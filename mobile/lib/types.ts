export type Frequency = 'daily' | 'twice_daily' | 'three_daily' | 'weekly' | 'as_needed' | 'cycle'

export type CycleType = 'none' | 'once' | 'monthly' | 'custom'

export type LogStatus = 'pending' | 'taken' | 'skipped' | 'missed'

export interface Medication {
  id: string
  user_id: string
  name: string
  dosage: string | null
  unit: string
  frequency: Frequency
  photo_url: string | null
  barcode: string | null
  expiry_date: string | null
  illness: string | null       // 治疗病症，如 "感冒"、"高血压"
  usage_note: string | null    // 服用方式，如 "饭后服用"、"空腹服用"
  notes: string | null
  color: string
  is_active: boolean
  // Cycle fields
  cycle_type: CycleType
  cycle_start_day: number | null    // 月循环开始日 (1-31)
  cycle_end_day: number | null      // 月循环结束日 (1-31)
  cycle_active_days: number | null  // 自定义循环：吃药天数
  cycle_rest_days: number | null    // 自定义循环：停药天数
  cycle_start_date: string | null   // 疗程起始日期
  cycle_end_date: string | null     // 单次疗程结束日期
  created_at: string
  updated_at: string
}

export interface Schedule {
  id: string
  medication_id: string
  user_id: string
  time_of_day: string // 'HH:mm'
  days_of_week: number[] // 0=Sun, 6=Sat
  enabled: boolean
  notification_id: string | null
  created_at: string
}

export interface MedicationLog {
  id: string
  user_id: string
  medication_id: string
  schedule_id: string | null
  scheduled_date: string // 'YYYY-MM-DD'
  scheduled_time: string // 'HH:mm'
  status: LogStatus
  taken_at: string | null
  created_at: string
}

// Joined types for display
export interface MedicationWithSchedules extends Medication {
  schedules: Schedule[]
}

export interface TodayItem {
  log: MedicationLog
  medication: Medication
  schedule: Schedule | null
}

// Health data types
export type HealthType = 'blood_sugar' | 'blood_pressure' | 'weight'

export interface HealthRecord {
  id: string
  user_id: string
  type: HealthType
  value1: number         // 血糖值 / 收缩压 / 体重
  value2: number | null  // 舒张压（仅血压）
  unit: string           // mmol/L, mmHg, kg
  measured_at: string
  notes: string | null
  source: 'manual' | 'screenshot'
  created_at: string
}

// Family types
export type FamilyRole = 'owner' | 'member' | 'viewer'

export interface Family {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export interface FamilyMember {
  id: string
  family_id: string
  user_id: string
  role: FamilyRole
  nickname: string | null
  joined_at: string
}

export interface FamilyMemberWithEmail extends FamilyMember {
  email?: string
}
