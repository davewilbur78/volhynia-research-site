let R = [];
let ARCHIVES = {}; // code -> {full, url}

// ---------------- state ----------------
// Variant B "Tightened Nextgen": keeps Town/District/Archive lenses and the
// pill filters, but the settings gear panel is gone entirely — Record Type,
// Tag, and Year range now live in a visible filter bar, and "Scanned Only"
// (the old gear "include unscanned" switch, inverted) is a 5th pill so it
// sits on the surface with everything else. Appearance (light/dark/auto)
// also lived in the gear panel; with the panel gone this build just follows
// the system's prefers-color-scheme (still fully supported by the CSS).
let lens = 'town'; // town | district | archive | myresearch
let pillFilters = { scanned:true, jewish:false, star:false, priority:false, recent:false };
let sortField = null; // null = default (scanned/priority first). Else key into SORT_FIELDS.
let sortDir = 1;
let expandedKey = null;
let openArchiveCards = {}; // archive code -> bool
const RECENT_DAYS = 30;

// ---------------- localStorage helpers (unchanged data model) ----------------
function getLS(k) { try { return JSON.parse(localStorage.getItem(k)||'{}'); } catch(e) { return {}; } }
function setLS(k,v) { try { localStorage.setItem(k,JSON.stringify(v)); } catch(e) {} showSaved(); }
function stars() { return getLS('v-stars'); }
function statuses() { return getLS('v-status'); }
function handwritten() { return getLS('v-handwritten'); }
function setHandwritten(key,v) { const h=handwritten(); if(v) h[key]=v; else delete h[key]; setLS('v-handwritten',h); }

function notesV2() { return getLS('v-notes-v2'); }
function setNoteEntry(key,text) {
  const author=getAuthor();
  const all=notesV2();
  const list=all[key]||[];
  const trimmed=text.trim();
  const idx=list.findIndex(e=>e.author===author);
  if(trimmed) {
    const entry={author,text:trimmed,updated_at:new Date().toISOString()};
    if(idx>=0) list[idx]=entry; else list.push(entry);
  } else if(idx>=0) {
    list.splice(idx,1);
  }
  if(list.length) all[key]=list; else delete all[key];
  setLS('v-notes-v2',all);
}
function notesForRecord(key) { return (notesV2()[key])||[]; }
function hasAnyNote(key) { return notesForRecord(key).length>0; }
function getAuthor() {
  let a=localStorage.getItem('v-author');
  if(!a) {
    a=(prompt('Your name (shown on notes you leave, so collaborators know who wrote what):')||'').trim()||'Anonymous';
    try { localStorage.setItem('v-author',a); } catch(e){}
  }
  return a;
}
function setStar(key,v) { const s=stars(); if(v) s[key]=true; else delete s[key]; setLS('v-stars',s); }
function setStatus(key,v) { const s=statuses(); s[key]=v; setLS('v-status',s); }

function tagDefs() { try { return JSON.parse(localStorage.getItem('v-tagdefs')||'[]'); } catch(e) { return []; } }
function saveTagDefs(list) { try { localStorage.setItem('v-tagdefs',JSON.stringify(list)); } catch(e) {} }
function recordTags() { return getLS('v-tags'); }
function tagHue(name) { let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))>>>0; return h%360; }
function tagStyle(name) { const h=tagHue(name); return `border-color:hsl(${h},55%,45%);color:hsl(${h},60%,38%);background:hsla(${h},55%,45%,0.14)`; }
function toggleRecordTag(key,tag) {
  const all=recordTags();
  const list=all[key]||[];
  const idx=list.indexOf(tag);
  if(idx>=0) list.splice(idx,1); else list.push(tag);
  if(list.length) all[key]=list; else delete all[key];
  setLS('v-tags',all);
}

function callNumber(r) {
  const parts=[r.fond,r.opis,r.sprava].filter(Boolean);
  if(!parts.length) return r.archive||'';
  return (r.archive||'')+' '+parts.join('-');
}

