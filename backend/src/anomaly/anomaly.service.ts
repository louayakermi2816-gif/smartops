import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { computeDefectRate, computeFinancialImpact } from './anomaly.metrics';
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
        // business rule: you cannot fail more units than you received
        if (dto.unitsFailed > dto.unitsReceived) {
            throw new BadRequestException('unitsFailed cannot be greater than unitsReceived');
        }

        // Defect rate (%, 2 decimals) and cost of poor quality ($)
        const defectRate = computeDefectRate(dto.unitsReceived, dto.unitsFailed);
        const financialImpact = computeFinancialImpact(dto.unitsFailed);

        // Create and save — agent fields start empty (null)
        // status starts as 'open' for every new anomaly
        const anomaly = new this.anomalyModel({
            ...dto,
            defectRate,
            financialImpact,
            status: 'open',
        });

        try {
            return await anomaly.save();
        } catch (error) {
            // MongoDB error 11000 = duplicate key: this shipment was already ingested
            if ((error as { code?: number }).code === 11000) {
                throw new ConflictException(`Shipment ${dto.shipmentId} was already ingested`);
            }
            throw error;
        }
    }

    async findAll(): Promise<AnomalyDocument[]> {
        return this.anomalyModel.find().sort({ createdAt: -1 }).exec();
    }
}