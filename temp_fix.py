import re

with open('c:/project/VITOGRAPH/prisma/schema.prisma', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Filter out null characters and weird spaces
text = text.replace('\x00', '')
text = re.sub(r'm o d e l.*', '', text, flags=re.DOTALL)

# Also let's remove the url lines from datasource db
text = text.replace('  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n', '')

with open('c:/project/VITOGRAPH/prisma/schema.prisma', 'w', encoding='utf-8') as f:
    f.write(text.strip('\n'))
    f.write('\n\nmodel InsightCache {\n  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid\n  markerSignature String   @map("marker_signature") // e.g. "Витамин D - High"\n  embedding       Unsupported("vector(384)")? // Размерность 384 для BAAI/bge-small\n  aiClinicalNote  String   @map("ai_clinical_note")\n  hitCount        Int      @default(0) @map("hit_count")\n  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz\n\n  @@map("insights_cache")\n}\n')
