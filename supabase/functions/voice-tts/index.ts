// Turns one line of dialogue into speech with ElevenLabs. The API key never leaves this function.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODELS = new Set(["eleven_multilingual_v2", "eleven_turbo_v2_5", "eleven_flash_v2_5", "eleven_v3"]);
const MAX_CHARS = 420;

// A light per-instance limiter so a runaway client cannot burn the account's quota.
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(key, list);
  return list.length > 40;
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("ELEVENLABS_API_KEY");
    if (!key) return json({ error: "voice_not_configured" }, 503);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    if (limited(ip)) return json({ error: "rate_limited" }, 429);

    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
    const voiceId = typeof body.voiceId === "string" ? body.voiceId : "";
    if (!text || text.length > MAX_CHARS) return json({ error: "bad_text" }, 400);
    if (!/^[A-Za-z0-9]{12,40}$/.test(voiceId)) return json({ error: "bad_voice" }, 400);
    const model = MODELS.has(body.model) ? body.model : "eleven_multilingual_v2";
    const s = body.settings ?? {};

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: clamp(s.stability, 0, 1, 0.5),
          similarity_boost: clamp(s.similarity, 0, 1, 0.75),
          style: clamp(s.style, 0, 1, 0.2),
          speed: clamp(s.speed, 0.7, 1.2, 1),
          use_speaker_boost: true,
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("elevenlabs tts failed", res.status, detail.slice(0, 300));
      return json({ error: "tts_failed", status: res.status }, 502);
    }
    const audio = new Uint8Array(await res.arrayBuffer());
    return json({ audio: toBase64(audio), mime: "audio/mpeg" });
  } catch (e) {
    console.error("voice-tts error", e);
    return json({ error: "server_error" }, 500);
  }
});
