# Prisma Bottlenecks Benchmark Report

Generated: 2026-05-15T09:07:48.431Z

## Dataset

- Users: 800
- Posts per user: 20
- Total posts: 16000
- Orders: 200
- Products: 25

## Endpoint Results

| Scenario | Bad Wall | Good Wall | Wall Speedup | Bad Service | Good Service | Statuses |
|---|---:|---:|---:|---:|---:|---|
| N+1 queries | avg=3002.86ms p50=2826.23ms p95=3180.55ms | avg=60.14ms p50=60.08ms p95=60.67ms | 49.93x | avg=1494.75ms p50=1425ms p95=1616ms | avg=27.5ms p50=28ms p95=29ms | bad: 200=4; good: 200=4 |
| Sequential await | avg=14.76ms p50=13.18ms p95=24.81ms | avg=12.94ms p50=11.84ms p95=25.29ms | 1.14x | avg=2.08ms p50=2ms p95=3ms | avg=1.83ms p50=2ms p95=3ms | bad: 200=12; good: 200=12 |
| In-memory sort | avg=65.46ms p50=65.2ms p95=66.99ms | avg=8.03ms p50=8.09ms p95=8.35ms | 8.15x | avg=28.83ms p50=29ms p95=31ms | avg=2.5ms p50=2ms p95=3ms | bad: 200=6; good: 200=6 |
| Cold start | avg=4.71ms p50=4.29ms p95=5.77ms | avg=2.04ms p50=1.86ms p95=2.98ms | 2.31x | avg=2.88ms p50=3ms p95=4ms | avg=0.75ms p50=1ms p95=1ms | bad: 200=8; good: 200=8 |
| Cold start note | This repo uses the better-sqlite3 driver adapter, so these numbers are local adapter startup costs, not serverless Rust-engine cold starts. |  |  |  |  |  |
| Max params | avg=1055.56ms p50=1055.56ms p95=1055.56ms | avg=1221.88ms p50=1221.88ms p95=1221.88ms | 0.86x | avg=1050ms p50=1050ms p95=1050ms | avg=1218ms p50=1218ms p95=1218ms | bad: 200=1; good: 200=1 |
| Unindexed WHERE | avg=19.15ms p50=17.78ms p95=23.61ms | avg=32.6ms p50=29.91ms p95=38.93ms | 0.59x | avg=8.13ms p50=7ms p95=14ms | avg=14.75ms p50=14ms p95=21ms | bad: 200=8; good: 200=8 |
| Unindexed WHERE note | Bad run executed with the composite index dropped. Good run executed after CREATE INDEX ON Post(published, createdAt DESC). |  |  |  |  |  |

## Race Condition Check

| Metric | Bad | Good |
|---|---:|---:|
| Starting stock | 150 | 150 |
| Requests | 100 | 100 |
| Expected final stock | 50 | 50 |
| Actual final stock | 50 | 50 |
| Lost updates | 0 | 0 |
