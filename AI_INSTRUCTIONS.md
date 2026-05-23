# AI Instructions - Roam Export Filter

> **Lee esto primero** al inicio de cada sesión de trabajo.

## Descripción del proyecto

Plugin para Roam Research que exporta contenido filtrado usando consultas Datalog. Funciona incluso cuando los bloques están colapsados. Ofrece múltiples modos: copia rápida con selección visual (`Alt+Shift+C`), exportación a archivo Markdown por tag, exportación por bloques raíz, y exportación por selección manual de ramas.

---

## Fuente de verdad

**CRÍTICO**: El archivo que DEBES editar es:

```
roam-filter.js    ← ÚNICA FUENTE DE VERDAD
```

Este archivo se sirve desde GitHub Pages y es cargado por Roam Research:
```javascript
s.src = 'https://camiloluvino.github.io/roamFilter/roam-filter.js';
```

### Estructura del proyecto:

```
roamExportFilter/
├── docs/                   ← Documentación adicional (CHANGELOG)
├── tests/                  ← Suite de tests (tests.html)
├── reference/              ← Archivos de referencia (documentación Roam API)
├── roam-filter.js          ← ÚNICA FUENTE DE VERDAD
├── roam_loader.js          ← Script local para pruebas y carga del plugin
├── AI_INSTRUCTIONS.md      ← Reglas y lineamientos para Vibe Coding
├── STATUS.md               ← Estado actual del proyecto y pendientes
├── README.md               ← Documentación usuario
└── .gitignore              ← Archivos ignorados por Git
```

### Después de editar `roam-filter.js`:

1. Actualiza la versión y fecha en las líneas 1-3 del archivo.
2. Actualiza `docs/CHANGELOG.md` con los cambios realizados.
3. Actualiza `STATUS.md` al final de la sesión.
4. Haz push a GitHub para que los cambios se reflejen en GitHub Pages.

---

## Arquitectura conceptual

El código en `roam-filter.js` está organizado en secciones lógicas marcadas con comentarios. **No es modular** porque Roam no soporta ES modules.

### Secciones principales:

Busca estos comentarios en el código para ubicar cada sección:

- **JSZIP LOADING** - Carga JSZip desde CDN para exports >5 archivos
- **queries.js** - Consultas Datalog contra roamAlphaAPI
- **export-by-root.js** - Exportación por bloques raíz
- **tree-builder.js** - Construcción de árboles unificados
- **exporter.js** - Conversión a Markdown y descarga
- **MAIN EXTENSION LOGIC** - UI y orquestación de export/copy by tag
- **VISUAL SELECTION COPY** - Alt+Shift+C para bloques seleccionados
- **EXTENSION INITIALIZATION** - Registro de comandos y cleanup

### Flujo de Datos y Arquitectura:
El flujo general de los datos en una exportación:
1. **Query**: Consultas Datalog usando `window.roamAlphaAPI.data.q` filtran los bloques.
2. **Blocks**: `window.roamAlphaAPI.pull` obtiene el árbol completo de cada bloque.
3. **Tree**: `tree-builder.js` transforma la salida plana/invertida de Roam en una jerarquía JSON.
4. **Markdown/EPUB**: `exporter.js` o el generador EPUB transforman el árbol al formato final.
5. **Download/ZIP**: Se descarga un archivo único o se empaqueta con JSZip.

---

## Decisiones de diseño

### ¿Por qué todo está inlineado en un archivo?

**Roam Research no soporta ES modules (`import/export`)**. El código debe ejecutarse como un script único. Históricamente existió una carpeta `src/core/` con módulos separados, pero fue eliminada por estar obsoleta.

### ¿Por qué se usa GitHub Pages?

`roam-filter.js` se sirve desde GitHub Pages como CDN. Los usuarios cargan el plugin con:
```javascript
s.src = 'https://camiloluvino.github.io/roamFilter/roam-filter.js';
```

### Variable DEBUG

