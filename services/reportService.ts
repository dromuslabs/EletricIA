
import { InspectionImage, Severity } from "../types";

export function generateHtmlReport(images: InspectionImage[]): string {
  const completed = images.filter(img => img.status === 'completed');
  const totalAnomalies = completed.reduce((acc, img) => acc + (img.results?.foundAnomalies.length || 0), 0);
  const criticalCount = completed.reduce((acc, img) => 
    acc + (img.results?.foundAnomalies.filter(a => a.severity === Severity.CRITICAL || a.severity === Severity.HIGH).length || 0), 0
  );

  const dateStr = new Date().toLocaleString('pt-BR');

  const rows = images.map(img => {
    const res = img.results;
    const anomaliesHtml = res?.foundAnomalies.length 
      ? `
        <table class="anomaly-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Severidade</th>
              <th>Descrição</th>
            </tr>
          </thead>
          <tbody>
            ${res.foundAnomalies.map(a => `
              <tr>
                <td>${a.type}</td>
                <td><span class="badge ${a.severity.toLowerCase()}">${a.severity}</span></td>
                <td>${a.description}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` 
      : '<p class="no-anomalies">Nenhuma anomalia detectada.</p>';

    return `
      <div class="card">
        <div class="card-header">
          <h3>Inspeção: ${img.id.toUpperCase()}</h3>
          <span class="status-badge ${img.status}">${img.status.toUpperCase()}</span>
        </div>
        <div class="card-body">
          <div class="metadata">
            <p><strong>Linha:</strong> ${res?.lineName || 'N/A'}</p>
            <p><strong>Seguro p/ Operar:</strong> ${res ? (res.safeToOperate ? '✅ Sim' : '❌ Não') : 'N/A'}</p>
            <p><strong>GPS:</strong> ${res?.latitude ? `${res.latitude}, ${res.longitude}` : 'N/A'}</p>
          </div>
          <p class="summary"><strong>Resumo Técnico:</strong> ${res?.summary || img.error || 'Sem dados'}</p>
          ${img.status === 'completed' ? anomaliesHtml : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório de Inspeção - DroneGuard AI</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; max-width: 1000px; margin: 0 auto; padding: 40px 20px; background: #f8fafc; }
        .header { background: #0f172a; color: white; padding: 30px; border-radius: 16px; margin-bottom: 40px; }
        .header h1 { margin: 0; font-size: 28px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px; }
        .stat-item { background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; text-align: center; }
        .stat-item span { display: block; font-size: 24px; font-weight: bold; }
        .stat-label { font-size: 12px; text-transform: uppercase; opacity: 0.8; }
        
        .card { background: white; border: 1px border #e2e8f0; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
        .card-header { background: #f1f5f9; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; }
        .card-header h3 { margin: 0; font-size: 16px; color: #1e293b; }
        .card-body { padding: 20px; }
        
        .metadata { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px; font-size: 13px; }
        .summary { background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6; font-style: italic; margin-bottom: 20px; }
        
        .anomaly-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .anomaly-table th { text-align: left; background: #f8fafc; padding: 10px; border-bottom: 2px solid #e2e8f0; }
        .anomaly-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; }
        
        .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
        .badge.crítico { background: #fee2e2; color: #991b1b; }
        .badge.alto { background: #ffedd5; color: #9a3412; }
        .badge.médio { background: #fef9c3; color: #854d0e; }
        .badge.baixo { background: #dbeafe; color: #1e40af; }
        
        .status-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
        .status-badge.completed { background: #dcfce7; color: #166534; }
        .status-badge.error { background: #fee2e2; color: #991b1b; }
        .status-badge.pending { background: #f1f5f9; color: #475569; }
        
        .no-anomalies { color: #22c55e; font-weight: bold; font-size: 13px; }
        .footer { text-align: center; margin-top: 60px; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Relatório Técnico de Inspeção</h1>
        <p>Gerado em: ${dateStr} | DroneGuard AI Systems</p>
        <div class="stats">
          <div class="stat-item">
            <span class="stat-label">Total Imagens</span>
            <span>${images.length}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Anomalias Detectadas</span>
            <span>${totalAnomalies}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Riscos Críticos</span>
            <span style="color: #ef4444">${criticalCount}</span>
          </div>
        </div>
      </div>

      ${rows}

      <div class="footer">
        Este documento é uma exportação automatizada do sistema DroneGuard AI.<br>
        As análises são baseadas em modelos de inteligência artificial e devem ser validadas em campo se necessário.
      </div>
    </body>
    </html>
  `;
}
