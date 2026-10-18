// ---------- app state ----------
let P = null, BASE_PRICES = [], PRICE_META = {}, PRICES = [], TAB = 'setup';
const $ = s => document.querySelector(s), main = () => $('#main');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '$' + (+n).toFixed(2);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function toast(t){ const e=$('#toast'); e.textContent=t; e.classList.add('on'); clearTimeout(e._t); e._t=setTimeout(()=>e.classList.remove('on'),1800); }

function newProfile(name){
  return { id: uid(), name, zip: '48170', locations: {},
    targets: { mode: 'manual', kcal: 2400, protein: 190, carbs: 250, fat: 70 },
    mealsPerDay: 4, snacks: false, servings: 1, budget: 75, likes: '', dislikes: '', allergies: '',
    stores: ['Aldi', 'Kroger', 'Meijer'], prepStyle: 'sunday', variety: 3,
    myRecipes: [], customIngs: {}, locks: [], history: [], mealSizes: {mode:'sizes', sizes:{}, pct:[]}, units: 'both', pantry: {}, log: [], foods: {}, recent: [], current: null, plans: [], checks: {}, ui: { hideChecked: false, groupBy: 'section' } };
}
async function save(){ await Store.saveProfile(P); }

// ---------- prices ----------
const PLYMOUTH_AREA = z => /^48(1[0-9]|3[0-9])/.test(z || '');   // SE Michigan ZIPs
async function loadPrices(){
  try { const j = await (await fetch('prices.json', {cache:'no-cache'})).json(); BASE_PRICES = j.prices; PRICE_META = j; }
  catch(e){ BASE_PRICES = []; toast('Couldn\'t load prices.json'); }
}
async function buildPriceRows(){
  // Kroger banners reuse the Kroger estimated rows, unless live data replaces them.
  let rows = BASE_PRICES.slice();
  for (const ch of P.stores) if (KROGER_FAMILY.includes(ch) && ch !== 'Kroger')
    rows = rows.concat(BASE_PRICES.filter(r => r.store === 'Kroger').map(r => ({...r, store: ch, product: r.product.replace(/^Kroger/, ch + ' (Kroger brand)')})));
  // user-entered prices for custom ingredients (kept in the profile, never in prices.json)
  Object.entries(P.customIngs || {}).forEach(([id, ci]) => { if (ci.price > 0 && ci.pkgG > 0)
    rows.push({item_id:id, store:'Your price', product:ci.name, package_size:ci.pkgLabel || (Math.round(ci.pkgG)+' g'), package_grams:+ci.pkgG, price:+ci.price, package_noun:'pack', estimated:false, user:true, aisle:null, last_updated:'you'}); });
  for (const ch of P.stores){
    const prov = CHAIN_PROVIDER(ch), loc = P.locations[ch];
    if (!prov.live || !loc || !loc.locationId) continue;
    try {
      const live = await prov.getProducts(Object.keys(ING), loc.locationId, ch);
      const got = new Set(live.map(x => x.item_id));
      rows = rows.filter(r => !(r.store === ch && got.has(r.item_id))).concat(live.filter(x => x.price > 0 && x.package_grams > 0));
    } catch(e){ toast(ch + ' live prices unavailable, using estimates'); }
  }
  PRICES = rows;
}
function estLabel(){ return PLYMOUTH_AREA(P.zip) ? 'estimated' : 'estimated for Plymouth, MI area (not your ZIP)'; }


// ---------- units ----------
const IRREG = {box:'boxes',bunch:'bunches',dozen:'dozen',loaf:'loaves',lb:'lb',each:'each',peach:'peaches'};
const plural = (w, n) => n === 1 ? w : (IRREG[w] || (/(x|ch|sh|s)$/.test(w) ? w + 'es' : w + 's'));
const r1 = x => (Math.round(x*10)/10).toString();
function ozStr(g){ const oz = g/28.3495; return oz >= 16 ? r1(oz/16) + ' lb' : r1(oz) + ' oz'; }
function W(g){ const u = (P && P.units) || 'both', gs = Math.round(g) + ' g';
  return u === 'g' ? gs : u === 'oz' ? ozStr(g) : `${gs} (${ozStr(g)})`; }
// Kitchen-friendly measures: [grams per unit, singular, plural?]
const FRIENDLY = { eggs:[50,'egg'], rice_white:[185,'cup dry'], quinoa:[170,'cup dry'], oats:[80,'cup'], lentils:[192,'cup dry'],
  milk:[245,'cup'], greek_yogurt:[245,'cup'], cottage_cheese:[225,'cup'], cheddar:[113,'cup shredded'], mozzarella:[113,'cup shredded'],
  honey:[21,'tbsp'], olive_oil:[13.5,'tbsp'], soy_sauce:[16,'tbsp'], peanut_butter:[16,'tbsp'], garlic:[5,'clove'], bell_pepper:[150,'pepper'],
  onion:[150,'onion'], banana:[120,'banana'], apple:[180,'apple'], tortillas:[70,'tortilla'], bread:[40,'slice'], potatoes:[213,'potato'],
  sweet_potato:[200,'sweet potato'], spinach:[30,'cup'], salsa:[260,'cup'], marinara:[250,'cup'], black_beans:[260,'can'], chickpeas:[260,'can'],
  canned_tomatoes:[794,'can (28 oz)'], tuna:[142,'can'], berries:[140,'cup'], broccoli:[90,'cup'], mixed_veg:[135,'cup'], green_beans:[110,'cup'],
  whey:[30,'scoop'], almonds:[143,'cup'], carrots:[61,'carrot'], egg_whites:[243,'cup'] };
const COUNTABLE = new Set(['egg','clove','pepper','onion','banana','apple','tortilla','slice','potato','sweet potato','carrot','scoop','can','can (28 oz)']);
function fracStr(x){ const w = Math.floor(x), f = Math.round((x-w)*4)/4, map = {0:'',0.25:'¼',0.5:'½',0.75:'¾',1:''};
  const ww = f === 1 ? w+1 : w; return (ww ? ww : '') + map[f] || '0'; }
