// =======================
// app.js für GitHub Pages
// =======================

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

async function loadData() {
  try {
    // Pfad: relative URL zu index.html
    const res = await fetch('./data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
  } catch (e) {
    console.error('Fehler beim Laden von data.json:', e);
    DATA = { users: {}, questions: {}, config: { defaultPoints: 0 } };
  }

  users = DATA.users || {};
  questions = DATA.questions || {};
  config = DATA.config || { defaultPoints: 0 };
}

// ===================
// UI Helper
// ===================
function showLogin(){ qs('#login-screen')?.classList.remove('hidden'); qs('#main-screen')?.classList.add('hidden'); }
function showMain(){ qs('#login-screen')?.classList.add('hidden'); qs('#main-screen')?.classList.remove('hidden'); }
function openModal(){ qs('#profile-modal')?.classList.remove('hidden'); }
function closeModal(){ qs('#profile-modal')?.classList.add('hidden'); }
function updateBarProfile(){
  if(!currentUser) {
    if(qs('#bar-name')) qs('#bar-name').textContent='—';
    if(qs('#bar-points')) qs('#bar-points').textContent='0';
    return;
  }
  if(qs('#bar-name')) qs('#bar-name').textContent=currentUser.name;
  if(qs('#bar-points')) qs('#bar-points').textContent=currentUser.points;
  if(qs('#modal-name')) qs('#modal-name').value=currentUser.name;
  if(qs('#modal-points')) qs('#modal-points').textContent=currentUser.points;
}

function randFrom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function pickQuestion(sub){ return randFrom(questions[sub] || []); }

function renderQuestion(q){
  if(!q){
    if(qs('#question-text')) qs('#question-text').textContent='Für dieses Fach sind noch keine Fragen vorhanden.';
    if(qs('#answers')) qs('#answers').innerHTML='';
    return;
  }
  currentQuestion = q;
  if(qs('#question-text')) qs('#question-text').textContent=q.question;
  const container = qs('#answers');
  container.innerHTML = '';
  q.answers.forEach(a=>{
    const btn=document.createElement('button');
    btn.className='ans-btn';
    btn.textContent=a;
    btn.dataset.answer=a;
    btn.addEventListener('click',()=>handleAnswer(a,btn));
    container.appendChild(btn);
  });
}

function showQuestionFor(subject){
  if(!subject) return;
  currentSubject=subject;
  qsa('.subject-btn').forEach(b=>b.classList.toggle('active', b.dataset.subject===subject));
  renderQuestion(pickQuestion(subject));
}

function disableAnswers(){ qsa('.ans-btn').forEach(b=>b.disabled=true); }

function handleAnswer(answer,btn){
  disableAnswers();
  if(!currentQuestion) return;
  const correct=currentQuestion.correct;
  if(answer===correct){
    btn.classList.add('correct');
    currentUser.points=(currentUser.points||0)+1;
    users[currentUser.name]={points:currentUser.points};
    localStorage.setItem('lernapp_users',JSON.stringify(users));
    updateBarProfile();
  } else {
    btn.classList.add('wrong');
    const corr=qsa('.ans-btn').find(b=>b.dataset.answer===correct);
    if(corr) corr.classList.add('correct');
  }
  if(nextQuestionTimeout) clearTimeout(nextQuestionTimeout);
  nextQuestionTimeout=setTimeout(()=>{showQuestionFor(currentSubject);},900);
}

function logout(){
  currentUser=null;
  updateBarProfile();
  showLogin();
}

// ===================
// Boot
// ===================
document.addEventListener('DOMContentLoaded', async()=>{
  await loadData();

  const loginBtn=qs('#login-btn');
  const input=qs('#username-input');
  const subjectBtns=qsa('.subject-btn');
  const profileBtn=qs('#profile-button');
  const closeModalBtn=qs('#close-modal-btn');
  const saveNameBtn=qs('#save-name-btn');
  const logoutBtn=qs('#logout-btn');

  loginBtn?.addEventListener('click',()=>{
    const name=input.value.trim();
    if(!name) return alert('Bitte gib deinen Namen ein.');
    const existing=users[name]||{points:config.defaultPoints||0};
    currentUser={name,points:existing.points||0};
    users[name]={points:currentUser.points};
    localStorage.setItem('lernapp_users',JSON.stringify(users));
    updateBarProfile();
    showMain();
    showQuestionFor('deutsch');
  });

  subjectBtns.forEach(b=>b.addEventListener('click',()=>{
    if(!currentUser){ alert('Bitte zuerst einloggen.'); return; }
    showQuestionFor(b.dataset.subject);
  }));

  profileBtn?.addEventListener('click',()=>{ if(currentUser) openModal(); });
  closeModalBtn?.addEventListener('click',closeModal);

  saveNameBtn?.addEventListener('click',()=>{
    const newName=qs('#modal-name').value.trim();
    if(!newName) return alert('Name darf nicht leer sein.');
    if(newName!==currentUser.name){
      users[newName]=users[currentUser.name];
      delete users[currentUser.name];
      currentUser.name=newName;
      localStorage.setItem('lernapp_users',JSON.stringify(users));
      updateBarProfile();
    }
    closeModal();
  });

  logoutBtn?.addEventListener('click',()=>{ closeModal(); logout(); });

  input.addEventListener('keydown',(e)=>{ if(e.key==='Enter') loginBtn.click(); });
});
