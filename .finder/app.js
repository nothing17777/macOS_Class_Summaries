/* ===== macOS-in-the-browser · core ===== */
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const el = (t,c,h)=>{const e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e;};

const S = {
  tree:[], flat:[], byPath:{}, z:10, wins:[], active:null,
  dark: localStorage.getItem('mac.dark')==='1',
  accent: localStorage.getItem('mac.accent')||'#0a84ff',
  wall: localStorage.getItem('mac.wall')||'ventura',
  reading: JSON.parse(localStorage.getItem('mac.reading')||'{}'),
  recents: JSON.parse(localStorage.getItem('mac.recents')||'[]'),
  tags: JSON.parse(localStorage.getItem('mac.tags')||'{}'),
};
const save=(k,v)=>localStorage.setItem('mac.'+k, typeof v==='string'?v:JSON.stringify(v));

const EXT = {
  pdf:{g:'file-text',c:'#ff453a',t:'PDF Document'},
  html:{g:'file-code-2',c:'#ff9f0a',t:'HTML Document'}, htm:{g:'file-code-2',c:'#ff9f0a',t:'HTML Document'},
  docx:{g:'file-text',c:'#0a84ff',t:'Word Document'}, doc:{g:'file-text',c:'#0a84ff',t:'Word Document'},
  md:{g:'file-type-2',c:'#30d158',t:'Markdown'}, markdown:{g:'file-type-2',c:'#30d158',t:'Markdown'},
  txt:{g:'file-text',c:'#8e8e93',t:'Plain Text'}, rtf:{g:'file-text',c:'#8e8e93',t:'Rich Text'},
  pptx:{g:'file-text',c:'#ff6482',t:'Presentation'}, ppt:{g:'file-text',c:'#ff6482',t:'Presentation'},
  xlsx:{g:'file-chart-column',c:'#30d158',t:'Spreadsheet'}, csv:{g:'file-chart-column',c:'#30d158',t:'CSV'},
  epub:{g:'book',c:'#bf5af2',t:'EPUB Book'}, tex:{g:'file-code-2',c:'#64d2ff',t:'LaTeX'},
  pages:{g:'file-text',c:'#ff9f0a',t:'Pages'}, key:{g:'file-text',c:'#ff6482',t:'Keynote'},
  numbers:{g:'file-chart-column',c:'#30d158',t:'Numbers'},
  png:{g:'image',c:'#64d2ff',t:'PNG Image'}, jpg:{g:'image',c:'#64d2ff',t:'JPEG Image'},
  jpeg:{g:'image',c:'#64d2ff',t:'JPEG Image'}, webp:{g:'image',c:'#64d2ff',t:'WebP Image'},
  gif:{g:'image',c:'#64d2ff',t:'GIF Image'}
};
const glyph = (i,cls) => i.kind==='folder'
  ? ico('folder',(cls||'')+' folderic','#3b9dff')
  : ico(EXT[i.ext]?.g||'file-text', cls, EXT[i.ext]?.c||'#8e8e93');
const kindOf = i => i.kind==='folder' ? 'Folder' : (EXT[i.ext]?.t || (i.ext||'').toUpperCase()+' File');
const fsize = b => b==null?'--': b<1024?b+' bytes': b<1048576?(b/1024).toFixed(0)+' KB':(b/1048576).toFixed(1)+' MB';
const fdate = t => new Date(t*1000).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})
  +' at '+new Date(t*1000).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
const url = p => './'+p.split('/').map(encodeURIComponent).join('/');
const isBook = i => i.kind==='file' && (i.ext==='epub' || i.ext==='pdf');

/* ---------- manifest ---------- */
function index(items, parent){
  items.forEach(i=>{ i.parent=parent; S.byPath[i.path]=i; S.flat.push(i);
    if(i.children) index(i.children, i.path); });
}
async function loadManifest(){
  const r = await fetch('./.finder/manifest.json?'+Date.now());
  const m = await r.json();
  S.tree=m.items; S.flat=[]; S.byPath={}; index(m.items,null);
  S.classes = m.items.filter(i=>i.kind==='folder');
  S.books = S.flat.filter(i=>i.kind==='file');
}
const childrenOf = p => p===null||p===''? S.tree : (S.byPath[p]?.children||[]);

/* ---------- theme ---------- */
function applyTheme(){
  document.body.classList.toggle('dark', S.dark);
  document.documentElement.style.setProperty('--accent', S.accent);
  document.documentElement.style.setProperty('--accent-soft', S.accent+'38');
  drawWall();
}

/* ---------- wallpaper ---------- */
const WALLS = {
  ventura:['#3a1c71','#b5307a','#f5793b','#ffd36e'],
  sonoma:['#0b1b3a','#1e4a8c','#3c8fd0','#8fd6ff'],
  sequoia:['#102a1f','#1d6f4e','#56b67e','#d9f2b6'],
  monterey:['#1a0f2e','#6a2c8f','#c1439a','#ff9d7a'],
  graphite:['#0d0d10','#232329','#3a3a42','#55555f'],
};
function drawWall(){
  const c=$('#wallc'), ctx=c.getContext('2d');
  const w=c.width=innerWidth*devicePixelRatio, h=c.height=innerHeight*devicePixelRatio;
  const cols=WALLS[S.wall]||WALLS.ventura;
  const g=ctx.createLinearGradient(0,0,w*.7,h);
  cols.forEach((col,i)=>g.addColorStop(i/(cols.length-1),col));
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  // soft light blooms
  for(let i=0;i<5;i++){
    const rg=ctx.createRadialGradient(w*(.15+i*.2),h*(.2+(i%3)*.26),0,w*(.15+i*.2),h*(.2+(i%3)*.26),w*.33);
    rg.addColorStop(0,'rgba(255,255,255,'+(S.dark?.07:.15)+')'); rg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=rg; ctx.fillRect(0,0,w,h);
  }
  if(S.dark){ ctx.fillStyle='rgba(0,0,0,.42)'; ctx.fillRect(0,0,w,h); }
}
addEventListener('resize',()=>{drawWall(); clampWins();});

/* ---------- window manager ---------- */
let WID=0;
function makeWin(opt){
  const w = el('div','win');
  const id = 'w'+(++WID);
  w.id=id;
  const AVAIL_H = innerHeight-26-108, AVAIL_W = innerWidth-28;
  const W=Math.min(opt.w||860, AVAIL_W), H=Math.min(opt.h||560, AVAIL_H);
  const off=(S.wins.length%6)*26;
  w.style.width=W+'px'; w.style.height=H+'px';
  w.style.left=Math.max(14,Math.min((innerWidth-W)/2+off-60, innerWidth-W-14))+'px';
  w.style.top=Math.max(32,Math.min(26+(AVAIL_H-H)/2+off, innerHeight-H-84))+'px';
  w.innerHTML = `
   <div class="titlebar">
     <div class="lights">
       <div class="lt r" data-a="close"><span>✕</span></div>
       <div class="lt y" data-a="min"><span>–</span></div>
       <div class="lt g" data-a="zoom"><span>⤢</span></div>
     </div>
     <div class="tb-left"></div>
     <div class="title">${opt.title||''}</div>
     <div class="tbar-right"></div>
   </div>
   <div class="body"></div>
   <div class="rsz-e"></div><div class="rsz-s"></div><div class="rsz"></div>`;
  $('#desktop').appendChild(w);
  const win = {id, el:w, app:opt.app||'finder', title:opt.title||'', body:$('.body',w),
    tbl:$('.tb-left',w), tbr:$('.tbar-right',w), min:false, state:null};
  S.wins.push(win);
  focusWin(win);
  $('.titlebar',w).addEventListener('mousedown',e=>{
    if(e.target.closest('.lt,button,input')) return;
    focusWin(win); dragWin(win,e);
  });
  w.addEventListener('mousedown',()=>focusWin(win));
  $$('.lt',w).forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const a=b.dataset.a;
    if(a==='close') closeWin(win); else if(a==='min') minWin(win); else zoomWin(win);
  }));
  $('.titlebar',w).addEventListener('dblclick',e=>{ if(!e.target.closest('.lt')) zoomWin(win); });
  resizer(win);
  updateDock();
  return win;
}
function focusWin(win){
  S.active=win; S.wins.forEach(x=>x.el.classList.add('inactive'));
  win.el.classList.remove('inactive'); win.el.style.zIndex=++S.z;
  setMenuApp(win.app);
}
function closeWin(win){
  win.el.classList.add('closing');
  setTimeout(()=>{ win.el.remove(); S.wins=S.wins.filter(x=>x!==win);
    const last=S.wins.filter(x=>!x.min).pop(); if(last) focusWin(last); else setMenuApp('finder');
    updateDock(); },190);
}
function minWin(win){
  win.el.classList.add('minimizing');
  setTimeout(()=>{ win.el.style.display='none'; win.el.classList.remove('minimizing'); win.min=true; updateDock(); },400);
}
function unminWin(win){
  win.min=false; win.el.style.display='flex'; win.el.style.animation='winOpen .32s var(--ease)';
  focusWin(win); updateDock();
}
function zoomWin(win){
  const w=win.el;
  w.classList.add('zooming');
  if(win.state){ Object.assign(w.style,win.state); win.state=null; }
  else{
    win.state={left:w.style.left,top:w.style.top,width:w.style.width,height:w.style.height};
    Object.assign(w.style,{left:'0px',top:'26px',width:innerWidth+'px',height:(innerHeight-26)+'px'});
  }
  setTimeout(()=>w.classList.remove('zooming'),320);
}
function dragWin(win,e0){
  const w=win.el, sx=e0.clientX, sy=e0.clientY;
  const l=parseFloat(w.style.left), t=parseFloat(w.style.top);
  if(win.state){ win.state=null; }
  const mv=e=>{ w.style.left=(l+e.clientX-sx)+'px'; w.style.top=Math.max(0,t+e.clientY-sy)+'px'; };
  const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
    document.body.style.cursor='';};
  document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
}
function resizer(win){
  const w=win.el;
  const grab=(node,ax)=>node.addEventListener('mousedown',e=>{
    e.preventDefault(); e.stopPropagation(); focusWin(win);
    const sx=e.clientX, sy=e.clientY, W=w.offsetWidth, H=w.offsetHeight;
    const mv=ev=>{
      if(ax!=='y') w.style.width=Math.max(430,W+ev.clientX-sx)+'px';
      if(ax!=='x') w.style.height=Math.max(260,H+ev.clientY-sy)+'px';
    };
    const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  });
  grab($('.rsz',w),'xy'); grab($('.rsz-e',w),'x'); grab($('.rsz-s',w),'y');
}
function clampWins(){ S.wins.forEach(w=>{
  w.el.style.left=Math.min(parseFloat(w.el.style.left), innerWidth-120)+'px';
  w.el.style.top=Math.min(parseFloat(w.el.style.top), innerHeight-60)+'px'; }); }

