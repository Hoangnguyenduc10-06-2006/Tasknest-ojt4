import { useState } from 'react';
import { TextField, type TextFieldProps } from './TextField';

export function PasswordField(props: Omit<TextFieldProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField {...props} type={visible ? 'text' : 'password'} trailing={
      <button type="button" disabled={props.disabled} aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${props.label.toLowerCase()}`} aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
        className="rounded-lg px-2 py-2 text-xs font-medium text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
        {visible ? 'Ẩn' : 'Hiện'}
      </button>
    } />
  );
}
