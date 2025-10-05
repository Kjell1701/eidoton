// app.js (ES module)
let DATA = null;
let users = {};
let questions = {};
let config = { defaultPoints: 0 };
let currentUser = null;
let currentSubject = null;
let currentQuestion = null;
let nextQuestionTimeout = null;

const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

// --- helper: fetch data.json ---
async function loadData() {
  const res = await fetch('data.json');
  DATA = await res.json();
  config = DATA.config || { defaultPoints: 0 };
  users = DATA.users || {};
  questions = DATA.questions || {};
  // If there are users saved locally in previous sessions, merge
  const local = localStorage.getItem('lernapp_users');
  if (local) {
    try {
      const lyst = JSON.parse(local);
      users = { ...users, ...lyst };
    } catch(e){ /* ignore */ }
  }
}

// --- UI updates ---
function showLogin() {
  qs('#login-screen').classList.remove('hidden');
  qs('#main-screen').classList.add('hidden');
}

function showMain() {
  qs('#login-screen').classList.add('hidden');
  qs('#main-screen').classList.remove('hidden');
}

function updateProfileUI() {
  if (!currentUser) return;
  qs('#profile-name').textContent = currentUser.name;
  qs('#profile-points').textContent = `${currentUser.points} Punkte`;
  qs('#profile-name-big').textContent = currentUser.name;
  qs('#profile-points-big').textContent = `${currentUser.points} Punkte`;
}

// --- question logic ---
function randFrom(arr){
  if(!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickQuestion(subject){
  const list = questions[subject] || [];
  return randFrom(list);
}

function clearAnswerButtons(){
  const container = qs('#answers');
  container.innerHTML = '';
}

function showQuestionFor(subject){
  if(!subject) return;
  currentSubject = subject;
  // Update header title
  const title = subject[0].toUpperCase() + subject.slice(1);
  qs('#subject-title').textContent = title;

  // mark active button
  qsa('.subject-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.subject === subject);
  });

  // pick & render question
  currentQuestion = pickQuestion(subject);
  if(!currentQuestion){
    qs('#question-text').textContent = 'Für dieses Fach sind noch keine Fragen vorhanden.';
    clearAnswerButtons();
    return;
  }

  qs('#question-text').textContent = currentQuestion.question;
  const ansBox = qs('#answers');
  ansBox.innerHTML = '';

  // create buttons (larger tappable)
  currentQuestion.answers.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'ans-btn';
    btn.textContent = a;
    btn.dataset.answer = a;
    btn.addEventListener('click', () => handleAnswer(a, btn));
    ansBox.appendChild(btn);
  });
}

function disableAnswerButtons(){
  qsa('.ans-btn').forEach(b => b.disabled = true);
}

function handleAnswer(answer, btnElement){
  // prevent double clicks
  disableAnswerButtons();

  const correct = currentQuestion.correct;
  if(answer === correct){
    btnElement.classList.add('correct');
    currentUser.points = (currentUser.points || 0) + 1;
    // persist to localStorage
    users[currentUser.name] = { points: currentUser.points };
    localStorage.setItem('lernapp_users', JSON.stringify(users));
    updateProfileUI();
  } else {
    btnElement.classList.add('wrong');
    // optionally highlight correct
    const corrBtn = qsa('.ans-btn').find(b => b.dataset.answer === correct);
    if (corrBtn) corrBtn.classList.add('correct');
  }

  // next question after short delay
  if (nextQuestionTimeout) clearTimeout(nextQuestionTimeout);
  nextQuestionTimeout = setTimeout(() => {
    showQuestionFor(currentSubject);
  }, 900);
}

// --- saving/export ---
function exportUsers(){
  const blob = new Blob([JSON.stringify(users, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'users-export.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resetLocalStorage(){
  localStorage.removeItem('lernapp_users');
  // reload default users from DATA
  users = DATA.users || {};
  alert('Lokaler Speicher zurückgesetzt. Seite neu laden.');
  location.reload();
}

// --- events / boot ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();

  // elements
  const loginBtn = qs('#login-btn');
  const demoBtn = qs('#demo-btn');
  const input = qs('#username-input');
  const subjectBtns = qsa('.subject-btn');
  const exportBtn = qs('#export-btn');
  const resetBtn = qs('#resetlocal-btn');

  loginBtn.addEventListener('click', () => {
    const name = input.value.trim();
    if(!name) return alert('Bitte gib deinen Namen ein.');
    const existing = users[name] || { points: config.defaultPoints || 0 };
    currentUser = { name, points: existing.points || 0 };
    // ensure in users object
    users[name] = { points: currentUser.points };
    // persist locally
    localStorage.setItem('lernapp_users', JSON.stringify(users));
    updateProfileUI();
    showMain();
    // default subject = deutsch
    showQuestionFor('deutsch');
  });

  demoBtn.addEventListener('click', () => {
    input.value = 'Demo';
  });

  subjectBtns.forEach(b => {
    b.addEventListener('click', () => {
      if (!currentUser) {
        // if not logged in, encourage to login first but still allow preview:
        showLogin();
        alert('Bitte zuerst einloggen (Name eingeben).');
        return;
      }
      const subject = b.dataset.subject;
      showQuestionFor(subject);
    });
  });

  exportBtn.addEventListener('click', exportUsers);
  resetBtn.addEventListener('click', resetLocalStorage);

  // If there's a remembered user in localStorage, prefill name for convenience
  try {
    const local = JSON.parse(localStorage.getItem('lernapp_users') || '{}');
    const keys = Object.keys(local);
    if(keys.length) {
      qs('#username-input').value = keys[0];
    }
  } catch(e){}
});
