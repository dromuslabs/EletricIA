
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
          type: { type: Type.STRING },
          description: { type: Type.STRING },
          severity: { type: Type.STRING },
          location_hint: { type: Type.STRING },
          boundingBox: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
          }
        },
        required: ["type", "description", "severity", "boundingBox"]
      }
    },
    summary: { type: Type.STRING },
    safeToOperate: { type: Type.BOOLEAN },
    latitude: { type: Type.STRING },
    longitude: { type: Type.STRING },
    lineName: { type: Type.STRING }
  },
  required: ["foundAnomalies", "summary", "safeToOperate"]
};

async function analyzeViaCustomApi(base64Data: string, mimeType: string, endpoint: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64Data,
      mimeType: mimeType,
      timestamp: new Date().toISOString()
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Erro no servidor: ${response.status}`);
  }

  return response.json();
}

export async function analyzeInspectionImage(
  base64Data: string, 
  mimeType: string, 
  settings: ApiSettings = { mode: 'sdk', customEndpoint: '' }
) {
  if (settings.mode === 'custom' && settings.customEndpoint) {
    return analyzeViaCustomApi(base64Data, mimeType, settings.customEndpoint);
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Chave de API não configurada no ambiente.");

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    Analise esta imagem de inspeção de linha de transmissão. 
    Identifique falhas críticas, corrosão, parafusos soltos ou cabos danificados.
    Retorne estritamente em JSON.
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { data: base64Data, mimeType: mimeType } }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    }
  });

  const text = response.text;
  if (!text) throw new Error("Resposta da IA vazia.");
  
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  }
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
  });
}
