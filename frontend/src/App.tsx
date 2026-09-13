import { useState, useEffect } from 'react';
import { OperativeView } from './components/OperativeView';
import { HistoryView } from './components/HistoryView';
import { ConfigView } from './components/ConfigView';
import { LabelDesigner } from './components/LabelDesigner';
import { Settings, BarChart2, Cpu, Palette } from 'lucide-react';

type ViewMode = 'OPERATIVE' | 'HISTORY' | 'CONFIG' | 'DESIGNER';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('OPERATIVE');
  
  // Base configuration settings
  const [apiBaseUrl, setApiBaseUrl] = useState(() => {
    const local = localStorage.getItem('api_base_url');
    if (local) return local;
    return window.location.origin.includes('http') ? window.location.origin : 'http://localhost:5121';
  });
  
  const [puesto, setPuesto] = useState(() => {
    return localStorage.getItem('active_puesto') || 'DL01';
  });

  const [refreshIntervalSec, setRefreshIntervalSec] = useState(() => {
    return parseInt(localStorage.getItem('refresh_interval') || '5', 10);
  });

  const [operador] = useState(() => {
    return localStorage.getItem('active_operador') || 'OP-JUAN';
  });

  // Simulator configurations
  const [mockDbError, setMockDbError] = useState(false);
  const [mockPrintFolderError, setMockPrintFolderError] = useState(false);
  const [showQrSimulator, setShowQrSimulator] = useState(false);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('api_base_url', apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    localStorage.setItem('active_puesto', puesto);
  }, [puesto]);

  useEffect(() => {
    localStorage.setItem('refresh_interval', refreshIntervalSec.toString());
  }, [refreshIntervalSec]);

  // Load live config settings directly from the DB on startup
  const reloadFromDbConfig = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/config`);
      if (res.ok) {
        const data = await res.json();
        if (data.Workstation_Puesto) {
          setPuesto(data.Workstation_Puesto);
          localStorage.setItem('active_puesto', data.Workstation_Puesto);
        }
        if (data.Refresh_Interval_Sec) {
          const sec = parseInt(data.Refresh_Interval_Sec, 10);
          setRefreshIntervalSec(sec);
          localStorage.setItem('refresh_interval', sec.toString());
        }
        if (data.Show_QR_Simulator) {
          setShowQrSimulator(data.Show_QR_Simulator === 'true');
        }
      }
    } catch (e) {
      console.warn("Failed to load configs from API. Using local fallbacks.", e);
    }
  };

  useEffect(() => {
    reloadFromDbConfig();
  }, [apiBaseUrl]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'row', 
      height: '100vh', 
      width: '100vw', 
      color: 'var(--text-primary)', 
      overflow: 'hidden' 
    }}>
      
      {/* SIDEBAR NAVIGATION (HMI Control Menu) */}
      <nav style={{ 
        width: '80px', 
        background: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        borderRadius: '24px',
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        padding: '24px 0', 
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        margin: '16px 0 16px 16px',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
          
          {/* Brand Logo */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '48px', 
            height: '48px', 
            borderRadius: '14px', 
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', 
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.2)' 
          }}>
            <Cpu size={24} style={{ color: '#fff' }} />
          </div>

          {/* Action Tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button 
              onClick={() => setViewMode('OPERATIVE')}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: viewMode === 'OPERATIVE' ? '#0f172a' : 'transparent',
                color: viewMode === 'OPERATIVE' ? '#ffffff' : 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                boxShadow: viewMode === 'OPERATIVE' ? '0 4px 12px rgba(15, 23, 42, 0.15)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              title="Operaciones de Planta"
            >
              <Cpu size={20} />
              <span style={{ fontSize: '8px', fontWeight: 700 }}>DL01</span>
            </button>

            <button 
              onClick={() => setViewMode('HISTORY')}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: viewMode === 'HISTORY' ? '#0f172a' : 'transparent',
                color: viewMode === 'HISTORY' ? '#ffffff' : 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                boxShadow: viewMode === 'HISTORY' ? '0 4px 12px rgba(15, 23, 42, 0.15)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              title="Logs Historial"
            >
              <BarChart2 size={20} />
              <span style={{ fontSize: '8px', fontWeight: 700 }}>LOGS</span>
            </button>

            <button 
              onClick={() => setViewMode('DESIGNER')}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: viewMode === 'DESIGNER' ? '#0f172a' : 'transparent',
                color: viewMode === 'DESIGNER' ? '#ffffff' : 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                boxShadow: viewMode === 'DESIGNER' ? '0 4px 12px rgba(15, 23, 42, 0.15)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              title="Diseñador de Etiquetas"
            >
              <Palette size={20} />
              <span style={{ fontSize: '8px', fontWeight: 700 }}>DESIGN</span>
            </button>

            <button 
              onClick={() => setViewMode('CONFIG')}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: viewMode === 'CONFIG' ? '#0f172a' : 'transparent',
                color: viewMode === 'CONFIG' ? '#ffffff' : 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                boxShadow: viewMode === 'CONFIG' ? '0 4px 12px rgba(15, 23, 42, 0.15)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              title="Administración"
            >
              <Settings size={20} />
              <span style={{ fontSize: '8px', fontWeight: 700 }}>SETTINGS</span>
            </button>
          </div>
        </div>

        {/* API Connection settings drawer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'center', fontSize: '9px', color: 'var(--text-secondary)' }}>
            <strong style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>API Target</strong>
            <input 
              type="text" 
              value={apiBaseUrl} 
              onChange={(e) => setApiBaseUrl(e.target.value)} 
              style={{
                width: '68px',
                fontSize: '8px',
                background: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(0,0,0,0.08)',
                color: 'var(--text-primary)',
                textAlign: 'center',
                padding: '4px 0',
                borderRadius: '6px',
                marginTop: '4px',
                outline: 'none',
                fontWeight: 600
              }}
            />
          </div>
          <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)' }}>v1.0.0</div>
        </div>
      </nav>

      {/* VIEWPORT AREA */}
      <div style={{ flex: 1, height: '100vh', overflow: 'hidden', position: 'relative' }}>
        {viewMode === 'OPERATIVE' && (
          <OperativeView 
            apiBaseUrl={apiBaseUrl}
            puesto={puesto}
            refreshIntervalSec={refreshIntervalSec}
            operador={operador}
            onOpenConfig={() => setViewMode('CONFIG')}
            mockDbError={mockDbError}
            setMockDbError={setMockDbError}
            mockPrintFolderError={mockPrintFolderError}
            setMockPrintFolderError={setMockPrintFolderError}
            showQrSimulator={showQrSimulator}
          />
        )}

        {viewMode === 'HISTORY' && (
          <HistoryView 
            apiBaseUrl={apiBaseUrl}
            onClose={() => setViewMode('OPERATIVE')}
          />
        )}

        {viewMode === 'CONFIG' && (
          <ConfigView 
            apiBaseUrl={apiBaseUrl}
            onClose={() => setViewMode('OPERATIVE')}
            onConfigUpdated={reloadFromDbConfig}
            onOpenDesigner={() => setViewMode('DESIGNER')}
          />
        )}

        {viewMode === 'DESIGNER' && (
          <LabelDesigner 
            apiBaseUrl={apiBaseUrl}
            onClose={() => setViewMode('OPERATIVE')}
            onConfigUpdated={reloadFromDbConfig}
          />
        )}
      </div>

    </div>
  );
}

export default App;
