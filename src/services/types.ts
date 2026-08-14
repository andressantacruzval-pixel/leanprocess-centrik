export interface ServiceResponse<T> {
  data: T | null
  error: Error | null
}

export type ServiceResult<T> = Promise<ServiceResponse<T>>
