# Project Status - Roam Export Filter

> **Última actualización**: 2026-05-06 18:35

---

## Versión actual

**2.24.1** (2026-05-06 18:35)

---

## Estado de funcionalidades

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| **Smart Export** | ✅ Estable | Modal unificado con 3 pestañas y buscador de páginas |
| **MD Export** | ✅ Estable | Exporta a Markdown en formato Jerárquico o Plano |
| **EPUB Export** | ✅ Estable | Exporta a formato EPUB 3.0 con soporte de Markdown |
| **Smart Copy (Alt+Shift+C)** | ✅ Estable | Copia bloques visualmente seleccionados |
| **Export by Root Blocks** | ✅ Estable | Exporta cada bloque raíz como archivo separado |
| **ZIP Export (>5 files)** | ✅ Estable | Bundling automático con JSZip |
| **Custom Naming** | ✅ Estable | Opciones de nomenclatura y prevención de duplicados |

---

## Problemas conocidos

- [ ] `DEBUG = true` en código — Cambiar a `false` antes de release de producción

---

## Próximos pasos

- [ ] Considerar agregar "Export by Root Blocks" al modal unificado
- [ ] Probar con páginas muy grandes (>100 bloques)

---

## Historial reciente

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
