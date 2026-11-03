import { getMongoDb } from '@/lib/mongodb';
import type { Exercise, FoodItem } from '@/types/database';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const engine = require('./embedding-engine.js') as {
  VECTOR_DIMENSIONS: number;
  embedText: (text: string) => number[];
  buildExerciseSemanticText: (ex: Partial<Exercise>) => string;
  buildFoodSemanticText: (food: Partial<FoodItem>) => string;
  cosineSimilarity: (a: number[], b: number[]) => number;
  euclideanDistance: (a: number[], b: number[]) => number;
};

export const VECTOR_DIMENSIONS = engine.VECTOR_DIMENSIONS;
export const embedText = engine.embedText;
export const buildExerciseSemanticText = engine.buildExerciseSemanticText;
export const buildFoodSemanticText = engine.buildFoodSemanticText;
export const cosineSimilarity = engine.cosineSimilarity;
export const euclideanDistance = engine.euclideanDistance;

export type VectorDomain = 'exercise' | 'food';

export interface VectorDocument {
  domain: VectorDomain;
  entity_id: number;
  user_id: number | null;
  title: string;
  subtitle: string;
  semantic_text: string;
  dimensions: number;
  embedding: number[];
  metadata: Record<string, unknown>;
  updated_at: Date;
}

export interface VectorSearchHit {
  domain: VectorDomain;
  entity_id: number;
  title: string;
  subtitle: string;
  semantic_text: string;
  cosine_similarity: number;
  cosine_distance: number;
  l2_distance: number;
  match_pct: number;
  metadata: Record<string, unknown>;
}

/** Upsert a 32-d vector embedding for a MySQL exercise into MongoDB physiq.vector_embeddings */
export async function upsertExerciseVector(ex: Exercise): Promise<void> {
  const db = await getMongoDb();
  const semantic_text = buildExerciseSemanticText(ex);
  const embedding = embedText(semantic_text);
  await db.collection<VectorDocument>('vector_embeddings').updateOne(
    { domain: 'exercise', entity_id: ex.id },
    {
      $set: {
        domain: 'exercise',
        entity_id: ex.id,
        user_id: null,
        title: ex.name,
        subtitle: `${ex.muscle_group} · ${ex.equipment_needed}`,
        semantic_text,
        dimensions: VECTOR_DIMENSIONS,
        embedding,
        metadata: {
          muscle_group_id: ex.muscle_group_id,
          muscle_group: ex.muscle_group,
          equipment_needed: ex.equipment_needed,
          instructions: ex.instructions,
        },
        updated_at: new Date(),
      },
    },
    { upsert: true }
  );
}

/** Upsert a 32-d vector embedding for a MySQL food item into MongoDB physiq.vector_embeddings */
export async function upsertFoodVector(food: FoodItem): Promise<void> {
  const db = await getMongoDb();
  const semantic_text = buildFoodSemanticText(food);
  const embedding = embedText(semantic_text);
  await db.collection<VectorDocument>('vector_embeddings').updateOne(
    { domain: 'food', entity_id: food.id },
    {
      $set: {
        domain: 'food',
        entity_id: food.id,
        user_id: food.user_id ?? null,
        title: food.name,
        subtitle: `${food.serving_label} · ${food.calories} kcal · ${food.protein_g}g P`,
        semantic_text,
        dimensions: VECTOR_DIMENSIONS,
        embedding,
        metadata: {
          category: food.category,
          serving_label: food.serving_label,
          serving_grams: food.serving_grams,
          calories: food.calories,
          protein_g: food.protein_g,
          carbs_g: food.carbs_g,
          fat_g: food.fat_g,
        },
        updated_at: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * Execute K-Nearest Neighbor (KNN) similarity search in MongoDB using an
 * aggregation pipeline that computes Cosine Similarity (dot product of unit
 * vectors) and Euclidean L2 distance inside the database engine.
 */
export async function searchVectorsInMongo({
  domain,
  userId,
  queryVector,
  excludeEntityId,
  k = 6,
}: {
  domain: VectorDomain;
  userId: number;
  queryVector: number[];
  excludeEntityId?: number;
  k?: number;
}): Promise<VectorSearchHit[]> {
  const db = await getMongoDb();
  const matchFilter: Record<string, unknown> = {
    domain,
    $or: [{ user_id: null }, { user_id: userId }],
  };
  if (excludeEntityId) {
    matchFilter.entity_id = { $ne: excludeEntityId };
  }

  // MongoDB Aggregation Pipeline: compute dot product (cosine similarity) and L2 distance in-engine
  const docs = await db
    .collection<VectorDocument>('vector_embeddings')
    .aggregate<{
      domain: VectorDomain;
      entity_id: number;
      title: string;
      subtitle: string;
      semantic_text: string;
      metadata: Record<string, unknown>;
      cosine_similarity: number;
      l2_distance: number;
    }>([
      { $match: matchFilter },
      {
        $addFields: {
          cosine_similarity: {
            $reduce: {
              input: { $range: [0, VECTOR_DIMENSIONS] },
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $multiply: [
                      { $arrayElemAt: ['$embedding', '$$this'] },
                      { $arrayElemAt: [queryVector, '$$this'] },
                    ],
                  },
                ],
              },
            },
          },
          l2_distance: {
            $sqrt: {
              $reduce: {
                input: { $range: [0, VECTOR_DIMENSIONS] },
                initialValue: 0,
                in: {
                  $add: [
                    '$$value',
                    {
                      $pow: [
                        {
                          $subtract: [
                            { $arrayElemAt: ['$embedding', '$$this'] },
                            { $arrayElemAt: [queryVector, '$$this'] },
                          ],
                        },
                        2,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
      { $sort: { cosine_similarity: -1, entity_id: 1 } },
      { $limit: Math.min(20, Math.max(1, k)) },
      {
        $project: {
          _id: 0,
          domain: 1,
          entity_id: 1,
          title: 1,
          subtitle: 1,
          semantic_text: 1,
          metadata: 1,
          cosine_similarity: { $round: ['$cosine_similarity', 4] },
          l2_distance: { $round: ['$l2_distance', 4] },
        },
      },
    ])
    .toArray();

  return docs.map((d) => {
    const sim = Number(d.cosine_similarity ?? 0);
    const cosine_distance = Number((1 - sim).toFixed(4));
    const match_pct = Math.max(5, Math.min(99, Math.round(Math.max(0, sim) * 100)));
    return {
      ...d,
      cosine_similarity: sim,
      cosine_distance,
      l2_distance: Number(d.l2_distance ?? 0),
      match_pct,
    };
  });
}
