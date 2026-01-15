
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.status || (error?.message?.includes('429') ? 429 : 0);
      
      if (status === 429 && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function analyzeInspectionImage(base64Data: string, mimeType: string) {
  // Inicializa o cliente dentro da função para garantir o uso da chave configurada no ambiente
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `
    Você é um especialista em inspeção industrial de linhas de transmissão.
    Analise esta imagem de drone e forneça um relatório técnico rigoroso.
    
    1. DETECÇÃO VISUAL: Identifique parafusos soltos, corrosão, cabos danificados ou trincas.
    2. LOCALIZAÇÃO: Para cada anomalia, defina o boundingBox exato [ymin, xmin, ymax, xmax].
    3. METADADOS: Leia o canto superior esquerdo e extraia Latitude, Longitude e o Nome da Linha.
    
    Retorne estritamente um JSON que siga o schema definido.
  `;

  return withRetry(async () => {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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

    if (!response.text) throw new Error("Resposta vazia da IA");
    
    // Limpeza de possíveis marcadores markdown que a IA possa incluir por engano
    const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  });
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
}
