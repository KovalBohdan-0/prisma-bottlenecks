import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  await app.listen(3000);
  console.log('🚀 Server running on http://localhost:3000');
  console.log('\nAvailable endpoints:');
  console.log('  POST http://localhost:3000/bottlenecks/seed  (run first!)');
  console.log('\n  -- Bottleneck 1: Connection Pool --');
  console.log('  GET  http://localhost:3000/bottlenecks/connection-pool/bad');
  console.log('  GET  http://localhost:3000/bottlenecks/connection-pool/good');
  console.log('\n  -- Bottleneck 2: N+1 Queries --');
  console.log('  GET  http://localhost:3000/bottlenecks/n-plus-1/bad');
  console.log('  GET  http://localhost:3000/bottlenecks/n-plus-1/good');
  console.log('\n  -- Bottleneck 3: Over-fetching --');
  console.log('  GET  http://localhost:3000/bottlenecks/overfetch/bad');
  console.log('  GET  http://localhost:3000/bottlenecks/overfetch/good');
  console.log('\n  -- Bottleneck 4: No Pagination --');
  console.log('  GET  http://localhost:3000/bottlenecks/pagination/no-limit/bad');
  console.log('  GET  http://localhost:3000/bottlenecks/pagination/cursor/good?limit=5');
  console.log('\n  -- Bottleneck 5: Offset Pagination --');
  console.log('  GET  http://localhost:3000/bottlenecks/pagination/offset/bad?page=1');
  console.log('\n  -- Bottleneck 6: Long Transactions --');
  console.log('  GET  http://localhost:3000/bottlenecks/long-transaction/bad/1');
  console.log('  GET  http://localhost:3000/bottlenecks/long-transaction/good/1');
  console.log('\n  -- Bottleneck 7: Race Conditions --');
  console.log('  GET  http://localhost:3000/bottlenecks/race-condition/bad/1?qty=1');
  console.log('  GET  http://localhost:3000/bottlenecks/race-condition/good/1?qty=1');
  console.log('\n  -- Bottleneck 8: Deep Include --');
  console.log('  GET  http://localhost:3000/bottlenecks/deep-include/bad');
  console.log('  GET  http://localhost:3000/bottlenecks/deep-include/good');
}

bootstrap();