function Wp(g){ const u=(P&&P.units)||'both'; return u==='both' ? `${Math.round(g)} g / ${ozStr(g)}` : W(g); }
function friendly(id, g){
  const F = FRIENDLY[id]; if (!F) return W(g);
  const q = g / F[0], unit = F[1];
  if (COUNTABLE.has(unit)){ const n = Math.max(1, Math.round(q*2)/2); if (q < 0.3) return W(g);
    const [base, ...rest] = unit.split(' (');
    return `${n % 1 ? fracStr(n) : n} ${n > 1 ? plural(base, 2) : base}${rest.length ? ' (' + rest.join(' (') : ''} (${Wp(g)})`; }
  if (q < 0.25) return W(g);
  const [w0, ...more] = unit.split(' '); const uq = Math.round(q*4)/4;
  return `${fracStr(q)} ${w0 === 'cup' && uq > 1 ? 'cups' : w0}${more.length ? ' ' + more.join(' ') : ''} (${Wp(g)})`;
}
function buyHeadline(l){
  const o = l.buy.o, n = l.buy.n, noun = o.package_noun || 'package';
  if (noun === 'lb') return `Buy about ${r1(n)} lb`;
  if (noun === 'dozen') return `Buy ${n} dozen`;
  return `Buy ${n} ${plural(noun, n)}`;
}
function pkgDesc(o){
  const noun = o.package_noun || 'package';
  if (noun === 'lb') return `${o.product} · ${money(o.price)}/lb`;
  if (noun === 'dozen') return `${o.product}, 1 dozen (12 eggs)`;
  if (o.package_size === 'each') return `${o.product}, sold each`;
  if (o.count_per_package && noun !== 'dozen') return `${o.product.replace(/, \d+ ct$/,'')}, pack of ${o.count_per_package} ${plural(o.count_noun, o.count_per_package)}`;
  const cnt = o.count_per_package ? ` (${o.count_per_package} ${plural(o.count_noun, o.count_per_package)})` : '';
  const size = o.package_size.replace(/ (bag|can|ct)$/,'').replace(/^(\d+) ct$/, '$1-count');
  return `${o.product}, ${size} ${noun}${cnt}`;
}

// ---------- profiles ----------
async function boot(){
  await loadPrices();
  let idx = await Store.listProfiles();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(()=>{});
  const onboarded = localStorage.getItem(OB_FLAG), wiz = wizLoad();
  if (!idx.length && !onboarded) return startWizard('first', wiz);          // brand-new device: first-run wizard (resumes if closed mid-way)
  if (idx.length && !onboarded) localStorage.setItem(OB_FLAG, '1');       // existing users: migrate silently, never show it
  if (!idx.length){ const p = newProfile('Roman'); p.mealSizes = {mode:'sizes', sizes:{breakfast:'L',lunch:'M',dinner:'H',meal4:'L',meal5:'L',snack:'L'}, pct:[]}; await Store.saveProfile(p); await Store.setActiveId(p.id); idx = [p]; }
  let id = await Store.getActiveId(); if (!idx.find(x => x.id === id)) id = idx[0].id;
  await switchProfile(id);
  if (curPlan()){ TAB = 'week'; render(); }
  if (wiz && wiz.mode !== 'first') startWizard(wiz.mode, wiz);            // resume an unfinished "new profile" / "re-run" wizard
}
async function switchProfile(id){
  P = await Store.getProfile(id); await Store.setActiveId(id);
  P.ui = P.ui || { hideChecked:false, groupBy:'section' }; P.checks = P.checks || {}; P.locations = P.locations || {};
  P.myRecipes = P.myRecipes || []; P.customIngs = P.customIngs || {}; P.locks = P.locks || []; P.history = P.history || [];
  applyCustom();
  $('#profileName').textContent = P.name;
  await buildPriceRows();
  $('#sub').textContent = 'Budget macro meal prep' + (P.zip ? ' · ZIP ' + P.zip : '');
  render();
}
async function profilesDialog(){
  const idx = await Store.listProfiles();
  $('#dlgBody').innerHTML = `<h2>Profiles</h2>
   <div class="note">🔒 Profiles are saved only on this device (this browser's storage). Nobody else can see them unless you export one.
   On a shared phone, anyone holding it can open any profile here.</div>
   ${idx.map(x => `<div class="prow ${x.id===P.id?'act':''}"><span class="n">${esc(x.name)}</span>
     <button class="btn sm sec" data-act="pswitch" data-id="${x.id}">Open</button>
     <button class="btn sm sec" data-act="prename" data-id="${x.id}">Rename</button>
     <button class="btn sm warn" data-act="pdelete" data-id="${x.id}">Delete</button></div>`).join('')}
   <div class="btns" style="margin-top:12px"><button class="btn" data-act="pnew">+ New profile</button></div>
   <h3>Move to a new phone</h3>
   <div class="btns"><button class="btn sec" data-act="pexportfile">Export file</button><button class="btn sec" data-act="pexportcode">Copy code</button></div>
   <label>Import (paste a code or JSON)</label><textarea id="importText" placeholder="MP1.…"></textarea>
   <div class="btns" style="margin-top:8px"><button class="btn sec" data-act="pimporttext">Import code</button>
   <label class="btn sec" style="margin:0;text-align:center;color:var(--g)">Import file<input type="file" id="importFile" accept=".json,application/json" hidden></label></div>
   <p class="muted">Cross-device sync (Firebase sign-in) is ${SYNC_CONFIG.enabled ? 'ON' : 'off. Data stays on this device'}.</p>
   <button class="btn sec" data-act="close" style="margin-top:6px">Close</button>`;
  $('#importFile').onchange = async e => { const f = e.target.files[0]; if (f) importProfile(await f.text()); };
  if (!$('#dlg').open) $('#dlg').showModal();
}
async function importProfile(text){
  try {
    const p = ProfileIO.fromText(text), idx = await Store.listProfiles();
    p.id = uid(); if (idx.some(x => x.name === p.name)) p.name += ' (imported)';
    await Store.saveProfile(p); await switchProfile(p.id); $('#dlg').close(); toast('Imported ' + p.name);
  } catch(e){ alert('Couldn\'t import: ' + e.message); }
}

// ---------- plan ----------
function curPlan(){ return P.current && P.current.plan; }
async function makePlan(fixedSel, newSeed, explore){
  if (!P.stores.length){ alert('Pick at least one store.'); return; }
  applyCustom();
  const seed = newSeed || (P.current && P.current.seed) || 1;
  P.locks = (P.locks || []).filter(id => RBY[id]);
  const prev = curPlan();
  const plan = generate(P, PRICES, seed, fixedSel, { locked: P.locks, avoidKey: explore && prev ? selKey(prev.sel) : null, prevIds: [prev, ...(P.history||[]).slice(0,2).map(h=>h.plan)].filter(Boolean).flatMap(p => Object.values(p.sel).flat()), explore });
  if (P.current) { P.history = [P.current, ...(P.history || [])].slice(0, 10); }
  P.current = { planId: uid(), seed, plan };
  await save(); render();
}
function checksOf(){ const id = P.current && P.current.planId; if (!id) return {}; return P.checks[id] = P.checks[id] || {}; }

