import pg from 'pg'

// BIGINT (OID 20) columns -- epoch-ms timestamps, COUNT(*) -- come back from
// node-postgres as strings by default (BIGINT can exceed JS's safe integer
// range). Our values never do, so parse them back to numbers.
pg.types.setTypeParser(20, (val) => parseInt(val, 10))

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? '')

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS word_sets (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS words (
      id SERIAL PRIMARY KEY,
      word_set_id INTEGER NOT NULL REFERENCES word_sets(id) ON DELETE CASCADE,
      term TEXT NOT NULL,
      meaning TEXT NOT NULL,
      is_idiom BOOLEAN NOT NULL DEFAULT false,
      part_of_speech TEXT
    );

    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id SERIAL PRIMARY KEY,
      group_id TEXT NOT NULL,
      word_set_id INTEGER NOT NULL REFERENCES word_sets(id) ON DELETE CASCADE,
      word_set_title TEXT NOT NULL,
      round INTEGER NOT NULL,
      started_at BIGINT NOT NULL,
      finished_at BIGINT NOT NULL,
      duration_ms BIGINT NOT NULL,
      total_questions INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      wrong_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_answers (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
      word_id INTEGER NOT NULL,
      question_type TEXT NOT NULL,
      term TEXT NOT NULL,
      meaning TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      user_answer TEXT NOT NULL,
      correct BOOLEAN NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_words_word_set_id ON words(word_set_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_sessions_group_id ON quiz_sessions(group_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_sessions_started_at ON quiz_sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_quiz_answers_session_id ON quiz_answers(session_id);
  `)
}
