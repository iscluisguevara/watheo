#ifndef WATHEO_CONEXION_SERVIDOR_H
#define WATHEO_CONEXION_SERVIDOR_H

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <time.h>
#include "config_sensores.h"
#include "certificados_tls.h"
#include "lectura_sensores.h"
#include "conexion_wifi.h"

// =============================================================================
// WATHEO - Módulo de Sincronización NTP y Envío HTTPS al Servidor Backend
// =============================================================================

inline bool sincronizarHoraTls() {
    time_t ahora = time(nullptr);
    if (ahora >= 1700000000) {
        return true;
    }

    configTime(0, 0, "pool.ntp.org", "time.google.com");
    unsigned long inicio = millis();
    while (millis() - inicio < 12000) {
        time(&ahora);
        if (ahora >= 1700000000) {
            return true;
        }
        delay(400);
    }

    Serial.println("No se pudo obtener hora NTP para validar certificado TLS.");
    return false;
}

inline void enviarMedicionAlBackend(const MedicionSensores& m) {
    if (redWatheo.apiKey.length() < 32) {
        Serial.println("Sin clave API configurada. No se enviara medicion.");
        return;
    }
    if (!sincronizarHoraTls()) {
        return;
    }

    WiFiClientSecure clienteTls;
    clienteTls.setCACert(CERTIFICADO_ISRG_ROOT_X1);

    HTTPClient http;
    if (!http.begin(clienteTls, redWatheo.apiUrl)) {
        Serial.println("No se pudo abrir la URL HTTPS del backend.");
        return;
    }

    http.setTimeout(12000);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", redWatheo.apiKey);

    String payloadJson = "{";
    payloadJson += "\"codigo_dispositivo\":\"" + String(CODIGO_DISPOSITIVO) + "\",";
    payloadJson += "\"temperatura_aire\":" + String(m.temperaturaAire, 2) + ",";
    payloadJson += "\"humedad_aire\":" + String(m.humedadAire, 2) + ",";
    payloadJson += "\"humedad_tierra\":" + String(m.humedadSuelo, 2) + ",";
    payloadJson += "\"valor_adc\":" + String(m.valorAdc);
    payloadJson += "}";

    int codigoHttp = http.POST(payloadJson);
    Serial.print("Respuesta HTTP Backend: ");
    Serial.println(codigoHttp);

    if (codigoHttp == 201) {
        Serial.println("Medicion almacenada correctamente en WATHEO.");
    } else if (codigoHttp > 0) {
        Serial.println(http.getString());
    } else {
        Serial.println(http.errorToString(codigoHttp));
    }

    http.end();
}

#endif // WATHEO_CONEXION_SERVIDOR_H
