// ---------- Food log + barcode scanning (per profile, stored in the profile = localStorage) ----------
const LOG_MEALS = ['breakfast','lunch','dinner','snack'];
const OFF_URL = code => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,brands,image_front_small_url,image_url,serving_size,serving_quantity,nutriments`;
const ZXING_CDN = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';
let LOG_DATE = null, SCAN = null;
const todayStr = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
function logInit(){ P.log = P.log || []; P.foods = P.foods || {}; P.recent = P.recent || []; if (!LOG_DATE) LOG_DATE = todayStr(); }
const n1 = x => Math.round(x*10)/10;
function entryMac(e){ const k = e.g/100, f = e.per100; return {kcal:f.kcal*k, p:f.p*k, c:f.c*k, f:f.f*k}; }

function renderLog(){
  logInit();
  const T = targetsOf(P.targets), day = P.log.filter(e => e.date === LOG_DATE), tot = zero();
  day.forEach(e => addM(tot, entryMac(e)));
  const bar = (lab, v, t, u) => { const pc = t ? v/t*100 : 0; return `<div style="margin:8px 0"><div class="top2" style="display:flex;justify-content:space-between"><b>${lab}</b><span>${Math.round(v)} / ${t} ${u} <span class="muted">(${Math.round(pc)}%)</span></span></div>
    <div class="bar"><i style="width:${Math.min(100,pc)}%;background:${pc>110?'var(--r)':pc>=90?'var(--g)':'var(--o)'}"></i></div></div>`; };
  const recent = P.recent.map(k => P.foods[k]).filter(Boolean).slice(0, 12);
  const meals = LOG_MEALS.map(m => { const es = day.filter(e => e.meal === m); const mt = zero(); es.forEach(e => addM(mt, entryMac(e)));
    return `<h3><span style="text-transform:capitalize">${m}</span></h3>${es.length ? macroChips(mt) : ''}${es.map(e => { const x = entryMac(e);
      return `<div class="prow"><span class="n">${esc(e.name)}<br><small class="muted">${esc(amountLabel(e))} · ${Math.round(x.kcal)} kcal · P ${n1(x.p)} C ${n1(x.c)} F ${n1(x.f)}</small></span>
      <button class="btn sm sec" data-act="logedit" data-id="${e.id}">Edit</button><button class="btn sm warn" data-act="logdel" data-id="${e.id}" aria-label="Delete">✕</button></div>`; }).join('') || '<p class="muted">Nothing logged</p>'}`; }).join('');
  return `<h1 class="screen">Food log</h1><div class="card"><div style="display:flex;gap:8px;align-items:center"><button class="btn sm sec" data-act="logday" data-v="-1" aria-label="Previous day">◀</button>
     <input type="date" id="logDate" value="${LOG_DATE}"><button class="btn sm sec" data-act="logday" data-v="1" aria-label="Next day">▶</button></div>
   ${bar('Calories', tot.kcal, T.kcal, 'kcal')}${bar('Protein', tot.p, T.p, 'g')}${bar('Carbs', tot.c, T.c, 'g')}${bar('Fat', tot.f, T.f, 'g')}
   <div class="note">🔒 Your log stays on this device, in ${esc(P.name)}'s profile. Only barcode lookups go to Open Food Facts.</div></div>
   <div class="card"><h2>Add food</h2><button class="btn" data-act="logscan">📷 Scan barcode</button>
   <label>Or type the barcode</label><div style="display:flex;gap:8px"><input id="barcode" inputmode="numeric" placeholder="e.g. 737628064502"><button class="btn sm" data-act="loglookup">Look up</button></div>
   <div class="btns" style="margin-top:10px"><button class="btn sec" data-act="logcustom">✍️ Custom food</button><button class="btn sec" data-act="rpick">📖 My recipes</button>${curPlan() ? `<button class="btn sec" data-act="logplanned">📅 Log planned meals</button>` : ''}</div>
   ${recent.length ? `<h3>Recent</h3><div class="chips">${recent.map(f => `<button class="chip" data-act="logrecent" data-id="${esc(f.key)}">${esc(f.name)}</button>`).join('')}</div>` : ''}</div>
   <div class="card"><h2>${LOG_DATE === todayStr() ? 'Today' : LOG_DATE}</h2>${meals}</div>`;
}
function amountLabel(e){ if (e.unit === 'serving') return `${e.qty} serving${e.qty==1?'':'s'} · ${W(e.g)}`; return W(e.g); }

// ---- lookup ----
async function lookupBarcode(code){
  code = String(code||'').replace(/\D/g,''); if (code.length < 6) return toast('Enter a valid barcode');
  const key = 'off:' + code;
  showDlg(`<h2>Looking up ${esc(code)}…</h2><p class="muted">Open Food Facts</p>`);
  try {
    const r = await fetch(OFF_URL(code), {cache:'no-store'}); const j = await r.json();
    if (j.status !== 1 || !j.product) throw new Error('nf');
    const p = j.product, nu = p.nutriments || {};
    const kcal100 = nu['energy-kcal_100g'] ?? (nu['energy_100g'] ? nu['energy_100g']/4.184 : null);
    if (kcal100 == null) throw new Error('nf');
    const food = { key, code, name: p.product_name || 'Product ' + code, brand: p.brands || '', image: p.image_front_small_url || p.image_url || '',
      servingLabel: p.serving_size || '', servingG: +p.serving_quantity || null, source:'Open Food Facts',
      per100: { kcal:+kcal100, p:+(nu.proteins_100g||0), c:+(nu.carbohydrates_100g||0), f:+(nu.fat_100g||0) } };
    P.foods[key] = food; await save(); foodDialog(food);
  } catch(e){ customDialog(code, e.message === 'nf' ? 'Not found in Open Food Facts. Enter it by hand:' : 'Lookup failed (offline?). Enter it by hand:'); }
}
function showDlg(h){ $('#dlgBody').innerHTML = h; if (!$('#dlg').open) $('#dlg').showModal(); }

function foodDialog(food, entry){
  const f = food.per100, sg = food.servingG, per = sg ? {kcal:f.kcal*sg/100,p:f.p*sg/100,c:f.c*sg/100,f:f.f*sg/100} : null;
  const u0 = entry ? entry.unit : (sg ? 'serving' : (P.units === 'oz' ? 'oz' : 'g'));
  const q0 = entry ? entry.qty : (sg ? 1 : (u0 === 'oz' ? 3.5 : 100));
  const row = (lab, m) => `<tr><td>${lab}</td><td>${Math.round(m.kcal)}</td><td>${n1(m.p)}</td><td>${n1(m.c)}</td><td>${n1(m.f)}</td></tr>`;
  showDlg(`<div style="display:flex;gap:12px;align-items:center">${food.image ? `<img src="${esc(food.image)}" alt="" style="width:72px;height:72px;object-fit:contain;border-radius:10px;background:#f3f3f3">` : '<div style="font-size:48px">🍽️</div>'}
    <div><h2 style="margin:0">${esc(food.name)}</h2><div class="muted">${esc(food.brand)}${food.code ? ' · ' + esc(food.code) : ''}</div>
    <div class="muted">Serving: ${sg ? esc(food.servingLabel || '') + ' = ' + W(sg) : 'not listed'}</div></div></div>
    <table class="tbl" style="margin-top:10px"><tr><th></th><th>kcal</th><th>P</th><th>C</th><th>F</th></tr>${row('Per 100 g', f)}${per ? row('Per serving', per) : ''}</table>
    <p class="muted">Source: ${esc(food.source || 'Custom')}</p>
    <div class="row"><div><label>Amount</label><input id="lqty" type="number" inputmode="decimal" step="any" value="${q0}"></div>
    <div><label>Unit</label><select id="lunit">${food.servingsOnly ? '' : '<option value="g">grams</option><option value="oz">ounces</option>'}${sg ? '<option value="serving">servings</option>' : ''}</select></div></div>
    ${food.servingsOnly ? '<p class="sub">Add the total cooked weight to the recipe to log by grams.</p>' : ''}
    <div class="row"><div><label>Meal</label><select id="lmeal">${LOG_MEALS.map(m => `<option ${((entry && entry.meal) || guessMeal()) === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    <div><label>Date</label><input id="ldate" type="date" value="${entry ? entry.date : LOG_DATE}"></div></div>
    <div id="lprev" class="note"></div>
    <div class="btns"><button class="btn" data-act="logsave" data-key="${esc(food.key)}" data-id="${entry ? entry.id : ''}">${entry ? 'Save changes' : 'Log it'}</button><button class="btn sec" data-act="close">Cancel</button></div>`);
  $('#lunit').value = u0;
  const prev = () => { const g = toGrams(food); $('#lprev').textContent = isFinite(g) && g > 0 ? `${W(g)} → ${Math.round(f.kcal*g/100)} kcal · P ${n1(f.p*g/100)} g · C ${n1(f.c*g/100)} g · F ${n1(f.f*g/100)} g` : 'Enter an amount'; };
  $('#lqty').oninput = prev; $('#lunit').onchange = prev; prev();
}
function toGrams(food){ const q = parseFloat($('#lqty').value), u = $('#lunit').value; return u === 'g' ? q : u === 'oz' ? q*28.3495 : q*(food.servingG||100); }
function guessMeal(){ const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 20 ? 'dinner' : 'snack'; }

