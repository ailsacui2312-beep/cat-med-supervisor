import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { fetchTodayItems, markAsTaken, markAsSkipped, undoLog, getStreakDays } from '../../lib/logs'
import type { TodayItem } from '../../lib/types'

const TIME_GROUPS = [
  { label: '早上', start: '00:00', end: '11:59' },
  { label: '下午', start: '12:00', end: '17:59' },
  { label: '晚上', start: '18:00', end: '23:59' },
]

export default function TodayScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<TodayItem[]>([])
  const [streak, setStreak] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const [todayItems, streakDays] = await Promise.all([
        fetchTodayItems(user.id),
        getStreakDays(user.id),
      ])
      setItems(todayItems)
      setStreak(streakDays)
    } catch (e: any) {
      console.error('Failed to load today:', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleTake = async (item: TodayItem) => {
    try {
      await markAsTaken(item.log.id)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      await loadData()
    } catch (e: any) {
      Alert.alert('错误', e.message)
    }
  }

  const handleSkip = async (item: TodayItem) => {
    try {
      await markAsSkipped(item.log.id)
      await loadData()
    } catch (e: any) {
      Alert.alert('错误', e.message)
    }
  }

  const handleUndo = async (item: TodayItem) => {
    try {
      await undoLog(item.log.id)
      await loadData()
    } catch (e: any) {
      Alert.alert('错误', e.message)
    }
  }

  const takenCount = items.filter(i => i.log.status === 'taken').length
  const totalCount = items.length
  const progress = totalCount > 0 ? takenCount / totalCount : 0

  const today = new Date()
  const dateStr = format(today, 'M月d日 EEEE', { locale: zhCN })

  const renderItem = ({ item }: { item: TodayItem }) => {
    const isDone = item.log.status === 'taken'
    const isSkipped = item.log.status === 'skipped'
    const isMissed = item.log.status === 'missed'

    return (
      <View style={[
        styles.medCard,
        isDone && styles.medCardDone,
        isMissed && styles.medCardMissed,
      ]}>
        <View style={[styles.colorDot, { backgroundColor: item.medication.color }]} />
        <View style={styles.medInfo}>
          <Text style={[styles.medName, isDone && styles.medNameDone]}>
            {item.medication.name}
          </Text>
          <Text style={styles.medDosage}>
            {item.medication.dosage || ''} {item.medication.unit}
            {'  '}
            {item.log.scheduled_time.slice(0, 5)}
            {isMissed && '  ⚠️ 漏服'}
          </Text>
        </View>
        <View style={styles.actions}>
          {isDone ? (
            <TouchableOpacity onPress={() => handleUndo(item)} style={styles.doneButton}>
              <Text style={styles.doneIcon}>✓</Text>
            </TouchableOpacity>
          ) : isSkipped ? (
            <TouchableOpacity onPress={() => handleUndo(item)} style={styles.skippedButton}>
              <Text style={styles.skippedText}>已跳过</Text>
            </TouchableOpacity>
          ) : isMissed ? (
            <TouchableOpacity onPress={() => handleTake(item)} style={styles.missedTakeButton}>
              <Text style={styles.missedTakeText}>补吃了</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => handleSkip(item)}
                style={styles.skipButton}
              >
                <Text style={styles.skipText}>跳过</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleTake(item)}
                style={styles.takeButton}
              >
                <Text style={styles.takeText}>吃了</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    )
  }

  const groupedSections = TIME_GROUPS.map(group => ({
    ...group,
    data: items.filter(
      i => i.log.scheduled_time >= group.start && i.log.scheduled_time <= group.end
    ),
  })).filter(g => g.data.length > 0)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{dateStr}</Text>
          {streak > 0 && (
            <Text style={styles.streakText}>
              🔥 连续 {streak} 天按时吃药
            </Text>
          )}
        </View>
        {totalCount > 0 && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {takenCount}/{totalCount}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
          </View>
        )}
      </View>

      {/* Content */}
      {totalCount === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🐱</Text>
          <Text style={styles.emptyTitle}>今天没有需要吃的药</Text>
          <Text style={styles.emptySubtitle}>去药柜添加药品和提醒时间吧</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/medication/add')}
          >
            <Text style={styles.addButtonText}>+ 添加药品</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groupedSections}
          keyExtractor={(item) => item.label}
          renderItem={({ item: group }) => (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{group.label}</Text>
              {group.data.map(item => (
                <View key={item.log.id}>
                  {renderItem({ item })}
                </View>
              ))}
            </View>
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListFooterComponent={
            takenCount === totalCount && totalCount > 0 ? (
              <View style={styles.allDone}>
                <Text style={styles.allDoneEmoji}>🎉</Text>
                <Text style={styles.allDoneText}>今天的药都吃完啦！</Text>
              </View>
            ) : null
          }
        />
      )}
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
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  dateText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  streakText: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 4,
    fontWeight: '500',
  },
  progressContainer: {
    alignItems: 'flex-end',
  },
  progressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  progressBar: {
    width: 80,
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  medCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  medCardDone: {
    opacity: 0.6,
    backgroundColor: '#F0FFF0',
  },
  medCardMissed: {
    borderColor: Colors.danger + '40',
    backgroundColor: '#FFF5F5',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  medInfo: {
    flex: 1,
  },
  medName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  medNameDone: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  medDosage: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  takeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  takeText: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  doneButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  skippedButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.bgInput,
  },
  skippedText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  missedTakeButton: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  missedTakeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  addButtonText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  allDone: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  allDoneEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  allDoneText: {
    fontSize: 16,
    color: Colors.success,
    fontWeight: '600',
  },
})
