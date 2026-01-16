
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { InspectionImage, ApiSettings, UserFeedback } from './types';
import Header from './components/Header';
import InspectionCard from './components/InspectionCard';
import { analyzeInspectionImage, fileToBase64 } from './services/geminiService';
import { generateHtmlReport } from './services/reportService';

const STORAGE_KEY = 'dg_cache_v2';
const INITIAL_CREDITS = 100;

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [images, setImages] = useState<InspectionImage[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [credits, setCredits] = useState<number>(INITIAL_CREDITS);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [currentProcessingFile, setCurrentProcessingFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setImages(parsed.map((img: any) => ({ 
            ...img, 
            status: img.status === 'processing' ? 'pending' : img.status,
            previewUrl: img.previewUrl?.startsWith('blob:') ? '' : img.previewUrl
          })));
        }
      } catch (e) { 
        localStorage.removeItem(STORAGE_KEY); 
      }
    }
  }, []);

  useEffect(() => {
    if (images.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      const toSave = images.map(({ file, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    }
  }, [images]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages: InspectionImage[] = Array.from(files).map((file: File) => ({
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      file: file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending' as const,
      userFeedback: { comments: '' }
    }));
    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateFeedback = (id: string, feedback: UserFeedback) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, userFeedback: { ...img.userFeedback, ...feedback } } : img
    ));
  };

  const clearInspection = useCallback(() => {
    if (window.confirm('Deseja limpar todas as fotos e iniciar uma nova inspeção?')) {
      images.forEach(img => {
        if (img.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
      setImages([]);
      localStorage.removeItem(STORAGE_KEY);
      setBatchProgress({ current: 0, total: 0 });
      setIsProcessingAll(false);
    }
  }, [images]);

  const processImage = async (img: InspectionImage): Promise<boolean> => {
    if (!img.file) {
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error', error: "Arquivo original não disponível. Por favor, re-adicione a foto." } : i));
      return false;
    }
    setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'processing', error: undefined } : i));
    try {
      const base64 = await fileToBase64(img.file);
      const results = await analyzeInspectionImage(base64, img.file.type, { mode: 'sdk', customEndpoint: '' });
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'completed', results } : i));
      setCredits(prev => Math.max(0, prev - 1));
      return true;
    } catch (error: any) {
      if (error.message === 'API_KEY_REQUIRED' && window.aistudio) {
        await window.aistudio.openSelectKey();
        return processImage(img);
      }
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error', error: error.message } : i));
      return false;
    }
  };

  const handleProcessAll = async () => {
    const pending = images.filter(img => (img.status === 'pending' || img.status === 'error'));
    if (pending.length === 0) return;
    setIsProcessingAll(true);
    setBatchProgress({ current: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      const current = pending[i];
      setCurrentProcessingFile(current.file?.name || current.id);
      await processImage(current);
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));
    }
    setIsProcessingAll(false);
    setCurrentProcessingFile(null);
  };

  const handleExportReport = async () => {
    const completed = images.filter(img => img.status === 'completed' && img.results);
    if (completed.length === 0) {
      alert("Realize ao menos uma inspeção completa antes de exportar.");
      return;
    }
    setIsExporting(true);
    try {
      const htmlContent = await generateHtmlReport(images);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatorio-DroneGuard-${new Date().getTime()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Falha ao gerar o laudo técnico.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-blue-500/30">
      <Header onOpenSettings={() => setShowSettings(true)} />
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Hybrid Human-AI Diagnostics
            </div>
            <h2 className="text-5xl sm:text-7xl font-black text-white uppercase italic tracking-tighter leading-none">
              Contr<span className="text-zinc-800">ole</span><br/>
              Técni<span className="text-blue-500">co</span>
            </h2>
          </div>
          <div className="flex gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 min-w-[140px] backdrop-blur-xl">
              <p className="text-[10px] text-zinc-500 font-black uppercase mb-2 tracking-widest">Saldo API</p>
              <span className="text-3xl font-black text-white font-mono">{credits}</span>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 min-w-[140px] backdrop-blur-xl">
              <p className="text-[10px] text-zinc-500 font-black uppercase mb-2 tracking-widest">Alertas</p>
              <span className="text-3xl font-black text-blue-500 font-mono">
                {images.reduce((acc, i) => acc + (i.results?.foundAnomalies.length || 0), 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-12 p-2 bg-zinc-900/30 border border-zinc-800 rounded-3xl sticky top-24 z-40 backdrop-blur-md">
          <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none bg-white text-black px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95 shadow-lg">Adicionar Fotos</button>
          <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileUpload} />
          <button disabled={images.filter(i => i.status === 'pending' || i.status === 'error').length === 0 || isProcessingAll} onClick={handleProcessAll} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-20 transition-all">Iniciar Análise</button>
          <button disabled={images.filter(i => i.status === 'completed').length === 0 || isExporting} onClick={handleExportReport} className="flex-1 sm:flex-none bg-zinc-900 border border-zinc-800 text-zinc-100 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Exportar Relatório</button>
          <div className="h-8 w-[1px] bg-zinc-800 hidden sm:block mx-2"></div>
          <button onClick={clearInspection} disabled={images.length === 0 || isProcessingAll} className="flex-1 sm:flex-none bg-zinc-950 border border-zinc-800 text-zinc-500 hover:text-red-500 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Nova Inspeção</button>
        </div>

        {isProcessingAll && (
          <div className="mb-12 p-8 bg-zinc-900/50 border border-blue-500/20 rounded-3xl">
            <div className="flex justify-between items-end mb-4">
              <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Analisando: {currentProcessingFile}</span>
              <span className="text-3xl font-black font-mono text-white">{batchProgress.current}/{batchProgress.total}</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-700 shadow-[0_0_15px_rgba(59,130,246,0.6)]" style={{ width: `${(batchProgress.current/batchProgress.total)*100}%` }} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {images.map(img => (
            <InspectionCard 
              key={img.id} 
              image={img} 
              onRetry={processImage} 
              onUpdateFeedback={(fb) => handleUpdateFeedback(img.id, fb)}
            />
          ))}
          {images.length === 0 && (
            <div onClick={() => fileInputRef.current?.click()} className="col-span-full py-40 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[3rem] opacity-30 cursor-pointer">
              <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-[10px]">Aguardando Capturas</p>
            </div>
          )}
        </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-zinc-800 p-12 rounded-[3rem] max-w-md w-full shadow-2xl relative">
            <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-8">Preferências</h3>
            <div className="space-y-4">
              <button onClick={async () => { if(window.aistudio) await window.aistudio.openSelectKey(); setShowSettings(false); }} className="w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest">Gerenciar API Key</button>
              <button onClick={() => setShowSettings(false)} className="w-full bg-zinc-900 border border-zinc-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest">Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
