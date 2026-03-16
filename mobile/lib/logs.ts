import { supabase } from './supabase'
import type { MedicationLog, TodayItem } from './types'
import { format } from 'date-fns'
import { isInActivePeriod } from './cycles'

export async function fetchTodayItems(userId: string): Promise<TodayItem[]> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const dayOfWeek = new Date().getDay() // 0=Sun, 6=Sat

  // Get all active schedules for today's day of week
  const { data: schedules, error: schedError } = await supabase
    .from('schedules')
    .select('*, medications(*)')
    .eq('user_id', userId)
    .eq('enabled', true)
    .contains('days_of_week', [dayOfWeek])

  if (schedError) throw schedError

  // Get existing logs for today
  const { data: existingLogs, error: logError } = await supabase
    .from('medication_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('scheduled_date', today)

  if (logError) throw logError

  const logsBySchedule = new Map(
    (existingLogs || []).map(log => [log.schedule_id, log])
  )

  const items: TodayItem[] = []

  for (const schedule of schedules || []) {
    const medication = (schedule as any).medications
    if (!medication || !medication.is_active) continue

    // Skip if medication is in a cycle rest period
    if (!isInActivePeriod(medication, new Date())) continue

    let log = logsBySchedule.get(schedule.id)

    // Create pending log if none exists
    if (!log) {
      const { data: newLog, error: createError } = await supabase
        .from('medication_logs')
        .insert({
          user_id: userId,
          medication_id: schedule.medication_id,
          schedule_id: schedule.id,
          scheduled_date: today,
          scheduled_time: schedule.time_of_day,
          status: 'pending',
        })
        .select()
        .single()

      if (createError) {
        // Might already exist (race condition), try to fetch
        const { data: existing } = await supabase
          .from('medication_logs')
          .select('*')
          .eq('schedule_id', schedule.id)
          .eq('scheduled_date', today)
          .single()
        log = existing || undefined
      } else {
        log = newLog
      }
    }

    if (log) {
      items.push({
        log,
        medication: { ...medication, schedules: undefined },
        schedule,
      })
    }
  }

  // Auto-mark overdue pending logs as missed (2+ hours past scheduled time)
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  for (const item of items) {
    if (item.log.status === 'pending') {
      const [h, m] = item.log.scheduled_time.split(':').map(Number)
      const scheduledMinutes = h * 60 + m
      if (nowMinutes - scheduledMinutes >= 120) {
        // Mark as missed in DB
        await supabase
          .from('medication_logs')
          .update({ status: 'missed' })
          .eq('id', item.log.id)
        item.log.status = 'missed'
      }
    }
  }

  // Sort by scheduled time
  items.sort((a, b) => a.log.scheduled_time.localeCompare(b.log.scheduled_time))

  return items
}

export async function markAsTaken(logId: string): Promise<void> {
  const { error } = await supabase
    .from('medication_logs')
    .update({
      status: 'taken',
      taken_at: new Date().toISOString(),
    })
    .eq('id', logId)

  if (error) throw error
}

export async function markAsSkipped(logId: string): Promise<void> {
  const { error } = await supabase
    .from('medication_logs')
    .update({ status: 'skipped' })
    .eq('id', logId)

  if (error) throw error
}

export async function undoLog(logId: string): Promise<void> {
  const { error } = await supabase
    .from('medication_logs')
    .update({ status: 'pending', taken_at: null })
    .eq('id', logId)

  if (error) throw error
}

export async function fetchLogsForDate(
  userId: string,
  date: string
): Promise<MedicationLog[]> {
  const { data, error } = await supabase
    .from('medication_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('scheduled_date', date)
    .order('scheduled_time', { ascending: true })

  if (error) throw error
  return data || []
}

export async function fetchLogsForRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<MedicationLog[]> {
  const { data, error } = await supabase
    .from('medication_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_date', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getStreakDays(userId: string): Promise<number> {
  // Fetch last 60 days of logs
  const endDate = format(new Date(), 'yyyy-MM-dd')
  const startDate = format(
    new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    'yyyy-MM-dd'
  )

  const { data, error } = await supabase
    .from('medication_logs')
    .select('scheduled_date, status')
    .eq('user_id', userId)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)

  if (error) throw error
  if (!data || data.length === 0) return 0

  // Group by date, check if all logs for each day are taken
  const byDate = new Map<string, { total: number; taken: number }>()
  for (const log of data) {
    const d = byDate.get(log.scheduled_date) || { total: 0, taken: 0 }
    d.total++
    if (log.status === 'taken') d.taken++
    byDate.set(log.scheduled_date, d)
  }

  // Count consecutive days from today backwards
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 60; i++) {
    const date = format(
      new Date(today.getTime() - i * 24 * 60 * 60 * 1000),
      'yyyy-MM-dd'
    )
    const dayData = byDate.get(date)
    if (!dayData) {
      if (i === 0) continue // Today might not have logs yet
      break
    }
    if (dayData.taken === dayData.total) {
      streak++
    } else {
      if (i === 0) continue // Today is still in progress
      break
    }
  }

  return streak
}

/**
 * Get profile statistics: total taken count and total active days.
 */
export async function getProfileStats(userId: string): Promise<{ totalTaken: number; activeDays: number }> {
  // Total taken
  const { count: totalTaken, error: e1 } = await supabase
    .from('medication_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'taken')

  if (e1) throw e1

  // Distinct active days
  const { data, error: e2 } = await supabase
    .from('medication_logs')
    .select('scheduled_date')
    .eq('user_id', userId)
    .eq('status', 'taken')

  if (e2) throw e2

  const uniqueDays = new Set((data || []).map(r => r.scheduled_date))

  return {
    totalTaken: totalTaken || 0,
    activeDays: uniqueDays.size,
  }
}
