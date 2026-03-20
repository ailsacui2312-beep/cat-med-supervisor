import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { useMode } from '../../contexts/ModeContext'
import { getMyFamily, leaveFamily, removeFamilyMember } from '../../lib/family'
import type { Family, FamilyMemberWithEmail } from '../../lib/types'

export default function FamilyScreen() {
  const { user } = useAuth()
  const { s, si } = useMode()
  const router = useRouter()
  const [family, setFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<FamilyMemberWithEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [nicknames, setNicknames] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const result = await getMyFamily(user.id)
      if (result) {
        setFamily(result.family)
        setMembers(result.members)
        // Load nicknames from AsyncStorage
        const nicks: Record<string, string> = {}
        for (const m of result.members) {
          const saved = await AsyncStorage.getItem(`nickname_${m.user_id}`)
          if (saved) nicks[m.user_id] = saved
        }
        setNicknames(nicks)
      } else {
        setFamily(null)
        setMembers([])
      }
    } catch (e: any) {
      console.error('Failed to load family:', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleCopyCode = async () => {
    if (!family) return
    await Clipboard.setStringAsync(family.invite_code)
    Alert.alert('已复制', `邀请码 ${family.invite_code} 已复制到剪贴板`)
  }

  const handleShareCode = async () => {
    if (!family) return
    try {
      await Share.share({
        message: `加入我的家庭「${family.name}」一起管理用药吧！邀请码：${family.invite_code}`,
      })
    } catch {}
  }

  const handleLeave = () => {
    if (!family || !user) return
    const isOwner = family.created_by === user.id
    Alert.alert(
      isOwner ? '解散家庭' : '退出家庭',
      isOwner
        ? '解散后所有成员将失去家庭共享功能，确定吗？'
        : '退出后将无法查看家庭成员的用药数据，确定吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: isOwner ? '解散' : '退出',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveFamily(user.id, family.id)
              setFamily(null)
              setMembers([])
            } catch (e: any) {
              Alert.alert('错误', e.message)
            }
          },
        },
      ]
    )
  }

  const handleRemoveMember = (member: FamilyMemberWithEmail) => {
    Alert.alert('移除成员', `确定要将 ${getMemberDisplayName(member)} 移出家庭吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFamilyMember(member.id)
            await loadData()
          } catch (e: any) {
            Alert.alert('错误', e.message)
          }
        },
      },
    ])
  }

  const getMemberDisplayName = (member: FamilyMemberWithEmail) => {
    return member.nickname || nicknames[member.user_id] || member.email?.split('@')[0] || '成员'
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return '管理员'
      case 'member': return '成员'
      case 'viewer': return '观察者'
      default: return role
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return Colors.primary
      case 'member': return Colors.success
      case 'viewer': return Colors.info
      default: return Colors.textMuted
    }
  }

  const isOwner = user && family?.created_by === user.id

  // No family — show create/join options
  if (!loading && !family) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={si(24)} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: s(18) }]}>我的家庭</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { width: s(96), height: s(96), borderRadius: s(48) }]}>
            <MaterialIcons name="family-restroom" size={si(48)} color={Colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { fontSize: s(20) }]}>还没有加入家庭</Text>
          <Text style={[styles.emptySubtitle, { fontSize: s(14) }]}>
            创建一个家庭或输入邀请码加入，{'\n'}和家人互相监督按时吃药
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, { borderRadius: s(16), paddingVertical: s(16), marginBottom: s(12) }]}
            onPress={() => router.push('/family/create')}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add-circle" size={si(22)} color="#fff" />
            <Text style={[styles.primaryBtnText, { fontSize: s(17) }]}>创建家庭</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.outlineBtn, { borderRadius: s(16), paddingVertical: s(16) }]}
            onPress={() => router.push('/family/join')}
            activeOpacity={0.8}
          >
            <MaterialIcons name="group-add" size={si(22)} color={Colors.primary} />
            <Text style={[styles.outlineBtnText, { fontSize: s(17) }]}>输入邀请码加入</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={si(24)} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: s(18) }]}>我的家庭</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: s(20) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Family card */}
        {family && (
          <View style={[styles.familyCard, { borderRadius: s(20), padding: s(20) }]}>
            <View style={styles.familyCardHeader}>
              <View style={[styles.familyIcon, { width: s(52), height: s(52), borderRadius: s(26) }]}>
                <MaterialIcons name="home" size={si(28)} color={Colors.primary} />
              </View>
              <View style={styles.familyInfo}>
                <Text style={[styles.familyName, { fontSize: s(20) }]}>{family.name}</Text>
                <Text style={[styles.memberCount, { fontSize: s(13) }]}>
                  {members.length} 位成员
                </Text>
              </View>
            </View>

            {/* Invite code section */}
            <View style={[styles.inviteSection, { borderRadius: s(14), padding: s(14), marginTop: s(16) }]}>
              <Text style={[styles.inviteLabel, { fontSize: s(12) }]}>邀请码</Text>
              <View style={styles.inviteRow}>
                <Text style={[styles.inviteCode, { fontSize: s(28) }]}>{family.invite_code}</Text>
                <View style={styles.inviteActions}>
                  <TouchableOpacity onPress={handleCopyCode} style={[styles.inviteBtn, { borderRadius: s(10), padding: s(8) }]}>
                    <MaterialIcons name="content-copy" size={si(18)} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleShareCode} style={[styles.inviteBtn, { borderRadius: s(10), padding: s(8) }]}>
                    <MaterialIcons name="share" size={si(18)} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.inviteHint, { fontSize: s(11) }]}>
                把邀请码分享给家人，TA就可以加入啦
              </Text>
            </View>
          </View>
        )}

        {/* Members list */}
        <Text style={[styles.sectionTitle, { fontSize: s(12), marginTop: s(24) }]}>家庭成员</Text>
        <View style={[styles.membersCard, { borderRadius: s(16) }]}>
          {members.map((member, idx) => (
            <View key={member.id}>
              {idx > 0 && <View style={styles.separator} />}
              <TouchableOpacity
                style={[styles.memberRow, { paddingVertical: s(14), paddingHorizontal: s(16) }]}
                onPress={() => {
                  if (member.user_id !== user?.id) {
                    router.push(`/family/member/${member.user_id}`)
                  }
                }}
                activeOpacity={0.6}
              >
                <View style={[styles.memberAvatar, { width: s(40), height: s(40), borderRadius: s(20) }]}>
                  <MaterialIcons
                    name={member.user_id === user?.id ? 'person' : 'person-outline'}
                    size={si(22)}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={[styles.memberName, { fontSize: s(15) }]}>
                      {getMemberDisplayName(member)}
                      {member.user_id === user?.id ? ' (我)' : ''}
                    </Text>
                    <View style={[styles.roleBadge, { backgroundColor: getRoleColor(member.role) + '20', borderRadius: s(8), paddingHorizontal: s(8), paddingVertical: s(2) }]}>
                      <Text style={[styles.roleText, { fontSize: s(11), color: getRoleColor(member.role) }]}>
                        {getRoleLabel(member.role)}
                      </Text>
                    </View>
                  </View>
                </View>
                {isOwner && member.user_id !== user?.id ? (
                  <TouchableOpacity onPress={() => handleRemoveMember(member)}>
                    <MaterialIcons name="remove-circle-outline" size={si(20)} color={Colors.danger} />
                  </TouchableOpacity>
                ) : member.user_id !== user?.id ? (
                  <MaterialIcons name="chevron-right" size={si(22)} color={Colors.textMuted} />
                ) : null}
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Leave/Dissolve button */}
        <TouchableOpacity
          style={[styles.leaveBtn, { borderRadius: s(14), paddingVertical: s(14), marginTop: s(24) }]}
          onPress={handleLeave}
          activeOpacity={0.6}
        >
          <Text style={[styles.leaveBtnText, { fontSize: s(16) }]}>
            {isOwner ? '解散家庭' : '退出家庭'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  scroll: { paddingBottom: 40 },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: {
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    width: '100%',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    width: '100%',
  },
  outlineBtnText: { color: Colors.primary, fontWeight: '700' },

  // Family card
  familyCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 16,
  },
  familyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  familyIcon: {
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  familyInfo: { flex: 1 },
  familyName: { fontWeight: '800', color: Colors.textPrimary },
  memberCount: { color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },

  // Invite section
  inviteSection: {
    backgroundColor: Colors.primary + '0A',
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  inviteLabel: {
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteCode: {
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 4,
  },
  inviteActions: { flexDirection: 'row', gap: 8 },
  inviteBtn: {
    backgroundColor: Colors.primary + '15',
  },
  inviteHint: {
    color: Colors.textMuted,
    marginTop: 6,
  },

  // Members
  sectionTitle: {
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  membersCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  separator: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 70 },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  memberAvatar: {
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberInfo: { flex: 1 },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: { fontWeight: '600', color: Colors.textPrimary },
  roleBadge: {},
  roleText: { fontWeight: '600' },

  // Leave button
  leaveBtn: {
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: 'center',
  },
  leaveBtnText: { fontWeight: '600', color: Colors.danger },
})
