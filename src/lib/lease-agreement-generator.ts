import { jsPDF } from "jspdf";
import { put } from "@vercel/blob";
import { fetchLogoBase64, drawHeader, drawFooter, FOOTER_H } from "./pdf-template";

export interface LeaseAgreementData {
  leaseId: string;
  organizationName: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  propertyName: string;
  unitName: string;
  startDate: string;
  endDate: string;
  paymentCycle: string;
  rentAmount: string;
  depositAmount: string | null;
  isAutoRenew: boolean;
  gracePeriodDays: number | null;
  autoRenewalNoticeDays: number | null;
  lastPaymentDate: string | null;
  lastCancellationDate: string | null;
  templateClauses: string | null;
}

export interface LeaseAgreementResult {
  url: string;
  storageKey: string;
}


export async function generateLeaseAgreement(
  data: LeaseAgreementData,
): Promise<LeaseAgreementResult> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const labelX = margin;
  const valueX = margin + 55;

  const logo = await fetchLogoBase64();
  const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const docId = `HAV-${data.leaseId.slice(-8).toUpperCase()}`;

  const newPage = () => {
    doc.addPage();
    const y = drawHeader(doc, logo, data.organizationName);
    drawFooter(doc, generatedAt, docId, data.tenantName, data.organizationName, "This document is legally binding upon acceptance of lease terms by both parties.");
    return y;
  };

  let y = drawHeader(doc, logo, data.organizationName);
  drawFooter(doc, generatedAt, docId, data.tenantName, data.organizationName, "This document is legally binding upon acceptance of lease terms by both parties.");

  // H1
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("Lease Agreement", margin, y);
  y += 12;
  doc.setTextColor(0, 0, 0);

  const checkY = (needed = 15) => {
    if (y > pageHeight - FOOTER_H - needed) y = newPage();
  };

  // ── Parties ─────────────────────────────────────────────────────────────────
  const colWidth = (pageWidth - margin * 2) / 2;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Parties", margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Landlord (Organization)", margin, y);
  doc.text("Tenant", margin + colWidth, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.text(data.organizationName, margin, y);
  doc.text(data.tenantName, margin + colWidth, y);
  y += 5;
  doc.text("", margin, y);
  doc.text(data.tenantEmail || "—", margin + colWidth, y);
  y += 5;
  doc.text("", margin, y);
  doc.text(data.tenantPhone || "—", margin + colWidth, y);
  y += 12;

  // ── Property ─────────────────────────────────────────────────────────────────
  checkY(20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Property", margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Property:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.propertyName, margin + 35, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Unit:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.unitName, margin + 35, y);
  y += 12;

  // ── Lease Terms ──────────────────────────────────────────────────────────────
  checkY(50);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Lease Terms", margin, y);
  y += 6;

  const termRows: [string, string][] = [
    ["Start Date:", data.startDate],
    ["End Date:", data.endDate],
    ["Payment Cycle:", data.paymentCycle],
    ["Rent Amount:", data.rentAmount],
    ["Deposit Amount:", data.depositAmount ?? "—"],
    ["Grace Period:", data.gracePeriodDays != null ? `${data.gracePeriodDays} day(s)` : "—"],
    ["Auto-Renewal:", data.isAutoRenew ? "Yes" : "No"],
  ];

  doc.setFontSize(9);
  for (const [label, value] of termRows) {
    checkY();
    doc.setFont("helvetica", "bold");
    doc.text(label, labelX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, valueX, y);
    y += 5;
  }
  y += 7;

  // ── Auto-Renewal ─────────────────────────────────────────────────────────────
  if (data.isAutoRenew) {
    checkY(30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Auto-Renewal Details", margin, y);
    y += 6;

    const renewalRows: [string, string][] = [
      ["Notice Period:", `${data.autoRenewalNoticeDays ?? 30} day(s) before end date`],
      ["Last Payment Date:", data.lastPaymentDate ?? "—"],
      ["Last Cancellation Date:", data.lastCancellationDate ?? "—"],
    ];

    doc.setFontSize(9);
    for (const [label, value] of renewalRows) {
      checkY();
      doc.setFont("helvetica", "bold");
      doc.text(label, labelX, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, valueX, y);
      y += 5;
    }
    y += 7;
  }

  // ── Terms & Conditions ───────────────────────────────────────────────────────
  if (data.templateClauses) {
    checkY(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Terms & Conditions", margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const clauseLines = doc.splitTextToSize(data.templateClauses, pageWidth - margin * 2);
    for (const line of clauseLines) {
      checkY();
      doc.text(line, margin, y);
      y += 5;
    }
  }

  const storageKey = `lease-agreements/lease-${data.leaseId}.pdf`;
  const blob = await put(storageKey, Buffer.from(doc.output("arraybuffer")), {
    access: "public",
    contentType: "application/pdf",
  });

  return { url: blob.url, storageKey };
}
