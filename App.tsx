
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { InspectionImage, Severity, ApiSettings } from './types';
import Header from './components/Header';
import InspectionCard from './components/InspectionCard';
import { analyzeInspectionImage, fileToBase64 } from './services/geminiService';
import { generateHtmlReport } from './services/reportService';

const STORAGE_KEY = 'droneguard_inspections_v1';
const SETTINGS_KEY = 'droneguard_settings_v1';

const App: React.FC = () => {
  const [images, setImages] = useState<InspectionImage[]>([]);
  const [apiSettings, setApiSettings] = useState<ApiSettings>({ mode: 'sdk', customEndpoint: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedImgs = localStorage.getItem(STORAGE_KEY);
    if (savedImgs) {
      try {
        const parsed: InspectionImage[] = JSON.parse(savedImgs);
        setImages(parsed.map(img => ({ 
          ...img, 
          status: img.status === 'processing' ? 'pending' : img.status, 
          previewUrl: img.previewUrl || '' 
        })));
      } catch (e) { console.error(e); }
    }
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try { setApiSettings(JSON.parse(savedSettings)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(apiSettings));
  }, [apiSettings]);

  useEffect(() => {
    const toSave = images.map(({ file, previewUrl, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [images]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newImages: InspectionImage[] = Array.from(files).map((file: File) => ({
      id: Math.random().toString(36).substring(2, 11),
      file: file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending' as const
    }));

    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processImage = async (img: InspectionImage): Promise<boolean> => {
    if (!img.file && !img.previewUrl) return true;

    setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'processing', error: undefined } : i));
    
    try {
      let base64 = '';
      if (img.file) {
        base64 = await fileToBase64(img.file);
      } else {
        throw new Error("Arquivo original não disponível.");
      }

      const results = await analyzeInspectionImage(base64, img.file.type, apiSettings);
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'completed', results } : i));
      return true;
    } catch (error: any) {
      const msg = error.message || 'Erro inesperado';
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error', error: msg } : i));
      return false;
    }
  };

  const handleRetry = (id: string) => {
    const img = images.find(i => i.id === id);
    if (img) processImage(img);
  };

  const handleProcessAll = async () => {
    const pending = images.filter(img => (img.status === 'pending' || img.status === 'error') && img.file);
    if (pending.length === 0) return;
    
    setIsProcessingAll(true);
    setBatchProgress({ current: 0, total: pending.length });

    for (let i = 0; i < pending.length; i++) {
      await processImage(pending[i]);
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));
      await new Promise(r => setTimeout(r, 1200)); // Delay ligeiramente maior para evitar 429
    }
    
    setIsProcessingAll(false);
  };

  const handleExportReport = () => {
    if (images.length === 0) return;
    setIsExporting(true);
    try {
      const htmlContent = generateHtmlReport(images);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-inspecao-${new Date().getTime()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const stats = useMemo(() => ({
    total: images.length,
    processed: images.filter(i => i.status === 'completed').length,
    anomalies: images.reduce((acc, i) => acc + (i.results?.foundAnomalies.length || 0), 0)
  }), [images]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header onOpenSettings={() => setShowSettings(true)} />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Painel de Inspeção</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full animate-pulse ${apiSettings.mode === 'sdk' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-indigo-500'}`}></span>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Motor: {apiSettings.mode === 'sdk' ? 'Gemini 3 Flash AI' : 'Custom Server'}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm min-w-[120px]">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total Fotos</p>
              <p className="text-2xl font-black text-slate-800 tracking-tight">{stats.total}</p>
            </div>
            <div className="bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm min-w-[120px]">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Incidentes</p>
              <p className="text-2xl font-black text-red-600 tracking-tight">{stats.anomalies}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 p-5 rounded-3xl shadow-xl border border-white backdrop-blur-xl mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-20 z-40">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] active:scale-95 h-14"
          >
            Carregar Imagens
          </button>
          <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileUpload} />

          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              disabled={isProcessingAll || images.filter(i => (i.status === 'pending' || i.status === 'error') && i.file).length === 0}
              onClick={handleProcessAll}
              className="flex-1 sm:flex-none bg-slate-900 hover:bg-black disabled:bg-slate-100 disabled:text-slate-400 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] h-14 transition-all shadow-xl"
            >
              {isProcessingAll ? 'Processando...' : 'Análise Geral'}
            </button>
            <button 
              disabled={images.length === 0 || isExporting}
              onClick={handleExportReport}
              className="bg-white border border-slate-200 px-8 py-4 rounded-2xl text-slate-700 font-black uppercase tracking-widest text-[11px] hover:bg-slate-50 h-14 shadow-sm"
            >
              Laudo HTML
            </button>
            <button onClick={() => { setImages([]); localStorage.removeItem(STORAGE_KEY); }} className="text-slate-400 hover:text-red-500 font-black text-[10px] uppercase tracking-widest px-4 transition-colors">
              Zerar
            </button>
          </div>
        </div>

        {isProcessingAll && (
          <div className="mb-10 space-y-3 bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-blue-800 uppercase tracking-[0.2em] mb-1">Status do Lote</p>
                <h4 className="text-xl font-black text-blue-900 tracking-tight">Processando Arquivos</h4>
              </div>
              <span className="text-blue-900 font-black text-lg">{batchProgress.current} <span className="text-blue-400 text-sm">/ {batchProgress.total}</span></span>
            </div>
            <div className="w-full bg-blue-200/50 rounded-full h-3 overflow-hidden p-0.5">
              <div className="bg-blue-600 h-full rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(37,99,235,0.4)]" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
            </div>
          </div>
        )}

        {images.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-24 text-center flex flex-col items-center justify-center group hover:border-blue-300 transition-colors">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
             </div>
             <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Arraste fotos ou clique em carregar para iniciar a varredura.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {images.map(img => <InspectionCard key={img.id} image={img} onRetry={handleRetry} />)}
          </div>
        )}
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-2xl font-black tracking-tight">Preferências</h3>
              <button onClick={() => setShowSettings(false)} className="bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm hover:bg-red-50 hover:text-red-500 transition-colors font-bold">✕</button>
            </div>
            <div className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setApiSettings({ ...apiSettings, mode: 'sdk' })} className={`py-6 rounded-3xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${apiSettings.mode === 'sdk' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 hover:border-slate-300'}`}>Cloud AI (SDK)</button>
                <button onClick={() => setApiSettings({ ...apiSettings, mode: 'custom' })} className={`py-6 rounded-3xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${apiSettings.mode === 'custom' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 hover:border-slate-300'}`}>Proxy Local</button>
              </div>
              {apiSettings.mode === 'custom' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">URL do Endpoint</label>
                  <input 
                    type="text" 
                    value={apiSettings.customEndpoint} 
                    onChange={e => setApiSettings({...apiSettings, customEndpoint: e.target.value})}
                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 ring-blue-500 transition-all font-medium"
                    placeholder="https://api.v1.local/analyze"
                  />
                </div>
              )}
              <button onClick={() => setShowSettings(false)} className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl transition-all active:scale-95">Aplicar Alterações</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
