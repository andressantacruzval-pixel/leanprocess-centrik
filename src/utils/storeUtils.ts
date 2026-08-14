/**
 * storeUtils — helpers tipados para Zustand stores.
 */

/**
 * Reemplaza `migrate: (state) => state as any` en persist().
 * Mantiene type safety sin suprimir el error con `any`.
 */
export function identityMigration<T>() {
  return (state: unknown): T => state as T
}
