import { MongoClient, type Db } from 'mongodb';

/**
 * MongoDB access layer: one client per process, reused across dev hot reloads.
 * Collections (validators live in database/mongodb/):
 *   custom_routines  — workout templates with nested exercise lists
 *   journey_stories  — post-workout journals and progress photos
 */
const globalForMongo = globalThis as unknown as { physiqMongo?: Promise<MongoClient> };

function getClient(): Promise<MongoClient> {
  if (!globalForMongo.physiqMongo) {
    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    globalForMongo.physiqMongo = client.connect().catch((err) => {
      // Do not cache a failed connection; the next request retries
      globalForMongo.physiqMongo = undefined;
      throw err;
    });
  }
  return globalForMongo.physiqMongo;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || 'physiq');
}
