# Próximas mejoras acordadas

Estado actualizado 2026-11-03: las mejoras de interfaz sin ambigüedades ya se implementaron. El [listado consolidado de validaciones](VALIDACIONES_PENDIENTES.md) separa las decisiones que faltan y enumera lo entregado. Los apartados de alineamiento siguientes conservan la definición original; no significan que toda esa interfaz siga pendiente.

Nueva entrega: reglas de los siete héroes revisados, incompatibilidades y limpieza reversible, búsqueda Nombre/Contiene, grupo reservado Auxiliares y estadísticas según el código público de MarvelCDB ya implementados. Estado y pruebas en [registro de entrega](evidencia/gestor/REGLAS_AUXILIARES_ESTADISTICAS.md). En los apartados históricos siguientes, las menciones a decisiones de búsqueda/estadísticas/auxiliares por confirmar quedan sustituidas por ese registro y el listado consolidado.

## Exportación compatible con MarvelCDB

**Backlog por decisión expresa del usuario.** No implementar en la siguiente tanda. Cuando se reactive, verificar el formato que acepte MarvelCDB. El JSON actual es un respaldo propio; no se debe presentar como compatible. Conservar cantidades, identidad, aspectos e identificadores de cartas al definir la conversión.

## Filtros avanzados simultáneos

**Implementados el 2026-11-03.** La última aclaración confirma controles iguales y valores independientes. Incluye presets globales, nombres editables, copia, ojos con resultados O y fijados persistentes por filtro. [Comportamiento y validación](evidencia/gestor/FILTROS_FIJADOS_SIMULADOR.md). El planteamiento original conservado debajo ya no representa dudas pendientes.

Confirmado: guardado global; cada filtro nuevo copia el actual; los controles son iguales y cada filtro conserva valores independientes.

- Activación desde Otros mediante «Filtro avanzado».
- Subpestañas pequeñas junto a Filtros, con nombres iniciales «Filtro 1», «Filtro 2», etc.
- Botón + fuera de cada pestaña para añadir otra configuración.
- Cada pestaña permite consultar y configurar todas sus opciones y conservarlas guardadas.
- Icono de ojo junto al nombre para mostrar/ocultar su contribución a los resultados, sin borrar la configuración.
- X para eliminar filtros. Su ubicación definitiva, en pestaña o contenido, sigue pendiente de diseño.
- Los filtros visibles se combinan con O: una carta aparece si cumple cualquiera de ellos. Dentro de cada filtro se mantienen las combinaciones de sus criterios.
- Ejemplos de uso: un filtro temático X-Force, otro de planes secundarios y otro de eventos con condiciones específicas.
- Ampliar los parámetros del catálogo permitirá criterios más específicos. No hay motor semántico conectado.

## Probabilidades de iniciar la estrategia

Backlog de análisis futuro, separado del simulador básico. Alternativas O dentro de cada grupo y requisitos Y entre grupos; explorar la probabilidad de reunir el núcleo de una estrategia por turno. Falta definir el modelo de turnos, efectos y cartas de búsqueda antes de implementar cálculos.

## Mapa de reglas especiales de construcción

Cable comenzó como piloto, a partir del texto local de Nathan Summers `40001b`: «Puedes incluir en tu mazo Planes secundarios de jugador de cualquier aspecto». La entrega actual amplía Regla especial a los cinco héroes con permisos expresos, conservando los otros criterios y excluyendo conjuntos exclusivos de otros héroes.

Revisión posterior completada: [69 héroes y 138 identidades](REVISION_IDENTIDADES_HEROES.md). Gamora, Cíclope, Cable, Maria Hill y Hombre Maravilla tienen permisos expresos de otros aspectos; Spiderwoman y Adam Warlock tienen reglas estructurales. Las siete reglas están implementadas con avisos y límites correspondientes. Que una carta aparezca en un filtro no constituye una validación completa de legalidad del mazo.

## Cobertura de ilustraciones

El selector usa las imágenes distintas que ya existen en la biblioteca. No cuenta cada reimpresión como una ilustración nueva. Energía tiene dos pares visuales distintos disponibles (`01088` y `60057`), aunque existen más registros de impresión que reutilizan la imagen. Incorporar otras ilustraciones requiere enriquecer la biblioteca con fuentes verificadas.

## Alineamiento de interfaz — 2026-11-03

Definición original del alineamiento. Implementación parcial completada: iconos y controles del mazo, lista superpuesta de rasgos, fila secundaria con Solo cartas del mazo y ajustes de planes/widgets. Las interpretaciones sin confirmar siguen pendientes; consultar el listado consolidado enlazado arriba.

### Cartas del mazo: iconos y controles

