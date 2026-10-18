// ---------- My Macros calculator + weight log (per profile) ----------
const ACT = [
  ['sedentary', 1.2, 'Sedentary', 'Desk job, little or no exercise'],
  ['light', 1.375, 'Light', 'Light exercise or walking 1–3 days/week'],
  ['moderate', 1.55, 'Moderate', 'Exercise 3–5 days/week, or an active job'],
  ['very', 1.725, 'Very active', 'Hard exercise 6–7 days/week'],
  ['athlete', 1.9, 'Athlete', 'Twice-a-day training or heavy physical labor']];
const PACES = [['-1.5','Lose 1.5 lb/week'],['-1','Lose 1 lb/week'],['-0.5','Lose 0.5 lb/week'],['0','Maintain'],['0.25','Gain 0.25 lb/week'],['0.5','Gain 0.5 lb/week']];
const LB = 0.45359237;
const imperial = () => ((P && P.units) || 'both') !== 'g';
function bodyInit(){ P.body = P.body || { sex:'male', age:30, heightCm:177.8, weightKg:90.7, goalKg:81.6, activity:'moderate', liftDays:0, pace:'-1', bodyFat:'' }; P.weights = P.weights || []; }

function calcMacros(b){
  const lbs = b.weightKg/LB, goalLb = b.goalKg/LB, bf = parseFloat(b.bodyFat);
  const bmr = bf > 0 && bf < 70 ? 370 + 21.6*b.weightKg*(1-bf/100) : 10*b.weightKg + 6.25*b.heightCm - 5*b.age + (b.sex === 'male' ? 5 : -161);
  const formula = bf > 0 && bf < 70 ? 'Katch-McArdle' : 'Mifflin-St Jeor';
  const fac = (ACT.find(a => a[0] === b.activity) || ACT[2])[1], tdee = bmr*fac, pace = parseFloat(b.pace);
  let kcal = tdee + pace*3500/7; const floor = b.sex === 'male' ? 1500 : 1200, floored = kcal < floor; if (floored) kcal = floor;
  kcal = Math.round(kcal/10)*10;
  const protein = Math.round(goalLb*(+b.liftDays > 0 ? 1 : 0.8));
  let fat = Math.max(Math.round(kcal*0.27/9), Math.round(0.3*goalLb));
  let carbs = Math.round((kcal - protein*4 - fat*9)/4); if (carbs < 50) carbs = 50;
  const delta = kcal - tdee, diffLb = goalLb - lbs, wkRate = delta*7/3500;
  let weeks = null; if (Math.abs(diffLb) >= 0.5 && Math.sign(wkRate) === Math.sign(diffLb) && Math.abs(wkRate) > 0.01) weeks = Math.abs(diffLb/wkRate);
  const date = weeks ? new Date(Date.now() + weeks*7*864e5) : null;
  return { bmr, tdee, fac, formula, kcal, protein, fat, carbs, delta, floored, floor, weeks, date, wkRate, diffLb };
}
const kgOut = kg => imperial() ? `${n1(kg/LB)} lb` : `${n1(kg)} kg`;

