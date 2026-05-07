const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'garimpador-de-pecas',
    at: new Date().toISOString(),
    node: process.version,
    env: process.env.NODE_ENV || 'development',
    integracoes: {
      access_key:    !!process.env.ACCESS_KEY,
      gemini:        !!process.env.GEMINI_API_KEY,
      groq:          !!process.env.GROQ_API_KEY,
      ml_token:      !!process.env.ML_ACCESS_TOKEN,
      ig_token:      !!process.env.IG_ACCESS_TOKEN,
      db_url:        !!process.env.DATABASE_URL,
      cron_secret:   !!process.env.CRON_SECRET,
      resend:        !!process.env.RESEND_API_KEY,
      callmebot_wa:  !!process.env.CALLMEBOT_APIKEY,
    },
  });
});

module.exports = router;