- Afinar la identificación de aspectos. Se puede conservar el color, pero las cartas propias del héroe deben tener un icono reconocible adicional. El símbolo concreto queda para diseño.
- Sustituir los recursos poco reconocibles por iconos legibles: en particular, el recurso físico debe distinguirse como puño, no como un punto rojo. Mantener la identificación accesible del recurso.
- En las cartas obligatorias del conjunto del héroe, retirar el botón de quitar copia y el candado. Conservar la protección funcional existente: ocultar controles no cambia la regla de que no se pueden quitar.
- A la izquierda de «Agrupar por», añadir la casilla «Ocultar cartas de héroe» para ocultarlas solo del listado del mazo. No retirar cartas ni cambiar cantidades, estadísticas o estado guardado por ocultarlas. Este control es independiente del que filtra la galería.
- Ajustar el círculo y tamaño del botón ① para que tenga el mismo tamaño visual que el icono de seleccionar todo contiguo.

### Cartas disponibles: segunda fila de controles

Última decisión: Mantener cartas del mazo y ordenar por grupos quedan en revisión mientras el usuario evalúa otra vista para ver todo el mazo. Las propuestas siguientes no se implementan aún.

- Botón de desplegar/ocultar una segunda fila a la derecha de Reiniciar filtros y orden.
- Trasladar «Solo cartas de este mazo» desde Otros a esa fila.
- Cuando «Solo cartas de este mazo» esté activo, habilitar «Grupos personalizados» como criterio adicional de ordenación. La propuesta es usar el mismo grupo preferido que organiza cada carta del mazo; confirmar cómo ordenar Default, varios grupos asociados y grupos ocultos antes de implementar. Desactivar el modo debe dejar un criterio válido si estaba elegido este orden.
- Incorporar «Mantener cartas del mazo». Interpretación propuesta, pendiente de confirmar: resultados = cartas que cumplen los filtros O cartas incluidas en el mazo, evitando que una carta añadida desaparezca al cambiar filtros. Aclarar si incluye todas las cartas del mazo o solo las que estaban visibles al activar el control, y cómo combina con ocultar héroe.
- El usuario también propone trasladar el selector que llamó «Ocultar cartas DM». Interpretación pendiente: se refiere al actual «Ocultar cartas de héroe» de la galería. No confundirlo con el nuevo control del listado izquierdo.

### Estadísticas y simulador de robo

Estado actualizado: ambos implementados. El simulador básico permite 1/2/6, manos impresas, reemplazo, devolución y Reset, sin preparación ni efectos. Las preguntas históricas siguientes quedan sustituidas por esta decisión.

- Crear bajo Cartas del mazo una sección independiente «Estadísticas», plegable y del mismo ancho que esa columna.
- Incluir gráficos de recursos por carta, coste de cartas y aspectos de cartas, tomando como referencia conceptual los mencionados por el usuario en MarvelCDB. Excluir gráficos de torta. El tipo exacto de gráfico queda por definir; se proponen barras.
- Confirmado posteriormente: Recursos cuenta símbolos impresos. Los auxiliares no participan en ninguna estadística. Para costes y aspectos, sigue como propuesta contar copias físicas incluidas, no solo nombres distintos.
- Debajo, añadir una sección de simulación de robo («Card draw simulator»), también ajustada al ancho de Cartas del mazo. Falta acordar mano inicial, reinicio/barajado, robo adicional, mulligan y tratamiento de cartas apartadas/preparación. No asumir simulación completa de reglas por mencionar esta herramienta.
- Toda sección futura situada bajo Cartas del mazo debe seguir el ancho de esa columna.

### Avisos por cartas incompatibles con el aspecto

- Al cambiar aspectos o duplicar y luego cambiar aspectos, señalar con el nombre en rojo las cartas incluidas que no correspondan a la construcción elegida. Ejemplo solicitado: Cable de Liderazgo pasa a Justicia y conserva cartas de Liderazgo.
- Añadir un distintivo al control de quitar copia que invite a revisar/retirar la carta. No eliminar cartas automáticamente ni convertir el botón en eliminación de todas las copias sin definición adicional.
- Evaluar primero las excepciones conocidas del héroe: los planes secundarios permitidos de otros aspectos para Cable no deben marcarse como incompatibles por ese motivo. Mantener sin advertencia de aspecto las cartas básicas y las propias de su conjunto.
- Si faltan reglas por mapear, distinguir «pendiente de evaluar» de incompatibilidad confirmada. No garantizar legalidad completa a partir de colores y aspectos.

### Rasgos: desplegable superpuesto y selección compacta

- Sustituir el bloque desplegable «En mazo» situado debajo por un botón junto al campo de rasgos, a la izquierda de +. Dentro o fuera del campo es una decisión visual pendiente.
- Ese botón abre una lista superpuesta de rasgos del mazo: no aumenta la altura del panel ni desplaza los elementos inferiores. Elegir un rasgo lo añade a la selección actual; mantener contadores y ordenación existentes.
- Los rasgos seleccionados deben ocupar una franja compacta. Si no caben, permitir desplazamiento horizontal dentro de esa franja, sin ensanchar la página ni crear más filas. Conservar la X para quitar cada rasgo y la combinación O entre ellos.

