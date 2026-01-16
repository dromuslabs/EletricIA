
import { InspectionImage, Severity } from "../types";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error("Erro no arquivo."));
    };
    reader.onerror = () => reject(new Error("Erro na leitura."));
    reader.readAsDataURL(file);
  });
}

export async function generateHtmlReport(images: InspectionImage[]): Promise<string> {
  // Apenas imagens completas e NÃO reprovadas
  const imagesForReport = images.filter(img => 
    img.status === 'completed' && img.results && img.userFeedback?.status !== 'rejected'
  );

  const totalAnomalies = imagesForReport.reduce((acc, img) => acc + (img.results?.foundAnomalies.length || 0), 0);
  const dateStr = new Date().toLocaleString('pt-BR');

  const cardPromises = imagesForReport.map(async img => {
    const res = img.results!;
    let base64Image = "";
    if (img.file) {
      try { base64Image = await fileToDataUrl(img.file); } catch (e) {}
    } else if (img.previewUrl.startsWith('data:image')) {
      base64Image = img.previewUrl;
    }

    const anomaliesHtml = `
      <table class="anomaly-table">
        <thead>
          <tr>
            <th>Componente</th>
            <th>Gravidade</th>
            <th>Descrição Técnica</th>
          </tr>
        </thead>
        <tbody>
          ${res.foundAnomalies.map(a => `
            <tr>
              <td><strong>${a.type}</strong></td>
              <td><span class="badge ${a.severity.toLowerCase()}">${a.severity}</span></td>
              <td>${a.description}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const locationInfo = res.latitude && res.longitude ? `
      <div class="loc-tag">
        <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2M12,4A5,5 0 0,1 17,9C17,12.42 12,18.1 12,18.1C12,18.1 7,12.42 7,9A5,5 0 0,1 12,4M12,6A3,3 0 0,0 9,9A3,3 0 0,0 12,12A3,3 0 0,0 15,9A3,3 0 0,0 12,6Z"/></svg>
        ${res.latitude}, ${res.longitude}
      </div>
    ` : '';

    return `
      <div class="card">
        <div class="card-header">
          <span>ORDEM DE INSPEÇÃO: ${img.id}</span>
          <span>LINHA: ${res.lineName || 'REDE DISTRIBUIÇÃO'}</span>
        </div>
        <div class="card-body">
          <div class="img-wrap">
            ${base64Image ? `<img src="${base64Image}" />` : `<div class="no-img">Referência Indisponível</div>`}
          </div>
          <div class="info">
            ${locationInfo}
            <div class="summary"><strong>PARECER IA:</strong> ${res.summary}</div>
            ${anomaliesHtml}
            <div class="feedback-box ${img.userFeedback?.status || 'none'}">
              <div class="feedback-header">
                <strong>VALIZAÇÃO DO INSPETOR:</strong> 
                <span class="fb-status">${img.userFeedback?.status === 'approved' ? 'APROVADO' : 'PENDENTE'}</span>
              </div>
              <p class="fb-comments">${img.userFeedback?.comments || 'Sem anotações complementares.'}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  const cardsHtml = (await Promise.all(cardPromises)).join('');

  // Coletar coordenadas para o mapa interativo no relatório
  const geoPoints = imagesForReport
    .filter(i => i.results?.latitude && i.results?.longitude)
    .map(i => ({
      lat: parseFloat(i.results?.latitude?.replace(/[^0-9.-]/g, '') || "0"),
      lng: parseFloat(i.results?.longitude?.replace(/[^0-9.-]/g, '') || "0"),
      id: i.id
    }));

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório DroneGuard AI - Inspeção</title>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1e293b; max-width: 1000px; margin: 40px auto; padding: 0 20px; background: #f1f5f9; }
        header { background: #020617; color: white; padding: 40px; border-radius: 20px; margin-bottom: 40px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 20px; margin-bottom: 40px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .card-header { background: #f8fafc; padding: 15px 25px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; border-bottom: 1px solid #e2e8f0; color: #64748b; }
        .img-wrap img { width: 100%; height: auto; max-height: 500px; object-fit: cover; display: block; }
        .info { padding: 30px; }
        .loc-tag { display: inline-flex; align-items: center; gap: 6px; background: #eff6ff; color: #1d4ed8; padding: 4px 10px; rounded: 6px; font-size: 10px; font-weight: 700; border-radius: 6px; margin-bottom: 15px; }
        .summary { font-size: 15px; margin-bottom: 25px; line-height: 1.6; color: #334155; }
        .anomaly-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 25px; }
        .anomaly-table th { text-align: left; border-bottom: 2px solid #f1f5f9; padding: 12px; color: #475569; }
        .anomaly-table td { padding: 12px; border-bottom: 1px solid #f8fafc; }
        .badge { font-size: 9px; padding: 3px 8px; border-radius: 6px; font-weight: bold; text-transform: uppercase; }
        .badge.crítico { color: #991b1b; background: #fee2e2; }
        .badge.alto { color: #9a3412; background: #ffedd5; }
        
        .feedback-box { padding: 20px; border-radius: 12px; font-size: 13px; margin-top: 20px; border: 1px solid #e2e8f0; }
        .feedback-box.approved { border-left: 6px solid #22c55e; background: #f0fdf4; }
        .feedback-box.none { border-left: 6px solid #94a3b8; background: #f8fafc; }
        .feedback-header { margin-bottom: 8px; font-size: 11px; color: #64748b; }
        .fb-status { font-weight: 900; color: #0f172a; margin-left: 5px; }
        .fb-comments { margin: 0; color: #475569; font-style: italic; }

        .map-section { margin-top: 60px; padding: 40px; background: white; border-radius: 20px; border: 1px solid #e2e8f0; }
        #report-map { height: 400px; width: 100%; border-radius: 12px; margin-top: 20px; }
        .map-title { font-size: 18px; font-weight: 900; color: #0f172a; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <header>
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="margin:0; font-size: 28px; letter-spacing: -0.02em;">Relatório Técnico de Inspeção</h1>
            <p style="opacity:0.6; font-size:13px; margin-top: 5px;">DroneGuard AI Network | Laudo Consolidado</p>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 900; font-size: 12px;">EMITIDO EM</div>
            <div style="font-size: 14px; opacity: 0.8;">${dateStr}</div>
          </div>
        </div>
        <div style="margin-top: 30px; display: flex; gap: 30px;">
          <div>
            <div style="font-size: 10px; font-weight: 800; opacity: 0.5; text-transform: uppercase;">Total Estruturas</div>
            <div style="font-size: 24px; font-weight: 900;">${imagesForReport.length}</div>
          </div>
          <div>
            <div style="font-size: 10px; font-weight: 800; opacity: 0.5; text-transform: uppercase;">Anomalias Detectadas</div>
            <div style="font-size: 24px; font-weight: 900;">${totalAnomalies}</div>
          </div>
        </div>
      </header>

      <div class="cards-container">
        ${cardsHtml}
      </div>

      <div class="map-section">
        <div class="map-title">Mapeamento Georreferenciado</div>
        <p style="font-size: 13px; color: #64748b;">Abaixo constam as marcações geográficas de todas as estruturas validadas nesta inspeção.</p>
        <div id="report-map"></div>
      </div>

      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const points = ${JSON.stringify(geoPoints)};
        const map = L.map('report-map', { scrollWheelZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        
        const markers = L.featureGroup();
        points.forEach(p => {
          const m = L.marker([p.lat, p.lng]).addTo(map).bindPopup('Estrutura #' + p.id);
          markers.addLayer(m);
        });
        
        if(points.length > 0) {
          map.fitBounds(markers.getBounds(), { padding: [30, 30] });
        } else {
          map.setView([0,0], 2);
        }
      </script>

      <footer style="margin-top: 80px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 40px; color: #94a3b8; font-size: 11px;">
        <p>© ${new Date().getFullYear()} DroneGuard AI System - Este documento é um relatório técnico automatizado assistido por Inteligência Artificial.</p>
      </footer>
    </body>
    </html>
  `;
}
