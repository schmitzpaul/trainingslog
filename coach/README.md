# Coach: AI analysis with a small context

The AI reads only three small files instead of the whole log:

| File | Content | Who writes it |
|---|---|---|
| `PROFILE.md` | Goals, plan, constraints | you |
| `NOTES.md` | Running summary + conclusions (max. 60 lines) | the coach, after every analysis |
| `current.md` | Today's session + recent trend per exercise (~3 KB) | `coach/digest.js`, no AI |

The shared source of truth is **Netlify Blobs** (store `coach`). The repo is public, so personal files
live only there and in the git-ignored `coach/memory/`.

## One-time setup
1. Netlify → Site configuration → Environment variables (scope: Functions):
   - `ANTHROPIC_API_KEY`: API key from console.anthropic.com
   - `COACH_TOKEN`: any long random string (e.g. `openssl rand -hex 24`)
   - optional `COACH_MODEL` (default `claude-opus-5-5`; cheaper: `claude-sonnet-5-5`)
2. Netlify CLI on the Mac: `npm i -g netlify-cli && netlify login && netlify link` (site `tubular-melomakarona-cfffcd`)
3. Write your profile: `mkdir -p coach/memory && cp coach/templates/*.md coach/memory/`, edit `coach/memory/PROFILE.md`, then
   `netlify blobs:set coach PROFILE.md --input coach/memory/PROFILE.md`
4. In the app, open the "Coach" tab and enter `COACH_TOKEN` once.

## Usage
- **iPhone:** after training, Coach → "Einheit analysieren".
- **Claude Code:** save a backup to iCloud Drive/training, then run `/analyze` in this folder (optionally `/analyze <file> <date>`).
- Both use the same rules (`coach/prompt.mjs`) and the same notes.

## Test the digest by hand
`node coach/digest.js "<backup.json>" [YYYY-MM-DD]`
