export function businessToday(now: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addBusinessDays(isoDate: string, days: number) {
  return new Date(Date.parse(isoDate + 'T00:00:00Z') + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
