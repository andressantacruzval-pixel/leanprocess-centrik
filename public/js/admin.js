let token = sessionStorage.getItem('adminToken');
let examsCache = [];
let selectedExamId = parseInt(sessionStorage.getItem('selectedExamId'), 10) || null;
let questionsCache = [];
let resultsCache = [];

const el = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function flash(msg, type = 'success') {
  const a = el('globalAlert');
  a.textContent = msg;
  a.className = 'alert alert-' + type;
  a.classList.remove('hidden');
  clearTimeout(flash._t);
  flash._t = setTimeout(() => a.classList.add('hidden'), 4500);
}

async function api(path, opts = {}) {
  const res = await fetch('/api/admin' + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error('Tu sesion expiro. Vuelve a ingresar.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ocurrio un error.');
  return data;
}

function btn(text, cls, onClick) {
  const b = document.createElement('button');
  b.textContent = text;
  b.className = cls;
  b.addEventListener('click', onClick);
  return b;
}

// --- Autenticacion -------------------------------------------------------
el('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  el('loginAlert').classList.add('hidden');
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: el('password').value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo ingresar.');
    token = data.token;
    sessionStorage.setItem('adminToken', token);
    showDashboard();
  } catch (err) {
    const a = el('loginAlert');
    a.textContent = err.message;
    a.classList.remove('hidden');
  }
});

el('logoutBtn').addEventListener('click', logout);
function logout() {
  sessionStorage.removeItem('adminToken');
  token = null;
  el('dashView').classList.add('hidden');
  el('loginView').classList.remove('hidden');
}

function showDashboard() {
  el('loginView').classList.add('hidden');
  el('dashView').classList.remove('hidden');
  loadExams();
  loadSettings();
  loadResults();
}

// --- Tabs ----------------------------------------------------------------
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
    el('tab-' + tab.dataset.tab).classList.remove('hidden');
  });
});

function switchTab(name) {
  document.querySelector(`.tab[data-tab="${name}"]`).click();
}

// --- Certificaciones (examenes) -----------------------------------------
async function loadExams() {
  try {
    const { exams } = await api('/exams');
    examsCache = exams;
    if (!exams.find((e) => e.id === selectedExamId)) {
      selectedExamId = exams.length ? exams[0].id : null;
    }
    if (selectedExamId) sessionStorage.setItem('selectedExamId', selectedExamId);
    renderExamSelector();
    renderExamsTable();
    renderResultsFilter();
    await refreshSelectedExam();
  } catch (err) {
    flash(err.message, 'error');
  }
}

function renderExamSelector() {
  const sel = el('examSelector');
  sel.innerHTML = '';
  examsCache.forEach((e) => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.name + (e.is_active ? '' : ' (inactiva)');
    sel.appendChild(opt);
  });
  if (selectedExamId) sel.value = selectedExamId;
  sel.classList.toggle('hidden', examsCache.length === 0);
  el('examContextEmpty').classList.toggle('hidden', examsCache.length > 0);
}

el('examSelector').addEventListener('change', () => {
  selectedExamId = parseInt(el('examSelector').value, 10) || null;
  if (selectedExamId) sessionStorage.setItem('selectedExamId', selectedExamId);
  refreshSelectedExam();
});

function renderExamsTable() {
  const tbody = el('examsTable');
  tbody.innerHTML = '';
  el('examCount').textContent = examsCache.length;
  el('noExams').classList.toggle('hidden', examsCache.length > 0);

  examsCache.forEach((e) => {
    const tr = document.createElement('tr');
    if (e.id === selectedExamId) tr.style.background = 'rgba(20,184,166,0.07)';
    tr.innerHTML = `
      <td><strong>${esc(e.name)}</strong></td>
      <td>${e.active_questions} activas / ${e.total_questions} totales</td>
      <td>${e.total_codes}</td>
      <td>${e.completed_attempts}</td>
      <td><span class="pill ${e.is_active ? 'green' : 'gray'}">${e.is_active ? 'Activa' : 'Inactiva'}</span></td>
      <td></td>`;
    const actions = tr.lastElementChild;
    actions.style.whiteSpace = 'nowrap';
    const manage = btn('Gestionar', 'btn-primary btn-sm', () => {
      selectedExamId = e.id;
      sessionStorage.setItem('selectedExamId', e.id);
      el('examSelector').value = e.id;
      refreshSelectedExam();
      switchTab('config');
    });
    const toggle = btn(e.is_active ? 'Desactivar' : 'Activar', 'btn-ghost btn-sm', () =>
      toggleExamActive(e)
    );
    const del = btn('Eliminar', 'btn-danger btn-sm', () => deleteExam(e));
    actions.append(manage, document.createTextNode(' '), toggle, document.createTextNode(' '), del);
    tbody.appendChild(tr);
  });
}

