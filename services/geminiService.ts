
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
            description: "Componente: Isolador, Condutor, Estrutura, Ferragem ou Vegetação"
          },
          description: { 
            type: Type.STRING,
            description: "Descrição técnica da anomalia"
          },
          severity: { 
            type: Type.STRING, 
            description: "Baixo, Médio, Alto ou Crítico"
          },
          location_hint: {
            type: Type.STRING,
            description: "Onde olhar na imagem"
          },
          boundingBox: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "Coordenadas [ymin, xmin, ymax, xmax] 0-1000"
          }
        },
        required: ["type", "description", "severity", "boundingBox", "location_hint"]
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

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (!result) return reject(new Error("Erro na leitura do arquivo."));
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Falha ao converter arquivo."));
    reader.readAsDataURL(file);
  });
}

export async function analyzeInspectionImage(
  base64Data: string, 
  mimeType: string, 
  settings: ApiSettings
) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          { text: "Analise esta imagem de infraestrutura elétrica. Identifique falhas críticas ou preventivas. Retorne JSON em Português-BR." },
          { inlineData: { data: base64Data, mimeType } }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) throw new Error("Resposta nula.");

    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);

  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message?.includes('404') || error.message?.includes('entity was not found')) {
      throw new Error("API_KEY_REQUIRED");
    }
    throw new Error(error.message || "Erro na análise da imagem.");
  }
}
