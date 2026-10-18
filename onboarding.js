// ---------- Onboarding wizard (first run, new profile, re-run) ----------
const OB_FLAG = 'mealprep.onboarded', WIZ_KEY = 'mealprep.wizard';
let WZ = null;
const wizLoad = () => { try { return JSON.parse(localStorage.getItem(WIZ_KEY)); } catch { return null; } };
const wizSave = () => { if (WZ) localStorage.setItem(WIZ_KEY, JSON.stringify(WZ)); };
const WSTEPS = ['welcome','name','about','plan','prefs','finish'];

function startWizard(mode, saved){
  if (saved && saved.mode === mode) WZ = saved;
  else {
    const base = mode === 'rerun' && P ? P : null;
    WZ = { mode, step: mode === 'first' ? 0 : 1, d: {
      name: base ? base.name : '', body: base && base.body ? {...base.body} : { sex:'male', age:30, heightCm:177.8, weightKg:90.7, goalKg:81.6, activity:'moderate', liftDays:0, pace:'-1', bodyFat:'' },
      know: false, manual: base ? {...targetsOf(base.targets)} : { kcal:2200, p:160, c:230, f:70 }, adjust: null,
      mealsPerDay: base ? base.mealsPerDay : 4, sizesMode: base && base.mealSizes && base.mealSizes.mode === 'any' ? 'any' : 'sizes', sizes: base && base.mealSizes ? {...(base.mealSizes.sizes||{})} : {},
      budget: base ? base.budget : 75, zip: base ? base.zip : '', stores: base ? [...base.stores] : ['Aldi','Kroger','Meijer'],
      likes: base ? base.likes : '', dislikes: base ? base.dislikes : '', allergies: base ? base.allergies : '' } };
  }
  wizSave(); renderWiz();
}
function wizResult(){ const d = WZ.d; if (d.know) return { kcal:+d.manual.kcal, protein:+d.manual.p, carbs:+d.manual.c, fat:+d.manual.f, calc:null };
  const r = calcMacros(d.body), a = d.adjust; return { kcal: a ? +a.kcal : r.kcal, protein: a ? +a.p : r.protein, carbs: a ? +a.c : r.carbs, fat: a ? +a.f : r.fat, calc: r }; }

