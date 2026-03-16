import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { Schedule, Medication } from './types'

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function setupNotifications(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return false

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medication-reminders', {
      name: '吃药提醒',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    })
  }

  return true
}

export async function scheduleMedicationReminder(
  schedule: Schedule,
  medication: Medication
): Promise<string | null> {
  const [hours, minutes] = schedule.time_of_day.split(':').map(Number)

  const dosageText = medication.dosage ? ` ${medication.dosage}` : ''
  const content = {
    title: '该吃药啦 💊',
    body: `${medication.name}${dosageText}（${medication.unit}）`,
    data: {
      scheduleId: schedule.id,
      medicationId: medication.id,
    },
    ...(Platform.OS === 'android' && { channelId: 'medication-reminders' }),
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      },
    })
    return id
  } catch (e) {
    console.warn('Failed to schedule notification:', e)
    return null
  }
}

export async function cancelMedicationReminder(
  notificationId: string | null
): Promise<void> {
  if (!notificationId) return
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId)
  } catch (e) {
    console.warn('Failed to cancel notification:', e)
  }
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}
