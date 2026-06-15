# Project Status - Roam Export Filter

> **Última actualización**: 2026-06-15 16:45

---

## Versión actual

**2.31.1** (2026-06-15 16:45)

---

## Estado de funcionalidades

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| **Smart Export** | ✅ Estable | Modal unificado con 2 pestañas (Por Ramas, Por Páginas) con buscador interactivo y administrador persistente de tags favoritos |
| **MD Export** | ✅ Estable | Exporta a Markdown en formato Jerárquico o Plano |
| **EPUB Export** | ✅ Estable | Exporta a formato EPUB 3.0 con soporte de Markdown |
| **Shallow Export** | ✅ Nuevo | Opción "Solo texto visible" para omitir sub-bloques anidados |
| **Clean Copy** | ✅ Nuevo | Botón "Copiar al portapapeles" que exporta markdown en texto plano sin metadatos |
| **Export by Root Blocks** | ✅ Estable | Exporta cada bloque raíz como archivo separado |
| **ZIP Export (>5 files)** | ✅ Estable | Bundling automático con JSZip |
| **Custom Naming** | ✅ Estable | Opciones de nomenclatura y prevención de duplicados |
| **Merge Export** | ✅ Estable | Combina múltiples ramas en un solo archivo Markdown |

---

## Problemas conocidos

- [ ] `DEBUG = true` en código — Cambiar a `false` antes de release de producción

---

## Próximos pasos

- [ ] Considerar agregar "Export by Root Blocks" al modal unificado
- [ ] Probar con páginas muy grandes (>100 bloques)

---

## Historial reciente

### v2.31.1 (2026-06-15 16:45)
- Fixed: **Corrección visual y de scrollbar en la columna de Opciones de Exportación**.
  - Agregado `flex-shrink: 0;` a todos los elementos hijos directos de la columna derecha para evitar que Flexbox los comprima, solucionando el problema donde los botones del final de la columna se aplastaban a líneas invisibles. Esto activa de forma correcta el scrollbar vertical (`overflow-y: auto`) de la columna ante desbordamientos de contenido.
  - Aumentado el ancho de la columna de `280px` a `360px` y sus márgenes internos para dar más aire y espacio visual a las opciones.
  - Añadido truncado de texto con puntos suspensivos (`text-overflow: ellipsis`) a las vistas previas de nomenclatura y nombre de archivo combinado.

### v2.31.0 (2026-06-12 18:05)
- Added: **Exportación "Solo texto visible" (Shallow Export)**.
  - Nueva opción en el panel lateral del modal que permite extraer únicamente el texto de los bloques de nivel raíz seleccionados, ignorando todo su contenido anidado (hijos/nietos).
  - Compatible tanto con el modo "Por Ramas" como con "Por Páginas".
- Added: **Copiar al Portapapeles Limpio**.
  - Nuevo botón "Copiar al Portapapeles" junto a "Exportar" en el modal principal.
  - Genera y copia directamente el Markdown limpio sin descargar archivos físicos.
  - Formato puro: omite los metadatos de encabezado global, las marcas de tiempo (`> Generated`) y los separadores de archivo, entregando solo el texto seleccionado.
- Removed: **Eliminación del antiguo Smart Copy**.
  - Se eliminó la función obsoleta de "Smart Copy" (atajo `Alt+Shift+C`) en favor del nuevo botón de copia limpio integrado directamente en el modal unificado.

### v2.30.1 (2026-06-12 16:10)
- Fixed: **Corrección de desconfiguración visual (overlapping) en panel de Opciones de Exportación**.
  - Agregado `min-height: 0` y `box-sizing: border-box` en el panel derecho para permitir el scroll vertical de flexbox y evitar desbordamientos.
  - Agregado `height: 0` al contenedor padre del modal para una resolución correcta de altura dinámica.
  - Reducido el alto máximo (`max-height`) de los Tags Favoritos a `100px` para liberar espacio vertical a los selectores de Formato/Estructura.

