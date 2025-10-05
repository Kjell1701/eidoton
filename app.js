// app.js (robuste Version: entfernt BOM + versucht "salvage" bei extra Zeichen)
let DATA = null;
let users = {};
let questions = {};
let config = { defaultPoints: 0 };
let currentUser = null;
let currentSubject = null;
let currentQuestion = null;
let nextQuestionTimeout = null;

const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));

/**
 * loadData:
 * - fetch als text()
 * - entfernt BOM (\uFEFF)
 * - versucht JSON.parse, falls Fehler -> versucht Substring von erstem "{" bis letztem "}" (salvage)
 * - bei totalem Fehler -> Fallback defaults
 */
async function loadData(){
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let text = await res.text();

    // Entferne UTF-8 BOM falls vorhanden
    if (text.charCodeAt(0) === 0xFEFF) {
      console.warn('BOM entfernt von data.json');
      text = text.replace(/^\uFEFF/, '');
    }

    // Trimmt führende unsichtbare Zeichen vor erstem brace (sicherheit)
    const firstBrace = text.search(/[\{\[]/);
    if (firstBrace > 0) {
      console.warn('Entferne führende Zeichen vor erstem JSON-Token');
      text = text.slice(firstBrace);
    }

    // Versuche normales Parsen
    try {
      DATA = JSON.parse(text);
    } catch (parseErr) {
      console.warn('Erster JSON-Parse fehlgeschlagen, versuche salvage...', parseErr);

      // Versuche salvage: von erstem "{" bis letztem "}" schneiden
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const sub = text.slice(start, end + 1);
        try {
          DATA = JSON.parse(sub);
          console.warn('Salvage erfolgreich (geschnittenes Substring).');
        } catch (parseErr2) {
          console.error('Salvage-Parse fehlgeschlagen:', parseErr2);
          throw parseErr2; // weiter nach unten auf Default
        }
      } else {
        throw parseErr;
      }
    }

  } catch (e) {
    console.error('Konnte data.json nicht sauber laden/parsen — verwende Defaults. Fehler:', e);
    DATA = {
      config: { defaultPoints: 0 },
      users: {},
      questions: {}
    };
  }

  config = DATA.config || { defaultPoints: 0 };
  users = DATA.users || {};
  questions = DATA.questions || {};

  // Merge lokale gespeicherte Nutzer (localStorage), falls vorhanden
  try {
    const local = JSON.parse(localStorage.getItem('lernapp_users') || '{}');
    users = { ...users, ...local };
  } catch (e) {
    console.warn('Fehler beim Parsen von localStorage lernapp_users', e);
  }

  console.info('DATA geladen. users keys:', Object.keys(users).length, 'questions keys:', Object.keys(questions).length);
}

// --- UI Helper ---
function showLogin(){ qs('#login-screen')?.classList.remove('hidden'); qs('#main-screen')?.classList.add('hidden'); }
function showMain(){ qs('#login-screen')?.classList.add('hidden'); qs('#main-screen')?.classList.remove('hidden'); }
function openModal(){ qs('#profile-modal')?.classList.remove('hidden'); }
function closeModal(){ qs('#profile-modal')?.classList.add('hidden'); }

function updateBarProfile(){
  if(!currentUser) {
    if (qs('#bar-name')) qs('#bar-name').textContent = '—';
    if (qs('#bar-points')) qs('#bar-points').textContent = '0';
    return;
  }
  if (qs('#bar-name')) qs('#bar-name').textContent = currentUser.name;
  if (qs('#bar-points')) qs('#bar-points').textContent = currentUser.points;
  if (qs('#modal-name')) qs('#modal-name').value = currentUser.name;
  if (qs('#modal-points')) qs('#modal-points').textContent = currentUser.points;
}

function randFrom(arr){ if(!arr || !arr.length) return null; return arr[Math.floor(Math.random()*arr.length)]; }
function pickQuestion(sub){ const list = questions[sub] || []; return randFrom(list); }

function renderQuestion(q){
  if(!q){
    if (qs('#question-text')) qs('#question-text').textContent = 'Für dieses Fach sind noch keine Fragen vorhanden.';
    if (qs('#answers')) qs('#answers').innerHTML = '';
    return;
  }
  currentQuestion = q;
  if (qs('#question-text')) qs('#question-text').textContent = q.question;
  const container = qs('#answers');
  if (!container) return;
  container.innerHTML = '';
  q.answers.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'ans-btn';
    btn.textContent = a;
    btn.dataset.answer = a;
    btn.addEventListener('click', () => handleAnswer(a, btn));
    container.appendChild(btn);
  });
}

