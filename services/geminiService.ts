
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
            description: "Tipo: Cabo Solto, Parafuso Solto, Trinca/Rachadura, Corrosão, ou Outro"
          },
          description: { 
            type: Type.STRING,
            description: "Descrição técnica da falha detectada"
          },
          severity: { 
            type: Type.STRING, 
            description: "Gravidade: Baixo, Médio, Alto, Crítico"
          },
          boundingBox: {
            type: Type.ARRAY,
            description: "Coordenadas [ymin, xmin, ymax, xmax] de 0 a 1000",
            items: { type: Type.NUMBER },
          }
        },
        required: ["type", "description", "severity", "boundingBox"]
      }
    },
    summary: { type: Type.STRING, description: "Resumo técnico da estrutura" },
    safeToOperate: { type: Type.BOOLEAN, description: "Seguro para operar?" },
    latitude: { type: Type.STRING },
    longitude: { type: Type.STRING },
    lineName: { type: Type.STRING }
  },
  required: ["foundAnomalies", "summary", "safeToOperate"]
};

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

  // Use recommended model and initialization pattern from guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: "Aja como um engenheiro de manutenção elétrica. Analise a imagem de drone do poste/torre e identifique falhas técnicas. Retorne estritamente JSON." },
          { inlineData: { data: base64Data, mimeType } }
        ]
      },
      config: {
        systemInstruction: "Você é um especialista em inspeção de linhas de alta tensão. Identifique anomalias com precisão. Se não houver GPS nos metadados, deixe latitude/longitude vazios.",
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
        // Removed explicit thinkingConfig to allow default model behavior for flash-preview
      }
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("Nenhum resultado gerado pela IA. Verifique se a imagem está clara.");
    }

    const candidate = response.candidates[0];
    if (candidate.finishReason === 'SAFETY') {
      throw new Error("A imagem foi bloqueada pelos filtros de segurança da IA.");
    }

    // Access text property directly as per modern SDK guidelines (not a method)
    const text = response.text;
    if (!text) throw new Error("A IA retornou uma resposta vazia.");

    return JSON.parse(text);
  } catch (error: any) {
    console.error("Erro Gemini:", error);
    if (error.message?.includes('429')) throw new Error("Muitas requisições. Aguarde 60 segundos.");
    throw new Error(error.message || "Erro desconhecido na análise.");
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
