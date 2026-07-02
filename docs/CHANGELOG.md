# Changelog

## [2.37.1] - 2026-07-02 01:47

### Fixed
- **Falta de foco del cursor al cerrar modales (Caret vertical perdido)**:
  - Se reemplazó el patrón destructivo `blur() -> setTimeout(focus, 10)` en las 4 funciones de cleanup con un helper centralizado `restoreRoamFocus`.
  - El helper realiza validaciones de existencia en el DOM (`document.body.contains`) y cuenta con un fallback dinámico que busca el textarea activo actual del editor de bloques de Roam (`textarea.rm-block-input`).
  - Aumentado el delay a 50ms para acomodar los ciclos asíncronos de actualización de React en Roam Research.

### Improved
- **Limpieza de overlays huérfanos**:
  - Se actualizó `cleanupExtension` para limpiar cualquier overlay abierto en el DOM en caso de desactivación de la extensión.

---

## [2.37.0] - 2026-07-02 01:33

### Added
- **Reordenamiento de Presets por Drag & Drop**:
  - Arrastre nativo en HTML5 mediante un handle visual (`⠿`).
  - Indicador visual dinámico (línea de inserción en mitad superior/inferior del preset objetivo).
  - Persistencia automática e inmediata del nuevo orden en el Grafo.

### Improved
- **Diseño más limpio para pestaña Presets**:
  - Se oculta de forma automática la columna derecha de "Opciones de exportación" al estar en la pestaña Presets, permitiendo que la lista de presets use el 100% del ancho del modal.

---

## [2.36.2] - 2026-06-29 21:42

### Fixed
- **Falta de foco del cursor tras cerrar modal (Restauración de Focus)**:
  - Se solucionó el problema por el cual el cursor de texto de Roam desaparecía tras cerrar la ventana del plugin, obligando a desenfocar la pestaña para recuperarlo.
  - El plugin ahora captura el elemento activo (`document.activeElement`) justo antes de mostrar el modal y le devuelve el foco de manera programática e inmediata en la limpieza (`cleanup`).
- **Bloques de configuración duplicados en Graph Sync (Deduplicación/Race Condition)**:
  - Se implementó un almacenamiento en caché en memoria (`pendingSettingsBlocks`) para los UIDs de bloques recién creados. Esto previene que se creen bloques de presets vacíos duplicados cuando el plugin escribe datos inmediatamente después de inicializar la página de configuración en segundo plano.

---

## [2.36.1] - 2026-06-29 15:02

