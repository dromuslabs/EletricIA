
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
      const isQuota = error?.message?.includes('429') || JSON.stringify(error).includes('429');
      const errorMessage = isQuota 
        ? 'Limite de cota excedido. Tente novamente em alguns segundos.' 
        : (error instanceof Error ? error.message : 'Falha na API');

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
      const img = pendingImages[i];
      await processImage(img);
      
      if (i < pendingImages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
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
    const reportDate = new Date().toLocaleString('pt-BR');
    
    let htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <title>Relatório de Inspeção - DroneGuard AI</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; line-height: 1.6; margin: 0; padding: 40px; background: #f8fafc; }
            .container { max-width: 950px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 5px; }
            .date { color: #64748b; font-size: 0.9em; margin-bottom: 30px; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 40px; }
            .stat-card { background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
            .stat-value { display: block; font-size: 1.8em; font-weight: bold; color: #2563eb; }
            .stat-label { font-size: 0.75em; text-transform: uppercase; color: #64748b; font-weight: 600; }
            .inspection-item { border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 40px; overflow: hidden; page-break-inside: avoid; background: #fff; }
            .image-container { width: 100%; height: 450px; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }
            .image-container img { width: 100%; height: 100%; object-fit: contain; }
            .details { padding: 25px; }
            .file-name { font-size: 1.2em; font-weight: bold; margin-bottom: 10px; color: #1e293b; display: flex; justify-content: space-between; align-items: center; }
            .geo-info { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; font-size: 0.85em; display: flex; gap: 20px; }
            .geo-link { color: #2563eb; text-decoration: none; font-weight: 600; }
            .geo-link:hover { text-decoration: underline; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 0.75em; font-weight: bold; text-transform: uppercase; margin-bottom: 15px; }
            .badge-safe { background: #dcfce7; color: #166534; }
            .badge-danger { background: #fee2e2; color: #991b1b; }
            .summary-text { font-style: italic; color: #475569; margin-bottom: 20px; border-left: 4px solid #cbd5e1; padding-left: 15px; }
            .anomaly-list { margin-top: 20px; }
            .anomaly-card { background: #fff; border: 1px solid #f1f5f9; padding: 12px; border-radius: 6px; margin-bottom: 10px; border-left: 4px solid #ef4444; }
            .anomaly-type { font-weight: bold; color: #1e293b; }
            .anomaly-severity { font-size: 0.8em; padding: 2px 6px; border-radius: 4px; margin-left: 10px; }
            .severity-Crítico { background: #991b1b; color: white; }
            .severity-Alto { background: #dc2626; color: white; }
            .severity-Médio { background: #f59e0b; color: white; }
            .severity-Baixo { background: #3b82f6; color: white; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Relatório de Inspeção - DroneGuard AI</h1>
            <div class="date">Gerado em: ${reportDate}</div>

            <div class="stats-grid">
                <div class="stat-card"><span class="stat-value">${stats.total}</span><span class="stat-label">Total Imagens</span></div>
                <div class="stat-card"><span class="stat-value">${stats.processed}</span><span class="stat-label">Processadas</span></div>
                <div class="stat-card" style="border-color: #fdba74;"><span class="stat-value" style="color: #ea580c;">${stats.anomalies}</span><span class="stat-label">Anomalias</span></div>
                <div class="stat-card" style="border-color: #fca5a5;"><span class="stat-value" style="color: #dc2626;">${stats.critical}</span><span class="stat-label">Críticos</span></div>
            </div>

            <h2>Análise Detalhada das Estruturas</h2>
    `;

    for (const img of images) {
      if (img.status === 'completed' && img.results) {
        const base64 = await fileToBase64(img.file);
        const dataUrl = `data:${img.file.type};base64,${base64}`;
        
        const hasGeo = img.results.latitude && img.results.longitude;
        const mapsLink = hasGeo ? `https://www.google.com/maps?q=${img.results.latitude},${img.results.longitude}` : '#';
        
        htmlContent += `
            <div class="inspection-item">
                <div class="image-container">
                    <img src="${dataUrl}" alt="${img.file.name}">
                </div>
                <div class="details">
                    <div class="file-name">
                        <span>${img.file.name}</span>
                        ${img.results.lineName ? `<span style="font-size: 0.7em; color: #64748b; font-weight: normal;">Linha: <b>${img.results.lineName}</b></span>` : ''}
                    </div>

                    ${hasGeo ? `
                    <div class="geo-info">
                        <span>📍 <b>Localização:</b> ${img.results.latitude}, ${img.results.longitude}</span>
                        <a href="${mapsLink}" target="_blank" class="geo-link">Abrir no Google Maps ↗</a>
                    </div>
                    ` : ''}

                    <span class="badge ${img.results.safeToOperate ? 'badge-safe' : 'badge-danger'}">
                        ${img.results.safeToOperate ? 'Operação Segura' : 'Risco Detectado'}
                    </span>
                    
                    <div class="summary-text">"${img.results.summary}"</div>
                    
                    <div class="anomaly-list">
                        ${img.results.foundAnomalies.length > 0 ? 
                            img.results.foundAnomalies.map(a => `
                                <div class="anomaly-card" style="border-left-color: ${a.severity === Severity.CRITICAL || a.severity === Severity.HIGH ? '#ef4444' : '#f59e0b'}">
                                    <div>
                                        <span class="anomaly-type">${a.type}</span>
                                        <span class="anomaly-severity severity-${a.severity}">${a.severity}</span>
                                    </div>
                                    <div style="font-size: 0.9em; color: #64748b; margin-top: 5px;">${a.description}</div>
                                    ${a.location_hint ? `<div style="font-size: 0.8em; color: #94a3b8; margin-top: 2px;">Local na Imagem: ${a.location_hint}</div>` : ''}
                                </div>
                            `).join('') : 
                            '<p style="color: #16a34a; font-weight: 500;">✓ Nenhuma anomalia detectada nesta estrutura.</p>'
                        }
                    </div>
                </div>
            </div>
        `;
      }
    }

    htmlContent += `
            <div style="text-align: center; color: #94a3b8; font-size: 0.8em; margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                Relatório gerado automaticamente por DroneGuard AI
            </div>
        </div>
    </body>
    </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_Inspecao_Georeferenciado_${new Date().toISOString().split('T')[0]}.html`;
    link.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-slate-900">Inspeção de Rede Elétrica</h2>
            <p className="text-slate-500 mt-1">Carregue fotos de drones para detecção automatizada de anomalias.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total', value: stats.total, color: 'text-slate-700' },
                { label: 'Processadas', value: stats.processed, color: 'text-blue-600' },
                { label: 'Anomalias', value: stats.anomalies, color: 'text-orange-600' },
                { label: 'Críticos', value: stats.critical, color: 'text-red-600' },
              ].map((s, idx) => (
                <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm min-w-[90px] sm:min-w-[110px]">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {stats.processed > 0 && (
              <button 
                onClick={exportReport}
                disabled={isExporting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors shadow-sm"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                    Gerando...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Exportar Relatório Geo
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-20 z-40">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Upload Fotos
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              accept="image/*" 
              onChange={handleFileUpload}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              disabled={isProcessingAll || images.filter(i => i.status === 'pending' || i.status === 'error').length === 0}
              onClick={handleProcessAll}
              className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              {isProcessingAll ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                  Processando...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.3 1.047a1 1 0 01.897.95l1.135 11.773a1 1 0 01-1.118 1.09l-11.773-1.135a1 1 0 01-.897-.95l-1.135-11.773a1 1 0 011.118-1.09l11.773 1.135zM10.16 3.01l-7.792-.751.751 7.792 7.792.751-.751-7.792z" clipRule="evenodd" />
                  </svg>
                  Analisar Tudo
                </>
              )}
            </button>
            <button 
              onClick={clearAll}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-lg font-semibold transition-all"
            >
              Limpar
            </button>
          </div>
        </div>

        {images.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
            <div className="bg-slate-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800">Nenhuma imagem carregada</h3>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto">
              Selecione múltiplas fotos de inspeção para começar a identificar falhas estruturais com IA.
            </p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 inline-flex items-center text-blue-600 font-semibold hover:text-blue-700 underline underline-offset-4"
            >
              Selecionar arquivos agora
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map(img => (
              <InspectionCard key={img.id} image={img} />
            ))}
          </div>
        )}
      </main>

      <footer className="bg-slate-900 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">© 2024 DroneGuard Inspection Systems. Powered by Gemini AI.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
