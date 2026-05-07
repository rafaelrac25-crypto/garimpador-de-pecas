const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'garimpador-de-pecas',
    at: new Date().toISOString(),
    node: process.version,
    env: process.env.NODE_ENV || 'development',
    has_access_key: !!process.env.ACCESS_KEY,
    has_groq: !!process.env.GROQ_API_KEY,
    has_db_url: !!process.env.DATABASE_URL,
  });
});

module.exports = router;
