import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { useMode } from '../../contexts/ModeContext'

export default function ModeSelectScreen() {
  const { setMode } = useMode()
  const router = useRouter()

  const handleSelect = async (mode: 'normal' | 'elder') => {
    await setMode(mode)
    router.replace('/(tabs)')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.emoji}>🐱</Text>
        <Text style={styles.title}>选择界面模式</Text>
        <Text style={styles.subtitle}>您可以随时在「我的」中更改</Text>

        <View style={styles.cards}>
          {/* Normal Mode */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleSelect('normal')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '15' }]}>
              <MaterialIcons name="phone-iphone" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>普通版</Text>
            <Text style={styles.cardDesc}>标准字体和按钮大小</Text>
            <Text style={styles.cardSample}>示例文字 Aa</Text>
          </TouchableOpacity>

          {/* Elder Mode */}
          <TouchableOpacity
            style={[styles.card, styles.cardHighlight]}
            onPress={() => handleSelect('elder')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '20' }]}>
              <MaterialIcons name="elderly" size={40} color={Colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { fontSize: 22 }]}>长辈版</Text>
            <Text style={styles.cardDesc}>更大的字体和按钮</Text>
            <Text style={[styles.cardSample, { fontSize: 20 }]}>示例文字 Aa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 40,
  },
  cards: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  card: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHighlight: {
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '08',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  cardSample: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
})
