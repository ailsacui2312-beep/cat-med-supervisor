import { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { format, parseISO } from 'date-fns'
import { Colors } from '../../constants/colors'
import { useAuth } from '../../hooks/useAuth'
import { fetchHealthHistory, deleteHealthRecord, HEALTH_TYPE_INFO } from '../../lib/health'
import type { HealthType, HealthRecord } from '../../lib/types'

export default function HealthHistoryScreen() {
  const { type } = useLocalSearchParams<{ type: string }>()
  const healthType = type as HealthType
  const { user } = useAuth()
  const router = useRouter()

  const [records, setRecords] = useState<HealthRecord[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const info = HEALTH_TYPE_INFO[healthType]
  if (!info) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>未知数据类型</Text>
      </SafeAreaView>
    )
  }

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const data = await fetchHealthHistory(user.id, healthType, 50)
      setRecords(data)
    } catch (e: any) {
      console.error('Failed to load health history:', e)
    }
  }, [user, healthType])

  useFocusEffect(useCallback(() => { loadData() }, [loadData]))

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleDelete = (record: HealthRecord) => {
    Alert.alert('删除记录', '确定要删除这条记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHealthRecord(record.id)
            await loadData()
          } catch (e: any) {
            Alert.alert('错误', e.message)
          }
        },
      },
    ])
  }

  const renderItem = ({ item }: { item: HealthRecord }) => {
    const status = info.normalRange(item.value1, item.value2)
    const statusText = status === 'low' ? '偏低' : status === 'high' ? '偏高' : '正常'
    const statusColor = status === 'low' ? Colors.warning : status === 'high' ? Colors.danger : Colors.success

    return (
      <TouchableOpacity
        style={styles.card}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.cardValue}>{info.format(item)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardDate}>
            {format(parseISO(item.measured_at), 'MM月dd日')}
          </Text>
          <Text style={styles.cardTime}>
            {format(parseISO(item.measured_at), 'HH:mm')}
          </Text>
          {item.source === 'screenshot' && (
            <Text style={styles.sourceTag}>截图识别</Text>
          )}
        </View>
        {item.notes && (
          <Text style={styles.cardNotes}>{item.notes}</Text>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{info.emoji} {info.label}记录</Text>
        <TouchableOpacity onPress={() => router.push(`/health/add?type=${healthType}`)}>
          <Text style={styles.addText}>+ 记录</Text>
        </TouchableOpacity>
      </View>

      {records.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>{info.emoji}</Text>
          <Text style={styles.emptyTitle}>暂无{info.label}记录</Text>
          <Text style={styles.emptySubtitle}>点击右上角添加第一条记录</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListHeaderComponent={
            records.length > 0 ? (
              <Text style={styles.listHint}>长按记录可删除</Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 100,
    color: Colors.danger,
    fontSize: 16,
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
  backText: {
    fontSize: 16,
    color: Colors.primary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  addText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  list: {
    padding: 20,
  },
  listHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flexWrap: 'wrap',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  cardDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  cardTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  sourceTag: {
    fontSize: 10,
    color: Colors.primary,
    marginTop: 2,
  },
  cardNotes: {
    fontSize: 12,
    color: Colors.textMuted,
    width: '100%',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
})
