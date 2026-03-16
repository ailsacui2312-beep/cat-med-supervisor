import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format, subDays, addDays, isSameDay } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { fetchLogsForDate, getStreakDays } from '../../lib/logs'
import { fetchMedications } from '../../lib/medications'
import type { MedicationLog, Medication } from '../../lib/types'

const DAYS_TO_SHOW = 14

export default function HistoryScreen() {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [logs, setLogs] = useState<MedicationLog[]>([])
  const [medications, setMedications] = useState<Map<string, Medication>>(new Map())
  const [streak, setStreak] = useState(0)

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const [dayLogs, meds, streakDays] = await Promise.all([
        fetchLogsForDate(user.id, dateStr),
        fetchMedications(user.id),
        getStreakDays(user.id),
      ])
      setLogs(dayLogs)
      setMedications(new Map(meds.map(m => [m.id, m])))
      setStreak(streakDays)
    } catch (e) {
      console.error('Failed to load history:', e)
    }
  }, [user, selectedDate])

  useEffect(() => { loadData() }, [loadData])

  const dates = Array.from({ length: DAYS_TO_SHOW }, (_, i) =>
    subDays(new Date(), DAYS_TO_SHOW - 1 - i)
  )

  const takenCount = logs.filter(l => l.status === 'taken').length
  const totalCount = logs.length
  const rate = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0

  const statusIcon = (status: string) => {
    switch (status) {
      case 'taken': return '✅'
      case 'skipped': return '⏭️'
      case 'missed': return '❌'
      default: return '⏳'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'taken': return '已吃'
      case 'skipped': return '跳过'
      case 'missed': return '漏服'
      default: return '待服'
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>记录</Text>
        {streak > 0 && (
          <Text style={styles.streakBadge}>🔥 {streak}天</Text>
        )}
      </View>

      {/* Calendar Strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calendarStrip}
      >
        {dates.map(date => {
          const isSelected = isSameDay(date, selectedDate)
          const isToday = isSameDay(date, new Date())
          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={[
                styles.dateItem,
                isSelected && styles.dateItemSelected,
              ]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={[
                styles.dateWeekday,
                isSelected && styles.dateTextSelected,
              ]}>
                {format(date, 'EEE', { locale: zhCN })}
              </Text>
              <Text style={[
                styles.dateDay,
                isSelected && styles.dateTextSelected,
                isToday && !isSelected && styles.dateDayToday,
              ]}>
                {format(date, 'd')}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryDate}>
          {format(selectedDate, 'M月d日', { locale: zhCN })}
        </Text>
        {totalCount > 0 ? (
          <View style={styles.summaryStats}>
            <Text style={styles.summaryRate}>{rate}%</Text>
            <Text style={styles.summaryLabel}>完成率</Text>
          </View>
        ) : (
          <Text style={styles.summaryEmpty}>无用药记录</Text>
        )}
      </View>

      {/* Logs */}
      <FlatList
        data={logs}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyDay}>
            <Text style={styles.emptyDayText}>这一天没有用药计划</Text>
          </View>
        }
        renderItem={({ item }) => {
          const med = medications.get(item.medication_id)
          return (
            <View style={styles.logCard}>
              <Text style={styles.logIcon}>{statusIcon(item.status)}</Text>
              <View style={styles.logInfo}>
                <Text style={styles.logName}>
                  {med?.name || '未知药品'}
                </Text>
                <Text style={styles.logTime}>
                  计划 {item.scheduled_time.slice(0, 5)}
                  {item.taken_at && (
                    `  ·  实际 ${format(new Date(item.taken_at), 'HH:mm')}`
                  )}
                </Text>
              </View>
              <Text style={[
                styles.logStatus,
                { color: item.status === 'taken' ? Colors.success : Colors.textMuted },
              ]}>
                {statusLabel(item.status)}
              </Text>
            </View>
          )
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  streakBadge: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  calendarStrip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  dateItem: {
    width: 48,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
  },
  dateItemSelected: {
    backgroundColor: Colors.primary,
  },
  dateWeekday: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dateDayToday: {
    color: Colors.primary,
  },
  dateTextSelected: {
    color: Colors.textOnPrimary,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  summaryDate: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  summaryStats: {
    alignItems: 'center',
  },
  summaryRate: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.success,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  summaryEmpty: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  logCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  logIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  logInfo: {
    flex: 1,
  },
  logName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  logTime: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logStatus: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyDay: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyDayText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
})
