import Tesseract from 'tesseract.js';
import pdf from 'pdf-parse';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface ExtractionResult {
  rawText: string;
  confidence: number;
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  subtotal: number | null;
  taxAmount: number | null;
  taxRate: number | null;
  totalAmount: number | null;
  currency: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

async function extractTextFromImage(filePath: string): Promise<{ text: string; confidence: number }> {
  // Preprocess with sharp for better OCR
  const processed = await sharp(filePath)
    .greyscale()
    .normalize()
    .sharpen()
    .toBuffer();

  const { data } = await Tesseract.recognize(processed, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        process.stdout.write(`\rOCR progress: ${(m.progress * 100).toFixed(0)}%`);
      }
    },
  });

  console.log(''); // newline after progress
  return { text: data.text, confidence: data.confidence };
}

async function extractTextFromPdf(filePath: string): Promise<{ text: string; confidence: number }> {
  const buffer = await fs.readFile(filePath);
  const data = await pdf(buffer);
  // PDFs with embedded text get high confidence
  if (data.text.trim().length > 20) {
    return { text: data.text, confidence: 95 };
  }
  // If PDF has minimal text, it's likely a scanned document — not supported without pdf-to-image conversion
  return { text: data.text, confidence: 30 };
}

function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[,$\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function extractField(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function normalizeDate(raw: string): string {
  // Handle MM-DD-YYYY or MM/DD/YYYY
  const mdyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Handle YYYY-MM-DD (already normalized)
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw;
  // Fallback: try Date for text dates like "October 2, 2023"
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return raw;
}

function extractDate(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return normalizeDate(match[1].trim());
    }
  }
  return null;
}

function isHeaderOrSummary(desc: string): boolean {
  return /^(qty|quantity|description|item|unit\s*price|amount|subtotal|sub\s*total|total|tax|balance|sales)/i.test(desc);
}

function extractLineItems(text: string): ExtractionResult['lineItems'] {
  const items: ExtractionResult['lineItems'] = [];
  let match;

  // Pattern 1: qty  description  price  amount (most common OCR layout)
  // Handles both multi-space and single-space separators, optional $ or S (OCR misread)
  const qtyFirstPattern = /^(\d+(?:\.\d+)?)\s+(.+?)\s{2,}[\$S]?([\d,]+\.\d{2})\s+[\$S]?([\d,]+\.\d{2})\s*$/gm;
  while ((match = qtyFirstPattern.exec(text)) !== null) {
    const desc = match[2].trim();
    if (isHeaderOrSummary(desc)) continue;
    items.push({
      description: desc,
      quantity: parseFloat(match[1]),
      unitPrice: parseAmount(match[3]) ?? 0,
      amount: parseAmount(match[4]) ?? 0,
    });
  }

  // Pattern 2: qty  description  price  amount (single space separators)
  if (items.length === 0) {
    const flexQtyPattern = /^(\d+(?:\.\d+)?)\s+(.+?)\s+[\$S]?([\d,]+\.\d{2})\s+[\$S]?([\d,]+\.\d{2})\s*$/gm;
    while ((match = flexQtyPattern.exec(text)) !== null) {
      const desc = match[2].trim();
      if (isHeaderOrSummary(desc)) continue;
      items.push({
        description: desc,
        quantity: parseFloat(match[1]),
        unitPrice: parseAmount(match[3]) ?? 0,
        amount: parseAmount(match[4]) ?? 0,
      });
    }
  }

  // Pattern 3: description  qty  price  amount
  if (items.length === 0) {
    const descFirstPattern = /^(.{3,80}?)\s{2,}(\d+(?:\.\d+)?)\s+[\$S]?([\d,]+\.\d{2})\s+[\$S]?([\d,]+\.\d{2})\s*$/gm;
    while ((match = descFirstPattern.exec(text)) !== null) {
      const desc = match[1].trim();
      if (isHeaderOrSummary(desc)) continue;
      items.push({
        description: desc,
        quantity: parseFloat(match[2]),
        unitPrice: parseAmount(match[3]) ?? 0,
        amount: parseAmount(match[4]) ?? 0,
      });
    }
  }

  // Pattern 4: description  price  amount (no explicit qty column — assume qty=1)
  if (items.length === 0) {
    const noPricePattern = /^(.{3,80}?)\s{2,}[\$S]?([\d,]+\.\d{2})\s+[\$S]?([\d,]+\.\d{2})\s*$/gm;
    while ((match = noPricePattern.exec(text)) !== null) {
      const desc = match[1].trim();
      if (isHeaderOrSummary(desc)) continue;
      const unitPrice = parseAmount(match[2]) ?? 0;
      const amount = parseAmount(match[3]) ?? 0;
      const quantity = unitPrice > 0 ? Math.round(amount / unitPrice) : 1;
      items.push({
        description: desc,
        quantity,
        unitPrice,
        amount,
      });
    }
  }

  return items;
}

