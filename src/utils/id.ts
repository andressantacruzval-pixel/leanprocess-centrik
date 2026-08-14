/** Genera un UUID v4 aleatorio. Wrapper centralizado para facilitar mocking en tests. */
export const generateId = (): string => crypto.randomUUID()
