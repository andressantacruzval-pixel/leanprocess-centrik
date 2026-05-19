// Punto de entrada para ejecucion local o en servidores persistentes (Render, etc.).
// En Vercel se usa api/index.js, que no necesita escuchar un puerto.
const config = require('./config');
const app = require('./app');
const { ensureSchema } = require('./db');

ensureSchema()
  .then(() => {
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`Plataforma de examen activa en http://localhost:${config.port}`);
      console.log(`Panel de administrador: http://localhost:${config.port}/admin.html`);
    });
  })
  .catch((err) => {
    console.error('No se pudo iniciar el servidor:', err);
    process.exit(1);
  });
