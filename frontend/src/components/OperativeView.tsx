import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  CheckCircle, XCircle, AlertTriangle, RefreshCw, 
  User, ShieldAlert, Volume2, Settings, FileText, Info
} from 'lucide-react';

// Toyota Boshoku Red Wings Logo
const ToyotaBoshokuLogo: React.FC<{ height?: number }> = ({ height = 28 }) => (
  <svg height={height} viewBox="0 0 54 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M4 25C14 25 25 18 36 7C28 9 20 13 14 17C10 20 6 23 4 25Z" fill="#E60012"/>
    <path d="M13 28C24 28 37 18 49 6C39 8 28 13 20 20C16 23 14 26 13 28Z" fill="#E60012"/>
    <path d="M2 30C8 30 16 28 24 24C16 26 9 28 2 30Z" fill="#E60012"/>
  </svg>
);

// Framed QR Target Icon for Center Banner
const QrTargetIcon: React.FC<{ size?: number }> = ({ size = 52 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M6 16V10C6 7.79086 7.79086 6 10 6H16" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <path d="M32 6H38C40.2091 6 42 7.79086 42 10V16" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <path d="M6 32V38C6 40.2091 7.79086 42 10 42H16" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <path d="M32 42H38C40.2091 42 42 40.2091 42 38V32" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5" fill="white"/>
    <rect x="27" y="14" width="7" height="7" rx="1.5" fill="white"/>
    <rect x="14" y="27" width="7" height="7" rx="1.5" fill="white"/>
    <rect x="27" y="27" width="4" height="4" fill="white"/>
    <rect x="33" y="33" width="3" height="3" fill="white"/>
    <rect x="33" y="27" width="2" height="3" fill="white"/>
    <rect x="27" y="33" width="3" height="2" fill="white"/>
  </svg>
);

// Barcode Handheld Scanner Icon for Footer
const BarcodeScannerIcon: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <rect x="4" y="6" width="24" height="13" rx="3" stroke="white" strokeWidth="2.5" />
    <path d="M10 10V15M14 10V15M17 10V15M20 10V15M23 10V15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <path d="M11 19L9 26H23L21 19" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/>
  </svg>
);

// Control Barcode Display Component
const ControlQRCode: React.FC<{ value: string; size?: number }> = ({ value, size = 140 }) => {
  return (
    <div style={{ background: '#ffffff', padding: '12px', borderRadius: '12px', display: 'inline-block', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
      <QRCodeSVG value={value} size={size} level="H" includeMargin={true} />
      <div style={{ textAlign: 'center', color: '#0f172a', fontFamily: 'monospace', fontSize: '11px', fontWeight: 800, marginTop: '6px', letterSpacing: '1px' }}>
        {value}
      </div>
    </div>
  );
};

// Web Audio API Sound Generator (Offline-safe)
const playSound = (type: 'success' | 'error') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    if (type === 'success') {
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(950, ctx.currentTime);
      gain1.gain.setValueAtTime(0.08, ctx.currentTime);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.08);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(1150, ctx.currentTime);
        gain2.gain.setValueAtTime(0.08, ctx.currentTime);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.12);
      }, 120);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    console.warn("Sound generation failed or blocked by browser policy.", e);
  }
};

interface Panel {
  referencia: string;
  iD_OrdenProduccion: number;
  iD_OrdenCliente: number;
  orden: number;
  secuencia: number;
  sd: string;
  expr1: string;
  puesto: string;
  fechaSecuencia?: string;
  mano?: string;
  posicion?: string;
  requiereOrnamento?: boolean;
}

interface ValidationResult {
  id_Validacion: number;
  id_Operacion: string;
  iD_OrdenProduccion: number;
  iD_OrdenCliente: number;
  orden: number;
  referencia: string;
  codigoOrnamentoEsperado: string | null;
  codigoOrnamentoLeido: string | null;
  qrCompleto: string;
  numeroSerie: string | null;
  lote: string | null;
  inicioCurado: string | null;
  fechaActualServidor: string;
  minutosCurado: number | null;
  tiempoMinimoRequerido: number | null;
  resultadoCurado: string | null;
  resultadoCorrespondencia: string | null;
  resultadoGeneral: string;
  motivoRechazo: string | null;
  puesto: string;
  operador: string;
  fechaLectura: string;
  estadoImpresion: string | null;
  fechaAvancePuntero: string | null;
}

interface PriorUse {
  fecha: string;
  puesto: string;
  panel: string;
  ordenProduccion: number;
  operador: string;
}

interface OperativeViewProps {
  apiBaseUrl: string;
  puesto: string;
  refreshIntervalSec: number;
  operador: string;
  onOpenConfig: () => void;
  onOpenHistory?: () => void;
  onOpenDesigner?: () => void;
  mockDbError: boolean;
  setMockDbError: (val: boolean) => void;
  mockPrintFolderError: boolean;
  setMockPrintFolderError: (val: boolean) => void;
  showQrSimulator: boolean;
}

