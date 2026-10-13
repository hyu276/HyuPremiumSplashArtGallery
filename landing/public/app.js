const dialog = document.getElementById('signup-dialog');
const trigger = document.getElementById('open-signup');
const closer = document.getElementById('close-signup');
const form = document.getElementById('signup-form');
const message = document.getElementById('form-message');
const submit = form.querySelector('button[type="submit"]');
trigger.addEventListener('click', () => { dialog.showModal(); form.email.focus(); });
closer.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
function setStatus(text, error = false) { message.textContent = text; message.classList.toggle('error', error); }
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  submit.disabled = true;
  setStatus('Đang xử lý đăng ký…');
  try {
    const response = await fetch('/.netlify/functions/ebook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'request', email: form.email.value.trim(), marketing: form.marketing.checked, privacy: form.privacy.checked, company: form.company.value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Không thể xử lý yêu cầu.');
    setStatus(data.message);
    form.reset();
  } catch (error) { setStatus(error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.', true); }
  finally { submit.disabled = false; }
});
const token = new URLSearchParams(window.location.search).get('confirm');
if (token) {
  history.replaceState({}, '', window.location.pathname + window.location.hash);
  dialog.showModal();
  form.hidden = true;
  const box = document.createElement('div');
  box.className = 'confirm-box';
  const heading = document.createElement('p');
  heading.textContent = 'Bạn đang xác nhận yêu cầu nhận ebook. Vui lòng bấm nút bên dưới để hoàn tất.';
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'btn btn-primary';
  button.textContent = 'XÁC NHẬN EMAIL →';
  const result = document.createElement('div');
  result.className = 'form-message'; result.setAttribute('role', 'status');
  box.append(heading, button, result);
  form.parentNode.appendChild(box);
  button.addEventListener('click', async () => {
    button.disabled = true; result.textContent = 'Đang xác nhận…';
    try {
      const response = await fetch('/.netlify/functions/ebook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'confirm', token }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Không thể xác nhận.');
      result.textContent = data.message;
      button.hidden = true;
    } catch (error) { result.textContent = error.message || 'Lỗi kết nối'; button.disabled = false; }
  });
}
