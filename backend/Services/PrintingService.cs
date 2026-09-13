using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using Backend.Models;

namespace Backend.Services
{
    // Native Windows Spooler raw printing helper class
    public class RawPrinterHelper
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        public class DOCINFOA
        {
            [MarshalAs(UnmanagedType.LPStr)] public string pDocName = "";
            [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile = "";
            [MarshalAs(UnmanagedType.LPStr)] public string pDataType = "";
        }

        [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

        [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

        public static bool SendStringToPrinter(string szPrinterName, string szString)
        {
            IntPtr hPrinter = IntPtr.Zero;
            DOCINFOA di = new DOCINFOA();
            bool bSuccess = false;

            di.pDocName = "Zebra ZPL Raw Print Job";
            di.pDataType = "RAW";

            if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero))
            {
                if (StartDocPrinter(hPrinter, 1, di))
                {
                    if (StartPagePrinter(hPrinter))
                    {
                        IntPtr pBytes = Marshal.StringToCoTaskMemAnsi(szString);
                        int dwCount = szString.Length;
                        int dwWritten = 0;
                        bSuccess = WritePrinter(hPrinter, pBytes, dwCount, out dwWritten);
                        Marshal.FreeCoTaskMem(pBytes);
                        EndPagePrinter(hPrinter);
                    }
                    EndDocPrinter(hPrinter);
                }
                ClosePrinter(hPrinter);
            }
            return bSuccess;
        }
    }

    public class PrintingService : IPrintingService
    {
        private readonly IDatabaseService _dbService;
        private static bool _isLabelaryAvailable = true;
        private static DateTime _lastConnectionCheck = DateTime.MinValue;
        private static readonly object _checkLock = new object();

        private const string DefaultStandardTemplate = @"^XA
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
^XZ";

        public PrintingService(IDatabaseService dbService)
        {
            _dbService = dbService;
        }

