const express = require('express');
const { pool } = require('../db');
const { signAttempt, requireAttempt } = require('../auth');
const { shuffle, generateCode, getAttemptQuestions, gradeAttempt, buildReview } = require('../helpers');

const router = express.Router();

async function getConfig() {
  const { rows } = await pool.query('SELECT * FROM exam_config WHERE id = 1');
  return rows[0];
}

// Construye el estado completo del examen para el frontend.
async function buildState(attempt, config) {
  const base = {
    attemptId: attempt.id,
    status: attempt.status,
    examTitle: config.exam_title,
    serverNow: new Date().toISOString(),
  };
  if (attempt.status === 'completed') {
    return { ...base };
  }
  const questions = await getAttemptQuestions(pool, attempt);
  const { rows: answers } = await pool.query(
    'SELECT question_id, selected_option_ids FROM attempt_answers WHERE attempt_id = $1',
    [attempt.id]
  );
  const answerMap = {};
  answers.forEach((a) => {
    answerMap[a.question_id] = (a.selected_option_ids || []).map(Number);
  });
  return {
    ...base,
    questions,
    answers: answerMap,
    expiresAt: attempt.expires_at,
    durationMinutes: config.duration_minutes,
    passPercentage: config.pass_percentage,
    totalQuestions: questions.length,
  };
}

// POST /api/exam/start  { code, studentName }
router.post('/start', async (req, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    const studentName = String(req.body.studentName || '').trim();
    const studentEmail = String(req.body.studentEmail || '').trim().toLowerCase();
    if (!code) return res.status(400).json({ error: 'Ingresa tu codigo de acceso.' });
    if (studentName.length < 3) {
      return res.status(400).json({ error: 'Ingresa tu nombre completo.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) {
      return res.status(400).json({ error: 'Ingresa un correo electronico valido.' });
    }

    const { rows: codeRows } = await pool.query(
      'SELECT * FROM access_codes WHERE code = $1',
      [code]
    );
    const accessCode = codeRows[0];
    if (!accessCode || !accessCode.is_active) {
      return res.status(403).json({ error: 'Codigo de acceso invalido o desactivado.' });
    }

    const config = await getConfig();

    // Finaliza intentos vencidos que sigan abiertos.
    const { rows: openRows } = await pool.query(
      `SELECT * FROM attempts WHERE access_code_id = $1 AND status = 'in_progress'`,
      [accessCode.id]
    );
    for (const open of openRows) {
      if (new Date(open.expires_at).getTime() <= Date.now()) {
        await gradeAttempt(pool, open.id);
      } else {
        // Hay un intento en curso: se reanuda.
        const token = signAttempt(open.id);
        const state = await buildState(open, config);
        return res.json({ token, ...state, resumed: true });
      }
    }

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS used FROM attempts WHERE access_code_id = $1 AND status = 'completed'`,
      [accessCode.id]
    );
    const used = countRows[0].used;
    if (used >= config.max_attempts) {
      return res.status(403).json({
        error: `Has agotado tus intentos (${config.max_attempts}). Contacta al administrador.`,
      });
    }

    const { rows: bankRows } = await pool.query(
      'SELECT id FROM questions WHERE is_active = true'
    );
    if (bankRows.length < config.questions_per_exam) {
      return res.status(409).json({
        error: 'El examen aun no esta disponible. Contacta al administrador.',
      });
    }

    let selected = bankRows.map((r) => r.id);
    selected = config.shuffle_questions ? shuffle(selected) : selected;
    selected = selected.slice(0, config.questions_per_exam);

    const { rows: optRows } = await pool.query(
      'SELECT id, question_id, position FROM options WHERE question_id = ANY($1)',
      [selected]
    );
    const optsByQ = {};
    optRows.forEach((o) => {
      (optsByQ[o.question_id] = optsByQ[o.question_id] || []).push(o);
    });
    const optionOrder = {};
    for (const qid of selected) {
      let list = (optsByQ[qid] || []).slice();
      list = config.shuffle_options
        ? shuffle(list)
        : list.sort((a, b) => a.position - b.position || a.id - b.id);
      optionOrder[qid] = list.map((o) => o.id);
    }

    const expiresAt = new Date(Date.now() + config.duration_minutes * 60000);
    const { rows: created } = await pool.query(
      `INSERT INTO attempts
         (access_code_id, student_name, student_email, question_ids, option_order, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        accessCode.id,
        studentName,
        studentEmail,
        JSON.stringify(selected),
        JSON.stringify(optionOrder),
        expiresAt,
      ]
    );
    if (!accessCode.student_name) {
      await pool.query('UPDATE access_codes SET student_name = $1 WHERE id = $2', [
        studentName,
        accessCode.id,
      ]);
    }

    const attempt = created[0];
    const token = signAttempt(attempt.id);
    const state = await buildState(attempt, config);
    res.json({ token, ...state, resumed: false });
  } catch (err) {
    console.error('POST /exam/start', err);
    res.status(500).json({ error: 'No se pudo iniciar el examen.' });
  }
});

