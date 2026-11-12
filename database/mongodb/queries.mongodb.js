// =============================================================================
// PhysiQ: MongoDB queries (document store + vector similarity search)
//
// Run the whole file:
//   mongosh "mongodb://127.0.0.1:27017/physiq" --file database/mongodb/queries.mongodb.js
// or paste a section into MongoDB Compass (the mongosh tab) or a VS Code
// MongoDB playground. Build the demo data first: npm run db:init (or db:reset).
//
// Read-only, except two inserts (sections 2 and 12) that the collection
// validators are expected to REJECT.
//
// user_id, session_id, exercise_id and entity_id are MySQL ids. MongoDB stores
// them; the API checks them against MySQL before writing, because no database
// can enforce a foreign key across two stores.
// =============================================================================

db = db.getSiblingDB('physiq');
const show = (title, value) => {
  print(`\n--- ${title}`);
  printjson(value);
};

// Alex, the demo member, owns the demo routines; his id comes from MySQL
const ALEX = (await db.custom_routines.findOne({ name: 'Heavy Push' })).user_id;

// =============================================================================
// A. DOCUMENT STORE: custom_routines and journey_stories
// =============================================================================

// 1. The three collections and their sizes
const sizes = [];
for (const name of ['custom_routines', 'journey_stories', 'vector_embeddings']) {
  sizes.push({ collection: name, documents: await db.getCollection(name).countDocuments() });
}
show('1. collections', sizes);

// 2. Schema validation: the $jsonSchema validator rejects a bad document
const storySchema = (await db.getCollectionInfos({ name: 'journey_stories' }))[0].options.validator.$jsonSchema;
show('2a. journey_stories: required fields and allowed kinds', { required: storySchema.required, kind: storySchema.properties.kind.enum });
try {
  await db.journey_stories.insertOne({ user_id: ALEX, date: '2026-11-08', kind: 'note', mood: 9, created_at: new Date() });
  print('!! the invalid document was accepted (this should not happen)');
} catch (err) {
  show('2b. insert { mood: 9 } (allowed range 1-5)', `REJECTED, error code ${err.code}: Document failed validation`);
}

// 3. Indexes: compound, multikey, sparse and text
show('3a. custom_routines indexes', (await db.custom_routines.getIndexes()).map((i) => ({ name: i.name, key: i.key, unique: i.unique ?? false })));
show('3b. journey_stories indexes', (await db.journey_stories.getIndexes()).map((i) => ({ name: i.name, key: i.key })));

// 4. Nested documents: a whole routine in one read, and a query on a field inside the array
show('4a. one routine: ordered exercises with targets, rest and supersets', await db.custom_routines.findOne(
  { user_id: ALEX, name: 'Heavy Push' },
  { _id: 0, name: 1, focus: 1, times_used: 1, 'exercises.name': 1, 'exercises.target_sets': 1, 'exercises.rep_min': 1, 'exercises.rep_max': 1, 'exercises.rest_seconds': 1, 'exercises.superset': 1 }
));
show('4b. routines that contain exercise 1 (Barbell Bench Press)', await db.custom_routines
  .find({ user_id: ALEX, 'exercises.exercise_id': 1 }, { _id: 0, name: 1, times_used: 1 })
  .toArray());

// 5. Timeline with keyset paging on (date, _id): no OFFSET, served by idx_user_timeline
const page1 = await db.journey_stories
  .find({ user_id: ALEX }, { date: 1, kind: 1, caption: 1 })
  .sort({ date: -1, _id: -1 })
  .limit(3)
  .toArray();
const last = page1[page1.length - 1];
const page2 = await db.journey_stories
  .find({ user_id: ALEX, $or: [{ date: { $lt: last.date } }, { date: last.date, _id: { $lt: last._id } }] }, { date: 1, kind: 1, caption: 1 })
  .sort({ date: -1, _id: -1 })
  .limit(3)
  .toArray();