el('createExamBtn').addEventListener('click', async () => {
  const name = el('newExamName').value.trim();
  if (name.length < 3) {
    flash('Escribe el nombre de la certificacion.', 'error');
    return;
  }
  try {
    const { exam } = await api('/exams', { method: 'POST', body: JSON.stringify({ name }) });
    el('newExamName').value = '';
    selectedExamId = exam.id;
    sessionStorage.setItem('selectedExamId', exam.id);
    flash('Certificacion creada. Configurala y agrega su banco de preguntas.');
    await loadExams();
  } catch (err) {
    flash(err.message, 'error');
  }
});

async function toggleExamActive(e) {
  try {
    const { exam } = await api('/exams/' + e.id);
    await api('/exams/' + e.id, {
      method: 'PUT',
      body: JSON.stringify({
        name: exam.name,
        questionsPerExam: exam.questions_per_exam,
        passPercentage: exam.pass_percentage,
        durationMinutes: exam.duration_minutes,
        maxAttempts: exam.max_attempts,
        shuffleQuestions: exam.shuffle_questions,
        shuffleOptions: exam.shuffle_options,
        reviewMode: exam.review_mode,
        isActive: !exam.is_active,
        emailSubjectPass: exam.email_subject_pass,
        emailBodyPass: exam.email_body_pass,
        emailSubjectFail: exam.email_subject_fail,
        emailBodyFail: exam.email_body_fail,
      }),
    });
    flash(`Certificacion ${exam.is_active ? 'desactivada' : 'activada'}.`);
    loadExams();
  } catch (err) {
    flash(err.message, 'error');
  }
}

async function deleteExam(e) {
  if (
    !confirm(
      `Eliminar la certificacion "${e.name}"?\n\n` +
        'Se borraran TODAS sus preguntas, codigos de acceso y resultados. ' +
        'Esta accion no se puede deshacer.'
    )
  ) {
    return;
  }
  try {
    await api('/exams/' + e.id, { method: 'DELETE' });
    if (selectedExamId === e.id) selectedExamId = null;
    flash('Certificacion eliminada.');
    loadExams();
    loadResults();
  } catch (err) {
    flash(err.message, 'error');
  }
}

// --- Estado de la certificacion seleccionada ----------------------------
async function refreshSelectedExam() {
  const hasExam = !!selectedExamId;
  document.querySelectorAll('.needs-exam').forEach((n) => n.classList.toggle('hidden', hasExam));
  document.querySelectorAll('.exam-scoped').forEach((n) => n.classList.toggle('hidden', !hasExam));
  if (el('examSelector') && selectedExamId) el('examSelector').value = selectedExamId;
  if (!hasExam) return;
  await loadExamConfig();
  await loadQuestions();
  await loadCodes();
}

// --- Configuracion de la certificacion ----------------------------------
function statBox(num, label) {
  return `<div class="stat-box"><div class="num">${num}</div><div class="lbl">${esc(label)}</div></div>`;
}

