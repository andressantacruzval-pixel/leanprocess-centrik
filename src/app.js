const path = require('path');
const express = require('express');
const { ensureSchema } = require('./db');
const examRouter = require('./routes/exam');
const adminRouter = require('./routes/admin');

const app = express();

app.use(express.json({ limit: '5mb' }));

// Verificacion de vida (no depende de la base de datos).
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Garantiza que el esquema de base de datos exista antes de atender la solicitud.
app.use(async (_req, res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (err) {
    console.error('Error al preparar la base de datos:', err);
    res.status(503).json({ error: 'La base de datos no esta disponible.' });
  }
});

app.use('/api/exam', examRouter);
app.use('/api/admin', adminRouter);

// Archivos estaticos (usado en ejecucion local; en Vercel los sirve la CDN).
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((err, _req, res, _next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

module.exports = app;
