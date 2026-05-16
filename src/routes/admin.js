const express = require('express');
const { pool } = require('../db');
const config = require('../config');
const { signAdmin, requireAdmin } = require('../auth');
const { generateCode, buildReview } = require('../helpers');
const { sendTestEmail } = require('../mailer');
const { parseCSV, rowsToQuestions } = require('../csv');

const router = express.Router();

// --- Autenticacion -------------------------------------------------------
router.post('/login', (req, res) => {
  const password = String(req.body.password || '');
  if (password !== config.adminPassword) {
    return res.status(401).json({ error: 'Contrasena incorrecta.' });
  }
  res.json({ token: signAdmin() });
});

router.use(requireAdmin);

// --- Ajustes globales (correo / SMTP) -----------------------------------
router.get('/settings', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM app_settings WHERE id = 1');
    const settings = { ...rows[0] };
    settings.smtp_pass_set = !!settings.smtp_pass;
    delete settings.smtp_pass;
    res.json({ settings });
  } catch (err) {
    console.error('GET /admin/settings', err);
    res.status(500).json({ error: 'No se pudieron cargar los ajustes.' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const b = req.body || {};
    const emailEnabled = !!b.emailEnabled;
    const smtpHost = String(b.smtpHost || '').trim();
    const smtpFrom = String(b.smtpFrom || '').trim();
    let smtpPort = parseInt(b.smtpPort, 10);
    if (!(smtpPort >= 1 && smtpPort <= 65535)) smtpPort = 587;
    const smtpUser = String(b.smtpUser || '').trim();
    const smtpPass = String(b.smtpPass || '');

    if (emailEnabled && (!smtpHost || !smtpFrom)) {
      return res.status(400).json({
        error: 'Para activar el correo debes indicar el servidor SMTP y el remitente.',
      });
    }

    const { rows } = await pool.query(
      `UPDATE app_settings SET
         email_enabled = $1, smtp_host = $2, smtp_port = $3, smtp_secure = $4,
         smtp_user = $5, smtp_from = $6,
         smtp_pass = COALESCE(NULLIF($7, ''), smtp_pass)
       WHERE id = 1 RETURNING *`,
      [emailEnabled, smtpHost || null, smtpPort, !!b.smtpSecure, smtpUser || null,
       smtpFrom || null, smtpPass]
    );
    const settings = { ...rows[0] };
    settings.smtp_pass_set = !!settings.smtp_pass;
    delete settings.smtp_pass;
    res.json({ settings });
  } catch (err) {
    console.error('PUT /admin/settings', err);
    res.status(500).json({ error: 'No se pudieron guardar los ajustes.' });
  }
});

router.post('/settings/test-email', async (req, res) => {
  try {
    const to = String(req.body.to || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Ingresa un correo de destino valido.' });
    }
    const { rows } = await pool.query('SELECT * FROM app_settings WHERE id = 1');
    const settings = rows[0];
    if (!settings.smtp_host || !settings.smtp_from) {
      return res.status(400).json({
        error: 'Configura y guarda el servidor SMTP y el remitente antes de probar.',
      });
    }
    await sendTestEmail(settings, to);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /admin/settings/test-email', err);
    res.status(500).json({ error: 'No se pudo enviar el correo de prueba: ' + err.message });
  }
});

