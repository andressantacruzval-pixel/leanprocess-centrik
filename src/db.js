const { Pool } = require('pg');
const config = require('./config');

if (!config.databaseUrl) {
  console.error('ERROR: falta la variable DATABASE_URL. Copia .env.example a .env y configurala.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.ssl,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS exam_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  exam_title TEXT NOT NULL DEFAULT 'Examen de Certificacion Lean Process Implementer',
  questions_per_exam INTEGER NOT NULL DEFAULT 20,
  pass_percentage INTEGER NOT NULL DEFAULT 70,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_attempts INTEGER NOT NULL DEFAULT 2,
  shuffle_questions BOOLEAN NOT NULL DEFAULT true,
  shuffle_options BOOLEAN NOT NULL DEFAULT true,
  review_mode TEXT NOT NULL DEFAULT 'if_passed',
  CONSTRAINT exam_config_single_row CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
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
  code TEXT NOT NULL UNIQUE,
  student_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY,
  access_code_id INTEGER NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
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

INSERT INTO exam_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Migraciones para bases de datos ya existentes.
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS student_email TEXT;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS tab_switches INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS smtp_host TEXT;
ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS smtp_port INTEGER NOT NULL DEFAULT 587;
ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS smtp_user TEXT;
ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS smtp_pass TEXT;
ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS smtp_from TEXT;
ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS email_subject_pass TEXT
  NOT NULL DEFAULT 'Resultado de tu examen - {examen}';
ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS email_body_pass TEXT
  NOT NULL DEFAULT 'Hola {nombre},

Felicitaciones. Has APROBADO el examen "{examen}" con una calificacion de {puntaje}.

El equipo de certificacion se pondra en contacto contigo para los siguientes pasos.

Saludos cordiales.';
ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS email_subject_fail TEXT
  NOT NULL DEFAULT 'Resultado de tu examen - {examen}';
ALTER TABLE exam_config ADD COLUMN IF NOT EXISTS email_body_fail TEXT
  NOT NULL DEFAULT 'Hola {nombre},

Has finalizado el examen "{examen}" con una calificacion de {puntaje}. El resultado es REPROBADO (el minimo para aprobar es {minimo}).

Puedes consultar con el administrador sobre la disponibilidad de nuevos intentos.

Saludos cordiales.';
`;

async function initSchema() {
  await pool.query(SCHEMA);
  console.log('Esquema de base de datos verificado.');
}

module.exports = { pool, initSchema };
