const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { client, signedIn, today, photoForm, PNG_1X1, uniqueEmail, DEMO_PASSWORD } = require('./helpers');

let alex;
let admin;
const created = []; // story ids to clean up

before(async () => {
  alex = await signedIn('alex@physiq.test');
  admin = await signedIn('admin@physiq.test');
});

after(async () => {
  for (const id of created) await alex.del(`/api/journey/${id}`);
});

test('journey requires a signed-in user', async () => {
  const anon = client();
  assert.equal((await anon.get('/api/journey')).status, 401);
  assert.equal((await anon.get('/api/journey/insights')).status, 401);
  assert.equal((await anon.get('/api/photos/00000000-0000-0000-0000-000000000000.png')).status, 401);
});

test('a note can be created and is validated', async () => {
  const ok = await alex.post('/api/journey', { date: today(), caption: 'Zebra pump session notes', mood: 4, energy: 3, tags: ['Zebra', 'zebra', ' pump '] });
  assert.equal(ok.status, 201);
  created.push(ok.body.id);

  assert.equal((await alex.post('/api/journey', { date: today(), caption: '   ' })).status, 400, 'empty caption');
  assert.equal((await alex.post('/api/journey', { date: today(1000), caption: 'future' })).status, 400, 'far-future date');
  assert.equal((await alex.post('/api/journey', { date: '2026-02-30', caption: 'impossible date' })).status, 400, 'impossible date');
  assert.equal((await alex.post('/api/journey', { date: today(), caption: 'bad mood', mood: 9 })).status, 400, 'mood out of range');
  const wrongType = await alex.req('/api/journey', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
  assert.equal(wrongType.status, 415, 'JSON content type required');
});

test('tags are normalised and the feed finds the note by tag, kind and full-text search', async () => {
  const byTag = await alex.get('/api/journey?tag=zebra');
  assert.equal(byTag.status, 200);
  assert.equal(byTag.body.stories.length, 1);
  assert.deepEqual(byTag.body.stories[0].tags, ['zebra', 'pump']);

  const byKind = await alex.get('/api/journey?kind=note');
  assert.ok(byKind.body.stories.every((s) => s.kind === 'note'));

  const byText = await alex.get('/api/journey?q=zebra');
  assert.equal(byText.body.stories.length, 1, 'text index finds whole words in caption/tags');
  assert.equal((await alex.get('/api/journey?q=xylophonic')).body.stories.length, 0);

  assert.equal((await alex.get('/api/journey?kind=selfie')).status, 400);
  assert.equal((await alex.get('/api/journey?before=garbage')).status, 400);
});

test('the feed never leaks another member’s stories, even through search', async () => {
  const adminFeed = await admin.get('/api/journey?q=zebra');
  assert.equal(adminFeed.body.stories.length, 0);
});

test('feed pages with a keyset cursor without repeats', async () => {
  const first = await alex.get('/api/journey?limit=3');
  assert.equal(first.body.stories.length, 3);
  assert.ok(first.body.nextCursor);
  const second = await alex.get(`/api/journey?limit=3&before=${first.body.nextCursor}`);
  const seen = new Set(first.body.stories.map((s) => s.id));
  for (const s of second.body.stories) assert.ok(!seen.has(s.id), 'no story appears on two pages');
  const dates = [...first.body.stories, ...second.body.stories].map((s) => s.date);
  assert.deepEqual(dates, [...dates].sort().reverse(), 'newest first across pages');
});

test('progress photo: upload, private download, access control, delete', async () => {
  const up = await alex.req('/api/journey/photo', { method: 'POST', body: photoForm({ caption: 'Front pose', tags: 'fasted, morning' }) });
  assert.equal(up.status, 201, JSON.stringify(up.body));
  created.push(up.body.id);
  assert.match(up.body.photoUrl, /^\/api\/photos\/[a-f0-9-]{36}\.png$/);

  const img = await alex.get(up.body.photoUrl);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.match(img.headers.get('cache-control'), /private/);
  assert.equal(img.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(img.body.equals(PNG_1X1), 'bytes round-trip unchanged');

  assert.equal((await admin.get(up.body.photoUrl)).status, 404, 'another member cannot fetch it');
  assert.equal((await client().get(up.body.photoUrl)).status, 401, 'anonymous cannot fetch it');

  const story = (await alex.get('/api/journey?kind=progress_photo')).body.stories.find((s) => s.id === up.body.id);
  assert.equal(story.photo_angle, 'front');
  assert.equal(typeof story.weight_snapshot, 'number', 'weight comes from fn_current_weight in MySQL');
  assert.ok(story.photo_url);

  assert.equal((await admin.del(`/api/journey/${up.body.id}`)).status, 404, 'another member cannot delete it');
  assert.equal((await alex.del(`/api/journey/${up.body.id}`)).status, 200);
  created.splice(created.indexOf(up.body.id), 1);
  assert.equal((await alex.get(up.body.photoUrl)).status, 404, 'file is removed with the story');
});

test('photo upload rejects non-images, spoofed types, bad angles and oversize files', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal((await alex.req('/api/journey/photo', { method: 'POST', body: photoForm({ bytes: svg, name: 'x.png', type: 'image/png' }) })).status, 415, 'SVG disguised as PNG');
  assert.equal((await alex.req('/api/journey/photo', { method: 'POST', body: photoForm({ bytes: Buffer.from('<html></html>'), name: 'x.jpg', type: 'image/jpeg' }) })).status, 415, 'HTML disguised as JPEG');
  assert.equal((await alex.req('/api/journey/photo', { method: 'POST', body: photoForm({ angle: 'upside-down' }) })).status, 400);
  assert.equal((await alex.req('/api/journey/photo', { method: 'POST', body: photoForm({ date: today(500) }) })).status, 400);
  const big = Buffer.concat([PNG_1X1, Buffer.alloc(7 * 1024 * 1024)]);
  assert.equal((await alex.req('/api/journey/photo', { method: 'POST', body: photoForm({ bytes: big }) })).status, 413);
  assert.equal((await alex.req('/api/journey/photo', { method: 'POST', body: JSON.stringify({}) })).status, 415, 'must be multipart');
  assert.equal((await alex.get('/api/photos/..%2F..%2Fpackage.json')).status, 404, 'no path traversal');
  assert.equal((await alex.get('/api/photos/not-a-photo.png')).status, 404);
});

test('insights aggregate counts, mood by week and top tags for the member only', async () => {
  // Top tags are ranked by usage, so give "zebra" a second use to make it the clear leader
  const second = await alex.post('/api/journey', { date: today(), caption: 'Second zebra entry', mood: 5, tags: ['zebra'] });
  created.push(second.body.id);
  const res = await alex.get('/api/journey/insights');
  assert.equal(res.status, 200);
  const { counts, moodByWeek, topTags } = res.body;
  assert.ok(counts.workout_journal >= 6 && counts.note >= 1);
  assert.ok(moodByWeek.length >= 2);
  for (const w of moodByWeek) {
    assert.match(w.week, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(w.week + 'T00:00:00Z').getUTCDay(), 1, 'weeks start on Monday');
    assert.ok(w.mood >= 1 && w.mood <= 5);
  }
  assert.deepEqual(topTags[0], { tag: 'zebra', count: 2 });
  const adminInsights = await admin.get('/api/journey/insights');
  assert.ok(!adminInsights.body.topTags.some((t) => t.tag === 'zebra'));
});

test('the first workout of a new member creates a milestone story', async () => {
  const email = uniqueEmail('milestone');
  const c = client();
  assert.equal((await c.post('/api/auth/register', { name: 'Milestone Tester', email, password: DEMO_PASSWORD })).status, 201);
  await c.login(email);
  const lib = (await c.get('/api/exercises')).body.exercises;
  const bench = lib.find((e) => e.name === 'Barbell Bench Press');
  const saved = await c.post('/api/workouts', {
    clientRef: require('crypto').randomUUID(),
    sessionDate: today(),
    splitDayId: null,
    bodyPart: 'Freestyle',
    startedAt: null,
    endedAt: null,
    exercises: [{ exerciseId: bench.id, sets: [{ weight: 60, reps: 8, warmup: false }] }],
  });
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  const feed = await c.get('/api/journey?kind=milestone');
  assert.equal(feed.body.stories.length, 1);
  assert.deepEqual(feed.body.stories[0].milestone, { type: 'sessions', value: 1 });
  // a retried submit (same clientRef) must not add a second milestone
  const again = await c.get('/api/journey?kind=milestone');
  assert.equal(again.body.stories.length, 1);
  assert.equal((await c.del('/api/me', { password: DEMO_PASSWORD })).status, 200, 'cleanup: delete the test account');
});