/* ===== Finder ===== */
function openFinder(path){
  const win = makeWin({title:'class_summaries', app:'finder', w:900, h:580});
  win.nav = {hist:[path===undefined?null:path], i:0, view:localStorage.getItem('mac.view')||'icon',
             q:'', sort:'name', asc:true, sel:new Set(), special:null};
  win.body.innerHTML = `<div class="sidebar"></div>
    <div class="content"><div class="pane"></div><div class="pathbar"></div></div>`;
  win.tbl.innerHTML = `<div class="navbtns">
      <button class="nav b">‹</button><button class="nav f">›</button></div>`;
  win.tbr.innerHTML = `
    <div class="segmented">
      <button data-v="icon" title="Icons">▦</button>
      <button data-v="list" title="List">☰</button>
      <button data-v="col"  title="Columns">◫</button>
    </div>
    <button class="btn rd finder-read" style="display:none">${ico('book-open','sm')}Read</button>
    <button class="btn sec finder-aloud" title="Read aloud" style="display:none">${ico('volume-2','sm')}</button>
    <button class="btn sec finder-import" title="Import files…">${ico('file-down','sm')}</button>
    <div class="search">${ico('search','sm')}<input placeholder="Search"></div>`;
  $('.nav.b',win.el).onclick=()=>{ if(win.nav.i>0){win.nav.i--; renderFinder(win);} };
  $('.nav.f',win.el).onclick=()=>{ if(win.nav.i<win.nav.hist.length-1){win.nav.i++; renderFinder(win);} };
  $$('.segmented button',win.el).forEach(b=>b.onclick=()=>{
    win.nav.view=b.dataset.v; save('view',b.dataset.v); renderFinder(win); });
  const si=$('.search input',win.el);
  si.oninput=()=>{ win.nav.q=si.value.trim(); renderFinder(win); };
  dropTarget(win.el, ()=> win.nav.special? '' : (win.nav.hist[win.nav.i]||''));
  $('.finder-import',win.el).onclick=()=>importDialog(win.nav.special?'':(win.nav.hist[win.nav.i]||''));
  renderSidebar(win); renderFinder(win);
  return win;
}
function goto(win,path,special){
  const n=win.nav; n.hist=n.hist.slice(0,n.i+1); n.hist.push(path); n.i=n.hist.length-1;
  n.special=special||null; n.sel.clear(); renderFinder(win);
}
function renderSidebar(win){
  const sb=$('.sidebar',win.el); sb.innerHTML='';
  const grp=(t)=>sb.appendChild(el('div','sb-h',t));
  const item=(ico,nm,fn,key)=>{
    const d=el('div','sb-i',`<span class="ico">${ico}</span><span class="nm">${nm}</span>`);
    d.dataset.k=key; d.onclick=fn; sb.appendChild(d); return d;
  };
  grp('Favorites');
  item(ico('clock','sb','#8e8e93'),'Recents',()=>goto(win,null,'recents'),'r:recents');
  item(ico('library','sb','#bf5af2'),'Books',()=>openBooks(),'r:books');
  item(ico('house','sb','#3b9dff'),'class_summaries',()=>goto(win,null),'p:');
  item(ico('star','sb','#ffd60a'),'Starred',()=>goto(win,null,'starred'),'r:starred');
  grp('Classes');
  S.classes.forEach(c=>item(ico('graduation-cap','sb','#3b9dff'),c.name,()=>goto(win,c.path),'p:'+c.path));
  grp('Tags');
  ['PDF','HTML','Word','Markdown','Books'].forEach(t=>
    item(ico('tag','sb',{PDF:'#ff453a',HTML:'#ff9f0a',Word:'#0a84ff',Markdown:'#30d158',Books:'#bf5af2'}[t]),t,()=>goto(win,null,'tag:'+t),'r:tag:'+t));
  markSidebar(win);
}
function markSidebar(win){
  const n=win.nav, key = n.special? 'r:'+n.special : 'p:'+(n.hist[n.i]||'');
  $$('.sb-i',win.el).forEach(d=>d.classList.toggle('on', d.dataset.k===key));
}
function currentItems(win){
  const n=win.nav; let items;
  if(n.special==='recents') items = S.recents.map(p=>S.byPath[p]).filter(Boolean);
  else if(n.special==='starred') items = S.flat.filter(i=>S.tags[i.path]);
  else if(n.special&&n.special.startsWith('tag:')){
    const m={PDF:['pdf'],HTML:['html','htm'],Word:['docx','doc'],Markdown:['md','markdown','txt'],Books:['epub','pdf']};
    items = S.flat.filter(i=>i.kind==='file'&&m[n.special.slice(4)].includes(i.ext));
  }
  else items = childrenOf(n.hist[n.i]);
  if(n.q){
    const q=n.q.toLowerCase();
    items = (n.special?items:S.flat).filter(i=>i.name.toLowerCase().includes(q));
  }
  const dir=n.asc?1:-1;
  return [...items].sort((a,b)=>{
    if(a.kind!==b.kind) return a.kind==='folder'?-1:1;
    if(n.sort==='size') return ((a.size||0)-(b.size||0))*dir;
    if(n.sort==='date') return ((a.mtime||0)-(b.mtime||0))*dir;
    if(n.sort==='kind') return kindOf(a).localeCompare(kindOf(b))*dir;
    return a.name.localeCompare(b.name,undefined,{numeric:true})*dir;
  });
}
function renderFinder(win){
  const n=win.nav, pane=$('.pane',win.el), p=n.hist[n.i];
  const titles={recents:'Recents',starred:'Starred'};
  const label = n.q? 'Search' : n.special? (titles[n.special]||n.special.replace('tag:','')+' Files')
               : (p? p.split('/').pop() : 'class_summaries');
  $('.title',win.el).innerHTML = (n.special?ico('clock','ti'):p?ico('folder','ti','#3b9dff'):ico('house','ti','#3b9dff'))+label;
  $('.nav.b',win.el).disabled = n.i===0;
  $('.nav.f',win.el).disabled = n.i>=n.hist.length-1;
  $$('.segmented button',win.el).forEach(b=>b.classList.toggle('on',b.dataset.v===n.view));
  markSidebar(win);
  const rb=$('.finder-read',win.el); if(rb) rb.style.display='none';
  const ab=$('.finder-aloud',win.el); if(ab) ab.style.display='none';
  const items=currentItems(win);
  pane.className='pane'; pane.innerHTML='';
  if(n.view==='col' && !n.special && !n.q){ pane.style.padding='0'; renderCols(win,pane); }
  else if(!items.length){
    pane.appendChild(el('div','empty',`<div class="glyph">${ico('folder-open','',  '#3b9dff')}</div><div>${n.q?'No results for “'+n.q+'”':'This folder is empty'}</div>`));
  }
  else if(n.view==='list') renderList(win,pane,items);
  else renderIcons(win,pane,items);
  renderPath(win,items.length);
}
function renderPath(win,count){
  const pb=$('.pathbar',win.el), n=win.nav; pb.innerHTML='';
  const parts=[{n:ico('house','ti')+'class_summaries',p:null}];
  if(!n.special && n.hist[n.i]){
    let acc=[]; n.hist[n.i].split('/').forEach(seg=>{acc.push(seg); parts.push({n:seg,p:acc.join('/')});});
  }
  parts.forEach((pt,i)=>{
    if(i) pb.appendChild(el('span','','›'));
    const c=el('span','crumb',pt.n); c.onclick=()=>goto(win,pt.p); pb.appendChild(c);
  });
  pb.appendChild(el('span','',`&nbsp;&nbsp;·&nbsp;&nbsp;<span class="dim">${count} item${count===1?'':'s'}</span>`));
}
function activate(win,i){
  if(i.kind==='folder') goto(win,i.path);
  else openDoc(i);
}
function selectIn(win,i,node,cls){
  win.nav.sel.clear(); win.nav.sel.add(i.path);
  $$('.'+cls,win.el).forEach(x=>x.classList.remove('sel'));
  node.classList.add('sel'); S.qlItem=i;
  const rb=$('.finder-read',win.el);
  if(rb){ rb.style.display = readable(i)?'inline-flex':'none'; rb.onclick=()=>openReader(i); }
  const ab=$('.finder-aloud',win.el);
  if(ab){ ab.style.display = ALOUD_OK(i)?'inline-flex':'none'; ab.onclick=()=>openAloud(i); }
}
function renderIcons(win,pane,items){
  const g=el('div','grid'); pane.appendChild(g);
  items.forEach((i,k)=>{
    const d=el('div','it',`<span class="glyph">${glyph(i)}</span>
      <span class="nm">${i.name}</span>
      <div class="sub">${i.kind==='folder'? i.count+' items' : fsize(i.size)}</div>`);
    d.style.animationDelay=Math.min(k*14,340)+'ms';
    d.onclick=()=>selectIn(win,i,d,'it');
    d.ondblclick=()=>activate(win,i);
    d.oncontextmenu=e=>{selectIn(win,i,d,'it'); ctxMenu(e,win,i);};
    g.appendChild(d);
  });
}
function renderList(win,pane,items){
  const t=el('table','list');
  const n=win.nav;
  t.innerHTML=`<thead><tr>
    <th data-s="name">Name</th><th data-s="date" style="width:170px">Date Modified</th>
    <th data-s="size" style="width:86px">Size</th><th data-s="kind" style="width:130px">Kind</th></tr></thead>`;
  const tb=el('tbody'); t.appendChild(tb);
  $$('th',t).forEach(th=>{
    if(n.sort===th.dataset.s) th.innerHTML+=' '+(n.asc?'▴':'▾');
    th.onclick=()=>{ if(n.sort===th.dataset.s) n.asc=!n.asc; else {n.sort=th.dataset.s;n.asc=true;} renderFinder(win); };
  });
  items.forEach(i=>{
    const tr=el('tr','',`<td class="n"><span class="glyph">${glyph(i)}</span>${i.name}</td>
      <td class="dim">${fdate(i.mtime)}</td>
      <td class="dim">${i.kind==='folder'?'--':fsize(i.size)}</td>
      <td class="dim">${kindOf(i)}</td>`);
    tr.onclick=()=>selectIn(win,i,tr,'list tbody tr');
    tr.ondblclick=()=>activate(win,i);
    tr.oncontextmenu=e=>{selectIn(win,i,tr,'list tbody tr'); ctxMenu(e,win,i);};
    tb.appendChild(tr);
  });
  pane.appendChild(t);
}
function renderCols(win,pane){
  const wrap=el('div','cols'); pane.appendChild(wrap);
  const chain=[null];
  const base=win.nav.hist[win.nav.i];
  if(base) base.split('/').reduce((a,s)=>{const p=a?a+'/'+s:s; chain.push(p); return p;},'');
  const draw=()=>{
    wrap.innerHTML='';
    chain.forEach((p,ci)=>{
      const col=el('div','col');
      childrenOf(p).forEach(i=>{
        const d=el('div','ci',`<span>${glyph(i)}</span><span class="nm">${i.name}</span>
          ${i.kind==='folder'?'<span>›</span>':''}`);
        if(chain[ci+1]===i.path||(ci===chain.length-1&&S.colSel===i.path)) d.classList.add('on');
        d.onclick=()=>{ S.colSel=i.path;
          chain.length=ci+1; if(i.kind==='folder') chain.push(i.path); draw(); preview(i); };
        d.ondblclick=()=>activate(win,i);
        col.appendChild(d);
      });
      wrap.appendChild(col);
    });
    wrap.appendChild(prevPane);
    wrap.scrollLeft=wrap.scrollWidth;
  };
  const prevPane=el('div','colprev');
  const preview=i=>{
    S.qlItem=i;
    prevPane.innerHTML=`<div class="glyph">${glyph(i)}</div><h4>${i.name}</h4>
      <div class="meta">${kindOf(i)}<br>${i.kind==='folder'?i.count+' items':fsize(i.size)}<br>${fdate(i.mtime)}</div>`;
    if(i.kind==='file'){
      if(readable(i)){ const r=el('button','btn',ico('book-open','sm')+'Read');
        r.onclick=()=>openReader(i); prevPane.appendChild(r); }
      const b=el('button','btn sec','Open'); b.onclick=()=>openDoc(i); prevPane.appendChild(b);
      const q=el('button','btn sec','Quick Look'); q.onclick=()=>quickLook(i); prevPane.appendChild(q);
    }
  };
  prevPane.innerHTML=`<div class="empty"><div class="glyph">${ico('eye')}</div><div>Select an item to preview</div></div>`;
  draw();
}

