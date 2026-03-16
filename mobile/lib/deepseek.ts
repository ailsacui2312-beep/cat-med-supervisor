/**
 * DeepSeek Chat API client for smart voice intent parsing.
 * The AI acts as a cute cat assistant 🐱 that helps users manage medications.
 */

import type { Medication, HealthType } from './types'

// ── Config ──────────────────────────────────────────────────────────

const DEEPSEEK_BASE = 'https://api.deepseek.com'
const API_KEY = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || ''
const MODEL = 'deepseek-chat'
const TIMEOUT_MS = 15000

// ── Types ───────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMIntentResult {
  action: 'ADD_MED' | 'ADD_HEALTH' | 'MARK_TAKEN' | 'ASK'
  // ADD_MED fields
  name?: string
  dosage?: string
  frequency?: string
  usage_note?: string
  illness?: string
  // ADD_HEALTH fields
  healthType?: HealthType
  healthValue?: number
  // MARK_TAKEN fields
  medicationName?: string
  // ASK fields — cat persona follow-up question
  message?: string
}

// ── System Prompt ───────────────────────────────────────────────────

function buildSystemPrompt(medications: Medication[]): string {
  const medList = medications.map(m => ({
    name: m.name,
    illness: m.illness || '未知',
    dosage: m.dosage ? `${m.dosage} ${m.unit}` : m.unit,
    usage_note: m.usage_note || '',
    frequency: m.frequency,
  }))

  const medListStr = medList.length > 0
    ? JSON.stringify(medList, null, 2)
    : '[]（暂无药品）'

  return `你是「小猫吃药监督」App 里的小猫助手🐱。你性格可爱、温暖、关心主人的健康。
用户通过语音告诉你他们想做什么，你需要理解用户意图并返回结构化 JSON。

## 用户当前的药品列表
${medListStr}

## 你可以执行的操作

1. **ADD_MED** — 添加新药品到药盒
   返回: { "action": "ADD_MED", "name": "药名", "dosage": "剂量", "frequency": "频率", "usage_note": "服用方式", "illness": "治疗病症" }
   - frequency 可选值: daily, twice_daily, three_daily, weekly, as_needed, cycle
   - usage_note 例如: 饭后服用, 空腹服用, 睡前服用
   - 如果用户没提到的字段就不要包含

2. **ADD_HEALTH** — 记录健康数据
   返回: { "action": "ADD_HEALTH", "healthType": "类型", "healthValue": 数值 }
   - healthType 可选值: blood_sugar（血糖）, blood_pressure（血压）, weight（体重）
   - healthValue 是数字，如 5.6、130、65.5

3. **MARK_TAKEN** — 标记药品已服用
   返回: { "action": "MARK_TAKEN", "medicationName": "药名" }
   - medicationName 必须是用户药品列表中存在的药名

4. **ASK** — 信息不全，需要追问用户
   返回: { "action": "ASK", "message": "追问内容" }

## 重要规则

- 如果用户提到的药名**在列表中**存在（或近似匹配），优先理解为 MARK_TAKEN
- 如果用户说"吃了XX药"、"已经吃过了"，理解为 MARK_TAKEN
- 如果药名**不在列表中**，理解为 ADD_MED（添加新药品）
- 如果用户说"帮我记一下"但没说记什么，用 ASK 追问
- 如果用户提到血糖/血压/体重相关的话题，理解为 ADD_HEALTH
- 尽量从用户的话中提取所有有用信息（剂量、频率、服用方式等）

## ASK 追问的语气

当你需要追问时，请用小猫的可爱语气，加上 emoji：
- "喵～主人想加什么药呢？告诉小猫药名就好啦🐾"
- "喵呜，主人的血糖是多少呀？小猫帮你记下来～🐱"
- "喵？主人是要记录吃药还是添加新药呢？小猫有点没听清～😺"
- "喵喵，主人说的是哪种药呀？小猫在药盒里找找看🔍"

## 输出格式

必须返回**纯 JSON**，不要包含 markdown 代码块、解释或其他文字。
示例: {"action":"ADD_MED","name":"布洛芬","dosage":"1粒","frequency":"daily","usage_note":"饭后服用","illness":"感冒"}`
}

// ── API Call ────────────────────────────────────────────────────────

async function chat(messages: ChatMessage[]): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const resp = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 300,
      }),
      signal: controller.signal,
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      throw new Error(`DeepSeek API error ${resp.status}: ${errText}`)
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek returned empty response')
    return content.trim()
  } finally {
    clearTimeout(timer)
  }
}

// ── Intent Inference ────────────────────────────────────────────────

/**
 * Use DeepSeek LLM to infer user intent from transcribed voice text.
 * Supports multi-turn conversation via history parameter.
 */
export async function inferIntent(
  rawText: string,
  medications: Medication[],
  history?: ChatMessage[],
): Promise<LLMIntentResult> {
  if (!API_KEY) {
    throw new Error('DEEPSEEK_API_KEY_NOT_SET')
  }

  const systemMsg: ChatMessage = {
    role: 'system',
    content: buildSystemPrompt(medications),
  }

  // Build messages array
  const messages: ChatMessage[] = [systemMsg]

  // If there's conversation history, append it
  if (history && history.length > 0) {
    messages.push(...history)
  }

  // Add current user message
  messages.push({ role: 'user', content: rawText })

  const raw = await chat(messages)

  // Parse JSON response — handle potential markdown wrapping
  let jsonStr = raw
  // Strip markdown code blocks if present
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim()
  }

  try {
    const result = JSON.parse(jsonStr) as LLMIntentResult
    // Validate action field
    if (!['ADD_MED', 'ADD_HEALTH', 'MARK_TAKEN', 'ASK'].includes(result.action)) {
      throw new Error(`Invalid action: ${result.action}`)
    }
    return result
  } catch (parseErr) {
    console.warn('Failed to parse DeepSeek response as JSON:', raw)
    // If the response looks like a conversational reply, treat it as ASK
    if (raw.length > 0 && raw.length < 200) {
      return { action: 'ASK', message: raw }
    }
    throw new Error('AI 返回格式异常，请重试')
  }
}

/**
 * Check if DeepSeek API is configured.
 */
export function isDeepSeekEnabled(): boolean {
  return !!API_KEY
}
