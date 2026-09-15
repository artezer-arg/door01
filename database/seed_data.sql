USE [TB-L];
GO

-- 1. Seed Equivalencias Panel-Ornamento
DELETE FROM dbo.Equivalencia_Panel_Ornamento;
GO

INSERT INTO dbo.Equivalencia_Panel_Ornamento
(
    CodigoPanel,
    CodigoOrnamento,
    RequiereOrnamento,
    Activo,
    FechaDesde,
    UsuarioModificacion
)
VALUES
('67610-0KM60-C0', '67781-0K090', 1, 1, GETDATE(), 'SEED'),
('67620-0KM60-C0', '67782-0K090', 1, 1, GETDATE(), 'SEED'),
('67610-0KM70-C0', '67781-0K100', 1, 1, GETDATE(), 'SEED'),
('67620-0KM70-C0', '67782-0K100', 1, 1, GETDATE(), 'SEED'),
('67610-0KM80-C4', '67781-0K110', 1, 1, GETDATE(), 'SEED'),
('67620-0KM80-C4', '67782-0K110', 1, 1, GETDATE(), 'SEED'),
('67640-0KF40-C0', NULL, 0, 1, GETDATE(), 'SEED'),
('67630-0KF30-C0', NULL, 0, 1, GETDATE(), 'SEED');
GO

-- 2. Seed System Configurations
DELETE FROM dbo.Configuracion_Sistema;
GO

INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion, UsuarioModificacion)
VALUES
('Workstation_Puesto', 'DL01', 'Puesto de trabajo activo', 'SEED'),
('Refresh_Interval_Sec', '5', 'Intervalo de consulta en segundos para buscar nuevos paneles', 'SEED'),
('Min_Curing_Hours', '4', 'Tiempo minimo requerido para curado en horas', 'SEED'),
('Printer_Name', 'Microsoft Print to PDF', 'Nombre de la impresora local de etiquetas', 'SEED'),
('Printer_Simulator_Enabled', 'true', 'Simular la impresion guardando archivos locales en lugar de enviar a impresora fisica', 'SEED'),
('Print_Copies', '1', 'Cantidad de copias a imprimir por etiqueta aprobada', 'SEED'),
('Qr_Parse_Type', 'Separator', 'Tipo de parseo: Position, Separator, Regex', 'SEED'),
('Qr_Separator', ';', 'Separador de campos si el parseo es Separator', 'SEED'),
('Qr_Pos_Ornament_Index', '0', 'Indice o posicion inicial del codigo de ornamento', 'SEED'),
('Qr_Pos_Ornament_Length', '11', 'Largo del codigo de ornamento para posicion fija', 'SEED'),
('Qr_Pos_Date_Index', '1', 'Indice o posicion inicial de la fecha/hora en el QR', 'SEED'),
('Qr_Pos_Date_Length', '12', 'Largo de la fecha/hora para posicion fija', 'SEED'),
('Qr_Pos_Serial_Index', '2', 'Indice o posicion de numero de serie', 'SEED'),
('Qr_Pos_Serial_Length', '10', 'Largo del numero de serie para posicion fija', 'SEED'),
('Qr_Datetime_Format', 'yyyyMMddHHmm', 'Formato de fecha y hora del QR (ej. yyyyMMddHHmm, yyyyMMddHHmmss, etc.)', 'SEED'),
('Qr_Regex_Pattern', '^(?<ornament>[^;]+);(?<datetime>\\d{12});(?<serial>[^;]+)$', 'Expresion regular para parseo tipo Regex', 'SEED'),
('Audio_Alerts_Enabled', 'true', 'Emitir alertas sonoras por parlantes locales', 'SEED'),
('Supervisor_Password', '1234', 'Contrasena para acceder a la pantalla de configuracion y supervisor', 'SEED'),
('Printer_Mode', 'Spooler', 'Modo de conexion de la impresora: Spooler, NetworkRaw', 'SEED'),
('Printer_IP', '192.168.1.100', 'Direccion IP de la impresora Zebra en red', 'SEED'),
('Printer_Port', '9100', 'Puerto TCP de la impresora Zebra en red', 'SEED'),
('Arduino_Enabled', 'true', 'Habilitar comunicacion TCP con Arduino ESP32', 'SEED'),
('Arduino_IP', '192.168.3.200', 'Direccion IP del Arduino ESP32', 'SEED'),
('Arduino_Port', '8080', 'Puerto TCP del Arduino ESP32', 'SEED'),
('Arduino_Heartbeat_Timeout_Sec', '15', 'Tiempo maximo sin heartbeat antes de reconectar', 'SEED'),
('Arduino_Reconnect_Interval_Sec', '5', 'Intervalo de reintento de conexion en segundos', 'SEED'),
('Printer_Zpl_Template', '^XA
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
^XZ', 'Plantilla ZPL de diseño del Kanban', 'SEED');
GO

-- 2b. Seed Link_Socket_TCP if empty
IF NOT EXISTS (SELECT 1 FROM dbo.Link_Socket_TCP)
BEGIN
    INSERT INTO dbo.Link_Socket_TCP (Referencia, Señal) VALUES
    ('67610-0KM60-C0', '1'),
    ('67620-0KM60-C0', '2'),
    ('67610-0KM70-C0', '3'),
    ('67620-0KM70-C0', '4'),
    ('67610-0KM80-C4', '5'),
    ('67620-0KM80-C4', '14'),
    ('67640-0KF40-C0', '15'),
    ('67630-0KF30-C0', '16');
END;
GO

-- 3. Reset Workstation Pointer for DL01 to 952 to ensure it picks up 953
UPDATE dbo.Puesto
SET Puntero_ID_OrdenProduccion = 952,
    Lector = 'H'
WHERE Puesto = 'DL01';
GO

-- 3b. Clear validation logs to allow QR reuse in tests
TRUNCATE TABLE dbo.Validacion_Ornamento;
GO

-- 4. Seed Test Orders in Orden_Produccion
DELETE FROM dbo.Produccion_Secuencia;
DELETE FROM dbo.Orden_Produccion;
GO

SET IDENTITY_INSERT dbo.Orden_Produccion ON;
GO

INSERT INTO dbo.Orden_Produccion
(
    ID_OrdenProduccion,
    ID_OrdenCliente,
    Lector,
    Secuencia,
    Fecha_Secuencia,
    Suffix,
    Fecha_Proceso,
    SD,
    Puesto,
    Referencia,
    Orden,
    Estado,
    Impresiones_Intentos,
    Etiqueta_Confirmada,
    Mano,
    Posicion
)
VALUES
-- Prueba 1 y 2: Panel 67610-0KM60-C0 (Requiere Ornamento 67781-0K090)
(953, 77, 'H', 101, GETDATE(), 'A', NULL, 'SD001', 'DL01', '67610-0KM60-C0', 1, 1, 0, 0, 'R', 'F'),

-- Prueba 3 y 4: Panel 67610-0KM70-C0 (Requiere Ornamento 67781-0K100)
(954, 78, 'H', 102, GETDATE(), 'A', NULL, 'SD002', 'DL01', '67610-0KM70-C0', 2, 1, 0, 0, 'L', 'F'),

-- Prueba 5: Panel 67640-0KF40-C0 (No requiere ornamento)
(955, 79, 'H', 103, GETDATE(), 'A', NULL, 'SD003', 'DL01', '67640-0KF40-C0', 3, 1, 0, 0, 'R', 'R'),

-- Prueba 6: Panel 67630-0KF30-C0 (No requiere ornamento)
(956, 80, 'H', 104, GETDATE(), 'A', NULL, 'SD004', 'DL01', '67630-0KF30-C0', 4, 1, 0, 0, 'L', 'R'),

-- Prueba 7: Panel sin equivalencia configurada
(957, 81, 'H', 105, GETDATE(), 'A', NULL, 'SD005', 'DL01', '99999-99999-99', 5, 1, 0, 0, 'R', 'F'),

-- Prueba 8: Duplicate QR check (using panel 67610-0KM80-C4, expects 67781-0K110)
(958, 82, 'H', 106, GETDATE(), 'A', NULL, 'SD006', 'DL01', '67610-0KM80-C4', 6, 1, 0, 0, 'L', 'R'),

-- Prueba 9: Printer Error check (using panel 67620-0KM80-C4, expects 67782-0K110)
(959, 83, 'H', 107, GETDATE(), 'A', NULL, 'SD007', 'DL01', '67620-0KM80-C4', 7, 1, 0, 0, 'R', 'F'),

-- Prueba 10: DB failure after print check (using panel 67620-0KM70-C0, expects 67782-0K100)
(960, 84, 'H', 108, GETDATE(), 'A', NULL, 'SD008', 'DL01', '67620-0KM70-C0', 8, 1, 0, 0, 'L', 'F');
GO

SET IDENTITY_INSERT dbo.Orden_Produccion OFF;
GO
