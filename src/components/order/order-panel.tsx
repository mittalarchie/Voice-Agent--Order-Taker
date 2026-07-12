import type { OrderSummary } from "@/server/order-engine/types";

export function OrderPanel({ order }: { order: OrderSummary | null }) {
  if (!order || order.lines.length === 0) {
    return (
      <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        No items yet — start the call and place an order.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-6">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">Order</h2>
      <ul className="space-y-3">
        {order.lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-4 text-sm">
            <div>
              <div className="font-medium text-foreground">
                {line.quantity > 1 ? `${line.quantity}\u00d7 ` : ""}
                {line.menuItemName}
              </div>
              {line.modifiers.length > 0 && (
                <div className="text-muted-foreground">{line.modifiers.map((m) => m.name).join(", ")}</div>
              )}
            </div>
            <div className="whitespace-nowrap text-foreground">AED {line.lineTotal}</div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm font-medium text-foreground">
        <span>Total</span>
        <span>AED {order.total}</span>
      </div>
      {order.status === "CONFIRMED" && (
        <div className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          Order confirmed
        </div>
      )}
    </div>
  );
}
