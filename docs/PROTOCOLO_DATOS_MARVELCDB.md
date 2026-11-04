# Protocolo de adquisición y actualización de MarvelCDB

Fecha de revisión: 2026-11-02. Alcance: cartas de jugador, identidades y referencias necesarias para construir mazos; conservar datos de ambas caras, reimpresiones y textos en inglés y español. Este documento especifica el procedimiento; todavía no existe un importador local.

**Actualización de ejecución:** el texto siguiente conserva la evaluación inicial. El importador y la biblioteca se implementaron posteriormente en esta misma fecha; su alcance real, comandos y límites se documentan en [BIBLIOTECA_LOCAL.md](BIBLIOTECA_LOCAL.md). La validación posterior detectó además imágenes JPEG bajo URLs y MIME PNG. Los estados de verificación histórica de este protocolo no sustituyen los informes actuales de `data/`.

## 1. Resultado y fuentes

**La opción A es técnicamente viable.** Existe un repositorio público de JSON y una API pública destinada expresamente a constructores de mazos y bases de cartas. Las imágenes se obtienen por separado de los JSON del repositorio. La disponibilidad pública no garantiza que cada carta tenga traducción o escaneo.

Fuentes primarias consultadas:

| Fuente | Uso |
| --- | --- |
| [Repositorio de datos](https://github.com/zzorba/marvelsdb-json-data) | Base inglesa, traducciones, catálogos y evolución por commits |
| [JSON de cartas](https://github.com/zzorba/marvelsdb-json-data/tree/master/pack) | Archivos por producto; incluyen también cartas de encuentro |
| [Traducciones españolas](https://github.com/zzorba/marvelsdb-json-data/tree/master/translations/es) | Complementos por código; no son registros completos independientes |
| [Esquema de carta](https://github.com/zzorba/marvelsdb-json-data/blob/master/schema/card_schema.json) | Contratos del repositorio; admite propiedades adicionales |
| [Presentación de la API](https://marvelcdb.com/api/) y [documentación](https://marvelcdb.com/api/doc) | Endpoints públicos, JSON, caché y CORS |
| [Catálogo EN](https://marvelcdb.com/api/public/cards/) | Publicación inglesa y referencias de imágenes |
| [Catálogo ES](https://es.marvelcdb.com/api/public/cards/) | Publicación española; debe compararse por campo |
| [Productos](https://marvelcdb.com/api/public/packs/) | Inventario publicado de productos |
| [Robots](https://marvelcdb.com/robots.txt) | Revisión previa de extracción HTML |

No se necesita OAuth para leer estos endpoints públicos. Guardar mazos en nuestra aplicación puede ser independiente de las cuentas de MarvelCDB. Una integración posterior para escribir allí es otro alcance.

## 2. Qué se comprobó realmente

La evidencia está en [verificacion-marvelcdb-2026-11-02.json](evidencia/verificacion-marvelcdb-2026-11-02.json).

| Consulta | Resultado observado |
| --- | --- |
| `https://marvelcdb.com/api/public/cards/` | HTTP 200; 2.155 registros; 2.155 códigos distintos |
| `https://es.marvelcdb.com/api/public/cards/` | HTTP 200; los mismos 2.155 códigos |
| Unión de claves superiores del catálogo | 85 claves en cada idioma; no todas existen en cada carta |
| Registros sin `imagesrc` | 376 en cada respuesta; no equivale a 376 cartas jugables distintas |
| `https://marvelcdb.com/api/public/packs/` | HTTP 200; 63 productos |
| Imágenes de `01001a` y `01001b` | GET 200, `image/png`, 43.722 y 42.242 bytes |
| Caché de cartas | `public, max-age=600` y `Last-Modified` |
| Rama por defecto del repositorio | `master`; HEAD consultado `44b7f2c9b01faa50f5a96cb40a9c0ecbbace7776` |

Los conteos son una fotografía de la fuente, no un criterio fijo de aceptación ni una garantía de cobertura de todos los productos publicados oficialmente. El endpoint incluye identidades, reimpresiones y algunos tipos de encuentro asociados; **2.155 no significa 2.155 opciones libres para cualquier mazo**.

Ejemplo comprobado: `01001a` devuelve `Spider-Man` / `Spiderman`, `Avenger.` / `Vengador.` y habilidad traducida. En ES, `real_name`, `real_text` y `real_traits` conservan valores ingleses en esa muestra. No usar esos campos como sustituto universal de la descarga EN.

Hay una diferencia importante entre el `linked_card` anidado y la carta obtenida como registro independiente: el Peter Parker anidado en la consulta individual ES de Spider-Man devolvió texto inglés; el registro superior `01001b` del catálogo ES sí devolvió texto español. Resolver relaciones por código y preferir los registros superiores de cada idioma. Conservar el original anidado como evidencia, sin duplicarlo en el catálogo normalizado.

No se comprobó la disponibilidad de todas las imágenes, la exactitud lingüística de todo el español, ni la equivalencia exhaustiva entre Git y la base servida. Los textos distintos entre EN y ES por sí solos no certifican una traducción completa.

## 3. Definición de datos completos

Importar **todo el objeto disponible**, incluidos campos desconocidos, y construir encima una representación para consultas. No reducir la importación a los campos que inicialmente aparecen en la interfaz.

| Familia | Campos reales encontrados o documentados |
| --- | --- |
| Identidad y origen | `code`, `name`, `subname`, `pack_code`, `position`, `quantity`, `url`, `octgn_id` |
| Clasificación | `type_code`, `faction_code`, `traits`, `set_code` en Git; `card_set_code` y metadatos de conjunto en API |
| Texto | `text`, `flavor`, `back_text`, `back_name`, `errata`; `real_*` en API |
| Costos y recursos | `cost`, `cost_star`, `cost_per_hero`, `resource_energy`, `resource_physical`, `resource_mental`, `resource_wild` |
| Estadísticas | `attack`, `thwart`, `defense`, `recover`, `health`, `hand_size`, costos de activación y marcadores de asterisco |
| Construcción | `deck_limit`, `deck_options`, `deck_requirements`, `restrictions`, `is_unique`, `permanent`, `hidden` |
| Relaciones | `back_link`, `duplicate_of` en Git; `linked_to_code`, `linked_card`, `duplicate_of_code`, `duplicated_by` en API |
| Imágenes | `imagesrc`, `backimagesrc` en API |

El inventario exacto observado de 85 claves está en la evidencia JSON. La tabla agrupa datos; no es una lista cerrada ni afirma que todos los campos estén presentes en todos los registros.

Preservar `code` como cadena con ceros y sufijos (`01001a`). Preservar `null`, ausencia de campo, cero y valores variables: `cost: -1` se representa como X según el README de la fuente, no como costo negativo ni cero. `quantity` es cantidad del producto y `deck_limit` es límite de construcción; ninguna indica cuántas copias posee el usuario. Los textos contienen HTML e iconos como `[mental]`: mantener original y derivar texto de búsqueda; sanitizar al mostrar.

## 4. Organización propuesta de la descarga

Esta estructura es una propuesta para el futuro importador; no describe carpetas ya implementadas:

```text
sources/marvelsdb-json-data/          clon intacto de la fuente
data/raw/<revision>/                 respuestas/API y JSON originales
data/catalog/<revision>/             normalización y traducciones por código
data/manifests/<revision>.json       procedencia y estado de la importación
data/images/sha256/<hash>.<ext>       imágenes verificadas, sin sobrescribir
data/reports/<revision>.json         altas, cambios, faltantes y errores
```

El manifiesto debe registrar: versión del protocolo/esquema, commit Git, URL y locale de cada respuesta, fecha UTC, `Last-Modified`/`ETag` cuando existan, hash del contenido, cantidad de registros y resultado de validaciones. Cada imagen: código, cara, idioma solicitado y verificado o desconocido, URL original/final, tipo MIME, bytes, hash, fecha y estado (`ok`, `missing`, `failed`, `unverified_language`). No inferir idioma de la imagen por el idioma del texto.

## 5. Opción A — descarga inicial

### 5.1 Capturar una revisión reproducible

Desde la raíz del proyecto, estos comandos estándar sirven para obtener el repositorio. No se ejecutaron durante esta revisión:

```powershell
git clone https://github.com/zzorba/marvelsdb-json-data.git sources/marvelsdb-json-data
git -C sources/marvelsdb-json-data rev-parse HEAD
```

Registrar ese SHA antes de importar. Leer todos los archivos de una misma revisión inmóvil: no hacer `pull` durante una importación. En una ejecución futura, usar un checkout separado del commit o materializar su árbol en una carpeta nueva.

Importar `pack/*.json`, `translations/es/pack/*.json` y catálogos raíz `packs.json`, `types.json`, `factions.json`, `sets.json`, `settypes.json`, `subtypes.json`, `packtypes.json`, junto con sus traducciones ES cuando existan. Mantener el esquema y la revisión fuente para reproducir las validaciones. No hace falta instalar dependencias del sitio para leer JSON.

### 5.2 Clasificar jugador, identidades y referencias

Conservar la fuente completa y producir tres conjuntos derivados: identidades seleccionables, cartas candidatas a mazo y referencias relacionadas que no se añaden al mazo del jugador. Usar los códigos de tipo, aspecto y conjunto, no el nombre traducido. Aliados, eventos, mejoras, apoyos, recursos y planes secundarios de jugador son tipos relevantes; sus reglas particulares se resuelven después.

La pertenencia a un conjunto de héroe no basta para afirmar que una carta se incluye en el mazo. No descartar registros `hidden`: pueden ser reversos o formas necesarias. Tampoco asumir que todo lo que devuelve `/cards/` es seleccionable. Tipos nuevos o combinaciones desconocidas deben quedar señalados para clasificación y conservarse en bruto.

**Pendiente previo a implementar la selección:** validar una correspondencia explícita entre tipos, aspectos y conjuntos de la fuente y los tres conjuntos derivados, contrastándola con las excepciones de cartas reales. Esta revisión no verificó la lógica exacta del controlador de MarvelCDB. Hasta completar esa validación, el importador puede conservar todos los registros, pero no afirmar que el subconjunto seleccionable está certificado.

### 5.3 Construir inglés y español sin pérdida

Unir registros por `code`. La base estructural es EN; el archivo ES aporta campos traducidos. Para cada campo lingüístico, mantener valor EN, valor ES si existe y procedencia. Ausencia ES permite fallback visible a EN; una cadena vacía explícita no debe confundirse automáticamente con ausencia. No reemplazar estadísticas con una traducción. Si una traducción introduce campos estructurales discrepantes, registrar conflicto y revisar.

La cobertura debe reportarse por campo: nombre, subtítulo, texto, rasgos, sabor y reverso; indicar `present`, `missing`, `fallback_en` o `needs_review`. EN y ES iguales pueden ser correctos para nombres propios; no etiquetar automáticamente como error.

Para imágenes y contraste de publicación, consultar los dos catálogos API y productos, guardando respuestas originales. Rutas verificadas:

```text
GET https://marvelcdb.com/api/public/cards/
GET https://es.marvelcdb.com/api/public/cards/
GET https://marvelcdb.com/api/public/packs/
GET https://marvelcdb.com/api/public/card/01001a
GET https://es.marvelcdb.com/api/public/card/01001a
```

La documentación también ofrece `/api/public/cards/{pack_code}` para consultar un producto. No se comprobó su respuesta durante esta ejecución. Puede reducir consultas de contraste a productos afectados, pero revisar solo productos nuevos no detecta cartas añadidas posteriormente a un producto existente.

Si una carta existe en Git pero todavía no en API, conservarla con estado de publicación/imagen pendiente. Si existe en API pero no en Git, conservarla como registro de origen API separado y registrar la divergencia. No fusionar silenciosamente dos versiones contradictorias. Para campos estructurales se propone Git como base; para imágenes, API; cualquier excepción queda trazada.

### 5.4 Obtener imágenes de referencia

1. Para cada registro superior y cada cara relacionada, leer `imagesrc`/`backimagesrc`. Resolver URL relativa contra el origen de la respuesta. **No generar rutas a partir del código**, porque hay imágenes ausentes y excepciones.
2. Priorizar el catálogo EN según la preferencia inicial del proyecto. El idioma del texto de interfaz seguirá siendo independiente. Un futuro archivo ES se añade como otro recurso.
3. Crear cola de URLs únicas; reutilizar el mismo archivo local si varias cartas apuntan al mismo contenido. Empezar con una solicitud simultánea y una pausa propuesta de un segundo entre descargas. No es un límite oficial publicado.
4. Descargar a temporal; verificar HTTP 200, MIME de imagen y decodificación válida. Una página HTML con status 200 no es una imagen válida. Calcular SHA-256 y tamaño; mover a almacenamiento por hash solo después de validar.
5. Registrar frente, reverso o forma por separado. `double_sided`, cartas enlazadas y `backimagesrc` son mecanismos distintos: no fabricar una segunda carta al interpretar un reverso.
6. Sin URL: estado `missing` y ficha visual con nombre, atributos y texto. Si una relación explícita de reimpresión permite mostrar otra impresión como referencia, identificarla visualmente y conservar que falta el escaneo de la impresión elegida; no afirmar que es la misma imagen. Error transitorio: estado `failed` y reintento posterior. Una imagen faltante no debe bloquear los datos ni eliminar la carta.

Dos URLs reales comprobadas:

- [Spider-Man](https://marvelcdb.com/bundles/cards/01001a.png).
- [Peter Parker](https://marvelcdb.com/bundles/cards/01001b.png).

Los dos archivos se consultaron para verificar bytes y hashes; no se guardó una biblioteca de imágenes. El protocolo definitivo debe medir espacio con una muestra representativa antes de descargar toda la colección; dos ejemplos no bastan para estimar el total.

### 5.5 Validar y activar

Validar JSON y esquema de fuente donde aplique; el esquema de Git no se aplica sin adaptación al objeto de la API. Conservar propiedades adicionales. Verificar códigos únicos por origen/idioma, referencias resolubles o faltantes explícitos, relaciones sin ciclos inesperados, estadísticas preservadas y conteos por tipo/aspecto/producto. No confundir una duplicación de impresión con un error de código.

Generar reporte de cobertura ES e imágenes y revisar muestras de héroe/alter ego, reimpresión, costo X, rasgos, requisitos especiales y carta sin imagen. Activar el catálogo en una operación local atómica solo si no hay errores bloqueantes. Si falla, conservar el catálogo anterior y la descarga temporal para diagnóstico. Los mazos guardados no cambian por importar una nueva revisión del catálogo.

## 6. Actualización incremental: solo lo que no tenemos

Definición: una carta nueva es un `code` ausente del catálogo local, no un nombre desconocido ni un producto de fecha reciente. Esto permite incorporar cartas tardías de productos existentes y reimpresiones con códigos nuevos.

### 6.1 Detección por Git

En el clon de fuente, con el SHA importado guardado en el manifiesto:

```powershell
git -C sources/marvelsdb-json-data fetch origin
git -C sources/marvelsdb-json-data rev-parse origin/master
```

Guardar el resultado como SHA candidato. Comparar dos SHA concretos; las siguientes variables se rellenan desde manifiestos, no con valores inventados:

```powershell
git -C sources/marvelsdb-json-data diff --name-status $previousCommit $candidateCommit -- pack translations/es packs.json types.json factions.json sets.json settypes.json subtypes.json packtypes.json
```

Si el commit anterior no existe localmente, el historial cambió o no puede resolverse el diff, comparar snapshots completos por código y hash; no adivinar el delta. Usar el árbol del SHA candidato para leer JSON, sin modificar el árbol importado anterior. El diff de archivos identifica candidatos; una modificación de archivo no implica que todas sus cartas sean nuevas.

### 6.2 Aplicación de altas

En este algoritmo, `source_codes` es la unión de códigos del árbol Git candidato y del snapshot API vigente. Comparar ambos inventarios en cada ciclo de actualización, incluso sin cambios Git, revalidando la API según su caché. Esto permite detectar altas publicadas únicamente en la API. Mantener las dos procedencias y resolver divergencias según §5.3; para cartas exclusivas de API, no inventar un registro Git.

Pseudocódigo de comportamiento propuesto, no un comando ya implementado:

```text
source_codes = git_candidate_codes UNION api_snapshot_codes
new_codes = source_codes - local_codes
for code in new_codes:
    importar EN + ES disponible + relaciones + procedencia
    incorporar catálogos y referencias requeridas que falten
    buscar metadatos de imagen en snapshot API
    descargar solo URLs/archivos que no estén disponibles localmente
reportar cambios detectados en códigos existentes sin aplicarlos
validar, generar manifiesto de altas y activar atómicamente
```

No reescribir cartas existentes en este modo. Una relación nueva que apunte a una carta ya existente se enlaza a esa carta; una referencia no resoluble se informa. Detectar también archivos ES nuevos, pero su contenido para códigos existentes se informa como traducción pendiente, no se altera silenciosamente en una operación de solo altas.

### 6.3 Modo separado de sincronización de correcciones

Recomendado para mantenimiento, pero distinto del modo solicitado de solo nuevas. Compara hashes normalizados por `code` y por idioma; clasifica altas, cambios, traducciones añadidas, imágenes nuevas/cambiadas y desapariciones. Aplica cambios creando una revisión y conservando la anterior; nunca borra automáticamente una carta ausente de la fuente ni modifica cantidades de mazos.

Una actualización de ES o una imagen añadida puede llegar sin cambios en los JSON ingleses. Por eso debe revisarse el catálogo API y la cola de imágenes faltantes aunque Git no tenga novedades. Para cambios de una imagen bajo la misma URL, revalidar por cabeceras si están disponibles y, si no hay validadores fiables, hacer reconciliación periódica del contenido. No puede detectarse una sustitución solo comparando URLs.

### 6.4 Límites del delta remoto

La API pública documentada no ofrece aquí un endpoint comprobado de “cartas creadas desde fecha X”. No prometer que solo se transferirán los JSON de códigos nuevos. Git permite descargar cambios del repositorio; un snapshot API puede volver a transferir todo el listado y luego filtrar localmente. **La escritura local y la descarga de imágenes sí pueden limitarse a altas y recursos faltantes.**

Guardar validadores por URL/idioma. Tras vencer `max-age`, enviar `If-Modified-Since` y `If-None-Match` únicamente si se recibieron sus cabeceras. En 304 usar el snapshot local; en 200 validar y comparar. `Last-Modified` se observó; no se verificó aún una respuesta 304 ni presencia de ETag. Si el servidor omite o aplica mal validadores, recurrir a contenido/hash; mantener separados los validadores del catálogo y los de las imágenes.

## 7. Fallos, idempotencia y recuperación

- Segunda ejecución con la misma revisión: cero altas y cero imágenes ya verificadas descargadas de nuevo. Se puede guardar una nueva marca de consulta sin duplicar cartas.
- Interrupción: reanudar por manifiesto y cola; no confiar solo en que existe un archivo temporal.
- 429: respetar `Retry-After`; 5xx/red intermitente: pocos reintentos con espera creciente; 401/403 o desafío anti-bot: detener esa vía y registrar la causa. No eludir bloqueos.
- Fuente incompleta o caída: trabajar con último catálogo válido y reportar estado. No interpretar una respuesta vacía o HTML como borrado de todo el catálogo.
- Fallo de ES: conservar EN y reportar cobertura pendiente; no marcar inglés como español.
- Cambio de esquema: conservar bruto y detener la transformación afectada si altera contratos necesarios.
- Recuperación: volver a apuntar a la revisión anterior; mazos y anotaciones propias permanecen separados y nunca se eliminan al sincronizar.

## 8. Opción B — scraping HTML como respaldo

**Viable técnicamente para la información que la página renderiza, con menor fidelidad y mayor mantenimiento.** La [ficha de Spider-Man](https://marvelcdb.com/card/01001a) expone texto, atributos, vínculo de alter ego e imágenes. Esto no demuestra que todos los campos internos del JSON puedan reconstruirse desde HTML.

El `robots.txt` observado respondió 200 con comentarios y `User-agent: *`, sin reglas `Disallow`. Esto es una observación del archivo consultado, no una licencia sobre imágenes o textos. Reconsultar EN y ES antes de cada extracción HTML y verificar las condiciones vigentes. La [API](https://marvelcdb.com/api/) reconoce derechos sobre los textos y el [pie del sitio](https://marvelcdb.com/) sobre contenido literal y gráfico. No asumir que el carácter público del repositorio concede derechos sobre el arte.

Procedimiento alternativo propuesto:

1. Obtener listado de códigos/enlaces desde las búsquedas públicas y su paginación, sin enumerar números al azar. Si la API sigue disponible, usarla antes que rastrear HTML.
2. Recorrer solo páginas de cartas EN y ES; excluir reseñas, comentarios, perfiles y mazos de terceros. Guardar URL, hora, HTML original y hash.
3. Extraer nombre, subtítulo, tipo, rasgos, estadísticas, texto de reglas, producto, código y caras relacionadas mediante selectores verificados contra el HTML real.
4. Extraer los `src`/enlaces de imágenes observados; resolver URLs relativas. Aplicar el mismo manifiesto de imágenes que en A.
5. Usar parsers por versión de plantilla y pruebas con muestras guardadas. No copiar texto de opiniones como reglas ni confundir el texto de una cara con otra.
6. Comparar por código y hashes, aplicar el mismo modo de altas y registrar campos no recuperables como desconocidos, nunca como cero o falso.
7. Respetar caché, pausa, errores y límites; no hace falta automatizar sesiones autenticadas para esta evaluación.

No se implementaron ni probaron selectores de extracción, recorrido completo, paginación o scraping masivo. Si una plantilla deja de exponer un campo, el respaldo queda incompleto: debe indicarlo y no sustituir silenciosamente un registro más rico. No usar OCR como fuente principal de atributos.

## 9. Criterios de aceptación del futuro importador

1. Conserva todos los campos originales y puede reconstruir qué fuente/revisión produjo cada dato.
2. Une EN/ES por código sin duplicar la carta y muestra cobertura por campo.
3. Conserva reversos, formas, reimpresiones y referencias especiales.
4. El modo de altas no cambia los hashes de registros existentes.
5. Detecta altas tardías dentro de un producto existente; no depende solo de `packs.json` o fechas.
6. Una segunda ejecución no crea duplicados ni repite descargas de imágenes verificadas.
7. No pierde cartas ni mazos ante un fallo, desaparición en origen o imagen faltante.
8. Puede volver a una revisión anterior y reanudar una descarga interrumpida.
9. Distingue datos importados, correcciones propias, reglas derivadas y elementos pendientes.
10. Reporta cobertura de jugador realmente seleccionable; no usa el total bruto como sinónimo de cartas legales.

Estas son pruebas requeridas para la futura implementación. Hoy solo se verificaron consultas y muestras indicadas en la sección 2.
