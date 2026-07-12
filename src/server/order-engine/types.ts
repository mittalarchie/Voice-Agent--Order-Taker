/**
 * Shapes shared across the order-engine, the voice/tool layer, and the UI.
 * These describe a *read* of order state (already priced), never an
 * instruction to change it — mutation inputs live next to the functions
 * that perform them in order-engine/index.ts.
 */

export interface OrderLineModifierSummary {
  id: string;
  name: string;
  priceDelta: number;
}

export interface OrderLineSummary {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitBasePrice: number;
  modifiers: OrderLineModifierSummary[];
  /** (unitBasePrice + sum of modifier deltas) * quantity */
  lineTotal: number;
}

export interface OrderSummary {
  id: string;
  status: "IN_PROGRESS" | "CONFIRMED" | "CANCELLED";
  lines: OrderLineSummary[];
  /** Sum of every line's lineTotal. Always computed, never stored. */
  total: number;
}
