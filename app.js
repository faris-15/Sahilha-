// ========= سهلها - Sahilha App =========
const STORAGE_KEY = 'sahilha_data_v1';

const defaultState = {
  subjects: [],          // {id,name,notes,minutes,exams:[{id,title,date}]}
  sessions: 0,
  totalMinutes: 0,
  lastStudyDate: null,
  streak: 0,
  earnedBadges: [],
};

let state = load();

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return structuredClone(defaultState);
    return {...structuredClone(defaultState), ...JSON.parse(raw)};
  }catch(e){return structuredClone(defaultState)}
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
const uid = ()=> Math.random().toString(36).slice(2,9);

// ========= Navigation =========
const navLinks = document.querySelectorAll('.nav-link');
const views = document.querySelectorAll('.view');
navLinks.forEach(l=>{
  l.addEventListener('click',()=>{
    navLinks.forEach(x=>x.classList.remove('active'));
    l.classList.add('active');
    const t = l.dataset.target;
    views.forEach(v=>v.classList.toggle('active', v.id===t));
    if(t==='stats'){
      renderStatsSummary();
      renderChart();
    }
    document.querySelector('.sidebar').classList.remove('open');
  });
});
document.getElementById('menuToggle').addEventListener('click',()=>{
  document.querySelector('.sidebar').classList.toggle('open');
});