export const OperativeView: React.FC<OperativeViewProps> = ({
  apiBaseUrl,
  puesto,
  refreshIntervalSec,
  operador,
  onOpenConfig,
  onOpenHistory,
  onOpenDesigner,
  mockDbError,
  setMockDbError,
  mockPrintFolderError,
  setMockPrintFolderError,
  showQrSimulator
}) => {
  // Sequence State
  const [currentPanel, setCurrentPanel] = useState<Panel | null>(null);
  const [isLoadingPanel, setIsLoadingPanel] = useState(false);
  const [noPanelsMessage, setNoPanelsMessage] = useState('');
  
  // Validation Process States
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScannedQr, setLastScannedQr] = useState<string>('');
  const [showQrForSeconds, setShowQrForSeconds] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [duplicateUseDetails, setDuplicateUseDetails] = useState<PriorUse | null>(null);
  const [labelPreview, setLabelPreview] = useState<string | null>(null);
  const [remainingMinText, setRemainingMinText] = useState<string>('');

  // Hardware Status Indicators
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [printerOnline, setPrinterOnline] = useState<boolean | null>(null);

  // Footer & Process State
  const [footerState, setFooterState] = useState<'waiting' | 'processing' | 'approved' | 'rejected' | 'error' | 'idle'>('idle');
  const [footerText, setFooterText] = useState('INICIANDO PUESTO...');

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // Supervisor Menu Modal
  const [showSupervisorMenu, setShowSupervisorMenu] = useState(false);

  // Simulator State
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simQrInput, setSimQrInput] = useState('');

  // Auto-advance countdown timer
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState<number | null>(null);

  // Keep ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time and date
  const timeStr = currentTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = currentTime.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Map door panel image based on requested position and hand
  const getDoorImage = (panel: Panel | null): string => {
    const req = panel ? panel.requiereOrnamento !== false : true;
    return req ? '/door_exploded_con.png' : '/door_exploded_sin.png';
  };

  const isLeftHand = (panel: Panel | null): boolean => {
    if (!panel) return false;
    const mano = (panel.mano || '').toUpperCase();
    return mano.includes('IZQUIERDO') || mano.startsWith('I') || mano.includes('LH');
  };

  // Main Polling effect to fetch the next panel
  useEffect(() => {
    let active = true;

    const fetchNextPanel = async () => {
      if (isProcessing || autoAdvanceSeconds !== null) return;
      
      try {
        const response = await fetch(`${apiBaseUrl}/api/sequence/next?puesto=${puesto}`);
        if (!active) return;
        setDbConnected(true);
        
        if (response.ok) {
          const data = await response.json();
          
          const normalizedData: Panel = {
            referencia: data.referencia || data.Referencia || '',
            iD_OrdenProduccion: data.iD_OrdenProduccion !== undefined ? data.iD_OrdenProduccion : (data.ID_OrdenProduccion !== undefined ? data.ID_OrdenProduccion : 0),
            iD_OrdenCliente: data.iD_OrdenCliente !== undefined ? data.iD_OrdenCliente : (data.ID_OrdenCliente !== undefined ? data.ID_OrdenCliente : 0),
            orden: data.orden !== undefined ? data.orden : (data.Orden !== undefined ? data.Orden : 0),
            secuencia: data.secuencia !== undefined ? data.secuencia : (data.Secuencia !== undefined ? data.Secuencia : 0),
            sd: data.sd || data.SD || '',
            expr1: data.expr1 || data.Expr1 || '',
            puesto: data.puesto || data.Puesto || '',
            fechaSecuencia: data.fechaSecuencia || data.FechaSecuencia,
            mano: data.mano || data.Mano || '',
            posicion: data.posicion || data.Posicion || '',
            requiereOrnamento: data.requiereOrnamento !== undefined ? data.requiereOrnamento : (data.RequiereOrnamento !== undefined ? data.RequiereOrnamento : true)
          };

          const isNewPanel = !currentPanel || currentPanel.iD_OrdenProduccion !== normalizedData.iD_OrdenProduccion;

          if (isNewPanel) {
            setCurrentPanel(normalizedData);
            setNoPanelsMessage('');
            setValidationResult(null);
            setDuplicateUseDetails(null);
            setLabelPreview(null);
            setRemainingMinText('');
            setLastScannedQr('');
            setShowQrForSeconds(false);

            if (normalizedData.requiereOrnamento === false) {
              setFooterState('waiting');
              setFooterText('ESTE PANEL NO LLEVA ORNAMENTO');
            } else {
              setFooterState('waiting');
              setFooterText('ESPERANDO LECTURA DE QR');
            }
          } else {
            // Same panel: only set waiting if we were in idle state
            if (footerState === 'idle') {
              if (normalizedData.requiereOrnamento === false) {
                setFooterState('waiting');
                setFooterText('ESTE PANEL NO LLEVA ORNAMENTO');
              } else {
                setFooterState('waiting');
                setFooterText('ESPERANDO LECTURA DE QR');
              }
            }
          }
        } else if (response.status === 404) {
          setCurrentPanel(null);
          const errData = await response.json().catch(() => ({}));
          setNoPanelsMessage(errData.message || `SIN PANELES PENDIENTES PARA EL PUESTO ${puesto.toUpperCase()}`);
          setFooterState('idle');
          setFooterText(`SIN PANELES PENDIENTES PARA EL PUESTO ${puesto.toUpperCase()}`);
        } else {
          setDbConnected(false);
          if (!currentPanel) {
            setFooterState('error');
            setFooterText('SIN CONEXIÓN CON SQL SERVER');
          }
        }
      } catch (err) {
        console.error("DB Fetch Error", err);
        setDbConnected(false);
        if (active && !currentPanel) {
          setFooterState('error');
          setFooterText('SIN CONEXIÓN CON SQL SERVER');
        }
      } finally {
        if (active) {
          setIsLoadingPanel(false);
        }
      }
    };

    fetchNextPanel();

    const polling = setInterval(fetchNextPanel, refreshIntervalSec * 1000);
    return () => {
      active = false;
      clearInterval(polling);
    };
  }, [puesto, refreshIntervalSec, isProcessing, autoAdvanceSeconds, currentPanel?.iD_OrdenProduccion, footerState]);

  // Fetch installed printer status
  useEffect(() => {
    const checkPrinter = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/print/printers`);
        if (res.ok) {
          const list = await res.json();
          setPrinterOnline(list.length > 0);
        } else {
          setPrinterOnline(false);
        }
      } catch {
        setPrinterOnline(false);
      }
    };
    checkPrinter();
  }, [apiBaseUrl]);

  // Capture barcode wedge (globally)
  useEffect(() => {
    let rawBuffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (!currentPanel || isProcessing) return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 200) {
        rawBuffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (rawBuffer.trim().length > 0) {
          handleQrScan(rawBuffer.trim());
          rawBuffer = '';
        }
      } else if (e.key.length === 1) {
        rawBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentPanel, isProcessing, validationResult]);

  // Core scan processing logic
  const handleQrScan = async (qrCode: string) => {
    if (!currentPanel || isProcessing) return;

    const normalizedQr = qrCode.trim().replace(/\r?\n|\r/g, "");
    const command = normalizedQr.toUpperCase();

    if (command === 'CMD-NO-ORN') {
      if (currentPanel.requiereOrnamento === false && !isProcessing && !validationResult) {
        handleConfirmNoOrnament();
      }
      return;
    }
    if (command === 'CMD-RETRY') {
      if (validationResult && validationResult.resultadoGeneral === 'APROBADO' && validationResult.estadoImpresion === 'COMPLETO' && !validationResult.fechaAvancePuntero && !isProcessing) {
        handleRetryDatabaseAdvance();
      }
      return;
    }
    if (command === 'CMD-RESET') {
      if (validationResult && validationResult.resultadoGeneral === 'RECHAZADO') {
        handleResetForNewScan();
      }
      return;
    }

    setLastScannedQr(normalizedQr);
    setShowQrForSeconds(true);
    setTimeout(() => setShowQrForSeconds(false), 5000);

    setIsProcessing(true);
    setFooterState('processing');
    setFooterText('PROCESANDO CÓDIGO QR...');

    setValidationResult(null);
    setDuplicateUseDetails(null);
    setLabelPreview(null);
    setRemainingMinText('');

    try {
      const res = await fetch(`${apiBaseUrl}/api/validation/validate-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr: normalizedQr,
          panelReference: currentPanel.referencia,
          iD_OrdenProduccion: mockDbError ? 0 : currentPanel.iD_OrdenProduccion,
          iD_OrdenCliente: currentPanel.iD_OrdenCliente,
          orden: currentPanel.orden,
          secuencia: currentPanel.secuencia,
          sd: currentPanel.sd,
          expr1: currentPanel.expr1,
          puesto: puesto,
          operador: operador,
          mano: currentPanel.mano,
          posicion: currentPanel.posicion
        })
      });

      if (res.ok) {
        const result = await res.json();
        
        if (mockPrintFolderError && result.success) {
          setFooterState('error');
          setFooterText('ERROR DE IMPRESIÓN');
          playSound('error');
          setIsProcessing(false);
          return;
        }

        setValidationResult(result.validation);
        if (result.preview) {
          setLabelPreview(result.preview);
        }

        if (result.success) {
          setFooterState('approved');
          setFooterText('PROCESO COMPLETADO');
          playSound('success');
          
          // Auto advance in 4s with visual countdown
          setAutoAdvanceSeconds(4);
          const interval = setInterval(() => {
            setAutoAdvanceSeconds((prev) => (prev !== null && prev > 1 ? prev - 1 : null));
          }, 1000);

          setTimeout(() => {
            clearInterval(interval);
            setAutoAdvanceSeconds(null);
            setValidationResult(null);
            setLabelPreview(null);
            setIsProcessing(false);
          }, 4000);

        } else {
          playSound('error');
          if (result.validation.motivoRechazo === 'ORNAMENTO YA PROCESADO') {
            setFooterState('rejected');
            setFooterText('ORNAMENTO YA PROCESADO');
            if (result.priorUse) {
              setDuplicateUseDetails(result.priorUse);
            }
          } else if (result.validation.resultadoCorrespondencia === 'ORNAMENTO INCORRECTO') {
            setFooterState('rejected');
            setFooterText('ORNAMENTO INCORRECTO');
          } else if (result.validation.resultadoCurado === 'CURADO INSUFICIENTE') {
            setFooterState('rejected');
            const rem = result.remainingMinutes || 0;
            const hours = Math.floor(rem / 60);
            const mins = rem % 60;
            const remText = hours > 0 ? `RESTAN ${hours} H ${mins} MIN DE CURADO` : `RESTAN ${mins} MINUTOS DE CURADO`;
            setRemainingMinText(remText);
            setFooterText(remText);
          } else if (result.message === 'ERROR DE IMPRESIÓN' || result.validation.estadoImpresion === 'FALLIDO') {
            setFooterState('error');
            setFooterText('ERROR DE IMPRESIÓN');
          } else if (result.dbError) {
            setFooterState('error');
            setFooterText('ERROR AL ACTUALIZAR SECUENCIA EN BASE DE DATOS');
          } else {
            setFooterState('rejected');
            setFooterText(result.validation.motivoRechazo || 'VALIDACIÓN RECHAZADA');
          }
          
          setIsProcessing(false);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setFooterState('error');
        setFooterText(err.detail || err.message || 'ERROR DE SERVIDOR AL VALIDAR');
        playSound('error');
        setIsProcessing(false);
      }
    } catch (e) {
      console.error(e);
      setFooterState('error');
      setFooterText('SIN CONEXIÓN CON SERVICIO DE VALIDACIÓN');
      playSound('error');
      setIsProcessing(false);
    }
  };

  // Confirm Panel Without Ornament (Case B)
  const handleConfirmNoOrnament = async () => {
    if (!currentPanel || isProcessing) return;

    setIsProcessing(true);
    setFooterState('processing');
    setFooterText('REGISTRANDO PANEL SIN ORNAMENTO...');
    
    setValidationResult(null);
    setLabelPreview(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/validation/confirm-no-ornament`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panelReference: currentPanel.referencia,
          iD_OrdenProduccion: mockDbError ? 0 : currentPanel.iD_OrdenProduccion,
          iD_OrdenCliente: currentPanel.iD_OrdenCliente,
          orden: currentPanel.orden,
          secuencia: currentPanel.secuencia,
          sd: currentPanel.sd,
          expr1: currentPanel.expr1,
          puesto: puesto,
          operador: operador,
          mano: currentPanel.mano,
          posicion: currentPanel.posicion
        })
      });

      if (res.ok) {
        const result = await res.json();
        
        if (mockPrintFolderError && result.success) {
          setFooterState('error');
          setFooterText('ERROR DE IMPRESIÓN');
          playSound('error');
          setIsProcessing(false);
          return;
        }

        setValidationResult(result.validation);
        if (result.preview) setLabelPreview(result.preview);

        if (result.success) {
          setFooterState('approved');
          setFooterText('PROCESO COMPLETADO');
          playSound('success');

          setAutoAdvanceSeconds(4);
          const interval = setInterval(() => {
            setAutoAdvanceSeconds((prev) => (prev !== null && prev > 1 ? prev - 1 : null));
          }, 1000);

          setTimeout(() => {
            clearInterval(interval);
            setAutoAdvanceSeconds(null);
            setValidationResult(null);
            setLabelPreview(null);
            setIsProcessing(false);
          }, 4000);
        } else {
          playSound('error');
          if (result.message === 'ERROR DE IMPRESIÓN') {
            setFooterState('error');
            setFooterText('ERROR DE IMPRESIÓN');
          } else if (result.dbError) {
            setFooterState('error');
            setFooterText('ERROR AL ACTUALIZAR SECUENCIA EN BASE DE DATOS');
          } else {
            setFooterState('rejected');
            setFooterText(result.validation.motivoRechazo || 'CONFIRMACIÓN FALLIDA');
          }
          setIsProcessing(false);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setFooterState('error');
        setFooterText(err.detail || err.message || 'ERROR AL CONFIRMAR PANEL SIN ORNAMENTO');
        playSound('error');
        setIsProcessing(false);
      }
    } catch (e) {
      console.error(e);
      setFooterState('error');
      setFooterText('FALLO AL PROCESAR SOLICITUD');
      playSound('error');
      setIsProcessing(false);
    }
  };

  // Retry DB Pointer Advance
  const handleRetryDatabaseAdvance = async () => {
    if (!validationResult) return;
    setIsProcessing(true);
    setFooterState('processing');
    setFooterText('REINTENTANDO AVANCE DE SECUENCIA...');

    try {
      const res = await fetch(`${apiBaseUrl}/api/validation/retry-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iD_Validacion: validationResult.id_Validacion,
          iD_OrdenProduccion: currentPanel?.iD_OrdenProduccion || validationResult.iD_OrdenProduccion,
          iD_OrdenCliente: validationResult.iD_OrdenCliente,
          puesto: puesto,
          orden: validationResult.orden
        })
      });

      if (res.ok) {
        setFooterState('approved');
        setFooterText('PROCESO COMPLETADO');
        playSound('success');
        
        setTimeout(() => {
          setValidationResult(null);
          setLabelPreview(null);
          setIsProcessing(false);
        }, 3000);
      } else {
        setFooterState('error');
        setFooterText('REINTENTO FALLIDO EN BASE DE DATOS');
        playSound('error');
        setIsProcessing(false);
      }
    } catch {
      setFooterState('error');
      setFooterText('FALLA DE RED AL REINTENTAR');
      playSound('error');
      setIsProcessing(false);
    }
  };

  // Reset screen state to let operator retry scanning
  const handleResetForNewScan = () => {
    setValidationResult(null);
    setDuplicateUseDetails(null);
    setLabelPreview(null);
    setRemainingMinText('');
    setFooterState('waiting');
    setFooterText(currentPanel && currentPanel.requiereOrnamento === false ? 'ESTE PANEL NO LLEVA ORNAMENTO' : 'ESPERANDO LECTURA DE QR');
  };

  // Determine state of the 5 Poka-Yoke steps
  const getStepStatus = (stepNumber: number): 'pending' | 'loading' | 'success' | 'error' => {
    if (isProcessing) {
      if (stepNumber === 1) return 'loading';
      return 'pending';
    }

    const isApprovedNoOrn = footerState === 'approved' && currentPanel?.requiereOrnamento === false;
    if (isApprovedNoOrn) return 'success';

    if (!validationResult) return 'pending';

    const isApproved = validationResult.resultadoGeneral === 'APROBADO';
    const isRejected = validationResult.resultadoGeneral === 'RECHAZADO';
    const corrOk = validationResult.resultadoCorrespondencia === 'CORRECTO' || (!validationResult.resultadoCorrespondencia && isApproved);
    const corrFail = validationResult.resultadoCorrespondencia === 'ORNAMENTO INCORRECTO' || validationResult.motivoRechazo?.toUpperCase().includes('CORRESPONDENCIA') || validationResult.motivoRechazo?.toUpperCase().includes('INCORRECTO');
    const curadoOk = validationResult.resultadoCurado === 'CURADO OK' || isApproved;
    const curadoFail = validationResult.resultadoCurado === 'CURADO INSUFICIENTE' || validationResult.motivoRechazo?.toUpperCase().includes('CURADO');
    const dupFail = !!duplicateUseDetails || validationResult.motivoRechazo?.toUpperCase().includes('DUPLICADO') || validationResult.motivoRechazo?.toUpperCase().includes('PROCESADO');

    switch (stepNumber) {
      case 1: // QR leído
        return 'success';
      case 2: // Pieza correcta
        if (corrFail) return 'error';
        if (corrOk || isApproved) return 'success';
        return 'pending';
      case 3: // Curado OK
        if (corrFail) return 'pending';
        if (curadoFail) return 'error';
        if (curadoOk || isApproved) return 'success';
        return 'pending';
      case 4: // No duplicado
        if (corrFail || curadoFail) return 'pending';
        if (dupFail) return 'error';
        if (isApproved) return 'success';
        return isRejected ? 'pending' : 'pending';
      case 5: // Impresión etiqueta
        if (!isApproved) return 'pending';
        if (validationResult.estadoImpresion === 'ERROR' || mockPrintFolderError) return 'error';
        if (validationResult.estadoImpresion === 'COMPLETO') return 'success';
        return 'loading';
      default:
        return 'pending';
    }
  };

  const stepsConfig = [
    { number: 1, title: 'QR leído' },
    { number: 2, title: 'Pieza correcta' },
    { number: 3, title: 'Curado OK' },
    { number: 4, title: 'No duplicado' },
    { number: 5, title: 'Impresión etiqueta' }
  ];

  return (
    <div className="tb-hmi-root">
      
      {/* 1. INSTITUTIONAL TOP HEADER */}
      <header className="tb-hmi-header">
        {/* Left: Toyota Boshoku Logo & Station Identification */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ToyotaBoshokuLogo height={32} />
          <div style={{ marginLeft: '14px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '0.5px', color: '#ffffff', lineHeight: 1.1 }}>
              TOYOTA BOSHOKU
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', color: '#94a3b8', lineHeight: 1.2 }}>
              ARGENTINA
            </span>
          </div>

          <div style={{ height: '34px', width: '1px', background: 'rgba(255, 255, 255, 0.2)', margin: '0 20px' }} />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '17px', fontWeight: 900, letterSpacing: '-0.3px', color: '#ffffff', lineHeight: 1.1 }}>
              {puesto} - ENSAMBLE DE PANEL
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#38bdf8', lineHeight: 1.2 }}>
              SISTEMA POKA-YOKE
            </span>
          </div>
        </div>

        {/* Right: Live Telemetry & Statuses */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '26px' }}>
          {/* SQL Status */}
          <div className="tb-telemetry-badge">
            <span style={{ 
              width: '11px', 
              height: '11px', 
              borderRadius: '50%', 
              background: dbConnected ? '#22c55e' : '#ef4444',
              boxShadow: dbConnected ? '0 0 10px #22c55e' : '0 0 10px #ef4444',
              display: 'inline-block' 
            }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>SQL</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                {dbConnected ? 'CONECTADA' : 'DESCONECTADA'}
              </span>
            </div>
          </div>

          {/* Zebra Printer Status */}
          <div className="tb-telemetry-badge">
            <span style={{ 
              width: '11px', 
              height: '11px', 
              borderRadius: '50%', 
              background: printerOnline ? '#22c55e' : '#f59e0b',
              boxShadow: printerOnline ? '0 0 10px #22c55e' : '0 0 10px #f59e0b',
              display: 'inline-block' 
            }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>ZEBRA</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                {printerOnline ? 'ONLINE' : 'FALLA/PREVIEW'}
              </span>
            </div>
          </div>

          {/* Audio Indicator */}
          <div className="tb-telemetry-badge">
            <div style={{ 
              background: '#15803d', 
              padding: '5px 7px', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Volume2 size={16} color="#ffffff" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>AUDIO</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>ACTIVO</span>
            </div>
          </div>

          {/* Operator Badge */}
          <div className="tb-telemetry-badge" style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '18px' }}>
            <div style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              background: 'rgba(255,255,255,0.12)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <User size={16} color="#ffffff" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>{operador}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>TURNO 1</span>
            </div>
          </div>

          {/* Large Live Digital Clock */}
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '18px', textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.5px' }}>
              {timeStr}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginTop: '2px' }}>
              {dateStr}
            </div>
          </div>

          {/* Discreet Supervisor Gear Button */}
          <button 
            onClick={() => setShowSupervisorMenu(!showSupervisorMenu)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '7px 10px',
              cursor: 'pointer',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            title="Menú de Supervisión"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* 2. MAIN 3-COLUMN WORKSTATION BODY */}
      <main className="tb-hmi-body">
        
        {/* ===================================================================
            COLUMN 1: PANEL SOLICITADO (~28%)
           =================================================================== */}
        <section className="tb-col-left">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px', textTransform: 'uppercase' }}>
              Panel Solicitado
            </h2>
          </div>

          {currentPanel ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '12px', minHeight: 0 }}>
              {/* Card 1: Secuencia */}
              <div className="tb-card" style={{ flex: 1.1, padding: '12px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                  Secuencia
                </span>
                <span style={{ fontSize: 'clamp(56px, 7.5vh, 92px)', fontWeight: 900, color: '#0f172a', lineHeight: 1, letterSpacing: '-1.5px' }}>
                  {currentPanel.secuencia.toString().padStart(4, '0')}
                </span>
              </div>

              {/* Card 2: Modelo (SD) */}
              <div className="tb-card" style={{ flex: 1.1, padding: '12px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                  Modelo (SD)
                </span>
                <span style={{ fontSize: 'clamp(48px, 6.5vh, 78px)', fontWeight: 900, color: '#15803d', lineHeight: 1, letterSpacing: '-0.5px' }}>
                  {currentPanel.sd || 'N/A'}
                </span>
              </div>

              {/* Card 3: Posición y Mano */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1 }}>
                <div className="tb-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                    Posición
                  </span>
                  <span style={{ fontSize: 'clamp(26px, 3.8vh, 42px)', fontWeight: 900, color: '#7e22ce', textTransform: 'uppercase', lineHeight: 1.1 }}>
                    {currentPanel.posicion || 'N/A'}
                  </span>
                </div>

                <div className="tb-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                    Mano
                  </span>
                  <span style={{ fontSize: 'clamp(32px, 4.8vh, 54px)', fontWeight: 900, color: '#db2777', textTransform: 'uppercase', lineHeight: 1.1 }}>
                    {currentPanel.mano || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Card 4: Metadata Footer */}
              <div className="tb-card" style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Part Number Panel
                </span>
                <span style={{ fontSize: '17px', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
                  {currentPanel.referencia}
                </span>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', display: 'block' }}>OP</span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{currentPanel.iD_OrdenProduccion}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', display: 'block' }}>FECHA / HORA</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                      {currentPanel.fechaSecuencia 
                        ? new Date(currentPanel.fechaSecuencia).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
                          new Date(currentPanel.fechaSecuencia).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="tb-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
              {isLoadingPanel ? (
                <>
                  <RefreshCw className="pulse" size={44} style={{ color: '#0284c7', marginBottom: '16px' }} />
                  <span style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>CONSULTANDO SECUENCIA SQL...</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={48} style={{ color: '#94a3b8', marginBottom: '16px' }} />
                  <span style={{ fontWeight: 800, fontSize: '16px', color: '#475569' }}>
                    {noPanelsMessage || "SIN PANELES PENDIENTES"}
                  </span>
                </>
              )}
            </div>
          )}
        </section>


        {/* ===================================================================
            COLUMN 2: ESCANEAR ORNAMENTO (~42%)
           =================================================================== */}
        <section className="tb-col-center">
          <h2 style={{ margin: '0 0 2px 0', fontSize: '24px', fontWeight: 900, color: '#0f172a', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
            Escanear Ornamento
          </h2>

          {/* DYNAMIC ACTION BANNER */}
          <div style={{
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            background: (() => {
              if (footerState === 'processing') return 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)';
              if (footerState === 'approved') return 'linear-gradient(135deg, #15803d 0%, #166534 100%)';
              if (footerState === 'rejected' || footerState === 'error') return 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)';
              if (currentPanel && currentPanel.requiereOrnamento === false) return 'linear-gradient(135deg, #0284c7 0%, #0f766e 100%)';
              return 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)';
            })(),
            color: '#ffffff',
            transition: 'all 0.3s ease'
          }}>
            {/* Top row with icon and primary message */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: '20px' }}>
              {/* Dynamic Icon */}
              {footerState === 'processing' ? (
                <RefreshCw className="pulse" size={48} color="#ffffff" style={{ flexShrink: 0 }} />
              ) : footerState === 'approved' ? (
                <CheckCircle size={52} color="#ffffff" style={{ flexShrink: 0 }} />
              ) : footerState === 'rejected' || footerState === 'error' ? (
                <AlertTriangle size={52} color="#ffffff" style={{ flexShrink: 0 }} />
              ) : currentPanel && currentPanel.requiereOrnamento === false ? (
                <FileText size={48} color="#ffffff" style={{ flexShrink: 0 }} />
              ) : (
                <QrTargetIcon size={54} />
              )}

              <div style={{ height: '42px', width: '1px', background: 'rgba(255, 255, 255, 0.25)', flexShrink: 0 }} />

              {/* Main Heading */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ 
                  fontSize: 'clamp(20px, 2.8vh, 28px)', 
                  fontWeight: 900, 
                  letterSpacing: '0.5px', 
                  textTransform: 'uppercase',
                  lineHeight: 1.15 
                }}>
                  {(() => {
                    if (footerState === 'processing') return 'PROCESANDO CÓDIGO QR...';
                    if (footerState === 'approved') return 'PROCESO COMPLETADO';
                    if (footerState === 'rejected') return (validationResult?.motivoRechazo || 'VALIDACIÓN RECHAZADA');
                    if (footerState === 'error') return footerText;
                    if (currentPanel && currentPanel.requiereOrnamento === false) return 'ESTE PANEL NO LLEVA ORNAMENTO';
                    return 'ACERQUE EL QR AL ESCÁNER';
                  })()}
                </span>
                {autoAdvanceSeconds !== null && (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginTop: '2px' }}>
                    Avanzando automáticamente en {autoAdvanceSeconds}s...
                  </span>
                )}
              </div>
            </div>

            {/* Subtitle description bar */}
            <div style={{ 
              padding: '8px 20px', 
              background: 'rgba(0, 0, 0, 0.14)', 
              borderTop: '1px solid rgba(255, 255, 255, 0.18)', 
              fontSize: '13px', 
              fontWeight: 500, 
              color: 'rgba(255, 255, 255, 0.95)' 
            }}>
              {(() => {
                if (footerState === 'processing') return 'Verificando correspondencia, tiempo de curado y duplicidad en base de datos.';
                if (footerState === 'approved') return 'Kanban impreso correctamente. Pieza validada para ensamble.';
                if (footerState === 'rejected') return `${remainingMinText ? remainingMinText + ' — ' : ''}Presione "Aceptar" abajo o escanee CMD-RESET para reintentar.`;
                if (footerState === 'error') return 'Verifique la conexión de red o impresora y reintente el proceso.';
                if (currentPanel && currentPanel.requiereOrnamento === false) return 'Presione "Confirmar Panel Sin Ornamento" o escanee CMD-NO-ORN para avanzar.';
                return 'El sistema validará automáticamente pieza, curado y duplicado.';
              })()}
            </div>
          </div>

          {/* LARGE CENTRAL VISUAL DISPLAY (Photograph or Rejection Detail) */}
          <div className="tb-card" style={{ flex: 1, minHeight: '180px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            {validationResult && validationResult.resultadoGeneral === 'RECHAZADO' ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 2 }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px' }}>
                  <strong style={{ color: '#dc2626', fontSize: '15px', display: 'block', marginBottom: '8px' }}>
                    DETALLES DEL RECHAZO:
                  </strong>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 800 }}>ORNAMENTO ESPERADO:</span>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{validationResult.codigoOrnamentoEsperado || 'NINGUNO'}</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 800 }}>ORNAMENTO LEÍDO:</span>
                      <div style={{ fontWeight: 800, color: '#dc2626' }}>{validationResult.codigoOrnamentoLeido || 'N/A'}</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 800 }}>DURACIÓN DE CURADO:</span>
                      <div style={{ fontWeight: 800, color: validationResult.resultadoCurado === 'CURADO INSUFICIENTE' ? '#dc2626' : '#15803d' }}>
                        {validationResult.minutosCurado != null ? `${Math.floor(validationResult.minutosCurado / 60)} h ${validationResult.minutosCurado % 60} min` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 800 }}>ESTADO CURADO:</span>
                      <div style={{ fontWeight: 800, color: validationResult.resultadoCurado === 'CURADO INSUFICIENTE' ? '#dc2626' : '#15803d' }}>
                        {validationResult.resultadoCurado || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {duplicateUseDetails && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #fecaca', fontSize: '11px', color: '#991b1b' }}>
                      <strong>UTILIZACIÓN ANTERIOR:</strong> OP {duplicateUseDetails.ordenProduccion} | Operador: {duplicateUseDetails.operador} | Fecha: {new Date(duplicateUseDetails.fecha).toLocaleString()}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleResetForNewScan} 
                    style={{ flex: 1, padding: '14px', fontSize: '14px', fontWeight: 800, background: '#0f172a' }}
                  >
                    ACEPTAR Y LEER OTRO ORNAMENTO
                  </button>
                  <ControlQRCode value="CMD-RESET" size={60} />
                </div>
              </div>
            ) : labelPreview ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Kanban Impreso (Vista Previa)
                </span>
                <img 
                  src={`data:image/png;base64,${labelPreview}`} 
                  alt="Kanban Impreso" 
                  style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                />
              </div>
            ) : (
              <img 
                src={getDoorImage(currentPanel)} 
                alt="Ensamble Panel" 
                style={{ 
                  maxWidth: '96%', 
                  maxHeight: '96%', 
                  objectFit: 'contain', 
                  display: 'block',
                  transform: isLeftHand(currentPanel) ? 'scaleX(-1)' : 'none',
                  transition: 'transform 0.3s ease'
                }} 
              />
            )}
          </div>

          {/* BOTTOM BLUE CALLOUT */}
          <div style={{ 
            background: '#e0f2fe', 
            border: '1px solid #bae6fd', 
            borderRadius: '10px', 
            padding: '12px 18px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '14px' 
          }}>
            <div style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              background: '#0284c7', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              flexShrink: 0 
            }}>
              <Info size={18} color="#ffffff" />
            </div>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#0369a1', lineHeight: 1.25 }}>
              Verifique visualmente modelo, posición y mano antes de escanear el ornamento.
            </span>
          </div>

        </section>


        {/* ===================================================================
            COLUMN 3: VALIDACIÓN AUTOMÁTICA (~30%)
           =================================================================== */}
        <section className="tb-col-right">
          <div>
            <h2 style={{ margin: '0 0 2px 0', fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px', textTransform: 'uppercase' }}>
              Validación Automática
            </h2>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              El sistema verificará en el siguiente orden:
            </span>
          </div>

          {/* 5-STEP CHECKLIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {stepsConfig.map((step) => {
              const status = getStepStatus(step.number);

              let badgeBg = '#64748b';
              if (status === 'loading') badgeBg = '#0284c7';
              if (status === 'success') badgeBg = '#15803d';
              if (status === 'error') badgeBg = '#dc2626';

              let cardClass = 'tb-step-card';
              if (status === 'loading') cardClass += ' active';
              if (status === 'success') cardClass += ' success';
              if (status === 'error') cardClass += ' error';

              return (
                <div key={step.number} className={cardClass}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {/* Circle Step Number */}
                    <div style={{ 
                      width: '34px', 
                      height: '34px', 
                      borderRadius: '50%', 
                      background: badgeBg, 
                      color: '#ffffff', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontWeight: 900, 
                      fontSize: '15px',
                      flexShrink: 0,
                      transition: 'background 0.3s ease'
                    }}>
                      {step.number}
                    </div>

                    {/* Step Name */}
                    <span style={{ marginLeft: '14px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                      {step.title}
                    </span>
                  </div>

                  {/* Right Status Indicator */}
                  <div>
                    {status === 'pending' && (
                      <span style={{ fontSize: '20px', fontWeight: 900, color: '#94a3b8', letterSpacing: '2px' }}>
                        •••
                      </span>
                    )}
                    {status === 'loading' && (
                      <RefreshCw className="pulse" size={20} color="#0284c7" />
                    )}
                    {status === 'success' && (
                      <CheckCircle size={24} color="#15803d" />
                    )}
                    {status === 'error' && (
                      <XCircle size={24} color="#dc2626" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* PANEL SIN ORNAMENTO ACTION CARD */}
          <div 
            onClick={() => {
              if (currentPanel && currentPanel.requiereOrnamento === false && !isProcessing) {
                handleConfirmNoOrnament();
              }
            }}
            style={{
              background: currentPanel && currentPanel.requiereOrnamento === false ? '#f0fdf4' : '#ffffff',
              border: `1px solid ${currentPanel && currentPanel.requiereOrnamento === false ? '#86efac' : '#cbd5e1'}`,
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              cursor: currentPanel && currentPanel.requiereOrnamento === false ? 'pointer' : 'default',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ 
              width: '38px', 
              height: '38px', 
              borderRadius: '50%', 
              background: currentPanel && currentPanel.requiereOrnamento === false ? '#dcfce7' : '#f1f5f9', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexShrink: 0 
            }}>
              <FileText size={20} color={currentPanel && currentPanel.requiereOrnamento === false ? '#15803d' : '#64748b'} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>
                PANEL SIN ORNAMENTO
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                Escanee CMD-NO-ORN para avanzar.
              </span>
            </div>
          </div>

          {/* Pruebas 10 retry notice if pointer advance fails */}
          {validationResult && validationResult.resultadoGeneral === 'APROBADO' && validationResult.estadoImpresion === 'COMPLETO' && !validationResult.fechaAvancePuntero && (
            <div style={{ padding: '10px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px' }}>
              <strong style={{ color: '#ea580c', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                FALLÓ AVANCE EN SQL SERVER
              </strong>
              <button className="btn btn-primary" onClick={handleRetryDatabaseAdvance} style={{ width: '100%', fontSize: '12px', padding: '8px', background: '#ea580c' }}>
                REINTENTAR ACTUALIZAR BD
              </button>
            </div>
          )}

        </section>

      </main>

      {/* 3. INDUSTRIAL FOOTER BAR */}
      <footer className="tb-hmi-footer">
        {/* Left: Hardware Scanner Status Block */}
        <div style={{ 
          background: '#15803d', 
          height: '100%', 
          padding: '0 24px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '14px' 
        }}>
          <BarcodeScannerIcon size={26} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', fontWeight: 900, letterSpacing: '0.5px', color: '#ffffff', lineHeight: 1.1 }}>
              ESCÁNER ACTIVO
            </span>
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', lineHeight: 1.1 }}>
              Listo para recibir lectura de QR
            </span>
          </div>
        </div>

        {/* Center: Quality Motto */}
        <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '3px', color: '#94a3b8', textTransform: 'uppercase' }}>
          ——— CALIDAD EN CADA ENSAMBLE ———
        </div>

        {/* Right: Institutional Name */}
        <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1.5px', color: '#ffffff', opacity: 0.9 }}>
          TOYOTA BOSHOKU ARGENTINA
        </div>
      </footer>

      {/* SUPERVISOR MODAL MENU */}
      {showSupervisorMenu && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '400px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <strong style={{ fontSize: '18px', color: '#0f172a' }}>Menú de Supervisión</strong>
              <button 
                onClick={() => setShowSupervisorMenu(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '18px', fontWeight: 800, color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setShowSupervisorMenu(false); onOpenConfig(); }}
                style={{ padding: '12px', justifyContent: 'flex-start', fontWeight: 700 }}
              >
                ⚙️ Configuración del Puesto
              </button>
              
              {onOpenHistory && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => { setShowSupervisorMenu(false); onOpenHistory(); }}
                  style={{ padding: '12px', justifyContent: 'flex-start', fontWeight: 700 }}
                >
                  📊 Logs e Historial de Ensamble
                </button>
              )}

              {onOpenDesigner && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => { setShowSupervisorMenu(false); onOpenDesigner(); }}
                  style={{ padding: '12px', justifyContent: 'flex-start', fontWeight: 700 }}
                >
                  🏷️ Diseñador de Etiquetas ZPL
                </button>
              )}

              <button 
                className="btn btn-secondary" 
                onClick={() => { setShowSupervisorMenu(false); setSimulatorOpen(!simulatorOpen); }}
                style={{ padding: '12px', justifyContent: 'flex-start', fontWeight: 700 }}
              >
                🖥️ {simulatorOpen ? 'Ocultar' : 'Mostrar'} Simulador de QR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR SCAN POPUP TOAST */}
      {showQrForSeconds && lastScannedQr && (
        <div style={{
          position: 'fixed',
          bottom: '64px',
          right: '24px',
          background: '#0f172a',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          fontSize: '12px',
          zIndex: 100,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{ color: '#38bdf8', fontWeight: 800 }}>QR LEÍDO: </span>
          <code style={{ color: '#ffffff', fontFamily: 'monospace' }}>{lastScannedQr}</code>
        </div>
      )}

      {/* SIMULATOR SLIDEOUT (For testing/development) */}
      {(showQrSimulator || simulatorOpen) && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          width: '320px',
          background: 'rgba(255, 255, 255, 0.98)',
          boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
          border: '1px solid #cbd5e1',
          borderRadius: '14px',
          padding: '16px',
          zIndex: 200
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <strong style={{ fontSize: '13px', color: '#0284c7' }}>🖥️ SIMULADOR QR</strong>
            <button 
              onClick={() => setSimulatorOpen(false)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 800, color: '#64748b' }}
            >
              ✕
            </button>
          </div>

          <textarea 
            className="form-input" 
            rows={2} 
            value={simQrInput}
            onChange={(e) => setSimQrInput(e.target.value)}
            placeholder="67781-0K090;202607170600;SN998822"
            style={{ fontSize: '12px', fontFamily: 'monospace', marginBottom: '8px' }}
          />

          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => { if (simQrInput) handleQrScan(simQrInput); }}
              disabled={!currentPanel || isProcessing}
              style={{ flex: 1, padding: '8px', fontSize: '12px' }}
            >
              Simular Escaneo
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => setSimQrInput('')}
              style={{ padding: '8px', fontSize: '12px' }}
            >
              Borrar
            </button>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontSize: '11px' }}>
            <strong style={{ display: 'block', marginBottom: '4px', color: '#ea580c' }}>Simular Fallas:</strong>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={mockPrintFolderError} 
                onChange={(e) => setMockPrintFolderError(e.target.checked)} 
              />
              Error de Impresora
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={mockDbError} 
                onChange={(e) => setMockDbError(e.target.checked)} 
              />
              Fallo de Base de Datos
            </label>
          </div>

          {currentPanel && currentPanel.referencia === '67610-0KM60-C0' && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button className="btn btn-secondary" style={{ fontSize: '10px', padding: '4px' }} onClick={() => setSimQrInput("67781-0K090;202607170600;SN123456")}>
                ✔️ Cargar QR Válido (Prueba 1)
              </button>
              <button className="btn btn-secondary" style={{ fontSize: '10px', padding: '4px' }} onClick={() => setSimQrInput("67782-0K090;202607170600;SN123456")}>
                ❌ Cargar QR Incorrecto (Prueba 2)
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
