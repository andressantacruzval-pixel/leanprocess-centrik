const express = require('express');
const { pool } = require('../db');
const { signAttempt, requireAttempt } = require('../auth');
const { shuffle, getAttemptQuestions, gradeAttempt, buildReview } = require('../helpers');

const router = express.Router();

async function getExam(id) {
  const { rows } = await pool.query('SELECT * FROM exams WHERE id = $1', [id]);
  return rows[0] || null;
}

// Construye el estado del examen para el frontend.
async function buildState(attempt, exam) {
  const base = {
    attemptId: attempt.id,
    status: attempt.status,
    examTitle: exam.name,
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
    durationMinutes: exam.duration_minutes,
    passPercentage: exam.pass_percentage,
    totalQuestions: questions.length,
  };
}

// POST /api/exam/start  { code, studentName, studentEmail }
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

    const exam = await getExam(accessCode.exam_id);
    if (!exam || !exam.is_active) {
      return res.status(403).json({
        error: 'El examen asociado a este codigo no esta disponible. Contacta al administrador.',
      });
    }

    // Finaliza intentos vencidos que sigan abiertos.
    const { rows: openRows } = await pool.query(
      `SELECT * FROM attempts WHERE access_code_id = $1 AND status = 'in_progress'`,
      [accessCode.id]
    );
    for (const open of openRows) {
      if (new Date(open.expires_at).getTime() <= Date.now()) {
        await gradeAttempt(pool, open.id);
      } else {
        const token = signAttempt(open.id);
        const state = await buildState(open, exam);
        return res.json({ token, ...state, resumed: true });
      }
    }

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS used FROM attempts WHERE access_code_id = $1 AND status = 'completed'`,
      [accessCode.id]
    );
    if (countRows[0].used >= exam.max_attempts) {
      return res.status(403).json({
        error: `Has agotado tus intentos (${exam.max_attempts}). Contacta al administrador.`,
      });
    }

    const { rows: bankRows } = await pool.query(
      'SELECT id FROM questions WHERE exam_id = $1 AND is_active = true',
      [exam.id]
    );
    if (bankRows.length < exam.questions_per_exam) {
      return res.status(409).json({
        error: 'El examen aun no esta disponible. Contacta al administrador.',
      });
    }

    let selected = bankRows.map((r) => r.id);
    selected = exam.shuffle_questions ? shuffle(selected) : selected;
    selected = selected.slice(0, exam.questions_per_exam);

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
      list = exam.shuffle_options
        ? shuffle(list)
        : list.sort((a, b) => a.position - b.position || a.id - b.id);
      optionOrder[qid] = list.map((o) => o.id);
    }

    const expiresAt = new Date(Date.now() + exam.duration_minutes * 60000);
    const { rows: created } = await pool.query(
      `INSERT INTO attempts
         (access_code_id, exam_id, student_name, student_email,
          question_ids, option_order, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        accessCode.id,
        exam.id,
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
    const state = await buildState(attempt, exam);
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
    const exam = await getExam(attempt.exam_id);
    if (!exam) return res.status(404).json({ error: 'Examen no encontrado.' });
    res.json(await buildState(attempt, exam));
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

    const exam = await getExam(attempt.exam_id);
    if (!exam) return res.status(404).json({ error: 'Examen no encontrado.' });

    const total = attempt.question_ids.length;
    const score = Number(attempt.score);
    const correctCount = Math.round((score / 100) * total);

    const showReview =
      exam.review_mode === 'always' ||
      (exam.review_mode === 'if_passed' && attempt.passed);

    const payload = {
      examTitle: exam.name,
      studentName: attempt.student_name,
      score,
      passed: attempt.passed,
      passPercentage: exam.pass_percentage,
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

module.exports = router;
