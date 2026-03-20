/**
 * Reminder Service — single source of truth for notification ↔ DB consistency.
 *
 * All notification side-effects go through here. Screens should NOT import
 * from notifications.ts directly for schedule/cancel operations.
 *
 * Principles:
 * - DB is source of truth; system notification is derived state
 * - On failure, prefer "no notification" over "orphan notification"
 * - Never leave a stale notification_id in DB
 */

import {
  setupNotifications,
  scheduleMedicationReminder,
  cancelMedicationReminder,
} from './notifications'
import { updateSchedule, createSchedule, deleteSchedule } from './schedules'
import { fetchMedication, archiveMedication, restoreMedication } from './medications'
import type { Schedule, Medication, MedicationWithSchedules } from './types'

// ── Toggle a single schedule on/off ─────────────────────────────────

export async function enableSchedule(
  schedule: Schedule,
  medication: Medication,
): Promise<void> {
  await setupNotifications()
  const notificationId = await scheduleMedicationReminder(schedule, medication)
  // Write DB only after notification succeeds (or returns null on soft failure)
  await updateSchedule(schedule.id, {
    enabled: true,
    notification_id: notificationId,
  })
}

export async function disableSchedule(schedule: Schedule): Promise<void> {
  // Cancel system notification first; if it fails, we still want DB to reflect "disabled"
  await cancelMedicationReminder(schedule.notification_id)
  await updateSchedule(schedule.id, {
    enabled: false,
    notification_id: null,
  })
}

// ── Create schedules + notifications for a new/edited medication ────

export async function createSchedulesWithReminders(
  medicationId: string,
  userId: string,
  times: string[],
  medication: Medication,
): Promise<void> {
  await setupNotifications()
  for (const time of times) {
    const schedule = await createSchedule(medicationId, userId, time)
    const notificationId = await scheduleMedicationReminder(schedule, medication)
    if (notificationId) {
      await updateSchedule(schedule.id, { notification_id: notificationId })
    }
  }
}

// ── Tear down old schedules and rebuild (for edit flow) ─────────────

export async function replaceSchedules(
  medicationId: string,
  userId: string,
  oldSchedules: Schedule[],
  newTimes: string[],
  medication: Medication,
): Promise<void> {
  // 1. Cancel all old notifications
  for (const old of oldSchedules) {
    await cancelMedicationReminder(old.notification_id)
    await deleteSchedule(old.id)
  }
  // 2. Create new schedules with notifications
  await createSchedulesWithReminders(medicationId, userId, newTimes, medication)
}

// ── Archive: cancel all notifications, keep schedule enabled state ──

/**
 * Archive a medication and cancel its notifications.
 * Unlike the PR's approach, we do NOT flip schedule.enabled to false.
 * This preserves the user's schedule preferences for restore.
 * We only clear notification_ids since the notifications are cancelled.
 */
export async function archiveWithCleanup(
  med: MedicationWithSchedules,
): Promise<void> {
  // Cancel all system notifications first
  for (const schedule of med.schedules) {
    if (schedule.notification_id) {
      await cancelMedicationReminder(schedule.notification_id)
      // Clear stale notification_id but keep enabled as-is
      await updateSchedule(schedule.id, { notification_id: null })
    }
  }
  // Then archive
  await archiveMedication(med.id)
}

// ── Restore: re-register notifications for enabled schedules ────────

export async function restoreWithReminders(
  medId: string,
): Promise<void> {
  // Restore first so the medication is active again
  await restoreMedication(medId)
  // Re-fetch to get the full medication + schedules
  const med = await fetchMedication(medId)
  if (!med) return

  await setupNotifications()
  for (const schedule of med.schedules) {
    if (schedule.enabled) {
      const notificationId = await scheduleMedicationReminder(schedule, med)
      await updateSchedule(schedule.id, { notification_id: notificationId })
    }
  }
}
