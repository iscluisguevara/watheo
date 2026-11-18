#ifndef WATHEO_CONFIG_SENSORES_H
#define WATHEO_CONFIG_SENSORES_H

#include <Arduino.h>

// =============================================================================
// WATHEO - Configuración de Pines y Calibración de Sensores (ESP32-CAM)
// =============================================================================

// Pines físicos de conexión de sensores
#define PIN_SENSOR_DHT      13
#define TIPO_SENSOR_DHT     DHT11
#define PIN_SENSOR_SUELO    14    // ADC2: debe leerse con la radio Wi-Fi apagada

// Calibración empírica del sensor capacitivo de humedad de suelo (ADC 12 bits)
constexpr int ADC_SUELO_SECO        = 4095;
constexpr int ADC_SUELO_MOJADO      = 223;
constexpr int MUESTRAS_ADC_SUELO    = 10;

// Intervalo entre ciclos de lectura y transmisión (20 segundos)
constexpr unsigned long PAUSA_CICLO_MS = 20000;

// Identificación del nodo y portal cautivo de configuración
constexpr const char* CODIGO_DISPOSITIVO = "WATHEO-001";
constexpr const char* SSID_PORTAL_CONFIG = "WATHEO-CONFIG";
constexpr const char* CLAVE_PORTAL       = "Adminwhateo-2026";

// Endpoint HTTPS por defecto (configurable desde el portal cautivo sin reprogramar)
constexpr const char* URL_POR_DEFECTO =
    "https://watheo.tail667784.ts.net/backend/sensores/recibir.php";

#endif // WATHEO_CONFIG_SENSORES_H
