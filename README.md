# Charm Log Bot (PokeMMO)

A Discord bot that logs shiny charm uses. Each time a member mentions `@shinycharm`, they get credited with one charm worth **250,000** contribution, subject to a **1 hour cooldown per user**. Totals are stored locally in SQLite, not in Discord.

## How to use (for server members)

| What you do | What happens |
| --- | --- |
| Mention `@shinycharm` in any channel | +250,000 to your contribution and +1 charm. The bot replies with your new total. |
| Mention `@shinycharm` again within 1 hour | The bot tells you how long to wait. Nothing is counted. |
| Run `/log` | Shows the grand total and every member's contribution and charm count. |
| Run `/editcontribution` | Admins only. Sets a member's contribution total. See below. |

- Each member has their own 1 hour cooldown. One person's charm doesn't affect anyone else.
- The cooldown starts when a charm is logged. Mentions that are refused during cooldown don't reset it.

### Editing a contribution (admins)

Only the **server owner** and members with the **`capo`** or **`executive`** role can run `/editcontribution`. Discord Administrators without one of those roles can't.

```
/editcontribution user:@someone amount:1.5m
```

- `amount` sets the total exactly. It doesn't add to it.
- Accepted formats: `250000`, `250,000`, `250k`, `1.5m`.
- The charm count and cooldown don't change.
- The reply shows the change, for example `Contribution for @someone: 250,000 → 1,500,000.`

## Setup (for the bot owner)

1. Open your application at https://discord.com/developers/applications/1563021052597108776/bot. The Application ID is `1563021052597108776`.
2. Under **Bot**, click **Reset Token** and copy the token. Under **Bot → Privileged Gateway Intents**, turn on **Message Content Intent**. Without it the bot can't read `@shinycharm` typed in text.
3. Invite the bot from **OAuth2 → URL Generator**. Select the scopes `bot` and `applications.commands`, and these permissions: View Channels, Send Messages, Read Message History.
4. `cp .env.example .env` and set `DISCORD_TOKEN`. `CLIENT_ID` is already set to `1563021052597108776`.
5. `npm install`
6. `npm run deploy` to register the slash commands. Set `GUILD_ID` in `.env` for instant updates while testing.
7. `npm start`

Needs Node 22.5 or newer (uses the built-in `node:sqlite`).

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | required | Bot token |
| `CLIENT_ID` | `1563021052597108776` | Application ID, used by `npm run deploy` |
| `GUILD_ID` | empty | Register commands to one server instantly |
| `ADMIN_ROLE_NAMES` | `capo,executive` | Roles allowed to run `/editcontribution` (the server owner is always allowed) |
| `TRIGGER_NAME` | `shinycharm` | Role or text name that counts as a charm |
| `DB_PATH` | `data/charm-log.db` | Where the SQLite database is stored |

## Data

Stored in SQLite at `data/charm-log.db` (or `DB_PATH`). Back this file up to keep your totals. Deleting it resets everyone to zero.

## Development

- `npm test` runs the unit tests (cooldown, totals, manual edits, amount parsing, and permissions).
- `.env` holds the bot token. It is git-ignored. Never commit it.
