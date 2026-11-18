<?php
declare(strict_types=1);

/**
 * WATHEO - Pasarela de Retrocompatibilidad para Nodos ESP32 (/ingresar.php)
 * Permite que los dispositivos ESP32 previamente configurados con la ruta
 * `/ingresar.php` continúen reportando sin necesidad de reprogramarlos,
 * delegando toda la lógica al módulo `/backend/sensores/recibir.php`.
 */

require __DIR__ . '/backend/sensores/recibir.php';
