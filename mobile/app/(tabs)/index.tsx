import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ScrollView, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { MaterialIcons } from '@expo/vector-icons'
import { Video, ResizeMode } from 'expo-av'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useMode } from '../../contexts/ModeContext'
import { fetchTodayItems, markAsTaken, markAsSkipped, undoLog, getStreakDays, hasBadStreak } from '../../lib/logs'
import { getMyFamily } from '../../lib/family'
import type { TodayItem, FamilyMemberWithEmail } from '../../lib/types'
import type { VoiceIntent } from '../../lib/voice'
import VoiceModal from '../../components/VoiceModal'

// Cat animation videos — random happy ones + a special "worried" one
const CAT_VIDEOS_NORMAL = [
  require('../../assets/cat-videos/坐着.mp4'),
  require('../../assets/cat-videos/开心.mp4'),
  require('../../assets/cat-videos/打招呼.mp4'),
  require('../../assets/cat-videos/跑过来.mp4'),
  require('../../assets/cat-videos/转圈圈.mp4'),
  require('../../assets/cat-videos/一起玩.mp4'),
]
const CAT_VIDEO_WORRIED = require('../../assets/cat-videos/担心.mp4')

const TIME_GROUPS = [
  { label: '早上', start: '00:00', end: '11:59' },
  { label: '下午', start: '12:00', end: '17:59' },
  { label: '晚上', start: '18:00', end: '23:59' },
]

