# PostgreSQL Benchmark Report

Generated: 2026-05-15T10:18:11.614Z
Database: postgresql://postgres:postgres@127.0.0.1:54329/prisma_bench?schema=public

## Dataset

- Users: 2000
- Posts per user: 30
- Total posts: 60000
- Products: 100
- Orders: 1000

## Scenarios

| Scenario | Bad | Good | Speedup |
|---|---:|---:|---:|
| N+1 queries | avg=18485.65ms p50=17761.27ms p95=20013.33ms | avg=142.17ms p50=140.71ms p95=145.6ms | 130.02x |
| Sequential await | avg=11.22ms p50=10.4ms p95=16.84ms | avg=8.54ms p50=5.58ms p95=32.17ms | 1.31x |
| In-memory sort | avg=194.73ms p50=191.47ms p95=214.53ms | avg=16.52ms p50=15.56ms p95=20.55ms | 11.79x |
| Offset pagination | avg=8.35ms p50=8.21ms p95=8.69ms | avg=2.48ms p50=1.87ms p95=5.03ms | 3.37x |
| Long transactions | avg=504.18ms p50=506.13ms p95=510.94ms | avg=239.33ms p50=233.22ms p95=251.81ms | 2.11x |
| Indexed vs unindexed WHERE | avg=4.81ms p50=2.5ms p95=13.8ms | avg=22.91ms p50=4.17ms p95=97.69ms | 0.21x |
| Max parameters | avg=3254.69ms p50=3254.69ms p95=3254.69ms | avg=2367.08ms p50=2367.08ms p95=2367.08ms | 1.37x |

## Race Condition

- Starting stock: 200
- Requests: 150
- Expected final stock: 50
- Bad final stock: 197
- Good final stock: 50
- Bad lost updates: 147
- Good lost updates: 0
