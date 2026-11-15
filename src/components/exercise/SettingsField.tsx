import type { ReactNode } from 'react';

/** One labelled setting, with its current value on the right. */
export default function SettingsField(p: { label: string; value?: string; children: ReactNode }) {
  return (
    <div className="ex-field">
      <div className="ex-field-head">
        <span className="ex-field-label">{p.label}</span>
        {p.value !== undefined && <span className="ex-field-value">{p.value}</span>}
      </div>
      {p.children}
    </div>
  );
}
