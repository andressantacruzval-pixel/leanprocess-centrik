const alertBox = document.getElementById('alert');
const form = document.getElementById('startForm');
const startBtn = document.getElementById('startBtn');

function showError(msg) {
  alertBox.textContent = msg;
  alertBox.classList.remove('hidden');
}

fetch('/api/exam/info')
  .then((r) => r.json())
  .then((d) => {
    if (d.examTitle) document.getElementById('examTitle').textContent = d.examTitle;
  })
  .catch(() => {});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.classList.add('hidden');
  const studentName = document.getElementById('studentName').value.trim();
  const studentEmail = document.getElementById('studentEmail').value.trim();
  const code = document.getElementById('code').value.trim().toUpperCase();

  startBtn.disabled = true;
  startBtn.textContent = 'Iniciando...';
  try {
    const res = await fetch('/api/exam/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName, studentEmail, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'No se pudo iniciar el examen.');
      return;
    }
    sessionStorage.setItem('examToken', data.token);
    window.location.href = '/exam.html';
  } catch {
    showError('Error de conexion. Intenta nuevamente.');
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = 'Comenzar examen';
  }
});
