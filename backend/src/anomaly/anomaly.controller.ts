import { Controller, Post, Get, Body } from '@nestjs/common';
import { AnomalyService } from './anomaly.service';
import { CreateAnomalyDto } from './dto/create-anomaly.dto';

@Controller('anomaly')
export class AnomalyController {
    constructor(private readonly anomalyService: AnomalyService) { }

    // POST /anomaly/ingest
    // Receives warehouse data and stores it
    @Post('ingest')
    async ingest(@Body() dto: CreateAnomalyDto) {
        const anomaly = await this.anomalyService.create(dto);
        return {
            message: 'Anomaly received and stored successfully',
            id: anomaly._id,
            defectRate: anomaly.defectRate,
            status: anomaly.status,
        };
    }

    // GET /anomaly
    // Returns all stored anomalies
    @Get()
    async findAll() {
        return this.anomalyService.findAll();
    }
}
