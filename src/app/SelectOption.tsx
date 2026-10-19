import type { ReactNode } from 'react';

/**
 * Native <option> element that matches the Fluent UI `Option` prop API.
 *
 * Fluent UI's `Option` (from @fluentui/react-combobox) always renders a
 * `<div role="option">`, which is only valid inside a Combobox/Dropdown
 * listbox. A native `<select>` only renders real `<option>` children, so
 * using the Fluent `Option` inside `Select` produced an empty dropdown.
 *
 * `text` is accepted for API compatibility and ignored: a native option
 * displays its children.
 */
export type SelectOptionProps = {
  value?: string | number;
  text?: string;
  disabled?: boolean;
  children?: ReactNode;
};

export function Option({ value, disabled, children }: SelectOptionProps) {
  return <option value={value} disabled={disabled}>{children}</option>;
}
