const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite'); // built into Node 22.5+, no native build needed

const CHARM_VALUE = 250_000;
const COOLDOWN_MS = 60 * 60 * 1000;

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'charm-log.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');

// Contributors are kept per server: the same user has a separate ledger in each guild.
// Earlier builds had no guild_id column. Rebuild only when that table is empty, so no data is lost.
const hasGuildColumn = db
  .prepare("SELECT 1 FROM pragma_table_info('contributors') WHERE name = 'guild_id'")
  .get();
const tableExists = db
  .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'contributors'")
  .get();
if (tableExists && !hasGuildColumn) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM contributors').get();
  if (n > 0) throw new Error('contributors has rows without guild_id; migrate them before starting the bot');
  db.exec('DROP TABLE contributors');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS contributors (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    contribution INTEGER NOT NULL DEFAULT 0,
    charms INTEGER NOT NULL DEFAULT 0,
    last_charm_at INTEGER,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS boards (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL
  );
`);

const stmts = {
  get: db.prepare('SELECT * FROM contributors WHERE guild_id = ? AND user_id = ?'),
  insertIgnore: db.prepare('INSERT OR IGNORE INTO contributors (guild_id, user_id) VALUES (?, ?)'),
  addCharm: db.prepare(
    'UPDATE contributors SET contribution = contribution + ?, charms = charms + 1, last_charm_at = ? WHERE guild_id = ? AND user_id = ?'
  ),
  setContribution: db.prepare('UPDATE contributors SET contribution = ? WHERE guild_id = ? AND user_id = ?'),
  list: db.prepare(
    'SELECT * FROM contributors WHERE guild_id = ? ORDER BY contribution DESC, charms DESC'
  ),
  totals: db.prepare(
    'SELECT COALESCE(SUM(contribution), 0) AS contribution, COALESCE(SUM(charms), 0) AS charms FROM contributors WHERE guild_id = ?'
  ),
  getBoard: db.prepare('SELECT * FROM boards WHERE guild_id = ?'),
  setBoard: db.prepare(
    `INSERT INTO boards (guild_id, channel_id, message_id) VALUES (?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id`
  ),
};

function getContributor(guildId, userId) {
  return stmts.get.get(guildId, userId) ?? null;
}

// Milliseconds until this user may log another charm in this server (0 = allowed now).
function cooldownRemaining(guildId, userId, now = Date.now()) {
  const row = getContributor(guildId, userId);
  if (!row?.last_charm_at) return 0;
  return Math.max(0, row.last_charm_at + COOLDOWN_MS - now);
}

function logCharm(guildId, userId, now = Date.now()) {
  const remainingMs = cooldownRemaining(guildId, userId, now);
  if (remainingMs > 0) return { ok: false, remainingMs };
  stmts.insertIgnore.run(guildId, userId);
  stmts.addCharm.run(CHARM_VALUE, now, guildId, userId);
  return { ok: true, contributor: getContributor(guildId, userId) };
}

function setContribution(guildId, userId, amount) {
  const before = getContributor(guildId, userId)?.contribution ?? 0;
  stmts.insertIgnore.run(guildId, userId);
  stmts.setContribution.run(amount, guildId, userId);
  return { before, after: amount };
}

function listContributors(guildId) {
  return stmts.list.all(guildId);
}

function getTotals(guildId) {
  return { ...stmts.totals.get(guildId) };
}

// One live board per Discord server.
function getBoard(guildId) {
  const row = stmts.getBoard.get(guildId);
  return row ? { ...row } : null;
}

function setBoard(guildId, channelId, messageId) {
  stmts.setBoard.run(guildId, channelId, messageId);
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
};