function customDialog(code, msg){
  showDlg(`<h2>Custom food</h2>${msg ? `<div class="warnnote">${esc(msg)}</div>` : ''}
   <label>Name</label><input id="cname" placeholder="e.g. Grandma's chili">
   <label>Barcode (optional)</label><input id="ccode" inputmode="numeric" value="${esc(code||'')}">
   <label>Macros are per</label><select id="cbasis"><option value="serving">serving</option><option value="100">100 g</option></select>
   <label>Serving size (g)</label><input id="csg" type="number" inputmode="decimal" placeholder="e.g. 150">
   <div class="row4"><div><label>kcal</label><input id="ck" type="number" inputmode="decimal"></div><div><label>Protein</label><input id="cp" type="number" inputmode="decimal"></div>
   <div><label>Carbs</label><input id="cc" type="number" inputmode="decimal"></div><div><label>Fat</label><input id="cf" type="number" inputmode="decimal"></div></div>
   <div class="btns" style="margin-top:12px"><button class="btn" data-act="logcustomsave">Save food</button><button class="btn sec" data-act="close">Cancel</button></div>`);
}
async function saveCustom(){
  const v = id => parseFloat($('#'+id).value) || 0, name = $('#cname').value.trim(), basis = $('#cbasis').value, sg = v('csg');
  if (!name) return alert('Give it a name');
  if (basis === 'serving' && !sg) return alert('Serving size (g) is needed to convert per-serving macros');
  const k = basis === 'serving' ? 100/sg : 1, code = $('#ccode').value.replace(/\D/g,'');
  const food = { key: code ? 'custom:' + code : 'custom:' + uid(), code, name, brand:'', image:'', servingG: sg || null, servingLabel: sg ? '1 serving' : '', source:'Custom (you)',
    per100: { kcal:v('ck')*k, p:v('cp')*k, c:v('cc')*k, f:v('cf')*k } };
  P.foods[food.key] = food; await save(); foodDialog(food);
}
async function saveEntry(key, id){
  const food = P.foods[key], g = toGrams(food); if (!(g > 0)) return alert('Enter an amount');
  const e = { id: id || uid(), date: $('#ldate').value || todayStr(), meal: $('#lmeal').value, foodKey: key, name: food.name + (food.brand ? ' · ' + food.brand.split(',')[0] : ''),
    qty: parseFloat($('#lqty').value), unit: $('#lunit').value, g, per100: {...food.per100} };
  const i = P.log.findIndex(x => x.id === e.id); if (i >= 0) P.log[i] = e; else P.log.push(e);
  P.recent = [key, ...P.recent.filter(k => k !== key)].slice(0, 20);
  LOG_DATE = e.date; await save(); $('#dlg').close(); render(); toast(id ? 'Updated' : 'Logged');
}
async function logPlanned(){
  const plan = curPlan(); if (!plan) return;
  const d = new Date(LOG_DATE + 'T12:00'), di = (d.getDay() + 6) % 7, day = plan.days[di];
  const map = s => /break/i.test(s) ? 'breakfast' : /lunch/i.test(s) ? 'lunch' : /dinner/i.test(s) ? 'dinner' : 'snack';
  day.meals.forEach(m => { const g = m.ing.reduce((a,i) => a + i.g, 0), key = 'plan:' + m.recipe;
    const per100 = {kcal:m.m.kcal/g*100, p:m.m.p/g*100, c:m.m.c/g*100, f:m.m.f/g*100};
    P.foods[key] = { key, name: RBY[m.recipe].name, brand:'', image:'', servingG: g, servingLabel:'planned portion', source:'Prep Pal plan', per100 };
    P.log.push({ id: uid(), date: LOG_DATE, meal: map(m.slot), foodKey: key, name: RBY[m.recipe].name + ' (planned)', qty: 1, unit:'serving', g, per100 }); });
  await save(); render(); toast(`Logged ${day.meals.length} planned meals (${day.day})`);
}

