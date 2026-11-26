const timeZone = 'Asia/Ho_Chi_Minh';
const dayMs = 24 * 60 * 60 * 1000;
const groupGapMs = 15 * 60 * 1000;
const isoTimestamp = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

const dayFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const clockFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const exactFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function parseTimestamp(value: string) {
  const match = isoTimestamp.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthEnd = new Date(0);
  monthEnd.setUTCFullYear(year, month, 0);
  if (day > monthEnd.getUTCDate()) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function localDay(date: Date) {
  const parts = dayFormat.formatToParts(date);
  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((entry) => entry.type === type)!.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  // Count calendar days after projecting to Vietnam time, regardless of the host zone.
  const utcDay = new Date(0);
  utcDay.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  return { year, short: `${day}/${month}`, index: utcDay.getTime() / dayMs };
}

export function getChatTimestamp(value: string, now: Date) {
  const date = parseTimestamp(value);
  if (!date || !Number.isFinite(now.getTime())) return undefined;

  const sent = localDay(date);
  const today = localDay(now);
  const clock = clockFormat.format(date);
  const localDate = today.year === sent.year ? sent.short : `${sent.short}/${sent.year}`;
  const daysAgo = today.index - sent.index;
  const label = daysAgo === 0 ? 'Hôm nay' : daysAgo === 1 ? 'Hôm qua' : localDate;
  const minutesAgo = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  const relative = minutesAgo < 1
    ? 'Vừa gửi'
    : minutesAgo < 60
      ? `Đã gửi ${minutesAgo} phút trước`
      : minutesAgo < 24 * 60
        ? `Đã gửi ${Math.floor(minutesAgo / 60)} giờ trước`
        : `${label}, ${clock}`;
  return {
    dateTime: date.toISOString(),
    exact: exactFormat.format(date),
    clock,
    timeline: `${label}, ${clock}`,
    dayLabel: label,
    inbox: daysAgo === 0 ? clock : label,
    relative,
  };
}

export function startsChatDayGroup(previous: string | undefined, current: string) {
  const date = parseTimestamp(current);
  if (!date) return false;
  const priorDate = previous === undefined ? undefined : parseTimestamp(previous);
  return !priorDate || localDay(priorDate).index !== localDay(date).index;
}

export function startsChatTimeGroup(previous: string | undefined, current: string) {
  const date = parseTimestamp(current);
  if (!date) return false;
  const priorDate = previous === undefined ? undefined : parseTimestamp(previous);
  return (
    !priorDate ||
    date.getTime() - priorDate.getTime() >= groupGapMs ||
    localDay(priorDate).index !== localDay(date).index
  );
}
