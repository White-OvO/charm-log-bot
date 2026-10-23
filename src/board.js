const fmt = (n) => n.toLocaleString('en-US');
const charmWord = (n) => (n === 1 ? 'charm' : 'charms');

// Builds the shared totals message. Discord caps messages at 2000 characters,
// so trailing rows are dropped and replaced with a "...and N more" line.
function buildBoard(rows, totals, { updatedAt } = {}) {
  const header = `**Shiny Charm Log**\nTotal contribution: **${fmt(totals.contribution)}** · Charms used: **${totals.charms}**`;
  if (!rows.length) return `${header}\n\nNo charms logged yet.`;

  const lines = rows.map(
    (r, i) => `${i + 1}. <@${r.user_id}> — ${fmt(r.contribution)} · ${r.charms} ${charmWord(r.charms)}`
  );
  const footer = updatedAt ? `\nLast updated <t:${Math.floor(updatedAt / 1000)}:R>` : '';

  const build = (shown) => {
    const more = shown < lines.length ? `\n…and ${lines.length - shown} more` : '';
    return `${header}\n\n${lines.slice(0, shown).join('\n')}${more}${footer}`;
  };

  let shown = lines.length;
  let content = build(shown);
  while (content.length > 1900 && shown > 0) {
    shown -= 1;
    content = build(shown);
  }
  return content;
}

module.exports = { buildBoard };
