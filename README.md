# Marvel 2.0 — biblioteca de jugador

La copia preparada en `dist/` se puede abrir con **Lanzar servidor local.cmd** en Windows o con `npm run gestor:servir` usando Node.js 22 o posterior. Para subir el proyecto, seguir el [protocolo de publicación privada en GitHub](docs/PUBLICACION_GITHUB.md).

Primera versión del **gestor visual de mazos** disponible en `web/`. Preparar con `npm run gestor:preparar` y abrir con `npm run gestor:servir`. Incluye filtros, grupos manuales, versiones, importación/exportación y mazos armados. Instrucciones y límites: [Gestor de mazos](docs/GESTOR_MAZOS.md). Aún sin publicación ni análisis de compatibilidad.

La opción A es viable: datos públicos estructurados de MarvelCDB mediante repositorio Git y API. Se recomienda repositorio como base versionada, API para contrastar la publicación y descubrir imágenes, y scraping HTML como respaldo.

Documentación y datos del proyecto:

- [Protocolo de adquisición y actualización](docs/PROTOCOLO_DATOS_MARVELCDB.md): fuentes, inglés/español, imágenes, altas incrementales, correcciones y alternativa de scraping.
- [Propuesta del constructor y compatibilidad](docs/PROPUESTA_CONSTRUCTOR.md): primer alcance visual, modelo de datos y evolución hacia reglas explicables.
- [Evidencia de consultas reales](docs/evidencia/verificacion-marvelcdb-2026-11-02.json): conteos, campos observados, cabeceras, muestras bilingües y dos imágenes comprobadas.
- [Biblioteca local y comandos](docs/BIBLIOTECA_LOCAL.md): alcance implementado, formato, imágenes y mantenimiento.
- [Entrada del catálogo](data/current.json): apunta a la revisión activa y sus reportes.

El importador ya conserva el catálogo de jugador EN/ES, imágenes disponibles, trazabilidad y revisiones. Excluye campaña y encuentros del catálogo activo. La biblioteca separa cartas de mazo, identidades/formas y auxiliares de héroe. El constructor visual tiene una primera versión local; la compatibilidad sigue como propuesta.

Biblioteca completada: **2.009 registros** y **2.010 caras con referencia visual local**: 1.690 escaneos propios y 320 referencias de reimpresiones identificadas. Las imágenes combinan archivos de MarvelCDB, su CDN original y paquetes comunitarios con hashes y procedencia. No quedan imágenes pendientes.

Validación: 11 pruebas de regresión, códigos/relaciones/alcance, hashes y decodificación de 1.693 archivos de imagen. La repetición de importación conservó los 2.009 registros sin altas, cambios ni descargas nuevas. Evidencia: [verificación](data/validation/latest.json) e [idempotencia](data/validation/idempotencia.json).
