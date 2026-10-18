// Planning engine: recipe selection, per-day macro fitting, shopping/cost, prep, reuse.
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const RBY = Object.fromEntries(RECIPES.map(r => [r.id, r]));
const norm = s => s.toLowerCase().trim().replace(/(es|s)$/,'');
const terms = s => (s||'').split(/[,;\n]/).map(norm).filter(Boolean);
const ALG_WORDS = {dairy:'dairy',milk:'dairy',lactose:'dairy',egg:'egg',peanut:'peanut',nut:'treenut','tree nut':'treenut',almond:'treenut',fish:'fish',seafood:'fish',gluten:'gluten',wheat:'gluten',soy:'soy'};

function mac(id, g){ const i = ING[id], k = g/100; return {kcal:i.kcal*k, p:i.p*k, c:i.c*k, f:i.f*k}; }
function addM(a,b){ a.kcal+=b.kcal; a.p+=b.p; a.c+=b.c; a.f+=b.f; return a; }
const zero = () => ({kcal:0,p:0,c:0,f:0});
function recipeServingMacros(r){ const m=zero(); r.ing.forEach(([id,g])=>addM(m,mac(id,g/r.servings))); return m; }

function targetsOf(t){
  if (t.mode === 'calc') { const p=+t.protein, f=Math.round(+t.kcal*0.27/9); return {kcal:+t.kcal,p,f,c:Math.max(0,Math.round((+t.kcal-p*4-f*9)/4))}; }
  return {kcal:+t.kcal, p:+t.protein, c:+t.carbs, f:+t.fat};
}

function recipeMatches(r, termList){
  const hay = [r.name, ...r.ing.map(([id]) => ING[id].name + ' ' + id.replace(/_/g,' '))].join(' | ').toLowerCase();
  return termList.filter(t => hay.includes(t));
}
function allowed(r, prof){
  if (recipeMatches(r, terms(prof.dislikes)).length) return false;
  const al = terms(prof.allergies);
  if (!al.length) return true;
  const tags = new Set(r.ing.flatMap(([id]) => ING[id].alg));
  for (const a of al){ for (const [w,tag] of Object.entries(ALG_WORDS)) if (a.includes(w) && tags.has(tag)) return false; }
  return recipeMatches(r, al).length === 0;
}

// ---------- prices ----------
function bestBuy(item, need, prices, stores){
  let best=null;
  for (const o of prices){ if (o.item_id!==item || !stores.includes(o.store)) continue;
    // Loose by-the-lb items are bought in ¼-lb steps; everything else in whole packages.
    const n = o.package_noun==='lb' ? Math.max(0.25,Math.ceil(need/113.4-1e-9)/4) : Math.max(1,Math.ceil(need/o.package_grams-1e-9)), cost=n*o.price;
    if (!best || cost<best.cost-0.001 || (Math.abs(cost-best.cost)<0.001 && n*o.package_grams<best.n*best.o.package_grams)) best={o,n,cost}; }
  return best;
}
function cheapestPerGram(item, prices, stores){
  let b=Infinity; for (const o of prices) if (o.item_id===item && stores.includes(o.store)) b=Math.min(b,o.price/o.package_grams); return b===Infinity?0.02:b;
}

// ---------- macro fitting ----------
// Per-meal fitting, two stages:
// 1) size each meal toward its kcal share (uniform scale of its protein/carb/fat ingredients, clamped 0.5x–2.5x);
// 2) one daily correction (protein/carb/fat scales shared by all meals) so the day hits P/C/F, protein first.
// shares = null means "any size": skip stage 1 (old behavior).
function fitDay(meals, T, shares){
  const n = meals.length;
  const R = meals.map(r => { const o={x:zero(),p:zero(),c:zero(),f:zero()}; r.ing.forEach(([id,g,role]) => addM(o[role], mac(id,g/r.servings))); return o; });
  const k = R.map((o,i) => { if (!shares) return 1; const v = o.p.kcal+o.c.kcal+o.f.kcal; if (v<=0) return 1;
    return Math.min(2.5, Math.max(0.5, (shares[i]*T.kcal - o.x.kcal)/v)); });
  const S={x:zero(),p:zero(),c:zero(),f:zero()};
  R.forEach((o,i)=>{ addM(S.x,o.x); ['p','c','f'].forEach(role=>{ const m=o[role]; addM(S[role],{kcal:m.kcal*k[i],p:m.p*k[i],c:m.c*k[i],f:m.f*k[i]}); }); });
  const val = s => ({p:S.x.p+s[0]*S.p.p+s[1]*S.c.p+s[2]*S.f.p, c:S.x.c+s[0]*S.p.c+s[1]*S.c.c+s[2]*S.f.c, f:S.x.f+s[0]*S.p.f+s[1]*S.c.f+s[2]*S.f.f});
  const err = s => { const v=val(s); return 9*((v.p-T.p)/T.p)**2 + ((v.c-T.c)/T.c)**2 + 1.5*((v.f-T.f)/T.f)**2; };
  let s=[1,1,1], e0=err(s), step=0.5;
  while (step>0.0005){ let imp=false;
    for (let j=0;j<3;j++) for (const d of [step,-step]){ const t=s.slice(); t[j]=Math.min(4,Math.max(0.25,t[j]+d)); const te=err(t); if (te<e0-1e-12){s=t;e0=te;imp=true;} }
    if(!imp) step/=2; }
  return k.map(ki => [ki*s[0], ki*s[1], ki*s[2]]);
}
const SIZE_W = { main:{L:1,M:1.5,H:2}, snack:{L:0.5,M:1,H:1.5} };
function mealShares(prof, n){
  const ms = prof.mealSizes || {mode:'sizes'}, slots = slotsFor(prof);
  if (ms.mode === 'any') return null;
  if (ms.mode === 'custom' && ms.pct && ms.pct.length === n){ const t=ms.pct.reduce((a,b)=>a+b,0)||1; return ms.pct.map(x=>x/t); }
  const w = slots.map(s => SIZE_W[s.type==='snack'?'snack':'main'][(ms.sizes||{})[s.key] || 'M']);
  const t = w.reduce((a,b)=>a+b,0); return w.map(x=>x/t);
}

