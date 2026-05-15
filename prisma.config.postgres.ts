import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.postgres.prisma",
  datasource: {
    url:
      process.env.PG_BENCH_DATABASE_URL ??
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:54329/prisma_bench?schema=public",
  },
});
