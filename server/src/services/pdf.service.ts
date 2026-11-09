import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  placeOfSupply?: string | null;
  isInterState: boolean;
  notes?: string | null;

  // Financial totals
  subtotal: number | string;
  discountTotal: number | string;
  taxableAmount: number | string;
  cgstTotal: number | string;
  sgstTotal: number | string;
  igstTotal: number | string;
  taxTotal: number | string;
  grandTotal: number | string;
  totalPaid?: number | string;
  balanceRemaining?: number | string;
  paymentStatus?: string;

  // Business snapshots
  business: {
    name: string;
    address: string;
    phone: string;
    email: string;
    gstin?: string | null;
    state?: string | null;
    logoUrl?: string | null;
  };

  // Customer snapshots
  customer: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address: string;
    gstin?: string | null;
    state?: string | null;
  };

  // Items
  items: Array<{
    description: string;
    unit?: string;
    quantity: number | string;
    unitPrice: number | string;
    discountAmount: number | string;
    taxableAmount: number | string;
    taxRate: number | string;
    cgstAmount?: number | string;
    sgstAmount?: number | string;
    igstAmount?: number | string;
    taxAmount: number | string;
    lineTotal: number | string;
  }>;

  // Payments
  payments?: Array<{
    amount: number | string;
    paymentDate: string;
    method: string;
    reference?: string | null;
  }>;
}

function formatINR(val: number | string | undefined): string {
  const num = typeof val === 'number' ? val : parseFloat(String(val || '0'));
  return 'INR ' + (isNaN(num) ? '0.00' : num.toFixed(2));
}

/**
 * Generates an A4 PDF Stream for an invoice
 */
