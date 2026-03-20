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
import { createFamily } from '../../lib/family'

export default function CreateFamilyScreen() {
  const { user } = useAuth()
  const { s, si } = useMode()
  const router = useRouter()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      Alert.alert('提示', '请输入家庭名称')
      return
    }
    if (!user) return

    setCreating(true)
    try {
      const { inviteCode } = await createFamily(user.id, trimmed)
      Alert.alert(
        '创建成功！🎉',
        `家庭「${trimmed}」已创建\n\n邀请码：${inviteCode}\n\n把邀请码分享给家人，TA就可以加入啦`,
        [{ text: '好的', onPress: () => router.replace('/family') }]
      )
    } catch (e: any) {
      Alert.alert('创建失败', e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={si(24)} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: s(18) }]}>创建家庭</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.formArea}>
          {/* Icon */}
          <View style={[styles.iconCircle, { width: s(80), height: s(80), borderRadius: s(40) }]}>
            <MaterialIcons name="home" size={si(40)} color={Colors.primary} />
          </View>

          <Text style={[styles.title, { fontSize: s(22) }]}>给你的家庭起个名字</Text>
          <Text style={[styles.subtitle, { fontSize: s(14) }]}>
            例如"崔家"、"爸妈的药盒"等
          </Text>

          <TextInput
            style={[styles.input, {
              fontSize: s(18),
              paddingHorizontal: s(20),
              paddingVertical: s(16),
              borderRadius: s(16),
            }]}
            placeholder="输入家庭名称"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={20}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <TouchableOpacity
            style={[
              styles.createBtn,
              { borderRadius: s(16), paddingVertical: s(16) },
              (!name.trim() || creating) && { opacity: 0.5 },
            ]}
            onPress={handleCreate}
            disabled={!name.trim() || creating}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add-circle" size={si(22)} color="#fff" />
            <Text style={[styles.createBtnText, { fontSize: s(17) }]}>
              {creating ? '创建中...' : '创建家庭'}
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
    fontWeight: '600',
    width: '100%',
    textAlign: 'center',
    marginBottom: 24,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    width: '100%',
  },
  createBtnText: { color: '#fff', fontWeight: '700' },
})
