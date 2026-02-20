-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create SkillEmbedding table with vector column
CREATE TABLE "SkillEmbedding" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "skill" TEXT NOT NULL,
    "normalizedSkill" TEXT NOT NULL,
    "embedding" vector(384) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillEmbedding_pkey" PRIMARY KEY ("id")
);

-- Unique index on normalizedSkill (one embedding per canonical skill)
CREATE UNIQUE INDEX "SkillEmbedding_normalizedSkill_key" ON "SkillEmbedding"("normalizedSkill");

-- HNSW index for fast cosine similarity search
CREATE INDEX "SkillEmbedding_embedding_idx" ON "SkillEmbedding" 
USING hnsw ("embedding" vector_cosine_ops);

-- GIN index for pg_trgm fuzzy text search on skill names
CREATE INDEX "SkillEmbedding_skill_trgm_idx" ON "SkillEmbedding" 
USING gin ("normalizedSkill" gin_trgm_ops);
