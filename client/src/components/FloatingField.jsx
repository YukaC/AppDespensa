import { forwardRef, useId, useState } from 'react';

const NATIVE_PICKER_TYPES = new Set(['date', 'week', 'month', 'time', 'datetime-local']);

function isFilled(value, type, as) {
  if (as === 'select') return value !== '' && value != null;
  if (NATIVE_PICKER_TYPES.has(type)) return Boolean(value);
  if (type === 'number') return value !== '' && value != null && value !== undefined;
  return String(value ?? '').length > 0;
}

const FloatingField = forwardRef(function FloatingField(
  {
    label,
    as = 'input',
    value,
    onChange,
    className = '',
    inputClassName = '',
    size = 'md',
    clearable = false,
    children,
    id,
    onFocus,
    onBlur,
    type,
    ...props
  },
  ref
) {
  const autoId = useId();
  const fieldId = id || autoId;
  const [focused, setFocused] = useState(false);
  const inputType = type;
  const isNativePicker = NATIVE_PICKER_TYPES.has(inputType);
  const filled = isFilled(value, inputType, as);
  const alwaysFloatLabel = as === 'select' || isNativePicker;
  const floated = alwaysFloatLabel || filled || focused;
  const showValueTone = filled || focused;
  const valueToneClass = showValueTone ? 'text-slate-100' : 'text-slate-400 focus:text-slate-100';

  const isLg = size === 'lg';
  const minH = isLg ? 'min-h-[4rem]' : 'min-h-[3.5rem]';
  const pad = floated
    ? isLg
      ? 'pt-8 pb-2.5'
      : 'pt-8 pb-2'
    : isLg
      ? 'pt-7 pb-3'
      : 'pt-6 pb-2.5';
  const textSize = isLg ? 'text-lg' : 'text-base';

  const hasClear = clearable && as !== 'select' && filled;

  const nativePickerClass = isNativePicker
    ? [
        '[color-scheme:dark]',
        valueToneClass,
        '[&::-webkit-datetime-edit]:text-inherit',
        '[&::-webkit-datetime-edit-fields-wrapper]:text-inherit',
        '[&::-webkit-datetime-edit-text]:text-inherit',
        '[&::-webkit-datetime-edit-month-field]:text-inherit',
        '[&::-webkit-datetime-edit-day-field]:text-inherit',
        '[&::-webkit-datetime-edit-year-field]:text-inherit',
        'focus:[&::-webkit-datetime-edit]:text-slate-100',
        'focus:[&::-webkit-datetime-edit-fields-wrapper]:text-slate-100',
        '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
        '[&::-webkit-calendar-picker-indicator]:opacity-80',
        '[&::-webkit-calendar-picker-indicator]:[filter:brightness(0)_invert(1)]',
        '[&::-webkit-calendar-picker-indicator]:hover:opacity-100',
      ].join(' ')
    : '';

  const fieldClass = [
    'w-full rounded-xl border border-slate-600/90 bg-slate-900/90 px-4 shadow-inner shadow-black/10',
    'transition-[border-color,box-shadow,color] duration-150 ease-out',
    'hover:border-slate-500',
    'focus:border-blue-500 focus:shadow-md focus:shadow-blue-500/10 focus:ring-2 focus:ring-blue-500/25 focus:outline-none',
    isNativePicker ? '' : valueToneClass,
    hasClear ? 'pr-11' : '',
    minH,
    pad,
    textSize,
    as === 'select' ? 'leading-snug' : '',
    nativePickerClass,
    inputClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const labelClass = floated
    ? 'top-2 scale-100 text-[0.68rem] font-semibold uppercase tracking-wide text-blue-400/95'
    : 'top-1/2 -translate-y-1/2 scale-100 text-sm font-normal text-slate-400';

  const handleFocus = (e) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setFocused(false);
    onBlur?.(e);
  };

  return (
    <div className={`relative ${className}`}>
      {as === 'select' ? (
        <select
          id={fieldId}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={fieldClass}
          {...props}
        >
          {children}
        </select>
      ) : (
        <input
          ref={ref}
          id={fieldId}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder=" "
          className={`peer placeholder-transparent ${fieldClass}`}
          {...props}
        />
      )}
      {hasClear && (
        <button
          type="button"
          onClick={() => onChange?.({ target: { value: '' } })}
          className="btn-icon absolute right-1 top-1/2 z-20 !min-h-9 !min-w-9 -translate-y-1/2 text-slate-400 hover:text-white"
          aria-label="Limpiar"
          tabIndex={-1}
        >
          ✕
        </button>
      )}
      <label
        htmlFor={fieldId}
        className={`pointer-events-none absolute left-4 z-10 max-w-[calc(100%-2rem)] truncate transition-[top,transform,color,font-size] duration-150 ease-out ${labelClass} ${
          floated ? 'bg-slate-900/95 px-1' : ''
        }`}
      >
        {label}
      </label>
    </div>
  );
});

FloatingField.displayName = 'FloatingField';

export default FloatingField;
