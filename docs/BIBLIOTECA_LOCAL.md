# Biblioteca local de jugador

La biblioteca se importa desde `zzorba/marvelsdb-json-data` y la API pública EN/ES de MarvelCDB. La entrada estable para consumirla es [data/current.json](../data/current.json). Apunta a una revisión del catálogo, índices, imágenes, taxonomías, manifiesto y reporte.

Estado verificado el 2 de noviembre de 2026: **2.009 registros de jugador**: 1.843 cartas de mazo, 145 registros de identidades/formas y 21 auxiliares. Sus 2.010 caras/referencias visuales se resuelven localmente: 1.690 con escaneo propio y 320 con referencia identificada de otra impresión. No quedan descargas pendientes. El número de caras incluye un reverso adicional de una carta de doble cara; no equivale al número de cartas físicas distintas.

## Alcance implementado

- Cartas de mazo: aliados, eventos, apoyos, mejoras, recursos y planes secundarios de jugador, en las facciones `hero`, `basic`, `aggression`, `justice`, `leadership`, `protection` y `pool`.
- Identidades: héroes, alter egos y formas adicionales, incluidas caras `hidden`.
- Auxiliares: conjuntos `hero_special` y vínculo con el héroe padre. No se mezclan con las cartas del mazo normal.
- Se excluyen del catálogo activo las facciones `encounter` y `campaign`. No se descargan sus imágenes.

La fuente Git intacta y los snapshots API pueden contener datos fuera de alcance para conservar procedencia y permitir auditar la clasificación; no son la biblioteca activa. El importador detiene la publicación si encuentra una combinación de jugador que no sabe clasificar.

