import { callAiProxy } from '@/lib/aiClient'

// Transcripción de voz FIABLE, independiente del navegador. El dictado nativo
// (Web Speech API) falla con `network` en Chromium que no es Google Chrome, en
// Firefox y en redes que bloquean el servicio de voz de Google. Aquí grabamos el
// audio en el navegador y lo transcribimos por el MISMO ai-proxy que ya usa la
// app (Gemini), pasando el audio como contenido multimodal (rawContents) — igual
// que ya se hace con imágenes en el análisis de procedimientos. No requiere
// cambios en la Edge Function.
//
// Se pide una transcripción LITERAL: la IA no interpreta ni resume, solo pasa la
// voz a texto tal cual, en español.
export async function transcribeAudio(base64: string, mimeType: string): Promise<string> {
  const data = base64.includes(',') ? base64.split(',')[1] : base64
  const rawContents = {
    parts: [
      {
        text: 'Transcribe el audio a texto en español de forma LITERAL. Devuelve ÚNICAMENTE la transcripción, sin comentarios, sin traducir, sin resumir ni interpretar. Usa puntuación natural. Si no hay voz clara, devuelve una cadena vacía.',
      },
      { inlineData: { mimeType: mimeType || 'audio/webm', data } },
    ],
  }
  const text = await callAiProxy([], {
    rawContents,
    feature: 'transcription',
    temperature: 0,
    modelId: 'gemini-2.5-flash',
  })
  return (text || '').trim()
}
