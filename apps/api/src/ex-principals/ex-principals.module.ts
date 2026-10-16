import { Module } from '@nestjs/common';
import { ExPrincipalsService } from './ex-principals.service';
import { ExPrincipalsController } from './ex-principals.controller';

@Module({
  controllers: [ExPrincipalsController],
  providers: [ExPrincipalsService],
})
export class ExPrincipalsModule {}
