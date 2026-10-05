import { findPackage } from '../src/services/purchaseProductMatch';
import { PurchasesOffering } from '../src/services/purchases';

function offeringWith(identifiers: string[]): PurchasesOffering {
  return {
    identifier: 'default',
    availablePackages: identifiers.map(id => ({
      identifier: id,
      product: { identifier: id, priceString: '$1.00', title: 'x' },
    })),
  };
}

describe('findPackage (CLAUDE-CODE-PROMPT-legal-links.md §8)', () => {
  test('matches a plain iOS-style identifier exactly', () => {
    const offering = offeringWith(['pro_monthly', 'pro_annual']);
    expect(findPackage(offering, 'pro_monthly')?.product.identifier).toBe('pro_monthly');
  });

  test('matches an Android-style identifier with a base-plan suffix after the colon', () => {
    const offering = offeringWith(['pro_monthly:p1m', 'pro_annual:p1y']);
    expect(findPackage(offering, 'pro_monthly')?.product.identifier).toBe('pro_monthly:p1m');
    expect(findPackage(offering, 'pro_annual')?.product.identifier).toBe('pro_annual:p1y');
  });

  test('returns undefined when no package matches the product id', () => {
    const offering = offeringWith(['premium_monthly:p1m']);
    expect(findPackage(offering, 'pro_monthly')).toBeUndefined();
  });

  test('returns undefined when offering is null', () => {
    expect(findPackage(null, 'pro_monthly')).toBeUndefined();
  });
});
