using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Backend.Models;

namespace Backend.Services
{
    public class ArduinoService : BackgroundService, IArduinoService
    {
        private readonly IDatabaseService _dbService;
        private readonly ILogger<ArduinoService> _logger;
        
        private TcpClient? _client;
        private NetworkStream? _stream;
        private StreamReader? _reader;
        private StreamWriter? _writer;
        private readonly SemaphoreSlim _sendLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _reconnectSignal = new SemaphoreSlim(0, 1);

        private bool _enabled = true;
        private string _ip = "192.168.3.200";
        private int _port = 8080;
        private int _heartbeatTimeoutSec = 15;
        private int _reconnectIntervalSec = 5;

        private bool _isConnected = false;
        private DateTime? _lastHeartbeat = null;
        private DateTime? _lastConnected = null;
        private string? _lastAck = null;
        private string? _lastCommandSent = null;
        private string? _lastErrorMessage = null;

        public ArduinoService(IDatabaseService dbService, ILogger<ArduinoService> logger)
        {
            _dbService = dbService;
            _logger = logger;
        }

        public ArduinoStatus GetStatus()
        {
            return new ArduinoStatus
            {
                Enabled = _enabled,
                IsConnected = _isConnected && _client != null && _client.Connected,
                Ip = _ip,
                Port = _port,
                LastHeartbeat = _lastHeartbeat,
                LastConnected = _lastConnected,
                LastAck = _lastAck,
                LastCommandSent = _lastCommandSent,
                LastErrorMessage = _lastErrorMessage
            };
        }

        public async Task ReloadConfigAsync()
        {
            try
            {
                var configs = await _dbService.GetConfigsAsync();
                _enabled = bool.TryParse(configs.GetValueOrDefault("Arduino_Enabled", "true"), out var en) ? en : true;
                _ip = configs.GetValueOrDefault("Arduino_IP", "192.168.3.200").Trim();
                _port = int.TryParse(configs.GetValueOrDefault("Arduino_Port", "8080"), out var p) ? p : 8080;
                _heartbeatTimeoutSec = int.TryParse(configs.GetValueOrDefault("Arduino_Heartbeat_Timeout_Sec", "15"), out var ht) ? ht : 15;
                _reconnectIntervalSec = int.TryParse(configs.GetValueOrDefault("Arduino_Reconnect_Interval_Sec", "5"), out var ri) ? ri : 5;
                
                _logger.LogInformation("[ArduinoService] Configuración recargada: Enabled={Enabled}, IP={IP}:{Port}", _enabled, _ip, _port);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ArduinoService] Error al cargar configuración de Arduino");
            }
        }

