#!/usr/bin/env node
/*
 * Turns a raw exercise clip (an AI-generated video or a screen recording) into the short,
 * seamless loop the guided workout plays full screen: public/exercise-videos/<media_key>.mp4.
 *
 *  1. Finds one clean repetition: two frames that look alike, at least 1.2 s apart, on the same
 *     camera shot (hard cuts are detected), with real movement in between (a still hold or a
 *     camera zoom is not a rep). Or pass --start/--end in seconds to choose it yourself.
 *  2. Cuts that piece out and cross-fades its last few frames into its first ones, so the end of
 *     the loop runs straight into the start with no visible jump.
 *  3. Optionally crops (--crop w:h:x:y in source pixels), scales to at most 720 px wide, drops
 *     the audio and compresses (H.264, starts playing before the download ends).
 *
 * Then add the media_key to EXERCISE_VIDEOS in src/lib/exercise-videos.ts.
 *
 * Needs ffmpeg: on PATH, or its path in FFMPEG_PATH.
 * Usage: node scripts/prepare-exercise-video.js "<clip.mp4>" <media_key> [--start 2.5 --end 4.5]
 *        [--crop 600:1000:5:40] [--fade 0.3] [--dry-run]   (--dry-run only prints the loop it would use)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const OUT_DIR = path.join(__dirname, '..', 'public', 'exercise-videos');
const SMALL_W = 48; // frames are compared at this width, in grey
const MIN_LOOP = 1.2; // seconds: shorter than one real repetition
const MAX_LOOP = 4.5;

function args() {
  const [input, key, ...rest] = process.argv.slice(2);
  if (!input || !key || !/^[a-z0-9-]+$/.test(key)) {
    console.error('Usage: node scripts/prepare-exercise-video.js "<clip.mp4>" <media_key> [--start s --end s] [--crop w:h:x:y] [--fade s] [--dry-run]');
    process.exit(1);
  }
  const opt = { input, key, start: null, end: null, crop: null, fade: 0.3, dryRun: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--dry-run') opt.dryRun = true;
    else if (a === '--start') opt.start = Number(rest[++i]);
    else if (a === '--end') opt.end = Number(rest[++i]);
    else if (a === '--fade') opt.fade = Number(rest[++i]);
    else if (a === '--crop') opt.crop = rest[++i];
    else throw new Error(`Unknown option ${a}`);
  }
  if (opt.crop && !/^\d+:\d+:\d+:\d+$/.test(opt.crop)) throw new Error('--crop must be w:h:x:y');
  return opt;
}

function ffmpeg(list, opts = {}) {
  const r = spawnSync(FFMPEG, ['-hide_banner', ...list], { maxBuffer: 1 << 30, ...opts });
  if (r.error) throw new Error(`Could not run ffmpeg (${r.error.message}). Install it or set FFMPEG_PATH.`);
  return r;
}

function probe(input) {
  const err = ffmpeg(['-i', input]).stderr.toString();
  const m = err.match(/Video:.*?(\d{2,5})x(\d{2,5}).*?([\d.]+) fps/);
  const d = err.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!m || !d) throw new Error(`Not a readable video: ${input}`);
  return { w: +m[1], h: +m[2], fps: +m[3], duration: +d[1] * 3600 + +d[2] * 60 + +d[3] };
}

/** Every frame, small and grey, as one byte array per frame. */
function frames(input, info) {
  const h = Math.round((SMALL_W * info.h) / info.w / 2) * 2;
  const r = ffmpeg(['-loglevel', 'error', '-i', input, '-vf', `scale=${SMALL_W}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-']);
  const size = SMALL_W * h;
  const out = [];
  for (let o = 0; o + size <= r.stdout.length; o += size) out.push(r.stdout.subarray(o, o + size));
  return out;
}

const diff = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};

/** The best repetition to loop: [startFrame, endFrame) with its match score (lower = more alike). */
function findLoop(f, fps) {
  const n = f.length;
  const step = [];
  for (let i = 1; i < n; i++) step.push(diff(f[i - 1], f[i]));
  const median = [...step].sort((a, b) => a - b)[Math.floor(step.length / 2)];
  // A hard cut: one frame-to-frame change far bigger than the usual movement
  const cutAt = new Set(step.map((d, i) => (d > Math.max(8, median * 6) ? i + 1 : -1)).filter((i) => i > 0));
  const shotOf = [];
  for (let i = 0, shot = 0; i < n; i++) shotOf.push(cutAt.has(i) ? ++shot : shot);

  const minGap = Math.ceil(MIN_LOOP * fps);
  const maxGap = Math.floor(MAX_LOOP * fps);
  // How far a frame can drift from the start of a rep: the biggest change seen inside any window
  let reach = 0;
  for (let i = 0; i < n; i += 2) for (let j = i + 2; j < Math.min(n, i + maxGap); j += 2) if (shotOf[i] === shotOf[j]) reach = Math.max(reach, diff(f[i], f[j]));

  let best = null;
  for (let i = 1; i < n - minGap - 1; i++) {
    for (let j = i + minGap; j <= Math.min(n - 2, i + maxGap); j++) {
      if (shotOf[i - 1] !== shotOf[j + 1]) continue; // must stay on one camera shot
      // Alike at the seam: the frame, and the frames on either side (so the motion matches too)
      const score = (diff(f[i], f[j]) * 2 + diff(f[i - 1], f[j - 1]) + diff(f[i + 1], f[j + 1])) / 4;
      if (best && score >= best.score) continue;
      // A real rep moves well away from where it started, and only small steps at a time (no cut)
      let far = 0;
      for (let k = i + 1; k < j; k++) far = Math.max(far, diff(f[i], f[k]));
      if (far < reach * 0.45) continue;
      best = { start: i, end: j, score, far };
    }
  }
  if (!best) throw new Error('No clean repetition found: pass --start and --end');
  return { ...best, cuts: [...cutAt].map((i) => +(i / fps).toFixed(2)), reach };
}

function main() {
  const opt = args();
  const info = probe(opt.input);
  let start = opt.start;
  let end = opt.end;
  if (start === null || end === null) {
    const loop = findLoop(frames(opt.input, info), info.fps);
    start = loop.start / info.fps;
    end = loop.end / info.fps;
    console.log(`Camera cuts at ${loop.cuts.join(', ') || 'none'} s; best repetition ${start.toFixed(2)}-${end.toFixed(2)} s (seam difference ${loop.score.toFixed(1)}, movement ${loop.far.toFixed(1)} of ${loop.reach.toFixed(1)})`);
  }
  const len = end - start;
  if (!(len > 0.5) || start < 0 || end > info.duration + 0.01) throw new Error(`Bad loop ${start}-${end} s in a ${info.duration} s clip`);
  const fade = Math.min(opt.fade, len / 4);
  console.log(`Loop: ${start.toFixed(2)}-${end.toFixed(2)} s, ${(len - fade).toFixed(2)} s long, ${fade.toFixed(2)} s cross-fade at the seam`);
  if (opt.dryRun) return;

  // Body = the rep after its first `fade` seconds; head = those first seconds. Fading the body's
  // tail into the head makes the last frame of the file lead straight into its first frame.
  const crop = opt.crop ? `crop=${opt.crop},` : '';
  const t = (s) => s.toFixed(3);
  const graph = [
    `[0:v]fps=${Math.round(info.fps)},${crop}scale='min(720,iw)':-2:flags=lanczos,setsar=1,format=yuv420p,split[a][b]`,
    `[a]trim=start=${t(fade)},setpts=PTS-STARTPTS[body]`,
    `[b]trim=end=${t(fade)},setpts=PTS-STARTPTS[head]`,
    `[body][head]xfade=transition=fade:duration=${t(fade)}:offset=${t(len - 2 * fade)},format=yuv420p[v]`,
  ].join(';');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${opt.key}.mp4`);
  // The rep is cut at the input (-ss/-t), so nothing outside it reaches the filters
  const r = ffmpeg(['-loglevel', 'error', '-y', '-ss', t(start), '-t', t(len), '-i', opt.input, '-filter_complex', graph, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-profile:v', 'main', '-movflags', '+faststart', out]);
  if (r.status !== 0) throw new Error(r.stderr.toString());
  const done = probe(out);
  console.log(`Wrote ${path.relative(process.cwd(), out)}: ${done.w}x${done.h}, ${done.duration.toFixed(2)} s, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
