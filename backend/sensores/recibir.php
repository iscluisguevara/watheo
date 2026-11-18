<?php
declare(strict_types=1);

/**
 * WATHEO - Endpoint de Recepción de Telemetría de Sensores (POST)
 * Ruta: /backend/sensores/recibir.php
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/autenticacion.php';
require_once __DIR__ . '/validador.php';
require_once __DIR__ . '/conexion_sensor.php';

configurarCabecerasApi(['POST']);
verificarAutenticacionSensor();
$medicion = validarPayloadSensor();

try {
    $db = conectarBD();
    $resultado = guardarLecturaSensor($db, $medicion);

    if (!$resultado['encontrado']) {
        responderJson(404, [
            'ok'    => false,
            'error' => 'Dispositivo no registrado o inactivo en la base de datos'
        ]);
    }

    responderJson(201, [
        'ok'             => true,
        'estado'         => 'ok',
        'mensaje'        => 'Medición guardada correctamente en telemetría y tabla de registros',
        'dispositivo'    => $medicion['codigo_dispositivo'],
        'estado_humedad' => $resultado['estado_humedad'],
        'nivel_alerta'   => $resultado['nivel_alerta'],
    ]);
} catch (Throwable $error) {
    error_log('[WATHEO sensores/recibir] ' . $error->getMessage());
    responderJson(500, [
        'ok'    => false,
        'error' => 'Error interno del servidor al almacenar la lectura'
    ]);
}
