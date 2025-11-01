-- Add defaultPphRate column to Settings for global PPh percentage
ALTER TABLE "Settings" ADD COLUMN "defaultPphRate" DOUBLE PRECISION NOT NULL DEFAULT 1.5;