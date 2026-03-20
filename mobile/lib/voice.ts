/**
 * Voice recognition service using iFlytek (科大讯飞) dialect model WebSocket API
 * and intent parsing for medication management commands.
 */

import type { Medication, HealthType } from './types'
import { File as ExpoFile } from 'expo-file-system'
import CryptoJS from 'crypto-js'
import { inferIntent as llmInferIntent, isDeepSeekEnabled, type ChatMessage, type LLMIntentResult } from './deepseek'

// ── Config ──────────────────────────────────────────────────────────

export const MOCK_MODE = false

export interface IFlytekConfig {
  appId: string
  apiKey: string
  apiSecret: string
}

export const DEFAULT_CONFIG: IFlytekConfig = {
  appId: process.env.EXPO_PUBLIC_IFLYTEK_APP_ID || '',
  apiKey: process.env.EXPO_PUBLIC_IFLYTEK_API_KEY || '',
  apiSecret: process.env.EXPO_PUBLIC_IFLYTEK_API_SECRET || '',
}

// ── Intent Types ────────────────────────────────────────────────────

export type VoiceIntent =
  | { type: 'ADD_MED'; name: string; dosage?: string; frequency?: string; usage_note?: string; illness?: string }
  | { type: 'ADD_HEALTH'; healthType: HealthType; value?: number }
  | { type: 'MARK_TAKEN'; medication: Medication }
  | { type: 'ASK'; message: string; history: ChatMessage[] }
  | { type: 'UNKNOWN'; rawText: string }

export type { ChatMessage } from './deepseek'

// ── Intent Parsing ──────────────────────────────────────────────────

// Patterns for "mark taken" — 吃了/要吃/已服用/刚吃 etc.
const MARK_TAKEN_PATTERNS = [
  /(?:吃了|吃过了?|服了|服过了?|已吃|已服|刚吃了?|刚服了?)(?:药)?[，,]?\s*(.+)/,
  /(?:我|已经)?(?:吃了|吃过|服了|服过)(.+)/,
]

// Patterns for "want to take / need to take" — 我要吃/该吃/帮我记录吃
const WANT_TAKE_PATTERNS = [
  /(?:我?要吃|我?想吃|我?该吃|帮我?记录?吃|我吃了?|我在吃)(.+)/,
]

// Explicit "add medication" — 添加/加/新增/录入
const ADD_MED_PATTERNS = [
  /(?:添加|加|新增|加上|录入|帮我加|帮我添加|我要加|我要添加)(.+?)(?:药)?$/,
]

const HEALTH_PATTERNS: { pattern: RegExp; type: HealthType }[] = [
  { pattern: /血糖[是为]?\s*(\d+\.?\d*)/, type: 'blood_sugar' },
  { pattern: /(?:记录|量|测|查)血糖/, type: 'blood_sugar' },
  { pattern: /血压[是为]?\s*(\d+)[/\/](\d+)/, type: 'blood_pressure' },
  { pattern: /(?:记录|量|测|查)血压/, type: 'blood_pressure' },
  { pattern: /体重[是为]?\s*(\d+\.?\d*)/, type: 'weight' },
  { pattern: /(?:记录|量|称|查)体重/, type: 'weight' },
]

/**
 * Clean up transcribed text — remove punctuation, whitespace, filler words
 */
function cleanText(text: string): string {
  return text
    .replace(/[。，、！？,.!?;；：:""''「」（）\(\)\s]+/g, '')
    .replace(/^(嗯|呃|那个|就是|然后|啊)+/, '')
    .trim()
}

/**
 * Parse transcribed text into a structured intent.
 * Handles natural speech like "我要吃布洛芬，每天早上8点吃一粒"
 */