La clasificación se contrastó con [CardRepository.php](https://github.com/zzorba/marvelsdb/blob/master/src/AppBundle/Repository/CardRepository.php), [ui.deckedit.js](https://github.com/zzorba/marvelsdb/blob/master/src/AppBundle/Resources/public/js/ui.deckedit.js) y los conjuntos `hero_special` de la fuente. `/api/public/cards/` excluye encuentro pero incluye campaña; por eso se aplica un filtro local adicional.

Los registros son impresiones y caras, no copias poseídas ni opciones legales para cualquier héroe. La biblioteca no implementa todavía reglas completas de construcción, guardado de mazos o puntajes de compatibilidad.

## Cómo leerla

1. Leer `data/current.json`.
2. Abrir la ruta indicada en `catalog`; contiene `cards` con registros por código.
3. Cada registro conserva `en`, `es`, `translation_coverage`, `links`, `role`, `images` y `source`.
4. Consultar `index`: listas de códigos de `identities`, `deck_cards` y `hero_auxiliaries`.
5. Consultar `images` para encontrar archivos locales y estados; las rutas `file` son relativas a la raíz del proyecto.

`deck_cards` incluye las caras conservadas de las cartas; una futura interfaz debe agrupar `links.other_face` y respetar `hidden`, no contar cada cara como una copia independiente. `quantity` procede del producto; no es inventario del usuario.

`source` conserva los objetos Git/API originales. `en` combina API y atributos Git resueltos; `es` conserva la misma estructura con textos localizados. Las reimpresiones heredan campos de `duplicate_of`, pero conservan su código, producto, posición y cantidad. Se mantienen relaciones entre caras en ambos sentidos.

El reporte `source_field_conflicts` conserva discrepancias estructurales. Se confirmó una: `62034`, Size Advantage, figura como Justicia en Git, pero la API y el escaneo impreso indican Agresividad. La [corrección local](../data/overrides/cards.json) aplica Agresividad y conserva la evidencia y los valores originales. Esta capa es independiente del clon de fuente y se mantiene al actualizar.

La cobertura se indica por campo. `present` significa traducción presente en Git, no revisión editorial; `present_unreviewed` indica una diferencia localizada observada en API; `fallback_en` conserva el inglés cuando falta traducción identificable. Un nombre propio idéntico en ambos idiomas no demuestra un error. Los campos `real_*` conservan su función original y pueden seguir en inglés. Los originales completos permiten revisar discrepancias sin perder información.

## Imágenes

Se solicitan en inglés desde las referencias de MarvelCDB y su CDN original. Se registra `requested_locale: en` y `verified_language: unknown`: no se ha hecho una revisión manual del idioma de cada escaneo. Las imágenes no se traducen automáticamente.

La fuente alternativa está documentada en el propio [ImportImagesCommand.php](https://github.com/zzorba/marvelsdb/blob/master/src/AppBundle/Command/ImportImagesCommand.php): `lcgcdn.s3.amazonaws.com/mc/`, usando `packs.cgdb_id`, posición y variantes A/B. Se comprobó que el archivo de Spider-Man del CDN tiene el mismo SHA-256 que el servido por MarvelCDB. Se conserva siempre la URL publicada por la API y la URL que entregó los bytes. No se adivinan variantes C–F ni rutas sin identificador de producto confirmado.

Un candidato derivado que responde 403/404 se registra y no se reintenta ni se intenta autenticar. Esto no afirma que la carta carezca de escaneo: la URL pública e independiente de la API sigue siendo una fuente posible. Un 401 o un 403 de las referencias directas detiene la vía de descarga. La descarga predeterminada usa las URLs publicadas por la API. `--solo-cdn` permite obtener solo los objetos públicos del CDN y dejar las demás referencias como `pending_download`; `--usar-cdn` permite priorizar esos candidatos y después consultar la URL original. Su cobertura es parcial y no se recomienda rastrear candidatos indiscriminadamente.

Los archivos se guardan por SHA-256 y **formato real**, después de decodificar sus píxeles con `sharp`. Se comprobó que el servidor devuelve JPEG en URLs `.png` con `Content-Type: image/png`; por eso no se confía en la extensión remota ni solo en MIME. El índice conserva tanto el formato detectado como el MIME anunciado.

Estados en el snapshot de imágenes:

| Estado | Significado |
| --- | --- |
| `ok` | Archivo propio descargado, hash comprobado y píxeles decodificados |
| `missing_url` | La fuente no ofrece URL propia de esa impresión/cara |
| `pending_download` | Hay URL pero todavía no se descargó |
| `failed` | La última descarga o verificación local falló; conserva motivo |
| `reference_only` | Imagen de otra impresión identificada mediante relación explícita |

Una reimpresión sin imagen propia puede incluir `reference_image` de su original documentado. Tiene código y etiqueta explícitos: es otra impresión, no el escaneo exacto faltante. Las cartas sin recurso ni referencia deben mostrarse con una ficha de texto.

### Complemento de escaneos comunitarios

Ante fallos de conectividad de MarvelCDB, se complementó la biblioteca con los paquetes públicos de [sdolle1775/marvel-lcg](https://github.com/sdolle1775/marvel-lcg), catálogo `artwork-2026-10-18-1`, fijado al commit `253a9df03ec0d10e26493df631a5293bdd8d7f5a`. Su [manifiesto](https://raw.githubusercontent.com/sdolle1775/marvel-lcg/253a9df03ec0d10e26493df631a5293bdd8d7f5a/data/artwork-manifest.json) relaciona códigos, alias, hashes, formatos y paquetes. No se ejecutó su aplicación ni sus scripts.

Se descargaron 63 paquetes necesarios, se comprobaron sus hashes y se extrajeron **solo 1.394 caras de nuestra selección de jugador**. Los ZIP originales se conservan como respaldo en `data/raw/community/packs/`; pueden contener miembros de encuentro de la fuente, pero esos miembros no se extrajeron a la biblioteca de imágenes activa. Se preservaron los archivos ya descargados de MarvelCDB y su CDN. Las 24 imágenes que faltaban en el manifiesto comunitario se descargaron de las URLs publicadas por MarvelCDB.

Los escaneos comunitarios se identifican en `data/images/community-index.json`, con URL y hash del manifiesto, URL/hash del paquete, miembro exacto, código y dimensiones. La atribución de origen —Unicorn Snuggler y colaboradores del Workshop— se conserva en `data/raw/community/source.json`. Se diferencian de los archivos servidos directamente por MarvelCDB.

Los alias conservan `reference_only` y `reference_image`; no se presentan como escaneos propios. Tanto al importar datos como al completar imágenes se verifican existencia y hash antes de publicar disponibilidad local. La verificación completa vuelve a decodificar los píxeles de cada archivo referenciado.

No se inventan URLs para imágenes ausentes. El diario `data/images/downloads.jsonl` permite reanudar después de una interrupción. Los archivos corruptos detectados se conservan en cuarentena antes de reconstruirlos.

## Comandos disponibles

Requiere Node.js 22 o superior, Git, `sharp` 0.35.5 y `jszip` 3.10.1. En esta ejecución se usaron las dependencias ya incluidas en el runtime de Codex; no se instaló otra copia. En otra máquina, instalar las dependencias declaradas con `npm install`. El programa busca primero la dependencia del proyecto y después la del runtime de Node.

Desde la raíz del proyecto:

```powershell
# Añadir solo códigos nuevos y descargar imágenes faltantes; conserva cartas existentes.
node scripts/importar-biblioteca.mjs

# Añadir solo datos, sin iniciar descargas de imágenes.
node scripts/importar-biblioteca.mjs --solo-datos

# Aplicar correcciones y traducciones a una nueva revisión; revalida imágenes por HTTP.
node scripts/importar-biblioteca.mjs --sincronizar

# Reintentar imágenes faltantes y revalidar también las ya existentes.
node scripts/importar-biblioteca.mjs --revalidar-imagenes

# Reanudar imágenes usando el catálogo API ya capturado, sin refrescar los datos.
node scripts/importar-biblioteca.mjs --imagenes

# Completar faltantes desde los paquetes comunitarios fijados, sin reemplazar imágenes válidas.
node scripts/completar-imagenes.mjs

# Reconstrucción/comprobación desde los snapshots locales, sin consultas de red.
node scripts/importar-biblioteca.mjs --offline

# Comprobar biblioteca, hashes, relaciones y decodificación de todos los archivos referenciados.
node scripts/verificar-biblioteca.mjs

# Pruebas de regresión del importador.
node --test tests/biblioteca.test.mjs
```

El intervalo predeterminado es de un segundo, con una descarga simultánea. La adquisición inicial permite `--interval-ms=250 --concurrency=4`: no supera cuatro inicios por segundo ni cuatro descargas activas. Son límites locales, no cuotas oficiales. Se respetan las esperas `Retry-After` globalmente; 401/403 detienen nuevos accesos. No ejecutar dos instancias del importador al mismo tiempo.

## Actualizar la fuente Git

El importador lee el clon local y registra su SHA; no cambia Git por su cuenta. Para consultar novedades del repositorio, actualizarlo antes de importar:

```powershell
git -C sources/marvelsdb-json-data pull --ff-only
node scripts/importar-biblioteca.mjs
```

La API se contrasta en cada ciclo según su caché, incluso si Git no cambia. Se detectan códigos presentes en cualquiera de las fuentes. No existe aquí un delta remoto por carta: puede transferirse un snapshot JSON completo y luego aplicar solo las altas localmente. Las cartas existentes con cambios se reportan, pero solo se actualizan con `--sincronizar`.

`--sincronizar` conserva las revisiones anteriores y nunca borra automáticamente cartas desaparecidas de la fuente. No hay datos de mazos ni anotaciones propias dentro de esta biblioteca.

Para volver a una revisión anterior, usar el campo `previous` del manifiesto y restaurar ese objeto como `data/current.json`, después de verificar que sus rutas existen. Los archivos de datos e imágenes se conservan. No eliminar revisiones manualmente mientras existan referencias a ellas.

## Validación y límites

El resultado de la última verificación se guarda en [data/validation/latest.json](../data/validation/latest.json). Los informes por importación están en `data/reports/` e incluyen altas, cambios, cobertura por campo, relaciones, exclusiones e imágenes faltantes. Un proceso terminado con código 2 indica descargas fallidas/pendientes o acceso detenido; no debe presentarse como biblioteca visual completa.

La entrega pasó 11 pruebas de regresión y la decodificación/hash de 1.693 archivos distintos. [Idempotencia](../data/validation/idempotencia.json) confirma 2.009 huellas de carta sin cambios, cero altas y cero descargas al repetir. La carpeta `data/` ocupa aproximadamente 2,31 GiB, incluidos los ZIP originales y las revisiones; los archivos de imagen referenciados suman 609.417.260 bytes.

Las fuentes pueden estar incompletas respecto a publicaciones oficiales. Se conserva toda la información disponible para el alcance de jugador y se reportan faltantes; no se inventan traducciones ni ilustraciones. No se certifica fidelidad editorial de cada traducción ni legalidad de cada mazo.
