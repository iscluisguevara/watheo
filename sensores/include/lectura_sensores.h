#ifndef WATHEO_LECTURA_SENSORES_H
#define WATHEO_LECTURA_SENSORES_H

#include <Arduino.h>
#include <WiFi.h>
#include <DHT.h>
#include <math.h>
#include "config_sensores.h"

// =============================================================================
// WATHEO - Módulo de Conexión Física y Lectura de Sensores (DHT11 + Suelo ADC)
// =============================================================================

struct MedicionSensores {
    float temperaturaAire;
    float humedadAire;
    float humedadSuelo;
    int   valorAdc;
    bool  esValida;
};

static DHT sensorDht(PIN_SENSOR_DHT, TIPO_SENSOR_DHT);

inline void inicializarSensores() {
    sensorDht.begin();
    analogReadResolution(12);
}

inline MedicionSensores leerSensoresFisicos() {
    // GPIO14 utiliza ADC2 en el ESP32: apagar radio Wi-Fi antes de muestrear
    WiFi.mode(WIFI_OFF);
    delay(1000);

    MedicionSensores lectura{};
    lectura.temperaturaAire = sensorDht.readTemperature();
    lectura.humedadAire     = sensorDht.readHumidity();

    long sumaAdc = 0;
    for (int i = 0; i < MUESTRAS_ADC_SUELO; i++) {
        sumaAdc += analogRead(PIN_SENSOR_SUELO);
        delay(20);
    }
    lectura.valorAdc = static_cast<int>(sumaAdc / MUESTRAS_ADC_SUELO);

    if (
        isnan(lectura.temperaturaAire) ||
        isnan(lectura.humedadAire) ||
        lectura.temperaturaAire < -40.0f || lectura.temperaturaAire > 85.0f ||
        lectura.humedadAire < 0.0f || lectura.humedadAire > 100.0f ||
        lectura.valorAdc == 0
    ) {
        lectura.esValida = false;
        return lectura;
    }

    float porcentajeSuelo =
        (ADC_SUELO_SECO - lectura.valorAdc) * 100.0f /
        (ADC_SUELO_SECO - ADC_SUELO_MOJADO);

    lectura.humedadSuelo = constrain(porcentajeSuelo, 0.0f, 100.0f);
    lectura.esValida     = true;
    return lectura;
}

#endif // WATHEO_LECTURA_SENSORES_H
