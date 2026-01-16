
export enum AnomalyType {
  INSULATOR = 'Isolador',
  CONDUCTOR = 'Condutor',
  STRUCTURE = 'Estrutura',
  VEGETATION = 'Vegetação',
  HARDWARE = 'Ferragem',
  OTHER = 'Outro'
}

export enum Severity {
  LOW = 'Baixo',
  MEDIUM = 'Médio',
  HIGH = 'Alto',
  CRITICAL = 'Crítico'
}

export interface Anomaly {
  type: string;
  description: string;
  severity: Severity;
  location_hint?: string;
  boundingBox?: [number, number, number, number];
}

export interface ApiSettings {
  mode: 'sdk' | 'custom';
  customEndpoint: string;
}

export interface UserFeedback {
  status?: 'approved' | 'rejected';
  comments?: string;
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
  userFeedback?: UserFeedback;
  error?: string;
}

export interface InspectionSummary {
  totalImages: number;
  anomaliesDetected: number;
  criticalIssues: number;
}
