<?php
declare(strict_types=1);

/**
 * WATHEO - Conexión a Base de Datos SQL Server
 * Soporta tanto autenticación integrada de Windows (entorno local) como
 * credenciales SQL (usuario/contraseña) para despliegue en internet/nube.
 */

require_once __DIR__ . '/env.php';

function conectarBD(): PDO
{
    static $instancia = null;
    if ($instancia instanceof PDO) {
        return $instancia;
    }

    $servidor  = env('DB_HOST', 'Bryan_LAP\SQLEXPRESS');
    $baseDatos = env('DB_NAME', 'WATHEO');
    $usuario   = env('DB_USER', '');
    $password  = env('DB_PASS', '');
    $encrypt   = env('DB_ENCRYPT', 'yes');
    $trustCert = env('DB_TRUST_CERT', 'yes');

    $dsn = "sqlsrv:Server=$servidor;Database=$baseDatos;Encrypt=$encrypt;TrustServerCertificate=$trustCert";

    $instancia = new PDO(
        $dsn,
        $usuario !== '' ? $usuario : null,
        $password !== '' ? $password : null,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    return $instancia;
}
