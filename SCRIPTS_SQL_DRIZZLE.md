# Scripts SQL para Drizzle Console

Ejecuta estos scripts en Drizzle Console para crear la tabla y migrar los datos.

## Script 1: Crear Tabla y Migrar Datos

```sql
-- Crear la tabla rodmar_cuentas
CREATE TABLE IF NOT EXISTS "rodmar_cuentas" (
  "id" serial PRIMARY KEY NOT NULL,
  "nombre" text NOT NULL,
  "codigo" varchar(50) NOT NULL UNIQUE,
  "user_id" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Crear índice en el campo codigo
CREATE INDEX IF NOT EXISTS "idx_rodmar_cuentas_codigo" ON "rodmar_cuentas"("codigo");

-- Insertar las 6 cuentas existentes
INSERT INTO "rodmar_cuentas" ("nombre", "codigo", "user_id", "created_at", "updated_at")
VALUES
  ('Bemovil', 'BEMOVIL', NULL, now(), now()),
  ('Corresponsal', 'CORRESPONSAL', NULL, now(), now()),
  ('Efectivo', 'EFECTIVO', NULL, now(), now()),
  ('Cuentas German', 'CUENTAS_GERMAN', NULL, now(), now()),
  ('Cuentas Jhon', 'CUENTAS_JHON', NULL, now(), now()),
  ('Otros', 'OTROS', NULL, now(), now())
ON CONFLICT ("codigo") DO NOTHING;
```

## Script 2: Crear Permisos

```sql
-- Crear permisos para cada cuenta (usando códigos)
INSERT INTO "permissions" ("key", "descripcion", "categoria", "created_at")
SELECT 
  'module.RODMAR.account.BEMOVIL.view',
  'Ver cuenta RodMar: Bemovil',
  'account',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "key" = 'module.RODMAR.account.BEMOVIL.view'
);

INSERT INTO "permissions" ("key", "descripcion", "categoria", "created_at")
SELECT 
  'module.RODMAR.account.CORRESPONSAL.view',
  'Ver cuenta RodMar: Corresponsal',
  'account',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "key" = 'module.RODMAR.account.CORRESPONSAL.view'
);

INSERT INTO "permissions" ("key", "descripcion", "categoria", "created_at")
SELECT 
  'module.RODMAR.account.EFECTIVO.view',
  'Ver cuenta RodMar: Efectivo',
  'account',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "key" = 'module.RODMAR.account.EFECTIVO.view'
);

INSERT INTO "permissions" ("key", "descripcion", "categoria", "created_at")
SELECT 
  'module.RODMAR.account.CUENTAS_GERMAN.view',
  'Ver cuenta RodMar: Cuentas German',
  'account',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "key" = 'module.RODMAR.account.CUENTAS_GERMAN.view'
);

INSERT INTO "permissions" ("key", "descripcion", "categoria", "created_at")
SELECT 
  'module.RODMAR.account.CUENTAS_JHON.view',
  'Ver cuenta RodMar: Cuentas Jhon',
  'account',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "key" = 'module.RODMAR.account.CUENTAS_JHON.view'
);

INSERT INTO "permissions" ("key", "descripcion", "categoria", "created_at")
SELECT 
  'module.RODMAR.account.OTROS.view',
  'Ver cuenta RodMar: Otros',
  'account',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "key" = 'module.RODMAR.account.OTROS.view'
);
```

## Script 3: Asignar Permisos al Rol ADMIN

```sql
-- Asignar todos los permisos al rol ADMIN (si existe)
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT 
  r.id,
  p.id,
  now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.nombre = 'ADMIN'
  AND p.key LIKE 'module.RODMAR.account.%'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
```

## Verificación

Después de ejecutar los scripts, verifica que todo se creó correctamente:

```sql
-- Verificar cuentas creadas
SELECT * FROM "rodmar_cuentas" ORDER BY "id";

-- Verificar permisos creados
SELECT * FROM "permissions" WHERE "key" LIKE 'module.RODMAR.account.%' ORDER BY "key";

-- Verificar asignaciones al ADMIN
SELECT 
  r.nombre as rol,
  p.key as permiso,
  p.descripcion
FROM "role_permissions" rp
JOIN "roles" r ON rp.role_id = r.id
JOIN "permissions" p ON rp.permission_id = p.id
WHERE r.nombre = 'ADMIN'
  AND p.key LIKE 'module.RODMAR.account.%'
ORDER BY p.key;
```

## Notas Importantes

1. **Ejecuta los scripts en orden**: Primero Script 1, luego Script 2, luego Script 3
2. **Los permisos antiguos** (que usan nombres) seguirán funcionando durante la transición
3. **Las transacciones existentes** pueden usar slugs ("bemovil") o IDs numéricos ("1") - ambos son soportados
4. **Si algo falla**, puedes ejecutar los scripts individualmente o usar el script TypeScript: `npx tsx server/migrate-rodmar-cuentas.ts`



