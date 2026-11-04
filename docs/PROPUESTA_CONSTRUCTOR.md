# Constructor visual y sistema de compatibilidad

Estado: este documento conserva el diseño propuesto como referencia. Ya existe una [primera versión local del constructor](GESTOR_MAZOS.md), con galería, edición, grupos manuales y versiones. La compatibilidad y los puntajes siguen pendientes. La fuente de datos resulta viable según el [protocolo](PROTOCOLO_DATOS_MARVELCDB.md); se conserva la separación entre fuente y anotaciones propias.

## 1. Diferencia que aportaría el proyecto

MarvelCDB ya ofrece vistas de búsqueda `Full Cards` y `Scans only`, visibles en su [buscador](https://marvelcdb.com/find). Por tanto, la propuesta no debe basarse en afirmar que el sitio solo permite listas de texto.

El valor buscado es una experiencia integrada: filtrar, examinar imágenes, seleccionar cantidades, ver el mazo y comprender compatibilidad dentro de la misma pantalla. La compatibilidad debe poder evaluarse contra héroe, conjunto de héroe, selección del mazo o un conjunto manual independiente.

## 2. Primer alcance funcional

Diseño conceptual de escritorio; no es una captura ni una interfaz construida:

```text
Héroe / aspecto / idioma             Buscar nombre o texto
┌────────────────┬──────────────────────────┬─────────────────────┐
│ Filtros        │ Galería de cartas        │ Mi mazo             │
│ Tipo / rasgo   │ Imagen + nombre          │ Héroe y obligatorias│
│ Costo / recurso│ Cantidad seleccionada    │ Cartas y cantidades │
│ Estadísticas  │ + añadir / − retirar     │ Tamaño y advertencias│
│ Producto      │ Abrir detalle / reverso  │ Guardar / exportar  │
└────────────────┴──────────────────────────┴─────────────────────┘
```

En móvil, galería y mazo pueden ser pestañas con contador persistente. No fijar una tecnología de interfaz antes de acordar la implementación; esta carpeta no contiene todavía una aplicación ni dependencias.

Comportamiento propuesto:

- Búsqueda por nombre EN o ES, subtítulo y texto; filtros por tipo, aspecto, rasgos, costo, recursos impresos, estadísticas aplicables, producto, conjunto, unicidad y estado de selección. Los campos opcionales sin valor se filtran como desconocidos, no como cero.
- Combinar familias de filtros con AND; dentro de una familia ofrecer “cualquiera”/“todos” cuando tenga sentido. Mostrar filtros activos y número de resultados. Orden estable por nombre, costo, producto o estadísticas relevantes.
- Mostrar imagen EN inicial y texto EN/ES independiente; reversos/formas accesibles. Sin imagen: ficha con atributos, texto y aviso de recurso pendiente.
- Botones `+` y `−` para cantidades. Un clic de selección puede llevar de 0 a 1, pero no debe borrar varias copias accidentalmente. Mostrar `0/3`, `1/3`, etc. según el límite calculado, sin asumir tres para toda carta.
- El estado visual de “seleccionada” se distingue de “admisible”, “con advertencia” y “no evaluada”. No esconder una carta seleccionada porque cambió el filtro.
- Panel de mazo con cantidades, contador, clasificación y advertencias. Cambiar búsqueda o idioma no cambia el mazo. Cambiar de héroe con un mazo existente requiere un flujo que preserve el borrador anterior.
- Guardado local versionado y exportación JSON propia con códigos y cantidades; listado textual EN/ES para compartir. No prometer compatibilidad de importación con MarvelCDB hasta verificar su formato. No necesita cuentas inicialmente.
- Imágenes con carga diferida y miniaturas como derivados si se justifican. Los originales conservan hash y procedencia. Evitar renderizar miles de imágenes simultáneas.

Los campos existentes pueden exponerse en filtros avanzados conforme se tipifiquen; “todos los valores” no significa que un objeto técnico como `meta` sea un filtro útil para el jugador. Todo campo original seguirá disponible para inspección y futura indexación.

## 3. Modelo de datos propuesto

Nombres de entidades orientativos, todavía no tablas ni archivos implementados:

| Entidad | Propósito |
| --- | --- |
| Registro fuente | JSON intacto, origen, idioma, revisión, fecha y hash |
| Impresión/cara | Código exacto, producto, posición, estadísticas y relaciones |
| Texto por idioma | Nombre, subtítulo, reglas, rasgos y cobertura por campo |
| Familia de reimpresión | Relaciones documentadas entre impresiones; no agrupar solo por nombre |
| Recurso visual | URL, cara, idioma verificado/desconocido, archivo y hash |
| Mazo y revisión | Héroe, aspectos, códigos/cantidades, versión de catálogo y anotaciones |
| Perfil semántico | Propiedades interpretadas, evidencia, estado de revisión y versión |
| Regla de evaluación | Condiciones, efectos, puntajes y explicación |
| Contexto de comparación | Héroe, conjunto fijo, selección del mazo o conjunto manual |

Separar las propiedades propias de las de MarvelCDB. Una sincronización no puede borrar las etiquetas semánticas revisadas. Si cambia el texto fuente, marcar las anotaciones dependientes para revisión. Mantener códigos de impresión para guardar/exportar, aunque la galería permita agrupar reimpresiones. Aplicar límites entre copias equivalentes cuando corresponda; no convertir cada impresión en una vía para exceder límites.

## 4. Tres evaluaciones distintas

| Evaluación | Pregunta | Salida propuesta |
| --- | --- | --- |
| Construcción | ¿Esta carta puede incluirse en este mazo? | Permitida, prohibida o no evaluada; motivo |
| Activación/uso | ¿Se cumplen las condiciones de jugarla o aprovecharla? | Cumplida, condicionada, no cumplida o desconocida |
| Sinergia | ¿Qué relaciones favorables tiene con el contexto? | Puntaje, condiciones, evidencia y cobertura |

Una restricción “solo mutante” no siempre significa prohibición de incluirla: puede ser condición de jugarla, de pagar un recurso o de resolver un efecto. Antes de asignar `+3`, hay que tipificar qué restringe exactamente el texto. Un rasgo de alter ego tampoco debe asumirse activo en forma de héroe.

Por ello, un buen puntaje no vuelve legal una carta. Y puntaje cero no significa incompatibilidad: puede significar que todavía no se han anotado sus interacciones. La legalidad completa requiere interpretar reglas oficiales vigentes, excepciones de héroe y erratas; esta investigación no certifica un motor de reglas.

## 5. Compatibilidad explicable y extensible

La base pública aporta texto y algunos requisitos, pero no se comprobó una base completa de sinergias estructuradas. Para esta capa se necesitan anotaciones adicionales revisadas. Empezar por reglas declarativas y un conjunto pequeño de cartas; la búsqueda de palabras puede sugerir anotaciones, no validarlas automáticamente.

Información semántica propuesta por carta:

- Qué requiere: rasgo, forma, identidad, recurso, tipo de objetivo, estado de mesa o carta concreta.
- A quién aplica: identidad, aliado, otro jugador, objetivo vinculado o conjunto de cartas.
- Qué aporta: descuento, recurso, robo, curación, preparación, aumento de estadística, rasgo otorgado u otro efecto.
- Cuándo aplica: al construir, jugar, pagar, activar o resolver; si es permanente, condicional o limitado por ronda.
- Dirección de la relación: A beneficia a B; no asumir que B beneficia a A.
- Evidencia: código y cara, fragmento relevante, campo fuente, hash/revisión, autor de revisión y estado (`proposed`, `reviewed`, `needs_review`).

Ejemplo conceptual de regla (no formato ya implementado):

```json
{
  "id": "trait_discount_v1",
  "status": "proposed",
  "context": "selected_reference_set",
  "condition": {
    "effect": "cost_reduction",
    "required_trait": "mutant",
    "target": "identity",
    "timing": "play"
  },
  "score": 2,
  "explanation": "Descuento relacionado con el rasgo mutante; comprobar forma y condición de uso."
}
```

Los términos de este ejemplo son un vocabulario propio propuesto, no campos que ya ofrezca MarvelCDB. La regla solo se aplica a una anotación revisada que describa una interacción real; no basta con hallar “mutant” en el texto. Mutant y X-Men deben mantenerse como rasgos diferentes.

Los `+3` para una interacción exclusiva y `+2` para un descuento son pesos iniciales sugeridos por el usuario, pendientes de calibración. Se pueden conservar como perfil experimental, sin presentarlos como calidad estratégica objetiva. Separar puntos por cumplimiento de una restricción de puntos por un beneficio para evitar recomendar cartas de efecto pobre solo por ser exclusivas.

Cada resultado debería explicar: “+2 por descuento si la identidad cumple el rasgo”, qué carta lo provoca, en qué dirección, qué condición falta y qué versión de regla se usó. Mostrar cobertura de análisis: “sin interacciones detectadas” y “sin analizar” son estados diferentes. No mostrar porcentajes de probabilidad sin un modelo validado.

## 6. Contextos de comparación solicitados

1. **Mi héroe:** identidad y formas explícitas; separar rasgos activos en héroe y alter ego. Puede mostrarse coincidencia permanente o condicional por forma.
2. **Conjunto del héroe:** cartas asociadas a la identidad. Separar las que forman parte del mazo, identidad y referencias que van a otra zona; pertenecer al conjunto no implica estar robándose juntas.
3. **Mi mazo actual:** cartas y cantidades elegidas. No asumir que todas están en juego a la vez.
4. **Selección de mi mazo:** subconjunto marcado para evaluar una combinación específica.
5. **Conjunto manual:** códigos elegidos como referencia, aunque no pertenezcan al mazo; agregar aquí no los añade al mazo.

Mantener contexto de comparación separado del estado de selección. Permitir “cualquier referencia” o “todas las condiciones requeridas”, con explicación de qué miembro cumple cada requisito. No sumar diez veces el mismo descuento porque diez referencias comparten el rasgo.

Agregación inicial propuesta: cada interacción identificada puntúa una vez por familia de efecto/regla; multiplicidad solo si la regla lo declara. Excluir autorrelaciones triviales, agrupar reimpresiones y evaluar una instantánea estable del contexto para evitar puntajes que se retroalimentan. Distinguir incompatibilidad demostrada, condición pendiente y ausencia de información.

Más adelante se pueden incorporar combinaciones de varios pasos y simulación de disponibilidad. No forman parte de la primera entrega: una lista de cartas con relaciones no prueba que una secuencia de juego sea ejecutable.

## 7. Secuencia recomendada y validaciones

| Etapa | Entrega | Validación principal |
| --- | --- | --- |
| 1. Datos | Importador, catálogo EN/ES, imágenes y actualizaciones | Criterios del protocolo; altas idempotentes, reanudación y reversión |
| 2. Constructor visual | Galería, filtros, cantidades, panel de mazo, guardar/exportar | Filtros combinados, cambios de idioma sin pérdida, persistencia y exportación recuperable |
| 3. Reglas básicas | Admisibilidad conocida y advertencias explicadas | Casos revisados por héroe, excepciones y límites; estado desconocido explícito |
| 4. Compatibilidad piloto | Anotaciones y reglas para una muestra revisada | Casos positivos, negativos, condicionales y sin datos; resultados explicables y repetibles |
| 5. Ampliación | Más efectos, contextos y calibración | Revisión de cobertura, ausencia de duplicación de puntajes y vigencia ante erratas |

No se necesitan IA ni servicios de pago para demostrar las primeras etapas. La plataforma de aplicación, cuentas, sincronización entre dispositivos y despliegue quedan como decisiones posteriores; esta propuesta no autoriza contrataciones ni publicación.

Antes de implementar la capa de compatibilidad convendrá acordar el vocabulario de condiciones, qué significa cada peso y cómo se revisan anotaciones. Eso no impide comenzar por datos y galería, que son el primer paso solicitado.
