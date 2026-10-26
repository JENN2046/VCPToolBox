export function showMessage(message: string, type: string = 'info') {
  const target = document.getElementById('feedback');
  if (!target) return;
  target.textContent = message;
  target.dataset.type = type;
  target.hidden = false;
}
