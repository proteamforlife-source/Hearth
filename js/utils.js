// ─── UTILS.JS — Shared globals, helpers, constants ────────────────────────
// Loaded FIRST. All other modules depend on these.

// ── Firebase config ──
var FB={apiKey:"AIzaSyA-JVr7hgGJZvlRWIA3RHWZ6SdzIkB5ngw",authDomain:"family-kitchen-628cb.firebaseapp.com",databaseURL:"https://family-kitchen-628cb-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"family-kitchen-628cb",storageBucket:"family-kitchen-628cb.firebasestorage.app",messagingSenderId:"1033585168692",appId:"1:1033585168692:web:d0482fdfe9996c8c6c1561"};
firebase.initializeApp(FB);
var db=firebase.database();

// ── Deferred-startup scheduler ──────────────────────────────────────────
// Attaches non-essential startup listeners on the NEXT MACROTASK, after the
// dashboard has synchronously issued its planner/chatGroups reads, so those
// reads hit a quiet connection instead of a listener-registration storm.
// MessageChannel = true macrotask boundary (unlike queueMicrotask same-task
// drain), without a timer or the paint lifecycle (rAF). Fires exactly once,
// independent of whether the dashboard reads ever complete.
var _deferChan=new MessageChannel();
var _deferQueue=[];
var _deferDone=false;
var _deferArmed=false;
_deferChan.port1.onmessage=function(){
  if(_deferDone)return;
  _deferDone=true;
  var q=_deferQueue;_deferQueue=[];
  q.forEach(function(fn){try{fn();}catch(e){}});
};
function scheduleDeferredStartup(cb){
  if(_deferDone){try{cb();}catch(e){}return;}
  _deferQueue.push(cb);
  if(!_deferArmed){_deferArmed=true;_deferChan.port2.postMessage(0);}
}

// ── App constants ──
var ADMIN='Mum';
var DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
var PRESET_TAGS=['Slow Cooker','Sweet Treats','Cakes','Asian Inspired','Lebanese','Middle Eastern','Mexican','Salads','Drinks','Desserts','Bars','High Protein','Low Carb','GF','DF','Quick','Whole Food','Kid Friendly','Meal Prep'];
var PRESET_CATS=['Breakfast','Mains','Chicken','Beef','Lamb','Pork','Seafood','Vegetarian','Vegan','Salads','Soups','Sides','Snacks','Desserts','Sweet Treats','Cakes','Breads','Drinks','Other'];
var EVENT_COLORS=['#B8967E','#A67868','#8A7A6E','#9A8FB0','#7A9BAA','#C49A9A','#8AADA8','#5C5048'];
var BILL_CATS={utilities:{icon:'⚡',bg:'#fff8e1',col:'#f9a825'},insurance:{icon:'🛡',bg:'#e8f5e9',col:'#2e7d32'},subscriptions:{icon:'📺',bg:'#f3e5f5',col:'#7b1fa2'},rent:{icon:'🏠',bg:'#e3f2fd',col:'#1565c0'},phone:{icon:'📱',bg:'#e0f2f1',col:'#00695c'},medical:{icon:'♥',bg:'#fce4ec',col:'#c62828'},transport:{icon:'🚗',bg:'#fff3e0',col:'#e65100'},other:{icon:'📋',bg:'#f5f5f5',col:'#616161'}};
var MEMBER_COLORS=[{hex:'#B8967E',name:'Caramel'},{hex:'#A67868',name:'Warm Rust'},{hex:'#8A7A6E',name:'Driftwood'},{hex:'#6E6560',name:'Pebble'},{hex:'#C4A882',name:'Sand'},{hex:'#B8A090',name:'Blush Taupe'},{hex:'#C49A9A',name:'Dusty Rose'},{hex:'#D4A5A5',name:'Soft Rose'},{hex:'#B89AB0',name:'Mauve'},{hex:'#9A8FB0',name:'Soft Lavender'},{hex:'#8FA0B8',name:'Steel Blue'},{hex:'#7A9BAA',name:'Dusty Blue'},{hex:'#8AADA8',name:'Sage Teal'},{hex:'#2A2218',name:'Espresso'},{hex:'#5C5048',name:'Dark Mocha'}];
var QUOTES=[{q:"Let food be thy medicine.",a:"Hippocrates"},{q:"Your body is a reflection of your lifestyle.",a:"Don Tolman"},{q:"Whole foods nourish the whole person.",a:"Don Tolman"},{q:"The cleaner you eat, the clearer you think.",a:"Don Tolman"},{q:"Hydration is the foundation of health.",a:"Don Tolman"},{q:"Processed foods cause inflammation.",a:"Barbara O'Neill"},{q:"Your immune system is your best doctor.",a:"Barbara O'Neill"},{q:"If you want a new outcome, break the habit of being yourself.",a:"Joe Dispenza"},{q:"Where you place your attention is where you place your energy.",a:"Joe Dispenza"},{q:"You are the creator of your own reality.",a:"Joe Dispenza"},{q:"Eating well is a form of self-respect.",a:"Unknown"},{q:"Progress, not perfection.",a:"Unknown"},{q:"Family is not an important thing. It's everything.",a:"Michael J. Fox"},{q:"Cooking is love made visible.",a:"Unknown"},{q:"The hearth is the heart of the home.",a:"Unknown"},{q:"Eat food. Not too much. Mostly plants.",a:"Michael Pollan"}];
var CAL_TYPES={event:{icon:'📅',bg:'#fff0eb',border:'#f0c4b0',color:'#96705a',label:'Event'},meal:{icon:'🍽',bg:'#eaf3ea',border:'#a0d0a0',color:'#2a6a2a',label:'Meal'},personal:{icon:'📋',bg:'#e8f0fe',border:'#b0c4f0',color:'#1a3a8a',label:'Schedule'},birthday:{icon:'🎂',bg:'#fff8e1',border:'#ffe082',color:'#e65100',label:'Birthday'},bill:{icon:'💳',bg:'#fce4ec',border:'#f48fb1',color:'#c62828',label:'Bill'},work:{icon:'💼',bg:'#e8f0fe',border:'#b0c4f0',color:'#1a3a8a',label:'Work'},uni:{icon:'🎓',bg:'#f3e8ff',border:'#c4a0f0',color:'#5a1a9a',label:'Uni'},appt:{icon:'🏥',bg:'#e8fff8',border:'#a0f0d0',color:'#1a6a5a',label:'Appt'},workout:{icon:'💪',bg:'#fff0e8',border:'#f0c0a0',color:'#7a3010',label:'Workout'}};

// ── Shared state ──
var userName='', userColor='#B8967E';
var members={}, personalData={};
var recipes=[], testRecipes=[], events=[], shopItems=[], bills=[], calEvents=[];
var selectedPresetTags=[];
var activeTag='', activeCat='';
var billFilter='all';
var calView='month', calOffset=0;
var plannerView='week', planOffset=0, planMonthOffset=0;
var planWeekOffset=0, planDayOffset=0; // separate offsets per view — never share between week and day
var plannerRef=null, plannerCalCache={};
var weekOffset=0, monthOffset=0;
var myPageView='week';
var currentConvoId='family', currentConvoName='Hearth Chat';
var chatListeners={};
var groupSelectedMembers=[], addMembersGid='', addMembersCurrent={}, addMembersSelected=[];
var evInviteId='', editBillId='', editCalId='';
var ckSteps=[], ckIdx=0, ckAll=false;
var currentPrintRec=null;
var dayCtx={}, mealCtx={};
var pinEntry='', newPinEntry='', authMember=null;

// ── Helper functions ──
function el(id){return document.getElementById(id);}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmtDate(d){try{return new Date(d+'T00:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});}catch(e){return d;}}
function dKey(d){return d.toISOString().split('T')[0];}
function todayKey(){var n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');}
function daysUntil(ds){var d=new Date(ds+'T00:00:00'),t=new Date();t.setHours(0,0,0,0);return Math.round((d-t)/(86400000));}
function parseIng(s){var m=s.match(/^([\d\u00BC\u00BD\u00BE\/\.\s\-]+\s*(?:g|kg|ml|tsp|tbsp|cups?|oz|lbs?|pinch|bunch|handful|slices?|cans?|cloves?)\.?)\s+(.+)$/i);if(m&&m[2]&&m[2].length>1)return{q:m[1].trim(),n:m[2].trim()};var m2=s.match(/^([\d\/\.\s\-]+)\s+(.+)$/);if(m2&&m2[2]&&m2[2].length>1)return{q:m2[1].trim(),n:m2[2].trim()};return{q:'',n:s};}
function avt(name,color,size){size=size||32;var fs=Math.round(size*0.42);return'<div class="mavatar" style="background:'+(color||'#8A7A6E')+';width:'+size+'px;height:'+size+'px;font-size:'+fs+'px">'+esc((name||'?').charAt(0).toUpperCase())+'</div>';}
function getWeekDates(off){var s=new Date();var d=s.getDay()||7;s.setDate(s.getDate()-d+1+(off*7));s.setHours(0,0,0,0);var arr=[];for(var i=0;i<7;i++){var dt=new Date(s);dt.setDate(s.getDate()+i);arr.push(dt);}return arr;}
function getMonthDates(off){var d=new Date();d.setDate(1);d.setMonth(d.getMonth()+off);var yr=d.getFullYear(),mo=d.getMonth(),days=[],tot=new Date(yr,mo+1,0).getDate();for(var i=1;i<=tot;i++)days.push(new Date(yr,mo,i));return{days:days,label:d.toLocaleDateString('en-AU',{month:'long',year:'numeric'})};}
function getMonthDatesForCal(offset){var d=new Date();d.setDate(1);d.setMonth(d.getMonth()+offset);var yr=d.getFullYear(),mo=d.getMonth(),days=[],tot=new Date(yr,mo+1,0).getDate();for(var i=1;i<=tot;i++)days.push(new Date(yr,mo,i));return{days:days,label:d.toLocaleDateString('en-AU',{month:'long',year:'numeric'}),year:yr,month:mo};}
// ── Shared mini calendar picker ─────────────────────────────────────────────
// showMiniCalPicker(anchorEl, viewingDate, onPickFn)
// Appears as a dropdown below anchorEl.
// onPickFn(dateString) called with YYYY-MM-DD when user picks a day.
var _mcpOffset = 0; // internal month offset for the picker

function showMiniCalPicker(anchorEl, viewingDate, onPickFn) {
  // Close if already open
  var existing = document.getElementById('mcpModal');
  if (existing) { existing.remove(); return; }

  // Start picker on the month of the viewing date
  var base = viewingDate ? new Date(viewingDate + 'T00:00:00') : new Date();
  var now = new Date();
  _mcpOffset = (base.getFullYear() - now.getFullYear()) * 12 + (base.getMonth() - now.getMonth());

  function build() {
    var old = document.getElementById('mcpModal');
    var nowD = new Date();
    var yr = nowD.getFullYear(); var mo = nowD.getMonth();
    var disp = new Date(yr, mo + _mcpOffset, 1);
    var pyr = disp.getFullYear(); var pmo = disp.getMonth();
    var monthLabel = disp.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    var firstDow = disp.getDay() || 7;
    var daysInMonth = new Date(pyr, pmo + 1, 0).getDate();
    var todayStr = todayKey();
    var viewingStr = viewingDate || todayStr;
    var DOWS = ['M','T','W','T','F','S','S'];

    var grid = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-top:6px">';
    DOWS.forEach(function(d) {
      grid += '<div style="text-align:center;font-size:.68rem;font-weight:700;color:var(--muted);padding:3px 0">' + d + '</div>';
    });
    for (var i = 1; i < firstDow; i++) {
      // Trailing days from previous month — dimmed
      var prevDays = new Date(pyr, pmo, 0).getDate();
      var pd = prevDays - (firstDow - 1) + (i - 1);
      grid += '<div style="text-align:center;padding:5px 2px;font-size:.82rem;color:#ccc">' + pd + '</div>';
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var dk = pyr + '-' + String(pmo + 1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
      var isToday = dk === todayStr;
      var isViewing = dk === viewingStr;
      var bg = isViewing ? 'var(--terra)' : isToday ? 'var(--cream)' : 'transparent';
      var color = isViewing ? '#fff' : isToday ? 'var(--charcoal)' : 'var(--charcoal)';
      var border = isToday && !isViewing ? '1.5px solid var(--border)' : '1px solid transparent';
      var fw = (isToday || isViewing) ? '700' : '400';
      grid += '<button data-mcpday="' + dk + '" style="text-align:center;padding:5px 2px;border-radius:7px;border:' + border + ';background:' + bg + ';color:' + color + ';font-size:.82rem;font-weight:' + fw + ';cursor:pointer;line-height:1.2">' + day + '</button>';
    }
    grid += '</div>';

    // Position below anchor
    var rect = anchorEl.getBoundingClientRect();
    var left = Math.min(rect.left, window.innerWidth - 260);
    var top = rect.bottom + window.scrollY + 4;

    var html = '<div id="mcpModal" style="position:absolute;z-index:9999;top:' + top + 'px;left:' + left + 'px;width:252px;background:#fff;border-radius:14px;box-shadow:0 4px 24px rgba(42,34,24,.18);padding:14px;border:1px solid var(--border)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">' +
      '<button id="mcpPrev" style="background:none;border:none;font-size:1rem;cursor:pointer;color:var(--charcoal);padding:4px 8px">&#x2190;</button>' +
      '<span style="font-weight:700;font-size:.85rem;color:var(--charcoal)">' + monthLabel + '</span>' +
      '<button id="mcpNext" style="background:none;border:none;font-size:1rem;cursor:pointer;color:var(--charcoal);padding:4px 8px">&#x2192;</button>' +
      '</div>' +
      grid +
      '<div style="display:flex;justify-content:space-between;margin-top:10px">' +
      '<button id="mcpClear" style="background:none;border:none;color:var(--terra);font-size:.82rem;cursor:pointer;padding:4px 8px">Clear</button>' +
      '<button id="mcpToday" style="background:none;border:none;color:var(--terra);font-size:.82rem;cursor:pointer;padding:4px 8px">Today</button>' +
      '</div>' +
      '</div>';

    if (old) { old.outerHTML = html; } else { document.body.insertAdjacentHTML('beforeend', html); }

    // Wire up prev/next/today/clear
    var modal = document.getElementById('mcpModal');
    modal.querySelector('#mcpPrev').addEventListener('click', function(e) { e.stopPropagation(); _mcpOffset--; build(); });
    modal.querySelector('#mcpNext').addEventListener('click', function(e) { e.stopPropagation(); _mcpOffset++; build(); });
    modal.querySelector('#mcpToday').addEventListener('click', function(e) { e.stopPropagation(); onPickFn(todayKey()); modal.remove(); });
    modal.querySelector('#mcpClear').addEventListener('click', function(e) { e.stopPropagation(); modal.remove(); });
    modal.querySelectorAll('[data-mcpday]').forEach(function(btn) {
      btn.addEventListener('click', function(e) { e.stopPropagation(); onPickFn(btn.dataset.mcpday); modal.remove(); });
    });
  }

  build();

  // Close on outside tap
  function onOutside(e) {
    var m = document.getElementById('mcpModal');
    if (m && !m.contains(e.target) && e.target !== anchorEl) {
      m.remove(); document.removeEventListener('click', onOutside, true);
    }
  }
  setTimeout(function() { document.addEventListener('click', onOutside, true); }, 50);
}

// ── lKey — local date string, always matches stored YYYY-MM-DD event dates ──
// Never use dKey() for display/matching — dKey uses toISOString (UTC) which
// shifts back one day in AEST (UTC+10). lKey uses local date parts.
function lKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ── Month picker — for month-view navigation (Calendar and Planner) ─────────
// showMonthPicker(anchorEl, currentMonthOffset, onPickFn)
// onPickFn(monthOffset) — offset from today's month
function showMonthPicker(anchorEl, currentOffset, onPickFn) {
  var existing = document.getElementById('mthPickModal');
  if (existing) { existing.remove(); return; }

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var now = new Date();
  var html = '<div id="mthPickModal" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(42,34,24,.45)">' +
    '<div style="background:#fff;border-radius:18px;padding:20px;width:300px;max-width:92vw;box-shadow:0 4px 24px rgba(42,34,24,.18)">' +
    '<div style="font-weight:700;font-size:.95rem;color:var(--charcoal);margin-bottom:14px;text-align:center">Jump to Month</div>';

  for (var y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
    html += '<div style="margin-bottom:10px">' +
      '<div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:6px">' + y + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px">';
    MONTHS.forEach(function(m, mi) {
      var val = (y - now.getFullYear()) * 12 + (mi - now.getMonth());
      var isNow = y === now.getFullYear() && mi === now.getMonth();
      var isSel = val === currentOffset;
      html += '<button data-mthval="' + val + '" style="padding:7px 4px;border-radius:9px;border:1.5px solid ' +
        (isSel ? 'var(--terra)' : 'var(--border)') + ';background:' +
        (isSel ? 'var(--terra)' : isNow ? 'var(--cream)' : '#fff') + ';color:' +
        (isSel ? '#fff' : 'var(--charcoal)') + ';font-size:.78rem;font-weight:' +
        (isNow || isSel ? '700' : '500') + ';cursor:pointer">' + m + '</button>';
    });
    html += '</div></div>';
  }
  html += '<button id="mthPickClose" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;border:none;background:var(--cream);color:var(--muted);font-size:.84rem;cursor:pointer">Close</button>' +
    '</div></div>';

  document.body.insertAdjacentHTML('beforeend', html);
  var modal = document.getElementById('mthPickModal');

  modal.querySelectorAll('[data-mthval]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      modal.remove();
      onPickFn(parseInt(btn.dataset.mthval));
    });
  });
  modal.querySelector('#mthPickClose').addEventListener('click', function() { modal.remove(); });
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}