import { Test, TestingModule } from '@nestjs/testing';
import { AnomalyController } from './anomaly.controller';
import { AnomalyService } from './anomaly.service';
import { CreateAnomalyDto } from './dto/create-anomaly.dto';

describe('AnomalyController', () => {
  let controller: AnomalyController;

  // Fake service: the controller test only checks the controller's own job
  // (pass the data on, shape the reply), not the calculations
  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
  };

  const shipment: CreateAnomalyDto = {
    timestamp: '2026-10-09T10:00:00Z',
    location: 'Warehouse Zone B',
    supplierId: 'SUP-001',
    supplierName: 'Supplier Y',
    shipmentId: 'SHIP-TEST-001',
    unitsReceived: 1200,
    unitsFailed: 180,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnomalyController],
      providers: [{ provide: AnomalyService, useValue: mockService }],
    }).compile();

    controller = module.get<AnomalyController>(AnomalyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('ingest() passes the shipment to the service and replies with a short summary', async () => {
    mockService.create.mockResolvedValue({
      _id: 'fake-id',
      defectRate: 15,
      financialImpact: 4500,
      status: 'open',
    });

    const reply = await controller.ingest(shipment);

    expect(mockService.create).toHaveBeenCalledWith(shipment);
    expect(reply).toEqual({
      message: 'Anomaly received and stored successfully',
      id: 'fake-id',
      defectRate: 15,
      status: 'open',
    });
  });

  it('findAll() returns the list from the service unchanged', async () => {
    const anomalies = [{ shipmentId: 'SHIP-B' }, { shipmentId: 'SHIP-A' }];
    mockService.findAll.mockResolvedValue(anomalies);

    await expect(controller.findAll()).resolves.toEqual(anomalies);
  });
});
