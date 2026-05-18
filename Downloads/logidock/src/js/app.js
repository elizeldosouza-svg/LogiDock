'use strict';

// ─── STORAGE ────────────────────────────────────────
const K={docks:'ld_docks',queue:'ld_queue',sched:'ld_sched',hist:'ld_hist',cfg:'ld_cfg',carriers:'ld_carriers',stats:'ld_stats'};
const ls=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}};
const ss=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const g=id=>document.getElementById(id);

// ─── DEFAULTS ───────────────────────────────────────
const CFG_DEF={name:'Centro de Distribuição',totalDocks:6,defaultTime:60,shifts:{a:{s:'06:00',e:'14:00'},b:{s:'14:00',e:'22:00'},c:{s:'22:00',e:'06:00'}}};
const CAR_DEF=['LogBrasil','Trans Alfa','Rápido Entregas','Norte Sul Log.','Expresso Nacional'];

let CFG=ls(K.cfg,CFG_DEF);
// Migração: força sempre 6 docas, apaga cache se tiver valor maior
if(!CFG||CFG.totalDocks!==6){CFG={...CFG_DEF,...(CFG||{}),totalDocks:6};ss(K.cfg,CFG);localStorage.removeItem(K.docks);}
let CARRIERS=ls(K.carriers,CAR_DEF);
let DOCKS=ls(K.docks,null);
let QUEUE=ls(K.queue,[]);
let SCHED=ls(K.sched,[]);
let HIST=ls(K.hist,[]);
let STATS=ls(K.stats,{done:0,totalMin:0});

function buildDocks(n){
  const a=[];
  for(let i=1;i<=n;i++) a.push({num:i,status:'livre',plate:'',carrier:'',driver:'',type:'',start:'',end:'',progress:0,nf:'',obs:''});
  return a;
}
if(!DOCKS||DOCKS.length!==CFG.totalDocks){DOCKS=buildDocks(CFG.totalDocks);ss(K.docks,DOCKS);}

const svDocks=()=>ss(K.docks,DOCKS);
const svQueue=()=>ss(K.queue,QUEUE);
const svSched=()=>ss(K.sched,SCHED);
const svHist=()=>ss(K.hist,HIST);
const svStats=()=>ss(K.stats,STATS);

// ─── HISTORY ────────────────────────────────────────
function addH(msg,tag){
  const now=new Date();
  HIST.unshift({ts:now.toISOString(),time:now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),msg,tag});
  if(HIST.length>600)HIST.splice(500);
  svHist();
}
let hFilter='all';

// ─── CLOCK ──────────────────────────────────────────
function getTurno(){
  const sh=CFG.shifts;const now=new Date();const hm=now.getHours()*60+now.getMinutes();
  const tm=t=>{if(!t)return-1;const[h,m]=t.split(':').map(Number);return h*60+m;};
  if(hm>=tm(sh.a.s)&&hm<tm(sh.a.e))return'A';
  if(hm>=tm(sh.b.s)&&hm<tm(sh.b.e))return'B';
  return'C';
}
function tickClock(){
  const now=new Date();
  g('clock').textContent=now.toLocaleTimeString('pt-BR');
  const t=getTurno();
  g('turno-lbl').textContent='Turno '+t;
  g('turno-info').textContent='Turno '+t+' • '+CFG.name;
}
setInterval(tickClock,1000);tickClock();

const WD=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
function setTodayLbl(){
  const n=new Date();
  g('today-lbl').textContent=WD[n.getDay()]+', '+n.toLocaleDateString('pt-BR')+' • '+CFG.name;
}

// ─── NAV ────────────────────────────────────────────
function goPage(page,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  g('pg-'+page).classList.add('active');
  document.querySelectorAll('.ni').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  closeDetail();
  ({docas:()=>renderDockGrid(),agenda:()=>renderFullSched(),fila:()=>renderFullQueue(),historico:()=>renderHistory(),config:()=>loadCfg()})[page]?.();
}

// ─── STATS ──────────────────────────────────────────
function updStats(){
  const libre=DOCKS.filter(d=>d.status==='livre').length;
  const ocup=DOCKS.filter(d=>d.status==='ocupado').length;
  const agrd=DOCKS.filter(d=>d.status==='aguardando').length;
  const mnt=DOCKS.filter(d=>d.status==='manutencao').length;
  const ativas=ocup+agrd;
  const pct=Math.round((ativas/CFG.totalDocks)*100);
  g('s-livre').textContent=libre;g('s-ocup').textContent=ocup;
  g('s-agrd').textContent=agrd;g('s-fila').textContent=QUEUE.length;
  g('fila-bdg').textContent=QUEUE.length;
  g('occ-pct').textContent=pct+'%';g('occ-bar').style.width=pct+'%';
  g('occ-detail').textContent=ativas+' de '+CFG.totalDocks+' docas ativas';
  g('occ-maint').textContent=mnt>0?mnt+' em manutenção':'';
  g('s-done').textContent=STATS.done;
  g('s-avg').innerHTML=(STATS.done>0?Math.round(STATS.totalMin/STATS.done):'—')+'<span style="font-size:11px;color:var(--muted)">min</span>';
}