export function generateInvoicePdfStream(invoice: InvoicePdfData): NodeJS.ReadableStream {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 36, bottom: 50, left: 36, right: 36 },
    bufferPages: true,
  });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2; // 523.28 pt

  // Colors
  const primaryColor = '#0f172a'; // Navy 900
  const brandTeal = '#0d9488'; // Teal 600
  const textColor = '#334155'; // Slate 700
  const mutedText = '#64748b'; // Slate 500
  const borderColor = '#cbd5e1'; // Slate 300
  const tableHeaderBg = '#f1f5f9'; // Slate 100

  // 1. Top Brand Banner / Header
  doc.rect(margin, margin, contentWidth, 4).fill(brandTeal);

  let currentY = margin + 12;

  // Header Title & Business Details
  doc.fillColor(primaryColor).fontSize(18).font('Helvetica-Bold').text(invoice.business.name, margin, currentY);
  
  // Right header: TAX INVOICE
  doc.fontSize(16).fillColor(brandTeal).text('TAX INVOICE', margin, currentY, {
    align: 'right',
    width: contentWidth,
  });

  currentY += 22;

  // Business metadata on left
  doc.fontSize(8.5).font('Helvetica').fillColor(textColor);
  const busLines = [
    invoice.business.address,
    `Phone: ${invoice.business.phone}  |  Email: ${invoice.business.email}`,
    invoice.business.gstin ? `GSTIN: ${invoice.business.gstin}` : null,
    invoice.business.state ? `State: ${invoice.business.state}` : null,
  ].filter(Boolean) as string[];

  doc.text(busLines.join('\n'), margin, currentY, { width: 300, lineGap: 2 });

  // Invoice Meta Box on right
  const metaBoxWidth = 190;
  const metaBoxX = pageWidth - margin - metaBoxWidth;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, metaBoxX, currentY, { align: 'right', width: metaBoxWidth });
  doc.font('Helvetica').fontSize(8.5).fillColor(textColor);
  doc.text(`Date: ${invoice.invoiceDate}`, metaBoxX, currentY + 14, { align: 'right', width: metaBoxWidth });
  doc.text(`Due Date: ${invoice.dueDate}`, metaBoxX, currentY + 26, { align: 'right', width: metaBoxWidth });
  doc.text(`Place of Supply: ${invoice.placeOfSupply || 'Karnataka'}`, metaBoxX, currentY + 38, { align: 'right', width: metaBoxWidth });
  doc.text(
    `Supply Type: ${invoice.isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}`,
    metaBoxX,
    currentY + 50,
    { align: 'right', width: metaBoxWidth }
  );

  currentY += 68;

  // Divider line
  doc.strokeColor(borderColor).lineWidth(0.75).moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).stroke();
  currentY += 10;

  // 2. Bill To & Customer Info Box
  doc.roundedRect(margin, currentY, contentWidth, 54, 4).fillAndStroke('#f8fafc', borderColor);
  
  doc.fillColor(mutedText).fontSize(7.5).font('Helvetica-Bold').text('BILLED TO (CUSTOMER DETAILS)', margin + 10, currentY + 8);
  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text(invoice.customer.name, margin + 10, currentY + 19);

  const custDetails = [
    invoice.customer.address,
    invoice.customer.phone ? `Phone: ${invoice.customer.phone}` : null,
    invoice.customer.email ? `Email: ${invoice.customer.email}` : null,
  ].filter(Boolean).join('  |  ');
  doc.fillColor(textColor).fontSize(8).font('Helvetica').text(custDetails, margin + 10, currentY + 33, { width: 330 });

  // Customer GSTIN & State on right
  if (invoice.customer.gstin || invoice.customer.state) {
    const custGst = [
      invoice.customer.gstin ? `Customer GSTIN: ${invoice.customer.gstin}` : null,
      invoice.customer.state ? `State: ${invoice.customer.state}` : null,
    ].filter(Boolean).join('\n');
    doc.fillColor(textColor).fontSize(8).font('Helvetica').text(custGst, metaBoxX, currentY + 19, { align: 'right', width: metaBoxWidth });
  }

  currentY += 66;

  // 3. Itemized Products & Services Table
  const tableX = margin;
  const colWidths = {
    sno: 25,
    desc: 175,
    qty: 40,
    price: 55,
    disc: 45,
    taxable: 55,
    tax: 60,
    total: 68,
  };

  const drawTableHeader = (y: number) => {
    doc.rect(tableX, y, contentWidth, 18).fill(tableHeaderBg);
    doc.strokeColor(borderColor).lineWidth(0.5).rect(tableX, y, contentWidth, 18).stroke();

    doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica-Bold');
    let x = tableX;
    doc.text('#', x + 4, y + 5, { width: colWidths.sno, align: 'center' });
    x += colWidths.sno;
    doc.text('Item Description', x + 4, y + 5, { width: colWidths.desc, align: 'left' });
    x += colWidths.desc;
    doc.text('Qty', x, y + 5, { width: colWidths.qty, align: 'right' });
    x += colWidths.qty;
    doc.text('Rate', x, y + 5, { width: colWidths.price, align: 'right' });
    x += colWidths.price;
    doc.text('Disc', x, y + 5, { width: colWidths.disc, align: 'right' });
    x += colWidths.disc;
    doc.text('Taxable', x, y + 5, { width: colWidths.taxable, align: 'right' });
    x += colWidths.taxable;
    doc.text(invoice.isInterState ? 'IGST' : 'CGST+SGST', x, y + 5, { width: colWidths.tax, align: 'right' });
    x += colWidths.tax;
    doc.text('Total (INR)', x - 4, y + 5, { width: colWidths.total, align: 'right' });
  };

  drawTableHeader(currentY);
  currentY += 18;

  // Draw Items
  invoice.items.forEach((item, index) => {
    // Check if new page is needed
    if (currentY > pageHeight - 160) {
      doc.addPage();
      currentY = margin;
      drawTableHeader(currentY);
      currentY += 18;
    }

    const rowHeight = 20;
    const isEven = index % 2 === 1;
    if (isEven) {
      doc.rect(tableX, currentY, contentWidth, rowHeight).fill('#fbfcfd');
    }
    doc.strokeColor(borderColor).lineWidth(0.5).rect(tableX, currentY, contentWidth, rowHeight).stroke();

    doc.fillColor(textColor).fontSize(7.5).font('Helvetica');
    let x = tableX;

    // S.No
    doc.text(String(index + 1), x + 4, currentY + 5, { width: colWidths.sno, align: 'center' });
    x += colWidths.sno;

    // Description & Unit
    const itemDesc = item.unit ? `${item.description} (${item.unit})` : item.description;
    doc.font('Helvetica-Bold').fillColor(primaryColor).text(itemDesc, x + 4, currentY + 5, {
      width: colWidths.desc - 6,
      ellipsis: true,
    });
    doc.font('Helvetica').fillColor(textColor);
    x += colWidths.desc;

    // Qty
    doc.text(String(item.quantity), x, currentY + 5, { width: colWidths.qty, align: 'right' });
    x += colWidths.qty;

    // Price
    doc.text(formatINR(item.unitPrice).replace('INR ', ''), x, currentY + 5, { width: colWidths.price, align: 'right' });
    x += colWidths.price;

    // Discount
    const discNum = parseFloat(String(item.discountAmount || '0'));
    doc.text(discNum > 0 ? `-${discNum.toFixed(2)}` : '0.00', x, currentY + 5, { width: colWidths.disc, align: 'right' });
    x += colWidths.disc;

    // Taxable
    doc.text(formatINR(item.taxableAmount).replace('INR ', ''), x, currentY + 5, { width: colWidths.taxable, align: 'right' });
    x += colWidths.taxable;

    // Tax
    const taxLabel = `${formatINR(item.taxAmount).replace('INR ', '')} (${item.taxRate}%)`;
    doc.text(taxLabel, x, currentY + 5, { width: colWidths.tax, align: 'right' });
    x += colWidths.tax;

    // Line Total
    doc.font('Helvetica-Bold').fillColor(primaryColor).text(formatINR(item.lineTotal).replace('INR ', ''), x - 4, currentY + 5, {
      width: colWidths.total,
      align: 'right',
    });

    currentY += rowHeight;
  });

  currentY += 12;

  // Check if summary fits on page
  if (currentY > pageHeight - 160) {
    doc.addPage();
    currentY = margin;
  }

  // 4. Summary & Tax Breakdown Box (Right Aligned)
  const summaryBoxWidth = 230;
  const summaryBoxX = pageWidth - margin - summaryBoxWidth;
  const notesWidth = contentWidth - summaryBoxWidth - 16;

  // Notes & Payment terms on Left
  if (invoice.notes) {
    doc.fillColor(mutedText).fontSize(7.5).font('Helvetica-Bold').text('NOTES & TERMS', margin, currentY);
    doc.fillColor(textColor).fontSize(8).font('Helvetica').text(invoice.notes, margin, currentY + 12, {
      width: notesWidth,
      lineGap: 2,
    });
  }

  // Right Side Totals Card
  const summaryTop = currentY;
  doc.rect(summaryBoxX, summaryTop, summaryBoxWidth, 120).fillAndStroke('#f8fafc', borderColor);

  let sumY = summaryTop + 8;
  const renderSummaryRow = (label: string, value: string, isBold: boolean = false, isAccent: boolean = false) => {
    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isBold ? 9 : 8)
      .fillColor(isAccent ? brandTeal : isBold ? primaryColor : textColor);
    doc.text(label, summaryBoxX + 10, sumY, { width: 110, align: 'left' });
    doc.text(value, summaryBoxX + 120, sumY, { width: 100, align: 'right' });
    sumY += 13;
  };

  renderSummaryRow('Gross Subtotal:', formatINR(invoice.subtotal));
  const discTotalNum = parseFloat(String(invoice.discountTotal || '0'));
  if (discTotalNum > 0) {
    renderSummaryRow('Total Discounts:', `-${formatINR(invoice.discountTotal)}`);
  }
  renderSummaryRow('Taxable Value:', formatINR(invoice.taxableAmount));

  if (invoice.isInterState) {
    renderSummaryRow('IGST (Integrated Tax):', formatINR(invoice.igstTotal));
  } else {
    renderSummaryRow('CGST (Central Tax):', formatINR(invoice.cgstTotal));
    renderSummaryRow('SGST (State Tax):', formatINR(invoice.sgstTotal));
  }

  renderSummaryRow('Total Tax (GST):', formatINR(invoice.taxTotal));

  // Grand Total Highlight
  sumY += 2;
  doc.rect(summaryBoxX + 4, sumY - 2, summaryBoxWidth - 8, 20).fill(primaryColor);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#ffffff');
  doc.text('Grand Total:', summaryBoxX + 12, sumY + 3, { width: 100, align: 'left' });
  doc.text(formatINR(invoice.grandTotal), summaryBoxX + 110, sumY + 3, { width: 106, align: 'right' });

  currentY = Math.max(currentY + 130, sumY + 28);

  // 5. Payment Details Section (if any paid or payments recorded)
  if (invoice.payments && invoice.payments.length > 0) {
    if (currentY > pageHeight - 80) {
      doc.addPage();
      currentY = margin;
    }

    doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('Payment History & Balance Status', margin, currentY);
    currentY += 14;

    const payBox = `Total Paid: ${formatINR(invoice.totalPaid)}   |   Balance Due: ${formatINR(invoice.balanceRemaining)}   |   Payment Status: ${invoice.paymentStatus || 'UNPAID'}`;
    doc.roundedRect(margin, currentY, contentWidth, 22, 3).fillAndStroke('#f0fdf4', '#bbf7d0');
    doc.fillColor('#166534').fontSize(8).font('Helvetica-Bold').text(payBox, margin + 10, currentY + 6);
    currentY += 30;
  }

  // 6. Footer on all pages (inside page margins, zero phantom pages)
  const totalPages = doc.bufferedPageRange().count;
  const footerY = pageHeight - 40;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // Prevent PDFKit auto-page-break on this specific page

    doc.strokeColor(borderColor).lineWidth(0.5).moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).stroke();
    
    doc.fillColor(mutedText).fontSize(7.5).font('Helvetica');
    doc.text(
      'Thank you for your business. This is a computer-generated tax invoice generated via Viora Bills.',
      margin,
      footerY + 8,
      { align: 'left', width: 350, lineBreak: false }
    );
    doc.text(`Page ${i + 1} of ${totalPages}`, pageWidth - margin - 100, footerY + 8, {
      align: 'right',
      width: 100,
      lineBreak: false,
    });
  }

  doc.end();
  return doc;
}
