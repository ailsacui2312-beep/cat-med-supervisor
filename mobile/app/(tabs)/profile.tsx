import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking, TextInput, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useMode, type AppMode } from '../../contexts/ModeContext'
import { getStreakDays, getProfileStats } from '../../lib/logs'

type SettingsItem = {
  icon: keyof typeof MaterialIcons.glyphMap
  label: string
  value?: string
  onPress?: () => void
}

function SettingsRow({ icon, label, value, onPress, s, si }: SettingsItem & { s: (n: number) => number; si: (n: number) => number }) {
  return (
    <TouchableOpacity style={[styles.settingsRow, { paddingVertical: s(14), paddingHorizontal: s(16) }]} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.settingsIconBox, { width: s(36), height: s(36), borderRadius: s(10) }]}>
        <MaterialIcons name={icon} size={si(20)} color={Colors.primary} />
      </View>
      <Text style={[styles.settingsLabel, { fontSize: s(15) }]}>{label}</Text>
      {value && <Text style={[styles.settingsValue, { fontSize: s(13) }]}>{value}</Text>}
      <MaterialIcons name="chevron-right" size={si(22)} color={Colors.textMuted} />
    </TouchableOpacity>
  )
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth()
  const { isElder, s, si, setMode, mode } = useMode()
  const router = useRouter()
  const [streak, setStreak] = useState(0)
  const [totalTaken, setTotalTaken] = useState(0)
  const [activeDays, setActiveDays] = useState(0)
  const [nickname, setNickname] = useState('')
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState('')

  const loadStats = useCallback(async () => {
    if (!user) return
    try {
      const [streakDays, stats, savedName, savedAvatar] = await Promise.all([
        getStreakDays(user.id),
        getProfileStats(user.id),
        AsyncStorage.getItem(`nickname_${user.id}`),
        AsyncStorage.getItem(`avatar_${user.id}`),
      ])
      setStreak(streakDays)
      setTotalTaken(stats.totalTaken)
      setActiveDays(stats.activeDays)
      if (savedName) setNickname(savedName)
      if (savedAvatar) setAvatarUri(savedAvatar)
    } catch (e) {
      console.error('Failed to load profile stats:', e)
    }
  }, [user])

  useFocusEffect(useCallback(() => { loadStats() }, [loadStats]))

  const displayName = nickname || (user?.email ? user.email.split('@')[0] : '用户')

  const handleEditName = () => {
    setTempName(displayName)
    setEditingName(true)
  }

  const handleSaveName = async () => {
    const trimmed = tempName.trim()
    if (!trimmed || !user) {
      setEditingName(false)
      return
    }
    setNickname(trimmed)
    setEditingName(false)
    await AsyncStorage.setItem(`nickname_${user.id}`, trimmed)
  }

  const handlePickAvatar = async () => {
    Alert.alert('更换头像', '选择照片来源', [
      {
        text: '拍照', onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync()
          if (!perm.granted) { Alert.alert('提示', '需要相机权限'); return }
          const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6 })
          if (!res.canceled && res.assets[0] && user) {
            setAvatarUri(res.assets[0].uri)
            await AsyncStorage.setItem(`avatar_${user.id}`, res.assets[0].uri)
          }
        },
      },
      {
        text: '从相册选择', onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (!perm.granted) { Alert.alert('提示', '需要相册权限'); return }
          const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6 })
          if (!res.canceled && res.assets[0] && user) {
            setAvatarUri(res.assets[0].uri)
            await AsyncStorage.setItem(`avatar_${user.id}`, res.assets[0].uri)
          }
        },
      },
      { text: '取消', style: 'cancel' },
    ])
  }

  const handleSignOut = () => {
    Alert.alert('退出登录', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: signOut },
    ])
  }

  const handleModeSwitch = () => {
    Alert.alert('切换界面模式', '选择界面模式', [
      { text: '普通版', onPress: () => setMode('normal') },
      { text: '长辈版（大字体）', onPress: () => setMode('elder') },
      { text: '取消', style: 'cancel' },
    ])
  }

  const handleNotifications = () => {
    Alert.alert('通知设置', '请在系统设置中管理本应用的通知权限', [
      { text: '取消', style: 'cancel' },
      { text: '打开设置', onPress: () => Linking.openSettings() },
    ])
  }

  const handleExportData = () => {
    Alert.alert('导出数据', '该功能即将上线，敬请期待！')
  }

  const handleBackup = () => {
    Alert.alert('备份与同步', '您的数据已通过云端自动同步，无需手动备份。')
  }

  const handleFAQ = () => {
    Alert.alert(
      '常见问题',
      '1. 如何添加药品？\n点击药盒页右上角「添加」按钮\n\n2. 如何设置提醒？\n在药品详情中设置提醒时间\n\n3. 如何使用语音？\n点击首页或药盒页的麦克风按钮\n\n4. 如何切换大字版？\n在「我的」→「界面模式」中切换',
    )
  }

  const handleContact = () => {
    Alert.alert('联系我们', '如有问题或建议，请发送邮件给我们', [
      { text: '发送邮件', onPress: () => Linking.openURL('mailto:ailsacui2312@gmail.com?subject=小猫吃药监督 - 反馈') },
      { text: '取消', style: 'cancel' },
    ])
  }

  const modeLabel = mode === 'elder' ? '长辈版' : '普通版'

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: s(20) }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.headerTitle, { fontSize: s(22) }]}>我的</Text>

        {/* User Info */}
        <View style={styles.userSection}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              onPress={handlePickAvatar}
              style={[styles.avatar, { width: s(100), height: s(100), borderRadius: s(50) }]}
              activeOpacity={0.7}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: s(100), height: s(100), borderRadius: s(50) }} />
              ) : (
                <MaterialIcons name="person" size={si(48)} color={Colors.textMuted} />
              )}
              <View style={[styles.cameraOverlay, { width: s(30), height: s(30), borderRadius: s(15) }]}>
                <MaterialIcons name="camera-alt" size={si(16)} color="#fff" />
              </View>
            </TouchableOpacity>
            {streak > 0 && (
              <View style={styles.streakBadge}>
                <MaterialIcons name="local-fire-department" size={si(14)} color="#FF6B35" />
                <Text style={[styles.streakBadgeText, { fontSize: s(11) }]}>{streak} 天</Text>
              </View>
            )}
          </View>
          {editingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <TextInput
                style={[styles.nameInput, { fontSize: s(18), paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: s(10) }]}
                value={tempName}
                onChangeText={setTempName}
                autoFocus
                maxLength={20}
                onSubmitEditing={handleSaveName}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={handleSaveName}>
                <MaterialIcons name="check-circle" size={si(28)} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleEditName}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}
              activeOpacity={0.6}
            >
              <Text style={[styles.username, { fontSize: s(20) }]}>{displayName}</Text>
              <MaterialIcons name="edit" size={si(16)} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
          <Text style={[styles.emailText, { fontSize: s(12) }]}>{user?.email || ''}</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { padding: s(16), borderRadius: s(16) }]}>
            <MaterialIcons name="medication" size={si(28)} color={Colors.primary} />
            <Text style={[styles.statNumber, { fontSize: s(28) }]}>{totalTaken}</Text>
            <Text style={[styles.statLabel, { fontSize: s(13) }]}>服药总次数</Text>
          </View>
          <View style={[styles.statCard, { padding: s(16), borderRadius: s(16) }]}>
            <MaterialIcons name="calendar-today" size={si(28)} color={Colors.primary} />
            <Text style={[styles.statNumber, { fontSize: s(28) }]}>{activeDays}</Text>
            <Text style={[styles.statLabel, { fontSize: s(13) }]}>使用天数</Text>
          </View>
        </View>

        {/* 显示设置 */}
        <Text style={[styles.sectionHeader, { fontSize: s(12) }]}>显示设置</Text>
        <View style={[styles.settingsGroup, { borderRadius: s(16) }]}>
          <SettingsRow icon="text-fields" label="界面模式" value={modeLabel} onPress={handleModeSwitch} s={s} si={si} />
        </View>

        {/* 家庭共享 */}
        <Text style={[styles.sectionHeader, { fontSize: s(12) }]}>家庭共享</Text>
        <View style={[styles.settingsGroup, { borderRadius: s(16) }]}>
          <SettingsRow icon="family-restroom" label="我的家庭" onPress={() => router.push('/family')} s={s} si={si} />
        </View>

        {/* 账户设置 */}
        <Text style={[styles.sectionHeader, { fontSize: s(12) }]}>账户设置</Text>
        <View style={[styles.settingsGroup, { borderRadius: s(16) }]}>
          <SettingsRow icon="notifications-active" label="通知设置" onPress={handleNotifications} s={s} si={si} />
        </View>

        {/* 数据与隐私 */}
        <Text style={[styles.sectionHeader, { fontSize: s(12) }]}>数据与隐私</Text>
        <View style={[styles.settingsGroup, { borderRadius: s(16) }]}>
          <SettingsRow icon="cloud-sync" label="备份与同步" onPress={handleBackup} s={s} si={si} />
          <View style={styles.separator} />
          <SettingsRow icon="download" label="导出健康数据" onPress={handleExportData} s={s} si={si} />
        </View>

        {/* 支持 */}
        <Text style={[styles.sectionHeader, { fontSize: s(12) }]}>支持</Text>
        <View style={[styles.settingsGroup, { borderRadius: s(16) }]}>
          <SettingsRow icon="quiz" label="常见问题" onPress={handleFAQ} s={s} si={si} />
          <View style={styles.separator} />
          <SettingsRow icon="mail" label="联系我们" onPress={handleContact} s={s} si={si} />
        </View>

        <TouchableOpacity style={[styles.signOutButton, { paddingVertical: s(14), borderRadius: s(14) }]} onPress={handleSignOut} activeOpacity={0.6}>
          <Text style={[styles.signOutText, { fontSize: s(16) }]}>退出登录</Text>
        </TouchableOpacity>

        <Text style={[styles.versionText, { fontSize: s(12) }]}>小猫吃药监督 v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  scroll: { paddingBottom: 40 },
  headerTitle: { fontWeight: '700', color: Colors.textPrimary, paddingTop: 8, paddingBottom: 16 },
  userSection: { alignItems: 'center', marginBottom: 24 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: { backgroundColor: Colors.bgCard, borderWidth: 3, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  cameraOverlay: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  streakBadge: { position: 'absolute', bottom: -4, right: -8, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  streakBadgeText: { fontWeight: '700', color: '#FF6B35' },
  username: { fontWeight: '700', color: Colors.textPrimary },
  emailText: { color: Colors.textMuted, marginTop: 4 },
  nameInput: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.primary, fontWeight: '600', color: Colors.textPrimary, minWidth: 140, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  statCard: { flex: 1, backgroundColor: Colors.bgCard, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary + '1A', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statNumber: { fontWeight: '800', color: Colors.textPrimary, marginTop: 8 },
  statLabel: { color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  sectionHeader: { color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 },
  settingsGroup: { backgroundColor: Colors.bgCard, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderLight },
  settingsRow: { flexDirection: 'row', alignItems: 'center' },
  settingsIconBox: { backgroundColor: Colors.primary + '1A', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  settingsLabel: { flex: 1, fontWeight: '500', color: Colors.textPrimary },
  settingsValue: { color: Colors.textSecondary, marginRight: 8, fontWeight: '500' },
  separator: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 66 },
  signOutButton: { borderWidth: 1, borderColor: Colors.danger, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  signOutText: { fontWeight: '600', color: Colors.danger },
  versionText: { textAlign: 'center', color: Colors.textMuted, marginBottom: 8 },
})
