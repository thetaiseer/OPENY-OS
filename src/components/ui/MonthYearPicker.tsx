'use client';

type MonthYearPickerProps = {
  value?: string;
  onChange?: (value: any) => void;
  [key: string]: any;
};

export default function MonthYearPicker({ value = '', onChange, ...props }: MonthYearPickerProps) {
  return (
    <input
      {...props}
      type="month"
      value={value}
      onChange={(event) => {
        onChange?.(event.target.value);
      }}
    />
  );
}
