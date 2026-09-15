import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Edit2, CheckCircle2, Settings, KeyRound, Palette } from 'lucide-react';

interface Equivalencia {
  id_Equivalencia: number;
  codigoPanel: string;
  codigoOrnamento: string | null;
  requiereOrnamento: boolean;
  activo: boolean;
}

interface AuditConfig {
  id_Auditoria: number;
  clave: string;
  valorAnterior: string | null;
  valorNuevo: string;
  fechaModificacion: string;
  usuarioModificacion: string;
  motivo: string | null;
}

interface ConfigViewProps {
  apiBaseUrl: string;
  onClose: () => void;
  onConfigUpdated: () => void;
  onOpenDesigner?: () => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ apiBaseUrl, onClose, onConfigUpdated, onOpenDesigner }) => {
  // Authentication
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Configurations map
  const [auditLogs, setAuditLogs] = useState<AuditConfig[]>([]);

  // Equivalences State
  const [equivalences, setEquivalences] = useState<Equivalencia[]>([]);
  const [editingEquiv, setEditingEquiv] = useState<Partial<Equivalencia> | null>(null);
  const [equivError, setEquivError] = useState('');

  // QR Test Tool
  const [testQrInput, setTestQrInput] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState('');

  // Active configurations forms
  const [activePuesto, setActivePuesto] = useState('');
  const [refreshInterval, setRefreshInterval] = useState('');
  const [minCuringHours, setMinCuringHours] = useState('');
  const [printerMode, setPrinterMode] = useState('Spooler');
  const [printerName, setPrinterName] = useState('');
  const [printerIp, setPrinterIp] = useState('192.168.1.100');
  const [printerPort, setPrinterPort] = useState('9100');
  const [labelDimensions, setLabelDimensions] = useState({ width: '4', height: '3', dpi: '203' });
  const [printerList, setPrinterList] = useState<string[]>([]);
  const [simulatorEnabled, setSimulatorEnabled] = useState(false);
  const [showQrSimulator, setShowQrSimulator] = useState(false);
  const [qrParseType, setQrParseType] = useState('Separator');
  const [qrSeparator, setQrSeparator] = useState(';');
  const [qrPosOrnIdx, setQrPosOrnIdx] = useState('0');
  const [qrPosOrnLen, setQrPosOrnLen] = useState('11');
  const [qrPosDateIdx, setQrPosDateIdx] = useState('11');
  const [qrPosDateLen, setQrPosDateLen] = useState('12');
  const [qrPosSerialIdx, setQrPosSerialIdx] = useState('23');
  const [qrPosSerialLen, setQrPosSerialLen] = useState('10');
  const [qrDatetimeFormat, setQrDatetimeFormat] = useState('yyyyMMddHHmm');
  const [qrRegexPattern, setQrRegexPattern] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  // SQL Connection states
  const [sqlConnectionString, setSqlConnectionString] = useState('');
  const [testConnMessage, setTestConnMessage] = useState('');
  const [testConnSuccess, setTestConnSuccess] = useState<boolean | null>(null);
  const [isTestingConn, setIsTestingConn] = useState(false);

  // Arduino ESP32 State
  const [arduinoEnabled, setArduinoEnabled] = useState(true);
  const [arduinoIp, setArduinoIp] = useState('192.168.3.200');
  const [arduinoPort, setArduinoPort] = useState('8080');
  const [arduinoStatus, setArduinoStatus] = useState<any>(null);
  const [arduinoMappings, setArduinoMappings] = useState<{ referencia: string; señal: string }[]>([]);
  const [newMappingRef, setNewMappingRef] = useState('');
  const [newMappingSignal, setNewMappingSignal] = useState('');
  const [testPosition, setTestPosition] = useState<number>(14);
  const [testPickOrden, setTestPickOrden] = useState('OP-1001');
  const [testPickPositions, setTestPickPositions] = useState('14');
  const [arduinoMsg, setArduinoMsg] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadConfigurations();
      loadEquivalences();
      loadAuditLogs();
      loadInstalledPrinters();
      loadConnectionString();
      loadArduinoStatus();
      loadArduinoMappings();

      const timer = setInterval(() => {
        loadArduinoStatus();
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [isAuthenticated]);

  const loadConnectionString = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/config/connection`);
      if (res.ok) {
        const data = await res.json();
        setSqlConnectionString(data.connectionString || '');
      }
    } catch (e) {
      console.error("Error loading connection string:", e);
    }
  };

  const handleTestAndSaveConnection = async () => {
    if (!sqlConnectionString.trim()) {
      setTestConnMessage('La cadena de conexión no puede estar vacía.');
      setTestConnSuccess(false);
      return;
    }
    
    setIsTestingConn(true);
    setTestConnMessage('Probando conexión a SQL Server (tiempo de espera máximo de 5s)...');
    setTestConnSuccess(null);
    
    try {
      const res = await fetch(`${apiBaseUrl}/api/config/connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString: sqlConnectionString })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTestConnSuccess(true);
          setTestConnMessage('¡Conexión establecida con éxito y guardada en connection.json!');
          onConfigUpdated();
        } else {
          setTestConnSuccess(false);
          setTestConnMessage(`Fallo de conexión: ${data.message}`);
        }
      } else {
        setTestConnSuccess(false);
        setTestConnMessage('Error de comunicación con la API del HMI.');
      }
    } catch (e: any) {
      setTestConnSuccess(false);
      setTestConnMessage(`Error de red: ${e.message}`);
    } finally {
      setIsTestingConn(false);
    }
  };

  const loadInstalledPrinters = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/print/printers`);
      if (res.ok) {
        const data = await res.json();
        setPrinterList(data);
      }
    } catch (e) {
      console.error("Error loading printers list:", e);
    }
  };

  const loadConfigurations = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/config`);
      if (res.ok) {
        const data = await res.json();
        // Bind to forms
        setActivePuesto(data.Workstation_Puesto || 'DL01');
        setRefreshInterval(data.Refresh_Interval_Sec || '5');
        setMinCuringHours(data.Min_Curing_Hours || '4');
        setPrinterName(data.Printer_Name || 'Microsoft Print to PDF');
        setPrinterMode(data.Printer_Mode || 'Spooler');
        setPrinterIp(data.Printer_IP || '192.168.1.100');
        setPrinterPort(data.Printer_Port || '9100');
        setLabelDimensions({
          width: data.Printer_Label_Width_Inches || '4',
          height: data.Printer_Label_Height_Inches || '3',
          dpi: data.Printer_Label_DPI || '203'
        });
        setSimulatorEnabled(data.Printer_Simulator_Enabled === 'true');
        setShowQrSimulator(data.Show_QR_Simulator === 'true');
        setQrParseType(data.Qr_Parse_Type || 'Separator');
        setQrSeparator(data.Qr_Separator || ';');
        setQrPosOrnIdx(data.Qr_Pos_Ornament_Index || '0');
        setQrPosOrnLen(data.Qr_Pos_Ornament_Length || '11');
        setQrPosDateIdx(data.Qr_Pos_Date_Index || '1');
        setQrPosDateLen(data.Qr_Pos_Date_Length || '12');
        setQrPosSerialIdx(data.Qr_Pos_Serial_Index || '2');
        setQrPosSerialLen(data.Qr_Pos_Serial_Length || '10');
        setQrDatetimeFormat(data.Qr_Datetime_Format || 'yyyyMMddHHmm');
        setQrRegexPattern(data.Qr_Regex_Pattern || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadEquivalences = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/equivalence`);
      if (res.ok) {
        const data = await res.json();
        setEquivalences(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/config/audit`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadArduinoStatus = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/arduino/status`);
      if (res.ok) {
        const data = await res.json();
        setArduinoStatus(data);
        if (data.ip) setArduinoIp(data.ip);
        if (data.port) setArduinoPort(data.port.toString());
        setArduinoEnabled(data.enabled !== false);
      }
    } catch (e) {
      console.error("Error loading Arduino status:", e);
    }
  };

  const loadArduinoMappings = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/arduino/mapping`);
      if (res.ok) {
        const data = await res.json();
        setArduinoMappings(data);
      }
    } catch (e) {
      console.error("Error loading Arduino mappings:", e);
    }
  };

  const handleSaveArduinoConfig = async () => {
    setArduinoMsg('Guardando configuración de Arduino...');
    const ok1 = await handleSaveConfig('Arduino_Enabled', arduinoEnabled ? 'true' : 'false', 'Configuración Arduino');
    const ok2 = await handleSaveConfig('Arduino_IP', arduinoIp.trim(), 'Configuración Arduino');
    const ok3 = await handleSaveConfig('Arduino_Port', arduinoPort.trim(), 'Configuración Arduino');
    if (ok1 && ok2 && ok3) {
      setArduinoMsg('Configuración guardada exitosamente. Reconectando...');
      await fetch(`${apiBaseUrl}/api/arduino/reconnect`, { method: 'POST' });
      setTimeout(loadArduinoStatus, 1500);
    } else {
      setArduinoMsg('Error al guardar la configuración.');
    }
  };

  const handleReconnectArduino = async () => {
    setArduinoMsg('Iniciando reconexión TCP con ESP32...');
    try {
      await fetch(`${apiBaseUrl}/api/arduino/reconnect`, { method: 'POST' });
      setArduinoMsg('Reconexión solicitada.');
      setTimeout(loadArduinoStatus, 1000);
    } catch (e: any) {
      setArduinoMsg(`Error al reconectar: ${e.message}`);
    }
  };

  const handleSendClear = async () => {
    setArduinoMsg('Enviando comando CLEAR...');
    try {
      const res = await fetch(`${apiBaseUrl}/api/arduino/clear`, { method: 'POST' });
      const data = await res.json();
      setArduinoMsg(data.message || 'Comando CLEAR enviado.');
      loadArduinoStatus();
    } catch (e: any) {
      setArduinoMsg(`Error: ${e.message}`);
    }
  };

  const handleTestSingleLight = async (state: boolean) => {
    setArduinoMsg(`Enviando LIGHT_TEST posición ${testPosition} (${state ? 'ON' : 'OFF'})...`);
    try {
      const res = await fetch(`${apiBaseUrl}/api/arduino/test-light`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: testPosition, state })
      });
      const data = await res.json();
      setArduinoMsg(data.message || 'Comando de prueba enviado.');
      loadArduinoStatus();
    } catch (e: any) {
      setArduinoMsg(`Error: ${e.message}`);
    }
  };

  const handleSendTestPick = async () => {
    const posList = testPickPositions.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (posList.length === 0) {
      setArduinoMsg('Debe especificar al menos una posición numérica válida.');
      return;
    }

    setArduinoMsg(`Enviando orden pick [${posList.join(',')}]...`);
    try {
      const res = await fetch(`${apiBaseUrl}/api/arduino/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden: testPickOrden.trim(), pick: posList })
      });
      const data = await res.json();
      setArduinoMsg(data.message || 'Orden pick enviada.');
      loadArduinoStatus();
    } catch (e: any) {
      setArduinoMsg(`Error: ${e.message}`);
    }
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMappingRef.trim() || !newMappingSignal.trim()) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/arduino/mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referencia: newMappingRef.trim(), señal: newMappingSignal.trim() })
      });
      if (res.ok) {
        setNewMappingRef('');
        setNewMappingSignal('');
        loadArduinoMappings();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMapping = async (ref: string) => {
    if (!window.confirm(`¿Eliminar mapeo para ${ref}?`)) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/arduino/mapping/${encodeURIComponent(ref)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadArduinoMappings();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // In production, we'd query the DB settings for Supervisor_Password,
    // let's fetch configs in background or match '1234' default.
    try {
      const res = await fetch(`${apiBaseUrl}/api/config`);
      const data = await res.json();
      const supervisorPass = data.Supervisor_Password || '1234';
      if (password === supervisorPass) {
        setIsAuthenticated(true);
        setAuthError('');
      } else {
        setAuthError('Contraseña incorrecta.');
      }
    } catch {
      if (password === '1234') {
        setIsAuthenticated(true);
      } else {
        setAuthError('Fallo de conexión o contraseña inválida.');
      }
    }
  };

  const handleSaveConfig = async (key: string, value: string, motivo: string = "Actualización HMI") => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value,
          user: 'SUPERVISOR',
          motivo
        })
      });
      return res.ok;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleSaveAllGeneral = async () => {
    setSaveMessage('Guardando configuración...');
    let success = true;
    
    success = success && await handleSaveConfig('Workstation_Puesto', activePuesto, 'Cambio puesto de trabajo');
    success = success && await handleSaveConfig('Refresh_Interval_Sec', refreshInterval, 'Cambio intervalo de refresco');
    success = success && await handleSaveConfig('Min_Curing_Hours', minCuringHours, 'Cambio límite horas de curado');
    success = success && await handleSaveConfig('Printer_Name', printerName, 'Configuración de impresora');
    success = success && await handleSaveConfig('Printer_Simulator_Enabled', simulatorEnabled ? 'true' : 'false', 'Configuración de simulador de impresión');
    success = success && await handleSaveConfig('Show_QR_Simulator', showQrSimulator ? 'true' : 'false', 'Configuración visualización simulador QR');
    success = success && await handleSaveConfig('Printer_Mode', printerMode, 'Configuración de modo de conexión de impresora');
    success = success && await handleSaveConfig('Printer_IP', printerIp, 'Configuración de dirección IP de impresora');
    success = success && await handleSaveConfig('Printer_Port', printerPort, 'Configuración de puerto TCP de impresora');
    
    // Parser Settings
    success = success && await handleSaveConfig('Qr_Parse_Type', qrParseType, 'Configuración tipo de parseo QR');
    success = success && await handleSaveConfig('Qr_Separator', qrSeparator, 'Configuración separador QR');
    success = success && await handleSaveConfig('Qr_Pos_Ornament_Index', qrPosOrnIdx, 'Configuración índice de ornamento');
    success = success && await handleSaveConfig('Qr_Pos_Ornament_Length', qrPosOrnLen, 'Configuración largo de ornamento');
    success = success && await handleSaveConfig('Qr_Pos_Date_Index', qrPosDateIdx, 'Configuración índice de fecha');
    success = success && await handleSaveConfig('Qr_Pos_Date_Length', qrPosDateLen, 'Configuración largo de fecha');
    success = success && await handleSaveConfig('Qr_Pos_Serial_Index', qrPosSerialIdx, 'Configuración índice de serial');
    success = success && await handleSaveConfig('Qr_Pos_Serial_Length', qrPosSerialLen, 'Configuración largo de serial');
    success = success && await handleSaveConfig('Qr_Datetime_Format', qrDatetimeFormat, 'Configuración formato de fecha QR');
    success = success && await handleSaveConfig('Qr_Regex_Pattern', qrRegexPattern, 'Configuración regex QR');

    if (success) {
      setSaveMessage('Configuración guardada correctamente.');
      loadConfigurations();
      loadAuditLogs();
      onConfigUpdated();
      setTimeout(() => setSaveMessage(''), 4000);
    } else {
      setSaveMessage('Error al guardar algunos valores.');
    }
  };

  // Equivalences CRUD
  const handleSaveEquivalence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEquiv || !editingEquiv.codigoPanel) {
      setEquivError('El código de panel es requerido.');
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/equivalence?user=SUPERVISOR`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigoPanel: editingEquiv.codigoPanel,
          codigoOrnamento: editingEquiv.requiereOrnamento ? editingEquiv.codigoOrnamento : null,
          requiereOrnamento: editingEquiv.requiereOrnamento ?? true,
          activo: true
        })
      });

      if (res.ok) {
        setEditingEquiv(null);
        setEquivError('');
        loadEquivalences();
      } else {
        setEquivError('Error al guardar la equivalencia en base de datos.');
      }
    } catch {
      setEquivError('Error de red al guardar equivalencia.');
    }
  };

  const handleDeleteEquivalence = async (id: number) => {
    if (!window.confirm('¿Está seguro de desactivar esta equivalencia?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/equivalence/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadEquivalences();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // QR Parser Client-Side Live Tester (simulating C# QrParsingService logic)
  const handleTestQr = () => {
    setTestError('');
    setTestResult(null);

    if (!testQrInput.trim()) {
      setTestError('Ingrese un código QR para probar');
      return;
    }

    const qr = testQrInput.trim().replace(/\r?\n|\r/g, "");

    let ornament = '';
    let datetimeVal = '';
    let serialVal = '';

    try {
      if (qrParseType === 'Position') {
        const ornIdx = parseInt(qrPosOrnIdx);
        const ornLen = parseInt(qrPosOrnLen);
        const dateIdx = parseInt(qrPosDateIdx);
        const dateLen = parseInt(qrPosDateLen);
        const serialIdx = parseInt(qrPosSerialIdx);
        const serialLen = parseInt(qrPosSerialLen);

        if (qr.length < ornIdx + ornLen) {
          setTestError(`QR es muy corto para extraer ornamento. Se necesitan ${ornIdx + ornLen} caracteres, largo actual: ${qr.length}`);
          return;
        }
        ornament = qr.substring(ornIdx, ornIdx + ornLen);
        
        if (qr.length >= dateIdx + dateLen) {
          datetimeVal = qr.substring(dateIdx, dateIdx + dateLen);
        }
        if (qr.length >= serialIdx + serialLen) {
          serialVal = qr.substring(serialIdx, serialIdx + serialLen);
        }
      } else if (qrParseType === 'Regex') {
        if (!qrRegexPattern) {
          setTestError('Expresión regular no definida.');
          return;
        }
        const regex = new RegExp(qrRegexPattern);
        const match = qr.match(regex);

        if (!match) {
          setTestError('El QR no coincide con la expresión regular.');
          return;
        }

        // We simulate named groups in javascript regex
        // Javascript supports named groups since ES2018: (?<name>pattern)
        const groups = match.groups || {};
        ornament = groups['ornament'] || '';
        datetimeVal = groups['datetime'] || '';
        serialVal = groups['serial'] || '';
      } else {
        // Separator split
        const sep = qrSeparator || ';';
        const tokens = qr.split(sep);
        const ornIdx = parseInt(qrPosOrnIdx);
        const dateIdx = parseInt(qrPosDateIdx);
        const serialIdx = parseInt(qrPosSerialIdx);

        if (ornIdx < 0 || ornIdx >= tokens.length) {
          setTestError(`Índice de ornamento (${ornIdx}) fuera de rango. Encontrados: ${tokens.length} tokens.`);
          return;
        }
        ornament = tokens[ornIdx];

        if (dateIdx >= 0 && dateIdx < tokens.length) {
          datetimeVal = tokens[dateIdx];
        }
        if (serialIdx >= 0 && serialIdx < tokens.length) {
          serialVal = tokens[serialIdx];
        }
      }

      ornament = ornament.toUpperCase().trim();
      
      // Parse Date
      let parsedDate: Date | null = null;
      if (datetimeVal) {
        if (qrDatetimeFormat.toLowerCase().startsWith('unix')) {
          const timestamp = parseInt(datetimeVal);
          if (!isNaN(timestamp)) {
            parsedDate = datetimeVal.length > 10 ? new Date(timestamp) : new Date(timestamp * 1000);
          }
        } else {
          // Helper parser for simple layouts
          // yyyyMMddHHmm, yyyyMMddHHmmss, ddMMyyyyHHmm, yyMMddHHmm
          const clean = datetimeVal.trim();
          if (qrDatetimeFormat === 'yyyyMMddHHmm' && clean.length >= 12) {
            const y = parseInt(clean.substring(0, 4));
            const m = parseInt(clean.substring(4, 6)) - 1;
            const d = parseInt(clean.substring(6, 8));
            const h = parseInt(clean.substring(8, 10));
            const min = parseInt(clean.substring(10, 12));
            parsedDate = new Date(y, m, d, h, min);
          } else if (qrDatetimeFormat === 'yyyyMMddHHmmss' && clean.length >= 14) {
            const y = parseInt(clean.substring(0, 4));
            const m = parseInt(clean.substring(4, 6)) - 1;
            const d = parseInt(clean.substring(6, 8));
            const h = parseInt(clean.substring(8, 10));
            const min = parseInt(clean.substring(10, 12));
            const s = parseInt(clean.substring(12, 14));
            parsedDate = new Date(y, m, d, h, min, s);
          } else if (qrDatetimeFormat === 'ddMMyyyyHHmm' && clean.length >= 12) {
            const d = parseInt(clean.substring(0, 2));
            const m = parseInt(clean.substring(2, 4)) - 1;
            const y = parseInt(clean.substring(4, 8));
            const h = parseInt(clean.substring(8, 10));
            const min = parseInt(clean.substring(10, 12));
            parsedDate = new Date(y, m, d, h, min);
          } else if (qrDatetimeFormat === 'yyMMddHHmm' && clean.length >= 10) {
            const y = parseInt("20" + clean.substring(0, 2));
            const m = parseInt(clean.substring(2, 4)) - 1;
            const d = parseInt(clean.substring(4, 6));
            const h = parseInt(clean.substring(6, 8));
            const min = parseInt(clean.substring(8, 10));
            parsedDate = new Date(y, m, d, h, min);
          } else {
            // fallback generic JS date parser
            parsedDate = new Date(clean);
          }
        }
      }

      if (isNaN(parsedDate?.getTime() ?? NaN) && datetimeVal) {
        setTestError(`No se pudo interpretar la fecha '${datetimeVal}' con el formato '${qrDatetimeFormat}'.`);
        return;
      }

      setTestResult({
        ornament,
        rawDatetime: datetimeVal,
        parsedDatetime: parsedDate ? parsedDate.toLocaleString() : 'No se incluyó',
        serial: serialVal || 'No se incluyó',
        originalQr: qr,
        curingHours: parsedDate ? ((Date.now() - parsedDate.getTime()) / (1000 * 60 * 60)).toFixed(2) : null
      });

    } catch (e: any) {
      setTestError(`Error al procesar: ${e.message}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
        <form onSubmit={handleLogin} className="card-panel slide-up" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '20px', borderRadius: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(37, 99, 235, 0.08)', marginBottom: '12px' }}>
              <KeyRound size={32} style={{ color: 'var(--accent-color)' }} />
            </div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Acceso Supervisado Protegido</h2>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Ingrese la contraseña de supervisor para editar configuraciones</span>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Contraseña de Supervisor (por defecto 1234):</label>
            <input 
              type="password" 
              className="form-input" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••"
              autoFocus
            />
          </div>

          {authError && <div style={{ color: '#dc2626', fontSize: '13px', textAlign: 'center', fontWeight: 700 }}>{authError}</div>}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1.5 }}>Ingresar</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 24px 16px 8px', boxSizing: 'border-box', overflowY: 'auto' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.08)' }}>
            <Settings size={24} style={{ color: 'var(--accent-color)' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>Panel de Administración de Planta</h2>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Configuraciones globales, equivalencias de panel y herramientas de análisis QR</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Volver a Operativo
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        
        {/* LEFT BLOCK: General configurations & Equivalences */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* CONEXIÓN A BASE DE DATOS SQL SERVER */}
          <section className="card-panel" style={{ borderLeft: '4px solid var(--accent-color)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}>🖥️ Conexión SQL Server</h3>
            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 500 }}>
              Configure la cadena de conexión de SQL Server de forma dinámica. La aplicación probará y guardará el acceso localmente en connection.json.
            </span>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Cadena de Conexión (Connection String):</label>
              <textarea 
                className="form-input" 
                rows={3} 
                value={sqlConnectionString} 
                onChange={(e) => setSqlConnectionString(e.target.value)} 
                style={{ fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                placeholder="Server=localhost;Database=TB-L;Trusted_Connection=True;TrustServerCertificate=True;"
                disabled={isTestingConn}
              />
            </div>
            
            {testConnMessage && (
              <div style={{ 
                marginTop: '12px', 
                fontSize: '13px', 
                fontWeight: 700, 
                color: testConnSuccess === true ? '#059669' : testConnSuccess === false ? '#dc2626' : '#d97706'
              }}>
                {testConnMessage}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleTestAndSaveConnection} 
                disabled={isTestingConn}
              >
                {isTestingConn ? 'Probando...' : 'Probar y Guardar Conexión'}
              </button>
            </div>
          </section>

          {/* GENERAL CONFIGURATION SETTINGS */}
          <section className="card-panel">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}>⚙️ Configuración del Puesto</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Puesto Activo (Workstation):</label>
                <input type="text" className="form-input" value={activePuesto} onChange={(e) => setActivePuesto(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Tiempo Mínimo de Curado (Horas):</label>
                <input type="number" className="form-input" value={minCuringHours} onChange={(e) => setMinCuringHours(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Conexión de Impresora:</label>
                <select className="form-input" value={printerMode} onChange={(e) => setPrinterMode(e.target.value)}>
                  <option value="Spooler">Windows Spooler / Driver USB</option>
                  <option value="NetworkRaw">Zebra TCP/IP Directo (Red)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Intervalo Refresco Secuencia (Segundos):</label>
                <input type="number" className="form-input" value={refreshInterval} onChange={(e) => setRefreshInterval(e.target.value)} />
              </div>

              {printerMode === 'Spooler' ? (
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Seleccionar Impresora Windows:</label>
                  <select className="form-input" value={printerName} onChange={(e) => setPrinterName(e.target.value)}>
                    <option value="">-- Seleccione una Impresora --</option>
                    {printerList.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    {printerName && !printerList.includes(printerName) && (
                      <option value={printerName}>{printerName} (Configurada)</option>
                    )}
                  </select>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Dirección IP de Impresora:</label>
                    <input type="text" className="form-input" value={printerIp} onChange={(e) => setPrinterIp(e.target.value)} placeholder="192.168.1.100" />
                  </div>
                  <div className="form-group">
                    <label>Puerto TCP de Impresora:</label>
                    <input type="number" className="form-input" value={printerPort} onChange={(e) => setPrinterPort(e.target.value)} placeholder="9100" />
                  </div>
                </>
              )}

              {/* UNIFIED LABEL DESIGN INFO CARD */}
              <div style={{ 
                gridColumn: 'span 2', 
                padding: '16px 20px', 
                backgroundColor: 'rgba(37, 99, 235, 0.04)', 
                border: '1px solid rgba(37, 99, 235, 0.2)', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                marginTop: '4px'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-color)' }}>
                      🏷️ Diseño y Formato de Etiqueta Kanban
                    </span>
                    <span style={{ 
                      fontSize: '10px', 
                      padding: '2px 8px', 
                      borderRadius: '6px', 
                      backgroundColor: '#059669', 
                      color: '#ffffff', 
                      fontWeight: 800,
                      letterSpacing: '0.5px' 
                    }}>
                      UNIFICADO
                    </span>
                  </div>
                  <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: '1.4' }}>
                    El diseño visual, la plantilla ZPL, las medidas físicas y la resolución (DPI) de la etiqueta se gestionan y guardan exclusivamente desde el <strong>Diseñador de Etiquetas</strong> para garantizar una única fuente de verdad y evitar desincronizaciones.
                  </p>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    <span>📐 Tamaño: <strong>{(parseFloat(labelDimensions.width) * 2.54).toFixed(1)} cm × {(parseFloat(labelDimensions.height) * 2.54).toFixed(1)} cm ({labelDimensions.width}" × {labelDimensions.height}")</strong></span>
                    <span>⚡ Resolución: <strong>{labelDimensions.dpi} DPI</strong></span>
                  </div>
                </div>
                {onOpenDesigner && (
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={onOpenDesigner}
                    style={{ whiteSpace: 'nowrap', padding: '10px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
                  >
                    <Palette size={16} />
                    Ir al Diseñador
                  </button>
                )}
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  id="simulatorCheck" 
                  checked={simulatorEnabled} 
                  onChange={(e) => setSimulatorEnabled(e.target.checked)} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }} 
                />
                <label htmlFor="simulatorCheck" style={{ margin: 0, color: '#b45309', cursor: 'pointer', fontWeight: 600 }}>
                  Activar Simulador de Impresión Virtual (Guarda archivos PNG locales en PrintedLabels en vez de imprimir)
                </label>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <input 
                  type="checkbox" 
                  id="showQrSimulatorCheck" 
                  checked={showQrSimulator} 
                  onChange={(e) => setShowQrSimulator(e.target.checked)} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }} 
                />
                <label htmlFor="showQrSimulatorCheck" style={{ margin: 0, color: 'var(--accent-color)', cursor: 'pointer', fontWeight: 600 }}>
                  Mostrar Panel de Simulación QR en la pantalla operativa de Planta (Demo)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '16px' }}>
              <span style={{ fontSize: '13px', color: '#059669', fontWeight: 700 }}>{saveMessage}</span>
              <button className="btn btn-primary" onClick={handleSaveAllGeneral}>
                <Save size={16} />
                Guardar Configuración
              </button>
            </div>
          </section>

          {/* ARDUINO ESP32 PICK-TO-LIGHT SECTION */}
          <section className="card-panel" style={{ borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#059669', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}>
                💡 Arduino ESP32 (Pick-to-Light TCP)
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  background: arduinoStatus?.isConnected ? '#22c55e' : '#ef4444',
                  boxShadow: arduinoStatus?.isConnected ? '0 0 8px #22c55e' : '0 0 8px #ef4444',
                  display: 'inline-block' 
                }} />
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 800, 
                  color: arduinoStatus?.isConnected ? '#15803d' : '#b91c1c',
                  background: arduinoStatus?.isConnected ? '#dcfce7' : '#fee2e2',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  {arduinoStatus?.isConnected ? `CONECTADO (${arduinoIp}:${arduinoPort})` : `DESCONECTADO (${arduinoIp}:${arduinoPort})`}
                </span>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={handleReconnectArduino}
                  title="Forzar reconexión con ESP32"
                >
                  🔄 Reconectar
                </button>
              </div>
            </div>

            {/* Live Telemetry Info Row */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr 1fr', 
              gap: '10px', 
              background: 'rgba(0,0,0,0.02)', 
              padding: '10px 14px', 
              borderRadius: '8px', 
              fontSize: '11px', 
              marginBottom: '16px' 
            }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Último Heartbeat:</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {arduinoStatus?.lastHeartbeat ? new Date(arduinoStatus.lastHeartbeat).toLocaleTimeString() : 'Sin señal'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Último ACK Recibido:</span>
                <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {arduinoStatus?.lastAck ? 'ORDER_RECEIVED' : 'Ninguno'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Último Comando Enviado:</span>
                <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {arduinoStatus?.lastCommandSent || 'Ninguno'}
                </strong>
              </div>
              {arduinoStatus?.lastErrorMessage && (
                <div style={{ gridColumn: 'span 3', color: '#dc2626', fontWeight: 600 }}>
                  ⚠️ Estado / Error: {arduinoStatus.lastErrorMessage}
                </div>
              )}
            </div>

            {/* Network Settings */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div className="form-group">
                <label>Dirección IP del Arduino (ESP32):</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={arduinoIp} 
                  onChange={(e) => setArduinoIp(e.target.value)} 
                  placeholder="192.168.3.200"
                />
              </div>
              <div className="form-group">
                <label>Puerto TCP:</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={arduinoPort} 
                  onChange={(e) => setArduinoPort(e.target.value)} 
                  placeholder="8080"
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="checkbox" 
                    id="arduinoEnabledCheck" 
                    checked={arduinoEnabled} 
                    onChange={(e) => setArduinoEnabled(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="arduinoEnabledCheck" style={{ margin: 0, fontWeight: 600, cursor: 'pointer' }}>
                    Habilitar comunicación TCP con Arduino ESP32
                  </label>
                </div>
                <button type="button" className="btn btn-secondary" onClick={handleSaveArduinoConfig} style={{ padding: '6px 14px', fontSize: '12px' }}>
                  Guardar Parámetros de Red
                </button>
              </div>
            </div>

            {/* Live Testing Controls */}
            <div style={{ 
              border: '1px solid rgba(0,0,0,0.08)', 
              borderRadius: '10px', 
              padding: '14px', 
              background: '#f8fafc', 
              marginBottom: '16px' 
            }}>
              <strong style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', display: 'block', marginBottom: '10px' }}>
                🛠️ Pruebas Manuales de Luces (Diagnóstico)
              </strong>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', marginBottom: '12px' }}>
                {/* Single Light Test */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>Posición (1..32):</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    style={{ width: '70px', padding: '6px' }} 
                    value={testPosition} 
                    onChange={(e) => setTestPosition(parseInt(e.target.value) || 1)} 
                    min={1} 
                    max={64}
                  />
                  <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleTestSingleLight(true)}>
                    💡 Encender
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleTestSingleLight(false)}>
                    ⚫ Apagar
                  </button>
                </div>

                {/* Emergency Clear Button */}
                <button 
                  type="button" 
                  onClick={handleSendClear}
                  style={{ 
                    background: '#dc2626', 
                    color: '#ffffff', 
                    border: 'none', 
                    borderRadius: '8px', 
                    padding: '8px 16px', 
                    fontWeight: 700, 
                    fontSize: '12px', 
                    cursor: 'pointer',
                    marginLeft: 'auto'
                  }}
                >
                  🛑 APAGAR TODO (CLEAR)
                </button>
              </div>

              {/* Order Pick Test */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>Orden:</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ width: '110px', padding: '6px' }} 
                  value={testPickOrden} 
                  onChange={(e) => setTestPickOrden(e.target.value)} 
                />
                <label style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>Posiciones (ej. 1,4,7):</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ width: '130px', padding: '6px' }} 
                  value={testPickPositions} 
                  onChange={(e) => setTestPickPositions(e.target.value)} 
                />
                <button type="button" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700 }} onClick={handleSendTestPick}>
                  🚀 Enviar Pick
                </button>
              </div>

              {arduinoMsg && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#0284c7', fontWeight: 600 }}>
                  {arduinoMsg}
                </div>
              )}
            </div>

            {/* Mapeo Link_Socket_TCP Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#334155' }}>
                  📋 Mapeo de Posiciones Pick-to-Light (dbo.Link_Socket_TCP)
                </strong>
              </div>

              <form onSubmit={handleSaveMapping} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ flex: 2, padding: '6px 10px', fontSize: '12px' }} 
                  placeholder="Referencia Panel (ej. 67620-0KM80-C4)" 
                  value={newMappingRef} 
                  onChange={(e) => setNewMappingRef(e.target.value)} 
                  required
                />
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }} 
                  placeholder="Señal / Posición (ej. 14)" 
                  value={newMappingSignal} 
                  onChange={(e) => setNewMappingSignal(e.target.value)} 
                  required
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>
                  Guardar Mapeo
                </button>
              </form>

              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '6px 12px' }}>Referencia de Panel</th>
                      <th style={{ padding: '6px 12px' }}>Posición / Señal de Luz</th>
                      <th style={{ padding: '6px 12px', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {arduinoMappings.map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{m.referencia}</td>
                        <td style={{ padding: '6px 12px' }}>
                          <span style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                            Posición {m.señal}
                          </span>
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                          <button 
                            type="button" 
                            onClick={() => handleDeleteMapping(m.referencia)} 
                            style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}
                            title="Eliminar mapeo"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                    {arduinoMappings.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>
                          No hay mapeos configurados en Link_Socket_TCP.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* EQUIVALENCES TABLE EDITING */}
          <section className="card-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}>📋 Equivalencias Panel - Ornamento</h3>
              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditingEquiv({ codigoPanel: '', codigoOrnamento: '', requiereOrnamento: true })}>
                <Plus size={14} /> Nueva Equivalencia
              </button>
            </div>

            {/* Edit/Add Form Overlay */}
            {editingEquiv && (
              <form onSubmit={handleSaveEquivalence} style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px' }}>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {editingEquiv.id_Equivalencia ? 'Editar Equivalencia' : 'Agregar Nueva Equivalencia'}
                </strong>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Código Panel:</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editingEquiv.codigoPanel || ''} 
                      onChange={(e) => setEditingEquiv({ ...editingEquiv, codigoPanel: e.target.value })} 
                      placeholder="67610-0KM60-C0"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Código Ornamento:</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editingEquiv.codigoOrnamento || ''} 
                      onChange={(e) => setEditingEquiv({ ...editingEquiv, codigoOrnamento: e.target.value })} 
                      placeholder="67781-0K090"
                      disabled={!editingEquiv.requiereOrnamento}
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      id="equivRequiresOrn" 
                      checked={editingEquiv.requiereOrnamento ?? true} 
                      onChange={(e) => setEditingEquiv({ ...editingEquiv, requiereOrnamento: e.target.checked })} 
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="equivRequiresOrn" style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }}>Requiere lectura de ornamento y curado</label>
                  </div>
                </div>

                {equivError && <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '8px', fontWeight: 600 }}>{equivError}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditingEquiv(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '12px' }}>Guardar</button>
                </div>
              </form>
            )}

            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código Panel</th>
                    <th>Código Ornamento</th>
                    <th>Requiere Ornamento</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {equivalences.filter(e => e.activo).map((equiv) => (
                    <tr key={equiv.id_Equivalencia}>
                      <td><strong>{equiv.codigoPanel}</strong></td>
                      <td>{equiv.codigoOrnamento || <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>SIN ORNAMENTO</span>}</td>
                      <td style={{ fontWeight: 600 }}>{equiv.requiereOrnamento ? 'Sí' : 'No'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setEditingEquiv(equiv)}>
                            <Edit2 size={12} />
                          </button>
                          <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => handleDeleteEquivalence(equiv.id_Equivalencia)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>

        {/* RIGHT BLOCK: QR Parsing configuration & Live Tester */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* QR PARSER CONFIGURATION */}
          <section className="card-panel">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}>📐 Configuración de Formato QR</h3>
            
            <div className="form-group">
              <label>Tipo de Parseo:</label>
              <select className="form-input" value={qrParseType} onChange={(e) => setQrParseType(e.target.value)}>
                <option value="Separator">Por separador (Split)</option>
                <option value="Position">Por posición fija (Slice)</option>
                <option value="Regex">Por expresión regular (Regular Expression)</option>
              </select>
            </div>

            {qrParseType === 'Separator' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Separador utilizado:</label>
                  <input type="text" className="form-input" value={qrSeparator} onChange={(e) => setQrSeparator(e.target.value)} maxLength={1} />
                </div>
                <div className="form-group">
                  <label>Índice Ornamento (0-based):</label>
                  <input type="number" className="form-input" value={qrPosOrnIdx} onChange={(e) => setQrPosOrnIdx(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Índice Fecha (0-based):</label>
                  <input type="number" className="form-input" value={qrPosDateIdx} onChange={(e) => setQrPosDateIdx(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Índice Serial (0-based):</label>
                  <input type="number" className="form-input" value={qrPosSerialIdx} onChange={(e) => setQrPosSerialIdx(e.target.value)} />
                </div>
              </div>
            )}

            {qrParseType === 'Position' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Pos. Inicio Ornamento:</label>
                  <input type="number" className="form-input" value={qrPosOrnIdx} onChange={(e) => setQrPosOrnIdx(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Largo Ornamento:</label>
                  <input type="number" className="form-input" value={qrPosOrnLen} onChange={(e) => setQrPosOrnLen(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Pos. Inicio Fecha:</label>
                  <input type="number" className="form-input" value={qrPosDateIdx} onChange={(e) => setQrPosDateIdx(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Largo Fecha:</label>
                  <input type="number" className="form-input" value={qrPosDateLen} onChange={(e) => setQrPosDateLen(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Pos. Inicio Serial:</label>
                  <input type="number" className="form-input" value={qrPosSerialIdx} onChange={(e) => setQrPosSerialIdx(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Largo Serial:</label>
                  <input type="number" className="form-input" value={qrPosSerialLen} onChange={(e) => setQrPosSerialLen(e.target.value)} />
                </div>
              </div>
            )}

            {qrParseType === 'Regex' && (
              <div className="form-group">
                <label>Expresión Regular (Debe tener grupos capturadores ?&lt;ornament&gt;, ?&lt;datetime&gt;, ?&lt;serial&gt;):</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={qrRegexPattern} 
                  onChange={(e) => setQrRegexPattern(e.target.value)} 
                  placeholder="^(?<ornament>[^;]+);(?<datetime>\d{12});(?<serial>[^;]+)$"
                  style={{ fontFamily: 'monospace', fontSize: '13px' }}
                />
              </div>
            )}

            <div className="form-group">
              <label>Formato DateTime del QR (yyyyMMddHHmm, ddMMyyyyHHmm, Unix):</label>
              <input type="text" className="form-input" value={qrDatetimeFormat} onChange={(e) => setQrDatetimeFormat(e.target.value)} placeholder="yyyyMMddHHmm" />
            </div>

          </section>

          {/* INTERACTIVE QR PREVIEW TESTING TOOL */}
          <section className="card-panel" style={{ border: '1px solid rgba(37, 99, 235, 0.2)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--accent-color)', textTransform: 'uppercase', fontWeight: 800 }}>🧪 Herramienta de Prueba de Parser</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 12px 0', fontWeight: 500 }}>Pegue un código QR y presione 'Probar Parseo' para verificar que la configuración sea correcta antes de guardar.</p>

            <div className="form-group">
              <label>Pegar QR para Prueba:</label>
              <textarea 
                className="form-input" 
                rows={2} 
                value={testQrInput} 
                onChange={(e) => setTestQrInput(e.target.value)} 
                placeholder="Pegue aquí el string QR..."
                style={{ fontSize: '12px', fontFamily: 'monospace' }}
              />
            </div>

            <button className="btn btn-secondary" onClick={handleTestQr} style={{ width: '100%', marginBottom: '12px' }}>
              Probar Parseo QR
            </button>

            {testError && (
              <div style={{ padding: '10px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', color: '#dc2626', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}>
                ❌ {testError}
              </div>
            )}

            {testResult && (
              <div className="slide-up" style={{ padding: '12px', background: 'rgba(5,150,129,0.04)', border: '1px solid rgba(5,150,129,0.15)', borderRadius: '10px', fontSize: '12px' }}>
                <div style={{ color: '#059669', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} />
                  <span>PARSEO COMPLETO CORRECTO</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Ornamento:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{testResult.ornament}</strong>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Fecha Raw:</span>
                  <code>{testResult.rawDatetime}</code>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Fecha Interpretada:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{testResult.parsedDatetime}</strong>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Serie:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{testResult.serial}</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Horas Curado:</span>
                  <strong style={{ color: parseFloat(testResult.curingHours) >= parseFloat(minCuringHours) ? '#059669' : '#dc2626' }}>
                    {testResult.curingHours ? `${testResult.curingHours} horas` : 'N/A'}
                  </strong>
                </div>
              </div>
            )}
          </section>

          {/* AUDIT LOG TRAIL */}
          <section className="card-panel" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-primary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>📜 Historial de Cambios</h3>
            {auditLogs.length > 0 ? (
              <div style={{ fontSize: '12px' }}>
                {auditLogs.map((log) => (
                  <div key={log.id_Auditoria} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', padding: '6px 0' }}>
                    <div>
                      <strong style={{ color: 'var(--accent-color)' }}>{log.clave}</strong>: 
                      <span style={{ color: 'var(--text-secondary)' }}> {log.valorAnterior || 'NULL'} </span> → 
                      <strong style={{ color: 'var(--text-primary)' }}> {log.valorNuevo}</strong>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 500 }}>
                      Por {log.usuarioModificacion} el {new Date(log.fechaModificacion).toLocaleString()} | Motivo: {log.motivo || 'No indicado'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', padding: '12px', fontWeight: 500 }}>
                No hay registros de auditoría de configuración.
              </div>
            )}
          </section>

        </div>

      </div>

    </div>
  );
};
