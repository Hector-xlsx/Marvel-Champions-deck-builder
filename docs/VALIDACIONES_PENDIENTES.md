# Decisiones pendientes para continuar

Actualizado: 2026-11-03. Se implementaron las mejoras ya definidas; los puntos siguientes no se completaron mediante supuestos silenciosos. Se puede responder por número.

## Última aclaración e implementación

Este estado sustituye las propuestas históricas de los puntos 1, 2, 5 y 6 que se conservan debajo como contexto:

- **Puntos 1 y 2, todavía en revisión:** el usuario quiere ver todas las cartas del mazo simultáneamente y está evaluando otra vista. No se implementa aún Mantener cartas del mazo ni ordenar la galería por grupos personalizados.
- **Punto 5, implementado:** simulador básico con robo de 1/2/6, mano impresa del héroe/alter ego, selección para reemplazar o devolver y Reset. Sin reglas específicas de preparación ni efectos. Excluye auxiliares.
- **Punto 6, implementado:** presets globales, controles iguales y valores independientes, nombres editables, copia del actual, ojo y combinación O. Fijados persistentes por filtro; Mostrar solo fijados recupera el conjunto guardado aunque cambien sus criterios. Desfijar una carta de todos sus filtros y vaciar los fijados del filtro actual requieren doble pulsación.
- **Backlog nuevo:** probabilidades de iniciar la estrategia por turno, con alternativas O dentro de cada grupo y requisitos Y entre grupos. Falta definir el modelo de turnos y efectos antes de desarrollar ese análisis.

Comportamiento y pruebas: [entrega de filtros, fijados y simulador](evidencia/gestor/FILTROS_FIJADOS_SIMULADOR.md).

## 1. Mantener cartas del mazo y ocultar héroe en la galería

En revisión por el usuario: se evalúa otra vista para ver simultáneamente todas las cartas del mazo. No implementar aún Mantener cartas del mazo ni trasladar controles por esta propuesta.

## 2. Ordenar por grupos personalizados

En revisión junto con el punto 1; la solución puede cambiar si se crea otra vista. No se añade este criterio a la galería. El agrupamiento del listado izquierdo continúa funcionando.

## 3. Búsqueda Nombre / Contiene

Confirmado por el usuario: búsqueda parcial, como `LIKE "%nombre%heroe%"`; no debe exigir igualdad exacta. Siempre debe quedar al menos una casilla activa: no se permite desmarcar ambas.

Implementado tras confirmación del usuario: Nombre incluye subtítulo y Contiene busca en texto de reglas. Ambos activos combinan resultados con O; se conserva Español/Inglés/Ambos. Los términos se buscan en orden, separados por cualquier contenido intermedio. Se deshabilita desmarcar la última casilla activa. Ya no requiere definición.

## 4. Estadísticas

Implementado: sección plegable bajo Cartas del mazo, ajustada al ancho de su columna, sin tortas. Se cuentan todas las copias incluidas, independientemente del ocultador visual de héroe.

Confirmado por el usuario: Recursos cuenta símbolos impresos, no cantidad de nombres que aportan cada símbolo. Los auxiliares están excluidos de todas las estadísticas por decisión funcional del usuario.

Coste y Aspecto cuentan copias incluidas, confirmado por el usuario. Alineamiento con el código público de MarvelCDB: recursos en columnas con aporte del héroe diferenciado y desglose por cantidad de símbolos en cada carta; curva de costes numéricos con huecos cero, excluyendo X y ausentes; aspectos en columnas. Se añade el promedio de recursos impresos por carta. Ya no requiere definición. Ver fuente y límites en [registro de entrega](evidencia/gestor/REGLAS_AUXILIARES_ESTADISTICAS.md).

## 5. Simulador de robo

Implementado según la última aclaración: robo de 1/2/6 y manos impresas, reemplazo, devolución y Reset. Ver registro enlazado al principio.

## 6. Filtros avanzados simultáneos

Implementados con valores independientes y resultados O, según la última aclaración. Incluye fijados por filtro y doble pulsación para borrados conjuntos. Ver registro enlazado al principio.

## 7. Reglas especiales y avisos de incompatibilidad

