-- =========================================================================
-- SCRIPT DE INSTALACIÓN Y ACTUALIZACIÓN - APLICACIÓN INDUSTRIAL PUESTO DL01
-- =========================================================================
-- IMPORTANTE: Ejecute este script dentro de la base de datos de destino.
-- Seleccione la base de datos en SQL Server Management Studio (SSMS) antes de ejecutar.
-- =========================================================================

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET QUOTED_IDENTIFIER ON;
GO

-- =========================================================================
-- 1. CREACIÓN DE TABLAS (SI NO EXISTEN)
-- =========================================================================

-- Tabla de Equivalencias Panel - Ornamento
IF OBJECT_ID('dbo.Equivalencia_Panel_Ornamento', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Equivalencia_Panel_Ornamento (
        ID_Equivalencia INT IDENTITY(1,1) PRIMARY KEY,
        CodigoPanel VARCHAR(50) NOT NULL,
        CodigoOrnamento VARCHAR(50) NULL,
        RequiereOrnamento BIT NOT NULL DEFAULT 1,
        Activo BIT NOT NULL DEFAULT 1,
        FechaDesde DATETIME NOT NULL DEFAULT GETDATE(),
        FechaHasta DATETIME NULL,
        FechaModificacion DATETIME NOT NULL DEFAULT GETDATE(),
        UsuarioModificacion VARCHAR(50) NOT NULL DEFAULT 'SYSTEM'
    );
    
    CREATE UNIQUE NONCLUSTERED INDEX UIX_Equivalencia_Panel_Activo 
    ON dbo.Equivalencia_Panel_Ornamento(CodigoPanel) 
    WHERE Activo = 1;
END;
GO

-- Tabla de Configuración de Sistema
IF OBJECT_ID('dbo.Configuracion_Sistema', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Configuracion_Sistema (
        Clave VARCHAR(50) PRIMARY KEY,
        Valor NVARCHAR(MAX) NOT NULL,
        Descripcion NVARCHAR(200) NULL,
        FechaModificacion DATETIME NOT NULL DEFAULT GETDATE(),
        UsuarioModificacion VARCHAR(50) NOT NULL DEFAULT 'SYSTEM'
    );
END;
GO

-- Tabla de Auditoría de Configuración
IF OBJECT_ID('dbo.Auditoria_Configuracion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Auditoria_Configuracion (
        ID_Auditoria INT IDENTITY(1,1) PRIMARY KEY,
        Clave VARCHAR(50) NOT NULL,
        ValorAnterior NVARCHAR(MAX) NULL,
        ValorNuevo NVARCHAR(MAX) NOT NULL,
        FechaModificacion DATETIME NOT NULL DEFAULT GETDATE(),
        UsuarioModificacion VARCHAR(50) NOT NULL,
        Motivo NVARCHAR(200) NULL
    );
END;
GO

-- Tabla Historial de Validaciones y Trazabilidad de Ornamentos
IF OBJECT_ID('dbo.Validacion_Ornamento', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Validacion_Ornamento (
        ID_Validacion INT IDENTITY(1,1) PRIMARY KEY,
        ID_Operacion UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        ID_OrdenProduccion INT NOT NULL,
        ID_OrdenCliente INT NOT NULL,
        Orden INT NOT NULL,
        Secuencia INT NULL,
        SD VARCHAR(10) NULL,
        Referencia VARCHAR(50) NOT NULL,
        CodigoOrnamentoEsperado VARCHAR(50) NULL,
        CodigoOrnamentoLeido VARCHAR(100) NULL,
        QrCompleto VARCHAR(500) NOT NULL,
        NumeroSerie VARCHAR(100) NULL,
        Lote VARCHAR(100) NULL,
        InicioCurado DATETIME NULL,
        FechaActualServidor DATETIME NOT NULL DEFAULT GETDATE(),
        MinutosCurado INT NULL,
        TiempoMinimoRequerido INT NULL,
        ResultadoCurado VARCHAR(50) NULL,
        ResultadoCorrespondencia VARCHAR(50) NULL,
        ResultadoGeneral VARCHAR(50) NOT NULL,
        MotivoRechazo NVARCHAR(200) NULL,
        Puesto VARCHAR(20) NOT NULL,
        Operador VARCHAR(50) NOT NULL DEFAULT 'OPERADOR',
        FechaLectura DATETIME NOT NULL DEFAULT GETDATE(),
        FechaImpresion DATETIME NULL,
        Impresora VARCHAR(100) NULL,
        EstadoImpresion VARCHAR(50) NULL,
        FechaAvancePuntero DATETIME NULL,
        MensajeErrorTecnico NVARCHAR(MAX) NULL,
        Mano VARCHAR(10) NULL,
        Posicion VARCHAR(10) NULL
    );

    -- Restricción única de QR para evitar procesar dos veces el mismo ornamento
    CREATE UNIQUE NONCLUSTERED INDEX UIX_Validacion_Ornamento_Qr_Aprobado
    ON dbo.Validacion_Ornamento(QrCompleto)
    WHERE ResultadoGeneral = 'APROBADO';
    
    CREATE NONCLUSTERED INDEX IX_Validacion_Ornamento_NumeroSerie
    ON dbo.Validacion_Ornamento(NumeroSerie)
    WHERE NumeroSerie IS NOT NULL;
END;
GO

-- Tabla de Puestos (Puntero del secuenciador)
IF OBJECT_ID('dbo.Puesto', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Puesto (
        Puesto VARCHAR(20) PRIMARY KEY,
        Lector CHAR(1) NOT NULL DEFAULT 'H',
        Puntero_ID_OrdenProduccion INT NOT NULL DEFAULT 0
    );
END;
GO

-- Tabla de Orden de Producción (Secuencia de paneles cargada por el secuenciador central)
IF OBJECT_ID('dbo.Orden_Produccion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Orden_Produccion (
        ID_OrdenProduccion INT IDENTITY(1,1) PRIMARY KEY,
        ID_OrdenCliente INT NOT NULL,
        Lector CHAR(1) NOT NULL,
        Secuencia INT NOT NULL,
        Fecha_Secuencia DATETIME NOT NULL DEFAULT GETDATE(),
        Suffix VARCHAR(10) NULL,
        Fecha_Proceso DATETIME NULL,
        SD VARCHAR(10) NULL,
        Puesto VARCHAR(20) NOT NULL,
        Referencia VARCHAR(50) NOT NULL,
        Orden INT NOT NULL,
        Estado INT NOT NULL DEFAULT 1,
        Impresiones_Intentos INT NOT NULL DEFAULT 0,
        Etiqueta_Confirmada BIT NOT NULL DEFAULT 0,
        Mano VARCHAR(10) NULL,
        Posicion VARCHAR(10) NULL
    );
END;
GO

-- Tabla de Secuencia de Producción Procesada (Historial de avance)
IF OBJECT_ID('dbo.Produccion_Secuencia', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Produccion_Secuencia (
        ID_ProduccionSecuencia INT IDENTITY(1,1) PRIMARY KEY,
        ID_OrdenProduccion INT NOT NULL,
        ID_OrdenCliente INT NOT NULL,
        Puesto VARCHAR(20) NOT NULL,
        Fecha DATETIME NOT NULL DEFAULT GETDATE(),
        Orden INT NOT NULL
    );
END;
GO

-- =========================================================================
-- 2. PROCEDIMIENTOS ALMACENADOS
-- =========================================================================

-- SP para obtener el próximo panel en secuencia
IF OBJECT_ID('dbo.SP_ObtenerSiguientePanel', 'P') IS NOT NULL
    DROP PROCEDURE dbo.SP_ObtenerSiguientePanel;
GO

CREATE PROCEDURE dbo.SP_ObtenerSiguientePanel
    @Puesto VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    -- Si el puesto consultado es DL01, sincronizar y avanzar puntero si DL02 ya procesó el panel
    IF UPPER(LTRIM(RTRIM(@Puesto))) = 'DL01' OR UPPER(@Puesto) LIKE '%DL01%'
    BEGIN
        DECLARE @MaxDL01 INT = 0;

        SELECT @MaxDL01 = ISNULL(MAX(OP1.ID_OrdenProduccion), 0)
        FROM dbo.Orden_Produccion OP1
        WHERE UPPER(LTRIM(RTRIM(OP1.Puesto))) = 'DL01'
          AND (
              EXISTS (
                  SELECT 1 
                  FROM dbo.Produccion_Secuencia PS
                  WHERE UPPER(LTRIM(RTRIM(PS.Puesto))) = 'DL02'
                    AND PS.ID_OrdenProduccion = OP1.ID_OrdenProduccion
              )
              OR EXISTS (
                  SELECT 1 
                  FROM dbo.Produccion_Secuencia PS
                  INNER JOIN dbo.Orden_Produccion OP2 
                      ON PS.ID_OrdenProduccion = OP2.ID_OrdenProduccion
                  WHERE UPPER(LTRIM(RTRIM(PS.Puesto))) = 'DL02'
                    AND UPPER(LTRIM(RTRIM(OP2.Puesto))) = 'DL02'
                    AND OP2.ID_OrdenCliente = OP1.ID_OrdenCliente
                    AND OP2.Orden = OP1.Orden
              )
              OR EXISTS (
                  SELECT 1 
                  FROM dbo.Produccion_Secuencia PS
                  WHERE UPPER(LTRIM(RTRIM(PS.Puesto))) = 'DL02'
                    AND PS.ID_OrdenCliente = OP1.ID_OrdenCliente
                    AND PS.Orden = OP1.Orden
              )
          );

        IF @MaxDL01 > 0
        BEGIN
            UPDATE dbo.Puesto
            SET Puntero_ID_OrdenProduccion = @MaxDL01,
                Fecha_Puntero = GETDATE()
            WHERE UPPER(LTRIM(RTRIM(Puesto))) = 'DL01'
              AND Puntero_ID_OrdenProduccion < @MaxDL01;

            INSERT INTO dbo.Produccion_Secuencia (ID_OrdenProduccion, ID_OrdenCliente, Puesto, Fecha, Orden, Resultado)
            SELECT OP1.ID_OrdenProduccion, OP1.ID_OrdenCliente, 'DL01', GETDATE(), OP1.Orden, 'AUTO_DL02'
            FROM dbo.Orden_Produccion OP1
            WHERE UPPER(LTRIM(RTRIM(OP1.Puesto))) = 'DL01'
              AND OP1.ID_OrdenProduccion <= @MaxDL01
              AND NOT EXISTS (
                  SELECT 1 FROM dbo.Produccion_Secuencia PS1
                  WHERE PS1.ID_OrdenProduccion = OP1.ID_OrdenProduccion
                    AND UPPER(LTRIM(RTRIM(PS1.Puesto))) = 'DL01'
              );
        END;
    END;

    WITH Consulta_Principal AS
    (
        SELECT TOP (1)
            OP.Lector,
            P.Puntero_ID_OrdenProduccion,
            OP.ID_OrdenProduccion,
            OP.ID_OrdenCliente,
            OP.Secuencia,
            OP.Fecha_Secuencia,
            OP.Suffix,
            OP.Fecha_Proceso,
            OP.SD,
            OP.Referencia,
            OP.Puesto,
            OP.Orden,
            OP.Estado,
            ISNULL(OP.Posicion, '') + ISNULL(OP.Mano, '') AS Expr1,
            OP.Mano,
            OP.Posicion
        FROM dbo.Orden_Produccion AS OP
        INNER JOIN dbo.Puesto AS P
            ON OP.Lector = P.Lector
            AND OP.Puesto = P.Puesto
            AND OP.ID_OrdenProduccion > P.Puntero_ID_OrdenProduccion
        WHERE OP.Puesto LIKE '%' + @Puesto + '%'
          AND NOT EXISTS (
              SELECT 1 FROM dbo.Produccion_Secuencia PS 
              WHERE PS.ID_OrdenProduccion = OP.ID_OrdenProduccion 
                AND PS.Puesto = P.Puesto
          )
          AND NOT EXISTS (
              SELECT 1 FROM dbo.Produccion_Secuencia PS_DL02
              WHERE UPPER(LTRIM(RTRIM(PS_DL02.Puesto))) = 'DL02'
                AND (
                    PS_DL02.ID_OrdenProduccion = OP.ID_OrdenProduccion
                    OR EXISTS (
                        SELECT 1 FROM dbo.Orden_Produccion OP2
                        WHERE OP2.ID_OrdenProduccion = PS_DL02.ID_OrdenProduccion
                          AND UPPER(LTRIM(RTRIM(OP2.Puesto))) = 'DL02'
                          AND OP2.ID_OrdenCliente = OP.ID_OrdenCliente
                          AND OP2.Orden = OP.Orden
                    )
                    OR (
                        PS_DL02.ID_OrdenCliente = OP.ID_OrdenCliente
                        AND PS_DL02.Orden = OP.Orden
                    )
                )
          )
        ORDER BY
            OP.ID_OrdenProduccion,
            OP.Orden
    )
    SELECT
        Referencia,
        ID_OrdenProduccion,
        ID_OrdenCliente,
        Orden,
        Secuencia,
        SD,
        Expr1,
        Puesto,
        Fecha_Secuencia AS FechaSecuencia,
        Mano,
        Posicion
    FROM Consulta_Principal;
END;
GO

-- SP transaccional para finalizar el proceso (Avance de secuencia en base de datos)
IF OBJECT_ID('dbo.SP_FinalizarProcesoPanel', 'P') IS NOT NULL
    DROP PROCEDURE dbo.SP_FinalizarProcesoPanel;
GO

CREATE PROCEDURE dbo.SP_FinalizarProcesoPanel
    @ID_OrdenProduccion INT,
    @ID_OrdenCliente INT,
    @Puesto VARCHAR(20),
    @Orden INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Concurrency locks
        IF EXISTS
        (
            SELECT 1
            FROM dbo.Produccion_Secuencia WITH (UPDLOCK, HOLDLOCK)
            WHERE ID_OrdenProduccion = @ID_OrdenProduccion
              AND Puesto = @Puesto
        )
        BEGIN
            THROW 50001, 'La orden ya fue procesada en este puesto.', 1;
        END;

        -- Insertar registro en secuencia histórica de planta
        INSERT INTO dbo.Produccion_Secuencia
        (
            ID_OrdenProduccion,
            ID_OrdenCliente,
            Puesto,
            Fecha,
            Orden
        )
        VALUES
        (
            @ID_OrdenProduccion,
            @ID_OrdenCliente,
            @Puesto,
            GETDATE(),
            @Orden
        );

        -- Avanzar puntero del puesto
        UPDATE dbo.Puesto WITH (ROWLOCK)
        SET Puntero_ID_OrdenProduccion = @ID_OrdenProduccion
        WHERE Puesto = @Puesto
          AND Puntero_ID_OrdenProduccion < @ID_OrdenProduccion;

        IF @@ROWCOUNT = 0
        BEGIN
            THROW 50002, 'No se pudo avanzar el puntero del puesto.', 1;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END;
GO

-- =========================================================================
-- 3. SEMILLERO DE CONFIGURACIÓN Y EQUIVALENCIAS (IF NOT EXISTS)
-- =========================================================================

-- Inserción de configuraciones por defecto
IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Workstation_Puesto')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Workstation_Puesto', 'DL01', 'Puesto de trabajo activo');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Refresh_Interval_Sec')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Refresh_Interval_Sec', '5', 'Intervalo de refresco en segundos');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Min_Curing_Hours')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Min_Curing_Hours', '4', 'Tiempo minimo requerido para curado en horas');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Printer_Name')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Printer_Name', 'Microsoft Print to PDF', 'Nombre de la impresora local');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Printer_Simulator_Enabled')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Printer_Simulator_Enabled', 'true', 'Habilitar simulacion de impresion');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Print_Copies')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Print_Copies', '1', 'Cantidad de copias de etiquetas');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Qr_Parse_Type')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Qr_Parse_Type', 'Separator', 'Tipo de parseo: Position, Separator, Regex');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Qr_Separator')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Qr_Separator', ';', 'Separador de campos QR');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Qr_Pos_Ornament_Index')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Qr_Pos_Ornament_Index', '0', 'Indice del codigo de ornamento');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Qr_Pos_Ornament_Length')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Qr_Pos_Ornament_Length', '11', 'Largo del codigo de ornamento');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Qr_Pos_Date_Index')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Qr_Pos_Date_Index', '1', 'Indice de la fecha/hora en QR');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Qr_Pos_Date_Length')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Qr_Pos_Date_Length', '12', 'Largo de fecha/hora en QR');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Qr_Pos_Serial_Index')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Qr_Pos_Serial_Index', '2', 'Indice del numero de serie');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Qr_Pos_Serial_Length')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Qr_Pos_Serial_Length', '10', 'Largo del numero de serie');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Qr_Datetime_Format')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Qr_Datetime_Format', 'yyyyMMddHHmm', 'Formato de fecha y hora del QR');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Qr_Regex_Pattern')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Qr_Regex_Pattern', '^(?<ornament>[^;]+);(?<datetime>\d{12});(?<serial>[^;]+)$', 'Expresion regular para parseo');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Audio_Alerts_Enabled')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Audio_Alerts_Enabled', 'true', 'Emitir alertas sonoras');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Supervisor_Password')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Supervisor_Password', '1234', 'Contrasena de supervisor');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Printer_Mode')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Printer_Mode', 'Spooler', 'Modo: Spooler, NetworkRaw');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Printer_IP')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Printer_IP', '192.168.1.100', 'IP impresora Zebra');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Printer_Port')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Printer_Port', '9100', 'Puerto TCP impresora Zebra');

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Printer_Zpl_Template')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Printer_Zpl_Template', '^XA
^LH30,20
^FO10,10^GB560,410,4^FS
^CF0,24
^FO30,30^FDETIQUETA KANBAN - PUESTO: {Puesto}^FS
^FO10,65^GB560,2,2^FS
^CF0,40
^FO35,90^FD{Referencia}^FS
^CF0,26
^FO35,160^FDORNAMENTO: {Ornamento}^FS
^FO10,210^GB560,2,2^FS
^CF0,24
^FO35,230^FDOrden Prod: {OrdenProduccion}^FS
^FO260,230^FDCliente: {OrdenCliente}^FS
^FO35,275^FDSecuencia: {Secuencia}^FS
^FO260,275^FDModelo: {SD}^FS
^FO35,320^FDMano/Pos: {Mano}^FS
^FO35,365^FDCurado: {MinutosCurado} min^FS
^FO420,230^BQN,2,6^FDQA,{QrCompleto}^FS
^XZ', 'Plantilla ZPL de diseño del Kanban');
GO

