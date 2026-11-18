<?php
declare(strict_types=1);

/**
 * WATHEO - Validador de Telemetría de Sensores
 * Sanitiza y valida rangos físicos del DHT11 y del sensor capacitivo de humedad de suelo.
 */

require_once __DIR__ . '/../config/cors.php';

function validarPayloadSensor(): array
{
    $cuerpoCrudo = file_get_contents('php://input');
    $datos = is_string($cuerpoCrudo) ? json_decode($cuerpoCrudo, true) : null;

    if (!is_array($datos)) {
        responderJson(400, [
            'ok'    => false,
            'error' => 'El cuerpo de la petición no es un JSON válido'
        ]);
    }

    $camposRequeridos = [
        'codigo_dispositivo',
        'temperatura_aire',
        'humedad_aire',
        'humedad_tierra',
    ];

    foreach ($camposRequeridos as $campo) {
        if (!isset($datos[$campo])) {
            responderJson(400, [
                'ok'    => false,
                'error' => "Falta el campo obligatorio: $campo"
            ]);
        }
    }

    $codigo = trim((string)$datos['codigo_dispositivo']);
    if ($codigo === '' || !preg_match('/^[A-Za-z0-9_-]{1,60}$/D', $codigo)) {
        responderJson(400, [
            'ok'    => false,
            'error' => 'Código de dispositivo inválido'
        ]);
    }

    foreach (['temperatura_aire', 'humedad_aire', 'humedad_tierra'] as $campoNumerico) {
        if (!is_numeric($datos[$campoNumerico])) {
            responderJson(400, [
                'ok'    => false,
                'error' => "Valor numérico inválido en: $campoNumerico"
            ]);
        }
    }

    $temperatura = round((float)$datos['temperatura_aire'], 2);
    $humedadAire = round((float)$datos['humedad_aire'], 2);
    $humedadSuelo = round((float)$datos['humedad_tierra'], 2);

    $valorAdc = null;
    if (isset($datos['valor_adc']) && is_numeric($datos['valor_adc'])) {
        $valorAdc = (int)$datos['valor_adc'];
        if ($valorAdc < 0 || $valorAdc > 4095) {
            responderJson(400, [
                'ok'    => false,
                'error' => 'Valor ADC fuera de rango (0 - 4095)'
            ]);
        }
    }

    if (
        !is_finite($temperatura) ||
        !is_finite($humedadAire) ||
        !is_finite($humedadSuelo) ||
        $temperatura < -40.0 || $temperatura > 85.0 ||
        $humedadAire < 0.0 || $humedadAire > 100.0 ||
        $humedadSuelo < 0.0 || $humedadSuelo > 100.0
    ) {
        responderJson(400, [
            'ok'    => false,
            'error' => 'Mediciones fuera de rango físico permitido'
        ]);
    }

    return [
        'codigo_dispositivo' => $codigo,
        'temperatura_aire'   => $temperatura,
        'humedad_aire'       => $humedadAire,
        'humedad_tierra'     => $humedadSuelo,
        'valor_adc'          => $valorAdc,
    ];
}
