# Roam Export Filter - Smart Export for Filtered Blocks

Plugin para Roam Research que exporta contenido filtrado usando consultas Datalog. Funciona incluso con bloques colapsados.

## Características

- **Smart Export**: Modal unificado con tres pestañas de alta interacción (Por Ramas, Por Páginas y Presets).
- **Presets (Selecciones Guardadas)**: Pestaña dedicada para guardar y reutilizar selecciones de bloques cross-page. Permite copiar el texto Markdown u obtener los UIDs en formato `((uid))` directamente al portapapeles sin abrir la página original, y cargar selecciones de forma interactiva con navegación y auto-apertura del modal automatizada.
- **Copiar UIDs**: Opción "🔗 Copiar UIDs" en el footer para copiar referencias en formato `((uid))` de todos los bloques seleccionados (o referencias `[[Página]]` en la pestaña de Páginas).
- **Filtro Jerárquico Interactivo**: Buscador en tiempo real integrado directamente en el árbol de ramas. Permite búsquedas insensibles a acentos y mayúsculas, autodespliegue automático de ramas que contienen coincidencias, resaltado visual del texto coincidente mediante marcas de alta visibilidad, y selección en lote de coincidencias con propagación inteligente en cascada.
- **Administrador de Tags Favoritos Persistente**: Panel premium integrado en la columna derecha de opciones que permite gestionar (agregar, usar, y eliminar) tus etiquetas favoritas de forma persistente utilizando el `localStorage` del navegador, permitiendo autocompletar e iniciar el filtro interactivo del árbol con un solo clic.
- **Formatos de Salida**: Exportación a **Markdown Jerárquico**, **Markdown Plano** (párrafos limpios conservando Títulos H1/H2/H3 nativos de Roam) y **EPUB** (con soporte nativo para el formato de Roam).
- **Selección de Páginas**: Tab "Por Páginas" con buscador universal para exportar múltiples páginas del grafo a la vez.
- **Selección de Ramas**: Interfaz visual con **diseño organizado en dos columnas**, botón "Seleccionar todo", **expand/collapse individual (▶/▼)**, botones de **Expandir/Colapsar todo**, y nomenclatura personalizada.
- **Ruta de Contexto**: Las exportaciones por ramas incluyen un registro de la **Jerarquía original** (bloques padres) en formato de cita al inicio del archivo, permitiendo conservar el contexto sin afectar la indentación del contenido principal.
- **Soporte total**: Funciona en cualquier página, incluyendo **Daily Notes**.
- **ZIP automático**: Bundling cuando hay >5 archivos

## Comandos

| Comando | Activación | Descripción |
|---------|------------|-------------|
| **Smart Export** | Command Palette | Modal unificado de exportación |
| **Smart Copy Selected Blocks** | `Alt+Shift+C` | Copia bloques seleccionados (azules) |
| **Export by Root Blocks** | Command Palette | Cada bloque raíz como archivo separado |

## Instalación (CDN - Recomendada)

1. Ve a la página `[[roam/js]]` en tu grafo
2. Crea un bloque `{{[[roam/js]]}}`
3. Añade un code block con:

```javascript
var s = document.createElement('script');
s.src = 'https://camiloluvino.github.io/roamFilter/roam-filter.js?v=' + Date.now();
s.type = 'text/javascript';
document.head.appendChild(s);
```

4. Refresca la página

### Desarrollo Local (Opcional)

Si estás modificando el código localmente, puedes usar el script `roam_loader.js` (cargándolo localmente en tu navegador) para probar los cambios sin necesidad de hacer push a GitHub Pages cada vez.

## Desinstalar

```javascript
window.roamExportFilterCleanup();
```

## Licencia

MIT - Camilo Luvino