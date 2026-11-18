// =============================================================================
// WATHEO - Punto de Entrada Principal del Nodo Sensor (ESP32-CAM)
// Arquitectura modular:
//   - include/config_sensores.h   : Pines y constantes de calibración
//   - include/lectura_sensores.h  : Lectura de DHT11 y humedad de suelo (ADC)
//   - include/conexion_wifi.h     : Gestión Wi-Fi y portal cautivo
//   - include/conexion_servidor.h : Sincronización TLS y envío HTTPS POST
// =============================================================================

#include <Arduino.h>
#include "config_sensores.h"
#include "lectura_sensores.h"
#include "conexion_wifi.h"
#include "conexion_servidor.h"

void setup() {
    Serial.begin(115200);
    delay(1500);
    inicializarSensores();
    Serial.println("\n===== WATHEO - NODO DE SENSORES IoT =====");
    configurarRedYServidor();
}

void loop() {
    MedicionSensores lectura = leerSensoresFisicos();

    if (!lectura.esValida) {
        Serial.println("Lectura de sensores invalida, descartando ciclo.");
        delay(PAUSA_CICLO_MS);
        return;
    }

    Serial.println("\n--- LECTURA DE SENSORES WATHEO ---");
    Serial.printf("Temperatura aire : %.2f C\n", lectura.temperaturaAire);
    Serial.printf("Humedad aire     : %.2f %%\n", lectura.humedadAire);
    Serial.printf("ADC suelo        : %d\n", lectura.valorAdc);
    Serial.printf("Humedad suelo    : %.2f %%\n", lectura.humedadSuelo);

    if (reconectarWiFi()) {
        enviarMedicionAlBackend(lectura);
    }

    delay(PAUSA_CICLO_MS);
}