const TOWN_LINKS = {
  "Ostroh": {kl:"https://sites.google.com/jewishgen.org/ostroh/home", jg:525},
  "Bilohorodka": {kl:"https://sites.google.com/jewishgen.org/bilohorodka", jg:425},
  "Zaslav": {kl:"https://kehilalinks.jewishgen.org/Izyaslav/", jg:463},
  "Zaslav (Iziaslav)": {kl:"https://kehilalinks.jewishgen.org/Izyaslav/", jg:463},
  "Zaslav/Iziaslav": {kl:"https://kehilalinks.jewishgen.org/Izyaslav/", jg:463},
  "Lechowitz/Bilohirya (Lyakhovets)": {kl:"https://kehilalinks.jewishgen.org/Bilohirya/", jg:426},
  "Lechowitz/Bilohirya (bundled with Netishyn, see source_note)": {kl:"https://kehilalinks.jewishgen.org/Bilohirya/", jg:426},
  "Olyka": {kl:"https://kehilalinks.jewishgen.org/olyka/", jg:522},
  "Kremenets": {kl:"https://kehilalinks.jewishgen.org/Kremenets/", jg:487},
  "Vyshnevets": {kl:"https://kehilalinks.jewishgen.org/vishnevets/vishnevets.html", jg:580},
  "Kulchyny": {kl:"https://kehilalinks.jewishgen.org/kulchiny/", jg:490},
  "Kulchyny (bundled, see source_note)": {kl:"https://kehilalinks.jewishgen.org/kulchiny/", jg:490},
  "Starokostyantyniv": {kl:"https://sites.google.com/jewishgen.org/starokonstantinov", jg:null},
  "Bilozerka": {kl:"https://kehilalinks.jewishgen.org/Belozerka/", jg:427},
  "Belozirka": {kl:"https://kehilalinks.jewishgen.org/Belozerka/", jg:427},
  "Shums'k": {kl:"https://kehilalinks.jewishgen.org/Shumskoye/shumsk.html", jg:555},
  "Шумськ": {kl:"https://kehilalinks.jewishgen.org/Shumskoye/shumsk.html", jg:555},
  "Vyshhorodok": {kl:"https://kehilalinks.jewishgen.org/vyshgorodok/", jg:586},
  "Vyshgorodok": {kl:"https://kehilalinks.jewishgen.org/vyshgorodok/", jg:586},
  "Rivne": {kl:"https://kehilalinks.jewishgen.org/rovno/", jg:547},
  "Berezne": {kl:"https://kehilalinks.jewishgen.org/berezne/", jg:432},
  "Derazhne": {kl:"https://kehilalinks.jewishgen.org/Derazhno/", jg:443},
  "Polonnoye": {kl:"https://kehilalinks.jewishgen.org/Polonnoye/", jg:null},
  "Stepan": {kl:null, jg:563},
  "Mezhyrichi (id=506, Ostroh-side)": {kl:null, jg:506},
  "Berezhets": {kl:null, jg:578},
  "Lanivtsi": {kl:null, jg:495},
  "Pochaiv": {kl:null, jg:534},
  "Antoniny": {kl:null, jg:418},
  "Slavuta": {kl:null, jg:556},
  "Slavuta (multi-village, see source_note)": {kl:null, jg:556},
  "Oleksynets": {kl:null, jg:519},
  "Kornytsya": {kl:null, jg:479},
  "Kuniv": {kl:null, jg:491},
  "Bazaliya": {kl:null, jg:423},
  "Shepetivka": {kl:null, jg:554},
  "Sudylkiv": {kl:null, jg:565},
  "Katerburg": {kl:null, jg:467},
  "Katerynivka": {kl:null, jg:467},
  "Rakhmanov": {kl:null, jg:544},
  "Rokhmanov": {kl:null, jg:544},
  "Sosnivka (Shumsk/Kremenets)": {kl:null, jg:952},
  "Lyudvypil": {kl:null, jg:560},
  "Ozhehivtsi": {kl:null, jg:531},
  "Teofipol": {kl:null, jg:566},
  "Kylykyiv": {kl:null, jg:469},
  "Troyanivka": {kl:null, jgUrl:"https://www.jewishgen.org/ukraine/GEO_district.asp?id=45", jgLabel:"Lutsk District"},
  "Svyniukhy": {kl:null, jgUrl:"https://www.jewishgen.org/ukraine/GEO_district.asp?id=90", jgLabel:"Volodymyr-Volynskyi District"},
  "Lyubachivka": {kl:null, jgUrl:"https://www.jewishgen.org/ukraine/GEO_district.asp?id=15", jgLabel:"Dubno District"}
};
function townDisplayName(town) { return (town||'').replace(/\s*\([^)]*\)\s*$/,''); }
function townLinks(town) {
  const e=TOWN_LINKS[town];
  if(!e) return {kl:null, jg:null, jgLabel:null};
  const jg=e.jgUrl || (e.jg ? ('https://www.jewishgen.org/ukraine/GEO_town.asp?id='+e.jg) : null);
  return {kl:e.kl||null, jg, jgLabel:e.jgLabel||null};
}
function actsButtons(r) {
  const tl=townLinks(r.town);
  const dn=townDisplayName(r.town);
  let out='';
  if(tl.kl) out+=`<a class="actbtn" href="${tl.kl}" target="_blank" rel="noopener">&#x1F517; KehilaLinks: ${esc(dn)}</a>`;
  if(tl.jg) out+=`<a class="actbtn" href="${tl.jg}" target="_blank" rel="noopener">&#x1F50E; JewishGen: ${esc(tl.jgLabel||dn)}</a>`;
  return out;
}

