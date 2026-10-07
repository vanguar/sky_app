import { useId } from 'react';

interface ToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange(on: boolean): void;
  testId?: string;
}

/** Accessible switch row (button role="switch"). */
export function Toggle({ label, hint, checked, onChange, testId }: ToggleProps) {
  const id = useId();
  return (
    <div className="toggle-row">
      <div className="toggle-text">
        <span id={id}>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        className={`switch ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
        data-testid={testId}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}
