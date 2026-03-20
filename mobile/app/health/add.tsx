import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Platform, KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { createHealthRecord, HEALTH_TYPE_INFO } from '../../lib/health'
import type { HealthType } from '../../lib/types'

const HEALTH_TYPES: HealthType[] = ['blood_sugar', 'blood_pressure', 'weight']

const TYPE_ICONS: Record<HealthType, keyof typeof MaterialIcons.glyphMap> = {
  blood_sugar: 'colorize',
  blood_pressure: 'monitor-heart',
  weight: 'monitor-weight',
}

export default function AddHealthScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const params = useLocalSearchParams<{ type?: string; source?: string; value?: string }>()

  const [type, setType] = useState<HealthType>(
    (params.type as HealthType) || 'blood_sugar'
  )
  const [value1, setValue1] = useState(params.value || '')
  const [value2, setValue2] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const info = HEALTH_TYPE_INFO[type]

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
        notes: notes.trim() || undefined,
        source: (params.source as 'manual' | 'screenshot') || 'manual',
      })
      Alert.alert('记录成功', `${info.label}数据已保存`, [
        { text: '好的', onPress: () => router.replace('/(tabs)/medications') },
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
          <Text style={styles.headerTitle}>记录身体数据</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <MaterialIcons name="save" size={18} color={Colors.primary} />
            <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>
              {saving ? '保存中...' : '保存'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.form}
          showsVerticalScrollIndicator={false}
        >
          {/* Type selector */}
          <View style={styles.field}>
            <Text style={styles.label}>数据类型</Text>
            <View style={styles.typeRow}>
              {HEALTH_TYPES.map(t => {
                const tInfo = HEALTH_TYPE_INFO[t]
                const selected = type === t
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeCard,
                      selected && {
                        borderColor: tInfo.color,
                        backgroundColor: tInfo.color + '15',
                      },
                    ]}
                    onPress={() => {
                      setType(t)
                      setValue1('')
                      setValue2('')
                    }}
                  >
                    <View style={[styles.typeIconCircle, { backgroundColor: tInfo.color + '15' }]}>
                      <MaterialIcons
                        name={TYPE_ICONS[t]}
                        size={24}
                        color={selected ? tInfo.color : Colors.textSecondary}
                      />
                    </View>
                    <Text style={[
                      styles.typeLabel,
                      selected && { color: tInfo.color, fontWeight: '700' },
                    ]}>
                      {tInfo.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Value input */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {type === 'blood_sugar' ? '血糖值'
                : type === 'blood_pressure' ? '收缩压（高压）'
                : '体重'}
            </Text>
            <View style={styles.valueRow}>
              <TextInput
                style={[styles.valueInput, { flex: 1 }]}
                placeholder={type === 'blood_sugar' ? '如 5.6' : type === 'blood_pressure' ? '如 120' : '如 65.5'}
                placeholderTextColor={Colors.textMuted}
                value={value1}
                onChangeText={setValue1}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={styles.unitText}>{info.defaultUnit}</Text>
            </View>
          </View>

          {/* Blood pressure: second value */}
          {type === 'blood_pressure' && (
            <View style={styles.field}>
              <Text style={styles.label}>舒张压（低压）</Text>
              <View style={styles.valueRow}>
                <TextInput
                  style={[styles.valueInput, { flex: 1 }]}
                  placeholder="如 80"
                  placeholderTextColor={Colors.textMuted}
                  value={value2}
                  onChangeText={setValue2}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.unitText}>mmHg</Text>
              </View>
            </View>
          )}

          {/* Range indicator */}
          {value1 !== '' && !isNaN(parseFloat(value1)) && (
            <View style={styles.rangeIndicator}>
              {(() => {
                const v1 = parseFloat(value1)
                const v2 = value2 ? parseFloat(value2) : undefined
                const status = info.normalRange(v1, v2)
                const statusText = status === 'low' ? '偏低' : status === 'high' ? '偏高' : '正常'
                const statusColor = status === 'low' ? Colors.warning : status === 'high' ? Colors.danger : Colors.success
                return (
                  <View style={[styles.rangeBadge, { backgroundColor: statusColor + '20' }]}>
                    <MaterialIcons
                      name="fiber-manual-record"
                      size={10}
                      color={statusColor}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.rangeText, { color: statusColor }]}>
                      {statusText}
                    </Text>
                  </View>
                )
              })()}
            </View>
          )}

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.label}>备注</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="如：餐前、空腹、运动后..."
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  saveText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  form: {
    padding: 20,
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
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 2,
    borderColor: Colors.borderLight,
  },
  typeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  valueInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  unitText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
    width: 60,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  rangeIndicator: {
    alignItems: 'center',
    marginBottom: 20,
  },
  rangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  rangeText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
