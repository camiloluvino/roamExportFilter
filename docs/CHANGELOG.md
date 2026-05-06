# Changelog
+
+## [2.24.0] - 2026-05-06 11:35
+
+### Added
+- **Tree-View Interactivo**: Nueva funcionalidad en la pestaña "Por Ramas" que permite navegar por la jerarquía de la página de forma selectiva.
+  - Botones de toggle (▶/▼) para expandir o colapsar ramas individuales.
+  - Botones globales "⊞ Expandir todo" y "⊟ Colapsar todo" para manejo rápido de listas largas.
+- **Ruta de Contexto (Breadcrumbs)**: Las exportaciones (Markdown y EPUB) ahora incluyen la ruta completa de bloques padres.
+  - Formato: `Página → Padre 1 → Padre 2`.
+  - Útil para mantener el contexto de bloques extraídos de niveles profundos.
+
+### Fixed
+- **Indentación del Árbol**: Corregido problema visual donde la sangría de los bloques aumentaba exponencialmente debido a la anidación de paddings. Ahora usa una estructura de sangría plana y limpia.
+

## [2.23.2] - 2026-04-16 01:10

### Fixed
- **Optimización de Interfaz (Flexbox)**: Se implementó `flex-shrink: 0;` en los elementos críticos del modal (header, footer y opciones de formato) para evitar que se colapsen o queden inaccesibles cuando la lista de ramas es muy extensa.
- **Scroll Interno Inteligente**: Se restauró la estructura de desbordamiento para que solo el área de contenido (pestañas) genere barras de desplazamiento, manteniendo los controles de acción siempre visibles en la parte inferior.

---

## [2.23.1] - 2026-04-16 00:46

### Fixed
- **Scroll del Modal Principal**: Se agregó un manejo inicial de scroll al contenedor del modal para asegurar accesibilidad en pantallas pequeñas. Una iteración posterior (v2.23.2) refinó este comportamiento.

---

## [2.23.0] - 2026-04-16 00:15

### Added
- **Nomenclatura personalizada de archivos**: Nueva sección en la pestaña "Por Ramas" para elegir cómo nombrar los archivos individuales (Bloque, Página + Bloque, o Página).
- **Vista previa en tiempo real**: Los usuarios pueden ver exactamente cómo quedará el nombre del archivo (incluyendo prefijos de orden) antes de exportar.
- **Prevención de duplicados**: Lógica de resolución de nombres que añade sufijos numéricos si detecta conflictos en el paquete de exportación.

---

## [2.21.1] - 2026-03-29 20:40

### Fixed
- **Scroll en pestaña "Por Ramas"**: Corregido problema donde el modal crecía indefinidamente o el footer se ocultaba. Se implementó un contenedor con scroll interno independiente para la lista de ramas.

---

## [2.20.1] - 2026-03-04 14:55

### Fixed
- **Markdown Plano Títulos perdidos**: Ahora el modo de Markdown "Plano" extrae y respeta el nivel de título (Heading 1, 2, 3) asignado a los bloques de Roam y los inyecta como Títulos Markdown válidos (`#`, `##`, `###`), conservando su peso semántico y evitando que sean párrafos ordinarios al perder la indentación original.

---

## [2.20.0] - 2026-03-04 14:35

### Added
- **Exportación "Markdown Plano"**: Se agregó la opción de estructura (Jerárquico vs. Plano) en el modal de formato Markdown. Activar "Plano (Párrafos)" exporta el contenido en texto limpio usando párrafos, eliminando las viñetas e indentación natural de Roam.

---

## [2.19.0] - 2026-02-20 16:41

### Changed
- **Generador EPUB 3.0 Manual**: Se reemplazó la librería subyacente de generación (jEpub) por un generador manual nativo de EPUB 3.0.
  - Genera archivos XHTML bien formados en vez de HTML simple.
  - Elimina atributos de estilo inline en favor de una hoja de estilos CSS externa (`styles.css`).
  - Añade soporte completo para `nav.xhtml` de EPUB 3.0 manteniendo compatibilidad con `toc.ncx` de EPUB 2.0.
  - Declara explícitamente el metadata de lenguaje y tiempo de última modificación.
  - Previene problemas de compresión de `mimetype` que causaban errores de formato.
- **Kindle Compatibility**: Estos cambios resuelven directamente los errores del conversor de Amazon ("Send to Kindle").