show('5a. timeline, page 1', page1.map(({ date, kind, caption }) => ({ date, kind, caption })));
show('5b. timeline, page 2 (continues after the last item of page 1)', page2.map(({ date, kind, caption }) => ({ date, kind, caption })));

// 6. Query plan: the timeline uses the compound index, not a collection scan
const plan = await db.journey_stories.find({ user_id: ALEX }).sort({ date: -1, _id: -1 }).limit(5).explain('executionStats');
const stages = (p) => (p.inputStage ? `${p.stage} -> ${stages(p.inputStage)}` : `${p.stage}${p.indexName ? ` (${p.indexName})` : ''}`);
show('6. timeline query plan', {
  winningPlan: stages(plan.queryPlanner.winningPlan),
  docsExamined: plan.executionStats.totalDocsExamined,
  returned: plan.executionStats.nReturned,
});

// 7. Filter on an array field (multikey index idx_user_tags)
show('7. stories tagged "pr"', await db.journey_stories
  .find({ user_id: ALEX, tags: 'pr' }, { _id: 0, date: 1, caption: 1, tags: 1 })
  .sort({ date: -1 })
  .toArray());

// 8. Full-text search over caption + tags, ranked by relevance (text index txt_caption_tags)
show('8. text search "deadlift", best match first', await db.journey_stories
  .find({ user_id: ALEX, $text: { $search: 'deadlift' } }, { _id: 0, date: 1, caption: 1, score: { $meta: 'textScore' } })
  .sort({ score: { $meta: 'textScore' } })
  .toArray());

// 9. Aggregation with $facet: three summaries in one round trip (Progress -> Journey insights)
show('9. $facet: stories per kind, average mood per week, top tags', await db.journey_stories.aggregate([
  { $match: { user_id: ALEX } },
  {
    $facet: {
      perKind: [{ $group: { _id: '$kind', stories: { $sum: 1 } } }],
      moodByWeek: [
        { $match: { mood: { $ne: null } } },
        { $addFields: { day: { $dateFromString: { dateString: '$date' } } } },
        { $group: { _id: { $dateTrunc: { date: '$day', unit: 'week', startOfWeek: 'monday' } }, avgMood: { $avg: '$mood' }, entries: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, week: { $dateToString: { date: '$_id', format: '%Y-%m-%d' } }, avgMood: { $round: ['$avgMood', 1] }, entries: 1 } },
      ],
      topTags: [{ $unwind: '$tags' }, { $group: { _id: '$tags', uses: { $sum: 1 } } }, { $sort: { uses: -1, _id: 1 } }, { $limit: 3 }],
    },
  },
]).toArray());

// 10. $group then $match: the MongoDB form of SQL's GROUP BY ... HAVING
show('10. months with at least 2 workout journals, with average mood and energy', await db.journey_stories.aggregate([
  { $match: { user_id: ALEX, kind: 'workout_journal' } },                        // WHERE
  { $group: {                                                                     // GROUP BY month
    _id: { $substrBytes: ['$date', 0, 7] },
    journals: { $sum: 1 },                                                        // COUNT(*)
    avgMood: { $avg: '$mood' },                                                   // AVG(mood)
    avgEnergy: { $avg: '$energy' },
  } },
  { $match: { journals: { $gte: 2 } } },                                          // HAVING COUNT(*) >= 2
  { $sort: { _id: 1 } },                                                          // ORDER BY
  { $project: { _id: 0, month: '$_id', journals: 1, avgMood: { $round: ['$avgMood', 1] }, avgEnergy: { $round: ['$avgEnergy', 1] } } },
]).toArray());