export function parseIntent(text: string, medications: Medication[]): VoiceIntent {
  const trimmed = text.trim()
  const cleaned = cleanText(trimmed)

  // 1. HEALTH — "血糖5.6" / "记录血压" / "体重70" (check first, very specific)
  for (const { pattern, type } of HEALTH_PATTERNS) {
    const m = trimmed.match(pattern)
    if (m) {
      const value = m[1] ? parseFloat(m[1]) : undefined
      return { type: 'ADD_HEALTH', healthType: type, value }
    }
  }

  // 2. MARK_TAKEN — explicit past tense: "吃了布洛芬" / "已经服过了"
  for (const pat of MARK_TAKEN_PATTERNS) {
    const m = cleaned.match(pat) || trimmed.match(pat)
    if (m) {
      const drugQuery = cleanText(m[1])
      const match = findMedication(drugQuery, medications)
      if (match) return { type: 'MARK_TAKEN', medication: match }
    }
  }

  // 3. Explicit ADD — "添加阿莫西林" / "帮我加布洛芬"
  for (const pat of ADD_MED_PATTERNS) {
    const m = cleaned.match(pat) || trimmed.match(pat)
    if (m) {
      const name = cleanText(m[1])
      if (name.length > 0) return { type: 'ADD_MED', name }
    }
  }

  // 4. "我要吃xxx" / "我想吃xxx" — if med exists → MARK_TAKEN, else → ADD_MED
  for (const pat of WANT_TAKE_PATTERNS) {
    const m = cleaned.match(pat) || trimmed.match(pat)
    if (m) {
      const drugQuery = cleanText(m[1])
      // If user's medication list contains this, it's "mark taken"
      const existing = findMedication(drugQuery, medications)
      if (existing) return { type: 'MARK_TAKEN', medication: existing }
      // Otherwise treat as "add new medication"
      const name = extractMedName(drugQuery)
      if (name.length > 0) return { type: 'ADD_MED', name }
    }
  }

  // 5. Last resort: fuzzy match entire text against existing medications
  const fuzzy = findMedication(cleaned, medications)
  if (fuzzy) return { type: 'MARK_TAKEN', medication: fuzzy }

  // 6. If text contains known drug-like words, treat as ADD_MED
  const medName = extractMedName(cleaned)
  if (medName.length >= 2) return { type: 'ADD_MED', name: medName }

  return { type: 'UNKNOWN', rawText: trimmed }
}

/**
 * Extract medication name from a longer phrase.
 * Strips common trailing phrases like "每天...", "一天...", "一粒", "一片" etc.
 */
function extractMedName(text: string): string {
  // Remove scheduling/dosage suffixes
  return text
    .replace(/[，,].*/g, '') // everything after first comma
    .replace(/每[天日].*$/, '')
    .replace(/一[天日].*$/, '')
    .replace(/[早中晚]上?.*$/, '')
    .replace(/(\d+)[点时].*$/, '')
    .replace(/吃?\d*[粒片颗包支瓶盒杯勺袋].*$/, '')
    .replace(/的?药?$/, '')
    .trim()
}

