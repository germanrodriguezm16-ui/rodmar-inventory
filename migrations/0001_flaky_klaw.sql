ALTER TABLE "compradores" ADD COLUMN "balance_desactualizado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "compradores" ADD COLUMN "ultimo_recalculo" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "volqueteros" ADD COLUMN "balance_calculado" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "volqueteros" ADD COLUMN "balance_desactualizado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "volqueteros" ADD COLUMN "ultimo_recalculo" timestamp DEFAULT now();