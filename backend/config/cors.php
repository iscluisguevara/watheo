<?php
declare(strict_types=1);

/**
 * WATHEO - Configuración de CORS, Cabeceras HTTP y Respuestas JSON
 */

require_once __DIR__ . '/env.php';

function configurarCabecerasApi(array $metodosPermitidos = ['GET']): void
{
    $origenPermitido = env('CORS_ORIGIN', '*');
    $metodosTexto = implode(', ', array_unique(array_merge($metodosPermitidos, ['OPTIONS'])));

    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, private');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header("Access-Control-Allow-Origin: $origenPermitido");
    header("Access-Control-Allow-Methods: $metodosTexto");
    header('Access-Control-Allow-Headers: Content-Type, Accept, X-API-Key');

    $metodoActual = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($metodoActual === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    if (!in_array($metodoActual, $metodosPermitidos, true)) {
        header('Allow: ' . implode(', ', $metodosPermitidos));
        responderJson(405, [
            'ok'    => false,
            'error' => 'Método HTTP no permitido'
        ]);
    }
}

function responderJson(int $codigoHttp, array $datos): never
{
    http_response_code($codigoHttp);
    echo json_encode(
        $datos,
        JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
    );
    exit;
}
