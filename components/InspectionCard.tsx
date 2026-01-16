
import React, { useState, useEffect, useRef } from 'react';
import { InspectionImage, Severity, UserFeedback } from '../types';

interface InspectionCardProps {
  image: InspectionImage;
  onRetry?: (img: InspectionImage) => void;
  onUpdateFeedback?: (feedback: UserFeedback) => void;
}

declare const L: any;

const InspectionCard: React.FC<InspectionCardProps> = ({ image, onRetry, onUpdateFeedback }) => {
  const [showModal, setShowModal] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const modalMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const modalMapInstanceRef = useRef<any>(null);

  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case Severity.CRITICAL: return 'text-red-500';
      case Severity.HIGH: return 'text-orange-500';
      case Severity.MEDIUM: return 'text-yellow-500';
      default: return 'text-zinc-500';
    }
  };

  const hasGeo = image.status === 'completed' && image.results?.latitude && image.results?.longitude;

  // Mapa do Card (Miniatura)
  useEffect(() => {
    if (hasGeo && mapContainerRef.current && !mapInstanceRef.current && typeof L !== 'undefined') {
      const lat = parseFloat(image.results?.latitude?.replace(/[^0-9.-]/g, '') || "0");
      const lng = parseFloat(image.results?.longitude?.replace(/[^0-9.-]/g, '') || "0");

      if (!isNaN(lat) && !isNaN(lng)) {
        mapInstanceRef.current = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 13,
          zoomControl: false,
          attributionControl: false
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstanceRef.current);
        L.marker([lat, lng]).addTo(mapInstanceRef.current);
      }
    }
    return () => { if (mapInstanceRef.current) mapInstanceRef.current.remove(); mapInstanceRef.current = null; };
  }, [hasGeo, image.results]);

  // Mapa do Modal (Popup)
  useEffect(() => {
    if (showModal && hasGeo && modalMapRef.current && !modalMapInstanceRef.current && typeof L !== 'undefined') {
      const lat = parseFloat(image.results?.latitude?.replace(/[^0-9.-]/g, '') || "0");
      const lng = parseFloat(image.results?.longitude?.replace(/[^0-9.-]/g, '') || "0");

      if (!isNaN(lat) && !isNaN(lng)) {
        setTimeout(() => {
          if (!modalMapRef.current) return;
          modalMapInstanceRef.current = L.map(modalMapRef.current, {
            center: [lat, lng],
            zoom: 15,
            zoomControl: true,
            attributionControl: false
          });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(modalMapInstanceRef.current);
          L.marker([lat, lng]).addTo(modalMapInstanceRef.current);
        }, 100);
      }
    }
    return () => { if (modalMapInstanceRef.current) modalMapInstanceRef.current.remove(); modalMapInstanceRef.current = null; };
  }, [showModal, hasGeo, image.results]);

  const handleStatusChange = (status: 'approved' | 'rejected') => {
    onUpdateFeedback?.({ 
      status: image.userFeedback?.status === status ? undefined : status 
    });
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateFeedback?.({ comments: e.target.value });
  };

  return (
    <>
      <div className={`bg-zinc-900/40 border rounded-[2rem] overflow-hidden transition-all duration-500 flex flex-col h-full group
        ${image.status === 'error' ? 'border-red-900/30' : 'border-zinc-800 hover:border-zinc-700 shadow-lg hover:shadow-blue-500/5'}
      `}>
        {/* Imagem Clickável */}
        <div 
          onClick={() => image.status === 'completed' && setShowModal(true)}
          className={`relative aspect-square bg-black overflow-hidden ${image.status === 'completed' ? 'cursor-zoom-in' : ''}`}
        >
          {image.previewUrl ? (
            <img src={image.previewUrl} className={`w-full h-full object-cover transition-all duration-700 ${image.status === 'processing' ? 'opacity-20' : 'group-hover:scale-110'}`} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-800 text-[10px] font-black uppercase tracking-widest">Sem sinal</div>
          )}

          {/* Overlay de Hover para analisadas */}
          {image.status === 'completed' && (
            <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
               <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-full">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
               </div>
            </div>
          )}

          {image.status === 'completed' && image.results?.foundAnomalies.map((a, i) => (
            a.boundingBox && (
              <div key={i} className="absolute border-2 border-blue-500/30 bg-blue-500/5 pointer-events-none"
                style={{ top: `${a.boundingBox[0] / 10}%`, left: `${a.boundingBox[1] / 10}%`, width: `${(a.boundingBox[3] - a.boundingBox[1]) / 10}%`, height: `${(a.boundingBox[2] - a.boundingBox[0]) / 10}%` }}
              />
            )
          ))}
          {image.status === 'processing' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        <div className="p-6 flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] font-mono text-zinc-600 font-bold">#ID-{image.id}</span>
            <div className={`h-2 w-2 rounded-full ${image.status === 'completed' ? 'bg-blue-500' : image.status === 'error' ? 'bg-red-500' : 'bg-zinc-700'}`}></div>
          </div>

          {image.status === 'completed' && image.results && (
            <div className="space-y-4 flex-1 flex flex-col">
              <p className="text-xs text-zinc-400 leading-relaxed font-medium line-clamp-2">{image.results.summary}</p>
              
              <div className="flex gap-2">
                 <div className="px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-[9px] font-black uppercase text-zinc-500 tracking-tighter">
                    {image.results.foundAnomalies.length} Anomalias
                 </div>
                 {image.userFeedback?.status === 'approved' && (
                   <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-lg text-[9px] font-black uppercase text-green-400 tracking-tighter">
                      Validado
                   </div>
                 )}
              </div>

              <div className="mt-auto pt-4 border-t border-zinc-800">
                <button 
                  onClick={() => setShowModal(true)}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-zinc-800 transition-all"
                >
                  Ver Laudo Completo
                </button>
              </div>
            </div>
          )}

          {image.status === 'error' && (
            <div className="flex-1">
               <p className="text-red-400 text-[10px] font-medium leading-relaxed mb-4">{image.error}</p>
               <button onClick={() => onRetry?.(image)} className="text-[10px] font-black text-white uppercase tracking-widest hover:text-blue-400">Re-Analisar</button>
            </div>
          )}
        </div>
      </div>

      {/* Modal / Popup Detalhado */}
      {showModal && image.results && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowModal(false)}></div>
          
          <div className="relative bg-zinc-950 border border-zinc-800 w-full max-w-6xl max-h-[90vh] rounded-[3rem] overflow-hidden flex flex-col md:flex-row shadow-2xl">
            {/* Esquerda: Imagem */}
            <div className="md:w-3/5 relative bg-black flex items-center justify-center overflow-hidden">
              <img src={image.previewUrl} className="max-w-full max-h-full object-contain" />
              
              {/* Bounding Boxes no Modal */}
              {image.results.foundAnomalies.map((a, i) => (
                a.boundingBox && (
                  <div 
                    key={i} 
                    className={`absolute border-2 transition-all ${expandedIndex === i ? 'border-blue-400 bg-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.5)] scale-105 z-10' : 'border-blue-500/40 bg-blue-500/5'}`}
                    style={{ top: `${a.boundingBox[0] / 10}%`, left: `${a.boundingBox[1] / 10}%`, width: `${(a.boundingBox[3] - a.boundingBox[1]) / 10}%`, height: `${(a.boundingBox[2] - a.boundingBox[0]) / 10}%` }}
                  >
                    {expandedIndex === i && (
                      <span className="absolute -top-6 left-0 bg-blue-500 text-white text-[8px] font-black px-2 py-1 rounded-t-lg whitespace-nowrap uppercase tracking-widest">
                        {a.type} - {a.severity}
                      </span>
                    )}
                  </div>
                )
              ))}
            </div>

            {/* Direita: Dados */}
            <div className="md:w-2/5 p-8 md:p-12 overflow-y-auto border-t md:border-t-0 md:border-l border-zinc-800 flex flex-col">
              <div className="flex justify-between items-start mb-10">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Análise Técnica</h3>
                  <p className="text-[10px] text-zinc-500 font-bold font-mono tracking-widest uppercase">Protocolo: #ID-{image.id}</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-8 flex-1">
                <div className="space-y-4">
                   <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Sumário Executivo</p>
                   <p className="text-zinc-100 text-sm leading-relaxed font-medium italic">{image.results.summary}</p>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Anomalias Identificadas ({image.results.foundAnomalies.length})</p>
                  <div className="space-y-3">
                    {image.results.foundAnomalies.map((a, i) => (
                      <div 
                        key={i} 
                        onMouseEnter={() => setExpandedIndex(i)}
                        onMouseLeave={() => setExpandedIndex(null)}
                        className={`p-4 rounded-2xl border transition-all ${expandedIndex === i ? 'bg-zinc-800 border-blue-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-black text-white uppercase tracking-tight">{a.type}</span>
                          <span className={`${getSeverityColor(a.severity)} text-[9px] font-black uppercase tracking-widest`}>{a.severity}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-snug">{a.description}</p>
                        {a.location_hint && <p className="mt-2 text-[9px] text-blue-500/60 font-medium">Ref: {a.location_hint}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {hasGeo && (
                  <div className="space-y-4">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Localização Geográfica</p>
                    <div ref={modalMapRef} className="h-32 w-full rounded-2xl grayscale brightness-75 border border-zinc-800" />
                    <p className="text-[9px] font-mono text-zinc-600">Coordenadas: {image.results.latitude}, {image.results.longitude}</p>
                  </div>
                )}

                <div className="space-y-4 pb-12">
                   <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Curadoria Humana</p>
                   <div className="flex gap-4">
                      <button 
                        onClick={() => handleStatusChange('approved')}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border
                          ${image.userFeedback?.status === 'approved' ? 'bg-green-500 text-black border-green-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                      >
                        Aprovar
                      </button>
                      <button 
                        onClick={() => handleStatusChange('rejected')}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border
                          ${image.userFeedback?.status === 'rejected' ? 'bg-red-500 text-black border-red-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                      >
                        Reprovar
                      </button>
                   </div>
                   <textarea 
                      value={image.userFeedback?.comments || ''}
                      onChange={handleCommentChange}
                      placeholder="Adicione observações técnicas manuais aqui..."
                      className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-200 focus:border-blue-500/50 outline-none transition-all resize-none"
                   />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InspectionCard;
