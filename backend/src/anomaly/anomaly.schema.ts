import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AnomalyDocument = HydratedDocument<Anomaly>;

@Schema({ timestamps: true })
export class Anomaly {

    // ─── CONTEXT ───────────────────────────────────────
    @Prop({ required: true })
    timestamp: Date;

    @Prop({ required: true })
    location: string;

    // What the inspector saw, in free text ("cartons wet on arrival").
    // The RAG search (Phase 3) compares anomalies by the meaning of these notes.
    @Prop({ default: null })
    inspectorNotes: string;

    // ─── SOURCE ────────────────────────────────────────
    @Prop({ required: true })
    supplierId: string;

    @Prop({ required: true })
    supplierName: string;

    // unique: MongoDB refuses a second record with the same shipment number
    @Prop({ required: true, unique: true })
    shipmentId: string;

    // ─── METRICS ───────────────────────────────────────
    @Prop({ required: true })
    unitsReceived: number;

    @Prop({ required: true })
    unitsFailed: number;

    @Prop({ default: null })
    defectRate: number;

    @Prop({ default: null })
    financialImpact: number;

    // ─── DIAGNOSIS ─────────────────────────────────────
    @Prop({ default: null, enum: ['low', 'medium', 'high', 'critical'] })
    severityLevel: string;

    @Prop({ default: null, enum: ['common_cause', 'special_cause'] })
    leanCategory: string;

    @Prop({ default: null })
    rootCause: string;

    @Prop({ default: null })
    aiConfidenceScore: number;

    // ─── RESOLUTION ────────────────────────────────────
    @Prop({ default: null })
    actionTaken: string;

    @Prop({ default: null, enum: ['open', 'in_progress', 'resolved'] })
    status: string;

    @Prop({ default: null })
    resolvedAt: Date;
}

export const AnomalySchema = SchemaFactory.createForClass(Anomaly);