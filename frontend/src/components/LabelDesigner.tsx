import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, Printer, RefreshCw, Layers, Sparkles, 
  CheckCircle2, AlertTriangle, Trash2, Move, Type, Square, Maximize2,
  Upload, Download
} from 'lucide-react';

interface LabelDesignerProps {
  apiBaseUrl: string;
  onClose: () => void;
  onConfigUpdated: () => void;
}

interface SimulatedData {
  puesto: string;
  referencia: string;
  codigoOrnamentoLeido: string;
  id_OrdenProduccion: number;
  id_OrdenCliente: number;
  secuencia: number;
  sd: string;
  qrCompleto: string;
  minutosCurado: number;
  mano: string;
  posicion: string;
  orden: number;
}

interface VisualElement {
  id: string;
  type: 'text' | 'barcode' | 'qrcode' | 'box' | 'line';
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;      // static text or variable placeholders like {Referencia}
  fontSize?: number;    // ZPL font height size
  thickness?: number;   // Box or line border thickness
  qrScale?: number;     // QR scale (1-10)
}

export const LabelDesigner: React.FC<LabelDesignerProps> = ({ apiBaseUrl, onClose, onConfigUpdated }) => {
  const [editorMode, setEditorMode] = useState<'visual' | 'code'>('visual');
  const [zplCode, setZplCode] = useState('');
  const [originalZpl, setOriginalZpl] = useState('');
  const [visualElements, setVisualElements] = useState<VisualElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  
  // Canvas settings
  const [useGrid, setUseGrid] = useState(true);
  const [showSimulatedValues, setShowSimulatedValues] = useState(true);

  // Label settings (in centimeters)
  const [labelWidthCm, setLabelWidthCm] = useState(10.16); // 4 inches * 2.54 = 10.16 cm
  const [labelHeightCm, setLabelHeightCm] = useState(7.62); // 3 inches * 2.54 = 7.62 cm
  const [labelDpi, setLabelDpi] = useState(203); // 203, 300, 600

  const [originalWidth, setOriginalWidth] = useState(4);
  const [originalHeight, setOriginalHeight] = useState(3);
  const [originalDpi, setOriginalDpi] = useState(203);
  const [labelHomeX, setLabelHomeX] = useState(0);
  const [labelHomeY, setLabelHomeY] = useState(0);

  const labelWidth = parseFloat((labelWidthCm / 2.54).toFixed(3));
  const labelHeight = parseFloat((labelHeightCm / 2.54).toFixed(3));

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState({ x: 0, y: 0 });

  // Preview & printers state
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [printStatus, setPrintStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Simulated values state
  const [simData, setSimData] = useState<SimulatedData>({
    puesto: 'DL01',
    referencia: '67610-0KM60-C0',
    codigoOrnamentoLeido: 'ORN-9988-X',
    id_OrdenProduccion: 5821,
    id_OrdenCliente: 9283,
    secuencia: 147,
    sd: 'SD-420-A',
    qrCompleto: 'ORN-9988-X;202608061200;SERIAL-0042',
    minutosCurado: 300,
    mano: 'LH',
    posicion: 'FR',
    orden: 1
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ZPL Templates Presets
  const presets = {
    standard: `^XA
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
^XZ`,

    detailedQr: `^XA
^LH20,20
^FO10,10^GB580,410,4^FS
^CF0,20
^FO30,30^FDKANBAN VALIDACION - PUESTO: {Puesto}^FS
^FO10,60^GB580,2,2^FS
^CF0,44
^FO30,80^FD{Referencia}^FS
^CF0,24
^FO30,135^FDOmn: {Ornamento}^FS
^FO30,170^FDMano: {Mano}^FS
^FO10,210^GB580,2,2^FS
^CF0,20
^FO30,230^FDOP ID: {OrdenProduccion}^FS
^FO30,260^FDORD CLIENTE: {OrdenCliente}^FS
^FO30,290^FDSECUENCIA: {Secuencia}^FS
^FO30,320^FDT. CURADO: {MinutosCurado} min^FS
^FO30,350^FDFECHA IMP: {FechaLectura}^FS
^FO330,230^BQN,2,7^FDQA,Puesto:{Puesto};Ref:{Referencia};Seq:{Secuencia};Cure:{MinutosCurado};QR:{QrCompleto}^FS
^FO380,380^FDLECTURA QR KANBAN^FS
^XZ`,

    compact: `^XA
^LH10,10
^FO10,10^GB380,280,3^FS
^CF0,18
^FO20,25^FDPUESTO: {Puesto} - SEC: {Secuencia}^FS
^FO10,50^GB380,2,2^FS
^CF0,30
^FO20,70^FD{Referencia}^FS
^CF0,18
^FO20,115^FDORN: {Ornamento}^FS
^FO20,140^FDOP: {OrdenProduccion} | CL: {OrdenCliente}^FS
^FO20,165^FDCURADO: {MinutosCurado} min^FS
^FO20,195^FDFECHA: {FechaLectura}^FS
^FO260,110^BQN,2,5^FDQA,{QrCompleto}^FS
^XZ`
  };

  useEffect(() => {
    loadTemplateFromDb();
    loadPrinters();
  }, []);

  const loadTemplateFromDb = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/config`);
      if (res.ok) {
        const data = await res.json();
        const width = parseFloat(data.Printer_Label_Width_Inches) || 4;
        const height = parseFloat(data.Printer_Label_Height_Inches) || 3;
        const dpi = parseInt(data.Printer_Label_DPI) || 203;
        setLabelWidthCm(parseFloat((width * 2.54).toFixed(2)));
        setLabelHeightCm(parseFloat((height * 2.54).toFixed(2)));
        setLabelDpi(dpi);

        const template = data.Printer_Zpl_Template || presets.standard;
        setZplCode(template);
        setOriginalZpl(template);
        // Parse raw ZPL into visual elements initially
        const elements = parseZplToElements(template);
        setVisualElements(elements);

        // Check for ^PW and ^LL in template to sync
        const pwMatch = template.match(/\^PW(\d+)/i);
        const llMatch = template.match(/\^LL(\d+)/i);
        let finalWidth = width;
        let finalHeight = height;
        if (pwMatch) {
          finalWidth = parseFloat((parseInt(pwMatch[1]) / dpi).toFixed(2));
          setLabelWidthCm(parseFloat((finalWidth * 2.54).toFixed(2)));
        }
        if (llMatch) {
          finalHeight = parseFloat((parseInt(llMatch[1]) / dpi).toFixed(2));
          setLabelHeightCm(parseFloat((finalHeight * 2.54).toFixed(2)));
        }

        setOriginalWidth(finalWidth);
        setOriginalHeight(finalHeight);
        setOriginalDpi(dpi);

        fetchPreview(template, simData, finalWidth, finalHeight, dpi);
      }
    } catch (e) {
      console.warn("Error cargando plantilla inicial. Usando preset estándar.", e);
      setZplCode(presets.standard);
      setOriginalZpl(presets.standard);
      setOriginalWidth(4);
      setOriginalHeight(3);
      setOriginalDpi(203);
      const elements = parseZplToElements(presets.standard);
      setVisualElements(elements);
      fetchPreview(presets.standard, simData, 4, 3, 203);
    }
  };

  const loadPrinters = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/print/printers`);
      if (res.ok) {
        const list = await res.json();
        setPrinters(list);
        if (list.length > 0) {
          setSelectedPrinter(list[0]);
        }
      }
    } catch (e) {
      console.error("Error obteniendo impresoras", e);
    }
  };

  // PARSER: ZPL String -> VisualElement[]
  const parseZplToElements = (zpl: string): VisualElement[] => {
    const elements: VisualElement[] = [];
    if (!zpl) return elements;

    // 1. Check for Label Home ^LHx,y if present
    const lhMatch = zpl.match(/\^LH(\d+),(\d+)/i);
    if (lhMatch) {
      setLabelHomeX(parseInt(lhMatch[1], 10) || 0);
      setLabelHomeY(parseInt(lhMatch[2], 10) || 0);
    }

    let globalFontSize = 24;

    // Match all field blocks (^FO...^FS or ^FT...^FS) and font changes (^CF...)
    const tokenRegex = /(\^CF[A-Z0-9]?,?\d*|\^(?:FO|FT)\d+,\d+[\s\S]*?(?=\^FS|\^FO|\^FT|\^XZ|$)(?:\^FS)?)/gi;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(zpl)) !== null) {
      const token = match[0].trim();
      if (!token) continue;

      // Global font setting ^CF0,24
      if (token.toUpperCase().startsWith('^CF')) {
        const cfMatch = token.match(/\^CF[A-Z0-9]?,?(\d+)/i);
        if (cfMatch && cfMatch[1]) {
          globalFontSize = parseInt(cfMatch[1], 10) || 24;
        }
        continue;
      }

      // Position command: ^FOx,y or ^FTx,y
      const foMatch = token.match(/\^(FO|FT)(\d+),(\d+)/i);
      if (!foMatch) continue;

      const isFt = foMatch[1].toUpperCase() === 'FT';
      let x = parseInt(foMatch[2], 10) || 0;
      let y = parseInt(foMatch[3], 10) || 0;

      // A. Graphic Box / Line: ^GBw,h,t
      const gbMatch = token.match(/\^GB(\d+),(\d+),?(\d*)/i);
      if (gbMatch) {
        const w = parseInt(gbMatch[1], 10) || 10;
        const h = parseInt(gbMatch[2], 10) || 10;
        const t = parseInt(gbMatch[3], 10) || 2;
        const isLine = (w <= 6 || h <= 6);
        elements.push({
          id: 'el_' + Math.random().toString(36).substr(2, 9),
          type: isLine ? 'line' : 'box',
          x,
          y,
          w,
          h,
          content: isLine ? 'Línea' : 'Caja',
          thickness: t
        });
        continue;
      }

      // B. QR Code: ^BQN...
      const bqMatch = token.match(/\^BQ[A-Z0-9]?,?(\d*)?,?(\d*)/i);
      if (bqMatch) {
        const scale = parseInt(bqMatch[2] || bqMatch[1], 10) || 5;
        let content = '{QrCompleto}';
        const fdMatch = token.match(/\^FD(?:QA,)?([\s\S]*?)(?:\^FS|$)/i);
        if (fdMatch) content = fdMatch[1];
        elements.push({
          id: 'el_' + Math.random().toString(36).substr(2, 9),
          type: 'qrcode',
          x,
          y,
          w: scale * 25,
          h: scale * 25,
          content,
          qrScale: scale
        });
        continue;
      }

      // C. 1D Barcode: ^BC...
      const bcMatch = token.match(/\^BC[A-Z0-9]?,?(\d*)/i);
      if (bcMatch) {
        const h = parseInt(bcMatch[1], 10) || 60;
        let content = '{Referencia}';
        const fdMatch = token.match(/\^FD([\s\S]*?)(?:\^FS|$)/i);
        if (fdMatch) content = fdMatch[1];
        elements.push({
          id: 'el_' + Math.random().toString(36).substr(2, 9),
          type: 'barcode',
          x,
          y,
          w: 240,
          h,
          content
        });
        continue;
      }

      // D. Text Field: ^FD...
      const fdMatch = token.match(/\^FD([\s\S]*?)(?:\^FS|$)/i);
      if (fdMatch) {
        const content = fdMatch[1];
        let fontSize = globalFontSize;

        // Check for specific font size in this field e.g. ^A0N,28,28 or ^A0,40,40
        const aMatch = token.match(/\^A[A-Z0-9]?,?[A-Z]?,?(\d+)/i);
        if (aMatch && aMatch[1]) {
          fontSize = parseInt(aMatch[1], 10) || globalFontSize;
        } else {
          const inFieldCf = token.match(/\^CF[A-Z0-9]?,?(\d+)/i);
          if (inFieldCf && inFieldCf[1]) {
            fontSize = parseInt(inFieldCf[1], 10) || globalFontSize;
          }
        }

        let w = Math.max(60, Math.round(content.length * (fontSize * 0.58)));
        const fbMatch = token.match(/\^FB(\d+)/i);
        if (fbMatch && fbMatch[1]) {
          w = parseInt(fbMatch[1], 10) || w;
        }

        const h = Math.round(fontSize * 1.15);
        if (isFt) {
          y = Math.max(0, y - fontSize);
        }

        elements.push({
          id: 'el_' + Math.random().toString(36).substr(2, 9),
          type: 'text',
          x,
          y,
          w,
          h,
          content,
          fontSize
        });
      }
    }

    return elements;
  };

  // GENERATOR: VisualElement[] -> ZPL String
  const generateZplFromElements = (elements: VisualElement[]): string => {
    const dotsWidth = Math.round(labelWidth * labelDpi);
    const dotsHeight = Math.round(labelHeight * labelDpi);
    let zpl = `^XA\n^PW${dotsWidth}\n^LL${dotsHeight}\n`;
    if (labelHomeX > 0 || labelHomeY > 0) {
      zpl += `^LH${labelHomeX},${labelHomeY}\n`;
    }
    
    // Sort elements visually by Y, then X to write neat ZPL
    const sorted = [...elements].sort((a, b) => {
      if (a.y === b.y) return a.x - b.x;
      return a.y - b.y;
    });

    for (const el of sorted) {
      if (el.type === 'text') {
        const size = el.fontSize || 24;
        zpl += `^FO${el.x},${el.y}^A0N,${size},${size}^FD${el.content}^FS\n`;
      } else if (el.type === 'barcode') {
        zpl += `^FO${el.x},${el.y}^BCN,${el.h},Y,N,N^FD${el.content}^FS\n`;
      } else if (el.type === 'qrcode') {
        const scale = el.qrScale || 5;
        zpl += `^FO${el.x},${el.y}^BQN,2,${scale}^FDQA,${el.content}^FS\n`;
      } else if (el.type === 'box') {
        zpl += `^FO${el.x},${el.y}^GB${el.w},${el.h},${el.thickness || 2}^FS\n`;
      } else if (el.type === 'line') {
        zpl += `^FO${el.x},${el.y}^GB${el.w},${el.h},${el.thickness || 2}^FS\n`;
      }
    }

    zpl += '^XZ';
    return zpl;
  };

  const fetchPreview = async (
    templateToRender: string, 
    dataToUse: SimulatedData,
    width = labelWidth,
    height = labelHeight,
    dpi = labelDpi
  ) => {
    if (!templateToRender) return;
    setIsLoadingPreview(true);
    setPreviewError(null);

    const validationData = {
      id_Validacion: 0,
      id_Operacion: '00000000-0000-0000-0000-000000000000',
      id_OrdenProduccion: dataToUse.id_OrdenProduccion,
      id_OrdenCliente: dataToUse.id_OrdenCliente,
      orden: 1,
      secuencia: dataToUse.secuencia,
      sd: dataToUse.sd,
      referencia: dataToUse.referencia,
      codigoOrnamentoEsperado: dataToUse.codigoOrnamentoLeido,
      codigoOrnamentoLeido: dataToUse.codigoOrnamentoLeido,
      qrCompleto: dataToUse.qrCompleto,
      numeroSerie: '1001',
      lote: 'L-2026',
      inicioCurado: new Date(Date.now() - dataToUse.minutosCurado * 60 * 1000).toISOString(),
      fechaActualServidor: new Date().toISOString(),
      minutosCurado: dataToUse.minutosCurado,
      tiempoMinimoRequerido: 240,
      resultadoCurado: 'APROBADO',
      resultadoCorrespondencia: 'CORRECTO',
      resultadoGeneral: 'APROBADO',
      puesto: dataToUse.puesto,
      operador: 'SIM_USER',
      fechaLectura: new Date().toISOString()
    };

    try {
      const response = await fetch(`${apiBaseUrl}/api/print/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zplTemplate: templateToRender,
          validationData,
          labelWidthInches: width,
          labelHeightInches: height,
          labelDpi: dpi
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.preview) {
          setPreviewImage(result.preview);
        } else {
          setPreviewError('La API no retornó una vista previa válida.');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setPreviewError(errorData.message || `Error del servidor (${response.status})`);
      }
    } catch (e: any) {
      console.warn("Fallo de conexión. Intentando llamada directa a Labelary...", e);
      try {
        let zplSimulated = templateToRender;
        zplSimulated = zplSimulated.replace(/{Puesto}/g, dataToUse.puesto);
        zplSimulated = zplSimulated.replace(/{Referencia}/g, dataToUse.referencia);
        zplSimulated = zplSimulated.replace(/{Ornamento}/g, dataToUse.codigoOrnamentoLeido);
        zplSimulated = zplSimulated.replace(/{OrdenProduccion}/g, dataToUse.id_OrdenProduccion.toString());
        zplSimulated = zplSimulated.replace(/{OrdenCliente}/g, dataToUse.id_OrdenCliente.toString());
        zplSimulated = zplSimulated.replace(/{Secuencia}/g, dataToUse.secuencia.toString());
        zplSimulated = zplSimulated.replace(/{SD}/g, dataToUse.sd);
        zplSimulated = zplSimulated.replace(/{Orden}/g, dataToUse.orden.toString());
        zplSimulated = zplSimulated.replace(/{Posicion}/g, dataToUse.posicion);
        zplSimulated = zplSimulated.replace(/{ManoCompuesta}/g, `${dataToUse.posicion} - ${dataToUse.mano}`);
        zplSimulated = zplSimulated.replace(/{Mano}/g, dataToUse.mano);
        zplSimulated = zplSimulated.replace(/{MinutosCurado}/g, dataToUse.minutosCurado.toString());
        zplSimulated = zplSimulated.replace(/{QrCompleto}/g, dataToUse.qrCompleto);
        zplSimulated = zplSimulated.replace(/{FechaLectura}/g, new Date().toLocaleString());

        const dpmmStr = dpi === 300 ? '12dpmm' : dpi === 600 ? '24dpmm' : '8dpmm';
        const labelaryRes = await fetch(`http://api.labelary.com/v1/printers/${dpmmStr}/labels/${width}x${height}/0/`, {
          method: 'POST',
          body: zplSimulated
        });
        
        if (labelaryRes.ok) {
          const blob = await labelaryRes.blob();
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            const base64data = reader.result as string;
            setPreviewImage(base64data.split(',')[1]);
          };
        } else {
          setPreviewError('Labelary offline.');
        }
      } catch {
        setPreviewError(`No se pudo conectar al HMI en ${apiBaseUrl}`);
      }
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSimDataChange = (field: keyof SimulatedData, value: string | number) => {
    const updated = { ...simData, [field]: value };
    setSimData(updated);
    // Refresh preview based on current editor mode ZPL source
    if (editorMode === 'visual') {
      const generated = generateZplFromElements(visualElements);
      fetchPreview(generated, updated);
    } else {
      fetchPreview(zplCode, updated);
    }
  };

  const handleModeSwitch = (mode: 'visual' | 'code') => {
    if (mode === 'visual') {
      // Parse ZPL code text area to rebuild visual elements
      const parsed = parseZplToElements(zplCode);
      setVisualElements(parsed);
      setSelectedElementId(null);

      // Parse dimensions from ZPL if present to sync inputs
      const pwMatch = zplCode.match(/\^PW(\d+)/i);
      const llMatch = zplCode.match(/\^LL(\d+)/i);
      if (pwMatch) {
        const finalW = parseFloat((parseInt(pwMatch[1]) / labelDpi).toFixed(2));
        setLabelWidthCm(parseFloat((finalW * 2.54).toFixed(2)));
      }
      if (llMatch) {
        const finalH = parseFloat((parseInt(llMatch[1]) / labelDpi).toFixed(2));
        setLabelHeightCm(parseFloat((finalH * 2.54).toFixed(2)));
      }
    } else {
      // Generate ZPL code from visual elements
      const generated = generateZplFromElements(visualElements);
      setZplCode(generated);
    }
    setEditorMode(mode);
  };

  // DRAG AND DROP MOUSE EVENTS handlers
  const handleElementMouseDown = (e: React.MouseEvent, element: VisualElement) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedElementId(element.id);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setElementStart({ x: element.x, y: element.y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || selectedElementId === null) return;

      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      let newX = elementStart.x + dx;
      let newY = elementStart.y + dy;

      // Snapping
      if (useGrid) {
        newX = Math.round(newX / 10) * 10;
        newY = Math.round(newY / 10) * 10;
      }

      // Keep within label boundaries (dotsWidth and dotsHeight)
      const dotsWidth = Math.round(labelWidth * labelDpi);
      const dotsHeight = Math.round(labelHeight * labelDpi);
      newX = Math.max(0, Math.min(dotsWidth - 20, newX));
      newY = Math.max(0, Math.min(dotsHeight - 20, newY));

      setVisualElements(prev => prev.map(el => {
        if (el.id === selectedElementId) {
          return { ...el, x: newX, y: newY };
        }
        return el;
      }));
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, elementStart, selectedElementId, useGrid, labelWidth, labelHeight, labelDpi]);

  // Visual template helper methods
  const addElement = (type: VisualElement['type']) => {
    const id = 'el_' + Math.random().toString(36).substr(2, 9);
    let newElement: VisualElement;
    const dotsWidth = Math.round(labelWidth * labelDpi);
    const dotsHeight = Math.round(labelHeight * labelDpi);

    switch (type) {
      case 'text':
        newElement = { id, type, x: 50, y: 50, w: 120, h: 30, content: 'Texto Nuevo', fontSize: 24 };
        break;
      case 'barcode':
        newElement = { id, type, x: 50, y: 150, w: 200, h: 60, content: '{Referencia}' };
        break;
      case 'qrcode':
        newElement = { id, type, x: Math.round(dotsWidth - 170), y: Math.round(dotsHeight - 170), w: 125, h: 125, content: '{QrCompleto}', qrScale: 5 };
        break;
      case 'box':
        newElement = { id, type, x: 10, y: 10, w: dotsWidth - 20, h: dotsHeight - 20, content: 'Caja', thickness: 4 };
        break;
      case 'line':
        newElement = { id, type, x: 10, y: Math.round(dotsHeight / 2), w: dotsWidth - 20, h: 2, content: 'Línea', thickness: 2 };
        break;
    }

    setVisualElements(prev => [...prev, newElement]);
    setSelectedElementId(id);
  };

  const deleteElement = (id: string) => {
    setVisualElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  const updateSelectedElement = (updates: Partial<VisualElement>) => {
    if (!selectedElementId) return;
    setVisualElements(prev => prev.map(el => {
      if (el.id === selectedElementId) {
        const merged = { ...el, ...updates } as VisualElement;
        // recalculate approximate width for visual representation if text changed
        if (merged.type === 'text' && (updates.content !== undefined || updates.fontSize !== undefined)) {
          const fontSize = merged.fontSize || 24;
          merged.w = Math.max(80, merged.content.length * (fontSize * 0.55));
          merged.h = fontSize + 6;
        }
        if (merged.type === 'qrcode' && updates.qrScale !== undefined) {
          const scale = merged.qrScale || 5;
          merged.w = scale * 25;
          merged.h = scale * 25;
        }
        return merged;
      }
      return el;
    }));
  };

  // Get current active ZPL code (either compiled from visual model or current text edit)
  const getActiveZpl = () => {
    if (editorMode === 'visual') {
      return generateZplFromElements(visualElements);
    }
    return zplCode;
  };

  const isModified = getActiveZpl() !== originalZpl || 
    Math.abs(labelWidth - originalWidth) > 0.01 || 
    Math.abs(labelHeight - originalHeight) > 0.01 || 
    labelDpi !== originalDpi;

  const handleExportZpl = () => {
    const zpl = getActiveZpl();
    const blob = new Blob([zpl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diseno_kanban_${labelWidthCm}cm_x_${labelHeightCm}cm_${labelDpi}dpi.zpl`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportZpl = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setZplCode(text);
        setOriginalZpl(''); // Mark as dirty
        
        // Parse raw ZPL into visual elements
        const parsedElements = parseZplToElements(text);
        setVisualElements(parsedElements);
        
        // Try parsing dimensions
        const pwMatch = text.match(/\^PW(\d+)/);
        if (pwMatch) {
          const wInches = parseFloat((parseInt(pwMatch[1]) / labelDpi).toFixed(2));
          setLabelWidthCm(parseFloat((wInches * 2.54).toFixed(2)));
        }
        const llMatch = text.match(/\^LL(\d+)/);
        if (llMatch) {
          const hInches = parseFloat((parseInt(llMatch[1]) / labelDpi).toFixed(2));
          setLabelHeightCm(parseFloat((hInches * 2.54).toFixed(2)));
        }

        setSaveStatus({ type: 'success', message: 'Diseño importado correctamente. Recuerda guardar los cambios.' });
        setTimeout(() => setSaveStatus({ type: null, message: '' }), 5000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveTemplate = async () => {
    setSaveStatus({ type: null, message: '' });
    const targetZpl = getActiveZpl();
    const batchItems = [
      { key: 'Printer_Zpl_Template', value: targetZpl, user: 'ADMIN_DISEÑO', motivo: 'Guardado unificado de etiqueta Kanban' },
      { key: 'Printer_Label_Width_Inches', value: labelWidth.toString(), user: 'ADMIN_DISEÑO', motivo: 'Guardado unificado tamaño etiqueta' },
      { key: 'Printer_Label_Height_Inches', value: labelHeight.toString(), user: 'ADMIN_DISEÑO', motivo: 'Guardado unificado tamaño etiqueta' },
      { key: 'Printer_Label_DPI', value: labelDpi.toString(), user: 'ADMIN_DISEÑO', motivo: 'Guardado unificado resolución etiqueta' },
    ];

    try {
      let res = await fetch(`${apiBaseUrl}/api/config/batch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchItems)
      });

      // Fallback to sequential updates if batch is not supported by older API
      if (!res.ok && res.status === 404) {
        for (const item of batchItems) {
          res = await fetch(`${apiBaseUrl}/api/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
          });
        }
      }

      if (res.ok) {
        setOriginalZpl(targetZpl);
        setOriginalWidth(labelWidth);
        setOriginalHeight(labelHeight);
        setOriginalDpi(labelDpi);
        setZplCode(targetZpl);
        setSaveStatus({ type: 'success', message: '¡Diseño y medidas de la etiqueta guardados y activos en producción!' });
        onConfigUpdated();
        setTimeout(() => setSaveStatus({ type: null, message: '' }), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveStatus({ type: 'error', message: err.message || 'Error al guardar el diseño.' });
      }
    } catch (e: any) {
      setSaveStatus({ type: 'error', message: `Fallo de red: ${e.message}` });
    }
  };

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      setPrintStatus({ type: 'error', message: 'No hay impresora seleccionada.' });
      return;
    }
    setPrintStatus({ type: null, message: 'Preparando e imprimiendo...' });

    const targetZpl = getActiveZpl();
    const batchItems = [
      { key: 'Printer_Zpl_Template', value: targetZpl, user: 'ADMIN_DISEÑO', motivo: 'Impresión de prueba temporal' },
      { key: 'Printer_Label_Width_Inches', value: labelWidth.toString(), user: 'ADMIN_DISEÑO', motivo: 'Impresión de prueba temporal' },
      { key: 'Printer_Label_Height_Inches', value: labelHeight.toString(), user: 'ADMIN_DISEÑO', motivo: 'Impresión de prueba temporal' },
      { key: 'Printer_Label_DPI', value: labelDpi.toString(), user: 'ADMIN_DISEÑO', motivo: 'Impresión de prueba temporal' },
    ];

    try {
      // Save temporarily to run print job
      await fetch(`${apiBaseUrl}/api/config/batch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchItems)
      }).catch(async () => {
        for (const item of batchItems) {
          await fetch(`${apiBaseUrl}/api/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
          });
        }
      });

      setOriginalZpl(targetZpl);
      setOriginalWidth(labelWidth);
      setOriginalHeight(labelHeight);
      setOriginalDpi(labelDpi);
      setZplCode(targetZpl);
      onConfigUpdated();

      const res = await fetch(
        `${apiBaseUrl}/api/print/test?printerName=${encodeURIComponent(selectedPrinter)}&panelCode=${encodeURIComponent(simData.referencia)}`,
        { method: 'POST' }
      );

      if (res.ok) {
        setPrintStatus({ type: 'success', message: '¡Etiqueta física enviada a ' + selectedPrinter + '!' });
        setTimeout(() => setPrintStatus({ type: null, message: '' }), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setPrintStatus({ type: 'error', message: err.detail || err.message || 'Error de cola de impresión.' });
      }
    } catch (e: any) {
      setPrintStatus({ type: 'error', message: `Fallo de red: ${e.message}` });
    }
  };

  const loadPreset = (presetKey: keyof typeof presets) => {
    if (window.confirm('¿Desea cargar esta plantilla predefinida? Se perderán las modificaciones no guardadas.')) {
      const selected = presets[presetKey];
      setZplCode(selected);
      if (editorMode === 'visual') {
        setVisualElements(parseZplToElements(selected));
        setSelectedElementId(null);
      }
      fetchPreview(selected, simData);
    }
  };

  const insertVariableInCodeEditor = (variable: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = textareaRef.current.value;
      const placeholder = `{${variable}}`;
      const newText = text.substring(0, start) + placeholder + text.substring(end);
      setZplCode(newText);
      
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + placeholder.length;
        }
      }, 50);
    } else {
      setZplCode(prev => prev + `{${variable}}`);
    }
  };

  // Helper function to resolve variable bindings visually on canvas
  const getSimulatedText = (rawContent: string) => {
    if (!showSimulatedValues) return rawContent;
    let text = rawContent;
    text = text.replace(/{Puesto}/g, simData.puesto);
    text = text.replace(/{Referencia}/g, simData.referencia);
    text = text.replace(/{Ornamento}/g, simData.codigoOrnamentoLeido);
    text = text.replace(/{OrdenProduccion}/g, simData.id_OrdenProduccion.toString());
    text = text.replace(/{OrdenCliente}/g, simData.id_OrdenCliente.toString());
    text = text.replace(/{Secuencia}/g, simData.secuencia.toString());
    text = text.replace(/{SD}/g, simData.sd);
    text = text.replace(/{Orden}/g, simData.orden.toString());
    text = text.replace(/{Posicion}/g, simData.posicion);
    text = text.replace(/{ManoCompuesta}/g, `${simData.posicion} - ${simData.mano}`);
    text = text.replace(/{Mano}/g, simData.mano);
    text = text.replace(/{MinutosCurado}/g, simData.minutosCurado.toString() + ' min');
    text = text.replace(/{QrCompleto}/g, simData.qrCompleto);
    text = text.replace(/{FechaLectura}/g, new Date().toLocaleDateString());
    return text;
  };

  const getSelectedElement = () => {
    return visualElements.find(el => el.id === selectedElementId) || null;
  };

  const selectedElement = getSelectedElement();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      color: 'var(--text-primary)',
      overflow: 'hidden',
      padding: '16px 24px 16px 8px',
      boxSizing: 'border-box'
    }} className="slide-up">
      
      {/* HEADER BAR */}
      <header className="card-panel" style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        marginBottom: '16px',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            color: 'var(--accent-color)'
          }}>
            <Layers size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px' }}>Diseñador Visual de Etiquetas ZPL</h1>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Cree plantillas Zebra de forma visual mediante Drag & Drop.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(255, 255, 255, 0.45)',
          padding: '3px',
          borderRadius: '10px',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <button 
            onClick={() => handleModeSwitch('visual')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: editorMode === 'visual' ? '#0f172a' : 'transparent',
              color: editorMode === 'visual' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.25s'
            }}
          >
            Diseño Visual (Lienzo)
          </button>
          <button 
            onClick={() => handleModeSwitch('code')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: editorMode === 'code' ? '#0f172a' : 'transparent',
              color: editorMode === 'code' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.25s'
            }}
          >
            Código ZPL (Raw)
          </button>
        </div>
        
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportZpl} 
            accept=".zpl,.txt" 
            style={{ display: 'none' }} 
          />

          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
            Cerrar Diseñador
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="btn btn-secondary" 
            style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Importar diseño ZPL desde archivo"
          >
            <Upload size={14} />
            Importar
          </button>

          <button 
            onClick={handleExportZpl} 
            className="btn btn-secondary" 
            style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Exportar diseño actual a archivo .zpl"
          >
            <Download size={14} />
            Exportar
          </button>
          
          <button 
            onClick={handleSaveTemplate} 
            className="btn btn-primary" 
            style={{ 
              padding: '8px 16px', 
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isModified ? 'var(--accent-color)' : '#059669',
              boxShadow: isModified ? '0 2px 8px rgba(37, 99, 235, 0.3)' : '0 2px 8px rgba(5, 150, 105, 0.2)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            title={isModified ? 'Guardar los cambios en base de datos y activar en producción' : 'Diseño guardado y en vigencia'}
          >
            {isModified ? <Save size={14} /> : <CheckCircle2 size={14} />}
            {isModified ? 'Guardar Diseño' : 'Diseño Activo'}
          </button>
        </div>
      </header>

      {/* VIEWPORT AREA */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: LIENZO (VISUAL) O TEXTAREA (CODE) */}
        <div className="card-panel" style={{
          flex: '1.4',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          marginRight: '16px',
          borderRadius: '16px'
        }}>
          
          {/* Subheader: Presets */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Presets:</span>
              {['standard', 'detailedQr', 'compact'].map(p => (
                <button 
                  key={p} 
                  onClick={() => loadPreset(p as any)} 
                  className="btn btn-secondary" 
                  style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}
                >
                  {p === 'standard' ? 'Estándar' : p === 'detailedQr' ? 'QR Detallado' : 'Compacto'}
                </button>
              ))}
            </div>

            {editorMode === 'visual' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={useGrid} onChange={(e) => setUseGrid(e.target.checked)} style={{ cursor: 'pointer' }} />
                  Ajustar a Rejilla (10px)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={showSimulatedValues} onChange={(e) => setShowSimulatedValues(e.target.checked)} style={{ cursor: 'pointer' }} />
                  Ver Valores Simulados
                </label>
              </div>
            )}
          </div>

          {/* VISUAL LIENZO MODE */}
          {editorMode === 'visual' && (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '20px',
              overflow: 'auto',
              position: 'relative'
            }}>
              {/* Element Add Toolbox (Barra de herramientas flotante arriba) */}
              <div style={{
                position: 'absolute',
                top: '16px',
                display: 'flex',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: '12px',
                padding: '4px',
                gap: '4px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
                zIndex: 10
              }}>
                <button onClick={() => addElement('text')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px' }}>
                  <Type size={12} /> +Texto
                </button>
                <button onClick={() => addElement('barcode')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px' }}>
                  <Move size={12} /> +Barras 1D
                </button>
                <button onClick={() => addElement('qrcode')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px' }}>
                  <Maximize2 size={12} /> +QR 2D
                </button>
                <button onClick={() => addElement('box')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px' }}>
                  <Square size={12} /> +Borde/Caja
                </button>
                <button onClick={() => addElement('line')} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px' }}>
                  <Maximize2 size={12} /> +Línea
                </button>
              </div>

              {/* CANVA SCALING WRAPPER */}
              <div style={{
                width: '640px',
                height: '480px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                borderRadius: '16px',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                position: 'relative'
              }}>
                {/* CANVA WRAPPER CARD */}
                <div 
                  ref={canvasRef}
                  style={{
                    width: `${Math.round(labelWidth * labelDpi)}px`,
                    height: `${Math.round(labelHeight * labelDpi)}px`,
                    transform: `scale(${Math.min(620 / Math.round(labelWidth * labelDpi), 460 / Math.round(labelHeight * labelDpi), 1)})`,
                    transformOrigin: 'center center',
                    flexShrink: 0,
                    backgroundColor: '#ffffff',
                    position: 'relative',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.08)',
                    borderRadius: '12px',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    backgroundImage: useGrid ? 'radial-gradient(circle, rgba(0, 0, 0, 0.08) 1px, transparent 1px)' : 'none',
                    backgroundSize: '10px 10px',
                    userSelect: 'none',
                    overflow: 'hidden'
                  }}
                  onClick={() => setSelectedElementId(null)}
                >
                  {/* Visual rendering of elements */}
                  {visualElements.map(el => {
                    const isSelected = selectedElementId === el.id;
                    
                    // Render styles dynamically depending on type
                    let innerNode: React.ReactNode;
                    let elementStyle: React.CSSProperties = {
                      position: 'absolute',
                      left: `${el.x}px`,
                      top: `${el.y}px`,
                      width: el.type === 'text' ? 'max-content' : `${el.w}px`,
                      minWidth: el.type === 'text' ? `${el.w}px` : undefined,
                      height: `${el.h}px`,
                      boxSizing: 'border-box',
                      cursor: 'move',
                      display: 'flex',
                      alignItems: 'center',
                      border: isSelected ? '2px solid #2563eb' : '1px dashed transparent',
                      boxShadow: isSelected ? '0 0 10px rgba(37,99,235,0.4)' : 'none',
                      zIndex: isSelected ? 100 : 10,
                      userSelect: 'none'
                    };

                    if (el.type === 'text') {
                      innerNode = (
                        <span style={{ 
                          fontSize: `${el.fontSize || 24}px`, 
                          fontFamily: 'Arial, sans-serif', 
                          fontWeight: 700,
                          color: '#000000',
                          whiteSpace: 'nowrap',
                          lineHeight: 1,
                          letterSpacing: '0px'
                        }}>
                          {getSimulatedText(el.content)}
                        </span>
                      );
                    } else if (el.type === 'barcode') {
                      innerNode = (
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', justifyContent: 'space-between', padding: '2px' }}>
                          <div style={{ 
                            flex: 1, 
                            width: '100%', 
                            background: 'repeating-linear-gradient(90deg, #000, #000 3px, #fff 3px, #fff 7px)' 
                          }} />
                          <span style={{ fontSize: '9px', color: '#000', fontFamily: 'monospace', textAlign: 'center', fontWeight: 'bold' }}>
                            {getSimulatedText(el.content)}
                          </span>
                        </div>
                      );
                    } else if (el.type === 'qrcode') {
                      innerNode = (
                        <div style={{ 
                          width: '100%', 
                          height: '100%', 
                          border: '4px solid #000',
                          backgroundColor: '#fff',
                          boxSizing: 'border-box',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#000',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          fontSize: '9px',
                          overflow: 'hidden'
                        }}>
                          <span>QR CODE</span>
                          <span style={{ fontSize: '7px', color: '#666' }}>({el.qrScale}x)</span>
                        </div>
                      );
                    } else if (el.type === 'box') {
                      const isFilled = (el.thickness || 2) >= (el.h || 10) || (el.thickness || 2) >= (el.w || 10);
                      if (isFilled) {
                        elementStyle.backgroundColor = '#000000';
                        elementStyle.border = 'none';
                      } else {
                        elementStyle.border = `${el.thickness || 2}px solid #000000`;
                        elementStyle.backgroundColor = 'transparent';
                      }
                      innerNode = null;
                    } else if (el.type === 'line') {
                      elementStyle.backgroundColor = '#000000';
                      elementStyle.border = 'none';
                      innerNode = null;
                    }

                    return (
                      <div 
                        key={el.id}
                        style={elementStyle}
                        onMouseDown={(e) => handleElementMouseDown(e, el)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.borderColor = '#999';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.borderColor = 'transparent';
                        }}
                      >
                        {innerNode}
                        
                        {/* Element corner labels when selected */}
                        {isSelected && (
                          <>
                            <div style={{ position: 'absolute', top: '-4px', left: '-4px', width: '8px', height: '8px', background: '#2563eb', borderRadius: '50%' }} />
                            <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', background: '#2563eb', borderRadius: '50%' }} />
                            <div style={{ position: 'absolute', bottom: '-4px', left: '-4px', width: '8px', height: '8px', background: '#2563eb', borderRadius: '50%' }} />
                            <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '8px', height: '8px', background: '#2563eb', borderRadius: '50%' }} />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* RAW ZPL TEXTAREA MODE */}
          {editorMode === 'code' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{
                padding: '8px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                overflowX: 'auto'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', marginRight: '6px' }}>Insertar Variable:</span>
                {['Puesto', 'Referencia', 'Ornamento', 'OrdenProduccion', 'OrdenCliente', 'Secuencia', 'SD', 'Orden', 'Posicion', 'ManoCompuesta', 'Mano', 'MinutosCurado', 'QrCompleto', 'FechaLectura'].map(v => (
                  <button 
                    key={v}
                    onClick={() => insertVariableInCodeEditor(v)}
                    style={{
                      padding: '3px 6px',
                      fontSize: '11px',
                      background: 'rgba(255, 255, 255, 0.5)',
                      border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    &#123;{v}&#125;
                  </button>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={zplCode}
                onChange={(e) => setZplCode(e.target.value)}
                style={{
                  flex: 1,
                  width: '100%',
                  margin: 0,
                  padding: '20px',
                  border: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.65)',
                  color: '#09326c',
                  fontFamily: 'Fira Code, Consolas, Monaco, Courier New, monospace',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                  borderTop: '1px solid rgba(0, 0, 0, 0.05)'
                }}
                placeholder="Escriba código ZPL..."
              />
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: ELEMENT PROPERTIES, PREVIEW AND TEST PANEL */}
        <div className="card-panel" style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: '20px',
          gap: '20px',
          boxSizing: 'border-box',
          borderRadius: '16px'
        }}>
          
          {/* 0. CONFIGURACIÓN DE LA ETIQUETA */}
          <div className="card-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
              Configuración de Etiqueta
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '10px', marginBottom: '2px' }}>Ancho (cm):</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="2.5"
                  max="30"
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  value={labelWidthCm} 
                  onChange={(e) => setLabelWidthCm(parseFloat(e.target.value) || 10.16)} 
                />
               </div>
               <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '10px', marginBottom: '2px' }}>Alto (cm):</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="2.5"
                  max="30"
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  value={labelHeightCm} 
                  onChange={(e) => setLabelHeightCm(parseFloat(e.target.value) || 7.62)} 
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '10px', marginBottom: '2px' }}>Resolución (DPI):</label>
              <select
                className="form-input"
                style={{ padding: '6px 10px', fontSize: '12px' }}
                value={labelDpi}
                onChange={(e) => setLabelDpi(parseInt(e.target.value) || 203)}
              >
                <option value="203">203 DPI (8 dpmm)</option>
                <option value="300">300 DPI (12 dpmm)</option>
                <option value="600">600 DPI (24 dpmm)</option>
              </select>
            </div>
            
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Resolución de Lienzo: {Math.round(labelWidth * labelDpi)} x {Math.round(labelHeight * labelDpi)} px (puntos ZPL)
            </div>
          </div>

          {/* 1. SELECTED ELEMENT PROPERTIES (Only visible in Visual mode) */}
          {editorMode === 'visual' && (
            <div className="card-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Propiedades del Elemento</span>
                {selectedElement && (
                  <button 
                    onClick={() => deleteElement(selectedElement.id)}
                    style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700 }}
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                )}
              </h3>
              
              {selectedElement ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Position coordinates */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', marginBottom: '2px' }}>Posición X (px):</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                        value={selectedElement.x} 
                        onChange={(e) => updateSelectedElement({ x: parseInt(e.target.value) || 0 })} 
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', marginBottom: '2px' }}>Posición Y (px):</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                        value={selectedElement.y} 
                        onChange={(e) => updateSelectedElement({ y: parseInt(e.target.value) || 0 })} 
                      />
                    </div>
                  </div>

                  {/* Size adjustments */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', marginBottom: '2px' }}>Ancho W (px):</label>
                      <input 
                        type="number" 
                        disabled={selectedElement.type === 'text'}
                        className="form-input" 
                        style={{ padding: '6px 10px', fontSize: '12px', opacity: selectedElement.type === 'text' ? 0.5 : 1 }}
                        value={selectedElement.w} 
                        onChange={(e) => updateSelectedElement({ w: parseInt(e.target.value) || 0 })} 
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', marginBottom: '2px' }}>Alto H (px):</label>
                      <input 
                        type="number" 
                        disabled={selectedElement.type === 'text' || selectedElement.type === 'qrcode'}
                        className="form-input" 
                        style={{ padding: '6px 10px', fontSize: '12px', opacity: (selectedElement.type === 'text' || selectedElement.type === 'qrcode') ? 0.5 : 1 }}
                        value={selectedElement.h} 
                        onChange={(e) => updateSelectedElement({ h: parseInt(e.target.value) || 0 })} 
                      />
                    </div>
                  </div>

                  {/* Specific fields depending on type */}
                  {selectedElement.type === 'text' && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', marginBottom: '2px' }}>Tamaño de Fuente (px / dots ZPL):</label>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input 
                          type="number" 
                          min="8"
                          max="150"
                          className="form-input" 
                          style={{ padding: '6px 10px', fontSize: '12px', width: '80px' }}
                          value={selectedElement.fontSize || 24} 
                          onChange={(e) => updateSelectedElement({ fontSize: parseInt(e.target.value) || 24 })} 
                        />
                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                          {[16, 20, 24, 28, 32, 40, 48].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateSelectedElement({ fontSize: s })}
                              style={{
                                padding: '3px 6px',
                                fontSize: '10px',
                                borderRadius: '4px',
                                border: '1px solid rgba(0,0,0,0.1)',
                                background: (selectedElement.fontSize || 24) === s ? '#2563eb' : 'rgba(0,0,0,0.05)',
                                color: (selectedElement.fontSize || 24) === s ? '#ffffff' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontWeight: 700
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedElement.type === 'qrcode' && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', marginBottom: '2px' }}>Escala del QR (1 - 10):</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="10" 
                        className="form-input" 
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                        value={selectedElement.qrScale || 5}
                        onChange={(e) => updateSelectedElement({ qrScale: parseInt(e.target.value) || 5 })} 
                      />
                    </div>
                  )}

                  {(selectedElement.type === 'box' || selectedElement.type === 'line') && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10px', marginBottom: '2px' }}>Grosor del Borde (px):</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                        value={selectedElement.thickness || 2}
                        onChange={(e) => updateSelectedElement({ thickness: parseInt(e.target.value) || 2 })} 
                      />
                    </div>
                  )}

                  {/* Content & Variables list */}
                  {selectedElement.type !== 'box' && selectedElement.type !== 'line' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '10px', marginBottom: '2px' }}>Contenido / Variables:</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                          value={selectedElement.content} 
                          onChange={(e) => updateSelectedElement({ content: e.target.value })} 
                        />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {['Puesto', 'Referencia', 'Ornamento', 'OrdenProduccion', 'OrdenCliente', 'Secuencia', 'SD', 'Orden', 'Posicion', 'ManoCompuesta', 'Mano', 'MinutosCurado', 'QrCompleto', 'FechaLectura'].map(v => (
                          <button 
                            key={v}
                            onClick={() => updateSelectedElement({ content: `{${v}}` })}
                            style={{
                              padding: '3px 8px',
                              fontSize: '10px',
                              background: 'rgba(37, 99, 235, 0.08)',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: 'var(--accent-color)',
                              fontWeight: 700
                            }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0', fontWeight: 600 }}>
                  Seleccione un elemento del lienzo para editar sus propiedades.
                </div>
              )}
            </div>
          )}

          {/* 2. RENDERED PREVIEW IMAGE BLOCK */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                Vista Previa del Renderizado
              </span>
              
              <button 
                onClick={() => fetchPreview(getActiveZpl(), simData)}
                disabled={isLoadingPreview}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}
              >
                <RefreshCw size={10} className={isLoadingPreview ? 'pulse' : ''} />
                Actualizar Render
              </button>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.03)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              minHeight: '220px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              padding: '12px',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
            }}>
              {isLoadingPreview ? (
                <div className="pulse" style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Generando preview ZPL...</div>
              ) : previewError ? (
                <div style={{ textAlign: 'center', padding: '12px' }}>
                  <AlertTriangle size={24} style={{ color: '#d97706', marginBottom: '4px' }} />
                  <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>{previewError}</div>
                </div>
              ) : previewImage ? (
                <img 
                  src={`data:image/png;base64,${previewImage}`} 
                  alt="Zebra Rendered Label" 
                  style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', backgroundColor: '#fff', borderRadius: '4px', padding: '8px', border: '1px solid rgba(0, 0, 0, 0.05)', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }} 
                />
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Cargando preview...</span>
              )}
            </div>
          </div>

          {/* 3. SIMULATED VARIABLES DATA */}
          <div className="card-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
              <Sparkles size={14} style={{ color: '#d97706' }} />
              Simulación de Datos
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '10px', marginBottom: '2px' }}>Puesto:</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  value={simData.puesto} 
                  onChange={(e) => handleSimDataChange('puesto', e.target.value)} 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '10px', marginBottom: '2px' }}>Referencia:</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  value={simData.referencia} 
                  onChange={(e) => handleSimDataChange('referencia', e.target.value)} 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '10px', marginBottom: '2px' }}>Ornamento:</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  value={simData.codigoOrnamentoLeido} 
                  onChange={(e) => handleSimDataChange('codigoOrnamentoLeido', e.target.value)} 
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '10px', marginBottom: '2px' }}>Secuencia:</label>
                <input 
                  type="number" 
                  className="form-input" 
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  value={simData.secuencia} 
                  onChange={(e) => handleSimDataChange('secuencia', parseInt(e.target.value) || 0)} 
                />
              </div>
            </div>
          </div>

          {/* 4. PHYSICAL PRINTER TEST */}
          <div className="card-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
              <Printer size={14} style={{ color: 'var(--accent-color)' }} />
              Prueba de Impresión Física
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {printers.length > 0 ? (
                <select 
                  value={selectedPrinter} 
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  className="form-input"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                >
                  {printers.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', fontWeight: 600 }}>
                  No se encontraron impresoras en Windows.
                </div>
              )}

              <button 
                onClick={handleTestPrint}
                disabled={printers.length === 0}
                className="btn btn-secondary"
                style={{ padding: '8px 12px', fontSize: '12px', width: '100%', borderRadius: '8px' }}
              >
                <Printer size={12} />
                Imprimir Etiqueta de Prueba
              </button>

              {printStatus.message && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  backgroundColor: printStatus.type === 'success' ? 'rgba(5, 150, 105, 0.05)' : 'rgba(220, 38, 38, 0.05)',
                  border: '1px solid ' + (printStatus.type === 'success' ? '#059669' : '#dc2626'),
                  color: printStatus.type === 'success' ? '#059669' : '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700
                }}>
                  <span>{printStatus.message}</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Save Notification HUD */}
      {saveStatus.message && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          padding: '12px 20px',
          borderRadius: '10px',
          backgroundColor: saveStatus.type === 'success' ? '#059669' : '#dc2626',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          animation: 'slideUp 0.2s ease-out',
          zIndex: 1000
        }}>
          <CheckCircle2 size={16} />
          <span style={{ fontSize: '12px', fontWeight: 700 }}>{saveStatus.message}</span>
        </div>
      )}

    </div>
  );
};