// ─── DOCK GRID ──────────────────────────────────────
const EMO={livre:'🟢',ocupado:'🚛',aguardando:'🟡',manutencao:'🔧',agendado:'📅'};
const SLB={livre:'Livre',ocupado:'Ocupado',aguardando:'Aguardando',manutencao:'Manutenção',agendado:'Agendado'};
let dkFilter='all';

function renderDockGrid(f){
  if(f!==undefined)dkFilter=f;
  const grid=g('dock-grid');grid.innerHTML='';
  const list=dkFilter==='all'?DOCKS:DOCKS.filter(d=>d.status===dkFilter);
  if(!list.length){grid.innerHTML='<div class="empty" style="grid-column:1/-1">Nenhuma doca</div>';return;}
  list.forEach(d=>{
    const el=document.createElement('div');
    el.className='dc';
    const pb=d.status==='ocupado'&&d.progress>0?`<div class="pb" style="width:80%"><div class="pf" style="width:${d.progress}%;background:var(--blue)"></div></div>`:'';
    el.innerHTML=`<span class="dn">D${String(d.num).padStart(2,'0')}</span><div class="dico ${d.status}">${EMO[d.status]}</div><span class="dtag ${d.status}">${SLB[d.status]}</span>${d.plate?`<span class="dplate">${d.plate}</span>`:''}${pb}`;
    el.onclick=()=>showDetail(d.num);
    grid.appendChild(el);
  });
}
function filterDocks(f,btn){
  document.querySelectorAll('#dock-chips .chip').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');renderDockGrid(f);
}

// ─── DETAIL PANEL ───────────────────────────────────
function showDetail(num){
  const d=DOCKS.find(x=>x.num===num);if(!d)return;
  const panel=g('dpanel'),content=g('dpanel-c');
  const C={livre:'var(--green)',ocupado:'var(--blue)',aguardando:'var(--amber)',manutencao:'var(--red)',agendado:'var(--purple)'};
  const pc=d.progress>=80?'var(--green)':d.progress>=50?'var(--blue)':'var(--amber)';
  let acts='';
  if(d.status==='livre')acts=`<button class="btn btp btn-bl" onclick="openIni(${num})">▶ Iniciar Operação</button><button class="btn btw btn-bl" onclick="setDS(${num},'agendado');closeDetail()">📅 Marcar Agendado</button><button class="btn btr btn-bl" onclick="setDS(${num},'manutencao');closeDetail()">🔧 Colocar em Manutenção</button>`;
  else if(d.status==='ocupado')acts=`<button class="btn bts btn-bl" onclick="finishDock(${num})">✓ Finalizar Operação</button><button class="btn btw btn-bl" onclick="updProg(${num})">📊 Atualizar Progresso</button><button class="btn btr btn-bl" onclick="cancelDock(${num})">✕ Cancelar / Liberar</button>`;
  else if(d.status==='aguardando')acts=`<button class="btn btp btn-bl" onclick="openIni(${num})">▶ Iniciar Operação</button><button class="btn btg btn-bl" onclick="setDS(${num},'livre',true);closeDetail()">← Liberar Doca</button>`;
  else if(d.status==='agendado')acts=`<button class="btn btp btn-bl" onclick="openIni(${num})">▶ Iniciar Operação</button><button class="btn btg btn-bl" onclick="setDS(${num},'livre',true);closeDetail()">✕ Cancelar Agendamento</button>`;
  else if(d.status==='manutencao')acts=`<button class="btn bts btn-bl" onclick="setDS(${num},'livre',true);closeDetail()">✓ Manutenção Concluída</button>`;

  const infoRows=[
    d.plate&&['Placa',`<span style="font-family:monospace;font-weight:700">${d.plate}</span>`],
    d.carrier&&['Transportadora',d.carrier],
    d.driver&&['Motorista',d.driver],
    d.type&&['Operação',d.type],
    d.nf&&['NF / Pedido',`<span style="font-family:monospace">${d.nf}</span>`],
    d.start&&['Início',`<span style="font-family:monospace">${d.start}</span>`],
    d.end&&['Prev. Término',`<span style="font-family:monospace">${d.end}</span>`],
    d.obs&&['Obs',`<span style="font-size:11px">${d.obs}</span>`],
  ].filter(Boolean).map(([l,v])=>`<div class="irow"><span class="ilbl">${l}</span><span class="ival">${v}</span></div>`).join('');

  content.innerHTML=`
    <div class="dnum">D${String(d.num).padStart(2,'0')}</div>
    <div class="dsub">DOCA ${d.num} — <span style="color:${C[d.status]}">${SLB[d.status].toUpperCase()}</span></div>
    ${d.plate?`<div class="card" style="margin:0 14px 12px">${infoRows}
      ${d.status==='ocupado'&&d.progress>=0?`<div style="padding:10px 14px;border-top:1px solid var(--border)"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px"><span style="color:var(--muted)">Progresso</span><span style="font-family:monospace;font-weight:700;color:${pc}">${d.progress}%</span></div><div class="pb" style="height:7px"><div class="pf" style="width:${d.progress}%;background:${pc}"></div></div></div>`:''}
    </div>`:`<div style="padding:0 14px 12px;font-size:13px;color:var(--muted)">${d.status==='manutencao'?'⚠️ Em manutenção preventiva.':'✅ Disponível para operação.'}</div>`}
    <div style="padding:0 14px">${acts}</div>
  `;
  panel.classList.add('open');panel.scrollTop=0;
}
function closeDetail(){g('dpanel').classList.remove('open');}