async function loadExamConfig() {
  try {
    const { exam, stats } = await api('/exams/' + selectedExamId);
    el('cfgName').value = exam.name;
    el('cfgActive').checked = exam.is_active;
    el('cfgQuestions').value = exam.questions_per_exam;
    el('cfgPass').value = exam.pass_percentage;
    el('cfgDuration').value = exam.duration_minutes;
    el('cfgAttempts').value = exam.max_attempts;
    el('cfgReview').value = exam.review_mode;
    el('cfgShuffleQ').checked = exam.shuffle_questions;
    el('cfgShuffleO').checked = exam.shuffle_options;
    el('cfgSubjPass').value = exam.email_subject_pass || '';
    el('cfgBodyPass').value = exam.email_body_pass || '';
    el('cfgSubjFail').value = exam.email_subject_fail || '';
    el('cfgBodyFail').value = exam.email_body_fail || '';

    el('statsGrid').innerHTML = `
      ${statBox(stats.active_questions, 'Preguntas activas')}
      ${statBox(stats.total_questions, 'Preguntas totales')}
      ${statBox(stats.total_codes, 'Codigos emitidos')}
      ${statBox(stats.completed_attempts, 'Examenes rendidos')}`;

    const hint = el('bankHint');
    if (stats.active_questions < exam.questions_per_exam) {
      hint.textContent = `Atencion: solo hay ${stats.active_questions} preguntas activas. El examen no podra iniciar.`;
      hint.style.color = 'var(--danger)';
    } else {
      hint.textContent = `Hay ${stats.active_questions} preguntas activas disponibles.`;
      hint.style.color = 'var(--muted)';
    }
  } catch (err) {
    flash(err.message, 'error');
  }
}

el('configForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedExamId) return;
  try {
    await api('/exams/' + selectedExamId, {
      method: 'PUT',
      body: JSON.stringify({
        name: el('cfgName').value,
        isActive: el('cfgActive').checked,
        questionsPerExam: el('cfgQuestions').value,
        passPercentage: el('cfgPass').value,
        durationMinutes: el('cfgDuration').value,
        maxAttempts: el('cfgAttempts').value,
        reviewMode: el('cfgReview').value,
        shuffleQuestions: el('cfgShuffleQ').checked,
        shuffleOptions: el('cfgShuffleO').checked,
        emailSubjectPass: el('cfgSubjPass').value,
        emailBodyPass: el('cfgBodyPass').value,
        emailSubjectFail: el('cfgSubjFail').value,
        emailBodyFail: el('cfgBodyFail').value,
      }),
    });
    flash('Configuracion guardada correctamente.');
    loadExams();
  } catch (err) {
    flash(err.message, 'error');
  }
});

// --- Banco de preguntas --------------------------------------------------
async function loadQuestions() {
  try {
    const { questions } = await api('/exams/' + selectedExamId + '/questions');
    questionsCache = questions;
    el('questionCount').textContent = questions.length;
    const tbody = el('questionsTable');
    tbody.innerHTML = '';
    el('noQuestions').classList.toggle('hidden', questions.length > 0);

    questions.forEach((q) => {
      const tr = document.createElement('tr');
      const correct = q.options.filter((o) => o.is_correct).length;
      tr.innerHTML = `
        <td>${q.id}</td>
        <td>${esc(q.text.length > 70 ? q.text.slice(0, 70) + '...' : q.text)}</td>
        <td>${esc(q.category || '-')}</td>
        <td>${q.options.length} (${correct} correcta${correct !== 1 ? 's' : ''})</td>
        <td><span class="pill ${q.is_active ? 'green' : 'gray'}">${q.is_active ? 'Activa' : 'Inactiva'}</span></td>
        <td></td>`;
      const actions = tr.lastElementChild;
      actions.style.whiteSpace = 'nowrap';
      actions.append(
        btn('Editar', 'btn-ghost btn-sm', () => openQuestionModal(q)),
        document.createTextNode(' '),
        btn('Eliminar', 'btn-danger btn-sm', () => deleteQuestion(q))
      );
      tbody.appendChild(tr);
    });
  } catch (err) {
    flash(err.message, 'error');
  }
}

async function deleteQuestion(q) {
  if (!confirm(`Eliminar la pregunta #${q.id}? Esta accion no se puede deshacer.`)) return;
  try {
    await api('/questions/' + q.id, { method: 'DELETE' });
    flash('Pregunta eliminada.');
    loadQuestions();
    loadExamConfig();
    loadExams();
  } catch (err) {
    flash(err.message, 'error');
  }
}

el('newQuestionBtn').addEventListener('click', () => openQuestionModal(null));

