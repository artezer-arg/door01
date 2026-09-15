using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Backend.Services;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SequenceController : ControllerBase
    {
        private readonly IDatabaseService _dbService;
        private readonly IArduinoService _arduinoService;

        public SequenceController(IDatabaseService dbService, IArduinoService arduinoService)
        {
            _dbService = dbService;
            _arduinoService = arduinoService;
        }

        [HttpGet("next")]
        public async Task<IActionResult> GetNext([FromQuery] string puesto)
        {
            if (string.IsNullOrEmpty(puesto))
            {
                return BadRequest("El puesto es requerido.");
            }

            try
            {
                var nextPanel = await _dbService.GetNextPanelAsync(puesto);
                if (nextPanel == null)
                {
                    _ = _arduinoService.SendClearAsync();
                    return NotFound(new { message = $"SIN PANELES PENDIENTES PARA EL PUESTO {puesto.ToUpper()}" });
                }

                // Disparar las luces Pick-to-Light para este panel de forma no bloqueante
                _ = _arduinoService.TriggerPanelLightsAsync(nextPanel.Referencia, nextPanel.ID_OrdenProduccion);

                // Check equivalence mapping dynamically to see if ornament is required
                var equiv = await _dbService.GetEquivalenceAsync(nextPanel.Referencia);
                bool requiereOrnamento = equiv?.RequiereOrnamento ?? true; // Default to true if not configured

                return Ok(new {
                    nextPanel.Referencia,
                    nextPanel.ID_OrdenProduccion,
                    nextPanel.ID_OrdenCliente,
                    nextPanel.Orden,
                    nextPanel.Secuencia,
                    nextPanel.SD,
                    nextPanel.Expr1,
                    nextPanel.Puesto,
                    nextPanel.FechaSecuencia,
                    nextPanel.Mano,
                    nextPanel.Posicion,
                    RequiereOrnamento = requiereOrnamento
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error de conexión con la base de datos.", detail = ex.Message });
            }
        }

        [HttpPost("complete")]
        public async Task<IActionResult> Complete([FromBody] CompleteRequest request)
        {
            if (request == null) return BadRequest("Datos inválidos.");

            try
            {
                await _dbService.CompletePanelProcessAsync(
                    request.ID_OrdenProduccion, 
                    request.ID_OrdenCliente, 
                    request.Puesto, 
                    request.Orden
                );
                return Ok(new { success = true, message = "Secuencia avanzada correctamente." });
            }
            catch (SqlException ex) when (ex.Number == 50001 || ex.Number == 50002)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Error al completar la secuencia.", detail = ex.Message });
            }
        }
    }

    public class CompleteRequest
    {
        public int ID_OrdenProduccion { get; set; }
        public int ID_OrdenCliente { get; set; }
        public string Puesto { get; set; } = string.Empty;
        public int Orden { get; set; }
    }
}
