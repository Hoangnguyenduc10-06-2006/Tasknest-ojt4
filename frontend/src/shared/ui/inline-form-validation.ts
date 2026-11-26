type ValidatableControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

type InlineError = {
  element: HTMLParagraphElement;
  describedBy?: string;
  ariaInvalid: string | null;
};

const errors = new WeakMap<ValidatableControl, InlineError>();
let nextErrorId = 0;

type ValidityFlags = Pick<ValidityState,
  | 'valueMissing'
  | 'typeMismatch'
  | 'patternMismatch'
  | 'tooShort'
  | 'tooLong'
  | 'rangeUnderflow'
  | 'rangeOverflow'
  | 'stepMismatch'
  | 'badInput'
  | 'customError'
>;

export function validationMessageFor(
  name: string,
  type: string,
  validity: ValidityFlags,
  constraints: { min?: string; max?: string; minLength?: number; maxLength?: number } = {},
): string {
  if (validity.valueMissing) return `${name} không được để trống.`;
  if (validity.typeMismatch) {
    return type === 'email'
      ? `${name} không đúng định dạng email.`
      : `${name} chưa đúng định dạng.`;
  }
  if (validity.patternMismatch) return `${name} chưa đúng định dạng yêu cầu.`;
  if (validity.tooShort) return `${name} cần có ít nhất ${constraints.minLength ?? 0} ký tự.`;
  if (validity.tooLong) return `${name} không được vượt quá ${constraints.maxLength ?? 0} ký tự.`;
  if (validity.rangeUnderflow) return `${name} phải từ ${constraints.min ?? ''} trở lên.`;
  if (validity.rangeOverflow) return `${name} không được vượt quá ${constraints.max ?? ''}.`;
  if (validity.stepMismatch) return `Vui lòng kiểm tra giá trị ${name.toLocaleLowerCase()}.`;
  if (validity.badInput) return `${name} chưa đúng định dạng.`;
  if (validity.customError) return `${name} chưa hợp lệ.`;
  return `${name} chưa hợp lệ.`;
}

function fieldName(control: ValidatableControl) {
  const label = Array.from(control.labels ?? [])
    .map((item) => item.textContent ?? '')
    .join(' ')
    .replace(/\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[:：]+$/, '');
  if (label) return label;

  const accessibleName =
    control.getAttribute('aria-label') ||
    control.getAttribute('placeholder') ||
    control.name.replace(/[_-]+/g, ' ');
  return accessibleName.trim() || 'Thông tin này';
}

export function inlineValidationMessage(control: ValidatableControl): string {
  const type = control instanceof HTMLInputElement
    ? control.type
    : control instanceof HTMLSelectElement
      ? 'select'
      : 'text';
  return validationMessageFor(fieldName(control), type, control.validity, {
    min: control.getAttribute('min') ?? undefined,
    max: control.getAttribute('max') ?? undefined,
    minLength: Number(control.getAttribute('minlength')) || undefined,
    maxLength: Number(control.getAttribute('maxlength')) || undefined,
  });
}

function showError(control: ValidatableControl) {
  let error = errors.get(control);
  if (!error) {
    const element = document.createElement('p');
    element.id = `tasknest-field-error-${++nextErrorId}`;
    element.className = 'mt-1.5 block text-xs leading-5 text-danger';
    element.setAttribute('role', 'alert');
    element.dataset.inlineValidationMessage = 'true';
    const wrappingLabel = control.closest('label');
    (wrappingLabel ?? control).insertAdjacentElement('afterend', element);

    error = {
      element,
      describedBy: control.getAttribute('aria-describedby') ?? undefined,
      ariaInvalid: control.getAttribute('aria-invalid'),
    };
    errors.set(control, error);
  }

  error.element.textContent = inlineValidationMessage(control);
  control.setAttribute('aria-invalid', 'true');
  control.setAttribute(
    'aria-describedby',
    [error.describedBy, error.element.id].filter(Boolean).join(' '),
  );
}

function clearError(control: ValidatableControl) {
  const error = errors.get(control);
  if (!error) return;

  error.element.remove();
  if (error.describedBy) control.setAttribute('aria-describedby', error.describedBy);
  else control.removeAttribute('aria-describedby');
  if (error.ariaInvalid === null) control.removeAttribute('aria-invalid');
  else control.setAttribute('aria-invalid', error.ariaInvalid);
  errors.delete(control);
}

function validatableControl(target: EventTarget | null): ValidatableControl | null {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return target;
  }
  return null;
}

/** Replace browser validation popovers with accessible, field-level messages. */
export function installInlineFormValidation(root: Document = document) {
  const onInvalid = (event: Event) => {
    const control = validatableControl(event.target);
    if (!control || control.form?.noValidate) return;

    event.preventDefault();
    showError(control);
  };

  const onEdit = (event: Event) => {
    const control = validatableControl(event.target);
    if (!control || !errors.has(control)) return;
    if (control.validity.valid) clearError(control);
    else showError(control);
  };

  root.addEventListener('invalid', onInvalid, true);
  root.addEventListener('input', onEdit, true);
  root.addEventListener('change', onEdit, true);

  return () => {
    root.removeEventListener('invalid', onInvalid, true);
    root.removeEventListener('input', onEdit, true);
    root.removeEventListener('change', onEdit, true);
  };
}