function setDS(num,status,clear){
  const d=DOCKS.find(x=>x.num===num);if(!d)return;
  d.status=status;
  if(clear){d.plate='';d.carrier='';d.driver='';d.type='';d.start='';d.end='';d.progress=0;d.nf='';d.obs='';}
  svDocks();renderDockGrid();updStats();renderDashSched();renderDashQueue();
}

function openIni(num){
  const d=DOCKS.find(x=>x.num===num);
  g('ini-title').textContent='Iniciar — D'+String(num).padStart(2,'0');
  const now=new Date();
  const hhmm=now.toTimeString().slice(0,5);
  const endT=new Date(now.getTime()+CFG.defaultTime*60000).toTimeString().slice(0,5);
  const qOpts=QUEUE.map(q=>`<option value="${q.id}">${q.plate} · ${q.vehicle} · ${q.carrier}</option>`).join('');
  g('ini-body').innerHTML=`
    ${QUEUE.length?`<div class="fg"><label class="flbl">Puxar da Fila</label><select class="fsel" id="ini-q" onchange="fillFromQ(this.value)"><option value="">— Inserir manualmente —</option>${qOpts}</select></div>`:''}
    <div class="frow"><div class="fg"><label class="flbl">Placa <span class="req">*</span></label><input class="finp mono" id="ini-placa" type="text" placeholder="ABC-1234" maxlength="8" autocapitalize="characters" value="${d.plate||''}"></div>
    <div class="fg"><label class="flbl">Veículo</label><select class="fsel" id="ini-veic"><option>Caminhão Toco</option><option>Truck</option><option>Carreta Simples</option><option>Furgão</option><option>Van</option></select></div></div>
    <div class="fg"><label class="flbl">Motorista</label><input class="finp" id="ini-mot" type="text" placeholder="Nome completo" value="${d.driver||''}"></div>
    <div class="fg"><label class="flbl">Transportadora</label><select class="fsel" id="ini-car">${CARRIERS.map(c=>`<option>${c}</option>`).join('')}</select></div>
    <div class="frow"><div class="fg"><label class="flbl">Operação</label><select class="fsel" id="ini-tipo"><option>Carregamento</option><option>Descarga</option><option>Transferência</option><option>Devolução</option><option>Coleta</option></select></div>
    <div class="fg"><label class="flbl">NF / Pedido</label><input class="finp" id="ini-nf" type="text" placeholder="NF-000000" value="${d.nf||''}"></div></div>
    <div class="frow"><div class="fg"><label class="flbl">Início</label><input class="finp" id="ini-s" type="time" value="${hhmm}"></div>
    <div class="fg"><label class="flbl">Prev. Término</label><input class="finp" id="ini-e" type="time" value="${endT}"></div></div>
    <div class="fg"><label class="flbl">Obs</label><textarea class="fta" id="ini-obs">${d.obs||''}</textarea></div>
  `;
  g('btn-ini').onclick=()=>confirmIni(num);
  closeDetail();openModal('modal-iniciar');
}

function fillFromQ(qid){
  if(!qid)return;
  const q=QUEUE.find(x=>x.id==qid);if(!q)return;
  g('ini-placa').value=q.plate;
  if(g('ini-mot'))g('ini-mot').value=q.driver||'';
  if(g('ini-nf'))g('ini-nf').value=q.nf||'';
  if(g('ini-obs'))g('ini-obs').value=q.obs||'';
  setSel('ini-car',q.carrier);setSel('ini-tipo',q.type);
}

