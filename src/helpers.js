const { sendResultEmail } = require('./mailer');

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  let body = '';
  for (let i = 0; i < 8; i++) {
    body += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `LPI-${body}`;
}

// Devuelve las preguntas de un intento SIN revelar cuales opciones son correctas.
async function getAttemptQuestions(pool, attempt) {
  const qids = attempt.question_ids;
  if (!qids.length) return [];

  const { rows: qs } = await pool.query(
    'SELECT id, text, category FROM questions WHERE id = ANY($1)',
    [qids]
  );
  const { rows: opts } = await pool.query(
    'SELECT id, question_id, text, is_correct FROM options WHERE question_id = ANY($1)',
    [qids]
  );

  const qMap = {};
  qs.forEach((q) => (qMap[q.id] = q));
  const optMap = {};
  opts.forEach((o) => {
    (optMap[o.question_id] = optMap[o.question_id] || []).push(o);
  });

  const order = attempt.option_order || {};
  return qids
    .map((qid, index) => {
      const q = qMap[qid];
      if (!q) return null;
      const theseOpts = optMap[qid] || [];
      const byId = {};
      theseOpts.forEach((o) => (byId[o.id] = o));
      const ord = order[qid] || theseOpts.map((o) => o.id);
      const correctCount = theseOpts.filter((o) => o.is_correct).length;
      return {
        id: q.id,
        number: index + 1,
        text: q.text,
        category: q.category,
        multiple: correctCount > 1,
        options: ord
          .map((oid) => byId[oid])
          .filter(Boolean)
          .map((o) => ({ id: o.id, text: o.text })),
      };
    })
    .filter(Boolean);
}

function setsEqual(a, b) {
  if (a.size !== b.size || a.size === 0) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// Califica un intento y lo marca como completado. Idempotente.
async function gradeAttempt(pool, attemptId) {
  const { rows: attemptRows } = await pool.query('SELECT * FROM attempts WHERE id = $1', [attemptId]);
  const attempt = attemptRows[0];
  if (!attempt) return null;
  if (attempt.status === 'completed') return attempt;

  const qids = attempt.question_ids;
  const { rows: opts } = await pool.query(
    'SELECT id, question_id, is_correct FROM options WHERE question_id = ANY($1)',
    [qids]
  );
  const correctByQ = {};
  for (const o of opts) {
    correctByQ[o.question_id] = correctByQ[o.question_id] || new Set();
    if (o.is_correct) correctByQ[o.question_id].add(o.id);
  }

  const { rows: answers } = await pool.query(
    'SELECT question_id, selected_option_ids FROM attempt_answers WHERE attempt_id = $1',
    [attemptId]
  );
  const selByQ = {};
  for (const a of answers) {
    selByQ[a.question_id] = new Set((a.selected_option_ids || []).map(Number));
  }

  let correctCount = 0;
  for (const qid of qids) {
    const correct = correctByQ[qid] || new Set();
    const selected = selByQ[qid] || new Set();
    if (setsEqual(correct, selected)) correctCount++;
  }

  const total = qids.length;
  const score = total ? Math.round((correctCount / total) * 10000) / 100 : 0;

  const { rows: examRows } = await pool.query('SELECT * FROM exams WHERE id = $1', [attempt.exam_id]);
  const exam = examRows[0];
  const passPct = exam ? exam.pass_percentage : 100;
  const passed = score >= passPct;

  const { rows: updated } = await pool.query(
    `UPDATE attempts
        SET status = 'completed', finished_at = now(), score = $2, passed = $3
      WHERE id = $1
      RETURNING *`,
    [attemptId, score, passed]
  );
  const result = updated[0];

  // Notificacion por correo al estudiante (sin bloquear la respuesta HTTP).
  if (exam && result.student_email && !result.email_sent) {
    pool
      .query('SELECT * FROM app_settings WHERE id = 1')
      .then(({ rows }) => {
        const settings = rows[0];
        if (settings && settings.email_enabled) {
          return sendResultEmail(settings, exam, result);
        }
        return false;
      })
      .then((sent) => {
        if (sent) {
          return pool.query('UPDATE attempts SET email_sent = true WHERE id = $1', [attemptId]);
        }
      })
      .catch((err) => console.error('Error al enviar correo de resultado:', err.message));
  }

  return result;
}

// Construye el detalle de revision (con respuestas correctas) de un intento ya calificado.
async function buildReview(pool, attempt) {
  const qids = attempt.question_ids;
  const { rows: qs } = await pool.query(
    'SELECT id, text, category FROM questions WHERE id = ANY($1)',
    [qids]
  );
  const { rows: opts } = await pool.query(
    'SELECT id, question_id, text, is_correct FROM options WHERE question_id = ANY($1)',
    [qids]
  );
  const { rows: answers } = await pool.query(
    'SELECT question_id, selected_option_ids FROM attempt_answers WHERE attempt_id = $1',
    [attempt.id]
  );

  const qMap = {};
  qs.forEach((q) => (qMap[q.id] = q));
  const optMap = {};
  opts.forEach((o) => {
    (optMap[o.question_id] = optMap[o.question_id] || []).push(o);
  });
  const selByQ = {};
  answers.forEach((a) => {
    selByQ[a.question_id] = new Set((a.selected_option_ids || []).map(Number));
  });

  const order = attempt.option_order || {};
  return qids.map((qid, index) => {
    const q = qMap[qid] || { text: '(pregunta eliminada)', category: null };
    const theseOpts = optMap[qid] || [];
    const byId = {};
    theseOpts.forEach((o) => (byId[o.id] = o));
    const ord = order[qid] || theseOpts.map((o) => o.id);
    const selected = selByQ[qid] || new Set();
    const correctSet = new Set(theseOpts.filter((o) => o.is_correct).map((o) => o.id));
    const isCorrect = setsEqual(correctSet, selected);
    return {
      number: index + 1,
      text: q.text,
      category: q.category,
      isCorrect,
      options: ord
        .map((oid) => byId[oid])
        .filter(Boolean)
        .map((o) => ({
          text: o.text,
          isCorrect: o.is_correct,
          wasSelected: selected.has(o.id),
        })),
    };
  });
}

module.exports = { shuffle, generateCode, getAttemptQuestions, gradeAttempt, buildReview };