/* ===== document rendering ===== */
function remember(p){
  S.recents = [p, ...S.recents.filter(x=>x!==p)].slice(0,30); save('recents',S.recents);
}
async function docHTML(item){
  const u=url(item.path), e=item.ext;
  if(e==='md'||e==='markdown'){
    const t=await (await fetch(u)).text();
    await need('./.finder/vendor/marked.min.js','marked');
    return marked.parse(t);
  }
  if(e==='docx'){
    await need('./.finder/vendor/mammoth.browser.min.js','mammoth');
    const buf=await (await fetch(u)).arrayBuffer();
    return (await mammoth.convertToHtml({arrayBuffer:buf})).value;
  }
  if(e==='html'||e==='htm'){
    const t=await (await fetch(u)).text();
    const dom=new DOMParser().parseFromString(t,'text/html');
    dom.querySelectorAll('script,link[rel=stylesheet],style').forEach(n=>n.remove());
    return (dom.body||dom.documentElement).innerHTML;
  }
  if(e==='csv'){
    const rows=(await (await fetch(u)).text()).trim().split(/\r?\n/).map(r=>r.split(','));
    return `<table><thead><tr>${rows[0].map(c=>'<th>'+esc(c)+'</th>').join('')}</tr></thead><tbody>`
      +rows.slice(1).map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  }
  if(e==='txt'||e==='tex'||e==='rtf'){
    return '<pre style="white-space:pre-wrap">'+esc(await (await fetch(u)).text())+'</pre>';
  }
  return null;
}
const readable = i => i.kind==='file' && (i.ext==='epub'||i.ext==='pdf'||
  ['md','markdown','docx','html','htm','txt','csv','tex','rtf'].includes(i.ext));

