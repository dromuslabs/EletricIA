
import React, { useState, useEffect, useRef } from 'react';
import { InspectionImage, Severity, Anomaly } from '../types';

interface InspectionCardProps {
  image: InspectionImage;
  onRetry?: (id: string) => void;
}

declare const L: any; // Global Leaflet object from CDN

const InspectionCard: React.FC<InspectionCardProps> = ({ image, onRetry }) => {
  const [hoveredAnomaly, setHoveredAnomaly] = useState<Anomaly | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case Severity.LOW: return 'bg-blue-100 text-blue-800 border-blue-400';
      case Severity.MEDIUM: return 'bg-yellow-100 text-yellow-800 border-yellow-400';
      case Severity.HIGH: return 'bg-orange-100 text-orange-800 border-orange-400';
      case Severity.CRITICAL: return 'bg-red-100 text-red-800 border-red-400';
      default: return 'bg-gray-100 text-gray-800 border-gray-400';
    }
  };

  const getMarkerStyle = (box: [number, number, number, number]) => {
    const [ymin, xmin, ymax, xmax] = box;
    return {
      top: `${ymin / 10}%`,
      left: `${xmin / 10}%`,
      width: `${(xmax - xmin) / 10}%`,
      height: `${(ymax - ymin) / 10}%`,
    };
  };

  const hasGeo = image.status === 'completed' && image.results?.latitude && image.results?.longitude;
  const isFromHistory = !image.file && !image.previewUrl;

  useEffect(() => {
    if (hasGeo && mapContainerRef.current && !mapInstanceRef.current) {
      const lat = parseFloat(image.results!.latitude!);
      const lng = parseFloat(image.results!.longitude!);

      if (!isNaN(lat) && !isNaN(lng)) {
        mapInstanceRef.current = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 15,
          zoomControl: false,
          scrollWheelZoom: false,
          dragging: true,
          attributionControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstanceRef.current);
        const marker = L.marker([lat, lng]).addTo(mapInstanceRef.current);
        marker.bindPopup(`<b>${image.results?.lineName || 'Inspeção'}</b><br>${image.id}`);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [hasGeo, image.results, image.id]);

  return (
    <div className={`bg-white rounded-xl shadow-sm border transition-all duration-300 overflow-hidden flex flex-col hover:shadow-md group relative
      ${image.status === 'error' ? 'border-red-200 bg-red-50/10' : 'border-slate-200'}
    `}>
      <div className="relative h-56 w-full bg-slate-100 overflow-hidden">
        {isFromHistory ? (
          <div className="h-full w-full flex flex-col items-center justify-center bg-slate-200 text-slate-400 p-4 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Histórico</span>
            <span className="text-[8px] mt-1 leading-tight">Foto indisponível</span>
          </div>
        ) : (
          <img 
            src={image.previewUrl} 
            alt="Inspection" 
            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${image.status === 'processing' ? 'blur-sm grayscale' : ''}`}
          />
        )}
        
        {/* Camada de Marcações de IA */}
        {!isFromHistory && image.status === 'completed' && image.results?.foundAnomalies.map((anomaly, idx) => (
          anomaly.boundingBox && (
            <div
              key={idx}
              className={`absolute border-2 border-dashed transition-all duration-200 pointer-events-none
                ${hoveredAnomaly === anomaly ? 'bg-red-500/20 scale-105 border-red-500 z-20' : 'bg-transparent border-red-400/60 z-10'}
              `}
              style={getMarkerStyle(anomaly.boundingBox)}
            >
              <div className={`absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[8px] font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity
                ${anomaly.severity === Severity.CRITICAL || anomaly.severity === Severity.HIGH ? 'bg-red-600' : 'bg-orange-500'}
              `}>
                {anomaly.type}
              </div>
            </div>
          )
        ))}

        {image.status === 'processing' && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-30">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-400 border-t-transparent mb-2"></div>
            <span className="text-white text-[10px] font-bold uppercase tracking-widest animate-pulse">Analisando...</span>
          </div>
        )}
        
        {image.status === 'completed' && (
          <div className="absolute bottom-2 left-2 flex gap-1 z-30">
            {image.results?.lineName && (
              <span className="bg-slate-900/80 text-white text-[9px] px-1.5 py-0.5 rounded font-medium backdrop-blur-sm">
                {image.results.lineName}
              </span>
            )}
            {hasGeo && (
              <span className="bg-blue-600/80 text-white text-[9px] px-1.5 py-0.5 rounded font-medium backdrop-blur-sm flex items-center gap-1">
                📍 GPS Ativo
              </span>
            )}
          </div>
        )}

        {image.status === 'completed' && (
          <div className={`absolute top-2 right-2 text-white text-[10px] px-2 py-1 rounded-full font-bold uppercase shadow-lg z-30 
            ${(image.results?.foundAnomalies.length || 0) > 0 ? 'bg-red-600' : 'bg-green-600'}`}>
            {(image.results?.foundAnomalies.length || 0) > 0 ? `${image.results?.foundAnomalies.length} Falhas` : 'Normal'}
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-sm font-bold text-slate-800 truncate mb-1 flex items-center justify-between">
          {image.id.toUpperCase()}
          {image.status === 'error' && (
            <button 
              onClick={() => onRetry?.(image.id)}
              className="text-blue-600 text-[10px] font-bold hover:underline"
            >
              Reprocessar
            </button>
          )}
        </h3>
        
        {image.status === 'pending' && <p className="text-xs text-slate-400 italic">Aguardando início...</p>}
        
        {image.status === 'error' && (
          <div className="mt-1">
            <p className="text-[11px] leading-tight text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 font-medium">
              {image.error || 'Erro inesperado na análise da imagem.'}
            </p>
          </div>
        )}

        {image.status === 'completed' && image.results && (
          <div className="space-y-3 flex-1 flex flex-col">
            <p className="text-[11px] text-slate-600 line-clamp-2 italic border-l-2 border-blue-200 pl-2 leading-snug">
              "{image.results.summary}"
            </p>
            
            <div className="space-y-1.5">
              {image.results.foundAnomalies.slice(0, 3).map((anomaly, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-start justify-between gap-2 p-1.5 rounded-lg transition-colors
                    ${hoveredAnomaly === anomaly ? 'bg-slate-100' : 'bg-slate-50'}
                  `}
                  onMouseEnter={() => setHoveredAnomaly(anomaly)}
                  onMouseLeave={() => setHoveredAnomaly(null)}
                >
                  <p className="text-[10px] font-bold text-slate-700 truncate flex-1">{anomaly.type}</p>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase shrink-0 ${getSeverityColor(anomaly.severity)}`}>
                    {anomaly.severity}
                  </span>
                </div>
              ))}
              {image.results.foundAnomalies.length > 3 && (
                <p className="text-[9px] text-slate-400 font-bold text-center uppercase tracking-tight">+{image.results.foundAnomalies.length - 3} itens detectados</p>
              )}
            </div>
            
            <div className="mt-auto pt-3 border-t border-slate-100">
              {hasGeo ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">MAPA DE CAMPO</span>
                    <a 
                      href={`https://www.google.com/maps?q=${image.results.latitude},${image.results.longitude}`} 
                      target="_blank"
                      className="text-blue-600 text-[10px] font-bold hover:underline"
                    >
                      Ver GPS ↗
                    </a>
                  </div>
                  <div ref={mapContainerRef} className="h-28 w-full rounded-xl border border-slate-200 shadow-inner bg-slate-50 overflow-hidden" />
                </div>
              ) : (
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-300 text-[9px] uppercase font-black tracking-widest">Sem Coordenadas</span>
                  {isFromHistory && <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">DB</span>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InspectionCard;
