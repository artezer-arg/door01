using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Backend.Models;
using Backend.Services;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ValidationController : ControllerBase
    {
        private readonly IDatabaseService _dbService;
        private readonly IQrParsingService _qrParser;
        private readonly IPrintingService _printer;
        private readonly IArduinoService _arduinoService;

        public ValidationController(
            IDatabaseService dbService, 
            IQrParsingService qrParser, 
            IPrintingService printer,
            IArduinoService arduinoService)
        {
            _dbService = dbService;
            _qrParser = qrParser;
            _printer = printer;
            _arduinoService = arduinoService;
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory(
            [FromQuery] DateTime? desde, [FromQuery] DateTime? hasta, 
            [FromQuery] string? panel, [FromQuery] string? ornament, 
            [FromQuery] int? ordenId, [FromQuery] int? secuencia, 
            [FromQuery] string? puesto, [FromQuery] string? result, 
            [FromQuery] string? motivo)
        {
            try
            {
                var history = await _dbService.GetValidationHistoryAsync(
                    desde, hasta, panel, ornament, ordenId, secuencia, puesto, result, motivo);
                return Ok(history);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error al obtener el historial.", detail = ex.Message });
            }
        }

        [HttpGet("export")]
        public async Task<IActionResult> ExportHistory(
            [FromQuery] DateTime? desde, [FromQuery] DateTime? hasta, 
            [FromQuery] string? panel, [FromQuery] string? ornament, 
            [FromQuery] int? ordenId, [FromQuery] int? secuencia, 
            [FromQuery] string? puesto, [FromQuery] string? result, 
            [FromQuery] string? motivo)
        {
            try
            {
                var history = await _dbService.GetValidationHistoryAsync(
                    desde, hasta, panel, ornament, ordenId, secuencia, puesto, result, motivo);

                var csv = new StringBuilder();
                csv.AppendLine("ID_Validacion,ID_Operacion,ID_OrdenProduccion,ID_OrdenCliente,Orden,Secuencia,SD,Referencia,OrnamentoEsperado,OrnamentoLeido,ResultadoGeneral,MotivoRechazo,Puesto,Operador,FechaLectura,EstadoImpresion,FechaAvancePuntero");

                foreach (var log in history)
                {
                    csv.AppendLine($"{log.ID_Validacion},\"{log.ID_Operacion}\",{log.ID_OrdenProduccion},{log.ID_OrdenCliente},{log.Orden},{log.Secuencia},\"{log.SD}\",\"{log.Referencia}\",\"{log.CodigoOrnamentoEsperado}\",\"{log.CodigoOrnamentoLeido}\",\"{log.ResultadoGeneral}\",\"{log.MotivoRechazo}\",\"{log.Puesto}\",\"{log.Operador}\",\"{log.FechaLectura:yyyy-MM-dd HH:mm:ss}\",\"{log.EstadoImpresion}\",\"{log.FechaAvancePuntero:yyyy-MM-dd HH:mm:ss}\"");
                }

                byte[] buffer = Encoding.UTF8.GetBytes(csv.ToString());
                return File(buffer, "text/csv", $"historial_trazabilidad_{DateTime.Now:yyyyMMddHHmmss}.csv");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error al exportar el historial.", detail = ex.Message });
            }
        }

        [HttpPost("validate-scan")]
        public async Task<IActionResult> ValidateScan([FromBody] ValidateScanRequest request)
        {
            try
            {
                if (request == null) return BadRequest("Datos del escaneo inválidos.");

                Console.WriteLine($"[ValidateScan] ID_OP={request.ID_OrdenProduccion}, ID_OC={request.ID_OrdenCliente}, Orden={request.Orden}, Secuencia={request.Secuencia}, Ref={request.PanelReference}, Puesto={request.Puesto}, Qr={request.Qr}");

                var configs = await _dbService.GetConfigsAsync();
                var serverTime = await _dbService.GetServerDateTimeAsync();

                // Fetch order from database to ensure metadata matches the database truth
                var dbOrder = await _dbService.GetOrderProductionByIdAsync(request.ID_OrdenProduccion);

                var validation = new Validacion
                {
                    ID_OrdenProduccion = request.ID_OrdenProduccion,
                    ID_OrdenCliente = dbOrder != null ? dbOrder.ID_OrdenCliente : request.ID_OrdenCliente,
                    Orden = dbOrder != null ? dbOrder.Orden : request.Orden,
                    Secuencia = dbOrder != null ? dbOrder.Secuencia : request.Secuencia,
                    SD = dbOrder != null ? dbOrder.SD : request.SD,
                    Referencia = dbOrder != null ? dbOrder.Referencia : request.PanelReference,
                    Puesto = request.Puesto,
                    Operador = request.Operador,
                    FechaActualServidor = serverTime,
                    QrCompleto = request.Qr,
                    ResultadoGeneral = "RECHAZADO",
                    Mano = dbOrder != null ? dbOrder.Mano : request.Mano,
                    Posicion = dbOrder != null ? dbOrder.Posicion : request.Posicion
                };

                // 1. Check Equivalence Config
                var equiv = await _dbService.GetEquivalenceAsync(validation.Referencia);
                if (equiv == null)
                {
                    validation.ResultadoGeneral = "RECHAZADO";
                    validation.MotivoRechazo = "PANEL SIN EQUIVALENCIA CONFIGURADA";
                    validation.ID_Validacion = await _dbService.InsertValidationLogAsync(validation);
                    return Ok(new { success = false, validation });
                }

                validation.CodigoOrnamentoEsperado = equiv.CodigoOrnamento;

                // 2. Parse QR Code
                var parseResult = _qrParser.ParseQr(request.Qr, configs);
                if (!parseResult.IsValid)
                {
                    validation.ResultadoGeneral = "RECHAZADO";
                    validation.MotivoRechazo = parseResult.ErrorMessage ?? "QR Invalido";
                    validation.ID_Validacion = await _dbService.InsertValidationLogAsync(validation);
                    return Ok(new { success = false, validation });
                }

                validation.CodigoOrnamentoLeido = parseResult.OrnamentCode;
                validation.NumeroSerie = parseResult.SerialNumber;
                validation.InicioCurado = parseResult.CureStartTime;

                // 3. Check Duplicates (QR code successfully used)
                var isDuplicate = await _dbService.CheckQrProcessedAsync(request.Qr);
                if (isDuplicate)
                {
                    var priorVal = await _dbService.GetPriorValidationByQrAsync(request.Qr);
                    validation.ResultadoGeneral = "RECHAZADO";
                    validation.MotivoRechazo = "ORNAMENTO YA PROCESADO";
                    validation.ID_Validacion = await _dbService.InsertValidationLogAsync(validation);
                    return Ok(new
                    {
                        success = false,
                        validation,
                        priorUse = priorVal != null ? new
                        {
                            fecha = priorVal.FechaLectura,
                            puesto = priorVal.Puesto,
                            panel = priorVal.Referencia,
                            ordenProduccion = priorVal.ID_OrdenProduccion,
                            operador = priorVal.Operador
                        } : null
                    });
                }

                // 4. Validate Ornament Correspondence
                string cleanExpected = (equiv.CodigoOrnamento ?? "").Replace(" ", "").Replace("-", "").ToUpper();
                string cleanLeido = (parseResult.OrnamentCode ?? "").Replace(" ", "").Replace("-", "").ToUpper();

                if (!cleanExpected.Equals(cleanLeido))
                {
                    validation.ResultadoCorrespondencia = "ORNAMENTO INCORRECTO";
                    validation.ResultadoGeneral = "RECHAZADO";
                    validation.MotivoRechazo = "ORNAMENTO INCORRECTO";
                    validation.ID_Validacion = await _dbService.InsertValidationLogAsync(validation);
                    return Ok(new { success = false, validation });
                }
                validation.ResultadoCorrespondencia = "ORNAMENTO CORRECTO";

                // 5. Validate Curing Time
                if (parseResult.CureStartTime.HasValue)
                {
                    var start = parseResult.CureStartTime.Value;
                    if (start > serverTime)
                    {
                        validation.ResultadoCurado = "FECHA DE CURADO INVÁLIDA";
                        validation.ResultadoGeneral = "RECHAZADO";
                        validation.MotivoRechazo = "FECHA DE CURADO INVÁLIDA";
                        validation.ID_Validacion = await _dbService.InsertValidationLogAsync(validation);
                        return Ok(new { success = false, validation });
                    }

                    double elapsedMinutes = (serverTime - start).TotalMinutes;
                    validation.MinutosCurado = (int)elapsedMinutes;
                    
                    int minHours = int.Parse(configs.GetValueOrDefault("Min_Curing_Hours", "4"));
                    validation.TiempoMinimoRequerido = minHours * 60;

                    if (elapsedMinutes < (minHours * 60))
                    {
                        validation.ResultadoCurado = "CURADO INSUFICIENTE";
                        validation.ResultadoGeneral = "RECHAZADO";
                        int remainingMin = (minHours * 60) - (int)elapsedMinutes;
                        validation.MotivoRechazo = $"CURADO INSUFICIENTE (FALTAN {remainingMin} MIN)";
                        validation.ID_Validacion = await _dbService.InsertValidationLogAsync(validation);
                        return Ok(new { success = false, validation, remainingMinutes = remainingMin });
                    }
                    validation.ResultadoCurado = "CURADO APROBADO";
                }
                else
                {
                    validation.ResultadoCurado = "N/A";
                }

                // 6. Complete Validation Approved
                validation.ResultadoGeneral = "APROBADO";
                validation.EstadoImpresion = "PENDIENTE";

                // Save log in DB
                validation.ID_Validacion = await _dbService.InsertValidationLogAsync(validation);

                // 7. Print Kanban label
                var printResult = await _printer.PrintKanbanAsync(validation, configs);
                if (!printResult.Success)
                {
                    await _dbService.UpdateValidationPrintStatusAsync(validation.ID_Validacion, "FALLIDO", printResult.PrinterUsed, printResult.ErrorMessage);
                    validation.EstadoImpresion = "FALLIDO";
                    validation.MensajeErrorTecnico = printResult.ErrorMessage;
                    
                    return Ok(new { 
                        success = false, 
                        message = "ERROR DE IMPRESIÓN", 
                        validation, 
                        preview = printResult.Base64LabelPreview 
                    });
                }

                await _dbService.UpdateValidationPrintStatusAsync(validation.ID_Validacion, "COMPLETO", printResult.PrinterUsed, null);
                validation.EstadoImpresion = "COMPLETO";

                // 8. Commit SQL database Sequence pointer advance
                try
                {
                    await _dbService.CompletePanelProcessAsync(
                        request.ID_OrdenProduccion,
                        request.ID_OrdenCliente,
                        request.Puesto,
                        request.Orden
                    );

                    await _dbService.UpdateValidationPointerAdvancedAsync(validation.ID_Validacion);
                    validation.FechaAvancePuntero = DateTime.Now;

                    _ = _arduinoService.SendClearAsync();

                    return Ok(new { 
                        success = true, 
                        message = "PROCESO COMPLETADO", 
                        validation, 
                        preview = printResult.Base64LabelPreview 
                    });
                }
                catch (Exception ex)
                {
                    // DB Pointer advance failed, but Kanban printed! (Prueba 10 scenario)
                    validation.MensajeErrorTecnico = $"Impresión exitosa, pero falló avance de puntero en base de datos. Detalle: {ex.Message}";
                    await _dbService.UpdateValidationPrintStatusAsync(validation.ID_Validacion, "COMPLETO", printResult.PrinterUsed, validation.MensajeErrorTecnico);
                    
                    return Ok(new { 
                        success = false, 
                        dbError = true, 
                        message = "ERROR AL ACTUALIZAR SECUENCIA EN BASE DE DATOS", 
                        validation, 
                        preview = printResult.Base64LabelPreview 
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ValidateScan Exception] {ex}");
                return StatusCode(500, new { message = "Error interno de servidor al validar.", detail = ex.Message, stackTrace = ex.StackTrace });
            }
        }

        [HttpPost("confirm-no-ornament")]
        public async Task<IActionResult> ConfirmNoOrnament([FromBody] ConfirmNoOrnamentRequest request)
        {
            try
            {
                if (request == null) return BadRequest("Datos inválidos.");

                Console.WriteLine($"[ConfirmNoOrnament] ID_OP={request.ID_OrdenProduccion}, ID_OC={request.ID_OrdenCliente}, Orden={request.Orden}, Secuencia={request.Secuencia}, Ref={request.PanelReference}, Puesto={request.Puesto}");

                var configs = await _dbService.GetConfigsAsync();
                var serverTime = await _dbService.GetServerDateTimeAsync();

                // Fetch order from database to ensure metadata matches the database truth
                var dbOrder = await _dbService.GetOrderProductionByIdAsync(request.ID_OrdenProduccion);

                var validation = new Validacion
                {
                    ID_OrdenProduccion = request.ID_OrdenProduccion,
                    ID_OrdenCliente = dbOrder != null ? dbOrder.ID_OrdenCliente : request.ID_OrdenCliente,
                    Orden = dbOrder != null ? dbOrder.Orden : request.Orden,
                    Secuencia = dbOrder != null ? dbOrder.Secuencia : request.Secuencia,
                    SD = dbOrder != null ? dbOrder.SD : request.SD,
                    Referencia = dbOrder != null ? dbOrder.Referencia : request.PanelReference,
                    Puesto = request.Puesto,
                    Operador = request.Operador,
                    FechaActualServidor = serverTime,
                    QrCompleto = $"SIN_ORNAMENTO_OP_{request.ID_OrdenProduccion}_SEC_{(dbOrder != null ? dbOrder.Secuencia : request.Secuencia)}_{Guid.NewGuid().ToString().Substring(0, 8)}",
                    ResultadoGeneral = "APROBADO",
                    ResultadoCorrespondencia = "N/A",
                    ResultadoCurado = "N/A",
                    EstadoImpresion = "PENDIENTE",
                    Mano = dbOrder != null ? dbOrder.Mano : request.Mano,
                    Posicion = dbOrder != null ? dbOrder.Posicion : request.Posicion
                };

                // Check Equivalence
                var equiv = await _dbService.GetEquivalenceAsync(validation.Referencia);
                if (equiv == null)
                {
                    validation.ResultadoGeneral = "RECHAZADO";
                    validation.MotivoRechazo = "PANEL SIN EQUIVALENCIA CONFIGURADA";
                    validation.ID_Validacion = await _dbService.InsertValidationLogAsync(validation);
                    return Ok(new { success = false, validation });
                }

                if (equiv.RequiereOrnamento)
                {
                    return BadRequest("Este panel requiere leer un ornamento, no puede confirmarse sin él.");
                }

                // Save log
                validation.ID_Validacion = await _dbService.InsertValidationLogAsync(validation);

                // Print Kanban label
                var printResult = await _printer.PrintKanbanAsync(validation, configs);
                if (!printResult.Success)
                {
                    await _dbService.UpdateValidationPrintStatusAsync(validation.ID_Validacion, "FALLIDO", printResult.PrinterUsed, printResult.ErrorMessage);
                    validation.EstadoImpresion = "FALLIDO";
                    
                    return Ok(new { 
                        success = false, 
                        message = "ERROR DE IMPRESIÓN", 
                        validation, 
                        preview = printResult.Base64LabelPreview 
                    });
                }

                await _dbService.UpdateValidationPrintStatusAsync(validation.ID_Validacion, "COMPLETO", printResult.PrinterUsed, null);
                validation.EstadoImpresion = "COMPLETO";

                // Advance DB pointer
                try
                {
                    await _dbService.CompletePanelProcessAsync(
                        request.ID_OrdenProduccion,
                        request.ID_OrdenCliente,
                        request.Puesto,
                        request.Orden
                    );

                    await _dbService.UpdateValidationPointerAdvancedAsync(validation.ID_Validacion);
                    validation.FechaAvancePuntero = DateTime.Now;

                    _ = _arduinoService.SendClearAsync();

                    return Ok(new { 
                        success = true, 
                        message = "PROCESO COMPLETADO", 
                        validation, 
                        preview = printResult.Base64LabelPreview 
                    });
                }
                catch (Exception ex)
                {
                    validation.MensajeErrorTecnico = $"Impresión exitosa, pero falló avance de puntero en base de datos. Detalle: {ex.Message}";
                    await _dbService.UpdateValidationPrintStatusAsync(validation.ID_Validacion, "COMPLETO", printResult.PrinterUsed, validation.MensajeErrorTecnico);
                    
                    return Ok(new { 
                        success = false, 
                        dbError = true, 
                        message = "ERROR AL ACTUALIZAR SECUENCIA EN BASE DE DATOS", 
                        validation, 
                        preview = printResult.Base64LabelPreview 
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ConfirmNoOrnament Exception] {ex}");
                return StatusCode(500, new { message = "Error interno de servidor al confirmar sin ornamento.", detail = ex.Message, stackTrace = ex.StackTrace });
            }
        }

        [HttpPost("retry-complete")]
        public async Task<IActionResult> RetryComplete([FromBody] RetryCompleteRequest request)
        {
            if (request == null) return BadRequest("Datos inválidos.");

            try
            {
                // Execute DB transaction
                await _dbService.CompletePanelProcessAsync(
                    request.ID_OrdenProduccion,
                    request.ID_OrdenCliente,
                    request.Puesto,
                    request.Orden
                );

                if (request.ID_Validacion > 0)
                {
                    await _dbService.UpdateValidationPointerAdvancedAsync(request.ID_Validacion);
                }

                return Ok(new { success = true, message = "Puntero avanzado correctamente en reintento." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error de transacción al reintentar.", detail = ex.Message });
            }
        }

        [HttpPost("reprint")]
        public async Task<IActionResult> Reprint([FromBody] ReprintRequest request)
        {
            if (request == null) return BadRequest("Solicitud inválida.");

            var configs = await _dbService.GetConfigsAsync();
            string supervisorPass = configs.GetValueOrDefault("Supervisor_Password", "1234");

            if (!request.SupervisorPassword.Equals(supervisorPass))
            {
                return Unauthorized(new { message = "Contraseña de supervisor incorrecta." });
            }

            try
            {
                var history = await _dbService.GetValidationHistoryAsync(
                    null, null, null, null, request.ID_OrdenProduccion, null, null, "APROBADO", null);
                
                Validacion? target = null;
                foreach (var log in history)
                {
                    if (log.ID_OrdenProduccion == request.ID_OrdenProduccion)
                    {
                        target = log;
                        break;
                    }
                }

                if (target == null)
                {
                    return NotFound(new { message = "No se encontró registro de validación aprobado para esta orden." });
                }

                // Append reprint audit details
                target.Operador = $"REIMPRESION ({request.Operador})";
                
                var printResult = await _printer.PrintKanbanAsync(target, configs);
                if (!printResult.Success)
                {
                    return BadRequest(new { message = "Fallo de impresión al reimprimir.", detail = printResult.ErrorMessage });
                }

                // Log a new validation record or update reprint logs as needed
                return Ok(new { success = true, message = "Reimpresión completada.", preview = printResult.Base64LabelPreview });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error al reimprimir.", detail = ex.Message });
            }
        }
    }

    public class ValidateScanRequest
    {
        public string Qr { get; set; } = string.Empty;
        public string PanelReference { get; set; } = string.Empty;
        public int ID_OrdenProduccion { get; set; }
        public int ID_OrdenCliente { get; set; }
        public int Orden { get; set; }
        public int Secuencia { get; set; }
        public string SD { get; set; } = string.Empty;
        public string Expr1 { get; set; } = string.Empty;
        public string Puesto { get; set; } = string.Empty;
        public string Operador { get; set; } = "OPERADOR";
        public string? Mano { get; set; }
        public string? Posicion { get; set; }
    }

    public class ConfirmNoOrnamentRequest
    {
        public string PanelReference { get; set; } = string.Empty;
        public int ID_OrdenProduccion { get; set; }
        public int ID_OrdenCliente { get; set; }
        public int Orden { get; set; }
        public int Secuencia { get; set; }
        public string SD { get; set; } = string.Empty;
        public string Expr1 { get; set; } = string.Empty;
        public string Puesto { get; set; } = string.Empty;
        public string Operador { get; set; } = "OPERADOR";
        public string? Mano { get; set; }
        public string? Posicion { get; set; }
    }

    public class RetryCompleteRequest
    {
        public int ID_Validacion { get; set; }
        public int ID_OrdenProduccion { get; set; }
        public int ID_OrdenCliente { get; set; }
        public string Puesto { get; set; } = string.Empty;
        public int Orden { get; set; }
    }

    public class ReprintRequest
    {
        public int ID_OrdenProduccion { get; set; }
        public string SupervisorPassword { get; set; } = string.Empty;
        public string Operador { get; set; } = string.Empty;
    }
}