function showQuestionFor(subject){
  if(!subject) return;
  currentSubject = subject;
  qsa('.subject-btn').forEach(b => b.classList.toggle('active', b.dataset.subject === subject));
  const q = pickQuestion(subject);
  renderQuestion(q);
}

function disableAnswers(){ qsa('.ans-btn').forEach(b => b.disabled = true); }

function handleAnswer(answer, btn){
  disableAnswers();
  if(!currentQuestion) return;
  const correct = currentQuestion.correct;
  if(answer === correct){
    btn.classList.add('correct');
    currentUser.points = (currentUser.points||0) + 1;
    users[currentUser.name] = { points: currentUser.points };
    try { localStorage.setItem('lernapp_users', JSON.stringify(users)); } catch(e){ console.warn('localStorage write failed', e); }
    updateBarProfile();
  } else {
    btn.classList.add('wrong');
    const corr = qsa('.ans-btn').find(b => b.dataset.answer === correct);
    if(corr) corr.classList.add('correct');
  }
  if(nextQuestionTimeout) clearTimeout(nextQuestionTimeout);
  nextQuestionTimeout = setTimeout(() => {
    showQuestionFor(currentSubject);
  }, 900);
}

function exportUsers(){
  const blob = new Blob([JSON.stringify(users, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'users-export.json';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function logout(){
  currentUser = null;
  updateBarProfile();
  showLogin();
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();

  const loginBtn = qs('#login-btn');
  const demoBtn = qs('#demo-btn');
  const input = qs('#username-input');
  const subjectBtns = qsa('.subject-btn');
  const profileBtn = qs('#profile-button');
  const closeModalBtn = qs('#close-modal-btn');
  const saveNameBtn = qs('#save-name-btn');
  const logoutBtn = qs('#logout-btn');

  if(!loginBtn || !input) {
    console.error('Wichtige UI-Elemente fehlen (login-btn / username-input). Prüfe index.html.');
    return;
  }

  // prefill from local users if any
  try {
    const local = JSON.parse(localStorage.getItem('lernapp_users') || '{}');
    const names = Object.keys(local);
    if(names.length) input.value = names[0];
  } catch(e){ /* ignore */ }

  loginBtn.addEventListener('click', () => {
    const name = input.value.trim();
    if(!name) return alert('Bitte gib deinen Namen ein.');
    const existing = users[name] || { points: config.defaultPoints || 0 };
    currentUser = { name, points: existing.points || 0 };
    users[name] = { points: currentUser.points };
    try { localStorage.setItem('lernapp_users', JSON.stringify(users)); } catch(e){ console.warn('localStorage write failed', e); }
    updateBarProfile();
    showMain();
    showQuestionFor('deutsch');
  });

  if(demoBtn) demoBtn.addEventListener('click', () => { input.value = 'Demo'; });

  subjectBtns.forEach(b => b.addEventListener('click', () => {
    if(!currentUser){ alert('Bitte zuerst einloggen (Name eingeben).'); return; }
    const subject = b.dataset.subject;
    showQuestionFor(subject);
  }));

  if(profileBtn) profileBtn.addEventListener('click', () => {
    if(!currentUser){ alert('Bitte zuerst einloggen (Name eingeben).'); return; }
    openModal();
  });

  if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

  if(saveNameBtn) saveNameBtn.addEventListener('click', () => {
    const newName = qs('#modal-name').value.trim();
    if(!newName) return alert('Name darf nicht leer sein.');
    if(newName === currentUser.name){ closeModal(); return; }
    users[newName] = users[currentUser.name] || { points: currentUser.points || 0 };
    delete users[currentUser.name];
    currentUser.name = newName;
    try { localStorage.setItem('lernapp_users', JSON.stringify(users)); } catch(e){ console.warn('localStorage write failed', e); }
    updateBarProfile();
    closeModal();
  });

  if(logoutBtn) logoutBtn.addEventListener('click', () => { closeModal(); logout(); });

  input.addEventListener('keydown', (e) => { if(e.key === 'Enter') loginBtn.click(); });

  if(profileBtn) profileBtn.addEventListener('contextmenu', (e) => { e.preventDefault(); exportUsers(); });
});