-- Inserción de equivalencias estándar por defecto
IF NOT EXISTS (SELECT 1 FROM dbo.Configuracion_Sistema WHERE Clave = 'Show_QR_Simulator')
    INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion) VALUES ('Show_QR_Simulator', 'false', 'Mostrar panel simulador QR en pantalla principal');

IF NOT EXISTS (SELECT 1 FROM dbo.Equivalencia_Panel_Ornamento WHERE CodigoPanel = '67610-0KM60-C0')
    INSERT INTO dbo.Equivalencia_Panel_Ornamento (CodigoPanel, CodigoOrnamento, RequiereOrnamento) VALUES ('67610-0KM60-C0', '67781-0K090', 1);


IF NOT EXISTS (SELECT 1 FROM dbo.Equivalencia_Panel_Ornamento WHERE CodigoPanel = '67620-0KM60-C0')
    INSERT INTO dbo.Equivalencia_Panel_Ornamento (CodigoPanel, CodigoOrnamento, RequiereOrnamento) VALUES ('67620-0KM60-C0', '67782-0K090', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Equivalencia_Panel_Ornamento WHERE CodigoPanel = '67610-0KM70-C0')
    INSERT INTO dbo.Equivalencia_Panel_Ornamento (CodigoPanel, CodigoOrnamento, RequiereOrnamento) VALUES ('67610-0KM70-C0', '67781-0K100', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Equivalencia_Panel_Ornamento WHERE CodigoPanel = '67620-0KM70-C0')
    INSERT INTO dbo.Equivalencia_Panel_Ornamento (CodigoPanel, CodigoOrnamento, RequiereOrnamento) VALUES ('67620-0KM70-C0', '67782-0K100', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Equivalencia_Panel_Ornamento WHERE CodigoPanel = '67610-0KM80-C4')
    INSERT INTO dbo.Equivalencia_Panel_Ornamento (CodigoPanel, CodigoOrnamento, RequiereOrnamento) VALUES ('67610-0KM80-C4', '67781-0K110', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Equivalencia_Panel_Ornamento WHERE CodigoPanel = '67620-0KM80-C4')
    INSERT INTO dbo.Equivalencia_Panel_Ornamento (CodigoPanel, CodigoOrnamento, RequiereOrnamento) VALUES ('67620-0KM80-C4', '67782-0K110', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Equivalencia_Panel_Ornamento WHERE CodigoPanel = '67640-0KF40-C0')
    INSERT INTO dbo.Equivalencia_Panel_Ornamento (CodigoPanel, CodigoOrnamento, RequiereOrnamento) VALUES ('67640-0KF40-C0', NULL, 0);