export function parseInvoiceText(rawText: string, confidence: number): ExtractionResult {
  const text = rawText;

  const vendorName = extractField(text, [
    /(?:from|vendor|bill from|sold by)[:\s]*([^\n]+)/i,
    /^([A-Z][A-Za-z\s&.,]+(?:Inc|LLC|Ltd|Corp|Co)\.?)/m,
  ]);

  const invoiceNumber = extractField(text, [
    /(?:invoice\s*#?|inv\s*#?|invoice\s*no\.?|invoice\s*number)[:\s]*([A-Za-z0-9\-]+)/i,
    /(?:#)\s*([A-Za-z0-9\-]+)/i,
  ]);

  const invoiceDate = extractDate(text, [
    /(?:invoice\s*date|date\s*of\s*invoice|date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(?:invoice\s*date|date)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(?:date)[:\s]*(\d{4}-\d{2}-\d{2})/i,
  ]);

  const dueDate = extractDate(text, [
    /(?:due\s*date|payment\s*due|due)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(?:due\s*date|due)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
  ]);

  const totalStr = extractField(text, [
    /(?:\btotal\s*(?:\([^)]*\)\s*)?(?:due|amount)?|amount\s*due|balance\s*due|grand\s*total)[:\s]*\$?([\d,]+\.\d{2})/i,
  ]);
  const totalAmount = totalStr ? parseAmount(totalStr) : null;

  const subtotalStr = extractField(text, [
    /(?:subtotal|sub[\s-]?total)[:\s]*\$?([\d,]+\.\d{2})/i,
  ]);
  const subtotal = subtotalStr ? parseAmount(subtotalStr) : null;

  const taxStr = extractField(text, [
    /(?:tax|vat|gst|hst|sales\s*tax)(?:\s*\([^)]*\))?[:\s]*\$?([\d,]+\.\d{2})/i,
  ]);
  const taxAmount = taxStr ? parseAmount(taxStr) : null;

  // Extract tax rate percentage (e.g. "Sales Tax 6.25%", "Tax (5%)", "VAT 20%", "GST 9%")
  const taxRateStr = extractField(text, [
    /(?:sales\s*tax|tax|vat|gst|hst)\s*([\d.]+)\s*%/i,
    /(?:sales\s*tax|tax|vat|gst|hst)\s*\(\s*([\d.]+)\s*%\s*\)/i,
    /(?:sales\s*tax|tax|vat|gst|hst)\s*(?:rate)?\s*[:\s]\s*([\d.]+)\s*%/i,
  ]);
  let taxRate: number | null = taxRateStr ? parseFloat(taxRateStr) : null;
  // Calculate tax rate from amounts if not found in text
  if (taxRate === null && taxAmount !== null && subtotal !== null && subtotal > 0) {
    taxRate = Math.round((taxAmount / subtotal) * 10000) / 100;
  }

  // Detect currency
  let currency = 'USD';
  if (/[£]/.test(text)) currency = 'GBP';
  else if (/[€]/.test(text)) currency = 'EUR';
  else if (/CAD/i.test(text)) currency = 'CAD';

  const lineItems = extractLineItems(text);

  console.log(`Extracted ${lineItems.length} line items from OCR text`);

  // Only override OCR-extracted totals if line items sum matches the extracted subtotal,
  // confirming all items were captured. Otherwise keep the OCR totals as source of truth.
  let finalSubtotal = subtotal;
  let finalTotal = totalAmount;
  if (lineItems.length > 0) {
    const itemsSum = Math.round(lineItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    if (subtotal !== null && Math.abs(itemsSum - subtotal) < 0.02) {
      // Line items are complete — use calculated values for precision
      finalSubtotal = itemsSum;
      finalTotal = Math.round((itemsSum + (taxAmount ?? 0)) * 100) / 100;
    } else if (subtotal === null) {
      // No OCR subtotal extracted — use line items sum as best effort
      finalSubtotal = itemsSum;
      finalTotal = Math.round((itemsSum + (taxAmount ?? 0)) * 100) / 100;
    }
    // Otherwise: line items are incomplete, keep OCR-extracted subtotal/total
  }

  return {
    rawText,
    confidence,
    vendorName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    subtotal: finalSubtotal,
    taxAmount,
    taxRate,
    totalAmount: finalTotal,
    currency,
    lineItems,
  };
}

export async function processFile(filePath: string): Promise<ExtractionResult> {
  const ext = path.extname(filePath).toLowerCase();
  let text: string;
  let confidence: number;

  if (ext === '.pdf') {
    const result = await extractTextFromPdf(filePath);
    text = result.text;
    confidence = result.confidence;
  } else if (['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.webp'].includes(ext)) {
    const result = await extractTextFromImage(filePath);
    text = result.text;
    confidence = result.confidence;
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  return parseInvoiceText(text, confidence);
}
