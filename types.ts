
export enum AnomalyType {
  LOOSE_CABLE = 'Cabo Solto',
  LOOSE_BOLT = 'Parafuso Solto',
  CRACK = 'Trinca/Rachadura',
  CORROSION = 'Corrosão',
  OTHER = 'Outro'
}

export enum Severity {
  LOW = 'Baixo',
  MEDIUM = 'Médio',
  HIGH = 'Alto',
  CRITICAL = 'Crítico'
}

export interface Anomaly {
  type: AnomalyType;
  description: string;
  severity: Severity;
  location_hint?: string;
  boundingBox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
}

export interface ApiSettings {
  mode: 'sdk' | 'custom';
  customEndpoint: string;
}

export interface InspectionImage {
  id: string;
  file?: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  results?: {
    foundAnomalies: Anomaly[];
    summary: string;
    safeToOperate: boolean;
    latitude?: string;
    longitude?: string;
    lineName?: string;
  };
  error?: string;
}

export interface InspectionSummary {
  totalImages: number;
  anomaliesDetected: number;
  criticalIssues: number;
}
