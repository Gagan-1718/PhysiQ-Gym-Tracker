#!/usr/bin/env node
/*
 * Generates docs/CONTRIBUTIONS.md from git history: commits, active days, lines
 * and the areas each member touched. Facts only; nothing is typed in by hand.
 *
 * Usage: npm run docs:contributions
 *
 * Counts cover the checked-out branch. Generated and binary files (lockfile,
 * screenshots, diagrams, the generated data dictionary and demo seed) are
 * excluded from line counts so they do not distort them.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });

// Same person, several git identities: group by e-mail
const PEOPLE = {
  'pes1ug24am367@stu.pes.edu': 'Gagandeep N (Gagan-1718)',
  'demigodhruvanth@gmail.com': 'Dhruvanth (theDEMIGOD600)',
};

const GENERATED = [/package-lock\.json$/, /^docs\/screenshots\//, /^docs\/diagrams\/.*\.(png|svg)$/, /^docs\/DATA_DICTIONARY\.md$/, /^database\/seeds\/demo_data\.sql$/, /^public\/icons\//, /\.png$/];
const AREAS = [
  ['Database (SQL, Mongo validators, seeds)', /^database\//],
  ['Database tests', /^tests\/db\//],
  ['API routes', /^src\/app\/api\//],
  ['Pages and UI components', /^src\/(app\/(?!api)|components\/)/],
  ['Libraries and types', /^src\/(lib|types)\//],
  ['API tests and CI', /^(tests\/api\/|\.github\/)/],
  ['Scripts and tooling', /^(scripts\/|package\.json|tailwind|tsconfig|next\.config|postcss)/],
  ['Documentation', /^(docs\/|README\.md|PLAN\.md)/],
];

const log = git(['log', '--no-merges', '--numstat', '--format=@@%H|%ae|%ad', '--date=short']).split('@@').slice(1);
const stats = new Map();
for (const block of log) {
  const [head, ...rows] = block.split('\n');
  const [, email, date] = head.split('|');
  const key = PEOPLE[email.toLowerCase()] ?? email;
  const s = stats.get(key) ?? { commits: 0, days: new Set(), added: 0, deleted: 0, areas: new Map(), first: date, last: date };
  s.commits++;
  s.days.add(date);
  if (date < s.first) s.first = date;
  if (date > s.last) s.last = date;
  for (const row of rows) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(row);
    if (!m || GENERATED.some((re) => re.test(m[3]))) continue;
    const added = Number(m[1]) || 0;
    const deleted = Number(m[2]) || 0;
    s.added += added;
    s.deleted += deleted;
    const area = AREAS.find(([, re]) => re.test(m[3]))?.[0] ?? 'Other';
    s.areas.set(area, (s.areas.get(area) ?? 0) + added + deleted);
  }
  stats.set(key, s);
}

const total = [...stats.values()].reduce((n, s) => n + s.commits, 0);
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const out = [];
out.push('# Team contributions');
out.push('');
out.push(`> Generated from git history of branch \`${branch}\` by \`npm run docs:contributions\`. Do not edit by hand.`);
out.push('');
out.push('| Member | Commits | Share | Active days | First → last commit | Lines added / removed* |');
out.push('|---|---:|---:|---:|---|---:|');
for (const [name, s] of [...stats].sort((a, b) => b[1].commits - a[1].commits)) {
  out.push(`| ${name} | ${s.commits} | ${Math.round((100 * s.commits) / total)}% | ${s.days.size} | ${s.first} → ${s.last} | +${s.added.toLocaleString('en')} / −${s.deleted.toLocaleString('en')} |`);
}
out.push('');
out.push('\\* Excluding the lockfile, screenshots, rendered diagrams, the generated data dictionary and the generated demo seed.');
out.push('');
out.push('## Where each member worked');
out.push('');
out.push('Lines added plus removed per area (same exclusions).');
out.push('');
const areaNames = [...AREAS.map(([n]) => n), 'Other'];
const members = [...stats].sort((a, b) => b[1].commits - a[1].commits);
out.push(`| Area | ${members.map(([n]) => n).join(' | ')} |`);
out.push(`|---|${members.map(() => '---:').join('|')}|`);
for (const area of areaNames) {
  const cells = members.map(([, s]) => (s.areas.get(area) ?? 0).toLocaleString('en'));
  if (cells.every((c) => c === '0')) continue;
  out.push(`| ${area} | ${cells.join(' | ')} |`);
}
out.push('');
out.push('## Reading these numbers');
out.push('');
out.push('- **Commit counts depend on commit size.** The history on this branch was deliberately split into small commits (one table, procedure, route or component each), so counts say little about effort. Lines per area are a fairer view.');
out.push('- **The foundation is the first member\'s schema, Mongo model, Next.js scaffold and the 10-phase plan** (`PLAN.md`). Much of that code was later rewritten or replaced as the design changed, so surviving lines understate what it provided.');
out.push('- **Both members worked on the database and on the application**, as the course requires (see the area table).');

// Commits that exist on other branches but are not part of this branch yet
const others = [];
for (const ref of git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin']).split('\n').filter(Boolean)) {
  if (/\/(HEAD|main)$/.test(ref) || ref === `origin/${branch}`) continue;
  const ahead = git(['log', '--no-merges', '--format=%h %an %ad %s', '--date=short', `HEAD..${ref}`]).trim();
  if (ahead) others.push([ref, ahead.split('\n')]);
}
for (const [ref, commits] of others) {
  out.push(`- **${ref}** has ${commits.length} commit${commits.length === 1 ? ' that is' : 's that are'} not on this branch yet: ${commits.map((c) => `\`${c.split(' ')[0]}\` (${c.split(' ').slice(1).join(' ')})`).join('; ')}`);
}
out.push('');
fs.writeFileSync(path.join(ROOT, 'docs', 'CONTRIBUTIONS.md'), out.join('\n'));
console.log(`Wrote docs/CONTRIBUTIONS.md (${total} commits, ${stats.size} members)`);
