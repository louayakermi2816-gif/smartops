import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

// ── Connection ──────────────────────────────────────
const MONGO_URI = `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@localhost:27017/${process.env.MONGO_DATABASE}?authSource=admin`;

// ── Inline Schema (mirrors your anomaly.schema.ts) ──
const AnomalySchema = new mongoose.Schema(
    {
        // CONTEXT
        timestamp: { type: Date, required: true },
        location: { type: String, required: true },
        // SOURCE
        supplierId: { type: String, required: true },
        supplierName: { type: String, required: true },
        shipmentId: { type: String, required: true },
        // METRICS
        unitsReceived: { type: Number, required: true },
        unitsFailed: { type: Number, required: true },
        defectRate: { type: Number, default: null },
        financialImpact: { type: Number, default: null },
        // DIAGNOSIS
        severityLevel: {
            type: String, default: null,
            enum: ['low', 'medium', 'high', 'critical']
        },
        leanCategory: {
            type: String, default: null,
            enum: ['common_cause', 'special_cause']
        },
        rootCause: { type: String, default: null },
        aiConfidenceScore: { type: Number, default: null },
        // RESOLUTION
        actionTaken: { type: String, default: null },
        status: {
            type: String, default: null,
            enum: ['open', 'in_progress', 'resolved']
        },
        resolvedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

const AnomalyModel = mongoose.model('Anomaly', AnomalySchema);

// ── Seed Function ────────────────────────────────────
async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        await AnomalyModel.deleteMany({});
        console.log('🗑️  Cleared existing anomalies');

        const fakeAnomaly = {
            // CONTEXT
            timestamp: new Date('2026-06-08T09:14:00'),
            location: 'Warehouse Zone B',

            // SOURCE
            supplierId: 'SUP-001',
            supplierName: 'Supplier Y',
            shipmentId: 'SHIP-2026-00847',

            // METRICS
            unitsReceived: 1200,
            unitsFailed: 180,
            defectRate: 15.0,
            financialImpact: 4500,

            // DIAGNOSIS
            severityLevel: 'critical',         // ← changed from 'high'
            leanCategory: 'special_cause',
            rootCause: 'Humidity damage in transit',
            aiConfidenceScore: 92,             // ← changed from 0.92

            // RESOLUTION
            actionTaken: 'Supplier orders paused, re-inspection certificate requested',
            status: 'resolved',
            resolvedAt: new Date('2026-06-08T14:30:00'),
        };

        const created = await AnomalyModel.create(fakeAnomaly as any); // ← added as any
        console.log('🌱 Seeded anomaly record:');
        console.log(JSON.stringify(created, null, 2));

        await mongoose.disconnect();
        console.log('✅ Disconnected. Seed complete.');

    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
}

seed();
