// SILMA <-> Vapi custom-voice bridge
// Receives Vapi "voice-request" webhooks, synthesizes Najdi speech with SILMA,
// converts SILMA's 24kHz float32 audio to the raw PCM16 Vapi expects, and returns it.

const express = require('express');
const app = express();
app.use(express.json({ limit: '10mb' }));

// ---- Configuration (set these as environment variables on Railway) ----
const SILMA_API_KEY = process.env.SILMA_API_KEY;                       // required
const SILMA_URL     = process.env.SILMA_URL || 'https://api.silma.ai/tts/v2/stream';
const MODEL_ID      = process.env.MODEL_ID  || 'silma-tts-v2-ksa';     // Najdi (Saudi) dialect
const VOICE_ID      = process.env.VOICE_ID  || 'fahd';                 // pick the voice you liked in the SILMA playground
const VAPI_SECRET   = process.env.VAPI_SECRET || '';                   // optional shared secret with Vapi
const SILMA_RATE    = 24000;                                           // SILMA v2 output: 24kHz mono float32

// Health check
app.get('/', (req, res) => res.status(200).send('SILMA<->Vapi bridge is running'));

// Main endpoint Vapi calls
app.post('/api/synthesize', async (req, res) => {
  try {
    if (VAPI_SECRET && req.get('X-VAPI-SECRET') !== VAPI_SECRET) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const message = req.body && req.body.message;
    if (!message || message.type !== 'voice-request') {
      return res.status(400).json({ error: 'invalid message type' });
    }

    let text = (message.text || '').toString().trim();
    const sampleRate = message.sampleRate;
    if (!text) return res.status(400).json({ error: 'empty text' });
    if (![8000, 16000, 22050, 24000].includes(sampleRate)) {
      return res.status(400).json({ error: 'unsupported sampleRate', got: sampleRate });
    }
    if (text.length > 1000) text = text.slice(0, 1000); // SILMA /stream limit

    // Call SILMA TTS (Najdi)
    const silmaResp = await fetch(SILMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apiKey': SILMA_API_KEY },
      body: JSON.stringify({ model_id: MODEL_ID, voice_id: VOICE_ID, text }),
    });

    if (!silmaResp.ok) {
      const detail = await silmaResp.text().catch(() => '');
      console.error('SILMA error', silmaResp.status, detail);
      return res.status(502).json({ error: 'silma_failed', status: silmaResp.status });
    }

    // SILMA returns raw float32 little-endian bytes at 24kHz mono
    const ab = await silmaResp.arrayBuffer();
    const usable = ab.byteLength - (ab.byteLength % 4);     // keep whole float32 samples
    const f32 = new Float32Array(ab.slice(0, usable));

    const pcm = floatToPcm16(f32, SILMA_RATE, sampleRate);  // resample + convert

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', pcm.length);
    return res.end(pcm);
  } catch (err) {
    console.error('bridge error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'bridge_error' });
  }
});

// Convert float32 [-1,1] @ srcRate -> int16 LE PCM @ dstRate (linear resample)
function floatToPcm16(input, srcRate, dstRate) {
  let samples = input;
  if (srcRate !== dstRate) {
    const ratio = srcRate / dstRate;
    const outLen = Math.floor(input.length / ratio);
    const out = new Float32Array(outLen);
    for (let j = 0; j < outLen; j++) {
      const pos = j * ratio;
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      const s0 = input[i0] || 0;
      const s1 = (input[i0 + 1] !== undefined) ? input[i0 + 1] : s0;
      out[j] = s0 + (s1 - s0) * frac;
    }
    samples = out;
  }
  const buf = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    let s = samples[i];
    if (s > 1) s = 1; else if (s < -1) s = -1;
    buf.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  return buf;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('SILMA<->Vapi bridge listening on port', PORT));
