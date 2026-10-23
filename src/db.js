const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite'); // built into Node 22.5+, no native build needed

const CHARM_VALUE = 250_000;
const COOLDOWN_MS = 60 * 60 * 1000;

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'charm-log.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec(`
  CREATE TABLE IF NOT EXISTS contributors (
    user_id TEXT PRIMARY KEY,
    contribution INTEGER NOT NULL DEFAULT 0,
    charms INTEGER NOT NULL DEFAULT 0,
    last_charm_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS boards (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL
  );
`);

const stmts = {
  get: db.prepare('SELECT * FROM contributors WHERE user_id = ?'),
  insertIgnore: db.prepare('INSERT OR IGNORE INTO contributors (user_id) VALUES (?)'),
  addCharm: db.prepare(
    'UPDATE contributors SET contribution = contribution + ?, charms = charms + 1, last_charm_at = ? WHERE user_id = ?'
  ),
  setContribution: db.prepare('UPDATE contributors SET contribution = ? WHERE user_id = ?'),
  list: db.prepare('SELECT * FROM contributors ORDER BY contribution DESC, charms DESC'),
  totals: db.prepare(
    'SELECT COALESCE(SUM(contribution), 0) AS contribution, COALESCE(SUM(charms), 0) AS charms FROM contributors'
  ),
  getBoard: db.prepare('SELECT * FROM boards WHERE guild_id = ?'),
  listBoards: db.prepare('SELECT * FROM boards'),
  setBoard: db.prepare(
    `INSERT INTO boards (guild_id, channel_id, message_id) VALUES (?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id`
  ),
};

function getContributor(userId) {
  return stmts.get.get(userId) ?? null;
}

// Milliseconds until this user may log another charm (0 = allowed now).
function cooldownRemaining(userId, now = Date.now()) {
  const row = getContributor(userId);
  if (!row?.last_charm_at) return 0;
  return Math.max(0, row.last_charm_at + COOLDOWN_MS - now);
}

function logCharm(userId, now = Date.now()) {
  const remainingMs = cooldownRemaining(userId, now);
  if (remainingMs > 0) return { ok: false, remainingMs };
  stmts.insertIgnore.run(userId);
  stmts.addCharm.run(CHARM_VALUE, now, userId);
  return { ok: true, contributor: getContributor(userId) };
}

function setContribution(userId, amount) {
  const before = getContributor(userId)?.contribution ?? 0;
  stmts.insertIgnore.run(userId);
  stmts.setContribution.run(amount, userId);
  return { before, after: amount };
}

function listContributors() {
  return stmts.list.all();
}

function getTotals() {
  return stmts.totals.get();
}

// One live board per Discord server.
function getBoard(guildId) {
  const row = stmts.getBoard.get(guildId);
  return row ? { ...row } : null;
}

function setBoard(guildId, channelId, messageId) {
  stmts.setBoard.run(guildId, channelId, messageId);
}

function listBoards() {
  return stmts.listBoards.all();
}

module.exports = {
  CHARM_VALUE,
  COOLDOWN_MS,
  getContributor,
  cooldownRemaining,
  logCharm,
  setContribution,
  listContributors,
  getTotals,
  getBoard,
  setBoard,
  listBoards,
};
