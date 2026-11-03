/*
 * PhysiQ 32-Dimensional Semantic Vector Embedding Engine
 *
 * Generates deterministic, L2-normalized 32-d dense float embeddings [-1..1]
 * for exercises, foods, and natural-language queries:
 *   - Dimensions 0..15: 16 orthogonal domain concept axes (biomechanics, muscle
 *     groups, joint-friendliness, equipment, macro profiles, meal timing, satiety)
 *   - Dimensions 16..31: signed feature hashing over word stems & character trigrams
 *
 * Because every vector is L2-normalized (||v||_2 = 1):
 *   - Cosine Similarity: cos(theta) = A . B            in [-1.0, 1.0]
 *   - Cosine Distance:   1 - cos(theta)                in [ 0.0, 2.0]
 *   - Euclidean (L2):    sqrt(sum((A_i - B_i)^2))      in [ 0.0, 2.0]
 */

const VECTOR_DIMENSIONS = 32;

const CONCEPT_AXES = [
  // 0: Chest / Push / Pressing
  ['chest', 'pec', 'pectoral', 'bench', 'press', 'push', 'fly', 'incline', 'dip', 'upper chest'],
  // 1: Back / Pull / Lats / V-taper
  ['back', 'lat', 'lats', 'pull', 'pulldown', 'row', 'chin', 'pull-up', 'vtaper', 'v-taper', 'rhomboid', 'trap', 'posture'],
  // 2: Shoulders / Delts / Overhead
  ['shoulder', 'shoulders', 'delt', 'delts', 'lateral', 'overhead', 'military', 'rear delt', 'face pull', 'rotator'],
  // 3: Arms / Biceps / Triceps / Elbows
  ['arm', 'arms', 'bicep', 'biceps', 'tricep', 'triceps', 'curl', 'pushdown', 'skull', 'extension', 'brachialis', 'forearm', 'grip'],
  // 4: Quads / Knee extension / Squat
  ['quad', 'quads', 'squat', 'leg press', 'hack', 'lunge', 'split squat', 'leg extension', 'knee', 'anterior', 'thigh', 'leg', 'legs'],
  // 5: Posterior chain / Hamstrings / Glutes / Hinge
  ['hamstring', 'hamstrings', 'glute', 'glutes', 'deadlift', 'rdl', 'romanian', 'hip thrust', 'hinge', 'leg curl', 'kickback', 'posterior'],
  // 6: Core / Calves / Bodyweight / Stability
  ['core', 'ab', 'abs', 'abdominal', 'crunch', 'plank', 'wheel', 'hanging', 'calf', 'calves', 'raise', 'stability'],
  // 7: Joint-friendly / Low lower-back stress / Machine / Cable / Isolation / Safe
  [
    'machine', 'cable', 'supported', 'seated', 'lying', 'isolation', 'joint', 'safe', 'friendly',
    'pain', 'rehab', 'lower back friendly', 'no axial', 'spine', 'shoulder safe', 'controlled', 'stretch',
  ],
  // 8: Heavy compound / Barbell / Strength / Power / Mass
  ['barbell', 'heavy', 'compound', 'strength', 'power', 'mass', 'overload', 'free weight', 'dumbbell', 'axial'],
  // 9: High protein / Muscle recovery / Lean meat / Hypertrophy
  ['protein', 'high protein', 'chicken', 'beef', 'salmon', 'tuna', 'egg', 'whey', 'isolate', 'paneer', 'tofu', 'yogurt', 'muscle', 'recovery', 'anabolic', 'hypertrophy'],
  // 10: Complex carbs / Pre-workout energy / Glycogen
  ['carb', 'carbs', 'rice', 'oat', 'oats', 'oatmeal', 'potato', 'sweet potato', 'bread', 'roti', 'chapati', 'banana', 'glycogen', 'energy', 'pre-workout', 'endurance', 'fuel'],
  // 11: Healthy fats / Omega / Nuts / Satiety
  ['fat', 'fats', 'healthy fat', 'salmon', 'omega', 'peanut', 'almond', 'nuts', 'avocado', 'olive oil', 'yolk', 'calorie dense', 'bulking', 'surplus'],
  // 12: Low calorie / Fat loss / Cutting / High volume lean
  ['low calorie', 'low carb', 'fat loss', 'cut', 'cutting', 'lean', 'diet', 'filling', 'satiety', 'broccoli', 'greens', 'veg', 'vegetable', 'berries', 'blueberries', 'egg white', 'tuna', 'non-fat', 'skim'],
  // 13: Quick / Portable / Shake / Snack / Post-workout
  ['quick', 'fast', 'shake', 'scoop', 'snack', 'post-workout', 'intra-workout', 'drink', 'liquid', 'portable', 'easy', 'electrolyte'],
  // 14: Breakfast / Morning / Dairy & Eggs
  ['breakfast', 'morning', 'egg', 'eggs', 'oat', 'oatmeal', 'yogurt', 'milk', 'dairy', 'berries', 'banana'],
  // 15: Complete Meal / Lunch / Dinner / Bowl / Plate
  ['meal', 'bowl', 'plate', 'lunch', 'dinner', 'evening', 'steak', 'chicken & rice', 'balanced', 'complete'],
];

