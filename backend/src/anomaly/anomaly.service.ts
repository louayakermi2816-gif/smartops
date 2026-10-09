import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Anomaly, AnomalyDocument } from './anomaly.schema';
import { CreateAnomalyDto } from './dto/create-anomaly.dto';

@Injectable()
export class AnomalyService {
    constructor(
        @InjectModel(Anomaly.name)
        private anomalyModel: Model<AnomalyDocument>,
    ) { }

    async create(dto: CreateAnomalyDto): Promise<AnomalyDocument> {

        // Safety guard — DTO should catch this first
        // but this protects against any edge case
        if (!dto.unitsReceived || dto.unitsReceived <= 0) {
            throw new BadRequestException('unitsReceived must be greater than zero');
        }

        // Calculate defect rate — rounded to 2 decimal places
        const defectRate = Math.round(
            (dto.unitsFailed / dto.unitsReceived) * 100 * 100
        ) / 100;

        // Estimate financial impact — each failed unit costs $25
        const financialImpact = dto.unitsFailed * 25;

        // Create and save — agent fields start empty (null)
        // status starts as 'open' for every new anomaly
        const anomaly = new this.anomalyModel({
            ...dto,
            defectRate,
            financialImpact,
            status: 'open',
        });

        return anomaly.save();
    }

    async findAll(): Promise<AnomalyDocument[]> {
        return this.anomalyModel.find().sort({ createdAt: -1 }).exec();
    }
}