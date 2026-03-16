import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import {
  fetchMedications, archiveMedication, restoreMedication,
  fetchArchivedMedications, deleteMedicationPermanently, FREQUENCY_LABELS,
} from '../../lib/medications'
import { getCycleStatusText } from '../../lib/cycles'
import { fetchLatestAll, HEALTH_TYPE_INFO } from '../../lib/health'
import type { MedicationWithSchedules, HealthType, HealthRecord } from '../../lib/types'
import { format, differenceInDays, parseISO } from 'date-fns'

export default function MedicationsScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [medications, setMedications] = useState<MedicationWithSchedules[]>([])
  const [archivedMeds, setArchivedMeds] = useState<MedicationWithSchedules[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [healthData, setHealthData] = useState<Record<HealthType, HealthRecord | null>>({
    blood_sugar: null, blood_pressure: null, weight: null,
  })

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const [data, archived, health] = await Promise.all([
        fetchMedications(user.id),
        fetchArchivedMedications(user.id),
        fetchLatestAll(user.id),
      ])
      setMedications(data)
      setArchivedMeds(archived)
      setHealthData(health)
    } catch (e: any) {
      console.error('Failed to load medications:', e)
    }
  }, [user])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleArchive = (med: MedicationWithSchedules) => {
    Alert.alert(
      '停用药品',
      `确定要停用「${med.name}」吗？停用后将不再提醒。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '停用',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveMedication(med.id)
              await loadData()
            } catch (e: any) {
              Alert.alert('错误', e.message)
            }
          },
        },
      ]
    )
  }

  const handleRestore = (med: MedicationWithSchedules) => {
    Alert.alert('恢复药品', `确定要重新启用「${med.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '恢复',
        onPress: async () => {
          try {
            await restoreMedication(med.id)
            await loadData()
          } catch (e: any) {
            Alert.alert('错误', e.message)
          }
        },
      },
    ])
  }

  const handleDelete = (med: MedicationWithSchedules) => {
    Alert.alert(
      '永久删除',
      `确定要永久删除「${med.name}」吗？\n删除后不可恢复，包括所有历史记录。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '永久删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMedicationPermanently(med.id)
              await loadData()
            } catch (e: any) {
              Alert.alert('错误', e.message)
            }
          },
        },
      ]
    )
  }

  const getExpiryInfo = (expiryDate: string | null) => {
    if (!expiryDate) return null
    const days = differenceInDays(parseISO(expiryDate), new Date())
    if (days < 0) return { text: '已过期', color: Colors.danger }
    if (days < 30) return { text: `${days}天后过期`, color: Colors.warning }
    return null
  }

  const renderItem = ({ item }: { item: MedicationWithSchedules }) => {
    const expiryInfo = getExpiryInfo(item.expiry_date)
    const cycleStatus = getCycleStatusText(item, new Date())
    const scheduleText = item.schedules
      .filter(s => s.enabled)
      .map(s => s.time_of_day.slice(0, 5))
      .join('、')

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/medication/${item.id}`)}
        onLongPress={() => handleArchive(item)}
      >
        <View style={[styles.colorBar, { backgroundColor: item.color }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.medName}>{item.name}</Text>
            {expiryInfo && (
              <View style={[styles.expiryBadge, { backgroundColor: expiryInfo.color + '20' }]}>
                <Text style={[styles.expiryText, { color: expiryInfo.color }]}>
                  {expiryInfo.text}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.medDetail}>
            {item.dosage ? `${item.dosage} ${item.unit}` : item.unit}
            {'  ·  '}
            {FREQUENCY_LABELS[item.frequency]}
          </Text>
          {cycleStatus && (
            <Text style={[styles.scheduleText, { color: Colors.primary }]}>
              🔄 {cycleStatus}
            </Text>
          )}
          {scheduleText ? (
            <Text style={styles.scheduleText}>⏰ {scheduleText}</Text>
          ) : (
            <Text style={[styles.scheduleText, { color: Colors.warning }]}>
              未设置提醒时间
            </Text>
          )}
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>药柜</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/medication/add')}
        >
          <Text style={styles.addBtnText}>+ 添加</Text>
        </TouchableOpacity>
      </View>

      {medications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🗄️</Text>
          <Text style={styles.emptyTitle}>药柜是空的</Text>
          <Text style={styles.emptySubtitle}>添加你正在服用的药品吧</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/medication/add')}
          >
            <Text style={styles.emptyBtnText}>+ 添加第一种药</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={medications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListFooterComponent={<>
            {/* Health Data Summary */}
            <View style={styles.healthSection}>
              <View style={styles.healthHeader}>
                <Text style={styles.healthTitle}>身体数据</Text>
                <TouchableOpacity onPress={() => router.push('/health/add')}>
                  <Text style={styles.healthAddText}>+ 记录</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.healthCards}>
                {(['blood_sugar', 'blood_pressure', 'weight'] as HealthType[]).map(type => {
                  const info = HEALTH_TYPE_INFO[type]
                  const record = healthData[type]
                  const rangeStatus = record
                    ? info.normalRange(record.value1, record.value2)
                    : null
                  const rangeColor = rangeStatus === 'high' ? Colors.danger
                    : rangeStatus === 'low' ? Colors.warning
                    : Colors.success
                  return (
                    <TouchableOpacity
                      key={type}
                      style={styles.healthCard}
                      onPress={() => router.push(`/health/${type}`)}
                    >
                      <Text style={styles.healthEmoji}>{info.emoji}</Text>
                      <Text style={styles.healthLabel}>{info.label}</Text>
                      {record ? (
                        <>
                          <Text style={[styles.healthValue, { color: rangeColor }]}>
                            {info.format(record)}
                          </Text>
                          <Text style={styles.healthTime}>
                            {format(parseISO(record.measured_at), 'MM/dd HH:mm')}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.healthEmpty}>暂无数据</Text>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
              <TouchableOpacity
                style={styles.screenshotBtn}
                onPress={() => router.push('/health/screenshot')}
              >
                <Text style={styles.screenshotBtnText}>📷 截图识别血糖</Text>
              </TouchableOpacity>
            </View>

            {archivedMeds.length > 0 && (
            <View style={styles.archivedSection}>
              <TouchableOpacity
                style={styles.archivedToggle}
                onPress={() => setShowArchived(!showArchived)}
              >
                <Text style={styles.archivedToggleText}>
                  已停用 ({archivedMeds.length}) {showArchived ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              {showArchived && archivedMeds.map(med => (
                <View key={med.id} style={[styles.card, { opacity: 0.6 }]}>
                  <View style={[styles.colorBar, { backgroundColor: med.color }]} />
                  <View style={styles.cardContent}>
                    <Text style={styles.medName}>{med.name}</Text>
                    <Text style={styles.medDetail}>已停用</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
                    <TouchableOpacity onPress={() => handleRestore(med)}>
                      <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '500' }}>恢复</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(med)}>
                      <Text style={{ color: Colors.danger, fontSize: 13 }}>删除</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
          </>}
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  colorBar: {
    width: 5,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  medName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  expiryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  expiryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  medDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  scheduleText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  chevron: {
    fontSize: 22,
    color: Colors.textMuted,
    paddingRight: 14,
  },
  empty: {
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
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyBtnText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  healthSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  healthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  healthAddText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  healthCards: {
    flexDirection: 'row',
    gap: 10,
  },
  healthCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  healthEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  healthLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  healthValue: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  healthTime: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  healthEmpty: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  screenshotBtn: {
    marginTop: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  screenshotBtnText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  archivedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  archivedToggle: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  archivedToggleText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
})