function findMedication(query: string, medications: Medication[]): Medication | null {
  if (!query) return null
  const exact = medications.find(m => query.includes(m.name) || m.name.includes(query))
  if (exact) return exact
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

// ── Smart Intent Parsing (DeepSeek LLM) ─────────────────────────────

/**
 * Smart intent parsing: tries DeepSeek LLM first, falls back to regex.
 * Supports multi-turn conversation via history parameter.
 */
export async function smartParseIntent(
  text: string,
  medications: Medication[],
  history?: ChatMessage[],
): Promise<VoiceIntent> {
  // If DeepSeek is not configured, fall back to regex
  if (!isDeepSeekEnabled()) {
    return parseIntent(text, medications)
  }

  try {
    const result = await llmInferIntent(text, medications, history)
    return llmResultToIntent(result, medications, text, history)
  } catch (err: any) {
    console.warn('DeepSeek failed, falling back to regex:', err.message)
    // If it's a config error, just use regex silently
    if (err.message === 'DEEPSEEK_API_KEY_NOT_SET') {
      return parseIntent(text, medications)
    }
    // For other errors, still try regex
    return parseIntent(text, medications)
  }
}

/**
 * Convert LLM result to VoiceIntent, resolving medication references.
 */
function llmResultToIntent(
  result: LLMIntentResult,
  medications: Medication[],
  rawText: string,
  history?: ChatMessage[],
): VoiceIntent {
  switch (result.action) {
    case 'ADD_MED':
      if (!result.name) {
        return {
          type: 'ASK',
          message: result.message || '喵～主人想加什么药呢？告诉小猫药名就好啦🐾',
          history: buildHistory(history, rawText, result),
        }
      }
      return {
        type: 'ADD_MED',
        name: result.name,
        dosage: result.dosage,
        frequency: result.frequency,
        usage_note: result.usage_note,
        illness: result.illness,
      }

    case 'ADD_HEALTH': {
      const healthType = result.healthType as HealthType
      if (!healthType || !['blood_sugar', 'blood_pressure', 'weight'].includes(healthType)) {
        return {
          type: 'ASK',
          message: result.message || '喵？主人想记录血糖、血压还是体重呀？🐱',
          history: buildHistory(history, rawText, result),
        }
      }
      return {
        type: 'ADD_HEALTH',
        healthType,
        value: result.healthValue,
      }
    }

    case 'MARK_TAKEN': {
      const medName = result.medicationName || ''
      const med = findMedication(medName, medications)
      if (!med) {
        return {
          type: 'ASK',
          message: result.message || `喵呜，小猫在药盒里没找到「${medName}」呢～主人确定是这个名字吗？😺`,
          history: buildHistory(history, rawText, result),
        }
      }
      return { type: 'MARK_TAKEN', medication: med }
    }

    case 'ASK':
      return {
        type: 'ASK',
        message: result.message || '喵～小猫没太听懂，主人能再说一遍吗？🐾',
        history: buildHistory(history, rawText, result),
      }

    default:
      return { type: 'UNKNOWN', rawText }
  }
}

/**
 * Build conversation history for multi-turn dialogue.
 */
function buildHistory(
  prevHistory: ChatMessage[] | undefined,
  userText: string,
  assistantResult: LLMIntentResult,
): ChatMessage[] {
  const history: ChatMessage[] = prevHistory ? [...prevHistory] : []
  history.push({ role: 'user', content: userText })
  history.push({
    role: 'assistant',
    content: JSON.stringify(assistantResult),
  })
  return history
}

// ── iFlytek WebSocket Transcription ─────────────────────────────────

/**
 * Generate the authenticated iFlytek WebSocket URL using HMAC-SHA256.
 * Per iFlytek IAT API specification.
 */
function createIFlytekUrl(config: IFlytekConfig): string {
  const host = 'iat-api.xfyun.cn'
  const path = '/v2/iat'
  const date = new Date().toUTCString()

  // Build signature origin string per iFlytek spec
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`

  // HMAC-SHA256 sign with API Secret
  const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, config.apiSecret)
  const signature = CryptoJS.enc.Base64.stringify(signatureSha)

  // Build authorization header
  const authorizationOrigin =
    `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = CryptoJS.enc.Base64.stringify(
    CryptoJS.enc.Utf8.parse(authorizationOrigin)
  )

  // Encode URL params
  const dateEncoded = encodeURIComponent(date)
  const hostEncoded = encodeURIComponent(host)
  const authEncoded = encodeURIComponent(authorization)

  return `wss://${host}${path}?authorization=${authEncoded}&date=${dateEncoded}&host=${hostEncoded}`
}

/**
 * Convert Uint8Array chunk to base64 string using CryptoJS.
 */
function uint8ToBase64(bytes: Uint8Array): string {
  // Build a CryptoJS WordArray from the byte array
  const words: number[] = []
  for (let i = 0; i < bytes.length; i += 4) {
    words.push(
      ((bytes[i] || 0) << 24) |
      ((bytes[i + 1] || 0) << 16) |
      ((bytes[i + 2] || 0) << 8) |
      (bytes[i + 3] || 0)
    )
  }
  const wordArray = CryptoJS.lib.WordArray.create(words, bytes.length)
  return CryptoJS.enc.Base64.stringify(wordArray)
}

/**
 * Transcribe audio to text using iFlytek dialect model WebSocket API.
 * Records as PCM 16kHz mono, streams in 1280-byte frames.
 */
export async function transcribe(
  audioUri: string,
  config: IFlytekConfig = DEFAULT_CONFIG,
): Promise<string> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 1500))
    const demos = ['吃了布洛芬', '添加阿莫西林', '血糖5.6', '记录血压', '体重65.5']
    return demos[Math.floor(Math.random() * demos.length)]
  }

  if (!config.appId || !config.apiKey || !config.apiSecret) {
    throw new Error('讯飞API密钥未配置')
  }

  // Read audio file as ArrayBuffer
  const file = new ExpoFile(audioUri)
  const audioBuffer = await file.arrayBuffer()
  const audioBytes = new Uint8Array(audioBuffer)

  // Generate authenticated WebSocket URL
  const wsUrl = createIFlytekUrl(config)

  return new Promise<string>((resolve, reject) => {
    let settled = false
    const ws = new WebSocket(wsUrl)
    let fullText = ''
    let frameIndex = 0
    const FRAME_SIZE = 1280 // 40ms of 16kHz 16bit mono PCM

    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true
        fn()
      }
    }

    ws.onopen = () => {
      sendNextFrame()
    }

    function sendNextFrame() {
      const totalFrames = Math.ceil(audioBytes.length / FRAME_SIZE)
      const isFirst = frameIndex === 0
      const isLast = frameIndex >= totalFrames

      // Determine audio chunk
      let chunkBase64 = ''
      if (!isLast) {
        const start = frameIndex * FRAME_SIZE
        const end = Math.min(start + FRAME_SIZE, audioBytes.length)
        const chunk = audioBytes.slice(start, end)
        chunkBase64 = uint8ToBase64(chunk)
      }

      const frame: any = {
        data: {
          status: isLast ? 2 : (isFirst ? 0 : 1),
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: chunkBase64,
        },
      }

      // First frame includes common + business params
      if (isFirst) {
        frame.common = { app_id: config.appId }
        frame.business = {
          language: 'zh_cn',
          domain: 'iat',
          accent: 'mandarin',   // Dialect model auto-detects variants
          vad_eos: 3000,        // 3s end-of-speech silence timeout
          dwa: 'wpgs',          // Dynamic correction enabled
        }
      }

      ws.send(JSON.stringify(frame))
      frameIndex++

      if (!isLast) {
        // 40ms interval between frames
        setTimeout(sendNextFrame, 40)
      }
    }

    ws.onmessage = (event) => {
      try {
        const resp = JSON.parse(event.data as string)

        if (resp.code !== 0) {
          ws.close()
          settle(() => reject(new Error(`讯飞错误 [${resp.code}]: ${resp.message || '未知'}`)))
          return
        }

        // Extract recognized text from response
        const wsArr = resp.data?.result?.ws
        if (wsArr && Array.isArray(wsArr)) {
          for (const w of wsArr) {
            if (w.cw && Array.isArray(w.cw)) {
              for (const cw of w.cw) {
                if (cw.w) fullText += cw.w
              }
            }
          }
        }

        // Final response
        if (resp.data?.status === 2) {
          ws.close()
          const result = fullText.trim()
          settle(() => {
            if (result) {
              resolve(result)
            } else {
              reject(new Error('未识别到语音内容，请重试'))
            }
          })
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    ws.onerror = (e: any) => {
      settle(() => reject(new Error('连接讯飞服务失败: ' + (e.message || '网络错误'))))
    }

    ws.onclose = () => {
      // If connection closed before getting result
      settle(() => {
        if (fullText.trim()) {
          resolve(fullText.trim())
        } else {
          reject(new Error('连接已关闭，未获取到识别结果'))
        }
      })
    }

    // 15s timeout
    setTimeout(() => {
      try { ws.close() } catch {}
      settle(() => reject(new Error('识别超时，请重试')))
    }, 15000)
  })
}

// ── Recording Config for iFlytek ────────────────────────────────────

/**
 * PCM 16kHz, 16-bit, mono — required by iFlytek IAT API.
 */
export const RECORDING_OPTIONS = {
  android: {
    extension: '.wav',
    outputFormat: 2,
    audioEncoder: 1,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: '.wav',
    audioQuality: 127,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
}
