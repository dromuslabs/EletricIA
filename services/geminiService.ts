
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnomalyType, Severity, Anomaly } from "../types";

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
            description: "O tipo de anomalia encontrada (Cabo Solto, Parafuso Solto, Trinca/Rachadura, Corrosão, Outro)",
          },
          description: {
            type: Type.STRING,
            description: "Descrição detalhada do problema.",
          },
          severity: {
            type: Type.STRING,
            description: "Gravidade do problema (Baixo, Médio, Alto, Crítico).",
          },
          location_hint: {
            type: Type.STRING,
            description: "Dica de onde na foto o problema está localizado.",
          },
          boundingBox: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Coordenadas [ymin, xmin, ymax, xmax] normalizadas de 0 a 1000 que delimitam a anomalia.",
          }
        },
        required: ["type", "description", "severity", "boundingBox"]
      }
    },
    summary: {
      type: Type.STRING,
      description: "Um resumo geral da condição da estrutura mostrada nesta foto.",
    },
    safeToOperate: {
      type: Type.BOOLEAN,
      description: "Se a estrutura parece segura para operação imediata.",
    },
    latitude: {
      type: Type.STRING,
      description: "Latitude extraída da legenda da imagem (se disponível). Ex: -23.5505",
    },
    longitude: {
      type: Type.STRING,
      description: "Longitude extraída da legenda da imagem (se disponível). Ex: -46.6333",
    },
    lineName: {
      type: Type.STRING,
      description: "Nome ou identificação da linha de transmissão extraído da imagem.",
    }
  },
  required: ["foundAnomalies", "summary", "safeToOperate"]
};

/**
 * Utilitário para pausa (delay)
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executa uma função com retry e exponential backoff para lidar com limites de cota (429).
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isQuotaError = error?.message?.includes('429') || error?.status === 429 || JSON.stringify(error).includes('429');
      
      if (isQuotaError && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Cota excedida. Tentando novamente em ${delay}ms... (Tentativa ${i + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Analisa uma imagem de inspeção usando o modelo Gemini.
 */
export async function analyzeInspectionImage(base64Data: string, mimeType: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const prompt = `
    Você é um especialista em inspeção industrial de linhas de transmissão de energia elétrica.
    Analise esta imagem capturada por drone e:
    1. Identifique anomalias (Cabos soltos, parafusos frouxos, trincas, corrosão).
    2. LOCALIZAÇÃO ESPACIAL: Para cada anomalia, forneça o boundingBox [ymin, xmin, ymax, xmax] (0-1000).
    3. OCR DE METADADOS: Observe atentamente o canto superior esquerdo da imagem. Extraia as informações de Latitude, Longitude e o Nome da Linha de Transmissão que estão escritos na legenda sobreposta.
    4. Formate a Latitude e Longitude como números decimais se possível.

    Se não houver anomalias, retorne a lista vazia, mas ainda extraia os metadados da legenda.
  `;

  return withRetry(async () => {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result;
  });
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
}
