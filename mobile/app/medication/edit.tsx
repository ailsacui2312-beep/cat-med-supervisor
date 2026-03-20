import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Image, Platform, KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { format } from 'date-fns'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import {
  fetchMedication, updateMedication, pickImage, takePhoto,
  FREQUENCY_LABELS, UNIT_OPTIONS,
} from '../../lib/medications'
import { fetchSchedulesForMedication } from '../../lib/schedules'
import { replaceSchedules } from '../../lib/reminderService'
import type { Frequency, Schedule } from '../../lib/types'

const FREQUENCIES: Frequency[] = ['daily', 'twice_daily', 'three_daily', 'weekly', 'as_needed']
const DEFAULT_TIMES: Record<Frequency, string[]> = {
  daily: ['08:00'],
  twice_daily: ['08:00', '20:00'],
  three_daily: ['08:00', '13:00', '20:00'],
  weekly: ['08:00'],
  as_needed: [],
  cycle: ['08:00'],
}

export default function EditMedicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()

  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [unit, setUnit] = useState('粒')
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [notes, setNotes] = useState('')
  const [color, setColor] = useState(Colors.pillColors[0])
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [expiryDate, setExpiryDate] = useState<string | null>(null)
  const [times, setTimes] = useState<string[]>(['08:00'])
  const [existingSchedules, setExistingSchedules] = useState<Schedule[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    loadMedication()
  }, [id])

  const loadMedication = async () => {
    try {
      const med = await fetchMedication(id!)
      if (!med) {
        Alert.alert('错误', '药品不存在')
        router.back()
        return
      }
      setName(med.name)
      setDosage(med.dosage || '')
      setUnit(med.unit)
      setFrequency(med.frequency)
      setNotes(med.notes || '')
      setColor(med.color)
      setPhotoUri(med.photo_url)
      setExpiryDate(med.expiry_date)

      const schedules = await fetchSchedulesForMedication(med.id)
      setExistingSchedules(schedules)
      if (schedules.length > 0) {
        setTimes(schedules.map(s => s.time_of_day.slice(0, 5)))
      }
    } catch (e: any) {
      Alert.alert('错误', e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFrequencyChange = (freq: Frequency) => {
    setFrequency(freq)
    setTimes(DEFAULT_TIMES[freq])
  }

  const handlePhoto = () => {
    Alert.alert('修改药品照片', '', [
      { text: '拍照', onPress: async () => {
        const uri = await takePhoto()
        if (uri) setPhotoUri(uri)
      }},
      { text: '从相册选择', onPress: async () => {
        const uri = await pickImage()
        if (uri) setPhotoUri(uri)
      }},
      { text: '取消', style: 'cancel' },
    ])
  }

  const handleAddTime = () => {
    setTimes([...times, '12:00'])
  }

  const handleRemoveTime = (index: number) => {
    if (times.length <= 1) {
      Alert.alert('提示', '至少保留一个提醒时间')
      return
    }
    setTimes(times.filter((_, i) => i !== index))
  }

  const handleTimeChange = (index: number, timeStr: string) => {
    const newTimes = [...times]
    newTimes[index] = timeStr
    setTimes(newTimes)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('提示', '请输入药品名称')
      return
    }
    if (!user || !id) return

    setSaving(true)
    try {
      await updateMedication(id, {
        name: name.trim(),
        dosage: dosage.trim() || undefined,
        unit,
        frequency,
        expiry_date: expiryDate || undefined,
        notes: notes.trim() || undefined,
        color,
      })

      // Sync schedules: cancel old notifications, delete old, create new
      const updatedMed = await fetchMedication(id)
      if (updatedMed) {
        await replaceSchedules(id, user.id, existingSchedules, times, updatedMed)
      }

      Alert.alert('保存成功', `${name} 已更新`, [
        { text: '好的', onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert('错误', e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>加载中...</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>编辑药品</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>
              {saving ? '保存中...' : '保存'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.form}
          showsVerticalScrollIndicator={false}
        >
          {/* Photo */}
          <TouchableOpacity style={styles.photoArea} onPress={handlePhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoImage} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoIcon}>📸</Text>
                <Text style={styles.photoText}>拍照记录药品</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>药品名称 *</Text>
            <TextInput
              style={styles.input}
              placeholder="如：布洛芬、阿莫西林"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Dosage + Unit */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>剂量</Text>
              <TextInput
                style={styles.input}
                placeholder="如：200mg"
                placeholderTextColor={Colors.textMuted}
                value={dosage}
                onChangeText={setDosage}
              />
            </View>
            <View style={[styles.field, { width: 120 }]}>
              <Text style={styles.label}>单位</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {UNIT_OPTIONS.map(u => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.chip, unit === u && styles.chipSelected]}
                      onPress={() => setUnit(u)}
                    >
                      <Text style={[styles.chipText, unit === u && styles.chipTextSelected]}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Frequency */}
          <View style={styles.field}>
            <Text style={styles.label}>频率</Text>
            <View style={styles.chipRow}>
              {FREQUENCIES.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, frequency === f && styles.chipSelected]}
                  onPress={() => handleFrequencyChange(f)}
                >
                  <Text style={[styles.chipText, frequency === f && styles.chipTextSelected]}>
                    {FREQUENCY_LABELS[f]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Times */}
          {frequency !== 'as_needed' && (
            <View style={styles.field}>
              <View style={styles.timesHeader}>
                <Text style={styles.label}>提醒时间</Text>
                <TouchableOpacity onPress={handleAddTime}>
                  <Text style={styles.addTimeText}>+ 添加时间</Text>
                </TouchableOpacity>
              </View>
              {times.map((time, index) => (
                <View key={index} style={styles.timeRow}>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => {
                      // Simple time input via prompt for cross-platform compatibility
                      Alert.prompt(
                        '设置时间',
                        '输入时间（格式 HH:MM，如 08:30）',
                        (text) => {
                          if (text && /^\d{2}:\d{2}$/.test(text)) {
                            handleTimeChange(index, text)
                          }
                        },
                        'plain-text',
                        time,
                      )
                    }}
                  >
                    <Text style={styles.timeText}>{time}</Text>
                  </TouchableOpacity>
                  {times.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveTime(index)}
                      style={styles.removeTimeBtn}
                    >
                      <Text style={styles.removeTimeText}>删除</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Color */}
          <View style={styles.field}>
            <Text style={styles.label}>标签颜色</Text>
            <View style={styles.colorRow}>
              {Colors.pillColors.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    color === c && styles.colorDotSelected,
                  ]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.label}>备注</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="如：饭后服用、需要空腹"
              placeholderTextColor={Colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  loadingText: {
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  saveText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  form: {
    padding: 20,
  },
  photoArea: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: Colors.bgInput,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  photoText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  photoImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  timesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addTimeText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  timeButton: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timeText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  removeTimeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  removeTimeText: {
    fontSize: 14,
    color: Colors.danger,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: Colors.textPrimary,
  },
})
