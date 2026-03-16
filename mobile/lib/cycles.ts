import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Medication } from './types'

/**
 * 判断给定日期是否在药品的周期「活跃期」内
 * 非周期药品（cycle_type = 'none'）始终返回 true
 */
export function isInActivePeriod(medication: Medication, date: Date): boolean {
  const { cycle_type } = medication
  if (!cycle_type || cycle_type === 'none') return true

  if (cycle_type === 'once') {
    return isInOnceRange(medication, date)
  }
  if (cycle_type === 'monthly') {
    return isInMonthlyRange(medication, date)
  }
  if (cycle_type === 'custom') {
    return isInCustomCycle(medication, date)
  }

  return true
}

/** 单次疗程：cycle_start_date ~ cycle_end_date */
function isInOnceRange(med: Medication, date: Date): boolean {
  if (!med.cycle_start_date) return true
  const start = parseISO(med.cycle_start_date)
  if (date < start) return false
  if (med.cycle_end_date) {
    const end = parseISO(med.cycle_end_date)
    if (date > end) return false
  }
  return true
}

/** 每月重复：每月第 cycle_start_day 到 cycle_end_day */
function isInMonthlyRange(med: Medication, date: Date): boolean {
  if (med.cycle_start_day == null || med.cycle_end_day == null) return true
  const dayOfMonth = date.getDate()

  if (med.cycle_start_day <= med.cycle_end_day) {
    // 正常范围，如 1~21
    return dayOfMonth >= med.cycle_start_day && dayOfMonth <= med.cycle_end_day
  } else {
    // 跨月范围，如 25~5（本月25到下月5号）
    return dayOfMonth >= med.cycle_start_day || dayOfMonth <= med.cycle_end_day
  }
}

/** 自定义循环：吃 N 天停 M 天 */
function isInCustomCycle(med: Medication, date: Date): boolean {
  if (!med.cycle_start_date || !med.cycle_active_days || !med.cycle_rest_days) return true

  const start = parseISO(med.cycle_start_date)
  const daysSinceStart = differenceInCalendarDays(date, start)
  if (daysSinceStart < 0) return false

  const cycleLength = med.cycle_active_days + med.cycle_rest_days
  const positionInCycle = daysSinceStart % cycleLength
  return positionInCycle < med.cycle_active_days
}

/**
 * 获取周期药品的显示信息
 * 返回如："服用中（第 5/21 天）" 或 "停药中（还有 3 天恢复）"
 */
export function getCycleStatusText(medication: Medication, date: Date): string | null {
  const { cycle_type } = medication
  if (!cycle_type || cycle_type === 'none') return null

  if (cycle_type === 'once') {
    if (!medication.cycle_start_date) return null
    const start = parseISO(medication.cycle_start_date)
    const daysSinceStart = differenceInCalendarDays(date, start)
    if (daysSinceStart < 0) return '尚未开始'
    if (medication.cycle_end_date) {
      const end = parseISO(medication.cycle_end_date)
      const totalDays = differenceInCalendarDays(end, start) + 1
      if (date > end) return '疗程已结束'
      return `疗程第 ${daysSinceStart + 1}/${totalDays} 天`
    }
    return `第 ${daysSinceStart + 1} 天`
  }

  if (cycle_type === 'monthly') {
    if (medication.cycle_start_day == null || medication.cycle_end_day == null) return null
    const dayOfMonth = date.getDate()
    const isActive = isInActivePeriod(medication, date)
    if (isActive) {
      const dayInPeriod = dayOfMonth - medication.cycle_start_day + 1
      const totalDays = medication.cycle_end_day - medication.cycle_start_day + 1
      return `每月${medication.cycle_start_day}-${medication.cycle_end_day}日 · 第 ${dayInPeriod}/${totalDays} 天`
    } else {
      // 计算距离下次开始还有多少天
      let daysUntilNext: number
      if (dayOfMonth > medication.cycle_end_day) {
        // 本月已过，等下月
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
        daysUntilNext = daysInMonth - dayOfMonth + medication.cycle_start_day
      } else {
        daysUntilNext = medication.cycle_start_day - dayOfMonth
      }
      return `停药中（${daysUntilNext} 天后恢复）`
    }
  }

  if (cycle_type === 'custom') {
    if (!medication.cycle_start_date || !medication.cycle_active_days || !medication.cycle_rest_days) return null
    const start = parseISO(medication.cycle_start_date)
    const daysSinceStart = differenceInCalendarDays(date, start)
    if (daysSinceStart < 0) return '尚未开始'
    const cycleLength = medication.cycle_active_days + medication.cycle_rest_days
    const positionInCycle = daysSinceStart % cycleLength
    if (positionInCycle < medication.cycle_active_days) {
      return `吃${medication.cycle_active_days}停${medication.cycle_rest_days} · 第 ${positionInCycle + 1}/${medication.cycle_active_days} 天`
    } else {
      const restPosition = positionInCycle - medication.cycle_active_days
      const daysUntilNext = medication.cycle_rest_days - restPosition
      return `停药中（${daysUntilNext} 天后恢复）`
    }
  }

  return null
}