### Fixed
- **Rotura de bloque de código de Roam (Escape de backticks)**:
  - Se corrigió el problema crítico por el cual la presencia de cadenas literales de triple backtick (```) dentro de la extensión rompía el renderizado y la estructura del bloque de código nativo de Roam donde se carga el plugin.
  - Ahora los delimitadores de código de Markdown se generan dinámicamente utilizando `String.fromCharCode(96, 96, 96)`, eliminando por completo las secuencias literales de triple backtick del código fuente.

---

## [2.36.0] - 2026-06-29 00:10

### Added
- **Sincronización en la Nube mediante el Grafo de Roam**:
  - Los presets y los tags favoritos ahora se almacenan directamente en la base de datos de tu grafo de Roam Research en una página llamada `roamExportFilter/Settings` en lugar de guardarse de manera local en el `localStorage` del navegador.
  - Esto habilita la sincronización instantánea y nativa de todas tus selecciones de presets y etiquetas favoritas en múltiples computadoras o dispositivos vinculados al mismo grafo.
  - Implementación de un sistema de caché de sesión para evitar cualquier tipo de lag asíncrono en la interfaz del usuario al cargar y guardar configuraciones.
  - Soporte de migración automatizada sin pérdida de datos: el plugin detectará automáticamente si tienes presets o tags favoritos en tu `localStorage` local (incluso de versiones heredadas o aisladas por grafo) y los migrará a tu base de datos de Roam en la primera ejecución, limpiando la clave de almacenamiento local posterior para evitar duplicación.

---

## [2.35.1] - 2026-06-24 13:45

### Fixed
- **Fuga de Presets Heredados (Leak)**:
  - Se corrigió un error por el cual los presets heredados de la versión anterior se migraban de manera repetida a múltiples grafos si el usuario los abría. Ahora, una vez que los presets antiguos se migran exitosamente al primer grafo que se abre, se elimina la clave global antigua de `localStorage` para evitar que se propaguen a otros repositorios.

---

## [2.35.0] - 2026-06-24 13:15

### Added
- **Presets aislados por Grafo (Repositorio)**:
  - Los presets ahora se guardan de forma independiente para cada grafo de Roam Research en `localStorage` usando la clave dinámica `roam-export-presets-{nombreGrafo}`. Esto evita que los presets de un grafo aparezcan por error en grafos independientes.
  - El nombre del grafo se obtiene directamente a través de `window.roamAlphaAPI` o analizando el hash de la URL (`#/app/{graphName}`).
- **Migración automática de presets heredados**:
  - Al iniciar, si no existen presets guardados para el grafo actual, el plugin busca presets en la clave global antigua (`roam-export-presets`) y los migra automáticamente al almacenamiento propio del grafo sin pérdida de datos.

---

## [2.34.0] - 2026-06-24 13:00

### Added
- **Edición de Presets (Selecciones Guardadas)**:
  - Posibilidad de **Renombrar** presets existentes mediante un botón **"✏️ Renombrar"** que abre un diálogo modal premium pre-rellenado con el nombre actual.
  - Posibilidad de **Fusionar** nuevos bloques a un preset existente con el botón **"🔄 Fusionar"**. Los bloques seleccionados en el árbol de ramas se añaden a los ya guardados en el preset, eliminando duplicados y actualizando la descripción (conteo de bloques y preview) y la fecha de creación.
  - Habilitación adaptativa: el botón "🔄 Fusionar" solo se activa si el usuario se encuentra en la misma página de Roam que originó el preset. Para presets de otras páginas se muestra deshabilitado e incluye un tooltip explicativo.

---

## [2.33.0] - 2026-06-24 12:00

### Added
- **Nueva pestaña de Presets (Selecciones Guardadas)**:
  - Nueva pestaña "📌 Presets" en el header principal del modal para gestionar selecciones pre-guardadas de bloques cross-page.
  - Nuevo botón **"💾 Guardar Preset"** en la barra de controles de "Por Ramas" para guardar los bloques seleccionados de la página actual.
  - Formulario inline premium para nombrar el preset, con generación automática de descripción (número de bloques y vista previa de texto).
  - Soporte de acciones rápidas para cada preset guardado:
    - **Cargar**: Selecciona automáticamente los checkboxes guardados en el árbol. Si el preset es de otra página, ofrece navegar a ella de forma automática y carga la selección después de la navegación.
    - **Copiar Texto**: Obtiene el contenido actual de los bloques usando Datalog de Roam y copia el Markdown al portapapeles.
    - **Copiar UIDs**: Copia las referencias de los bloques en formato `((uid))`.
    - **Eliminar**: Borra el preset del almacenamiento persistente.
  - Persistencia total de presets en `localStorage` bajo la clave `roam-export-presets`.
- **Botón "Copiar UIDs" en footer**:
  - Nuevo botón **"🔗 Copiar UIDs"** en el pie del modal principal.
  - Copia al portapapeles todos los UIDs de los bloques seleccionados en formato `((uid))`, separados por línea.
  - En la pestaña de páginas, copia las referencias a las páginas seleccionadas en formato `[[Nombre de Página]]`.

### Changed
- **Renombrado de botón de copia principal**:
  - Se renombró el botón "Copiar al Portapapeles" a **"📋 Copiar Texto"** en el modal, haciéndolo más claro y descriptivo.

---

## [2.32.2] - 2026-06-15 20:25

### Fixed
- **Errores de exportación ZIP y descompresión en Windows**:
  - Solucionado el error `0x80070057: El parámetro no es correcto` al descomprimir archivos ZIP en Windows. Se eliminan o reemplazan caracteres prohibidos (`< > : " | ? *`) por espacios en la función `sanitizeToCamelCase` antes del formateo a camelCase/PascalCase.
  - Solucionado el error `0x80010135: Ruta de acceso demasiado larga` al descomprimir archivos ZIP en Windows. Se implementó un truncamiento inteligente que limita el tamaño del nombre del archivo final a un máximo de 120 caracteres (preservando la extensión `.md` o `.epub`) y el prefijo de namespaces de página a 80 caracteres.
  - Se mejoró la limpieza de contenido en `generateRootFilename` para remover URLs y rutas locales absolutas/relativas (de Windows y Unix) antes de generar las primeras 5 palabras para el nombre, evitando nombres inflados gigantes.
  - Corregido el problema de extensión duplicada (ej. `.md.md` o `.Md.md` → `.md`) en nombres de archivos.

## [2.32.1] - 2026-06-15 19:00

### Fixed
- **Scrollbar del panel de árbol de ramas y páginas**:
  - Se solucionó el error que impedía hacer scroll hacia abajo en el panel central del modal ("Por Ramas" / "Por Páginas") en pantallas medianas/pequeñas o ante listas muy extensas de bloques.
  - Reemplazados los atributos de alto fijos (`height: 0` y `height: 100%`) por `min-height: 0` e implementado `box-sizing: border-box` en el contenedor principal de las pestañas para permitir el encogimiento adaptativo del layout de flexbox, activando correctamente el scroll nativo (`overflow-y: auto`).

---

## [2.32.0] - 2026-06-15 17:30

### Added
- **Nomenclatura Jerárquica Estricta**:
  - Implementación del formato `{NombrePagina}_{Fecha}_{Bloque}` usando estrictamente PascalCase/camelCase y guiones bajos (`_`).
  - Eliminación completa de guiones medios (`-`), espacios y caracteres especiales de todos los nombres de archivo generados.
  - Extracción inteligente de la fecha nativa de Roam (ej: `[[June 14th, 2026]]` → `20260614`) tanto de los bloques como del título de la página, con fallback a la fecha de hoy.
  - Los bloques sin título (texto plano) ahora generan nombres legibles abreviando las primeras 5 palabras en camelCase (ej: `ayerEstuvimosRevisandoElFiltro`).
  - Preservación inteligente de siglas/acrónimos completamente en mayúsculas (ej: `AIResearch`).
  - Aplicado a exportaciones por ramas, exportaciones de bloques raíz, descargas ZIP de lotes y exportaciones EPUB.

---

## [2.30.1] - 2026-06-12 16:10

### Fixed
- **Corrección de desconfiguración visual (overlapping) en panel de Opciones de Exportación**:
  - Agregado `min-height: 0` y `box-sizing: border-box` en el panel derecho para permitir el scroll vertical de flexbox y evitar desbordamientos.
  - Agregado `height: 0` al contenedor padre del modal para una resolución correcta de altura dinámica.
  - Reducido el alto máximo (`max-height`) de los Tags Favoritos a `100px` para liberar espacio vertical a los selectores de Formato/Estructura.

---

## [2.30.0] - 2026-06-08 21:47

### Added
- **Rediseño global persistente en dos columnas y flexibilidad vertical completa**:
  - La columna derecha de opciones de exportación es ahora global y visible en todas las pestañas ("Por Ramas" y "Por Páginas").
  - Se movió el panel de opciones de formato (Markdown/EPUB y sus sub-ajustes específicos) desde la barra inferior hacia la columna lateral derecha.
  - Se eliminó la barra de formatos inferior, liberando un gran espacio vertical.
  - Se rediseñó el flujo interno de los paneles de formato (Markdown y EPUB) a una disposición vertical amigable e inteligente en la columna lateral de 280px con botones flexibles (`flex: 1`).
  - Se optimizó el espacio vertical de los contenedores de árbol (`#branch-tree-container`) y lista de páginas (`#pages-list-container`) usando `flex: 1` y permitiendo un crecimiento dinámico real para ocupar todo el modal.

---

## [2.29.0] - 2026-06-06 13:25

### Added
- **Rediseño completo de la interfaz de exportación (Smart Export Modal)**:
  - Se agrandó la ventana principal para pantallas modernas (ancho mínimo `1200px` y máximo `1400px` o `90vw`).
  - Mayor espacio y separación (de `20px` a `32px` de gap) entre la sección de contenidos y la de opciones para mejorar la estética.
  - El panel central (tanto árbol como lista de páginas) ahora aprovecha al máximo el espacio vertical con altura dinámica (`calc(90vh - 250px)`).
  - Compactada la columna de opciones a `260px` y reducida la separación interna de controles (`gap` a `8px` y `padding` a `12px`).
  - La barra horizontal inferior (Formatos y Estructura) se compactó reduciendo paddings y márgenes para ganar espacio vertical útil.
  - Reorganización de la barra de controles superior (profundidad y botones de selección/colapso masivo) en una sola fila horizontal para optimizar el espacio visual.

---

## [2.28.0] - 2026-05-19 01:30

### Added
- **Buscador interactivo visual de ramas**: Permite filtrar ramas en tiempo real con resaltado visual (`<mark>`) de texto coincidente. Normalización inteligente de acentos y autodespliegue.
- **Selección masiva de coincidencias**: Botón dinámico para marcar de un solo golpe todas las ramas visibles resultantes del filtro, respetando y propagando la selección en cascada y estados indeterminados hacia arriba.
- **Administrador dinámico y persistente de Tags Favoritos**: Almacenamiento local mediante `localStorage` de tags favoritos, accesible desde la columna derecha de opciones. Permite añadir y eliminar tags al instante. Un clic en el chip de un tag autocompleta el buscador principal superior.

### Cleaned
- Eliminación de pestaña obsoleta "Por Filtros", input de tag de filtrado redundante de post-procesamiento y variables no utilizadas en la inicialización para evitar cualquier error de ejecución.

---

## [2.27.0] - 2026-05-18 12:26

### Added
- **Selección en cascada inteligente para la pestaña "Por Ramas"**:
  - Al marcar un bloque padre (nivel superior), se seleccionan automáticamente todas sus ramas hijas e indentadas.
  - Al desmarcar un bloque padre, se deseleccionan todos sus descendientes de forma automática.
  - **Estado Indeterminado para Checkboxes**: Si solo algunos sub-bloques de una rama están seleccionados, el checkbox de la rama padre mostrará un estado indeterminado (una barra horizontal `indeterminate`) en lugar de desmarcarse por completo. Esto indica visualmente que la rama contiene elementos seleccionados sin exportar toda la rama.
  - Al desmarcar manualmente un bloque hijo, el estado de los padres se actualiza automáticamente hacia arriba para ser consistente (pierde la marca total y pasa a indeterminado o desmarcado).

## [2.26.0] - 2026-05-08 16:55

### Added
- **Rediseño de pestaña "Por Ramas"**: Nueva estructura de dos columnas que organiza mejor la información.
  - El modal ahora es más ancho (1100-1200px) para aprovechar pantallas modernas.
  - El árbol de ramas ocupa la columna izquierda con mayor altura dinámica (55vh).
  - Las opciones de configuración se agrupan en un panel lateral derecho dedicado.
  - Mejora la accesibilidad al reducir la necesidad de scroll vertical para encontrar opciones críticas.

## [2.25.0] - 2026-05-08 13:43

### Added
- **Combinar en archivo único**: Nueva opción en la pestaña "Por Ramas" que permite exportar múltiples ramas seleccionadas concatenadas en un solo archivo Markdown.
  - Toggle "Combinar en archivo único" en la sección de opciones.
  - Campo de nombre de archivo editable (pre-llenado con el nombre de la página).
  - Cada rama se separa con `---` y usa encabezado `##` (H2); el título global es `#` (H1).
  - Se conservan los breadcrumbs de jerarquía original para cada rama.
  - Al activar, se deshabilitan automáticamente las opciones de nomenclatura individual y prefijos de orden (no aplican en archivo único).
  - Se oculta automáticamente cuando el formato es EPUB (ya genera archivo único por diseño).

### Technical
- Added `mergeIntoSingle` and `mergeFilename` fields to branches export result object.
- Added merge toggle event listener with UI state management (disables naming/order when active).
- Added format selector interaction: hides merge option for EPUB, shows for Markdown.
- Added merge execution branch in `unifiedExport()` that concatenates branch sections with H2 headings and `---` separators.

## [2.24.1] - 2026-05-06 18:35

### Improved
- **Visualización de Jerarquía de Padres**: En la exportación por ramas, los bloques padres ahora se muestran en un bloque de cita (`>`) al principio del documento. Esto evita la indentación excesiva del contenido principal mientras mantiene el registro completo del contexto original.

### Fixed
- **Ruta de Padres**: Corregido error donde la jerarquía de padres a veces no se generaba correctamente debido al orden de respuesta de la API de Roam. Ahora utiliza una búsqueda iterativa garantizada.

## [2.24.0] - 2026-05-06 11:35

### Added
- **Tree-View Interactivo**: Nueva funcionalidad en la pestaña "Por Ramas" que permite navegar por la jerarquía de la página de forma selectiva.
  - Botones de toggle (▶/▼) para expandir o colapsar ramas individuales.
  - Botones globales "⊞ Expandir todo" y "⊟ Colapsar todo" para manejo rápido de listas largas.
- **Ruta de Contexto (Breadcrumbs)**: Las exportaciones (Markdown y EPUB) ahora incluyen la ruta completa de bloques padres.
  - Formato: `Página → Padre 1 → Padre 2`.
  - Útil para mantener el contexto de bloques extraídos de niveles profundos.

### Fixed
- **Indentación del Árbol**: Corregido problema visual donde la sangría de los bloques aumentaba exponencialmente debido a la anidación de paddings. Ahora usa una estructura de sangría plana y limpia.


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