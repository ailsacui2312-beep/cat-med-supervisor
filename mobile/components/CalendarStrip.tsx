import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameDay, isSameMonth, addMonths, subMonths, isAfter,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { MaterialIcons } from '@expo/vector-icons'
import { Colors } from '../constants/colors'
import { useMode } from '../contexts/ModeContext'

interface CalendarStripProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function CalendarStrip({
  selectedDate,
  onSelectDate,
}: CalendarStripProps) {
  const { isElder, s } = useMode()
  const [viewMonth, setViewMonth] = useState(new Date())

  const today = new Date()
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calStart = startOfWeek(monthStart) // Sunday
  const calEnd = endOfWeek(monthEnd)

  // Build 6-week grid of dates
  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  const cellSize = isElder ? 44 : 36

  return (
    <View style={[styles.container, { marginHorizontal: s(16), borderRadius: s(16), padding: s(12) }]}>
      {/* Month nav */}
      <View style={styles.monthRow}>
        <TouchableOpacity onPress={() => setViewMonth(subMonths(viewMonth, 1))} style={styles.navBtn}>
          <MaterialIcons name="chevron-left" size={s(22)} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.monthText, { fontSize: s(16) }]}>
          {format(viewMonth, 'yyyy年M月', { locale: zhCN })}
        </Text>
        <TouchableOpacity onPress={() => setViewMonth(addMonths(viewMonth, 1))} style={styles.navBtn}>
          <MaterialIcons name="chevron-right" size={s(22)} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map(wd => (
          <View key={wd} style={[styles.cell, { width: cellSize, height: s(24) }]}>
            <Text style={[styles.weekdayText, { fontSize: s(11) }]}>{wd}</Text>
          </View>
        ))}
      </View>

      {/* Date grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map(d => {
            const isCurrentMonth = isSameMonth(d, viewMonth)
            const isSelected = isSameDay(d, selectedDate)
            const isToday = isSameDay(d, today)
            const isFuture = isAfter(d, today)

            return (
              <TouchableOpacity
                key={d.toISOString()}
                style={[
                  styles.cell,
                  { width: cellSize, height: cellSize, borderRadius: cellSize / 2 },
                  isSelected && styles.cellSelected,
                  isToday && !isSelected && styles.cellToday,
                ]}
                onPress={() => !isFuture && onSelectDate(d)}
                disabled={isFuture}
                activeOpacity={0.6}
              >
                <Text style={[
                  styles.dayText,
                  { fontSize: s(14) },
                  !isCurrentMonth && styles.dayTextOther,
                  isSelected && styles.dayTextSelected,
                  isToday && !isSelected && styles.dayTextToday,
                  isFuture && styles.dayTextFuture,
                ]}>
                  {format(d, 'd')}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      ))}

      {/* Quick jump to today */}
      {!isSameDay(selectedDate, today) && (
        <TouchableOpacity
          style={[styles.todayBtn, { borderRadius: s(16), paddingVertical: s(6), paddingHorizontal: s(14) }]}
          onPress={() => {
            setViewMonth(today)
            onSelectDate(today)
          }}
        >
          <MaterialIcons name="today" size={s(14)} color={Colors.primary} />
          <Text style={[styles.todayBtnText, { fontSize: s(12) }]}>回到今天</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  navBtn: {
    padding: 4,
  },
  monthText: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 2,
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellSelected: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cellToday: {
    backgroundColor: Colors.primary + '15',
  },
  weekdayText: {
    color: Colors.textMuted,
    fontWeight: '600',
  },
  dayText: {
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  dayTextOther: {
    color: Colors.textMuted + '60',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  dayTextToday: {
    color: Colors.primary,
    fontWeight: '700',
  },
  dayTextFuture: {
    color: Colors.textMuted + '40',
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: Colors.primary + '10',
    alignSelf: 'center',
  },
  todayBtnText: {
    color: Colors.primary,
    fontWeight: '600',
  },
})
