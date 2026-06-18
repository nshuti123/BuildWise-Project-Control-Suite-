import type { ReactNode } from "react";

export interface SiteInventoryPrintItem {
  material_name: string;
  material_unit: string;
  current_stock: string | number;
  material_minimum_stock?: string | number;
  updated_at: string;
  status: "ok" | "low" | "out";
}

export interface SiteInventoryPrintAllocation {
  id: number;
  material_name: string;
  material_unit: string;
  task_name: string;
  quantity: string | number;
  allocated_by_name?: string;
  date_allocated: string;
  notes?: string;
}

export interface SiteInventoryPrintRequest {
  material_name: string;
  quantity_requested: string | number;
  material_unit: string;
  status: string;
  created_at: string;
}

export interface SiteInventoryUsageByMaterial {
  material_name: string;
  material_unit: string;
  total_quantity: number;
  allocation_count: number;
}

export type SiteInventoryPrintVariant = "snapshot" | "daily-usage";

export interface SiteInventoryPrintReportProps {
  projectName: string;
  generatedAt: Date;
  variant?: SiteInventoryPrintVariant;
  /** e.g. "Monday, 18 May 2026" */
  periodLabel?: string;
  summary: {
    totalItems: number;
    lowStock: number;
    outOfStock: number;
    pendingRequests: number;
    allocationsRecent: number;
    unitsIssuedRecent: number;
    /** Daily usage report */
    usageAllocations?: number;
    usageMaterials?: number;
    usageTasks?: number;
  };
  items: SiteInventoryPrintItem[];
  allocations: SiteInventoryPrintAllocation[];
  pendingRequests: SiteInventoryPrintRequest[];
  usageByMaterial?: SiteInventoryUsageByMaterial[];
}

function StatusPill({ status }: { status: SiteInventoryPrintItem["status"] }) {
  const palette =
    status === "out"
      ? { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }
      : status === "low"
        ? { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }
        : { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" };
  const label = status === "out" ? "Out of stock" : status === "low" ? "Low stock" : "In stock";
  return (
    <span
      style={{
        ...palette,
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: "9999px",
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </span>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginTop: "28px" }}>
      <h2
        style={{
          fontSize: "14px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#0f172a",
          margin: "0 0 4px 0",
          borderBottom: "2px solid #1e40af",
          paddingBottom: "6px",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: "11px", color: "#64748b", margin: "6px 0 12px 0" }}>{subtitle}</p>
      )}
      {children}
    </section>
  );
}

