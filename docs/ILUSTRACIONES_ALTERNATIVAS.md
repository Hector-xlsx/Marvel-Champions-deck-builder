# Ilustraciones alternativas pendientes

Referencia aportada por el usuario. Cubre productos comerciales hasta *Iron Fist* y excluye promociones de juego organizado. El listado excluye reimpresiones idénticas, cambios de símbolo, erratas, traducciones y cartas distintas que comparten nombre.

El resumen recibido indicaba 42 nombres y 55 reskins. Al contar las filas y las expansiones posteriores a la primera, la tabla contiene **44 nombres y 57 variantes propuestas**. Se conserva completa hasta aclarar la diferencia.

## Validación e incorporación

Se compararon escaneos de [Hall of Heroes](https://hallofheroeslcg.com/browse/) con las imágenes locales. Se incorporaron **19 variantes** y se corrigieron las imágenes originales de **Build Support** (`40027`), **Call for Backup** (`40018`) y **Superpower Training** (`40059`). Cada escaneo incorporado tiene URL por código y SHA-256 en `data/overrides/verified-artwork.json` y en `artworkSource` del catálogo ejecutable. Los datos fuente se conservan en su revisión original.

Los planes secundarios se compararon en horizontal. La imagen local anterior de **Superpower Training** (`40059`) mostraba la ilustración de *Fear No Evil* (`60056`) girada. El escaneo de *NeXt Evolution* muestra a los X-Men entrenando y el de *Fear No Evil* muestra a un personaje bajo los rayos de Dagger. Se detectó la misma asignación cruzada en **Call for Backup**. Las dos impresiones de **Build Support** muestran ilustraciones distintas.

- **Variantes incorporadas:** `35019`, `43017`, `45013`, `45019`, `45047`, `46021`, `47017`, `50025`–`50027`, `56014`, `56020`–`56022`, `59022` y `60056`–`60059`.
- **Arte distinto ya disponible:** `35015`, `41014`, `46023`, `56048` y `60051`.
- **Mismo arte observado en ambas impresiones:** `42015`, `40030`, `40055`, `45046`, `45052`, `46017`, `46022` y `49023`. No se añadió otra opción visual para estas impresiones.
- **Pendientes:** las 25 propuestas restantes, incluidos los pares de códigos de recursos de *Sinister Motives* y *Mutant Genesis*. Una imagen prestada puede mostrar una ilustración distinta sin corresponder al código de esa edición. Para promoverla hace falta confirmar la impresión con un escaneo.

## Cruce inicial con el catálogo local

Revisión `2026-11-02T23-41-01-835Z-9644`. Cada fila conserva el orden de la referencia. Se buscaron coincidencias por nombre inglés de carta y producto, sin distinguir mayúsculas ni el tipo de apóstrofo. Los códigos son candidatos locales, no una certificación de la ilustración impresa.

De las 57 variantes propuestas, **36 usan una imagen prestada**, **8 reutilizan un archivo ya visto en la misma fila**, **6 tienen varios códigos candidatos** y **7 tienen un archivo propio distinto de los ya vistos en su fila**. El cruce comprueba que los archivos existen en `dist/`. Un archivo distinto puede ser otro escaneo de la misma ilustración. Para confirmar cada variante queda comparar las imágenes y conservar el código, la fuente y la evidencia.

| Carta | Arte original según la referencia | Primeras apariciones de las variantes según la referencia |
| --- | --- | --- |
| Bait and Switch | Scarlet Witch (`15030`) · archivo propio | Sinister Motives (`27013`) · referencia prestada<br>Mutant Genesis (`32015`) · referencia prestada |
| Battle Fury | Thor (`06018`) · archivo propio | Wolverine (`35015`) · archivo propio |
| Bombs Away | Angel (`42029`) · archivo propio | Wonder Man (`58017`) · referencia prestada |
| Build Support | NeXt Evolution (`40027`) · archivo propio | Black Panther (`51026`) · mismo archivo |
| Call for Backup | NeXt Evolution (`40018`) · archivo propio | Hercules (`59022`) · referencia prestada |
| Clobber | Gamora (`18012`) · archivo propio | Age of Apocalypse (`45046`) · referencia prestada |
| Concussive Blow | Ms. Marvel (`05031`) · archivo propio | Psylocke (`41014`) · archivo propio |
| Deft Focus | The Galaxy’s Most Wanted (`16024`) · archivo propio | Magneto (`49023`) · referencia prestada |
| Down Time | Ms. Marvel (`05033`) · archivo propio | Phoenix (`34024`) · referencia prestada |
| Endurance | Ms. Marvel (`05023`) · archivo propio | Storm (`36026`) · referencia prestada |
| Energy | Core Set (`01088`) · archivo propio | Sinister Motives (`27020`, `27051`) · varios códigos<br>Mutant Genesis (`32022`, `32052`) · varios códigos<br>Agents of S.H.I.E.L.D. (`50025`) · referencia prestada<br>Civil War (`56020`) · referencia prestada<br>Fear No Evil (`60057`) · mismo archivo |
| Ever Vigilant | Star-Lord (`17030`) · archivo propio | Angel (`42015`) · mismo archivo |
| Genius | Core Set (`01089`) · archivo propio | Sinister Motives (`27021`, `27052`) · varios códigos<br>Mutant Genesis (`32023`, `32053`) · varios códigos<br>Agents of S.H.I.E.L.D. (`50026`) · referencia prestada<br>Civil War (`56021`) · referencia prestada<br>Fear No Evil (`60058`) · mismo archivo |
| Hit and Run | Gamora (`18020`) · archivo propio | Gambit (`37020`) · referencia prestada |
| Looking for Trouble | The Galaxy’s Most Wanted (`16043`) · archivo propio | Iceman (`46017`) · mismo archivo |
| Mean Swing | Thor (`06015`) · archivo propio | Wolverine (`35019`) · referencia prestada |
| Moment of Triumph | Ant-Man (`12030`) · archivo propio | X-23 (`43017`) · referencia prestada |
| Not Today! | Rogue (`38016`) · archivo propio | Silk (`52015`) · referencia prestada |
| Overwatch | Spider-Ham (`30019`) · archivo propio | NeXt Evolution (`40055`) · referencia prestada |
| Perseverance | Wasp (`13033`) · archivo propio | Mutant Genesis (`32016`) · referencia prestada |
| Powerful Punch | Mutant Genesis (`32014`) · archivo propio | Fear No Evil (`60051`) · archivo propio |
| Preemptive Strike | Ms. Marvel (`05014`) · archivo propio | Rogue (`38015`) · archivo propio |
| Ready to Rumble | The Mad Titan’s Shadow (`21022`) · archivo propio | Mutant Genesis (`32051`) · referencia prestada |
| Recuperation | Scarlet Witch (`15031`) · archivo propio | Iceman (`46022`) · referencia prestada |
| Sidearm | War Machine (`23035`) · archivo propio | NeXt Evolution (`40030`) · referencia prestada |
| Spiritual Meditation | Scarlet Witch (`15019`) · archivo propio | Age of Apocalypse (`45052`) · mismo archivo |
| Stealth Strike | Black Widow (`08013`) · archivo propio | Gambit (`37014`) · archivo propio |
| Strength | Core Set (`01090`) · archivo propio | Sinister Motives (`27022`, `27053`) · varios códigos<br>Mutant Genesis (`32024`, `32054`) · varios códigos<br>Agents of S.H.I.E.L.D. (`50027`) · referencia prestada<br>Civil War (`56022`) · referencia prestada<br>Fear No Evil (`60059`) · mismo archivo |
| Superpower Training | NeXt Evolution (`40059`) · archivo propio | Fear No Evil (`60056`) · mismo archivo |
| Suppressing Fire | Iceman (`46014`) · archivo propio | Civil War (`56014`) · referencia prestada |
| Swift Retribution | Scarlet Witch (`15014`) · archivo propio | Phoenix (`34019`) · referencia prestada |
| Taunt | Angel (`42016`) · archivo propio | Civil War (`56048`) · archivo propio |
| Team Training | The Rise of Red Skull (`04016`) · archivo propio | Age of Apocalypse (`45013`) · referencia prestada |
| Team-Building Exercise | Ant-Man (`12024`) · archivo propio | Iceman (`46021`) · referencia prestada |
| Teamwork | Thor (`06032`) · archivo propio | Cyclops (`33017`) · referencia prestada |
| The Power in All of Us | Wasp (`13024`) · archivo propio | Iceman (`46023`) · archivo propio |
| The Power of Aggression | Core Set (`01055`) · archivo propio | Age of Apocalypse (`45047`) · referencia prestada |
| The Power of Flight | Angel (`42022`) · archivo propio | Falcon (`53028`) · referencia prestada |
| The Power of Justice | Core Set (`01062`) · archivo propio | Jubilee (`47017`) · referencia prestada |
| The Power of Leadership | Core Set (`01072`) · archivo propio | Age of Apocalypse (`45019`) · referencia prestada |
| The Power of Protection | Core Set (`01079`) · archivo propio | Nightcrawler (`48019`) · referencia prestada |
| The Power of the Mind | NeXt Evolution (`40028`) · archivo propio | Psylocke (`41021`) · referencia prestada |
| Toe to Toe | Hulk (`10015`) · archivo propio | Mutant Genesis (`32046`) · referencia prestada |
| Unflappable | Doctor Strange (`09020`) · archivo propio | Rogue (`38013`) · referencia prestada |
