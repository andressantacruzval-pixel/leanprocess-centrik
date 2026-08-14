import { toast } from '@/stores/toastStore'

export interface DbWriteOptions {
  /** Mensaje de éxito para mostrar al usuario. Si no se define, no hay toast en éxito. */
  successMessage?: string
  /** Mensaje de error que se muestra al usuario. Default genérico. */
  errorMessage?: string
  /** Si true, no se muestran toasts (útil para auto-save y escrituras internas). */
  silent?: boolean
  /** Callback que se ejecuta si la escritura falla, para revertir el estado local. */
  rollback?: () => void
}

export interface DbWriteResult<T> {
  ok: boolean
  data: T | null
  error: Error | null
}

/** Forma mínima que Supabase garantiza en sus thenables. */
type SupabaseLike<T> = PromiseLike<{
  data: T | null
  error: { message: string; code?: string } | null
}>

/**
 * Los triggers de negocio (topes de plan, nivel documentable, niveles congelados)
 * lanzan `check_violation` con un mensaje escrito para una persona. Ese texto es
 * lo único que explica por qué falló la acción: taparlo con el genérico deja al
 * usuario mirando "no se pudo guardar" sin saber que llegó a su límite.
 *
 * Se excluyen los CHECK declarativos, cuyo mensaje lo redacta Postgres y no se
 * puede enseñar ("new row for relation ... violates check constraint ...").
 */
function mensajeDeNegocio(error: { message: string; code?: string }): string | null {
  if (error.code !== '23514') return null
  if (error.message.includes('violates check constraint')) return null
  return error.message
}

/**
 * Envuelve una escritura a Supabase con manejo uniforme de error, rollback y
 * feedback visible al usuario. Reemplaza el anti-pattern fire-and-forget
 * `supabase.from(...).then(({error}) => console.warn(...))` que tragaba
 * errores de RLS silenciosamente.
 */
export async function dbWrite<T>(
  label: string,
  operation: SupabaseLike<T>,
  options: DbWriteOptions = {}
): Promise<DbWriteResult<T>> {
  const { successMessage, errorMessage, silent = false, rollback } = options

  try {
    const { data, error } = await operation
    if (error) {
      console.error(`[dbWrite:${label}] ${error.message}`)
      const negocio = mensajeDeNegocio(error)
      if (!silent) {
        toast.error(negocio ?? errorMessage ?? 'No se pudo guardar en la nube. Intenta de nuevo.')
      }
      rollback?.()
      return { ok: false, data: null, error: new Error(error.message) }
    }
    if (successMessage && !silent) {
      toast.success(successMessage)
    }
    return { ok: true, data, error: null }
  } catch (err) {
    const normalized = err instanceof Error ? err : new Error(String(err))
    console.error(`[dbWrite:${label}]`, normalized)
    if (!silent) {
      toast.error(errorMessage ?? 'Error de red. Verifica tu conexión.')
    }
    rollback?.()
    return { ok: false, data: null, error: normalized }
  }
}
