/**
 * Shared auth utility functions
 */

function showAlert(boxId, message, type) {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.className = `alert ${type}`;
  box.innerHTML = message;
  box.classList.remove('hidden');
}

function clearAlert(boxId) {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.classList.add('hidden');
  box.textContent = '';
}

function setLoading(btn, loading) {
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled = loading;
  if (loading) {
    text && text.classList.add('hidden');
    spinner && spinner.classList.remove('hidden');
  } else {
    text && text.classList.remove('hidden');
    spinner && spinner.classList.add('hidden');
  }
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  btn.innerHTML = isText
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}
