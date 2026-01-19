import "dotenv/config";
import { migrateTransaccionesOrphanas, migrateVolqueterosFromViajes } from "./init-db";

async function run() {
  console.log("=== EJECUTANDO MIGRACIONES HISTÓRICAS ===");
  await migrateVolqueterosFromViajes();
  await migrateTransaccionesOrphanas();
  console.log("=== MIGRACIONES HISTÓRICAS FINALIZADAS ===");
}

run().catch((error) => {
  console.error("❌ Error ejecutando migraciones históricas:", error?.message || error);
  process.exit(1);
});
