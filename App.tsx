
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
    
    // Explicitly type file as File to avoid 'unknown' inference error when calling URL.createObjectURL
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
        throw new Error("Arquivo original não disponível para re-análise.");
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

  const handleProcessAll = async () => {
    const pending = images.filter(img => (img.status === 'pending' || img.status === 'error') && img.file);
    if (pending.length === 0) return;
    
    setIsProcessingAll(true);
    setBatchProgress({ current: 0, total: pending.length });

    for (let i = 0; i < pending.length; i++) {
      await processImage(pending[i]);
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));
      // Small delay to respect rate limits
      await new Promise(r => setTimeout(r, 1000));
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
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Inspeção de Rede</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${apiSettings.mode === 'sdk' ? 'bg-green-500' : 'bg-indigo-500'}`}></span>
              <p className="text-slate-500 text-sm">IA: {apiSettings.mode === 'sdk' ? 'Gemini 3 Flash' : 'Endpoint Customizado'}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm min-w-[100px]">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Imagens</p>
              <p className="text-xl font-bold text-slate-700">{stats.total}</p>
            </div>
            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm min-w-[100px]">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Anomalias</p>
              <p className="text-xl font-bold text-orange-600">{stats.anomalies}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-20 z-40 backdrop-blur-md bg-white/90">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all h-12"
          >
            Carregar Fotos
          </button>
          <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileUpload} />

          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              disabled={isProcessingAll || images.filter(i => (i.status === 'pending' || i.status === 'error') && i.file).length === 0}
              onClick={handleProcessAll}
              className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white px-8 py-3 rounded-xl font-bold h-12 transition-all"
            >
              {isProcessingAll ? 'Analisando...' : 'Iniciar Análise'}
            </button>
            <button 
              disabled={images.length === 0 || isExporting}
              onClick={handleExportReport}
              className="bg-white border border-slate-200 px-6 py-3 rounded-xl text-slate-700 font-bold hover:bg-slate-50 h-12"
            >
              Exportar
            </button>
            <button onClick={() => { setImages([]); localStorage.removeItem(STORAGE_KEY); }} className="text-slate-400 hover:text-red-500 px-4">
              Limpar
            </button>
          </div>
        </div>

        {isProcessingAll && (
          <div className="mb-8 space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
              <span>Progresso</span>
              <span>{batchProgress.current} / {batchProgress.total}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
            </div>
          </div>
        )}

        {images.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center flex flex-col items-center justify-center">
             <p className="text-slate-400 font-medium">Nenhuma imagem carregada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map(img => <InspectionCard key={img.id} image={img} />)}
          </div>
        )}
      </main>

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold">Configurações de API</h3>
              <button onClick={() => setShowSettings(false)}>X</button>
            </div>
            <div className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setApiSettings({ ...apiSettings, mode: 'sdk' })} className={`p-3 rounded-xl border-2 ${apiSettings.mode === 'sdk' ? 'border-blue-600 bg-blue-50' : ''}`}>SDK</button>
                <button onClick={() => setApiSettings({ ...apiSettings, mode: 'custom' })} className={`p-3 rounded-xl border-2 ${apiSettings.mode === 'custom' ? 'border-blue-600 bg-blue-50' : ''}`}>Custom</button>
              </div>
              {apiSettings.mode === 'custom' && (
                <input 
                  type="text" 
                  value={apiSettings.customEndpoint} 
                  onChange={e => setApiSettings({...apiSettings, customEndpoint: e.target.value})}
                  className="w-full p-3 border rounded-xl"
                  placeholder="URL do Endpoint"
                />
              )}
              <button onClick={() => setShowSettings(false)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