function confirmIni(num){
  const placa=(g('ini-placa')?.value||'').trim().toUpperCase();
  if(!placa){toast('Informe a placa!','e');return;}
  const d=DOCKS.find(x=>x.num===num);
  const qid=g('ini-q')?.value;
  d.status='ocupado';d.plate=placa;
  d.driver=g('ini-mot')?.value.trim()||'';
  d.carrier=g('ini-car')?.value||'';
  d.type=g('ini-tipo')?.value||'';
  d.nf=g('ini-nf')?.value.trim()||'';
  d.obs=g('ini-obs')?.value.trim()||'';
  d.start=g('ini-s')?.value||'';
  d.end=g('ini-e')?.value||'';
  d.progress=0;
  if(qid){QUEUE=QUEUE.filter(x=>x.id!=qid).map((x,i)=>({...x,id:i+1}));svQueue();}
  svDocks();renderDockGrid();updStats();renderDashSched();renderDashQueue();
  addH(`D${String(num).padStart(2,'0')} — ${placa} (${d.type}) iniciada | ${d.carrier}`,'op');
  closeModal('modal-iniciar');toast(`▶ D${String(num).padStart(2,'0')} — ${placa} iniciado`,'s');
}

function finishDock(num){
  const d=DOCKS.find(x=>x.num===num);if(!d)return;
  const pl=d.plate,tp=d.type,ca=d.carrier;
  const sm=d.start?parseInt(d.start.split(':')[0])*60+parseInt(d.start.split(':')[1]):null;
  const now=new Date();const nm=now.getHours()*60+now.getMinutes();
  const el=sm!==null?Math.max(1,nm-sm):CFG.defaultTime;
  STATS.done++;STATS.totalMin+=el;svStats();
  d.status='livre';d.plate='';d.carrier='';d.driver='';d.type='';d.start='';d.end='';d.progress=0;d.nf='';d.obs='';
  svDocks();closeDetail();renderDockGrid();updStats();renderDashSched();
  addH(`D${String(num).padStart(2,'0')} finalizada — ${pl} (${tp}) | ${ca} | ${el}min`,'fin');
  toast(`✅ D${String(num).padStart(2,'0')} finalizada — ${pl}`,'s');
}

function cancelDock(num){
  confirmAct('Cancelar operação?','A doca será liberada.',()=>{
    const d=DOCKS.find(x=>x.num===num);const pl=d.plate;
    addH(`D${String(num).padStart(2,'0')} cancelada — ${pl}`,'cancel');
    setDS(num,'livre',true);closeDetail();toast('Operação cancelada','w');
  });
}

function updProg(num){
  const d=DOCKS.find(x=>x.num===num);
  const v=prompt(`Progresso atual: ${d.progress}%\nNovo valor (0-100):`,'');
  if(v===null)return;
  d.progress=Math.min(100,Math.max(0,parseInt(v)||0));
  svDocks();showDetail(num);renderDockGrid();
  addH(`D${String(num).padStart(2,'0')} — progresso ${d.progress}%`,'op');
  toast(`Progresso: ${d.progress}%`,'s');
}

// ─── SCHEDULE ───────────────────────────────────────
const SP={
  'em-curso':{c:'var(--blue)',bg:'rgba(88,166,255,.12)',l:'Em Curso'},
  'confirmado':{c:'var(--green)',bg:'rgba(63,185,80,.12)',l:'Confirmado'},
  'agendado':{c:'var(--purple)',bg:'rgba(188,140,255,.12)',l:'Agendado'},
  'pendente':{c:'var(--amber)',bg:'rgba(240,165,0,.12)',l:'Pendente'},
  'cancelado':{c:'var(--red)',bg:'rgba(248,81,73,.12)',l:'Cancelado'},
};
let sfilt='all',editId=null;

function renderDashSched(){
  const tb=g('dash-sched');
  const today=new Date().toISOString().split('T')[0];
  const list=SCHED.filter(s=>s.date===today||!s.date).sort((a,b)=>a.time.localeCompare(b.time)).slice(0,6);
  if(!list.length){tb.innerHTML='<tr><td colspan="5" class="empty" style="padding:14px">Sem agendamentos hoje</td></tr>';return;}
  tb.innerHTML=list.map(s=>{const sp=SP[s.status]||SP.pendente;return`<tr>
    <td class="mono" style="font-size:10px">${s.time}</td>
    <td><span class="ptag">${s.plate}</span></td>
    <td style="font-size:10px">${s.type}</td>
    <td class="mono" style="font-size:10px">${s.dock?'D'+String(s.dock).padStart(2,'0'):'—'}</td>
    <td><span class="spill" style="color:${sp.c};background:${sp.bg}"><span class="dot"></span>${sp.l}</span></td>
  </tr>`;}).join('');
}

