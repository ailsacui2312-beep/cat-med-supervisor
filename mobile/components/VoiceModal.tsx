import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Animated, ActivityIndicator, Alert, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { Colors } from '../constants/colors'
import { useMode } from '../contexts/ModeContext'
import {
  transcribe, smartParseIntent, DEFAULT_CONFIG,
  type VoiceIntent, type ChatMessage,
} from '../lib/voice'
import type { Medication } from '../lib/types'

type VoiceState = 'idle' | 'recording' | 'processing' | 'result' | 'conversation' | 'error'

interface VoiceModalProps {
  visible: boolean
  onClose: () => void
  onConfirm: (intent: VoiceIntent) => void
  medications: Medication[]
}

// Intent display labels
const INTENT_LABELS: Record<string, string> = {
  ADD_MED: '添加药品',
  ADD_HEALTH: '记录健康数据',
  MARK_TAKEN: '标记已服用',
  UNKNOWN: '无法识别',
}

const HEALTH_LABELS: Record<string, string> = {
  blood_sugar: '血糖',
  blood_pressure: '血压',
  weight: '体重',
}

export default function VoiceModal({ visible, onClose, onConfirm, medications }: VoiceModalProps) {
  const { isElder, s, si } = useMode()
  const [state, setState] = useState<VoiceState>('idle')
  const [intent, setIntent] = useState<VoiceIntent | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [catMessage, setCatMessage] = useState('')
  const [userReply, setUserReply] = useState('')
  const pulseAnim = useRef(new Animated.Value(1)).current
  const recordingRef = useRef<any>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setState('idle')
      setIntent(null)
      setErrorMsg('')
      setChatHistory([])
      setCatMessage('')
      setUserReply('')
      setTimeout(() => startRecording(), 300)
    } else {
      stopRecordingCleanup()
    }
  }, [visible])

  // Pulse animation during recording
  useEffect(() => {
    if (state === 'recording') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      )
      pulse.start()
      return () => pulse.stop()
    }
  }, [state])

  const startRecording = async () => {
    try {
      const { Audio } = await import('expo-av')
      const permission = await Audio.requestPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('需要麦克风权限', '请在设置中允许使用麦克风')
        onClose()
        return
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })
      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.wav',
          outputFormat: 2,
          audioEncoder: 1,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
        },
        ios: {
          extension: '.wav',
          audioQuality: 127,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      })
      recordingRef.current = recording
      setState('recording')
    } catch (err: any) {
      console.error('Failed to start recording:', err)
      setErrorMsg('无法启动录音: ' + (err.message || '未知错误'))
      setState('error')
    }
  }

  const stopRecordingCleanup = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync()
      } catch {}
      recordingRef.current = null
    }
  }

  // Process text through smart intent parsing (DeepSeek + fallback)
  const processText = useCallback(async (text: string, history?: ChatMessage[]) => {
    setState('processing')
    try {
      const parsed = await smartParseIntent(text, medications, history)
      if (parsed.type === 'ASK') {
        // Cat is asking a follow-up question
        setCatMessage(parsed.message)
        setChatHistory(parsed.history)
        setUserReply('')
        setState('conversation')
      } else {
        setIntent(parsed)
        setState('result')
      }
    } catch (err: any) {
      setErrorMsg(err.message || '识别失败')
      setState('error')
    }
  }, [medications])

  const handleStopAndTranscribe = useCallback(async () => {
    if (state !== 'recording') return
    setState('processing')

    let audioUri = ''
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync()
        audioUri = recordingRef.current.getURI() || ''
        recordingRef.current = null
      }
    } catch {}

    try {
      const text = await transcribe(audioUri, DEFAULT_CONFIG)
      await processText(text)
    } catch (err: any) {
      setErrorMsg(err.message || '识别失败')
      setState('error')
    }
  }, [state, processText])

  // Handle text reply in conversation mode
  const handleSendReply = useCallback(async () => {
    const reply = userReply.trim()
    if (!reply) return
    await processText(reply, chatHistory)
  }, [userReply, chatHistory, processText])

  // Handle voice reply in conversation mode
  const handleVoiceReply = useCallback(() => {
    setCatMessage('')
    startRecordingForReply()
  }, [])

  const startRecordingForReply = async () => {
    try {
      const { Audio } = await import('expo-av')
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })
      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.wav', outputFormat: 2, audioEncoder: 1,
          sampleRate: 16000, numberOfChannels: 1, bitRate: 256000,
        },
        ios: {
          extension: '.wav', audioQuality: 127, sampleRate: 16000,
          numberOfChannels: 1, bitRate: 256000, linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false, linearPCMIsFloat: false,
        },
        web: {},
      })
      recordingRef.current = recording
      setState('recording')
    } catch (err: any) {
      setErrorMsg('无法启动录音: ' + (err.message || '未知错误'))
      setState('error')
    }
  }

  // After recording reply, transcribe and continue conversation
  const handleStopReplyRecording = useCallback(async () => {
    if (state !== 'recording') return
    setState('processing')

    let audioUri = ''
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync()
        audioUri = recordingRef.current.getURI() || ''
        recordingRef.current = null
      }
    } catch {}

    try {
      const text = await transcribe(audioUri, DEFAULT_CONFIG)
      await processText(text, chatHistory)
    } catch (err: any) {
      setErrorMsg(err.message || '识别失败')
      setState('error')
    }
  }, [state, chatHistory, processText])

  const handleRetry = () => {
    setState('idle')
    setIntent(null)
    setErrorMsg('')
    setChatHistory([])
    setCatMessage('')
    setUserReply('')
    setTimeout(() => startRecording(), 300)
  }

  const renderContent = () => {
    switch (state) {
      case 'idle':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={[styles.stateText, { fontSize: s(16) }]}>准备中...</Text>
          </View>
        )

      case 'recording':
        return (
          <View style={styles.centerContent}>
            <Animated.View style={[
              styles.micCircle,
              {
                width: s(120), height: s(120), borderRadius: s(60),
                transform: [{ scale: pulseAnim }],
              },
            ]}>
              <MaterialIcons name="mic" size={s(56)} color="#fff" />
            </Animated.View>
            <Text style={[styles.stateText, { fontSize: s(18), marginTop: s(24) }]}>
              正在听...
            </Text>
            <Text style={[styles.hintText, { fontSize: s(14) }]}>
              {chatHistory.length > 0 ? '回答小猫的问题吧～' : '说出你想要的操作'}
            </Text>
            <TouchableOpacity
              style={[styles.stopBtn, { paddingVertical: s(14), paddingHorizontal: s(36), borderRadius: s(28) }]}
              onPress={chatHistory.length > 0 ? handleStopReplyRecording : handleStopAndTranscribe}
            >
              <MaterialIcons name="stop" size={s(20)} color="#fff" />
              <Text style={[styles.stopBtnText, { fontSize: s(16) }]}>完成</Text>
            </TouchableOpacity>
          </View>
        )

      case 'processing':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={[styles.stateText, { fontSize: s(18), marginTop: s(20) }]}>
              {chatHistory.length > 0 ? '小猫思考中...' : '识别中...'}
            </Text>
          </View>
        )

      case 'conversation':
        return (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView style={styles.conversationContent} contentContainerStyle={styles.conversationScroll}>
              {/* Cat message bubble */}
              <View style={[styles.catBubble, { borderRadius: s(16), padding: s(16) }]}>
                <Text style={[styles.catEmoji, { fontSize: s(32) }]}>🐱</Text>
                <Text style={[styles.catText, { fontSize: s(16) }]}>
                  {catMessage}
                </Text>
              </View>
            </ScrollView>

            {/* Reply input area */}
            <View style={[styles.replyBar, { paddingHorizontal: s(16), paddingVertical: s(12) }]}>
              <TextInput
                style={[styles.replyInput, {
                  fontSize: s(15), paddingHorizontal: s(16), paddingVertical: s(10),
                  borderRadius: s(24),
                }]}
                placeholder="输入回复..."
                placeholderTextColor={Colors.textMuted}
                value={userReply}
                onChangeText={setUserReply}
                returnKeyType="send"
                onSubmitEditing={handleSendReply}
              />
              <TouchableOpacity
                style={[styles.voiceReplyBtn, { width: s(42), height: s(42), borderRadius: s(21) }]}
                onPress={handleVoiceReply}
              >
                <MaterialIcons name="mic" size={si(20)} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, {
                  width: s(42), height: s(42), borderRadius: s(21),
                  opacity: userReply.trim() ? 1 : 0.4,
                }]}
                onPress={handleSendReply}
                disabled={!userReply.trim()}
              >
                <MaterialIcons name="send" size={si(20)} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )

      case 'result':
        if (!intent) return null
        return (
          <View style={styles.resultContent}>
            <View style={[styles.resultCard, { padding: s(20), borderRadius: s(16) }]}>
              <MaterialIcons
                name={intent.type === 'UNKNOWN' ? 'help-outline' : 'check-circle'}
                size={s(40)}
                color={intent.type === 'UNKNOWN' ? Colors.warning : Colors.success}
              />
              <Text style={[styles.resultType, { fontSize: s(14) }]}>
                {INTENT_LABELS[intent.type] || intent.type}
              </Text>
              <Text style={[styles.resultDetail, { fontSize: s(20) }]}>
                {getIntentDescription(intent)}
              </Text>
              {/* Show extra info for ADD_MED from LLM */}
              {intent.type === 'ADD_MED' && (intent.dosage || intent.usage_note || intent.illness) && (
                <View style={[styles.extraInfo, { marginTop: s(8) }]}>
                  {intent.illness && (
                    <Text style={[styles.extraText, { fontSize: s(12) }]}>
                      🏥 {intent.illness}
                    </Text>
                  )}
                  {intent.dosage && (
                    <Text style={[styles.extraText, { fontSize: s(12) }]}>
                      💊 {intent.dosage}
                    </Text>
                  )}
                  {intent.usage_note && (
                    <Text style={[styles.extraText, { fontSize: s(12) }]}>
                      📋 {intent.usage_note}
                    </Text>
                  )}
                </View>
              )}
            </View>

            <View style={styles.resultActions}>
              {intent.type !== 'UNKNOWN' ? (
                <>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { paddingVertical: s(14), borderRadius: s(24) }]}
                    onPress={onClose}
                  >
                    <Text style={[styles.cancelBtnText, { fontSize: s(16) }]}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, { paddingVertical: s(14), borderRadius: s(24) }]}
                    onPress={() => onConfirm(intent)}
                  >
                    <MaterialIcons name="check" size={s(20)} color="#fff" />
                    <Text style={[styles.confirmBtnText, { fontSize: s(16) }]}>确认</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { paddingVertical: s(14), borderRadius: s(24) }]}
                    onPress={onClose}
                  >
                    <Text style={[styles.cancelBtnText, { fontSize: s(16) }]}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, { paddingVertical: s(14), borderRadius: s(24) }]}
                    onPress={handleRetry}
                  >
                    <MaterialIcons name="refresh" size={s(20)} color="#fff" />
                    <Text style={[styles.confirmBtnText, { fontSize: s(16) }]}>重试</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )

      case 'error':
        return (
          <View style={styles.centerContent}>
            <MaterialIcons name="error-outline" size={s(64)} color={Colors.danger} />
            <Text style={[styles.stateText, { fontSize: s(16), color: Colors.danger }]}>
              {errorMsg || '识别出错'}
            </Text>
            <View style={[styles.resultActions, { marginTop: s(24) }]}>
              <TouchableOpacity
                style={[styles.cancelBtn, { paddingVertical: s(14), borderRadius: s(24) }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelBtnText, { fontSize: s(16) }]}>关闭</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { paddingVertical: s(14), borderRadius: s(24) }]}
                onPress={handleRetry}
              >
                <Text style={[styles.confirmBtnText, { fontSize: s(16) }]}>重试</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { borderRadius: s(24), paddingBottom: s(40) }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <MaterialIcons name="close" size={s(24)} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Title */}
          <Text style={[styles.title, { fontSize: s(20) }]}>
            {state === 'conversation' ? '🐱 小猫助手' : '语音输入'}
          </Text>

          {renderContent()}
        </View>
      </View>
    </Modal>
  )
}

