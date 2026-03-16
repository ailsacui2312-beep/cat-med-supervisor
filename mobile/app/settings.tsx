import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Switch, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Colors } from '../constants/colors'
import { useAuth } from '../hooks/useAuth'
import { setupNotifications, cancelAllReminders } from '../lib/notifications'

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value)
    if (value) {
      const granted = await setupNotifications()
      if (!granted) {
        Alert.alert('权限不足', '请在系统设置中开启通知权限')
        setNotificationsEnabled(false)
      }
    } else {
      await cancelAllReminders()
    }
  }

  const handleSignOut = () => {
    Alert.alert('退出登录', '确定要退出吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>设置</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>通知</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>吃药提醒</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ true: Colors.primary }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>账号</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>邮箱</Text>
          <Text style={styles.rowValue}>{user?.email || '-'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>退出登录</Text>
      </TouchableOpacity>

      <Text style={styles.version}>小猫吃药监督 v1.0.0</Text>
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
  },
  backText: {
    fontSize: 16,
    color: Colors.primary,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  section: {
    backgroundColor: Colors.bgCard,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rowLabel: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  rowValue: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  signOutBtn: {
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: 'center',
  },
  signOutText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '500',
  },
  version: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 32,
  },
})
