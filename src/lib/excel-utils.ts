import * as XLSX from "xlsx";

/**
 * Parse an Excel file and return rows as objects
 */
export function parseExcelFile<T = Record<string, unknown>>(
  file: File
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json<T>(worksheet);

        resolve(jsonData);
      } catch (error) {
        reject(new Error("Failed to parse Excel file"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Generate and download an Excel file from data
 */
export function downloadExcelFile<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  sheetName = "Sheet1"
): void {
  // Create workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate file and trigger download
  XLSX.writeFile(workbook, filename);
}

/**
 * Generate Excel template with sample row
 * Headers are automatically generated from the object keys
 */
export function downloadExcelTemplate<T extends Record<string, unknown>>(
  sampleRow: T,
  filename: string,
  sheetName = "Template"
): void {
  // json_to_sheet automatically creates headers from object keys
  const data = [sampleRow];
  downloadExcelFile(data, filename, sheetName);
}

/**
 * Convert boolean string values to actual booleans
 */
export function parseBooleanField(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

/**
 * Safely trim string values
 */
export function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "");
}

/**
 * Format date for Excel export
 */
export function formatDateForExcel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Parse date from Excel import
 */
export function parseDateFromExcel(value: unknown): Date | null {
  if (!value) return null;

  // Excel dates are serial numbers
  if (typeof value === "number") {
    // Excel epoch starts at 1900-01-01
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
    return date;
  }

  // String dates
  if (typeof value === "string") {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}
