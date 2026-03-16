import { supabase } from './supabase'
import type { HealthRecord, HealthType } from './types'

export interface CreateHealthRecordInput {
  type: HealthType
  value1: number
  value2?: number
  unit: string
  measured_at?: string
  notes?: string
  source?: 'manual' | 'screenshot'
}

export async function createHealthRecord(
  userId: string,
  input: CreateHealthRecordInput
): Promise<HealthRecord> {
  const { data, error } = await supabase
    .from('health_records')
    .insert({
      user_id: userId,
      type: input.type,
      value1: input.value1,
      value2: input.value2 ?? null,
      unit: input.unit,
      measured_at: input.measured_at || new Date().toISOString(),
      notes: input.notes || null,
      source: input.source || 'manual',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function fetchLatestByType(
  userId: string,
  type: HealthType
): Promise<HealthRecord | null> {
  const { data, error } = await supabase
    .from('health_records')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchLatestAll(
  userId: string
): Promise<Record<HealthType, HealthRecord | null>> {
  const [bs, bp, wt] = await Promise.all([
    fetchLatestByType(userId, 'blood_sugar'),
    fetchLatestByType(userId, 'blood_pressure'),
    fetchLatestByType(userId, 'weight'),
  ])
  return { blood_sugar: bs, blood_pressure: bp, weight: wt }
}

export async function fetchHealthHistory(
  userId: string,
  type: HealthType,
  limit = 30
): Promise<HealthRecord[]> {
  const { data, error } = await supabase
    .from('health_records')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .order('measured_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function deleteHealthRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from('health_records')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Health data display helpers
export const HEALTH_TYPE_INFO: Record<HealthType, {
  label: string
  emoji: string
  defaultUnit: string
  color: string
  format: (r: HealthRecord) => string
  normalRange: (v1: number, v2?: number | null) => 'low' | 'normal' | 'high'
}> = {
  blood_sugar: {
    label: '血糖',
    emoji: '🩸',
    defaultUnit: 'mmol/L',
    color: '#FF6B6B',
    format: (r) => `${r.value1} ${r.unit}`,
    normalRange: (v) => v < 3.9 ? 'low' : v > 7.8 ? 'high' : 'normal',
  },
  blood_pressure: {
    label: '血压',
    emoji: '💓',
    defaultUnit: 'mmHg',
    color: '#6C9BD2',
    format: (r) => `${r.value1}/${r.value2 ?? '-'} ${r.unit}`,
    normalRange: (v1, v2) => {
      if (v1 < 90 || (v2 != null && v2 < 60)) return 'low'
      if (v1 >= 140 || (v2 != null && v2 >= 90)) return 'high'
      return 'normal'
    },
  },
  weight: {
    label: '体重',
    emoji: '⚖️',
    defaultUnit: 'kg',
    color: '#4CAF50',
    format: (r) => `${r.value1} ${r.unit}`,
    normalRange: () => 'normal', // Weight has no universal "normal"
  },
}
