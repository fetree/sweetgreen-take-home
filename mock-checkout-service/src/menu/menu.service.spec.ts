import { Test, TestingModule } from '@nestjs/testing';
import { MenuService } from './menu.service';
import { PrismaService } from '../prisma/prisma.service';

const mockMenuItems = [
  { id: '1', name: 'Harvest Bowl', description: 'Roasted chicken...', priceCents: 1495, available: true },
  { id: '2', name: 'Kale Caesar', description: 'Shaved parmesan...', priceCents: 1295, available: true },
];

const mockPrismaService = {
  client: {
    menuItem: {
      findMany: jest.fn().mockResolvedValue(mockMenuItems),
    },
  },
};

describe('MenuService', () => {
  let service: MenuService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MenuService>(MenuService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll() returns only available items ordered by name', async () => {
    const items = await service.findAll();
    expect(items).toEqual(mockMenuItems);
    expect(mockPrismaService.client.menuItem.findMany).toHaveBeenCalledWith({
      where: { available: true },
      orderBy: { name: 'asc' },
    });
  });
});
