
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnomalyType, Severity, Anomaly, ApiSettings } from "../types";

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    foundAnomalies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { 
            type: Type.STRING,
            description: "Tipo de falha: Cabo Solto, Parafuso Solto, Trinca/Rachadura, Corrosão, ou Outro"
          },
          description: { 
            type: Type.STRING,
            description: "Descrição detalhada do defeito encontrado"
          },
          severity: { 
            type: Type.STRING, 
            description: "Nível: Baixo, Médio, Alto, Crítico"
          },
          boundingBox: {
            type: Type.ARRAY,
            description: "Coordenadas [ymin, xmin, ymax, xmax] escala 0-1000",
            items: { type: Type.NUMBER },
          }
        },
        required: ["type", "description", "severity", "boundingBox"]
      }
    },
    summary: { type: Type.STRING, description: "Parecer técnico geral sobre a estrutura analisada" },
    safeToOperate: { type: Type.BOOLEAN, description: "A estrutura apresenta risco imediato?" },
    latitude: { type: Type.STRING, description: "Latitude encontrada nos metadados ou estimada" },
    longitude: { type: Type.STRING, description: "Longitude encontrada nos metadados ou estimada" },
    lineName: { type: Type.STRING, description: "Identificação da linha ou torre" }
  },
  required: ["foundAnomalies", "summary", "safeToOperate"]
};

/**
 * Limpa a string de resposta da IA para garantir que seja um JSON válido
 */
function cleanJsonResponse(text: string): string {
  // Remove blocos de código markdown se existirem
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  // Busca o primeiro '{' e o último '}' para isolar o objeto
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

export async function analyzeInspectionImage(
  base64Data: string, 
  mimeType: string, 
  settings: ApiSettings = { mode: 'sdk', customEndpoint: '' }
) {
  if (settings.mode === 'custom' && settings.customEndpoint) {
    const response = await fetch(settings.customEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Data, mimeType })
    });
    if (!response.ok) throw new Error(`Erro na API Customizada: ${response.status}`);
    return response.json();
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: "Aja como um engenheiro especialista em manutenção de redes de alta tensão. Analise esta foto de drone e identifique defeitos estruturais ou elétricos. Retorne os dados estritamente em formato JSON conforme o schema definido." },
          { inlineData: { data: base64Data, mimeType } }
        ]
      },
      config: {
        systemInstruction: "Você é um sistema crítico de detecção de falhas em infraestrutura elétrica. Sua precisão salva vidas e evita apagões. Forneça análises frias, técnicas e baseadas em evidências visuais. Se não houver coordenadas geográficas, retorne strings vazias para latitude/longitude.",
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
      }
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("A IA não gerou candidatos de resposta. Tente uma imagem com melhor iluminação.");
    }

    const candidate = response.candidates[0];
    if (candidate.finishReason === 'SAFETY') {
      throw new Error("A análise foi interrompida por filtros de segurança. Certifique-se de que a imagem é puramente técnica.");
    }

    const rawText = response.text;
    if (!rawText) throw new Error("A resposta da IA veio vazia.");

    try {
      const cleanedJson = cleanJsonResponse(rawText);
      return JSON.parse(cleanedJson);
    } catch (e) {
      console.error("Falha no parse do JSON:", rawText);
      throw new Error("A IA retornou dados em um formato inválido. Tente novamente.");
    }
  } catch (error: any) {
    console.error("Erro na integração Gemini:", error);
    
    // Tratamento de erros comuns de cota ou rede
    if (error.message?.includes('429')) {
      throw new Error("Limite de requisições da API atingido. Aguarde 60 segundos antes de processar novas fotos.");
    }
    if (error.message?.includes('fetch')) {
      throw new Error("Erro de conexão com o servidor da Google AI. Verifique sua internet.");
    }
    
    throw new Error(error.message || "Erro desconhecido durante o processamento da imagem.");
  }
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) reject(new Error("Não foi possível converter o arquivo para base64."));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo de imagem."));
  });
}