function openModal(innerHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${innerHtml}</div>`;
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  el('modalRoot').appendChild(overlay);
  return overlay;
}

function openQuestionModal(q) {
  const isEdit = !!q;
  const overlay = openModal(`
    <h3>${isEdit ? 'Editar pregunta' : 'Nueva pregunta'}</h3>
    <div class="field">
      <label>Enunciado</label>
      <textarea id="qmText"></textarea>
    </div>
    <div class="panel-row">
      <div class="field"><label>Categoria (opcional)</label><input type="text" id="qmCategory" /></div>
      <div class="field"><label>Dificultad (opcional)</label><input type="text" id="qmDifficulty" /></div>
    </div>
    <div class="checkbox-row">
      <input type="checkbox" id="qmActive" checked />
      <label for="qmActive">Pregunta activa (se incluye en los examenes)</label>
    </div>
    <label style="font-weight:600; font-size:0.88rem;">Opciones (marca las correctas)</label>
    <div id="qmOptions" style="margin-top:8px;"></div>
    <button type="button" class="btn-ghost btn-sm" id="qmAddOption">+ Agregar opcion</button>
    <div id="qmAlert" class="alert alert-error hidden" style="margin-top:12px;"></div>
    <div class="modal-actions">
      <button type="button" class="btn-ghost" id="qmCancel">Cancelar</button>
      <button type="button" class="btn-primary" id="qmSave">Guardar</button>
    </div>`);

  const optionsBox = overlay.querySelector('#qmOptions');
  function addOptionRow(text = '', isCorrect = false) {
    const row = document.createElement('div');
    row.className = 'q-edit-option';
    row.innerHTML = `
      <input type="checkbox" ${isCorrect ? 'checked' : ''} title="Correcta" />
      <input type="text" placeholder="Texto de la opcion" />
      <button type="button" class="btn-danger btn-sm">X</button>`;
    row.querySelector('input[type="text"]').value = text;
    row.querySelector('.btn-danger').addEventListener('click', () => row.remove());
    optionsBox.appendChild(row);
  }

  if (isEdit) {
    overlay.querySelector('#qmText').value = q.text;
    overlay.querySelector('#qmCategory').value = q.category || '';
    overlay.querySelector('#qmDifficulty').value = q.difficulty || '';
    overlay.querySelector('#qmActive').checked = q.is_active;
    q.options.forEach((o) => addOptionRow(o.text, o.is_correct));
  } else {
    addOptionRow();
    addOptionRow();
  }

  overlay.querySelector('#qmAddOption').addEventListener('click', () => addOptionRow());
  overlay.querySelector('#qmCancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#qmSave').addEventListener('click', async () => {
    const options = [...optionsBox.querySelectorAll('.q-edit-option')].map((row) => ({
      text: row.querySelector('input[type="text"]').value.trim(),
      is_correct: row.querySelector('input[type="checkbox"]').checked,
    }));
    const body = {
      text: overlay.querySelector('#qmText').value.trim(),
      category: overlay.querySelector('#qmCategory').value.trim(),
      difficulty: overlay.querySelector('#qmDifficulty').value.trim(),
      is_active: overlay.querySelector('#qmActive').checked,
      options,
    };
    try {
      if (isEdit) {
        await api('/questions/' + q.id, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/exams/' + selectedExamId + '/questions', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      overlay.remove();
      flash(isEdit ? 'Pregunta actualizada.' : 'Pregunta creada.');
      loadQuestions();
      loadExamConfig();
      loadExams();
    } catch (err) {
      const a = overlay.querySelector('#qmAlert');
      a.textContent = err.message;
      a.classList.remove('hidden');
    }
  });
}

el('importBtn').addEventListener('click', () => {
  const overlay = openModal(`
    <h3>Importar preguntas desde CSV</h3>
    <p class="muted-text" style="margin-bottom:12px;">
      Las preguntas se agregan a la certificacion activa. Columnas:
      <strong>pregunta, categoria, dificultad, opcion_a, opcion_b, opcion_c,
      opcion_d, opcion_e, correctas</strong>. La columna "correctas" admite una
      o varias letras (ej. "A" o "A,C"). Las columnas categoria, dificultad y
      opcion_c/d/e son opcionales.
    </p>
    <div class="field">
      <label>Selecciona un archivo .csv</label>
      <input type="file" id="impFile" accept=".csv,text/csv" />
    </div>
    <div class="field">
      <label>O pega el contenido CSV aqui</label>
      <textarea id="impText" style="min-height:140px;" placeholder="pregunta,opcion_a,opcion_b,opcion_c,correctas&#10;Que es Lean?,...,...,...,A"></textarea>
    </div>
    <div id="impAlert" class="alert alert-error hidden"></div>
    <div class="modal-actions">
      <button type="button" class="btn-ghost" id="impCancel">Cancelar</button>
      <button type="button" class="btn-primary" id="impSave">Importar</button>
    </div>`);

  overlay.querySelector('#impFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      overlay.querySelector('#impText').value = reader.result;
    };
    reader.readAsText(file);
  });

  overlay.querySelector('#impCancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#impSave').addEventListener('click', async () => {
    const csv = overlay.querySelector('#impText').value.trim();
    if (!csv) {
      const a = overlay.querySelector('#impAlert');
      a.textContent = 'Selecciona un archivo o pega el contenido CSV.';
      a.classList.remove('hidden');
      return;
    }
    try {
      const { imported } = await api('/exams/' + selectedExamId + '/questions/import', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      overlay.remove();
      flash(`${imported} pregunta(s) importada(s) correctamente.`);
      loadQuestions();
      loadExamConfig();
      loadExams();
    } catch (err) {
      const a = overlay.querySelector('#impAlert');
      a.textContent = err.message;
      a.classList.remove('hidden');
    }
  });
});

// --- Codigos de acceso ---------------------------------------------------
async function loadCodes() {
  try {
    const { codes } = await api('/exams/' + selectedExamId + '/codes');
    el('codeCountLabel').textContent = codes.length;
    const tbody = el('codesTable');
    tbody.innerHTML = '';
    el('noCodes').classList.toggle('hidden', codes.length > 0);

    codes.forEach((c) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="code-chip">${esc(c.code)}</span></td>
        <td>${esc(c.student_name || '-')}</td>
        <td>${c.used_attempts}</td>
        <td><span class="pill ${c.is_active ? 'green' : 'gray'}">${c.is_active ? 'Activo' : 'Desactivado'}</span></td>
        <td></td>`;
      const actions = tr.lastElementChild;
      actions.style.whiteSpace = 'nowrap';
      const toggle = btn(c.is_active ? 'Desactivar' : 'Activar', 'btn-ghost btn-sm', async () => {
        try {
          await api('/codes/' + c.id, {
            method: 'PATCH',
            body: JSON.stringify({ is_active: !c.is_active }),
          });
          loadCodes();
        } catch (err) {
          flash(err.message, 'error');
        }
      });
      const del = btn('Eliminar', 'btn-danger btn-sm', async () => {
        if (!confirm(`Eliminar el codigo ${c.code}? Se borraran tambien sus intentos.`)) return;
        try {
          await api('/codes/' + c.id, { method: 'DELETE' });
          flash('Codigo eliminado.');
          loadCodes();
          loadResults();
        } catch (err) {
          flash(err.message, 'error');
        }
      });
      actions.append(toggle, document.createTextNode(' '), del);
      tbody.appendChild(tr);
    });
  } catch (err) {
    flash(err.message, 'error');
  }
}