async function renderInto(node, item){
  node.innerHTML='<div class="loading"><div class="spin"></div>Opening '+item.name+'…</div>';
  const u=url(item.path), e=item.ext;
  try{
    if(e==='pdf'){ node.innerHTML=`<iframe src="${u}#view=FitH"></iframe>`; return; }
    if(e==='html'||e==='htm'){ node.innerHTML=`<iframe src="${u}" sandbox="allow-same-origin allow-popups"></iframe>`; return; }
    if(e==='md'||e==='markdown'){
      const t=await (await fetch(u)).text();
      await need('./.finder/vendor/marked.min.js','marked');
      node.innerHTML=`<div class="doc">${marked.parse(t)}</div>`; renderMath(node); return;
    }
    if(e==='txt'||e==='csv'||e==='tex'||e==='rtf'){
      const t=await (await fetch(u)).text();
      if(e==='csv'){
        const rows=t.trim().split(/\r?\n/).map(r=>r.split(','));
        node.innerHTML=`<div class="doc"><table><thead><tr>${rows[0].map(c=>'<th>'+esc(c)+'</th>').join('')}</tr></thead>
          <tbody>${rows.slice(1).map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`;
      } else node.innerHTML=`<div class="doc"><pre style="white-space:pre-wrap">${esc(t)}</pre></div>`;
      return;
    }
    if(['png','jpg','jpeg','webp','gif'].includes(e)){
      node.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;
        height:100%;padding:22px;background:var(--win-bg)">
        <img src="${u}" style="max-width:100%;max-height:100%;border-radius:8px;
          box-shadow:0 8px 28px rgba(0,0,0,.25)"></div>`; return;
    }
    if(e==='docx'){
      await need('./.finder/vendor/mammoth.browser.min.js','mammoth');
      const buf=await (await fetch(u)).arrayBuffer();
      const res=await mammoth.convertToHtml({arrayBuffer:buf});
      node.innerHTML=`<div class="doc">${res.value}</div>`; renderMath(node); return;
    }
    node.innerHTML=`<div class="empty"><div class="glyph">${glyph(item)}</div>
      <div>No inline preview for ${kindOf(item)}</div>
      <a class="btn" href="${u}" download style="text-decoration:none">Download</a></div>`;
  }catch(err){
    node.innerHTML=`<div class="empty"><div class="glyph">${ico('info','','#ff9f0a')}</div><div>Couldn't open this file</div>
      <div class="dim" style="font-size:11px">${esc(err.message)}</div></div>`;
  }
}
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const loaded={};
function needCSS(href){
  if(document.querySelector(`link[href="${href}"]`)) return;
  const l=document.createElement('link'); l.rel='stylesheet'; l.href=href; document.head.appendChild(l);
}
async function renderMath(node){
  if(!/\$|\\\(|\\\[|\\begin\{/.test(node.textContent)) return;
  try{
    needCSS('./.finder/vendor/katex.min.css');
    await need('./.finder/vendor/katex.min.js','katex');
    await need('./.finder/vendor/katex-auto-render.min.js','renderMathInElement');
    renderMathInElement(node,{
      delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},
                  {left:'\\(',right:'\\)',display:false},{left:'$',right:'$',display:false}],
      throwOnError:false, ignoredTags:['script','noscript','style','textarea','pre','code']
    });
  }catch(e){ /* math stays as source text */ }
}
function need(src,global){
  if(window[global]) return Promise.resolve();
  if(loaded[src]) return loaded[src];
  return loaded[src]=new Promise((res,rej)=>{
    const s=document.createElement('script'); s.src=src; s.onload=res;
    s.onerror=()=>rej(new Error('Could not load '+src)); document.head.appendChild(s);
  });
}
function openDoc(item){
  if(item.ext==='epub'){ openReader(item); return; }
  remember(item.path);
  const win=makeWin({title:item.name, app:'preview', w:900, h:660});
  win.body.innerHTML='<div class="viewer-body"></div>';
  win.tbr.innerHTML=`${readable(item)?`<button class="btn rd">${ico('book-open','sm')}Read</button>`:''}
    <a class="btn sec dl" href="${url(item.path)}" download
     style="text-decoration:none">${ico('download','sm')}</a>`;
  const rd=$('.btn.rd',win.el);
  if(rd) rd.onclick=()=>{ openReader(item); closeWin(win); };
  $('.title',win.el).innerHTML=`${glyph(item,'ti')}${esc(item.name)}`;
  renderInto($('.viewer-body',win.el), item);
}
function quickLook(item){
  if(!item||item.kind==='folder') return;
  const ql=$('#ql'); ql.classList.add('show');
  $('#qltitle').textContent=item.name;
  const qr=$('#qlread');
  qr.style.display = readable(item)?'inline-flex':'none';
  qr.onclick=()=>{ closeQL(); openReader(item); };
  renderInto($('#qlbody'), item);
  S.qlOpen=item;
}
function closeQL(){ $('#ql').classList.remove('show'); $('#qlbody').innerHTML=''; S.qlOpen=null; }

/* ===== Books · ebook library + reader ===== */
function openBooks(){
  const win=makeWin({title:'Books', app:'books', w:900, h:620});
  win.body.innerHTML=`<div class="sidebar"></div><div class="content"><div class="pane shelf"></div>
     <div class="pathbar"></div></div>`;
  const sb=$('.sidebar',win.el);
  const mk=(ico,nm,f,on)=>{const d=el('div','sb-i'+(on?' on':''),
    `<span class="ico">${ico}</span><span class="nm">${nm}</span>`); d.onclick=()=>{
      $$('.sb-i',sb).forEach(x=>x.classList.remove('on')); d.classList.add('on'); f();}; sb.appendChild(d);};
  sb.appendChild(el('div','sb-h','Library'));
  mk(ico('library','sb','#bf5af2'),'All Books',()=>shelf(win,S.books),true);
  mk(ico('book-open','sb','#ff9f0a'),'Reading Now',()=>shelf(win,S.books.filter(b=>S.reading[b.path]?.pct>0)));
  mk(ico('book-marked','sb','#30d158'),'Finished',()=>shelf(win,S.books.filter(b=>(S.reading[b.path]?.pct||0)>=98)));
  mk(ico('file-text','sb','#8e8e93'),'Class Notes',()=>shelf(win,S.books.filter(b=>!['epub','pdf'].includes(b.ext))));
  sb.appendChild(el('div','sb-h','Formats'));
  mk(ico('book','sb','#bf5af2'),'EPUB',()=>shelf(win,S.books.filter(b=>b.ext==='epub')));
  mk(ico('file-text','sb','#ff453a'),'PDF',()=>shelf(win,S.books.filter(b=>b.ext==='pdf')));
  $('.title',win.el).innerHTML=ico('library','ti','#bf5af2')+'Books';
  shelf(win,S.books);
  return win;
}
const COVERS=[['#5b6ff0','#9b4ff0'],['#f0774b','#f0b74b'],['#19a974','#6fd37a'],
              ['#e8457a','#f58fb0'],['#2c5fa8','#4fb0e8'],['#7a4ff0','#c84ff0']];
function shelf(win,books){
  const p=$('.pane',win.el); p.innerHTML='';
  if(!books.length){
    p.appendChild(el('div','empty',`<div class="glyph">${ico('library')}</div><div>No books yet</div>
      <div class="dim" style="font-size:11.5px">Drop .epub or .pdf files into class_summaries and rescan</div>`));
    $('.pathbar',win.el).innerHTML='<span class="dim">0 books</span>'; return;
  }
  const g=el('div','bookgrid'); p.appendChild(g);
  books.forEach((b,k)=>{
    const prog=S.reading[b.path]?.pct||0;
    const c=COVERS[k%COVERS.length];
    const title=b.name.replace(/\.[^.]+$/,'');
    const d=el('div','book',`
      <div class="cover" style="background:linear-gradient(145deg,${c[0]},${c[1]})">
        <div class="ctitle">${esc(title)}</div>
        <div class="cfmt">${b.ext.toUpperCase()}</div>
        ${prog>0?`<div class="cbar"><i style="width:${prog}%"></i></div>`:''}
      </div>
      <div class="btitle">${esc(title)}</div>
      <div class="bsub">${prog>0?Math.round(prog)+'% read':fsize(b.size)}</div>`);
    d.style.animationDelay=Math.min(k*35,420)+'ms';
    d.onclick=()=>openReader(b);
    d.oncontextmenu=e=>ctxMenu(e,win,b);
    g.appendChild(d);
  });
  $('.pathbar',win.el).innerHTML=`<span class="dim">${books.length} book${books.length===1?'':'s'}</span>`;
}

/* ---------- reader ---------- */
const RTHEMES={light:{bg:'#fbf8f3',fg:'#1d1d1f'},sepia:{bg:'#f4ecd8',fg:'#43362a'},
               gray:{bg:'#3a3a3e',fg:'#e4e4e6'},dark:{bg:'#111113',fg:'#d8d8dc'}};
async function openReader(book){
  remember(book.path);
  if(book.ext!=='epub' && book.ext!=='pdf') return openDocReader(book);
  const st = S.reading[book.path] || (S.reading[book.path]={pct:0,loc:null,theme:'light',size:100,bm:[]});
  const win=makeWin({title:book.name, app:'books', w:880, h:720});
  win.body.innerHTML=`<div class="reader">
      <div class="rtoc"><div class="sb-h">Contents</div><div class="toclist"></div>
        <div class="sb-h">Bookmarks</div><div class="bmlist"></div></div>
      <div class="rmain">
        <div class="rstage"></div>
        <div class="rfoot">
          <button class="pg prev">‹</button>
          <div class="rprog"><i></i></div>
          <span class="rpct dim">0%</span>
          <button class="pg next">›</button>
        </div>
      </div></div>`;
  win.tbr.innerHTML=`
    <div class="segmented rth">
      ${Object.keys(RTHEMES).map(t=>`<button data-t="${t}" title="${t}"
        style="background:${RTHEMES[t].bg};color:${RTHEMES[t].fg}">A</button>`).join('')}
    </div>
    <div class="segmented">
      <button class="fs" data-d="-1" title="Smaller">A−</button>
      <button class="fs" data-d="1" title="Larger">A+</button>
      <button class="toc" title="Contents">☰</button>
      <button class="bm" title="Bookmark">${ico('bookmark','sm')}</button>
    </div>`;
  $('.title',win.el).innerHTML=ico('book-open','ti','#ff9f0a')+esc(book.name.replace(/\.(epub|pdf)$/i,''));
  const stage=$('.rstage',win.el);
  const setPct=p=>{ st.pct=p; save('reading',S.reading);
    $('.rprog i',win.el).style.width=p+'%'; $('.rpct',win.el).textContent=Math.round(p)+'%'; };
  $$('.rth button',win.el).forEach(b=>{
    b.classList.toggle('on',b.dataset.t===st.theme);
    b.onclick=()=>{ st.theme=b.dataset.t; save('reading',S.reading);
      $$('.rth button',win.el).forEach(x=>x.classList.toggle('on',x.dataset.t===st.theme)); applyR(); };
  });
  $('.toc',win.el).onclick=()=>$('.rtoc',win.el).classList.toggle('hidden');
  $$('.fs',win.el).forEach(b=>b.onclick=()=>{
    st.size=Math.max(70,Math.min(190,st.size+ +b.dataset.d*10)); save('reading',S.reading); applyR(); });

  if(book.ext==='pdf'){
    stage.innerHTML=`<iframe src="${url(book.path)}#view=FitH" style="width:100%;height:100%;border:none"></iframe>`;
    $('.rfoot',win.el).style.display='none'; $('.rtoc',win.el).classList.add('hidden');
    var applyR=()=>{};
    return win;
  }
  stage.innerHTML='<div class="loading"><div class="spin"></div>Opening book…</div>';
  let rend, bk;
  try{
    await need('./.finder/vendor/jszip.min.js','JSZip');
    await need('./.finder/vendor/epub.min.js','ePub');
  }catch(e){
    stage.innerHTML=`<div class="empty"><div class="glyph">${ico('library')}</div><div>Couldn't start the EPUB engine</div>
      <a class="btn" href="${url(book.path)}" download style="text-decoration:none">Download book</a></div>`;
    return win;
  }
  stage.innerHTML='';
  bk = ePub(url(book.path));
  rend = bk.renderTo(stage,{width:'100%',height:'100%',spread:'auto',flow:'paginated'});
  var applyR=()=>{
    const t=RTHEMES[st.theme];
    rend.themes.override('color',t.fg); rend.themes.override('background',t.bg);
    rend.themes.fontSize(st.size+'%');
    stage.style.background=t.bg;
  };
  await rend.display(st.loc||undefined);
  applyR();
  bk.ready.then(()=>bk.locations.generate(1200)).then(()=>{
    rend.on('relocated',l=>{ st.loc=l.start.cfi;
      setPct((bk.locations.percentageFromCfi(l.start.cfi)||0)*100); });
    if(st.loc) setPct((bk.locations.percentageFromCfi(st.loc)||0)*100);
  });
  bk.loaded.navigation.then(nav=>{
    const tl=$('.toclist',win.el);
    (nav.toc||[]).forEach(c=>{
      const d=el('div','sb-i',`<span class="nm">${esc(c.label.trim()||'—')}</span>`);
      d.onclick=()=>rend.display(c.href); tl.appendChild(d);
    });
    if(!tl.children.length) tl.appendChild(el('div','sb-i','<span class="nm dim">No contents</span>'));
  });
  const drawBM=()=>{
    const bl=$('.bmlist',win.el); bl.innerHTML='';
    (st.bm||[]).forEach((b,i)=>{
      const d=el('div','sb-i',`<span class="ico">${ico('bookmark','sb','#ff9f0a')}</span><span class="nm">${Math.round(b.pct)}%</span>`);
      d.onclick=()=>rend.display(b.cfi);
      d.oncontextmenu=e=>{e.preventDefault(); st.bm.splice(i,1); save('reading',S.reading); drawBM();};
      bl.appendChild(d);
    });
    if(!st.bm.length) bl.appendChild(el('div','sb-i','<span class="nm dim">None yet</span>'));
  };
  drawBM();
  $('.bm',win.el).onclick=()=>{ if(!st.loc)return; st.bm.push({cfi:st.loc,pct:st.pct});
    save('reading',S.reading); drawBM(); notify('Books','Bookmark added at '+Math.round(st.pct)+'%'); };
  const prev=()=>rend.prev(), next=()=>rend.next();
  $('.pg.prev',win.el).onclick=prev; $('.pg.next',win.el).onclick=next;
  $('.rprog',win.el).onclick=e=>{
    const r=e.currentTarget.getBoundingClientRect(), f=(e.clientX-r.left)/r.width;
    if(bk.locations.length()) rend.display(bk.locations.cfiFromPercentage(f));
  };
  rend.on('keyup',e=>{ if(e.key==='ArrowLeft')prev(); if(e.key==='ArrowRight')next(); });
  win.el.addEventListener('keyup',e=>{ if(e.key==='ArrowLeft')prev(); if(e.key==='ArrowRight')next(); });
  win.onClose=()=>{ try{bk.destroy();}catch(_){ } };
  return win;
}

/* ===== menu bar ===== */
const MENUS = {
  finder:{name:'Finder', menus:{
    File:[['New Finder Window','⌘N',()=>openFinder(null)],['Open Books','⌘B',()=>openBooks()],
          ['Import Files…','⌘I',()=>importDialog(S.active?.nav?(S.active.nav.hist[S.active.nav.i]||''):'')],
          ['New Class Folder…','⌘⇧N',()=>newFolder()],
          ['Read Selected','⌘⇧O',()=>S.qlItem&&readable(S.qlItem)&&openReader(S.qlItem)],'-',
          ['Close Window','⌘W',()=>S.active&&closeWin(S.active)]],
    Edit:[['Select All','⌘A',()=>{}],'-',['Find…','⌘F',()=>{const w=$('.search input',S.active?.el||document); w&&w.focus();}]],
    View:[['as Icons','⌘1',()=>setView('icon')],['as List','⌘2',()=>setView('list')],['as Columns','⌘3',()=>setView('col')],'-',
          ['Rescan Files','⌘R',()=>rescan()]],
    Go:[['Home','⌘⇧H',()=>S.active?.nav&&goto(S.active,null)],['Recents','⌘⇧R',()=>S.active?.nav&&goto(S.active,null,'recents')],
        '-',['Books','',()=>openBooks()]],
  }},
  books:{name:'Books', menus:{
    File:[['Library','⌘L',()=>openBooks()],'-',['Close','⌘W',()=>S.active&&closeWin(S.active)]],
    View:[['Larger Text','⌘+',()=>{}],['Smaller Text','⌘−',()=>{}]],
  }},
  aloud:{name:'Read Aloud', menus:{
    File:[['Open a File…','',()=>openAloud()],'-',['Close','⌘W',()=>S.active&&closeWin(S.active)]],
  }},
  preview:{name:'Preview', menus:{
    File:[['Close','⌘W',()=>S.active&&closeWin(S.active)]],
  }},
};
const setView=v=>{ if(S.active?.nav){S.active.nav.view=v; save('view',v); renderFinder(S.active);} };
function setMenuApp(app){
  const def=MENUS[app]||MENUS.finder;
  const bar=$('#menus'); bar.innerHTML='';
  const nm=el('div','mi bold',def.name); bar.appendChild(nm);
  Object.keys(def.menus).forEach(k=>{
    const m=el('div','mi',k);
    m.onclick=e=>{e.stopPropagation(); dropMenu(m,def.menus[k]);};
    bar.appendChild(m);
  });
  const h=el('div','mi','Window'); h.onclick=e=>{e.stopPropagation(); dropMenu(h,
    S.wins.length? S.wins.map(w=>[w.title,'',()=>w.min?unminWin(w):focusWin(w)])
                 : [['No Windows','',()=>{}]]);};
  bar.appendChild(h);
}
function dropMenu(anchor,items){
  const c=$('#ctx'); c.innerHTML=''; c.style.display='block';
  items.forEach(it=>{
    if(it==='-'){ c.appendChild(el('div','sep')); return; }
    const d=el('div','ci',`<span>${it[0]}</span>${it[1]?`<span style="float:right;opacity:.5">${it[1]}</span>`:''}`);
    d.onclick=()=>{ c.style.display='none'; it[2](); }; c.appendChild(d);
  });
  const r=anchor.getBoundingClientRect();
  c.style.left=r.left+'px'; c.style.top=(r.bottom+3)+'px'; c.style.minWidth='210px';
}
function ctxMenu(e,win,item){
  e.preventDefault(); e.stopPropagation();
  const c=$('#ctx'); c.innerHTML=''; c.style.display='block'; c.style.minWidth='190px';
  const add=(t,f)=>{const d=el('div','ci',t); d.onclick=()=>{c.style.display='none';f();}; c.appendChild(d);};
  if(item){
    add('Open', ()=>win?.nav? activate(win,item) : openDoc(item));
    if(item.kind==='file'){ add('Quick Look', ()=>quickLook(item));
      if(readable(item)) add('Read in Books', ()=>openReader(item));
      if(ALOUD_OK(item)) add('Read Aloud', ()=>openAloud(item));
      add('Open in Preview', ()=>openDoc(item)); }
    c.appendChild(el('div','sep'));
    add(S.tags[item.path]?'Remove from Starred':'Add to Starred',
      ()=>{ S.tags[item.path]?delete S.tags[item.path]:S.tags[item.path]=1; save('tags',S.tags);
        win?.nav&&renderFinder(win); });
    if(item.kind==='file'){
      add('Download', ()=>{const a=document.createElement('a'); a.href=url(item.path); a.download=item.name; a.click();});
      add('Copy Path', ()=>navigator.clipboard?.writeText(item.path));
    }
    c.appendChild(el('div','sep'));
    add('Get Info', ()=>infoWin(item));
  } else {
    add('Import Files…', ()=>importDialog(''));
    add('New Class Folder…', ()=>newFolder());
    c.appendChild(el('div','sep'));
    add('New Finder Window', ()=>openFinder(null));
    add('Open Books', ()=>openBooks());
    c.appendChild(el('div','sep'));
    add('Change Wallpaper', ()=>cycleWall());
    add(S.dark?'Light Appearance':'Dark Appearance', ()=>toggleDark());
    add('Rescan Files', ()=>rescan());
  }
  const x=Math.min(e.clientX, innerWidth-210), y=Math.min(e.clientY, innerHeight-240);
  c.style.left=x+'px'; c.style.top=y+'px';
}
function infoWin(i){
  const w=makeWin({title:i.name+' Info', app:'finder', w:300, h:380});
  w.body.innerHTML=`<div class="pane" style="text-align:center">
    <div style="font-size:74px;margin:8px 0">${glyph(i)}</div>
    <div style="font-weight:600;word-break:break-word">${esc(i.name)}</div>
    <div class="dim" style="margin:4px 0 16px">${kindOf(i)}</div>
    <table style="width:100%;font-size:11.5px;text-align:left">
      <tr><td class="dim">Size</td><td>${i.kind==='folder'?i.count+' items':fsize(i.size)}</td></tr>
      <tr><td class="dim">Where</td><td style="word-break:break-all">${esc(i.parent||'class_summaries')}</td></tr>
      <tr><td class="dim">Modified</td><td>${fdate(i.mtime)}</td></tr>
      <tr><td class="dim">Starred</td><td>${S.tags[i.path]?'Yes':'No'}</td></tr>
    </table></div>`;
}
document.addEventListener('click',()=>{const c=$('#ctx'); if(c)c.style.display='none';});

/* ===== dock ===== */
const DOCK=[
  {id:'finder',ico:'folder-open',bg:'linear-gradient(180deg,#5ac8fa,#0a84ff)',nm:'Finder',fn:()=>openFinder(null)},
  {id:'books',ico:'library',bg:'linear-gradient(180deg,#ffb340,#ff9500)',nm:'Books',fn:()=>openBooks()},
  {id:'aloud',ico:'volume-2',bg:'linear-gradient(180deg,#ff9f0a,#ff375f)',nm:'Read Aloud',fn:()=>openAloud()},
  {id:'launch',ico:'rocket',bg:'linear-gradient(180deg,#8e8e93,#48484a)',nm:'Launchpad',fn:()=>toggleLaunchpad()},
  {id:'spot',ico:'search',bg:'linear-gradient(180deg,#d1d1d6,#8e8e93)',nm:'Spotlight',fn:()=>openSpotlight()},
  {id:'recent',ico:'clock',bg:'linear-gradient(180deg,#636366,#1c1c1e)',nm:'Recents',fn:()=>{const w=openFinder(null); goto(w,null,'recents');}},
  {id:'star',ico:'star',bg:'linear-gradient(180deg,#ffd60a,#ff9f0a)',nm:'Starred',fn:()=>{const w=openFinder(null); goto(w,null,'starred');}},
  'sep',
  {id:'theme',ico:'moon',bg:'linear-gradient(180deg,#5e5ce6,#3634a3)',nm:'Appearance',fn:()=>toggleDark()},
  {id:'wall',ico:'image',bg:'linear-gradient(180deg,#30d158,#248a3d)',nm:'Wallpaper',fn:()=>cycleWall()},
];
function buildDock(){
  const d=$('#dock'); d.innerHTML='';
  DOCK.forEach(it=>{
    if(it==='sep'){ d.appendChild(el('div','dksep')); return; }
    const b=el('div','dk',`<span class="dkbg" style="background:${it.bg}">${ico(it.ico,'dkic')}</span>
      <span class="tip">${it.nm}</span><span class="dot"></span>`);
    b.dataset.id=it.id; b.onclick=()=>{ b.animate([{transform:'translateY(-13px) scale(1.34)'},
      {transform:'translateY(-26px) scale(1.34)'},{transform:'translateY(-13px) scale(1.34)'}],
      {duration:420,easing:'cubic-bezier(.3,.7,0,1)'}); it.fn(); };
    d.appendChild(b);
  });
}
function updateDock(){
  $$('#dock .dk').forEach(b=>{
    const apps=S.wins.map(w=>w.app);
    b.classList.toggle('run', apps.includes(b.dataset.id));
  });
}
function toggleDark(){ S.dark=!S.dark; save('dark',S.dark?'1':'0'); applyTheme();
  notify('Appearance', S.dark?'Dark Mode on':'Light Mode on'); }
function cycleWall(){ const k=Object.keys(WALLS); S.wall=k[(k.indexOf(S.wall)+1)%k.length];
  save('wall',S.wall); drawWall(); notify('Desktop','Wallpaper: '+S.wall); }

/* ===== notifications ===== */
function notify(t,m){
  const n=el('div','notif',`<div class="nt">${t}</div><div class="nm">${m}</div>`);
  $('#notifs').appendChild(n);
  setTimeout(()=>{n.classList.add('out'); setTimeout(()=>n.remove(),380);},2600);
}

/* ===== Spotlight ===== */
function openSpotlight(){
  const s=$('#spot'); s.classList.add('show');
  const i=$('#spotin'); i.value=''; i.focus(); spotResults('');
}
function closeSpot(){ $('#spot').classList.remove('show'); }
function spotResults(q){
  const box=$('#spotres'); box.innerHTML='';
  const ql=q.toLowerCase().trim();
  let hits = ql? S.flat.filter(i=>i.name.toLowerCase().includes(ql)).slice(0,9)
               : S.recents.map(p=>S.byPath[p]).filter(Boolean).slice(0,6);
  const acts=[];
  if(ql && ('read aloud'.includes(ql)||'aloud'.includes(ql)||'speak'.includes(ql)||'tts'.includes(ql)))
    acts.push({ico:ico('volume-2','','#ff9f0a'),nm:'Read Aloud',sub:'Application',fn:()=>openAloud()});
  if(ql && 'books'.includes(ql)) acts.push({ico:ico('library','','#bf5af2'),nm:'Books',sub:'Application',fn:openBooks});
  if(ql && ('dark'.includes(ql)||'appearance'.includes(ql))) acts.push({ico:ico('moon','','#5e5ce6'),nm:'Toggle Appearance',sub:'System',fn:toggleDark});
  if(ql && 'wallpaper'.includes(ql)) acts.push({ico:ico('image','','#30d158'),nm:'Change Wallpaper',sub:'System',fn:cycleWall});
  if(!hits.length && !acts.length){
    box.innerHTML=`<div class="srow dim" style="justify-content:center">${ql?'No results':'Type to search your notes'}</div>`;
    return;
  }
  if(!ql && hits.length) box.appendChild(el('div','shead','Recents'));
  const rows=[];
  acts.forEach(a=>{
    const r=el('div','srow',`<span class="g">${a.ico}</span><div><div>${a.nm}</div>
      <div class="dim" style="font-size:11px">${a.sub}</div></div>`);
    r.onclick=()=>{closeSpot(); a.fn();}; box.appendChild(r); rows.push(r);
  });
  if(ql && hits.length) box.appendChild(el('div','shead','Documents'));
  hits.forEach(i=>{
    const r=el('div','srow',`<span class="g">${glyph(i)}</span><div><div>${esc(i.name)}</div>
      <div class="dim" style="font-size:11px">${esc(i.parent||'class_summaries')} · ${kindOf(i)}</div></div>`);
    r.onclick=()=>{closeSpot(); i.kind==='folder'?goto(openFinder(null),i.path):openDoc(i);};
    box.appendChild(r); rows.push(r);
  });
  rows[0]?.classList.add('on'); S.spotRows=rows; S.spotI=0;
}
function spotMove(d){
  if(!S.spotRows?.length) return;
  S.spotRows[S.spotI].classList.remove('on');
  S.spotI=(S.spotI+d+S.spotRows.length)%S.spotRows.length;
  const r=S.spotRows[S.spotI]; r.classList.add('on'); r.scrollIntoView({block:'nearest'});
}

/* ===== Launchpad ===== */
function toggleLaunchpad(){
  const lp=$('#lpad');
  if(lp.classList.contains('show')){ lp.classList.remove('show'); return; }
  const g=$('#lpgrid'); g.innerHTML='';
  const A=(ic,bg,nm,fn)=>({ic,bg,nm,fn});
  const apps=[
    A('folder-open','linear-gradient(180deg,#5ac8fa,#0a84ff)','Finder',()=>openFinder(null)),
    A('library','linear-gradient(180deg,#ffb340,#ff9500)','Books',()=>openBooks()),
    A('volume-2','linear-gradient(180deg,#ff9f0a,#ff375f)','Read Aloud',()=>openAloud()),
    A('search','linear-gradient(180deg,#d1d1d6,#8e8e93)','Spotlight',openSpotlight),
    A('clock','linear-gradient(180deg,#636366,#1c1c1e)','Recents',()=>goto(openFinder(null),null,'recents')),
    A('star','linear-gradient(180deg,#ffd60a,#ff9f0a)','Starred',()=>goto(openFinder(null),null,'starred')),
    A('moon','linear-gradient(180deg,#5e5ce6,#3634a3)','Appearance',toggleDark),
    A('image','linear-gradient(180deg,#30d158,#248a3d)','Wallpaper',cycleWall),
    ...S.classes.map(c=>A('graduation-cap','linear-gradient(180deg,#64d2ff,#0a84ff)',c.name,
      ()=>goto(openFinder(null),c.path)))];
  apps.forEach((a,k)=>{
    const d=el('div','lpa',`<div class="lpi" style="background:${a.bg}">${ico(a.ic,'lpg')}</div>
      <div class="lpn">${esc(a.nm)}</div>`);
    d.style.animationDelay=(k*26)+'ms';
    d.onclick=()=>{ lp.classList.remove('show'); a.fn(); };
    g.appendChild(d);
  });
  lp.classList.add('show');
}

/* ===== clock + keys ===== */
function tick(){
  const d=new Date();
  $('#clock').textContent = d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})
    +'  '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
}
document.addEventListener('keydown',e=>{
  const cmd=e.metaKey||e.ctrlKey;
  if(e.key==='Escape'){ if($('#ql').classList.contains('show'))return closeQL();
    if($('#spot').classList.contains('show'))return closeSpot();
    if($('#lpad').classList.contains('show'))return $('#lpad').classList.remove('show'); }
  if($('#spot').classList.contains('show')){
    if(e.key==='ArrowDown'){e.preventDefault(); spotMove(1);}
    if(e.key==='ArrowUp'){e.preventDefault(); spotMove(-1);}
    if(e.key==='Enter'){e.preventDefault(); S.spotRows?.[S.spotI]?.click();}
    return;
  }
  if(cmd&&e.key.toLowerCase()==='k'){e.preventDefault(); openSpotlight();}
  if(cmd&&e.code==='Space'){e.preventDefault(); openSpotlight();}
  if(cmd&&e.key.toLowerCase()==='n'){e.preventDefault(); openFinder(null);}
  if(cmd&&e.key.toLowerCase()==='b'){e.preventDefault(); openBooks();}
  if(cmd&&e.key.toLowerCase()==='i'){e.preventDefault();
    importDialog(S.active?.nav?(S.active.nav.hist[S.active.nav.i]||''):'');}
  if(cmd&&e.key.toLowerCase()==='w'){e.preventDefault(); S.active&&closeWin(S.active);}
  if(cmd&&e.key.toLowerCase()==='m'){e.preventDefault(); S.active&&minWin(S.active);}
  if(cmd&&['1','2','3'].includes(e.key)){e.preventDefault(); setView({1:'icon',2:'list',3:'col'}[e.key]);}
  if(e.code==='Space'&&!cmd&&!/input|textarea/i.test(e.target.tagName)){
    e.preventDefault(); $('#ql').classList.contains('show')?closeQL():quickLook(S.qlItem);
  }
  if(e.key==='Enter'&&S.qlItem&&!/input|textarea/i.test(e.target.tagName)
     &&!$('#ql').classList.contains('show')){ openDoc(S.qlItem); }
});

