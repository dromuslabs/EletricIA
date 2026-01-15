
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { InspectionImage, Severity } from './types';
import Header from './components/Header';
import InspectionCard from './components/InspectionCard';
import { analyzeInspectionImage, fileToBase64 } from './services/geminiService';

const App: React.FC = () => {
  const [images, setImages] = useState<InspectionImage[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newFiles: File[] = Array.from(files);
    const newImages: InspectionImage[] = newFiles.map((file: File) => ({
      id: Math.random().toString(36).substring(2, 11),
      file: file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending' as const
    }));

    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setQuotaExceeded(false); // Reset ao subir novas fotos
  };

  const processImage = async (img: InspectionImage): Promise<boolean> => {
    if (!process.env.API_KEY) {
      setImages(prev => prev.map(i => i.id === img.id ? { 
        ...i, 
        status: 'error', 
        error: 'Chave de API (API_KEY) não encontrada.' 
      } : i));
      return false;
    }

    setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'processing', error: undefined } : i));
    
    try {
      const base64 = await fileToBase64(img.file);
      const results = await analyzeInspectionImage(base64, img.file.type);
      
      setImages(prev => prev.map(i => i.id === img.id ? { 
        ...i, 
        status: 'completed',
        results: results
      } : i));
      return true;
    } catch (error: any) {
      console.error("Erro ao processar imagem:", error);
      let errorMessage = 'Falha na comunicação com a IA';
      let isQuotaError = false;
      
      const status = error?.status;
      const message = error?.message?.toLowerCase() || '';

      if (status === 429 || message.includes('quota') || message.includes('exhausted') || message.includes('limit')) {
        errorMessage = 'Limite de cota atingido ou créditos insuficientes no Google AI Studio.';
        isQuotaError = true;
        setQuotaExceeded(true);
      } else if (status === 403 || status === 401) {
        errorMessage = 'Erro de Autenticação: Verifique sua chave de API.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setImages(prev => prev.map(i => i.id === img.id ? { 
        ...i, 
        status: 'error', 
        error: errorMessage
      } : i));
      
      return !isQuotaError; // Retorna false se for erro de cota para parar o loop
    }
  };

  const handleProcessAll = async () => {
    const pendingImages = images.filter(img => img.status === 'pending' || img.status === 'error');
    if (pendingImages.length === 0) return;
    
    setIsProcessingAll(true);
    setQuotaExceeded(false);
    setBatchProgress({ current: 0, total: pendingImages.length });

    for (let i = 0; i < pendingImages.length; i++) {
      const success = await processImage(pendingImages[i]);
      setBatchProgress(prev => ({ ...prev, current: i + 1 }));
      
      if (!success) {
        // Se houve erro de cota, paramos o processamento do lote
        break;
      }

      if (i < pendingImages.length - 1) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    
    setIsProcessingAll(false);
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    setBatchProgress({ current: 0, total: 0 });
    setQuotaExceeded(false);
  };

  const stats = useMemo(() => ({
    total: images.length,
    processed: images.filter(i => i.status === 'completed').length,
    anomalies: images.reduce((acc, i) => acc + (i.results?.foundAnomalies.length || 0), 0),
    critical: images.reduce((acc, i) => acc + (i.results?.foundAnomalies.filter(a => a.severity === Severity.CRITICAL || a.severity === Severity.HIGH).length || 0), 0)
  }), [images]);

  const progressPercentage = batchProgress.total > 0 
    ? Math.round((batchProgress.current / batchProgress.total) * 100) 
    : 0;

  const exportReport = async () => {
    setIsExporting(true);
    try {
      const reportDate = new Date().toLocaleString('pt-BR');
      let htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <title>Relatório DroneGuard</title>
          <style>
              body { font-family: system-ui, sans-serif; color: #334155; padding: 40px; background: #f8fafc; }
              .container { max-width: 950px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .inspection-item { border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 40px; overflow: hidden; page-break-inside: avoid; }
              .image-container { width: 100%; height: 500px; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; }
              .image-container img { width: 100%; height: 100%; object-fit: contain; }
              .details { padding: 25px; }
              .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 0.75em; font-weight: bold; text-transform: uppercase; margin-bottom: 15px; }
              .badge-safe { background: #dcfce7; color: #166534; }
              .badge-danger { background: #fee2e2; color: #991b1b; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>Relatório DroneGuard AI</h1>
              <p>Data: ${reportDate}</p>
              <hr>
      `;

      for (const img of images) {
        if (img.status === 'completed' && img.results) {
          const base64 = await fileToBase64(img.file);
          htmlContent += `
              <div class="inspection-item">
                  <div class="image-container"><img src="data:${img.file.type};base64,${base64}"></div>
                  <div class="details">
                      <h2>Estrutura: ${img.results.lineName || 'N/A'}</h2>
                      <p><b>Arquivo:</b> ${img.file.name}</p>
                      <span class="badge ${img.results.safeToOperate ? 'badge-safe' : 'badge-danger'}">
                          ${img.results.safeToOperate ? 'Seguro' : 'Risco'}
                      </span>
                      <p><i>"${img.results.summary}"</i></p>
                  </div>
              </div>
          `;
        }
      }
      htmlContent += `</div></body></html>`;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Relatorio_DroneGuard_${Date.now()}.html`;
      link.click();
    } catch (e) {
      alert("Erro ao exportar.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Inspeção de Rede Elétrica</h2>
            <p className="text-slate-500 mt-1">Gestão inteligente de ativos de transmissão com visão computacional.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-2">
              <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-center shadow-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Anomalias</p>
                <p className="text-xl font-bold text-orange-600">{stats.anomalies}</p>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-center shadow-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Críticos</p>
                <p className="text-xl font-bold text-red-600">{stats.critical}</p>
              </div>
            </div>

            {stats.processed > 0 && (
              <button 
                onClick={exportReport}
                disabled={isExporting}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-100"
              >
                {isExporting ? <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> : 'Exportar Relatório'}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-col items-stretch gap-6 sticky top-20 z-40 backdrop-blur-md bg-white/90">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Carregar Fotos
            </button>
            <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileUpload} />

            <div className="flex gap-3 w-full sm:w-auto">
              <button 
                disabled={isProcessingAll || images.filter(i => i.status === 'pending' || i.status === 'error').length === 0}
                onClick={handleProcessAll}
                className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white px-8 py-3 rounded-xl font-bold transition-all"
              >
                {isProcessingAll ? 'Processando Lote...' : 'Iniciar Análise'}
              </button>
              <button onClick={clearAll} className="bg-white border border-slate-200 px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-slate-50">Limpar</button>
            </div>
          </div>

          {/* Banner de Cota Excedida */}
          {quotaExceeded && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 animate-pulse">
              <div className="bg-red-100 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">Seus créditos acabaram ou a cota foi atingida!</p>
                <p className="text-xs text-red-600">O processamento foi interrompido. Verifique seu painel no Google AI Studio ou aguarde para tentar novamente.</p>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {isProcessingAll && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between items-center text-sm font-semibold text-slate-600 px-1">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                  </div>
                  <span>Analisando imagens do drone...</span>
                </div>
                <span>{batchProgress.current} de {batchProgress.total} ({progressPercentage}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                <div 
                  className="bg-blue-600 h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {images.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
               </svg>
             </div>
             <p className="text-slate-500 font-medium text-lg">Pronto para iniciar a inspeção</p>
             <p className="text-slate-400 text-sm mt-1">Arraste fotos ou clique em "Carregar Fotos" para detectar falhas estruturais.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map(img => <InspectionCard key={img.id} image={img} />)}
          </div>
        )}
      </main>
      <footer className="py-8 text-center text-slate-400 text-xs font-medium">
        DRONEGUARD AI &copy; {new Date().getFullYear()} - TECNOLOGIA PARA INFRAESTRUTURA CRÍTICA
      </footer>
    </div>
  );
};

export default App;
