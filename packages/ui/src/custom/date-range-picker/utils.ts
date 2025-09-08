import { subDays, subHours } from 'date-fns';
import type { DateRange } from 'react-day-picker';

export function calculateQuickSelectRange(
  value: string,
): DateRange | undefined {
  const now = new Date();
  let from: Date;

  switch (value) {
    case 'Last hour':
      from = subHours(now, 1);
      break;
    case 'Last 6 hours':
      from = subHours(now, 6);
      break;
    case 'Last 12 hours':
      from = subHours(now, 12);
      break;
    case 'Last 24 hours':
      from = subHours(now, 24);
      break;
    case 'Last 3 days':
      from = subDays(now, 3);
      break;
    case 'Last 7 days':
      from = subDays(now, 7);
      break;
    case 'Last 14 days':
      from = subDays(now, 14);
      break;
    case 'Last 30 days':
      from = subDays(now, 30);
      break;
    default:
      return undefined;
  }

  return { from, to: now };
}

export function getInitialDateRange(
  dateRange?: DateRange,
  dayCount?: number,
): DateRange | undefined {
  if (dateRange) {
    return dateRange;
  }
  if (dayCount) {
    const toDay = new Date();
    const fromDay = subDays(toDay, dayCount);
    return {
      from: fromDay,
      to: toDay,
    };
  }
  return undefined;
}
