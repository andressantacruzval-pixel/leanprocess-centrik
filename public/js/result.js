const token = sessionStorage.getItem('examToken');
const el = (id) => document.getElementById(id);

async function load() {
  if (!token) {
    window.location.href = '/';
    return;
  }
  try {
    const res = await fetch('/api/exam/result', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json();
    if (!res.ok) {
      const a = el('loadAlert');
      a.textContent = data.error || 'No se pudo cargar el resultado.';
      a.classList.remove('hidden');
      return;
    }
    render(data);
  } catch {
    const a = el('loadAlert');
    a.textContent = 'Error de conexion. Recarga la pagina.';
    a.classList.remove('hidden');
  }
}

function render(d) {
  if (d.examTitle) el('examTitle').textContent = d.examTitle;
  el('studentLine').textContent = d.studentName || '';

  const banner = el('banner');
  banner.classList.add(d.passed ? 'pass' : 'fail');
  el('verdict').textContent = d.passed ? 'APROBADO' : 'REPROBADO';
  el('scoreLine').textContent = `Puntaje obtenido: ${d.score}%`;

  el('statCorrect').textContent = d.correctCount;
  el('statTotal').textContent = d.totalQuestions;
  el('statPass').textContent = d.passPercentage + '%';

  if (d.reviewAvailable && Array.isArray(d.review)) {
    el('reviewSection').classList.remove('hidden');
    const list = el('reviewList');
    d.review.forEach((item) => {
      const wrap = document.createElement('div');
      wrap.className = 'review-item';

      const head = document.createElement('div');
      head.className = 'rq';
      head.innerHTML =
        `<span class="badge ${item.isCorrect ? 'ok' : 'no'}">` +
        `${item.isCorrect ? 'Correcta' : 'Incorrecta'}</span> ` +
        `Pregunta ${item.number}`;
      wrap.appendChild(head);

      const qt = document.createElement('div');
      qt.style.marginBottom = '10px';
      qt.textContent = item.text;
      wrap.appendChild(qt);

      item.options.forEach((opt) => {
        const o = document.createElement('div');
        let cls = 'neutral';
        if (opt.isCorrect) cls = 'correct';
        else if (opt.wasSelected) cls = 'wrong';
        o.className = 'review-opt ' + cls;
        let prefix = '';
        if (opt.isCorrect) prefix = '✓ ';
        else if (opt.wasSelected) prefix = '✗ ';
        let suffix = '';
        if (opt.wasSelected) suffix = '  (tu respuesta)';
        o.textContent = prefix + opt.text + suffix;
        wrap.appendChild(o);
      });
      list.appendChild(wrap);
    });
  } else {
    el('noReview').classList.remove('hidden');
  }

  el('resultContent').classList.remove('hidden');
  sessionStorage.removeItem('examToken');
}

load();
