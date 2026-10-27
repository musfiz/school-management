import 'dotenv/config';
import { defineConfig } from '@prisma/config';
import {
  buildDatabaseUrl,
  buildShadowDatabaseUrl,
} from './src/prisma/database-url';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: buildDatabaseUrl(),
    shadowDatabaseUrl: buildShadowDatabaseUrl(),
  },
  migrations: {
    seed: 'ts-node -T -r tsconfig-paths/register prisma/seed.ts',
  },
});