function renderWiz(){
  let el = $('#wiz'); if (!el){ el = document.createElement('div'); el.id = 'wiz'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); document.body.appendChild(el); }
  document.body.classList.add('wizon');
  const d = WZ.d, st = WSTEPS[WZ.step], steps = WZ.mode === 'first' ? WSTEPS : WSTEPS.slice(1), pos = steps.indexOf(st);
  const dots = steps.map((s,i) => `<span class="${i<pos?'done':i===pos?'cur':''}"></span>`).join('');
  const b = d.body, ft = Math.floor(b.heightCm/2.54/12), inch = Math.round(b.heightCm/2.54 - ft*12);
  let body = '';
  if (st === 'welcome') body = `<div class="wz-hero">🥗</div><h1>Welcome to Prep Pal</h1><p class="wz-lead">Budget meal prep that hits your calories and macros, with a shopping list, prep steps and a food log.</p>
     <div class="note">🔒 Your info stays private on this phone.</div>`;
  if (st === 'name') body = `<h1>${WZ.mode==='rerun'?'Your profile':'Create your profile'}</h1><p class="wz-lead">Each person gets their own private profile on this device.</p>
     <label for="wzName">Your name</label><input id="wzName" value="${esc(d.name)}" placeholder="e.g. Roman" autocomplete="given-name"><div class="sub" id="wzErr" style="color:var(--r)"></div>`;
  if (st === 'about') body = `<h1>About you</h1>
     <div class="chips"><button class="chip ${!d.know?'on':''}" data-wz="know" data-v="0">Calculate for me</button><button class="chip ${d.know?'on':''}" data-wz="know" data-v="1">I already know my macros</button></div>
     ${d.know ? `<div class="row"><div><label for="wzK">Calories</label><input id="wzK" type="number" inputmode="numeric" value="${d.manual.kcal}"></div><div><label for="wzP">Protein (g)</label><input id="wzP" type="number" inputmode="numeric" value="${d.manual.p}"></div></div>
       <div class="row"><div><label for="wzC">Carbs (g)</label><input id="wzC" type="number" inputmode="numeric" value="${d.manual.c}"></div><div><label for="wzF">Fat (g)</label><input id="wzF" type="number" inputmode="numeric" value="${d.manual.f}"></div></div>`
     : `<label for="wzSex">Sex (for the formula)</label><select id="wzSex"><option value="male" ${b.sex==='male'?'selected':''}>Male</option><option value="female" ${b.sex==='female'?'selected':''}>Female</option></select>
       <label for="wzAge">Age</label><input id="wzAge" type="number" inputmode="numeric" value="${b.age}">
       <label>Height</label><div class="row keep"><div><input id="wzFt" type="number" inputmode="numeric" value="${ft}" aria-label="feet"><small class="muted">ft</small></div><div><input id="wzIn" type="number" inputmode="numeric" value="${inch}" aria-label="inches"><small class="muted">in</small></div></div>
       <div class="row keep"><div><label for="wzW">Weight (lb)</label><input id="wzW" type="number" inputmode="decimal" value="${n1(b.weightKg/LB)}"></div><div><label for="wzG">Goal (lb)</label><input id="wzG" type="number" inputmode="decimal" value="${n1(b.goalKg/LB)}"></div></div>
       <label for="wzAct">Activity level</label><select id="wzAct">${ACT.map(a=>`<option value="${a[0]}" ${b.activity===a[0]?'selected':''}>${a[2]}: ${a[3]}</option>`).join('')}</select>
       <div class="row keep"><div><label for="wzLift">Lifting days/week</label><select id="wzLift">${[0,1,2,3,4,5,6,7].map(n=>`<option ${+b.liftDays===n?'selected':''}>${n}</option>`).join('')}</select></div>
       <div><label for="wzPace">Pace</label><select id="wzPace">${PACES.map(p=>`<option value="${p[0]}" ${String(b.pace)===p[0]?'selected':''}>${p[1]}</option>`).join('')}</select></div></div>`}`;
  if (st === 'plan'){ const r = wizResult(), c = r.calc;
    body = `<h1>Your macro plan</h1>
     <div class="wz-big">${r.kcal} <small>kcal / day</small></div>${macroChips({kcal:r.kcal,p:r.protein,c:r.carbs,f:r.fat})}
     ${c ? `<div class="sum" style="margin-top:12px"><div><span class="sub">BMR</span><b>${Math.round(c.bmr)}</b></div><div><span class="sub">TDEE</span><b>${Math.round(c.tdee)}</b></div></div>
       <p>${c.weeks ? `About <b>${Math.ceil(c.weeks)} weeks</b> to reach ${n1(b.goalKg/LB)} lb, around <b>${c.date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</b>.` : 'Maintenance: no weight change planned.'}</p>
       ${c.floored ? `<div class="warnnote">⚠️ Calories were raised to the ${c.floor} kcal minimum.</div>` : ''}` : '<p class="sub">Using the macros you entered.</p>'}
     <details class="more" ${d.adjust?'open':''}><summary>Adjust</summary><div class="row keep"><div><label for="wzaK">Calories</label><input id="wzaK" type="number" value="${r.kcal}"></div><div><label for="wzaP">Protein</label><input id="wzaP" type="number" value="${r.protein}"></div></div>
       <div class="row keep"><div><label for="wzaC">Carbs</label><input id="wzaC" type="number" value="${r.carbs}"></div><div><label for="wzaF">Fat</label><input id="wzaF" type="number" value="${r.fat}"></div></div></details>
     <div class="warnnote">Estimates only, not medical advice.</div>`; }
  if (st === 'prefs'){ const slots = slotsFor({mealsPerDay:d.mealsPerDay, snacks:false}), r = wizResult();
    const sh = mealShares({mealsPerDay:d.mealsPerDay, snacks:false, mealSizes:{mode:d.sizesMode, sizes:d.sizes}}, slots.length);
    body = `<h1>Quick preferences</h1><p class="wz-lead">Optional. Skip any of these and you get sensible defaults.</p>
     <label for="wzMeals">Meals per day</label><select id="wzMeals">${[2,3,4,5].map(n=>`<option ${d.mealsPerDay==n?'selected':''}>${n}</option>`).join('')}</select>
     <label>Meal sizes</label><div class="chips"><button class="chip ${d.sizesMode==='sizes'?'on':''}" data-wz="smode" data-v="sizes">Light / Medium / Heavy</button><button class="chip ${d.sizesMode==='any'?'on':''}" data-wz="smode" data-v="any">Any size</button></div>
     ${d.sizesMode==='sizes' ? slots.map((sl,i)=>`<div class="line"><div class="top2"><b>${sl.label}</b><span class="sub">~${Math.round(r.kcal*sh[i])} kcal</span></div><div class="seg">${['L','M','H'].map(z=>`<button class="${(d.sizes[sl.key]||'M')===z?'on':''}" data-wz="size" data-slot="${sl.key}" data-v="${z}">${{L:'Light',M:'Medium',H:'Heavy'}[z]}</button>`).join('')}</div></div>`).join('') : ''}
     <div class="row keep"><div><label for="wzBud">Weekly budget ($)</label><input id="wzBud" type="number" inputmode="decimal" value="${d.budget}"></div><div><label for="wzZip">ZIP code</label><input id="wzZip" inputmode="numeric" maxlength="5" value="${esc(d.zip)}" placeholder="48170"></div></div>
     <label>Stores</label><div class="chips">${ALL_CHAINS.slice(0,6).map(c=>`<button class="chip ${d.stores.includes(c)?'on':''}" data-wz="store" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
     <label for="wzLikes">Foods you like</label><input id="wzLikes" value="${esc(d.likes)}" placeholder="chicken, rice, eggs">
     <label for="wzDis">Dislikes</label><input id="wzDis" value="${esc(d.dislikes)}" placeholder="mushrooms">
     <label for="wzAll">Allergies</label><input id="wzAll" value="${esc(d.allergies)}" placeholder="peanuts, dairy…">`; }
  if (st === 'finish'){ const r = wizResult();
    body = `<div class="wz-hero">✅</div><h1>You're all set${d.name ? ', ' + esc(d.name) : ''}!</h1>
     <p class="wz-lead">${r.kcal} kcal · P ${r.protein} g · C ${r.carbs} g · F ${r.fat} g<br>${d.mealsPerDay} meals a day · ${money(d.budget)}/week · ${esc(d.stores.join(', ') || 'Aldi')}</p>
     <button class="btn wz-go" data-wz="finish">🍳 Build my first plan</button>`; }
  const canBack = pos > 0, isLast = st === 'finish';
  el.innerHTML = `<div class="wz-top"><div class="wz-dots" aria-label="Step ${pos+1} of ${steps.length}">${dots}</div><span class="sub">Step ${pos+1} of ${steps.length}</span>
     ${WZ.mode !== 'first' ? '<button class="btn sm sec" data-wz="cancel">Cancel</button>' : ''}</div>
    <div class="wz-body">${body}</div>
    <div class="wz-nav">${canBack ? '<button class="btn sec" data-wz="back">← Back</button>' : '<span></span>'}
      ${isLast ? '' : st === 'prefs' ? '<button class="btn sec" data-wz="skip">Skip</button><button class="btn" data-wz="next">Next →</button>' : `<button class="btn" data-wz="next">${st==='welcome'?'Get started →':'Next →'}</button>`}</div>`;
  el.scrollTop = 0;
}
function wizRead(){
  const d = WZ.d, st = WSTEPS[WZ.step], v = id => $('#'+id) ? $('#'+id).value : null, num = id => parseFloat(v(id));
  if (st === 'name') d.name = (v('wzName') || '').trim();
  if (st === 'about'){ if (d.know){ d.manual = { kcal:num('wzK')||d.manual.kcal, p:num('wzP')||d.manual.p, c:num('wzC')||d.manual.c, f:num('wzF')||d.manual.f }; }
    else { const b = d.body; b.sex = v('wzSex'); b.age = num('wzAge') || b.age; const h = (num('wzFt')||0)*12 + (num('wzIn')||0); if (h > 0) b.heightCm = h*2.54;
      if (num('wzW') > 0) b.weightKg = num('wzW')*LB; if (num('wzG') > 0) b.goalKg = num('wzG')*LB; b.activity = v('wzAct'); b.liftDays = +v('wzLift'); b.pace = v('wzPace'); d.adjust = null; } }
  if (st === 'plan' && $('#wzaK')){ const r = wizResult(), a = { kcal:num('wzaK'), p:num('wzaP'), c:num('wzaC'), f:num('wzaF') };
    if (a.kcal !== r.kcal || a.p !== r.protein || a.c !== r.carbs || a.f !== r.fat) d.adjust = a; }
  if (st === 'prefs'){ d.mealsPerDay = +v('wzMeals') || 4; d.budget = num('wzBud') || 75; d.zip = (v('wzZip')||'').trim(); d.likes = v('wzLikes'); d.dislikes = v('wzDis'); d.allergies = v('wzAll'); }
}
async function wizFinish(){
  const d = WZ.d, r = wizResult(); let p;
  if (WZ.mode === 'rerun' && P){ p = P; } else { p = newProfile(d.name || 'Me'); }
  Object.assign(p, { name: d.name || p.name, targets: { mode:'manual', kcal:r.kcal, protein:r.protein, carbs:r.carbs, fat:r.fat }, mealsPerDay: d.mealsPerDay,
    mealSizes: { mode: d.sizesMode, sizes: d.sizes, pct: [] }, budget: d.budget, zip: d.zip || p.zip, stores: d.stores.length ? d.stores : ['Aldi'], likes: d.likes, dislikes: d.dislikes, allergies: d.allergies });
  if (!d.know) p.body = { ...d.body };
  await Store.saveProfile(p); await Store.setActiveId(p.id);
  localStorage.setItem(OB_FLAG, '1'); localStorage.removeItem(WIZ_KEY); WZ = null;
  closeWiz(); await switchProfile(p.id); await makePlan(null, Math.floor(Math.random()*1e9)+2);
  TAB = 'week'; render(); scrollTo(0,0); toast('Your first plan is ready');
}
function closeWiz(){ const el = $('#wiz'); if (el) el.remove(); document.body.classList.remove('wizon'); }

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-wz],[data-act=wizrerun]'); if (!t) return;
  if (t.dataset.act === 'wizrerun') return startWizard('rerun');
  const a = t.dataset.wz, d = WZ.d; wizRead();
  if (a === 'next'){ if (WSTEPS[WZ.step] === 'name' && !d.name){ $('#wzErr').textContent = 'Please enter a name.'; $('#wzName').focus(); return; } WZ.step = Math.min(WSTEPS.length-1, WZ.step+1); }
  if (a === 'back') WZ.step = Math.max(WZ.mode === 'first' ? 0 : 1, WZ.step-1);
  if (a === 'skip') WZ.step = WSTEPS.indexOf('finish');
  if (a === 'know') { d.know = t.dataset.v === '1'; }
  if (a === 'smode') d.sizesMode = t.dataset.v;
  if (a === 'size') d.sizes[t.dataset.slot] = t.dataset.v;
  if (a === 'store') d.stores = d.stores.includes(t.dataset.v) ? d.stores.filter(s => s !== t.dataset.v) : [...d.stores, t.dataset.v];
  if (a === 'cancel'){ localStorage.removeItem(WIZ_KEY); WZ = null; closeWiz(); return; }
  if (a === 'finish') return wizFinish();
  wizSave(); renderWiz();
});
document.addEventListener('input', e => { if (WZ && e.target.closest('#wiz')){ wizRead(); wizSave(); } });
document.addEventListener('change', e => { if (WZ && e.target.closest('#wiz')){ wizRead(); wizSave(); if (e.target.id === 'wzMeals') renderWiz(); } });
