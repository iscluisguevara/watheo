<?php
declare(strict_types=1);

/**
 * WATHEO - Cargador de Variables de Entorno (.env)
 * Permite configurar credenciales de base de datos y claves API sin exponerlas en el código.
 */

function cargarEntorno(?string $rutaArchivo = null): void
{
    static $cargado = false;
    if ($cargado) {
        return;
    }

    $rutasPosibles = $rutaArchivo
        ? [$rutaArchivo]
        : [
            dirname(__DIR__, 2) . '/.env',
            dirname(__DIR__) . '/.env',
        ];

    foreach ($rutasPosibles as $archivo) {
        if (!is_file($archivo) || !is_readable($archivo)) {
            continue;
        }

        $lineas = file($archivo, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lineas)) {
            continue;
        }

        foreach ($lineas as $linea) {
            $linea = trim($linea);
            if ($linea === '' || str_starts_with($linea, '#')) {
                continue;
            }

            $partes = explode('=', $linea, 2);
            if (count($partes) !== 2) {
                continue;
            }

            $clave = trim($partes[0]);
            $valor = trim($partes[1]);
            $valor = trim($valor, "\"'");

            if ($clave !== '' && getenv($clave) === false) {
                putenv("$clave=$valor");
                $_ENV[$clave] = $valor;
            }
        }
        break;
    }

    $cargado = true;
}

function env(string $clave, string $porDefecto = ''): string
{
    cargarEntorno();
    $valor = getenv($clave);
    if ($valor !== false && $valor !== '') {
        return (string)$valor;
    }
    if (isset($_ENV[$clave]) && $_ENV[$clave] !== '') {
        return (string)$_ENV[$clave];
    }
    return $porDefecto;
}
