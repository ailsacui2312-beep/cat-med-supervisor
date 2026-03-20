import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Image, ActivityIndicator, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { MaterialIcons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { createHealthRecord, HEALTH_TYPE_INFO } from '../../lib/health'

interface AnalysisResult {
  blood_sugar?: number
  unit?: string
  measured_at?: string
  notes?: string
  confidence?: string
  error?: string
  message?: string
}

export default function ScreenshotScreen() {
  const router = useRouter()
  const { user } = useAuth()

  const [imageUri, setImageUri] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualValue, setManualValue] = useState('')

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('提示', '需要相册权限才能选择截图')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    })
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri)
      setResult(null)
    }
  }

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('提示', '需要相机权限才能拍照')
      return
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    })
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri)
      setResult(null)
    }
  }

  const handleAnalyze = async () => {
    if (!imageUri) return

    setAnalyzing(true)
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64' as any,
      })

      const ext = imageUri.split('.').pop()?.toLowerCase()
      const mediaType = ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png' ? 'image/png' : 'image/jpeg'

      const { data, error } = await supabase.functions.invoke('analyze-screenshot', {
        body: { image_base64: base64, media_type: mediaType },
      })

      if (error) throw error

      if (data.error) {
        Alert.alert('识别失败', data.message || '无法识别截图内容')
        return
      }

      setResult(data)
    } catch (e: any) {
      Alert.alert(
        '识别失败',
        '云端识别功能暂未部署，你可以手动输入血糖值。',
        [
          { text: '手动输入', onPress: () => setManualMode(true) },
          { text: '取消', style: 'cancel' },
        ]
      )
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!user || !result?.blood_sugar) return

    setSaving(true)
    try {
      await createHealthRecord(user.id, {
        type: 'blood_sugar',
        value1: result.blood_sugar,
        unit: result.unit || 'mmol/L',
        measured_at: result.measured_at || undefined,
        notes: result.notes || undefined,
        source: 'screenshot',
      })
      Alert.alert('保存成功', '血糖数据已记录', [
        { text: '好的', onPress: () => router.replace('/(tabs)/medications') },
      ])
    } catch (e: any) {
      Alert.alert('错误', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleManualSave = async () => {
    if (!user) return
    const v = parseFloat(manualValue)
    if (isNaN(v) || v <= 0) {
      Alert.alert('提示', '请输入有效的血糖值')
      return
    }
    setSaving(true)
    try {
      await createHealthRecord(user.id, {
        type: 'blood_sugar',
        value1: v,
        unit: 'mmol/L',
        source: 'screenshot',
      })
      Alert.alert('保存成功', '血糖数据已记录', [
        { text: '好的', onPress: () => router.replace('/(tabs)/medications') },
      ])
    } catch (e: any) {
      Alert.alert('错误', e.message)
    } finally {
      setSaving(false)
    }
  }

  const info = HEALTH_TYPE_INFO.blood_sugar

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>取消</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>截图识别</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Image selection */}
        {!imageUri ? (
          <View style={styles.selectArea}>
            <View style={styles.selectIconCircle}>
              <MaterialIcons name="photo-camera" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.selectTitle}>选择血糖仪截图</Text>
            <Text style={styles.selectSubtitle}>
              支持欧态（Ottai）等CGM App的截图
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.selectBtn} onPress={pickImage}>
                <MaterialIcons name="photo-library" size={18} color={Colors.textOnPrimary} />
                <Text style={styles.selectBtnText}>从相册选择</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.selectBtn, styles.selectBtnOutline]} onPress={takePhoto}>
                <MaterialIcons name="camera-alt" size={18} color={Colors.primary} />
                <Text style={[styles.selectBtnText, { color: Colors.primary }]}>拍照</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Preview */}
            <View style={styles.previewArea}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
              <TouchableOpacity
                style={styles.changeBtn}
                onPress={() => { setImageUri(null); setResult(null) }}
              >
                <Text style={styles.changeBtnText}>换一张</Text>
              </TouchableOpacity>
            </View>

            {/* Analyze button */}
            {!result && (
              <TouchableOpacity
                style={[styles.analyzeBtn, analyzing && { opacity: 0.6 }]}
                onPress={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <View style={styles.analyzingRow}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.analyzeBtnText}>AI 识别中...</Text>
                  </View>
                ) : (
                  <Text style={styles.analyzeBtnText}>开始识别</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Result */}
            {result && !result.error && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>识别结果</Text>

                <View style={styles.resultRow}>
                  <View style={styles.resultLabelRow}>
                    <MaterialIcons name="colorize" size={16} color={info.color} />
                    <Text style={styles.resultLabel}>血糖值</Text>
                  </View>
                  <Text style={styles.resultValue}>
                    {result.blood_sugar} {result.unit || 'mmol/L'}
                  </Text>
                </View>

                {result.blood_sugar && (
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>状态</Text>
                    {(() => {
                      const status = info.normalRange(result.blood_sugar)
                      const text = status === 'low' ? '偏低' : status === 'high' ? '偏高' : '正常'
                      const color = status === 'low' ? Colors.warning : status === 'high' ? Colors.danger : Colors.success
                      return (
                        <View style={[styles.resultStatusBadge, { backgroundColor: color + '20' }]}>
                          <MaterialIcons name="fiber-manual-record" size={8} color={color} />
                          <Text style={[styles.resultStatusText, { color }]}>{text}</Text>
                        </View>
                      )
                    })()}
                  </View>
                )}

                {result.notes && (
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>其他信息</Text>
                    <Text style={[styles.resultValue, { fontSize: 13, flex: 1, textAlign: 'right' }]}>
                      {result.notes}
                    </Text>
                  </View>
                )}

                {result.confidence && (
                  <Text style={styles.confidenceText}>
                    置信度：{result.confidence === 'high' ? '高' : result.confidence === 'medium' ? '中' : '低'}
                  </Text>
                )}

                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <MaterialIcons name="save" size={18} color={Colors.textOnPrimary} />
                  <Text style={styles.saveBtnText}>
                    {saving ? '保存中...' : '确认保存'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Manual input fallback */}
        {manualMode && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>手动输入血糖值</Text>
            <View style={styles.valueRow}>
              <TextInput
                style={[styles.valueInput, { flex: 1 }]}
                placeholder="如 5.6"
                placeholderTextColor={Colors.textMuted}
                value={manualValue}
                onChangeText={setManualValue}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={styles.unitLabel}>mmol/L</Text>
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleManualSave}
              disabled={saving}
            >
              <MaterialIcons name="save" size={18} color={Colors.textOnPrimary} />
              <Text style={styles.saveBtnText}>
                {saving ? '保存中...' : '确认保存'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  content: {
    flex: 1,
    padding: 20,
  },
  selectArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  selectTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  selectSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  selectBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  selectBtnText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  previewArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: 280,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
  },
  changeBtn: {
    marginTop: 8,
  },
  changeBtnText: {
    fontSize: 14,
    color: Colors.primary,
  },
  analyzeBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analyzeBtnText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resultValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  resultStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  resultStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confidenceText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
  },
  saveBtnText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  valueInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  unitLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
})