export function SiteInventoryPrintReport({
  projectName,
  generatedAt,
  variant = "snapshot",
  periodLabel,
  summary,
  items,
  allocations,
  pendingRequests,
  usageByMaterial = [],
}: SiteInventoryPrintReportProps) {
  const isDailyUsage = variant === "daily-usage";
  const sortedItems = [...items].sort((a, b) =>
    a.material_name.localeCompare(b.material_name),
  );
  const sortedUsage = [...usageByMaterial].sort((a, b) =>
    b.total_quantity - a.total_quantity,
  );

  const reportTitle = isDailyUsage
    ? "Daily Inventory Usage Report"
    : "Site Inventory Report";

  const summaryCards = isDailyUsage
    ? [
        { label: "Allocations", value: summary.usageAllocations ?? allocations.length },
        { label: "Units issued", value: (summary.unitsIssuedRecent ?? 0).toLocaleString() },
        { label: "Materials used", value: summary.usageMaterials ?? 0 },
        { label: "Tasks supplied", value: summary.usageTasks ?? 0 },
      ]
    : [
        { label: "Materials tracked", value: summary.totalItems },
        { label: "Low stock", value: summary.lowStock },
        { label: "Out of stock", value: summary.outOfStock },
        { label: "Pending requests", value: summary.pendingRequests },
      ];

  return (
    <div
      className="site-inventory-print-report"
      style={{
        fontFamily: "Segoe UI, system-ui, sans-serif",
        color: "#0f172a",
        fontSize: "11px",
        lineHeight: 1.45,
        padding: "0",
        background: "#fff",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)",
          color: "#fff",
          padding: "28px 32px",
          marginBottom: "24px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          BuildWise · Construction Management
        </p>
        <h1 style={{ margin: "8px 0 0 0", fontSize: "26px", fontWeight: 800, letterSpacing: "-0.02em" }}>
          {reportTitle}
        </h1>
        <p style={{ margin: "12px 0 0 0", fontSize: "14px", fontWeight: 500, opacity: 0.95 }}>
          {projectName}
        </p>
        {periodLabel && (
          <p
            style={{
              margin: "8px 0 0 0",
              fontSize: "13px",
              fontWeight: 600,
              opacity: 0.95,
              background: "rgba(255,255,255,0.12)",
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: "6px",
            }}
          >
            {periodLabel}
          </p>
        )}
        <p style={{ margin: "6px 0 0 0", fontSize: "11px", opacity: 0.8 }}>
          Generated {generatedAt.toLocaleString()}
        </p>
      </header>

      <div style={{ padding: "0 32px 32px" }}>
        {/* Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          {summaryCards.map((s) => (
            <div
              key={s.label}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "14px 12px",
                textAlign: "center",
                background: "#f8fafc",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "9px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748b",
                }}
              >
                {s.label}
              </p>
              <p style={{ margin: "6px 0 0 0", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
        {!isDailyUsage && (
          <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 4px 0" }}>
            Allocations (last 7 days): {summary.allocationsRecent} · Units issued:{" "}
            {summary.unitsIssuedRecent.toLocaleString()}
          </p>
        )}
        {isDailyUsage && (
          <p style={{ fontSize: "10px", color: "#64748b", margin: "0 0 4px 0" }}>
            Material issued from site stock to field tasks during the period above.
          </p>
        )}

        {isDailyUsage && (
          <Section
            title="Usage by material"
            subtitle="Total quantity allocated during this period"
          >
            {sortedUsage.length === 0 ? (
              <p style={{ color: "#64748b" }}>No inventory usage recorded for this day.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    {["Material", "Total issued", "Allocations"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === "Total issued" ? "right" : "left",
                          padding: "10px 12px",
                          fontWeight: 700,
                          borderBottom: "2px solid #cbd5e1",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedUsage.map((row) => (
                    <tr key={row.material_name} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>{row.material_name}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700 }}>
                        {row.total_quantity.toLocaleString()} {row.material_unit}
                      </td>
                      <td style={{ padding: "9px 12px", color: "#64748b" }}>{row.allocation_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        )}

        {/* Stock table */}
        {!isDailyUsage && (
        <Section title="Stock on hand" subtitle="Current quantities at site warehouse">
          {sortedItems.length === 0 ? (
            <p style={{ color: "#64748b" }}>No materials in site inventory.</p>
          ) : (
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}
            >
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {["#", "Material", "On hand", "Min level", "Status", "Last updated"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === "On hand" || h === "Min level" ? "right" : "left",
                          padding: "10px 12px",
                          fontWeight: 700,
                          color: "#334155",
                          borderBottom: "2px solid #cbd5e1",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, idx) => (
                  <tr key={`${item.material_name}-${idx}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "9px 12px", color: "#94a3b8" }}>{idx + 1}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 600 }}>{item.material_name}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700 }}>
                      {Number(item.current_stock)} {item.material_unit}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#64748b" }}>
                      {Number(item.material_minimum_stock ?? 0) > 0
                        ? `${Number(item.material_minimum_stock)} ${item.material_unit}`
                        : "—"}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <StatusPill status={item.status} />
                    </td>
                    <td style={{ padding: "9px 12px", color: "#64748b" }}>
                      {new Date(item.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
        )}

        {/* Allocations */}
        <Section
          title={isDailyUsage ? "Allocation detail" : "Material allocations"}
          subtitle={
            isDailyUsage
              ? "Each issue from site stock during this period"
              : "Issues from site stock to project tasks (most recent first)"
          }
        >
          {allocations.length === 0 ? (
            <p style={{ color: "#64748b" }}>
              {isDailyUsage
                ? "No inventory usage recorded for this day."
                : "No allocations recorded."}
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {(isDailyUsage
                    ? ["Time", "Material", "Qty", "Task", "Allocated by"]
                    : ["Date", "Material", "Qty", "Task", "Allocated by"]
                  ).map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "Qty" ? "right" : "left",
                        padding: "8px 10px",
                        fontWeight: 700,
                        color: "#334155",
                        borderBottom: "2px solid #cbd5e1",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocations.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "#475569" }}>
                      {isDailyUsage
                        ? new Date(row.date_allocated).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : new Date(row.date_allocated).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{row.material_name}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>
                      {Number(row.quantity)} {row.material_unit}
                    </td>
                    <td style={{ padding: "8px 10px" }}>{row.task_name || "—"}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>
                      {row.allocated_by_name || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Pending requests */}
        {!isDailyUsage && pendingRequests.length > 0 && (
          <Section title="Pending requisitions" subtitle="Awaiting approval or fulfillment">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {["Material", "Quantity", "Status", "Requested"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        fontWeight: 700,
                        borderBottom: "2px solid #cbd5e1",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingRequests.slice(0, 20).map((req, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{req.material_name}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {Number(req.quantity_requested)} {req.material_unit}
                    </td>
                    <td style={{ padding: "8px 10px", textTransform: "capitalize" }}>
                      {req.status.replace(/_/g, " ")}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <footer
          style={{
            marginTop: "36px",
            paddingTop: "16px",
            borderTop: "2px solid #0f172a",
            textAlign: "center",
            color: "#64748b",
            fontSize: "10px",
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: "#334155" }}>
            BuildWise — {isDailyUsage ? "Daily usage report" : "Confidential site report"}
          </p>
          <p style={{ margin: "4px 0 0 0" }}>Page 1 · {generatedAt.toLocaleDateString()}</p>
        </footer>
      </div>
    </div>
  );
}
