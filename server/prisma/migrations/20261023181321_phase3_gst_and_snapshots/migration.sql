-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "state" TEXT DEFAULT 'Karnataka';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "state" TEXT DEFAULT 'Karnataka';

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "cgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "sgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'PCS',
ADD COLUMN     "unitSnapshot" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "businessStateSnapshot" TEXT,
ADD COLUMN     "cgstTotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "customerStateSnapshot" TEXT,
ADD COLUMN     "igstTotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "isInterState" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placeOfSupply" TEXT DEFAULT 'Karnataka',
ADD COLUMN     "sgstTotal" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "taxableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00;
