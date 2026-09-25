import { Router } from 'express'
import { pool } from './db.js'

export const router = Router()

function isSameDay(a, b) {
  const da = new Date(a)
  const db_ = new Date(b)
  return da.getFullYear() === db_.getFullYear() && da.getMonth() === db_.getMonth() && da.getDate() === db_.getDate()
}

/** Groups quiz_sessions rows by groupId into one attempt summary each, same shape as the old Dexie-backed getAttempts(). */
function summarizeAttempts(sessions) {
  const byGroup = new Map()
  for (const s of sessions) {
    const list = byGroup.get(s.groupId) ?? []
    list.push(s)
    byGroup.set(s.groupId, list)
  }
  const attempts = []
  for (const [groupId, rounds] of byGroup) {
    rounds.sort((a, b) => a.round - b.round)
    const first = rounds[0]
    const last = rounds[rounds.length - 1]
    attempts.push({
      groupId,
      wordSetId: first.wordSetId,
      wordSetTitle: first.wordSetTitle,
      firstRoundSessionId: first.id,
      startedAt: first.startedAt,
      lastFinishedAt: last.finishedAt,
      totalQuestions: first.totalQuestions,
      correctCount: first.correctCount,
      wrongCount: first.wrongCount,
      accuracy: first.totalQuestions > 0 ? Math.round((first.correctCount / first.totalQuestions) * 100) : 0,
      totalDurationMs: rounds.reduce((sum, r) => sum + r.durationMs, 0),
      roundsTaken: rounds.length,
      mastered: rounds.some((r) => r.wrongCount === 0),
    })
  }
  attempts.sort((a, b) => b.startedAt - a.startedAt)
  return attempts
}

/**
 * 같은 테스트(group_id)의 같은 라운드가 여러 번 저장된 기록이 있다. 예전에는 "마치기"를
 * 여러 번 누르면 그때마다 다시 저장됐기 때문이다. 집계(소요 시간, 정답률, 틀린 횟수)에는
 * 가장 먼저 저장된 하나만 쓰고, 나머지 중복은 원본만 남겨 두고 세지 않는다.
 * `s`는 quiz_sessions의 별칭이어야 한다.
 */
const FIRST_SAVE_ONLY = `s.id = (SELECT MIN(d.id) FROM quiz_sessions d WHERE d.group_id = s.group_id AND d.round = s.round)`

async function fetchAllSessions() {
  const { rows } = await pool.query(`
    SELECT s.id, s.group_id AS "groupId", s.word_set_id AS "wordSetId", s.word_set_title AS "wordSetTitle",
           s.round, s.started_at AS "startedAt", s.finished_at AS "finishedAt", s.duration_ms AS "durationMs",
           s.total_questions AS "totalQuestions", s.correct_count AS "correctCount", s.wrong_count AS "wrongCount"
    FROM quiz_sessions s
    WHERE ${FIRST_SAVE_ONLY}
    ORDER BY s.started_at DESC
  `)
  return rows
}

/**
 * 오답 노트 갱신. 틀리면 노트에 담고(이미 있으면 횟수 +1, 다시 '남은 단어'로),
 * 이후 다른 테스트의 첫 라운드에서 맞히면 '외운 단어'로 옮긴다.
 * (같은 테스트의 복습 라운드에서 맞힌 것은 외운 것으로 치지 않는다.)
 */
async function updateWrongNote(client, answer, { groupId, round, finishedAt }) {
  if (!answer.correct) {
    await client.query(
      `INSERT INTO wrong_notes (word_id, wrong_count, last_wrong_at, last_wrong_group_id)
       SELECT id, 1, $2::bigint, $3::text FROM words WHERE id = $1
       ON CONFLICT (word_id) DO UPDATE SET
         wrong_count = wrong_notes.wrong_count + 1,
         last_wrong_at = $2::bigint,
         last_wrong_group_id = $3::text,
         resolved_at = NULL`,
      [answer.wordId, finishedAt, groupId],
    )
  } else if (round === 1) {
    await client.query(
      `UPDATE wrong_notes SET resolved_at = $2::bigint
       WHERE word_id = $1 AND resolved_at IS NULL AND last_wrong_group_id <> $3::text`,
      [answer.wordId, finishedAt, groupId],
    )
  }
}

// ---- word sets ----

router.get('/wordsets', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT ws.id, ws.title, ws.created_at AS "createdAt", COUNT(w.id)::int AS count
    FROM word_sets ws
    LEFT JOIN words w ON w.word_set_id = ws.id
    GROUP BY ws.id
    ORDER BY ws.created_at DESC
  `)
  res.json(rows)
})

router.get('/wordsets/latest', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, created_at AS "createdAt" FROM word_sets ORDER BY created_at DESC LIMIT 1`,
  )
  res.json(rows[0] ?? null)
})