### Removed
- **jEpub y EJS dependencies**: Eliminados al ya no ser necesarios. El payload del script ahora es más liviano y con menos puntos de fallo externo.

---

## [2.18.0] - 2026-02-20 15:35

### Added
- **Buscador de Páginas Universal**: El tab "📄 Por Páginas" ahora es **siempre visible** y cuenta con un buscador para añadir cualquier página del grafo a la lista de exportación.
- **Soporte para Daily Notes**: Se corrigió error que impedía abrir el modal desde la vista principal de Daily Notes (`#/app/{graph-name}`).
- **Rediseño de Tabs**: Los tabs ahora están agrupados visualmente bajo etiquetas superiores ("📍 Esta página" y "📑 Múltiples páginas") con un separador claro.
- **Visibilidad inteligente**: El nombre de la página se oculta automáticamente al activar el tab "Por Páginas" para evitar confusión en contexto multi-página.

### Technical
- Added `searchPages(searchTerm)`: Nueva función para búsqueda parcial de títulos en el grafo usando Datalog.
- Added Daily Notes fallback in `getCurrentPageUid()` using date formatting and reverse-lookup.
- Refactored `promptUnifiedExport()` to remove `hasChildPages` requirement for the Pages tab.
- Added `page-name-display` ID and toggle logic in `switchTab()`.

## [2.17.0] - 2026-02-20 14:40

### Added
- **Export por Páginas (Initial)**: New "📄 Por Páginas" tab in the Smart Export modal for namespace child pages.
- **camelCase filename generation**: Page titles like `entrevista/real/María Paz` become `entrevistaReal_MariaPaz.epub`.
- **ZIP bundling for Pages**: Automatic bundling when exporting multiple pages.

### Technical
- Added `getChildPages(pageName)`: Queries all pages, filters by namespace prefix in JavaScript
- Added `generatePageFilename(fullTitle)`: Converts slash-separated page titles to camelCase with `_` separator, removes diacritics
- Added `generateEpubBlob(tree, title, options)`: Extracted from `downloadAsEpub` to generate EPUB blob without immediate download (enables ZIP packaging)
- Added `downloadBlob(blob, filename)`: Generic blob download helper
- Modified `findBlocksByTag(tagName, targetPageUid)`: Now accepts optional `targetPageUid` parameter to query any page (not just current)
- Modified `downloadAsEpub()`: Now uses `generateEpubBlob` + `downloadBlob` internally
- Modified `promptUnifiedExport()`: Added conditional 3rd tab with group labels, page list rendering, and pages-specific event listeners
- Modified `unifiedExport()`: Added `mode === 'pages'` branch with per-page tree building, format selection, and ZIP packaging

---

## [2.16.0] - 2026-02-18 23:00

### Added
- **Sub-branch filtering**: "Por Ramas" export now supports content filtering WITHIN selected branches
  - When a tag filter is applied (e.g., `#summary`), only the sub-blocks containing that tag (and their descendants) are exported
  - Non-matching content is pruned from the export tree
  - Useful for extracting specific sections (like "key takeaways" or "vocab") from multiple daily notes or meeting logs

### Fixed
- **Tag search depth**: Fixed an issue where tags nested deep in the hierarchy (>2 levels) were not found by the filter
  - Replaced legacy Datalog query with recursive content-based tree inspection
  - Now finds tags at any nesting level
  - Improved validation accuracy in the unified export modal

---

## [2.15.0] - 2026-02-18 21:40

### Fixed
- **Filter not found closes modal**: When exporting branches with a tag filter that doesn't match any selected branch, the modal now stays open and shows an inline error message instead of closing and showing a brief notification
- **Empty filter tag**: If the filter checkbox is enabled but the tag field is empty, the field highlights in red and the modal stays open

### Added
- **Select All / Deselect All**: Toggle button above the branch tree in "Por Ramas" tab
  - Toggles between "☑ Seleccionar todo" and "☐ Deseleccionar todo"
  - Updates correctly when depth changes or individual checkboxes are toggled

### Technical
- Filter tag validation (Datalog query) now runs inside the modal before closing, with "Verificando..." feedback on the export button
- Added `updateSelectAllLabel()` function and `branch-filter-error` inline error container
- Checkbox change listeners now also update the Select All button label

---

## [2.14.4] - 2026-01-22 01:38

### Fixed
- **EPUB export error**: Fixed `TypeError: book.css is not a function`.
  - The `jEpub` library does not support the `.css()` method (contrary to some documentation/assumptions).
  - Replaced API call with manual inline CSS injection into the HTML content.