/* ===== desktop icons ===== */
function renderDesktop(){
  const d=$('#desktop');
  $$('.dicon',d).forEach(x=>x.remove());
  const items=[...S.classes, ...S.flat.filter(i=>isBook(i)).slice(0,4)];
  items.slice(0,10).forEach((it,k)=>{
    const node=el('div','dicon',`<div class="glyph">${it.kind==='folder'
        ? ico('folder','','#3b9dff') : glyph(it)}</div>
      <div class="lbl">${esc(it.name)}</div>`);
    node.style.right=(22+Math.floor(k/6)*100)+'px';
    node.style.top=(16+(k%6)*94)+'px';
    node.onclick=e=>{e.stopPropagation(); $$('.dicon').forEach(x=>x.classList.remove('sel')); node.classList.add('sel'); S.qlItem=it;};
    node.ondblclick=()=> it.kind==='folder'? goto(openFinder(null),it.path) : openDoc(it);
    node.oncontextmenu=e=>ctxMenu(e,null,it);
    d.appendChild(node);
  });
}
$('#desktop')?.addEventListener('click',e=>{
  if(e.target.id==='desktop'){ $$('.dicon').forEach(x=>x.classList.remove('sel')); }
});

async function rescan(){
  notify('Finder','Rescanning files…');
  await loadManifest(); renderDesktop();
  S.wins.forEach(w=>{ if(w.nav){renderSidebar(w); renderFinder(w);} });
  notify('Finder', S.flat.filter(i=>i.kind==='file').length+' documents found');
}

