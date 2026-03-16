import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type AppMode = 'elder' | 'normal'

interface ModeContextType {
  mode: AppMode | null
  modeLoaded: boolean
  isElder: boolean
  /** Scale a numeric value: ×1.0 in normal, ×1.4 in elder (fonts/spacing) */
  s: (size: number) => number
  /** Scale icon size: ×1.0 in normal, ×1.3 in elder */
  si: (size: number) => number
  setMode: (m: AppMode) => Promise<void>
}

const ModeContext = createContext<ModeContextType | null>(null)

const STORAGE_KEY = 'app_mode'

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode | null>(null)
  const [modeLoaded, setModeLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val === 'elder' || val === 'normal') {
        setModeState(val)
      }
      setModeLoaded(true)
    }).catch(() => setModeLoaded(true))
  }, [])

  const isElder = mode === 'elder'

  const s = (size: number) => isElder ? Math.round(size * 1.4) : size
  const si = (size: number) => isElder ? Math.round(size * 1.3) : size

  const setMode = async (m: AppMode) => {
    setModeState(m)
    await AsyncStorage.setItem(STORAGE_KEY, m)
  }

  return (
    <ModeContext.Provider value={{ mode, modeLoaded, isElder, s, si, setMode }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode(): ModeContextType {
  const ctx = useContext(ModeContext)
  if (!ctx) {
    // Return safe defaults when outside provider (e.g. during initial load)
    return {
      mode: 'normal',
      modeLoaded: false,
      isElder: false,
      s: (size: number) => size,
      si: (size: number) => size,
      setMode: async () => {},
    }
  }
  return ctx
}
