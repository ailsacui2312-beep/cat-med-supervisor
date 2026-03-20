import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useMode } from '../../contexts/ModeContext'
import { joinFamily } from '../../lib/family'

export default function JoinFamilyScreen() {
  const { user } = useAuth()
  const { s, si } = useMode()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length !== 6) {
      Alert.alert('提示', '请输入6位邀请码')
      return
    }
    if (!user) return

    setJoining(true)
    try {
      await joinFamily(user.id, trimmed)
      Alert.alert('加入成功！🎉', '你已成功加入家庭，可以查看家人的用药情况了', [
        { text: '好的', onPress: () => router.replace('/family') },
      ])
    } catch (e: any) {
      Alert.alert('加入失败', e.message)
    } finally {
      setJoining(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={si(24)} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: s(18) }]}>加入家庭</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.formArea}>
          {/* Icon */}
          <View style={[styles.iconCircle, { width: s(80), height: s(80), borderRadius: s(40) }]}>
            <MaterialIcons name="group-add" size={si(40)} color={Colors.primary} />
          </View>

          <Text style={[styles.title, { fontSize: s(22) }]}>输入邀请码</Text>
          <Text style={[styles.subtitle, { fontSize: s(14) }]}>
            向家庭创建者索取6位邀请码
          </Text>

          <TextInput
            style={[styles.input, {
              fontSize: s(32),
              paddingHorizontal: s(20),
              paddingVertical: s(16),
              borderRadius: s(16),
            }]}
            placeholder="ABC123"
            placeholderTextColor={Colors.textMuted + '40'}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            maxLength={6}
            autoFocus
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={handleJoin}
          />

          <TouchableOpacity
            style={[
              styles.joinBtn,
              { borderRadius: s(16), paddingVertical: s(16) },
              (code.trim().length !== 6 || joining) && { opacity: 0.5 },
            ]}
            onPress={handleJoin}
            disabled={code.trim().length !== 6 || joining}
            activeOpacity={0.8}
          >
            <MaterialIcons name="check-circle" size={si(22)} color="#fff" />
            <Text style={[styles.joinBtnText, { fontSize: s(17) }]}>
              {joining ? '加入中...' : '加入家庭'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: { fontWeight: '700', color: Colors.textPrimary },
  content: { flex: 1 },
  formArea: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    alignItems: 'center',
  },
  iconCircle: {
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    color: Colors.textPrimary,
    fontWeight: '800',
    width: '100%',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 24,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    width: '100%',
  },
  joinBtnText: { color: '#fff', fontWeight: '700' },
})
