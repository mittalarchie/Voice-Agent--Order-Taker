/**
 * Order engine — the only module allowed to mutate order state.
 *
 * Every function here is a straightforward CRUD-plus-validation operation;
 * none of them compute a price by hand. They fetch the real base
 * price / modifier deltas from the database, snapshot them onto the line,
 * and hand the arithmetic off to pricing.ts. This is what the plan means
 * by "the model never invents a price" — it's enforced here, structurally,
 * not just by prompt instruction.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { computeLineTotal, computeOrderTotal } from "./pricing";
import type { OrderLineSummary, OrderSummary } from "./types";

export class OrderEngineError extends Error {}

export async function createOrder(): Promise<{ id: string }> {
  return db.order.create({ data: {} });
}

export interface AddLineItemInput {
  menuItemId: string;
  quantity?: number;
  modifierOptionIds?: string[];
}

export async function addLineItem(orderId: string, input: AddLineItemInput): Promise<OrderLineSummary> {
  const menuItem = await db.menuItem.findUnique({ where: { id: input.menuItemId } });
  if (!menuItem) {
    throw new OrderEngineError(`No menu item with id ${input.menuItemId}`);
  }

  const modifierOptionIds = input.modifierOptionIds ?? [];
  const modifierOptions = modifierOptionIds.length
    ? await db.modifierOption.findMany({ where: { id: { in: modifierOptionIds } } })
    : [];

  if (modifierOptions.length !== modifierOptionIds.length) {
    throw new OrderEngineError("One or more modifier options were not found");
  }

  const created = await db.orderLineItem.create({
    data: {
      orderId,
      menuItemId: menuItem.id,
      quantity: input.quantity ?? 1,
      unitBasePriceSnapshot: menuItem.basePrice,
      modifiers: {
        create: modifierOptions.map((option) => ({
          modifierOptionId: option.id,
          priceDeltaSnapshot: option.priceDelta,
        })),
      },
    },
    include: lineItemInclude,
  });

  return toLineSummary(created);
}

export async function updateLineItemQuantity(lineItemId: string, quantity: number): Promise<OrderLineSummary | null> {
  if (quantity <= 0) {
    await removeLineItem(lineItemId);
    return null;
  }

  const updated = await db.orderLineItem.update({
    where: { id: lineItemId },
    data: { quantity },
    include: lineItemInclude,
  });

  return toLineSummary(updated);
}

export async function removeLineItem(lineItemId: string): Promise<void> {
  // No cascading delete configured on the schema, so modifiers go first.
  await db.orderLineItemModifier.deleteMany({ where: { orderLineItemId: lineItemId } });
  await db.orderLineItem.delete({ where: { id: lineItemId } });
}

export async function addModifierToLineItem(lineItemId: string, modifierOptionId: string): Promise<OrderLineSummary> {
  const option = await db.modifierOption.findUnique({ where: { id: modifierOptionId } });
  if (!option) {
    throw new OrderEngineError(`No modifier option with id ${modifierOptionId}`);
  }

  await db.orderLineItemModifier.create({
    data: {
      orderLineItemId: lineItemId,
      modifierOptionId: option.id,
      priceDeltaSnapshot: option.priceDelta,
    },
  });

  const updated = await db.orderLineItem.findUniqueOrThrow({
    where: { id: lineItemId },
    include: lineItemInclude,
  });
  return toLineSummary(updated);
}

export async function removeModifierFromLineItem(lineItemId: string, modifierOptionId: string): Promise<OrderLineSummary> {
  const existing = await db.orderLineItemModifier.findFirst({
    where: { orderLineItemId: lineItemId, modifierOptionId },
  });
  if (existing) {
    await db.orderLineItemModifier.delete({ where: { id: existing.id } });
  }

  const updated = await db.orderLineItem.findUniqueOrThrow({
    where: { id: lineItemId },
    include: lineItemInclude,
  });
  return toLineSummary(updated);
}

export async function getOrderSummary(orderId: string): Promise<OrderSummary> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { lineItems: { include: lineItemInclude } },
  });

  const lines = order.lineItems.map(toLineSummary);

  return {
    id: order.id,
    status: order.status,
    lines,
    total: computeOrderTotal(lines),
  };
}

export async function confirmOrder(orderId: string): Promise<OrderSummary> {
  await db.order.update({ where: { id: orderId }, data: { status: "CONFIRMED" } });
  return getOrderSummary(orderId);
}

// ── internal helpers ─────────────────────────────────────────────────────

const lineItemInclude = {
  menuItem: true,
  modifiers: { include: { modifierOption: true } },
} satisfies Prisma.OrderLineItemInclude;

type LineItemWithRelations = Prisma.OrderLineItemGetPayload<{ include: typeof lineItemInclude }>;

function toLineSummary(line: LineItemWithRelations): OrderLineSummary {
  const modifiers = line.modifiers.map((m) => ({
    id: m.modifierOption.id,
    name: m.modifierOption.name,
    priceDelta: m.priceDeltaSnapshot,
  }));

  return {
    id: line.id,
    menuItemId: line.menuItemId,
    menuItemName: line.menuItem.name,
    quantity: line.quantity,
    unitBasePrice: line.unitBasePriceSnapshot,
    modifiers,
    lineTotal: computeLineTotal({
      unitBasePrice: line.unitBasePriceSnapshot,
      quantity: line.quantity,
      modifiers,
    }),
  };
}
