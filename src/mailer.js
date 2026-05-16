const nodemailer = require('nodemailer');

function fillTemplate(text, vars) {
  return String(text || '').replace(/\{(\w+)\}/g, (m, key) =>
    vars[key] != null ? vars[key] : m
  );
}

function buildTransport(settings) {
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port || 587,
    secure: !!settings.smtp_secure,
    auth: settings.smtp_user
      ? { user: settings.smtp_user, pass: settings.smtp_pass || '' }
      : undefined,
  });
}

// Envia el correo de resultado al estudiante. Devuelve true si se envio.
async function sendResultEmail(settings, exam, attempt) {
  if (!settings.email_enabled) return false;
  if (!settings.smtp_host || !settings.smtp_from) return false;
  if (!attempt.student_email) return false;

  const passed = !!attempt.passed;
  const vars = {
    nombre: attempt.student_name,
    puntaje: `${Number(attempt.score)}%`,
    resultado: passed ? 'APROBADO' : 'REPROBADO',
    examen: exam.name,
    minimo: `${exam.pass_percentage}%`,
  };

  const subject = fillTemplate(
    passed ? exam.email_subject_pass : exam.email_subject_fail,
    vars
  );
  const body = fillTemplate(
    passed ? exam.email_body_pass : exam.email_body_fail,
    vars
  );

  await buildTransport(settings).sendMail({
    from: settings.smtp_from,
    to: attempt.student_email,
    subject,
    text: body,
  });
  return true;
}

// Envia un correo de prueba para validar la configuracion SMTP.
async function sendTestEmail(settings, to) {
  await buildTransport(settings).sendMail({
    from: settings.smtp_from,
    to,
    subject: 'Correo de prueba - Plataforma de examenes',
    text: 'Este es un correo de prueba. La configuracion SMTP funciona correctamente.',
  });
}

module.exports = { sendResultEmail, sendTestEmail, fillTemplate };
