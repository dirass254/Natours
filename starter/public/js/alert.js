export const hideAlert = () => {
  const alertEl = document.querySelector('.alert');
  if (alertEl) alertEl.remove();
};

export const showAlert = (type, msg) => {
  const alertEl = document.querySelector('.alert');
  if (alertEl) alertEl.remove();
  const markup = `<div class="alert alert--${type}">${msg}</div>`;
  document.querySelector('body').insertAdjacentHTML('afterbegin', markup);
  window.setTimeout(hideAlert, 5000);
};
