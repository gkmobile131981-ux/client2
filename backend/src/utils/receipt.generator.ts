import { PDFDocument, PDFImage, rgb, StandardFonts } from 'pdf-lib';
import { formatDateOnly, formatDateTime } from './date';

// Custom helper to draw a beautiful, pixel-perfect Indian Rupee (₹) symbol using vector lines
function drawRupee(page: any, x: number, y: number, size: number = 10, color = rgb(0.12, 0.16, 0.23)) {
  const thickness = size * 0.09;
  
  // Top horizontal bar
  page.drawLine({
    start: { x: x, y: y + size * 0.85 },
    end: { x: x + size * 0.65, y: y + size * 0.85 },
    thickness,
    color,
  });

  // Second horizontal bar
  page.drawLine({
    start: { x: x, y: y + size * 0.6 },
    end: { x: x + size * 0.65, y: y + size * 0.6 },
    thickness,
    color,
  });

  // Vertical stem
  page.drawLine({
    start: { x: x + size * 0.15, y: y + size * 0.85 },
    end: { x: x + size * 0.15, y: y + size * 0.35 },
    thickness,
    color,
  });

  // Loop points to approximate the curve
  const loopPoints = [
    { x: x + size * 0.15, y: y + size * 0.85 },
    { x: x + size * 0.45, y: y + size * 0.85 },
    { x: x + size * 0.55, y: y + size * 0.725 },
    { x: x + size * 0.55, y: y + size * 0.6 },
    { x: x + size * 0.45, y: y + size * 0.475 },
    { x: x + size * 0.15, y: y + size * 0.475 },
  ];

  for (let i = 0; i < loopPoints.length - 1; i++) {
    page.drawLine({
      start: loopPoints[i],
      end: loopPoints[i + 1],
      thickness,
      color,
    });
  }

  // Slanted leg
  page.drawLine({
    start: { x: x + size * 0.25, y: y + size * 0.475 },
    end: { x: x + size * 0.55, y: y + size * 0.1 },
    thickness,
    color,
  });
}

interface ReceiptData {
  repair: {
    id: string;
    job_number: string;
    estimate: number;
    advance: number;
    balance: number;
    status: string;
    delivery_date: string | null;
    notes: string | null;
    created_at: string;
    delivered_at: string | null;
    receiver_name: string | null;
    receiver_phone: string | null;
    receiver_photo_url: string | null;
    signature_url: string | null;
    delivered_by: string | null;
    device: {
      brand: string;
      model: string;
      imei: string | null;
      problem: string;
      warranty?: string | null;
    };
    customer: {
      name: string;
      phone: string;
      address: string | null;
    };
  };
  shop: {
    name: string;
    logo_url: string | null;
    address: string | null;
    phone: string | null;
    currency_symbol?: string | null;
    currency_code?: string | null;
  };
}

// Embed PNG/JPG images safely (gracefully skips unsupported formats like webp)
async function embedFlexibleImage(
  pdfDoc: PDFDocument,
  buffer: ArrayBuffer,
  contentType: string
): Promise<PDFImage | null> {
  const attempts: Array<'png' | 'jpg'> = [];
  if (contentType.includes('png')) {
    attempts.push('png');
  } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    attempts.push('jpg');
  } else {
    // Unknown type: try png first, then jpg as a fallback
    attempts.push('png', 'jpg');
  }

  for (const kind of attempts) {
    try {
      return kind === 'png' ? await pdfDoc.embedPng(buffer) : await pdfDoc.embedJpg(buffer);
    } catch (err) {
      // Continue to the next attempt
    }
  }
  console.error('Failed to embed image (unsupported format):', contentType);
  return null;
}

