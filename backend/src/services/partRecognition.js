/**
 * Reconhecimento de peça automotiva via IA vision.
 *
 * Cadeia de fallback automática (qualidade → robustez):
 *   1. Gemini 2.5 Pro       — TOP de qualidade (50 req/dia free)
 *   2. Gemini 2.0 Flash     — boa qualidade, 1500 req/dia free
 *   3. Groq llama-4-scout   — alternativa rápida, 14.4k/dia free
 *
 * Se a chamada do nível 1 falhar (quota, erro), tenta o próximo automaticamente.
 *
 * 2 funções exportadas:
 *   - recognize(image)             → identifica a peça numa foto
 *   - verifyMatch(image, params)   → analisa thumb de anúncio e diz se a peça
 *                                    corresponde ao modelo/peça que o user procura
 *                                    (caso de uso: anúncio com foto mas título genérico)
 */

const axios = require('axios');

const TIMEOUT = 30000;

const SYSTEM_PROMPT_RECOGNIZE = `Você é especialista em peças de Chevrolet C10 e C14 (caminhonetes brasileiras anos 1964-1985).
Sua tarefa: identificar a peça automotiva na imagem e devolver APENAS JSON válido (sem markdown).

Formato OBRIGATÓRIO:
{
  "tipo": "string curta — nome da peça em PT-BR",
  "palavras": ["array", "de", "palavras-chave", "para busca"],
  "c10": true/false,
  "c14": true/false,
  "anoAprox": "string ou null — ex 1970-1979",
  "observacoes": "string opcional — diferenças de versão, condição visível, sinais de uso"
}

Use sinônimos brasileiros (ex: "para-choque" e "parachoque"). Se a peça é genérica de caminhonete antiga, marque c10 e c14 true. Se a foto não tiver peça automotiva clara, devolva tipo "indefinido" e palavras vazias.`;

const SYSTEM_PROMPT_VERIFY = `Você é especialista em peças de Chevrolet C10 e C14 (caminhonetes 1964-1985) e em peças de carros antigos brasileiros.
Sua tarefa: dado uma FOTO de anúncio + descrição do que o usuário procura, decidir se a peça mostrada na foto é a peça que ele quer (mesmo modelo/aplicação).

Devolve APENAS JSON válido:
{
  "match": true/false,
  "confianca": 0.0-1.0,
  "peca_real": "string — o que você acha que a peça realmente é",
  "compatibilidade": "string — pra qual carro/ano a peça serve, se conseguir identificar",
  "obs": "string curta — porque bate ou não bate"
}

Anúncios de "lote", "caixa misturada" ou peça muito danificada → match=false. Foto de placa, capa de catálogo, panfleto sem a peça em si → match=false. Peça idêntica em modelo + estado claro de uso → match=true com confiança alta.`;

/* Cadeia de provedores em ordem de qualidade */
const PROVIDERS = [
  { name: 'gemini-2.5-pro',   fn: callGemini, model: 'gemini-2.5-pro',           keyEnv: 'GEMINI_API_KEY' },
  { name: 'gemini-2.0-flash', fn: callGemini, model: 'gemini-2.0-flash',         keyEnv: 'GEMINI_API_KEY' },
  { name: 'groq-llama-4',     fn: callGroq,   model: 'meta-llama/llama-4-scout-17b-16e-instruct', keyEnv: 'GROQ_API_KEY' },
];

/* === API pública === */

async function recognize(imageInput, mime = 'image/jpeg') {
  return runWithFallback(SYSTEM_PROMPT_RECOGNIZE, 'Identifique a peça nesta foto.', imageInput, mime, sanitizeRecognize);
}

async function verifyMatch({ image, mime = 'image/jpeg', userQuery, modelo }) {
  const userMsg = `O usuário está procurando: "${userQuery}"${modelo ? ` (modelo do carro: ${modelo})` : ''}.\nA foto abaixo é de um anúncio. A peça mostrada bate com o que ele procura?`;
  return runWithFallback(SYSTEM_PROMPT_VERIFY, userMsg, image, mime, sanitizeVerify);
}

/* === Engine de fallback === */

async function runWithFallback(systemPrompt, userText, imageInput, mime, sanitizer) {
  const base64 = toBase64(imageInput);
  const errors = [];
  for (const p of PROVIDERS) {
    if (!process.env[p.keyEnv]) continue;
    try {
      const content = await p.fn({ systemPrompt, userText, base64, mime, model: p.model });
      const parsed = parseJSON(content);
      return { ...sanitizer(parsed), provider: p.name };
    } catch (err) {
      const status = err.response?.status;
      const isQuotaIssue = status === 429 || status === 403 || /quota|rate/i.test(err.message);
      errors.push({ provider: p.name, error: err.message, status });
      console.warn(`[partRecognition] ${p.name} falhou (${err.message}). ${isQuotaIssue ? 'Caindo pro próximo provider.' : ''}`);
      /* Erros não-quota também caem pro próximo — robustez */
    }
  }
  const e = new Error('Todos os provedores de IA falharam ou nenhum configurado');
  e.errors = errors;
  throw e;
}

/* === Implementação dos provedores === */

async function callGemini({ systemPrompt, userText, base64, mime, model }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = {
    contents: [{
      parts: [
        { text: systemPrompt + '\n\n' + userText },
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
  return resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGroq({ systemPrompt, userText, base64, mime, model }) {
  const dataUrl = `data:${mime};base64,${base64}`;
  const body = {
    model,
    temperature: 0.2,
    max_tokens: 600,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
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
  return resp.data?.choices?.[0]?.message?.content || '';
}

/* === Helpers === */

function toBase64(imageInput) {
  if (Buffer.isBuffer(imageInput)) return imageInput.toString('base64');
  if (typeof imageInput === 'string') {
    return imageInput.startsWith('data:') ? imageInput.split(',', 2)[1] : imageInput;
  }
  throw new Error('imageInput deve ser Buffer ou string base64');
}

function parseJSON(content) {
  try { return JSON.parse(content); }
  catch {
    const m = String(content).match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error(`IA devolveu não-JSON: ${String(content).slice(0, 200)}`);
  }
}

function sanitizeRecognize(parsed) {
  return {
    tipo: parsed.tipo || 'indefinido',
    palavras: Array.isArray(parsed.palavras) ? parsed.palavras.filter(Boolean).map(String) : [],
    c10: !!parsed.c10,
    c14: !!parsed.c14,
    anoAprox: parsed.anoAprox || null,
    observacoes: parsed.observacoes || '',
  };
}

function sanitizeVerify(parsed) {
  return {
    match: !!parsed.match,
    confianca: Math.max(0, Math.min(1, Number(parsed.confianca) || 0)),
    peca_real: parsed.peca_real || '',
    compatibilidade: parsed.compatibilidade || '',
    obs: parsed.obs || '',
  };
}

module.exports = { recognize, verifyMatch };