// ========= Greeting / Date =========
function setGreeting(){
  const h = new Date().getHours();
  let g = 'أهلاً بك';
  if(h<12) g='صباح الخير ☀️';
  else if(h<18) g='مساء الخير 🌤️';
  else g='مساء النور 🌙';
  document.getElementById('greetingText').textContent = g + ' يا طالب أم القرى';
  document.getElementById('dateText').textContent = new Date().toLocaleDateString('ar-SA',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}

// ========= Tips =========
const TIPS = [
  'قسّم وقت مذاكرتك إلى جلسات قصيرة باستخدام تقنية بومودورو لزيادة التركيز.',
  'راجع ملاحظاتك خلال 24 ساعة من المحاضرة لتثبيت المعلومة.',
  'النوم الكافي (7-8 ساعات) أهم من السهر للمذاكرة.',
  'اشرح ما تعلمته بصوت عالٍ، فهي أفضل طريقة لاختبار فهمك.',
  'اشرب الماء بانتظام أثناء المذاكرة للحفاظ على التركيز.',
];

let _tipsList = null;
let _tipIntervalId = null;

function parseTipsFromText(text){
  // Treat each non-empty line as a separate tip
  return text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
}

function pickRandomTipFromSegment(tips){
  const n = tips.length;
  if(n===0) return null;
  if(n<3) return tips[Math.floor(Math.random()*n)];
  const seg = Math.floor(Math.random()*3); // 0: start, 1: middle, 2: end
  const segSize = Math.ceil(n/3);
  const start = Math.min(seg * segSize, n-1);
  const end = Math.min(start + segSize, n);
  const idx = start + Math.floor(Math.random() * (end - start));
  return tips[idx];
}

function updateTip(){
  const el = document.getElementById('dailyTip');
  const source = _tipsList && _tipsList.length ? _tipsList : TIPS;
  const tip = pickRandomTipFromSegment(source) || '';
  try{
    el.style.transition = 'opacity .35s';
    el.style.opacity = 0;
    setTimeout(()=>{ el.textContent = tip; el.style.opacity = 1; }, 200);
  }catch(e){
    el.textContent = tip;
  }
}

function initializeTips(){
  // Clear any existing interval
  if(_tipIntervalId) clearInterval(_tipIntervalId);

  // Try loading `quist.txt` from the same folder
  fetch('quist.txt').then(r=>{
    if(!r.ok) throw new Error('no file');
    return r.text();
  }).then(txt=>{
    _tipsList = parseTipsFromText(txt);
  }).catch(()=>{
    _tipsList = null; // fallback to built-in TIPS
  }).finally(()=>{
    updateTip();
    // rotate every 2 minutes (120000 ms)
    _tipIntervalId = setInterval(updateTip, 120000);
  });
}

// ========= Streak =========
function updateStreak(){
  const today = new Date().toDateString();
  if(state.lastStudyDate === today) return;
  const yest = new Date(Date.now()-86400000).toDateString();
  if(state.lastStudyDate === yest) state.streak += 1;
  else state.streak = 1;
  state.lastStudyDate = today;
  save();
}

// ========= Dashboard =========
function renderDashboard(){
  document.getElementById('totalMinutes').textContent = state.totalMinutes;
  document.getElementById('subjectsCount').textContent = state.subjects.length;
  document.getElementById('sessionsCount').textContent = state.sessions;
  document.getElementById('badgesEarned').textContent = state.earnedBadges.length;
  document.getElementById('streakCount').textContent = state.streak;

  const list = document.getElementById('upcomingExams');
  const exams = [];
  state.subjects.forEach(s=> s.exams.forEach(e=> exams.push({...e, subject:s.name})));
  exams.sort((a,b)=> new Date(a.date) - new Date(b.date));
  const upcoming = exams.filter(e=> new Date(e.date) >= new Date(new Date().toDateString()));
  if(upcoming.length===0){
    list.innerHTML = '<li class="empty">لا توجد اختبارات قادمة</li>';
  }else{
    list.innerHTML = upcoming.slice(0,6).map(e=>{
      const d = new Date(e.date).toLocaleDateString('ar-SA',{month:'short',day:'numeric',weekday:'short'});
      return `<li><span><strong>${escapeHtml(e.title)}</strong> · ${escapeHtml(e.subject)}</span><span style="color:var(--gold-soft)">${d}</span></li>`;
    }).join('');
  }
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

// ========= Subjects =========
const subjectsList = document.getElementById('subjectsList');
const newSubjectInput = document.getElementById('newSubjectInput');
document.getElementById('addSubjectBtn').addEventListener('click', addSubject);
newSubjectInput.addEventListener('keydown', e=>{ if(e.key==='Enter') addSubject(); });

function addSubject(){
  const name = newSubjectInput.value.trim();
  if(!name) return;
  state.subjects.push({id:uid(),name,notes:'',minutes:0,exams:[]});
  newSubjectInput.value='';
  save(); renderAll();
}

function renderSubjects(){
  if(state.subjects.length===0){
    subjectsList.innerHTML = '<div class="glass panel" style="text-align:center;color:var(--muted)">لم تضف أي مادة بعد. ابدأ بإضافة مواد الفصل 📚</div>';
    return;
  }
  subjectsList.innerHTML = state.subjects.map(s=>`
    <div class="glass subject-card" data-id="${s.id}">
      <div class="subject-head">
        <h3>${escapeHtml(s.name)}</h3>
        <button class="btn danger" data-act="del">حذف</button>
      </div>
      <div class="subject-meta">⏱️ ${s.minutes} دقيقة مذاكرة</div>

      <div>
        <div class="section-label">📝 الملاحظات</div>
        <textarea data-act="notes" placeholder="اكتب ملاحظاتك حول هذه المادة...">${escapeHtml(s.notes)}</textarea>
      </div>

      <div>
        <div class="section-label">📅 الاختبارات والكويزات</div>
        <div class="exam-add">
          <input class="input" data-act="exam-title" placeholder="اسم الاختبار/الكويز" />
          <input class="input" type="date" data-act="exam-date" />
          <button class="btn primary" data-act="exam-add">إضافة</button>
        </div>
        <ul class="exams-mini" style="margin-top:10px">
          ${s.exams.map(e=>`<li><span>${escapeHtml(e.title)} · <span style="color:var(--gold-soft)">${new Date(e.date).toLocaleDateString('ar-SA')}</span></span><button data-act="exam-del" data-eid="${e.id}">✕</button></li>`).join('') || '<li style="color:var(--muted);justify-content:center">لا توجد اختبارات مضافة</li>'}
        </ul>
      </div>
    </div>
  `).join('');

  subjectsList.querySelectorAll('.subject-card').forEach(card=>{
    const id = card.dataset.id;
    const sub = state.subjects.find(x=>x.id===id);
    card.querySelector('[data-act="del"]').onclick = ()=>{
      if(confirm('حذف هذه المادة؟')){ state.subjects = state.subjects.filter(x=>x.id!==id); save(); renderAll(); }
    };
    card.querySelector('[data-act="notes"]').addEventListener('input', e=>{ sub.notes = e.target.value; save(); });
    card.querySelector('[data-act="exam-add"]').onclick = ()=>{
      const t = card.querySelector('[data-act="exam-title"]').value.trim();
      const d = card.querySelector('[data-act="exam-date"]').value;
      if(!t || !d) return alert('أدخل اسم الاختبار والتاريخ');
      sub.exams.push({id:uid(),title:t,date:d});
      save(); renderAll();
    };
    card.querySelectorAll('[data-act="exam-del"]').forEach(b=>{
      b.onclick = ()=>{ sub.exams = sub.exams.filter(e=>e.id!==b.dataset.eid); save(); renderAll(); };
    });
  });

  // Update timer subject select
  const sel = document.getElementById('timerSubject');
  sel.innerHTML = '<option value="">— بدون ربط بمادة —</option>' + state.subjects.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

// ========= Pomodoro =========
let focusMinutes = 25, breakMinutes = 5;
let mode = 'focus';
let secondsLeft = focusMinutes * 60;
let timerId = null;
let running = false;

const focusInput = document.getElementById('focusLength');
const breakInput = document.getElementById('breakLength');
const timerText = document.getElementById('timerText');
const ringFg = document.getElementById('ringFg');
const RING_LEN = 2 * Math.PI * 90;
ringFg.style.strokeDasharray = RING_LEN;

document.querySelectorAll('.mode').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.mode').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    mode = b.dataset.mode;
    resetTimer();
  });
});