// --- Examenes (certificaciones) -----------------------------------------
router.get('/exams', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*,
         (SELECT COUNT(*)::int FROM questions q WHERE q.exam_id = e.id) AS total_questions,
         (SELECT COUNT(*)::int FROM questions q WHERE q.exam_id = e.id AND q.is_active) AS active_questions,
         (SELECT COUNT(*)::int FROM access_codes c WHERE c.exam_id = e.id) AS total_codes,
         (SELECT COUNT(*)::int FROM attempts a WHERE a.exam_id = e.id AND a.status = 'completed') AS completed_attempts
       FROM exams e ORDER BY e.id`
    );
    res.json({ exams: rows });
  } catch (err) {
    console.error('GET /admin/exams', err);
    res.status(500).json({ error: 'No se pudieron cargar los examenes.' });
  }
});

router.post('/exams', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (name.length < 3) {
      return res.status(400).json({ error: 'El nombre del examen es obligatorio.' });
    }
    const { rows } = await pool.query(
      'INSERT INTO exams (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.json({ ok: true, exam: rows[0] });
  } catch (err) {
    console.error('POST /admin/exams', err);
    res.status(500).json({ error: 'No se pudo crear el examen.' });
  }
});

router.get('/exams/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM exams WHERE id = $1', [
      parseInt(req.params.id, 10),
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Examen no encontrado.' });
    const { rows: stats } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM questions q WHERE q.exam_id = $1) AS total_questions,
         (SELECT COUNT(*)::int FROM questions q WHERE q.exam_id = $1 AND q.is_active) AS active_questions,
         (SELECT COUNT(*)::int FROM access_codes c WHERE c.exam_id = $1) AS total_codes,
         (SELECT COUNT(*)::int FROM attempts a WHERE a.exam_id = $1 AND a.status = 'completed') AS completed_attempts`,
      [parseInt(req.params.id, 10)]
    );
    res.json({ exam: rows[0], stats: stats[0] });
  } catch (err) {
    console.error('GET /admin/exams/:id', err);
    res.status(500).json({ error: 'No se pudo cargar el examen.' });
  }
});

router.put('/exams/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const questionsPerExam = parseInt(b.questionsPerExam, 10);
    const passPercentage = parseInt(b.passPercentage, 10);
    const durationMinutes = parseInt(b.durationMinutes, 10);
    const maxAttempts = parseInt(b.maxAttempts, 10);
    const reviewMode = String(b.reviewMode || '');
    const subjPass = String(b.emailSubjectPass || '').trim();
    const bodyPass = String(b.emailBodyPass || '').trim();
    const subjFail = String(b.emailSubjectFail || '').trim();
    const bodyFail = String(b.emailBodyFail || '').trim();

    if (name.length < 3) {
      return res.status(400).json({ error: 'El nombre del examen es obligatorio.' });
    }
    if (!(questionsPerExam >= 1)) {
      return res.status(400).json({ error: 'El numero de preguntas debe ser al menos 1.' });
    }
    if (!(passPercentage >= 1 && passPercentage <= 100)) {
      return res.status(400).json({ error: 'El porcentaje para aprobar debe estar entre 1 y 100.' });
    }
    if (!(durationMinutes >= 1)) {
      return res.status(400).json({ error: 'La duracion debe ser al menos 1 minuto.' });
    }
    if (!(maxAttempts >= 1)) {
      return res.status(400).json({ error: 'Los intentos permitidos deben ser al menos 1.' });
    }
    if (!['never', 'if_passed', 'always'].includes(reviewMode)) {
      return res.status(400).json({ error: 'Modo de revision no valido.' });
    }
    if (!subjPass || !bodyPass || !subjFail || !bodyFail) {
      return res.status(400).json({
        error: 'Los textos de correo (aprobado y reprobado) no pueden estar vacios.',
      });
    }

    const { rows } = await pool.query(
      `UPDATE exams SET
         name = $1, questions_per_exam = $2, pass_percentage = $3, duration_minutes = $4,
         max_attempts = $5, shuffle_questions = $6, shuffle_options = $7, review_mode = $8,
         is_active = $9, email_subject_pass = $10, email_body_pass = $11,
         email_subject_fail = $12, email_body_fail = $13
       WHERE id = $14 RETURNING *`,
      [
        name, questionsPerExam, passPercentage, durationMinutes, maxAttempts,
        !!b.shuffleQuestions, !!b.shuffleOptions, reviewMode, b.isActive !== false,
        subjPass, bodyPass, subjFail, bodyFail, id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Examen no encontrado.' });
    res.json({ ok: true, exam: rows[0] });
  } catch (err) {
    console.error('PUT /admin/exams/:id', err);
    res.status(500).json({ error: 'No se pudo guardar el examen.' });
  }
});

router.delete('/exams/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM exams WHERE id = $1', [parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /admin/exams/:id', err);
    res.status(500).json({ error: 'No se pudo eliminar el examen.' });
  }
});

