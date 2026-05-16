const token = sessionStorage.getItem('examToken');
const authHeaders = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

const state = {
  questions: [],
  answers: {}, // questionId -> [optionId]
  current: 0,
  expiresAt: 0,
  serverOffset: 0,
  finished: false,
};

// --- Medidas anti-trampa: bloquear copiar/pegar y menu contextual --------
['contextmenu', 'copy', 'cut', 'paste', 'dragstart', 'selectstart'].forEach((ev) => {
  document.addEventListener(ev, (e) => e.preventDefault());
});

// --- Elementos -----------------------------------------------------------
const el = (id) => document.getElementById(id);

function showLoadError(msg) {
  el('loadingView').querySelector('h1').textContent = 'No se pudo cargar el examen';
  const a = el('loadAlert');
  a.textContent = msg;
  a.classList.remove('hidden');
  const back = el('backHome');
  back.classList.remove('hidden');
  back.style.display = 'block';
}

function now() {
  return Date.now() + state.serverOffset;
}

// --- Carga inicial -------------------------------------------------------
async function init() {
  if (!token) {
    window.location.href = '/';
    return;
  }
  try {
    const res = await fetch('/api/exam/state', { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) {
      showLoadError(data.error || 'Sesion no valida.');
      return;
    }
    if (data.status === 'completed') {
      window.location.href = '/result.html';
      return;
    }
    state.questions = data.questions || [];
    state.answers = data.answers || {};
    state.expiresAt = Date.parse(data.expiresAt);
    state.serverOffset = Date.parse(data.serverNow) - Date.now();

    el('examTitleBar').textContent = data.examTitle || 'Examen';
    el('loadingView').classList.add('hidden');
    el('examView').classList.remove('hidden');

    buildPalette();
    renderQuestion();
    startTimer();
  } catch {
    showLoadError('Error de conexion. Recarga la pagina.');
  }
}

// --- Temporizador --------------------------------------------------------
let timerInterval;
function startTimer() {
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}
function updateTimer() {
  const remaining = Math.max(0, Math.floor((state.expiresAt - now()) / 1000));
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  el('timerText').textContent = `${m}:${s}`;

  const timer = el('timer');
  timer.classList.toggle('warning', remaining <= 300 && remaining > 60);
  timer.classList.toggle('danger', remaining <= 60);

  if (remaining <= 0 && !state.finished) {
    clearInterval(timerInterval);
    autoSubmit();
  }
}

// --- Render de pregunta --------------------------------------------------
function renderQuestion() {
  const q = state.questions[state.current];
  if (!q) return;

  el('questionNum').textContent = `Pregunta ${state.current + 1} de ${state.questions.length}`;
  const tag = el('questionTag');
  if (q.category) {
    tag.textContent = q.category;
    tag.classList.remove('hidden');
  } else {
    tag.classList.add('hidden');
  }
  el('questionText').textContent = q.text;

  const multiHint = document.querySelector('.question-card .hint');
  if (multiHint) multiHint.style.display = q.multiple ? 'block' : 'none';

  const box = el('optionsBox');
  box.innerHTML = '';
  const selected = state.answers[q.id] || [];
  const inputType = q.multiple ? 'checkbox' : 'radio';

  q.options.forEach((opt) => {
    const label = document.createElement('label');
    label.className = 'option' + (selected.includes(opt.id) ? ' selected' : '');

    const input = document.createElement('input');
    input.type = inputType;
    input.name = 'q_' + q.id;
    input.value = opt.id;
    input.checked = selected.includes(opt.id);
    input.addEventListener('change', () => onAnswerChange(q));

    const span = document.createElement('span');
    span.textContent = opt.text;

    label.appendChild(input);
    label.appendChild(span);
    box.appendChild(label);
  });

  el('progressFill').style.width =
    ((state.current + 1) / state.questions.length) * 100 + '%';
  el('prevBtn').disabled = state.current === 0;
  el('nextBtn').disabled = state.current === state.questions.length - 1;
  refreshPalette();
}

function onAnswerChange(q) {
  const inputs = [...document.querySelectorAll(`input[name="q_${q.id}"]`)];
  const chosen = inputs.filter((i) => i.checked).map((i) => Number(i.value));
  state.answers[q.id] = chosen;

  // Resalta visualmente la opcion seleccionada.
  inputs.forEach((i) => {
    i.closest('.option').classList.toggle('selected', i.checked);
  });

  saveAnswer(q.id, chosen);
  refreshPalette();
}

async function saveAnswer(questionId, selectedOptionIds) {
  try {
    await fetch('/api/exam/answer', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ questionId, selectedOptionIds }),
    });
  } catch {
    /* Se reintenta al finalizar el examen. */
  }
}

// --- Mapa de preguntas ---------------------------------------------------
function buildPalette() {
  const grid = el('paletteGrid');
  grid.innerHTML = '';
  state.questions.forEach((q, i) => {
    const btn = document.createElement('button');
    btn.textContent = i + 1;
    btn.addEventListener('click', () => {
      state.current = i;
      renderQuestion();
    });
    grid.appendChild(btn);
  });
}

function isAnswered(q) {
  return (state.answers[q.id] || []).length > 0;
}

function refreshPalette() {
  const buttons = el('paletteGrid').children;
  let answered = 0;
  state.questions.forEach((q, i) => {
    const b = buttons[i];
    if (!b) return;
    const done = isAnswered(q);
    if (done) answered++;
    b.classList.toggle('answered', done);
    b.classList.toggle('current', i === state.current);
  });
  el('answeredCount').textContent =
    `${answered} de ${state.questions.length} respondidas`;
}

// --- Navegacion ----------------------------------------------------------
el('prevBtn').addEventListener('click', () => {
  if (state.current > 0) {
    state.current--;
    renderQuestion();
  }
});
el('nextBtn').addEventListener('click', () => {
  if (state.current < state.questions.length - 1) {
    state.current++;
    renderQuestion();
  }
});

// --- Finalizar -----------------------------------------------------------
el('finishBtn').addEventListener('click', async () => {
  const answered = state.questions.filter(isAnswered).length;
  const pending = state.questions.length - answered;
  const msg =
    pending > 0
      ? `Tienes ${pending} pregunta(s) sin responder. Una vez finalizado no podras volver al examen. Deseas finalizar?`
      : 'Una vez finalizado no podras volver al examen. Deseas finalizar?';
  if (!confirm(msg)) return;
  await submitExam();
});

async function flushAnswers() {
  for (const q of state.questions) {
    if (state.answers[q.id]) {
      await saveAnswer(q.id, state.answers[q.id]);
    }
  }
}

async function submitExam() {
  if (state.finished) return;
  state.finished = true;
  clearInterval(timerInterval);
  el('finishBtn').disabled = true;
  el('finishBtn').textContent = 'Finalizando...';
  try {
    await flushAnswers();
    await fetch('/api/exam/submit', { method: 'POST', headers: authHeaders });
  } catch {
    /* El servidor califica igualmente al vencer el tiempo. */
  }
  window.location.href = '/result.html';
}

async function autoSubmit() {
  alert('Se agoto el tiempo. El examen se enviara automaticamente.');
  await submitExam();
}

init();
