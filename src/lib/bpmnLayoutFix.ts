/**
 * Post-procesador de layout BPMN.
 * 1) Redimensiona pool y lanes para envolver todo el contenido (la IA suele
 *    dibujar el contenedor más chico que el diagrama).
 * 2) Sustituye todos los waypoints AI-generados por routing ortogonal correcto
 * usando 5 estrategias según la relación entre lanes origen/destino:
 *   A) misma lane          → horizontal directo
 *   B) lane adyacente ↓    → L-shape en el tope libre de la lane destino
 *   C) salta lanes ↓       → corredor derecho externo, entra por top del lane
 *   D) ascendente ↑        → ruteo local: top del origen → banda del lane destino → bottom del destino
 *   F) fallback sin lane   → L-shape ortogonal guiado por posición Y
 */

interface B { x: number; y: number; w: number; h: number }

const els = (root: Document | Element, name: string): Element[] =>
  Array.from(root.querySelectorAll('*')).filter((e) => e.localName === name)

export function fixBpmnWaypoints(xml: string): string {
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    if (els(doc, 'parsererror').length) return xml

    // ── shape bounds: bpmnElement id → {x,y,w,h} + nodo Bounds del DOM ──
    const bounds = new Map<string, B>()
    const boundsEl = new Map<string, Element>()
    els(doc, 'BPMNShape').forEach((shape) => {
      const id = shape.getAttribute('bpmnElement')
      const b = Array.from(shape.children).find((c) => c.localName === 'Bounds')
      if (!id || !b) return
      boundsEl.set(id, b)
      bounds.set(id, {
        x: +(b.getAttribute('x') ?? 0),
        y: +(b.getAttribute('y') ?? 0),
        w: +(b.getAttribute('width') ?? 100),
        h: +(b.getAttribute('height') ?? 80),
      })
    })
    if (!bounds.size) return xml

    // ── lanes ordenadas por Y + membresía de elementos ──────────────────
    const lanes: Array<{ id: string; elems: string[] }> = []
    els(doc, 'lane').forEach((lane) => {
      const id = lane.getAttribute('id')
      if (!id || !bounds.has(id)) return
      const elems: string[] = []
      els(lane, 'flowNodeRef').forEach((r) => {
        const e = r.textContent?.trim()
        if (e) elems.push(e)
      })
      lanes.push({ id, elems })
    })
    const participantIds = els(doc, 'participant')
      .map((p) => p.getAttribute('id') ?? '')
      .filter((id) => bounds.has(id))
    const containerIds = new Set([...participantIds, ...lanes.map((l) => l.id)])

    // Mediana de Y de los miembros declarados de cada lane. La IA a veces
    // declara elementos en el lane equivocado (flowNodeRef) aunque los dibuje
    // en la franja correcta; la mediana es robusta a esos outliers y evita que
    // un solo elemento mal declarado arrastre la frontera del carril.
    const medianCY = (l: { id: string; elems: string[] }): number => {
      const cys = l.elems
        .map((id) => bounds.get(id))
        .filter((b): b is B => !!b)
        .map((b) => b.y + b.h / 2)
        .sort((a, b) => a - b)
      const ob = bounds.get(l.id)!
      return cys.length ? cys[Math.floor(cys.length / 2)] : ob.y + ob.h / 2
    }
    const med = new Map(lanes.map((l) => [l.id, medianCY(l)]))
    lanes.sort((a, b) => med.get(a.id)! - med.get(b.id)!)
    const laneCYs = lanes.map((l) => med.get(l.id)!)

    // Membresía GEOMÉTRICA: cada elemento pertenece a la lane cuya mediana
    // está más cerca de donde realmente fue dibujado. La declaración solo
    // ancla la mediana; la posición dibujada manda (para resize y routing).
    const elemLane = new Map<string, number>()
    bounds.forEach((b, id) => {
      if (containerIds.has(id) || !laneCYs.length) return
      const cy = b.y + b.h / 2
      let best = 0
      laneCYs.forEach((m, i) => {
        if (Math.abs(cy - m) < Math.abs(cy - laneCYs[best])) best = i
      })
      elemLane.set(id, best)
    })

    // ── redimensionar pool y lanes para envolver TODO el contenido ──────
    // La IA suele dibujar el pool más chico que el diagrama: los nodos
    // quedan flotando fuera del contenedor. Recalculamos la geometría del
    // pool/lanes de forma determinista a partir del bbox real del contenido.
    const setB = (id: string, b: B) => {
      bounds.set(id, b)
      const el = boundsEl.get(id)
      if (!el) return
      el.setAttribute('x', String(Math.round(b.x)))
      el.setAttribute('y', String(Math.round(b.y)))
      el.setAttribute('width', String(Math.round(b.w)))
      el.setAttribute('height', String(Math.round(b.h)))
    }
    if (lanes.length && participantIds.length === 1) {
      const PAD = 25
      const LABEL_W = 30   // banda vertical del título del pool
      let fMinX = Infinity, fMaxX = -Infinity
      bounds.forEach((b, id) => {
        if (containerIds.has(id)) return
        fMinX = Math.min(fMinX, b.x)
        fMaxX = Math.max(fMaxX, b.x + b.w)
      })
      if (fMinX < Infinity) {
        // Rango vertical de cada lane según sus miembros reales
        const yr = lanes.map((l, i) => {
          let mn = Infinity, mx = -Infinity
          bounds.forEach((b, id) => {
            if (elemLane.get(id) !== i) return
            mn = Math.min(mn, b.y)
            mx = Math.max(mx, b.y + b.h)
          })
          const ob = bounds.get(l.id)!
          return mn < Infinity
            ? { mn: mn - PAD, mx: mx + PAD }
            : { mn: ob.y, mx: ob.y + ob.h }
        })
        // Lanes apiladas contiguas, mismo ancho, envolviendo a sus miembros
        const laneX = fMinX - PAD - LABEL_W
        const laneW = fMaxX + PAD - laneX
        let curY = yr[0].mn
        lanes.forEach((l, i) => {
          const h = Math.max(yr[i].mx - curY, 60)
          setB(l.id, { x: laneX, y: curY, w: laneW, h })
          curY += h
        })
        setB(participantIds[0], {
          x: laneX - LABEL_W,
          y: yr[0].mn,
          w: laneW + LABEL_W,
          h: curY - yr[0].mn,
        })
      }
    }

    // ── lista final de lanes (geometría ya corregida) para el routing ───
    const laneList = lanes.map((l) => {
      const lb = bounds.get(l.id)!
      return { y: lb.y, h: lb.h, elems: l.elems }
    })

    // ── corredor externo derecho (siempre vacío) ────────────────────────
    let maxX = -Infinity
    bounds.forEach((b) => { maxX = Math.max(maxX, b.x + b.w) })
    const RIGHT_X = Math.round(maxX + 35)
    let rightSlot = 0   // cada flujo tipo C recibe su propio slot → no se superponen

    // ── sequence flows: id → {src, dst} ───────────────────────────────
    const flows = new Map<string, { src: string; dst: string }>()
    els(doc, 'sequenceFlow').forEach((f) => {
      const id  = f.getAttribute('id')
      const src = f.getAttribute('sourceRef')
      const dst = f.getAttribute('targetRef')
      if (id && src && dst) flows.set(id, { src, dst })
    })

    // ── recalcular waypoints por BPMNEdge ──────────────────────────────
    els(doc, 'BPMNEdge').forEach((edge) => {
      const flow = flows.get(edge.getAttribute('bpmnElement') ?? '')
      if (!flow) return
      const sB = bounds.get(flow.src)
      const dB = bounds.get(flow.dst)
      if (!sB || !dB) return

      const sCX = sB.x + sB.w / 2, sCY = sB.y + sB.h / 2
      const dCX = dB.x + dB.w / 2, dCY = dB.y + dB.h / 2
      const sL  = elemLane.get(flow.src) ?? -1
      const dL  = elemLane.get(flow.dst) ?? -1

      let wps: [number, number][]

      if (sL < 0 || dL < 0) {
        // F: lane no detectada — L-shape ortogonal guiado por posición Y
        if (Math.abs(sCY - dCY) < 5) {
          wps = [[sB.x + sB.w, sCY], [dB.x, dCY]]
        } else if (dCY > sCY) {
          wps = [[sB.x + sB.w, sCY], [dCX, sCY], [dCX, dCY], [dB.x, dCY]]
        } else {
          wps = [[sB.x, sCY], [dCX, sCY], [dCX, dCY], [dB.x + dB.w, dCY]]
        }

      } else if (sL === dL) {
        if (dB.x >= sB.x + sB.w) {
          // A: misma lane hacia adelante → horizontal directo
          wps = [[sB.x + sB.w, sCY], [dB.x, dCY]]
        } else {
          // A2: misma lane hacia ATRÁS (loop de reproceso) → por la banda
          // superior libre de la lane, sin atravesar los elementos intermedios
          const topY = laneList[sL].y + 8
          wps = [
            [sCX, sB.y],       // sale por arriba del origen
            [sCX, topY],       // sube a la banda superior de la lane
            [dCX, topY],       // horizontal por zona libre
            [dCX, dB.y],       // entra por arriba del destino
          ]
        }

      } else if (dL > sL) {
        if (dL - sL === 1) {
          // B: lane adyacente → L-shape en el tope libre del lane destino (8px)
          const boundY = laneList[dL].y + 8
          wps = [
            [sCX, sB.y + sB.h],   // salida por abajo del origen
            [sCX, boundY],          // baja hasta el borde
            [dCX, boundY],          // horizontal en zona libre (sin elementos aquí)
            [dCX, dB.y],            // entra por arriba del destino
          ]
        } else {
          // C: salta lanes ↓ → corredor DERECHO externo, entra por TOP del lane destino
          // La zona libre en el tope es lane.y a lane.y+8 (elements start at lane.y+40)
          const laneTopFreeY = laneList[dL].y + 8
          const xC = RIGHT_X + rightSlot++ * 40
          wps = [
            [sB.x + sB.w, sCY],   // sale por la derecha del origen
            [xC, sCY],              // va al corredor externo derecho
            [xC, laneTopFreeY],     // baja por el corredor hasta zona libre del lane destino
            [dCX, laneTopFreeY],    // horizontal en zona libre (sin elementos)
            [dCX, dB.y],            // entra por ARRIBA del elemento destino
          ]
        }
      } else {
        // D: flujo ascendente ↑ (avance o retorno) → ruteo LOCAL: sale por el
        // TOP del origen, viaja por la banda libre inferior del lane destino
        // solo el tramo horizontal necesario, y entra por ABAJO del destino.
        // Sin corredor global: cada par origen/destino vive en su propio rango
        // X, así decenas de flujos ascendentes no se enciman en un mismo riel.
        // ponytail: varios retornos MUY largos podrían solapar sus tramos en la
        // banda — añadir slots por flujo si algún diagrama real lo exhibe.
        const bandY = laneList[dL].y + laneList[dL].h - 8
        // Offset ±20 en la entrada para no pisar el stem bottom-center del
        // propio destino (la estrategia B sale por ahí) y separar visualmente
        // un "Sí" y un "No" que entren a la misma tarea.
        const entryX = sCX < dCX ? dCX - 20 : dCX + 20
        wps = [
          [sCX, sB.y],             // sale por arriba del origen
          [sCX, bandY],            // sube hasta la banda libre del lane destino
          [entryX, bandY],         // tramo horizontal local
          [entryX, dB.y + dB.h],   // entra por abajo del destino
        ]
      }

      // Quitar puntos consecutivos duplicados (rutas degeneradas cuando
      // origen y destino comparten X)
      const clean = wps.filter(([x, y], i) => i === 0 || x !== wps[i - 1][0] || y !== wps[i - 1][1])
      if (clean.length >= 2) wps = clean

      // Eliminar waypoints anteriores y etiquetas de posición (auto-reposicionan)
      Array.from(edge.children)
        .filter((c) => c.localName === 'waypoint' || c.localName === 'BPMNLabel')
        .forEach((c) => edge.removeChild(c))

      // Insertar nuevos waypoints
      const diNS = 'http://www.omg.org/spec/DD/20100524/DI'
      wps.forEach(([x, y]) => {
        const wp = doc.createElementNS(diNS, 'di:waypoint')
        wp.setAttribute('x', String(Math.round(x)))
        wp.setAttribute('y', String(Math.round(y)))
        edge.appendChild(wp)
      })
    })

    return new XMLSerializer().serializeToString(doc)
  } catch {
    return xml   // fallback: devuelve el XML original si algo falla
  }
}

export function injectMissingBpmnEdges(xml: string): string {
  const sfIds = [...xml.matchAll(/<(?:\w+:)?sequenceFlow\b[^>]+\bid="([^"]+)"/g)]
    .map(m => m[1])
  if (sfIds.length === 0) return xml

  const existingEdges = new Set(
    [...xml.matchAll(/<(?:\w+:)?BPMNEdge\b[^>]+\bbpmnElement="([^"]+)"/g)]
      .map(m => m[1])
  )

  const missing = sfIds.filter(id => !existingEdges.has(id))
  if (missing.length === 0) return xml

  const injected = missing
    .map(id => `      <bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}"/>`)
    .join('\n')

  return xml.replace(/<\/(?:\w+:)?BPMNPlane>/, `${injected}\n    </bpmndi:BPMNPlane>`)
}