### v2.30.0 (2026-06-08 21:47)
- Added: **Rediseño global persistente en dos columnas y flexibilidad vertical completa**.
  - La columna derecha de opciones de exportación es ahora global y visible en todas las pestañas ("Por Ramas" y "Por Páginas").
  - Se movió el panel de opciones de formato (Markdown/EPUB y sus sub-ajustes específicos) desde la barra inferior hacia la columna lateral derecha.
  - Se eliminó la barra de formatos inferior, liberando un gran espacio vertical.
  - Se rediseñó el flujo interno de los paneles de formato (Markdown y EPUB) a una disposición vertical amigable e inteligente en la columna lateral de 280px con botones flexibles (`flex: 1`).
  - Se optimizó el espacio vertical de los contenedores de árbol (`#branch-tree-container`) y lista de páginas (`#pages-list-container`) usando `flex: 1` y permitiendo un crecimiento dinámico real para ocupar todo el modal.

### v2.29.0 (2026-06-06 13:25)
- Added: **Rediseño de interfaz de exportación (Smart Export Modal)**.
  - Agrandada la ventana principal (ancho adaptable hasta 1400px o 90vw) para mayor comodidad visual.
  - Aumento de la separación entre la columna del árbol de contenidos y la columna de opciones a `32px`.
  - El panel central (árbol y páginas) ahora aprovecha el 90% del espacio vertical con altura dinámica (`calc(90vh - 250px)`).
  - Compactada la columna de opciones derecha a 260px con menor margen y espaciado (gap 8px, padding 12px).
  - Compactación de la barra de formatos inferior.
  - Reubicación del selector de profundidad y botones de selección masiva en una sola barra horizontal.

### v2.28.0 (2026-05-19 01:30)
- Added: **Buscador interactivo visual de ramas**.
  - Permite filtrar ramas en tiempo real con resaltado visual (`<mark>`) de texto coincidente.
  - Normalización inteligente de acentos y caracteres especiales (búsqueda insensible).
  - Autodespliegue automático de ramas que contienen subcoincidencias.
- Added: **Selección masiva de coincidencias**.
  - Botón dinámico para marcar de un solo golpe todas las ramas visibles resultantes del filtro, respetando y propagando la selección en cascada y estados indeterminados hacia arriba.
- Added: **Administrador dinámico y persistente de Tags Favoritos**.
  - Almacenamiento local mediante `localStorage` de tags favoritos, accesible desde la columna derecha de opciones.
  - CRUD interactivo: añade nuevos tags favoritos directamente con el input e ícono `+` (o pulsando Enter), y elimina tags existentes al instante usando el botón `✕` integrado.
  - Un clic en el chip de un tag autocompleta el buscador principal superior y filtra todo el árbol visual al instante.
- Cleaned: Eliminación de pestaña obsoleta "Por Filtros", input de tag de filtrado redundante de post-procesamiento y variables no utilizadas en la inicialización para evitar cualquier error de ejecución.

### v2.27.0 (2026-05-18 12:26)
- Added: **Selección en cascada inteligente para la pestaña "Por Ramas"**.
  - Al marcar un bloque padre (nivel superior), se seleccionan automáticamente todas sus ramas hijas e indentadas.
  - Al desmarcar un bloque padre, se deseleccionan todos sus descendientes de forma automática.
  - **Estado Indeterminado para Checkboxes**: Si solo algunos sub-bloques de una rama están seleccionados, el checkbox de la rama padre mostrará un estado indeterminado (una barra horizontal `indeterminate`) en lugar de desmarcarse por completo. Esto indica visualmente que la rama contiene elementos seleccionados sin exportar toda la rama.
  - Sincronización hacia arriba: Al desmarcar o marcar un hijo, los padres actualizan su estado (marca completa, marca indeterminada o desmarcado) hacia arriba en el árbol.

### v2.26.0 (2026-05-08 16:55)
- Added: **Rediseño de pestaña "Por Ramas"**. Estructura renovada con layout de dos columnas para optimizar el espacio en pantallas grandes.
  - Columna izquierda: Selector de profundidad y Árbol de ramas (con mayor altura vertical, hasta 55vh).
  - Columna derecha: Panel de opciones de exportación (Nomenclatura, Combinar, Prefijos y Filtros) agrupado visualmente.
  - Modal ampliado: Ancho incrementado a 1100-1200px para evitar el hacinamiento visual de opciones.

