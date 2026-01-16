
import React, { useState, useEffect, useRef } from 'react';
import { InspectionImage, Severity, UserFeedback } from '../types';

interface InspectionCardProps {
  image: InspectionImage;
  onRetry?: (img: InspectionImage) => void;
  onUpdateFeedback?: (feedback: UserFeedback) => void;
}

declare const L: any;

const InspectionCard: React.FC<InspectionCardProps> = ({ image, onRetry, onUpdateFeedback }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case Severity.CRITICAL: return 'text-red-500';
      case Severity.HIGH: return 'text-orange-500';
      case Severity.MEDIUM: return 'text-yellow-500';
      default: return 'text-zinc-500';
    }
  };

  const hasGeo = image.status === 'completed' && image.results?.latitude && image.results?.longitude;

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

  const handleStatusChange = (status: 'approved' | 'rejected') => {
    onUpdateFeedback?.({ 
      status: image.userFeedback?.status === status ? undefined : status 
    });
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateFeedback?.({ comments: e.target.value });
  };

  return (
    <div className={`bg-zinc-900/40 border rounded-[2rem] overflow-hidden transition-all duration-500 flex flex-col h-full group
      ${image.status === 'error' ? 'border-red-900/30' : 'border-zinc-800 hover:border-zinc-700'}
    `}>
      <div className="relative aspect-square bg-black overflow-hidden">
        {image.previewUrl ? (
          <img src={image.previewUrl} className={`w-full h-full object-cover transition-all duration-700 ${image.status === 'processing' ? 'opacity-20' : 'group-hover:scale-105'}`} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-800 text-[10px] font-black uppercase tracking-widest">Sem sinal</div>
        )}

        {image.status === 'completed' && image.results?.foundAnomalies.map((a, i) => (
          a.boundingBox && (
            <div key={i} className={`absolute border-2 transition-all ${expandedIndex === i ? 'border-blue-400 bg-blue-500/10 z-20 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-blue-500/30 bg-blue-500/5'}`}
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

            <div className="space-y-2">
              {image.results.foundAnomalies.slice(0, 2).map((a, i) => (
                <div key={i} onClick={() => setExpandedIndex(expandedIndex === i ? null : i)} className={`p-3 rounded-xl border transition-all cursor-pointer ${expandedIndex === i ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-950 border-zinc-900'}`}>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="text-zinc-200 truncate pr-2">{a.type}</span>
                    <span className={getSeverityColor(a.severity)}>{a.severity}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Human Curatorship Section */}
            <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <button 
                  onClick={() => handleStatusChange('approved')}
                  className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border
                    ${image.userFeedback?.status === 'approved' 
                      ? 'bg-green-500/20 border-green-500 text-green-400' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}
                >
                  Aprovar
                </button>
                <button 
                  onClick={() => handleStatusChange('rejected')}
                  className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border
                    ${image.userFeedback?.status === 'rejected' 
                      ? 'bg-red-500/20 border-red-500 text-red-400' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}
                >
                  Reprovar
                </button>
              </div>

              <textarea 
                value={image.userFeedback?.comments || ''}
                onChange={handleCommentChange}
                placeholder="Notas de inspeção manual..."
                className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300 placeholder:text-zinc-700 focus:border-zinc-600 focus:outline-none transition-all resize-none"
              />
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
  );
};

export default InspectionCard;