// ---- camera scanning ----
async function startScan(){
  showDlg(`<h2>Scan barcode</h2><video id="scanVid" playsinline muted style="width:100%;border-radius:12px;background:#000;aspect-ratio:3/4;object-fit:cover"></video>
   <p class="muted" id="scanMsg">Point the rear camera at the barcode…</p><button class="btn sec" data-act="logscanstop">Cancel</button>`);
  const vid = $('#scanVid'), msg = t => { const m = $('#scanMsg'); if (m) m.textContent = t; };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return msg('Camera not available here (it needs HTTPS). Type the number instead.');
  try {
    if ('BarcodeDetector' in window){
      const det = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      SCAN = { stop: () => stream.getTracks().forEach(t => t.stop()) };
      vid.srcObject = stream; await vid.play();
      const tick = async () => { if (!SCAN) return; try { const c = await det.detect(vid); if (c.length){ const code = c[0].rawValue; stopScan(); return lookupBarcode(code); } } catch {} requestAnimationFrame(tick); };
      tick();
    } else {
      msg('Loading scanner…');
      if (!window.ZXing) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = ZXING_CDN; s.onload = res; s.onerror = () => rej(new Error('Scanner library failed to load')); document.head.appendChild(s); });
      const reader = new ZXing.BrowserMultiFormatReader();
      SCAN = { stop: () => reader.reset() };
      msg('Point the rear camera at the barcode…');
      reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, vid, (res) => { if (res && SCAN){ stopScan(); lookupBarcode(res.getText()); } });
    }
  } catch(e){ stopScan(false); msg('Camera error: ' + e.message + '. Type the number instead.'); }
}
function stopScan(){ if (SCAN){ try { SCAN.stop(); } catch {} SCAN = null; } }

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]'); if (!t || !t.dataset.act.startsWith('log')) return;
  const a = t.dataset.act, id = t.dataset.id; logInit();
  if (a === 'logday'){ const d = new Date(LOG_DATE + 'T12:00'); d.setDate(d.getDate() + +t.dataset.v); LOG_DATE = d.toISOString().slice(0,10); return render(); }
  if (a === 'logscan') return startScan();
  if (a === 'logscanstop'){ stopScan(); return $('#dlg').close(); }
  if (a === 'loglookup') return lookupBarcode($('#barcode').value);
  if (a === 'logcustom') return customDialog('');
  if (a === 'logcustomsave') return saveCustom();
  if (a === 'logsave') return saveEntry(t.dataset.key, t.dataset.id);
  if (a === 'logrecent') return foodDialog(P.foods[id]);
  if (a === 'logplanned') return logPlanned();
  if (a === 'logedit'){ const en = P.log.find(x => x.id === id); const food = P.foods[en.foodKey] || { key: en.foodKey, name: en.name, per100: en.per100, servingG: en.unit === 'serving' ? en.g/en.qty : null };
    P.foods[food.key] = food; return foodDialog(food, en); }
  if (a === 'logdel'){ if (!confirm('Delete this entry?')) return; P.log = P.log.filter(x => x.id !== id); await save(); return render(); }
});
document.addEventListener('change', e => { if (e.target.id === 'logDate'){ LOG_DATE = e.target.value || todayStr(); render(); } });
$('#dlg').addEventListener('close', () => stopScan());
