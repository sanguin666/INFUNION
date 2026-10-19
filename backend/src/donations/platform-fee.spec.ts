import { afterEach, describe, expect, it } from 'vitest';
import { donationFee, donationFeePercent } from './platform-fee.js';
import { Donation } from './entities/donation.entity.js';

describe('platform fee on gifts', () => {
  afterEach(() => {
    delete process.env.DONATION_FEE_PERCENT;
  });

  it('takes 1% by default, rounded to the cent', () => {
    expect(donationFeePercent()).toBe(1);
    expect(donationFee(20)).toBe(0.2);
    expect(donationFee(12.5)).toBe(0.13);
    expect(donationFee(5)).toBe(0.05);
  });

  it('follows DONATION_FEE_PERCENT, and ignores a value that makes no sense', () => {
    process.env.DONATION_FEE_PERCENT = '2.5';
    expect(donationFee(100)).toBe(2.5);
    process.env.DONATION_FEE_PERCENT = '0';
    expect(donationFee(100)).toBe(0);
    process.env.DONATION_FEE_PERCENT = 'lots';
    expect(donationFeePercent()).toBe(1);
  });

  it('is set on a gift when it is recorded', () => {
    const gift = Object.assign(new Donation(), { amount: 50 });
    gift.setPlatformFee();
    expect(gift.platformFee).toBe(0.5);
  });
});
