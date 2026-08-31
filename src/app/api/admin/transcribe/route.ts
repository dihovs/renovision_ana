import { isSignedIn } from "@/lib/adminAuth";

/**
 * A voice note, turned into text he can edit before sending. (ANA-22)
 *
 * WHY TRANSCRIBE RATHER THAN SEND AUDIO. Ana already listens — the phone line
 * and the widget both do. What the composer needs is different: the owner
 * dictating a question with wet hands, seeing the words appear, and fixing the
 * one the meter noise ate before anything is asked. Transcription puts a human
 * checkpoint between what was heard and what gets acted on, which matters most
 * for the tools that write: "log eighteen percent" misheard as eighty is a
 * drying log an adjuster reads later.
 *
 * ElevenLabs because the account, the key and the billing already exist for the
 * voice agent. Nothing else here is new.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** About two minutes of speech. A longer recording is a phone call. */
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await isSignedIn())) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return Response.json(
      { error: "Voice input is not configured — ELEVENLABS_API_KEY is missing." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected an audio upload." }, { status: 400 });
  }

  const file = form.get("audio");
  if (!(file instanceof File)) {
    return Response.json({ error: "No audio was attached." }, { status: 400 });
  }
  // Measured from what arrived, not from what the browser claimed.
  if (file.size > MAX_AUDIO_BYTES) {
    return Response.json(
      { error: "That recording is too long. Keep it under about two minutes." },
      { status: 413 },
    );
  }
  if (file.size === 0) {
    return Response.json({ error: "Nothing was recorded." }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", file, "note.webm");
  upstream.append("model_id", "scribe_v1");
  // He speaks both, often in one sentence. Letting the model decide beats
  // pinning a language and mangling every second word of the other one.
  upstream.append("diarize", "false");

  let response: Response;
  try {
    response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: upstream,
    });
  } catch (err) {
    console.error("[transcribe] could not reach ElevenLabs:", err);
    return Response.json({ error: "Could not reach the transcriber." }, { status: 502 });
  }

  if (!response.ok) {
    // The upstream body can quote the audio's content back; it stays server-side.
    const detail = await response.text().catch(() => "");
    console.error(`[transcribe] ElevenLabs ${response.status}: ${detail.slice(0, 300)}`);
    return Response.json({ error: "That did not transcribe." }, { status: 502 });
  }

  const body = (await response.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  // An empty transcript is a real outcome — a silent room, a muted mic — and
  // saying so beats handing back an empty box that looks like a bug.
  if (!text) {
    return Response.json({ error: "Nothing was said, or it could not be made out." }, { status: 422 });
  }

  return Response.json({ text });
}
