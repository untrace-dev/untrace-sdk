'use client';

import { Button } from '@untrace/ui/button';
import { Calendar } from '@untrace/ui/calendar';
import { Text } from '@untrace/ui/custom/typography';
import { Input } from '@untrace/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@untrace/ui/select';
import { format } from 'date-fns';

import { useMemo } from 'react';
import type { CalendarViewProps } from './types';

export function CalendarView({
  dateRange,
  onSelect,
  onApply,
  timezone,
  onTimezoneChange,
  disableFuture = true,
  disableBefore,
  onOpenCalendar,
}: CalendarViewProps) {
  const today = useMemo(() => {
    return new Date();
  }, []);

  const disabledDates = useMemo(() => {
    const matchers: Array<{ after: Date } | { before: Date }> = [];
    if (disableFuture) {
      matchers.push({ after: today });
    }
    if (disableBefore) {
      matchers.push({ before: disableBefore });
    }
    return matchers.length > 0 ? matchers : undefined;
  }, [disableFuture, disableBefore, today]);

  return (
    <>
      <Calendar
        captionLayout="dropdown"
        className="bg-popover px-0 mx-auto"
        defaultMonth={dateRange?.from}
        disabled={disabledDates}
        mode="range"
        onSelect={onSelect}
        selected={dateRange}
      />
      <div className="border-t border-border p-2 space-y-3">
        <div className="space-y-1">
          <div>
            <Text className="text-xs text-muted-foreground">Start</Text>
            <div className="flex gap-1 mt-0.5">
              <div className="flex-1">
                <Input
                  className="h-6 text-xs cursor-pointer"
                  onClick={onOpenCalendar}
                  readOnly
                  type="text"
                  value={
                    dateRange?.from
                      ? format(dateRange.from, 'MMM dd, yyyy')
                      : 'Select date'
                  }
                />
              </div>
              <div className="w-[90px]">
                <Input
                  className="h-7 text-sm"
                  defaultValue="00:00"
                  onChange={(e) => {
                    const time = e.target.value;
                    const date = new Date(dateRange?.from ?? new Date());
                    if (time && time.length === 5) {
                      const [hours, minutes] = time.split(':');
                      date.setHours(Number.parseInt(hours ?? '0', 10));
                      date.setMinutes(Number.parseInt(minutes ?? '0', 10));
                    }
                  }}
                  step="1"
                  type="time"
                  value={
                    dateRange?.from ? format(dateRange.from, 'HH:mm') : '--:--'
                  }
                />
              </div>
            </div>
          </div>
          <div>
            <Text className="text-xs text-muted-foreground">End</Text>
            <div className="flex gap-1 mt-0.5">
              <div className="flex-1">
                <Input
                  className="h-7 text-xs cursor-pointer"
                  onClick={onOpenCalendar}
                  readOnly
                  type="text"
                  value={
                    dateRange?.to
                      ? format(dateRange.to, 'MMM dd, yyyy')
                      : 'Select date'
                  }
                />
              </div>
              <div className="w-[90px]">
                <Input
                  className="h-6 text-sm"
                  defaultValue={format(new Date(), 'HH:mm')}
                  onChange={(e) => {
                    const time = e.target.value;
                    const date = new Date(dateRange?.to ?? new Date());
                    if (time && time.length === 5) {
                      const [hours, minutes] = time.split(':');
                      date.setHours(Number.parseInt(hours ?? '0', 10));
                      date.setMinutes(Number.parseInt(minutes ?? '0', 10));
                      onSelect?.({
                        from: dateRange?.from,
                        to: date,
                      });
                    }
                  }}
                  step="1"
                  type="time"
                  value={
                    dateRange?.to ? format(dateRange.to, 'HH:mm') : '--:--'
                  }
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Select onValueChange={onTimezoneChange} value={timezone}>
              <SelectTrigger
                className="h-6 w-full border-0 text-xs text-muted-foreground"
                size="sm"
              >
                <SelectValue
                  className="text-xs text-muted-foreground"
                  placeholder="Select timezone"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs h-6" value="UTC">
                  UTC
                </SelectItem>
                <SelectItem
                  className="text-xs h-6"
                  value={Intl.DateTimeFormat().resolvedOptions().timeZone}
                >
                  Local ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            onClick={() => onApply?.(dateRange)}
            size="sm"
            variant="outline"
          >
            Apply <span className="ml-2">↵</span>
          </Button>
        </div>
      </div>
    </>
  );
}
