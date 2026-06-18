import { jsPDF } from "jspdf";
import api from "../api";

export interface TableReportData {
  title: string;
  subtitle?: string;
  filename: string;
  columns: string[];
  rows: (string | number | null | undefined)[][];
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function exportTableExcelClient(data: TableReportData) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [
    data.columns.map(escape).join(","),
    ...data.rows.map((row) => row.map(escape).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${data.filename}.csv`);
}

export function exportTablePdfClient(data: TableReportData): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  doc.setFontSize(16);
  doc.text(`BuildWise — ${data.title}`, margin, y);
  y += 22;
  if (data.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(data.subtitle, margin, y);
    y += 18;
    doc.setTextColor(0);
  }

  const colCount = Math.max(data.columns.length, 1);
  const tableWidth = pageWidth - margin * 2;
  const colWidth = tableWidth / colCount;
  const lineHeight = 12;
  const cellPadding = 4;

  const wrapCellLines = (text: string, maxWidth: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 9 : 8);
    return doc.splitTextToSize(text, maxWidth - cellPadding * 2);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const headerLinesPerCol = data.columns.map((col) =>
    wrapCellLines(String(col), colWidth, true),
  );
  const headerRowHeight =
    Math.max(...headerLinesPerCol.map((lines) => lines.length), 1) * lineHeight + cellPadding * 2;

  ensureSpace(headerRowHeight);
  headerLinesPerCol.forEach((lines, i) => {
    lines.forEach((line, lineIdx) => {
      doc.text(line, margin + i * colWidth + cellPadding, y + cellPadding + lineIdx * lineHeight + 8);
    });
  });
  y += headerRowHeight;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (const row of data.rows) {
    const cellLines = row.map((cell, i) => wrapCellLines(String(cell ?? "—"), colWidth));
    const rowHeight =
      Math.max(...cellLines.map((lines) => lines.length), 1) * lineHeight + cellPadding * 2;

    ensureSpace(rowHeight);
    cellLines.forEach((lines, i) => {
      lines.forEach((line, lineIdx) => {
        doc.text(line, margin + i * colWidth + cellPadding, y + cellPadding + lineIdx * lineHeight + 8);
      });
    });
    y += rowHeight;
  }

  return doc.output("blob");
}

export async function exportTablePdfProject(projectId: number, data: TableReportData) {
  const response = await api.post(
    `/projects/${projectId}/export-table-report/`,
    {
      title: data.title,
      export_as: "pdf",
      headers: data.columns,
      rows: data.rows,
    },
    { responseType: "blob" },
  );
  downloadBlob(response.data, `${data.filename}.pdf`);
}

export async function exportTableExcelProject(projectId: number, data: TableReportData) {
  const response = await api.post(
    `/projects/${projectId}/export-table-report/`,
    {
      title: data.title,
      export_as: "excel",
      headers: data.columns,
      rows: data.rows,
    },
    { responseType: "blob" },
  );
  downloadBlob(response.data, `${data.filename}.xlsx`);
}

export async function emailTableReportProject(
  projectId: number,
  data: TableReportData,
  payload: { email: string; message: string; attachments: File[]; subject?: string },
) {
  const form = new FormData();
  form.append("email", payload.email);
  form.append("message", payload.message);
  form.append("title", data.title);
  form.append("headers", JSON.stringify(data.columns));
  form.append("rows", JSON.stringify(data.rows));
  if (payload.subject) form.append("subject", payload.subject);
  payload.attachments.forEach((file) => form.append("attachments", file));
  await api.post(`/projects/${projectId}/email-table-report/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function emailTableReportGeneric(
  data: TableReportData,
  payload: { email: string; message: string; attachments: File[]; subject?: string },
) {
  const pdfBlob = exportTablePdfClient(data);
  const form = new FormData();
  form.append("email", payload.email);
  form.append("message", payload.message);
  form.append("subject", payload.subject || `BuildWise Report — ${data.title}`);
  form.append("report", pdfBlob, `${data.filename}.pdf`);
  payload.attachments.forEach((file) => form.append("attachments", file));
  await api.post("/users/send-report-email/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function emailTimelineReportProject(
  projectId: number,
  payload: { email: string; message: string; attachments: File[] },
) {
  const form = new FormData();
  form.append("email", payload.email);
  form.append("message", payload.message);
  payload.attachments.forEach((file) => form.append("attachments", file));
  await api.post(`/projects/${projectId}/email-timeline-report/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function emailTransactionReportProject(
  projectId: number,
  payload: {
    email: string;
    message: string;
    attachments: File[];
    type: "Daily" | "Custom";
    startDate?: string;
    endDate?: string;
  },
) {
  const form = new FormData();
  form.append("email", payload.email);
  form.append("message", payload.message);
  form.append("type", payload.type);
  if (payload.type === "Custom") {
    form.append("start_date", payload.startDate ?? "");
    form.append("end_date", payload.endDate ?? "");
  }
  payload.attachments.forEach((file) => form.append("attachments", file));
  await api.post(`/projects/${projectId}/email-transaction-report/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