        public IEnumerable<string> GetInstalledPrinters()
        {
            var printers = new List<string>();
            try
            {
                foreach (string printer in PrinterSettings.InstalledPrinters)
                {
                    printers.Add(printer);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error enumerando impresoras: {ex.Message}");
            }
            return printers;
        }

        public async Task<PrintJobResult> PrintKanbanAsync(Validacion validation, Dictionary<string, string> config)
        {
            // Load all database configs as base
            var mergedConfig = await _dbService.GetConfigsAsync();
            // Merge passed overrides (like Printer_Name or Printer_Simulator_Enabled from TestPrint)
            foreach (var kvp in config)
            {
                mergedConfig[kvp.Key] = kvp.Value;
            }

            bool simulatorEnabled = bool.Parse(mergedConfig.GetValueOrDefault("Printer_Simulator_Enabled", "true"));
            string printerMode = mergedConfig.GetValueOrDefault("Printer_Mode", "Spooler"); // Spooler, NetworkRaw
            string printerName = mergedConfig.GetValueOrDefault("Printer_Name", "Microsoft Print to PDF");
            string printerIp = mergedConfig.GetValueOrDefault("Printer_IP", "192.168.1.100");
            int printerPort = int.Parse(mergedConfig.GetValueOrDefault("Printer_Port", "9100"));
            string zplTemplate = mergedConfig.GetValueOrDefault("Printer_Zpl_Template", "");
            if (string.IsNullOrWhiteSpace(zplTemplate))
            {
                zplTemplate = DefaultStandardTemplate;
            }
            int copies = int.Parse(mergedConfig.GetValueOrDefault("Print_Copies", "1"));

            if (copies <= 0) copies = 1;

            var result = new PrintJobResult();

            try
            {
                // 1. Process ZPL template variable replacements
                string processedZpl = ReplaceZplPlaceholders(zplTemplate, validation);

                // 2. Generate the base64 preview (Hybrid preview: Labelary online -> C# GDI fallback offline)
                result.Base64LabelPreview = await GetLabelPreviewAsync(processedZpl, validation, mergedConfig);

                // 3. Save simulation file if requested (for logging/development testing)
                string targetFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "PrintedLabels");
                Directory.CreateDirectory(targetFolder);
                string fileName = $"Kanban_{validation.ID_OrdenProduccion}_{DateTime.Now:yyyyMMddHHmmss}.png";
                string filePath = Path.Combine(targetFolder, fileName);
                
                // Decode base64 to save preview file
                byte[] previewBytes = Convert.FromBase64String(result.Base64LabelPreview);
                await File.WriteAllBytesAsync(filePath, previewBytes);
                result.SavedFilePath = filePath;

                if (!simulatorEnabled)
                {
                    if (printerMode.Equals("NetworkRaw", StringComparison.OrdinalIgnoreCase))
                    {
                        // Direct TCP raw socket printing to Zebra
                        var rawPayload = new StringBuilder();
                        for (int i = 0; i < copies; i++)
                        {
                            rawPayload.Append(processedZpl).Append("\n");
                        }
                        
                        await SendToNetworkZebraAsync(printerIp, printerPort, rawPayload.ToString());
                        result.PrinterUsed = $"Zebra IP ({printerIp}:{printerPort})";
                        result.Success = true;
                    }
                    else // Spooler mode (USB / Windows Driver)
                    {
                        // Check if printer selected is a Zebra (or Generic/Text Only) to use ZPL raw spooling
                        bool isZebraDriver = printerName.IndexOf("Zebra", StringComparison.OrdinalIgnoreCase) >= 0 
                                             || printerName.IndexOf("ZDesigner", StringComparison.OrdinalIgnoreCase) >= 0
                                             || printerName.IndexOf("Generic", StringComparison.OrdinalIgnoreCase) >= 0;

                        if (isZebraDriver)
                        {
                            var rawPayload = new StringBuilder();
                            for (int i = 0; i < copies; i++)
                            {
                                rawPayload.Append(processedZpl).Append("\n");
                            }
                            
                            bool rawSuccess = RawPrinterHelper.SendStringToPrinter(printerName, rawPayload.ToString());
                            if (!rawSuccess)
                            {
                                throw new InvalidOperationException($"No se pudo enviar ZPL a la cola de impresión de la impresora USB '{printerName}'");
                            }
                            
                            result.PrinterUsed = $"{printerName} (USB Raw ZPL)";
                            result.Success = true;
                        }
                        else
                        {
                            // Standard Spooler Graphics Printing (GDI fallback for PDFs/Standard drivers)
                            var doc = new PrintDocument();
                            doc.PrinterSettings.PrinterName = printerName;
                            doc.PrinterSettings.Copies = (short)copies;

                            if (!doc.PrinterSettings.IsValid)
                            {
                                result.Success = false;
                                result.ErrorMessage = $"La impresora '{printerName}' no es válida o está desconectada.";
                                return result;
                            }

                            doc.PrintPage += (sender, ev) =>
                            {
                                if (ev.Graphics == null) return;
                                try
                                {
                                    if (!string.IsNullOrEmpty(result.Base64LabelPreview))
                                    {
                                        byte[] imageBytes = Convert.FromBase64String(result.Base64LabelPreview);
                                        using (var ms = new MemoryStream(imageBytes))
                                        {
                                            using (var img = Image.FromStream(ms))
                                            {
                                                // Calculate fitting rectangle
                                                // Keep aspect ratio
                                                float imgAspect = (float)img.Width / img.Height;
                                                float printAspect = (float)ev.MarginBounds.Width / ev.MarginBounds.Height;
                                                
                                                int drawWidth = ev.MarginBounds.Width;
                                                int drawHeight = ev.MarginBounds.Height;
                                                int drawX = ev.MarginBounds.Left;
                                                int drawY = ev.MarginBounds.Top;

                                                if (imgAspect > printAspect)
                                                {
                                                    drawHeight = (int)(ev.MarginBounds.Width / imgAspect);
                                                    drawY = ev.MarginBounds.Top + (ev.MarginBounds.Height - drawHeight) / 2;
                                                }
                                                else
                                                {
                                                    drawWidth = (int)(ev.MarginBounds.Height * imgAspect);
                                                    drawX = ev.MarginBounds.Left + (ev.MarginBounds.Width - drawWidth) / 2;
                                                }

                                                ev.Graphics.DrawImage(img, drawX, drawY, drawWidth, drawHeight);
                                            }
                                        }
                                    }
                                    else
                                    {
                                        var (w, h) = ParseZplDimensions(processedZpl, mergedConfig);
                                        DrawZplLabel(ev.Graphics!, processedZpl, w, h);
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine($"Error al renderizar etiqueta para impresión GDI, reintentando dibujo directo: {ex.Message}");
                                    var (w, h) = ParseZplDimensions(processedZpl, mergedConfig);
                                    DrawZplLabel(ev.Graphics!, processedZpl, w, h);
                                }
                                ev.HasMorePages = false;
                            };

                            doc.Print();
                            result.PrinterUsed = printerName;
                            result.Success = true;
                        }
                    }
                }
                else
                {
                    result.PrinterUsed = "SIMULADOR (Virtual)";
                    result.Success = true;
                }
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.ErrorMessage = $"Error al imprimir: {ex.Message}";
            }

            return result;
        }

        private string ReplaceZplPlaceholders(string zplTemplate, Validacion val)
        {
            if (string.IsNullOrEmpty(zplTemplate)) return string.Empty;

            string output = zplTemplate;
            output = output.Replace("{Puesto}", val.Puesto ?? "");
            output = output.Replace("{Referencia}", val.Referencia ?? "");
            output = output.Replace("{Ornamento}", string.IsNullOrEmpty(val.CodigoOrnamentoLeido) ? "SIN ORNAMENTO" : val.CodigoOrnamentoLeido);
            output = output.Replace("{OrdenProduccion}", val.ID_OrdenProduccion.ToString());
            output = output.Replace("{OrdenCliente}", val.ID_OrdenCliente.ToString());
            output = output.Replace("{Secuencia}", val.Secuencia?.ToString() ?? "N/A");
            output = output.Replace("{SD}", val.SD ?? "N/A");
            output = output.Replace("{Orden}", val.Orden.ToString());
            output = output.Replace("{Posicion}", val.Posicion ?? "");
            
            // Safe Mano / Pos extraction
            string combinedMano = "N/A";
            if (!string.IsNullOrEmpty(val.Posicion) || !string.IsNullOrEmpty(val.Mano))
            {
                combinedMano = $"{val.Posicion ?? "N/A"} - {val.Mano ?? "N/A"}";
            }
            else if (!string.IsNullOrEmpty(val.CodigoOrnamentoLeido) && val.CodigoOrnamentoLeido.Length >= 5)
            {
                combinedMano = "F - " + val.CodigoOrnamentoLeido.Substring(val.CodigoOrnamentoLeido.Length - 5);
            }
            else if (!string.IsNullOrEmpty(val.CodigoOrnamentoLeido))
            {
                combinedMano = "F - " + val.CodigoOrnamentoLeido;
            }
            output = output.Replace("{ManoCompuesta}", combinedMano);
            
            // Raw Mano from DB
            output = output.Replace("{Mano}", val.Mano ?? "");

            output = output.Replace("{MinutosCurado}", val.MinutosCurado?.ToString() ?? "0");
            output = output.Replace("{QrCompleto}", val.QrCompleto ?? "");
            output = output.Replace("{FechaLectura}", val.FechaLectura.ToString("dd/MM/yyyy HH:mm:ss"));
            return output;
        }

        public async Task<string> GeneratePreviewAsync(
            string zplTemplate, 
            Validacion validation, 
            double? widthInches = null, 
            double? heightInches = null, 
            int? dpi = null)
        {
            var config = await _dbService.GetConfigsAsync();
            if (widthInches.HasValue) config["Printer_Label_Width_Inches"] = widthInches.Value.ToString();
            if (heightInches.HasValue) config["Printer_Label_Height_Inches"] = heightInches.Value.ToString();
            if (dpi.HasValue) config["Printer_Label_DPI"] = dpi.Value.ToString();

            string processedZpl = ReplaceZplPlaceholders(zplTemplate, validation);
            return await GetLabelPreviewAsync(processedZpl, validation, config);
        }

        private async Task<string> GetLabelPreviewAsync(string zplCode, Validacion validation, Dictionary<string, string> config)
        {
            double widthInches = double.Parse(config.GetValueOrDefault("Printer_Label_Width_Inches", "4"));
            double heightInches = double.Parse(config.GetValueOrDefault("Printer_Label_Height_Inches", "3"));
            int dpi = int.Parse(config.GetValueOrDefault("Printer_Label_DPI", "203"));

            string dpmmStr = (dpi == 300) ? "12dpmm" : (dpi == 600) ? "24dpmm" : "8dpmm";

            bool checkOnline = false;
            lock (_checkLock)
            {
                if (DateTime.Now - _lastConnectionCheck > TimeSpan.FromMinutes(5))
                {
                    checkOnline = true;
                    _lastConnectionCheck = DateTime.Now;
                }
            }

            if (checkOnline)
            {
                try
                {
                    using var httpClient = new HttpClient();
                    httpClient.Timeout = TimeSpan.FromSeconds(2); // Fast check
                    string url = $"http://api.labelary.com/v1/printers/{dpmmStr}/labels/{widthInches}x{heightInches}/0/";
                    var response = await httpClient.PostAsync(url, new StringContent(zplCode, Encoding.UTF8, "application/x-www-form-urlencoded"));
                    
                    if (response.IsSuccessStatusCode)
                    {
                        _isLabelaryAvailable = true;
                        byte[] imageBytes = await response.Content.ReadAsByteArrayAsync();
                        return Convert.ToBase64String(imageBytes);
                    }
                    else
                    {
                        _isLabelaryAvailable = false;
                    }
                }
                catch
                {
                    _isLabelaryAvailable = false;
                }
            }
            else if (_isLabelaryAvailable)
            {
                // Try quick fetch since it was available recently
                try
                {
                    using var httpClient = new HttpClient();
                    httpClient.Timeout = TimeSpan.FromSeconds(1.5);
                    string url = $"http://api.labelary.com/v1/printers/{dpmmStr}/labels/{widthInches}x{heightInches}/0/";
                    var response = await httpClient.PostAsync(url, new StringContent(zplCode, Encoding.UTF8, "application/x-www-form-urlencoded"));
                    if (response.IsSuccessStatusCode)
                    {
                        byte[] imageBytes = await response.Content.ReadAsByteArrayAsync();
                        return Convert.ToBase64String(imageBytes);
                    }
                    else
                    {
                        _isLabelaryAvailable = false;
                    }
                }
                catch
                {
                    _isLabelaryAvailable = false;
                }
            }

            // Fallback GDI Local Drawing
            var (widthDots, heightDots) = ParseZplDimensions(zplCode, config);

            using (var bitmap = new Bitmap(widthDots, heightDots))
            {
                using (var graphics = Graphics.FromImage(bitmap))
                {
                    graphics.Clear(Color.White);
                    DrawZplLabel(graphics, zplCode, widthDots, heightDots);
                }

                using (var ms = new MemoryStream())
                {
                    bitmap.Save(ms, ImageFormat.Png);
                    return Convert.ToBase64String(ms.ToArray());
                }
            }
        }

        private (int width, int height) ParseZplDimensions(string zpl, Dictionary<string, string> config)
        {
            double widthInches = double.Parse(config.GetValueOrDefault("Printer_Label_Width_Inches", "4"));
            double heightInches = double.Parse(config.GetValueOrDefault("Printer_Label_Height_Inches", "3"));
            int dpi = int.Parse(config.GetValueOrDefault("Printer_Label_DPI", "203"));

            int width = (int)Math.Round(widthInches * dpi);
            int height = (int)Math.Round(heightInches * dpi);

            if (string.IsNullOrEmpty(zpl)) return (width, height);

            var pwMatch = System.Text.RegularExpressions.Regex.Match(zpl, @"\^PW(\d+)");
            if (pwMatch.Success)
            {
                int.TryParse(pwMatch.Groups[1].Value, out width);
            }

            var llMatch = System.Text.RegularExpressions.Regex.Match(zpl, @"\^LL(\d+)");
            if (llMatch.Success)
            {
                int.TryParse(llMatch.Groups[1].Value, out height);
            }

            return (width, height);
        }

        private Task SendToNetworkZebraAsync(string ip, int port, string zplData)
        {
            using var client = new System.Net.Sockets.TcpClient();
            var connectTask = client.ConnectAsync(ip, port);
            
            // Timeout of 4 seconds for printer TCP socket connection
            if (Task.WhenAny(connectTask, Task.Delay(4000)).Result == connectTask)
            {
                connectTask.Wait(); // propagate exceptions if connection failed
                using var stream = client.GetStream();
                byte[] data = Encoding.ASCII.GetBytes(zplData);
                stream.Write(data, 0, data.Length);
                return Task.CompletedTask;
            }
            else
            {
                throw new TimeoutException($"No se pudo conectar a la impresora Zebra en {ip}:{port} (Tiempo de espera de conexión agotado).");
            }
        }

        private void DrawZplLabel(Graphics g, string zpl, int canvasWidth, int canvasHeight)
        {
            g.PageUnit = GraphicsUnit.Pixel;
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            if (string.IsNullOrEmpty(zpl)) return;

            // Split commands by ^ or ~
            string[] commands = zpl.Split(new[] { '^', '~' }, StringSplitOptions.RemoveEmptyEntries);

            int lhX = 0;
            int lhY = 0;
            int currentX = 0;
            int currentY = 0;
            int globalFontSize = 24;
            int? localFontSize = null;

            string fontFamily = "Arial";
            FontStyle fontStyle = FontStyle.Bold;

            for (int i = 0; i < commands.Length; i++)
            {
                string cmd = commands[i].Trim();
                if (string.IsNullOrEmpty(cmd)) continue;

                if (cmd.StartsWith("LH", StringComparison.OrdinalIgnoreCase))
                {
                    var parts = cmd.Substring(2).Split(',');
                    if (parts.Length >= 2 && int.TryParse(parts[0], out int x) && int.TryParse(parts[1], out int y))
                    {
                        lhX = x;
                        lhY = y;
                    }
                }
                else if (cmd.StartsWith("CF", StringComparison.OrdinalIgnoreCase))
                {
                    var parts = cmd.Substring(2).Split(',');
                    if (parts.Length >= 2 && int.TryParse(parts[1], out int h))
                    {
                        globalFontSize = h;
                    }
                    else if (parts.Length == 1 && parts[0].Length > 1 && int.TryParse(parts[0].Substring(1), out int h2))
                    {
                        globalFontSize = h2;
                    }
                }
                else if (cmd.StartsWith("FO", StringComparison.OrdinalIgnoreCase))
                {
                    var parts = cmd.Substring(2).Split(',');
                    if (parts.Length >= 2)
                    {
                        string cleanCoords = parts[1];
                        int index = cleanCoords.IndexOfAny(new[] { 'A', 'B', 'C', 'D', 'F', 'G', 'I', 'L', 'M', 'P', 'S', 'X' });
                        if (index >= 0)
                        {
                            cleanCoords = cleanCoords.Substring(0, index);
                        }
                        
                        int.TryParse(parts[0], out currentX);
                        int.TryParse(cleanCoords, out currentY);
                    }

                    int w = 0, h = 0, t = 2;
                    string textContent = "";
                    bool isBarcode = false;
                    bool isQrCode = false;
                    int qrScale = 5;
                    int barcodeHeight = 60;

                    for (int j = i + 1; j < commands.Length; j++)
                    {
                        string subCmd = commands[j].Trim();
                        if (subCmd.StartsWith("FO", StringComparison.OrdinalIgnoreCase) || 
                            subCmd.StartsWith("XZ", StringComparison.OrdinalIgnoreCase) || 
                            subCmd.StartsWith("XA", StringComparison.OrdinalIgnoreCase))
                        {
                            break;
                        }

                        if (subCmd.StartsWith("A0", StringComparison.OrdinalIgnoreCase))
                        {
                            var aParts = subCmd.Substring(2).Split(',');
                            if (aParts.Length >= 2 && int.TryParse(aParts[1], out int lh))
                            {
                                localFontSize = lh;
                            }
                            else if (aParts.Length == 1)
                            {
                                var match = System.Text.RegularExpressions.Regex.Match(subCmd, @"\d+$");
                                if (match.Success && int.TryParse(match.Value, out int lh2))
                                {
                                    localFontSize = lh2;
                                }
                            }
                        }
                        else if (subCmd.StartsWith("GB", StringComparison.OrdinalIgnoreCase))
                        {
                            var gbParts = subCmd.Substring(2).Split(',');
                            if (gbParts.Length >= 1) int.TryParse(gbParts[0], out w);
                            if (gbParts.Length >= 2) int.TryParse(gbParts[1], out h);
                            if (gbParts.Length >= 3) int.TryParse(gbParts[2], out t);
                            if (t <= 0) t = 2;

                            int drawX = lhX + currentX;
                            int drawY = lhY + currentY;
                            if (w <= 0) w = 1;
                            if (h <= 0) h = 1;

                            using (var pen = new Pen(Color.Black, t))
                            {
                                g.DrawRectangle(pen, drawX, drawY, w, h);
                            }
                        }
                        else if (subCmd.StartsWith("BC", StringComparison.OrdinalIgnoreCase))
                        {
                            isBarcode = true;
                            var bcParts = subCmd.Substring(2).Split(',');
                            if (bcParts.Length >= 2 && int.TryParse(bcParts[1], out int bh))
                            {
                                barcodeHeight = bh;
                            }
                        }
                        else if (subCmd.StartsWith("BQ", StringComparison.OrdinalIgnoreCase))
                        {
                            isQrCode = true;
                            var bqParts = subCmd.Substring(2).Split(',');
                            if (bqParts.Length >= 3 && int.TryParse(bqParts[2], out int scale))
                            {
                                qrScale = scale;
                            }
                            else if (bqParts.Length == 1)
                            {
                                var match = System.Text.RegularExpressions.Regex.Match(subCmd, @",(\d+)$");
                                if (match.Success && int.TryParse(match.Groups[1].Value, out int scale2))
                                {
                                    qrScale = scale2;
                                }
                            }
                        }
                        else if (subCmd.StartsWith("FD", StringComparison.OrdinalIgnoreCase))
                        {
                            textContent = subCmd.Substring(2);
                            if (textContent.EndsWith("FS", StringComparison.OrdinalIgnoreCase))
                            {
                                textContent = textContent.Substring(0, textContent.Length - 2);
                            }
                            
                            int drawX = lhX + currentX;
                            int drawY = lhY + currentY;

                            if (isQrCode)
                            {
                                string qrContent = textContent;
                                if (qrContent.StartsWith("QA,", StringComparison.OrdinalIgnoreCase))
                                {
                                    qrContent = qrContent.Substring(3);
                                }
                                
                                int qrSize = qrScale * 25;
                                g.FillRectangle(Brushes.White, drawX, drawY, qrSize, qrSize);
                                g.DrawRectangle(Pens.Black, drawX, drawY, qrSize, qrSize);
                                
                                int sqSize = Math.Max(12, qrSize / 4);
                                int sqOffset = 3;
                                
                                g.FillRectangle(Brushes.Black, drawX + sqOffset, drawY + sqOffset, sqSize, sqSize);
                                g.FillRectangle(Brushes.White, drawX + sqOffset + 2, drawY + sqOffset + 2, sqSize - 4, sqSize - 4);
                                g.FillRectangle(Brushes.Black, drawX + sqOffset + 4, drawY + sqOffset + 4, sqSize - 8, sqSize - 8);
                                
                                g.FillRectangle(Brushes.Black, drawX + qrSize - sqSize - sqOffset, drawY + sqOffset, sqSize, sqSize);
                                g.FillRectangle(Brushes.White, drawX + qrSize - sqSize - sqOffset + 2, drawY + sqOffset + 2, sqSize - 4, sqSize - 4);
                                g.FillRectangle(Brushes.Black, drawX + qrSize - sqSize - sqOffset + 4, drawY + sqOffset + 4, sqSize - 8, sqSize - 8);
                                
                                g.FillRectangle(Brushes.Black, drawX + sqOffset, drawY + qrSize - sqSize - sqOffset, sqSize, sqSize);
                                g.FillRectangle(Brushes.White, drawX + sqOffset + 2, drawY + qrSize - sqSize - sqOffset + 2, sqSize - 4, sqSize - 4);
                                g.FillRectangle(Brushes.Black, drawX + sqOffset + 4, drawY + qrSize - sqSize - sqOffset + 4, sqSize - 8, sqSize - 8);
                                
                                var tinyFont = new Font("Arial", 7, FontStyle.Bold);
                                g.DrawString("QR", tinyFont, Brushes.Black, drawX + qrSize/2 - 8, drawY + qrSize/2 - 5);
                            }
                            else if (isBarcode)
                            {
                                int bcWidth = 240;
                                g.FillRectangle(Brushes.White, drawX, drawY, bcWidth, barcodeHeight);
                                int barX = drawX + 10;
                                var rand = new Random(12345);
                                while (barX < drawX + bcWidth - 10)
                                {
                                    int barW = rand.Next(1, 4);
                                    g.FillRectangle(Brushes.Black, barX, drawY, barW, barcodeHeight - 12);
                                    barX += barW + rand.Next(1, 5);
                                }
                                var bcFont = new Font("Courier New", 8, FontStyle.Bold);
                                g.DrawString(textContent, bcFont, Brushes.Black, drawX + (bcWidth - textContent.Length * 6)/2, drawY + barcodeHeight - 10);
                            }
                            else
                            {
                                int fontSize = localFontSize ?? globalFontSize;
                                float pointSize = fontSize * 0.75f;
                                if (pointSize < 6) pointSize = 6;

                                using (var font = new Font(fontFamily, pointSize, fontStyle))
                                {
                                    g.DrawString(textContent, font, Brushes.Black, drawX, drawY);
                                }
                            }

                            isBarcode = false;
                            isQrCode = false;
                            localFontSize = null;
                        }
                    }
                }
            }
        }
    }
}