function renderMacros(){
  bodyInit(); const b = P.body, r = calcMacros(b), imp = imperial();
  const ft = Math.floor(b.heightCm/2.54/12), inch = Math.round(b.heightCm/2.54 - ft*12);
  const wv = kg => imp ? n1(kg/LB) : n1(kg);
  return `<h1 class="screen">My Macros</h1><div class="card"><h2>About you</h2>
  <div class="row"><div><label>Sex (for the formula)</label><select id="bsex"><option value="male" ${b.sex==='male'?'selected':''}>Male</option><option value="female" ${b.sex==='female'?'selected':''}>Female</option></select></div>
  <div><label>Age</label><input id="bage" type="number" inputmode="numeric" value="${b.age}"></div></div>
  ${imp ? `<label>Height</label><div class="row keep"><div><input id="bft" type="number" inputmode="numeric" value="${ft}" aria-label="feet"><small class="muted">ft</small></div><div><input id="bin" type="number" inputmode="numeric" value="${inch}" aria-label="inches"><small class="muted">in</small></div></div>`
        : `<label>Height (cm)</label><input id="bcm" type="number" inputmode="decimal" value="${n1(b.heightCm)}">`}
  <div class="row"><div><label>Current weight (${imp?'lb':'kg'})</label><input id="bw" type="number" inputmode="decimal" value="${wv(b.weightKg)}"></div>
  <div><label>Goal weight (${imp?'lb':'kg'})</label><input id="bg" type="number" inputmode="decimal" value="${wv(b.goalKg)}"></div></div>
  </div><div class="card"><h2>Activity & goal</h2><label>Activity level</label>${ACT.map(a => `<label style="display:flex;gap:10px;align-items:center;font-weight:400;color:var(--ink);border:1.5px solid ${b.activity===a[0]?'var(--g)':'var(--line)'};border-radius:12px;padding:10px;min-height:52px;background:${b.activity===a[0]?'var(--gl)':'#fff'}">
    <input type="radio" name="bact" value="${a[0]}" ${b.activity===a[0]?'checked':''} style="width:22px;min-height:22px"><span><b>${a[2]}</b><br><small class="muted">${a[3]}</small></span></label>`).join('')}
  <div class="row"><div><label>Lifting days/week</label><select id="blift">${[0,1,2,3,4,5,6,7].map(n=>`<option ${+b.liftDays===n?'selected':''}>${n}</option>`).join('')}</select></div>
  <div><label>Body fat % (optional)</label><input id="bbf" type="number" inputmode="decimal" value="${esc(b.bodyFat)}" placeholder="—"></div></div>
  <label>Goal pace</label><select id="bpace">${PACES.map(p=>`<option value="${p[0]}" ${String(b.pace)===p[0]?'selected':''}>${p[1]}</option>`).join('')}</select>
  <div class="btns" style="margin-top:12px"><button class="btn sec" data-act="mcalc">Calculate</button></div></div>
  <div class="card" id="mres"><h2>Your estimate</h2>
   <div class="sum"><div><small class="muted">BMR (${r.formula})</small><b>${Math.round(r.bmr)}</b></div><div><small class="muted">TDEE (×${r.fac})</small><b>${Math.round(r.tdee)}</b></div>
   <div><small class="muted">${r.delta < 0 ? 'Deficit' : 'Surplus'}/day</small><b>${r.delta<0?'−':'+'}${Math.abs(Math.round(r.delta))}</b></div><div><small class="muted">Daily target</small><b>${r.kcal} kcal</b></div></div>
   <div class="daytot"><div><b>${r.protein} g</b>protein</div><div><b>${r.carbs} g</b>carbs</div><div><b>${r.fat} g</b>fat</div><div><b>${r.kcal}</b>kcal</div></div>
   ${r.floored ? `<div class="warnnote">⚠️ Calories were raised to the ${r.floor} kcal minimum. Your chosen pace would go below a safe floor, so expect slower progress.</div>` : ''}
   <p>${r.weeks ? `About <b>${Math.ceil(r.weeks)} weeks</b> to reach ${kgOut(b.goalKg)} (${r.wkRate<0?'−':'+'}${n1(Math.abs(r.wkRate))} lb/week), around <b>${r.date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</b>.` : (Math.abs(r.diffLb) < 0.5 ? 'You\'re at your goal weight. This is maintenance.' : 'This pace doesn\'t move you toward your goal weight.')}</p>
   <div class="warnnote">Estimates only, not medical advice. Adjust after 2–3 weeks of real weigh-ins.</div>
   <button class="btn" data-act="mapply">✅ Apply to my plan</button></div>
  ${renderWeights()}`;
}
function readBody(){
  const b = P.body, v = id => $('#'+id) ? parseFloat($('#'+id).value) : NaN, imp = imperial();
  b.sex = $('#bsex').value; b.age = v('bage') || b.age;
  if (imp){ const h = (v('bft')||0)*12 + (v('bin')||0); if (h > 0) b.heightCm = h*2.54; } else if (v('bcm') > 0) b.heightCm = v('bcm');
  const k = imp ? LB : 1; if (v('bw') > 0) b.weightKg = v('bw')*k; if (v('bg') > 0) b.goalKg = v('bg')*k;
  const a = document.querySelector('input[name=bact]:checked'); if (a) b.activity = a.value;
  b.liftDays = +$('#blift').value; b.bodyFat = $('#bbf').value; b.pace = $('#bpace').value;
}

function renderWeights(){
  const ws = P.weights.slice().sort((a,b) => a.date.localeCompare(b.date)), imp = imperial();
  let chart = '<p class="muted">Log a couple of weigh-ins to see a trend line.</p>';
  if (ws.length >= 2){
    const W0 = 340, H = 140, pad = 26, xs = ws.map(w => +new Date(w.date)), ys = ws.map(w => imp ? w.kg/LB : w.kg);
    const goal = imp ? P.body.goalKg/LB : P.body.goalKg, mn = Math.min(...ys, goal) - 1, mx = Math.max(...ys, goal) + 1, x0 = Math.min(...xs), x1 = Math.max(...xs);
    const X = x => pad + (x1 > x0 ? (x - x0)/(x1 - x0) : 0.5)*(W0 - pad - 8), Y = y => 8 + (mx - y)/(mx - mn)*(H - 30);
    // 7-entry moving average as the trend
    const tr = ys.map((_, i) => { const s = ys.slice(Math.max(0, i-6), i+1); return s.reduce((a,b)=>a+b,0)/s.length; });
    chart = `<svg viewBox="0 0 ${W0} ${H}" width="100%" role="img" aria-label="Weight trend">
      <line x1="${pad}" x2="${W0-8}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="#f08a24" stroke-dasharray="4 4"/><text x="${W0-8}" y="${Y(goal)-4}" font-size="10" text-anchor="end" fill="#8a4b0c">goal ${n1(goal)}</text>
      <polyline fill="none" stroke="#2e9e66" stroke-width="2.5" points="${tr.map((y,i)=>X(xs[i])+','+Y(y)).join(' ')}"/>
      ${ys.map((y,i)=>`<circle cx="${X(xs[i])}" cy="${Y(y)}" r="3.5" fill="#1f7a4d"/>`).join('')}
      <text x="2" y="${Y(mx-1)+4}" font-size="10" fill="#66756c">${n1(mx-1)}</text><text x="2" y="${Y(mn+1)+4}" font-size="10" fill="#66756c">${n1(mn+1)}</text>
      <text x="${pad}" y="${H-4}" font-size="10" fill="#66756c">${ws[0].date.slice(5)}</text><text x="${W0-8}" y="${H-4}" font-size="10" text-anchor="end" fill="#66756c">${ws[ws.length-1].date.slice(5)}</text></svg>`;
  }
  return `<div class="card"><h2>⚖️ Weight log</h2>
   <div style="display:flex;gap:8px"><input id="wdate" type="date" value="${todayStr()}" style="flex:1.2"><input id="wval" type="number" inputmode="decimal" placeholder="${imp?'lb':'kg'}" style="flex:1"><button class="btn sm" data-act="wadd">Add</button></div>
   ${chart}${ws.slice(-6).reverse().map(w => `<div class="prow"><span class="n">${w.date} · ${kgOut(w.kg)}</span><button class="btn sm warn" data-act="wdel" data-v="${w.date}" aria-label="Delete">✕</button></div>`).join('')}</div>`;
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]'); if (!t) return; const a = t.dataset.act;
  if (!['mcalc','mapply','wadd','wdel'].includes(a)) return; bodyInit();
  if (a === 'mcalc'){ readBody(); await save(); render(); $('#mres').scrollIntoView({behavior:'smooth'}); return; }
  if (a === 'mapply'){ readBody(); const r = calcMacros(P.body);
    P.targets = { mode:'manual', kcal:r.kcal, protein:r.protein, carbs:r.carbs, fat:r.fat }; await save();
    await makePlan(null, Math.floor(Math.random()*1e6)+2); TAB = 'week'; render(); scrollTo(0,0); return toast('Macros applied and plan regenerated'); }
  if (a === 'wadd'){ const v = parseFloat($('#wval').value), d = $('#wdate').value || todayStr(); if (!(v > 0)) return toast('Enter a weight');
    const kg = imperial() ? v*LB : v; P.weights = P.weights.filter(w => w.date !== d).concat({date:d, kg});
    const last = P.weights.slice().sort((a,b)=>a.date.localeCompare(b.date)).pop(); if (last) P.body.weightKg = last.kg; await save(); return render(); }
  if (a === 'wdel'){ P.weights = P.weights.filter(w => w.date !== t.dataset.v); await save(); return render(); }
});
