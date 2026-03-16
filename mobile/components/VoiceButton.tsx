import { useEffect, useRef } from 'react'
import { TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { Colors } from '../constants/colors'
import { useMode } from '../contexts/ModeContext'

interface VoiceButtonProps {
  onPress: () => void
}

export default function VoiceButton({ onPress }: VoiceButtonProps) {
  const { isElder } = useMode()
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [])

  const size = isElder ? 72 : 56
  const iconSize = isElder ? 36 : 28
  const bottom = isElder ? 110 : 90

  return (
    <Animated.View style={[
      styles.wrapper,
      { bottom, right: 20, transform: [{ scale: pulseAnim }] },
    ]}>
      <TouchableOpacity
        style={[styles.button, { width: size, height: size, borderRadius: size / 2 }]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityLabel="语音输入"
        accessibilityRole="button"
      >
        <MaterialIcons name="mic" size={iconSize} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 100,
  },
  button: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
})
