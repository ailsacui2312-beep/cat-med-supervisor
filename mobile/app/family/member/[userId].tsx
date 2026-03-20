import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors } from '../../../constants/colors'
import { useAuth } from '../../../hooks/useAuth'
import { useMode } from '../../../contexts/ModeContext'
import { getMemberTodayItems, markMemberMedTaken } from '../../../lib/family'
import type { TodayItem } from '../../../lib/types'

const TIME_GROUPS = [
  { label: '早上', start: '00:00', end: '11:59' },
  { label: '下午', start: '12:00', end: '17:59' },
  { label: '晚上', start: '18:00', end: '23:59' },
]

export default function MemberDetailScreen() {
  const { userId: memberId } = useLocalSearchParams<{ userId: string }>()
  const { user } = useAuth()
  const { s, si } = useMode()
  const router = useRouter()
  const [items, setItems] = useState<TodayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [memberName, setMemberName] = useState('家人')

  const loadData = useCallback(async () => {
    if (!memberId) return
    try {
      const [todayItems, savedName] = await Promise.all([
        getMemberTodayItems(memberId),
        AsyncStorage.getItem(`nickname_${memberId}`),
      ])
      setItems(todayItems)
      if (savedName) setMemberName(savedName)
    } catch (e: any) {
      console.error('Failed to load member data:', e)
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleHelpTake = async (item: TodayItem) => {
    Alert.alert(
      '帮忙标记',
      `确认帮 ${memberName} 标记「${item.medication.name}」为已服用？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: async () => {
            try {
              await markMemberMedTaken(item.log.id)
              await loadData()
              Alert.alert('已标记', `已帮 ${memberName} 标记「${item.medication.name}」为已服用`)
            } catch (e: any) {
              Alert.alert('错误', e.message)
            }
          },
        },
      ]
    )
  }

  const takenCount = items.filter(i => i.log.status === 'taken').length
  const totalCount = items.length
  const missedCount = items.filter(i => i.log.status === 'missed').length
  const pendingCount = items.filter(i => i.log.status === 'pending').length

  const groupedSections = TIME_GROUPS.map(group => ({
    ...group,
    data: items.filter(
      i => i.log.scheduled_time >= group.start && i.log.scheduled_time <= group.end
    ),
  })).filter(g => g.data.length > 0)

  const today = new Date()
  const dateStr = format(today, 'M月d日 EEEE', { locale: zhCN })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={si(24)} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: s(18) }]}>{memberName}的用药</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: s(20) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Date */}
        <Text style={[styles.dateText, { fontSize: s(14), marginTop: s(12) }]}>{dateStr}</Text>

        {/* Stats summary */}
        <View style={[styles.statsRow, { marginTop: s(12), marginBottom: s(20) }]}>
          <View style={[styles.statCard, { borderRadius: s(14), padding: s(14) }]}>
            <Text style={[styles.statNum, { fontSize: s(24) }]}>{takenCount}</Text>
            <Text style={[styles.statLabel, { fontSize: s(12) }]}>已服用</Text>
          </View>
          <View style={[styles.statCard, { borderRadius: s(14), padding: s(14) }]}>
            <Text style={[styles.statNum, { fontSize: s(24), color: Colors.warning }]}>{pendingCount}</Text>
            <Text style={[styles.statLabel, { fontSize: s(12) }]}>待服用</Text>
          </View>
          <View style={[styles.statCard, { borderRadius: s(14), padding: s(14) }]}>
            <Text style={[styles.statNum, { fontSize: s(24), color: Colors.danger }]}>{missedCount}</Text>
            <Text style={[styles.statLabel, { fontSize: s(12) }]}>已漏服</Text>
          </View>
        </View>

        {/* Medication list */}
        {totalCount === 0 && !loading ? (
          <View style={styles.emptyArea}>
            <MaterialIcons name="check-circle" size={si(48)} color={Colors.success} />
            <Text style={[styles.emptyText, { fontSize: s(16) }]}>今天没有需要吃的药</Text>
          </View>
        ) : (
          groupedSections.map(group => (
            <View key={group.label} style={styles.section}>
              <Text style={[styles.sectionTitle, { fontSize: s(12) }]}>{group.label}</Text>
              {group.data.map(item => {
                const isDone = item.log.status === 'taken'
                const isMissed = item.log.status === 'missed'
                const isPending = item.log.status === 'pending'

                return (
                  <View
                    key={item.log.id}
                    style={[
                      styles.medCard,
                      { padding: s(14), borderRadius: s(14) },
                      isDone && styles.medCardDone,
                      isMissed && styles.medCardMissed,
                    ]}
                  >
                    <View style={[styles.colorDot, { backgroundColor: item.medication.color }]} />
                    <View style={styles.medInfo}>
                      <Text style={[styles.medName, { fontSize: s(15) }, isDone && styles.medNameDone]}>
                        {item.medication.name}
                      </Text>
                      <Text style={[styles.medDosage, { fontSize: s(12) }]}>
                        {item.medication.dosage || ''} {item.medication.unit}
                        {'  '}
                        {item.log.scheduled_time.slice(0, 5)}
                      </Text>
                    </View>

                    {/* Status / action */}
                    {isDone ? (
                      <View style={[styles.statusBadge, { backgroundColor: Colors.success + '15', borderRadius: s(10), paddingHorizontal: s(10), paddingVertical: s(4) }]}>
                        <MaterialIcons name="check" size={si(14)} color={Colors.success} />
                        <Text style={[styles.statusText, { fontSize: s(12), color: Colors.success }]}>已服用</Text>
                      </View>
                    ) : isMissed ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.statusBadge, { backgroundColor: Colors.danger + '15', borderRadius: s(10), paddingHorizontal: s(10), paddingVertical: s(4) }]}>
                          <MaterialIcons name="warning" size={si(14)} color={Colors.danger} />
                          <Text style={[styles.statusText, { fontSize: s(12), color: Colors.danger }]}>漏服</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.helpBtn, { borderRadius: s(10), paddingHorizontal: s(12), paddingVertical: s(6) }]}
                          onPress={() => handleHelpTake(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.helpBtnText, { fontSize: s(12) }]}>帮标记</Text>
                        </TouchableOpacity>
                      </View>
                    ) : isPending ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.statusBadge, { backgroundColor: Colors.warning + '15', borderRadius: s(10), paddingHorizontal: s(10), paddingVertical: s(4) }]}>
                          <MaterialIcons name="schedule" size={si(14)} color={Colors.warning} />
                          <Text style={[styles.statusText, { fontSize: s(12), color: Colors.warning }]}>待服用</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.helpBtn, { borderRadius: s(10), paddingHorizontal: s(12), paddingVertical: s(6) }]}
                          onPress={() => handleHelpTake(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.helpBtnText, { fontSize: s(12) }]}>帮标记</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                )
              })}
            </View>
          ))
        )}

        {/* All done */}
        {takenCount === totalCount && totalCount > 0 && (
          <View style={styles.allDone}>
            <View style={[styles.allDoneCircle, { width: s(56), height: s(56), borderRadius: s(28) }]}>
              <MaterialIcons name="celebration" size={si(28)} color={Colors.success} />
            </View>
            <Text style={[styles.allDoneText, { fontSize: s(16) }]}>
              {memberName}今天的药都吃完啦！
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: { fontWeight: '700', color: Colors.textPrimary },
  scroll: { paddingBottom: 40 },

  dateText: { color: Colors.textSecondary, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statNum: { fontWeight: '800', color: Colors.textPrimary },
  statLabel: { color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },

  section: { marginBottom: 16 },
  sectionTitle: {
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  medCard: {
    backgroundColor: Colors.bgCard,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  medInfo: { flex: 1 },
  medName: { fontWeight: '600', color: Colors.textPrimary },
  medNameDone: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  medDosage: { color: Colors.textSecondary, marginTop: 2 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: { fontWeight: '600' },

  helpBtn: {
    backgroundColor: Colors.primary,
  },
  helpBtnText: {
    color: '#fff',
    fontWeight: '600',
  },

  emptyArea: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: { color: Colors.textSecondary, fontWeight: '500' },

  allDone: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  allDoneCircle: {
    backgroundColor: Colors.success + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  allDoneText: { color: Colors.success, fontWeight: '600' },
})