el('generateCodesBtn').addEventListener('click', async () => {
  if (!selectedExamId) return;
  const names = el('codeNames').value
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean);
  const count = parseInt(el('codeCount').value, 10) || (names.length || 1);
  try {
    const { codes } = await api('/exams/' + selectedExamId + '/codes', {
      method: 'POST',
      body: JSON.stringify({ count, names }),
    });
    el('codeNames').value = '';
    flash(`${codes.length} codigo(s) generado(s).`);
    showGeneratedCodes(codes);
    loadCodes();
    loadExams();
  } catch (err) {
    flash(err.message, 'error');
  }
});

function showGeneratedCodes(codes) {
  const examName = (examsCache.find((e) => e.id === selectedExamId) || {}).name || '';
  const list = codes
    .map(
      (c) =>
        `<div class="code-chip" style="display:inline-block;margin:4px;">${esc(c.code)}` +
        (c.student_name ? ` &middot; ${esc(c.student_name)}` : '') +
        `</div>`
    )
    .join('');
  const overlay = openModal(`
    <h3>Codigos generados</h3>
    <p class="muted-text" style="margin-bottom:10px;">
      Certificacion: <strong>${esc(examName)}</strong>. Entrega estos codigos a los estudiantes:
    </p>
    <div>${list}</div>
    <div class="modal-actions">
      <button type="button" class="btn-primary" id="genClose">Listo</button>
    </div>`);
  overlay.querySelector('#genClose').addEventListener('click', () => overlay.remove());
}