export default function TodayScreen() {
  const { user } = useAuth()
  const { s, si } = useMode()
  const router = useRouter()
  const [items, setItems] = useState<TodayItem[]>([])
  const [streak, setStreak] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [voiceVisible, setVoiceVisible] = useState(false)
  const [worried, setWorried] = useState(false)
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberWithEmail[]>([])
  const [memberNicknames, setMemberNicknames] = useState<Record<string, string>>({})
  // Cat video state: which video to show + key to force remount
  const videoRef = useRef<Video>(null)
  const [videoKey, setVideoKey] = useState(0)
  const [catVideoSource, setCatVideoSource] = useState(
    () => CAT_VIDEOS_NORMAL[Math.floor(Math.random() * CAT_VIDEOS_NORMAL.length)]
  )

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const [todayItems, streakDays, isBadStreak, familyData] = await Promise.all([
        fetchTodayItems(user.id),
        getStreakDays(user.id),
        hasBadStreak(user.id, 3),
        getMyFamily(user.id).catch(() => null),
      ])
      setItems(todayItems)
      setStreak(streakDays)
      setWorried(isBadStreak)
      if (familyData) {
        // Only show other members (not self)
        const others = familyData.members.filter(m => m.user_id !== user.id)
        setFamilyMembers(others)
        // Load nicknames
        const nicks: Record<string, string> = {}
        for (const m of others) {
          const saved = await AsyncStorage.getItem(`nickname_${m.user_id}`)
          if (saved) nicks[m.user_id] = saved
          else if (m.nickname) nicks[m.user_id] = m.nickname
        }
        setMemberNicknames(nicks)
      } else {
        setFamilyMembers([])
      }
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

  // Happy cat videos to play after taking meds
  const CAT_HAPPY_VIDEOS = [
    require('../../assets/cat-videos/开心.mp4'),
    require('../../assets/cat-videos/转圈圈.mp4'),
  ]

  const handleTake = async (item: TodayItem) => {
    try {
      await markAsTaken(item.log.id)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      // Play a happy cat video!
      const happyVideo = CAT_HAPPY_VIDEOS[Math.floor(Math.random() * CAT_HAPPY_VIDEOS.length)]
      setCatVideoSource(happyVideo)
      setVideoKey(k => k + 1)
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

  // Voice intent handler
  const handleVoiceConfirm = (intent: VoiceIntent) => {
    setVoiceVisible(false)
    switch (intent.type) {
      case 'ADD_MED':
        router.push({
          pathname: '/medication/add',
          params: {
            name: intent.name,
            ...(intent.illness ? { illness: intent.illness } : {}),
            ...(intent.usage_note ? { usage_note: intent.usage_note } : {}),
          },
        })
        break
      case 'ADD_HEALTH':
        router.push({
          pathname: '/health/add',
          params: {
            type: intent.healthType,
            ...(intent.value !== undefined ? { value: intent.value.toString() } : {}),
          },
        })
        break
      case 'MARK_TAKEN': {
        const match = items.find(
          i => i.medication.id === intent.medication.id && i.log.status === 'pending'
        )
        if (match) {
          handleTake(match)
        } else {
          Alert.alert('提示', `「${intent.medication.name}」今天没有待服用的记录`)
        }
        break
      }
      case 'UNKNOWN':
        Alert.alert('无法识别', intent.rawText)
        break
    }
  }

  const allMedications = items.map(i => i.medication)

  const takenCount = items.filter(i => i.log.status === 'taken').length
  const totalCount = items.length
  const progress = totalCount > 0 ? takenCount / totalCount : 0

  // Show worried cat only when user hasn't taken meds well for 3+ consecutive days
  const catVideo = worried ? CAT_VIDEO_WORRIED : catVideoSource

  const today = new Date()
  const dateStr = format(today, 'M月d日 EEEE', { locale: zhCN })

  const renderItem = ({ item }: { item: TodayItem }) => {
    const isDone = item.log.status === 'taken'
    const isSkipped = item.log.status === 'skipped'
    const isMissed = item.log.status === 'missed'

    return (
      <View style={[
        styles.medCard,
        { padding: s(16), borderRadius: s(14) },
        isDone && styles.medCardDone,
        isMissed && styles.medCardMissed,
      ]}>
        {item.medication.photo_url ? (
          <Image
            source={{ uri: item.medication.photo_url }}
            style={{ width: s(44), height: s(44), borderRadius: s(8), marginRight: s(12) }}
          />
        ) : (
          <View style={[styles.colorDot, { backgroundColor: item.medication.color }]} />
        )}
        <View style={styles.medInfo}>
          <TouchableOpacity onPress={() => router.push(`/medication/${item.medication.id}`)} activeOpacity={0.7}>
            <Text style={[styles.medName, { fontSize: s(16) }, isDone && styles.medNameDone]}>
              {item.medication.name}
            </Text>
          </TouchableOpacity>
          {item.medication.illness && (
            <View style={styles.illnessBadge}>
              <MaterialIcons name="medical-services" size={si(10)} color={Colors.primary} />
              <Text style={[styles.illnessText, { fontSize: s(10) }]}>{item.medication.illness}</Text>
            </View>
          )}
          <View style={styles.medDosageRow}>
            <Text style={[styles.medDosage, { fontSize: s(13) }]}>
              {item.medication.dosage || ''} {item.medication.unit}
              {'  '}
              {item.log.scheduled_time.slice(0, 5)}
              {item.medication.usage_note ? `  ·  ${item.medication.usage_note}` : ''}
            </Text>
            {isMissed && (
              <View style={styles.missedBadge}>
                <MaterialIcons name="warning" size={si(12)} color={Colors.danger} />
                <Text style={[styles.missedBadgeText, { fontSize: s(11) }]}>漏服</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.actions}>
          {isDone ? (
            <TouchableOpacity onPress={() => handleUndo(item)} style={[styles.doneButton, { width: s(36), height: s(36), borderRadius: s(18) }]}>
              <MaterialIcons name="check-circle" size={si(20)} color="#fff" />
            </TouchableOpacity>
          ) : isSkipped ? (
            <TouchableOpacity onPress={() => handleUndo(item)} style={[styles.skippedButton, { paddingHorizontal: s(12), paddingVertical: s(8), borderRadius: s(20) }]}>
              <Text style={[styles.skippedText, { fontSize: s(13) }]}>已跳过</Text>
            </TouchableOpacity>
          ) : isMissed ? (
            <TouchableOpacity onPress={() => handleTake(item)} style={[styles.missedTakeButton, { paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: s(20) }]}>
              <Text style={[styles.missedTakeText, { fontSize: s(14) }]}>补吃了</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => handleSkip(item)}
                style={[styles.skipButton, { paddingHorizontal: s(12), paddingVertical: s(8), borderRadius: s(20) }]}
              >
                <Text style={[styles.skipText, { fontSize: s(14) }]}>跳过</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleTake(item)}
                style={[styles.takeButton, { paddingHorizontal: s(16), paddingVertical: s(8), borderRadius: s(20) }]}
              >
                <Text style={[styles.takeText, { fontSize: s(14) }]}>吃了</Text>
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
      {/* ===== Family Member Bar ===== */}
      {familyMembers.length > 0 && (
        <View style={[styles.familyBar, { paddingVertical: s(10), paddingHorizontal: s(16) }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s(12), alignItems: 'center' }}>
            <View style={[styles.familyBarSelf, { width: s(40), height: s(40), borderRadius: s(20) }]}>
              <MaterialIcons name="person" size={si(20)} color="#fff" />
            </View>
            {familyMembers.map(member => (
              <TouchableOpacity
                key={member.id}
                style={[styles.familyBarMember, { alignItems: 'center', width: s(56) }]}
                onPress={() => router.push(`/family/member/${member.user_id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.familyBarAvatar, { width: s(40), height: s(40), borderRadius: s(20) }]}>
                  <MaterialIcons name="person-outline" size={si(20)} color={Colors.primary} />
                </View>
                <Text style={[styles.familyBarName, { fontSize: s(10) }]} numberOfLines={1}>
                  {memberNicknames[member.user_id] || member.nickname || '家人'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ===== Hero Section ===== */}
      <View style={[styles.heroSection, { paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(16) }]}>
        {/* Top row: date + calendar badge */}
        <View style={styles.heroTopRow}>
          <Text style={[styles.dateText, { fontSize: s(22) }]}>{dateStr}</Text>
          <TouchableOpacity
            style={[styles.calendarBadge, { borderRadius: s(12), paddingHorizontal: s(10), paddingVertical: s(6) }]}
            onPress={() => router.push('/(tabs)/history')}
          >
            <MaterialIcons name="calendar-month" size={si(16)} color={Colors.primary} />
            <Text style={[styles.calendarBadgeText, { fontSize: s(12) }]}>
              {format(today, 'M/d')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Cat mascot + status area */}
        <View style={styles.heroCenterRow}>
          {/* Cat animation video — tap to switch */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (worried) return // Don't switch when worried
              // Pick a different random video
              let next = catVideoSource
              while (next === catVideoSource && CAT_VIDEOS_NORMAL.length > 1) {
                next = CAT_VIDEOS_NORMAL[Math.floor(Math.random() * CAT_VIDEOS_NORMAL.length)]
              }
              setCatVideoSource(next)
              setVideoKey(k => k + 1) // Force Video component remount
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
            style={{
              width: s(120),
              height: s(120),
              borderRadius: s(16),
              overflow: 'hidden',
              backgroundColor: Colors.bgPrimary,
            }}
          >
            <Video
              key={`cat-video-${videoKey}`}
              ref={videoRef}
              source={catVideo}
              style={{ width: s(120), height: s(120) }}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping={false}
              isMuted={false}
            />
          </TouchableOpacity>

          {/* Right side: status info */}
          <View style={styles.heroStatusArea}>
            {/* Streak badge */}
            {streak > 0 && (
              <View style={[styles.streakBadge, { borderRadius: s(16), paddingHorizontal: s(10), paddingVertical: s(5) }]}>
                <MaterialIcons name="local-fire-department" size={si(14)} color="#FF6B35" />
                <Text style={[styles.streakText, { fontSize: s(12) }]}>
                  连续 {streak} 天
                </Text>
              </View>
            )}

            {/* Progress ring area */}
            {totalCount > 0 && (
              <View style={[styles.progressCard, { borderRadius: s(14), padding: s(12) }]}>
                <Text style={[styles.progressLabel, { fontSize: s(11) }]}>今日进度</Text>
                <Text style={[styles.progressNum, { fontSize: s(24) }]}>
                  {takenCount}<Text style={[styles.progressDenom, { fontSize: s(14) }]}>/{totalCount}</Text>
                </Text>
                <View style={[styles.progressBar, { width: s(80), height: s(6), borderRadius: s(3) }]}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%`, height: s(6), borderRadius: s(3) }]} />
                </View>
              </View>
            )}

            {/* Voice button — inline */}
            <TouchableOpacity
              style={[styles.voiceBtn, { borderRadius: s(20), paddingHorizontal: s(14), paddingVertical: s(10) }]}
              onPress={() => setVoiceVisible(true)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="mic" size={si(18)} color="#fff" />
              <Text style={[styles.voiceBtnText, { fontSize: s(13) }]}>语音输入</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cat speech bubble */}
        <View style={[styles.speechBubble, { borderRadius: s(14), padding: s(10), marginTop: s(4) }]}>
          <Text style={[styles.speechText, { fontSize: s(13) }]}>
            {takenCount === totalCount && totalCount > 0
              ? '太棒了！今天的药都吃完啦 🎉'
              : totalCount === 0
              ? '记得准时吃药，身体棒棒哒！'
              : `还有 ${totalCount - takenCount} 种药没吃哦～`}
          </Text>
        </View>
      </View>

      {/* ===== Content ===== */}
      {totalCount === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { width: s(88), height: s(88), borderRadius: s(44) }]}>
            <MaterialIcons name="pets" size={si(40)} color={Colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { fontSize: s(20) }]}>今天没有需要吃的药</Text>
          <Text style={[styles.emptySubtitle, { fontSize: s(14) }]}>去药盒添加药品和提醒时间吧</Text>
          <TouchableOpacity
            style={[styles.addButton, { paddingHorizontal: s(24), paddingVertical: s(12), borderRadius: s(24) }]}
            onPress={() => router.push('/medication/add')}
          >
            <Text style={[styles.addButtonText, { fontSize: s(16) }]}>+ 添加药品</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groupedSections}
          keyExtractor={(item) => item.label}
          renderItem={({ item: group }) => (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { fontSize: s(12) }]}>{group.label}</Text>
              {group.data.map(item => (
                <View key={item.log.id}>
                  {renderItem({ item })}
                </View>
              ))}
            </View>
          )}
          contentContainerStyle={[styles.list, { paddingHorizontal: s(20) }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListFooterComponent={
            takenCount === totalCount && totalCount > 0 ? (
              <View style={styles.allDone}>
                <View style={[styles.allDoneIconCircle, { width: s(56), height: s(56), borderRadius: s(28) }]}>
                  <MaterialIcons name="celebration" size={si(28)} color={Colors.success} />
                </View>
                <Text style={[styles.allDoneText, { fontSize: s(16) }]}>今天的药都吃完啦！</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Voice Modal */}
      <VoiceModal
        visible={voiceVisible}
        onClose={() => setVoiceVisible(false)}
        onConfirm={handleVoiceConfirm}
        medications={allMedications}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  // ===== Hero Section =====
  heroSection: {
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateText: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  calendarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  calendarBadgeText: {
    color: Colors.primary,
    fontWeight: '700',
  },

  heroCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatusArea: {
    flex: 1,
    marginLeft: 12,
    gap: 8,
  },

  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  streakText: {
    color: '#FF6B35',
    fontWeight: '700',
  },

  progressCard: {
    backgroundColor: Colors.primary + '08',
    borderWidth: 1,
    borderColor: Colors.primary + '15',
  },
  progressLabel: {
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 2,
  },
  progressNum: {
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  progressDenom: {
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  progressBar: {
    backgroundColor: Colors.borderLight,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: Colors.success,
  },

  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  voiceBtnText: {
    color: '#fff',
    fontWeight: '700',
  },

  speechBubble: {
    backgroundColor: Colors.primary + '0A',
    borderWidth: 1,
    borderColor: Colors.primary + '15',
    alignItems: 'center',
  },
  speechText: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // ===== Content =====
  list: {
    paddingBottom: 40,
    paddingTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  medCard: {
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  medNameDone: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  illnessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '10',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  illnessText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  medDosageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  medDosage: {
    color: Colors.textSecondary,
  },
  missedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: Colors.danger + '10',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  missedBadgeText: {
    color: Colors.danger,
    fontWeight: '600',
    marginLeft: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  takeButton: {
    backgroundColor: Colors.primary,
  },
  takeText: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  skipButton: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipText: {
    color: Colors.textMuted,
  },
  doneButton: {
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skippedButton: {
    backgroundColor: Colors.bgInput,
  },
  skippedText: {
    color: Colors.textMuted,
  },
  missedTakeButton: {
    backgroundColor: Colors.warning,
  },
  missedTakeText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: Colors.primary,
  },
  addButtonText: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  allDone: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  allDoneIconCircle: {
    backgroundColor: Colors.success + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  allDoneText: {
    color: Colors.success,
    fontWeight: '600',
  },

  // Family bar
  familyBar: {
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  familyBarSelf: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  familyBarMember: {},
  familyBarAvatar: {
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.borderLight,
  },
  familyBarName: {
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
})
