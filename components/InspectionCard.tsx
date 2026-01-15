
import React, { useState } from 'react';
import { InspectionImage, Severity, Anomaly } from '../types';

interface InspectionCardProps {
  image: InspectionImage;
}

const InspectionCard: React.FC<InspectionCardProps> = ({ image }) => {
  const [hoveredAnomaly, setHoveredAnomaly] = useState<Anomaly | null>(null);

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow group relative">
      <div className="relative h-56 w-full bg-slate-100 overflow-hidden">
        {isFromHistory ? (
          <div className="h-full w-full flex flex-col items-center justify-center bg-slate-200 text-slate-400 p-4 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">Histórico</span>
            <span className="text-[8px] mt-1 leading-tight">Foto indisponível na sessão atual</span>
          </div>
        ) : (
          <img 
            src={image.previewUrl} 
            alt="Inspection thumbnail" 
            className="h-full w-full object-cover"
          />
        )}
        
        {/* Visual Markers Layer */}
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
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-30">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                📍 GPS
              </span>
            )}
          </div>
        )}

        {image.status === 'completed' && image.results?.foundAnomalies.length === 0 && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-2 py-1 rounded-full font-bold uppercase shadow-sm z-30">
            OK
          </div>
        )}
        
        {image.status === 'completed' && (image.results?.foundAnomalies.length || 0) > 0 && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-2 py-1 rounded-full font-bold uppercase shadow-sm z-30">
            {image.results?.foundAnomalies.length} Anomalia(s)
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-sm font-semibold text-slate-800 truncate mb-1">
          {image.id.toUpperCase()}
        </h3>
        
        {image.status === 'pending' && (
          <p className="text-xs text-slate-500 italic">Aguardando...</p>
        )}
        
        {image.status === 'error' && (
          <p className="text-[10px] leading-tight text-red-600 bg-red-50 p-1.5 rounded border border-red-100">{image.error || 'Erro no processamento'}</p>
        )}

        {image.status === 'completed' && image.results && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-600 line-clamp-2 italic border-l-2 border-slate-200 pl-2 leading-snug">
              "{image.results.summary}"
            </p>
            
            <div className="space-y-1.5">
              {image.results.foundAnomalies.slice(0, 3).map((anomaly, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-start justify-between gap-2 p-1 rounded transition-colors
                    ${hoveredAnomaly === anomaly ? 'bg-slate-50' : ''}
                  `}
                  onMouseEnter={() => setHoveredAnomaly(anomaly)}
                  onMouseLeave={() => setHoveredAnomaly(null)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-slate-700 truncate">
                      {anomaly.type}
                    </p>
                  </div>
                  <span className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase shrink-0 ${getSeverityColor(anomaly.severity)}`}>
                    {anomaly.severity}
                  </span>
                </div>
              ))}
              {image.results.foundAnomalies.length > 3 && (
                <p className="text-[9px] text-slate-400 font-medium text-center">+{image.results.foundAnomalies.length - 3} itens não listados</p>
              )}
            </div>
            
            <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between">
              {hasGeo ? (
                <a 
                  href={`https://www.google.com/maps?q=${image.results.latitude},${image.results.longitude}`} 
                  target="_blank"
                  className="text-blue-600 hover:text-blue-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                >
                  Ver Mapa
                </a>
              ) : (
                <span className="text-slate-300 text-[9px] uppercase font-bold">Sem Localização</span>
              )}
              {isFromHistory && (
                <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">HISTÓRICO</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InspectionCard;
