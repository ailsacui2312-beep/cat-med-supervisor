import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import {
  fetchMedications, archiveMedication, restoreMedication,
  fetchArchivedMedications, deleteMedicationPermanently, FREQUENCY_LABELS,
} from '../../lib/medications'
import { getCycleStatusText } from '../../lib/cycles'
import { fetchLatestAll, HEALTH_TYPE_INFO } from '../../lib/health'
import { useMode } from '../../contexts/ModeContext'
import type { MedicationWithSchedules, HealthType, HealthRecord } from '../../lib/types'
import { format, differenceInDays, parseISO } from 'date-fns'

const HEALTH_ICON_MAP: Record<HealthType, { name: keyof typeof MaterialIcons.glyphMap; bg: string; color: string }> = {
  blood_sugar: { name: 'colorize', bg: '#FFF7ED', color: '#F97316' },
  blood_pressure: { name: 'favorite', bg: '#FEF2F2', color: '#EF4444' },
  weight: { name: 'monitor-weight', bg: '#EFF6FF', color: '#3B82F6' },
}

export default function MedicationsScreen() {
  const { user } = useAuth()
  const { s, si } = useMode()
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
      .filter(sch => sch.enabled)
      .map(sch => sch.time_of_day.slice(0, 5))
      .join('、')

    return (
      <TouchableOpacity
        style={[styles.card, { borderRadius: s(14) }]}
        onPress={() => router.push(`/medication/${item.id}`)}
        onLongPress={() => handleArchive(item)}
      >
        <View style={[styles.colorBar, { backgroundColor: item.color }]} />
        {item.photo_url ? (
          <Image
            source={{ uri: item.photo_url }}
            style={[styles.medPhoto, { width: s(44), height: s(44), borderRadius: s(10), marginLeft: s(10) }]}
          />
        ) : null}
        <View style={[styles.cardContent, { padding: s(14) }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.medName, { fontSize: s(17) }]}>{item.name}</Text>
            {expiryInfo && (
              <View style={[styles.expiryBadge, { backgroundColor: expiryInfo.color + '15' }]}>
                <MaterialIcons name="warning" size={12} color={expiryInfo.color} style={{ marginRight: 3 }} />
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
            <View style={styles.scheduleRow}>
              <MaterialIcons name="sync" size={13} color={Colors.primary} />
              <Text style={[styles.scheduleText, { color: Colors.primary }]}>
                {cycleStatus}
              </Text>
            </View>
          )}
          {scheduleText ? (
            <View style={styles.scheduleRow}>
              <MaterialIcons name="schedule" size={13} color={Colors.textMuted} />
              <Text style={styles.scheduleText}>{scheduleText}</Text>
            </View>
          ) : (
            <View style={styles.scheduleRow}>
              <MaterialIcons name="schedule" size={13} color={Colors.warning} />
              <Text style={[styles.scheduleText, { color: Colors.warning }]}>
                未设置提醒时间
              </Text>
            </View>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} style={{ marginRight: 12 }} />
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: s(20) }]}>
        <Text style={[styles.title, { fontSize: s(24) }]}>药盒</Text>
        <TouchableOpacity
          style={[styles.addBtn, { paddingHorizontal: s(16), paddingVertical: s(8), borderRadius: s(20) }]}
          onPress={() => router.push('/medication/add')}
        >
          <MaterialIcons name="add" size={si(16)} color={Colors.textOnPrimary} />
          <Text style={[styles.addBtnText, { fontSize: s(14) }]}>添加</Text>
        </TouchableOpacity>
      </View>

      {medications.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="inventory-2" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>药盒是空的</Text>
          <Text style={styles.emptySubtitle}>添加你正在服用的药品吧</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/medication/add')}
          >
            <MaterialIcons name="add" size={18} color={Colors.textOnPrimary} />
            <Text style={styles.emptyBtnText}>添加第一种药</Text>
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
                <TouchableOpacity
                  style={styles.healthAddBtn}
                  onPress={() => router.push('/health/add')}
                >
                  <MaterialIcons name="edit-note" size={16} color={Colors.primary} />
                  <Text style={styles.healthAddText}>记录数据</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.healthCards}>
                {(['blood_sugar', 'blood_pressure', 'weight'] as HealthType[]).map(type => {
                  const info = HEALTH_TYPE_INFO[type]
                  const iconInfo = HEALTH_ICON_MAP[type]
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
                      <View style={[styles.healthIconCircle, { backgroundColor: iconInfo.bg }]}>
                        <MaterialIcons name={iconInfo.name as any} size={20} color={iconInfo.color} />
                      </View>
                      <Text style={styles.healthLabel}>{info.label}</Text>
                      {record ? (
                        <>
                          <Text style={[styles.healthValue, { color: rangeColor }]}>
                            {info.format(record)}
                          </Text>
                          <Text style={styles.healthUnit}>{info.defaultUnit}</Text>
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
                <MaterialIcons name="photo-camera" size={16} color={Colors.primary} />
                <Text style={styles.screenshotBtnText}>截图识别血糖</Text>
              </TouchableOpacity>
            </View>

            {archivedMeds.length > 0 && (
            <View style={styles.archivedSection}>
              <TouchableOpacity
                style={styles.archivedToggle}
                onPress={() => setShowArchived(!showArchived)}
              >
                <Text style={styles.archivedToggleText}>
                  已停用 ({archivedMeds.length})
                </Text>
                <MaterialIcons
                  name={showArchived ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={20}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
              {showArchived && archivedMeds.map(med => (
                <View key={med.id} style={[styles.card, { opacity: 0.6 }]}>
                  <View style={[styles.colorBar, { backgroundColor: med.color }]} />
                  <View style={styles.cardContent}>
                    <Text style={styles.medName}>{med.name}</Text>
                    <Text style={styles.medDetail}>已停用</Text>
                  </View>
                  <View style={styles.archivedActions}>
                    <TouchableOpacity onPress={() => handleRestore(med)}>
                      <Text style={styles.restoreText}>恢复</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(med)}>
                      <Text style={styles.deleteText}>删除</Text>
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
    backgroundColor: Colors.bgPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    paddingTop: 8,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  colorBar: {
    width: 6,
    alignSelf: 'stretch',
  },
  medPhoto: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginLeft: 10,
    marginRight: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
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
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  scheduleText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
  healthAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  healthAddText: {
    fontSize: 13,
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
  healthIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
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
  healthUnit: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    paddingVertical: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  archivedToggleText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  archivedActions: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  restoreText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  deleteText: {
    color: Colors.danger,
    fontSize: 13,
  },
})