// =============================================================================
// B. VECTOR SIMILARITY SEARCH: vector_embeddings
//
// What is embedded:  every exercise and food (one MySQL row each) as text:
//                    name, muscle group or food category, equipment or macros.
// Embedding method:  src/lib/embedding-engine.js, deterministic and offline (no
//                    external model): 16 fitness "concept" dimensions (chest, pull,
//                    joint-friendly, high protein, ...) + 16 dimensions of hashed
//                    word stems and character trigrams, scaled to length 1.
// Storage:           one document per item: domain, entity_id (the MySQL id),
//                    user_id (custom foods only), embedding (32 numbers), metadata.
// Similarity metric: cosine similarity (the dot product, because every vector has
//                    length 1); Euclidean (L2) distance is reported as well.
// Retrieval:         an aggregation pipeline filters by domain and owner, scores
//                    every candidate, sorts by similarity and keeps the top k.
// =============================================================================

// 11. One vector document (first 6 of its 32 numbers)
show('11. a vector document', await db.vector_embeddings.findOne(
  { domain: 'exercise', title: 'Barbell Bench Press' },
  { _id: 0, domain: 1, entity_id: 1, user_id: 1, title: 1, semantic_text: 1, dimensions: 1, embedding: { $slice: 6 }, metadata: 1 }
));

// 12. The validator only accepts 32-number vectors
try {
  await db.vector_embeddings.insertOne({
    domain: 'exercise', entity_id: 99999, title: 'Bad vector', subtitle: 'Chest', semantic_text: 'too short',
    dimensions: 32, embedding: [0.5, 0.5], metadata: {}, updated_at: new Date(),
  });
  print('!! the invalid vector was accepted (this should not happen)');
} catch (err) {
  show('12. insert a 2-number vector', `REJECTED, error code ${err.code}: Document failed validation`);
}

// 13. Every stored vector has length 1, so cosine similarity is a plain dot product
show('13. vector lengths (L2 norm) per domain', await db.vector_embeddings.aggregate([
  { $project: { domain: 1, norm: { $sqrt: { $reduce: { input: '$embedding', initialValue: 0, in: { $add: ['$$value', { $multiply: ['$$this', '$$this'] }] } } } } } },
  { $group: { _id: '$domain', vectors: { $sum: 1 }, minNorm: { $min: '$norm' }, maxNorm: { $max: '$norm' } } },
  { $project: { _id: 0, domain: '$_id', vectors: 1, minNorm: { $round: ['$minNorm', 6] }, maxNorm: { $round: ['$maxNorm', 6] } } },
  { $sort: { domain: 1 } },
]).toArray());

// The k-nearest-neighbour pipeline, the same as searchVectorsInMongo() in src/lib/vector.ts
const nearest = (domain, queryVector, { exclude = null, userId = null, k = 5 } = {}) => [
  { $match: { domain, $or: [{ user_id: null }, { user_id: userId }], ...(exclude ? { entity_id: { $ne: exclude } } : {}) } },
  {
    $addFields: {
      cosine_similarity: {
        $reduce: {
          input: { $range: [0, 32] },
          initialValue: 0,
          in: { $add: ['$$value', { $multiply: [{ $arrayElemAt: ['$embedding', '$$this'] }, { $arrayElemAt: [queryVector, '$$this'] }] }] },
        },
      },
      l2_distance: {
        $sqrt: {
          $reduce: {
            input: { $range: [0, 32] },
            initialValue: 0,
            in: { $add: ['$$value', { $pow: [{ $subtract: [{ $arrayElemAt: ['$embedding', '$$this'] }, { $arrayElemAt: [queryVector, '$$this'] }] }, 2] }] },
          },
        },
      },
    },
  },
  { $sort: { cosine_similarity: -1, entity_id: 1 } },
  { $limit: k },
  { $project: { _id: 0, entity_id: 1, title: 1, subtitle: 1, cosine_similarity: { $round: ['$cosine_similarity', 4] }, l2_distance: { $round: ['$l2_distance', 4] } } },
];

