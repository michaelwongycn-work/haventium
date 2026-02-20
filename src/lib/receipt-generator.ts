import { jsPDF } from "jspdf";
import { put } from "@vercel/blob";

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
  let y = 20;

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(data.organizationName, margin, y);
  y += 8;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Payment Receipt", margin, y);
  y += 15;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Transaction ID
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Transaction ID:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.transactionId, margin + 40, y);
  y += 6;

  // Paid At
  doc.setFont("helvetica", "bold");
  doc.text("Payment Date:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.paidAt, margin + 40, y);
  y += 12;

  // Tenant
  doc.setFont("helvetica", "bold");
  doc.text("Tenant:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.tenantName, margin + 40, y);
  y += 6;

  // Property / Unit
  doc.setFont("helvetica", "bold");
  doc.text("Property / Unit:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.propertyName} / ${data.unitName}`, margin + 40, y);
  y += 6;

  // Lease Period
  doc.setFont("helvetica", "bold");
  doc.text("Lease Period:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.leaseStartDate} – ${data.leaseEndDate}`, margin + 40, y);
  y += 12;

  // Divider
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Amount
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Amount Paid:", margin, y);
  doc.text(
    `${data.currency} ${data.amount}`,
    pageWidth - margin,
    y,
    { align: "right" },
  );
  y += 12;

  // Footer
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(
    "This is an automatically generated receipt.",
    margin,
    y,
  );

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const storageKey = `receipts/rent-${data.transactionId}.pdf`;

  const blob = await put(storageKey, pdfBuffer, {
    access: "public",
    contentType: "application/pdf",
  });

  return {
    url: blob.url,
    storageKey,
  };
}
