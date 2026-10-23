const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

// Point the DB at a throwaway file before db.js loads.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'charm-log-test-'));
process.env.DB_PATH = path.join(tmpDir, 'test.db');

const db = require('../src/db');
const { parseAmount } = require('../src/amount');
const { canEditContribution } = require('../src/permissions');

const HOUR = 60 * 60 * 1000;

test('canEditContribution allows the server owner and capo/executive role holders only', () => {
  const adminRoles = new Set(['capo', 'executive']);
  assert.equal(canEditContribution('owner-id', 'owner-id', [], adminRoles), true);
  assert.equal(canEditContribution('u-capo', 'owner-id', ['@everyone', 'Capo'], adminRoles), true);
  assert.equal(canEditContribution('u-exec', 'owner-id', ['Executive'], adminRoles), true);
  // Server Administrators without the role are refused.
  assert.equal(canEditContribution('u-mod', 'owner-id', ['Moderator'], adminRoles), false);
  assert.equal(canEditContribution(undefined, 'owner-id', ['Capo'], adminRoles), false);
  // DM use has no guild owner or roles.
  assert.equal(canEditContribution('someone', undefined, [], adminRoles), false);
});

test('parseAmount reads plain, comma, and shorthand numbers', () => {
  assert.equal(parseAmount('250000'), 250000);
  assert.equal(parseAmount('250,000'), 250000);
  assert.equal(parseAmount('250k'), 250000);
  assert.equal(parseAmount('1.5M'), 1500000);
  assert.equal(parseAmount(' 0 '), 0);
});

test('parseAmount rejects junk and negatives', () => {
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('-5'), null);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('1.2.3'), null);
});

test('logCharm adds 250K and one charm', () => {
  const r = db.logCharm('u1', 1_000_000);
  assert.equal(r.ok, true);
  assert.equal(r.contributor.contribution, 250000);
  assert.equal(r.contributor.charms, 1);
});

test('logCharm blocks a second charm inside the 1 hour cooldown', () => {
  const r = db.logCharm('u1', 1_000_000 + HOUR - 60_000);
  assert.equal(r.ok, false);
  assert.equal(r.remainingMs, 60_000);
  assert.equal(db.getContributor('u1').charms, 1);
});

test('logCharm allows another charm once the hour has passed', () => {
  const r = db.logCharm('u1', 1_000_000 + HOUR);
  assert.equal(r.ok, true);
  assert.equal(r.contributor.contribution, 500000);
  assert.equal(r.contributor.charms, 2);
});

test('cooldown is per user', () => {
  const r = db.logCharm('u2', 1_000_000 + 1);
  assert.equal(r.ok, true);
});

test('setContribution overrides the total without touching charm count', () => {
  const { before, after } = db.setContribution('u1', 1_000_000);
  assert.equal(before, 500000);
  assert.equal(after, 1_000_000);
  const row = db.getContributor('u1');
  assert.equal(row.contribution, 1_000_000);
  assert.equal(row.charms, 2);
});

test('setContribution creates a row for a new user', () => {
  const { before, after } = db.setContribution('u3', 42);
  assert.equal(before, 0);
  assert.equal(after, 42);
  assert.equal(db.getContributor('u3').charms, 0);
});

test('getTotals and listContributors reflect all users', () => {
  const totals = db.getTotals();
  // u1: 1,000,000 · u2: 250,000 · u3: 42
  assert.equal(totals.contribution, 1_000_042 + 250000);
  assert.equal(totals.charms, 3);
  const list = db.listContributors();
  assert.equal(list[0].user_id, 'u1');
  assert.equal(list.length, 3);
});
