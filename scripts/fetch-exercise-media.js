#!/usr/bin/env node
/*
 * Downloads the two demonstration drawings (start and end position) for every
 * exercise in the built-in library to public/exercises/<media_key>/0.svg and
 * 1.svg. The guided workout fades between the two frames so each exercise plays
 * like a short animation (ExerciseMedia shows them as white line art).
 *
 * Source: everkinetic exercise data (https://github.com/everkinetic/data),
 * illustrations licensed CC BY-SA 4.0. The files are saved unmodified; the
 * colours are inverted only when displayed. Pinned to one commit so the
 * drawings never change underneath us. A few exercises use the closest movement
 * the set has (noted below).
 *
 * Usage: npm run media:exercises   (only needed when the library changes)
 */
const fs = require('fs');
const path = require('path');

const COMMIT = '446bb9a3d0c3beb6b84f7c9d77dfc8af707a2ab6';
const SOURCE = `https://raw.githubusercontent.com/everkinetic/data/${COMMIT}/dist/svg`;
const OUT = path.join(__dirname, '..', 'public', 'exercises');

// media_key (as stored in exercises.media_key) -> everkinetic exercise number.
// Closest available movement: cable lateral raise (dumbbell lateral raise), rear delt fly
// (bent-over rear delt raise), face pull (seated rear lateral cable raise), hanging leg raise
// (lying leg raise), Bulgarian split squat (dumbbell lunge), hip thrust (bridge),
// seated / Arnold shoulder press (incline dumbbell shoulder press).
const MEDIA = {
  'barbell-bench-press': '0042',
  'incline-barbell-bench-press': '0043',
  'incline-dumbbell-press': '0080',
  'machine-chest-press': '0066',
  'cable-chest-fly': '0048',
  'dips-chest': '0054',
  'push-up': '0077',
  'barbell-deadlift': '0099',
  'lat-pulldown': '0096',
  'barbell-bent-over-row': '0026',
  'seated-cable-row': '0025',
  'pull-up': '0087',
  'one-arm-dumbbell-row': '0024',
  'chest-supported-t-bar-row': '0029',
  'overhead-barbell-press': '0004',
  'seated-dumbbell-shoulder-press': '0031',
  'dumbbell-lateral-raise': '0018',
  'cable-lateral-raise': '0018',
  'rear-delt-fly-machine': '0032',
  'face-pull': '0035',
  'dumbbell-arnold-press': '0031',
  'barbell-bicep-curl': '0211',
  'incline-dumbbell-curl': '0214',
  'hammer-curl': '0227',
  'dumbbell-bicep-curl': '0224',
  'preacher-curl': '0239',
  'cable-curl': '0212',
  'skull-crushers': '0183',
  'triceps-rope-pushdown': '0206',
  'overhead-cable-triceps-extension': '0201',
  'close-grip-bench-press': '0049',
  'barbell-back-squat': '0122',
  'leg-press': '0127',
  'hack-squat': '0123',
  'leg-extension': '0142',
  'bulgarian-split-squat': '0115',
  'romanian-deadlift': '0118',
  'leg-curl': '0117',
  'barbell-hip-thrust': '0109',
  'cable-glute-kickback': '0112',
  'standing-calf-raise': '0282',
  'seated-calf-raise': '0279',
  'hanging-leg-raise': '0021',
  'cable-crunch': '0288',
  'ab-wheel-rollout': '0286',
};

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const svg = await res.text();
  // Served as images, but check anyway that each file is a plain drawing
  if (!svg.trimStart().startsWith('<svg') || /<script|\son\w+=|<foreignObject/i.test(svg)) throw new Error(`unexpected content in ${url}`);
  return svg;
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const [key, id] of Object.entries(MEDIA)) {
    fs.mkdirSync(path.join(OUT, key), { recursive: true });
    fs.writeFileSync(path.join(OUT, key, '0.svg'), await download(`${SOURCE}/${id}-relaxation.svg`));
    fs.writeFileSync(path.join(OUT, key, '1.svg'), await download(`${SOURCE}/${id}-tension.svg`));
    process.stdout.write('.');
  }
  fs.writeFileSync(
    path.join(OUT, 'CREDITS.txt'),
    [
      'Exercise illustrations: everkinetic (https://github.com/everkinetic/data, http://www.everkinetic.com),',
      `commit ${COMMIT}, licensed under Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0,`,
      'https://creativecommons.org/licenses/by-sa/4.0/). Files are unmodified; the app inverts their colours when displaying them.',
      '',
    ].join('\n')
  );
  console.log(`\nWrote ${Object.keys(MEDIA).length * 2} drawings for ${Object.keys(MEDIA).length} exercises to public/exercises`);
}

module.exports = { MEDIA };
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
