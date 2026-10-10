import 'reflect-metadata';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { AnomalySchema } from '../anomaly/anomaly.schema';
import { computeDefectRate, computeFinancialImpact } from '../anomaly/anomaly.metrics';

dotenv.config();

// ── Connection ──────────────────────────────────────
const MONGO_URI = `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@localhost:27017/${process.env.MONGO_DATABASE}?authSource=admin`;

// Same schema as the API, so the seed can never drift from anomaly.schema.ts
const AnomalyModel = mongoose.model('Anomaly', AnomalySchema);

// ══════════════════════════════════════════════════════
//  SCENARIO — 12 weeks of incoming inspections
// ══════════════════════════════════════════════════════

// Each supplier's normal defect rate (common-cause level, as a proportion)
const SUPPLIERS = [
    { id: 'SUP-001', name: 'Supplier Y', zone: 'Warehouse Zone B', p: 0.02 },
    { id: 'SUP-002', name: 'Atlas Components', zone: 'Warehouse Zone A', p: 0.01 },
    { id: 'SUP-003', name: 'Meridian Plastics', zone: 'Warehouse Zone B', p: 0.04 },
    { id: 'SUP-004', name: 'Kestrel Metals', zone: 'Warehouse Zone C', p: 0.07 }, // poor but stable
];

const WEEKS = 12;
const FIRST_MONDAY = Date.UTC(2026, 6, 20); // Monday 20 July 2026 → week 12 = 5–11 Oct 2026
const DELIVERY_DAYS = [1, 3]; // Tuesday and Thursday (days after Monday)
const DAY_MS = 24 * 60 * 60 * 1000;

// Short notes inspectors write on ordinary lots (minor, expected defects)
const ROUTINE_NOTES: Record<string, string[]> = {
    'SUP-001': [
        'Minor cosmetic scratches on a few housings, within tolerance.',
        'Some labels slightly misaligned; lot accepted.',
    ],
    'SUP-002': [
        'Clean lot, one unit with a light scratch.',
        'Packaging in good condition, no remarks.',
    ],
    'SUP-003': [
        'Flash on the moulded edges of a few parts, trimmed on site.',
        'A few short shots found during sampling, usual level.',
    ],
    'SUP-004': [
        'Recurring surface porosity on castings, same level as previous lots.',
        'Paint thickness slightly uneven on some parts; accepted.',
    ],
};

// Special causes: the ground truth that the p-charts must detect in Phase 2
type PlantedEvent = {
    supplierId: string;
    week: number;
    delivery: number; // 0 = Tuesday, 1 = Thursday
    unitsReceived: number;
    defectProportion: number;
    inspectorNotes: string;
    label: string;
    // Only for cases already handled by the quality team (the RAG memory)
    resolution?: {
        severityLevel: 'low' | 'medium' | 'high' | 'critical';
        rootCause: string;
        actionTaken: string;
        resolvedAfterDays: number;
    };
};

const PLANTED_EVENTS: PlantedEvent[] = [
    {
        // Historical spike → resolved, with root cause and action
        supplierId: 'SUP-001',
        week: 4,
        delivery: 0,
        unitsReceived: 1200,
        defectProportion: 0.18,
        inspectorNotes:
            'Cartons soft and water-stained, condensation inside the shrink wrap. ' +
            'The container waited three days in the rain at the port; boards show corrosion spots.',
        label: 'spike: humidity in transit (resolved)',
        resolution: {
            severityLevel: 'critical',
            rootCause: 'Humidity damage in transit',
            actionTaken:
                'Supplier orders paused, re-inspection certificate requested; ' +
                'carrier switched to sealed containers with moisture indicators',
            resolvedAfterDays: 2,
        },
    },
    {
        // Open test case: should match the humidity case by meaning (RAG, Phase 3)
        supplierId: 'SUP-002',
        week: 12,
        delivery: 1,
        unitsReceived: 900,
        defectProportion: 0.11,
        inspectorNotes:
            'Boxes damp and several cartons collapsed. Water droplets inside the plastic wrap ' +
            'and rust spots on metal parts after sea transport.',
        label: 'open test: similar to a past case',
    },
    {
        // Open test case: a new kind of problem, nothing similar in the history
        supplierId: 'SUP-004',
        week: 12,
        delivery: 1,
        unitsReceived: 1100,
        defectProportion: 0.17,
        inspectorNotes:
            'Sharp burrs on bracket edges and several holes drilled off-position; ' +
            'the deburring step seems to have been skipped on this lot.',
        label: 'open test: new type of problem',
    },
];

