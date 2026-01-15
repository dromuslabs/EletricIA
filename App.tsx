
import React, { useState, useCallback, useRef } from 'react';
import { InspectionImage, Severity } from './types';
import Header from './components/Header';
import InspectionCard from './components/InspectionCard';
import { analyzeInspectionImage, fileToBase64 } from './services/geminiService';

const App: React.FC = () => {
  const [images, setImages] = useState<InspectionImage[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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
  };

  const processImage = async (img: InspectionImage) => {
    if (!process.env.API_KEY) {
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error', error: 'Chave de API não configurada no ambiente (Vercel).' } : i));
      return;
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
    } catch (error: any) {
      console.error("Erro ao processar imagem:", error);
      let errorMessage = 'Falha desconhecida';
      
      if (error?.status === 403 || error?.status === 401) {
        errorMessage = 'Erro de Autenticação: Chave de API inválida.';
      } else if (error?.status === 429) {
        errorMessage = 'Limite de cota atingido. Aguarde um momento.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setImages(prev => prev.map(i => i.id === img.id ? { 
        ...i, 
        status: 'error',
        error: errorMessage
      } : i));
    }
  };

  const handleProcessAll = async () => {
    const pendingImages = images.filter(img => img.status === 'pending' || img.status === 'error');
    if (pendingImages.length === 0) return;
    
    setIsProcessingAll(true);
    for (let i = 0; i < pendingImages.length; i++) {
      await processImage(pendingImages[i]);
      if (i < pendingImages.length - 1) await new Promise(r => setTimeout(r, 1500));
    }
    setIsProcessingAll(false);
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  };

  const stats = {
    total: images.length,
    processed: images.filter(i => i.status === 'completed').length,
    anomalies: images.reduce((acc, i) => acc + (i.results?.foundAnomalies.length || 0), 0),
    critical: images.reduce((acc, i) => acc + (i.results?.foundAnomalies.filter(a => a.severity === Severity.CRITICAL || a.severity === Severity.HIGH).length || 0), 0)
  };

  const exportReport = async () => {
    setIsExporting(true);
    try {
      const reportDate = new Date().toLocaleString('pt-BR');
      let htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <style>
              body { font-family: sans-serif; color: #334155; padding: 40px; background: #f8fafc; }
              .container { max-width: 950px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .inspection-item { border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 40px; overflow: hidden; page-break-inside: avoid; }
              .image-container { width: 100%; height: 450px; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; }
              .image-container img { width: 100%; height: 100%; object-fit: contain; }
              .details { padding: 25px; }
              .geo-link { color: #2563eb; text-decoration: none; font-weight: bold; }
              .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 0.75em; font-weight: bold; text-transform: uppercase; margin-bottom: 15px; }
              .badge-safe { background: #dcfce7; color: #166534; }
              .badge-danger { background: #fee2e2; color: #991b1b; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>Relatório de Inspeção DroneGuard</h1>
              <p>Gerado em: ${reportDate}</p>
              <hr>
      `;

      for (const img of images) {
        if (img.status === 'completed' && img.results) {
          const base64 = await fileToBase64(img.file);
          const hasGeo = img.results.latitude && img.results.longitude;
          const mapsLink = hasGeo ? `https://www.google.com/maps?q=${img.results.latitude},${img.results.longitude}` : '#';
          
          htmlContent += `
              <div class="inspection-item">
                  <div class="image-container"><img src="data:${img.file.type};base64,${base64}"></div>
                  <div class="details">
                      <h3>Arquivo: ${img.file.name} | Linha: ${img.results.lineName || 'N/A'}</h3>
                      ${hasGeo ? `<p>📍 Localização: <a href="${mapsLink}" target="_blank" class="geo-link">${img.results.latitude}, ${img.results.longitude}</a></p>` : ''}
                      <span class="badge ${img.results.safeToOperate ? 'badge-safe' : 'badge-danger'}">
                          ${img.results.safeToOperate ? 'Seguro' : 'Risco'}
                      </span>
                      <p><i>"${img.results.summary}"</i></p>
                      <ul>
                          ${img.results.foundAnomalies.map(a => `<li><b>${a.type}</b> (${a.severity}): ${a.description}</li>`).join('')}
                      </ul>
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
      alert("Erro ao gerar relatório. Tente com menos imagens.");
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
            <h2 className="text-3xl font-bold text-slate-900">Inspeção de Rede Elétrica</h2>
            <p className="text-slate-500 mt-1">Detecção automatizada de falhas estruturais via IA.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-2">
              <div className="bg-white p-2 rounded-lg border border-slate-200 text-center min-w-[80px]">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Anomalias</p>
                <p className="text-lg font-bold text-orange-600">{stats.anomalies}</p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 text-center min-w-[80px]">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Críticos</p>
                <p className="text-lg font-bold text-red-600">{stats.critical}</p>
              </div>
            </div>

            {stats.processed > 0 && (
              <button 
                onClick={exportReport}
                disabled={isExporting}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
              >
                {isExporting ? <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> : 'Exportar Relatório'}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2"
          >
            Upload Fotos
          </button>
          <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileUpload} />

          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              disabled={isProcessingAll || images.filter(i => i.status === 'pending' || i.status === 'error').length === 0}
              onClick={handleProcessAll}
              className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-lg font-semibold"
            >
              {isProcessingAll ? 'Processando...' : 'Analisar Tudo'}
            </button>
            <button onClick={clearAll} className="bg-white border border-slate-200 px-4 py-2.5 rounded-lg text-slate-600 font-semibold">Limpar</button>
          </div>
        </div>

        {images.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center text-slate-400">
            Nenhuma foto carregada. Clique em "Upload Fotos" para iniciar.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map(img => <InspectionCard key={img.id} image={img} />)}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
