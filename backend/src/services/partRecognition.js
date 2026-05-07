/**
 * Reconhecimento de peça automotiva via IA vision.
 *
 * Suporta DOIS provedores (auto-detect baseado em qual chave existe):
 *   - GEMINI_API_KEY  → Google Gemini 2.0 Flash (recomendado pra vision)
 *                       Free tier: 1500 req/dia. Qualidade superior em
 *                       descrições de objetos físicos.
 *   - GROQ_API_KEY    → Groq llama-4-scout (alternativa rápida)
 *                       Free tier: 14.4k req/dia. Ótimo em texto.
 *
 * Ordem de preferência: Gemini > Groq (Gemini é melhor em vision).
 *
 * Recebe Buffer/base64, retorna JSON: { tipo, palavras, c10, c14, anoAprox, observacoes }
 */

const axios = require('axios');

const TIMEOUT = 30000;

const SYSTEM_PROMPT = `Você é especialista em peças de Chevrolet C10 e C14 (caminhonetes brasileiras anos 1964-1985).
Sua tarefa: identificar a peça automotiva na imagem e devolver APENAS JSON válido (sem markdown, sem explicações fora do JSON).

Formato OBRIGATÓRIO:
{
  "tipo": "string curta — nome da peça em PT-BR",
  "palavras": ["array", "de", "palavras-chave", "para busca"],
  "c10": true/false,
  "c14": true/false,
  "anoAprox": "string ou null — ex 1970-1979",
  "observacoes": "string opcional — diferenças de versão, condição visível, sinais de uso"
}

Use sinônimos brasileiros (ex: "para-choque" e "parachoque"). Se a peça for genérica de caminhonete antiga e couber em ambas, marque c10 e c14 true. Se a foto não tiver peça automotiva clara, devolva tipo "indefinido" e palavras vazias.`;

/**
 * @param {Buffer|string} imageInput
 * @param {string} [mime]
 * @returns {Promise<{tipo, palavras, c10, c14, anoAprox, observacoes, provider}>}
 */
async function recognize(imageInput, mime = 'image/jpeg') {
  /* Normaliza pra base64 cru e dataUrl */
  let base64;
  if (Buffer.isBuffer(imageInput)) {
    base64 = imageInput.toString('base64');
  } else if (typeof imageInput === 'string') {
    base64 = imageInput.startsWith('data:')
      ? imageInput.split(',', 2)[1]
      : imageInput;
  } else {
    throw new Error('imageInput deve ser Buffer ou string base64');
  }

  /* Preferência: Gemini > Groq */
  if (process.env.GEMINI_API_KEY) {
    return { ...await recognizeWithGemini(base64, mime), provider: 'gemini' };
  }
  if (process.env.GROQ_API_KEY) {
    return { ...await recognizeWithGroq(base64, mime), provider: 'groq' };
  }
  throw new Error('Nenhum provedor de IA configurado. Defina GEMINI_API_KEY (recomendado) ou GROQ_API_KEY no .env');
}

/* Google Gemini 2.0 Flash — melhor pra reconhecimento físico */
async function recognizeWithGemini(base64, mime) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = {
    contents: [{
      parts: [
        { text: SYSTEM_PROMPT + '\n\nIdentifique a peça nesta foto.' },
        { inline_data: { mime_type: mime, data: base64 } },
      ],
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 600,
      responseMimeType: 'application/json',
    },
  };

  const resp = await axios.post(url, body, { timeout: TIMEOUT });
  const content = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Gemini retornou resposta vazia');
  return parseAndSanitize(content);
}

/* Groq llama-4-scout — alternativa rápida */
async function recognizeWithGroq(base64, mime) {
  const dataUrl = `data:${mime};base64,${base64}`;
  const body = {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    temperature: 0.2,
    max_tokens: 600,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Identifique a peça nesta foto.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  const resp = await axios.post('https://api.groq.com/openai/v1/chat/completions', body, {
    timeout: TIMEOUT,
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  const content = resp.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq retornou resposta vazia');
  return parseAndSanitize(content);
}

function parseAndSanitize(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    const m = String(content).match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
    else throw new Error(`IA devolveu não-JSON: ${String(content).slice(0, 200)}`);
  }
  return {
    tipo: parsed.tipo || 'indefinido',
    palavras: Array.isArray(parsed.palavras) ? parsed.palavras.filter(Boolean).map(String) : [],
    c10: !!parsed.c10,
    c14: !!parsed.c14,
    anoAprox: parsed.anoAprox || null,
    observacoes: parsed.observacoes || '',
  };
}

module.exports = { recognize };
