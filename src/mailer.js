const nodemailer = require('nodemailer');

function fillTemplate(text, vars) {
  return String(text || '').replace(/\{(\w+)\}/g, (m, key) =>
    vars[key] != null ? vars[key] : m
  );
}

// Envia el correo de resultado al estudiante. Devuelve true si se envio.
async function sendResultEmail(config, attempt) {
  if (!config.email_enabled) return false;
  if (!config.smtp_host || !config.smtp_from) return false;
  if (!attempt.student_email) return false;

  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port || 587,
    secure: !!config.smtp_secure,
    auth: config.smtp_user
      ? { user: config.smtp_user, pass: config.smtp_pass || '' }
      : undefined,
  });

  const passed = !!attempt.passed;
  const vars = {
    nombre: attempt.student_name,
    puntaje: `${Number(attempt.score)}%`,
    resultado: passed ? 'APROBADO' : 'REPROBADO',
    examen: config.exam_title,
    minimo: `${config.pass_percentage}%`,
  };

  const subject = fillTemplate(
    passed ? config.email_subject_pass : config.email_subject_fail,
    vars
  );
  const body = fillTemplate(
    passed ? config.email_body_pass : config.email_body_fail,
    vars
  );

  await transporter.sendMail({
    from: config.smtp_from,
    to: attempt.student_email,
    subject,
    text: body,
  });
  return true;
}

// Envia un correo de prueba para validar la configuracion SMTP.
async function sendTestEmail(config, to) {
  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port || 587,
    secure: !!config.smtp_secure,
    auth: config.smtp_user
      ? { user: config.smtp_user, pass: config.smtp_pass || '' }
      : undefined,
  });
  await transporter.sendMail({
    from: config.smtp_from,
    to,
    subject: 'Correo de prueba - Plataforma de examen',
    text: 'Este es un correo de prueba. La configuracion SMTP funciona correctamente.',
  });
}

module.exports = { sendResultEmail, sendTestEmail, fillTemplate };