### Buscar cartas: campos de búsqueda

- Añadir botón de desplegar a la derecha del campo Buscar cartas.
- Mostrar debajo casillas «Nombre» y «Contiene» para elegir una o ambas búsquedas. Mantener el selector de idioma existente.
- Confirmado posteriormente: búsqueda parcial como `LIKE "%nombre%heroe%"` y siempre al menos una casilla activa; no pueden desmarcarse ambas. Sigue pendiente precisar el subtítulo y confirmar que Contiene busca en el texto de reglas. La combinación O se mantiene como propuesta.

### Planes secundarios y widgets

- En el zoom/detalle y en las vistas previas, rotar la imagen de los planes secundarios 90° hacia la derecha para leerla horizontalmente. Ajustar el espacio y conservar la imagen completa, sin recortar. No cambiar la orientación de las imágenes de la galería ni los archivos fuente por esta solicitud.
- Widget de Cartas disponibles: quitar la imagen para las cartas normales, porque ya está al lado en la galería. Conservar los datos y texto. Excepción: los planes secundarios sí muestran su imagen completa y girada.
- Widget de Cartas del mazo: conservar la imagen completa para todas las cartas; aplicar el giro cuando sea un plan secundario.
- Implementado tras la autorización de desarrollar los pendientes claros: widgets diferenciados por sección y giro de planes secundarios.

### Esquema de distribución propuesto

```text
MI MAZO / FILTROS                                      OTROS
┌──────────────────────────┐ ┌─────────────────────────────────────────┐
│ CARTAS DEL MAZO           │ │ CARTAS DISPONIBLES                      │
│ ☐ Ocultar héroe           │ │ controles actuales · reiniciar · ▾     │
│ Agrupar por · columnas    │ │ ☐ Solo este mazo  ☐ Mantener del mazo  │
│ grupos y cartas          │ │ [segunda fila plegable]                │
├──────────────────────────┤ │                                         │
│ ▾ ESTADÍSTICAS            │ │ galería                                │
│ recursos · coste         │ │                                         │
│ aspectos (sin torta)      │ │                                         │
├──────────────────────────┤ │                                         │
│ SIMULADOR DE ROBO         │ │                                         │
└──────────────────────────┘ └─────────────────────────────────────────┘
```

Esquema orientativo de escritorio. En la implementación se debe definir el apilamiento móvil conservando el ancho disponible y los controles accesibles.

## Cartas auxiliares vinculadas

Grupo reservado implementado tras la confirmación del usuario: auxiliares propios del héroe automáticos, cartas manuales mediante arrastre y cantidades separadas. Los puntos siguientes conservan el planteamiento original; solo la automatización de vínculos adicionales de planes con aliados sigue como mejora de datos.

- Identificar y marcar las cartas que tienen auxiliares asociados, así como la relación entre la carta de origen y cada auxiliar. No limitar estas relaciones a la identidad del héroe: también pueden partir de una carta incluida en el mazo.
- Propuesta del usuario: mostrar las cartas relacionadas en una sección «Auxiliares» dentro de Cartas del mazo. Su ubicación y presentación definitivas se revisarán antes de implementar.
- Ejemplo descrito por el usuario: un plan secundario permite, al completarlo, escoger uno de varios aliados patrulleros vinculados y añadirlo a la mano. El nombre y los códigos concretos del plan y sus aliados quedan pendientes de identificar y verificar; no dar por confirmados sus rasgos ni el texto exacto de la interacción.
- Mostrar desde qué carta se accede a cada auxiliar y, cuando esté verificada, la condición que lo habilita. Si hay alternativas, presentarlas como opciones vinculadas; no asumir que todos los auxiliares se incorporan simultáneamente.
- Mostrar una relación no debe añadir automáticamente cartas al mazo ni simular que se ha completado el plan. La consulta de auxiliares y su eventual selección durante una partida son comportamientos distintos.
- Decisión funcional posterior del usuario: los auxiliares no cuentan para tamaño del mazo, estadísticas ni disponibilidad física. Se muestran aparte del total principal como «+ X cartas auxiliares». Esta es una decisión del gestor, sin deducir una regla universal del juego de la etiqueta auxiliar.
- Confirmado e implementado: se muestran los propios del héroe y los agregados manualmente; X suma sus copias. Los manuales se conservan en el respaldo y versiones en un mapa separado; los automáticos se derivan del héroe. No hay selector de partida. Evitar contar un mismo auxiliar dos veces cuando tenga varios vínculos.
- Revisar si las relaciones ya disponibles en la biblioteca cubren estos casos; completar únicamente con vínculos y reglas verificados.