// GET /api/exam/state
router.get('/state', requireAttempt, async (req, res) => {
  try {
    let { rows } = await pool.query('SELECT * FROM attempts WHERE id = $1', [req.attemptId]);
    let attempt = rows[0];
    if (!attempt) return res.status(404).json({ error: 'Intento no encontrado.' });

    if (attempt.status === 'in_progress' && new Date(attempt.expires_at).getTime() <= Date.now()) {
      attempt = await gradeAttempt(pool, attempt.id);
    }
    const config = await getConfig();
    res.json(await buildState(attempt, config));
  } catch (err) {
    console.error('GET /exam/state', err);
    res.status(500).json({ error: 'No se pudo cargar el examen.' });
  }
});

// POST /api/exam/answer  { questionId, selectedOptionIds }
router.post('/answer', requireAttempt, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM attempts WHERE id = $1', [req.attemptId]);
    const attempt = rows[0];
    if (!attempt) return res.status(404).json({ error: 'Intento no encontrado.' });
    if (attempt.status !== 'in_progress') {
      return res.status(409).json({ error: 'El examen ya fue finalizado.' });
    }
    if (new Date(attempt.expires_at).getTime() <= Date.now()) {
      return res.status(409).json({ error: 'Se agoto el tiempo del examen.' });
    }

    const questionId = Number(req.body.questionId);
    if (!attempt.question_ids.includes(questionId)) {
      return res.status(400).json({ error: 'Pregunta no valida para este examen.' });
    }
    const selected = Array.isArray(req.body.selectedOptionIds)
      ? [...new Set(req.body.selectedOptionIds.map(Number).filter((n) => Number.isInteger(n)))]
      : [];

    await pool.query(
      `INSERT INTO attempt_answers (attempt_id, question_id, selected_option_ids)
       VALUES ($1, $2, $3)
       ON CONFLICT (attempt_id, question_id)
       DO UPDATE SET selected_option_ids = EXCLUDED.selected_option_ids`,
      [attempt.id, questionId, JSON.stringify(selected)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /exam/answer', err);
    res.status(500).json({ error: 'No se pudo guardar la respuesta.' });
  }
});

// POST /api/exam/submit
router.post('/submit', requireAttempt, async (req, res) => {
  try {
    const attempt = await gradeAttempt(pool, req.attemptId);
    if (!attempt) return res.status(404).json({ error: 'Intento no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /exam/submit', err);
    res.status(500).json({ error: 'No se pudo finalizar el examen.' });
  }
});

// GET /api/exam/result
router.get('/result', requireAttempt, async (req, res) => {
  try {
    let { rows } = await pool.query('SELECT * FROM attempts WHERE id = $1', [req.attemptId]);
    let attempt = rows[0];
    if (!attempt) return res.status(404).json({ error: 'Intento no encontrado.' });
    if (attempt.status !== 'completed') {
      attempt = await gradeAttempt(pool, attempt.id);
    }

    const config = await getConfig();
    const total = attempt.question_ids.length;
    const score = Number(attempt.score);
    const correctCount = Math.round((score / 100) * total);

    const showReview =
      config.review_mode === 'always' ||
      (config.review_mode === 'if_passed' && attempt.passed);

    const payload = {
      examTitle: config.exam_title,
      studentName: attempt.student_name,
      score,
      passed: attempt.passed,
      passPercentage: config.pass_percentage,
      totalQuestions: total,
      correctCount,
      finishedAt: attempt.finished_at,
      reviewAvailable: showReview,
    };
    if (showReview) {
      payload.review = await buildReview(pool, attempt);
    }
    res.json(payload);
  } catch (err) {
    console.error('GET /exam/result', err);
    res.status(500).json({ error: 'No se pudo cargar el resultado.' });
  }
});

// POST /api/exam/flag  (anti-trampa: registra que el estudiante salio del examen)
router.post('/flag', requireAttempt, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE attempts SET tab_switches = tab_switches + 1
         WHERE id = $1 AND status = 'in_progress'
         RETURNING tab_switches`,
      [req.attemptId]
    );
    res.json({ ok: true, tabSwitches: rows.length ? rows[0].tab_switches : 0 });
  } catch (err) {
    console.error('POST /exam/flag', err);
    res.status(500).json({ error: 'No se pudo registrar el evento.' });
  }
});

// GET /api/exam/info  (publico: solo el titulo para la pantalla de ingreso)
router.get('/info', async (_req, res) => {
  try {
    const config = await getConfig();
    res.json({ examTitle: config.exam_title });
  } catch {
    res.json({ examTitle: 'Examen de Certificacion Lean Process Implementer' });
  }
});

module.exports = router;

// Exportado para pruebas/utilidades
module.exports.generateCode = generateCode;