### v2.25.0 (2026-05-08 13:43)
- Added: **Combinar en archivo único**. Nueva opción en el tab "Por Ramas" que permite exportar múltiples ramas seleccionadas en un solo archivo Markdown. El contenido se concatena con separadores `---` y encabezados H2 por rama, conservando breadcrumbs de jerarquía. Al activar la opción, se deshabilitan nomenclatura individual y prefijos de orden (no aplican). Se oculta automáticamente cuando el formato es EPUB (ya genera archivo único).

### v2.24.1 (2026-05-06 18:35)
- Improved: **Visualización de Jerarquía de Padres**. En la exportación por ramas, los bloques padres ahora se muestran en un bloque de cita (`>`) al principio del documento. Esto evita la indentación excesiva del contenido principal mientras mantiene el registro completo del contexto original.
- Fixed: Corregido error donde el breadcrumb de padres a veces no se generaba correctamente debido al orden de la API de Roam.

### v2.24.0 (2026-05-06 11:35)
- Added: **Árbol Interactivo en "Por Ramas"**. Ahora los bloques se pueden expandir y colapsar individualmente (▶/▼) o de forma global (Botones Expandir/Colapsar todo).
- Added: **Breadcrumb de padres en exportación**. Los archivos Markdown y EPUB ahora incluyen la ruta jerárquica (Página → Padre 1 → Padre 2) para dar contexto al bloque exportado.
- Fixed: Corregida indentación cuadrática en la vista previa del árbol.

### v2.23.2 (2026-04-16 01:10)
- Fixed: **UI Fix definitiva**. Uso de `flex-shrink: 0` y ajuste de `overflow` para asegurar que el contenido sea desplazable sin ocultar nunca el footer (botones) ni el header.
- Fixed: Restauración de lógica de nomenclatura que fue accidentalmente afectada durante las reparaciones de UI.

### v2.23.1 (2026-04-16 00:46)
- Fixed: **Scroll del Modal**. Se implementó un scroll general como solución rápida para visibilidad de elementos en pantallas pequeñas.

### v2.23.0 (2026-04-16 00:15)
- Added: **Nomenclatura personalizada** en exportación por ramas. Ahora se puede elegir si nombrar los archivos por el contenido del bloque, el nombre de la página, o una combinación de ambos.
- Added: **Vista previa dinámica** del nombre de archivo en el modal de exportación.
- Added: **Prevención de colisiones**: Si se generan nombres duplicados, el sistema añade automáticamente un sufijo numerado (`_2`, `_3`) para evitar sobreescrituras.

### v2.21.1 (2026-03-29 20:40)
- Fixed: Corregido problema de scroll en la pestaña "Por Ramas". Se implementó `min-height: 0` y se ajustó el manejo de `overflow` para asegurar que el footer y las opciones de formato permanezcan visibles y fijos mientras la lista de ramas mantiene su propio scroll.

### v2.20.2 (2026-03-05 01:40)
- Added: Soporte para formato Markdown de Roam en exportación EPUB (**negritas**, __cursivas__, ^^resaltado^^, links, etc).
- Added: Estilos CSS personalizados en EPUB para páginas de Roam y etiquetas.

### v2.20.1 (2026-03-04 14:55)
- Fixed: Extracción e inyección de Heading nativo en exportación Markdown Plano.

### v2.20.0 (2026-03-04 14:35)
- Added: Soporte para exportación en "Markdown Plano" removiendo viñetas e indentación, generando párrafos separados en el modal de Smart Export.

### v2.19.0 (2026-02-20 16:41)
- Changed: Reemplazado generador de EPUB basado en jEpub por un generador manual de EPUB 3.0 para mejor compatibilidad con Kindle ("Send to Kindle").
- Removed: Eliminadas dependencias de EJS y jEpub.

### v2.14.4 (2026-01-22 01:38)
- Fixed: EPUB export error - `book.css is not a function`

### v2.14.3 (2026-01-22 01:26)
- Fixed: Pinned EJS to v3.1.10 for browser compatibility

### v2.14.2 (2026-01-22 01:13)
- Added: EPUB export format with styling options

*Ver `docs/CHANGELOG.md` para historial completo.*
