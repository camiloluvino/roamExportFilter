# Roam Export Filter - Smart Export for Filtered Blocks

Plugin para Roam Research que exporta contenido filtrado usando consultas Datalog. Funciona incluso con bloques colapsados.

## Características

- **Smart Export**: Modal unificado con tres modos (por filtro, por ramas o por selección de páginas).
- **Formatos de Salida**: Exportación a **Markdown Jerárquico**, **Markdown Plano** (párrafos limpios conservando Títulos H1/H2/H3 nativos de Roam) y **EPUB** (con soporte nativo para el formato de Roam).
- **Selección de Páginas**: Tab "Por Páginas" con buscador universal para exportar múltiples páginas del grafo a la vez.
- **Selección de Ramas**: Interfaz visual con botón "Seleccionar todo", **expand/collapse individual (▶/▼)**, botones de **Expandir/Colapsar todo**, filtrado de sub-ramas y nomenclatura personalizada.
- **Ruta de Contexto**: Las exportaciones por ramas incluyen un **breadcrumb o ruta de padres** para saber exactamente de dónde proviene el bloque dentro de la jerarquía.
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

## Desinstalar

```javascript
window.roamExportFilterCleanup();
```

## Licencia

MIT - Camilo Luvino