// ---------- render ----------
function render(){
  const navTab = ['setup','macros','prep','reuse','more'].includes(TAB) ? 'more' : TAB;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === navTab));
  const plan = curPlan();
  if (!['setup','log','macros','more','recipes'].includes(TAB) && !plan){ main().innerHTML = `<div class="card"><h2>No plan yet</h2><p>Fill in Setup and tap <b>Generate plan</b>.</p><button class="btn" data-tab="setup">Go to Setup</button></div>`; return; }
  main().innerHTML = ({setup:renderSetup, week:renderWeek, shop:renderShop, prep:renderPrep, recipes:renderRecipes, reuse:renderReuse, log:renderLog, macros:renderMacros, more:renderMore})[TAB](plan);
}

function renderSetup(){
  const t = P.targets, calc = targetsOf(t);
  const chainChips = ALL_CHAINS.map(s => `<button class="chip ${P.stores.includes(s)?'on':''}" data-act="store" data-v="${esc(s)}">${esc(s)}</button>`).join('');
  const locRows = P.stores.map(ch => {
    const prov = CHAIN_PROVIDER(ch), loc = P.locations[ch];
    return `<div class="prow"><span class="n">${esc(ch)}<br><small class="muted">${loc ? esc(loc.name + (loc.address ? ' · ' + loc.address : '')) + (loc.locationId ? '' : ' (your note)') : 'No store chosen'}</small></span>
      <button class="btn sm sec" data-act="chooseloc" data-v="${esc(ch)}">Choose my store</button></div>`; }).join('');
  return `<h1 class="screen">Plan setup</h1><div class="card"><div class="note">🔒 <b>Your data stays on your device.</b> Each profile (${esc(P.name)}) is stored only in this browser. Use the profile button to switch or add people.</div>
  <h2>Targets</h2>
  <div class="chips"><button class="chip ${t.mode==='manual'?'on':''}" data-act="mode" data-v="manual">Set all macros</button><button class="chip ${t.mode==='calc'?'on':''}" data-act="mode" data-v="calc">Calories + protein</button></div>
  <div class="row"><div><label>Calories / day</label><input id="kcal" type="number" inputmode="numeric" value="${t.kcal}"></div><div><label>Protein (g)</label><input id="protein" type="number" inputmode="numeric" value="${t.protein}"></div></div>
  ${t.mode==='manual' ? `<div class="row"><div><label>Carbs (g)</label><input id="carbs" type="number" inputmode="numeric" value="${t.carbs}"></div><div><label>Fat (g)</label><input id="fat" type="number" inputmode="numeric" value="${t.fat}"></div></div>`
   : `<p class="muted">Calculated: ${calc.c} g carbs · ${calc.f} g fat (27% of calories from fat).</p>`}
  <div class="row"><div><label>Meals per day</label><select id="mealsPerDay">${[2,3,4,5].map(n=>`<option ${P.mealsPerDay==n?'selected':''}>${n}</option>`).join('')}</select></div>
  <div><label>Servings (people)</label><select id="servings">${[1,2].map(n=>`<option ${P.servings==n?'selected':''}>${n}</option>`).join('')}</select></div></div>
  <label>Units</label><select id="units"><option value="both" ${(P.units||'both')==='both'?'selected':''}>Both: g and oz</option><option value="g" ${P.units==='g'?'selected':''}>Grams</option><option value="oz" ${P.units==='oz'?'selected':''}>Ounces / lb</option></select>
  </div><div class="card"><h2>Meals, budget & units</h2>
  ${mealSizesUI()}
  <label><input type="checkbox" id="snacks" ${P.snacks?'checked':''} style="width:auto;min-height:0"> Add a daily snack</label>
  <div class="row"><div><label>Weekly budget ($)</label><input id="budget" type="number" inputmode="decimal" value="${P.budget}"></div>
  <div><label>Distinct recipes / week</label><select id="variety">${[2,3,4].map(n=>`<option ${P.variety==n?'selected':''}>${n}</option>`).join('')}</select></div></div>
  <label>Prep style</label><select id="prepStyle"><option value="sunday" ${P.prepStyle==='sunday'?'selected':''}>One big Sunday prep</option><option value="sunwed" ${P.prepStyle==='sunwed'?'selected':''}>Sunday + Wednesday</option></select>
  </div><div class="card"><h2>Food</h2>
  <label>Foods I like / want to make</label><input id="likes" value="${esc(P.likes)}" placeholder="chicken, rice, eggs">
  <label>Dislikes</label><input id="dislikes" value="${esc(P.dislikes)}" placeholder="mushrooms">
  <label>Allergies</label><input id="allergies" value="${esc(P.allergies)}" placeholder="peanuts, dairy, gluten…">
  </div><div class="card"><h2>Location & stores</h2>
  <label>ZIP code</label><input id="zip" inputmode="numeric" maxlength="5" value="${esc(P.zip)}">
  ${PLYMOUTH_AREA(P.zip) ? '' : `<div class="warnnote">The built-in prices are estimates for the Plymouth, MI area. They're labeled that way for your ZIP. Live prices come from the Kroger family when a price proxy is set up.</div>`}
  <label>Store chains</label><div class="chips">${chainChips}</div>
  <label>My store locations</label>${locRows || '<p class="muted">Select a chain first.</p>'}
  <div style="margin-top:16px"><button class="btn" data-act="generate">✨ Generate plan</button></div></div>`;
}
function readSetup(){
  const v = id => $('#'+id) && $('#'+id).value;
  Object.assign(P.targets, { kcal:+v('kcal'), protein:+v('protein') });
  if (P.targets.mode === 'manual') Object.assign(P.targets, { carbs:+v('carbs'), fat:+v('fat') });
  Object.assign(P, { mealsPerDay:+v('mealsPerDay'), servings:+v('servings'), snacks:$('#snacks').checked, budget:+v('budget'), variety:+v('variety'),
    prepStyle:v('prepStyle'), likes:v('likes'), dislikes:v('dislikes'), allergies:v('allergies'), zip:(v('zip')||'').trim(), units:v('units')||'both', });
  if ($('#msPct')) P.mealSizes.pct = $('#msPct').value.split(',').map(Number).filter(x=>x>0);
}
async function chooseLocation(ch){
  readSetup(); const prov = CHAIN_PROVIDER(ch);
  let list = [], err = '';
  if (prov.live){ try { list = await prov.searchLocations(P.zip, ch); } catch(e){ err = e.message; } }
  $('#dlgBody').innerHTML = `<h2>Choose my ${esc(ch)}</h2>
   ${prov.live ? (list.length ? list.map(l => `<div class="prow"><span class="n">${esc(l.name)}<br><small class="muted">${esc(l.address||'')}</small></span><button class="btn sm" data-act="setloc" data-ch="${esc(ch)}" data-loc='${esc(JSON.stringify(l))}'>Choose</button></div>`).join('')
       : `<p class="muted">${err ? esc(err) : 'No stores found near ' + esc(P.zip) + '.'}</p>`)
     : `<div class="warnnote">${KROGER_FAMILY.includes(ch) ? 'Store search needs a price proxy (PRICE_API_URL), which isn\'t set up yet. See PROXY_SPEC.md.' : esc(ch) + ' has no public location or price API, so prices stay estimated and the list groups by section.'}
       You can type a note to remember which store you use.</div>
       <label>My store (note)</label><input id="locNote" value="${esc((P.locations[ch]||{}).name||'')}" placeholder="e.g. ${esc(ch)} on Ann Arbor Rd">
       <button class="btn" style="margin-top:10px" data-act="setlocnote" data-ch="${esc(ch)}">Save</button>`}
   <button class="btn sec" data-act="close" style="margin-top:8px">Close</button>`;
  if (!$('#dlg').open) $('#dlg').showModal();
}

function pct(x){ const v = x*100, c = Math.abs(v) <= 5 ? 'ok' : Math.abs(v) <= 10 ? 'mid' : 'bad'; return `<span class="${c}">${v>=0?'+':''}${v.toFixed(1)}%</span>`; }
function renderWeek(plan){
  const sel = plan.sel, alts = type => RECIPES.filter(r => r.type === type && allowed(r, P)), used = Object.values(sel).flat();
  const rows = ['breakfast','main','snack'].flatMap(type => (sel[type]||[]).map((id, ix) => { const locked = (P.locks||[]).includes(id);
    return `<div class="line"><div class="ltitle">${esc(RBY[id].name)} ${RBY[id].mine?'<span class="mine">Mine</span>':''} ${RBY[id].pin?'📌':''}</div><div class="sub">${type === 'main' ? 'Lunch / dinner' : type[0].toUpperCase()+type.slice(1)}${locked?' · locked':''}</div>
    <div class="btns" style="margin-top:8px"><button class="btn sm ${locked?'':'sec'}" data-act="lock" data-id="${id}" aria-pressed="${locked}" aria-label="${locked?'Unlock':'Lock'} ${esc(RBY[id].name)}">${locked?'🔒 Locked':'🔓 Lock'}</button>
    <button class="btn sm sec" data-act="slotregen" data-type="${type}" data-ix="${ix}" ${locked?'disabled':''}>🎲 Different one</button></div>
    <details class="swap"><summary class="btn sm sec">Pick a specific one</summary><select data-act="swap" data-type="${type}" data-ix="${ix}" aria-label="Swap ${esc(RBY[id].name)}"><option value="">Choose a replacement…</option>${alts(type).filter(r=>!used.includes(r.id) && !(r.mine && r.usePlans===false)).map(r=>`<option value="${r.id}">${esc(r.name)}${r.mine?' (Mine)':''}</option>`).join('')}</select></details></div>`; })).join('');
  const T = plan.T, over = plan.total > plan.budget;
  const days = plan.days.map((d, di) => `<div class="card day"><h2>${d.day}</h2>${d.meals.map((m, mi) => { const r = RBY[m.recipe], g = m.ing.reduce((a,i)=>a+i.g,0);
    const mains = m.ing.filter(i => i.role !== 'x').map(i => ING[i.id].name.split(',')[0].toLowerCase()).slice(0,3).join(', ');
    return `<div class="meal"><div class="slot">${m.slot} ${splitOf(plan) ? (()=>{const tk=T.kcal*splitOf(plan)[mi], d=m.m.kcal/tk-1; return `<span class="sub" style="display:inline;text-transform:none;letter-spacing:0;font-weight:600">· target ~${Math.round(tk)} · actual ${Math.round(m.m.kcal)} kcal ${Math.abs(d)<=0.1?'<span class="ok">✓</span>':`<span class="mid">(${d>0?'+':''}${Math.round(d*100)}%)</span>`}</span>`;})() : ''}</div>
    <div class="ltitle">${esc(r.name)}</div>${macroChips(m.m)}<div class="sub">${esc(mains)} · ${W(g)} portion</div>
    <details class="more"><summary>Show amounts</summary><ul class="amts">${m.ing.map(i => `<li><span>${esc(ING[i.id].name.split(',')[0])}</span><span>${W(i.g)}</span></li>`).join('')}</ul></details></div>`; }).join('')}
    <div class="daytot"><div><b>${Math.round(d.tot.kcal)}</b>kcal ${pct(plan.acc[di].kcal)}</div><div><b>${Math.round(d.tot.p)}g</b>protein ${pct(plan.acc[di].p)}</div><div><b>${Math.round(d.tot.c)}g</b>carbs ${pct(plan.acc[di].c)}</div><div><b>${Math.round(d.tot.f)}g</b>fat ${pct(plan.acc[di].f)}</div></div></div>`).join('');
  return `<h1 class="screen">Week plan</h1>
   <div class="card"><div class="sum"><div><span class="sub">Daily target</span><b>${T.kcal} kcal</b></div><div><span class="sub">Weekly cost</span><b class="${over?'bad':''}">${money(plan.total)}</b><span class="sub">${over ? 'over ' + money(plan.total-plan.budget) : 'of ' + money(plan.budget) + ' ✓'}</span></div></div>
   ${macroChips({kcal:T.kcal,p:T.p,c:T.c,f:T.f})}
   <details class="more" open><summary>This week's recipes (${used.length})</summary>${rows}</details>
   <div class="btns"><button class="btn sec" data-act="regen">🔄 Regenerate week</button><button class="btn sec" data-act="undo" ${(P.history||[]).length?'':'disabled'}>↩️ Previous plan${(P.history||[]).length?` (${P.history.length})`:''}</button></div><div class="btns" style="margin-top:10px"><button class="btn" data-act="saveplan">💾 Save plan</button></div>
   <p class="sub">Portion amounts are raw/dry weights${plan.serv>1?`, per person (×${plan.serv} people)`:''}.</p></div>
   ${days}${renderSaved()}`;
}
function renderSaved(){
  return `<div class="card"><h2>Saved plans (${esc(P.name)})</h2>${P.plans.length ? P.plans.map(s => `<div class="prow"><span class="n">${esc(s.name)}<br><small class="muted">${money(s.plan.total)} · ${new Date(s.savedAt).toLocaleDateString()}</small></span>
    <button class="btn sm sec" data-act="loadplan" data-id="${s.id}">Open</button><button class="btn sm warn" data-act="delplan" data-id="${s.id}">✕</button></div>`).join('') : '<p class="muted">No saved plans yet. When you save a plan, leftovers that keep (pantry or freezer items) carry into next week.</p>'}
    ${Object.keys(P.pantry||{}).length ? `<p class="muted">Carried pantry: ${Object.entries(P.pantry).map(([k,g])=>esc(ING[k].name.split(',')[0])+' '+W(g)).join(', ')}</p><button class="btn sm warn" data-act="clearpantry">Clear pantry</button>` : ''}</div>`;
}

// ----- shopping -----
function shopModel(plan){
  const ck = checksOf(), stores = {};
  plan.lines.forEach(l => {
    const st = l.buy ? l.buy.o.store : (l.missing ? (isCustomIng(l.id) ? 'Price unknown (your ingredients)' : 'Not available at selected stores') : 'From your pantry');
    (stores[st] = stores[st] || []).push(l);
  });
  let have = 0, cart = 0;
  plan.lines.forEach(l => { if (ck[l.id] === 'have') have += l.cost; if (ck[l.id] === 'cart') cart += l.cost; });
  return { ck, stores, have, cart, remaining: plan.total - have, toBuy: plan.total - have - cart };
}
function checkBtns(id, ck, small){
  return `<div class="chk ${small?'small':''}"><button class="cart ${ck[id]==='cart'?'on':''}" data-act="check" data-id="${id}" data-v="cart">🛒 In cart</button><button class="have ${ck[id]==='have'?'on':''}" data-act="check" data-id="${id}" data-v="have">🏠 Have it</button></div>`;
}
function itemRow(l, ck){
  const o = l.buy && l.buy.o, aisle = o && o.aisle ? `${esc(o.aisle)} · ` : '';
  const head = o ? buyHeadline(l) : (l.missing ? (isCustomIng(l.id) ? 'Price unknown' : 'Not stocked at your stores') : 'Use from pantry');
  return `<div class="item ${ck[l.id]||''}"><div class="top2"><span class="buy">${esc(head)}</span><span class="lt">${o ? money(l.cost) : '—'}</span></div>
   <div class="nm">${esc(ING[l.id].name)}</div>
   ${o ? `<div class="sub">${aisle}${esc(pkgDesc(o))}</div>` : ''}
   <details class="more"><summary>Details</summary><div class="sub">${o ? `${l.buy.n} × ${money(o.price)}${o.package_noun==='lb'?'/lb':''} · ${o.live?'live price':'<span class="est">estimated</span>'}<br>` : ''}Need ${W(l.need)}${l.fromPantry ? `<br>${W(l.fromPantry)} from pantry` : ''}${l.left > 5 ? `<br>Leftover ${W(l.left)}` : ''}</div></details>
   ${isCustomIng(l.id) ? `<button class="btn sm sec" data-act="setprice" data-id="${l.id}" style="margin-top:8px">${o ? 'Edit my price' : 'Add my price'}</button>` : ''}
   ${checkBtns(l.id, ck)}</div>`;
}
function renderShop(plan){
  const M = shopModel(plan), hide = P.ui.hideChecked, alpha = P.ui.groupBy === 'alpha';
  const storeCards = Object.entries(M.stores).map(([st, lines]) => {
    const sub = lines.reduce((a, l) => a + l.cost, 0);
    const meta = BASE_PRICES.find(r => r.store === (KROGER_FAMILY.includes(st) ? 'Kroger' : st));
    const live = lines.some(l => l.buy && l.buy.o.live);
    const vis = lines.filter(l => !(hide && M.ck[l.id]));
    let body = '';
    if (alpha) body = vis.sort((a,b) => ING[a.id].name.localeCompare(ING[b.id].name)).map(l => itemRow(l, M.ck)).join('');
    else {
      const anyAisle = vis.some(l => l.buy && l.buy.o.aisle);
      const key = l => l.buy && l.buy.o.aisle ? parseInt(l.buy.o.aisle.replace(/\D/g,''))||999 : 1000;
      SECTIONS.forEach(sec => { const its = vis.filter(l => SECTION_OF[l.id] === sec).sort((a,b) => anyAisle ? key(a)-key(b) : ING[a.id].name.localeCompare(ING[b.id].name));
        if (its.length) body += `<div class="sect">${sec}</div>` + its.map(l => itemRow(l, M.ck)).join(''); });
    }
    return `<div class="card store"><h2><span>${esc(st)}</span><span>${money(sub)}</span></h2>
      ${meta || live ? `<div class="muted">Prices updated ${live ? 'live' : esc(meta.last_updated)} ${live ? '' : `<span class="est">${esc(estLabel())}</span>`}${P.locations[st] ? ' · ' + esc(P.locations[st].name) : ''}</div>` : ''}
      ${body || '<p class="muted">All items checked ✓</p>'}</div>`;
  }).join('');
  const left = plan.lines.filter(l => l.left > 5 && l.buy);
  return `<h1 class="screen">Shopping list</h1><div class="sticky-sum"><div><small class="muted">Left to buy</small><br><b>${money(M.toBuy)}</b></div><div style="text-align:right"><small class="muted">Remaining ${money(M.remaining)} of total ${money(plan.total)}</small><br><small class="muted">Budget ${money(plan.budget)} ${plan.total>plan.budget?'<b class="bad">over by '+money(plan.total-plan.budget)+'</b>':'<b class="ok">✓ under</b>'}</small></div></div>
   <div class="card"><div class="sum"><div><small class="muted">Total</small><b>${money(plan.total)}</b></div><div><small class="muted">Already have (excluded)</small><b>${money(M.have)}</b></div><div><small class="muted">In cart</small><b>${money(M.cart)}</b></div><div><small class="muted">Remaining cost</small><b>${money(M.remaining)}</b></div></div>
   <div class="bar"><i style="width:${Math.min(100, plan.total/plan.budget*100)}%;background:${plan.total>plan.budget?'var(--r)':'var(--g)'}"></i></div>
   <div class="btns" style="margin-top:10px"><button class="btn sm ${hide?'':'sec'}" data-act="hidechecked">${hide?'Show':'Hide'} checked</button>
   <div class="toggle"><button class="btn sm ${alpha?'sec':''}" data-act="group" data-v="section">By section</button><button class="btn sm ${alpha?'':'sec'}" data-act="group" data-v="alpha">A–Z</button></div>
   <button class="btn sm warn" data-act="resetlist">Reset list</button></div>
   <p class="muted">Cheapest store per item among your stores, buying whole packages. Aisle numbers show only when a live store API provides them. Otherwise items are grouped by section in a typical walk order.</p></div>
   ${storeCards}
   <div class="card"><h2>Leftovers after this week</h2>${left.length ? `<table class="tbl">${left.map(l => `<tr><td>${esc(ING[l.id].name)}</td><td>${W(l.left)}</td><td class="muted">${ING[l.id].shelf>=14||ING[l.id].freeze?'carries forward':'use soon'}</td></tr>`).join('')}</table>` : '<p class="muted">None</p>'}</div>`;
}

// ----- prep -----
function renderPrep(plan){
  const S = prepSessions(plan);
  return '<h1 class="screen">Prep plan</h1>' + S.map(s => {
    let n = 1; const steps = [];
    if (s.recs.some(x => x.r.method === 'oven')) steps.push(`Preheat the oven to 425°F and line 2–3 sheet pans.`);
    Object.entries(s.grains).forEach(([g, list]) => steps.push(`Start ${ING[g].name.toLowerCase()}: ${friendly(g, list.reduce((a,x)=>a+x[1],0))} total (${list.map(x=>esc(x[0])+': '+friendly(g, x[1])).join('; ')}).`));
    s.recs.forEach(x => steps.push(`<b>${esc(x.r.name)}</b> (${x.portions.length*plan.serv} portions): ${x.r.steps.map(esc).join(' ')}<details class="more"><summary>Batch amounts</summary><ul class="amts">${Object.entries(x.tot).map(([id,g])=>`<li><span>${esc(ING[id].name.split(',')[0])}</span><span>${friendly(id,g)}</span></li>`).join('')}</ul></details>`));
    steps.push(`Let everything cool for 20 min before you lid the containers.`);
    const portion = s.recs.map(x => `<h3>${esc(x.r.name)}</h3>${x.portions.map(p => `<div class="line"><div class="top2"><b>${p.day} ${p.slot}${plan.serv>1?' ×'+plan.serv:''}</b><span class="sub">${(p.share*100).toFixed(0)}% of batch · ${p.freeze?'❄️ Freeze':'Fridge'}</span></div>${macroChips(p.m)}
      <details class="more"><summary>Show amounts</summary><ul class="amts">${p.ing.filter(i=>i.role!=='x').map(i=>`<li><span>${esc(ING[i.id].name.split(',')[0])}</span><span>${friendly(i.id,i.g)}</span></li>`).join('')}</ul></details></div>`).join('')}`).join('');
    return `<div class="card"><h2>${s.name}: ${s.days.map(d=>DAYS[d]).join(', ')}</h2><p class="muted">${s.containers} containers · weigh each cooked batch and split it by the % shown.</p>
      <ol class="steps">${steps.map(t=>`<li>${t}</li>`).join('')}</ol><h3>Portioning</h3>${portion}
      <div class="note">❄️ Containers marked Freeze go past that recipe's fridge life. Move them to the fridge the night before.</div></div>`;
  }).join('');
}