// --- Banco de preguntas (por examen) ------------------------------------
async function fetchQuestions(examId) {
  const { rows: qs } = await pool.query(
    'SELECT id, text, category, difficulty, is_active FROM questions WHERE exam_id = $1 ORDER BY id DESC',
    [examId]
  );
  if (!qs.length) return [];
  const ids = qs.map((q) => q.id);
  const { rows: opts } = await pool.query(
    'SELECT id, question_id, text, is_correct, position FROM options WHERE question_id = ANY($1) ORDER BY position, id',
    [ids]
  );
  const byQ = {};
  opts.forEach((o) => {
    (byQ[o.question_id] = byQ[o.question_id] || []).push({
      id: o.id,
      text: o.text,
      is_correct: o.is_correct,
    });
  });
  return qs.map((q) => ({ ...q, options: byQ[q.id] || [] }));
}

function validateQuestionBody(b) {
  const text = String(b.text || '').trim();
  if (!text) return { error: 'El enunciado de la pregunta es obligatorio.' };
  const options = Array.isArray(b.options) ? b.options : [];
  const clean = options
    .map((o) => ({ text: String(o.text || '').trim(), is_correct: !!o.is_correct }))
    .filter((o) => o.text);
  if (clean.length < 2) return { error: 'Se requieren al menos 2 opciones con texto.' };
  if (!clean.some((o) => o.is_correct)) {
    return { error: 'Debes marcar al menos una opcion correcta.' };
  }
  return {
    value: {
      text,
      category: String(b.category || '').trim() || null,
      difficulty: String(b.difficulty || '').trim() || null,
      options: clean,
    },
  };
}

router.get('/exams/:examId/questions', async (req, res) => {
  try {
    res.json({ questions: await fetchQuestions(parseInt(req.params.examId, 10)) });
  } catch (err) {
    console.error('GET /admin/exams/:examId/questions', err);
    res.status(500).json({ error: 'No se pudieron cargar las preguntas.' });
  }
});

router.post('/exams/:examId/questions', async (req, res) => {
  const examId = parseInt(req.params.examId, 10);
  const { error, value } = validateQuestionBody(req.body);
  if (error) return res.status(400).json({ error });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO questions (exam_id, text, category, difficulty, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [examId, value.text, value.category, value.difficulty, req.body.is_active !== false]
    );
    const qid = rows[0].id;
    for (let i = 0; i < value.options.length; i++) {
      const o = value.options[i];
      await client.query(
        'INSERT INTO options (question_id, text, is_correct, position) VALUES ($1, $2, $3, $4)',
        [qid, o.text, o.is_correct, i]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true, id: qid });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /admin/exams/:examId/questions', err);
    res.status(500).json({ error: 'No se pudo crear la pregunta.' });
  } finally {
    client.release();
  }
});