Revisión de identidades completada por petición del usuario: [69 héroes y 138 identidades](REVISION_IDENTIDADES_HEROES.md). Implementados los permisos de otros aspectos para Gamora, Cíclope, Cable, Maria Hill y Hombre Maravilla, y las reglas estructurales de Spiderwoman y Adam Warlock. Los límites conjuntos se muestran como avisos y permiten elegir qué cartas retirar. Los incompatibles aparecen en rojo, con control de quitar copia destacado. Limpiar Mazo muestra una selección previa y permite deshacer; no toca Auxiliares ni cartas obligatorias. Ya no requiere definición.

No se deben marcar como incompatibles los planes secundarios permitidos para Cable. Quitar una copia debe seguir quitando solo una, sin eliminación automática. La revisión cubre las identidades indicadas, no reglas de otras cartas ni documentos externos.

## 8. Auxiliares vinculados

Implementado: grupo reservado Auxiliares. Los propios del héroe se muestran automáticamente según los vínculos ya disponibles en el catálogo y permanecen en el grupo. Las cartas del mazo pueden arrastrarse a este grupo o moverse con el menú del asa; para devolverlas se conserva el default natural y las asociaciones personalizadas anteriores. Las obligatorias del mazo principal no se trasladan. El grupo vacío aparece como destino bajo la entrada de personalizados, sin permitir crear un personalizado homónimo.

Decisión funcional confirmada por el usuario: los auxiliares no cuentan para tamaño del mazo, ninguna estadística ni copias físicas. El resumen debe mostrarlos aparte como «+ X cartas auxiliares».

El contador suma las copias auxiliares automáticas más las trasladadas manualmente; no hay selección de partida. Los manuales se conservan separados mediante `auxiliaries` en respaldos y snapshots; los automáticos se derivan del héroe y catálogo. En exportación textual tienen sección propia. No se validan como incompatibles ni se cuentan para tamaño, estadísticas o faltantes.

Pendiente de datos: identificar el plan y los aliados patrulleros del ejemplo si se quiere automatizar también ese vínculo. Ya pueden organizarse manualmente como auxiliares; no se simula completar planes ni elegir aliados durante una partida.

## 9. Validaciones de datos y formato externo

- Exportación MarvelCDB: **backlog**, aplazada explícitamente por el usuario. Cuando se reactive, verificar el formato de importación aceptado y su correspondencia con los códigos locales. El JSON propio actual sigue siendo un respaldo, no un archivo compatible con MarvelCDB.
- Más ilustraciones: identificar fuentes y archivos de las variantes faltantes. Las reimpresiones que comparten imagen no se presentarán como dibujos diferentes.

## Lo que ya quedó implementado

### Aclaración resuelta: menciones a planes secundarios

El usuario aclaró que busca cartas que mencionen planes secundarios en sus reglas, sin corchetes. Implementado como campo derivado textTopics y opción Plan secundario de En texto, con singular/plural ES/EN. No es un rasgo propio ni un filtro por tipo. Ya no requiere definición.

- Escudo con H para identificar cartas del héroe, manteniendo colores de aspectos; recursos con iconos SVG legibles, incluido el puño físico.
- Sin menos ni candado en filas obligatorias del héroe. Se conserva la protección en el modelo y los otros controles.
- Casilla de ocultar cartas de héroe en el listado del mazo, independiente de la galería, sin alterar copias ni total; preferencia local persistida.
- Icono ① ajustado al mismo tamaño visual que selección de todos.
- Segunda fila plegable de Cartas disponibles con Solo cartas de este mazo trasladado desde Otros.
- Lista de rasgos del mazo superpuesta, con selección, contadores, ordenación y cierre al elegir/afuera/Escape. Selección de rasgos en una franja con desplazamiento horizontal.
- Planes secundarios girados 90° a la derecha en detalle y widgets, sin recortar ni cambiar imágenes originales o galería.
- Widget de la galería sin imagen para cartas normales; conserva imagen girada para planes secundarios. Widget del mazo conserva imagen para todas.

Comprobaciones y archivos afectados: [registro de entrega](evidencia/gestor/PENDIENTES_CLAROS.md).
