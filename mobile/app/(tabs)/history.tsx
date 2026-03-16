import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { format, subDays, addDays, isSameDay } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { fetchLogsForDate, getStreakDays } from '../../lib/logs'
import { fetchMedications } from '../../lib/medications'
import type { MedicationLog, Medication } from '../../lib/types'

const DAYS_TO_SHOW = 14

const STATUS_CONFIG: Record<string, {
  icon: keyof typeof MaterialIcons.glyphMap
  color: string
  bgColor: string
  label: string
}> = {
  taken:   { icon: 'check-circle',  color: '#10B981', bgColor: '#10B98118', label: '已吃' },
  skipped: { icon: 'skip-next',     color: '#94A3B8', bgColor: '#94A3B818', label: '跳过' },
  missed:  { icon: 'cancel',        color: '#EF4444', bgColor: '#EF444418', label: '漏服' },
  pending: { icon: 'pending',       color: '#FF9E42', bgColor: '#FF9E4218', label: '待服' },
}

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

  const getStatusConfig = (status: string) =>
    STATUS_CONFIG[status] || STATUS_CONFIG.pending

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>记录</Text>
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <MaterialIcons name="local-fire-department" color="#FF9E42" size={16} />
            <Text style={styles.streakText}>{streak}天</Text>
          </View>
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
        <View>
          <Text style={styles.summaryDate}>
            {format(selectedDate, 'M月d日', { locale: zhCN })}
          </Text>
          {totalCount > 0 && (
            <Text style={styles.summaryDetail}>
              {takenCount}/{totalCount} 项已完成
            </Text>
          )}
        </View>
        {totalCount > 0 ? (
          <View style={styles.summaryStats}>
            <Text style={styles.summaryTopLabel}>服药依从性</Text>
            <View style={styles.summaryRateRow}>
              <Text style={styles.summaryRate}>{rate}%</Text>
              {rate > 0 && (
                <MaterialIcons
                  name="trending-up"
                  color={Colors.success}
                  size={18}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
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
            <MaterialIcons name="event-note" color={Colors.textMuted} size={40} />
            <Text style={styles.emptyDayText}>这一天没有用药计划</Text>
          </View>
        }
        renderItem={({ item }) => {
          const med = medications.get(item.medication_id)
          const cfg = getStatusConfig(item.status)
          return (
            <View style={styles.logCard}>
              <View style={[styles.logIconCircle, { backgroundColor: cfg.bgColor }]}>
                <MaterialIcons name={cfg.icon} color={cfg.color} size={22} />
              </View>
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
                { color: cfg.color },
              ]}>
                {cfg.label}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9E4215',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streakText: {
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
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
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
    paddingVertical: 18,
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: Colors.primary + '15',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  summaryDate: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  summaryDetail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  summaryStats: {
    alignItems: 'flex-end',
  },
  summaryTopLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  summaryRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryRate: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.success,
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
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  logIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 12,
  },
  emptyDayText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
})
