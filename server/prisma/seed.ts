import { prisma } from '../src/config/prisma';
import { calculateInvoiceTotals, toDecimal } from '../src/utils/money';

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Business Profile
  let business = await prisma.business.findFirst();
  if (!business) {
    business = await prisma.business.create({
      data: {
        name: 'Viora Tech Solutions',
        logoUrl: '/favicon.svg',
        address: '102 Innovation Hub, Tech City, Bengaluru, Karnataka - 560100',
        phone: '+91 98765 43210',
        email: 'billing@vioratech.com',
        gstin: '29ABCDE1234F1Z5',
        invoicePrefix: 'INV',
        nextInvoiceNumber: 1001,
      },
    });
  }

  // 2. Customers
  const customerCount = await prisma.customer.count({ where: { businessId: business.id } });
  let customer1, customer2, customer3;

  if (customerCount === 0) {
    customer1 = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'Acme Technologies Pvt Ltd',
        phone: '+91 98111 22233',
        email: 'billing@acmetech.in',
        billingAddress: '42 Cyber City, DLF Phase 2, Gurugram, Haryana - 122002',
        state: 'Haryana',
        gstin: '06AAACA1234A1Z5',
      },
    });

    customer2 = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'NexGen Digital Solutions',
        phone: '+91 98222 33344',
        email: 'accounts@nexgendigital.com',
        billingAddress: '15 High Tech Park, Hinjewadi Phase 1, Pune, Maharashtra - 411057',
        state: 'Maharashtra',
        gstin: '27AABCN5678B1Z2',
      },
    });

    customer3 = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'Horizon Global Logistics',
        phone: '+91 98333 44455',
        email: 'finance@horizonglobal.com',
        billingAddress: '88 Harbour View Road, Fort, Mumbai, Maharashtra - 400001',
        state: 'Maharashtra',
        gstin: '27AABCH9012C1Z8',
      },
    });
  } else {
    const list = await prisma.customer.findMany({ where: { businessId: business.id } });
    customer1 = list[0];
    customer2 = list[1] || list[0];
    customer3 = list[2] || list[0];
  }

  // 3. Products
  const productCount = await prisma.product.count({ where: { businessId: business.id } });
  let prod1, prod2, prod3;

  if (productCount === 0) {
    prod1 = await prisma.product.create({
      data: {
        businessId: business.id,
        name: 'Enterprise Cloud Billing Suite',
        description: 'Multi-tenant cloud invoicing and automated billing platform subscription',
        unit: 'MONTH',
        unitPrice: toDecimal(45000),
        taxRate: toDecimal(18),
        isActive: true,
      },
    });

    prod2 = await prisma.product.create({
      data: {
        businessId: business.id,
        name: 'Technical Architecture & Setup',
        description: 'Dedicated infrastructure engineering and database deployment services',
        unit: 'HRS',
        unitPrice: toDecimal(2500),
        taxRate: toDecimal(18),
        isActive: true,
      },
    });

    prod3 = await prisma.product.create({
      data: {
        businessId: business.id,
        name: 'Annual Software Support & SLA',
        description: '24/7 priority support and regulatory compliance updates',
        unit: 'YR',
        unitPrice: toDecimal(60000),
        taxRate: toDecimal(18),
        isActive: true,
      },
    });
  } else {
    const list = await prisma.product.findMany({ where: { businessId: business.id } });
    prod1 = list[0];
    prod2 = list[1] || list[0];
    prod3 = list[2] || list[0];
  }

  // 4. Initial Invoices
  const invoiceCount = await prisma.invoice.count({ where: { businessId: business.id } });

  if (invoiceCount === 0 && customer1 && prod1) {
    // Issued Invoice
    const calc1 = calculateInvoiceTotals([
      {
        productId: prod1.id,
        descriptionSnapshot: prod1.name,
        quantity: 2,
        unitPrice: prod1.unitPrice,
        discountAmount: 5000,
        taxRate: prod1.taxRate,
      },
      {
        productId: prod2.id,
        descriptionSnapshot: '10 Hours Solution Engineering',
        quantity: 10,
        unitPrice: prod2.unitPrice,
        discountAmount: 0,
        taxRate: prod2.taxRate,
      },
    ]);

    const inv1 = await prisma.invoice.create({
      data: {
        businessId: business.id,
        customerId: customer1.id,
        invoiceNumber: 'INV-2026-001001',
        placeOfSupply: 'Haryana',
        isInterState: true,
        invoiceDate: new Date('2025-10-15'),
        dueDate: new Date('2025-10-30'),
        status: 'ISSUED',
        subtotal: calc1.subtotal,
        discountTotal: calc1.discountTotal,
        taxTotal: calc1.taxTotal,
        grandTotal: calc1.grandTotal,
        notes: 'Thank you for your business. Payment terms net 15 days.',
        customerNameSnapshot: customer1.name,
        customerPhoneSnapshot: customer1.phone,
        customerEmailSnapshot: customer1.email,
        customerAddressSnapshot: customer1.billingAddress,
        customerGstinSnapshot: customer1.gstin,
        businessNameSnapshot: business.name,
        businessAddressSnapshot: business.address,
        businessPhoneSnapshot: business.phone,
        businessEmailSnapshot: business.email,
        businessGstinSnapshot: business.gstin,
        items: {
          create: calc1.items.map((it) => ({
            productId: it.productId,
            descriptionSnapshot: it.descriptionSnapshot,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountAmount: it.discountAmount,
            taxRate: it.taxRate,
            taxableAmount: it.taxableAmount,
            taxAmount: it.taxAmount,
            lineTotal: it.lineTotal,
          })),
        },
      },
    });

    // Record partial payment on inv1
    await prisma.payment.create({
      data: {
        invoiceId: inv1.id,
        amount: toDecimal(50000),
        paymentDate: new Date('2025-10-18'),
        method: 'BANK_TRANSFER',
        reference: 'NEFT-AXIS-991283',
        requestKey: `PAY-REQ-${inv1.id}-001`,
      },
    });

    // Draft Invoice
    const calc2 = calculateInvoiceTotals([
      {
        productId: prod3.id,
        descriptionSnapshot: prod3.name,
        quantity: 1,
        unitPrice: prod3.unitPrice,
        discountAmount: 0,
        taxRate: prod3.taxRate,
      },
    ]);

    await prisma.invoice.create({
      data: {
        businessId: business.id,
        customerId: customer2.id,
        invoiceNumber: 'DRAFT-000102',
        invoiceDate: new Date('2025-10-22'),
        dueDate: new Date('2025-11-06'),
        status: 'DRAFT',
        subtotal: calc2.subtotal,
        discountTotal: calc2.discountTotal,
        taxTotal: calc2.taxTotal,
        grandTotal: calc2.grandTotal,
        notes: 'Draft awaiting customer purchase order confirmation.',
        customerNameSnapshot: customer2.name,
        customerPhoneSnapshot: customer2.phone,
        customerEmailSnapshot: customer2.email,
        customerAddressSnapshot: customer2.billingAddress,
        customerGstinSnapshot: customer2.gstin,
        businessNameSnapshot: business.name,
        businessAddressSnapshot: business.address,
        businessPhoneSnapshot: business.phone,
        businessEmailSnapshot: business.email,
        businessGstinSnapshot: business.gstin,
        items: {
          create: calc2.items.map((it) => ({
            productId: it.productId,
            descriptionSnapshot: it.descriptionSnapshot,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountAmount: it.discountAmount,
            taxRate: it.taxRate,
            taxableAmount: it.taxableAmount,
            taxAmount: it.taxAmount,
            lineTotal: it.lineTotal,
          })),
        },
      },
    });

    // Update business sequence
    await prisma.business.update({
      where: { id: business.id },
      data: { nextInvoiceNumber: 1002 },
    });
  }

  console.log('✅ Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