// ---------- plan building ----------
function slotsFor(prof){
  const n=+prof.mealsPerDay, s=[];
  if (n>=3) s.push({key:'breakfast',label:'Breakfast',type:'breakfast'});
  const mains = n>=4 ? 2 : (n===3?2:2);
  ['Lunch','Dinner'].slice(0,mains).forEach(l=>s.push({key:l.toLowerCase(),label:l,type:'main'}));
  for (let i=4;i<=n;i++) s.push({key:'meal'+i,label:'Meal '+i,type:'snack'});
  if (prof.snacks) s.push({key:'snack',label:'Snack',type:'snack'});
  return s;
}

function scoreRecipe(r, prof, picked, prices, rnd){
  const likes = terms(prof.likes);
  let sc = 3*recipeMatches(r, likes).length;
  const used = new Set(picked.flatMap(p => p.ing.map(i=>i[0])));
  sc += 1.2*r.ing.filter(([id]) => used.has(id) && id!=='olive_oil' && id!=='garlic').length;
  sc += 0.8*r.ing.filter(([id]) => (prof.pantry||{})[id] > 50).length;
  const cps = r.ing.reduce((a,[id,g]) => a + g/r.servings*cheapestPerGram(id,prices,prof.stores),0);
  sc -= cps*1.5;
  const lastDay = prof.prepStyle==='sunwed' ? 4 : 7;
  if (r.fridge < lastDay && !r.freezer) sc -= prof.prepStyle==='sunwed' ? 1 : 3;
  return sc + rnd()*0.6;
}
function rng(seed){ let x=seed>>>0||1; return ()=>((x=(x*1664525+1013904223)>>>0)/4294967296); }

function pickSelection(prof, prices, seed){
  const rnd=rng(seed), slots=slotsFor(prof), pool=RECIPES.filter(r=>allowed(r,prof));
  const need={breakfast:slots.some(s=>s.type==='breakfast')?1:0, main:+prof.variety, snack:Math.min(2,slots.filter(s=>s.type==='snack').length)};
  const sel={breakfast:[],main:[],snack:[]}, picked=[];
  for (const type of ['main','breakfast','snack']) for (let i=0;i<need[type];i++){
    const c=pool.filter(r=>r.type===type && !picked.includes(r)); if(!c.length) break;
    c.sort((a,b)=>scoreRecipe(b,prof,picked,prices,rnd)-scoreRecipe(a,prof,picked,prices,rnd));
    sel[type].push(c[0].id); picked.push(c[0]); }
  return sel;
}