// Compute draw dimensions that preserve the image aspect ratio inside a max box
function fitImageInBox(image: PDFImage, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

// Truncate a string with an ellipsis so it never exceeds maxWidth
function truncateText(text: string, font: any, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let result = text;
  while (result.length > 0 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

// Wrap text into lines that fit within maxWidth
function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const { repair, shop } = data;
  const pdfDoc = await PDFDocument.create();
  
  // Use A4 size page
  const page = pdfDoc.addPage([595.27, 841.89]);
  const { width, height } = page.getSize();

  // Load fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Palette colors
  const primaryColor = rgb(0.06, 0.09, 0.16); // tailwind slate-950
  const secondaryColor = rgb(0.28, 0.33, 0.43); // slate-600
  const lightBgColor = rgb(0.96, 0.97, 0.98); // slate-50
  const accentGreen = rgb(0.09, 0.64, 0.29); // green-600
  const accentAmber = rgb(0.82, 0.5, 0.02); // amber-600
  const accentBlue = rgb(0.1, 0.46, 0.87); // blue-600
  const accentRed = rgb(0.83, 0.2, 0.2); // red-600
  const borderLight = rgb(0.89, 0.91, 0.94); // slate-200

  // Margins & Dimensions
  const marginX = 40;
  let cursorY = height - 40;

  // Currency handling with graceful fallback to INR / ₹
  const isValidCurrencySymbol = (s: string | null | undefined): boolean => {
    if (!s) return false;
    const normalized = s.trim();
    if (!normalized) return false;
    // Reject the corrupted mojibake default stored by an old migration (e.g. "\uFFFD,1")
    if (normalized.includes('\uFFFD')) return false;
    if (/[0-9]/.test(normalized)) return false;
    return true;
  };
  const currencySymbol = isValidCurrencySymbol(shop.currency_symbol) ? shop.currency_symbol!.trim() : '₹';
  const currencyCode = /^[A-Z]{3}$/.test(shop.currency_code || '') ? shop.currency_code! : 'INR';
  const useVectorRupee = currencySymbol === '₹';

  // Status badge meta (computed early so the header info column reserves enough room)
  const STATUS_META: Record<string, { label: string; color: any }> = {
    delivered: { label: 'DELIVERED', color: accentGreen },
    delivered_pending_balance: { label: 'DELIVERED · BALANCE DUE', color: accentAmber },
    ready: { label: 'READY FOR DELIVERY', color: accentBlue },
    repairing: { label: 'IN REPAIR', color: secondaryColor },
    pending: { label: 'PENDING', color: accentAmber },
    booking: { label: 'BOOKED', color: secondaryColor },
    cancelled: { label: 'CANCELLED', color: accentRed },
  };
  const statusMeta = STATUS_META[repair.status] || STATUS_META.booking;
  const badgeFontSize = 10;
  const badgeTextWidth = fontBold.widthOfTextAtSize(statusMeta.label, badgeFontSize);
  const badgeWidth = badgeTextWidth + 20;

  // Header layout: right side block reserves space for the title / job no / status badge
  const logoSize = 64;
  const rightBlockWidth = Math.max(150, badgeWidth + 16);
  const rightBlockX = width - marginX - rightBlockWidth;
  const infoX = marginX + logoSize + 15;
  const infoMaxWidth = rightBlockX - infoX - 8;

  // 1. Fetch and Embed Logo if available (aspect-ratio safe)
  let logoImage: PDFImage | null = null;
  if (shop.logo_url) {
    try {
      const response = await fetch(shop.logo_url);
      if (response && response.ok) {
        const logoBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || '';
        logoImage = await embedFlexibleImage(pdfDoc, logoBuffer, contentType);
      }
    } catch (err) {
      console.error('Failed to embed logo image:', err);
    }
  }

  // Draw Logo or Shop Initials Block (no distortion)
  if (logoImage) {
    const fitted = fitImageInBox(logoImage, logoSize, logoSize);
    page.drawImage(logoImage, {
      x: marginX + (logoSize - fitted.width) / 2,
      y: cursorY - logoSize + (logoSize - fitted.height) / 2,
      width: fitted.width,
      height: fitted.height,
    });
  } else {
    // Draw placeholder shop icon
    page.drawRectangle({
      x: marginX,
      y: cursorY - logoSize,
      width: logoSize,
      height: logoSize,
      color: primaryColor,
      opacity: 0.1,
    });
    // Draw initial letters
    const initials = shop.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    page.drawText(initials, {
      x: marginX + 18,
      y: cursorY - logoSize + 22,
      size: 20,
      font: fontBold,
      color: primaryColor,
    });
  }

  // Draw Shop Info next to logo (truncated so it never overlaps the right block)
  page.drawText(truncateText(shop.name, fontBold, 16, infoMaxWidth), {
    x: infoX,
    y: cursorY - 20,
    size: 16,
    font: fontBold,
    color: primaryColor,
  });

  // Address — wrapped automatically into multiple lines (up to MAX_ADDRESS_LINES),
  // preserving explicit newlines, so any length/format fits cleanly
  const MAX_ADDRESS_LINES = 3;
  const addressLines: string[] = [];
  const addressSegments = (shop.address || '')
    .split(/\r?\n/)
    .map((seg) => seg.trim())
    .filter(Boolean);
  for (const segment of addressSegments) {
    if (addressLines.length >= MAX_ADDRESS_LINES) break;
    for (const wrapped of wrapText(segment, font, 9, infoMaxWidth)) {
      if (addressLines.length >= MAX_ADDRESS_LINES) break;
      addressLines.push(wrapped);
    }
  }
  const addressDisplayLines = addressLines.length > 0 ? addressLines : ['Address not specified'];
  const addressStartY = cursorY - 38;
  addressDisplayLines.forEach((line, i) => {
    page.drawText(line, {
      x: infoX,
      y: addressStartY - i * 11,
      size: 9,
      font,
      color: secondaryColor,
    });
  });
  const phoneY = addressStartY - Math.max(addressDisplayLines.length - 1, 0) * 11 - 14;
  page.drawText(`Phone: ${shop.phone || 'N/A'}`, {
    x: infoX,
    y: phoneY,
    size: 9,
    font,
    color: secondaryColor,
  });

  // Draw Document Title + Job No + Status Badge in the reserved right block
  page.drawText('REPAIR RECEIPT', {
    x: rightBlockX,
    y: cursorY - 20,
    size: 14,
    font: fontBold,
    color: primaryColor,
  });

  page.drawText(`Job No: ${repair.job_number}`, {
    x: rightBlockX,
    y: cursorY - 36,
    size: 10,
    font: fontBold,
    color: secondaryColor,
  });

  const badgeX = width - marginX - badgeWidth;
  page.drawRectangle({
    x: badgeX,
    y: cursorY - 60,
    width: badgeWidth,
    height: 18,
    color: statusMeta.color,
    opacity: 0.12,
  });
  page.drawText(statusMeta.label, {
    x: badgeX + 10,
    y: cursorY - 54,
    size: badgeFontSize,
    font: fontBold,
    color: statusMeta.color,
  });

  cursorY -= (logoSize + 25);

  // Draw dividing horizontal rule
  page.drawLine({
    start: { x: marginX, y: cursorY },
    end: { x: width - marginX, y: cursorY },
    thickness: 1,
    color: borderLight,
  });

  cursorY -= 20;

  // 2. Dates section — three aligned columns (labels + values straight from the DB)
  page.drawText('Receipt Dates:', { x: marginX, y: cursorY, size: 9, font: fontBold, color: secondaryColor });

  const expectedDelivery = repair.delivery_date ? formatDateOnly(repair.delivery_date) : 'N/A';
  const deliveredValue = repair.delivered_at ? formatDateTime(repair.delivered_at) : '—';

  const dateColWidth = (width - marginX * 2) / 3;
  const dateLabelY = cursorY - 14;
  const dateValueY = cursorY - 28;
  const dateColumns = [
    { label: 'BOOKED', value: formatDateOnly(repair.created_at), emphasized: false },
    { label: 'EXPECTED DELIVERY', value: expectedDelivery, emphasized: false },
    { label: 'DELIVERED', value: deliveredValue, emphasized: !!repair.delivered_at },
  ];
  dateColumns.forEach((col, i) => {
    const x = marginX + i * dateColWidth;
    page.drawText(col.label, {
      x,
      y: dateLabelY,
      size: 7,
      font: fontBold,
      color: secondaryColor,
    });
    page.drawText(col.value, {
      x,
      y: dateValueY,
      size: 9,
      font: col.emphasized ? fontBold : font,
      color: col.emphasized ? accentGreen : primaryColor,
    });
  });

  cursorY -= 42;

  // 3. Customer and Device details boxes side-by-side
  const colWidth = (width - marginX * 2 - 16) / 2;
  const boxHeight = 90;
  const boxY = cursorY - boxHeight;

  // Customer Card
  page.drawRectangle({
    x: marginX,
    y: boxY,
    width: colWidth,
    height: boxHeight,
    color: lightBgColor,
  });
  page.drawRectangle({
    x: marginX,
    y: boxY,
    width: colWidth,
    height: boxHeight,
    borderColor: borderLight,
    borderWidth: 1,
  });
  // Title Customer
  page.drawText('CUSTOMER INFORMATION', {
    x: marginX + 12,
    y: boxY + boxHeight - 18,
    size: 9,
    font: fontBold,
    color: secondaryColor,
  });
  // Details
  page.drawText(repair.customer.name, {
    x: marginX + 12,
    y: boxY + boxHeight - 34,
    size: 10,
    font: fontBold,
    color: primaryColor,
  });
  page.drawText(`Phone: ${repair.customer.phone}`, {
    x: marginX + 12,
    y: boxY + boxHeight - 48,
    size: 9,
    font,
    color: primaryColor,
  });
  page.drawText(`Address: ${repair.customer.address || 'Not specified'}`, {
    x: marginX + 12,
    y: boxY + boxHeight - 62,
    size: 9,
    font,
    color: primaryColor,
    maxWidth: colWidth - 24,
    lineHeight: 11,
  });

  // Device Card
  const devCardX = marginX + colWidth + 16;
  page.drawRectangle({
    x: devCardX,
    y: boxY,
    width: colWidth,
    height: boxHeight,
    color: lightBgColor,
  });
  page.drawRectangle({
    x: devCardX,
    y: boxY,
    width: colWidth,
    height: boxHeight,
    borderColor: borderLight,
    borderWidth: 1,
  });
  // Title Device
  page.drawText('DEVICE DETAILS', {
    x: devCardX + 12,
    y: boxY + boxHeight - 18,
    size: 9,
    font: fontBold,
    color: secondaryColor,
  });
  // Details
  page.drawText(`${repair.device.brand} ${repair.device.model}`, {
    x: devCardX + 12,
    y: boxY + boxHeight - 34,
    size: 10,
    font: fontBold,
    color: primaryColor,
  });
  page.drawText(`IMEI: ${repair.device.imei || 'N/A'}`, {
    x: devCardX + 12,
    y: boxY + boxHeight - 48,
    size: 9,
    font,
    color: primaryColor,
  });
  page.drawText(`Issue: ${repair.device.problem}`, {
    x: devCardX + 12,
    y: boxY + boxHeight - 62,
    size: 9,
    font: fontBold,
    color: primaryColor,
    maxWidth: colWidth - 24,
    lineHeight: 11,
  });

  cursorY = boxY - 25;

  // 3.5. Device Warranty strip — shown between the device card and financials so the
  // customer can see the coverage at a glance. Renders the stored value, or "No Warranty"
  // when none was recorded.
  const warrantyValue = (repair.device.warranty || '').trim();
  const hasWarranty = warrantyValue.length > 0;
  const warrantyDisplay = hasWarranty ? warrantyValue : 'No Warranty';

  page.drawRectangle({
    x: marginX,
    y: cursorY - 26,
    width: width - marginX * 2,
    height: 26,
    color: lightBgColor,
  });

  page.drawText('DEVICE WARRANTY', {
    x: marginX + 12,
    y: cursorY - 17,
    size: 9,
    font: fontBold,
    color: secondaryColor,
  });

  page.drawText(warrantyDisplay, {
    x: marginX + colWidth + 16,
    y: cursorY - 17,
    size: 9,
    font: hasWarranty ? fontBold : font,
    color: hasWarranty ? primaryColor : secondaryColor,
    maxWidth: colWidth - 12,
    lineHeight: 11,
  });

  cursorY -= 26 + 12;

  // 4. Financials Section Table
  page.drawText('FINANCIALS SUMMARY', {
    x: marginX,
    y: cursorY,
    size: 9,
    font: fontBold,
    color: secondaryColor,
  });

  cursorY -= 15;

  const tableHeaderY = cursorY - 18;
  // Draw header row background
  page.drawRectangle({
    x: marginX,
    y: tableHeaderY,
    width: width - marginX * 2,
    height: 18,
    color: primaryColor,
  });

  page.drawText('Description', {
    x: marginX + 12,
    y: tableHeaderY + 5,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const amountRightX = width - marginX - 12;
  const amountHeaderText = `Amount (${currencyCode})`;
  const amountHeaderWidth = fontBold.widthOfTextAtSize(amountHeaderText, 9);
  page.drawText(amountHeaderText, {
    x: amountRightX - amountHeaderWidth,
    y: tableHeaderY + 5,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  let rowY = tableHeaderY - 20;

  const dueMatch = repair.notes?.match(/\[PROMISED_DUE:(\d{4}-\d{2}-\d{2})\]/);
  const promisedDueDate = dueMatch ? dueMatch[1] : null;
  const isOutflow = repair.status === 'delivered' && repair.balance > 0;

  // Financial Rows definition
  const financialRows = [
    { label: 'Total Estimate Charges', amount: repair.estimate, isNegative: false },
    { label: 'Less: Paid Advance / Collected', amount: repair.advance, isNegative: true },
    { 
      label: isOutflow ? `OUTFLOW BALANCE REMAINING (Due: ${promisedDueDate || 'As Promised'})` : 'Final Outstanding Balance', 
      amount: repair.balance, 
      isNegative: false, 
      isTotal: true 
    },
  ];

  financialRows.forEach((row, index) => {
    // Zebra striping
    if (index % 2 === 1) {
      page.drawRectangle({
        x: marginX,
        y: rowY,
        width: width - marginX * 2,
        height: 20,
        color: lightBgColor,
      });
    }

    // Border line between rows
    page.drawLine({
      start: { x: marginX, y: rowY },
      end: { x: width - marginX, y: rowY },
      thickness: 0.5,
      color: borderLight,
    });

    const isTotal = row.isTotal;
    const fontToUse = isTotal ? fontBold : font;
    const colorToUse = isTotal ? accentGreen : primaryColor;

    page.drawText(row.label, {
      x: marginX + 12,
      y: rowY + 6,
      size: 9,
      font: fontToUse,
      color: isTotal ? primaryColor : secondaryColor,
      maxWidth: amountRightX - (marginX + 12) - 90,
    });

    // Right-aligned amount value under the Amount header
    const signStr = row.isNegative ? '- ' : '';
    const numStr = `${signStr}${row.amount.toFixed(2)}`;
    const numWidth = fontToUse.widthOfTextAtSize(numStr, 9);
    const numX = amountRightX - numWidth;

    if (useVectorRupee) {
      drawRupee(page, numX - 13, rowY + 5, 9, colorToUse);
      page.drawText(numStr, {
        x: numX,
        y: rowY + 6,
        size: 9,
        font: fontToUse,
        color: colorToUse,
      });
    } else {
      const symWidth = fontToUse.widthOfTextAtSize(currencySymbol, 9);
      page.drawText(currencySymbol, {
        x: numX - symWidth - 4,
        y: rowY + 6,
        size: 9,
        font: fontToUse,
        color: colorToUse,
      });
      page.drawText(numStr, {
        x: numX,
        y: rowY + 6,
        size: 9,
        font: fontToUse,
        color: colorToUse,
      });
    }

    rowY -= 20;
  });

  cursorY = rowY - 15;

  // 5. Notes / Terms (if any) — internal [PROMISED_DUE:...] marker is stripped before display
  const cleanNotes = (repair.notes || '').replace(/\[PROMISED_DUE:\d{4}-\d{2}-\d{2}\]/g, '').trim();
  if (cleanNotes) {
    const notesLines = wrapText(cleanNotes, font, 9, width - marginX * 2);
    page.drawText('Notes / Remarks:', { x: marginX, y: cursorY, size: 9, font: fontBold, color: secondaryColor });
    notesLines.forEach((line, i) => {
      page.drawText(line, {
        x: marginX,
        y: cursorY - 14 - i * 12,
        size: 9,
        font,
        color: primaryColor,
      });
    });
    cursorY -= (14 + notesLines.length * 12 + 10);
  }

  // 6. Signature and Receiver info panel
  cursorY -= 20;
  const signSectionHeight = 110;
  const signSectionY = cursorY - signSectionHeight;

  // Draw hand-off information
  page.drawText('HAND-OFF DETAILS', {
    x: marginX,
    y: cursorY,
    size: 9,
    font: fontBold,
    color: secondaryColor,
  });

  const detailsY = cursorY - 20;
  page.drawText(`Receiver Name: ${repair.receiver_name || 'N/A'}`, {
    x: marginX,
    y: detailsY,
    size: 10,
    font: fontBold,
    color: primaryColor,
  });
  page.drawText(`Receiver Phone: ${repair.receiver_phone || 'N/A'}`, {
    x: marginX,
    y: detailsY - 14,
    size: 9,
    font,
    color: primaryColor,
  });
  page.drawText(`Delivered By: ${repair.delivered_by || 'System Admin'}`, {
    x: marginX,
    y: detailsY - 28,
    size: 9,
    font,
    color: secondaryColor,
  });

  // Embed signature image if it exists (PNG/JPG, aspect-ratio safe)
  let signatureImage: PDFImage | null = null;
  if (repair.signature_url) {
    try {
      const response = await fetch(repair.signature_url);
      if (response && response.ok) {
        const sigBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || '';
        signatureImage = await embedFlexibleImage(pdfDoc, sigBuffer, contentType);
      }
    } catch (err) {
      console.error('Failed to embed signature image:', err);
    }
  }

  const sigBoxWidth = 140;
  const sigBoxHeight = 70;
  const sigBoxX = width - marginX - sigBoxWidth;
  const sigBoxY = signSectionY + 10;

  // Draw Signature box boundary
  page.drawRectangle({
    x: sigBoxX,
    y: sigBoxY,
    width: sigBoxWidth,
    height: sigBoxHeight,
    borderColor: borderLight,
    borderWidth: 1,
  });

  if (signatureImage) {
    // Draw signature centered inside the frame preserving its aspect ratio
    const fitted = fitImageInBox(signatureImage, sigBoxWidth - 10, sigBoxHeight - 10);
    page.drawImage(signatureImage, {
      x: sigBoxX + (sigBoxWidth - fitted.width) / 2,
      y: sigBoxY + (sigBoxHeight - fitted.height) / 2,
      width: fitted.width,
      height: fitted.height,
    });
  } else {
    // Draw sign-here line indicator
    page.drawLine({
      start: { x: sigBoxX + 15, y: sigBoxY + 20 },
      end: { x: sigBoxX + sigBoxWidth - 15, y: sigBoxY + 20 },
      thickness: 1,
      color: secondaryColor,
    });
    page.drawText('Customer Signature', {
      x: sigBoxX + 25,
      y: sigBoxY + 8,
      size: 8,
      font,
      color: secondaryColor,
    });
  }

  page.drawText('Signature of Recipient', {
    x: sigBoxX,
    y: sigBoxY + sigBoxHeight + 5,
    size: 9,
    font: fontBold,
    color: secondaryColor,
  });

  cursorY = signSectionY - 30;

  // 7. Footer
  const footerDividerY = cursorY;
  page.drawLine({
    start: { x: marginX, y: footerDividerY },
    end: { x: width - marginX, y: footerDividerY },
    thickness: 1,
    color: borderLight,
  });

  const footerText = 'Thank you for your business!';
  const footerTextWidth = fontBold.widthOfTextAtSize(footerText, 11);
  page.drawText(footerText, {
    x: (width - footerTextWidth) / 2,
    y: footerDividerY - 20,
    size: 11,
    font: fontBold,
    color: primaryColor,
  });

  const subFooterText = `If you have any questions or feedback, please reach us at ${shop.phone || 'our support helpline'}.`;
  const subFooterWidth = font.widthOfTextAtSize(subFooterText, 8);
  page.drawText(subFooterText, {
    x: (width - subFooterWidth) / 2,
    y: footerDividerY - 34,
    size: 8,
    font,
    color: secondaryColor,
  });

  // Save and return binary array
  return await pdfDoc.save();
}
