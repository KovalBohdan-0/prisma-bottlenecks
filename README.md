# Prisma Bottlenecks

Simple PostgreSQL benchmark project for Prisma in high-concurrency NestJS applications.

This repo focuses on the bottlenecks that showed up clearly in the PostgreSQL benchmark:

- `N+1 queries`
- `Race conditions`
- `Long transactions`
- `Offset pagination`
- `In-memory sorting`

## Quick start

Install dependencies:

```bash
npm install
```

Start PostgreSQL with Docker:

```bash
docker run -d --name prisma-bench-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=prisma_bench \
  -p 54329:5432 \
  postgres:16-alpine
```

Run the PostgreSQL benchmark:

```bash
PG_BENCH_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/prisma_bench?schema=public" npm run benchmark:postgres
```

Results are written to:

- `benchmarks/postgres-report.json`
- `benchmarks/postgres-report.md`

## What the benchmark measures

Current PostgreSQL dataset:

- `2,000 users`
- `60,000 posts`
- `100 products`
- `1,000 orders`

The benchmark compares bad and good implementations and records timing for:

- `N+1 queries`
- `Sequential await`
- `In-memory sort`
- `Offset pagination`
- `Long transactions`
- `Indexed vs unindexed WHERE`
- `Max parameters`
- `Race-condition correctness under concurrency`

## Main measured results

From the latest PostgreSQL run:

- `N+1 queries`: about `130x` slower in the bad version
- `In-memory sorting`: about `11.79x` slower
- `Offset pagination`: about `3.37x` slower
- `Long transactions`: about `2.11x` slower
- `Race conditions`: `147` lost updates in the bad version, `0` in the good version

## Notes

- The PostgreSQL benchmark is the main path this repo is optimized for.
- The NestJS demo endpoints are still in `src/bottlenecks`.
- When you are done, remove the temporary database:

```bash
docker rm -f prisma-bench-pg
```
