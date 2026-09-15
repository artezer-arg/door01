using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Backend.Models;
using Backend.Services;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ArduinoController : ControllerBase
    {
        private readonly IArduinoService _arduinoService;
        private readonly IDatabaseService _dbService;

        public ArduinoController(IArduinoService arduinoService, IDatabaseService dbService)
        {
            _arduinoService = arduinoService;
            _dbService = dbService;
        }

        [HttpGet("status")]
        public IActionResult GetStatus()
        {
            var status = _arduinoService.GetStatus();
            return Ok(status);
        }

        [HttpPost("reconnect")]
        public async Task<IActionResult> Reconnect()
        {
            await _arduinoService.ReloadConfigAsync();
            await _arduinoService.ReconnectAsync();
            return Ok(new { success = true, message = "Reconexión iniciada." });
        }

        [HttpPost("pick")]
        public async Task<IActionResult> SendPick([FromBody] ArduinoPickOrderRequest request)
        {
            if (request == null || request.Pick == null || request.Pick.Count == 0)
            {
                return BadRequest(new { success = false, message = "Debe proporcionar al menos una posición en 'pick'." });
            }

            bool sent = await _arduinoService.SendPickOrderAsync(request.Orden, request.Pick);
            return Ok(new { success = sent, message = sent ? "Orden enviada a Arduino." : "No se pudo enviar orden (Arduino desconectado o error)." });
        }

        [HttpPost("clear")]
        public async Task<IActionResult> SendClear()
        {
            bool sent = await _arduinoService.SendClearAsync();
            return Ok(new { success = sent, message = sent ? "Comando CLEAR enviado." : "No se pudo enviar CLEAR." });
        }

        [HttpPost("test-light")]
        public async Task<IActionResult> TestLight([FromBody] ArduinoLightTestRequest request)
        {
            if (request == null || request.Position < 0)
            {
                return BadRequest(new { success = false, message = "Posición inválida." });
            }

            bool sent = await _arduinoService.SendLightTestAsync(request.Position, request.State);
            return Ok(new { 
                success = sent, 
                message = sent 
                    ? $"Luz {request.Position} {(request.State ? "encendida" : "apagada")} correctamente." 
                    : "Error al enviar comando a Arduino." 
            });
        }

        [HttpGet("mapping")]
        public async Task<IActionResult> GetMappings()
        {
            var mappings = await _dbService.GetLinkSocketsAsync();
            return Ok(mappings);
        }

        [HttpPost("mapping")]
        public async Task<IActionResult> UpsertMapping([FromBody] LinkSocketUpsertRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Referencia) || string.IsNullOrWhiteSpace(request.Señal))
            {
                return BadRequest(new { success = false, message = "Referencia y Señal son requeridas." });
            }

            bool ok = await _dbService.UpsertLinkSocketAsync(request.Referencia.Trim(), request.Señal.Trim());
            return Ok(new { success = ok, message = "Mapeo guardado exitosamente." });
        }

        [HttpDelete("mapping/{referencia}")]
        public async Task<IActionResult> DeleteMapping(string referencia)
        {
            if (string.IsNullOrWhiteSpace(referencia))
            {
                return BadRequest(new { success = false, message = "Referencia inválida." });
            }

            bool ok = await _dbService.DeleteLinkSocketAsync(referencia.Trim());
            return Ok(new { success = ok, message = "Mapeo eliminado." });
        }
    }
}
