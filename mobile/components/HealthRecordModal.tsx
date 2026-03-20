import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, Alert, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Colors } from '../constants/colors'
import { useAuth } from '../hooks/useAuth'
import { useMode } from '../contexts/ModeContext'
import { createHealthRecord, HEALTH_TYPE_INFO } from '../lib/health'
import type { HealthType } from '../lib/types'

const HEALTH_TYPES: HealthType[] = ['blood_sugar', 'blood_pressure', 'weight']

const TYPE_ICONS: Record<HealthType, keyof typeof MaterialIcons.glyphMap> = {
  blood_sugar: 'colorize',
  blood_pressure: 'monitor-heart',
  weight: 'monitor-weight',
}

interface HealthRecordModalProps {
  visible: boolean
  onClose: () => void
  onSaved?: () => void
  initialType?: HealthType
  initialValue?: string
}

export default function HealthRecordModal({
  visible,
  onClose,
  onSaved,
  initialType,
  initialValue,
}: HealthRecordModalProps) {
  const { user } = useAuth()
  const { s, si } = useMode()

  const [type, setType] = useState<HealthType>(initialType || 'blood_sugar')
  const [value1, setValue1] = useState(initialValue || '')
  const [value2, setValue2] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setType(initialType || 'blood_sugar')
      setValue1(initialValue || '')
      setValue2('')
    }
  }, [visible, initialType, initialValue])

  const info = HEALTH_TYPE_INFO[type]
  const now = new Date()

  const getRangeStatus = () => {
    const v1 = parseFloat(value1)
    if (isNaN(v1)) return null
    const v2val = value2 ? parseFloat(value2) : undefined
    const status = info.normalRange(v1, v2val)
    const text = status === 'low' ? '偏低' : status === 'high' ? '偏高' : '数值正常'
    const color = status === 'low' ? Colors.warning : status === 'high' ? Colors.danger : Colors.success
    return { text, color }
  }

  const handleSave = async () => {
    if (!user) return
    const v1 = parseFloat(value1)
    if (isNaN(v1)) {
      Alert.alert('提示', '请输入有效数值')
      return
    }
    if (type === 'blood_pressure') {
      const v2 = parseFloat(value2)
      if (isNaN(v2)) {
        Alert.alert('提示', '请输入舒张压')
        return
      }
    }

    setSaving(true)
    try {
      await createHealthRecord(user.id, {
        type,
        value1: v1,
        value2: type === 'blood_pressure' ? parseFloat(value2) : undefined,
        unit: info.defaultUnit,
        source: 'manual',
      })
      onSaved?.()
      onClose()
    } catch (e: any) {
      Alert.alert('错误', e.message)
    } finally {
      setSaving(false)
    }
  }

  const rangeStatus = getRangeStatus()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { borderTopLeftRadius: s(24), borderTopRightRadius: s(24), paddingHorizontal: s(20), paddingTop: s(20), paddingBottom: s(32) }]}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={[styles.header, { marginBottom: s(16) }]}>
            <View style={styles.headerLeft}>
              <MaterialIcons name="pets" size={si(22)} color={Colors.primary} />
              <Text style={[styles.headerTitle, { fontSize: s(18) }]}>记录身体数据</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={si(22)} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Type selector */}
          <View style={[styles.typeRow, { marginBottom: s(14) }]}>
            {HEALTH_TYPES.map(t => {
              const tInfo = HEALTH_TYPE_INFO[t]
              const selected = type === t
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeCard,
                    { borderRadius: s(14), paddingVertical: s(12) },
                    selected && {
                      borderColor: Colors.primary,
                      backgroundColor: Colors.primary + '12',
                    },
                  ]}
                  onPress={() => {
                    setType(t)
                    setValue1('')
                    setValue2('')
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={TYPE_ICONS[t]}
                    size={si(24)}
                    color={selected ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[
                    styles.typeLabel,
                    { fontSize: s(13) },
                    selected && { color: Colors.primary, fontWeight: '700' },
                  ]}>
                    {tInfo.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Time row */}
          <View style={[styles.timeRow, { borderRadius: s(12), paddingHorizontal: s(14), paddingVertical: s(12), marginBottom: s(14) }]}>
            <View style={styles.timeLeft}>
              <MaterialIcons name="schedule" size={si(18)} color={Colors.textMuted} />
              <Text style={[styles.timeLabel, { fontSize: s(14) }]}>记录时间</Text>
            </View>
            <Text style={[styles.timeValue, { fontSize: s(14) }]}>
              今天 {format(now, 'HH:mm')}
            </Text>
          </View>

          {/* Value input area */}
          <View style={[styles.valueArea, { borderRadius: s(16), padding: s(16), marginBottom: s(16) }]}>
            {type === 'blood_pressure' ? (
              <View style={styles.bpRow}>
                <View style={styles.bpInput}>
                  <TextInput
                    style={[styles.valueInput, { fontSize: s(32) }]}
                    placeholder="120"
                    placeholderTextColor={Colors.textMuted + '40'}
                    value={value1}
                    onChangeText={setValue1}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[styles.bpLabel, { fontSize: s(11) }]}>收缩压</Text>
                </View>
                <Text style={[styles.bpSeparator, { fontSize: s(24) }]}>/</Text>
                <View style={styles.bpInput}>
                  <TextInput
                    style={[styles.valueInput, { fontSize: s(32) }]}
                    placeholder="80"
                    placeholderTextColor={Colors.textMuted + '40'}
                    value={value2}
                    onChangeText={setValue2}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[styles.bpLabel, { fontSize: s(11) }]}>舒张压</Text>
                </View>
                <Text style={[styles.unitText, { fontSize: s(14) }]}>{info.defaultUnit}</Text>
              </View>
            ) : (
              <View style={styles.singleValueRow}>
                <TextInput
                  style={[styles.valueInput, { fontSize: s(36) }]}
                  placeholder="0.0"
                  placeholderTextColor={Colors.textMuted + '40'}
                  value={value1}
                  onChangeText={setValue1}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.unitText, { fontSize: s(16) }]}>{info.defaultUnit}</Text>
              </View>
            )}

            {/* Range indicator */}
            {rangeStatus && (
              <View style={[styles.rangeBadge, { backgroundColor: rangeStatus.color + '15', borderRadius: s(12), marginTop: s(8) }]}>
                <MaterialIcons name="fiber-manual-record" size={si(10)} color={rangeStatus.color} />
                <Text style={[styles.rangeText, { fontSize: s(13), color: rangeStatus.color }]}>
                  {rangeStatus.text}
                </Text>
              </View>
            )}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, { borderRadius: s(16), paddingVertical: s(16) }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <MaterialIcons name="save" size={si(20)} color="#fff" />
            <Text style={[styles.saveBtnText, { fontSize: s(17) }]}>
              {saving ? '保存中...' : '保存记录'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted + '30',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },

  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: Colors.borderLight,
    gap: 4,
  },
  typeLabel: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  timeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeLabel: {
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  timeValue: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  valueArea: {
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  singleValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
  },
  bpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bpInput: {
    alignItems: 'center',
  },
  bpSeparator: {
    color: Colors.textMuted,
    fontWeight: '300',
    marginHorizontal: 4,
  },
  bpLabel: {
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  valueInput: {
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    minWidth: 80,
    padding: 0,
  },
  unitText: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  rangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  rangeText: {
    fontWeight: '600',
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
})
