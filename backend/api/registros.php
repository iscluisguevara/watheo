<?php
declare(strict_types=1);

/**
 * WATHEO - Endpoint de Consulta de la Tabla de Registros / Bitácora (GET)
 * Ruta: /backend/api/registros.php
 *
 * Consulta la tabla `dbo.registros` (y la sincroniza automáticamente desde
 * `dbo.telemetria_sensores` si acaba de crearse), permitiendo filtrar por
 * dispositivo, nivel de alerta y límite de filas.
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../sensores/conexion_sensor.php';

configurarCabecerasApi(['GET']);

$codigo = trim((string)($_GET['codigo_dispositivo'] ?? ''));
$nivel  = strtoupper(trim((string)($_GET['nivel_alerta'] ?? 'TODOS')));
$limite = isset($_GET['limite']) && is_numeric($_GET['limite']) ? (int)$_GET['limite'] : 50;
$limite = max(1, min(200, $limite));

if ($codigo !== '' && !preg_match('/^[A-Za-z0-9_-]{1,60}$/D', $codigo)) {
    responderJson(400, [
        'ok'    => false,
        'error' => 'Código de dispositivo inválido'
    ]);
}

$nivelesPermitidos = ['TODOS', 'OPTIMO', 'CRITICO_BAJO', 'CRITICO_ALTO'];
if (!in_array($nivel, $nivelesPermitidos, true)) {
    responderJson(400, [
        'ok'    => false,
        'error' => 'Filtro de nivel_alerta inválido'
    ]);
}

try {
    $db = conectarBD();
    asegurarTablaRegistros($db);

    // Si dbo.registros existe y está vacía pero telemetria_sensores tiene datos, poblarla automáticamente
    try {
        $db->exec("
            IF OBJECT_ID(N'dbo.registros', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM dbo.registros)
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
                    estado_humedad,
                    nivel_alerta,
                    observaciones,
                    fecha_hora
                )
                SELECT TOP (500)
                    t.id,
                    t.dispositivo_id,
                    d.codigo_dispositivo,
                    ISNULL(v.planta, N'Cultivo Activo'),
                    ISNULL(v.region, N'Parcela Principal'),
                    t.temperatura_aire,
                    t.humedad_aire,
                    t.humedad_tierra,
                    CASE
                        WHEN t.humedad_tierra < ISNULL(v.humedad_suelo_minima, 35) THEN N'Humedad baja'
                        WHEN t.humedad_tierra > ISNULL(v.humedad_suelo_maxima, 75) THEN N'Humedad alta'
                        ELSE N'Dentro del rango'
                    END,
                    CASE
                        WHEN t.humedad_tierra < ISNULL(v.humedad_suelo_minima, 35) THEN 'CRITICO_BAJO'
                        WHEN t.humedad_tierra > ISNULL(v.humedad_suelo_maxima, 75) THEN 'CRITICO_ALTO'
                        ELSE 'OPTIMO'
                    END,
                    CASE
                        WHEN t.humedad_tierra < ISNULL(v.humedad_suelo_minima, 35)
                            THEN N'Humedad del suelo por debajo del umbral mínimo recomendado.'
                        WHEN t.humedad_tierra > ISNULL(v.humedad_suelo_maxima, 75)
                            THEN N'Humedad del suelo por encima del umbral máximo recomendado.'
                        ELSE N'Lectura registrada dentro del rango óptimo.'
                    END,
                    t.fecha_hora
                FROM dbo.telemetria_sensores t
                INNER JOIN dbo.dispositivos d ON d.id = t.dispositivo_id
                LEFT JOIN dbo.vista_monitoreo_riego v ON v.dispositivo_id = d.id
                ORDER BY t.fecha_hora ASC;
            END
        ");
    } catch (Throwable $syncErr) {
        error_log('[WATHEO sync registros] ' . $syncErr->getMessage());
    }

    // Verificar si la tabla dbo.registros está disponible
    $existeTabla = (bool)$db->query("SELECT CASE WHEN OBJECT_ID(N'dbo.registros', N'U') IS NOT NULL THEN 1 ELSE 0 END")->fetchColumn();

    $parametros = [];
    $condiciones = ['1 = 1'];

    if ($existeTabla) {
        if ($codigo !== '') {
            $condiciones[] = 'r.codigo_dispositivo = :codigo';
            $parametros[':codigo'] = $codigo;
        }
        if ($nivel !== 'TODOS') {
            $condiciones[] = 'r.nivel_alerta = :nivel';
            $parametros[':nivel'] = $nivel;
        }

        $whereSql = implode(' AND ', $condiciones);
        $sql = "
            SELECT TOP ($limite)
                r.id_registro,
                r.codigo_dispositivo,
                r.planta,
                r.region,
                r.temperatura_aire,
                r.humedad_aire,
                r.humedad_suelo,
                r.valor_adc,
                r.estado_humedad,
                r.nivel_alerta,
                r.observaciones,
                CONVERT(VARCHAR(19), r.fecha_hora, 120) AS fecha_hora
            FROM dbo.registros r
            WHERE $whereSql
            ORDER BY r.fecha_hora DESC, r.id_registro DESC
        ";
    } else {
        // Fallback de lectura directa si el usuario de BD no tiene permisos CREATE TABLE
        if ($codigo !== '') {
            $condiciones[] = 'd.codigo_dispositivo = :codigo';
            $parametros[':codigo'] = $codigo;
        }
        $whereSql = implode(' AND ', $condiciones);
        $sql = "
            SELECT TOP ($limite)
                t.id AS id_registro,
                d.codigo_dispositivo,
                ISNULL(v.planta, N'Cultivo Activo') AS planta,
                ISNULL(v.region, N'Parcela Principal') AS region,
                t.temperatura_aire,
                t.humedad_aire,
                t.humedad_tierra AS humedad_suelo,
                NULL AS valor_adc,
                CASE
                    WHEN t.humedad_tierra < ISNULL(v.humedad_suelo_minima, 35) THEN N'Humedad baja'
                    WHEN t.humedad_tierra > ISNULL(v.humedad_suelo_maxima, 75) THEN N'Humedad alta'
                    ELSE N'Dentro del rango'
                END AS estado_humedad,
                CASE
                    WHEN t.humedad_tierra < ISNULL(v.humedad_suelo_minima, 35) THEN 'CRITICO_BAJO'
                    WHEN t.humedad_tierra > ISNULL(v.humedad_suelo_maxima, 75) THEN 'CRITICO_ALTO'
                    ELSE 'OPTIMO'
                END AS nivel_alerta,
                N'Lectura obtenida del historial de sensores' AS observaciones,
                CONVERT(VARCHAR(19), t.fecha_hora, 120) AS fecha_hora
            FROM dbo.telemetria_sensores t
            INNER JOIN dbo.dispositivos d ON d.id = t.dispositivo_id
            LEFT JOIN dbo.vista_monitoreo_riego v ON v.dispositivo_id = d.id
            WHERE $whereSql
            ORDER BY t.fecha_hora DESC, t.id DESC
        ";
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($parametros);
    $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $registros = [];
    $optimos = 0;
    $criticosBajos = 0;
    $criticosAltos = 0;
    $sumaSuelo = 0.0;
    $sumaTemp = 0.0;
    $sumaAire = 0.0;

    foreach ($filas as $f) {
        $alerta = (string)($f['nivel_alerta'] ?? 'OPTIMO');
        if ($alerta === 'CRITICO_BAJO') {
            $criticosBajos++;
        } elseif ($alerta === 'CRITICO_ALTO') {
            $criticosAltos++;
        } else {
            $optimos++;
        }

        $sueloVal = round((float)$f['humedad_suelo'], 2);
        $tempVal  = round((float)$f['temperatura_aire'], 2);
        $aireVal  = round((float)$f['humedad_aire'], 2);

        $sumaSuelo += $sueloVal;
        $sumaTemp  += $tempVal;
        $sumaAire  += $aireVal;

        $registros[] = [
            'id_registro'        => (int)$f['id_registro'],
            'codigo_dispositivo' => (string)$f['codigo_dispositivo'],
            'planta'             => (string)$f['planta'],
            'region'             => (string)$f['region'],
            'humedad_suelo'      => $sueloVal,
            'temperatura_aire'   => $tempVal,
            'humedad_aire'       => $aireVal,
            'valor_adc'          => $f['valor_adc'] !== null ? (int)$f['valor_adc'] : null,
            'estado_humedad'     => (string)$f['estado_humedad'],
            'nivel_alerta'       => $alerta,
            'observaciones'      => (string)($f['observaciones'] ?? ''),
            'fecha_hora'         => (string)$f['fecha_hora'],
        ];
    }

    $total = count($registros);

    responderJson(200, [
        'ok'          => true,
        'proyecto'    => 'WATHEO',
        'tabla_origen'=> $existeTabla ? 'dbo.registros' : 'dbo.telemetria_sensores',
        'total'       => $total,
        'resumen'     => [
            'optimos'              => $optimos,
            'criticos_bajos'       => $criticosBajos,
            'criticos_altos'       => $criticosAltos,
            'promedio_suelo'       => $total > 0 ? round($sumaSuelo / $total, 1) : null,
            'promedio_temperatura' => $total > 0 ? round($sumaTemp / $total, 1) : null,
            'promedio_aire'        => $total > 0 ? round($sumaAire / $total, 1) : null,
        ],
        'registros'   => $registros,
    ]);
} catch (Throwable $error) {
    error_log('[WATHEO api/registros] ' . $error->getMessage());
    responderJson(500, [
        'ok'    => false,
        'error' => 'No fue posible consultar la tabla de registros'
    ]);
}
