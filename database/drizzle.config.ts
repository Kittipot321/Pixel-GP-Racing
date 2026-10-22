// drizzle-kit configuration.
// `npm run db:generate` reads the schema and emits SQL migrations into
// ./migrations. The migration runner (scripts/migrate.ts) applies them.

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './migrations',
});
