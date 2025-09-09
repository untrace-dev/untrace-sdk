'use client';

import { cn } from '@untrace/ui/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@untrace/ui/select';

import type { QuickSelectProps } from './types';

export function QuickSelect({
  isOpen,
  onOpenChange,
  selectedValue,
  onSelect,
  options,
}: QuickSelectProps) {
  return (
    <Select
      onOpenChange={onOpenChange}
      onValueChange={onSelect}
      open={isOpen}
      value={selectedValue}
    >
      <SelectTrigger className={cn('w-full h-7 text-xs border-0')}>
        {/* {visible && (
          <SelectValue placeholder={placeholder}>
            {options.find((option) => option.value === selectedValue)?.label ??
              selectedValue}
          </SelectValue>
        )} */}
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((option) => (
          <SelectItem
            className="text-xs"
            key={option.value}
            value={option.value}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
