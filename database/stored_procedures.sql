USE [TB-L];
GO

-- 1. Stored Procedure to Get Next Panel for a Workstation
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

-- 2. Stored Procedure to Finalize the Process (Insert Sequence and Advance Pointer in a Transaction)
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

        -- Concurrency lock hint - verify duplicate check in database
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

        -- Insert sequence log
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

        -- Update workstation pointer
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

        -- Re-throw the error for the caller to handle
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END;
GO