## [2.14.3] - 2026-01-22 01:26

### Fixed
- **EPUB export dependency**: Fixed `ReferenceError: exports is not defined`.
  - The generic CDN URL for `ejs` was floating to version 4.x, which dropped browser support.
  - Pinned EJS to version `3.1.10` to ensure compatibility.

## [2.14.2] - 2026-01-22 01:13

### Fixed
- **EPUB export not working**: Fixed multiple issues preventing EPUB generation:
  - Added missing **EJS** dependency (required by jEpub v2+)
  - Updated jEpub CDN to use `unpkg` (official source)
  - Fixed API initialization pattern

### Added
- **EPUB export format**: New option to export as EPUB instead of Markdown
  - Format selector (Markdown/EPUB) in the unified export modal
  - Works with both "Por Filtros" and "Por Ramas" export modes
  - In "Por Ramas" mode, all selected branches are combined into a single EPUB

- **EPUB styling options**: Configurable options for better reading experience
  - **Espaciado bloques**: Compact / Normal / Wide spacing between blocks
  - **Al cambiar nivel**: None / Subtle / Marked spacing when hierarchy changes
  - **Indicador niveles**: Indentation / Vertical line / Numbering for visual hierarchy

### Technical
- Added `loadJEpub()`: Loads jEpub library from CDN (depends on JSZip)
- Added `treeToEpubHTML()`: Converts block tree to HTML with configurable styles
- Added `downloadAsEpub()`: Generates and downloads EPUB file
- Added `escapeHTML()`: Helper for safe HTML content
- Modified `promptUnifiedExport()`: Added format selector and EPUB options panel
- Modified `unifiedExport()`: Routes to EPUB or Markdown based on selection

---

## [2.13.0] - 2026-01-19 14:29

### Added
- **Descending order option**: New checkbox "Orden descendente (..., 02_, 01_)" under the order prefix option
- When enabled, the first branch gets the highest number prefix instead of 01_
- Useful when you want files sorted alphabetically to appear in reverse order compared to Roam

### Technical
- Checkbox is disabled until "Agregar prefijo de orden" is enabled
- Added `useDescendingOrder` flag to export options

---

## [2.12.0] - 2026-01-19 02:31

### Added
- **Optional order prefix**: Checkbox to enable/disable order prefix (01_, 02_...) on filenames
- Default is now OFF (no prefix), user can enable when order matters

---

## [2.11.1] - 2026-01-19 00:59

### Fixed
- **Branch export indentation**: Now exports only the selected branch with descendants, without including ancestors
- Branches now export with correct nested structure instead of being flattened

### Technical
- Changed from `fetchBlocksForExport()` + `buildExportTree()` to using `getBlockWithDescendants()` directly
- Maintains tag filter validation before processing each branch

---

## [2.11.0] - 2026-01-19 00:43

### Added
- **One file per branch**: "Por Ramas" now exports each selected branch as a separate .md file
- Order prefixes (01_, 02_, etc.) on filenames to preserve selection order
- Automatic ZIP when exporting more than 5 branches

### Changed
- Notifications now in Spanish for consistency

---

## [2.10.1] - 2026-01-19 00:34

### Added
- **Depth selector** in "Por Ramas" tab: Choose 1-4 levels of hierarchy (default: 2)
- Tree re-renders dynamically when depth changes

### Changed
- **Larger modal**: 800-1000px wide (was 550-700px), 400px tree height (was 300px)
- Optimized for 1920x1080 screens
- Slightly larger font sizes for better readability

---

## [2.10.0] - 2026-01-19 00:22

### Added
- **Unified Export Modal**: Single command "Smart Export" opens a modal with two tabs:
  - **📋 Por Filtros**: Export blocks by tag (replaces "Export Filtered Content")
  - **🌳 Por Ramas**: Visual branch selection with checkboxes (includes optional tag filter)
- Page name displayed in modal header
- Favorite tags chips for quick selection in "Por Filtros" tab

### Changed
- Consolidated 3 commands into 1 unified "Smart Export" command
- Removed "Export Filtered Content", "Copy Filtered Content", and "Export by Branch Selection" as separate commands

### Technical
- Added `promptUnifiedExport()`: Modal with tab system and dual functionality
- Added `unifiedExport()`: Main orchestrator that handles both export modes
- Simplified Command Palette registration (now only 3 commands)

---