// ----- recipes -----
function recipeCard(r, inPlan, plan){
  const m = recipeServingMacros(r), ck = checksOf(), shop = new Set(plan ? plan.lines.map(l => l.id) : []);
  const cps = r.ing.reduce((a,[id,g]) => a + g/r.servings*cheapestPerGram(id, PRICES, [...P.stores,'Your price']), 0);
  const unknown = r.ing.some(([id]) => isCustomIng(id) && !(P.customIngs[id] && P.customIngs[id].price));
  return `<details ${inPlan?'open':''} id="rc-${r.id}"><summary><span>${inPlan?'⭐ ':''}${esc(r.name)} ${r.mine?'<span class="mine">Mine</span>':''}</span><span class="muted">${r.mine ? esc((r.types||[]).join(', ')) : r.type}</span></summary>
   <div class="muted" style="margin-top:6px">Per serving (1 of ${r.servings}):</div>${macroChips(m, `<span>≈${money(cps)}${unknown?'+':''}/serving</span>`)}
   <p class="muted">${r.prep?`Prep ${r.prep} min · `:''}${r.cook?`Cook ${r.cook} min · `:''}Fridge ${r.fridge} days · ${r.freezer?'Freezer-friendly ❄️':'Not for freezing'} · Batch makes ${r.servings} servings${r.cookedWeight?` · cooked ${W(r.cookedWeight)}`:''}${r.tags&&r.tags.length?' · '+r.tags.map(esc).join(', '):''}</p>
   <div class="btns"><button class="btn sm" data-act="rlog" data-id="${r.id}">🍽️ Log a serving</button>${r.mine ? `<button class="btn sm sec" data-act="redit" data-id="${r.id}">Edit</button>` : ''}<button class="btn sm sec" data-act="rdup" data-id="${r.id}">Duplicate${r.mine?'':' to Mine'}</button>${r.mine ? `<button class="btn sm warn" data-act="rdel" data-id="${r.id}">Delete</button>` : ''}</div>
   ${r.mine ? `<div class="chips" style="margin-top:12px"><button class="chip ${r.usePlans!==false?'on':''}" data-act="ruse" data-id="${r.id}">${r.usePlans!==false?'✓ ':''}Use in my meal plans</button><button class="chip ${r.pin?'on':''}" data-act="rpin" data-id="${r.id}">${r.pin?'📌 ':''}Always include this week</button></div>` : ''}
   <h3>Ingredients (whole batch)</h3>${r.ing.map(([id,g]) => `<div class="ri"><span>${friendly(id,g)} ${esc(ING[id].name)}</span>${inPlan && shop.has(id) ? checkBtns(id, ck, true) : ''}</div>`).join('')}
   <h3>Steps</h3><ol class="steps">${r.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>${!allowed(r,P)?'<div class="warnnote">Excluded by your dislikes or allergies.</div>':''}</details>`;
}
function renderRecipes(plan){
  const ids = new Set(plan ? Object.values(plan.sel).flat() : []), mine = RECIPES.filter(r => r.mine);
  return `<h1 class="screen">Recipes</h1>
   <div class="card"><h2>My recipes (${mine.length})</h2><button class="btn" data-act="rnew">➕ New recipe</button>${mine.map(r=>recipeCard(r, ids.has(r.id), plan)).join('') || '<p class="sub" style="margin-top:12px">Add your own recipes. They can go into your plans and your log.</p>'}</div>
   ${plan ? `<div class="card"><h2>This week's recipes</h2><p class="muted">Check items off here or in Shop. Both stay in sync.</p>${RECIPES.filter(r=>ids.has(r.id) && !r.mine).map(r=>recipeCard(r,true,plan)).join('')}</div>` : ''}
   <div class="card"><h2>Recipe library (${RECIPES.filter(r=>!r.mine).length})</h2>${RECIPES.filter(r=>!ids.has(r.id) && !r.mine).map(r=>recipeCard(r,false,plan)).join('')}</div>`;
}

// ----- reuse -----
function renderReuse(plan){
  const shared = Object.entries(plan.uses).filter(([,rs]) => rs.length > 1).sort((a,b)=>b[1].length-a[1].length);
  const ids = new Set(Object.values(plan.sel).flat());
  const left = plan.lines.filter(l => l.left > 5 && l.buy);
  return `<div class="card"><h2>Shared ingredients</h2><p class="muted">${shared.length} of ${plan.lines.length} ingredients go into 2 or more recipes, so you buy fewer packages.</p>
   <table class="tbl">${shared.map(([id,rs]) => `<tr><td><b>${esc(ING[id].name)}</b></td><td>${rs.map(r=>esc(RBY[r].name)).join(', ')}</td></tr>`).join('')}</table></div>
   <div class="card"><h2>Leftovers & how to use them</h2>${left.map(l => { const i = ING[l.id], carry = i.shelf>=14 || i.freeze;
     const ideas = RECIPES.filter(r => !ids.has(r.id) && allowed(r,P) && r.ing.some(x=>x[0]===l.id)).slice(0,3).map(r=>esc(r.name));
     return `<div class="item"><div class="top2"><span class="nm">${esc(i.name)}</span><span>${W(l.left)}</span></div><div class="meta">${carry ? (i.shelf>=14 ? '🥫 Keeps. Carries into next week when you save this plan.' : '❄️ Freeze it. Carries into next week when you save this plan.') : '⏳ Short shelf life. Add it to this week\'s portions or a snack.'}
     ${ideas.length ? '<br>Next week ideas: ' + ideas.join(', ') : ''}</div></div>`; }).join('') || '<p class="muted">No leftovers.</p>'}
   <p class="muted">The planner gives extra weight to recipes that use your carried pantry items.</p></div>`;
}

function renderMore(){
  const it = (tab, i, t, d, act) => `<button ${act ? `data-act="${act}"` : `data-tab="${tab}"`}><span class="i">${i}</span><span>${t}<small>${d}</small></span></button>`;
  return `<div class="card"><h2>More</h2><div class="menu">
   ${it('macros','🎯','My Macros','Calories and macros from your stats, plus a weight log')}
   ${it('setup','⚙️','Plan setup','Targets, budget, foods, stores and units')}
   ${it('prep','🔪','Prep plan','Batch-cooking order and portioning')}
   ${it('reuse','♻️','Reuse & leftovers','Shared ingredients and how to use extras')}
   ${it('','👥','Profiles','Switch, add, export or import',`profiles`)}
   ${it('','🧭','Re-run setup','Walk through the setup steps again for this profile',`wizrerun`)}</div>
   <div class="note" style="margin-top:12px">🔒 Your data stays on your device.</div></div>`;
}
function macroChips(m, extra=''){
  return `<div class="mac" aria-label="macros"><span class="k">${Math.round(m.kcal)} kcal</span><span class="p">P ${Math.round(m.p)}g</span><span class="c">C ${Math.round(m.c)}g</span><span class="f">F ${Math.round(m.f)}g</span>${extra}</div>`;
}
function splitOf(plan){ return plan.shares || null; }
function mealSizesUI(){
  P.mealSizes = P.mealSizes || {mode:'sizes', sizes:{}, pct:[]};
  const ms = P.mealSizes, slots = slotsFor(P), sh = mealShares(P, slots.length), T = targetsOf(P.targets);
  const modeBtn = (v, t) => `<button class="chip ${ms.mode===v?'on':''}" data-act="msmode" data-v="${v}">${t}</button>`;
  return `<h3>Meal sizes</h3><div class="chips">${modeBtn('sizes','Light / Medium / Heavy')}${modeBtn('any','Any size (just hit daily totals)')}${modeBtn('custom','Custom %')}</div>
   ${ms.mode==='sizes' ? slots.map((sl,i)=>`<div class="line"><div class="top2"><b>${sl.label}</b><span class="sub">~${Math.round(T.kcal*sh[i])} kcal</span></div>
      <div class="seg">${['L','M','H'].map(z=>`<button class="${((ms.sizes||{})[sl.key]||'M')===z?'on':''}" data-act="msize" data-slot="${sl.key}" data-v="${z}">${{L:'Light',M:'Medium',H:'Heavy'}[z]}</button>`).join('')}</div></div>`).join('')
      + `<button class="btn sm sec" data-act="mspreset" style="margin-top:12px">Preset: light breakfast, heavy dinner</button>`
    : ms.mode==='custom' ? `<label>Percent per meal (${slots.map(x=>x.label).join(', ')})</label><input id="msPct" value="${esc((ms.pct||[]).join(','))}" placeholder="e.g. 20,30,40,10">
      ${sh ? `<p class="sub">${slots.map((x,i)=>`${x.label} ~${Math.round(T.kcal*sh[i])} kcal`).join(' · ')}</p>` : '<p class="sub">Enter one number per meal.</p>'}`
    : '<p class="sub">Portions are scaled freely so each day hits your totals. Meal sizes may vary a lot.</p>'}`;
}
function presetSizes(){ const o={}; slotsFor(P).forEach(s=>o[s.key]= s.key==='breakfast'?'L': s.key==='dinner'?'H': s.type==='snack'?'L':'M'); return o; }
// ---------- events ----------
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-tab],[data-act]'); if (!t || t.tagName === 'SELECT') return;
  if (t.dataset.tab){ if (TAB === 'setup' && $('#kcal')) readSetup(); TAB = t.dataset.tab; render(); scrollTo(0,0); return; }
  const a = t.dataset.act, id = t.dataset.id, v = t.dataset.v;
  if (a === 'profiles') return profilesDialog();
  if (a === 'close') return $('#dlg').close();
  if (a === 'pswitch'){ $('#dlg').close(); return switchProfile(id); }
  if (a === 'pnew'){ $('#dlg').close(); return startWizard('new'); }
  if (a === 'prename'){ const p = await Store.getProfile(id), n = prompt('Rename profile', p.name); if (!n) return; p.name = n.trim(); await Store.saveProfile(p); if (id === P.id){ P.name = p.name; $('#profileName').textContent = p.name; } return profilesDialog(); }
  if (a === 'pdelete'){ const idx = await Store.listProfiles(); if (idx.length < 2) return alert('Keep at least one profile.'); if (!confirm('Delete this profile and all its plans from this device?')) return;
    await Store.deleteProfile(id); if (id === P.id) await switchProfile((await Store.listProfiles())[0].id); return profilesDialog(); }
  if (a === 'pexportfile'){ const b = new Blob([JSON.stringify({v:1, profile:P}, null, 1)], {type:'application/json'}); const u = URL.createObjectURL(b), l = document.createElement('a');
    l.href = u; l.download = `prep-pal-${P.name.replace(/\W+/g,'-')}.json`; l.click(); setTimeout(()=>URL.revokeObjectURL(u), 2000); return toast('Exported'); }
  if (a === 'pexportcode'){ const c = ProfileIO.toCode(P); $('#importText').value = c; try { await navigator.clipboard.writeText(c); toast('Code copied'); } catch { toast('Code is in the box below. Copy it.'); } return; }
  if (a === 'pimporttext') return importProfile($('#importText').value);
  if (a === 'mode'){ readSetup(); P.targets.mode = v; if (v==='manual'){ const c = targetsOf({...P.targets, mode:'calc'}); P.targets.carbs ||= c.c; P.targets.fat ||= c.f; } await save(); return render(); }
  if (a === 'store'){ readSetup(); P.stores = P.stores.includes(v) ? P.stores.filter(s=>s!==v) : [...P.stores, v]; await save(); await buildPriceRows(); return render(); }
  if (a === 'chooseloc') return chooseLocation(v);
  if (a === 'msmode'){ readSetup(); P.mealSizes.mode = v; await save(); return render(); }
  if (a === 'msize'){ readSetup(); P.mealSizes.sizes = P.mealSizes.sizes || {}; P.mealSizes.sizes[t.dataset.slot] = v; await save(); return render(); }
  if (a === 'mspreset'){ readSetup(); P.mealSizes = {...P.mealSizes, mode:'sizes', sizes: presetSizes()}; await save(); return render(); }
  if (a === 'setloc'){ P.locations[t.dataset.ch] = JSON.parse(t.dataset.loc); await save(); $('#dlg').close(); await buildPriceRows(); return render(); }
  if (a === 'setlocnote'){ const n = $('#locNote').value.trim(); if (n) P.locations[t.dataset.ch] = {name:n, locationId:null}; else delete P.locations[t.dataset.ch]; await save(); $('#dlg').close(); return render(); }
  if (a === 'generate'){ readSetup(); await save(); $('#sub').textContent = 'Budget macro meal prep · ZIP ' + P.zip; await buildPriceRows(); await makePlan(null, (P.current&&P.current.seed)||1); TAB = 'week'; render(); scrollTo(0,0); return toast('Plan ready'); }
  if (a === 'regen'){ await makePlan(null, Math.floor(Math.random()*1e9)+2, true); return toast('New plan'); }
  if (a === 'lock'){ P.locks = (P.locks||[]).includes(id) ? P.locks.filter(x=>x!==id) : [...(P.locks||[]), id]; await save(); const y=scrollY; render(); scrollTo(0,y); return; }
  if (a === 'slotregen'){ const plan = curPlan(), sel = JSON.parse(JSON.stringify(plan.sel)), type = t.dataset.type, ix = +t.dataset.ix, cur = sel[type][ix];
    const recent = new Set([cur, ...(P.history||[]).slice(0,3).map(h => h.plan.sel[type] && h.plan.sel[type][ix])]);
    let opts = RECIPES.filter(r => r.type === type && inPool(r, P) && !Object.values(sel).flat().includes(r.id));
    if (!opts.length) return toast('No other recipes fit');
    const fresh = opts.filter(r => !recent.has(r.id)); if (fresh.length) opts = fresh;
    sel[type][ix] = opts[Math.floor(Math.random()*opts.length)].id; const y=scrollY; await makePlan(sel); scrollTo(0,y); return toast('Swapped in ' + RBY[sel[type][ix]].name); }
  if (a === 'undo'){ const h = (P.history||[]).shift(); if (!h) return; P.current = h; await save(); const y=scrollY; render(); scrollTo(0,y); return toast('Back to previous plan'); }
  if (a === 'saveplan'){ const n = prompt('Name this plan', 'Week of ' + new Date().toLocaleDateString()); if (!n) return;
    const plan = curPlan(); P.plans.unshift({id:P.current.planId, name:n, savedAt:new Date().toISOString(), plan, seed:P.current.seed});
    const pantry = {}; plan.lines.forEach(l => { const i = ING[l.id]; if (l.left > 5 && (i.shelf >= 14 || i.freeze)) pantry[l.id] = l.left; }); P.pantry = pantry;
    await save(); render(); return toast('Saved. Leftovers carried to pantry'); }
  if (a === 'loadplan'){ const s = P.plans.find(x => x.id === id); P.current = {planId:s.id, seed:s.seed, plan:s.plan}; await save(); return render(); }
  if (a === 'delplan'){ P.plans = P.plans.filter(x => x.id !== id); delete P.checks[id]; await save(); return render(); }
  if (a === 'clearpantry'){ P.pantry = {}; await save(); return render(); }
  if (a === 'check'){ const ck = checksOf(); ck[id] = ck[id] === v ? undefined : v; if (!ck[id]) delete ck[id]; await save();
    const y = scrollY; render(); scrollTo(0, y); return; }
  if (a === 'hidechecked'){ P.ui.hideChecked = !P.ui.hideChecked; await save(); return render(); }
  if (a === 'group'){ P.ui.groupBy = v; await save(); return render(); }
  if (a === 'resetlist'){ if (!confirm('Clear all checkmarks for this plan?')) return; P.checks[P.current.planId] = {}; await save(); return render(); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.act === 'swap' && t.value){ const sel = JSON.parse(JSON.stringify(curPlan().sel)); sel[t.dataset.type][+t.dataset.ix] = t.value; await makePlan(sel); toast('Swapped'); }
});
boot();
