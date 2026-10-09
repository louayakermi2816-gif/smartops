import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Anomaly } from './anomaly.schema';
import { AnomalyService } from './anomaly.service';
import { CreateAnomalyDto } from './dto/create-anomaly.dto';

describe('AnomalyService', () => {
  let service: AnomalyService;

  // Fake Mongoose model, so unit tests never touch the real database
  // create() uses:  new Model(data).save()
  // findAll() uses: Model.find().sort().exec()
  const mockModel = Object.assign(
    jest.fn().mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ _id: 'fake-id', ...data }),
    })),
    { find: jest.fn() },
  );

  // A valid shipment; each test overrides only the fields it cares about
  const shipment = (
    overrides: Partial<CreateAnomalyDto> = {},
  ): CreateAnomalyDto => ({
    timestamp: '2026-10-09T10:00:00Z',
    location: 'Warehouse Zone B',
    supplierId: 'SUP-001',
    supplierName: 'Supplier Y',
    shipmentId: 'SHIP-TEST-001',
    unitsReceived: 1200,
    unitsFailed: 180,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomalyService,
        { provide: getModelToken(Anomaly.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get<AnomalyService>(AnomalyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create()', () => {
    it('computes defect rate and financial impact (180 of 1200)', async () => {
      const result = await service.create(shipment());

      expect(result.defectRate).toBe(15);
      expect(result.financialImpact).toBe(4500);
    });

    it('rounds the defect rate to 2 decimals (1 of 3 → 33.33)', async () => {
      const result = await service.create(
        shipment({ unitsReceived: 3, unitsFailed: 1 }),
      );

      expect(result.defectRate).toBe(33.33);
    });

    it('accepts a perfect shipment (0 failed → 0 %, $0)', async () => {
      const result = await service.create(shipment({ unitsFailed: 0 }));

      expect(result.defectRate).toBe(0);
      expect(result.financialImpact).toBe(0);
    });

    it('accepts the limit case where every unit failed (100 of 100)', async () => {
      const result = await service.create(
        shipment({ unitsReceived: 100, unitsFailed: 100 }),
      );

      expect(result.defectRate).toBe(100);
    });

    it('always opens a new anomaly with status "open"', async () => {
      await service.create(shipment());

      expect(mockModel).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'open' }),
      );
    });

    it('rejects 0 units received', async () => {
      await expect(
        service.create(shipment({ unitsReceived: 0, unitsFailed: 0 })),
      ).rejects.toThrow(BadRequestException);
      expect(mockModel).not.toHaveBeenCalled();
    });

    it('rejects more failed units than received (150 of 100)', async () => {
      await expect(
        service.create(shipment({ unitsReceived: 100, unitsFailed: 150 })),
      ).rejects.toThrow('unitsFailed cannot be greater than unitsReceived');
      expect(mockModel).not.toHaveBeenCalled();
    });
  });

  describe('findAll()', () => {
    it('returns anomalies sorted newest first', async () => {
      const anomalies = [{ shipmentId: 'SHIP-B' }, { shipmentId: 'SHIP-A' }];
      const exec = jest.fn().mockResolvedValue(anomalies);
      const sort = jest.fn().mockReturnValue({ exec });
      mockModel.find.mockReturnValue({ sort });

      const result = await service.findAll();

      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual(anomalies);
    });
  });
});
