using System;
using System.Collections.Generic;
using System.Data;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Dapper;
using Backend.Models;

using System.IO;

namespace Backend.Services
{
    public class DatabaseService : IDatabaseService
    {
        private readonly string _connectionString;
        private static string? _cachedConnectionString;
        private static readonly object _connLock = new object();

        public static string ConnectionStringFile => Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "connection.json");

        public DatabaseService(IConfiguration configuration)
        {
            lock (_connLock)
            {
                if (_cachedConnectionString == null)
                {
                    _cachedConnectionString = LoadConnectionString(configuration);
                }
                _connectionString = _cachedConnectionString;
            }
            
            // Run automatic schema migration to ensure Mano and Posicion exist in Validacion_Ornamento
            EnsureColumnsExist();
        }

        private void EnsureColumnsExist()
        {
            try
            {
                using var conn = GetConnection();
                conn.Open();
                
                var addColumnIfMissing = new Action<string, string, string>((tableName, columnName, columnDef) =>
                {
                    bool exists = false;
                    string checkSql = $"SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{tableName}' AND COLUMN_NAME = '{columnName}';";
                    using (var cmd = new SqlCommand(checkSql, conn))
                    {
                        var res = cmd.ExecuteScalar();
                        if (res != null) exists = true;
                    }
                    
                    if (!exists)
                    {
                        string alterSql = $"ALTER TABLE dbo.{tableName} ADD {columnName} {columnDef};";
                        using (var cmd = new SqlCommand(alterSql, conn))
                        {
                            cmd.ExecuteNonQuery();
                        }
                        Console.WriteLine($"Columna '{columnName}' agregada exitosamente a la tabla {tableName}.");
                    }
                    else
                    {
                        // Ensure column type is VARCHAR(10) to prevent truncation of values like "LH"/"RH" or "FR"/"RR"
                        string alterTypeSql = $"ALTER TABLE dbo.{tableName} ALTER COLUMN {columnName} {columnDef};";
                        using (var cmd = new SqlCommand(alterTypeSql, conn))
                        {
                            cmd.ExecuteNonQuery();
                        }
                    }
                });

                // 1. Ensure columns in Validacion_Ornamento
                addColumnIfMissing("Validacion_Ornamento", "Mano", "VARCHAR(10) NULL");
                addColumnIfMissing("Validacion_Ornamento", "Posicion", "VARCHAR(10) NULL");

                // 2. Ensure columns in Orden_Produccion
                addColumnIfMissing("Orden_Produccion", "Mano", "VARCHAR(10) NULL");
                addColumnIfMissing("Orden_Produccion", "Posicion", "VARCHAR(10) NULL");

                // 3. Recreate SP_ObtenerSiguientePanel
                string dropSp1 = "IF OBJECT_ID('dbo.SP_ObtenerSiguientePanel', 'P') IS NOT NULL DROP PROCEDURE dbo.SP_ObtenerSiguientePanel;";
                using (var cmd = new SqlCommand(dropSp1, conn))
                {
                    cmd.ExecuteNonQuery();
                }

                string createSp1 = @"
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
END;";
                using (var cmd = new SqlCommand(createSp1, conn))
                {
                    cmd.ExecuteNonQuery();
                }

                // 4. Recreate SP_FinalizarProcesoPanel
                string dropSp2 = "IF OBJECT_ID('dbo.SP_FinalizarProcesoPanel', 'P') IS NOT NULL DROP PROCEDURE dbo.SP_FinalizarProcesoPanel;";
                using (var cmd = new SqlCommand(dropSp2, conn))
                {
                    cmd.ExecuteNonQuery();
                }

                string createSp2 = @"
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
END;";
                using (var cmd = new SqlCommand(createSp2, conn))
                {
                    cmd.ExecuteNonQuery();
                }

                // 5. Auto-sync Puntero_ID_OrdenProduccion if it lags behind Produccion_Secuencia
                string syncPointerSql = @"
UPDATE dbo.Puesto
SET Puntero_ID_OrdenProduccion = (
    SELECT ISNULL(MAX(ID_OrdenProduccion), 1)
    FROM dbo.Produccion_Secuencia
    WHERE Puesto = dbo.Puesto.Puesto
)
WHERE Puntero_ID_OrdenProduccion < (
    SELECT ISNULL(MAX(ID_OrdenProduccion), 1)
    FROM dbo.Produccion_Secuencia
    WHERE Puesto = dbo.Puesto.Puesto
);

-- Sincronizar DL01 si DL02 ya procesó órdenes
UPDATE P
SET P.Puntero_ID_OrdenProduccion = DL02Procesado.MaxID,
    P.Fecha_Puntero = GETDATE()
FROM dbo.Puesto P
CROSS APPLY (
    SELECT ISNULL(MAX(OP1.ID_OrdenProduccion), P.Puntero_ID_OrdenProduccion) AS MaxID
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
      )
) AS DL02Procesado
WHERE UPPER(LTRIM(RTRIM(P.Puesto))) = 'DL01'
  AND DL02Procesado.MaxID > P.Puntero_ID_OrdenProduccion;";
                using (var cmd = new SqlCommand(syncPointerSql, conn))
                {
                    cmd.ExecuteNonQuery();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al ejecutar la migración de base de datos en inicio: {ex.Message}");
            }
        }

