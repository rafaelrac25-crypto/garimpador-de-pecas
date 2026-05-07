/**
 * Proxy genérico Groq — chat e identificação de peça por descrição textual.
 *
 * POST /api/ai/chat
 *   body: { message }    — pergunta livre, contexto = especialista C10/C14
 *
 * Pra reconhecimento de imagem use /api/photo-search.
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const TIMEOUT = 30000;

const SYSTEM_PROMPT = `Você é um assistente especialista em Chevrolet C10 e C14 (caminhonetes 1964-1985) e em peças de carros antigos brasileiros em geral. Responda de forma curta, direta e em PT-BR. Quando o usuário descrever uma peça, sugira palavras-chave de busca pra mercado online (ex: "kit motor", "para-choque", incluindo modelo do carro).`;

router.post('/chat', async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'GROQ_API_KEY não configurada' });
  }
  const message = (req.body?.message || '').toString().trim();
  if (!message) return res.status(400).json({ error: 'campo message obrigatório' });

  try {
    const resp = await axios.post(GROQ_URL, {
      model: MODEL,
      temperature: 0.4,
      max_tokens: 500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
    }, {
      timeout: TIMEOUT,
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    const reply = resp.data?.choices?.[0]?.message?.content || '';
    return res.json({ reply });
  } catch (err) {
    console.error('[ai/chat] erro:', err.response?.data || err.message);
    return res.status(502).json({ error: 'chat falhou', detalhes: err.message });
  }
});

module.exports = router;