Línea ~549. Habilita logs extensivos en consola. En producción debería ser `false`, pero se mantiene `true` para desarrollo activo.

### Constante FAVORITE_TAGS

Línea ~553. Lista editable de tags frecuentes para el modal de export by root blocks.

---

## Principios operativos

### Versionado

1. **Ubicación**: Líneas 1-3 de `roam-filter.js`:
   ```javascript
   // Roam Filter Export - Smart Export for Filtered Blocks
   // Version: X.Y.Z
   // Date: YYYY-MM-DD HH:MM
   ```

2. **OBLIGATORIO**: La fecha **siempre incluye hora** (formato `HH:MM`). Permite distinguir múltiples versiones del mismo día.

3. **Cuándo incrementar**:
   - MAJOR (X): Cambios breaking o restructuración significativa
   - MINOR (Y): Nueva funcionalidad
   - PATCH (Z): Corrección de bugs

### Convenciones de nombrado

- **Funciones**: camelCase con verbos descriptivos (`findBlocksByTag`, `buildExportTree`)
- **Constantes globales**: UPPER_CASE (`DEBUG`, `FAVORITE_TAGS`)
- **Variables de cache**: sufijo `Cache` (`descendantsCache`, `blockInfoCache`)

### Manejo de errores

**OBLIGATORIO**: Toda interacción con `roamAlphaAPI` debe estar en try/catch:

```javascript
try {
    const result = window.roamAlphaAPI.data.q(`...`);
    // ...
} catch (err) {
    console.error("Error in [functionName]:", err);
    return []; // o valor default apropiado
}
```

Antes de llamar a la API, verificar disponibilidad:
```javascript
if (!isRoamAPIAvailable()) {
    console.error("Roam API is not available");
    return [];
}
```

---

## Contexto técnico específico

### API disponible

- **`window.roamAlphaAPI.data.q(query)`**: Ejecuta consultas Datalog
- **`window.roamAlphaAPI.pull(pattern, eid)`**: Obtiene datos de una entidad
- **`window.roamAlphaAPI.ui.commandPalette.addCommand()`**: Registra comandos

### Formato de atributos

Los datos de Roam vienen con prefijos como `:block/uid`, `:block/string`, etc. El código maneja ambos formatos:
```javascript
const uid = block[":block/uid"] || block.uid;
```

### Limitaciones conocidas

1. **Sin recursión nativa**: El pattern `...` en pull no funciona para profundidad infinita. Usamos `buildTreeRecursively()`.
2. **Orden de bloques**: Viene de `:block/order`, debe ordenarse manualmente.
3. **Parents vienen al revés**: De raíz a hoja, pero procesamos de hoja a raíz.

### Registro de comandos (Command Palette)

```javascript
window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Command Name",
    callback: () => { ... }
});
```

### Limpieza al desinstalar

Exponer cleanup global:
```javascript
window.roamExportFilterCleanup = cleanupExtension;
```

---

## Fragilidades y errores comunes

### Errores que una IA podría cometer:

| Error | Prevención |
|-------|------------|
| Olvidar actualizar versión/fecha | Verificar líneas 1-3 de `roam-filter.js` en cada cambio |
| **No incluir hora en la fecha** | **Formato OBLIGATORIO: `YYYY-MM-DD HH:MM`** |
| Usar ES modules (`import`/`export`) | Roam no los soporta; todo debe ser inline |
| No envolver llamadas a API en try/catch | Toda llamada a `roamAlphaAPI` requiere manejo de errores |
| Asumir que los números de línea son exactos | Las líneas en esta documentación son aproximadas; siempre verifica |
| Olvidar hacer push a GitHub | Los cambios no se reflejan en Roam hasta hacer push |

### Puntos frágiles del sistema:

1. **GitHub Pages**: Después de hacer push, puede tomar unos segundos en actualizarse. El cache-busting (`?v=Date.now()`) ayuda a cargar la versión más reciente.

