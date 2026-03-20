import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Image, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { format, differenceInDays, parseISO } from 'date-fns'
import { Colors } from '../../constants/colors'
import {
  fetchMedication, FREQUENCY_LABELS,
} from '../../lib/medications'
import { enableSchedule, disableSchedule, archiveWithCleanup } from '../../lib/reminderService'
import { useMode } from '../../contexts/ModeContext'
import type { MedicationWithSchedules } from '../../lib/types'

export default function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { s, si } = useMode()
  const [med, setMed] = useState<MedicationWithSchedules | null>(null)

  const loadData = useCallback(() => {
    if (id) {
      fetchMedication(id).then(setMed).catch(console.error)
    }
  }, [id])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const handleToggleSchedule = async (scheduleId: string, enabled: boolean) => {
    if (!med) return
    try {
      const schedule = med.schedules.find(item => item.id === scheduleId)
      if (!schedule) return
      if (enabled) {
        await enableSchedule(schedule, med)
      } else {
        await disableSchedule(schedule)
      }
      loadData()
    } catch (e: any) {
      Alert.alert('错误', e.message)
    }
  }

  const handleArchive = () => {
    if (!med) return
    Alert.alert(
      '停用药品',
      `确定要停用「${med.name}」吗？停用后将不再提醒。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '停用',
          style: 'destructive',
          onPress: async () => {
            await archiveWithCleanup(med)
            router.back()
          },
        },
      ]
    )
  }

  if (!med) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>加载中...</Text>
      </SafeAreaView>
    )
  }

  const expiryDays = med.expiry_date
    ? differenceInDays(parseISO(med.expiry_date), new Date())
    : null

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: s(20) }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { fontSize: s(16) }]}>← 返回</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push(`/medication/edit?id=${med.id}`)}>
          <Text style={[styles.editText, { fontSize: s(16) }]}>编辑</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { padding: s(20) }]}>
        {/* Main info */}
        <View style={[styles.mainCard, { borderRadius: s(16) }]}>
          <View style={[styles.colorBand, { backgroundColor: med.color }]} />
          <View style={[styles.mainInfo, { padding: s(20) }]}>
            {med.photo_url && (
              <Image source={{ uri: med.photo_url }} style={[styles.photo, { width: s(80), height: s(80), borderRadius: s(12) }]} />
            )}
            <Text style={[styles.medName, { fontSize: s(24) }]}>{med.name}</Text>
            {med.illness && (
              <Text style={{ fontSize: s(14), color: Colors.primary, fontWeight: '600', marginBottom: 4 }}>
                {med.illness}
              </Text>
            )}
            {med.dosage && (
              <Text style={[styles.medDosage, { fontSize: s(16) }]}>
                {med.dosage} {med.unit}
              </Text>
            )}
            <Text style={[styles.medFreq, { fontSize: s(14) }]}>
              {FREQUENCY_LABELS[med.frequency]}
              {med.usage_note ? `  ·  ${med.usage_note}` : ''}
            </Text>
          </View>
        </View>

        {/* Schedule */}
        <View style={[styles.section, { borderRadius: s(14), padding: s(16) }]}>
          <Text style={[styles.sectionTitle, { fontSize: s(13) }]}>提醒时间</Text>
          {med.schedules.length > 0 ? (
            med.schedules.map(sch => (
              <View key={sch.id} style={styles.scheduleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.scheduleTime, { fontSize: s(18) }, !sch.enabled && { color: Colors.textMuted }]}>
                    ⏰ {sch.time_of_day.slice(0, 5)}
                  </Text>
                  <Text style={[styles.scheduleDays, { fontSize: s(13) }]}>
                    {sch.days_of_week.length === 7 ? '每天' :
                      sch.days_of_week.map(d => '日一二三四五六'[d]).join(' ')}
                  </Text>
                </View>
                <Switch
                  value={sch.enabled}
                  onValueChange={(val) => handleToggleSchedule(sch.id, val)}
                  trackColor={{ true: Colors.primary }}
                />
              </View>
            ))
          ) : (
            <Text style={[styles.noSchedule, { fontSize: s(14) }]}>未设置提醒</Text>
          )}
        </View>

        {/* Expiry */}
        {med.expiry_date && (
          <View style={[styles.section, { borderRadius: s(14), padding: s(16) }]}>
            <Text style={[styles.sectionTitle, { fontSize: s(13) }]}>有效期</Text>
            <View style={styles.expiryRow}>
              <Text style={[styles.expiryDate, { fontSize: s(16) }]}>
                {format(parseISO(med.expiry_date), 'yyyy年M月d日')}
              </Text>
              {expiryDays !== null && (
                <Text style={[
                  styles.expiryDays,
                  { fontSize: s(14), color: expiryDays < 0 ? Colors.danger : expiryDays < 30 ? Colors.warning : Colors.success },
                ]}>
                  {expiryDays < 0 ? '已过期' : `还有 ${expiryDays} 天`}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Notes */}
        {med.notes && (
          <View style={[styles.section, { borderRadius: s(14), padding: s(16) }]}>
            <Text style={[styles.sectionTitle, { fontSize: s(13) }]}>备注</Text>
            <Text style={[styles.notesText, { fontSize: s(15) }]}>{med.notes}</Text>
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity style={[styles.archiveBtn, { paddingVertical: s(14), borderRadius: s(12) }]} onPress={handleArchive}>
          <Text style={[styles.archiveBtnText, { fontSize: s(16) }]}>停用此药品</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  loading: {
    textAlign: 'center',
    marginTop: 100,
    color: Colors.textMuted,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backText: {
    fontSize: 16,
    color: Colors.primary,
  },
  editText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  mainCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  colorBand: {
    height: 6,
  },
  mainInfo: {
    padding: 20,
    alignItems: 'center',
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginBottom: 12,
  },
  medName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  medDosage: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  medFreq: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  section: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  scheduleTime: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  scheduleDays: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  noSchedule: {
    fontSize: 14,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expiryDate: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  expiryDays: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  archiveBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: 'center',
  },
  archiveBtnText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '500',
  },
})
