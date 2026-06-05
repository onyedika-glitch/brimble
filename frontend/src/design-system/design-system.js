class DsButton extends HTMLElement {
  static props = {
    label: { type: 'string', default: 'Button' },
    variant: { type: 'select', options: ['primary', 'secondary', 'danger', 'ghost'], default: 'primary' },
    size: { type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
    icon: { type: 'icon', default: '' },
    'icon-position': { type: 'select', options: ['left', 'right'], default: 'left' },
    loading: { type: 'boolean', default: false },
    disabled: { type: 'boolean', default: false },
    'full-width': { type: 'boolean', default: false },
  };

  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ['label', 'variant', 'size', 'icon', 'icon-position', 'loading', 'disabled', 'full-width'];
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const label = this.getAttribute('label') || 'Button';
    const variant = this.getAttribute('variant') || 'primary';
    const size = this.getAttribute('size') || 'md';
    const icon = this.getAttribute('icon') || '';
    const iconPosition = this.getAttribute('icon-position') || 'left';
    const loading = this.hasAttribute('loading');
    const disabled = this.hasAttribute('disabled');
    const fullWidth = this.hasAttribute('full-width');

    const sizeClass = `ds-button--${size}`;
    const variantClass = `ds-button--${variant}`;
    const widthClass = fullWidth ? 'ds-button--full' : '';
    const disabledClass = disabled || loading ? 'ds-button--disabled' : '';

    const spinner = `<svg class="ds-button__spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>`;

    const iconEl = icon ? `<i data-lucide="${icon}" class="ds-button__icon"></i>` : '';

    const content = loading
      ? `${spinner}<span class="ds-button__label">${label}</span>`
      : iconPosition === 'left'
        ? `${iconEl}<span class="ds-button__label">${label}</span>`
        : `<span class="ds-button__label">${label}</span>${iconEl}`;

    this.innerHTML = `<button type="button" class="ds-button ${variantClass} ${sizeClass} ${widthClass} ${disabledClass}" ${disabled || loading ? 'disabled' : ''}>${content}</button>`;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ root: this });
    }
  }
}

if (!customElements.get('ds-button')) customElements.define('ds-button', DsButton);


const CARD_SHADOW_CSS = `
  :host {
    display: block;
    width: 100%;
  }

  .card {
    background: var(--ds-surface-card);
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--theme-radius-xl);
    overflow: hidden;
    transition: border-color var(--theme-motion-fast), background var(--theme-motion-fast);
  }

  :host([interactive]) .card {
    cursor: pointer;
  }

  :host([interactive]) .card:hover {
    border-color: var(--ds-border-hover);
    background: var(--ds-surface-hover);
  }

  :host([selected]) .card {
    border-color: var(--ds-border-active);
    background: var(--ds-surface-active);
    border-left: 2px solid var(--ds-border-selected);
  }

  :host([elevated]) .card {
    box-shadow: var(--theme-shadow-md);
  }

  :host([flush]) .body {
    padding: 0;
  }

  .header {
    padding: var(--theme-spacing-5) var(--theme-spacing-5) 0;
  }

  .body {
    padding: var(--theme-spacing-5);
  }

  .footer {
    padding: 0 var(--theme-spacing-5) var(--theme-spacing-5);
  }

  /* Compact variant */
  :host([compact]) .header {
    padding: var(--theme-spacing-3-5) var(--theme-spacing-4) 0;
  }

  :host([compact]) .body {
    padding: var(--theme-spacing-3-5) var(--theme-spacing-4);
  }

  :host([compact]) .footer {
    padding: 0 var(--theme-spacing-4) var(--theme-spacing-3-5);
  }

  /* Hide empty slots via slotted */
  ::slotted([slot="header"]) {
    display: block;
  }

  ::slotted([slot="footer"]) {
    display: block;
    padding-top: var(--theme-spacing-4);
    border-top: 1px solid var(--ds-border-subtle);
  }

  :host([compact]) ::slotted([slot="footer"]) {
    padding-top: var(--theme-spacing-3);
  }
`;

class DsCard extends HTMLElement {
  static props = {
    interactive: { type: 'boolean', default: false },
    selected: { type: 'boolean', default: false },
    elevated: { type: 'boolean', default: false },
    compact: { type: 'boolean', default: false },
    flush: { type: 'boolean', default: false },
  };