function getIntentDescription(intent: VoiceIntent): string {
  switch (intent.type) {
    case 'ADD_MED':
      return `添加药品「${intent.name}」`
    case 'ADD_HEALTH':
      return intent.value
        ? `${HEALTH_LABELS[intent.healthType] || intent.healthType}: ${intent.value}`
        : `记录${HEALTH_LABELS[intent.healthType] || intent.healthType}`
    case 'MARK_TAKEN':
      return `吃了「${intent.medication.name}」`
    case 'ASK':
      return intent.message
    case 'UNKNOWN':
      return `"${intent.rawText}"`
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgPrimary,
    paddingTop: 16,
    minHeight: 400,
    maxHeight: '85%',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  title: {
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  centerContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  micCircle: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  stateText: {
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
  },
  hintText: {
    color: Colors.textSecondary,
    marginTop: 8,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.danger,
    marginTop: 32,
  },
  stopBtnText: {
    color: '#fff',
    fontWeight: '600',
  },

  // ── Conversation (Cat chat) ──
  conversationContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  conversationScroll: {
    paddingVertical: 8,
  },
  catBubble: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    alignItems: 'center',
  },
  catEmoji: {
    marginBottom: 8,
  },
  catText: {
    color: Colors.textPrimary,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.bgCard,
  },
  replyInput: {
    flex: 1,
    backgroundColor: Colors.bgInput,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  voiceReplyBtn: {
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Result ──
  resultContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  resultCard: {
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  resultType: {
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 8,
  },
  resultDetail: {
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 8,
    textAlign: 'center',
  },
  extraInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  extraText: {
    color: Colors.textSecondary,
    fontWeight: '500',
    backgroundColor: Colors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
  },
  confirmBtnText: {
    fontWeight: '600',
    color: '#fff',
  },
})
