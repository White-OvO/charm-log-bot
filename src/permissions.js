// Only the server owner, or a member holding one of the admin roles, may edit contributions.
// Discord's Administrator permission does not grant access on its own.
function canEditContribution(userId, guildOwnerId, memberRoleNames, adminRoleNames) {
  if (!userId) return false;
  if (guildOwnerId && userId === guildOwnerId) return true;
  return memberRoleNames.some((name) => adminRoleNames.has(name.toLowerCase()));
}

module.exports = { canEditContribution };
