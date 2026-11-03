import { ApiError, ok, route } from '@/lib/api';
import { getMongoDb } from '@/lib/mongodb';
import { requireUser } from '@/lib/session';
import {
  VECTOR_DIMENSIONS,
  embedText,
  searchVectorsInMongo,
  type VectorDocument,
  type VectorDomain,
} from '@/lib/vector';

// GET /api/vector/search?domain=exercise|food&q=...&similarTo=...&k=6
// Executes a 32-d Cosine Similarity + Euclidean L2 KNN search in MongoDB physiq.vector_embeddings
export const GET = route(async (req) => {
  const me = await requireUser();
  const params = new URL(req.url).searchParams;
  const domainRaw = params.get('domain');
  if (domainRaw !== 'exercise' && domainRaw !== 'food') {
    throw new ApiError(400, 'Pass domain=exercise or domain=food.');
  }
  const domain: VectorDomain = domainRaw;

  const q = params.get('q')?.trim() ?? '';
  const similarToRaw = params.get('similarTo');
  const k = Math.min(12, Math.max(1, Number(params.get('k')) || 6));

  let queryVector: number[];
  let excludeEntityId: number | undefined;
  let queryLabel = q;

  if (similarToRaw) {
    const entityId = Number(similarToRaw);
    if (!Number.isInteger(entityId) || entityId <= 0) {
      throw new ApiError(400, 'Invalid similarTo id.');
    }
    const db = await getMongoDb();
    const anchor = await db
      .collection<VectorDocument>('vector_embeddings')
      .findOne({ domain, entity_id: entityId });
    if (!anchor) {
      throw new ApiError(404, 'Reference item not found in vector store.');
    }
    queryVector = anchor.embedding;
    excludeEntityId = entityId;
    queryLabel = `Similar to ${anchor.title}`;
  } else if (q.length >= 2) {
    queryVector = embedText(q);
  } else {
    throw new ApiError(400, 'Pass a natural-language query (?q=...) or ?similarTo=<id>.');
  }

  const results = await searchVectorsInMongo({
    domain,
    userId: me.id,
    queryVector,
    excludeEntityId,
    k,
  });

  return ok({
    domain,
    query: queryLabel,
    dimensions: VECTOR_DIMENSIONS,
    metric: 'cosine_similarity',
    results,
  });
});
