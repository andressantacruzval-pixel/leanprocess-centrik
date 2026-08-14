import { supabase } from '@/lib/supabase'
import type { ServiceResult } from './types'

/**
 * Upload a user avatar to the avatars bucket and return the public URL.
 * Path: avatars/{userId}/avatar.{ext}
 */
export async function uploadAvatar(userId: string, file: File): ServiceResult<string> {
  try {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/avatar.${ext}`

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) return { data: null, error: new Error(error.message) }

    const url = getPublicUrl('avatars', path)
    return { data: url, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Upload a company logo to the company-assets bucket and return the public URL.
 * Path: company-assets/{companyId}/logo.{ext}
 */
export async function uploadCompanyLogo(
  companyId: string,
  file: File
): ServiceResult<string> {
  try {
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${companyId}/logo.${ext}`

    const { error } = await supabase.storage
      .from('company-assets')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) return { data: null, error: new Error(error.message) }

    const url = getPublicUrl('company-assets', path)
    return { data: url, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Upload a BPMN XML string as a file to the bpmn-diagrams bucket and return the public URL.
 * Path: bpmn-diagrams/{processId}/diagram.xml
 */
export async function uploadBpmnDiagram(
  processId: string,
  xmlContent: string
): ServiceResult<string> {
  try {
    const blob = new Blob([xmlContent], { type: 'application/xml' })
    const path = `${processId}/diagram.xml`

    const { error } = await supabase.storage
      .from('bpmn-diagrams')
      .upload(path, blob, { upsert: true, contentType: 'application/xml' })

    if (error) return { data: null, error: new Error(error.message) }

    const url = getPublicUrl('bpmn-diagrams', path)
    return { data: url, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Synchronously return the public URL for a file in a given storage bucket.
 */
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Delete a file from a storage bucket.
 */
export async function deleteFile(bucket: string, path: string): ServiceResult<void> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
