import { Prisma } from '../generated/prisma-client';

export type DecimalLike = Prisma.Decimal | number | string;

export function toDecimal(val: DecimalLike): Prisma.Decimal {
  if (val instanceof Prisma.Decimal) return val;
  return new Prisma.Decimal(val || 0);
}

export function round2(dec: Prisma.Decimal): Prisma.Decimal {
  return dec.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export interface CalculatedLineItem {
  productId?: string | null;
  descriptionSnapshot: string;
  unit: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  grossAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  cgstRate: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstRate: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstRate: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

export interface CalculatedInvoiceTotals {
  subtotal: Prisma.Decimal; // Gross amount before discount
  discountTotal: Prisma.Decimal;
  taxableAmount: Prisma.Decimal; // Gross - Discount
  cgstTotal: Prisma.Decimal;
  sgstTotal: Prisma.Decimal;
  igstTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  items: CalculatedLineItem[];
}

export function calculateLineItem(
  input: {
    productId?: string | null;
    descriptionSnapshot: string;
    unit?: string;
    quantity: DecimalLike;
    unitPrice: DecimalLike;
    discountAmount?: DecimalLike;
    taxRate?: DecimalLike;
  },
  isInterState: boolean = false
): CalculatedLineItem {
  // Validate finite inputs
  const rawQty = Number(input.quantity);
  const rawPrice = Number(input.unitPrice);
  const rawDiscount = Number(input.discountAmount ?? 0);
  const rawTaxRate = Number(input.taxRate ?? 0);

  if (!Number.isFinite(rawQty) || !Number.isFinite(rawPrice) || !Number.isFinite(rawDiscount) || !Number.isFinite(rawTaxRate)) {
    throw new Error('All numeric values must be finite valid numbers');
  }

  // Quantity is not money: preserve fractional units with at least 4 decimal places without rounding to 2 decimals
  const qty = toDecimal(input.quantity).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  const price = round2(toDecimal(input.unitPrice));
  const discount = round2(toDecimal(input.discountAmount ?? 0));
  const taxRate = toDecimal(input.taxRate ?? 0);

  if (qty.lessThanOrEqualTo(0)) {
    throw new Error('Quantity must be greater than zero');
  }
  if (price.isNegative()) {
    throw new Error('Unit price cannot be negative');
  }
  if (discount.isNegative()) {
    throw new Error('Discount amount cannot be negative');
  }
  if (taxRate.isNegative() || taxRate.greaterThan(100)) {
    throw new Error('Tax rate must be between 0% and 100%');
  }

  // 1. Gross amount = quantity * unit price
  const grossAmount = round2(qty.times(price));

  // 2. Discount cannot exceed gross amount
  if (discount.greaterThan(grossAmount)) {
    throw new Error(`Discount amount (₹${discount.toString()}) cannot exceed gross amount (₹${grossAmount.toString()})`);
  }

  // 3. Taxable amount = gross amount - discount
  const taxableAmount = round2(grossAmount.minus(discount));

  // 4. Tax amount = taxable amount * tax rate / 100 (ROUND_HALF_UP to 2 decimal places)
  const taxAmount = round2(taxableAmount.times(taxRate.dividedBy(100)));

  // 5. Line total = taxable amount + tax amount
  const lineTotal = round2(taxableAmount.plus(taxAmount));

  // 6. GST Tax Split (Intra-state vs Inter-state)
  let cgstRate = new Prisma.Decimal(0);
  let cgstAmount = new Prisma.Decimal(0);
  let sgstRate = new Prisma.Decimal(0);
  let sgstAmount = new Prisma.Decimal(0);
  let igstRate = new Prisma.Decimal(0);
  let igstAmount = new Prisma.Decimal(0);

  if (isInterState) {
    // Inter-State supply: 100% IGST
    igstRate = taxRate;
    igstAmount = taxAmount;
  } else {
    // Intra-State supply: 50% CGST + 50% SGST
    cgstRate = round2(taxRate.dividedBy(2));
    sgstRate = round2(taxRate.minus(cgstRate));

    cgstAmount = round2(taxAmount.dividedBy(2));
    sgstAmount = round2(taxAmount.minus(cgstAmount)); // Guarantees cgstAmount + sgstAmount === taxAmount
  }

  return {
    productId: input.productId || null,
    descriptionSnapshot: (input.descriptionSnapshot || '').trim(),
    unit: (input.unit || 'PCS').trim().toUpperCase(),
    quantity: qty,
    unitPrice: price,
    discountAmount: discount,
    grossAmount,
    taxableAmount,
    taxRate,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    taxAmount,
    lineTotal,
  };
}

export function calculateInvoiceTotals(
  itemsInput: Array<{
    productId?: string | null;
    descriptionSnapshot: string;
    unit?: string;
    quantity: DecimalLike;
    unitPrice: DecimalLike;
    discountAmount?: DecimalLike;
    taxRate?: DecimalLike;
  }>,
  isInterState: boolean = false
): CalculatedInvoiceTotals {
  if (!itemsInput || itemsInput.length === 0) {
    throw new Error('Invoice must contain at least one item');
  }

  const calculatedItems = itemsInput.map((item) => calculateLineItem(item, isInterState));

  let subtotal = new Prisma.Decimal(0);
  let discountTotal = new Prisma.Decimal(0);
  let taxableAmountTotal = new Prisma.Decimal(0);
  let cgstTotal = new Prisma.Decimal(0);
  let sgstTotal = new Prisma.Decimal(0);
  let igstTotal = new Prisma.Decimal(0);
  let taxTotal = new Prisma.Decimal(0);
  let grandTotal = new Prisma.Decimal(0);

  for (const item of calculatedItems) {
    subtotal = subtotal.plus(item.grossAmount);
    discountTotal = discountTotal.plus(item.discountAmount);
    taxableAmountTotal = taxableAmountTotal.plus(item.taxableAmount);
    cgstTotal = cgstTotal.plus(item.cgstAmount);
    sgstTotal = sgstTotal.plus(item.sgstAmount);
    igstTotal = igstTotal.plus(item.igstAmount);
    taxTotal = taxTotal.plus(item.taxAmount);
    grandTotal = grandTotal.plus(item.lineTotal);
  }

  if (grandTotal.greaterThan(9999999999.99) || subtotal.greaterThan(9999999999.99)) {
    throw new Error('Invoice total amount exceeds maximum supported financial limit (₹9,999,999,999.99)');
  }

  return {
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    taxableAmount: round2(taxableAmountTotal),
    cgstTotal: round2(cgstTotal),
    sgstTotal: round2(sgstTotal),
    igstTotal: round2(igstTotal),
    taxTotal: round2(taxTotal),
    grandTotal: round2(grandTotal),
    items: calculatedItems,
  };
}

export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export function derivePaymentStatus(
  grandTotal: DecimalLike,
  payments: Array<{ amount: DecimalLike }>
): {
  paymentStatus: PaymentStatus;
  totalPaid: Prisma.Decimal;
  balanceRemaining: Prisma.Decimal;
} {
  const total = round2(toDecimal(grandTotal));
  let totalPaid = new Prisma.Decimal(0);

  for (const p of payments) {
    totalPaid = totalPaid.plus(toDecimal(p.amount));
  }
  totalPaid = round2(totalPaid);

  const balance = round2(total.minus(totalPaid));
  const balanceRemaining = balance.isNegative() ? new Prisma.Decimal(0) : balance;

  let paymentStatus: PaymentStatus = 'UNPAID';
  if (total.isZero()) {
    paymentStatus = 'PAID';
  } else if (totalPaid.greaterThanOrEqualTo(total)) {
    paymentStatus = 'PAID';
  } else if (totalPaid.greaterThan(0)) {
    paymentStatus = 'PARTIALLY_PAID';
  }

  return {
    paymentStatus,
    totalPaid,
    balanceRemaining,
  };
}
