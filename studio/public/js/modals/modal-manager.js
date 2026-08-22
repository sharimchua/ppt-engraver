/**
 * Generic Modal Manager & Dynamic Form Dialog Controller
 */

let refactorPromiseResolve = null;

export function showRefactorDialog({ title, desc, fields, confirmText = 'Apply Refactoring' }) {
  return new Promise((resolve) => {
    refactorPromiseResolve = resolve;

    const modal = document.getElementById('refactor-modal');
    const titleEl = document.getElementById('refactor-title');
    const descEl = document.getElementById('refactor-desc');
    const fieldsEl = document.getElementById('refactor-fields');
    const btnConfirm = document.getElementById('btn-refactor-confirm');

    titleEl.textContent = title;
    descEl.textContent = desc;
    btnConfirm.textContent = confirmText;
    fieldsEl.innerHTML = '';

    fields.forEach((field) => {
      const formGroup = document.createElement('div');
      formGroup.className = 'refactor-form-group';

      if (field.label) {
        const label = document.createElement('label');
        label.textContent = field.label;
        if (field.id) label.htmlFor = field.id;
        formGroup.appendChild(label);
      }

      if (field.type === 'text') {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = field.id || `field_${field.name}`;
        input.name = field.name;
        input.value = field.value || '';
        input.className = 'input-text';
        if (field.placeholder) input.placeholder = field.placeholder;
        formGroup.appendChild(input);
      } else if (field.type === 'checkboxes') {
        const group = document.createElement('div');
        group.className = 'refactor-checkbox-group';
        field.options.forEach((opt) => {
          const lbl = document.createElement('label');
          lbl.className = 'refactor-checkbox-label';
          const chk = document.createElement('input');
          chk.type = 'checkbox';
          chk.name = field.name;
          chk.value = opt.id;
          chk.checked = !!opt.checked;
          lbl.appendChild(chk);
          const span = document.createElement('span');
          span.textContent = opt.label;
          lbl.appendChild(span);
          group.appendChild(lbl);
        });
        formGroup.appendChild(group);
      } else if (field.type === 'radios') {
        const group = document.createElement('div');
        group.className = 'refactor-radio-group';
        field.options.forEach((opt) => {
          const lbl = document.createElement('label');
          lbl.className = 'refactor-radio-label';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = field.name;
          radio.value = opt.id;
          radio.checked = !!opt.checked;
          lbl.appendChild(radio);
          const span = document.createElement('span');
          span.textContent = opt.label;
          lbl.appendChild(span);
          group.appendChild(lbl);
        });
        formGroup.appendChild(group);
      } else if (field.type === 'select') {
        const select = document.createElement('select');
        select.id = field.id || `field_${field.name}`;
        select.name = field.name;
        select.className = 'refactor-select';
        field.options.forEach((opt) => {
          const option = document.createElement('option');
          option.value = opt.id;
          option.textContent = opt.label;
          if (opt.id === field.value) option.selected = true;
          select.appendChild(option);
        });
        if (field.onChange) {
          select.addEventListener('change', (e) => field.onChange(e, fieldsEl));
        }
        formGroup.appendChild(select);
      } else if (field.type === 'html') {
        const htmlContainer = document.createElement('div');
        htmlContainer.innerHTML = field.html || '';
        formGroup.appendChild(htmlContainer);
      }

      fieldsEl.appendChild(formGroup);
    });

    modal.classList.remove('hidden');

    const firstInput = fieldsEl.querySelector('input[type="text"], select');
    if (firstInput) {
      setTimeout(() => {
        firstInput.focus();
        if (firstInput.select && firstInput.tagName === 'INPUT') firstInput.select();
      }, 50);
    }
  });
}

export function closeRefactorDialog(confirmed = false) {
  const modal = document.getElementById('refactor-modal');
  if (modal) modal.classList.add('hidden');

  if (refactorPromiseResolve) {
    if (!confirmed) {
      refactorPromiseResolve({ confirmed: false });
    } else {
      const values = {};
      const fieldsEl = document.getElementById('refactor-fields');
      const textInputs = fieldsEl.querySelectorAll('input[type="text"]');
      textInputs.forEach(input => { values[input.name] = input.value.trim(); });

      const selects = fieldsEl.querySelectorAll('select');
      selects.forEach(sel => { values[sel.name] = sel.value; });

      const checkedBoxes = {};
      fieldsEl.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        if (!checkedBoxes[chk.name]) checkedBoxes[chk.name] = [];
        if (chk.checked) checkedBoxes[chk.name].push(chk.value);
      });
      Object.assign(values, checkedBoxes);

      const checkedRadio = fieldsEl.querySelectorAll('input[type="radio"]:checked');
      checkedRadio.forEach(r => { values[r.name] = r.value; });

      refactorPromiseResolve({ confirmed: true, values });
    }
    refactorPromiseResolve = null;
  }
}

export function setupModalManagerListeners() {
  const btnClose = document.getElementById('btn-close-refactor');
  const btnCancel = document.getElementById('btn-refactor-cancel');
  const btnConfirm = document.getElementById('btn-refactor-confirm');
  const backdrop = document.getElementById('refactor-backdrop');

  if (btnClose) btnClose.addEventListener('click', () => closeRefactorDialog(false));
  if (btnCancel) btnCancel.addEventListener('click', () => closeRefactorDialog(false));
  if (btnConfirm) btnConfirm.addEventListener('click', () => closeRefactorDialog(true));
  if (backdrop) backdrop.addEventListener('click', () => closeRefactorDialog(false));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('refactor-modal');
      if (modal && !modal.classList.contains('hidden')) {
        closeRefactorDialog(false);
      }
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      const modal = document.getElementById('refactor-modal');
      if (modal && !modal.classList.contains('hidden')) {
        closeRefactorDialog(true);
      }
    }
  });
}