router.get('/wordsets/attempt-counts', async (_req, res) => {
  // 단어장 하나로만 진행한 테스트(1라운드 기준)의 횟수. 여러 단어장을 묶어서 본 테스트는
  // 특정 단어장 하나에 속하지 않으므로(word_set_id NULL) 세지 않는다.
  const { rows } = await pool.query(`
    SELECT word_set_id AS "wordSetId", COUNT(DISTINCT group_id)::int AS count
    FROM quiz_sessions
    WHERE round = 1 AND word_set_id IS NOT NULL
    GROUP BY word_set_id
  `)
  res.json(rows)
})

router.get('/wordsets/:id', async (req, res) => {
  const { rows } = await pool.query(`SELECT id, title, created_at AS "createdAt" FROM word_sets WHERE id = $1`, [
    req.params.id,
  ])
  if (!rows[0]) return res.status(404).json({ error: 'not found' })
  res.json(rows[0])
})

router.get('/wordsets/:id/words', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, word_set_id AS "wordSetId", term, meaning, is_idiom AS "isIdiom", part_of_speech AS "partOfSpeech"
     FROM words WHERE word_set_id = $1 ORDER BY id`,
    [req.params.id],
  )
  res.json(rows)
})

router.post('/wordsets', async (req, res) => {
  const { title, words } = req.body
  if (!title || !Array.isArray(words)) return res.status(400).json({ error: 'title and words[] required' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const {
      rows: [wordSet],
    } = await client.query(`INSERT INTO word_sets (title, created_at) VALUES ($1, $2) RETURNING id`, [
      title,
      Date.now(),
    ])
    for (const w of words) {
      await client.query(
        `INSERT INTO words (word_set_id, term, meaning, is_idiom, part_of_speech) VALUES ($1, $2, $3, $4, $5)`,
        [wordSet.id, w.term, w.meaning, !!w.isIdiom, w.partOfSpeech ?? null],
      )
    }
    await client.query('COMMIT')
    res.json({ id: wordSet.id })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

router.patch('/wordsets/:id', async (req, res) => {
  const { title } = req.body
  await pool.query(`UPDATE word_sets SET title = $1 WHERE id = $2`, [title, req.params.id])
  res.json({ ok: true })
})

// ---- words ----

router.post('/words', async (req, res) => {
  const { wordSetId, term, meaning, isIdiom, partOfSpeech } = req.body
  const {
    rows: [row],
  } = await pool.query(
    `INSERT INTO words (word_set_id, term, meaning, is_idiom, part_of_speech) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [wordSetId, term ?? '', meaning ?? '', !!isIdiom, partOfSpeech ?? null],
  )
  res.json({ id: row.id })
})

router.patch('/words/:id', async (req, res) => {
  const { term, meaning, isIdiom, partOfSpeech } = req.body
  await pool.query(
    `UPDATE words SET
       term = COALESCE($1, term),
       meaning = COALESCE($2, meaning),
       is_idiom = COALESCE($3, is_idiom),
       part_of_speech = COALESCE($4, part_of_speech)
     WHERE id = $5`,
    [term, meaning, isIdiom, partOfSpeech, req.params.id],
  )
  res.json({ ok: true })
})

router.delete('/words/:id', async (req, res) => {
  await pool.query(`DELETE FROM words WHERE id = $1`, [req.params.id])
  res.json({ ok: true })
})

// ---- quiz rounds ----