  connectedCallback() {
    if (this.shadowRoot) return;

    const shadow = this.attachShadow({ mode: 'open' });
    if (window.__DS_STYLES) shadow.adoptedStyleSheets = [window.__DS_STYLES];
    shadow.innerHTML = `<style>${CARD_SHADOW_CSS}</style>
      <div class="card">
        <div class="header"><slot name="header"></slot></div>
        <div class="body"><slot></slot></div>
        <div class="footer"><slot name="footer"></slot></div>
      </div>`;
  }
}

if (!customElements.get('ds-card')) customElements.define('ds-card', DsCard);


class DsInput extends HTMLElement {
  static props = {
    label: { type: 'string', default: '' },
    placeholder: { type: 'string', default: '' },
    value: { type: 'string', default: '' },
    type: { type: 'select', options: ['text', 'url', 'email', 'password', 'number', 'search'], default: 'text' },
    size: { type: 'select', options: ['sm', 'md'], default: 'md' },
    icon: { type: 'icon', default: '' },
    hint: { type: 'string', default: '' },
    error: { type: 'string', default: '' },
    disabled: { type: 'boolean', default: false },
    readonly: { type: 'boolean', default: false },
    required: { type: 'boolean', default: false },
    mono: { type: 'boolean', default: false },
  };

  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ['label', 'placeholder', 'value', 'type', 'size', 'icon', 'hint', 'error', 'disabled', 'readonly', 'required', 'mono'];
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const label = this.getAttribute('label') || '';
    const placeholder = this.getAttribute('placeholder') || '';
    const value = this.getAttribute('value') || '';
    const type = this.getAttribute('type') || 'text';
    const size = this.getAttribute('size') || 'md';
    const icon = this.getAttribute('icon') || '';
    const hint = this.getAttribute('hint') || '';
    const error = this.getAttribute('error') || '';
    const disabled = this.hasAttribute('disabled');
    const readonly = this.hasAttribute('readonly');
    const required = this.hasAttribute('required');
    const mono = this.hasAttribute('mono');

    const sizeClass = `ds-input__field--${size}`;
    const hasIcon = icon ? 'ds-input__field--has-icon' : '';
    const monoClass = mono ? 'ds-input__field--mono' : '';
    const errorClass = error ? 'ds-input__field--error' : '';

    const iconHtml = icon ? `<i data-lucide="${icon}" class="ds-input__icon"></i>` : '';

    const labelHtml = label
      ? `<label class="ds-input__label">${label}${required ? '<span class="ds-input__required">*</span>' : ''}</label>`
      : '';

    const hintHtml = hint && !error ? `<span class="ds-input__hint">${hint}</span>` : '';
    const errorHtml = error ? `<span class="ds-input__error">${error}</span>` : '';

    this.innerHTML = `
      <div class="ds-input">
        ${labelHtml}
        <div class="ds-input__wrapper">
          ${iconHtml}
          <input
            class="ds-input__field ${sizeClass} ${hasIcon} ${monoClass} ${errorClass}"
            type="${type}"
            placeholder="${placeholder}"
            value="${value}"
            ${disabled ? 'disabled' : ''}
            ${readonly ? 'readonly' : ''}
            ${required ? 'required' : ''}
          />
        </div>
        ${hintHtml}
        ${errorHtml}
      </div>
    `;

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ root: this });
    }
  }
}

if (!customElements.get('ds-input')) customElements.define('ds-input', DsInput);


class DsSelect extends HTMLElement {
  static props = {
    label: { type: 'string', default: '' },
    value: { type: 'string', default: '' },
    options: { type: 'json', default: '[]' },
    placeholder: { type: 'string', default: 'Select...' },
    size: { type: 'select', options: ['sm', 'md'], default: 'md' },
    hint: { type: 'string', default: '' },
    error: { type: 'string', default: '' },
    disabled: { type: 'boolean', default: false },
    required: { type: 'boolean', default: false },
  };

  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ['label', 'value', 'options', 'placeholder', 'size', 'hint', 'error', 'disabled', 'required'];
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const label = this.getAttribute('label') || '';
    const value = this.getAttribute('value') || '';
    const placeholder = this.getAttribute('placeholder') || 'Select...';
    const size = this.getAttribute('size') || 'md';
    const hint = this.getAttribute('hint') || '';
    const error = this.getAttribute('error') || '';
    const disabled = this.hasAttribute('disabled');
    const required = this.hasAttribute('required');