/* ===== boot ===== */
async function boot(){
  applyTheme(); buildDock(); tick(); setInterval(tick,10000);
  try{ await loadManifest(); }
  catch(e){
    $('#boot').innerHTML=`<div class="bootmsg"><div style="font-size:50px">🖥</div>
      <h3>Run it from the launcher</h3>
      <p>Open a Terminal in <code>class_summaries</code> and run<br><code>./open-mac.command</code><br>
      (files can't be read from <code>file://</code>)</p></div>`;
    return;
  }
  setMenuApp('finder'); renderDesktop();
  dropTarget($('#desktop'), ()=>'');
  const q=new URLSearchParams(location.hash.slice(1));
  if(q.get('dark')==='1'&&!S.dark){ S.dark=true; save('dark','1'); applyTheme(); }
  if(q.get('wall')) { S.wall=q.get('wall'); save('wall',S.wall); drawWall(); }
  await new Promise(r=>setTimeout(r,450));
  $('#boot').classList.add('done');
  setTimeout(()=>$('#boot').remove(),700);

  // deep links:  #folder=cs%20cm121  #read=<path>  #open=<path>  #app=books  #find=query
  const folder=q.get('folder'), read=q.get('read'), open_=q.get('open'), app=q.get('app');
  if(app==='books'){ openBooks(); }
  else { const w=openFinder(folder||null); if(folder) goto(w,folder); }
  if(read && S.byPath[read]) openReader(S.byPath[read]);
  const aloud=q.get('aloud');
  if(aloud!=null) openAloud(S.byPath[aloud]||null);
  if(open_ && S.byPath[open_]) openDoc(S.byPath[open_]);
  if(q.get('find')!=null){ openSpotlight(); const si=$('#spotin'); si.value=q.get('find'); spotResults(si.value); }
  if(q.get('launchpad')==='1') toggleLaunchpad();
  if(!read && !open_ && !app && q.get('aloud')==null)
    setTimeout(()=>notify('Welcome', S.flat.filter(i=>i.kind==='file').length+' notes · ⌘K to search'),900);
}
document.addEventListener('DOMContentLoaded',boot);

