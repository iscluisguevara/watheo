<?php
declare(strict_types=1);

/**
 * WATHEO - Punto de Entrada Raíz
 * - Si se solicita ?datos=1 (retrocompatibilidad), delega a /backend/api/monitoreo.php
 * - En navegación normal desde el navegador, redirige a /frontend/index.html
 */

if (isset($_GET['datos'])) {
    require __DIR__ . '/backend/api/monitoreo.php';
    exit;
}

header('Cache-Control: no-store');
header('Location: ./frontend/index.html', true, 302);
exit;
