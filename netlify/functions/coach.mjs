// Trainingslog Coach: analyses one session using PROFILE.md + NOTES.md + digest.
// POST /.netlify/functions/coach  {token, digest, date}  → {analysis, notes}
// GET  /.netlify/functions/coach?token=…                  → {analysis, notes, profile, date} (last saved state)
// Env: ANTHROPIC_API_KEY, COACH_TOKEN, optional COACH_MODEL (default claude-opus-5-5)
import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";
import { SYSTEM, OUTPUT_FORMAT } from "../../coach/prompt.mjs";

const TEMPLATE_NOTES = "# Coach-Notizen\n\n## Stand\n- Noch keine Analyse.\n\n## Erkenntnisse & Entscheidungen\n\n## Verlauf\n";
const SCHEMA = {
  type: "object",
  properties: { analysis: { type: "string" }, notes: { type: "string" } },
  required: ["analysis", "notes"],
  additionalProperties: false,
};

function authorized(given) {
  const want = Netlify.env.get("COACH_TOKEN");
  if (!want || typeof given !== "string") return false;
  const a = Buffer.from(given), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
const json = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export default async (req) => {
  const store = getStore({ name: "coach", consistency: "strong" });

  if (req.method === "GET") {
    if (!authorized(new URL(req.url).searchParams.get("token"))) return json({ error: "unauthorized" }, 401);
    const [analysis, notes, profile, date] = await Promise.all(
      ["analysis.md", "NOTES.md", "PROFILE.md", "date"].map((k) => store.get(k)));
    return json({ analysis, notes, profile, date });
  }
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!authorized(body.token)) return json({ error: "unauthorized" }, 401);
  const digest = typeof body.digest === "string" ? body.digest : "";
  if (!digest || digest.length > 20000) return json({ error: "digest missing or too large" }, 400);

  const [profile, notesOld] = await Promise.all([store.get("PROFILE.md"), store.get("NOTES.md")]);
  const notes = notesOld || TEMPLATE_NOTES;

  const client = new Anthropic({ apiKey: Netlify.env.get("ANTHROPIC_API_KEY"), timeout: 55_000, maxRetries: 0 });
  let msg;
  try {
    msg = await client.beta.messages.create({
      model: Netlify.env.get("COACH_MODEL") || "claude-opus-5-5",
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM + "\n\n" + OUTPUT_FORMAT,
      messages: [{
        role: "user",
        content:
          "<PROFILE.md>\n" + (profile || "(noch kein Profil hinterlegt)") + "\n</PROFILE.md>\n\n" +
          "<NOTES.md>\n" + notes + "\n</NOTES.md>\n\n" +
          "<current.md>\n" + digest + "\n</current.md>\n\n" +
          "Analysiere die Einheit und schreibe die neue NOTES.md.",
      }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "Zu viele Anfragen, bitte gleich nochmal." }, 429);
    if (e instanceof Anthropic.APIConnectionTimeoutError) return json({ error: "Zeitüberschreitung bei der Analyse." }, 504);
    if (e instanceof Anthropic.APIError) return json({ error: "Claude-API-Fehler " + (e.status ?? "") }, 502);
    throw e;
  }

  if (msg.stop_reason === "refusal") return json({ error: "Analyse wurde abgelehnt." }, 502);
  if (msg.stop_reason === "max_tokens") return json({ error: "Antwort zu lang, abgebrochen." }, 502);
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let out;
  try { out = JSON.parse(text); } catch { return json({ error: "Antwort war kein gültiges JSON." }, 502); }
  if (typeof out.analysis !== "string" || typeof out.notes !== "string") return json({ error: "Antwort unvollständig." }, 502);

  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || "") ? body.date : new Date().toISOString().slice(0, 10);
  await Promise.all([
    store.set("NOTES.md", out.notes),
    store.set("current.md", digest),
    store.set("analysis.md", out.analysis),
    store.set("date", date),
    notesOld ? store.set("history/NOTES-" + date + ".md", notesOld) : null,
  ]);
  return json({ analysis: out.analysis, notes: out.notes, date });
};
