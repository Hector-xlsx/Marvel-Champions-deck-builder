# Revisión de héroe y alter ego — 2026-11-03

Se revisaron **69 conjuntos de héroe y 138 identidades** de la biblioteca local. Fuente: `data/catalog/2026-11-02T23-41-01-835Z-9644/cards.json`, revisión `2026-11-02T23-41-01-835Z-9644`. El [inventario JSON](REVISION_IDENTIDADES_HEROES.json) conserva códigos, texto consultado, hashes y clasificación. Este archivo es evidencia de revisión; no está conectado al motor de filtros.

## Resultado

Cinco héroes tienen permisos expresos para cartas de otros aspectos y dos tienen reglas estructurales de construcción. En los otros 62 no se encontró una excepción expresa en las dos identidades revisadas. Esto describe el alcance revisado; no certifica todas las reglas posibles del juego.

| Héroe | Identidad que contiene la regla | Resultado |
|---|---|---|
| Spiderwoman | `04031b` | Elegir dos aspectos y mantener igual cantidad de cartas de ambos. |
| Gamora | `18001b` | Hasta 6 copias de Eventos con Ataque o Intervención de aspectos distintos del elegido. |
| Adam Warlock | `21031b` | Igual cantidad de cartas de los cuatro aspectos indicados y máximo una copia por carta ajena al conjunto de Adam Warlock. |
| Cíclope | `33001b` | Aliados Patrulla-X de cualquier aspecto. |
| Cable | `40001b` | Planes secundarios de jugador de cualquier aspecto. |
| Maria Hill | `50001b` | Hasta tres Apoyos S.H.I.E.L.D. distintos de otros aspectos, con el máximo de copias permitido para cada uno. |
| Hombre Maravilla | `58001b` | Eventos de cualquier aspecto con recurso Energía impreso. |

## Precisiones para programar

- Gamora: Ataque **o** Intervención; el original inglés dice `and/or`. El límite seis suma copias de ambas categorías de otros aspectos, no seis nombres ni seis de cada categoría.
- Maria Hill: tres nombres de apoyo distintos, no tres copias totales. El catálogo de la identidad también contiene `name_limit: 3` y `use_deck_limit: true`; al programarlo debe conservarse el límite de cada apoyo.
- Cíclope: `X-Men` en inglés corresponde a Patrulla-X en español. No confundir con X-Force.
- Hombre Maravilla: exige Energía **impresa**, no recursos que una capacidad pueda generar durante la partida.
- Spiderwoman: seleccionar dos aspectos no basta; también debe evaluarse la igualdad de cantidades.
- Adam Warlock: además del balance entre los cuatro aspectos indicados, limita copias de todas las cartas ajenas a su conjunto, incluidas las básicas. No se extrapola de este texto una resolución de interacciones con aspectos posteriores; cualquier caso no resuelto requerirá otra fuente.
- Una carta que cumple la condición individual de Gamora o Maria Hill puede ser candidata, pero el mazo debe respetar además sus límites conjuntos.

## Alcance de identidades

Se eligió una forma principal por conjunto y su alter ego; no se contaron formas adicionales como personajes distintos. Se omitieron `12001c`, `13001c`, `29002a`, `29003a` y `42001c`. Para Robot SP//dr se consultaron `31001a` (Héroe) y `31002a` (Peni Parker, Alter ego): el reverso `31001b` es un Apoyo, por lo que no se lo confundió con el alter ego. No se modificaron relaciones del catálogo.

No se interpretan como permisos de construcción las capacidades de buscar, robar, recuperar o jugar una carta durante la partida; tampoco los límites de mejoras Restringidas en juego ni las referencias a mazos auxiliares. Las referencias a reglas externas que aparezcan en las identidades no se resolvieron fuera del alcance pedido.

## Cobertura completa