function renderModeLabels(){
  document.querySelector('.mode[data-mode="focus"]').textContent = `مذاكرة (${focusMinutes}د)`;
  document.querySelector('.mode[data-mode="break"]').textContent = `راحة (${breakMinutes}د)`;
}

function updateDurationSettings(){
  focusMinutes = Number(focusInput.value) || 25;
  breakMinutes = Number(breakInput.value) || 5;
  renderModeLabels();
  if(!running) resetTimer();
}

focusInput.addEventListener('change', updateDurationSettings);
breakInput.addEventListener('change', updateDurationSettings);
focusInput.addEventListener('blur', updateDurationSettings);
breakInput.addEventListener('blur', updateDurationSettings);

function totalSeconds(){ return (mode==='focus'?focusMinutes:breakMinutes)*60; }

function renderTimer(){
  const m = String(Math.floor(secondsLeft/60)).padStart(2,'0');
  const s = String(secondsLeft%60).padStart(2,'0');
  timerText.textContent = `${m}:${s}`;
  const pct = secondsLeft / totalSeconds();
  ringFg.style.strokeDashoffset = RING_LEN * (1 - pct);
}

function startTimer(){
  if(running) return;
  running = true;
  timerId = setInterval(()=>{
    secondsLeft--;
    if(secondsLeft<=0){
      clearInterval(timerId); running=false;
      onComplete();
      return;
    }
    renderTimer();
  },1000);
}
function pauseTimer(){ running=false; clearInterval(timerId); }
function resetTimer(){ pauseTimer(); secondsLeft = totalSeconds(); renderTimer(); }

function onComplete(){
  playBeep();
  if(mode==='focus'){
    state.sessions += 1;
    state.totalMinutes += focusMinutes;
    const subId = document.getElementById('timerSubject').value;
    if(subId){
      const s = state.subjects.find(x=>x.id===subId);
      if(s) s.minutes += focusMinutes;
    }
    updateStreak();
    checkBadges();
    save();
    notify('انتهت جلسة المذاكرة! 🎉 خذ راحة 5 دقائق.');
  }else{
    notify('انتهت الراحة! ✨ هيا لجلسة جديدة.');
  }
  resetTimer();
  renderAll();
}

function playBeep(){
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 520;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    osc.stop(ctx.currentTime + 0.7);
    osc.onended = ()=>ctx.close();
  }catch(e){ }
}

function notify(msg){
  try{
    if('Notification' in window && Notification.permission==='granted'){
      new Notification('سهلها', {body: msg});
    }
  }catch(e){}
  alert(msg);
}

