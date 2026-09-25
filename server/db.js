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

    -- 오답 노트: 틀린 적이 있는 단어 하나당 한 줄. resolved_at이 NULL이면 아직 노트에 남아 있는 단어.
    CREATE TABLE IF NOT EXISTS wrong_notes (
      word_id INTEGER PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      last_wrong_at BIGINT NOT NULL,
      last_wrong_group_id TEXT NOT NULL,
      resolved_at BIGINT
    );

    -- 오답 노트 테스트는 여러 단어장의 단어가 섞이므로 특정 단어장에 속하지 않는다.
    ALTER TABLE quiz_sessions ALTER COLUMN word_set_id DROP NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_words_word_set_id ON words(word_set_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_sessions_group_id ON quiz_sessions(group_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_sessions_started_at ON quiz_sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_quiz_answers_session_id ON quiz_answers(session_id);
  `)

  // 오답 노트 기능 이전의 틀린 기록으로 노트를 채운다. 이미 노트에 있는 단어는 건드리지 않는다.
  // 실패해도 서버 시작을 막지 않는다.
  try {
    await pool.query(`
      INSERT INTO wrong_notes (word_id, wrong_count, last_wrong_at, last_wrong_group_id)
      SELECT a.word_id,
             COUNT(*)::int,
             MAX(s.finished_at),
             (ARRAY_AGG(s.group_id ORDER BY s.finished_at DESC))[1]
      FROM quiz_answers a
      JOIN quiz_sessions s ON s.id = a.session_id
      WHERE a.correct = false AND a.word_id IN (SELECT id FROM words)
      GROUP BY a.word_id
      ON CONFLICT (word_id) DO NOTHING
    `)
  } catch (err) {
    console.error('wrong_notes backfill failed (continuing)', err)
  }

  // 같은 라운드가 중복 저장된 예전 기록 때문에 부풀려진 오답 노트의 틀린 횟수를, 중복을
  // 뺀(가장 먼저 저장된 것만) 기록 기준으로 다시 맞춘다. 원본 기록은 건드리지 않고, 몇 번을
  // 실행해도 같은 결과가 나온다. 실패해도 서버 시작을 막지 않는다.
  try {
    await pool.query(`
      UPDATE wrong_notes n SET wrong_count = c.cnt
      FROM (
        SELECT a.word_id, COUNT(*)::int AS cnt
        FROM quiz_answers a
        JOIN quiz_sessions s ON s.id = a.session_id
        WHERE a.correct = false
          AND s.id = (SELECT MIN(d.id) FROM quiz_sessions d WHERE d.group_id = s.group_id AND d.round = s.round)
        GROUP BY a.word_id
      ) c
      WHERE n.word_id = c.word_id AND n.wrong_count <> c.cnt
    `)
  } catch (err) {
    console.error('wrong_notes recount failed (continuing)', err)
  }
}