router.post('/exams/:examId/questions/import', async (req, res) => {
  const examId = parseInt(req.params.examId, 10);
  let questions;
  try {
    const rows = parseCSV(req.body.csv || '');
    questions = rowsToQuestions(rows);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const q of questions) {
      const { rows } = await client.query(
        `INSERT INTO questions (exam_id, text, category, difficulty)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [examId, q.text, q.category, q.difficulty]
      );
      const qid = rows[0].id;
      for (let i = 0; i < q.options.length; i++) {
        const o = q.options[i];
        await client.query(
          'INSERT INTO options (question_id, text, is_correct, position) VALUES ($1, $2, $3, $4)',
          [qid, o.text, o.is_correct, i]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true, imported: questions.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /admin/exams/:examId/questions/import', err);
    res.status(500).json({ error: 'No se pudieron importar las preguntas.' });
  } finally {
    client.release();
  }
});

router.put('/questions/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { error, value } = validateQuestionBody(req.body);
  if (error) return res.status(400).json({ error });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE questions SET text = $1, category = $2, difficulty = $3, is_active = $4
       WHERE id = $5 RETURNING id`,
      [value.text, value.category, value.difficulty, req.body.is_active !== false, id]
    );
    if (!upd.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }
    await client.query('DELETE FROM options WHERE question_id = $1', [id]);
    for (let i = 0; i < value.options.length; i++) {
      const o = value.options[i];
      await client.query(
        'INSERT INTO options (question_id, text, is_correct, position) VALUES ($1, $2, $3, $4)',
        [id, o.text, o.is_correct, i]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /admin/questions/:id', err);
    res.status(500).json({ error: 'No se pudo actualizar la pregunta.' });
  } finally {
    client.release();
  }
});

router.delete('/questions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM questions WHERE id = $1', [parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /admin/questions/:id', err);
    res.status(500).json({ error: 'No se pudo eliminar la pregunta.' });
  }
});

// --- Codigos de acceso (por examen) -------------------------------------
router.get('/exams/:examId/codes', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.code, c.student_name, c.is_active, c.created_at,
              (SELECT COUNT(*)::int FROM attempts a
                 WHERE a.access_code_id = c.id AND a.status = 'completed') AS used_attempts
         FROM access_codes c
        WHERE c.exam_id = $1
        ORDER BY c.id DESC`,
      [parseInt(req.params.examId, 10)]
    );
    res.json({ codes: rows });
  } catch (err) {
    console.error('GET /admin/exams/:examId/codes', err);
    res.status(500).json({ error: 'No se pudieron cargar los codigos.' });
  }
});

router.post('/exams/:examId/codes', async (req, res) => {
  try {
    const examId = parseInt(req.params.examId, 10);
    const names = Array.isArray(req.body.names)
      ? req.body.names.map((n) => String(n || '').trim()).filter(Boolean)
      : [];
    let count = parseInt(req.body.count, 10);
    if (!(count >= 1)) count = names.length || 1;
    count = Math.min(count, 500);

    const created = [];
    for (let i = 0; i < count; i++) {
      let code;
      let attempts = 0;
      while (attempts < 10) {
        code = generateCode();
        const { rowCount } = await pool.query('SELECT 1 FROM access_codes WHERE code = $1', [code]);
        if (!rowCount) break;
        attempts++;
      }
      const { rows } = await pool.query(
        'INSERT INTO access_codes (exam_id, code, student_name) VALUES ($1, $2, $3) RETURNING *',
        [examId, code, names[i] || null]
      );
      created.push(rows[0]);
    }
    res.json({ ok: true, codes: created });
  } catch (err) {
    console.error('POST /admin/exams/:examId/codes', err);
    res.status(500).json({ error: 'No se pudieron generar los codigos.' });
  }
});

router.patch('/codes/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE access_codes SET is_active = $1 WHERE id = $2 RETURNING *',
      [!!req.body.is_active, parseInt(req.params.id, 10)]
    );
    if (!rows.length) return res.status(404).json({ error: 'Codigo no encontrado.' });
    res.json({ ok: true, code: rows[0] });
  } catch (err) {
    console.error('PATCH /admin/codes/:id', err);
    res.status(500).json({ error: 'No se pudo actualizar el codigo.' });
  }
});

router.delete('/codes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM access_codes WHERE id = $1', [parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /admin/codes/:id', err);
    res.status(500).json({ error: 'No se pudo eliminar el codigo.' });
  }
});

// --- Resultados ----------------------------------------------------------
router.get('/results', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.student_name, a.student_email, a.score, a.passed, a.status,
              a.started_at, a.finished_at, a.tab_switches, a.email_sent, a.exam_id,
              c.code, e.name AS exam_name,
              jsonb_array_length(a.question_ids) AS total_questions
         FROM attempts a
         JOIN access_codes c ON c.id = a.access_code_id
         LEFT JOIN exams e ON e.id = a.exam_id
        ORDER BY a.id DESC`
    );
    res.json({ results: rows });
  } catch (err) {
    console.error('GET /admin/results', err);
    res.status(500).json({ error: 'No se pudieron cargar los resultados.' });
  }
});

router.get('/results/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, c.code, e.name AS exam_name FROM attempts a
         JOIN access_codes c ON c.id = a.access_code_id
         LEFT JOIN exams e ON e.id = a.exam_id
        WHERE a.id = $1`,
      [parseInt(req.params.id, 10)]
    );
    const attempt = rows[0];
    if (!attempt) return res.status(404).json({ error: 'Resultado no encontrado.' });
    const review = attempt.status === 'completed' ? await buildReview(pool, attempt) : null;
    res.json({
      attempt: {
        id: attempt.id,
        code: attempt.code,
        examName: attempt.exam_name,
        studentName: attempt.student_name,
        studentEmail: attempt.student_email,
        score: attempt.score,
        passed: attempt.passed,
        status: attempt.status,
        startedAt: attempt.started_at,
        finishedAt: attempt.finished_at,
        tabSwitches: attempt.tab_switches,
        emailSent: attempt.email_sent,
      },
      review,
    });
  } catch (err) {
    console.error('GET /admin/results/:id', err);
    res.status(500).json({ error: 'No se pudo cargar el detalle.' });
  }
});

module.exports = router;