function fnv1aHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function embedText(rawText) {
  const text = String(rawText || '').toLowerCase().trim();
  const vec = new Array(VECTOR_DIMENSIONS).fill(0);

  if (!text) {
    vec[0] = 1;
    return vec;
  }

  // 1. Score the 16 semantic concept axes
  for (let axis = 0; axis < 16; axis++) {
    const terms = CONCEPT_AXES[axis];
    let score = 0;
    for (const term of terms) {
      if (text.includes(term)) {
        score += term.includes(' ') ? 1.8 : 1.0;
      }
    }
    vec[axis] = score;
  }

  // 2. Signed feature projection on dimensions 16..31 using word stems & character 3-grams
  const tokens = text.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    const h = fnv1aHash(tok);
    const dim = 16 + (h % 16);
    const sign = (h & 16) ? 1 : -1;
    vec[dim] += sign * 0.75;

    if (tok.length >= 4) {
      const stem = tok.slice(0, 4);
      const hs = fnv1aHash(stem);
      vec[16 + (hs % 16)] += ((hs & 32) ? 1 : -1) * 0.45;
    }
  }

  // 3. L2-normalize to unit length so dot product === cosine similarity
  let normSq = 0;
  for (let i = 0; i < VECTOR_DIMENSIONS; i++) normSq += vec[i] * vec[i];
  const norm = Math.sqrt(normSq) || 1;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

function buildExerciseSemanticText(ex) {
  const tags = [];
  const eq = String(ex.equipment_needed || '').toLowerCase();
  const mg = String(ex.muscle_group || '').toLowerCase();

  if (eq === 'machine' || eq === 'cable') {
    tags.push('joint friendly controlled stability low lower back stress isolation safe rehab');
  } else if (eq === 'barbell') {
    tags.push('heavy compound strength power mass builder axial free weight');
  } else if (eq === 'dumbbell') {
    tags.push('unilateral range of motion stabilizer shoulder friendly free weight');
  } else if (eq === 'bodyweight') {
    tags.push('calisthenics bodyweight core control anywhere');
  }

  if (['quads', 'hamstrings', 'glutes', 'calves'].includes(mg) && eq !== 'barbell') {
    tags.push('lower back friendly leg builder knee hip hypertrophy without spinal loading');
  }
  if (mg === 'chest' && (eq === 'dumbbell' || eq === 'cable' || eq === 'machine')) {
    tags.push('shoulder safe chest press pec builder');
  }

  return `${ex.name}. Muscle group: ${ex.muscle_group}. Equipment: ${ex.equipment_needed}. ${ex.instructions || ''} ${tags.join(' ')}`.trim();
}

function buildFoodSemanticText(food) {
  const tags = [];
  const pro = Number(food.protein_g) || 0;
  const carb = Number(food.carbs_g) || 0;
  const fat = Number(food.fat_g) || 0;
  const cal = Number(food.calories) || 0;

  if (pro >= 25) tags.push('high protein muscle recovery hypertrophy post-workout anabolic lean');
  else if (pro >= 15) tags.push('moderate protein recovery');

  if (carb >= 40) tags.push('high carb complex carbs pre-workout energy glycogen fuel');
  else if (carb <= 8) tags.push('low carb keto friendly cutting');

  if (cal <= 160) tags.push('low calorie fat loss cutting lean snack light filling');
  else if (cal >= 450) tags.push('complete meal high energy bulking lunch dinner bowl');

  if (fat <= 5 && pro >= 20) tags.push('very lean low fat high protein');
  if (fat >= 12) tags.push('healthy fats satiety omega energy');

  return `${food.name}. Category: ${food.category}. Serving: ${food.serving_label} (${cal} kcal, ${pro}g protein, ${carb}g carbs, ${fat}g fat). ${tags.join(' ')}`.trim();
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : Number((dot / denom).toFixed(4));
}

function euclideanDistance(a, b) {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Number(Math.sqrt(sum).toFixed(4));
}

module.exports = {
  VECTOR_DIMENSIONS,
  embedText,
  buildExerciseSemanticText,
  buildFoodSemanticText,
  cosineSimilarity,
  euclideanDistance,
};
