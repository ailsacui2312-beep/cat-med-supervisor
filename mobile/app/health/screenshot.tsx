import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Image, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { readAsStringAsync } from 'expo-file-system'
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
      const base64 = await readAsStringAsync(imageUri, {
        encoding: 'base64',
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
      Alert.alert('错误', e.message || '截图分析失败，请重试')
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
        { text: '好的', onPress: () => router.back() },
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
            <Text style={styles.selectEmoji}>📸</Text>
            <Text style={styles.selectTitle}>选择血糖仪截图</Text>
            <Text style={styles.selectSubtitle}>
              支持欧态（Ottai）等CGM App的截图
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.selectBtn} onPress={pickImage}>
                <Text style={styles.selectBtnText}>从相册选择</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.selectBtn, styles.selectBtnOutline]} onPress={takePhoto}>
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
                  <Text style={styles.resultLabel}>{info.emoji} 血糖值</Text>
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
                      return <Text style={[styles.resultValue, { color }]}>{text}</Text>
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
                  <Text style={styles.saveBtnText}>
                    {saving ? '保存中...' : '确认保存'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
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
  selectEmoji: {
    fontSize: 64,
    marginBottom: 16,
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
    borderRadius: 14,
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
  resultLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resultValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  confidenceText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
})