function renderFullSched(){
  const tb=g('full-sched');
  const q=(g('sched-search')?.value||'').toLowerCase();
  const df=g('sched-date')?.value||'';
  let list=SCHED.filter(s=>{
    if(sfilt!=='all'&&s.status!==sfilt)return false;
    if(df&&s.date&&s.date!==df)return false;
    if(q&&!(s.plate+s.driver+s.carrier+s.nf+s.type+s.obs).toLowerCase().includes(q))return false;
    return true;
  }).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  g('sched-sub').textContent=list.length+' agendamento(s)';
  if(!list.length){tb.innerHTML='<tr><td colspan="8" class="empty">Nenhum resultado</td></tr>';return;}
  tb.innerHTML=list.map(s=>{const sp=SP[s.status]||SP.pendente;return`<tr>
    <td class="mono" style="font-size:9px">${s.date?s.date.split('-').reverse().join('/'):'—'} ${s.time}</td>
    <td><span class="ptag">${s.plate}</span></td>
    <td style="font-size:10px;color:var(--muted)">${s.driver||'—'}</td>
    <td class="mono" style="font-size:10px">${s.dock?'D'+String(s.dock).padStart(2,'0'):'—'}</td>
    <td style="font-size:10px">${s.type}</td>
    <td><span class="spill" style="color:${sp.c};background:${sp.bg}"><span class="dot"></span>${sp.l}</span></td>
    <td class="mono" style="font-size:9px;color:var(--muted)">${s.nf||'—'}</td>
    <td style="display:flex;gap:3px">
      <button onclick="editSched('${s.id}')" style="background:none;border:1px solid var(--border);border-radius:5px;padding:3px 6px;cursor:pointer;font-size:11px;color:var(--muted)">✏️</button>
      <button onclick="delSched('${s.id}')" style="background:none;border:1px solid var(--border);border-radius:5px;padding:3px 6px;cursor:pointer;font-size:11px;color:var(--red)">🗑</button>
    </td>
  </tr>`;}).join('');
}

function filterSched(f,btn){sfilt=f;document.querySelectorAll('#sched-chips .chip').forEach(b=>b.classList.remove('on'));btn.classList.add('on');renderFullSched();}

function saveSched(){
  const placa=(g('f-placa')?.value||'').trim().toUpperCase();
  const mot=(g('f-motorista')?.value||'').trim();
  const data=g('f-data')?.value;const hora=g('f-hora')?.value;
  if(!placa){toast('Placa obrigatória!','e');return;}
  if(!mot){toast('Motorista obrigatório!','e');return;}
  if(!data){toast('Data obrigatória!','e');return;}
  if(!hora){toast('Horário obrigatório!','e');return;}
  if(editId){
    const idx=SCHED.findIndex(s=>s.id===editId);
    if(idx>=0){SCHED[idx]={...SCHED[idx],plate:placa,driver:mot,cpf:g('f-cpf')?.value||'',carrier:g('f-carrier')?.value||'',dock:g('f-doca')?.value||null,date:data,time:hora,type:g('f-tipo')?.value||'',nf:g('f-nf')?.value||'',obs:g('f-obs')?.value||''};}
    toast('Agendamento atualizado','s');
    editId=null;
  }else{
    const ns={id:Date.now().toString(),plate:placa,driver:mot,cpf:g('f-cpf')?.value||'',carrier:g('f-carrier')?.value||'',dock:g('f-doca')?.value||null,date:data,time:hora,type:g('f-tipo')?.value||'',nf:g('f-nf')?.value||'',obs:g('f-obs')?.value||'',status:'confirmado',progress:0};
    SCHED.push(ns);
    addH(`Agendamento: ${placa} (${ns.type}) ${data} ${hora} | ${ns.carrier}`,'op');
    toast('Agendado: '+placa,'s');
  }
  svSched();closeModal('modal-agendar');renderDashSched();renderFullSched();resetMag();
}

function editSched(id){
  const s=SCHED.find(x=>x.id===id);if(!s)return;
  editId=id;g('mag-title').textContent='Editar Agendamento';
  ['f-placa','f-motorista','f-cpf','f-data','f-hora','f-nf','f-obs'].forEach(i=>{const el=g(i);if(el)el.value=s[{['f-placa']:'plate',['f-motorista']:'driver',['f-cpf']:'cpf',['f-data']:'date',['f-hora']:'time',['f-nf']:'nf',['f-obs']:'obs'}[i]]||'';});
  setSel('f-carrier',s.carrier);setSel('f-tipo',s.type);
  openModal('modal-agendar');
}

function delSched(id){
  confirmAct('Remover agendamento?','Esta ação não pode ser desfeita.',()=>{
    SCHED=SCHED.filter(s=>s.id!==id);svSched();renderFullSched();renderDashSched();toast('Removido','e');
  });
}

function resetMag(){
  ['f-placa','f-motorista','f-cpf','f-nf','f-obs'].forEach(i=>{const el=g(i);if(el)el.value='';});
  g('mag-title').textContent='Novo Agendamento';editId=null;
  const n=new Date();
  if(g('f-data'))g('f-data').value=n.toISOString().split('T')[0];
  if(g('f-hora'))g('f-hora').value=String(n.getHours()+1).padStart(2,'0')+':00';
}

