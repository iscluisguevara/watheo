<?php
declare(strict_types=1);

/**
 * WATHEO - Endpoint de Monitoreo en Tiempo Real (GET)
 * Ruta: /backend/api/monitoreo.php
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';

configurarCabecerasApi(['GET']);

try {
    $db = conectarBD();

    $sql = "
        SELECT
            dispositivo_id,
            codigo_dispositivo,
            planta,
            region,
            humedad_suelo_minima,
            humedad_suelo_maxima,
            humedad_actual,
            temperatura_aire,
            humedad_aire,
            estado_humedad,
            CONVERT(VARCHAR(19), ultima_lectura, 120) AS ultima_lectura
        FROM dbo.vista_monitoreo_riego
        ORDER BY dispositivo_id
    ";

    $consulta = $db->query($sql);
    $dispositivos = $consulta->fetchAll(PDO::FETCH_ASSOC);

    if (isset($_GET['envoltorio']) && $_GET['envoltorio'] === '1') {
        responderJson(200, [
            'ok'                 => true,
            'proyecto'           => 'WATHEO',
            'total_dispositivos' => count($dispositivos),
            'dispositivos'       => $dispositivos,
        ]);
    }

    responderJson(200, $dispositivos);
} catch (Throwable $error) {
    error_log('[WATHEO api/monitoreo] ' . $error->getMessage());
    responderJson(500, [
        'ok'    => false,
        'error' => 'No fue posible consultar las mediciones en tiempo real'
    ]);
}