        private static string LoadConnectionString(IConfiguration configuration)
        {
            try
            {
                if (File.Exists(ConnectionStringFile))
                {
                    string json = File.ReadAllText(ConnectionStringFile);
                    using (var doc = System.Text.Json.JsonDocument.Parse(json))
                    {
                        if (doc.RootElement.TryGetProperty("ConnectionString", out var prop))
                        {
                            return prop.GetString() ?? string.Empty;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error loading connection.json: {ex.Message}");
            }

            return configuration.GetConnectionString("DefaultConnection") 
                ?? "Server=localhost;Database=TB-L;Trusted_Connection=True;TrustServerCertificate=True;";
        }

        public static string GetCurrentConnectionString()
        {
            lock (_connLock)
            {
                if (_cachedConnectionString == null)
                {
                    // Fallback load
                    try
                    {
                        if (File.Exists(ConnectionStringFile))
                        {
                            string json = File.ReadAllText(ConnectionStringFile);
                            using (var doc = System.Text.Json.JsonDocument.Parse(json))
                            {
                                if (doc.RootElement.TryGetProperty("ConnectionString", out var prop))
                                {
                                    _cachedConnectionString = prop.GetString();
                                }
                            }
                        }
                    }
                    catch { }

                    if (string.IsNullOrEmpty(_cachedConnectionString))
                    {
                        _cachedConnectionString = "Server=localhost;Database=TB-L;Trusted_Connection=True;TrustServerCertificate=True;";
                    }
                }
                return _cachedConnectionString;
            }
        }

        public static void UpdateConnectionString(string newConnString)
        {
            lock (_connLock)
            {
                _cachedConnectionString = newConnString;
                string json = System.Text.Json.JsonSerializer.Serialize(new { ConnectionString = newConnString });
                File.WriteAllText(ConnectionStringFile, json);
            }
        }

        private SqlConnection GetConnection() => new SqlConnection(GetCurrentConnectionString());

        public async Task<bool> TestConnectionAsync(string connString)
        {
            try
            {
                using var conn = new SqlConnection(connString);
                await conn.OpenAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        public async Task<DateTime> GetServerDateTimeAsync()
        {
            using var conn = GetConnection();
            return await conn.QuerySingleAsync<DateTime>("SELECT GETDATE();");
        }

        public async Task<PanelSequence?> GetNextPanelAsync(string puesto)
        {
            using var conn = GetConnection();
            var result = await conn.QueryFirstOrDefaultAsync<PanelSequence>(
                "dbo.SP_ObtenerSiguientePanel", 
                new { Puesto = puesto }, 
                commandType: CommandType.StoredProcedure
            );
            return result;
        }

        public async Task<Equivalencia?> GetEquivalenceAsync(string codigoPanel)
        {
            using var conn = GetConnection();
            string sql = "SELECT * FROM dbo.Equivalencia_Panel_Ornamento WHERE CodigoPanel = @CodigoPanel AND Activo = 1;";
            return await conn.QueryFirstOrDefaultAsync<Equivalencia>(sql, new { CodigoPanel = codigoPanel.Trim() });
        }

        public async Task<IEnumerable<Equivalencia>> GetEquivalencesAsync()
        {
            using var conn = GetConnection();
            string sql = "SELECT * FROM dbo.Equivalencia_Panel_Ornamento ORDER BY ID_Equivalencia DESC;";
            return await conn.QueryAsync<Equivalencia>(sql);
        }

        public async Task<bool> UpsertEquivalenceAsync(Equivalencia equiv, string user)
        {
            using var conn = GetConnection();
            string sql = @"
                MERGE dbo.Equivalencia_Panel_Ornamento AS Target
                USING (SELECT @CodigoPanel AS CodigoPanel) AS Source
                ON (Target.CodigoPanel = Source.CodigoPanel AND Target.Activo = 1)
                WHEN MATCHED THEN
                    UPDATE SET 
                        CodigoOrnamento = @CodigoOrnamento,
                        RequiereOrnamento = @RequiereOrnamento,
                        FechaModificacion = GETDATE(),
                        UsuarioModificacion = @User
                WHEN NOT MATCHED THEN
                    INSERT (CodigoPanel, CodigoOrnamento, RequiereOrnamento, Activo, FechaDesde, UsuarioModificacion)
                    VALUES (@CodigoPanel, @CodigoOrnamento, @RequiereOrnamento, 1, GETDATE(), @User);";
            
            var rows = await conn.ExecuteAsync(sql, new {
                CodigoPanel = equiv.CodigoPanel.Trim().ToUpper(),
                CodigoOrnamento = equiv.CodigoOrnamento?.Trim().ToUpper(),
                equiv.RequiereOrnamento,
                User = user
            });
            return rows > 0;
        }

        public async Task<bool> DeleteEquivalenceAsync(int id)
        {
            using var conn = GetConnection();
            string sql = "UPDATE dbo.Equivalencia_Panel_Ornamento SET Activo = 0, FechaHasta = GETDATE() WHERE ID_Equivalencia = @Id;";
            var rows = await conn.ExecuteAsync(sql, new { Id = id });
            return rows > 0;
        }

        public async Task<string> GetConfigValueAsync(string key, string defaultValue = "")
        {
            using var conn = GetConnection();
            string sql = "SELECT Valor FROM dbo.Configuracion_Sistema WHERE Clave = @Key;";
            var value = await conn.QueryFirstOrDefaultAsync<string>(sql, new { Key = key });
            return value ?? defaultValue;
        }

        public async Task<Dictionary<string, string>> GetConfigsAsync()
        {
            using var conn = GetConnection();
            string sql = "SELECT Clave, Valor FROM dbo.Configuracion_Sistema;";
            var rows = await conn.QueryAsync<(string Clave, string Valor)>(sql);
            var dict = new Dictionary<string, string>();
            foreach (var r in rows)
            {
                dict[r.Clave] = r.Valor;
            }
            return dict;
        }

        public async Task<bool> UpdateConfigValueAsync(string key, string value, string user, string? motivo)
        {
            using var conn = GetConnection();
            await conn.OpenAsync();
            using var transaction = conn.BeginTransaction();
            try
            {
                // Get old value
                string selectSql = "SELECT Valor FROM dbo.Configuracion_Sistema WITH (UPDLOCK, HOLDLOCK) WHERE Clave = @Key;";
                var oldValue = await conn.QueryFirstOrDefaultAsync<string>(selectSql, new { Key = key }, transaction);

                // Update configuration
                string updateSql = @"
                    UPDATE dbo.Configuracion_Sistema 
                    SET Valor = @Value, FechaModificacion = GETDATE(), UsuarioModificacion = @User
                    WHERE Clave = @Key;";
                var rows = await conn.ExecuteAsync(updateSql, new { Key = key, Value = value, User = user }, transaction);

                if (rows == 0)
                {
                    // Key doesn't exist, insert it
                    string insertSql = @"
                        INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion, FechaModificacion, UsuarioModificacion)
                        VALUES (@Key, @Value, 'Configuracion dinámica', GETDATE(), @User);";
                    await conn.ExecuteAsync(insertSql, new { Key = key, Value = value, User = user }, transaction);
                }

                // Log audit trail
                string auditSql = @"
                    INSERT INTO dbo.Auditoria_Configuracion (Clave, ValorAnterior, ValorNuevo, FechaModificacion, UsuarioModificacion, Motivo)
                    VALUES (@Key, @OldValue, @Value, GETDATE(), @User, @Motivo);";
                await conn.ExecuteAsync(auditSql, new { Key = key, OldValue = oldValue, Value = value, User = user, Motivo = motivo }, transaction);

                transaction.Commit();
                return true;
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        public async Task<bool> UpdateConfigsBatchAsync(IEnumerable<(string Key, string Value, string? Motivo)> items, string user)
        {
            using var conn = GetConnection();
            await conn.OpenAsync();
            using var transaction = conn.BeginTransaction();
            try
            {
                foreach (var (key, value, motivo) in items)
                {
                    if (string.IsNullOrWhiteSpace(key)) continue;

                    string selectSql = "SELECT Valor FROM dbo.Configuracion_Sistema WITH (UPDLOCK, HOLDLOCK) WHERE Clave = @Key;";
                    var oldValue = await conn.QueryFirstOrDefaultAsync<string>(selectSql, new { Key = key }, transaction);

                    string updateSql = @"
                        UPDATE dbo.Configuracion_Sistema 
                        SET Valor = @Value, FechaModificacion = GETDATE(), UsuarioModificacion = @User
                        WHERE Clave = @Key;";
                    var rows = await conn.ExecuteAsync(updateSql, new { Key = key, Value = value, User = user }, transaction);

                    if (rows == 0)
                    {
                        string insertSql = @"
                            INSERT INTO dbo.Configuracion_Sistema (Clave, Valor, Descripcion, FechaModificacion, UsuarioModificacion)
                            VALUES (@Key, @Value, 'Configuracion dinámica', GETDATE(), @User);";
                        await conn.ExecuteAsync(insertSql, new { Key = key, Value = value, User = user }, transaction);
                    }

                    string auditSql = @"
                        INSERT INTO dbo.Auditoria_Configuracion (Clave, ValorAnterior, ValorNuevo, FechaModificacion, UsuarioModificacion, Motivo)
                        VALUES (@Key, @OldValue, @Value, GETDATE(), @User, @Motivo);";
                    await conn.ExecuteAsync(auditSql, new { Key = key, OldValue = oldValue, Value = value, User = user, Motivo = motivo }, transaction);
                }

                transaction.Commit();
                return true;
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        public async Task<IEnumerable<AuditConfig>> GetConfigAuditsAsync()
        {
            using var conn = GetConnection();
            string sql = "SELECT * FROM dbo.Auditoria_Configuracion ORDER BY ID_Auditoria DESC;";
            return await conn.QueryAsync<AuditConfig>(sql);
        }

        public async Task<bool> CheckQrProcessedAsync(string qr)
        {
            using var conn = GetConnection();
            string sql = "SELECT COUNT(1) FROM dbo.Validacion_Ornamento WHERE QrCompleto = @Qr AND ResultadoGeneral = 'APROBADO';";
            var count = await conn.QuerySingleAsync<int>(sql, new { Qr = qr.Trim() });
            return count > 0;
        }

        public async Task<Validacion?> GetPriorValidationByQrAsync(string qr)
        {
            using var conn = GetConnection();
            string sql = "SELECT TOP 1 * FROM dbo.Validacion_Ornamento WHERE QrCompleto = @Qr AND ResultadoGeneral = 'APROBADO' ORDER BY ID_Validacion DESC;";
            return await conn.QueryFirstOrDefaultAsync<Validacion>(sql, new { Qr = qr.Trim() });
        }

        public async Task<int> InsertValidationLogAsync(Validacion log)
        {
            using var conn = GetConnection();
            string sql = @"
                INSERT INTO dbo.Validacion_Ornamento
                (
                    ID_Operacion, ID_OrdenProduccion, ID_OrdenCliente, Orden, Secuencia, SD, Referencia,
                    CodigoOrnamentoEsperado, CodigoOrnamentoLeido, QrCompleto, NumeroSerie, Lote,
                    InicioCurado, FechaActualServidor, MinutosCurado, TiempoMinimoRequerido,
                    ResultadoCurado, ResultadoCorrespondencia, ResultadoGeneral, MotivoRechazo,
                    Puesto, Operador, FechaLectura, EstadoImpresion, MensajeErrorTecnico,
                    Mano, Posicion
                )
                VALUES
                (
                    @ID_Operacion, @ID_OrdenProduccion, @ID_OrdenCliente, @Orden, @Secuencia, @SD, @Referencia,
                    @CodigoOrnamentoEsperado, @CodigoOrnamentoLeido, @QrCompleto, @NumeroSerie, @Lote,
                    @InicioCurado, GETDATE(), @MinutosCurado, @TiempoMinimoRequerido,
                    @ResultadoCurado, @ResultadoCorrespondencia, @ResultadoGeneral, @MotivoRechazo,
                    @Puesto, @Operador, GETDATE(), @EstadoImpresion, @MensajeErrorTecnico,
                    @Mano, @Posicion
                );
                SELECT CAST(SCOPE_IDENTITY() as int);";
            
            return await conn.QuerySingleAsync<int>(sql, log);
        }

        public async Task<bool> UpdateValidationPrintStatusAsync(int id, string status, string? printer, string? technicalError)
        {
            using var conn = GetConnection();
            string sql = @"
                UPDATE dbo.Validacion_Ornamento 
                SET EstadoImpresion = @Status,
                    Impresora = @Printer,
                    FechaImpresion = CASE WHEN @Status = 'COMPLETO' THEN GETDATE() ELSE FechaImpresion END,
                    MensajeErrorTecnico = @TechnicalError
                WHERE ID_Validacion = @Id;";
            var rows = await conn.ExecuteAsync(sql, new { Id = id, Status = status, Printer = printer, TechnicalError = technicalError });
            return rows > 0;
        }

        public async Task<bool> UpdateValidationPointerAdvancedAsync(int id)
        {
            using var conn = GetConnection();
            string sql = "UPDATE dbo.Validacion_Ornamento SET FechaAvancePuntero = GETDATE() WHERE ID_Validacion = @Id;";
            var rows = await conn.ExecuteAsync(sql, new { Id = id });
            return rows > 0;
        }

        public async Task CompletePanelProcessAsync(int idOrdenProduccion, int idOrdenCliente, string puesto, int orden)
        {
            using var conn = GetConnection();
            await conn.ExecuteAsync(
                "dbo.SP_FinalizarProcesoPanel",
                new 
                {
                    ID_OrdenProduccion = idOrdenProduccion,
                    ID_OrdenCliente = idOrdenCliente,
                    Puesto = puesto,
                    Orden = orden
                },
                commandType: CommandType.StoredProcedure
            );
        }

        public async Task<IEnumerable<Validacion>> GetValidationHistoryAsync(
            DateTime? desde, DateTime? hasta, string? panel, string? ornament, 
            int? ordenId, int? secuencia, string? puesto, string? result, string? motivo)
        {
            using var conn = GetConnection();
            var sql = "SELECT * FROM dbo.Validacion_Ornamento WHERE 1=1";
            var parameters = new DynamicParameters();

            if (desde.HasValue)
            {
                sql += " AND FechaLectura >= @Desde";
                parameters.Add("Desde", desde.Value);
            }
            if (hasta.HasValue)
            {
                sql += " AND FechaLectura <= @Hasta";
                parameters.Add("Hasta", hasta.Value);
            }
            if (!string.IsNullOrEmpty(panel))
            {
                sql += " AND Referencia LIKE @Panel";
                parameters.Add("Panel", "%" + panel.Trim() + "%");
            }
            if (!string.IsNullOrEmpty(ornament))
            {
                sql += " AND (CodigoOrnamentoEsperado LIKE @Orn OR CodigoOrnamentoLeido LIKE @Orn)";
                parameters.Add("Orn", "%" + ornament.Trim() + "%");
            }
            if (ordenId.HasValue)
            {
                sql += " AND ID_OrdenProduccion = @OrdenId";
                parameters.Add("OrdenId", ordenId.Value);
            }
            if (secuencia.HasValue)
            {
                sql += " AND Secuencia = @Secuencia";
                parameters.Add("Secuencia", secuencia.Value);
            }
            if (!string.IsNullOrEmpty(puesto))
            {
                sql += " AND Puesto = @Puesto";
                parameters.Add("Puesto", puesto.Trim());
            }
            if (!string.IsNullOrEmpty(result))
            {
                sql += " AND ResultadoGeneral = @Result";
                parameters.Add("Result", result.Trim());
            }
            if (!string.IsNullOrEmpty(motivo))
            {
                sql += " AND MotivoRechazo LIKE @Motivo";
                parameters.Add("Motivo", "%" + motivo.Trim() + "%");
            }

            sql += " ORDER BY ID_Validacion DESC";
            return await conn.QueryAsync<Validacion>(sql, parameters);
        }

        public async Task<PanelSequence?> GetOrderProductionByIdAsync(int idOrdenProduccion)
        {
            using var conn = GetConnection();
            string sql = "SELECT Referencia, ID_OrdenProduccion, ID_OrdenCliente, Orden, Secuencia, SD, (Posicion + Mano) AS Expr1, Puesto, Fecha_Secuencia AS FechaSecuencia, Mano, Posicion FROM dbo.Orden_Produccion WHERE ID_OrdenProduccion = @Id;";
            return await conn.QueryFirstOrDefaultAsync<PanelSequence>(sql, new { Id = idOrdenProduccion });
        }
    }
}