function buildPlan(prof, prices, sel){
  const T=targetsOf(prof.targets), slots=slotsFor(prof), serv=+prof.servings||1;
  const shares=mealShares(prof,slots.length);
  const days=DAYS.map((d,di)=>{
    let mi=0, si=0;
    const recs=slots.map(s=>{ const L=sel[s.type]; if(!L||!L.length) return null;
      if (s.type==='main'){ const id=L[(di+mi++)%L.length]; return {slot:s,r:RBY[id]}; }
      if (s.type==='snack'){ return {slot:s,r:RBY[L[(si++ + di)%L.length]]}; }
      return {slot:s,r:RBY[L[0]]}; }).filter(Boolean);
    const SC=fitDay(recs.map(x=>x.r),T,shares), tot=zero();
    const meals=recs.map(({slot,r},mi)=>{ const sc=SC[mi]; const m=zero(); const ing=r.ing.map(([id,g,role])=>{ const k=role==='p'?sc[0]:role==='c'?sc[1]:role==='f'?sc[2]:1; const gg=Math.round(g/r.servings*k); addM(m,mac(id,gg)); return {id,g:gg,role}; });
      addM(tot,m); return {slot:slot.label,slotKey:slot.key,recipe:r.id,ing,m,scale:sc}; });
    return {day:d,meals,tot};
  });
  // aggregate needs
  const need={}, uses={};
  days.forEach((d,di)=>d.meals.forEach(m=>m.ing.forEach(i=>{ need[i.id]=(need[i.id]||0)+i.g*serv; (uses[i.id]=uses[i.id]||new Set()).add(m.recipe); })));
  const pantry=prof.pantry||{}, lines=[]; let total=0;
  for (const [id,g] of Object.entries(need)){
    const fromPantry=Math.min(g,pantry[id]||0), buyG=g-fromPantry;
    if (buyG<=0){ lines.push({id,need:g,fromPantry,buy:null,cost:0,left:(pantry[id]||0)-g}); continue; }
    const b=bestBuy(id,buyG,prices,prof.stores);
    if(!b){ lines.push({id,need:g,fromPantry,buy:null,cost:0,left:0,missing:true}); continue; }
    total+=b.cost; lines.push({id,need:g,fromPantry,buy:b,cost:b.cost,left:b.n*b.o.package_grams-buyG});
  }
  const acc=days.map(d=>({p:d.tot.p/T.p-1,c:d.tot.c/T.c-1,f:d.tot.f/T.f-1,kcal:d.tot.kcal/T.kcal-1}));
  return {T,days,lines,total:Math.round(total*100)/100,uses:Object.fromEntries(Object.entries(uses).map(([k,v])=>[k,[...v]])),sel,serv,
    shares,stores:prof.stores,budget:+prof.budget,prepStyle:prof.prepStyle,acc,createdAt:new Date().toISOString()};
}

function generate(prof, prices, seed, fixedSel){
  if (fixedSel) return buildPlan(prof,prices,fixedSel);
  let best=null;
  for (let k=0;k<6;k++){ const p=generateOne(prof,prices,seed*7+k);
    if (p.total<=p.budget) return p; if(!best||p.total<best.total) best=p; }
  return best;
}
function generateOne(prof, prices, seed){
  let sel=pickSelection(prof,prices,seed), plan=buildPlan(prof,prices,sel);
  // budget repair: greedy swaps that lower cost while over budget
  const pool=RECIPES.filter(r=>allowed(r,prof));
  for (let it=0; it<12 && plan.total>plan.budget; it++){
    let best=null;
    for (const type of ['main','breakfast','snack']) sel[type].forEach((id,ix)=>{
      pool.filter(r=>r.type===type && !Object.values(sel).flat().includes(r.id)).forEach(r=>{
        const s2=JSON.parse(JSON.stringify(sel)); s2[type][ix]=r.id; const p2=buildPlan(prof,prices,s2);
        if (p2.total<(best?best.total:plan.total)-0.01) best=p2; }); });
    if(!best) break; sel=best.sel; plan=best;
  }
  return plan;
}

// ---------- prep sessions ----------
function prepSessions(plan){
  const sessions = plan.prepStyle==='sunwed' ? [{name:'Sunday prep',days:[0,1,2]},{name:'Wednesday prep',days:[3,4,5,6]}] : [{name:'Sunday prep',days:[0,1,2,3,4,5,6]}];
  return sessions.map(s=>{
    const byR={};
    s.days.forEach(di=>plan.days[di].meals.forEach(m=>{ (byR[m.recipe]=byR[m.recipe]||[]).push({day:plan.days[di].day,di,slot:m.slot,ing:m.ing,m:m.m}); }));
    const recs=Object.entries(byR).map(([id,portions])=>{ const r=RBY[id], tot={};
      portions.forEach(p=>p.ing.forEach(i=>tot[i.id]=(tot[i.id]||0)+i.g*plan.serv));
      const totalG=Object.values(tot).reduce((a,b)=>a+b,0);
      portions.forEach(p=>{ p.share=p.ing.reduce((a,i)=>a+i.g,0)*plan.serv/totalG; p.freeze = (p.di - s.days[0] + 1) > r.fridge; });
      return {r,portions,tot}; });
    const order={oven:0,stove:1,nocook:2};
    recs.sort((a,b)=>order[a.r.method]-order[b.r.method] || (b.r.cook-a.r.cook));
    const grains={}; recs.forEach(x=>['rice_white','quinoa','pasta','lentils'].forEach(g=>{ if(x.tot[g]) (grains[g]=grains[g]||[]).push([x.r.name,x.tot[g]]); }));
    const containers=recs.reduce((a,x)=>a+x.portions.length*plan.serv,0);
    return {...s,recs,grains,containers};
  });
}
