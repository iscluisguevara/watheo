-- =============================================================================
-- WATHEO IoT - Esquema de Base de Datos y Tabla de Registros (SQL Server)
-- Seguro de ejecutar sobre una base de datos nueva o una existente (idempotente)
-- =============================================================================

IF DB_ID(N'WATHEO') IS NULL
BEGIN
    CREATE DATABASE [WATHEO];
END
GO

USE [WATHEO];
GO

-- -----------------------------------------------------------------------------
-- 1. Tabla de Cultivos (Umbrales agronómicos por tipo de planta)
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.cultivos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.cultivos (
        id_cultivo INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        nombre NVARCHAR(100) NOT NULL,
        region NVARCHAR(120) NOT NULL DEFAULT N'Parcela Principal',
        humedad_suelo_minima DECIMAL(5,2) NOT NULL DEFAULT 35.00,
        humedad_suelo_maxima DECIMAL(5,2) NOT NULL DEFAULT 75.00,
        temperatura_optima_min DECIMAL(5,2) NOT NULL DEFAULT 18.00,
        temperatura_optima_max DECIMAL(5,2) NOT NULL DEFAULT 28.00,
        fecha_creacion DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT CK_cultivos_humedad_rango CHECK (
            humedad_suelo_minima >= 0 AND
            humedad_suelo_maxima <= 100 AND
            humedad_suelo_minima < humedad_suelo_maxima
        )
    );
END
GO

-- -----------------------------------------------------------------------------
-- 2. Tabla de Dispositivos / Nodos IoT (ESP32)
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.dispositivos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.dispositivos (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        codigo_dispositivo VARCHAR(60) NOT NULL UNIQUE,
        cultivo_id INT NOT NULL,
        ubicacion_parcela NVARCHAR(150) NOT NULL DEFAULT N'Invernadero Central',
        estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
        fecha_alta DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_dispositivos_cultivos FOREIGN KEY (cultivo_id)
            REFERENCES dbo.cultivos(id_cultivo)
    );
END
GO

-- -----------------------------------------------------------------------------
-- 3. Tabla de Telemetría Cruda de Sensores
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.telemetria_sensores', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.telemetria_sensores (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        dispositivo_id INT NOT NULL,
        temperatura_aire DECIMAL(5,2) NOT NULL,
        humedad_aire DECIMAL(5,2) NOT NULL,
        humedad_tierra DECIMAL(5,2) NOT NULL,
        valor_adc INT NULL,
        fecha_hora DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_telemetria_dispositivos FOREIGN KEY (dispositivo_id)
            REFERENCES dbo.dispositivos(id)
    );

    CREATE INDEX IX_telemetria_dispositivo_fecha
        ON dbo.telemetria_sensores (dispositivo_id, fecha_hora DESC);
END
ELSE IF COL_LENGTH('dbo.telemetria_sensores', 'valor_adc') IS NULL
BEGIN
    ALTER TABLE dbo.telemetria_sensores ADD valor_adc INT NULL;
END
GO

-- -----------------------------------------------------------------------------
-- 4. TABLA DE REGISTROS (Bitácora de lecturas, diagnóstico y eventos IoT)
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.registros', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.registros (
        id_registro BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        telemetria_id BIGINT NULL,
        dispositivo_id INT NOT NULL,
        codigo_dispositivo VARCHAR(60) NOT NULL,
        planta NVARCHAR(100) NOT NULL DEFAULT N'Sin asignar',
        region NVARCHAR(120) NOT NULL DEFAULT N'Parcela General',
        temperatura_aire DECIMAL(5,2) NOT NULL,
        humedad_aire DECIMAL(5,2) NOT NULL,
        humedad_suelo DECIMAL(5,2) NOT NULL,
        valor_adc INT NULL,
        estado_humedad NVARCHAR(40) NOT NULL,
        nivel_alerta VARCHAR(20) NOT NULL DEFAULT 'OPTIMO',
        observaciones NVARCHAR(255) NULL,
        fecha_hora DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_registros_dispositivos FOREIGN KEY (dispositivo_id)
            REFERENCES dbo.dispositivos(id)
    );

    CREATE INDEX IX_registros_fecha_hora
        ON dbo.registros (fecha_hora DESC);

    CREATE INDEX IX_registros_codigo_fecha
        ON dbo.registros (codigo_dispositivo, fecha_hora DESC);

    CREATE INDEX IX_registros_nivel_alerta
        ON dbo.registros (nivel_alerta, fecha_hora DESC);
END
GO

