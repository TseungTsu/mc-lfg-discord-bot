const path = require('node:path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'games.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    channel_id    TEXT NOT NULL,
    message_id    TEXT,
    requester_id  TEXT NOT NULL,
    day           TEXT NOT NULL,
    time          TEXT NOT NULL,
    scheduled_at  INTEGER NOT NULL, -- unix seconds, resolved from day+time
    location      TEXT NOT NULL,
    note          TEXT,
    army          TEXT,             -- requester's optional "what army" answer
    mission       TEXT,             -- requester's optional primary mission pick
    status        TEXT NOT NULL DEFAULT 'open', -- open | confirmed | cancelled
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rsvps (
    game_id     INTEGER NOT NULL,
    user_id     TEXT NOT NULL,
    army        TEXT,               -- RSVP'er's optional "what army" answer
    created_at  INTEGER NOT NULL,
    PRIMARY KEY (game_id, user_id),
    FOREIGN KEY (game_id) REFERENCES games(id)
  );
`);

function createGame({ guildId, channelId, requesterId, day, time, scheduledAt, location, note, army, mission }) {
  const stmt = db.prepare(`
    INSERT INTO games (guild_id, channel_id, requester_id, day, time, scheduled_at, location, note, army, mission, status, created_at)
    VALUES (@guildId, @channelId, @requesterId, @day, @time, @scheduledAt, @location, @note, @army, @mission, 'open', @createdAt)
  `);
  const info = stmt.run({
    guildId,
    channelId,
    requesterId,
    day,
    time,
    scheduledAt,
    location,
    note: note || null,
    army: army || null,
    mission: mission || null,
    createdAt: Date.now(),
  });
  return getGame(info.lastInsertRowid);
}

function getGame(id) {
  return db.prepare('SELECT * FROM games WHERE id = ?').get(id);
}

function setMessageId(id, messageId) {
  db.prepare('UPDATE games SET message_id = ? WHERE id = ?').run(messageId, id);
}

function setStatus(id, status) {
  db.prepare('UPDATE games SET status = ? WHERE id = ?').run(status, id);
}

function addRsvp(gameId, userId, army) {
  db.prepare(`
    INSERT OR IGNORE INTO rsvps (game_id, user_id, army, created_at) VALUES (?, ?, ?, ?)
  `).run(gameId, userId, army || null, Date.now());
}

function removeRsvp(gameId, userId) {
  db.prepare('DELETE FROM rsvps WHERE game_id = ? AND user_id = ?').run(gameId, userId);
}

function hasRsvp(gameId, userId) {
  return !!db.prepare('SELECT 1 FROM rsvps WHERE game_id = ? AND user_id = ?').get(gameId, userId);
}

// Returns [{ userId, army }]
function getRsvps(gameId) {
  return db.prepare('SELECT user_id, army FROM rsvps WHERE game_id = ? ORDER BY created_at ASC')
    .all(gameId)
    .map(r => ({ userId: r.user_id, army: r.army }));
}

function listOpenGames(guildId) {
  return db.prepare(`
    SELECT * FROM games WHERE guild_id = ? AND status = 'open' ORDER BY scheduled_at ASC
  `).all(guildId);
}

module.exports = {
  createGame,
  getGame,
  setMessageId,
  setStatus,
  addRsvp,
  removeRsvp,
  hasRsvp,
  getRsvps,
  listOpenGames,
};