| Héroe | Héroe / Alter ego | Clasificación |
|---|---|---|
| Spiderman | `01001a` / `01001b` | Sin excepción expresa en las identidades |
| Capitana Marvel | `01010a` / `01010b` | Sin excepción expresa en las identidades |
| Hulka | `01019a` / `01019b` | Sin excepción expresa en las identidades |
| Iron Man | `01029a` / `01029b` | Sin excepción expresa en las identidades |
| Pantera Negra | `01040a` / `01040b` | Sin excepción expresa en las identidades |
| Capitán América | `03001a` / `03001b` | Sin excepción expresa en las identidades |
| Ojo de Halcón | `04001a` / `04001b` | Sin excepción expresa en las identidades |
| Spiderwoman | `04031a` / `04031b` | Regla estructural |
| Ms. Marvel | `05001a` / `05001b` | Sin excepción expresa en las identidades |
| Thor | `06001a` / `06001b` | Sin excepción expresa en las identidades |
| Viuda Negra | `08001a` / `08001b` | Sin excepción expresa en las identidades |
| Doctor Extraño | `09001a` / `09001b` | Sin excepción expresa en las identidades |
| Hulk | `10001a` / `10001b` | Sin excepción expresa en las identidades |
| Hombre Hormiga | `12001a` / `12001b` | Sin excepción expresa en las identidades |
| Avispa | `13001a` / `13001b` | Sin excepción expresa en las identidades |
| Mercurio | `14001a` / `14001b` | Sin excepción expresa en las identidades |
| Bruja Escarlata | `15001a` / `15001b` | Sin excepción expresa en las identidades |
| Groot | `16001a` / `16001b` | Sin excepción expresa en las identidades |
| Mapache Cohete | `16029a` / `16029b` | Sin excepción expresa en las identidades |
| Starlord | `17001a` / `17001b` | Sin excepción expresa en las identidades |
| Gamora | `18001a` / `18001b` | Permiso de otros aspectos |
| Drax | `19001a` / `19001b` | Sin excepción expresa en las identidades |
| Veneno | `20001a` / `20001b` | Sin excepción expresa en las identidades |
| Spectrum | `21001a` / `21001b` | Sin excepción expresa en las identidades |
| Adam Warlock | `21031a` / `21031b` | Regla estructural |
| Nébula | `22001a` / `22001b` | Sin excepción expresa en las identidades |
| Máquina de Guerra | `23001a` / `23001b` | Sin excepción expresa en las identidades |
| Valquiria | `25001a` / `25001b` | Sin excepción expresa en las identidades |
| La Visión | `26001a` / `26001b` | Sin excepción expresa en las identidades |
| Ghost-Spider | `27001a` / `27001b` | Sin excepción expresa en las identidades |
| Spiderman | `27030a` / `27030b` | Sin excepción expresa en las identidades |
| Nova | `28001a` / `28001b` | Sin excepción expresa en las identidades |
| Ironheart | `29001a` / `29001b` | Sin excepción expresa en las identidades |
| Spiderham | `30001a` / `30001b` | Sin excepción expresa en las identidades |
| Robot SP//dr | `31001a` / `31002a` | Sin excepción expresa en las identidades |
| Coloso | `32001a` / `32001b` | Sin excepción expresa en las identidades |
| Gatasombra | `32030a` / `32030b` | Sin excepción expresa en las identidades |
| Cíclope | `33001a` / `33001b` | Permiso de otros aspectos |
| Fénix | `34001a` / `34001b` | Sin excepción expresa en las identidades |
| Lobezno | `35001a` / `35001b` | Sin excepción expresa en las identidades |
| Tormenta | `36001a` / `36001b` | Sin excepción expresa en las identidades |
| Gambito | `37001a` / `37001b` | Sin excepción expresa en las identidades |
| Pícara | `38001a` / `38001b` | Sin excepción expresa en las identidades |
| Cable | `40001a` / `40001b` | Permiso de otros aspectos |
| Dominó | `40037a` / `40037b` | Sin excepción expresa en las identidades |
| Mariposa Mental | `41001a` / `41001b` | Sin excepción expresa en las identidades |
| Ángel | `42001a` / `42001b` | Sin excepción expresa en las identidades |
| X-23 | `43001a` / `43001b` | Sin excepción expresa en las identidades |
| Masacre | `44001a` / `44001b` | Sin excepción expresa en las identidades |
| Bishop | `45001a` / `45001b` | Sin excepción expresa en las identidades |
| Magik | `45030a` / `45030b` | Sin excepción expresa en las identidades |
| Hombre de Hielo | `46001a` / `46001b` | Sin excepción expresa en las identidades |
| Júbilo | `47001a` / `47001b` | Sin excepción expresa en las identidades |
| Rondador Nocturno | `48001a` / `48001b` | Sin excepción expresa en las identidades |
| Magneto | `49001a` / `49001b` | Sin excepción expresa en las identidades |
| Maria Hill | `50001a` / `50001b` | Permiso de otros aspectos |
| Nick Furia | `50034a` / `50034b` | Sin excepción expresa en las identidades |
| Pantera Negra | `51001a` / `51001b` | Sin excepción expresa en las identidades |
| Seda | `52001a` / `52001b` | Sin excepción expresa en las identidades |
| Halcón | `53001a` / `53001b` | Sin excepción expresa en las identidades |
| Soldado de Invierno | `54001a` / `54001b` | Sin excepción expresa en las identidades |
| Tigra | `56001a` / `56001b` | Sin excepción expresa en las identidades |
| Hulkling | `56029a` / `56029b` | Sin excepción expresa en las identidades |
| Hombre Maravilla | `58001a` / `58001b` | Permiso de otros aspectos |
| Hércules | `59001a` / `59001b` | Sin excepción expresa en las identidades |
| Daredevil | `60001a` / `60001b` | Sin excepción expresa en las identidades |
| Eco | `60037a` / `60037b` | Sin excepción expresa en las identidades |
| Jessica Jones | `61001a` / `61001b` | Sin excepción expresa en las identidades |
| Luke Cage | `62001a` / `62001b` | Sin excepción expresa en las identidades |

## Estado de aplicación

Esta revisión original solo cambió documentación. Tras la autorización posterior, las siete reglas se implementaron: candidatos por regla especial, límites agregados y avisos de construcción. La aplicación posterior queda registrada en [la entrega](evidencia/gestor/REGLAS_AUXILIARES_ESTADISTICAS.md); no se modificaron los textos ni la biblioteca fuente de las identidades.
