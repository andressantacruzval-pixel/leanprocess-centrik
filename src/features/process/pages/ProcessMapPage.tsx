import { useSearchParams } from 'react-router-dom'
import { ProcessMap, ProcessDrilldown } from '@/components/process-map'

/**
 * En que macroproceso estas vive en la URL (`?macro=`), no en un `useState`.
 * Con el estado local, volver desde un proceso te dejaba siempre en la raiz del
 * mapa: había que bajar los niveles otra vez a mano. Ver `lib/processMapUrl.ts`.
 */
export default function ProcessMapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const drillMacroId = searchParams.get('macro')

  if (drillMacroId) {
    return (
      <ProcessDrilldown
        macroId={drillMacroId}
        onBack={() => setSearchParams({}, { replace: true })}
      />
    )
  }

  return (
    <ProcessMap onDrillDown={(id) => setSearchParams({ macro: id }, { replace: true })} />
  )
}
