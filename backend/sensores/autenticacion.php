<?php
declare(strict_types=1);

/**
 * WATHEO - Autenticación de Nodos Sensores (ESP32)
 * Verifica la cabecera X-API-Key contra la variable de entorno WATHEO_API_KEY
 * o el archivo local clave_dispositivo.txt usando comparación en tiempo constante.
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/cors.php';

function obtenerClaveEsperadaSensor(): string
{
    $claveEnv = env('WATHEO_API_KEY', '');
    if (strlen($claveEnv) >= 32) {
        return $claveEnv;
    }

    $archivoClave = __DIR__ . '/../config/clave_dispositivo.txt';
    if (is_file($archivoClave) && is_readable($archivoClave)) {
        $contenido = trim((string)file_get_contents($archivoClave));
        if (strlen($contenido) >= 32) {
            return $contenido;
        }
    }

    return '';
}

function verificarAutenticacionSensor(): void
{
    $claveEsperada = obtenerClaveEsperadaSensor();
    $claveRecibida = trim((string)($_SERVER['HTTP_X_API_KEY'] ?? ''));

    if (
        $claveEsperada === '' ||
        strlen($claveEsperada) < 32 ||
        $claveRecibida === '' ||
        !hash_equals($claveEsperada, $claveRecibida)
    ) {
        responderJson(401, [
            'ok'    => false,
            'error' => 'Dispositivo sensor no autorizado (X-API-Key inválida o ausente)'
        ]);
    }
}
