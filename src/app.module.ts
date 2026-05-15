import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { BottlenecksModule } from './bottlenecks/bottlenecks.module';

@Module({
  imports: [PrismaModule, BottlenecksModule],
})
export class AppModule {}
