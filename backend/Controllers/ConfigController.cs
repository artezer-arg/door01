using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Backend.Services;

namespace Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ConfigController : ControllerBase
    {
        private readonly IDatabaseService _dbService;

        public ConfigController(IDatabaseService dbService)
        {
            _dbService = dbService;
        }

        [HttpGet]
        public async Task<IActionResult> GetConfigs()
        {
            try
            {
                var dict = await _dbService.GetConfigsAsync();
                return Ok(dict);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error al obtener la configuración.", detail = ex.Message });
            }
        }

        [HttpPut]
        public async Task<IActionResult> UpdateConfig([FromBody] UpdateConfigRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.Key))
            {
                return BadRequest("Datos de configuración inválidos.");
            }

            try
            {
                var success = await _dbService.UpdateConfigValueAsync(
                    request.Key, 
                    request.Value, 
                    request.User ?? "ADMIN", 
                    request.Motivo
                );
                return Ok(new { success, message = "Configuración actualizada correctamente." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error al actualizar configuración.", detail = ex.Message });
            }
        }

        [HttpPut("batch")]
        public async Task<IActionResult> UpdateConfigsBatch([FromBody] System.Collections.Generic.List<UpdateConfigRequest> requests, [FromQuery] string? user = null)
        {
            if (requests == null || requests.Count == 0)
            {
                return BadRequest("La lista de configuraciones está vacía.");
            }

            try
            {
                string effectiveUser = user ?? requests.Find(r => !string.IsNullOrEmpty(r.User))?.User ?? "ADMIN";
                var items = System.Linq.Enumerable.Select(requests, r => (r.Key, r.Value, r.Motivo));
                var success = await _dbService.UpdateConfigsBatchAsync(items, effectiveUser);
                return Ok(new { success, message = "Configuraciones actualizadas en lote correctamente." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error al actualizar lote de configuraciones.", detail = ex.Message });
            }
        }

        [HttpGet("audit")]
        public async Task<IActionResult> GetAuditLogs()
        {
            try
            {
                var logs = await _dbService.GetConfigAuditsAsync();
                return Ok(logs);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error al obtener auditoría de configuración.", detail = ex.Message });
            }
        }

        [HttpGet("connection")]
        public IActionResult GetConnectionString()
        {
            try
            {
                string connStr = DatabaseService.GetCurrentConnectionString();
                return Ok(new { connectionString = connStr });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error al obtener cadena de conexión.", detail = ex.Message });
            }
        }

        [HttpPost("connection")]
        public async Task<IActionResult> UpdateConnectionString([FromBody] ConnectionConfigRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.ConnectionString))
            {
                return BadRequest("Cadena de conexión vacía.");
            }

            try
            {
                bool canConnect = await _dbService.TestConnectionAsync(request.ConnectionString);
                if (!canConnect)
                {
                    return Ok(new { success = false, message = "No se pudo conectar a SQL Server. Verifique el servidor, base de datos, usuario y contraseña." });
                }

                DatabaseService.UpdateConnectionString(request.ConnectionString);
                return Ok(new { success = true, message = "Cadena de conexión guardada y aplicada correctamente." });
            }
            catch (Exception ex)
            {
                return Ok(new { success = false, message = $"Error al probar conexión: {ex.Message}" });
            }
        }
    }

    public class UpdateConfigRequest
    {
        public string Key { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public string? User { get; set; }
        public string? Motivo { get; set; }
    }

    public class ConnectionConfigRequest
    {
        public string ConnectionString { get; set; } = string.Empty;
    }
}