-- -----------------------------------------------------------------------------
-- 5. Trigger Automático: Sincroniza cada lectura de sensor en dbo.registros
-- -----------------------------------------------------------------------------
CREATE OR ALTER TRIGGER dbo.trg_telemetria_a_registros
ON dbo.telemetria_sensores
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.registros (
        telemetria_id,
        dispositivo_id,
        codigo_dispositivo,
        planta,
        region,
        temperatura_aire,
        humedad_aire,
        humedad_suelo,
        valor_adc,
        estado_humedad,
        nivel_alerta,
        observaciones,
        fecha_hora
    )
    SELECT
        i.id,
        i.dispositivo_id,
        d.codigo_dispositivo,
        ISNULL(c.nombre, N'Cultivo General'),
        ISNULL(c.region, N'Parcela Principal'),
        i.temperatura_aire,
        i.humedad_aire,
        i.humedad_tierra,
        i.valor_adc,
        CASE
            WHEN i.humedad_tierra < ISNULL(c.humedad_suelo_minima, 35) THEN N'Humedad baja'
            WHEN i.humedad_tierra > ISNULL(c.humedad_suelo_maxima, 75) THEN N'Humedad alta'
            ELSE N'Dentro del rango'
        END,
        CASE
            WHEN i.humedad_tierra < ISNULL(c.humedad_suelo_minima, 35) THEN 'CRITICO_BAJO'
            WHEN i.humedad_tierra > ISNULL(c.humedad_suelo_maxima, 75) THEN 'CRITICO_ALTO'
            ELSE 'OPTIMO'
        END,
        CASE
            WHEN i.humedad_tierra < ISNULL(c.humedad_suelo_minima, 35)
                THEN N'Suelo por debajo del umbral mínimo recomendado (' + CAST(ISNULL(c.humedad_suelo_minima, 35) AS NVARCHAR(10)) + N'%).'
            WHEN i.humedad_tierra > ISNULL(c.humedad_suelo_maxima, 75)
                THEN N'Suelo por encima del umbral máximo recomendado (' + CAST(ISNULL(c.humedad_suelo_maxima, 75) AS NVARCHAR(10)) + N'%).'
            ELSE N'Lectura recibida dentro de parámetros normales.'
        END,
        ISNULL(i.fecha_hora, SYSDATETIME())
    FROM inserted i
    INNER JOIN dbo.dispositivos d ON d.id = i.dispositivo_id
    LEFT JOIN dbo.cultivos c ON c.id_cultivo = d.cultivo_id
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.registros r
        WHERE r.telemetria_id = i.id
    );
END
GO

-- -----------------------------------------------------------------------------
-- 6. Migración inicial de historial existente hacia dbo.registros (si está vacía)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.registros)
   AND OBJECT_ID(N'dbo.telemetria_sensores', N'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.registros (
        telemetria_id,
        dispositivo_id,
        codigo_dispositivo,
        planta,
        region,
        temperatura_aire,
        humedad_aire,
        humedad_suelo,
        valor_adc,
        estado_humedad,
        nivel_alerta,
        observaciones,
        fecha_hora
    )
    SELECT TOP (1000)
        t.id,
        t.dispositivo_id,
        d.codigo_dispositivo,
        ISNULL(c.nombre, N'Cultivo General'),
        ISNULL(c.region, N'Parcela Principal'),
        t.temperatura_aire,
        t.humedad_aire,
        t.humedad_tierra,
        t.valor_adc,
        CASE
            WHEN t.humedad_tierra < ISNULL(c.humedad_suelo_minima, 35) THEN N'Humedad baja'
            WHEN t.humedad_tierra > ISNULL(c.humedad_suelo_maxima, 75) THEN N'Humedad alta'
            ELSE N'Dentro del rango'
        END,
        CASE
            WHEN t.humedad_tierra < ISNULL(c.humedad_suelo_minima, 35) THEN 'CRITICO_BAJO'
            WHEN t.humedad_tierra > ISNULL(c.humedad_suelo_maxima, 75) THEN 'CRITICO_ALTO'
            ELSE 'OPTIMO'
        END,
        N'Registro histórico sincronizado desde telemetria_sensores.',
        t.fecha_hora
    FROM dbo.telemetria_sensores t
    INNER JOIN dbo.dispositivos d ON d.id = t.dispositivo_id
    LEFT JOIN dbo.cultivos c ON c.id_cultivo = d.cultivo_id
    ORDER BY t.fecha_hora ASC;
END
GO

-- -----------------------------------------------------------------------------
-- 7. Vista de Monitoreo en Tiempo Real (si no existe en la BD)
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.vista_monitoreo_riego', N'V') IS NULL
BEGIN
    EXEC('
    CREATE VIEW dbo.vista_monitoreo_riego AS
    SELECT
        d.id AS dispositivo_id,
        d.codigo_dispositivo,
        c.nombre AS planta,
        c.region AS region,
        c.humedad_suelo_minima,
        c.humedad_suelo_maxima,
        u.humedad_tierra AS humedad_actual,
        u.temperatura_aire,
        u.humedad_aire,
        CASE
            WHEN u.humedad_tierra IS NULL THEN N''Sin lecturas''
            WHEN u.humedad_tierra < c.humedad_suelo_minima THEN N''Humedad baja''
            WHEN u.humedad_tierra > c.humedad_suelo_maxima THEN N''Humedad alta''
            ELSE N''Dentro del rango''
        END AS estado_humedad,
        u.fecha_hora AS ultima_lectura
    FROM dbo.dispositivos d
    INNER JOIN dbo.cultivos c ON c.id_cultivo = d.cultivo_id
    OUTER APPLY (
        SELECT TOP (1)
            t.temperatura_aire,
            t.humedad_aire,
            t.humedad_tierra,
            t.fecha_hora
        FROM dbo.telemetria_sensores t
        WHERE t.dispositivo_id = d.id
        ORDER BY t.fecha_hora DESC, t.id DESC
    ) u
    WHERE d.estado = ''Activo'';
    ');
END
GO

-- -----------------------------------------------------------------------------
-- 8. Datos Semilla por defecto (Solo si la base de datos está recién creada)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.cultivos)
BEGIN
    INSERT INTO dbo.cultivos (nombre, region, humedad_suelo_minima, humedad_suelo_maxima)
    VALUES (N'Tomate Saladette', N'Invernadero Norte', 40.00, 75.00);
END

IF NOT EXISTS (SELECT 1 FROM dbo.dispositivos WHERE codigo_dispositivo = 'WATHEO-001')
BEGIN
    DECLARE @cultivoDefault INT = (SELECT TOP (1) id_cultivo FROM dbo.cultivos ORDER BY id_cultivo);
    INSERT INTO dbo.dispositivos (codigo_dispositivo, cultivo_id, ubicacion_parcela, estado)
    VALUES ('WATHEO-001', @cultivoDefault, N'Sector A - Camellón 1', 'Activo');
END
GO
