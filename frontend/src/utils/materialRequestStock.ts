export const FIELD_REQUISITION_STOCK_MESSAGE =
  "The requested quantity exceeds available warehouse stock. Please contact the Procurement department to arrange additional materials.";

export function parseMaterialRequestError(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Failed to submit material request.";
  }
  const payload = data as Record<string, unknown>;
  const qty = payload.quantity_requested;
  if (typeof qty === "string") return qty;
  if (Array.isArray(qty) && typeof qty[0] === "string") return qty[0];
  if (typeof payload.detail === "string") return payload.detail;
  return "Failed to submit material request.";
}

export function quantityExceedsStock(
  quantity: string | number,
  currentStock: string | number | undefined,
): boolean {
  const qty = Number(quantity);
  const stock = Number(currentStock ?? 0);
  if (!Number.isFinite(qty) || qty <= 0) return false;
  return qty > stock;
}
