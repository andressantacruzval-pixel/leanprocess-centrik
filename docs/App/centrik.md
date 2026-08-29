# El sistema de diseño Centrik en Lean Process

> Contrato visual de la aplicación. Antes de tocar colores, tamaños o
> espaciados de cualquier pantalla, leer esto y `DESIGN_SYSTEM.md` del kit.

## Qué es

Lean Process pertenece a la **familia visual Centrik**: interfaz empresarial
sobria, compacta y orientada a datos. Fondo gris muy claro, tarjetas blancas,
un único acento verde esmeralda, densidad alta y **nada de decoración**.

Las cinco reglas que no se negocian:

| | |
|---|---|
| Tipografía | **Geist** (y Geist Mono para códigos). Nunca Inter, Poppins ni Montserrat. |
| Acento | **`#10b981`** exacto. `600` para hover, `50` para selección suave. |
| Densidad | Raíz de 13 px; controles de 32 px de alto. |
| Forma | Radios de 6 px (normal) y 8 px (tarjeta). Nunca de 16-32 px. |
| Prohibido | Degradados, glassmorphism, halos de neón, sombras profundas, emojis como iconos. |

El color solo se usa cuando **significa** algo: verde marca/éxito, azul
información, ámbar advertencia, rojo destructivo. Todo lo demás es gris.

## Dónde vive

```
src/styles/
├── centrik-tokens.css       # bloque @theme de Tailwind v4 — la fuente de verdad
├── centrik-base.css         # lienzo, tipografía, controles nativos, scrollbars
└── centrik-components.css   # primitivos .ck-* (botones, campos, tablas, badges…)
src/index.css                # hoja de entrada: importa los tres + lo propio de la app
src/features/bpmn/components/bpmn-centrik-theme.css   # el diagramador, aparte (ver abajo)
```

### `centrik-tokens.css` es la palanca grande

Redefine el tema de Tailwind, así que **cambia lo que significan las clases en
toda la app a la vez**: `text-sm` pasa a 12 px, `rounded-lg` a 8 px, `shadow-lg`
a una sombra de contacto. Por eso la densidad Centrik aparece en 200 pantallas
sin editarlas una a una.

La consecuencia práctica: **para ajustar la escala se toca aquí, no en las
pantallas.** Si una pantalla necesita un tamaño que la escala no tiene, casi
siempre es que la escala está bien y la pantalla está mal.

### Los primitivos `.ck-*` son el punto de partida

`centrik-components.css` traduce la sección 7 del kit a clases reutilizables:
`.ck-btn` (`--primary`/`--secondary`/`--ghost`/`--danger`), `.ck-input`,
`.ck-label`, `.ck-card`, `.ck-table`, `.ck-badge`, `.ck-nav-item`,
`.ck-page-header`, `.ck-stat`, `.ck-empty`, `.ck-modal`, `.ck-progress`.

**Toda pantalla nueva o reescrita parte de estas clases.** Reinventar un botón
con utilidades sueltas es cómo se desincronizan los estilos: la barra lateral
ya tenía la receta del ítem de menú duplicada en dos sitios y habían empezado
a divergir.

## Cómo se hizo el traslado

La app estaba escrita en oscuro (lienzo navy `#070b14`, acento cian,
degradados, halos). Existía además una capa de ~250 reglas `!important` que la
reconvertía a claro en tiempo de ejecución.

Esa capa **ya no existe**. Se tradujo la fuente con un codemod
—`scripts/centrik-codemod.mjs`— por dos razones:

1. La capa había que alimentarla a mano: cada clase nueva que apareciera en una
   pantalla no estaba remapeada y salía oscura hasta que alguien lo notara.
2. Dejaba el código diciendo una cosa y la pantalla enseñando otra, que es la
   peor posición para depurar.

### El codemod, y por qué no es un buscar-y-reemplazar

Varias decisiones **dependen de las clases vecinas**:

- `text-white` sobre un panel navy es «texto principal» → gris 900.
  Sobre un botón verde es «texto sobre color» → sigue blanco.
  Un reemplazo global rompe uno de los dos casos.
- Un degradado con paradas **translúcidas** (`from-cyan-500/15 to-blue-500/10`)
  no era un color: era un **tinte** de fondo. Aplastarlo al verde sólido
  convierte un fondo suave en un bloque saturado y deja el texto que iba encima
  del mismo color que su propio fondo.

Por eso agrupa los literales por el `className` que los contiene —incluidos los
repartidos entre un tramo estático y el ternario de un `${…}`— y decide con el
fondo real delante.

### Lee el código con el analizador de TypeScript

Se escribió primero un lector propio y **falló dos veces en silencio**: tomó por
plantilla una comilla invertida que vivía dentro de una expresión regular, y
leyó el `/` de un `</span>` como el principio de otra regex. En ambos casos
siguió reescribiendo lo que creía texto: se perdieron palabras de la interfaz y
se juntaron sentencias en una sola línea.

Distinguir una división de una regex, o un cierre de etiqueta JSX de un
comentario, es el trabajo de un analizador de verdad. Se usa el de TypeScript,
que el proyecto ya trae, y solo se reescribe lo que hay **dentro** de los nodos
de tipo cadena. El texto JSX, los comentarios y las regex quedan fuera de
alcance por construcción, no por una heurística que haya que ir remendando.

Además, antes de escribir cada archivo se comprueba que sigue analizando y que
**fuera de las cadenas no ha cambiado ni un byte**. El que no cumple no se toca
y se avisa por consola.

> ⚠️ **El codemod no es idempotente.** `bg-primary-50` volvería a pasar por la
> escala y saldría `bg-primary-500`. Se ejecuta UNA vez sobre fuente sin
> convertir. Para repetirlo hay que restaurar los archivos primero.

## El diagramador va aparte

bpmn-js aplica su propia hoja al SVG del diagrama, donde las clases de utilidad
no llegan. Por eso `bpmn-centrik-theme.css` es un archivo propio y no hereda del
resto: lienzo blanco con cuadrícula de puntos, trazos y rellenos en el verde de
familia, texto en la escala gris y sombras de contacto.

## No hay tema oscuro

La interfaz tiene **un solo aspecto**. Se retiraron el conmutador del Header, el
campo `theme` del `uiStore` (migración v2, para no arrastrar la clave guardada),
el efecto de `App.tsx` que ponía `data-theme` y el script anti-parpadeo de
`index.html`, que existía justo para tapar el salto entre los dos temas.

Si algún día vuelve a hacer falta un modo oscuro, el sitio es un segundo bloque
de tokens, no otra capa de `!important` encima de las pantallas.

## Lista de control antes de dar una pantalla por buena

- ¿Usa Geist, y no una fuente sustituta?
- ¿El verde es exactamente `#10b981`?
- ¿Los controles principales miden 32 px?
- ¿Las tarjetas tienen borde gris 200 y sombra sutil, no elevación fuerte?
- ¿Las tablas priorizan densidad y legibilidad?
- ¿El color se usa con significado y no como decoración?
- ¿No hay degradados, glassmorphism ni radios exagerados?
- ¿Existen los estados de carga, vacío, error y deshabilitado?
- ¿Funciona en escritorio y en móvil?
