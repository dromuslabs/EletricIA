
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
  const imagesWithAnomalies = images.filter(img => 
    img.status === 'completed' && img.results
  );

  const totalAnomalies = imagesWithAnomalies.reduce((acc, img) => acc + (img.results?.foundAnomalies.length || 0), 0);
  const dateStr = new Date().toLocaleString('pt-BR');

  const cardPromises = imagesWithAnomalies.map(async img => {
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

    const feedbackHtml = `
      <div class="feedback-box ${img.userFeedback?.status || 'none'}">
        <div class="feedback-header">
          <strong>PARECER DO INSPETOR:</strong> 
          <span class="fb-status">${img.userFeedback?.status === 'approved' ? 'VALIDADO' : img.userFeedback?.status === 'rejected' ? 'REPROVADO' : 'NÃO REVISADO'}</span>
        </div>
        <p class="fb-comments">${img.userFeedback?.comments || 'Sem observações adicionais.'}</p>
      </div>
    `;

    return `
      <div class="card">
        <div class="card-header">
          <span>ORDEM: ${img.id}</span>
          <span>LINHA: ${res.lineName || 'N/A'}</span>
        </div>
        <div class="card-body">
          <div class="img-wrap">
            ${base64Image ? `<img src="${base64Image}" />` : `<div class="no-img">Referência Omitida</div>`}
          </div>
          <div class="info">
            <div class="summary"><strong>PARECER IA:</strong> ${res.summary}</div>
            ${anomaliesHtml}
            ${feedbackHtml}
          </div>
        </div>
      </div>
    `;
  });

  const cardsHtml = (await Promise.all(cardPromises)).join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório DroneGuard AI</title>
      <style>
        body { font-family: 'Inter', sans-serif; color: #1a202c; max-width: 900px; margin: 40px auto; padding: 0 20px; background: #f8fafc; }
        header { background: #000; color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 30px; overflow: hidden; }
        .card-header { background: #f1f5f9; padding: 10px 20px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; }
        .img-wrap img { width: 100%; height: auto; display: block; }
        .info { padding: 25px; }
        .summary { font-size: 14px; margin-bottom: 20px; color: #334155; }
        .anomaly-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
        .anomaly-table th { text-align: left; border-bottom: 1px solid #e2e8f0; padding: 8px; color: #64748b; }
        .anomaly-table td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
        .badge { font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
        .badge.crítico { color: #dc2626; background: #fee2e2; }
        
        .feedback-box { padding: 15px; border-radius: 8px; font-size: 12px; margin-top: 15px; border-left: 4px solid #cbd5e1; background: #f8fafc; }
        .feedback-box.approved { border-left-color: #22c55e; background: #f0fdf4; }
        .feedback-box.rejected { border-left-color: #ef4444; background: #fef2f2; }
        .feedback-header { margin-bottom: 5px; font-size: 11px; }
        .fb-status { font-weight: 900; margin-left: 5px; }
        .fb-comments { margin: 0; color: #475569; font-style: italic; }
      </style>
    </head>
    <body>
      <header>
        <h1 style="margin:0">Relatório de Inspeção Técnica</h1>
        <p style="opacity:0.6; font-size:12px">Total de anomalias: ${totalAnomalies} | Emitido em: ${dateStr}</p>
      </header>
      ${cardsHtml}
    </body>
    </html>
  `;
}
