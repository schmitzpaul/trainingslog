---
description: Analyse the latest training session with a small context (profile + notes + digest)
argument-hint: "[backup.json] [YYYY-MM-DD]"
allowed-tools: Bash(node coach/digest.js:*), Bash(ls:*), Bash(mkdir:*), Bash(cp:*), Bash(netlify blobs:*), Read, Write
---

Analyse my most recent training session. **Keep the context small**: read only the files named here.

## 1. Find the data
- If `$ARGUMENTS` contains a path to a `.json` file, use it.
- Otherwise use the newest backup: `ls -t ~/Library/Mobile\ Documents/com~apple~CloudDocs/training/trainingslog-backup*.json | head -1`
- **Never open the backup JSON yourself.** Only the digest script reads it.

## 2. Load the memory (Netlify Blobs is the source of truth)
- `mkdir -p coach/memory/history`
- If the `netlify` CLI is available and the folder is linked: get `PROFILE.md` and `NOTES.md` from store `coach` with
  `netlify blobs:get coach NOTES.md -O coach/memory/NOTES.md` (same for PROFILE.md). If a key is missing, keep the local file.
- If there is no local file, copy it from `coach/templates/`.
- If `coach/memory/PROFILE.md` is still the unfilled template, ask me for my goals briefly before analysing. Don't write the profile yourself without asking.

## 3. Build the digest
`node coach/digest.js "<backup>" [date from $ARGUMENTS] > coach/memory/current.md`

## 4. Analyse
- Read **only**: `coach/prompt.mjs` (rules), `coach/memory/PROFILE.md`, `coach/memory/NOTES.md`, `coach/memory/current.md`.
- Follow the rules in `SYSTEM` from `coach/prompt.mjs`, but write the analysis as normal chat Markdown, not JSON.

## 5. Update the notes
- Copy the old notes to `coach/memory/history/NOTES-<date of the session>.md`.
- Write the new `coach/memory/NOTES.md` following the rules in `prompt.mjs` (max. 60 lines).
- If netlify is available: `netlify blobs:set coach NOTES.md --input coach/memory/NOTES.md` and `netlify blobs:set coach current.md --input coach/memory/current.md` (and PROFILE.md if it was changed).
- At the end, give one line on whether the sync to Netlify worked.

Afterwards I can ask follow-up questions. For those, you may also run the digest for other dates, but still don't read the raw JSON.
