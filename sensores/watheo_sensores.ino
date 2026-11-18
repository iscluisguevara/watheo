// =============================================================================
// WATHEO - Sketch para Arduino IDE (Delega en los módulos de ./include/)
// =============================================================================

#include "include/config_sensores.h"
#include "include/certificados_tls.h"
#include "include/lectura_sensores.h"
#include "include/conexion_wifi.h"
#include "include/conexion_servidor.h"

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
