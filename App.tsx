
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { InspectionImage, Severity, ApiSettings } from './types';
import Header from './components/Header';
import InspectionCard from './components/InspectionCard';
import { analyzeInspectionImage, fileToBase64 } from './services/geminiService';

const STORAGE_KEY = 'droneguard_inspections_v1';
const SETTINGS_KEY = 'droneguard_settings_v1';

const App: React.FC = () => {
  const [images, setImages] = useState<InspectionImage[]>([]);
  const [apiSettings, setApiSettings] = useState<ApiSettings>({ mode: 'sdk', customEndpoint: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(!process.env.API_KEY);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar dados salvos
  useEffect(() => {
    const savedImgs = localStorage.getItem(STORAGE_KEY);
    if (savedImgs) {
      try {
        const parsed: InspectionImage[] = JSON.parse(savedImgs);
        setImages(parsed.map(img => ({ ...img, status: img.status === 'processing' ? 'pending' : img.status, previewUrl: '' })));
      } catch (e) { console.error(e); }
    }

    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try { setApiSettings(JSON.parse(savedSettings)); } catch (e) { console.error(e); }
    }
  }, []);

  // Salvar configurações
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(apiSettings));
  }, [apiSettings]);

  // Salvar imagens
  useEffect(() => {
    const toSave = images.map(({ file, previewUrl, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [images]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    // Fix: Explicitly cast Array.from(files) to File[] to resolve 'unknown' type errors on lines 52 and 55.
    const newImages: InspectionImage[] = (Array.from(files) as File[]).map(file => ({
      id: Math.random().toString(36).substring(2, 11),
      file: file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending' as const
    }));

    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processImage = async (img: InspectionImage): Promise<boolean> => {
    if (!img.file) {
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error', error: 'Arquivo original necessário.' } : i));
      return true;
    }

    setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'processing', error: undefined } : i));
    
    try {
      const base64 = await fileToBase64(img.file);
      const results = await analyzeInspectionImage(base64, img.file.type, apiSettings);
      
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'completed', results } : i));
      return true;
    } catch (error: any) {
      const msg = error.message || 'Erro de processamento';
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error', error: msg } : i));
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) setQuotaExceeded(true);
      return false;
    }
  };

  const handleProcessAll = async () => {
    const pending = images.filter(img => (img.status === 'pending' || img.status === 'error') && img.file);
    if (pending.length === 0) return;
    
    setIsProcessingAll(true);
    setBatchProgress({ current: 0, total: pending.length });

    for (let i = 0; i < pending.length; i++) {
      const success = await processImage(pending[i]);
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));
      if (!success && apiSettings.mode === 'sdk') break;
      await new Promise(r => setTimeout(r, 800));
    }
    
    setIsProcessingAll(false);
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
        
        {/* Banner de Modo de API */}
        <div className={`mb-6 p-3 rounded-xl border flex items-center justify-between transition-colors ${apiSettings.mode === 'custom' ? 'bg-indigo-50 border-indigo-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full animate-pulse ${apiSettings.mode === 'custom' ? 'bg-indigo-500' : 'bg-blue-500'}`}></div>
            <p className="text-xs font-semibold text-slate-700">
              {apiSettings.mode === 'custom' ? `Conectado ao Backend Vercel: ${apiSettings.customEndpoint}` : 'Operando via Gemini SDK Nativo'}
            </p>
          </div>
          <button onClick={() => setShowSettings(true)} className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:underline">Alterar</button>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Inspeção de Rede</h2>
            <p className="text-slate-500 mt-1">Status da API: {apiSettings.mode.toUpperCase()}</p>
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Carregar Drone Fotos
          </button>
          <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileUpload} />

          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              disabled={isProcessingAll || images.filter(i => (i.status === 'pending' || i.status === 'error') && i.file).length === 0}
              onClick={handleProcessAll}
              className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white px-10 py-3 rounded-xl font-bold h-12 transition-all shadow-md"
            >
              {isProcessingAll ? 'Processando...' : 'Iniciar Análise'}
            </button>
            <button 
              onClick={() => { setImages([]); localStorage.removeItem(STORAGE_KEY); }} 
              className="bg-white border border-slate-200 px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-50 h-12"
            >
              Limpar
            </button>
          </div>
        </div>

        {isProcessingAll && (
          <div className="mb-8 space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span>Progresso da Inspeção</span>
              <span>{batchProgress.current} / {batchProgress.total}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
            </div>
          </div>
        )}

        {images.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center flex flex-col items-center justify-center">
             <p className="text-slate-400 font-medium">Aguardando imagens para inspeção técnica.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map(img => <InspectionCard key={img.id} image={img} />)}
          </div>
        )}
      </main>

      {/* Modal de Configurações */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">Configuração de API</h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Modo de Conexão</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setApiSettings(prev => ({ ...prev, mode: 'sdk' }))}
                    className={`px-4 py-3 rounded-xl font-bold text-sm border-2 transition-all ${apiSettings.mode === 'sdk' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                  >
                    Gemini SDK
                  </button>
                  <button 
                    onClick={() => setApiSettings(prev => ({ ...prev, mode: 'custom' }))}
                    className={`px-4 py-3 rounded-xl font-bold text-sm border-2 transition-all ${apiSettings.mode === 'custom' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                  >
                    Custom (Vercel)
                  </button>
                </div>
              </div>

              {apiSettings.mode === 'custom' && (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">URL do Endpoint</label>
                  <input 
                    type="text" 
                    value={apiSettings.customEndpoint}
                    onChange={(e) => setApiSettings(prev => ({ ...prev, customEndpoint: e.target.value }))}
                    placeholder="https://seu-projeto.vercel.app/api/inspect"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-mono"
                  />
                  <p className="text-[10px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                    Nota: Seu backend deve aceitar um JSON com "image" (base64) e retornar o JSON de anomalias compatível.
                  </p>
                </div>
              )}

              <button 
                onClick={() => setShowSettings(false)}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
              >
                Salvar e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
