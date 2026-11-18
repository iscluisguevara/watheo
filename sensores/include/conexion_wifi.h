#ifndef WATHEO_CONEXION_WIFI_H
#define WATHEO_CONEXION_WIFI_H

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include "config_sensores.h"

// =============================================================================
// WATHEO - Módulo de Conexión Wi-Fi y Portal Cautivo de Configuración
// =============================================================================

struct EstadoConexionRed {
    String  apiUrl;
    String  apiKey;
    String  wifiSsid;
    String  wifiPassword;
    uint8_t fallosConsecutivos = 0;
};

static EstadoConexionRed redWatheo;

inline void configurarRedYServidor() {
    Preferences pref;
    pref.begin("watheo", false);
    redWatheo.apiUrl = pref.getString("url", URL_POR_DEFECTO);
    redWatheo.apiKey = pref.getString("key", "");
    pref.end();

    WiFi.mode(WIFI_STA);
    WiFiManager wm;
    wm.setConnectTimeout(15);
    wm.setSaveConnectTimeout(20);
    wm.setConfigPortalTimeout(0);
    wm.setShowInfoErase(false);
    wm.setDebugOutput(false);

    WiFiManagerParameter parametroUrl(
        "api_url", "URL HTTPS de recepcion", redWatheo.apiUrl.c_str(), 180
    );
    WiFiManagerParameter parametroClave(
        "api_key", "Clave API (solo si desea configurar o cambiar)", "", 110
    );
    wm.addParameter(&parametroUrl);
    wm.addParameter(&parametroClave);

    bool guardoParametros = false;
    wm.setSaveParamsCallback([&guardoParametros]() {
        guardoParametros = true;
    });

    Serial.println("Configurando red WATHEO...");
    bool conectado = false;
    if (redWatheo.apiKey.length() < 32) {
        conectado = wm.startConfigPortal(SSID_PORTAL_CONFIG, CLAVE_PORTAL);
    } else {
        conectado = wm.autoConnect(SSID_PORTAL_CONFIG, CLAVE_PORTAL);
    }

    if (guardoParametros) {
        String nuevaUrl = String(parametroUrl.getValue());
        nuevaUrl.trim();
        String nuevaClave = String(parametroClave.getValue());
        nuevaClave.trim();

        if (nuevaUrl.startsWith("https://") && nuevaUrl.length() < 180) {
            redWatheo.apiUrl = nuevaUrl;
        }
        if (nuevaClave.length() >= 32 && nuevaClave.length() <= 110) {
            redWatheo.apiKey = nuevaClave;
        }

        pref.begin("watheo", false);
        pref.putString("url", redWatheo.apiUrl);
        pref.putString("key", redWatheo.apiKey);
        pref.end();
    }

    if (!conectado || WiFi.status() != WL_CONNECTED) {
        Serial.println("No se configuro el Wi-Fi; reiniciando...");
        delay(3000);
        ESP.restart();
    }

    redWatheo.wifiSsid     = WiFi.SSID();
    redWatheo.wifiPassword = WiFi.psk();
    Serial.print("Wi-Fi configurado: ");
    Serial.println(redWatheo.wifiSsid);

    if (redWatheo.apiKey.length() < 32) {
        Serial.println("Falta configurar clave API en WATHEO-CONFIG.");
        delay(5000);
    }

    WiFi.mode(WIFI_OFF);
}

inline bool reconectarWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(redWatheo.wifiSsid.c_str(), redWatheo.wifiPassword.c_str());

    unsigned long inicio = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - inicio < 15000) {
        delay(300);
    }

    if (WiFi.status() == WL_CONNECTED) {
        redWatheo.fallosConsecutivos = 0;
        Serial.print("Wi-Fi conectado. IP ESP32: ");
        Serial.println(WiFi.localIP());
        return true;
    }

    redWatheo.fallosConsecutivos++;
    Serial.println("Wi-Fi no disponible.");
    if (redWatheo.fallosConsecutivos >= 2) {
        redWatheo.fallosConsecutivos = 0;
        Serial.println("Abriendo portal para seleccionar otra red...");
        configurarRedYServidor();
    }
    return false;
}

#endif // WATHEO_CONEXION_WIFI_H
