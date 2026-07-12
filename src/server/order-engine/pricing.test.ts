import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLineTotal, computeOrderTotal } from "./pricing";

test("a line with no modifiers is just base price × quantity", () => {
  const total = computeLineTotal({ unitBasePrice: 24, quantity: 1, modifiers: [] });
  assert.equal(total, 24);
});

test("a burger line carries several stacked modifiers (Large Double Chicken Smash, extra cheese, no onions)", () => {
  // Mirrors the worked example in the implementation plan: 38 + 4 + 0 = 42
  const total = computeLineTotal({
    unitBasePrice: 38,
    quantity: 1,
    modifiers: [{ priceDelta: 4 }, { priceDelta: 0 }],
  });
  assert.equal(total, 42);
});

test("quantity multiplies the whole (base + modifiers) sum, not just base", () => {
  // Two Spicy Zinger Burgers with Extra Patty each: (30 + 10) * 2 = 80
  const total = computeLineTotal({
    unitBasePrice: 30,
    quantity: 2,
    modifiers: [{ priceDelta: 10 }],
  });
  assert.equal(total, 80);
});

test("a Large Soft Drink applies both the size and flavor deltas (flavor is free here)", () => {
  // Small base 6, Large +4, Fanta +0 = 10
  const total = computeLineTotal({
    unitBasePrice: 6,
    quantity: 1,
    modifiers: [{ priceDelta: 4 }, { priceDelta: 0 }],
  });
  assert.equal(total, 10);
});

test("order total sums multiple lines correctly", () => {
  const total = computeOrderTotal([
    { unitBasePrice: 28, quantity: 1, modifiers: [] }, // Grilled Chicken Burger = 28
    { unitBasePrice: 10, quantity: 1, modifiers: [{ priceDelta: 5 }] }, // Large Fries = 15
    { unitBasePrice: 6, quantity: 1, modifiers: [{ priceDelta: 2 }, { priceDelta: 0 }] }, // Medium Coke = 8
  ]);
  assert.equal(total, 28 + 15 + 8);
});

test("an empty order totals to zero", () => {
  assert.equal(computeOrderTotal([]), 0);
});

test("a combo's flat price is unaffected by treating it as a single line with no modifiers", () => {
  // Classic Combo priced as one line at 42, matching menu.pdf rather than
  // summing its component items separately.
  const total = computeLineTotal({ unitBasePrice: 42, quantity: 1, modifiers: [] });
  assert.equal(total, 42);
});
