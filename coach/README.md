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
1. Claude access comes via **Netlify AI Gateway** (no key of your own; billed as Netlify credits, credit-based plan).
   Alternatively, set your own `ANTHROPIC_API_KEY` as an env var; it takes precedence.
   Netlify env vars (scope: Functions):
   - `COACH_TOKEN`: app password (is set; local copy in `coach/memory/COACH_TOKEN.txt`)
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
