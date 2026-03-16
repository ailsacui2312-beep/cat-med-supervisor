import { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useAuth } from '../hooks/useAuth'
import { View, StyleSheet } from 'react-native'
import { Colors } from '../constants/colors'
import { ModeProvider, useMode } from '../contexts/ModeContext'

SplashScreen.preventAutoHideAsync()

function RootNavigator() {
  const { user, loading } = useAuth()
  const { mode, modeLoaded } = useMode()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!loading && modeLoaded) {
      SplashScreen.hideAsync()
    }
  }, [loading, modeLoaded])

  useEffect(() => {
    if (loading || !modeLoaded) return

    const segs = segments as string[]
    const inAuthGroup = segs[0] === '(auth)'

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (user && inAuthGroup) {
      // User is logged in but in auth group — check mode selection
      if (mode === null && segs[1] !== 'mode-select') {
        router.replace('/(auth)/mode-select')
      } else if (mode !== null) {
        router.replace('/(tabs)')
      }
    }
  }, [user, loading, segments, mode, modeLoaded])

  if (loading || !modeLoaded) {
    return (
      <View style={styles.loading}>
        <StatusBar style="dark" />
      </View>
    )
  }

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  )
}

export default function RootLayout() {
  return (
    <ModeProvider>
      <RootNavigator />
    </ModeProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
