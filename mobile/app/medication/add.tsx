import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Image, Platform, KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format } from 'date-fns'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import {
  createMedication, pickImage, takePhoto,
  FREQUENCY_LABELS, UNIT_OPTIONS,
} from '../../lib/medications'
import { createSchedule } from '../../lib/schedules'
import { setupNotifications, scheduleMedicationReminder } from '../../lib/notifications'
import type { Frequency, CycleType } from '../../lib/types'

const FREQUENCIES: Frequency[] = ['daily', 'twice_daily', 'three_daily', 'weekly', 'as_needed', 'cycle']
const DEFAULT_TIMES: Record<Frequency, string[]> = {
  daily: ['08:00'],
  twice_daily: ['08:00', '20:00'],
  three_daily: ['08:00', '13:00', '20:00'],
  weekly: ['08:00'],
  as_needed: [],
  cycle: ['08:00'],
}

const CYCLE_TYPE_LABELS: Record<CycleType, string> = {
  none: '无',
  once: '单次疗程',
  monthly: '每月重复',
  custom: '自定义循环',
}
const CYCLE_TYPES: CycleType[] = ['once', 'monthly', 'custom']

export default function AddMedicationScreen() {
  const { user } = useAuth()
  const router = useRouter()

  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [unit, setUnit] = useState('粒')
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [notes, setNotes] = useState('')
  const [color, setColor] = useState(Colors.pillColors[0])
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [expiryDate, setExpiryDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [times, setTimes] = useState<string[]>(['08:00'])
  const [showTimePicker, setShowTimePicker] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  // Cycle fields
  const [cycleType, setCycleType] = useState<CycleType>('monthly')
  const [cycleStartDay, setCycleStartDay] = useState('1')
  const [cycleEndDay, setCycleEndDay] = useState('21')
  const [cycleActiveDays, setCycleActiveDays] = useState('14')
  const [cycleRestDays, setCycleRestDays] = useState('7')

  const handleFrequencyChange = (freq: Frequency) => {
    setFrequency(freq)
    setTimes(DEFAULT_TIMES[freq])
  }

  const handleTimeChange = (index: number, date: Date) => {
    const timeStr = format(date, 'HH:mm')
    const newTimes = [...times]
    newTimes[index] = timeStr
    setTimes(newTimes)
    setShowTimePicker(null)
  }

  const handlePhoto = () => {
    Alert.alert('添加药品照片', '', [
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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('提示', '请输入药品名称')
      return
    }
    if (!user) return

    setSaving(true)
    try {
      const cycleFields = frequency === 'cycle' ? {
        cycle_type: cycleType,
        cycle_start_day: cycleType === 'monthly' ? parseInt(cycleStartDay) || 1 : undefined,
        cycle_end_day: cycleType === 'monthly' ? parseInt(cycleEndDay) || 21 : undefined,
        cycle_active_days: cycleType === 'custom' ? parseInt(cycleActiveDays) || 14 : undefined,
        cycle_rest_days: cycleType === 'custom' ? parseInt(cycleRestDays) || 7 : undefined,
        cycle_start_date: format(new Date(), 'yyyy-MM-dd'),
        cycle_end_date: cycleType === 'once' && expiryDate ? format(expiryDate, 'yyyy-MM-dd') : undefined,
      } : {}

      const med = await createMedication(user.id, {
        name: name.trim(),
        dosage: dosage.trim() || undefined,
        unit,
        frequency,
        expiry_date: expiryDate ? format(expiryDate, 'yyyy-MM-dd') : undefined,
        notes: notes.trim() || undefined,
        color,
        ...cycleFields,
      })

      // Create schedules and register notifications
      await setupNotifications()
      for (const time of times) {
        const schedule = await createSchedule(med.id, user.id, time)
        await scheduleMedicationReminder(schedule, med)
      }

      Alert.alert('添加成功', `${name} 已添加到药柜`, [
        { text: '好的', onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert('错误', e.message)
    } finally {
      setSaving(false)
    }
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
          <Text style={styles.headerTitle}>添加药品</Text>
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

          {/* Cycle Settings */}
          {frequency === 'cycle' && (
            <View style={styles.field}>
              <Text style={styles.label}>周期类型</Text>
              <View style={styles.chipRow}>
                {CYCLE_TYPES.map(ct => (
                  <TouchableOpacity
                    key={ct}
                    style={[styles.chip, cycleType === ct && styles.chipSelected]}
                    onPress={() => setCycleType(ct)}
                  >
                    <Text style={[styles.chipText, cycleType === ct && styles.chipTextSelected]}>
                      {CYCLE_TYPE_LABELS[ct]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {cycleType === 'monthly' && (
                <View style={[styles.row, { marginTop: 12 }]}>
                  <View style={[styles.field, { flex: 1, marginBottom: 0 }]}>
                    <Text style={styles.sublabel}>每月第</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      value={cycleStartDay}
                      onChangeText={setCycleStartDay}
                      placeholder="1"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <Text style={styles.rangeSeparator}>到</Text>
                  <View style={[styles.field, { flex: 1, marginBottom: 0 }]}>
                    <Text style={styles.sublabel}>第</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      value={cycleEndDay}
                      onChangeText={setCycleEndDay}
                      placeholder="21"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <Text style={styles.rangeSuffix}>天</Text>
                </View>
              )}

              {cycleType === 'custom' && (
                <View style={[styles.row, { marginTop: 12 }]}>
                  <View style={[styles.field, { flex: 1, marginBottom: 0 }]}>
                    <Text style={styles.sublabel}>吃药</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      value={cycleActiveDays}
                      onChangeText={setCycleActiveDays}
                      placeholder="14"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <Text style={styles.rangeSeparator}>天，停</Text>
                  <View style={[styles.field, { flex: 1, marginBottom: 0 }]}>
                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      value={cycleRestDays}
                      onChangeText={setCycleRestDays}
                      placeholder="7"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <Text style={styles.rangeSuffix}>天</Text>
                </View>
              )}

              {cycleType === 'once' && (
                <Text style={[styles.sublabel, { marginTop: 8 }]}>
                  单次疗程从今天开始，有效期即为结束日期
                </Text>
              )}
            </View>
          )}

          {/* Times */}
          {times.length > 0 && frequency !== 'as_needed' && (
            <View style={styles.field}>
              <Text style={styles.label}>提醒时间</Text>
              {times.map((time, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.timeButton}
                  onPress={() => setShowTimePicker(index)}
                >
                  <Text style={styles.timeText}>{time}</Text>
                  <Text style={styles.timeEdit}>修改</Text>
                </TouchableOpacity>
              ))}
              {showTimePicker !== null && (
                <DateTimePicker
                  value={(() => {
                    const [h, m] = times[showTimePicker].split(':').map(Number)
                    const d = new Date()
                    d.setHours(h, m, 0, 0)
                    return d
                  })()}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  onChange={(_, date) => {
                    if (date) handleTimeChange(showTimePicker, date)
                    else setShowTimePicker(null)
                  }}
                />
              )}
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

          {/* Expiry Date */}
          <View style={styles.field}>
            <Text style={styles.label}>有效期</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={expiryDate ? styles.inputText : styles.inputPlaceholder}>
                {expiryDate ? format(expiryDate, 'yyyy-MM-dd') : '选填'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={expiryDate || new Date()}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={(_, date) => {
                  setShowDatePicker(false)
                  if (date) setExpiryDate(date)
                }}
              />
            )}
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
  inputText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  inputPlaceholder: {
    fontSize: 16,
    color: Colors.textMuted,
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
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  timeText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  timeEdit: {
    fontSize: 14,
    color: Colors.primary,
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
  sublabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  rangeSeparator: {
    fontSize: 16,
    color: Colors.textSecondary,
    alignSelf: 'flex-end',
    paddingBottom: 14,
  },
  rangeSuffix: {
    fontSize: 16,
    color: Colors.textSecondary,
    alignSelf: 'flex-end',
    paddingBottom: 14,
  },
})
