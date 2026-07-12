/**
 * Translates a tool call (name + JSON args) into a call against
 * order-engine / menu, and shapes the result back into the plain object
 * the model receives as the tool's output.
 *
 * Deliberately thin: no business logic lives here. If you're tempted to
 * add pricing math or menu-matching logic to this file, it belongs in
 * order-engine/pricing.ts or server/menu instead.
 *
 * Arguments arrive as `unknown` (parsed from the model's JSON) and are
 * cast after a light shape check — the tool schema in tools.ts is what
 * constrains what the model can send, so this stays pragmatic rather
 * than re-validating with a schema library.
 */

import {
  OrderEngineError,
  addLineItem,
  updateLineItemQuantity,
  removeLineItem,
  addModifierToLineItem,
  removeModifierFromLineItem,
  getOrderSummary,
  confirmOrder,
} from "@/server/order-engine";
import type { OrderLineSummary, OrderSummary } from "@/server/order-engine/types";
import { findMenuItemsByName, getMenuItemById, toMenuItemDetail } from "@/server/menu";

export interface ToolContext {
  orderId: string;
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;

export const toolHandlers: Record<string, ToolHandler> = {
  async search_menu(args) {
    const query = String(args.query ?? "");
    const items = await findMenuItemsByName(query);
    return { matches: items.map(toMenuItemDetail) };
  },

  async add_item(args, ctx) {
    const menuItemId = String(args.menu_item_id ?? "");
    const quantity = typeof args.quantity === "number" ? args.quantity : undefined;
    const modifierOptionIds = Array.isArray(args.modifier_option_ids)
      ? (args.modifier_option_ids as string[])
      : [];

    const item = await getMenuItemById(menuItemId);
    if (!item) {
      return { status: "error", message: `No menu item with id ${menuItemId}. Call search_menu again.` };
    }

    const selected = new Set(modifierOptionIds);
    const missingGroup = item.modifierGroups
      .map((link) => link.modifierGroup)
      .find((group) => group.isRequired && !group.options.some((option) => selected.has(option.id)));

    if (missingGroup) {
      return {
        status: "needs_clarification",
        missing_group: {
          modifier_group_id: missingGroup.id,
          name: missingGroup.name,
          options: missingGroup.options.map((option) => ({
            modifier_option_id: option.id,
            name: option.name,
            price_delta: option.priceDelta,
          })),
        },
      };
    }

    try {
      const line = await addLineItem(ctx.orderId, {
        menuItemId,
        quantity,
        modifierOptionIds,
      });
      const order = await getOrderSummary(ctx.orderId);
      return { status: "ok", line: toLineResult(line), order_total: order.total };
    } catch (err) {
      return { status: "error", message: err instanceof OrderEngineError ? err.message : "Failed to add item." };
    }
  },

  async update_item_quantity(args, ctx) {
    const lineItemId = String(args.line_item_id ?? "");
    const quantity = Number(args.quantity ?? 0);

    const line = await updateLineItemQuantity(lineItemId, quantity);
    const order = await getOrderSummary(ctx.orderId);
    return {
      status: "ok",
      removed: line === null,
      line: line ? toLineResult(line) : null,
      order_total: order.total,
    };
  },

  async remove_item(args, ctx) {
    const lineItemId = String(args.line_item_id ?? "");
    await removeLineItem(lineItemId);
    const order = await getOrderSummary(ctx.orderId);
    return { status: "ok", order_total: order.total };
  },

  async add_modifier(args, ctx) {
    const lineItemId = String(args.line_item_id ?? "");
    const modifierOptionId = String(args.modifier_option_id ?? "");

    try {
      const line = await addModifierToLineItem(lineItemId, modifierOptionId);
      const order = await getOrderSummary(ctx.orderId);
      return { status: "ok", line: toLineResult(line), order_total: order.total };
    } catch (err) {
      return { status: "error", message: err instanceof OrderEngineError ? err.message : "Failed to add modifier." };
    }
  },

  async remove_modifier(args, ctx) {
    const lineItemId = String(args.line_item_id ?? "");
    const modifierOptionId = String(args.modifier_option_id ?? "");

    const line = await removeModifierFromLineItem(lineItemId, modifierOptionId);
    const order = await getOrderSummary(ctx.orderId);
    return { status: "ok", line: toLineResult(line), order_total: order.total };
  },

  async get_order_summary(_args, ctx) {
    const order = await getOrderSummary(ctx.orderId);
    return toOrderResult(order);
  },

  async finalize_order(_args, ctx) {
    const order = await confirmOrder(ctx.orderId);
    return { status: "confirmed", order: toOrderResult(order) };
  },
};

// ── shaping helpers ─────────────────────────────────────────────────────

function toLineResult(line: OrderLineSummary) {
  return {
    line_item_id: line.id,
    menu_item_name: line.menuItemName,
    quantity: line.quantity,
    modifiers: line.modifiers.map((m) => ({ name: m.name, price_delta: m.priceDelta })),
    line_total: line.lineTotal,
  };
}

function toOrderResult(order: OrderSummary) {
  return {
    status: order.status,
    lines: order.lines.map(toLineResult),
    total: order.total,
  };
}
