import { jsPDF } from "jspdf";
import { put } from "@vercel/blob";
import { fetchLogoBase64, drawHeader, drawFooter, FOOTER_H } from "./pdf-template";

export interface ReceiptData {
  transactionId: string;
  organizationName: string;
  tenantName: string;
  propertyName: string;
  unitName: string;
  leaseStartDate: string;
  leaseEndDate: string;
  amount: string;
  currency: string;
  paidAt: string;
  paymentLinkUrl?: string;
}

export interface ReceiptResult {
  url: string;
  storageKey: string;
}

/**
 * Generate a PDF receipt and upload to Vercel Blob.
 * Returns the public URL and storage key.
 */
export async function generateReceipt(
  data: ReceiptData,
): Promise<ReceiptResult> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const labelX = margin;
  const valueX = margin + 50;

  const logo = await fetchLogoBase64();
  const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const docId = `RCP-${data.transactionId.slice(-8).toUpperCase()}`;

  let y = drawHeader(doc, logo, data.organizationName);
  drawFooter(doc, generatedAt, docId, data.tenantName, data.organizationName, "This is an automatically generated payment receipt.");

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("Payment Receipt", margin, y);
  y += 12;
  doc.setTextColor(0, 0, 0);

  // Transaction Details
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Transaction Details", margin, y);
  y += 6;

  const infoRows: [string, string][] = [
    ["Transaction ID:", data.transactionId],
    ["Payment Date:", data.paidAt],
  ];

  doc.setFontSize(9);
  for (const [label, value] of infoRows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, labelX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, valueX, y);
    y += 5;
  }
  y += 7;

  // Tenant & Property
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Tenant & Property", margin, y);
  y += 6;

  const partyRows: [string, string][] = [
    ["Tenant:", data.tenantName],
    ["Property / Unit:", `${data.propertyName} / ${data.unitName}`],
    ["Lease Period:", `${data.leaseStartDate} – ${data.leaseEndDate}`],
  ];

  doc.setFontSize(9);
  for (const [label, value] of partyRows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, labelX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, valueX, y);
    y += 5;
  }
  y += 7;

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Amount
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("Amount Paid:", margin, y);
  doc.text(
    `${data.currency} ${data.amount}`,
    pageWidth - margin,
    y,
    { align: "right" },
  );
  doc.setTextColor(0, 0, 0);

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const storageKey = `receipts/rent-${data.transactionId}.pdf`;

  const blob = await put(storageKey, pdfBuffer, {
    access: "public",
    contentType: "application/pdf",
  });

  return { url: blob.url, storageKey };
}
