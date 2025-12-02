CREATE TABLE "compradores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"saldo" numeric(15, 2) DEFAULT '0',
	"balance_calculado" numeric(15, 2) DEFAULT '0',
	"user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fusion_backups" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo_entidad" varchar(20) NOT NULL,
	"origen_id" integer NOT NULL,
	"destino_id" integer NOT NULL,
	"origen_nombre" varchar(255) NOT NULL,
	"destino_nombre" varchar(255) NOT NULL,
	"datos_originales" jsonb NOT NULL,
	"transacciones_afectadas" jsonb NOT NULL,
	"viajes_afectados" jsonb NOT NULL,
	"fecha_fusion" timestamp DEFAULT now(),
	"revertida" boolean DEFAULT false,
	"fecha_reversion" timestamp,
	"user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "inversiones" (
	"id" serial PRIMARY KEY NOT NULL,
	"concepto" text NOT NULL,
	"valor" numeric(15, 2) NOT NULL,
	"fecha" timestamp NOT NULL,
	"origen" text NOT NULL,
	"origen_detalle" text,
	"destino" text NOT NULL,
	"destino_detalle" text,
	"observaciones" text,
	"voucher" text,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "minas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"saldo" numeric(15, 2) DEFAULT '0',
	"balance_calculado" numeric(15, 2) DEFAULT '0',
	"balance_desactualizado" boolean DEFAULT false NOT NULL,
	"ultimo_recalculo" timestamp DEFAULT now(),
	"user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transacciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"de_quien_tipo" text,
	"de_quien_id" text,
	"para_quien_tipo" text,
	"para_quien_id" text,
	"postobon_cuenta" text,
	"concepto" text NOT NULL,
	"valor" numeric(15, 2) NOT NULL,
	"fecha" timestamp NOT NULL,
	"hora_interna" timestamp DEFAULT now() NOT NULL,
	"forma_pago" text NOT NULL,
	"voucher" text,
	"comentario" text,
	"tipo_transaccion" text DEFAULT 'manual',
	"oculta" boolean DEFAULT false NOT NULL,
	"oculta_en_comprador" boolean DEFAULT false NOT NULL,
	"oculta_en_mina" boolean DEFAULT false NOT NULL,
	"oculta_en_volquetero" boolean DEFAULT false NOT NULL,
	"oculta_en_general" boolean DEFAULT false NOT NULL,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"tipo_socio" text,
	"socio_id" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "viajes" (
	"id" text PRIMARY KEY NOT NULL,
	"fecha_cargue" timestamp NOT NULL,
	"fecha_descargue" timestamp,
	"conductor" text NOT NULL,
	"tipo_carro" text NOT NULL,
	"placa" text NOT NULL,
	"mina_id" integer,
	"comprador_id" integer,
	"peso" numeric(8, 2),
	"precio_compra_ton" numeric(10, 2) NOT NULL,
	"venta_ton" numeric(10, 2),
	"flete_ton" numeric(10, 2),
	"otros_gastos_flete" numeric(10, 2),
	"quien_paga_flete" text,
	"vut" numeric(10, 2),
	"cut" numeric(10, 2),
	"fut" numeric(10, 2),
	"total_venta" numeric(15, 2),
	"total_compra" numeric(15, 2),
	"total_flete" numeric(15, 2),
	"valor_consignar" numeric(15, 2),
	"ganancia" numeric(15, 2),
	"recibo" text,
	"observaciones" text,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"oculta" boolean DEFAULT false NOT NULL,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "volqueteros" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"placa" text NOT NULL,
	"saldo" numeric(15, 2) DEFAULT '0',
	"user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "compradores" ADD CONSTRAINT "compradores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fusion_backups" ADD CONSTRAINT "fusion_backups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inversiones" ADD CONSTRAINT "inversiones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "minas" ADD CONSTRAINT "minas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_mina_id_minas_id_fk" FOREIGN KEY ("mina_id") REFERENCES "public"."minas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_comprador_id_compradores_id_fk" FOREIGN KEY ("comprador_id") REFERENCES "public"."compradores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volqueteros" ADD CONSTRAINT "volqueteros_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");