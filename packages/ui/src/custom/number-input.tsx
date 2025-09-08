import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '../components/button';
import { Input } from '../components/input';

interface NumberInputProps
  extends Omit<React.ComponentProps<'input'>, 'onChange'> {
  onChange?: (value: number) => void;
  quickFillValues?: number[];
}

// Helper function to format number with commas
const formatNumberWithCommas = (value: number | string): string => {
  const numValue = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(numValue)) return '';

  // Format with commas, handling decimals
  return numValue.toLocaleString('en-US', {
    maximumFractionDigits: 10,
    minimumFractionDigits: 0,
  });
};

// Helper function to parse comma-formatted string back to number
const parseCommaFormattedNumber = (value: string): number => {
  const rawValue = value.replaceAll(/[^\d.-]/g, '');
  return Number.parseFloat(rawValue) || 0;
};

export const NumberInput: React.FC<NumberInputProps> = ({
  onChange,
  quickFillValues,
  ...props
}) => {
  const [value, setValue] = useState<string>('');

  const handleChange = useCallback(
    (newValue: string | number) => {
      const rawValue = newValue.toString().replaceAll(/[^\d.-]/g, '');
      const numericValue = Number.parseFloat(rawValue) || 0;
      const formattedValue = formatNumberWithCommas(numericValue);

      setValue(formattedValue);
      if (onChange) {
        onChange(numericValue);
      }
    },
    [onChange],
  );

  useEffect(() => {
    if (props.value !== undefined) {
      handleChange(props.value.toString());
    }
  }, [props.value, handleChange]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    const numericValue = parseCommaFormattedNumber(inputValue);
    const formattedValue = formatNumberWithCommas(numericValue);

    setValue(formattedValue);
    if (onChange) {
      onChange(numericValue);
    }
  };

  const handleQuickFill = (fillValue: number) => {
    const formattedValue = formatNumberWithCommas(fillValue);
    setValue(formattedValue);
    if (onChange) {
      onChange(fillValue);
    }
  };

  return (
    <div className="w-full">
      <Input
        {...props}
        onChange={handleInputChange}
        onFocus={(event) => event.target.select()}
        type="text"
        value={value}
      />
      {quickFillValues && quickFillValues.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {quickFillValues.map((value) => (
            <Button
              key={`quick-fill-${value.toString()}`}
              onClick={() => handleQuickFill(value)}
              size="sm"
              type="button"
              variant="outline"
            >
              {formatNumberWithCommas(value)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
