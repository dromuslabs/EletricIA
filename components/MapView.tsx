
import React, { useEffect, useRef } from 'react';
import { InspectionImage } from '../types';

interface MapViewProps {
  images: InspectionImage[];
}

declare const L: any;

const MapView: React.FC<MapViewProps> = ({ images }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current || typeof L === 'undefined') return;

    // Localizar pontos válidos
    const points = images
      .filter(img => img.results?.latitude && img.results?.longitude)
      .map(img => ({
        id: img.id,
        summary: img.results?.summary,
        status: img.userFeedback?.status,
        lat: parseFloat(img.results?.latitude?.replace(/[^0-9.-]/g, '') || "0"),
        lng: parseFloat(img.results?.longitude?.replace(/[^0-9.-]/g, '') || "0"),
        preview: img.previewUrl
      }))
      .filter(p => !isNaN(p.lat) && !isNaN(p.lng));

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstanceRef.current);
    }

    // Limpar marcadores anteriores
    mapInstanceRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });

    if (points.length > 0) {
      const markers = L.featureGroup();
      
      points.forEach(p => {
        const color = p.status === 'approved' ? '#3b82f6' : '#71717a';
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: 8,
          fillColor: color,
          color: '#000',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(mapInstanceRef.current);

        marker.bindPopup(`
          <div style="font-family: Inter, sans-serif; background: #000; color: #fff; border-radius: 12px; overflow: hidden; min-width: 200px;">
            <img src="${p.preview}" style="width: 100%; height: 120px; object-cover: center;" />
            <div style="padding: 12px;">
              <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: ${color}; margin-bottom: 4px;">ESTRUTURA #${p.id}</div>
              <div style="font-size: 11px; color: #a1a1aa; line-height: 1.4;">${p.summary}</div>
            </div>
          </div>
        `, {
          className: 'grok-popup',
          backgroundColor: 'transparent',
          border: 'none'
        });

        markers.addLayer(marker);
      });

      mapInstanceRef.current.fitBounds(markers.getBounds(), { padding: [50, 50] });
    } else {
      mapInstanceRef.current.setView([0, 0], 2);
    }

    return () => {
      // Not cleaning up instance to keep view state between renders if needed, 
      // but cleaning up markers is done above.
    };
  }, [images]);

  return (
    <div className="relative w-full h-full group">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute bottom-8 left-8 z-10 bg-zinc-950/80 border border-zinc-800 p-6 rounded-3xl backdrop-blur-xl max-w-xs animate-in slide-in-from-left-4">
        <h4 className="text-white font-black uppercase italic tracking-tighter text-lg mb-2">Visão Geoespacial</h4>
        <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">
          Exibindo {images.length} pontos de rede validados. Clique nos marcadores para detalhes técnicos.
        </p>
      </div>
      
      {/* Estilo Custom para Popup */}
      <style>{`
        .leaflet-popup-content-wrapper { background: black !important; border: 1px solid #27272a !important; border-radius: 16px !important; padding: 0 !important; }
        .leaflet-popup-content { margin: 0 !important; }
        .leaflet-popup-tip { background: black !important; border: 1px solid #27272a !important; }
      `}</style>
    </div>
  );
};

export default MapView;
