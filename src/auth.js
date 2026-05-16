const jwt = require('jsonwebtoken');
const config = require('./config');

function signAdmin() {
  return jwt.sign({ role: 'admin' }, config.jwtSecret, { expiresIn: '12h' });
}

function signAttempt(attemptId) {
  return jwt.sign({ attemptId, role: 'attempt' }, config.jwtSecret, { expiresIn: '24h' });
}

function verify(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function requireAdmin(req, res, next) {
  const payload = verify(bearer(req));
  if (!payload || payload.role !== 'admin') {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  next();
}

function requireAttempt(req, res, next) {
  const payload = verify(bearer(req));
  if (!payload || payload.role !== 'attempt') {
    return res.status(401).json({ error: 'Sesion de examen no valida.' });
  }
  req.attemptId = payload.attemptId;
  next();
}

module.exports = { signAdmin, signAttempt, verify, requireAdmin, requireAttempt };
