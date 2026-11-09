const MODEL = 'gemini-3.8-flash-lite-tts';
const VOICE = 'Charon';
// Only recent lines can be spoken, and the cache holds them all,
// so replaying old lines can't run up API calls or memory
export const SPEECH_LINES = 20;
const MAX_CACHED = SPEECH_LINES * 2;

type Reply = {
  candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
};

const { GEMINI_KEY } = process.env;
export const voiceOn = !!GEMINI_KEY;

// The WAV has a C2PA chunk after the audio that browsers play as static,
// so cut it off at the end of the data chunk and fix the RIFF size
function trimWav(wav: Uint8Array) {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let pos = 12;
  while (pos + 8 <= wav.length) {
    const id = String.fromCharCode(...wav.subarray(pos, pos + 4));
    const size = view.getUint32(pos + 4, true);
    if (id === 'data') {
      const end = Math.min(pos + 8 + size, wav.length);
      view.setUint32(4, end - 8, true);
      return wav.subarray(0, end);
    }
    pos += 8 + size + (size % 2);
  }
  return wav;
}

async function generate(text: string) {
  const started = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        // A hung call would stall every client's speech queue
        signal: AbortSignal.timeout(30_000),
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': GEMINI_KEY ?? '',
        },
        body: JSON.stringify({
          // The model reads any instructions aloud, so send only the line
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
            },
          },
        }),
      },
    );
    if (!res.ok) {
      console.error(`TTS error ${res.status}: ${await res.text()}`);
      return null;
    }
    const json = (await res.json()) as Reply;
    const data = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data) {
      console.error('TTS error: no audio in response');
      return null;
    }
    console.log(`TTS ${Date.now() - started}ms: ${text.length} chars`);
    return trimWav(new Uint8Array(Buffer.from(data, 'base64')));
  } catch (e) {
    console.error(`TTS error: ${e}`);
    return null;
  }
}

// Shared by concurrent requests; failures aren't kept
const cache = new Map<string, Promise<Uint8Array | null>>();

export function speak(text: string) {
  let clip = cache.get(text);
  if (!clip) {
    clip = generate(text);
    cache.set(text, clip);
    if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value ?? '');
    const own = clip;
    void own.then((c) => c || (cache.get(text) === own && cache.delete(text)));
  }
  return clip;
}
