import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';

// Tunable knobs:
// Think of these like dials you can turn to make the detector more or less picky.
// We keep them at the top so they are easy to find and change.
const TARGET_SR_HZ = 44100;
const WIN_MS = 10;
const HOP_MS = 5;
const MIN_GAP_MS = 100; // increase if you expect more gaps between words
const MIN_SEG_MS = 80;
const THR_ALPHA = 0.25; // between noise and speech percentiles
const HYST_LO_RATIO = 0.7; // lower threshold as fraction of thrHi

// Find which ffmpeg program to use.
// 1) If user tells us a path (FFMPEG_PATH), use that.
// 2) Else try the computer's ffmpeg (in PATH).
// 3) Else try the bundled one from ffmpeg-static.
async function resolveFfmpegBinary() {
  // Prefer explicit env var, then packaged static binary, then system ffmpeg
  const fromEnv = process.env.FFMPEG_PATH;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  // Prefer system ffmpeg to avoid missing vendor chunks in dev on Windows
  const systemBin = 'ffmpeg';
  try {
    const ffmpegStatic = await import('ffmpeg-static');
    const fromPkg = ffmpegStatic.default || '';
    return fromPkg || systemBin;
  } catch (e) {
    return systemBin;
  }
}

// Turn the .m4a file into raw audio numbers we can work with (PCM),
// in mono (1 channel) at a known speed (sample rate).
async function decodeM4aToPcm(filePath, targetSr = TARGET_SR_HZ) {
  return new Promise(async (resolve, reject) => {
    const bin = await resolveFfmpegBinary();
    const args = ['-hide_banner', '-loglevel', 'error', '-i', filePath, '-ac', '1', '-ar', String(targetSr), '-f', 's16le', 'pipe:1'];
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let stderr = '';
    proc.stdout.on('data', (d) => chunks.push(d));
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve({ pcm: Buffer.concat(chunks), sr: targetSr });
      else reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

// Change 16-bit integers (how ffmpeg gives us the audio) into gentle floats (-1 to 1)
// that are nicer for math.
function int16ToFloat32(buf) {
  const out = new Float32Array(buf.length / 2);
  for (let i = 0, j = 0; i < buf.length; i += 2, j++) {
    out[j] = buf.readInt16LE(i) / 32768;
  }
  return out;
}

// Make a smooth "loudness over time" line (RMS), by looking at tiny windows
// of the sound and sliding forward a little each time.
function rmsEnvelope(x, sr, winMs = WIN_MS, hopMs = HOP_MS) {
  const win = Math.max(1, Math.round((sr * winMs) / 1000));
  const hop = Math.max(1, Math.round((sr * hopMs) / 1000));
  const w = new Float32Array(win);
  for (let i = 0; i < win; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(1, win - 1)));
  const pad = Math.floor(win / 2);
  const padded = new Float32Array(x.length + pad * 2);
  padded.set(x, pad);
  const frames = 1 + Math.floor((padded.length - win) / hop);
  const rms = new Float32Array(Math.max(0, frames));
  for (let i = 0; i < frames; i++) {
    const s = i * hop;
    let acc = 0;
    for (let k = 0; k < win; k++) {
      const v = padded[s + k] * w[k];
      acc += v * v;
    }
    rms[i] = Math.sqrt(acc / win + 1e-12);
  }
  return { rms, hopSamples: hop };
}

// Pick a value at a certain percentile (like "top 80%" or "bottom 20%")
function percentile(values, p) {
  const arr = Array.from(values).sort((a, b) => a - b);
  if (arr.length === 0) return 0;
  const idx = Math.min(arr.length - 1, Math.max(0, Math.floor((p / 100) * (arr.length - 1))));
  return arr[idx];
}

// Find parts where someone is speaking (segments) by looking for
// when the loudness crosses above a bar (thrHi) and later falls below a lower bar (thrLo).
function detectSegments(rms, hopMs) {
  if (rms.length === 0) return [];
  const noise = percentile(rms, 20);
  const speechP = percentile(rms, 80);
  const thrHi = noise + THR_ALPHA * (speechP - noise);
  const thrLo = thrHi * HYST_LO_RATIO;

  const raw = [];
  let inSpeech = false;
  let startIdx = 0;
  for (let i = 0; i < rms.length; i++) {
    if (!inSpeech && rms[i] >= thrHi) {
      inSpeech = true;
      startIdx = i;
    } else if (inSpeech && rms[i] <= thrLo) {
      raw.push({ start_ms: startIdx * hopMs, end_ms: Math.max(startIdx * hopMs, i * hopMs) });
      inSpeech = false;
    }
  }
  if (inSpeech) raw.push({ start_ms: startIdx * hopMs, end_ms: rms.length * hopMs });

  // Put very close-together parts together (merge small gaps), so we don't split a word in half.
  const merged = [];
  for (const s of raw) {
    if (!merged.length) { merged.push(s); continue; }
    const prev = merged[merged.length - 1];
    if (s.start_ms - prev.end_ms < MIN_GAP_MS) prev.end_ms = s.end_ms; else merged.push(s);
  }
  // Throw away very tiny parts (like short pops), because they are not real words.
  const filtered = merged.filter(seg => (seg.end_ms - seg.start_ms) >= MIN_SEG_MS);
  return filtered;
}

// Turn text into simple words by splitting on spaces and trimming punctuation.
function simpleTokenize(text) {
  return text
    .split(/\s+/)
    .map(w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
}

// Call Google Speech-to-Text API using REST API with API key
async function transcribeAudio(audioBuffer, sampleRate) {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY environment variable is not set');
  }

  const requestBody = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: sampleRate,
      languageCode: 'en-US',
      enableWordTimeOffsets: false,
      enableAutomaticPunctuation: false,
      model: 'latest_short'
    },
    audio: {
      content: audioBuffer.toString('base64')
    }
  };

  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google STT API error: ${response.status} ${errorText}`);
  }

  return await response.json();
}

// Helper to parse multipart form data manually (Vercel Functions don't have built-in form parsing)
async function parseFormData(req) {
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return null;
  }

  // For Vercel Functions, we need to read the body from the request
  let body;
  if (req.body) {
    body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
  } else {
    // Read from request stream if body is not available
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks);
  }

  if (!body || body.length === 0) {
    return null;
  }

  // Simple multipart parser - extracts first file
  const boundary = contentType.split('boundary=')[1];
  if (!boundary) return null;

  const parts = body.toString('binary').split(`--${boundary}`);
  for (const part of parts) {
    if (part.includes('Content-Disposition') && part.includes('filename')) {
      const filenameMatch = part.match(/filename="([^"]+)"/);
      if (!filenameMatch) continue;

      const filename = filenameMatch[1];
      const dataStart = part.indexOf('\r\n\r\n') + 4;
      const dataEnd = part.lastIndexOf('\r\n');
      if (dataStart >= 4 && dataEnd > dataStart) {
        const fileData = Buffer.from(part.substring(dataStart, dataEnd), 'binary');
        return { file: fileData, filename };
      }
    }
  }

  return null;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1) Parse the uploaded file from the form
    const formData = await parseFormData(req);
    if (!formData) {
      return res.status(400).json({ error: 'missing file or invalid form data' });
    }

    const { file, filename } = formData;
    if (!filename.toLowerCase().endsWith('.m4a')) {
      return res.status(400).json({ error: 'only .m4a accepted' });
    }

    // 2) Save it to a temp place so ffmpeg can read it
    const tmpPath = join(tmpdir(), `${Date.now()}-${filename}`);
    await writeFile(tmpPath, file);

    try {
      // 3) Turn .m4a into raw numbers (PCM) we can measure
      const { pcm, sr } = await decodeM4aToPcm(tmpPath, TARGET_SR_HZ);

      // 4) Build the smooth loudness line (RMS) so we can see where words start/end
      const float = int16ToFloat32(pcm);
      const { rms, hopSamples } = rmsEnvelope(float, sr, WIN_MS, HOP_MS);
      const hopMs = Math.round((hopSamples / sr) * 1000);

      // 5) Find the talky parts (segments) using the loudness bars
      const segs = detectSegments(rms, hopMs);
      console.log('[Segments detected]', segs.map((s, i) => ({ i, start_ms: s.start_ms, end_ms: s.end_ms })));

      // Ask Google for the words only (no timestamps)
      const resp = await transcribeAudio(pcm, sr);
      const transcript = (resp.results || []).map((r) => r.alternatives?.[0]?.transcript || '').join(' ').trim();
      const tokens = simpleTokenize(transcript);
      console.log('[STT tokens]', tokens);

      // If counts don't match, return an error (no auto-reconciliation)
      if (tokens.length !== segs.length) {
        const ffBin = resolveFfmpegBinary();
        return res.status(422).json({
          error: "There was a mismatch between Google's transcript and the number of words detected.",
          details: { words: tokens.length, segments: segs.length },
          meta: {
            hop_ms: hopMs,
            window_ms: WIN_MS,
            sample_rate_hz: sr,
            segments_detected: segs.length,
            words_detected: tokens.length,
            ffmpeg_bin: ffBin,
            envelope_frames: rms.length,
            envelope_hop_samples: hopSamples,
            segments_preview: segs,
            min_segment_ms: MIN_SEG_MS
          }
        });
      }

      // Map words to segments in order (1:1)
      const words = segs.map((seg, i) => ({
        word: tokens[i],
        start: seg.start_ms,  // Return as 'start' (milliseconds)
        end: seg.end_ms        // Return as 'end' (milliseconds)
      }));
      console.log('[Alignment preview]', words.map((w, i) => ({
        i, word: w.word, start: w.start, end: w.end,
        center_ms: Math.round((w.start + w.end) / 2)
      })));

      const ffBin = resolveFfmpegBinary();
      return res.status(200).json({
        words,
        meta: {
          hop_ms: hopMs,
          window_ms: WIN_MS,
          sample_rate_hz: sr,
          segments_detected: segs.length,
          words_detected: tokens.length,
          ffmpeg_bin: ffBin,
          envelope_frames: rms.length,
          envelope_hop_samples: hopSamples,
          segments_preview: segs,
          min_segment_ms: MIN_SEG_MS
        }
      });
    } finally {
      // Clean up the temp file, even if something went wrong
      await unlink(tmpPath).catch(() => {});
    }
  } catch (e) {
    console.error('Error processing audio:', e);
    return res.status(500).json({ error: e?.message || 'internal error' });
  }
}

// Disable body parsing, we'll handle it manually
export const config = {
  api: {
    bodyParser: false
  }
};