// ── Random numbers with a fixed seed: same data on every run ──
function createRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        // mulberry32 generator
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const random = createRandom(2026);

// Failed units in a lot of n, each unit failing with probability p (binomial)
function countFailures(n: number, p: number): number {
    let failed = 0;
    for (let i = 0; i < n; i++) {
        if (random() < p) failed++;
    }
    return failed;
}

// ── Build the 96 inspection records ─────────────────
function buildShipments() {
    const shipments: Record<string, unknown>[] = [];
    const planted: { shipment: Record<string, unknown>; label: string }[] = [];

    for (let week = 1; week <= WEEKS; week++) {
        DELIVERY_DAYS.forEach((dayOffset, delivery) => {
            SUPPLIERS.forEach((supplier, index) => {
                // Deliveries arrive from 08:00, one supplier every 45 minutes
                const timestamp = new Date(
                    FIRST_MONDAY + ((week - 1) * 7 + dayOffset) * DAY_MS + (8 * 60 + index * 45) * 60 * 1000,
                );
                const event = PLANTED_EVENTS.find(
                    (e) => e.supplierId === supplier.id && e.week === week && e.delivery === delivery,
                );

                // Lot size between 400 and 2000 units, in steps of 50
                const unitsReceived = event?.unitsReceived ?? 400 + Math.round(random() * 32) * 50;
                const unitsFailed = event
                    ? Math.round(unitsReceived * event.defectProportion)
                    : countFailures(unitsReceived, supplier.p);

                const routine = ROUTINE_NOTES[supplier.id];
                const inspectorNotes =
                    event?.inspectorNotes ??
                    (random() < 0.4 ? routine[Math.floor(random() * routine.length)] : null);

                const record: Record<string, unknown> = {
                    timestamp,
                    location: supplier.zone,
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    unitsReceived,
                    unitsFailed,
                    defectRate: computeDefectRate(unitsReceived, unitsFailed),
                    financialImpact: computeFinancialImpact(unitsFailed),
                    inspectorNotes,
                    // A normal lot opens no ticket; Phase 2 (SPC) will decide what is an anomaly
                    status: null,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                };

                if (event?.resolution) {
                    const resolvedAt = new Date(timestamp.getTime() + event.resolution.resolvedAfterDays * DAY_MS);
                    Object.assign(record, {
                        severityLevel: event.resolution.severityLevel,
                        leanCategory: 'special_cause',
                        rootCause: event.resolution.rootCause,
                        actionTaken: event.resolution.actionTaken,
                        status: 'resolved',
                        resolvedAt,
                        updatedAt: resolvedAt,
                    });
                } else if (event) {
                    record.status = 'open'; // waiting for the AI diagnosis
                }

                shipments.push(record);
                if (event) planted.push({ shipment: record, label: event.label });
            });
        });
    }

    // Shipment ids in arrival order: SHIP-2026-00001, SHIP-2026-00002, …
    shipments.sort((a, b) => (a.timestamp as Date).getTime() - (b.timestamp as Date).getTime());
    shipments.forEach((s, i) => (s.shipmentId = `SHIP-2026-${String(i + 1).padStart(5, '0')}`));
    return { shipments, planted };
}

// ── Seed Function ────────────────────────────────────
async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        await AnomalyModel.deleteMany({});
        console.log('🗑️  Cleared existing anomalies');

        const { shipments, planted } = buildShipments();
        await AnomalyModel.insertMany(shipments);
        console.log(`🌱 Seeded ${shipments.length} shipments (${WEEKS} weeks × ${SUPPLIERS.length} suppliers × ${DELIVERY_DAYS.length} deliveries)\n`);

        // Summary per supplier: overall defect rate = total failed / total received
        console.table(
            SUPPLIERS.map((supplier) => {
                const lots = shipments.filter((s) => s.supplierId === supplier.id);
                const received = lots.reduce((sum, s) => sum + (s.unitsReceived as number), 0);
                const failed = lots.reduce((sum, s) => sum + (s.unitsFailed as number), 0);
                return {
                    supplier: supplier.name,
                    lots: lots.length,
                    'target %': Math.round(supplier.p * 100 * 100) / 100,
                    'actual %': computeDefectRate(received, failed),
                };
            }),
        );

        console.log('Planted special causes:');
        planted.forEach(({ shipment: s, label }) =>
            console.log(
                `  ${(s.timestamp as Date).toISOString().slice(0, 10)}  ${s.shipmentId}  ` +
                `${s.supplierName}  ${s.defectRate} %  → ${label}`,
            ),
        );

        await mongoose.disconnect();
        console.log('\n✅ Disconnected. Seed complete.');

    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
}

seed();
