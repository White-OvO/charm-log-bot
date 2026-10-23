const TRIGGER = 'shinycharm';

// Matches "@shinycharm" and "@shiny charm" (any spacing), case-insensitive.
const TEXT_PATTERN = /@shiny\s*charm\b/i;

const normalize = (name) => name.replace(/\s+/g, '').toLowerCase();

// True for the text triggers above, or a role mention whose name is either form.
function isCharmTrigger(content, roleNames = []) {
  return TEXT_PATTERN.test(content) || roleNames.some((name) => normalize(name) === TRIGGER);
}

module.exports = { isCharmTrigger };
