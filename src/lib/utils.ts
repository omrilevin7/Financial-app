export function normalizeBusinessName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^֐-׿a-z0-9\s*./\\-]/g, '')  // keep Hebrew, alphanumeric, common punctuation
    .trim()
}

export function formatCurrency(agorot: number): string {
  const shekel = agorot / 100
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(shekel)
}

export function formatMonth(yyyymm: string): string {
  const [year, month] = yyyymm.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getMonthFromDate(date: string): string {
  return date.substring(0, 7)  // YYYY-MM
}

export function daysInMonth(yyyymm: string): number {
  const [year, month] = yyyymm.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

export function dayOfMonth(date: string): number {
  return new Date(date).getDate()
}
