require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL || '';
const needsSsl =
  process.env.PGSSL === 'true' || /sslmode=require/i.test(databaseUrl);

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  databaseUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-cambia-esto',
};