// --- Resultados ----------------------------------------------------------
function renderResultsFilter() {
  const sel = el('filterExam');
  const current = sel.value;
  sel.innerHTML = '<option value="">Todas las certificaciones</option>';
  examsCache.forEach((e) => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.name;
    sel.appendChild(opt);
  });
  sel.value = current;
}

async function loadResults() {
  try {
    const { results } = await api('/results');
    resultsCache = results;
    renderResults();
  } catch (err) {
    flash(err.message, 'error');
  }
}

function filteredResults() {
  const examId = el('filterExam').value;
  const onlyPassed = el('filterPassed').checked;
  return resultsCache.filter((r) => {
    if (examId && String(r.exam_id) !== examId) return false;
    if (onlyPassed && !(r.status === 'completed' && r.passed)) return false;
    return true;
  });
}

function renderResults() {
  const rows = filteredResults();
  const tbody = el('resultsTable');
  tbody.innerHTML = '';
  el('noResults').classList.toggle('hidden', rows.length > 0);

  rows.forEach((r) => {
    const tr = document.createElement('tr');
    const done = r.status === 'completed';
    const verdict = !done
      ? '<span class="pill gray">En curso</span>'
      : r.passed
        ? '<span class="pill green">Aprobado</span>'
        : '<span class="pill red">Reprobado</span>';
    const switches =
      r.tab_switches > 0
        ? `<span class="pill red">${r.tab_switches}</span>`
        : '<span class="pill gray">0</span>';
    tr.innerHTML = `
      <td>${esc(r.student_name)}</td>
      <td>${esc(r.student_email || '-')}</td>
      <td>${esc(r.exam_name || '-')}</td>
      <td><span class="code-chip">${esc(r.code)}</span></td>
      <td>${done ? r.score + '%' : '-'}</td>
      <td>${verdict}</td>
      <td>${switches}</td>
      <td>${r.finished_at ? new Date(r.finished_at).toLocaleString('es') : '-'}</td>
      <td></td>`;
    tr.lastElementChild.appendChild(
      btn('Ver detalle', 'btn-ghost btn-sm', () => openResultModal(r.id))
    );
    tbody.appendChild(tr);
  });
}

el('filterExam').addEventListener('change', renderResults);
el('filterPassed').addEventListener('change', renderResults);

