<?php
declare(strict_types=1);

/**
 * WATHEO - Endpoint de Historial Agrupado para Gráficas (GET)
 * Ruta: /backend/api/historial.php
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';

configurarCabecerasApi(['GET']);

$codigo = trim((string)($_GET['codigo_dispositivo'] ?? 'WATHEO-001'));
$periodo = (string)($_GET['periodo'] ?? '24h');

if (!preg_match('/^[A-Za-z0-9_-]{1,60}$/D', $codigo)) {
    responderJson(400, [
        'ok'    => false,
        'error' => 'Código de dispositivo inválido'
    ]);
}

$configPeriodos = [
    '24h' => ['horas' => 24,  'minutos' => 15],
    '7d'  => ['horas' => 168, 'minutos' => 60],
    '30d' => ['horas' => 720, 'minutos' => 360],
];

if (!isset($configPeriodos[$periodo])) {
    responderJson(400, [
        'ok'    => false,
        'error' => 'Período no válido (use 24h, 7d o 30d)'
    ]);
}

try {
    $db = conectarBD();
    $horas = $configPeriodos[$periodo]['horas'];
    $minutos = $configPeriodos[$periodo]['minutos'];

    $bucket = "DATEADD(MINUTE, (DATEDIFF(MINUTE, CONVERT(datetime2,'20000101'), t.fecha_hora) / $minutos) * $minutos, CONVERT(datetime2,'20000101'))";

    $sql = "
        SELECT TOP (200)
            CONVERT(varchar(19), $bucket, 126) AS fecha_hora,
            AVG(CAST(t.humedad_tierra AS float)) AS humedad_suelo,
            AVG(CAST(t.humedad_aire AS float)) AS humedad_aire,
            AVG(CAST(t.temperatura_aire AS float)) AS temperatura_aire
        FROM dbo.telemetria_sensores t
        INNER JOIN dbo.dispositivos d ON d.id = t.dispositivo_id
        WHERE d.codigo_dispositivo = :codigo
          AND t.fecha_hora >= DATEADD(HOUR, -$horas, SYSDATETIME())
        GROUP BY $bucket
        ORDER BY $bucket DESC
    ";

    $stmt = $db->prepare($sql);
    $stmt->execute([':codigo' => $codigo]);
    $filas = array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC));

    $lecturas = array_map(static function (array $fila): array {
        return [
            'fecha_hora'       => (string)$fila['fecha_hora'],
            'humedad_suelo'    => $fila['humedad_suelo'] !== null ? round((float)$fila['humedad_suelo'], 2) : null,
            'humedad_aire'     => $fila['humedad_aire'] !== null ? round((float)$fila['humedad_aire'], 2) : null,
            'temperatura_aire' => $fila['temperatura_aire'] !== null ? round((float)$fila['temperatura_aire'], 2) : null,
        ];
    }, $filas);

    $stmtAntiguedad = $db->prepare("
        SELECT TOP (1)
            c.humedad_suelo_minima AS minimo,
            c.humedad_suelo_maxima AS maximo,
            DATEDIFF(SECOND, ultimo.fecha_hora, SYSDATETIME()) AS segundos
        FROM dbo.dispositivos d
        INNER JOIN dbo.cultivos c ON c.id_cultivo = d.cultivo_id
        OUTER APPLY (
            SELECT TOP (1) t.fecha_hora
            FROM dbo.telemetria_sensores t
            WHERE t.dispositivo_id = d.id
            ORDER BY t.fecha_hora DESC, t.id DESC
        ) ultimo
        WHERE d.codigo_dispositivo = :codigo
    ");
    $stmtAntiguedad->execute([':codigo' => $codigo]);
    $detalle = $stmtAntiguedad->fetch(PDO::FETCH_ASSOC) ?: [];
    $segundos = $detalle['segundos'] ?? null;

    responderJson(200, [
        'ok'                   => true,
        'proyecto'             => 'WATHEO',
        'codigo_dispositivo'   => $codigo,
        'periodo'              => $periodo,
        'intervalo_minutos'    => $minutos,
        'segundos_sin_datos'   => $segundos === null ? null : max(0, (int)$segundos),
        'humedad_suelo_minima' => isset($detalle['minimo']) ? (float)$detalle['minimo'] : null,
        'humedad_suelo_maxima' => isset($detalle['maximo']) ? (float)$detalle['maximo'] : null,
        'total'                => count($lecturas),
        'lecturas'             => $lecturas,
    ]);
} catch (Throwable $error) {
    error_log('[WATHEO api/historial] ' . $error->getMessage());
    responderJson(500, [
        'ok'    => false,
        'error' => 'No fue posible consultar el historial de sensores'
    ]);
}
