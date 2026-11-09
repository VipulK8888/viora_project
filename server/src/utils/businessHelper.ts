import { prisma } from '../config/prisma';

export async function getOrCreateDefaultBusiness() {
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
        nextInvoiceNumber: 1,
      },
    });
  }

  return business;
}
