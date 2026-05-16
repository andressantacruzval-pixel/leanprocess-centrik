const path = require('path');
const express = require('express');
const config = require('./config');
const { initSchema } = require('./db');
const examRouter = require('./routes/exam');
const adminRouter = require('./routes/admin');

const app = express();

app.use(express.json({ limit: '5mb' }));

app.use('/api/exam', examRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((err, _req, res, _next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

async function start() {
  try {
    await initSchema();
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`Plataforma de examen activa en http://localhost:${config.port}`);
      console.log(`Panel de administrador: http://localhost:${config.port}/admin.html`);
    });
  } catch (err) {
    console.error('No se pudo iniciar el servidor:', err);
    process.exit(1);
  }
}

start();
