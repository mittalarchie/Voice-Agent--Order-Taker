/**
 * The tool contract exposed to the model. Defined once, in a plain JSON
 * Schema shape, then adapted via toChatCompletionsTools() to whichever
 * OpenAI-compatible API is calling it — used by both the text simulator
 * (Milestone 3) and the voice pipeline's /api/converse endpoint
 * (Milestone 4), since both go through the same Chat Completions-style
 * API (Groq, by default). One source of truth means the two can't drift
 * out of sync with each other.
 *
 * Design principle: the model never receives or invents a price. Every
 * tool that touches an order returns the resulting order/line state
 * (including totals) computed by order-engine — the model just reads
 * those numbers back to the customer, it never calculates them.
 */

interface JSONSchemaProperty {
  type: "string" | "number" | "array" | "boolean";
  description?: string;
  items?: JSONSchemaProperty;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, JSONSchemaProperty>;
    required: string[];
    additionalProperties: false;
  };
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "search_menu",
    description:
      "Look up items by what the customer said. Returns ranked matches with modifier groups/options and prices. " +
      "Always call this before add_item. Empty result = not on the menu — say so plainly, suggest 1-2 alternatives.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "item name/description as the customer said it" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "add_item",
    description:
      "Add a menu item using a menu_item_id from search_menu. If a REQUIRED modifier group (Size, Flavor) has no " +
      "selection, returns status 'needs_clarification' with the missing options instead of adding — ask, then retry. " +
      "Optional groups (add-ons) only apply if the customer mentioned them.",
    parameters: {
      type: "object",
      properties: {
        menu_item_id: { type: "string", description: "id from a search_menu result" },
        quantity: { type: "number", description: "defaults to 1" },
        modifier_option_ids: {
          type: "array",
          items: { type: "string" },
          description: "selected modifier option ids, from the search_menu result",
        },
      },
      required: ["menu_item_id"],
      additionalProperties: false,
    },
  },
  {
    name: "update_item_quantity",
    description: "Change a line item's quantity (e.g. 'make it two'). Prefer remove_item for a plain cancellation.",
    parameters: {
      type: "object",
      properties: {
        line_item_id: { type: "string", description: "from add_item or get_order_summary" },
        quantity: { type: "number" },
      },
      required: ["line_item_id", "quantity"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_item",
    description: "Remove a line item entirely (e.g. 'cancel the fries').",
    parameters: {
      type: "object",
      properties: {
        line_item_id: { type: "string", description: "from add_item or get_order_summary" },
      },
      required: ["line_item_id"],
      additionalProperties: false,
    },
  },
  {
    name: "add_modifier",
    description: "Add a modifier to an existing line — to satisfy a required group, or an after-the-fact addition.",
    parameters: {
      type: "object",
      properties: {
        line_item_id: { type: "string" },
        modifier_option_id: { type: "string" },
      },
      required: ["line_item_id", "modifier_option_id"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_modifier",
    description: "Remove a modifier from an existing line item.",
    parameters: {
      type: "object",
      properties: {
        line_item_id: { type: "string" },
        modifier_option_id: { type: "string" },
      },
      required: ["line_item_id", "modifier_option_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_order_summary",
    description: "Every line item, its modifiers, and the running total. Use for total readbacks and pre-confirmation.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "finalize_order",
    description:
      "Close out the order. Only call after reading the full order back via get_order_summary and getting explicit confirmation.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
];

/** Chat Completions API shape: { type: "function", function: { name, description, parameters } } */
export function toChatCompletionsTools() {
  return toolDefinitions.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}
