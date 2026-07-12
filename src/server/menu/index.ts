/**
 * Read-side menu queries. Nothing here mutates an order — that's
 * order-engine's job. This module answers "what is the customer talking
 * about" and "what modifiers can apply to it."
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const menuItemWithModifiersInclude = {
  modifierGroups: { include: { modifierGroup: { include: { options: true } } } },
} satisfies Prisma.MenuItemInclude;

type MenuItemWithModifiers = Prisma.MenuItemGetPayload<{ include: typeof menuItemWithModifiersInclude }>;

export async function listMenu() {
  return db.category.findMany({
    include: {
      menuItems: {
        include: {
          modifierGroups: { include: { modifierGroup: { include: { options: true } } } },
        },
      },
    },
  });
}

export async function getMenuItemById(menuItemId: string) {
  return db.menuItem.findUnique({
    where: { id: menuItemId },
    include: {
      modifierGroups: { include: { modifierGroup: { include: { options: true } } } },
      comboSlots: true,
    },
  });
}

/**
 * Resolve a spoken/typed item name against the menu.
 *
 * Voice transcripts are messy ("can I get a double smash burger" for
 * "Double Chicken Smash"), so this is deliberately forgiving: exact match
 * first, then case-insensitive substring match in either direction, then
 * a token-overlap score as a last resort. It returns ranked candidates
 * rather than a single guess — the caller (the AI tool handler) decides
 * whether the top match is confident enough to add automatically or
 * whether to ask the customer to disambiguate. This is also the layer
 * that surfaces the "item not on the menu" curveball: an empty result
 * means nothing plausible matched.
 */
export async function findMenuItemsByName(query: string, limit = 3) {
  const items = await db.menuItem.findMany({ include: menuItemWithModifiersInclude });
  const normalizedQuery = normalize(query);
  const queryTokens = new Set(normalizedQuery.split(" ").filter(Boolean));

  const scored = items.map((item) => {
    const normalizedName = normalize(item.name);

    if (normalizedName === normalizedQuery) {
      return { item, score: 1 };
    }
    if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) {
      return { item, score: 0.8 };
    }

    const nameTokens = normalizedName.split(" ").filter(Boolean);
    const overlap = nameTokens.filter((t) => queryTokens.has(t)).length;
    const score = nameTokens.length > 0 ? overlap / nameTokens.length : 0;
    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
}

/**
 * Shapes a menu item (with its modifier groups/options) into the plain
 * object handed back as a tool result. snake_case keys because this is
 * the boundary the model reads directly — matching the tool schema's
 * naming makes the contract easier for the model to use correctly.
 */
export function toMenuItemDetail(item: MenuItemWithModifiers) {
  return {
    menu_item_id: item.id,
    name: item.name,
    description: item.description,
    base_price: item.basePrice,
    is_combo: item.isCombo,
    modifier_groups: item.modifierGroups.map((link) => ({
      modifier_group_id: link.modifierGroup.id,
      name: link.modifierGroup.name,
      selection_type: link.modifierGroup.selectionType,
      is_required: link.modifierGroup.isRequired,
      options: link.modifierGroup.options.map((option) => ({
        modifier_option_id: option.id,
        name: option.name,
        price_delta: option.priceDelta,
      })),
    })),
  };
}
