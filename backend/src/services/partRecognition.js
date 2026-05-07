/**
 * Reconhecimento de peça automotiva via Groq vision (llama-4-scout).
 *
 * Recebe uma imagem (Buffer ou base64), retorna JSON estruturado:
 *   { tipo, palavras, c10, c14, anoAprox, observacoes }
 *
 * Free tier Groq: ~30 req/min — suficiente pra uso pessoal.
 *
 * Doc: https://console.groq.com/docs/vision
 */

const axios = require('axios');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
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

Use sinônimos brasileiros nas palavras-chave (ex: "para-choque" e "parachoque"). Se a peça for genérica de caminhonete antiga e couber em ambas, marque c10 e c14 como true. Se a foto não tiver peça automotiva clara, devolva tipo "indefinido" e palavras vazias.`;

/**
 * @param {Buffer|string} imageInput  Buffer da imagem OU base64 OU data URL completo
 * @param {string} [mime]             ex 'image/jpeg' (default 'image/jpeg')
 */
async function recognize(imageInput, mime = 'image/jpeg') {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY não configurada');
  }

  /* Normaliza entrada pra data URL */
  let dataUrl;
  if (Buffer.isBuffer(imageInput)) {
    dataUrl = `data:${mime};base64,${imageInput.toString('base64')}`;
  } else if (typeof imageInput === 'string') {
    dataUrl = imageInput.startsWith('data:') ? imageInput : `data:${mime};base64,${imageInput}`;
  } else {
    throw new Error('imageInput deve ser Buffer ou string base64');
  }

  const body = {
    model: MODEL,
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

  const resp = await axios.post(GROQ_URL, body, {
    timeout: TIMEOUT,
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  const content = resp.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq retornou resposta vazia');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    /* Se vier com texto antes/depois do JSON, tenta extrair */
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      parsed = JSON.parse(m[0]);
    } else {
      throw new Error(`Groq devolveu não-JSON: ${content.slice(0, 200)}`);
    }
  }

  /* Sanitiza shape — qualquer chave faltando vira default seguro */
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
