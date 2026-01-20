/**
 * Patch de emergencia para asegurar que la vista previa de imagen en cuentas RodMar
 * reciba `cuentaCodigo` y `cuentaIdentificadores` (y que estos incluyan slug numérico
 * e identificador inferido desde transacciones).
 *
 * Ejecutar desde la raíz del repo (donde existe la carpeta `client/`):
 *   node scripts/patch-rodmar-cuenta-image.cjs
 */
const fs = require("fs");

const FILE = "client/src/pages/rodmar-cuenta-detail.tsx";

function fail(msg) {
  console.error(`[patch-rodmar-cuenta-image] ${msg}`);
  process.exit(1);
}

let s;
try {
  s = fs.readFileSync(FILE, "utf8");
} catch (e) {
  fail(`No se pudo leer ${FILE}: ${e.message}`);
}

// 1) Insertar cuentaCodigoInferido si no existe
if (!s.includes("const cuentaCodigoInferido")) {
  const anchor = "const hiddenCuentaCount = getHiddenTransactionsCount();";
  const i = s.indexOf(anchor);
  if (i === -1) fail(`No se encontró el anchor: ${anchor}`);

  const insert = `

  // Inferir identificador real de la cuenta desde transacciones (id numérico o código)
  const cuentaCodigoInferido = useMemo(() => {
    const conteo = new Map<string, number>();
    const list = (allTransaccionesReales || []) as any[];
    for (const t of list) {
      if (t?.deQuienTipo === "rodmar" && t?.deQuienId) {
        const k = String(t.deQuienId);
        conteo.set(k, (conteo.get(k) || 0) + 1);
      }
      if (t?.paraQuienTipo === "rodmar" && t?.paraQuienId) {
        const k = String(t.paraQuienId);
        conteo.set(k, (conteo.get(k) || 0) + 1);
      }
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [k, c] of conteo.entries()) {
      if (c > bestCount) {
        best = k;
        bestCount = c;
      }
    }
    return best;
  }, [allTransaccionesReales]);
`;

  s = s.slice(0, i + anchor.length) + insert + s.slice(i + anchor.length);
}

// 2) Reemplazar bloque cuentaIdentificadores (versión vieja -> versión robusta)
const reIds = /const cuentaIdentificadores = useMemo\([\s\S]*?\}, \[cuentaEncontrada, cuentaNombre\]\);/m;
if (reIds.test(s)) {
  const newIds = `const cuentaIdentificadores = useMemo(() => {
    const ids: string[] = [];
    
    // Siempre incluir el slug si es numérico (ej: /rodmar/cuenta/4)
    const cuentaIdNum = parseInt(cuentaSlug);
    if (!isNaN(cuentaIdNum)) {
      ids.push(cuentaIdNum.toString());
    }

    if (cuentaEncontrada) {
      // ID numérico como string
      if (cuentaEncontrada.id) {
        ids.push(cuentaEncontrada.id.toString());
      }
      // Código (persistente)
      if (cuentaEncontrada.codigo) {
        ids.push(cuentaEncontrada.codigo);
        ids.push(cuentaEncontrada.codigo.toLowerCase());
        ids.push(cuentaEncontrada.codigo.toUpperCase());
      }
      // Nombre como fallback
      if (cuentaEncontrada.nombre) {
        ids.push(cuentaEncontrada.nombre);
        ids.push(cuentaEncontrada.nombre.toLowerCase());
      }
    } else {
      // Fallback: usar lógica legacy si no se encontró la cuenta
      const legacyId = cuentaNameToId(cuentaNombre);
      ids.push(legacyId);
      ids.push(legacyId.toLowerCase());
      ids.push(legacyId.toUpperCase());
    }

    // Siempre incluir el nombre visible como fallback
    if (cuentaNombre) {
      ids.push(cuentaNombre);
      ids.push(cuentaNombre.toLowerCase());
    }

    // Incluir el identificador real inferido desde transacciones
    if (cuentaCodigoInferido) {
      ids.push(cuentaCodigoInferido);
      ids.push(cuentaCodigoInferido.toLowerCase());
      ids.push(cuentaCodigoInferido.toUpperCase());
    }
    
    return ids;
  }, [cuentaEncontrada, cuentaNombre, cuentaSlug, cuentaCodigoInferido]);`;

  s = s.replace(reIds, newIds);
}

// 3) Asegurar que el modal recibe cuentaCodigo + cuentaIdentificadores
const reModal = /<RodMarCuentasImageModal[\s\S]*?\/>/m;
const m = s.match(reModal);
if (!m) fail("No se encontró el JSX de <RodMarCuentasImageModal ... />");

const currentModal = m[0];
const desiredModal = `<RodMarCuentasImageModal
        open={isImageModalOpen}
        onOpenChange={setIsImageModalOpen}
        transacciones={transaccionesFiltradas}
        cuentaNombre={cuentaNombre}
        cuentaCodigo={cuentaEncontrada?.codigo || cuentaCodigoInferido || undefined}
        cuentaIdentificadores={cuentaIdentificadores}
        filtroAplicado={filtros.fechaTipo === "todos" ? "Todas" : 
          FILTROS_FECHA.find(f => f.value === filtros.fechaTipo)?.label || "Personalizado"}
      />`;

if (!currentModal.includes("cuentaCodigo=") || !currentModal.includes("cuentaIdentificadores=")) {
  s = s.replace(reModal, desiredModal);
}

try {
  fs.writeFileSync(FILE, s, "utf8");
} catch (e) {
  fail(`No se pudo escribir ${FILE}: ${e.message}`);
}

console.log("[patch-rodmar-cuenta-image] OK");

