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
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
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
  getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
  setSetting: db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
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

// Small key/value store for bot state, such as where the live board lives.
function getSetting(key) {
  const row = stmts.getSetting.get(key);
  return row ? JSON.parse(row.value) : null;
}

function setSetting(key, value) {
  stmts.setSetting.run(key, JSON.stringify(value));
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
  getSetting,
  setSetting,
};
