const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBoard } = require('../src/board');

const totals = { contribution: 500000, charms: 2 };

test('shows a placeholder when nobody has logged a charm', () => {
  const text = buildBoard([], { contribution: 0, charms: 0 });
  assert.match(text, /No charms logged yet/);
});

test('lists each member with formatted totals and a live timestamp', () => {
  const rows = [
    { user_id: '111', contribution: 500000, charms: 2 },
    { user_id: '222', contribution: 250000, charms: 1 },
  ];
  const text = buildBoard(rows, totals, { updatedAt: 1_700_000_000_000 });
  assert.match(text, /Total contribution: \*\*500,000\*\*/);
  assert.match(text, /1\. <@111> — 500,000 · 2 charms/);
  assert.match(text, /2\. <@222> — 250,000 · 1 charm\b/);
  assert.match(text, /Last updated <t:1700000000:R>/);
});

test('stays under the Discord 2000 character limit by trimming rows', () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({
    user_id: String(100000000000000000 + i),
    contribution: 1_000_000,
    charms: 4,
  }));
  const text = buildBoard(rows, { contribution: 300_000_000, charms: 1200 });
  assert.ok(text.length <= 1900, `length ${text.length}`);
  assert.match(text, /…and \d+ more/);
});
