const test = require('node:test');
const assert = require('node:assert/strict');
const { isCharmTrigger } = require('../src/triggers');

test('matches @shinycharm and @shiny charm in any case and spacing', () => {
  assert.equal(isCharmTrigger('done @shinycharm'), true);
  assert.equal(isCharmTrigger('done @shiny charm'), true);
  assert.equal(isCharmTrigger('done @ShinyCharm'), true);
  assert.equal(isCharmTrigger('done @shinycharm!'), true);
});

test('matches a role named shinycharm or "shiny charm"', () => {
  assert.equal(isCharmTrigger('hi', ['shinycharm']), true);
  assert.equal(isCharmTrigger('hi', ['Shiny Charm']), true);
  assert.equal(isCharmTrigger('hi', ['Capo']), false);
});

test('ignores unrelated text', () => {
  assert.equal(isCharmTrigger('shiny charms are cool'), false);
  assert.equal(isCharmTrigger('@shinycharmer'), false);
  assert.equal(isCharmTrigger(''), false);
});