// ─── QUEUE ──────────────────────────────────────────
const fmtW=m=>m<60?m+'min':Math.floor(m/60)+'h'+(m%60?` ${m%60}min`:'');

function renderDashQueue(){
  const el=g('dash-queue');
  if(!QUEUE.length){el.innerHTML='<div class="empty">Fila vazia ✅</div>';return;}
  el.innerHTML=QUEUE.slice(0,5).map(q=>`<div class="qi ${q.priority?'pri':''}">
    <div class="qpos ${q.priority?'p':''}">${q.id}</div><span style="font-size:20px">🚛</span>
    <div class="qd"><div class="qplate">${q.plate}</div><div class="qmeta">${q.vehicle} · ${q.carrier}</div></div>
    <div><div class="qtime">${fmtW(q.waitMin)}</div><div style="font-size:9px;color:var(--muted)">aguardando</div></div>
  </div>`).join('');
}

function renderFullQueue(){
  const el=g('full-queue'),wt=g('wait-times');
  g('queue-sub').textContent=QUEUE.length+' veículo(s) aguardando';
  if(!QUEUE.length){el.innerHTML='<div class="empty">Fila vazia ✅</div>';wt.innerHTML='';return;}
  el.innerHTML=QUEUE.map(q=>`<div class="qi ${q.priority?'pri':''}">
    <div class="qpos ${q.priority?'p':''}">${q.id}</div><span style="font-size:20px">🚛</span>
    <div class="qd"><div class="qplate">${q.plate}</div><div class="qmeta">${q.vehicle} · ${q.carrier}</div><div class="qmeta">${q.driver||'—'} · ${q.type}</div>${q.nf?`<div class="qmeta mono">${q.nf}</div>`:''}</div>
    <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">
      <div class="qtime">${fmtW(q.waitMin)}</div>
      <button class="btn bts btn-sm" onclick="openChamar(${q.id})">📢 Chamar</button>
      <button class="btn btr btn-sm" onclick="remQueue(${q.id})">✕</button>
    </div>
  </div>`).join('');
  const free=DOCKS.filter(d=>d.status==='livre').length||1;
  wt.innerHTML=QUEUE.map(q=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);font-size:12px">
    <div><span class="ptag">${q.plate}</span><span style="color:var(--muted);font-size:10px;margin-left:8px">${q.carrier}</span></div>
    <div style="text-align:right"><div style="font-family:monospace;font-weight:700;color:var(--amber)">${fmtW(q.waitMin)}</div><div style="font-size:9px;color:var(--muted)">estimado</div></div>
  </div>`).join('')+`<div style="margin-top:10px;padding:10px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
    <div style="font-size:9px;color:var(--muted);margin-bottom:3px">ESPERA ESTIMADA</div>
    <div style="font-family:monospace;font-size:22px;font-weight:900;color:var(--amber)">${fmtW(Math.round(QUEUE.length*CFG.defaultTime/free))}</div>
  </div>`;
}

let chamQ=null;
function openChamar(id){
  chamQ=id;const q=QUEUE.find(x=>x.id===id);if(!q)return;
  const free=DOCKS.filter(d=>d.status==='livre');
  g('chamar-body').innerHTML=`
    <div style="margin-bottom:12px;padding:10px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
      <div class="ptag" style="font-size:13px">${q.plate}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${q.vehicle} · ${q.carrier} · ${q.driver||'—'}</div>
      ${q.nf?`<div style="font-size:11px;font-family:monospace;color:var(--muted)">${q.nf}</div>`:''}
    </div>
    <div class="fg"><label class="flbl">Direcionar para Doca <span class="req">*</span></label>
      <select class="fsel" id="ch-doca">${free.length?free.map(d=>`<option value="${d.num}">Doca D${String(d.num).padStart(2,'0')}</option>`).join(''):'<option value="">Sem docas livres</option>'}</select>
    </div>
    ${!free.length?`<div style="color:var(--red);font-size:12px;padding:8px;background:rgba(248,81,73,.08);border-radius:8px">⚠️ Sem docas disponíveis no momento.</div>`:''}
  `;
  g('btn-chamar').onclick=()=>confChamar(free.length>0);
  openModal('modal-chamar');
}

function confChamar(ok){
  if(!chamQ)return;
  if(!ok){toast('Sem docas livres!','e');return;}
  const q=QUEUE.find(x=>x.id===chamQ);if(!q){closeModal('modal-chamar');return;}
  const dn=parseInt(g('ch-doca')?.value);if(!dn){toast('Selecione uma doca!','e');return;}
  const d=DOCKS.find(x=>x.num===dn);
  if(d){d.status='aguardando';d.plate=q.plate;d.carrier=q.carrier;d.driver=q.driver||'';d.type=q.type;d.nf=q.nf||'';d.obs=q.obs||'';}
  QUEUE=QUEUE.filter(x=>x.id!==chamQ).map((x,i)=>({...x,id:i+1}));
  svQueue();svDocks();renderFullQueue();renderDashQueue();renderDockGrid();updStats();
  addH(`📢 ${q.plate} → D${String(dn).padStart(2,'0')} | ${q.carrier}`,'fila');
  closeModal('modal-chamar');toast(`📢 ${q.plate} → D${String(dn).padStart(2,'0')}`,'s');
}

function addQueue(){
  const placa=(g('q-placa')?.value||'').trim().toUpperCase();
  if(!placa){toast('Informe a placa!','e');return;}
  const pri=g('q-priority')?.value==='1';
  const newId=QUEUE.length?Math.max(...QUEUE.map(q=>q.id))+1:1;
  QUEUE.push({id:newId,plate:placa,vehicle:g('q-veiculo')?.value||'',carrier:g('q-carrier')?.value||'',driver:g('q-motorista')?.value.trim()||'',type:g('q-tipo')?.value||'',nf:g('q-nf')?.value.trim()||'',obs:g('q-obs')?.value.trim()||'',priority:pri,waitMin:newId*CFG.defaultTime,ts:new Date().toISOString()});
  if(pri)QUEUE.sort((a,b)=>b.priority-a.priority).forEach((q,i)=>q.id=i+1);
  svQueue();closeModal('modal-fila');renderFullQueue();renderDashQueue();updStats();
  const pos=QUEUE.find(q=>q.plate===placa)?.id;
  addH(`Fila: ${placa} (${g('q-tipo')?.value||''}) | ${g('q-carrier')?.value||''}${pri?' ⚡':''} — pos.${pos}`,'fila');
  toast(`${placa} na fila — pos. ${pos}`,'s');
  ['q-placa','q-motorista','q-nf','q-obs'].forEach(i=>{const el=g(i);if(el)el.value='';});
}

function remQueue(id){
  confirmAct('Remover da fila?','O veículo será removido.',()=>{
    const q=QUEUE.find(x=>x.id===id);
    addH(`Removido da fila: ${q?.plate}`,'cancel');
    QUEUE=QUEUE.filter(x=>x.id!==id).map((x,i)=>({...x,id:i+1}));
    svQueue();renderFullQueue();renderDashQueue();updStats();toast('Removido da fila','w');
  });
}

// ─── HISTORY ────────────────────────────────────────
function renderHistory(){
  const el=g('history-list');
  const q=(g('hist-search')?.value||'').toLowerCase();
  const list=HIST.filter(h=>(hFilter==='all'||h.tag===hFilter)&&(!q||h.msg.toLowerCase().includes(q)));
  el.innerHTML=list.length?list.map(h=>`<div class="hitem"><span class="htime">${h.time}</span><span class="hmsg">${h.msg}</span><span class="htag ${h.tag}">${{op:'OPER',fila:'FILA',fin:'FIM',cancel:'CANCEL',sys:'SYS'}[h.tag]||h.tag}</span></div>`).join(''):'<div class="empty">Sem registros</div>';
}
function filterHist(f,btn){hFilter=f;document.querySelectorAll('#hist-chips .chip').forEach(b=>b.classList.remove('on'));btn.classList.add('on');renderHistory();}
function clearHistory(){HIST=[];svHist();renderHistory();toast('Histórico limpo','w');}

// ─── CONFIG ─────────────────────────────────────────
function loadCfg(){
  g('cfg-name').value=CFG.name||'';g('cfg-docks').value=CFG.totalDocks||24;g('cfg-time').value=CFG.defaultTime||60;
  g('cfg-ta-s').value=CFG.shifts?.a?.s||'06:00';g('cfg-ta-e').value=CFG.shifts?.a?.e||'14:00';
  g('cfg-tb-s').value=CFG.shifts?.b?.s||'14:00';g('cfg-tb-e').value=CFG.shifts?.b?.e||'22:00';
  g('cfg-tc-s').value=CFG.shifts?.c?.s||'22:00';g('cfg-tc-e').value=CFG.shifts?.c?.e||'06:00';
  renderCarriers();
}
function saveConfig(){
  const nd=parseInt(g('cfg-docks').value)||24;
  CFG={name:g('cfg-name').value.trim()||'CD',totalDocks:nd,defaultTime:parseInt(g('cfg-time').value)||60,
    shifts:{a:{s:g('cfg-ta-s').value,e:g('cfg-ta-e').value},b:{s:g('cfg-tb-s').value,e:g('cfg-tb-e').value},c:{s:g('cfg-tc-s').value,e:g('cfg-tc-e').value}}};
  ss(K.cfg,CFG);
  if(nd!==DOCKS.length){confirmAct('Alterar número de docas?','A grade será reconstruída. Dados ativos perdidos.',()=>{DOCKS=buildDocks(nd);svDocks();renderDockGrid();updStats();toast('Grade atualizada!','s');});}
  setTodayLbl();fillSelects();addH('Configurações salvas','sys');toast('Configurações salvas!','s');
}
function saveCarrier(){
  const n=(g('c-name')?.value||'').trim();if(!n){toast('Nome obrigatório!','e');return;}
  if(!CARRIERS.includes(n))CARRIERS.push(n);
  ss(K.carriers,CARRIERS);closeModal('modal-carrier');renderCarriers();fillSelects();toast('Transportadora adicionada','s');
  ['c-name','c-cnpj','c-phone'].forEach(i=>{const el=g(i);if(el)el.value='';});
}
function remCarrier(n){confirmAct('Remover transportadora?',n,()=>{CARRIERS=CARRIERS.filter(c=>c!==n);ss(K.carriers,CARRIERS);renderCarriers();fillSelects();toast('Removida','w');});}
function renderCarriers(){
  const el=g('carrier-list');if(!el)return;
  el.innerHTML=CARRIERS.map(c=>`<div class="srow"><span>${c}</span><button onclick="remCarrier('${c}')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;color:var(--red);font-family:inherit">✕</button></div>`).join('');
}

// ─── EXPORT ─────────────────────────────────────────
function exportCSV(){
  if(!SCHED.length){toast('Sem agendamentos','w');return;}
  const rows=[['Data','Hora','Placa','Motorista','CPF','Transportadora','Doca','Tipo','NF','Status','Obs']];
  SCHED.forEach(s=>rows.push([s.date||'',s.time||'',s.plate||'',s.driver||'',s.cpf||'',s.carrier||'',s.dock?'D'+String(s.dock).padStart(2,'0'):'',s.type||'',s.nf||'',s.status||'',s.obs||'']));
  const csv=rows.map(r=>r.map(v=>'"'+(v+'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='logidock_'+new Date().toISOString().split('T')[0]+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  toast('CSV exportado!','s');
}

// ─── MODALS ─────────────────────────────────────────
function openModal(id){g(id).classList.add('open');}
function closeModal(id){g(id).classList.remove('open');}
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));

// ─── CONFIRM ────────────────────────────────────────
function confirmAct(title,msg,cb){
  g('conf-title').textContent=title;g('conf-msg').textContent=msg;
  g('conf-ok').onclick=()=>{g('confirm-ov').classList.remove('open');cb();};
  g('confirm-ov').classList.add('open');
}

// ─── TOAST ──────────────────────────────────────────
function toast(msg,type='s'){
  const wrap=g('tw');const el=document.createElement('div');
  el.className='toast '+type;
  el.innerHTML=`<span style="font-size:17px">${{s:'✅',e:'❌',w:'⚠️'}[type]||'ℹ️'}</span><span>${msg}</span>`;
  wrap.appendChild(el);setTimeout(()=>el.remove(),3500);
}

// ─── HELPERS ────────────────────────────────────────
function setSel(id,val){const el=g(id);if(!el||!val)return;for(const o of el.options){if(o.value===val||o.text===val){el.value=o.value;break;}}}

function fillSelects(){
  ['f-carrier','q-carrier'].forEach(id=>{
    const el=g(id);if(!el)return;const cur=el.value;
    el.innerHTML=CARRIERS.map(c=>`<option value="${c}">${c}</option>`).join('');
    if(cur)setSel(id,cur);
  });
  const fd=g('f-doca');
  if(fd){fd.innerHTML='<option value="">Qualquer livre</option>'+DOCKS.filter(d=>d.status==='livre').map(d=>`<option value="${d.num}">D${String(d.num).padStart(2,'0')}</option>`).join('');}
}

function resetShift(){QUEUE=[];HIST=[];STATS={done:0,totalMin:0};svQueue();svHist();svStats();renderDashQueue();renderFullQueue();updStats();addH('Turno zerado','sys');toast('Turno zerado','w');}
function hardReset(){Object.values(K).forEach(k=>localStorage.removeItem(k));location.reload();}

// ─── INIT ────────────────────────────────────────────
(function(){
  setTodayLbl();fillSelects();updStats();renderDockGrid();renderDashSched();renderDashQueue();
  const n=new Date();
  if(g('f-data'))g('f-data').value=n.toISOString().split('T')[0];
  if(g('f-hora'))g('f-hora').value=String(n.getHours()+1).padStart(2,'0')+':00';
  if(g('sched-date'))g('sched-date').value=n.toISOString().split('T')[0];
  addH('Sistema iniciado — Turno '+getTurno(),'sys');
})();