import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnomalyService } from './anomaly.service';
import { AnomalyController } from './anomaly.controller';
import { Anomaly, AnomalySchema } from './anomaly.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Anomaly.name, schema: AnomalySchema },
    ]),
  ],
  controllers: [AnomalyController],
  providers: [AnomalyService],
  exports: [MongooseModule],
})
export class AnomalyModule { }
