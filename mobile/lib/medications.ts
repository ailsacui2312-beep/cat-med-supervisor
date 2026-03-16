import { supabase } from './supabase'
import type { Medication, MedicationWithSchedules, Frequency } from './types'
import * as ImagePicker from 'expo-image-picker'

export async function fetchMedications(userId: string): Promise<MedicationWithSchedules[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*, schedules(*)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function fetchMedication(id: string): Promise<MedicationWithSchedules | null> {
  const { data, error } = await supabase
    .from('medications')
    .select('*, schedules(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export interface CreateMedicationInput {
  name: string
  dosage?: string
  unit?: string
  frequency?: Frequency
  expiry_date?: string
  notes?: string
  color?: string
  photo_url?: string
  cycle_type?: string
  cycle_start_day?: number
  cycle_end_day?: number
  cycle_active_days?: number
  cycle_rest_days?: number
  cycle_start_date?: string
  cycle_end_date?: string
}

export async function createMedication(
  userId: string,
  input: CreateMedicationInput
): Promise<Medication> {
  const { data, error } = await supabase
    .from('medications')
    .insert({
      user_id: userId,
      name: input.name,
      dosage: input.dosage || null,
      unit: input.unit || '粒',
      frequency: input.frequency || 'daily',
      expiry_date: input.expiry_date || null,
      notes: input.notes || null,
      color: input.color || '#FF9F43',
      photo_url: input.photo_url || null,
      cycle_type: input.cycle_type || 'none',
      cycle_start_day: input.cycle_start_day ?? null,
      cycle_end_day: input.cycle_end_day ?? null,
      cycle_active_days: input.cycle_active_days ?? null,
      cycle_rest_days: input.cycle_rest_days ?? null,
      cycle_start_date: input.cycle_start_date || null,
      cycle_end_date: input.cycle_end_date || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateMedication(
  id: string,
  input: Partial<CreateMedicationInput>
): Promise<Medication> {
  const { data, error } = await supabase
    .from('medications')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function archiveMedication(id: string): Promise<void> {
  const { error } = await supabase
    .from('medications')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function restoreMedication(id: string): Promise<void> {
  const { error } = await supabase
    .from('medications')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function fetchArchivedMedications(userId: string): Promise<MedicationWithSchedules[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*, schedules(*)')
    .eq('user_id', userId)
    .eq('is_active', false)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function deleteMedicationPermanently(id: string): Promise<void> {
  const { error } = await supabase
    .from('medications')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function uploadMedicationPhoto(
  userId: string,
  uri: string
): Promise<string> {
  const ext = uri.split('.').pop() || 'jpg'
  const fileName = `${userId}/${Date.now()}.${ext}`

  const response = await fetch(uri)
  const blob = await response.blob()

  const { error: uploadError } = await supabase.storage
    .from('medication-photos')
    .upload(fileName, blob, { contentType: `image/${ext}` })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('medication-photos')
    .getPublicUrl(fileName)

  return data.publicUrl
}

export async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  })

  if (result.canceled) return null
  return result.assets[0].uri
}

export async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== 'granted') return null

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  })

  if (result.canceled) return null
  return result.assets[0].uri
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: '每天一次',
  twice_daily: '每天两次',
  three_daily: '每天三次',
  weekly: '每周',
  as_needed: '按需服用',
  cycle: '周期服用',
}

export const UNIT_OPTIONS = ['粒', '片', '颗', 'ml', '滴', '包', '支']
