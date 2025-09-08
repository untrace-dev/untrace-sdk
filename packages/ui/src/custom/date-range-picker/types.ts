import type { buttonVariants } from '@untrace/ui/button';
import type { PopoverContent } from '@untrace/ui/popover';
import type { VariantProps } from 'class-variance-authority';
import type { DateRange } from 'react-day-picker';

export type RelativeTime =
  | '1h'
  | '6h'
  | '12h'
  | '24h'
  | '3d'
  | '7d'
  | '14d'
  | '30d';

export interface DateRangePickerProps
  extends React.ComponentPropsWithoutRef<typeof PopoverContent> {
  className?: string;
  dateRange?: DateRange;
  onSelectDateRange?: (dateRange?: DateRange) => void;
  dayCount?: number;
  placeholder?: string;
  triggerVariant?: VariantProps<typeof buttonVariants>['variant'];
  triggerSize?: VariantProps<typeof buttonVariants>['size'];
  relativeTime?: RelativeTime;
  triggerClassName?: string;
  quickFillRanges?: { label: string; value: RelativeTime }[];
  restrictToToday?: boolean;
  initialTimezone?: string;
  onTimezoneChange?: (timezone: string) => void;
  disableFuture?: boolean;
  disableBefore?: Date;
  onRelativeDateChange?: (relativeDate: RelativeTime) => void;
}

export interface CalendarViewProps {
  dateRange?: DateRange;
  onSelect?: (date: DateRange | undefined) => void;
  onApply?: (date: DateRange | undefined) => void;
  timezone: string;
  onTimezoneChange?: (timezone: string) => void;
  disableFuture?: boolean;
  disableBefore?: Date;
  onOpenCalendar?: () => void;
  onOpenQuickSelect?: () => void;
}

export interface QuickSelectProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedValue?: RelativeTime;
  onSelect: (value: RelativeTime) => void;
  options: { label: string; value: RelativeTime }[];
  visible?: boolean;
  placeholder: string;
}
