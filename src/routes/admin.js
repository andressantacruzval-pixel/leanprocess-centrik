const express = require('express');
const { pool } = require('../db');
const config = require('../config');
const { signAdmin, requireAdmin } = require('../auth');
const { generateCode, buildReview } = require('../helpers');
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

// --- Configuracion del examen -------------------------------------------
router.get('/config', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM exam_config WHERE id = 1');
    const { rows: stats } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM questions) AS total_questions,
         (SELECT COUNT(*)::int FROM questions WHERE is_active = true) AS active_questions,
         (SELECT COUNT(*)::int FROM access_codes) AS total_codes,
         (SELECT COUNT(*)::int FROM attempts WHERE status = 'completed') AS completed_attempts`
    );
    res.json({ config: rows[0], stats: stats[0] });
  } catch (err) {
    console.error('GET /admin/config', err);
    res.status(500).json({ error: 'No se pudo cargar la configuracion.' });
  }
});

router.put('/config', async (req, res) => {
  try {
    const b = req.body || {};
    const examTitle = String(b.examTitle || '').trim();
    const questionsPerExam = parseInt(b.questionsPerExam, 10);
    const passPercentage = parseInt(b.passPercentage, 10);
    const durationMinutes = parseInt(b.durationMinutes, 10);
    const maxAttempts = parseInt(b.maxAttempts, 10);
    const reviewMode = String(b.reviewMode || '');

    if (!examTitle) return res.status(400).json({ error: 'El titulo es obligatorio.' });
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

    const { rows } = await pool.query(
      `UPDATE exam_config SET
         exam_title = $1, questions_per_exam = $2, pass_percentage = $3,
         duration_minutes = $4, max_attempts = $5,
         shuffle_questions = $6, shuffle_options = $7, review_mode = $8
       WHERE id = 1 RETURNING *`,
      [
        examTitle,
        questionsPerExam,
        passPercentage,
        durationMinutes,
        maxAttempts,
        !!b.shuffleQuestions,
        !!b.shuffleOptions,
        reviewMode,
      ]
    );
    res.json({ config: rows[0] });
  } catch (err) {
    console.error('PUT /admin/config', err);
    res.status(500).json({ error: 'No se pudo guardar la configuracion.' });
  }
});

// --- Banco de preguntas --------------------------------------------------
async function fetchQuestions() {
  const { rows: qs } = await pool.query(
    'SELECT id, text, category, difficulty, is_active FROM questions ORDER BY id DESC'
  );
  if (!qs.length) return [];
  const { rows: opts } = await pool.query(
    'SELECT id, question_id, text, is_correct, position FROM options ORDER BY position, id'
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

router.get('/questions', async (_req, res) => {
  try {
    res.json({ questions: await fetchQuestions() });
  } catch (err) {
    console.error('GET /admin/questions', err);
    res.status(500).json({ error: 'No se pudieron cargar las preguntas.' });
  }
});

router.post('/questions', async (req, res) => {
  const { error, value } = validateQuestionBody(req.body);
  if (error) return res.status(400).json({ error });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO questions (text, category, difficulty, is_active)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [value.text, value.category, value.difficulty, req.body.is_active !== false]
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
    console.error('POST /admin/questions', err);
    res.status(500).json({ error: 'No se pudo crear la pregunta.' });
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
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM questions WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /admin/questions/:id', err);
    res.status(500).json({ error: 'No se pudo eliminar la pregunta.' });
  }
});

router.post('/questions/import', async (req, res) => {
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
        `INSERT INTO questions (text, category, difficulty) VALUES ($1, $2, $3) RETURNING id`,
        [q.text, q.category, q.difficulty]
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
    console.error('POST /admin/questions/import', err);
    res.status(500).json({ error: 'No se pudieron importar las preguntas.' });
  } finally {
    client.release();
  }
});

// --- Codigos de acceso ---------------------------------------------------
router.get('/codes', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.code, c.student_name, c.is_active, c.created_at,
              (SELECT COUNT(*)::int FROM attempts a
                 WHERE a.access_code_id = c.id AND a.status = 'completed') AS used_attempts
         FROM access_codes c
        ORDER BY c.id DESC`
    );
    res.json({ codes: rows });
  } catch (err) {
    console.error('GET /admin/codes', err);
    res.status(500).json({ error: 'No se pudieron cargar los codigos.' });
  }
});

router.post('/codes', async (req, res) => {
  try {
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
      // Reintenta ante una colision improbable de codigo.
      while (attempts < 10) {
        code = generateCode();
        const { rowCount } = await pool.query('SELECT 1 FROM access_codes WHERE code = $1', [code]);
        if (!rowCount) break;
        attempts++;
      }
      const { rows } = await pool.query(
        'INSERT INTO access_codes (code, student_name) VALUES ($1, $2) RETURNING *',
        [code, names[i] || null]
      );
      created.push(rows[0]);
    }
    res.json({ ok: true, codes: created });
  } catch (err) {
    console.error('POST /admin/codes', err);
    res.status(500).json({ error: 'No se pudieron generar los codigos.' });
  }
});

router.patch('/codes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      'UPDATE access_codes SET is_active = $1 WHERE id = $2 RETURNING *',
      [!!req.body.is_active, id]
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
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM access_codes WHERE id = $1', [id]);
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
      `SELECT a.id, a.student_name, a.score, a.passed, a.status,
              a.started_at, a.finished_at, c.code,
              jsonb_array_length(a.question_ids) AS total_questions
         FROM attempts a
         JOIN access_codes c ON c.id = a.access_code_id
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
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT a.*, c.code FROM attempts a
         JOIN access_codes c ON c.id = a.access_code_id
        WHERE a.id = $1`,
      [id]
    );
    const attempt = rows[0];
    if (!attempt) return res.status(404).json({ error: 'Resultado no encontrado.' });
    const review = attempt.status === 'completed' ? await buildReview(pool, attempt) : null;
    res.json({
      attempt: {
        id: attempt.id,
        code: attempt.code,
        studentName: attempt.student_name,
        score: attempt.score,
        passed: attempt.passed,
        status: attempt.status,
        startedAt: attempt.started_at,
        finishedAt: attempt.finished_at,
      },
      review,
    });
  } catch (err) {
    console.error('GET /admin/results/:id', err);
    res.status(500).json({ error: 'No se pudo cargar el detalle.' });
  }
});

module.exports = router;
