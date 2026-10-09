import {
    IsString,
    IsInt,
    IsDateString,
    IsNotEmpty,
    IsDefined,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAnomalyDto {

    // ── CONTEXT ─────────────────────────────────────
    @IsDateString()
    @IsNotEmpty()
    timestamp: string;

    @IsString()
    @IsNotEmpty()
    location: string;

    // ── SOURCE ──────────────────────────────────────
    @IsString()
    @IsNotEmpty()
    supplierId: string;

    @IsString()
    @IsNotEmpty()
    supplierName: string;

    @IsString()
    @IsNotEmpty()
    shipmentId: string;

    // ── METRICS ─────────────────────────────────────
    // @IsDefined catches missing fields before any transformation
    // @Type(() => Number) tells class-transformer exactly how to convert
    // @Min(1) because a shipment must have at least 1 unit
    @IsDefined({ message: 'unitsReceived is required' })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    unitsReceived: number;

    // unitsFailed can be 0 — a perfect shipment with zero failures
    @IsDefined({ message: 'unitsFailed is required' })
    @Type(() => Number)
    @IsInt()
    @Min(0)
    unitsFailed: number;

}