        public async Task ReconnectAsync()
        {
            _logger.LogInformation("[ArduinoService] Solicitada reconexión manual...");
            CloseConnection();
            if (_reconnectSignal.CurrentCount == 0)
            {
                _reconnectSignal.Release();
            }
            await Task.CompletedTask;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[ArduinoService] Servicio de comunicación TCP con ESP32 iniciado.");
            await ReloadConfigAsync();

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    if (!_enabled)
                    {
                        CloseConnection();
                        await Task.Delay(2000, stoppingToken);
                        continue;
                    }

                    if (_client == null || !_client.Connected)
                    {
                        await TryConnectAsync(stoppingToken);
                    }

                    if (_isConnected && _client != null && _client.Connected)
                    {
                        // Monitor heartbeat watchdog: si no llega en > 15s, asumir caído y reconectar
                        if (_lastHeartbeat.HasValue && (DateTime.Now - _lastHeartbeat.Value).TotalSeconds > _heartbeatTimeoutSec)
                        {
                            _logger.LogWarning("[ArduinoService] Heartbeat timeout (> {Timeout}s) sin señal de ESP32. Asumiendo nodo caído...", _heartbeatTimeoutSec);
                            _lastErrorMessage = $"Timeout de heartbeat (> {_heartbeatTimeoutSec}s)";
                            CloseConnection();
                        }
                    }

                    // Esperar antes del siguiente chequeo o hasta señal de reconexión
                    await Task.WhenAny(
                        Task.Delay(1000, stoppingToken),
                        _reconnectSignal.WaitAsync(stoppingToken)
                    );
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[ArduinoService] Error en bucle principal");
                    CloseConnection();
                    await Task.Delay(TimeSpan.FromSeconds(_reconnectIntervalSec), stoppingToken);
                }
            }

            CloseConnection();
            _logger.LogInformation("[ArduinoService] Servicio de comunicación TCP detenido.");
        }

        private async Task TryConnectAsync(CancellationToken stoppingToken)
        {
            try
            {
                CloseConnection();
                _logger.LogInformation("[ArduinoService] Conectando a ESP32 en {IP}:{Port}...", _ip, _port);
                
                var client = new TcpClient();
                // Timeout de conexión de 4 segundos
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                cts.CancelAfter(4000);

                await client.ConnectAsync(_ip, _port, cts.Token);

                _client = client;
                _stream = client.GetStream();
                _reader = new StreamReader(_stream, Encoding.UTF8);
                _writer = new StreamWriter(_stream, Encoding.UTF8) { AutoFlush = true, NewLine = "\n" };

                _isConnected = true;
                _lastConnected = DateTime.Now;
                _lastHeartbeat = DateTime.Now; // Inicializar para evitar timeout inmediato
                _lastErrorMessage = null;
                _logger.LogInformation("[ArduinoService] Conexión TCP establecida exitosamente con ESP32 en {IP}:{Port}", _ip, _port);

                // Lanzar lector de líneas en segundo plano
                _ = Task.Run(() => ReadIncomingMessagesLoopAsync(stoppingToken), stoppingToken);
            }
            catch (Exception ex)
            {
                _isConnected = false;
                _lastErrorMessage = $"Error al conectar a {_ip}:{_port}: {ex.Message}";
                _logger.LogWarning("[ArduinoService] No se pudo conectar a {IP}:{Port}. Reintentando en {Sec}s...", _ip, _port, _reconnectIntervalSec);
                CloseConnection();
                await Task.Delay(TimeSpan.FromSeconds(_reconnectIntervalSec), stoppingToken);
            }
        }

        private async Task ReadIncomingMessagesLoopAsync(CancellationToken stoppingToken)
        {
            var reader = _reader;
            if (reader == null) return;

            try
            {
                while (!stoppingToken.IsCancellationRequested && _isConnected && reader != null)
                {
                    string? line = await reader.ReadLineAsync(stoppingToken);
                    if (line == null)
                    {
                        // Fin de stream (servidor cerró socket)
                        _logger.LogWarning("[ArduinoService] El ESP32 cerró la conexión TCP (stream finalizado).");
                        CloseConnection();
                        break;
                    }

                    line = line.Trim();
                    if (string.IsNullOrEmpty(line)) continue;

                    ProcessIncomingMessage(line);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                _logger.LogWarning("[ArduinoService] Error de lectura en socket: {Msg}", ex.Message);
                CloseConnection();
            }
        }

        private void ProcessIncomingMessage(string json)
        {
            try
            {
                _lastHeartbeat = DateTime.Now; // Cualquier mensaje recibido confirma que el nodo está vivo
                
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (root.TryGetProperty("type", out var typeProp))
                {
                    string type = typeProp.GetString() ?? string.Empty;

                    if (type.Equals("heartbeat", StringComparison.OrdinalIgnoreCase))
                    {
                        _lastHeartbeat = DateTime.Now;
                        // _logger.LogDebug("[ArduinoService] Heartbeat recibido de ESP32");
                    }
                    else if (type.Equals("ack", StringComparison.OrdinalIgnoreCase))
                    {
                        _lastAck = json;
                        string ackType = root.TryGetProperty("ack", out var a) ? a.GetString() ?? "" : "";
                        _logger.LogInformation("[ArduinoService] ACK recibido: {Ack} -> {Json}", ackType, json);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[ArduinoService] Mensaje no JSON o error al procesar: '{Raw}' ({Msg})", json, ex.Message);
            }
        }

        private void CloseConnection()
        {
            _isConnected = false;
            try { _writer?.Dispose(); } catch { }
            try { _reader?.Dispose(); } catch { }
            try { _stream?.Dispose(); } catch { }
            try { _client?.Close(); } catch { }
            try { _client?.Dispose(); } catch { }

            _writer = null;
            _reader = null;
            _stream = null;
            _client = null;
        }

        private async Task<bool> SendJsonAsync(string json)
        {
            if (!_enabled)
            {
                _logger.LogWarning("[ArduinoService] Arduino deshabilitado en configuración. No se envía: {Json}", json);
                return false;
            }

            await _sendLock.WaitAsync();
            try
            {
                if (!_isConnected || _writer == null || _client == null || !_client.Connected)
                {
                    _lastErrorMessage = "No conectado con Arduino ESP32";
                    _logger.LogWarning("[ArduinoService] Intento de envío sin conexión TCP activa: {Json}", json);
                    return false;
                }

                await _writer.WriteLineAsync(json);
                await _writer.FlushAsync();
                
                _lastCommandSent = json;
                _logger.LogInformation("[ArduinoService] Comando enviado a ESP32: {Json}", json);
                return true;
            }
            catch (Exception ex)
            {
                _lastErrorMessage = $"Fallo al enviar comando: {ex.Message}";
                _logger.LogError(ex, "[ArduinoService] Error al escribir en socket TCP: {Json}", json);
                CloseConnection();
                return false;
            }
            finally
            {
                _sendLock.Release();
            }
        }

        public async Task<bool> SendPickOrderAsync(string orden, IEnumerable<int> positions)
        {
            var posList = positions.ToList();
            var payload = new
            {
                orden = string.IsNullOrWhiteSpace(orden) ? "OP-0" : orden,
                pick = posList
            };

            string json = JsonSerializer.Serialize(payload);
            return await SendJsonAsync(json);
        }

        public async Task<bool> SendClearAsync()
        {
            var payload = new { cmd = "CLEAR" };
            string json = JsonSerializer.Serialize(payload);
            return await SendJsonAsync(json);
        }

        public async Task<bool> SendLightTestAsync(int position, bool state)
        {
            var payload = new
            {
                cmd = "LIGHT_TEST",
                position = position,
                state = state
            };

            string json = JsonSerializer.Serialize(payload);
            return await SendJsonAsync(json);
        }

        public async Task<bool> TriggerPanelLightsAsync(string referencia, int idOrdenProduccion)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(referencia))
                {
                    return await SendClearAsync();
                }

                var positions = await _dbService.GetPickPositionsForReferenceAsync(referencia);
                if (positions.Any())
                {
                    _logger.LogInformation("[ArduinoService] Referencia '{Ref}' mapeada a posiciones [{Positions}]. Enviando orden...", 
                        referencia, string.Join(",", positions));
                    return await SendPickOrderAsync($"OP-{idOrdenProduccion}", positions);
                }
                else
                {
                    _logger.LogWarning("[ArduinoService] Referencia '{Ref}' no tiene posiciones en Link_Socket_TCP.", referencia);
                    return await SendClearAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ArduinoService] Error al activar luces para panel {Ref}", referencia);
                return false;
            }
        }
    }
}
