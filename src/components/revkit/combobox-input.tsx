"use client";

import { useId } from "react";

/**
 * ComboboxInput — autocomplete input with free-text fallback.
 *
 * Uses the native HTML `<datalist>` element for the suggestions list.
 * This is the simplest + most accessible combobox pattern — no JS state,
 * keyboard-navigable out of the box, screen-reader-friendly, and
 * degrades gracefully to a plain `<input type="text">` in legacy browsers.
 *
 * Inspired by Rayyan's autocomplete-everywhere UX principle: users can
 * always type a custom value, but presets are offered to reduce typing.
 *
 * Usage:
 *   <ComboboxInput
 *     value={condition}
 *     onChange={setCondition}
 *     suggestions={COMMON_CONDITIONS}
 *     placeholder="e.g. acute sinusitis"
 *   />
 */
export interface ComboboxInputProps {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
  required?: boolean;
  disabled?: boolean;
}

export function ComboboxInput({
  value,
  onChange,
  onBlur,
  suggestions = [],
  placeholder,
  className = "input-compact",
  id,
  "aria-label": ariaLabel,
  required = false,
  disabled = false,
}: ComboboxInputProps) {
  // Stable unique ID for the datalist linkage.
  const generatedId = useId();
  const listId = `${generatedId}-list`;
  const inputId = id ?? generatedId;

  return (
    <>
      <input
        id={inputId}
        list={suggestions.length > 0 ? listId : undefined}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        autoComplete="off"
        className={className}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </>
  );
}
