import { getDataClient } from "./supabase-data";

/**
 * Insert an entry into audit_log with proper actor attribution.
 * Silently catches errors so audit failures never break the main operation.
 */
export async function logAction({ table, operation, rowId, oldData, newData, actor, actorRole }) {
  try {
    const db = getDataClient();
    await db.from("audit_log").insert({
      table_name: table,
      operation,
      row_id: rowId != null ? String(rowId) : null,
      old_data: oldData ?? null,
      new_data: newData ?? null,
      performed_by: actorRole ? `${actor} (${actorRole})` : (actor || "system"),
    });
  } catch {
    // Audit must never break the primary operation
  }
}
