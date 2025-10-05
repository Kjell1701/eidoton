// app.js (ES module)
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

async function loadData(){
  const res = await fetch('data.json');
  DATA = await res.json();
  config = DATA.config || { defaultPoints: 0 };
  users = DATA.users || {};
  questions = DATA.questions || {};
  // merge local users if exist
  try {
    const local = JSON.parse(localStorage.getItem('lernapp_users') || '{}');
    users = { ...users, ...local };
  } catch (e) {}
}

function showLogin(){ qs('#login-screen').classList.remove('hidden'); qs('#main-screen').classList.add('hidden'); }
function showMain(){ qs('#login-screen').classList.add('hidden'); qs('#main-screen').classList.remove('hidden'); }
function openModal(){ qs('#profile-modal').classList.remove('hidden'); }
function closeModal(){ qs('#profile-modal').classList.add('hidden'); }

function updateBarProfile(){
  if(!currentUser) {
    qs('#bar-name').textContent = '—';
    qs('#bar-points').textContent = '0';
    return;
  }
  qs('#bar-name').textContent = currentUser.name;
  qs('#bar-points').textContent = currentUser.points;
  qs('#modal-name').value = currentUser.name;
  qs('#modal-points').textContent = currentUser.points;
}

function randFrom(arr){ if(!arr || !arr.length) return null; return arr[Math.floor(Math.random()*arr.length)]; }
function pickQuestion(sub){ const list = questions[sub] || []; return randFrom(list); }

function renderQuestion(q){
  if(!q){
    qs('#question-text').textContent = 'Für dieses Fach sind noch keine Fragen vorhanden.';
    qs('#answers').innerHTML = '';
    return;
  }
  currentQuestion = q;
  qs('#question-text').textContent = q.question;
  const container = qs('#answers');
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
  // mark active
  qsa('.subject-btn').forEach(b => b.classList.toggle('active', b.dataset.subject === subject));
  // set header text (not visible now but we can show as question)
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
    localStorage.setItem('lernapp_users', JSON.stringify(users));
    updateBarProfile();
  } else {
    btn.classList.add('wrong');
    // highlight correct
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

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();

  // elements
  const loginBtn = qs('#login-btn');
  const demoBtn = qs('#demo-btn');
  const input = qs('#username-input');
  const subjectBtns = qsa('.subject-btn');
  const profileBtn = qs('#profile-button');
  const closeModalBtn = qs('#close-modal-btn');
  const saveNameBtn = qs('#save-name-btn');
  const logoutBtn = qs('#logout-btn');

  // quick-prefill from local users
  try {
    const local = JSON.parse(localStorage.getItem('lernapp_users') || '{}');
    const names = Object.keys(local);
    if(names.length) input.value = names[0];
  } catch(e){}

  loginBtn.addEventListener('click', () => {
    const name = input.value.trim();
    if(!name) return alert('Bitte gib deinen Namen ein.');
    const existing = users[name] || { points: config.defaultPoints || 0 };
    currentUser = { name, points: existing.points || 0 };
    users[name] = { points: currentUser.points };
    localStorage.setItem('lernapp_users', JSON.stringify(users));
    updateBarProfile();
    showMain();
    // default subject immediately show deutsch
    showQuestionFor('deutsch');
  });

  demoBtn.addEventListener('click', () => {
    input.value = 'Demo';
  });

  subjectBtns.forEach(b => b.addEventListener('click', () => {
    if(!currentUser){ alert('Bitte zuerst einloggen (Name eingeben).'); return; }
    const subject = b.dataset.subject;
    showQuestionFor(subject);
  }));

  profileBtn.addEventListener('click', () => {
    if(!currentUser){ alert('Bitte zuerst einloggen (Name eingeben).'); return; }
    openModal();
  });

  closeModalBtn.addEventListener('click', closeModal);

  saveNameBtn.addEventListener('click', () => {
    const newName = qs('#modal-name').value.trim();
    if(!newName) return alert('Name darf nicht leer sein.');
    if(newName === currentUser.name){ closeModal(); return; }
    // move user data to new name
    users[newName] = users[currentUser.name] || { points: currentUser.points || 0 };
    delete users[currentUser.name];
    currentUser.name = newName;
    // persist
    localStorage.setItem('lernapp_users', JSON.stringify(users));
    updateBarProfile();
    closeModal();
  });

  logoutBtn.addEventListener('click', () => {
    // do NOT remove localStorage users, just end session
    closeModal();
    logout();
  });

  // Keyboard: Enter to login
  input.addEventListener('keydown', (e) => { if(e.key === 'Enter') loginBtn.click(); });

  // Export users via longpress on profile (optional)
  profileBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault(); exportUsers();
  });

});
