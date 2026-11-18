<?php
declare(strict_types=1);

/**
 * WATHEO - Servicio de Conexión y Persistencia de Sensores
 * Registra la telemetría recibida del ESP32 en `dbo.telemetria_sensores` y
 * mantiene sincronizada la tabla de bitácora `dbo.registros`.
 */

require_once __DIR__ . '/../config/database.php';

/**
 * Garantiza que la tabla `dbo.registros` exista en SQL Server y esté poblada
 * con los datos históricos existentes si acaba de crearse.
 */
function asegurarTablaRegistros(PDO $db): void
{
    static $verificada = false;
    if ($verificada) {
        return;
    }

    try {
        $sqlCrear = "
            IF OBJECT_ID(N'dbo.registros', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.registros (
                    id_registro BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    telemetria_id BIGINT NULL,
                    dispositivo_id INT NOT NULL,
                    codigo_dispositivo VARCHAR(60) NOT NULL,
                    planta NVARCHAR(100) NOT NULL DEFAULT N'Sin asignar',
                    region NVARCHAR(120) NOT NULL DEFAULT N'Parcela General',
                    temperatura_aire DECIMAL(5,2) NOT NULL,
                    humedad_aire DECIMAL(5,2) NOT NULL,
                    humedad_suelo DECIMAL(5,2) NOT NULL,
                    valor_adc INT NULL,
                    estado_humedad NVARCHAR(40) NOT NULL,
                    nivel_alerta VARCHAR(20) NOT NULL DEFAULT 'OPTIMO',
                    observaciones NVARCHAR(255) NULL,
                    fecha_hora DATETIME2(0) NOT NULL DEFAULT SYSDATETIME()
                );

                CREATE INDEX IX_registros_fecha_hora
                    ON dbo.registros (fecha_hora DESC);

                CREATE INDEX IX_registros_codigo_fecha
                    ON dbo.registros (codigo_dispositivo, fecha_hora DESC);
            END
        ";
        $db->exec($sqlCrear);
        $verificada = true;
    } catch (Throwable $e) {
        // Si el usuario de BD es de solo lectura/escritura sin permiso DDL, continuar sin interrumpir.
        error_log('[WATHEO asegurarTablaRegistros] ' . $e->getMessage());
    }
}

/**
 * Guarda la medición del nodo sensor tanto en `dbo.telemetria_sensores` como en `dbo.registros`.
 */
function guardarLecturaSensor(PDO $db, array $medicion): array
{
    asegurarTablaRegistros($db);

    $stmtDisp = $db->prepare("
        SELECT TOP (1)
            d.id,
            d.codigo_dispositivo,
            c.humedad_suelo_minima,
            c.humedad_suelo_maxima
        FROM dbo.dispositivos d
        LEFT JOIN dbo.cultivos c ON c.id_cultivo = d.cultivo_id
        WHERE d.codigo_dispositivo = :codigo
          AND d.estado = 'Activo'
    ");
    $stmtDisp->execute([':codigo' => $medicion['codigo_dispositivo']]);
    $dispositivo = $stmtDisp->fetch(PDO::FETCH_ASSOC);

    if (!$dispositivo) {
        return [
            'encontrado' => false
        ];
    }

    $dispositivoId = (int)$dispositivo['id'];
    $minimo = isset($dispositivo['humedad_suelo_minima']) ? (float)$dispositivo['humedad_suelo_minima'] : 35.0;
    $maximo = isset($dispositivo['humedad_suelo_maxima']) ? (float)$dispositivo['humedad_suelo_maxima'] : 75.0;

    // 1. Insertar en dbo.telemetria_sensores
    $stmtInsert = $db->prepare("
        INSERT INTO dbo.telemetria_sensores
            (dispositivo_id, temperatura_aire, humedad_aire, humedad_tierra)
        VALUES
            (:dispositivo_id, :temperatura, :aire, :suelo)
    ");
    $stmtInsert->execute([
        ':dispositivo_id' => $dispositivoId,
        ':temperatura'    => $medicion['temperatura_aire'],
        ':aire'           => $medicion['humedad_aire'],
        ':suelo'          => $medicion['humedad_tierra'],
    ]);

    $telemetriaId = null;
    try {
        $idRaw = $db->lastInsertId();
        $telemetriaId = is_numeric($idRaw) ? (int)$idRaw : null;
    } catch (Throwable) {
        $telemetriaId = null;
    }

    // Evaluar diagnóstico agronómico para la tabla de registros
    $suelo = (float)$medicion['humedad_tierra'];
    if ($suelo < $minimo) {
        $estadoHumedad = 'Humedad baja';
        $nivelAlerta = 'CRITICO_BAJO';
        $observaciones = "Suelo bajo el umbral mínimo configurado ({$minimo}%). Se recomienda revisar riego.";
    } elseif ($suelo > $maximo) {
        $estadoHumedad = 'Humedad alta';
        $nivelAlerta = 'CRITICO_ALTO';
        $observaciones = "Suelo sobre el umbral máximo configurado ({$maximo}%). Suspender riego.";
    } else {
        $estadoHumedad = 'Dentro del rango';
        $nivelAlerta = 'OPTIMO';
        $observaciones = "Medición dentro del rango óptimo ({$minimo}% - {$maximo}%).";
    }

    // 2. Insertar en dbo.registros (si no fue insertado ya por el trigger de BD)
    try {
        $stmtMeta = $db->prepare("
            SELECT TOP (1)
                planta,
                region
            FROM dbo.vista_monitoreo_riego
            WHERE codigo_dispositivo = :codigo
        ");
        $stmtMeta->execute([':codigo' => $medicion['codigo_dispositivo']]);
        $meta = $stmtMeta->fetch(PDO::FETCH_ASSOC) ?: [];
        $planta = (string)($meta['planta'] ?? 'Cultivo Activo');
        $region = (string)($meta['region'] ?? 'Parcela Principal');

        $stmtReg = $db->prepare("
            IF OBJECT_ID(N'dbo.registros', N'U') IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM dbo.registros
                WHERE telemetria_id IS NOT NULL AND telemetria_id = :telemetria_id_check
            )
            BEGIN
                INSERT INTO dbo.registros (
                    telemetria_id,
                    dispositivo_id,
                    codigo_dispositivo,
                    planta,
                    region,
                    temperatura_aire,
                    humedad_aire,
                    humedad_suelo,
                    valor_adc,
                    estado_humedad,
                    nivel_alerta,
                    observaciones
                ) VALUES (
                    :telemetria_id,
                    :dispositivo_id,
                    :codigo,
                    :planta,
                    :region,
                    :temperatura,
                    :aire,
                    :suelo,
                    :adc,
                    :estado_humedad,
                    :nivel_alerta,
                    :observaciones
                );
            END
        ");
        $stmtReg->execute([
            ':telemetria_id_check' => $telemetriaId ?? -1,
            ':telemetria_id'       => $telemetriaId,
            ':dispositivo_id'      => $dispositivoId,
            ':codigo'              => $medicion['codigo_dispositivo'],
            ':planta'              => $planta,
            ':region'              => $region,
            ':temperatura'         => $medicion['temperatura_aire'],
            ':aire'                => $medicion['humedad_aire'],
            ':suelo'               => $medicion['humedad_tierra'],
            ':adc'                 => $medicion['valor_adc'],
            ':estado_humedad'      => $estadoHumedad,
            ':nivel_alerta'        => $nivelAlerta,
            ':observaciones'       => $observaciones,
        ]);
    } catch (Throwable $e) {
        error_log('[WATHEO registro bitacora] ' . $e->getMessage());
    }

    return [
        'encontrado'     => true,
        'dispositivo_id' => $dispositivoId,
        'estado_humedad' => $estadoHumedad,
        'nivel_alerta'   => $nivelAlerta,
    ];
}
