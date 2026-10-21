#!/usr/bin/env node
/*
 * MongoDB half of the viva demo (npm run viva:mongo). Read-only except for one
 * deliberately INVALID insert, which the collection validator rejects.
 * Each section prints what to say; the same commands work in mongosh / Compass.
 */
const path = require('path');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(path.join(__dirname, '..', '..'));

const h = (n, title) => console.log(`\n=== ${n}. ${title} ${'='.repeat(Math.max(3, 70 - title.length))}`);
const show = (label, value) => console.log(`${label}:`, typeof value === 'string' ? value : JSON.stringify(value, null, 2));

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'physiq');
  const sql = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'physiq_db',
  });
  const stories = db.collection('journey_stories');
  const [[alex]] = await sql.query("SELECT id FROM users WHERE email = 'alex@physiq.test'");

  h(1, 'Two collections, documents instead of join tables');
  for (const name of ['custom_routines', 'journey_stories']) show(name, `${await db.collection(name).countDocuments()} documents`);
  show('a routine (nested exercise list, supersets, targets in ONE document)', await db.collection('custom_routines').findOne({ user_id: alex.id }, { projection: { _id: 0, user_id: 0, created_at: 0, updated_at: 0 } }));

  h(2, 'A JSON-schema validator guards the collection');
  const info = (await db.listCollections({ name: 'journey_stories' }).toArray())[0];
  const schema = info.options.validator.$jsonSchema;
  show('required fields', schema.required);
  show('kind must be one of', schema.properties.kind.enum);
  show('mood range', { min: schema.properties.mood.minimum, max: schema.properties.mood.maximum });
  show('validationLevel / validationAction', `${info.options.validationLevel} / ${info.options.validationAction}`);
  try {
    await stories.insertOne({ user_id: alex.id, date: '2026-10-21', kind: 'note', mood: 9, created_at: new Date() });
    console.log('!! the invalid document was accepted (this should not happen)');
  } catch (err) {
    console.log(`insert { mood: 9 } -> REJECTED, error code ${err.code}: document failed validation`);
  }
  try {
    await stories.insertOne({ user_id: alex.id, date: '21/10/2026', kind: 'note', created_at: new Date() });
  } catch (err) {
    console.log(`insert { date: '21/10/2026' } -> REJECTED, error code ${err.code} (bad date format)`);
  }

  h(3, 'Indexes');
  for (const ix of await stories.indexes()) show(`  ${ix.name}`, JSON.stringify(ix.key));

  h(4, 'Timeline query uses the compound index (no collection scan)');
  const plan = await stories.find({ user_id: alex.id }).sort({ date: -1, _id: -1 }).limit(5).explain('executionStats');
  const stage = (p) => (p.inputStage ? `${p.stage} -> ${stage(p.inputStage)}` : p.stage + (p.indexName ? ` (${p.indexName})` : ''));
  show('winning plan', stage(plan.queryPlanner.winningPlan));
  show('docs examined / returned', `${plan.executionStats.totalDocsExamined} / ${plan.executionStats.nReturned}`);

  h(5, 'Full-text search over caption + tags (text index, scoped to the member)');
  const hits = await stories.find({ user_id: alex.id, $text: { $search: 'deadlift' } }, { projection: { _id: 0, date: 1, caption: 1, tags: 1 } }).toArray();
  show('search "deadlift"', hits);

  h(6, 'Aggregation pipeline with $facet: counts, mood by week, top tags in ONE round trip');
  const [agg] = await stories
    .aggregate([
      { $match: { user_id: alex.id } },
      {
        $facet: {
          perKind: [{ $group: { _id: '$kind', n: { $sum: 1 } } }],
          moodByWeek: [
            { $match: { mood: { $ne: null } } },
            { $addFields: { day: { $dateFromString: { dateString: '$date' } } } },
            { $group: { _id: { $dateTrunc: { date: '$day', unit: 'week', startOfWeek: 'monday' } }, avgMood: { $avg: '$mood' }, entries: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          topTags: [{ $unwind: '$tags' }, { $group: { _id: '$tags', n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 3 }],
        },
      },
    ])
    .toArray();
  show('stories per kind', agg.perKind);
  show('average mood per week', agg.moodByWeek.map((w) => ({ week: w._id.toISOString().slice(0, 10), avgMood: Math.round(w.avgMood * 10) / 10, entries: w.entries })));
  show('top tags', agg.topTags);

  h(7, 'Polyglot: a Mongo document points at MySQL; the app joins them');
  const linked = await stories.findOne({ user_id: alex.id, session_id: { $type: 'int' } }, { sort: { date: -1 } });
  const [[session]] = await sql.query('SELECT id, session_date, body_part, total_volume FROM workout_sessions WHERE id = ? AND user_id = ?', [linked.session_id, alex.id]);
  show('MongoDB story', { date: linked.date, caption: linked.caption, mood: linked.mood, tags: linked.tags, session_id: linked.session_id });
  show('MySQL session it points to (volume computed by a trigger)', { ...session, session_date: String(session.session_date).slice(0, 15) });

  await sql.end();
  await client.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
