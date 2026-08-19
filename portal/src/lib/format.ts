export function localDateString(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatLateMinutes(minutes: number | null | undefined): string {
  if (!minutes) return 'On time'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '—'
  return new Date(timeStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatHours(hours: number | string | null | undefined): string {
  if (hours == null) return '—'
  const num = typeof hours === 'string' ? parseFloat(hours) : hours
  return `${isNaN(num) ? 0 : num.toFixed(2)}h`
}

export function formatWage(wage: number | string | null | undefined): string {
  if (wage == null) return '—'
  const num = typeof wage === 'string' ? parseFloat(wage) : wage
  return `${(isNaN(num) ? 0 : num).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`
}

export function formatBreaks(count: number, minutes: number | null | undefined): string {
  if (!count && !minutes) return '0'
  if (minutes == null || minutes === 0) return String(count)
  return `${count} (${minutes}m)`
}

export function formatReportDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