/* ---------- paginated reader for non-EPUB documents ---------- */
async function openDocReader(doc){
  const st = S.reading[doc.path] || (S.reading[doc.path]={pct:0,page:0,theme:'light',size:100,bm:[]});
  const win=makeWin({title:doc.name, app:'books', w:900, h:730});
  win.body.innerHTML=`<div class="reader">
      <div class="rtoc"><div class="sb-h">Contents</div><div class="toclist"></div>
        <div class="sb-h">Bookmarks</div><div class="bmlist"></div></div>
      <div class="rmain">
        <div class="rstage"><div class="pager"><div class="pcols doc"></div></div></div>
        <div class="rfoot">
          <button class="pg prev">‹</button>
          <div class="rprog"><i></i></div>
          <span class="rpct dim">0%</span>
          <span class="rpage dim"></span>
          <button class="pg next">›</button>
        </div>
      </div></div>`;
  win.tbr.innerHTML=`
    <div class="segmented rth">
      ${Object.keys(RTHEMES).map(t=>`<button data-t="${t}" title="${t}"
        style="background:${RTHEMES[t].bg};color:${RTHEMES[t].fg}">A</button>`).join('')}
    </div>
    <div class="segmented">
      <button class="fs" data-d="-1" title="Smaller">A−</button>
      <button class="fs" data-d="1" title="Larger">A+</button>
      <button class="scroll" title="Scroll / page view">⇅</button>
      <button class="toc" title="Contents">☰</button>
      <button class="bm" title="Bookmark">${ico('bookmark','sm')}</button>
    </div>`;
  $('.title',win.el).innerHTML=ico('book-open','ti','#ff9f0a')+esc(doc.name.replace(/\.[^.]+$/,''));
  const stage=$('.rstage',win.el), pager=$('.pager',win.el), cols=$('.pcols',win.el);
  cols.innerHTML='<div class="loading"><div class="spin"></div>Preparing pages…</div>';

  let html;
  try{ html = await docHTML(doc); }
  catch(e){ html = `<p class="dim">Couldn't read this file: ${esc(e.message)}</p>`; }
  if(html==null){
    win.body.innerHTML=`<div class="viewer-body"></div>`;
    renderInto($('.viewer-body',win.el),doc); return win;
  }
  cols.innerHTML=html;
  cols.querySelectorAll('a[href^="http"]').forEach(a=>a.target='_blank');
  await renderMath(cols);

  let pages=1, page=st.page||0, scrollMode=false;
  const measure=()=>{
    if(scrollMode){ pages=1; return; }
    pages=Math.max(1,Math.round(pager.scrollWidth/pager.clientWidth));
    page=Math.min(page,pages-1);
  };
  const show=()=>{
    if(scrollMode) return;
    pager.scrollTo({left:page*pager.clientWidth,behavior:'smooth'});
    const pct=pages>1? page/(pages-1)*100 : 100;
    st.page=page; st.pct=pct; save('reading',S.reading);
    $('.rprog i',win.el).style.width=pct+'%';
    $('.rpct',win.el).textContent=Math.round(pct)+'%';
    $('.rpage',win.el).textContent=`${page+1} / ${pages}`;
  };
  const applyR=()=>{
    const t=RTHEMES[st.theme];
    stage.style.background=t.bg; cols.style.color=t.fg; cols.style.background=t.bg;
    cols.style.fontSize=(st.size/100*16)+'px';
    requestAnimationFrame(()=>{ measure(); show(); });
  };
  $$('.rth button',win.el).forEach(b=>{
    b.classList.toggle('on',b.dataset.t===st.theme);
    b.onclick=()=>{ st.theme=b.dataset.t; save('reading',S.reading);
      $$('.rth button',win.el).forEach(x=>x.classList.toggle('on',x.dataset.t===st.theme)); applyR(); };
  });
  $$('.fs',win.el).forEach(b=>b.onclick=()=>{
    st.size=Math.max(70,Math.min(200,st.size+ +b.dataset.d*10)); save('reading',S.reading); applyR(); });
  $('.toc',win.el).onclick=()=>$('.rtoc',win.el).classList.toggle('hidden');
  $('.scroll',win.el).onclick=e=>{
    scrollMode=!scrollMode;
    pager.classList.toggle('scrollmode',scrollMode);
    e.currentTarget.classList.toggle('on',scrollMode);
    $('.rfoot',win.el).style.opacity=scrollMode?'.5':'1';
    if(!scrollMode){ applyR(); } else pager.scrollTo({left:0});
  };
  const go=d=>{ page=Math.max(0,Math.min(pages-1,page+d)); show(); };
  $('.pg.prev',win.el).onclick=()=>go(-1);
  $('.pg.next',win.el).onclick=()=>go(1);
  $('.rprog',win.el).onclick=e=>{
    const r=e.currentTarget.getBoundingClientRect();
    page=Math.round((e.clientX-r.left)/r.width*(pages-1)); show();
  };
  pager.addEventListener('wheel',e=>{
    if(scrollMode) return;
    e.preventDefault(); go(e.deltaY>0||e.deltaX>0?1:-1);
  },{passive:false});
  win.el.addEventListener('keydown',e=>{
    if(/input|textarea/i.test(e.target.tagName)) return;
    if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();go(1);}
    if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(-1);}
  });
  win.el.tabIndex=0;

  // contents from headings
  const tl=$('.toclist',win.el);
  const hs=[...cols.querySelectorAll('h1,h2,h3')];
  hs.forEach(h=>{
    const d=el('div','sb-i',`<span class="nm" style="padding-left:${(+h.tagName[1]-1)*9}px">${esc(h.textContent.trim().slice(0,60))}</span>`);
    d.onclick=()=>{
      if(scrollMode){ h.scrollIntoView({behavior:'smooth',block:'start'}); return; }
      page=Math.max(0,Math.round((h.offsetLeft)/pager.clientWidth)); show();
    };
    tl.appendChild(d);
  });
  if(!hs.length) tl.appendChild(el('div','sb-i','<span class="nm dim">No headings</span>'));

  const drawBM=()=>{
    const bl=$('.bmlist',win.el); bl.innerHTML='';
    (st.bm||[]).forEach((b,i)=>{
      const d=el('div','sb-i',`<span class="ico">${ico('bookmark','sb','#ff9f0a')}</span><span class="nm">Page ${b.page+1}</span>`);
      d.onclick=()=>{page=b.page; show();};
      d.oncontextmenu=ev=>{ev.preventDefault(); st.bm.splice(i,1); save('reading',S.reading); drawBM();};
      bl.appendChild(d);
    });
    if(!st.bm.length) bl.appendChild(el('div','sb-i','<span class="nm dim">None yet</span>'));
  };
  drawBM();
  $('.bm',win.el).onclick=()=>{ st.bm.push({page,pct:st.pct}); save('reading',S.reading); drawBM();
    notify('Books','Bookmarked page '+(page+1)); };

  const ro=new ResizeObserver(()=>applyR()); ro.observe(stage);
  applyR(); setTimeout(applyR,120); win.el.focus();
  return win;
}

