/**
 * Voice recognition service using iFlytek (科大讯飞) WebSocket API
 * and intent parsing for medication management commands.
 *
 * Set MOCK_MODE = false and provide real iFlytek credentials to enable
 * actual speech recognition.
 */

import type { Medication, HealthType } from './types'

// ── Config ──────────────────────────────────────────────────────────

export const MOCK_MODE = true

export interface IFlytekConfig {
  appId: string
  apiKey: string
  apiSecret: string
}

// Default mock config (replace with real credentials)
export const DEFAULT_CONFIG: IFlytekConfig = {
  appId: 'YOUR_APP_ID',
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
}

// ── Intent Types ────────────────────────────────────────────────────

export type VoiceIntent =
  | { type: 'ADD_MED'; name: string }
  | { type: 'ADD_HEALTH'; healthType: HealthType; value?: number }
  | { type: 'MARK_TAKEN'; medication: Medication }
  | { type: 'UNKNOWN'; rawText: string }

// ── Intent Parsing ──────────────────────────────────────────────────

const ADD_MED_PATTERNS = /(?:添加|加|新增|加上|录入)(.+?)(?:药|的|$)/
const HEALTH_PATTERNS: { pattern: RegExp; type: HealthType }[] = [
  { pattern: /血糖[是为]?\s*(\d+\.?\d*)/,  type: 'blood_sugar' },
  { pattern: /(?:记录|量|测)血糖/,          type: 'blood_sugar' },
  { pattern: /血压[是为]?\s*(\d+)[/\/](\d+)/, type: 'blood_pressure' },
  { pattern: /(?:记录|量|测)血压/,          type: 'blood_pressure' },
  { pattern: /体重[是为]?\s*(\d+\.?\d*)/,   type: 'weight' },
  { pattern: /(?:记录|量|称)体重/,          type: 'weight' },
]
const MARK_TAKEN_PATTERN = /(?:吃了|吃过|服了|服过|已吃)(.+)/

/**
 * Parse transcribed text into a structured intent.
 * Checks patterns in priority order: MARK_TAKEN > ADD_HEALTH > ADD_MED > UNKNOWN
 */
export function parseIntent(text: string, medications: Medication[]): VoiceIntent {
  const trimmed = text.trim()

  // 1. Check MARK_TAKEN — "吃了xxx"
  const takenMatch = trimmed.match(MARK_TAKEN_PATTERN)
  if (takenMatch) {
    const drugQuery = takenMatch[1].trim()
    const match = findMedication(drugQuery, medications)
    if (match) {
      return { type: 'MARK_TAKEN', medication: match }
    }
  }

  // 2. Check HEALTH — "血糖5.6" / "记录血压" / "体重70"
  for (const { pattern, type } of HEALTH_PATTERNS) {
    const m = trimmed.match(pattern)
    if (m) {
      const value = m[1] ? parseFloat(m[1]) : undefined
      return { type: 'ADD_HEALTH', healthType: type, value }
    }
  }

  // 3. Check ADD_MED — "添加阿莫西林"
  const addMatch = trimmed.match(ADD_MED_PATTERNS)
  if (addMatch) {
    return { type: 'ADD_MED', name: addMatch[1].trim() }
  }

  // 4. Fallback: try fuzzy match against medications for marking taken
  const fuzzy = findMedication(trimmed, medications)
  if (fuzzy) {
    return { type: 'MARK_TAKEN', medication: fuzzy }
  }

  return { type: 'UNKNOWN', rawText: trimmed }
}

function findMedication(query: string, medications: Medication[]): Medication | null {
  if (!query) return null
  // Exact substring match
  const exact = medications.find(m => query.includes(m.name) || m.name.includes(query))
  if (exact) return exact
  // Single-char fuzzy: at least 2 chars match
  if (query.length >= 2) {
    for (const m of medications) {
      let matchCount = 0
      for (const ch of query) {
        if (m.name.includes(ch)) matchCount++
      }
      if (matchCount >= Math.min(2, m.name.length)) return m
    }
  }
  return null
}

// ── iFlytek WebSocket Transcription ─────────────────────────────────

/**
 * Generate the authenticated iFlytek WebSocket URL.
 * Uses HMAC-SHA256 signature per iFlytek's specification.
 */
export function createIFlytekUrl(_config: IFlytekConfig): string {
  // In production, this would generate the signed URL.
  // For now, return a placeholder — real implementation requires
  // crypto HMAC-SHA256 which needs expo-crypto or a native module.
  return 'wss://iat-api.xfyun.cn/v2/iat'
}

/**
 * Transcribe audio to text.
 * In MOCK_MODE, returns a sample transcription string.
 * In production, streams audio chunks to iFlytek WebSocket and collects results.
 */
export async function transcribe(
  _audioUri: string,
  _config: IFlytekConfig = DEFAULT_CONFIG,
): Promise<string> {
  if (MOCK_MODE) {
    // Simulate processing delay
    await new Promise(r => setTimeout(r, 1500))
    // Return a demo string for testing
    const demos = [
      '吃了布洛芬',
      '添加阿莫西林',
      '血糖5.6',
      '记录血压',
      '体重65.5',
    ]
    return demos[Math.floor(Math.random() * demos.length)]
  }

  // TODO: Real iFlytek WebSocket implementation
  // 1. Read audio file from _audioUri
  // 2. Open WebSocket to createIFlytekUrl(_config)
  // 3. Send first frame with { common, business, data } params
  // 4. Send audio data in 1280-byte chunks with 40ms interval
  // 5. Send last frame with status=2
  // 6. Collect ws.onmessage results, concat text
  // 7. Return final transcription

  throw new Error('Real iFlytek transcription not yet implemented. Set MOCK_MODE = true.')
}

// ── Recording Helpers ───────────────────────────────────────────────

/**
 * Audio recording configuration for iFlytek compatibility.
 * PCM 16kHz, 16-bit, mono channel.
 */
export const RECORDING_OPTIONS = {
  android: {
    extension: '.wav',
    outputFormat: 2, // THREE_GPP
    audioEncoder: 1, // AMR_NB (will be re-encoded)
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: '.wav',
    audioQuality: 127, // max
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
}
