import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyService } from './loyalty.service';

global.fetch = jest.fn();

describe('LoyaltyService', () => {
  let service: LoyaltyService;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.LOYALTY_SERVICE_URL = 'http://localhost:3001';
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoyaltyService],
    }).compile();
    service = module.get<LoyaltyService>(LoyaltyService);
  });

  describe('validate', () => {
    it('returns valid result for a successful response', async () => {
      const payload = { valid: true, discountCents: 500, rewardId: 'rwd_abc', expiresAt: '2026-01-01T00:00:00Z' };
      (fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });

      const result = await service.validate('SAVE500', 1500);
      expect(result).toEqual(payload);
    });

    it('returns invalid result for an invalid code', async () => {
      const payload = { valid: false, reason: 'expired' };
      (fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });

      const result = await service.validate('EXPIRED2024', 1500);
      expect(result).toEqual(payload);
    });

    it('throws ServiceUnavailableException on HTTP 500', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
      await expect(service.validate('SAVE500', 1500)).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.validate('SAVE500', 1500)).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
