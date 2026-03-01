import { jsPDF } from "jspdf";
import { list } from "@vercel/blob";

const LOGO_SCALE = 0.25;
export const HEADER_H = 26;
export const FOOTER_H = 26;

export async function fetchLogoBase64(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const { blobs } = await list({ prefix: "Haventium Logo" });
    const blob = blobs[0];
    if (!blob) return null;
    const res = await fetch(blob.url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const view = new DataView(buffer);
    const pxW = view.getUint32(16);
    const pxH = view.getUint32(20);
    const w = (pxW / 96) * 25.4 * LOGO_SCALE;
    const h = (pxH / 96) * 25.4 * LOGO_SCALE;
    const base64 = Buffer.from(buffer).toString("base64");
    return { data: base64, w, h };
  } catch {
    return null;
  }
}

export function drawHeader(
  doc: jsPDF,
  logo: { data: string; w: number; h: number } | null,
  orgName: string,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  const logoTopY = 3;
  const labelGap = 2;
  const labelH = 4;
  const bandH = logo ? logoTopY + logo.h + labelGap + labelH + 3 : HEADER_H;

  doc.setFillColor(248, 248, 248);
  doc.rect(0, 0, pageWidth, bandH, "F");

  if (logo) {
    doc.addImage(`data:image/png;base64,${logo.data}`, "PNG", margin, logoTopY, logo.w, logo.h);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Haventium", margin + logo.w / 2, logoTopY + logo.h + labelGap + labelH, { align: "center" });
  } else {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(orgName, margin, bandH / 2 + 2);
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(0, bandH, pageWidth, bandH);

  doc.setTextColor(0, 0, 0);
  return bandH + 8;
}

export function drawFooter(
  doc: jsPDF,
  generatedAt: string,
  docId: string,
  tenantName: string,
  orgName: string,
  footerNote: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const footerY = pageHeight - FOOTER_H;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("Electronically Generated · Haventium", margin, footerY + 5);

  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${generatedAt}  ·  Doc ID: ${docId}`, margin, footerY + 9.5);
  doc.text(`Issued for: ${tenantName}  ·  ${orgName}`, margin, footerY + 14);
  doc.text(footerNote, margin, footerY + 18.5);

  doc.setTextColor(0, 0, 0);
}