// 14. Alternatives to an exercise: its nearest neighbours (Train -> smart search -> alternatives)
const bench = await db.vector_embeddings.findOne({ domain: 'exercise', title: 'Barbell Bench Press' });
show('14. exercises most similar to Barbell Bench Press', await db.vector_embeddings
  .aggregate(nearest('exercise', bench.embedding, { exclude: bench.entity_id }))
  .toArray());

// 15. Food swaps: built-in foods plus only this member's own custom foods
const chicken = await db.vector_embeddings.findOne({ domain: 'food', title: 'Chicken Breast (Grilled)' });
show('15. foods most similar to Chicken Breast (Grilled)', await db.vector_embeddings
  .aggregate(nearest('food', chicken.embedding, { exclude: chicken.entity_id, userId: ALEX }))
  .toArray());

// 16. A free-text search. The app turns the typed text into a vector with the same
//     engine (GET /api/vector/search?domain=exercise&q=...); this is the vector for
//     "lower back friendly leg builder".
const QUERY = [0, 0.287331, 0, 0, 0.287331, 0, 0, 0.804528, 0, 0, 0, 0, 0, 0, 0, 0,
  -0.215499, 0, -0.086199, 0, 0, -0.129299, 0, 0.086199, 0, 0, 0.215499, 0, 0.129299, 0, 0.215499, 0];
show('16. top 3 exercises for "lower back friendly leg builder"', await db.vector_embeddings
  .aggregate(nearest('exercise', QUERY, { k: 3 }))
  .toArray());

// 17. The pre-filter uses an index: (domain, user_id), next to the unique (domain, entity_id)
const vplan = await db.vector_embeddings.find({ domain: 'food', user_id: null }).explain('executionStats');
show('17. vector indexes and the plan for the pre-filter', {
  indexes: (await db.vector_embeddings.getIndexes()).map((i) => ({ name: i.name, key: i.key, unique: i.unique ?? false })),
  winningPlan: stages(vplan.queryPlanner.winningPlan),
  docsExamined: vplan.executionStats.totalDocsExamined,
  returned: vplan.executionStats.nReturned,
});

// =============================================================================
// C. FILES IN THE DATABASE: GridFS bucket progress_photos
//
// Progress photos are stored in MongoDB itself, not on the server's disk:
//   progress_photos.files   one document per photo (filename, length, uploadDate,
//                           metadata.user_id = owner, metadata.content_type)
//   progress_photos.chunks  the bytes in 255 KB pieces, keyed by (files_id, n)
// The app reads a photo by filename AND the signed-in user's id, so a member
// can never open someone else's photo. Add a progress photo in the app first.
// =============================================================================

// 18. Photos per member: count and total size, from the files collection
show('18. progress photos per member', await db.progress_photos.files.aggregate([
  { $group: { _id: '$metadata.user_id', photos: { $sum: 1 }, totalBytes: { $sum: '$length' }, latest: { $max: '$uploadDate' } } },
  { $project: { _id: 0, user_id: '$_id', photos: 1, totalKB: { $round: [{ $divide: ['$totalBytes', 1024] }, 1] }, latest: 1 } },
]).toArray());

// 19. One photo's file document and how many chunks hold its bytes, plus the bucket's indexes
const photo = await db.progress_photos.files.findOne({}, { sort: { uploadDate: -1 } });
show('19. newest photo and its chunks', photo
  ? { filename: photo.filename, length: photo.length, chunkSize: photo.chunkSize, metadata: photo.metadata,
      chunks: await db.progress_photos.chunks.countDocuments({ files_id: photo._id }) }
  : 'no photos yet: add one in Progress -> Journey');
show('19b. GridFS indexes', {
  files: (await db.progress_photos.files.getIndexes()).map((i) => ({ name: i.name, key: i.key, unique: i.unique ?? false })),
  chunks: (await db.progress_photos.chunks.getIndexes()).map((i) => ({ name: i.name, key: i.key, unique: i.unique ?? false })),
});
