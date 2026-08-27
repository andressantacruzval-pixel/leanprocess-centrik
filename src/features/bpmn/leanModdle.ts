// Extensión moddle propia: agrega el atributo `isApplication` a los
// DataObjectReference, para marcar (de forma persistente en el XML e
// independiente del nombre) qué nodos son APLICACIONES/software. Así el usuario
// puede renombrar la etiqueta sin perder el marcador que lo dibuja como
// computadora y lo detecta el panel de aplicaciones.
const leanModdle = {
  name: 'LeanProcess',
  uri: 'http://leanprocess.app/bpmn',
  prefix: 'lp',
  xml: { tagAlias: 'lowerCase' },
  associations: [],
  types: [
    {
      name: 'AppMarker',
      extends: ['bpmn:DataStoreReference', 'bpmn:DataObjectReference'],
      properties: [
        { name: 'isApplication', isAttr: true, type: 'Boolean' },
      ],
    },
  ],
}

export default leanModdle