function fmtSize(b) {
  if(!b) return '';
  if(b<1024*1024) return (b/1024).toFixed(0)+' KB';
  return (b/(1024*1024)).toFixed(0)+' MB';
}
function daysSince(dateStr) {
  if(!dateStr) return Infinity;
  return (Date.now()-new Date(dateStr+'T00:00:00Z').getTime())/86400000;
}
function isLargeFile(r) {
  return (r.page_count && r.page_count>200) || (r.file_size_bytes && r.file_size_bytes>100*1024*1024);
}
function copyCitation(key) {
  const r=R.find(x=>x.citation_key===key);
  if(!r) return;
  const text=`${r.citation_raw} (${r.archive_full||r.archive})`;
  const done=()=>showSaved('Citation copied');
  if(navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(done);
  } else {
    done();
  }
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

function hilite(text, town) {
  if(!text) return '';
  let t = esc(text);
  t = t.replace(/\b(1[78]\d{2}|19[0-4]\d|1950)\s*[-\u2013\u2014]\s*(1[78]\d{2}|19[0-4]\d|1950)\b/g,
    '<span style="color:var(--gold-ink,var(--gold));font-weight:600">$1&ndash;$2</span>');
  t = t.replace(/(?<!span[^>]*>)\b(1[78]\d{2}|19[0-4]\d|1950)\b(?![^<]*<\/span>)/g,
    '<span style="color:var(--gold-ink,var(--gold));font-weight:600">$1</span>');
  if(town && town !== 'District-wide' && town.length > 3) {
    const clean = esc(townDisplayName(town));
    try { t = t.replace(new RegExp('\\b(' + clean.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')\\b','i'),
      '<span style="color:var(--teal-ink,var(--teal))">$1</span>'); } catch(e) {}
  }
  return t;
}

// ---------------- filtering ----------------
function baseFilter(r, opts) {
  opts = opts || {};
  const q=(document.getElementById('q').value||'').trim().toLowerCase();
  const typ=document.getElementById('f-type').value;
  const tagF=document.getElementById('f-tag').value;
  const y1=parseInt(document.getElementById('f-y1').value)||0;
  const y2=parseInt(document.getElementById('f-y2').value)||9999;
  const tg=recordTags(), st=stars();

  if(!opts.ignoreScan && pillFilters.scanned && !r.digitized) return false;
  if(typ && r.record_type!==typ) return false;
  if(tagF && !(tg[r.citation_key]||[]).includes(tagF)) return false;
  if(pillFilters.jewish && r.jewish_content!=='confirmed') return false;
  if(pillFilters.star && !st[r.citation_key]) return false;
  if(pillFilters.priority && !(r.priority && r.archive!=='DAVtsO')) return false;
  if(pillFilters.recent && daysSince(r.added_at)>RECENT_DAYS) return false;
  if(r.year_start && r.year_start>y2) return false;
  if(r.year_end && r.year_end<y1) return false;
  if(q) {
    const hay=(r.description_en+' '+r.town+' '+r.district+' '+r.citation_raw+' '+r.description_uk).toLowerCase();
    if(!hay.includes(q)) return false;
  }
  return true;
}
function defaultSort(a,b) {
  if(a.digitized && !b.digitized) return -1;
  if(!a.digitized && b.digitized) return 1;
  if(a.priority && !b.priority) return -1;
  if(!a.priority && b.priority) return 1;
  return (a.district+a.town).localeCompare(b.district+b.town);
}
const SORT_FIELDS = {
  loc:   {label:'Location',   get:r=>r.district+' '+r.town},
  type:  {label:'Type',       get:r=>(r.record_type||'')+' '+(r.subtype||'')},
  years: {label:'Years',      get:r=>r.year_start||9999, numeric:true},
  pages: {label:'Pages',      get:r=>r.page_count||999999, numeric:true},
  size:  {label:'Size',       get:r=>r.file_size_bytes==null?Infinity:r.file_size_bytes, numeric:true},
  archive:{label:'Archive',   get:r=>r.archive||''}
};
function applySort(list) {
  if(!sortField) { list.sort(defaultSort); return list; }
  const f=SORT_FIELDS[sortField];
  if(!f) { list.sort(defaultSort); return list; }
  list.sort((a,b)=>{
    const av=f.get(a), bv=f.get(b);
    if(av<bv) return -1*sortDir;
    if(av>bv) return 1*sortDir;
    return 0;
  });
  return list;
}
function setSortField(field) {
  if(sortField===field) sortDir=-sortDir; else { sortField=field; sortDir=1; }
  render();
}
function renderColumnHeader() {
  const cols = ['loc','type','years','pages','size','archive'];
  const spans = cols.map(c=>{
    const active = sortField===c;
    const arrow = active ? (sortDir===1?' &#x25B4;':' &#x25BE;') : '';
    return `<span class="ch${c==='loc'?' loc':''}${active?' active':''}" onclick="setSortField('${c}')">${SORT_FIELDS[c].label}${arrow}</span>`;
  }).join('');
  return `<div class="colhead">${spans}</div>`;
}

// ---------------- record card ----------------
function recordCardHTML(r) {
  const key=r.citation_key;
  const st=stars(), sta=statuses();
  const starred=!!st[key];
  const status=sta[key]||'not-started';
  const hasNote=hasAnyNote(key);
  const isPri=r.priority && r.archive!=='DAVtsO';
  const firstUrl=(r.commons_urls&&r.commons_urls.length)?r.commons_urls[0]:'';
  const multiCount=r.commons_urls?r.commons_urls.length:0;
  const tags=(recordTags()[key]||[]).map(t=>`<span class="tag-chip" style="${tagStyle(t)}">${esc(t)}</span>`).join('');

  const badges = [
    isPri ? '<span class="badge priority">&#x26A1; priority</span>' : '',
    r.jewish_content==='confirmed' ? '<span class="badge jewish">Jewish</span>' : '',
    (r.confidence && r.confidence!=='confirmed') ? `<span class="badge uncertain">${esc(r.confidence)}</span>` : '',
    (daysSince(r.added_at)<=RECENT_DAYS) ? '<span class="badge new">new</span>' : '',
    hasNote ? '<span class="badge">&#x25CF; note</span>' : ''
  ].filter(Boolean).join(' ');

  return `
    <div class="rtop">
      <div class="rtop-main">
        <button class="starbtn${starred?' on':''}" onclick="event.stopPropagation();clickStar('${key}',this)" title="${starred?'Unstar':'Star'}">&#x2605;</button>
        <div class="rmeta">
          <div class="rtitle">${esc(townDisplayName(r.town))} ${badges}</div>
          <div class="rdist">${esc(r.district)}</div>
          <div class="rcite mono">${esc(callNumber(r))}</div>
          <div class="rfacts">
            <span class="badge">${esc(r.record_type||'Record')}${r.subtype?' &middot; '+esc(r.subtype):''}</span>
            ${r.page_count?`<span class="badge mono">${r.page_count}pp</span>`:''}
            ${r.file_size_bytes?`<span class="badge mono">${fmtSize(r.file_size_bytes)}</span>`:''}
            ${isLargeFile(r)?`<span class="badge warn" title="Large file &mdash; may take a while to open or page through">&#x26A0; large file</span>`:''}
          </div>
        </div>
      </div>
      <div class="ryears">${esc(r.years||'')}</div>
    </div>
    <div class="rdesc">${hilite(r.description_en, r.town)}</div>
    <div class="rdesc-uk">${esc((r.description_uk||'').slice(0,100))}${(r.description_uk||'').length>100?'&hellip;':''}</div>
    <div class="rfooter">
      <div class="rtags">
        ${r.digitized ? `<a class="openscan" href="${esc(firstUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">&#x1F4C4; Open scan${multiCount>1?` (1 of ${multiCount})`:''} &#x2197;</a>`
                      : '<span class="badge lead">lead only &mdash; not yet scanned</span>'}
        ${tags}
      </div>
      <select class="statusselect" onclick="event.stopPropagation()" onchange="clickStatus('${key}',this)">
        <option value="not-started" ${status==='not-started'?'selected':''}>Not started</option>
        <option value="requested" ${status==='requested'?'selected':''}>Requested</option>
        <option value="in-progress" ${status==='in-progress'?'selected':''}>In progress</option>
        <option value="indexed" ${status==='indexed'?'selected':''}>Indexed</option>
        <option value="complete" ${status==='complete'?'selected':''}>Complete</option>
      </select>
    </div>
    <div class="rdetail-host"></div>`;
}

function detailHTML(r) {
  const key=r.citation_key;
  const scanLinks=r.commons_urls&&r.commons_urls.length
    ?r.commons_urls.map((u,i)=>`<div class="scanlink-item"><a class="openscan" href="${esc(u)}" target="_blank" rel="noopener">&#x1F4C4; Open scan ${i+1} on Wikimedia Commons &#x2197;</a></div>`).join('')
    :'<p style="color:var(--muted);font-size:13px">Not yet digitized. Request from the archive directly.</p>';
  const hw=handwritten()[key]||'';

  const pageSize=(r.page_count||r.file_size_bytes)
    ? `<div class="detailfield">${r.page_count?`<b>Pages:</b> ${r.page_count} &nbsp;`:''}${r.file_size_bytes?`<b>Size:</b> ${fmtSize(r.file_size_bytes)}`:''}</div>` : '';

  const archField = `<div class="detailfield">
      <b>Archive:</b> ${esc(r.archive_full||r.archive)}<br>
      ${r.fond?`<b>Fond:</b> ${esc(r.fond)} &nbsp;`:''}${r.opis?`<b>Opis:</b> ${esc(r.opis)} &nbsp;`:''}${r.sprava?`<b>Sprava:</b> ${esc(r.sprava)}`:''}
      ${r.added_at?`<br><span style="font-size:11px;color:var(--faint)">Added to dataset: ${esc(r.added_at)}</span>`:`<br><span style="font-size:11px;color:var(--faint)">Part of the original 593-record dataset</span>`}
    </div>`;

  const davtso = r.archive==='DAVtsO'
    ? `<div class="archnote">Zaslav vital records are held at DAVtsO (Vinnytsia), not DAZHO &mdash; a real custody quirk, confirmed by three independent sources.</div>` : '';
  const diszmo = r.archive==='DISZMO'
    ? `<div class="archnote">Held at the Institute of Jewish Studies, Kamianets-Podilsky.</div>` : '';
  const sourceNote = r.confidence && r.confidence!=='confirmed' && r.source_note
    ? `<div class="sourcenote"><b>${esc(r.confidence.toUpperCase())}:</b> ${esc(r.source_note)}</div>` : '';

  const tagDefsList=tagDefs();
  const applied=recordTags()[key]||[];
  const tagPicker = tagDefsList.map(t=>{
    const on=applied.includes(t);
    return `<button class="tagchipbtn" style="${on?tagStyle(t):''}" onclick="toggleRecordTag('${key}','${esc(t).replace(/'/g,"&#39;")}');rerenderCard('${key}')">${on?'&#x2713; ':''}${esc(t)}</button>`;
  }).join('') + `<button class="tagchipbtn tagnew" onclick="addNewTagFor('${key}')">&#x2795; New tag</button>`;

  const noteList=notesForRecord(key);
  const author=localStorage.getItem('v-author')||'';
  const others=noteList.filter(e=>e.author!==author);
  const mine=noteList.find(e=>e.author===author);
  const othersHtml=others.map(e=>`<div class="noteentry"><span class="noteauthor">${esc(e.author)}</span>${esc(e.text)}</div>`).join('');

  return `<div class="rdetail">
    <div>
      <h5>Scanned documents</h5>
      ${scanLinks}
      ${pageSize}
      <div class="gp-field" style="margin-top:8px">
        <label style="font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.05em">Handwritten or typed (set by eye when you open the scan)</label>
        <select class="hwselect" onclick="event.stopPropagation()" onchange="setHandwritten('${key}',this.value)">
          <option value="" ${!hw?'selected':''}>Not checked</option>
          <option value="handwritten" ${hw==='handwritten'?'selected':''}>Handwritten</option>
          <option value="typed" ${hw==='typed'?'selected':''}>Typed</option>
          <option value="mixed" ${hw==='mixed'?'selected':''}>Mixed</option>
        </select>
      </div>
      <h5>Full description</h5>
      <p style="font-size:13px">${hilite(r.description_en, r.town)}</p>
      <p style="font-size:12px;color:var(--faint);font-style:italic">${esc(r.description_uk)}</p>
    </div>
    <div onclick="event.stopPropagation()">
      <h5>Archive reference</h5>
      <div class="citebox">${esc(r.citation_raw)}<button class="copybtn" onclick="copyCitation('${key}')">&#x1F4CB; Copy</button></div>
      ${archField}
      ${davtso}${diszmo}${sourceNote}
      <div class="actbtns">
        ${r.archive_url&&r.archive_url!=='#'?`<a class="actbtn" href="${esc(r.archive_url)}" target="_blank" rel="noopener">&#x1F4C2; Archive catalog &#x2197;</a>`:''}
        ${actsButtons(r)}
      </div>
      <h5>Tags</h5>
      <div class="tagpicker">${tagPicker}</div>
      <h5>Research notes</h5>
      ${othersHtml}
      <div class="noteentry" style="background:var(--surface)">
        <span class="noteauthor">Your note${mine?' (editable)':''}</span>
        <textarea class="notesta" placeholder="Findings, links, anything worth remembering&hellip;" onblur="setNoteEntry('${key}',this.value)">${mine?esc(mine.text):''}</textarea>
      </div>
    </div>
  </div>`;
}

function rerenderCard(key) {
  const el=document.querySelector(`.rcard[data-key="${cssEsc(key)}"]`);
  if(!el) return;
  el.innerHTML=recordCardHTML(R.find(r=>r.citation_key===key));
  if(expandedKey===key) {
    el.classList.add('expanded');
    el.querySelector('.rdetail-host').innerHTML=detailHTML(R.find(r=>r.citation_key===key));
  }
}
function cssEsc(s){ return String(s).replace(/["\\]/g,'\\$&'); }

function makeCardEl(r) {
  const div=document.createElement('div');
  div.className='rcard';
  div.dataset.key=r.citation_key;
  div.innerHTML=recordCardHTML(r);
  div.addEventListener('click', (e)=>{
    if(e.target.closest('select,a,button,textarea,input')) return;
    toggleExpand(r, div);
  });
  return div;
}

function toggleExpand(r, el) {
  const key=r.citation_key;
  if(expandedKey===key) {
    expandedKey=null;
    el.classList.remove('expanded');
    el.querySelector('.rdetail-host').innerHTML='';
    return;
  }
  const prevEl=expandedKey ? document.querySelector(`.rcard[data-key="${cssEsc(expandedKey)}"]`) : null;
  if(prevEl) { prevEl.classList.remove('expanded'); prevEl.querySelector('.rdetail-host').innerHTML=''; }
  expandedKey=key;
  el.classList.add('expanded');
  el.querySelector('.rdetail-host').innerHTML=detailHTML(r);
}

function clickStar(key,btn) {
  const on=btn.classList.toggle('on');
  setStar(key,on);
  if(lens==='myresearch') renderMain();
}
function clickStatus(key,sel) {
  setStatus(key,sel.value);
  if(lens==='myresearch') renderMain();
}
function addNewTagFor(key) {
  const name=(prompt('New tag name:')||'').trim();
  if(!name) return;
  const defs=tagDefs();
  if(!defs.includes(name)) { defs.push(name); saveTagDefs(defs); populateTagFilter(); }
  toggleRecordTag(key,name);
  rerenderCard(key);
}

// ---------------- grouped list (town / district lenses) ----------------
function renderGroupedList(container, groupKey) {
  const recs=R.filter(r=>baseFilter(r));
  if(!recs.length) {
    container.innerHTML=`<div class="emptystate"><h3>No records match</h3><p>Try clearing the search or turning off &ldquo;Scanned Only.&rdquo;</p></div>`;
    return;
  }
  applySort(recs);
  const groups={};
  recs.forEach(r=>{
    const k = groupKey==='town' ? townDisplayName(r.town) : r.district;
    (groups[k]=groups[k]||[]).push(r);
  });
  const keys=Object.keys(groups).sort((a,b)=>a.localeCompare(b));
  container.innerHTML=renderColumnHeader();
  keys.forEach(k=>{
    const head=document.createElement('div');
    head.className='grouphead';
    head.innerHTML=`${esc(k)} <span class="n">&middot; ${groups[k].length}</span>`;
    container.appendChild(head);
    groups[k].forEach(r=>container.appendChild(makeCardEl(r)));
  });
}

// ---------------- archive holdings view ----------------
function renderArchiveView(container) {
  const scoped=R.filter(r=>baseFilter(r,{ignoreScan:true}));
  if(!scoped.length) {
    container.innerHTML=`<div class="emptystate"><h3>No records match</h3><p>Try clearing the search.</p></div>`;
    return;
  }
  const byArch={};
  scoped.forEach(r=>{ (byArch[r.archive]=byArch[r.archive]||[]).push(r); });
  const codes=Object.keys(byArch).sort((a,b)=>byArch[b].length-byArch[a].length);

  const grid=document.createElement('div');
  grid.className='archgrid';
  codes.forEach(code=>{
    const list=byArch[code];
    const total=list.length;
    const digitized=list.filter(r=>r.digitized).length;
    const jewish=list.filter(r=>r.jewish_content==='confirmed').length;
    const pct=total?Math.round(100*digitized/total):0;
    const meta=ARCHIVES[code]||{full:code,url:''};

    const card=document.createElement('div');
    card.className='archcard';
    card.innerHTML=`
      <div class="ahead">
        <div><div class="acode">${esc(code)}</div><div class="afull">${esc(meta.full)}</div></div>
        ${meta.url?`<a class="alink" href="${esc(meta.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">catalog &#x2197;</a>`:''}
      </div>
      <div class="abar"><div class="abarfill" style="width:${pct}%"></div></div>
      <div class="astats">
        <span><span class="num">${digitized}</span> of <span class="num">${total}</span> scanned</span>
        <span><span class="num">${jewish}</span> confirmed Jewish</span>
      </div>
      <div class="archrows" id="archrows-${cssId(code)}"></div>`;
    card.addEventListener('click', (e)=>{
      if(e.target.closest('a')) return;
      const rows=card.querySelector('.archrows');
      const isOpen=rows.classList.toggle('open');
      openArchiveCards[code]=isOpen;
      if(isOpen && !rows.dataset.built) {
        rows.dataset.built='1';
        const visible=list.filter(r=>baseFilter(r));
        if(!visible.length) {
          rows.innerHTML=`<div style="font-size:12px;color:var(--muted)">Everything here is a lead only &mdash; turn off &ldquo;Scanned Only&rdquo; above to see it.</div>`;
        } else {
          applySort(visible);
          visible.forEach(r=>{
            const row=document.createElement('div');
            row.className='rcard';
            row.dataset.key=r.citation_key;
            row.innerHTML=recordCardHTML(r);
            row.addEventListener('click', (ev)=>{
              if(ev.target.closest('select,a,button,textarea,input')) return;
              toggleExpand(r, row);
            });
            rows.appendChild(row);
          });
        }
      }
    });
    grid.appendChild(card);
  });
  container.innerHTML='';
  container.appendChild(grid);
}
function cssId(s){ return String(s).replace(/[^a-zA-Z0-9_-]/g,'_'); }

// ---------------- my research ----------------
function renderMyResearch(container) {
  const st=stars(),sta=statuses();
  const active=R.filter(r=>st[r.citation_key]||(sta[r.citation_key]&&sta[r.citation_key]!=='not-started')||hasAnyNote(r.citation_key));
  if(!active.length) {
    container.innerHTML=`<div class="emptystate"><h3>No records yet</h3><p>Star &#x2605; records or set a status from the Town, District, or Archive views.</p></div>`;
    return;
  }
  const wrap=document.createElement('div');
  wrap.innerHTML=`<div class="myrhdr"><h2 style="font-size:18px">My Research</h2><button class="exportbtn" onclick="exportCSV()">&#x1F4E5; Export CSV</button></div>`;
  active.sort(defaultSort);
  active.forEach(r=>{
    const key=r.citation_key;
    const starred=!!st[key];
    const status=sta[key]||'not-started';
    const noteList=notesForRecord(key);
    const note=noteList.map(e=>`${e.author}: ${e.text}`).join(' | ');
    const firstUrl=r.commons_urls&&r.commons_urls.length?r.commons_urls[0]:'';
    const card=document.createElement('div');
    card.className='mycard'+(r.priority&&r.archive!=='DAVtsO'?' priority':'');
    card.innerHTML=`
      <div class="mycard-hdr">
        <div>
          <div style="font-weight:600;font-size:14px">${esc(r.description_en)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">${esc(townDisplayName(r.town))} &middot; ${esc(r.district)} &middot; <span class="mono">${esc(callNumber(r))}</span> ${r.years?('&middot; '+esc(r.years)):''}</div>
          ${firstUrl?`<a class="openscan" href="${esc(firstUrl)}" target="_blank" rel="noopener" style="margin-top:6px;display:inline-flex">&#x1F4C4; Open scan &#x2197;</a>`:''}
        </div>
        <button class="starbtn${starred?' on':''}" onclick="clickStar('${key}',this)">&#x2605;</button>
      </div>
      <select class="statusselect" style="margin-top:8px" onchange="clickStatus('${key}',this)">
        <option value="not-started" ${status==='not-started'?'selected':''}>Not started</option>
        <option value="requested" ${status==='requested'?'selected':''}>Requested</option>
        <option value="in-progress" ${status==='in-progress'?'selected':''}>In progress</option>
        <option value="indexed" ${status==='indexed'?'selected':''}>Indexed</option>
        <option value="complete" ${status==='complete'?'selected':''}>Complete</option>
      </select>
      ${note?`<div class="mycard-notes">${esc(note.slice(0,400))}${note.length>400?'&hellip;':''}</div>`:''}`;
    wrap.appendChild(card);
  });
  container.innerHTML='';
  container.appendChild(wrap);
}

// ---------------- status line ----------------
function updateStatusLine() {
  const el=document.getElementById('statusline');
  const totalScanned=R.filter(r=>r.digitized).length;
  const totalAll=R.length;
  if(lens==='myresearch') {
    el.innerHTML=`<span class="dot" style="background:var(--gold)"></span> Records you&rsquo;ve starred, set a status on, or left a note on.`;
    return;
  }
  if(lens==='archive') {
    el.innerHTML=`<span class="dot"></span> Coverage across every archive &mdash; search and the filters above narrow this too.`;
    return;
  }
  if(pillFilters.scanned) {
    el.innerHTML=`<span class="dot"></span> Showing records with a scan to view &mdash; this is the default. <b>${totalScanned}</b> scanned &mdash; <button class="esc" onclick="setScannedOnly(false)">show all ${totalAll}, including the ${totalAll-totalScanned} without a scan yet</button>`;
  } else {
    el.innerHTML=`<span class="dot"></span> Showing all <b>${totalAll}</b> records, including leads without a scan &mdash; <button class="esc" onclick="setScannedOnly(true)">show only the ${totalScanned} with a scan</button>`;
  }
}
function setScannedOnly(v) {
  pillFilters.scanned=v;
  document.getElementById('p-scanned').classList.toggle('on', v);
  render();
}

// ---------------- lens / pill wiring ----------------
function setLens(l) {
  lens=l;
  document.querySelectorAll('#lenstabs .segopt').forEach(b=>b.classList.toggle('on', b.dataset.lens===l));
  document.getElementById('myresearchbtn').classList.toggle('on', l==='myresearch');
  expandedKey=null;
  render();
}
function togglePill(name) {
  pillFilters[name]=!pillFilters[name];
  document.getElementById('p-'+name).classList.toggle('on', pillFilters[name]);
  render();
}
function resetAll() {
  document.getElementById('q').value='';
  document.getElementById('f-type').value='';
  document.getElementById('f-tag').value='';
  document.getElementById('f-y1').value='';
  document.getElementById('f-y2').value='';
  pillFilters={scanned:true,jewish:false,star:false,priority:false,recent:false};
  document.getElementById('p-scanned').classList.add('on');
  document.getElementById('p-jewish').classList.remove('on');
  document.getElementById('p-star').classList.remove('on');
  document.getElementById('p-priority').classList.remove('on');
  document.getElementById('p-recent').classList.remove('on');
  sortField=null;
  sortDir=1;
  render();
}

// ---------------- main render ----------------
function render() {
  updateStatusLine();
  renderMain();
}
function renderMain() {
  const main=document.getElementById('main');
  if(lens==='town') return renderGroupedList(main,'town');
  if(lens==='district') return renderGroupedList(main,'district');
  if(lens==='archive') return renderArchiveView(main);
  if(lens==='myresearch') return renderMyResearch(main);
}

// ---------------- toast ----------------
let saveT;
function showSaved(msg) { const el=document.getElementById('toast'); if(!el) return; el.textContent=msg||'Saved'; el.classList.add('on'); clearTimeout(saveT); saveT=setTimeout(()=>el.classList.remove('on'),1600); }

// ---------------- CSV export ----------------
function exportCSV() {
  const st=stars(),sta=statuses(),tg=recordTags();
  const hdrs=['ID','District','Town','RecordType','Subtype','DescriptionEN','DescriptionUK','Years','PageCount','FileSizeBytes','JewishContent','AddedAt','Archive','ArchiveFull','Fond','Opis','Sprava','CallNumber','Citation','CommonsScan','Priority','Starred','Status','Tags','Notes'];
  const q=s=>'"'+String(s||'').replace(/"/g,'""')+'"';
  const rows=R.map(r=>[
    r.id,r.district,r.town,r.record_type,r.subtype||'',
    r.description_en,r.description_uk,r.years,
    r.page_count||'',r.file_size_bytes||'',r.jewish_content||'',r.added_at||'',
    r.archive,r.archive_full,r.fond||'',r.opis||'',r.sprava||'',
    callNumber(r),
    r.citation_raw,
    r.commons_urls&&r.commons_urls.length?r.commons_urls[0]:'',
    r.priority?'Yes':'No',
    st[r.citation_key]?'Yes':'No',
    sta[r.citation_key]||'not-started',
    (tg[r.citation_key]||[]).join('; '),
    notesForRecord(r.citation_key).map(e=>`${e.author}: ${e.text}`).join(' | ')
  ].map(q).join(','));
  const csv=[hdrs.join(','),...rows].join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='volhynia-jewish-archives-'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}

// ---------------- changelog ----------------
function checkChangelog() {
  const last=localStorage.getItem('v-lastvisit');
  const newCount=R.filter(r=>r.added_at && (!last || r.added_at > last.slice(0,10))).length;
  if(newCount>0 && last) {
    document.getElementById('changelog-text').textContent=
      `${newCount} record${newCount===1?'':'s'} added since your last visit (${last.slice(0,10)}).`;
    document.getElementById('changelog').classList.add('show');
  }
}
function dismissChangelog() {
  document.getElementById('changelog').classList.remove('show');
  try { localStorage.setItem('v-lastvisit', new Date().toISOString()); } catch(e) {}
}

// ---------------- filter dropdowns ----------------
function populateTagFilter() {
  const sel=document.getElementById('f-tag');
  const cur=sel.value;
  const defs=tagDefs();
  sel.innerHTML='<option value="">All tags</option>'+defs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  if(defs.includes(cur)) sel.value=cur;
}
function populateTypeFilter() {
  const sel=document.getElementById('f-type');
  const types=[...new Set(R.map(r=>r.record_type))].filter(Boolean).sort();
  sel.innerHTML='<option value="">All types</option>'+types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
}
function buildArchiveMeta() {
  R.forEach(r=>{
    if(r.archive && !ARCHIVES[r.archive]) {
      ARCHIVES[r.archive]={full:r.archive_full||r.archive, url:(r.archive_url&&r.archive_url!=='#')?r.archive_url:''};
    }
  });
}

// ---------------- init ----------------
async function loadRecords(){
  if (typeof EMBEDDED_RECORDS !== 'undefined') return EMBEDDED_RECORDS;
  const resp = await fetch('../records.json');
  return await resp.json();
}
async function init(){
  document.getElementById('p-scanned').classList.add('on');
  R = await loadRecords();
  buildArchiveMeta();
  populateTypeFilter();
  populateTagFilter();
  render();
  checkChangelog();
  if(!localStorage.getItem('v-lastvisit')) { try { localStorage.setItem('v-lastvisit', new Date().toISOString()); } catch(e) {} }
}
init();

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && expandedKey) {
    const el=document.querySelector(`.rcard[data-key="${cssEsc(expandedKey)}"]`);
    if(el) { el.classList.remove('expanded'); const h=el.querySelector('.rdetail-host'); if(h) h.innerHTML=''; }
    expandedKey = null;
  }
});
