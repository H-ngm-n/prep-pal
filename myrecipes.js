// ---------- My Recipes: user recipes + custom ingredients (per profile) ----------
let EDIT = null, ED_SCAN = null;
const isCustomIng = id => String(id).startsWith('c_');
const TYPE_OPTS = ['breakfast','lunch','dinner','snack'];
const primaryType = types => types.includes('lunch') || types.includes('dinner') ? 'main' : types.includes('breakfast') ? 'breakfast' : 'snack';

// Put this profile's custom ingredients and recipes into the live tables the planner uses.
function applyCustom(){
  if (!P) return;
  Object.keys(ING).filter(isCustomIng).forEach(k => { delete ING[k]; delete SECTION_OF[k]; });
  for (let i = RECIPES.length - 1; i >= 0; i--) if (RECIPES[i].mine) RECIPES.splice(i, 1);
  Object.keys(RBY).filter(k => !BUILTIN_IDS.has(k)).forEach(k => delete RBY[k]);
  Object.entries(P.customIngs || {}).forEach(([id, ci]) => {
    ING[id] = { name: ci.name, cat: 'Custom', kcal: +ci.kcal || 0, p: +ci.p || 0, c: +ci.c || 0, f: +ci.f || 0, shelf: ci.shelf || 14, freeze: 0, alg: [], custom: true, servingG: ci.servingG || null };
    SECTION_OF[id] = ci.sec || 'Snacks'; });
  (P.myRecipes || []).forEach(r => { r.mine = true; r.type = primaryType(r.types || ['lunch']); r.ing = r.ing.filter(([id]) => ING[id]); RECIPES.push(r); RBY[r.id] = r; });
}
function roleOf(id){
  const i = ING[id]; if (!i || i.kcal < 80) return 'x';
  const pk = i.p*4/i.kcal, ck = i.c*4/i.kcal, fk = i.f*9/i.kcal;
  return pk >= 0.35 ? 'p' : ck >= 0.6 ? 'c' : fk >= 0.7 ? 'f' : 'x';
}
function unitG(id, unit){
  const F = FRIENDLY[id], i = ING[id] || {};
  if (unit === 'g') return 1; if (unit === 'oz') return 28.3495;
  if (unit === 'cup') return F && F[1].startsWith('cup') ? F[0] : 240;
  if (unit === 'tbsp') return F && F[1] === 'tbsp' ? F[0] : 15;
  if (unit === 'each') return F && COUNTABLE.has(F[1]) ? F[0] : (i.servingG || 100);
  if (unit === 'serving') return i.servingG || 100;
  return 1;
}
function batchMacros(lines){ const m = zero(); lines.forEach(l => { if (ING[l.id]) addM(m, mac(l.id, l.qty*unitG(l.id, l.unit))); }); return m; }