## [2.9.0] - 2026-01-18

### Added
- **Export by Branch Selection**: New visual interface to manually select specific branches for export
  - Shows page structure with checkboxes for the first 3 levels
  - Indicates when blocks have deeper children (`+N sub-bloques`)
  - Full tooltip on hover showing complete block text
  - Real-time counter of selected branches
- **Combined mode**: Optional tag filter within selected branches (e.g., "from chapter 3, only the #summaries")
- New command in Command Palette: "Export by Branch Selection"

### Technical
- Added `getPageStructure()`: Fetches page tree limited to N levels for the branch selector
- Added `fetchBlocksForExport()`: Converts selected UIDs to format compatible with `buildExportTree()`
- Added `promptForBranchSelection()`: Modal UI with checkbox tree
- Added `exportByBranchSelection()`: Main orchestration function
- Reuses existing `buildExportTree()`, `treeToMarkdown()`, and `downloadFile()` functions

---

## [2.8.1] - 2026-01-07 02:42

### Changed
- **Favorite tags instead of dynamic detection**: Tag chips now show a configurable `FAVORITE_TAGS` list instead of detecting all tags in the page (which often included noise from copy/paste)
- Edit the `FAVORITE_TAGS` constant near line 412 to customize your preferred tags

---

## [2.8.0] - 2026-01-07 02:32

### Added
- **Order toggle in Export by Root Blocks**: Checkbox to control whether `01_` = bottom block (inverted, default) or top block
- **Live preview count**: Shows how many files will be exported as you type a filter tag (with 300ms debounce)
- **Clickable tag chips**: Displays up to 15 tags found in the page; click to use as filter

### Changed
- Export button now shows dynamic count: "Export X files"
- Modal is slightly wider to accommodate new UI elements

---

## [2.7.2] - 2026-01-07

### Changed
- **Inverted filename order prefix**: Bottom block in Roam now gets prefix `01_`, top block gets highest number. This makes chronological content (oldest at bottom) sort correctly when files are sorted alphabetically.

---

## [2.7.1] - 2025-12-20

### Added
- **Filename order prefix**: Exported files now include order prefix (01_, 02_, etc.) to maintain page order when sorted alphabetically

---

## [2.7.0] - 2025-12-20

### Added
- **ZIP export for Export by Root Blocks**: When exporting more than 5 root blocks, files are now bundled into a single ZIP file instead of downloading individually
- JSZip library integration (loaded from CDN on demand)

### Changed
- Export by Root Blocks now collects all files first, then decides export method based on count
- Improved notification messages to indicate ZIP creation process

---

- When filtering and selecting hierarchies, only copies branches containing leaf targets
- Example: "Metodología propuesta" and "Conclusiones" no longer copied when only "Introducción #filtrarEsto" is the target

### Technical
- Modified `processContainer` to filter `selectedDescendantUids` to only leaf targets before passing to `buildPathToDescendants`
- Leaf targets = selected blocks with NO other selected descendants
- This prevents intermediate selected blocks from being treated as copy destinations

## [2.1.1] - 2025-11-07

### Fixed
- **Critical fix**: Intermediate selected blocks (like "Conversación 1") no longer copy their entire tree
- Only "leaf targets" (selected blocks with NO selected descendants) copy their entire tree
- Intermediate blocks now correctly act as path segments, not copy destinations

### Technical
- Added `hasTargetDescendants` check in `buildPathToDescendants()`
- Distinguishes between leaf targets (copy all) and intermediate targets (path only)

## [2.1.0] - 2025-11-07

### Fixed
- **Critical fix**: Now correctly filters out unrelated branches when copying filtered selections
- When a block has selected descendants, ONLY paths to those descendants are copied (not the entire tree)
- Restored path-building logic that was incorrectly removed in v2.0.0

### Changed
- Simplified path detection logic - removed DOM-based child detection
- Now uses only UID-based descendant detection for more reliable filtering

### Technical
- Restored: `getAllDescendantUids()`, `findSelectedDescendants()`, `buildPathToDescendants()`
- Removed unreliable DOM traversal functions: `hasSelectedDescendants()`, `isDirectChild()`, `getBlockTextOnly()`
- More efficient: Single check for selected descendants, no complex branching

## [2.0.0] - 2025-11-07

### Changed
- Major refactoring: Simplified path-building logic, removed DOM-based detection
- First stable version with current architecture

---

*Historial anterior a v2.0.0 omitido. Consulta git log para detalles.*