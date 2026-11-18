# WATHEO IoT — Sistema de Monitoreo Agrícola y Riego Automatizado

Plataforma IoT para monitoreo agronómico en tiempo real mediante nodos **ESP32-CAM** (sensor ambiental **DHT11** y sensor capacitivo de **humedad de suelo**), API REST en **PHP 8+ (PDO SQL Server)** y aplicación web desacoplada.

---

## Arquitectura del Proyecto

```text
whateo-gaona/
├── frontend/                       # Aplicación Web Cliente (HTML5, CSS3, Vanilla JS)
│   ├── index.html                  # Vista principal (Resumen del Campo)
│   ├── pages/
│   │   ├── dashboard.html          # Panel de sensores y gráficas históricas
│   │   ├── registros.html          # Tabla de registros y bitácora (SQL Server)
│   │   └── asistente.html          # Asistente virtual agrícola Watheo
│   ├── css/
│   │   ├── main.css                # Sistema de diseño global
│   │   ├── inicio.css              # Estilos de vista de inicio
│   │   ├── dashboard.css           # Estilos de dashboard y gráficas
│   │   ├── registros.css           # Estilos de la tabla de registros y filtros
│   │   └── asistente.css           # Estilos del asistente virtual
│   ├── js/
│   │   ├── config.js               # Configuración de rutas y endpoints API
│   │   ├── api.js                  # Cliente HTTP y estado reactivo
│   │   ├── utils.js                # Utilidades de formato, salud y mascota
│   │   ├── inicio.js               # Controlador de vista principal
│   │   ├── dashboard.js            # Controlador de dashboard y Chart.js
│   │   ├── registros.js            # Controlador de tabla de registros y exportación CSV
│   │   └── asistente.js            # Controlador del chat agrícola
│   └── assets/                     # Íconos e ilustraciones SVG
│
├── backend/                        # Servidor API REST (PHP 8 + PDO SQL Server)
│   ├── config/
│   │   ├── env.php                 # Cargador de variables de entorno (.env)
│   │   ├── database.php            # Conexión singleton PDO a SQL Server
│   │   ├── cors.php                # Cabeceras HTTP, CORS y respuestas JSON
│   │   └── clave_dispositivo.txt   # Clave API local del nodo IoT (excluida de Git)
│   ├── sensores/                   # Conexión y recepción de sensores en Backend
│   │   ├── autenticacion.php       # Validación segura de X-API-Key (hash_equals)
│   │   ├── validador.php           # Sanitización y validación de rangos físicos
│   │   ├── conexion_sensor.php     # Persistencia en telemetría y tabla dbo.registros
│   │   └── recibir.php             # Endpoint POST para recepción de lecturas del ESP32
│   ├── api/                        # Endpoints de lectura para el Frontend
│   │   ├── monitoreo.php           # GET estado actual de dispositivos
│   │   ├── historial.php           # GET series históricas agrupadas (24h, 7d, 30d)
│   │   └── registros.php           # GET bitácora / tabla de registros filtrable
│   └── database/
│       └── schema.sql              # Esquema completo de BD, tabla dbo.registros y triggers
│
├── sensores/                       # Firmware y Conexión Hardware IoT (ESP32-CAM)
│   ├── platformio.ini              # Configuración de compilación PlatformIO
│   ├── watheo_sensores.ino         # Sketch para Arduino IDE
│   ├── include/
│   │   ├── config_sensores.h       # Pines GPIO, calibración ADC e intervalos
│   │   ├── certificados_tls.h      # Certificado raíz ISRG Root X1 (Let's Encrypt)
│   │   ├── lectura_sensores.h      # Conexión y lectura de DHT11 y suelo (ADC2)
│   │   ├── conexion_wifi.h         # Portal cautivo WiFiManager y reconexión
│   │   └── conexion_servidor.h     # Sincronización NTP y envío HTTPS POST
│   └── src/
│       └── main.cpp                # Ciclo principal modular del nodo sensor
│
├── index.php                       # Enrutador raíz hacia /frontend/index.html
├── ingresar.php                    # Pasarela compatible con ESP32 ya programados
├── .env.example                    # Plantilla de variables de entorno para producción
├── .htaccess                       # Protección de archivos sensibles en Apache
├── iniciar_servidor.ps1            # Arranque rápido en Windows (PowerShell)
└── iniciar_servidor.sh             # Arranque rápido en Linux / macOS
```

---

## Base de Datos y Tabla de Registros (`dbo.registros`)

El script [`backend/database/schema.sql`](./backend/database/schema.sql) es **idempotente** (seguro de ejecutar sobre una base de datos nueva o existente) e incluye:
1. **`dbo.cultivos`**: Catálogo de cultivos y sus umbrales óptimos de humedad y temperatura.
2. **`dbo.dispositivos`**: Nodos sensores registrados (`WATHEO-001`).
3. **`dbo.telemetria_sensores`**: Almacenamiento crudo de lecturas recibidas.
4. **`dbo.registros`**: Tabla de bitácora y auditoría que almacena cada lectura junto con su valor ADC, evaluación del umbral (`Dentro del rango`, `Humedad baja`, `Humedad alta`), nivel de alerta (`OPTIMO`, `CRITICO_BAJO`, `CRITICO_ALTO`) y observaciones agronómicas.
5. **Trigger `dbo.trg_telemetria_a_registros`**: Sincroniza automáticamente cada nueva inserción de sensor hacia `dbo.registros`, además de migrar el historial previo si la tabla se crea por primera vez.
6. **`dbo.vista_monitoreo_riego`**: Vista optimizada de última lectura por dispositivo.

> **Nota:** Adicionalmente, el servicio [`backend/sensores/conexion_sensor.php`](./backend/sensores/conexion_sensor.php) y el endpoint [`backend/api/registros.php`](./backend/api/registros.php) verifican y crean automáticamente la tabla `dbo.registros` si aún no existe en el servidor SQL.

---

## Ejecución y Despliegue en Internet

1. **Configurar variables de entorno**:
   Copia `.env.example` a `.env` y ajusta `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` y `WATHEO_API_KEY`.
2. **Iniciar servidor local**:
   - **Windows (PowerShell)**: `.\iniciar_servidor.ps1`
   - **Linux / macOS**: `./iniciar_servidor.sh`
3. **Endpoints de la API**:
   - `GET /backend/api/monitoreo.php` — Estado actual de los dispositivos.
   - `GET /backend/api/historial.php?codigo_dispositivo=WATHEO-001&periodo=24h` — Series de tiempo.
   - `GET /backend/api/registros.php?limite=50&nivel_alerta=TODOS` — Consulta de la tabla `dbo.registros`.
   - `POST /backend/sensores/recibir.php` (o `/ingresar.php`) — Recepción autenticada (`X-API-Key`) desde el ESP32.
# watheo
