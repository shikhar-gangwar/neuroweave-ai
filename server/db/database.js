import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'neuroweave.db');

let db = null;

function initDB() {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create tables
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Developer',
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      mastery INTEGER DEFAULT 0,
      interactions INTEGER DEFAULT 0,
      last_studied DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, topic_id)
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      response_summary TEXT,
      topics_touched TEXT,
      source TEXT DEFAULT 'chat',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS learning_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, topic_id)
    );
  `);

    console.log('✅ Database initialized at', DB_PATH);
    return db;
}

function getDB() {
    if (!db) initDB();
    return db;
}

// --- User operations ---

function getOrCreateUser(userId = 'default') {
    const db = getDB();
    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
        db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(userId, 'Developer');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    }
    db.prepare('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    return user;
}

// --- Progress operations ---

function getUserProgress(userId) {
    const db = getDB();
    return db.prepare('SELECT topic_id, mastery, interactions, last_studied FROM progress WHERE user_id = ?').all(userId);
}

function getProgressMap(userId) {
    const rows = getUserProgress(userId);
    const map = {};
    rows.forEach(r => { map[r.topic_id] = r.mastery; });
    return map;
}

function updateTopicProgress(userId, topicId, masteryDelta = 5) {
    const db = getDB();
    const existing = db.prepare('SELECT mastery, interactions FROM progress WHERE user_id = ? AND topic_id = ?').get(userId, topicId);

    if (existing) {
        const newMastery = Math.min(100, existing.mastery + masteryDelta);
        db.prepare(`
      UPDATE progress SET mastery = ?, interactions = interactions + 1, last_studied = CURRENT_TIMESTAMP
      WHERE user_id = ? AND topic_id = ?
    `).run(newMastery, userId, topicId);
        return newMastery;
    } else {
        const initialMastery = Math.min(100, masteryDelta);
        db.prepare(`
      INSERT INTO progress (user_id, topic_id, mastery, interactions) VALUES (?, ?, ?, 1)
    `).run(userId, topicId, initialMastery);
        return initialMastery;
    }
}

function bulkUpdateProgress(userId, topics, delta = 3) {
    const db = getDB();
    const stmt = db.prepare(`
    INSERT INTO progress (user_id, topic_id, mastery, interactions)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(user_id, topic_id)
    DO UPDATE SET mastery = MIN(100, mastery + ?), interactions = interactions + 1, last_studied = CURRENT_TIMESTAMP
  `);

    const update = db.transaction((topics) => {
        for (const topicId of topics) {
            stmt.run(userId, topicId, delta, delta);
        }
    });
    update(topics);
}

// --- Interaction logging ---

function logInteraction(userId, query, responseSummary, topicsTouched, source = 'chat') {
    const db = getDB();
    db.prepare(`
    INSERT INTO interactions (user_id, query, response_summary, topics_touched, source) VALUES (?, ?, ?, ?, ?)
  `).run(userId, query, responseSummary, JSON.stringify(topicsTouched), source);
}

function getRecentInteractions(userId, limit = 20) {
    const db = getDB();
    return db.prepare('SELECT * FROM interactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit);
}

// --- Learning steps ---

function completeLearningStep(userId, topicId) {
    const db = getDB();
    db.prepare(`
    INSERT INTO learning_steps (user_id, topic_id, completed, completed_at)
    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, topic_id)
    DO UPDATE SET completed = 1, completed_at = CURRENT_TIMESTAMP
  `).run(userId, topicId);

    // Boost mastery when completing a step
    updateTopicProgress(userId, topicId, 15);
}

function getCompletedSteps(userId) {
    const db = getDB();
    return db.prepare('SELECT topic_id FROM learning_steps WHERE user_id = ? AND completed = 1').all(userId).map(r => r.topic_id);
}

export {
    initDB, getDB,
    getOrCreateUser,
    getUserProgress, getProgressMap, updateTopicProgress, bulkUpdateProgress,
    logInteraction, getRecentInteractions,
    completeLearningStep, getCompletedSteps,
};