el('exportBtn').addEventListener('click', () => {
  const rows = filteredResults();
  if (!rows.length) {
    flash('No hay resultados para exportar.', 'error');
    return;
  }
  const headers = [
    'Estudiante', 'Correo', 'Certificacion', 'Codigo', 'Estado', 'Puntaje',
    'Resultado', 'Salidas del examen', 'Correo enviado', 'Inicio', 'Finalizado',
  ];
  const csvCell = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.join(',')];
  rows.forEach((r) => {
    const done = r.status === 'completed';
    lines.push(
      [
        r.student_name,
        r.student_email || '',
        r.exam_name || '',
        r.code,
        done ? 'Completado' : 'En curso',
        done ? r.score + '%' : '',
        done ? (r.passed ? 'Aprobado' : 'Reprobado') : '',
        r.tab_switches || 0,
        r.email_sent ? 'Si' : 'No',
        r.started_at ? new Date(r.started_at).toLocaleString('es') : '',
        r.finished_at ? new Date(r.finished_at).toLocaleString('es') : '',
      ]
        .map(csvCell)
        .join(',')
    );
  });
  const blob = new Blob(['﻿' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `resultados-examenes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

async function openResultModal(id) {
  try {
    const { attempt, review } = await api('/results/' + id);
    let reviewHtml = '<p class="muted-text">Este intento no esta finalizado.</p>';
    if (review) {
      reviewHtml = review
        .map((item) => {
          const opts = item.options
            .map((o) => {
              let cls = 'neutral';
              if (o.isCorrect) cls = 'correct';
              else if (o.wasSelected) cls = 'wrong';
              const mark = o.isCorrect ? '✓ ' : o.wasSelected ? '✗ ' : '';
              const tag = o.wasSelected ? '  (respuesta del estudiante)' : '';
              return `<div class="review-opt ${cls}">${mark}${esc(o.text)}${tag}</div>`;
            })
            .join('');
          return `<div class="review-item">
            <div class="rq"><span class="badge ${item.isCorrect ? 'ok' : 'no'}">${
              item.isCorrect ? 'Correcta' : 'Incorrecta'
            }</span> Pregunta ${item.number}</div>
            <div style="margin-bottom:8px;">${esc(item.text)}</div>${opts}</div>`;
        })
        .join('');
    }
    const verdict =
      attempt.status !== 'completed'
        ? 'En curso'
        : attempt.passed ? 'APROBADO' : 'REPROBADO';
    const switchLine =
      attempt.tabSwitches > 0
        ? `<p><strong>Salidas del examen:</strong> <span class="pill red">${attempt.tabSwitches}</span> ` +
          `(el estudiante abandono la pantalla durante la prueba)</p>`
        : '<p><strong>Salidas del examen:</strong> <span class="pill gray">0</span></p>';
    const overlay = openModal(`
      <h3>Detalle del examen</h3>
      <p><strong>Certificacion:</strong> ${esc(attempt.examName || '-')}</p>
      <p><strong>Estudiante:</strong> ${esc(attempt.studentName)}</p>
      <p><strong>Correo:</strong> ${esc(attempt.studentEmail || '-')}</p>
      <p><strong>Codigo:</strong> ${esc(attempt.code)}</p>
      <p><strong>Resultado:</strong> ${verdict}${
        attempt.status === 'completed' ? ' &middot; ' + attempt.score + '%' : ''
      }</p>
      ${switchLine}
      <p><strong>Correo de resultado enviado:</strong> ${attempt.emailSent ? 'Si' : 'No'}</p>
      <hr style="margin:14px 0; border:none; border-top:1px solid var(--border);" />
      ${reviewHtml}
      <div class="modal-actions">
        <button type="button" class="btn-primary" id="resClose">Cerrar</button>
      </div>`);
    overlay.querySelector('#resClose').addEventListener('click', () => overlay.remove());
  } catch (err) {
    flash(err.message, 'error');
  }
}

// --- Ajustes de correo ---------------------------------------------------
async function loadSettings() {
  try {
    const { settings } = await api('/settings');
    el('setEmailEnabled').checked = settings.email_enabled;
    el('setSmtpHost').value = settings.smtp_host || '';
    el('setSmtpPort').value = settings.smtp_port || 587;
    el('setSmtpSecure').checked = settings.smtp_secure;
    el('setSmtpUser').value = settings.smtp_user || '';
    el('setSmtpPass').value = '';
    el('setSmtpPass').placeholder = settings.smtp_pass_set ? '(sin cambios)' : 'Contrasena SMTP';
    el('setSmtpFrom').value = settings.smtp_from || '';
  } catch (err) {
    flash(err.message, 'error');
  }
}

el('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        emailEnabled: el('setEmailEnabled').checked,
        smtpHost: el('setSmtpHost').value,
        smtpPort: el('setSmtpPort').value,
        smtpSecure: el('setSmtpSecure').checked,
        smtpUser: el('setSmtpUser').value,
        smtpPass: el('setSmtpPass').value,
        smtpFrom: el('setSmtpFrom').value,
      }),
    });
    flash('Ajustes de correo guardados.');
    loadSettings();
  } catch (err) {
    flash(err.message, 'error');
  }
});

el('testEmailBtn').addEventListener('click', async () => {
  const to = el('testEmailTo').value.trim();
  if (!to) {
    flash('Ingresa un correo de destino para la prueba.', 'error');
    return;
  }
  const b = el('testEmailBtn');
  b.disabled = true;
  b.textContent = 'Enviando...';
  try {
    await api('/settings/test-email', { method: 'POST', body: JSON.stringify({ to }) });
    flash('Correo de prueba enviado correctamente.');
  } catch (err) {
    flash(err.message, 'error');
  } finally {
    b.disabled = false;
    b.textContent = 'Enviar prueba';
  }
});

// --- Arranque ------------------------------------------------------------
if (token) {
  showDashboard();
}