router.post('/quiz-rounds', async (req, res) => {
  const { groupId, wordSetId, wordSetTitle, round, startedAt, finishedAt, answers } = req.body
  if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers[] required' })

  const correctCount = answers.filter((a) => a.correct).length
  const wrongCount = answers.length - correctCount

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // 같은 라운드가 동시에/반복해서 들어와도 한 번만 저장한다 (연타, 재시도, 네트워크 재전송).
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${groupId}:${round}`])
    const {
      rows: [existing],
    } = await client.query(`SELECT id FROM quiz_sessions WHERE group_id = $1 AND round = $2 ORDER BY id LIMIT 1`, [
      groupId,
      round,
    ])
    if (existing) {
      await client.query('COMMIT')
      return res.json({ sessionId: existing.id, duplicate: true })
    }
    const {
      rows: [session],
    } = await client.query(
      `INSERT INTO quiz_sessions
         (group_id, word_set_id, word_set_title, round, started_at, finished_at, duration_ms, total_questions, correct_count, wrong_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [groupId, wordSetId, wordSetTitle, round, startedAt, finishedAt, finishedAt - startedAt, answers.length, correctCount, wrongCount],
    )
    for (const a of answers) {
      await client.query(
        `INSERT INTO quiz_answers (session_id, word_id, question_type, term, meaning, correct_answer, user_answer, correct)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [session.id, a.wordId, a.questionType, a.term, a.meaning, a.correctAnswer, a.userAnswer, a.correct],
      )
      await updateWrongNote(client, a, { groupId, round, finishedAt })
    }
    await client.query('COMMIT')
    res.json({ sessionId: session.id })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

// ---- parent dashboard ----

router.get('/attempts', async (_req, res) => {
  res.json(summarizeAttempts(await fetchAllSessions()))
})

router.get('/attempts/:groupId', async (req, res) => {
  const { rows: rounds } = await pool.query(
    `SELECT s.id, s.group_id AS "groupId", s.word_set_id AS "wordSetId", s.word_set_title AS "wordSetTitle",
            s.round, s.started_at AS "startedAt", s.finished_at AS "finishedAt", s.duration_ms AS "durationMs",
            s.total_questions AS "totalQuestions", s.correct_count AS "correctCount", s.wrong_count AS "wrongCount"
     FROM quiz_sessions s WHERE s.group_id = $1 AND ${FIRST_SAVE_ONLY} ORDER BY s.round`,
    [req.params.groupId],
  )
  const sessionIds = rounds.map((r) => r.id)
  const { rows: answers } =
    sessionIds.length === 0
      ? { rows: [] }
      : await pool.query(
          `SELECT id, session_id AS "sessionId", word_id AS "wordId", question_type AS "questionType",
                  term, meaning, correct_answer AS "correctAnswer", user_answer AS "userAnswer", correct
           FROM quiz_answers WHERE session_id = ANY($1::int[]) ORDER BY id`,
          [sessionIds],
        )
  res.json({ rounds, answers })
})

router.get('/missed-words', async (req, res) => {
  const limit = Number(req.query.limit) || 5
  const { rows: wrongAnswers } = await pool.query(
    `SELECT a.term, a.meaning
     FROM quiz_answers a
     JOIN quiz_sessions s ON s.id = a.session_id
     WHERE a.correct = false AND ${FIRST_SAVE_ONLY}`,
  )
  const counts = new Map()
  for (const a of wrongAnswers) {
    const entry = counts.get(a.term) ?? { term: a.term, meaning: a.meaning, wrong: 0 }
    entry.wrong += 1
    counts.set(a.term, entry)
  }
  const top = Array.from(counts.values())
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, limit)
  res.json(top)
})

// ---- wrong notes ----

router.get('/wrong-notes', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT n.word_id AS "wordId", w.term, w.meaning, w.is_idiom AS "isIdiom", w.part_of_speech AS "partOfSpeech",
           w.word_set_id AS "wordSetId", ws.title AS "wordSetTitle",
           n.wrong_count AS "wrongCount", n.last_wrong_at AS "lastWrongAt", n.resolved_at AS "resolvedAt"
    FROM wrong_notes n
    JOIN words w ON w.id = n.word_id
    JOIN word_sets ws ON ws.id = w.word_set_id
    ORDER BY n.last_wrong_at DESC
  `)
  res.json(rows)
})

router.patch('/wrong-notes/:wordId', async (req, res) => {
  const resolved = req.body?.resolved
  if (typeof resolved !== 'boolean') return res.status(400).json({ error: 'resolved (boolean) required' })
  const { rowCount } = await pool.query(`UPDATE wrong_notes SET resolved_at = $2::bigint WHERE word_id = $1`, [
    req.params.wordId,
    resolved ? Date.now() : null,
  ])
  if (rowCount === 0) return res.status(404).json({ error: 'not found' })
  res.json({ ok: true })
})

router.get('/home-stats', async (_req, res) => {
  const {
    rows: [{ count: totalWords }],
  } = await pool.query(`SELECT COUNT(*)::int AS count FROM words`)
  const attempts = summarizeAttempts(await fetchAllSessions())

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recent = attempts.filter((a) => a.startedAt >= weekAgo)
  const weeklyAccuracy =
    recent.length > 0 ? Math.round(recent.reduce((sum, a) => sum + a.accuracy, 0) / recent.length) : 0

  let streakDays = 0
  if (attempts.length > 0) {
    const days = Array.from(new Set(attempts.map((a) => new Date(a.startedAt).toDateString())))
      .map((d) => new Date(d).getTime())
      .sort((a, b) => b - a)
    let cursor = Date.now()
    for (const day of days) {
      if (isSameDay(day, cursor) || isSameDay(day, cursor - 24 * 60 * 60 * 1000)) {
        streakDays += 1
        cursor = day
      } else {
        break
      }
    }
  }

  const {
    rows: [{ count: wrongNoteCount }],
  } = await pool.query(`SELECT COUNT(*)::int AS count FROM wrong_notes WHERE resolved_at IS NULL`)

  res.json({ totalWords, totalAttempts: attempts.length, weeklyAccuracy, streakDays, wrongNoteCount })
})