/* ===== Read Aloud (ebook-reader app, embedded) ===== */
const ALOUD_OK = i => i.kind==='file' &&
  ['pdf','html','htm','md','markdown','txt','png','jpg','jpeg','webp'].includes(i.ext);

function openAloud(item){
  const win=makeWin({title:item?item.name:'Read Aloud', app:'aloud', w:1060, h:730});
  $('.title',win.el).innerHTML=ico('volume-2','ti','#ff9f0a')+(item?esc(item.name):'Read Aloud');
  win.body.innerHTML=`<iframe class="aloud" src="./.finder/apps/reader/index.html"
     allow="autoplay" title="Read Aloud"></iframe>`;
  const frame=$('.aloud',win.el);
  if(item){
    remember(item.path);
    const send=async()=>{
      try{
        const buf=await (await fetch(url(item.path))).arrayBuffer();
        frame.contentWindow.postMessage({type:'open-file', name:item.name,
          mime:({pdf:'application/pdf',html:'text/html',htm:'text/html',md:'text/markdown',
                 txt:'text/plain'})[item.ext]||'', buffer:buf},'*');
      }catch(e){ notify('Read Aloud','Could not load '+item.name); }
    };
    const onReady=e=>{ if(e.source===frame.contentWindow && e.data?.type==='reader-ready'){
      removeEventListener('message',onReady); send(); } };
    addEventListener('message',onReady);
    frame.addEventListener('load',()=>setTimeout(send,400));
  }
  return win;
}

/* ===== importing files into the directory ===== */
let UPLOAD_OK = true;   // false when served by a plain static server
async function uploadFiles(fileList, folder){
  const files=[...fileList]; if(!files.length) return;
  const fd=new FormData(); fd.append('folder', folder||'');
  files.forEach(f=>fd.append('files', f, f.name));
  notify('Importing', files.length===1? files[0].name : files.length+' files…');
  try{
    const r=await fetch('./__upload',{method:'POST',body:fd});
    if(!r.ok) throw new Error('server said '+r.status);
    const j=await r.json();
    await rescanQuiet();
    const where = folder || 'class_summaries';
    if(j.saved?.length) notify('Imported', j.saved.length+' file'+(j.saved.length===1?'':'s')+' → '+where);
    if(j.skipped?.length) notify('Skipped', j.skipped.map(s=>s.name+' ('+s.why+')').join(', '));
    return j;
  }catch(e){
    UPLOAD_OK=false;
    notify('Import failed','Run ./open-mac.command so files can be saved');
  }
}
async function rescanQuiet(){
  await loadManifest(); renderDesktop();
  S.wins.forEach(w=>{ if(w.nav){renderSidebar(w); renderFinder(w);}
                      if(w.app==='books' && $('.bookgrid',w.el)) shelf(w,S.books); });
}
function importDialog(folder){
  const inp=document.createElement('input');
  inp.type='file'; inp.multiple=true;
  inp.accept='.pdf,.html,.htm,.docx,.md,.markdown,.txt,.csv,.rtf,.epub,.pptx,.xlsx,.tex,.png,.jpg,.jpeg,.webp';
  inp.onchange=()=>uploadFiles(inp.files, folder);
  inp.click();
}
async function newFolder(){
  const name=prompt('New class folder name:');
  if(!name) return;
  try{
    const r=await fetch('./__mkdir',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({path:name})});
    const j=await r.json();
    if(j.error) throw new Error(j.error);
    await rescanQuiet(); notify('Finder','Created “'+name+'”');
  }catch(e){ notify('Could not create folder', e.message||'check the name'); }
}

/* drag & drop onto any Finder window, or the desktop */
function dropTarget(node, folderFn){
  let depth=0;
  node.addEventListener('dragover',e=>{ e.preventDefault(); e.dataTransfer.dropEffect='copy'; });
  node.addEventListener('dragenter',e=>{ e.preventDefault(); if(depth++===0) node.classList.add('dropping'); });
  node.addEventListener('dragleave',()=>{ if(--depth<=0){depth=0; node.classList.remove('dropping');} });
  node.addEventListener('drop',e=>{
    e.preventDefault(); e.stopPropagation(); depth=0; node.classList.remove('dropping');
    const files=e.dataTransfer?.files;
    if(files?.length) uploadFiles(files, folderFn());
  });
}
