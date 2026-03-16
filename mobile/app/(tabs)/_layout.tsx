import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { useMode } from '../../contexts/ModeContext'

type IconName = 'today' | 'inventory-2' | 'person'

function TabIcon({ icon, label, focused, isElder }: { icon: IconName; label: string; focused: boolean; isElder: boolean }) {
  const iconSize = isElder ? 32 : 24
  const labelSize = isElder ? 13 : 10
  return (
    <View style={styles.tabItem}>
      <MaterialIcons
        name={icon}
        size={iconSize}
        color={focused ? Colors.primary : Colors.textMuted}
      />
      <Text style={[
        styles.tabLabel,
        { fontSize: labelSize },
        focused && styles.tabLabelActive,
      ]}>{label}</Text>
    </View>
  )
}

export default function TabsLayout() {
  const { isElder } = useMode()
  const tabBarHeight = isElder ? 96 : 72

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: tabBarHeight }],
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="today" label="今天" focused={focused} isElder={isElder} />
          ),
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="inventory-2" label="药盒" focused={focused} isElder={isElder} />
          ),
        }}
      />
      {/* History tab hidden from tab bar but still routable */}
      <Tabs.Screen
        name="history"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="person" label="我的" focused={focused} isElder={isElder} />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingBottom: 12,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
})
