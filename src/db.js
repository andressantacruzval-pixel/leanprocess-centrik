const { Pool } = require('pg');
const config = require('./config');

if (!config.databaseUrl) {
  console.error('ERROR: falta la variable DATABASE_URL. Copia .env.example a .env y configurala.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.ssl,
  max: 5,
  idleTimeoutMillis: 20000,
});

const SCHEMA = `
-- Ajustes globales de la plataforma (servidor de correo).
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  smtp_host TEXT,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_secure BOOLEAN NOT NULL DEFAULT false,
  smtp_user TEXT,
  smtp_pass TEXT,
  smtp_from TEXT,
  CONSTRAINT app_settings_single_row CHECK (id = 1)
);

-- Cada examen representa una certificacion con su propia configuracion.
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  questions_per_exam INTEGER NOT NULL DEFAULT 20,
  pass_percentage INTEGER NOT NULL DEFAULT 70,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_attempts INTEGER NOT NULL DEFAULT 2,
  shuffle_questions BOOLEAN NOT NULL DEFAULT true,
  shuffle_options BOOLEAN NOT NULL DEFAULT true,
  review_mode TEXT NOT NULL DEFAULT 'if_passed',
  is_active BOOLEAN NOT NULL DEFAULT true,
  email_subject_pass TEXT NOT NULL DEFAULT 'Resultado de tu examen - {examen}',
  email_body_pass TEXT NOT NULL DEFAULT 'Hola {nombre},

Felicitaciones. Has APROBADO el examen "{examen}" con una calificacion de {puntaje}.

El equipo de certificacion se pondra en contacto contigo para los siguientes pasos.

Saludos cordiales.',
  email_subject_fail TEXT NOT NULL DEFAULT 'Resultado de tu examen - {examen}',
  email_body_fail TEXT NOT NULL DEFAULT 'Hola {nombre},

Has finalizado el examen "{examen}" con una calificacion de {puntaje}. El resultado es REPROBADO (el minimo para aprobar es {minimo}).

Puedes consultar con el administrador sobre la disponibilidad de nuevos intentos.

Saludos cordiales.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  category TEXT,
  difficulty TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS access_codes (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  student_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY,
  access_code_id INTEGER NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
  exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT,
  question_ids JSONB NOT NULL,
  option_order JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress',
  score NUMERIC(5,2),
  passed BOOLEAN,
  tab_switches INTEGER NOT NULL DEFAULT 0,
  email_sent BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS attempt_answers (
  attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  selected_option_ids JSONB NOT NULL DEFAULT '[]',
  PRIMARY KEY (attempt_id, question_id)
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Migraciones idempotentes para bases de datos de versiones anteriores.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS student_email TEXT;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS tab_switches INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT false;
`;

// Crea el primer examen y migra datos de la version anterior (tabla exam_config)
// hacia el modelo de multiples examenes.
async function migrateAndSeed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Evita que dos arranques concurrentes (serverless) siembren a la vez.
    await client.query('SELECT pg_advisory_xact_lock($1)', [727274]);
    const { rows: examCount } = await client.query('SELECT COUNT(*)::int AS n FROM exams');
    if (examCount[0].n === 0) {
      const { rows: reg } = await client.query(
        "SELECT to_regclass('public.exam_config') AS t"
      );
      let legacy = null;
      if (reg[0].t) {
        const { rows } = await client.query('SELECT * FROM exam_config WHERE id = 1');
        legacy = rows[0] || null;
      }
      const e = legacy || {};
      const cols = [
        'name', 'questions_per_exam', 'pass_percentage', 'duration_minutes',
        'max_attempts', 'shuffle_questions', 'shuffle_options', 'review_mode',
      ];
      const vals = [
        e.exam_title || 'Examen de Certificacion Lean Process Implementer',
        e.questions_per_exam || 20,
        e.pass_percentage || 70,
        e.duration_minutes || 60,
        e.max_attempts || 2,
        e.shuffle_questions != null ? e.shuffle_questions : true,
        e.shuffle_options != null ? e.shuffle_options : true,
        e.review_mode || 'if_passed',
      ];
      // Conserva las plantillas de correo si existian en la version anterior.
      const optional = [
        ['email_subject_pass', e.email_subject_pass],
        ['email_body_pass', e.email_body_pass],
        ['email_subject_fail', e.email_subject_fail],
        ['email_body_fail', e.email_body_fail],
      ];
      for (const [col, val] of optional) {
        if (val) {
          cols.push(col);
          vals.push(val);
        }
      }
      const placeholders = vals.map((_, i) => '$' + (i + 1)).join(', ');
      const { rows: ins } = await client.query(
        `INSERT INTO exams (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
        vals
      );
      const examId = ins[0].id;

      await client.query('UPDATE questions SET exam_id = $1 WHERE exam_id IS NULL', [examId]);
      await client.query('UPDATE access_codes SET exam_id = $1 WHERE exam_id IS NULL', [examId]);
      await client.query('UPDATE attempts SET exam_id = $1 WHERE exam_id IS NULL', [examId]);

      if (legacy) {
        await client.query(
          `UPDATE app_settings SET
             email_enabled = $1, smtp_host = $2, smtp_port = $3, smtp_secure = $4,
             smtp_user = $5, smtp_pass = $6, smtp_from = $7
           WHERE id = 1`,
          [
            legacy.email_enabled || false,
            legacy.smtp_host || null,
            legacy.smtp_port || 587,
            legacy.smtp_secure || false,
            legacy.smtp_user || null,
            legacy.smtp_pass || null,
            legacy.smtp_from || null,
          ]
        );
      }
      console.log(`Examen inicial creado (id ${examId}).`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Verifica el esquema una sola vez por instancia (apto para entornos serverless).
let schemaPromise;
function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(SCHEMA);
      await migrateAndSeed();
      console.log('Esquema de base de datos verificado.');
    })();
    // Si falla, permite reintentar en la siguiente solicitud.
    schemaPromise.catch(() => {
      schemaPromise = undefined;
    });
  }
  return schemaPromise;
}

module.exports = { pool, ensureSchema };