2. **Orden de bloques**: La lógica de ordenamiento (`globalOrderPath`, `compareOrderPaths`) es compleja. Cambios aquí pueden romper el orden de exportación.

3. **Consultas Datalog**: Las queries dependen del esquema de Roam. Si Roam cambia nombres de atributos, las queries fallarán silenciosamente.

4. **DOM manipulation en modales**: Los modales se crean con `innerHTML`. Si se añaden más, asegurar que los IDs sean únicos.

### Operaciones que requieren pasos específicos:

1. **Agregar un nuevo comando**:
   - Definir la función
   - Registrarla en `initExtension()` con `addCommand()`
   - Añadirla al array de cleanup en `cleanupExtension()`

2. **Modificar la UI de un modal**:
   - Los estilos están inline en template strings
   - Event listeners se añaden después de insertar en DOM
   - Siempre incluir función `cleanup()` para remover overlay

---

## Lecciones aprendidas

### Dependencias CDN: siempre fijar versión

Usar URLs genéricas como `unpkg.com/package` (sin versión) puede causar que librerías se actualicen silenciosamente y rompan el código.

- ❌ Inseguro: `https://unpkg.com/package/file.js`
- ✅ Seguro: `https://unpkg.com/package@x.y.z/file.js`

### Verificar APIs antes de asumir

No asumir que una librería tiene cierto método solo porque "debería". Si la documentación es escasa, revisar el código fuente. (Nota histórica: en el pasado asumenmos que jEpub tenía `.css()` pero no existía, lo que originó su eventual reemplazo por un generador manual EPUB 3.0).

### Cache agresivo de Roam

Roam y los browsers cachean scripts agresivamente. Después de hacer push:
1. Esperar 30-60 segundos para propagación de CDN
2. Siempre incluir `console.log("Loaded vX.Y.Z")` al inicio del script
3. Verificar que el log muestra la versión esperada antes de diagnosticar "por qué no funcionó el fix"

### Errores en cascada

Un error fatal al cargar (ej: dependencia fallida) puede enmascarar errores en tiempo de ejecución (ej: API incorrecta). Al arreglar un error bloqueante, anticipar que el código subsecuente nunca se ejecutó y puede tener más errores.

### Validación de UI
- **No cerrar modal en error**: Validaciones críticas (como filtros vacíos o sin resultados) deben mostrarse *dentro* del modal. Cerrar el modal frustra al usuario.
- **Feedback visual inmediato**: Limpiar estados de error (rojo) tan pronto el usuario interactúa para corregirlo (ej: evento `input`).

### Event Listeners dinámicos
- Al re-renderizar partes del DOM (ej: `treeContainer.innerHTML`), **todos los event listeners se pierden**.
- Debes re-adjuntar los listeners inmediatamente después de asignar el `innerHTML`.
- Si agregas un botón "Seleccionar todo", su estado y sus listeners deben actualizarse/re-adjuntarse cada vez que cambia la vista (ej: al cambiar profundidad).

---

## Glosario del Dominio (Roam Research)

- **Block (Bloque)**: Unidad básica en Roam. Cada viñeta es un bloque con un `uid`.
- **Page (Página)**: Contenedor superior de bloques. También tiene un `uid`.
- **Branch (Rama)**: Un bloque padre y todos sus bloques hijos (descendientes indentados).
- **Root Block (Bloque Raíz)**: Un bloque que es hijo directo de la página (no está indentado bajo otro bloque).
- **Daily Notes**: Páginas especiales creadas por día (ej. "February 20th, 2026").
- **Namespace Pages**: Páginas con "/" en el título (ej. "entrevista/real").
- **Datalog**: Lenguaje de consultas para la base de datos de Roam (usado en `window.roamAlphaAPI.data.q`).

---

## Referencias adicionales

- `reference/RoamResearch-developer-documentation-*.json`: Documentación oficial de la API
- `tests/tests.html`: Suite de tests unitarios ligeros
- `docs/CHANGELOG.md`: Historial detallado de cambios