IF NOT EXISTS (SELECT 1 FROM dbo.Equivalencia_Panel_Ornamento WHERE CodigoPanel = '67630-0KF30-C0')
    INSERT INTO dbo.Equivalencia_Panel_Ornamento (CodigoPanel, CodigoOrnamento, RequiereOrnamento) VALUES ('67630-0KF30-C0', NULL, 0);
GO

-- Inserción de Puesto DL01 por defecto si no existe
IF NOT EXISTS (SELECT 1 FROM dbo.Puesto WHERE Puesto = 'DL01')
    INSERT INTO dbo.Puesto (Puesto, Lector, Puntero_ID_OrdenProduccion) VALUES ('DL01', 'H', 952);
GO

-- Inserción de Órdenes de prueba por defecto si la tabla está vacía
IF NOT EXISTS (SELECT 1 FROM dbo.Orden_Produccion)
BEGIN
    SET IDENTITY_INSERT dbo.Orden_Produccion ON;
    INSERT INTO dbo.Orden_Produccion
    (ID_OrdenProduccion, ID_OrdenCliente, Lector, Secuencia, Suffix, SD, Puesto, Referencia, Orden, Estado, Mano, Posicion)
    VALUES
    (953, 77, 'H', 101, 'A', 'SD001', 'DL01', '67610-0KM60-C0', 1, 1, 'R', 'F'),
    (954, 78, 'H', 102, 'A', 'SD002', 'DL01', '67610-0KM70-C0', 2, 1, 'L', 'F'),
    (955, 79, 'H', 103, 'A', 'SD003', 'DL01', '67640-0KF40-C0', 3, 1, 'R', 'R'),
    (956, 80, 'H', 104, 'A', 'SD004', 'DL01', '67630-0KF30-C0', 4, 1, 'L', 'R'),
    (957, 81, 'H', 105, 'A', 'SD005', 'DL01', '99999-99999-99', 5, 1, 'R', 'F'),
    (958, 82, 'H', 106, 'A', 'SD006', 'DL01', '67610-0KM80-C4', 6, 1, 'L', 'R'),
    (959, 83, 'H', 107, 'A', 'SD007', 'DL01', '67620-0KM80-C4', 7, 1, 'R', 'F'),
    (960, 84, 'H', 108, 'A', 'SD008', 'DL01', '67620-0KM70-C0', 8, 1, 'L', 'F');
    SET IDENTITY_INSERT dbo.Orden_Produccion OFF;
END;
GO

PRINT '=======================================================';
PRINT ' Base de datos configurada y actualizada exitosamente. ';
PRINT '=======================================================';
