import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
    staff_id: string | null;
    device: {
      brand: string;
      model: string;
      imei: string | null;
      problem: string;
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
  };
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
  const borderLight = rgb(0.89, 0.91, 0.94); // slate-200

  // Margins & Dimensions
  const marginX = 40;
  let cursorY = height - 40;

  // 1. Fetch and Embed Logo if available
  let logoImage: any = null;
  if (shop.logo_url) {
    try {
      const response = await fetch(shop.logo_url);
      if (response && response.ok) {
        const logoBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('image/png')) {
          logoImage = await pdfDoc.embedPng(logoBuffer);
        } else {
          logoImage = await pdfDoc.embedJpg(logoBuffer);
        }
      }
    } catch (err) {
      console.error('Failed to embed logo image:', err);
    }
  }

  // Draw Logo or Shop Initials Block
  const logoSize = 64;
  if (logoImage) {
    page.drawImage(logoImage, {
      x: marginX,
      y: cursorY - logoSize,
      width: logoSize,
      height: logoSize,
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

  // Draw Shop Info next to logo
  const infoX = marginX + logoSize + 15;
  page.drawText(shop.name, {
    x: infoX,
    y: cursorY - 20,
    size: 16,
    font: fontBold,
    color: primaryColor,
  });

  page.drawText(shop.address || 'Address not specified', {
    x: infoX,
    y: cursorY - 36,
    size: 9,
    font,
    color: secondaryColor,
  });

  page.drawText(`Phone: ${shop.phone || 'N/A'}`, {
    x: infoX,
    y: cursorY - 50,
    size: 9,
    font,
    color: secondaryColor,
  });

  // Draw Document Title on the right side
  page.drawText('REPAIR RECEIPT', {
    x: width - marginX - 140,
    y: cursorY - 20,
    size: 14,
    font: fontBold,
    color: primaryColor,
  });

  page.drawText(`Job No: ${repair.job_number}`, {
    x: width - marginX - 140,
    y: cursorY - 36,
    size: 10,
    font: fontBold,
    color: secondaryColor,
  });

  // DELIVERED status badge
  page.drawRectangle({
    x: width - marginX - 140,
    y: cursorY - 60,
    width: 110,
    height: 18,
    color: accentGreen,
    opacity: 0.1,
  });

  page.drawText('DELIVERED [OK]', {
    x: width - marginX - 125,
    y: cursorY - 54,
    size: 10,
    font: fontBold,
    color: accentGreen,
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

  // 2. Dates section (Created, Expected Delivery, Delivered At)
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  };
  const formatDateOnly = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' });
  };

  page.drawText('Receipt Dates:', { x: marginX, y: cursorY, size: 9, font: fontBold, color: secondaryColor });
  
  const datesRowY = cursorY - 14;
  page.drawText(`Booked: ${formatDateOnly(repair.created_at)}`, {
    x: marginX,
    y: datesRowY,
    size: 9,
    font,
    color: primaryColor,
  });

  const deliveryDateLabel = repair.delivered_at ? 'Delivery Date' : 'Expected Delivery';
  const deliveryDateValue = repair.delivered_at
    ? formatDateTime(repair.delivered_at)
    : formatDateOnly(repair.delivery_date);

  page.drawText(`${deliveryDateLabel}: ${deliveryDateValue}`, {
    x: marginX + 170,
    y: datesRowY,
    size: 9,
    font,
    color: primaryColor,
  });

  page.drawText(`Delivered: ${formatDateTime(repair.delivered_at)}`, {
    x: marginX + 340,
    y: datesRowY,
    size: 9,
    font: fontBold,
    color: accentGreen,
  });

  cursorY -= 35;

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

  page.drawText('Amount (INR)', {
    x: width - marginX - 100,
    y: tableHeaderY + 5,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  let rowY = tableHeaderY - 20;

  // Financial Rows definition
  const financialRows = [
    { label: 'Total Estimate Charges', amount: repair.estimate, isNegative: false },
    { label: 'Less: Advance Paid', amount: repair.advance, isNegative: true },
    { label: 'Balance Due / Paid at Hand-off', amount: repair.balance, isNegative: false, isTotal: true },
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
    });

    // Sign/Signifier
    const signStr = row.isNegative ? '-' : '';
    const numStr = `${signStr} ${row.amount.toFixed(2)}`;

    // Draw Rupee symbol manually
    const rupeeX = width - marginX - 100;
    
    drawRupee(page, rupeeX, rowY + 5, 9, colorToUse);
    
    // Draw amount text
    page.drawText(numStr, {
      x: rupeeX + 12,
      y: rowY + 6,
      size: 9,
      font: fontToUse,
      color: colorToUse,
    });

    rowY -= 20;
  });

  cursorY = rowY - 15;

  // 5. Notes / Terms (if any)
  if (repair.notes) {
    page.drawText('Notes / Remarks:', { x: marginX, y: cursorY, size: 9, font: fontBold, color: secondaryColor });
    page.drawText(repair.notes, {
      x: marginX,
      y: cursorY - 14,
      size: 9,
      font,
      color: primaryColor,
      maxWidth: width - marginX * 2,
      lineHeight: 12,
    });
    cursorY -= 40;
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
  page.drawText(`Delivered By Staff ID: ${repair.staff_id ? 'GK Registered Staff' : 'System Admin'}`, {
    x: marginX,
    y: detailsY - 28,
    size: 9,
    font,
    color: secondaryColor,
  });

  // Embed signature image if it exists
  let signatureImage: any = null;
  if (repair.signature_url) {
    try {
      const response = await fetch(repair.signature_url);
      if (response && response.ok) {
        const sigBuffer = await response.arrayBuffer();
        signatureImage = await pdfDoc.embedPng(sigBuffer);
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
    // Draw signature centered inside the signature frame
    page.drawImage(signatureImage, {
      x: sigBoxX + 5,
      y: sigBoxY + 5,
      width: sigBoxWidth - 10,
      height: sigBoxHeight - 10,
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
