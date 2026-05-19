require('dotenv').config();

// Acepta la variable estandar o las que crea la integracion de Postgres de Vercel.
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

const needsSsl =
  process.env.PGSSL === 'true' || /sslmode=require/i.test(databaseUrl);

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  databaseUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-cambia-esto',
};