document.getElementById('startBtn').onclick = ()=>{
  if('Notification' in window && Notification.permission==='default') Notification.requestPermission();
  startTimer();
};
document.getElementById('pauseBtn').onclick = pauseTimer;
document.getElementById('resetBtn').onclick = resetTimer;

// ========= Stats / Chart =========
let chart = null;
function renderChart(){
  const ctx = document.getElementById('statsChart');
  if(!ctx) return;
  const labels = state.subjects.map(s=>s.name);
  const data = state.subjects.map(s=>s.minutes);
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type:'bar',
    data:{
      labels: labels.length?labels:['بدون بيانات'],
      datasets:[{
        label:'دقائق المذاكرة',
        data: data.length?data:[0],
        backgroundColor:'rgba(31,75,42,.65)',
        borderColor:'#1f4b2a',
        borderWidth:2,
        borderRadius:10,
        maxBarThickness:60,
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        title:{display:true,text:'وقت المذاكرة لكل مادة',color:'#1f3630',font:{size:16}}
      },
      scales:{
        x:{title:{display:true,text:'المادة',color:'#a9b6d4'},ticks:{color:'#a9b6d4'},grid:{color:'rgba(255,255,255,.05)'}},
        y:{title:{display:true,text:'الدقائق',color:'#a9b6d4'},ticks:{color:'#a9b6d4',beginAtZero:true},grid:{color:'rgba(255,255,255,.08)'}}
      }
    }
  });
}

function renderStatsSummary(){
  const total = state.totalMinutes;
  const subjectsCount = state.subjects.length;
  const average = subjectsCount ? Math.round(total / subjectsCount) : 0;
  const topSubject = state.subjects.reduce((best,s)=> s.minutes > (best.minutes||0) ? s : best, {});
  document.getElementById('statsTotalTime').textContent = `${total} د`;
  document.getElementById('statsAverage').textContent = `${average} د`;
  document.getElementById('statsTopSubject').textContent = subjectsCount ? escapeHtml(topSubject.name) : '—';
}

// ========= Badges =========
const BADGES = [
  {id:'prof',  emoji:'👨‍🏫', name:'بروفيسور', desc:'أكمل 10 جلسات بومودورو', check:s=>s.sessions>=10},
  {id:'da7i7', emoji:'🧠', name:'دحيح الجامعة', desc:'ذاكر 500 دقيقة (~8 ساعات)', check:s=>s.totalMinutes>=500},
  {id:'genius',emoji:'🏆', name:'عبقري أم القرى', desc:'حافظ على سلسلة 7 أيام مذاكرة', check:s=>s.streak>=7},
  {id:'starter',emoji:'🌱', name:'البداية الصحيحة', desc:'أكمل أول جلسة مذاكرة', check:s=>s.sessions>=1},
  {id:'organized',emoji:'📚', name:'منظم', desc:'أضف 3 مواد على الأقل', check:s=>s.subjects.length>=3},
  {id:'planner', emoji:'📅', name:'مخطط', desc:'سجل اختبار واحد على الأقل', check:s=> s.subjects.some(x=>x.exams.length>0)},
];

function checkBadges(){
  BADGES.forEach(b=>{
    if(b.check(state) && !state.earnedBadges.includes(b.id)){
      state.earnedBadges.push(b.id);
    }
  });
}

function renderBadges(){
  checkBadges(); save();
  document.getElementById('badgesGrid').innerHTML = BADGES.map(b=>{
    const earned = state.earnedBadges.includes(b.id);
    return `<div class="glass badge-card ${earned?'earned':'locked'}">
      <div class="badge-emoji">${b.emoji}</div>
      <h4>${b.name}</h4>
      <p>${b.desc}</p>
      <div style="font-size:12px;color:${earned?'var(--gold-soft)':'var(--muted)'};font-weight:700">${earned?'✓ تم تحقيقه':'🔒 لم يتحقق بعد'}</div>
    </div>`;
  }).join('');
}

// ========= Render All =========
function renderAll(){
  renderDashboard();
  renderSubjects();
  renderStatsSummary();
  renderBadges();
  if(document.getElementById('stats').classList.contains('active')) renderChart();
}

setGreeting(); initializeTips(); renderTimer(); renderAll();
