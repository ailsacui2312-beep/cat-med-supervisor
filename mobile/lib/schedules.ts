import { supabase } from './supabase'
import type { Schedule } from './types'

export async function createSchedule(
  medicationId: string,
  userId: string,
  timeOfDay: string,
  daysOfWeek: number[] = [0, 1, 2, 3, 4, 5, 6]
): Promise<Schedule> {
  const { data, error } = await supabase
    .from('schedules')
    .insert({
      medication_id: medicationId,
      user_id: userId,
      time_of_day: timeOfDay,
      days_of_week: daysOfWeek,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function updateSchedule(
  id: string,
  updates: {
    time_of_day?: string
    days_of_week?: number[]
    enabled?: boolean
    notification_id?: string | null
  }
): Promise<Schedule> {
  const { data, error } = await supabase
    .from('schedules')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function fetchSchedulesForMedication(medicationId: string): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('medication_id', medicationId)
    .order('time_of_day', { ascending: true })

  if (error) throw error
  return data || []
}