// ---- editor ----
function openEditor(r){
  EDIT = r ? JSON.parse(JSON.stringify({ id:r.id, name:r.name, types:r.types||['lunch','dinner'], servings:r.servings, lines: r.lines || r.ing.map(([id,g]) => ({id, qty:g, unit:'g'})),
      steps:(r.steps||[]).join('\n'), prep:r.prep||'', cook:r.cook||'', fridge:r.fridge||4, freezer:!!r.freezer, tags:(r.tags||[]).join(', '), cookedWeight:r.cookedWeight||'', usePlans:r.usePlans!==false, pin:!!r.pin }))
    : { id:null, name:'', types:['lunch','dinner'], servings:4, lines:[], steps:'', prep:'', cook:'', fridge:4, freezer:false, tags:'', cookedWeight:'', usePlans:true, pin:false };
  renderEditor();
}
function ingOptions(){
  const o = Object.entries(ING).filter(([id]) => !isCustomIng(id)).map(([id, i]) => [i.name, 'b:' + id]);
  Object.entries(P.customIngs || {}).forEach(([id, ci]) => o.push(['★ ' + ci.name, 'b:' + id]));
  Object.values(P.foods || {}).filter(f => !String(f.key).startsWith('plan:') && !String(f.key).startsWith('recipe:')).forEach(f => o.push(['📒 ' + f.name + (f.brand ? ' · ' + f.brand.split(',')[0] : ''), 'f:' + f.key]));
  return o;
}
function renderEditor(){
  const E = EDIT, units = ['g','oz','cup','tbsp','each'];
  $('#dlgBody').innerHTML = `<div class="editor"><h2>${E.id ? 'Edit recipe' : 'New recipe'}</h2>
   <label for="eName">Recipe name</label><input id="eName" value="${esc(E.name)}" placeholder="e.g. Roman's Turkey Taco Bowl">
   <label>Meal type(s)</label><div class="chips">${TYPE_OPTS.map(t => `<button class="chip ${E.types.includes(t)?'on':''}" data-act="etype" data-v="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div>
   <label for="eServ">Servings this batch makes</label><input id="eServ" type="number" inputmode="numeric" min="1" value="${E.servings}">
   <h3>Ingredients</h3><div id="eLines">${E.lines.map((l, i) => `<div class="eline"><div class="ltitle" style="font-size:16px">${esc(ING[l.id] ? ING[l.id].name : '(missing)')}</div>
      <div class="eqty"><input type="number" inputmode="decimal" step="any" data-eq="${i}" value="${l.qty}" aria-label="Amount"><select data-eu="${i}" aria-label="Unit">${units.map(u => `<option ${l.unit===u?'selected':''}>${u}</option>`).join('')}</select>
      <button class="btn sm warn" data-act="eldel" data-v="${i}" aria-label="Remove">✕</button></div><div class="sub" data-eg="${i}"></div></div>`).join('') || '<p class="sub">No ingredients yet.</p>'}</div>
   <label for="eSearch">Add an ingredient (search the built-in list, your foods, or scanned foods)</label>
   <input id="eSearch" list="eOpts" placeholder="Start typing… e.g. ground turkey"><datalist id="eOpts">${ingOptions().map(([n]) => `<option value="${esc(n)}">`).join('')}</datalist>
   <div class="btns"><button class="btn sm" data-act="eadd">Add ingredient</button></div>
   <details class="more" id="eNewWrap"><summary>New ingredient by hand or barcode</summary>
     <label for="niName">Name</label><input id="niName" placeholder="e.g. Siete tortilla chips">
     <div style="display:flex;gap:8px;margin-top:10px"><input id="niCode" inputmode="numeric" placeholder="Barcode (optional)"><button class="btn sm sec" data-act="nilookup">Look up</button><button class="btn sm sec" data-act="niscan" aria-label="Scan barcode">📷</button></div>
     <video id="niVid" playsinline muted style="display:none;width:100%;border-radius:12px;margin-top:8px;background:#000"></video><div class="sub" id="niMsg"></div>
     <label for="niBasis">Macros are per</label><select id="niBasis"><option value="serving">serving</option><option value="100">100 g</option></select>
     <label for="niSg">Serving size (g)</label><input id="niSg" type="number" inputmode="decimal" placeholder="e.g. 28">
     <div class="row4"><div><label for="niK">kcal</label><input id="niK" type="number" inputmode="decimal"></div><div><label for="niP">Protein</label><input id="niP" type="number" inputmode="decimal"></div>
     <div><label for="niC">Carbs</label><input id="niC" type="number" inputmode="decimal"></div><div><label for="niF">Fat</label><input id="niF" type="number" inputmode="decimal"></div></div>
     <div class="row"><div><label for="niPrice">Price $ (optional)</label><input id="niPrice" type="number" inputmode="decimal" step="any"></div><div><label for="niPkg">Package size g (optional)</label><input id="niPkg" type="number" inputmode="decimal"></div></div>
     <div class="row"><div><label for="niAmt">Amount in recipe</label><input id="niAmt" type="number" inputmode="decimal" value="1"></div><div><label for="niUnit">Unit</label><select id="niUnit"><option value="serving">servings</option><option>g</option><option>oz</option></select></div></div>
     <div class="btns"><button class="btn sm" data-act="niadd">Add new ingredient</button></div></details>
   <div class="card livebox" id="eMac"></div>
   <h3>Steps</h3><label for="eSteps">One step per line</label><textarea id="eSteps" rows="5">${esc(E.steps)}</textarea>
   <h3>Details</h3>
   <div class="row"><div><label for="ePrep">Prep (min)</label><input id="ePrep" type="number" inputmode="numeric" value="${E.prep}"></div><div><label for="eCook">Cook (min)</label><input id="eCook" type="number" inputmode="numeric" value="${E.cook}"></div></div>
   <div class="row"><div><label for="eFridge">Fridge days</label><input id="eFridge" type="number" inputmode="numeric" value="${E.fridge}"></div><div><label for="eCooked">Total cooked weight g (optional)</label><input id="eCooked" type="number" inputmode="decimal" value="${E.cookedWeight}"></div></div>
   <label><input type="checkbox" id="eFreezer" ${E.freezer?'checked':''} style="width:auto;min-height:0"> Freezer-friendly</label>
   <label for="eTags">Tags</label><input id="eTags" value="${esc(E.tags)}" placeholder="high-protein, mexican">
   <label><input type="checkbox" id="eUse" ${E.usePlans?'checked':''} style="width:auto;min-height:0"> Use in my meal plans</label>
   <div class="btns" style="position:sticky;bottom:0;background:#fff;padding:12px 0"><button class="btn" data-act="esave">Save recipe</button><button class="btn sec" data-act="eclose">Cancel</button></div></div>`;
  if (!$('#dlg').open) $('#dlg').showModal();
  updateLive();
}
function readEditor(){
  if (!EDIT || !$('#eName')) return; const E = EDIT, v = id => $('#'+id).value;
  E.name = v('eName').trim(); E.servings = Math.max(1, parseFloat(v('eServ')) || 1); E.steps = v('eSteps'); E.prep = v('ePrep'); E.cook = v('eCook');
  E.fridge = parseFloat(v('eFridge')) || 4; E.cookedWeight = v('eCooked'); E.freezer = $('#eFreezer').checked; E.tags = v('eTags'); E.usePlans = $('#eUse').checked;
  document.querySelectorAll('[data-eq]').forEach(x => E.lines[+x.dataset.eq].qty = parseFloat(x.value) || 0);
  document.querySelectorAll('[data-eu]').forEach(x => E.lines[+x.dataset.eu].unit = x.value);
}
function updateLive(){
  readEditor(); const E = EDIT, b = batchMacros(E.lines), n = E.servings || 1, ps = {kcal:b.kcal/n, p:b.p/n, c:b.c/n, f:b.f/n};
  E.lines.forEach((l, i) => { const el = document.querySelector(`[data-eg="${i}"]`); if (el && ING[l.id]) { const g = l.qty*unitG(l.id, l.unit); el.textContent = `${W(g)} · ${Math.round(mac(l.id, g).kcal)} kcal`; } });
  const box = $('#eMac'); if (box) box.innerHTML = `<b>Per serving</b>${macroChips(ps)}<b>Whole batch (${n} servings)</b>${macroChips(b)}`;
}
async function addLineFromSearch(){
  const val = $('#eSearch').value.trim(); if (!val) return;
  const hit = ingOptions().find(([n]) => n.toLowerCase() === val.toLowerCase()) || ingOptions().find(([n]) => n.toLowerCase().includes(val.toLowerCase()));
  if (!hit) return toast('Not found. Add it as a new ingredient below.');
  let id;
  if (hit[1].startsWith('b:')) id = hit[1].slice(2);
  else { const f = P.foods[hit[1].slice(2)]; id = 'c_' + f.key.replace(/[^a-z0-9]/gi, '').slice(-24);
    P.customIngs[id] = P.customIngs[id] || { name: f.name + (f.brand ? ' (' + f.brand.split(',')[0] + ')' : ''), ...f.per100, servingG: f.servingG || null, code: f.code || '' }; applyCustom(); }
  readEditor(); EDIT.lines.push({ id, qty: ING[id].servingG ? 1 : 100, unit: ING[id].servingG && isCustomIng(id) ? 'each' : 'g' }); renderEditor();
}
async function addNewIngredient(){
  const v = id => parseFloat($('#'+id).value) || 0, name = $('#niName').value.trim(); if (!name) return alert('Name the ingredient');
  const basis = $('#niBasis').value, sg = v('niSg'); if (basis === 'serving' && !sg) return alert('Serving size (g) is needed for per-serving macros');
  const k = basis === 'serving' ? 100/sg : 1, id = 'c_' + uid();
  P.customIngs[id] = { name, kcal: v('niK')*k, p: v('niP')*k, c: v('niC')*k, f: v('niF')*k, servingG: sg || null, code: $('#niCode').value.replace(/\D/g,''), price: v('niPrice') || null, pkgG: v('niPkg') || null };
  applyCustom(); readEditor();
  const u = $('#niUnit').value; EDIT.lines.push({ id, qty: v('niAmt') || 1, unit: u === 'serving' ? 'each' : u }); stopEdScan(); renderEditor(); toast('Added ' + name);
}
async function niLookup(code){
  code = String(code || $('#niCode').value).replace(/\D/g,''); const msg = t => { const m = $('#niMsg'); if (m) m.textContent = t; };
  if (code.length < 6) return msg('Enter a valid barcode'); $('#niCode').value = code; msg('Looking up…');
  try { const j = await (await fetch(OFF_URL(code), {cache:'no-store'})).json(); if (j.status !== 1) throw 0;
    const p = j.product, nu = p.nutriments || {};
    $('#niName').value = (p.product_name || 'Product ' + code) + (p.brands ? ' (' + p.brands.split(',')[0] + ')' : '');
    $('#niBasis').value = '100'; $('#niK').value = n1(nu['energy-kcal_100g'] ?? 0); $('#niP').value = n1(nu.proteins_100g || 0); $('#niC').value = n1(nu.carbohydrates_100g || 0); $('#niF').value = n1(nu.fat_100g || 0);
    if (p.serving_quantity) $('#niSg').value = p.serving_quantity; msg('Found on Open Food Facts. Check the values, then add it.');
  } catch { msg('Not found. Enter the macros by hand.'); }
}
async function niScan(){
  const vid = $('#niVid'), msg = t => { const m = $('#niMsg'); if (m) m.textContent = t; };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return msg('Camera not available here (it needs HTTPS).');
  vid.style.display = 'block'; msg('Point the rear camera at the barcode…');
  try {
    if ('BarcodeDetector' in window){ const det = new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});
      const st = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}}); ED_SCAN = () => st.getTracks().forEach(t => t.stop());
      vid.srcObject = st; await vid.play(); const tick = async () => { if (!ED_SCAN) return; try { const c = await det.detect(vid); if (c.length){ stopEdScan(); return niLookup(c[0].rawValue); } } catch {} requestAnimationFrame(tick); }; tick();
    } else {
      if (!window.ZXing) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = ZXING_CDN; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const reader = new ZXing.BrowserMultiFormatReader(); ED_SCAN = () => reader.reset();
      reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}}}, vid, res => { if (res && ED_SCAN){ stopEdScan(); niLookup(res.getText()); } });
    }
  } catch(e){ stopEdScan(); msg('Camera error: ' + (e.message || e)); }
}
function stopEdScan(){ if (ED_SCAN){ try { ED_SCAN(); } catch {} ED_SCAN = null; } const v = $('#niVid'); if (v) v.style.display = 'none'; }
async function saveRecipe(){
  readEditor(); const E = EDIT;
  if (!E.name) return alert('Give the recipe a name'); if (!E.types.length) return alert('Pick at least one meal type'); if (!E.lines.length) return alert('Add at least one ingredient');
  const old = E.id && P.myRecipes.find(r => r.id === E.id);
  const r = { id: E.id || 'u_' + uid(), mine: true, name: E.name, types: E.types, servings: E.servings,
    lines: E.lines, ing: E.lines.map(l => [l.id, Math.round(l.qty*unitG(l.id, l.unit)), roleOf(l.id)]),
    steps: E.steps.split('\n').map(s => s.trim()).filter(Boolean), prep: +E.prep || 0, cook: +E.cook || 0, fridge: +E.fridge || 4, freezer: E.freezer,
    tags: E.tags.split(',').map(s => s.trim()).filter(Boolean), cookedWeight: +E.cookedWeight || null, usePlans: E.usePlans, pin: old ? !!old.pin : false, method: 'stove' };
  if (!r.ing.some(x => x[2] !== 'x')) r.ing[0][2] = 'p';
  if (old) Object.assign(old, r); else P.myRecipes.push(r);
  applyCustom(); await save(); EDIT = null; $('#dlg').close(); TAB = 'recipes'; render(); toast('Saved ' + r.name);
  setTimeout(() => { const el = document.getElementById('rc-' + r.id); if (el){ el.open = true; el.scrollIntoView(); scrollBy(0, -80); } }, 50);
}

// ---- log from a recipe ----
function recipeFood(r){
  const b = zero(), raw = r.ing.reduce((a, [id, g]) => { addM(b, mac(id, g)); return a + g; }, 0), wt = r.cookedWeight || null, tot = wt || raw;
  return { key: 'recipe:' + r.id, name: r.name, brand: '', image: '', source: 'Recipe' + (r.mine ? ' (mine)' : ''), servingG: tot / r.servings,
    servingLabel: `1 of ${r.servings} servings${wt ? ' (cooked)' : ''}`, servingsOnly: !wt, per100: { kcal: b.kcal/tot*100, p: b.p/tot*100, c: b.c/tot*100, f: b.f/tot*100 } };
}
function logRecipe(id){ const r = RBY[id]; if (!r) return; logInit(); const f = recipeFood(r); P.foods[f.key] = f; foodDialog(f); }
function recipePicker(){
  const ids = curPlan() ? new Set(Object.values(curPlan().sel).flat()) : new Set();
  const list = [...RECIPES.filter(r => r.mine), ...RECIPES.filter(r => !r.mine && ids.has(r.id)), ...RECIPES.filter(r => !r.mine && !ids.has(r.id))];
  showDlg(`<h2>Log from a recipe</h2><p class="sub">Your recipes first, then this week's.</p>${list.map(r => { const m = recipeServingMacros(r);
    return `<div class="prow"><span class="n">${esc(r.name)} ${r.mine?'<span class="mine">Mine</span>':''}<br><small class="muted">${Math.round(m.kcal)} kcal · P ${Math.round(m.p)} per serving</small></span><button class="btn sm" data-act="rlog" data-id="${r.id}">Log</button></div>`; }).join('')}
    <button class="btn sec" data-act="close" style="margin-top:12px">Close</button>`);
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]'); if (!t) return; const a = t.dataset.act, id = t.dataset.id;
  if (!['rnew','redit','rdup','rdel','ruse','rpin','rlog','rpick','etype','eldel','eadd','niadd','nilookup','niscan','esave','eclose','setprice'].includes(a)) return;
  e.preventDefault();
  if (a === 'rnew') return openEditor(null);
  if (a === 'redit') return openEditor(P.myRecipes.find(r => r.id === id));
  if (a === 'rdup'){ const r = RBY[id]; const types = r.types || (r.type === 'main' ? ['lunch','dinner'] : [r.type]);
    const c = { ...JSON.parse(JSON.stringify(r)), id: 'u_' + uid(), name: r.name + (r.mine ? ' (copy)' : ' (my version)'), types, mine: true, pin: false, usePlans: true, lines: r.lines || r.ing.map(([i, g]) => ({id:i, qty:g, unit:'g'})) };
    P.myRecipes.push(c); applyCustom(); await save(); render(); return toast('Duplicated to My recipes'); }
  if (a === 'rdel'){ if (!confirm('Delete this recipe?')) return; P.myRecipes = P.myRecipes.filter(r => r.id !== id); P.locks = (P.locks||[]).filter(x => x !== id); applyCustom(); await save(); return render(); }
  if (a === 'ruse' || a === 'rpin'){ const r = P.myRecipes.find(x => x.id === id); if (a === 'ruse') r.usePlans = r.usePlans === false; else { r.pin = !r.pin; if (r.pin) r.usePlans = true; }
    applyCustom(); await save(); const y = scrollY; render(); scrollTo(0, y); const el = document.getElementById('rc-' + id); if (el) el.open = true;
    return toast(a === 'rpin' ? (r.pin ? 'Pinned. Regenerate the week to include it.' : 'Unpinned') : (r.usePlans !== false ? 'Planner can use it' : 'Kept out of plans')); }
  if (a === 'rlog') return logRecipe(id);
  if (a === 'rpick') return recipePicker();
  if (a === 'etype'){ readEditor(); EDIT.types = EDIT.types.includes(t.dataset.v) ? EDIT.types.filter(x => x !== t.dataset.v) : [...EDIT.types, t.dataset.v]; return renderEditor(); }
  if (a === 'eldel'){ readEditor(); EDIT.lines.splice(+t.dataset.v, 1); return renderEditor(); }
  if (a === 'eadd') return addLineFromSearch();
  if (a === 'niadd') return addNewIngredient();
  if (a === 'nilookup') return niLookup();
  if (a === 'niscan') return niScan();
  if (a === 'esave') return saveRecipe();
  if (a === 'eclose'){ stopEdScan(); EDIT = null; return $('#dlg').close(); }
  if (a === 'setprice'){ const ci = P.customIngs[id]; const pr = prompt(`Price for ${ci.name} ($ per package)`, ci.price || ''); if (pr === null) return;
    const pk = prompt('Package size in grams', ci.pkgG || ci.servingG || ''); if (pk === null) return; ci.price = parseFloat(pr) || null; ci.pkgG = parseFloat(pk) || null;
    await save(); await buildPriceRows(); await makePlan(curPlan() ? curPlan().sel : null); return toast('Price saved'); }
});
document.addEventListener('input', e => { if (EDIT && e.target.closest('.editor')) updateLive(); });
document.addEventListener('change', e => { if (EDIT && e.target.closest('.editor')) updateLive(); });
$('#dlg').addEventListener('close', () => { stopEdScan(); });
