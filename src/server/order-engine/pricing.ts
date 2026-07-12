/**
 * Pure pricing math. No database, no I/O — every function here is a plain
 * transformation of numbers/objects it's given, which is what makes them
 * testable without spinning up SQLite or mocking Prisma (see pricing.test.ts).
 *
 * This is the ONLY place total math happens. Nothing else in the codebase
 * — including the AI tool layer — should re-derive a price by hand.
 */

export interface ModifierForPricing {
  priceDelta: number;
}

export interface LineForPricing {
  unitBasePrice: number;
  quantity: number;
  modifiers: ModifierForPricing[];
}

/** (base + sum of modifier deltas) * quantity */
export function computeLineTotal(line: LineForPricing): number {
  const modifierTotal = line.modifiers.reduce((sum, m) => sum + m.priceDelta, 0);
  return (line.unitBasePrice + modifierTotal) * line.quantity;
}

/** Sum of computeLineTotal across every line in the order. */
export function computeOrderTotal(lines: LineForPricing[]): number {
  return lines.reduce((sum, line) => sum + computeLineTotal(line), 0);
}