    let options = [];
    try {
      options = JSON.parse(this.getAttribute('options') || '[]');
    } catch (e) {
      options = [];
    }

    const sizeClass = `ds-select__field--${size}`;
    const errorClass = error ? 'ds-select__field--error' : '';

    const labelHtml = label
      ? `<label class="ds-select__label">${label}${required ? '<span class="ds-select__required">*</span>' : ''}</label>`
      : '';

    const optionsHtml = options.map(opt => {
      const optValue = typeof opt === 'string' ? opt : opt.value;
      const optLabel = typeof opt === 'string' ? opt : opt.label;
      const selected = optValue === value ? 'selected' : '';
      return `<option value="${optValue}" ${selected}>${optLabel}</option>`;
    }).join('');

    const hintHtml = hint && !error ? `<span class="ds-select__hint">${hint}</span>` : '';
    const errorHtml = error ? `<span class="ds-select__error">${error}</span>` : '';

    this.innerHTML = `
      <div class="ds-select">
        ${labelHtml}
        <div class="ds-select__wrapper">
          <select
            class="ds-select__field ${sizeClass} ${errorClass}"
            ${disabled ? 'disabled' : ''}
            ${required ? 'required' : ''}
          >
            ${!value ? `<option value="" disabled selected>${placeholder}</option>` : ''}
            ${optionsHtml}
          </select>
          <svg class="ds-select__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        ${hintHtml}
        ${errorHtml}
      </div>
    `;
  }
}

if (!customElements.get('ds-select')) customElements.define('ds-select', DsSelect);


class DsStatusBadge extends HTMLElement {
  static props = {
    status: { type: 'select', options: ['running', 'building', 'failed', 'stopped', 'deploying', 'queued', 'cancelled'], default: 'running' },
    size: { type: 'select', options: ['sm', 'md'], default: 'md' },
    dot: { type: 'boolean', default: false },
  };

  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ['status', 'size', 'dot'];
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const status = this.getAttribute('status') || 'running';
    const size = this.getAttribute('size') || 'md';
    const dot = this.hasAttribute('dot');

    const config = DsStatusBadge.STATUS_CONFIG[status] || DsStatusBadge.STATUS_CONFIG.stopped;

    if (dot) {
      const pulseClass = status === 'running' || status === 'deploying' || status === 'building' ? 'ds-status-badge__dot--pulse' : '';
      this.innerHTML = `
        <span class="ds-status-badge__dot-wrapper ds-status-badge__dot-wrapper--${size}">
          <span class="ds-status-badge__dot ${pulseClass}" style="background: var(${config.color});"></span>
          <span class="ds-status-badge__dot-label" style="color: var(${config.textColor});">${config.label}</span>
        </span>
      `;
    } else {
      const iconHtml = config.icon ? `<i data-lucide="${config.icon}" class="ds-status-badge__icon"></i>` : '';
      this.innerHTML = `
        <span class="ds-status-badge ds-status-badge--${status} ds-status-badge--${size}">
          ${iconHtml}
          <span class="ds-status-badge__label">${config.label}</span>
        </span>
      `;

      if (typeof lucide !== 'undefined') {
        lucide.createIcons({ root: this });
      }
    }
  }
}

DsStatusBadge.STATUS_CONFIG = {
  running: {
    label: 'Running',
    icon: '',
    color: '--ds-color-success-text',
    textColor: '--ds-color-success-text',
  },
  building: {
    label: 'Building',
    icon: 'hammer',
    color: '--ds-color-info-text',
    textColor: '--ds-color-info-text',
  },
  deploying: {
    label: 'Deploying',
    icon: 'rocket',
    color: '--ds-color-brand-text',
    textColor: '--ds-color-brand-text',
  },
  failed: {
    label: 'Failed',
    icon: 'x-circle',
    color: '--ds-color-error-text',
    textColor: '--ds-color-error-text',
  },
  stopped: {
    label: 'Stopped',
    icon: '',
    color: '--ds-text-muted',
    textColor: '--ds-text-muted',
  },
  queued: {
    label: 'Queued',
    icon: 'clock',
    color: '--ds-color-warning-text',
    textColor: '--ds-color-warning-text',
  },
  cancelled: {
    label: 'Cancelled',
    icon: '',
    color: '--ds-text-dimmed',
    textColor: '--ds-text-dimmed',
  },
};

customElements.define('ds-status-badge', DsStatusBadge);
