import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExPrincipal } from '../database/entities/ex-principal.entity';
import { ExPrincipalsService } from './ex-principals.service';
import { ExPrincipalsController } from './ex-principals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ExPrincipal])],
  controllers: [ExPrincipalsController],
  providers: [ExPrincipalsService],
})
export class ExPrincipalsModule {}
