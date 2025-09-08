'use client';

import { Button } from '@untrace/ui/button';
import { cn } from '@untrace/ui/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@untrace/ui/popover';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect } from 'react';
import type { DateRange } from 'react-day-picker';
import { CalendarView } from './calendar-view';
import { QuickSelect } from './quick-select';
import type { DateRangePickerProps, RelativeTime } from './types';
import { getInitialDateRange } from './utils';

export function DateRangePicker({
  className,
  dateRange,
  onSelectDateRange,
  dayCount,
  placeholder = 'Select Period',
  triggerVariant = 'outline',
  triggerSize = 'default',
  triggerClassName,
  quickFillRanges = [
    { label: 'Last hour', value: '1h' },
    { label: 'Last 6 hours', value: '6h' },
    { label: 'Last 12 hours', value: '12h' },
    { label: 'Last 24 hours', value: '24h' },
    { label: 'Last 3 days', value: '3d' },
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 14 days', value: '14d' },
    { label: 'Last 30 days', value: '30d' },
  ],
  restrictToToday = true,
  relativeTime,
  initialTimezone,
  onTimezoneChange,
  disableFuture,
  disableBefore,
  onRelativeDateChange,
  ...props
}: DateRangePickerProps) {
  const [dateRangeState, setDateRangeState] = React.useState<
    DateRange | undefined
  >(() => getInitialDateRange(dateRange, dayCount));

  useEffect(() => {
    setDateRangeState(getInitialDateRange(dateRange, dayCount));
  }, [dateRange, dayCount]);

  const [timezone, setTimezone] = React.useState<string>(
    initialTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  const [selectionMode, setSelectionMode] = React.useState<
    'calendar' | 'quick'
  >(dateRange?.from || dateRange?.to ? 'calendar' : 'quick');
  const [selectedQuickFill, setSelectedQuickFill] = React.useState<
    RelativeTime | undefined
  >(relativeTime);

  useEffect(() => {
    setSelectedQuickFill(relativeTime);
    // Prioritize relative time selection over any existing dateRange to avoid flicker
    if (relativeTime) {
      setSelectionMode('quick');
      return;
    }
    // Fall back to calendar mode when an absolute range is present; otherwise quick
    if (dateRange?.from || dateRange?.to) {
      setSelectionMode('calendar');
    } else {
      setSelectionMode('quick');
    }
  }, [relativeTime, dateRange]);

  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [isQuickSelectOpen, setIsQuickSelectOpen] = React.useState(false);

  useEffect(() => {
    setDateRangeState(dateRange);
  }, [dateRange]);

  const handleSelect = useCallback((newDateRange: DateRange | undefined) => {
    setDateRangeState(newDateRange);
    setSelectionMode('calendar');
  }, []);

  const handleQuickSelect = useCallback(
    (value: RelativeTime) => {
      setSelectedQuickFill(value);
      setSelectionMode('quick');
      onRelativeDateChange?.(value);
    },
    [onRelativeDateChange],
  );

  const handleApply = (newDateRange?: DateRange) => {
    onSelectDateRange?.(newDateRange);
    setDateRangeState(newDateRange);
    setSelectionMode('calendar');
    setIsCalendarOpen(false);
  };

  const handleTimezoneChange = useCallback(
    (newTimezone: string) => {
      setTimezone(newTimezone);
      onTimezoneChange?.(newTimezone);
    },
    [onTimezoneChange],
  );

  return (
    <div className={cn('relative flex items-center gap-2', className)}>
      <div className="flex w-full items-center border rounded-md overflow-hidden">
        <div className={'flex flex-1'}>
          <Popover onOpenChange={setIsCalendarOpen} open={isCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                className={cn('rounded-r-none', {
                  'border-r': selectionMode === 'quick',
                  'border-r-0': selectionMode === 'calendar',
                })}
                onClick={() => {
                  setIsCalendarOpen(true);
                  setIsQuickSelectOpen(false);
                }}
                size="icon"
                variant="ghost"
              >
                <CalendarIcon className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0" {...props}>
              <CalendarView
                dateRange={dateRangeState}
                disableBefore={disableBefore}
                disableFuture={disableFuture}
                onApply={handleApply}
                onOpenCalendar={() => {
                  setIsCalendarOpen(true);
                  setIsQuickSelectOpen(false);
                }}
                onSelect={handleSelect}
                onTimezoneChange={handleTimezoneChange}
                timezone={timezone}
              />
            </PopoverContent>
          </Popover>
          {/* {selectionMode === 'calendar' ? (
            <Button
              variant={triggerVariant}
              size={triggerSize}
              className={cn(
                'w-full justify-start font-normal border-0 h-7 text-xs',
                !dateRange && 'text-muted-foreground',
                'group-hover:bg-accent group-hover:text-accent-foreground',
                triggerClassName,
              )}
            >
              <span className="truncate">
                {dateRange?.from
                  ? dateRange.to
                    ? `${format(dateRange.from, 'LLL dd, yyyy')} - ${format(
                        dateRange.to,
                        'LLL dd, yyyy',
                      )}`
                    : format(dateRange.from, 'LLL dd, yyyy')
                  : placeholder}
              </span>
            </Button>
          ) : null} */}
          <Button
            aria-label="Toggle between calendar and quick select modes"
            // className="w-full font-normal border-0 text-sm truncate flex items-center justify-center hover:bg-accent/50 px-2 py-1 h-auto"
            onClick={(e) => {
              e.preventDefault();
              if (selectionMode === 'calendar') {
                setIsCalendarOpen(true);
                setIsQuickSelectOpen(false);
              } else {
                setIsQuickSelectOpen(true);
                setIsCalendarOpen(false);
              }
            }}
            variant="ghost"
          >
            {selectionMode === 'calendar' ? (
              dateRangeState?.from && dateRangeState.to ? (
                `${format(dateRangeState.from, 'LLL dd, yyyy')} - ${format(
                  dateRangeState.to,
                  'LLL dd, yyyy',
                )}`
              ) : dateRangeState?.from ? (
                format(dateRangeState.from, 'LLL dd, yyyy')
              ) : (
                placeholder
              )
            ) : (
              <div className="ml-2">
                {quickFillRanges.find(
                  (range) => range.value === selectedQuickFill,
                )?.label ?? placeholder}
              </div>
            )}
          </Button>
        </div>

        {/* {selectionMode === 'quick' && ( */}
        <div className="flex-1 flex">
          <QuickSelect
            isOpen={isQuickSelectOpen}
            onOpenChange={setIsQuickSelectOpen}
            onSelect={handleQuickSelect}
            options={quickFillRanges}
            placeholder={placeholder}
            selectedValue={selectedQuickFill}
            visible={selectionMode === 'quick'}
          />
        </div>
        {/* )} */}

        {/* {selectionMode === 'calendar' && (
          <Button
            variant="ghost"
            size="sm"
            className={cn('rounded-l-none h-7 w-7', {
              'border-l': selectionMode === 'calendar',
            })}
            onClick={() => {
              setIsQuickSelectOpen(true);
              setIsCalendarOpen(false);
            }}
          >
            <ChevronDownIcon className="size-3" />
          </Button>
        )} */}
      </div>
    </div>
  );
}

export type { DateRangePickerProps } from './types';
