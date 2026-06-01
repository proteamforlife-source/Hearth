// ─── CALENDAR.JS ──────────────────────────────────────────────────────────
var calView = 'month', calOffset = 0, calEvents = [], calBirthdays = [];

var CAL_TYPES = {
  event:    { icon: '📅', bg: '#fff0eb', border: '#f0c4b0', color: '#96705a', label: 'Event' },
  meal:     { icon: '🍽', bg: '#eaf3ea', border: '#a0d0a0', color: '#2a6a2a', label: 'Meal' },
  personal: { icon: '📋', bg: '#e8f0fe', border: '#b0c4f0', color: '#1a3a8a', label: 'Schedule' },
  birthday: { icon: '🎂', bg: '#fff8e1', border: '#ffe082', color: '#e65100', label: 'Birthday' },
  bill:     { icon: '💳', bg: '#fce4ec', border: '#f48fb1', color: '#c62828', label: 'Bill' },
  work:     { icon: '💼', bg: '#e8f0fe', border: '#b0c4f0', color: '#1a3a8a', label: 'Work' },
  uni:      { icon: '🎓', bg: '#f3e8ff', border: '#c4a0f0', color: '#5a1a9a', label: 'Uni' },
  appt:     { icon: '🏥', bg: '#e8fff8', border: '#a0f0d0', color: '#1a6a5a', label: 'Appt' },
  workout:  { icon: '💪', bg: '#fff0e8', border: '#f0c0a0', color: '#7a3010', label: 'Workout' }
};

// ── Monday of the week containing d (local) ──
function getMondayOfWeek(d) {
  var day = new Date(d);
  var dow = day.getDay() || 7;
  day.setDate(day.getDate() - dow + 1);
  day.setHours(0, 0, 0, 0);
  return day;
}

function getCalItemsForDate(dk) {
  var items = [];
  events.forEach(function(ev) {
    if (ev.date === dk) items.push({ type: 'event', text: ev.name, source: 'Events' });
  });
  if (personalData && personalData.days && personalData.days[dk] && personalData.days[dk].items) {
    Object.values(personalData.days[dk].items).forEach(function(item) {
      items.push({ type: item.type || 'personal', text: item.text, source: 'My Schedule' });
    });
  }
  Object.values(members).forEach(function(m) {
    if (!m.birthday) return;
    var bd = new Date(m.birthday + 'T00:00:00');
    if (m.birthday.slice(5) === dk.slice(5)) {
      var age = null;
      if (bd.getFullYear() > 1900) age = parseInt(dk.slice(0, 4)) - bd.getFullYear();
      items.push({ type: 'birthday', text: m.name + (age !== null ? ' turns ' + age : '\'s birthday'), source: 'Birthdays' });
    }
  });
  calEvents.forEach(function(ev) {
    if (ev.type === 'birthday') {
      if (ev.date && ev.date.slice(5) === dk.slice(5)) {
        var age = null;
        if (ev.birthYear) age = parseInt(dk.slice(0, 4)) - ev.birthYear;
        items.push({ type: 'birthday', text: ev.name + (age !== null ? ' turns ' + age : ''), source: 'Birthdays', id: ev.id, ev: ev });
      }
    } else {
      if (ev.date === dk) items.push({ type: ev.type || 'event', text: ev.name, source: 'Calendar', id: ev.id, ev: ev });
    }
  });
  if (userName === ADMIN) {
    bills.forEach(function(b) {
      if (!b.paid && b.due === dk) items.push({ type: 'bill', text: b.name + (b.amount ? ' $' + b.amount.toFixed(2) : ''), source: 'Bills' });
    });
  }
  return items;
}

var plannerCalCache = {};
function loadPlannerForCalendar(wkKeys, callback) {
  var pending = wkKeys.length;
  if (!pending) { callback(); return; }
  wkKeys.forEach(function(wk) {
    db.ref('planner/' + wk).once('value', function(snap) {
      plannerCalCache[wk] = snap.val() || {};
      pending--;
      if (pending === 0) callback();
    });
  });
}

function getMealsForDate(dk) {
  var meals = [];
  var d = new Date(dk + 'T00:00:00');
  var monday = getMondayOfWeek(d);
  var wk = dKey(monday); // planner data uses dKey — intentional
  var dow = d.getDay() - 1; if (dow < 0) dow = 6;
  var dayData = plannerCalCache[wk] && plannerCalCache[wk][dow];
  if (!dayData) return meals;
  ['B', 'L', 'D'].forEach(function(slot) {
    if (dayData[slot]) Object.values(dayData[slot]).forEach(function(m) {
      meals.push({ type: 'meal', text: m.name, source: 'Planner' });
    });
  });
  return meals;
}

function getMonthDatesForCal(offset) {
  var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset);
  var yr = d.getFullYear(), mo = d.getMonth();
  var days = []; var tot = new Date(yr, mo + 1, 0).getDate();
  for (var i = 1; i <= tot; i++) days.push(new Date(yr, mo, i));
  return { days: days, label: d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }), year: yr, month: mo };
}

function openMonthJump() {
  var anchor = el('calLabelInner');
  if (!anchor) return;
  // Month view — use month grid picker (jump months, not days)
  if (calView === 'month') {
    showMonthPicker(anchor, calOffset, function(val) {
      calOffset = val;
      renderCalendar();
    });
    return;
  }
  // Week / day view — use mini calendar picker (jump to a specific date)
  var viewDate = todayKey();
  if (calView === 'day') {
    var vd = new Date(); vd.setDate(vd.getDate() + calOffset); viewDate = lKey(vd);
  } else {
    var wd = getWeekDates(calOffset); viewDate = lKey(wd[0]);
  }
  showMiniCalPicker(anchor, viewDate, function(dk) {
    var picked = new Date(dk + 'T00:00:00');
    var today = new Date(); today.setHours(0,0,0,0);
    if (calView === 'day') {
      calOffset = Math.round((picked - today) / 86400000);
    } else {
      var dow = picked.getDay() || 7;
      var mon = new Date(picked); mon.setDate(picked.getDate() - dow + 1);
      var todMon = new Date(today); var td = todMon.getDay() || 7; todMon.setDate(today.getDate() - td + 1);
      calOffset = Math.round((mon - todMon) / (7 * 86400000));
    }
    renderCalendar();
  });
}

function updateCalNav() {
  var navEl = el('calNavRow'); if (!navEl) return;
  var labelTxt = '';
  if (calView === 'month') {
    labelTxt = getMonthDatesForCal(calOffset).label;
  } else if (calView === 'week') {
    var dates = getWeekDates(calOffset);
    labelTxt = dates[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + ' – ' + dates[6].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  } else {
    var dd = new Date(); dd.setDate(dd.getDate() + calOffset);
    labelTxt = dd.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long' });
  }
  navEl.innerHTML =
    '<button id="calPrevNav" style="background:none;border:none;font-size:1.1rem;cursor:pointer;padding:4px 10px;color:var(--charcoal)">&#x2190;</button>' +
    '<span id="calLabelInner" style="font-weight:700;font-size:.92rem;color:var(--charcoal);cursor:pointer;border-bottom:1.5px dashed var(--terra);padding-bottom:1px">' + labelTxt + ' ▾</span>' +
    '<button id="calNextNav" style="background:none;border:none;font-size:1.1rem;cursor:pointer;padding:4px 10px;color:var(--charcoal)">&#x2192;</button>' +
    '<button id="calTodayBtn" style="background:var(--cream);border:1.5px solid var(--border);border-radius:20px;padding:4px 12px;font-size:.75rem;font-weight:700;color:var(--sage);cursor:pointer;margin-left:6px">Today</button>';
}

function renderCalendar() {
  if (!el('pg-c')) return;
  var billLeg = el('calBillLegend');
  if (billLeg) billLeg.style.display = userName === ADMIN ? 'flex' : 'none';
  ['month', 'week', 'day'].forEach(function(v) {
    var btn = el('cv-' + v); if (!btn) return;
    btn.className = 'cal-type-btn' + (calView === v ? ' on' : '');
  });
  updateCalNav();
  if (calView === 'month') renderCalMonth();
  else if (calView === 'week') renderCalWeek();
  else renderCalDay();
}

function renderCalMonth() {
  var mdata = getMonthDatesForCal(calOffset);
  var today = todayKey();
  var firstDay = mdata.days[0].getDay(); if (firstDay === 0) firstDay = 7;
  // wkKeys for planner use dKey (planner data stored with dKey)
  var wkKeys = [];
  mdata.days.forEach(function(d) {
    var wk = dKey(getMondayOfWeek(d));
    if (wkKeys.indexOf(wk) < 0) wkKeys.push(wk);
  });
  loadPlannerForCalendar(wkKeys, function() {
    var html = '<div class="cal-month-grid">';
    ['M','T','W','T','F','S','S'].forEach(function(d) { html += '<div class="cal-dow">' + d + '</div>'; });
    for (var i = 1; i < firstDay; i++) html += '<div></div>';
    mdata.days.forEach(function(d) {
      var dk = lKey(d); // lKey — local date, matches stored event dates
      var isT = dk === today;
      var items = getCalItemsForDate(dk).concat(getMealsForDate(dk));
      var shown = items.slice(0, 2); var more = items.length - 2;
      html += '<div class="cal-day' + (isT ? ' today' : '') + '" data-caldk="' + dk + '">';
      html += '<div class="cal-day-num">' + d.getDate() + '</div>';
      shown.forEach(function(item) {
        var t = CAL_TYPES[item.type] || CAL_TYPES.personal;
        html += '<div class="cal-event-pill" style="background:' + t.bg + ';color:' + t.color + '">' + t.icon + ' ' + esc(item.text.length > 10 ? item.text.slice(0, 10) + '…' : item.text) + '</div>';
      });
      if (more > 0) html += '<div class="cal-more">+' + more + ' more</div>';
      html += '</div>';
    });
    html += '</div>';
    el('calGrid').innerHTML = html;
  });
}

function renderCalWeek() {
  var dates = getWeekDates(calOffset);
  var today = todayKey();
  var wk = dKey(dates[0]); // planner uses dKey
  loadPlannerForCalendar([wk], function() {
    var html = '<div class="cal-week-grid">';
    html += '<div class="cal-week-time-hdr"></div>';
    dates.forEach(function(d, i) {
      var dk = lKey(d); // lKey for display/event matching
      var isT = dk === today;
      html += '<div class="cal-week-col-hdr' + (isT ? ' cal-week-today' : '') + '" data-caldk="' + dk + '" style="cursor:pointer"><div class="cal-week-day-name">' + DAYS[i] + '</div><div class="cal-week-day-num">' + d.getDate() + '</div></div>';
    });
    html += '<div class="cal-week-time" style="font-size:.65rem;padding:4px">All day</div>';
    dates.forEach(function(d) {
      var dk = lKey(d); // lKey for event matching
      var items = getCalItemsForDate(dk).concat(getMealsForDate(dk));
      html += '<div class="cal-week-events" data-caldk="' + dk + '" style="cursor:pointer">';
      items.forEach(function(item) {
        var t = CAL_TYPES[item.type] || CAL_TYPES.personal;
        html += '<div class="cal-event-pill" style="background:' + t.bg + ';color:' + t.color + ';margin-bottom:3px">' + t.icon + ' ' + esc(item.text.length > 12 ? item.text.slice(0, 12) + '…' : item.text) + '</div>';
      });
      if (!items.length) html += '<div style="height:100%;min-height:32px"></div>';
      html += '</div>';
    });
    html += '</div>';
    el('calGrid').innerHTML = html;
  });
}

function renderCalDay() {
  var d = new Date(); d.setDate(d.getDate() + calOffset); d.setHours(0, 0, 0, 0);
  var dk = lKey(d); // lKey — matches stored event date strings
  var wk = dKey(getMondayOfWeek(d)); // planner uses dKey
  loadPlannerForCalendar([wk], function() {
    var allItems = getCalItemsForDate(dk).concat(getMealsForDate(dk));
    var groups = { birthday: [], event: [], meal: [], personal: [] };
    allItems.forEach(function(item) {
      var g = ['birthday','event','meal'].indexOf(item.type) > -1 ? item.type : 'personal';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    });
    var sectionTitles = { birthday: '🎂 Birthdays', event: '📅 Events', meal: '🍽 Meals', personal: '📋 Schedule' };
    var html = '<div class="cal-day-view">';
    if (!allItems.length) {
      html += '<div class="cal-day-section"><div style="text-align:center;padding:28px;color:var(--muted)">Nothing on ☀️<br><span style="font-size:.82rem">Enjoy the quiet!</span></div></div>';
    } else {
      Object.keys(groups).forEach(function(g) {
        if (!groups[g].length) return;
        var t = CAL_TYPES[g] || CAL_TYPES.personal;
        html += '<div class="cal-day-section"><div class="cal-day-section-title" style="color:' + t.color + '">' + sectionTitles[g] + '</div>';
        groups[g].forEach(function(item) {
          html += '<div class="cal-day-item" style="background:' + t.bg + ';border-color:' + t.border + '">';
          html += '<div class="cal-day-item-icon">' + t.icon + '</div>';
          html += '<div style="flex:1"><div class="cal-day-item-text">' + esc(item.text) + '</div>';
          if (item.source) html += '<div class="cal-day-item-sub">' + esc(item.source) + '</div>';
          html += '</div>';
          if (item.id) {
            html += '<div style="display:flex;gap:6px;align-items:center">';
            html += '<button class="sm sx" style="font-size:.72rem;padding:4px 10px;border-radius:8px" data-caledit="' + item.id + '">Edit</button>';
            html += '<button style="background:none;border:none;font-size:1rem;cursor:pointer;padding:2px 6px" data-caldel="' + item.id + '">🗑</button>';
            html += '</div>';
          }
          html += '</div>';
        });
        html += '</div>';
      });
    }
    html += '</div>';
    el('calGrid').innerHTML = html;
  });
}

// ─── FIREBASE ──────────────────────────────────────────────────────────────
db.ref('calendarEvents').on('value', function(snap) {
  calEvents = []; snap.forEach(function(c) { calEvents.push(c.val()); });
  if (el('pg-c') && el('pg-c').classList.contains('on')) renderCalendar();
});

var editCalId = '';
function openCalEdit(id) {
  var ev = calEvents.find(function(x) { return x.id === id; }); if (!ev) return;
  editCalId = id;
  el('calAddName').value = ev.name || '';
  el('calAddDate').value = ev.date || '';
  el('calAddNotes').value = ev.notes || '';
  el('calTypeSelect').querySelectorAll('.cal-type-btn').forEach(function(b) {
    b.classList.toggle('on', b.dataset.caltype === (ev.type === 'birthday' ? 'birthday' : ev.type === 'personal' ? 'personal' : 'event'));
  });
  el('calBirthdayFields').style.display = ev.type === 'birthday' ? 'block' : 'none';
  el('calPersonalFields').style.display = ev.type === 'personal' ? 'block' : 'none';
  if (ev.type === 'birthday') {
    el('calBirthYear').value = ev.birthYear || '';
    el('calBirthdayRecurring').checked = ev.recurring !== false;
  }
  var savBtn = el('calAddSave'); if (savBtn) savBtn.dataset.editing = '1';
  var h3 = el('calAddMod').querySelector('h3'); if (h3) h3.textContent = 'Edit Event';
  el('calAddMod').classList.remove('h');
}

// ─── ALL LISTENERS ─────────────────────────────────────────────────────────

// ── Nav + view + day-tap (caledit/caldel handled by app.js global delegation) ──
document.addEventListener('click', function(e) {
  var t = e.target;

  if (t.id === 'calPrevNav') { calOffset--; renderCalendar(); return; }
  if (t.id === 'calNextNav') { calOffset++; renderCalendar(); return; }
  if (t.id === 'calTodayBtn') { calOffset = 0; renderCalendar(); return; }
  if (t.id === 'calLabelInner') { openMonthJump(); return; }



  var cv = t.closest('[data-calview]');
  if (cv && el('pg-c') && el('pg-c').classList.contains('on')) {
    calView = cv.dataset.calview;
    calOffset = 0;
    ['month','week','day'].forEach(function(v) { var b = el('cv-'+v); if (b) b.className = 'cal-type-btn'+(calView===v?' on':''); });
    renderCalendar(); return;
  }

  // Tap day in month → switch to day view for that date
  var caldk = t.closest('[data-caldk]');
  if (caldk && el('pg-c') && el('pg-c').classList.contains('on')) {
    calView = 'day';
    var clicked = new Date(caldk.dataset.caldk + 'T00:00:00');
    var today = new Date(); today.setHours(0, 0, 0, 0);
    calOffset = Math.round((clicked - today) / 86400000);
    ['month','week','day'].forEach(function(v) { var b = el('cv-'+v); if (b) b.className = 'cal-type-btn'+(calView===v?' on':''); });
    renderCalendar(); return;
  }
});

document.addEventListener('DOMContentLoaded', function() {

  var calAddName = el('calAddName');
  if (calAddName) calAddName.addEventListener('keydown', function(e) { if (e.key === 'Enter') { var s = el('calAddSave'); if (s) s.click(); } });

  var calAddBtn = el('calAddBtn');
  if (calAddBtn) calAddBtn.addEventListener('click', function() {
    if (!userName) { alert('Sign in first!'); return; }
    el('calAddName').value = '';
    // Pre-fill with the date currently being viewed in day view, or today
    if (calView === 'day') {
      var vd = new Date(); vd.setDate(vd.getDate() + calOffset);
      el('calAddDate').value = lKey(vd);
    } else {
      el('calAddDate').value = todayKey();
    }
    el('calAddNotes').value = '';
    el('calBirthdayFields').style.display = 'none';
    el('calPersonalFields').style.display = 'none';
    // Reset type select to Event
    el('calTypeSelect').querySelectorAll('.cal-type-btn').forEach(function(b) {
      b.classList.toggle('on', b.dataset.caltype === 'event');
    });
    var savBtn = el('calAddSave'); if (savBtn) savBtn.dataset.editing = '';
    var h3 = el('calAddMod').querySelector('h3'); if (h3) h3.textContent = 'Add to Calendar';
    editCalId = '';
    el('calAddMod').classList.remove('h');
  });

  var calAddCancel = el('calAddCancel');
  if (calAddCancel) calAddCancel.addEventListener('click', function() {
    el('calAddMod').classList.add('h');
    editCalId = '';
    var savBtn = el('calAddSave'); if (savBtn) savBtn.dataset.editing = '';
    var h3 = el('calAddMod').querySelector('h3'); if (h3) h3.textContent = 'Add to Calendar';
  });

  var calTypeSelect = el('calTypeSelect');
  if (calTypeSelect) calTypeSelect.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-caltype]'); if (!btn) return;
    calTypeSelect.querySelectorAll('.cal-type-btn').forEach(function(b) { b.classList.remove('on'); });
    btn.classList.add('on');
    var type = btn.dataset.caltype;
    el('calBirthdayFields').style.display = type === 'birthday' ? 'block' : 'none';
    el('calPersonalFields').style.display = type === 'personal' ? 'block' : 'none';
  });

  var calAddSave = el('calAddSave');
  if (calAddSave) calAddSave.addEventListener('click', function() {
    var name = el('calAddName').value.trim(); if (!name) { alert('Enter a name.'); return; }
    var date = el('calAddDate').value; if (!date) { alert('Select a date.'); return; }
    var typeBtn = el('calTypeSelect').querySelector('.cal-type-btn.on');
    var type = typeBtn ? typeBtn.dataset.caltype : 'event';
    var notes = el('calAddNotes').value.trim();
    // Edit existing
    if (calAddSave.dataset.editing === '1' && editCalId) {
      var updates = { name: name, date: date, notes: notes };
      if (type === 'birthday') {
        updates.birthYear = el('calBirthYear').value ? parseInt(el('calBirthYear').value) : null;
        updates.recurring = el('calBirthdayRecurring').checked;
      }
      db.ref('calendarEvents/' + editCalId).update(updates);
      el('calAddMod').classList.add('h');
      editCalId = ''; calAddSave.dataset.editing = '';
      var h3e = el('calAddMod').querySelector('h3'); if (h3e) h3e.textContent = 'Add to Calendar';
      return;
    }
    // Add new
    var id = 'ce' + Date.now();
    if (type === 'personal') {
      var ptype = el('calPersonalType').value;
      id = 'i' + Date.now();
      db.ref('personal/' + userName + '/days/' + date + '/items/' + id).set({ id: id, text: name, type: ptype });
    } else if (type === 'birthday') {
      var byear = el('calBirthYear').value;
      db.ref('calendarEvents/' + id).set({ id: id, name: name, date: date, type: 'birthday', birthYear: byear ? parseInt(byear) : null, recurring: el('calBirthdayRecurring').checked, notes: notes, by: userName });
    } else {
      db.ref('calendarEvents/' + id).set({ id: id, name: name, date: date, type: type, notes: notes, by: userName });
    }
    el('calAddMod').classList.add('h');
  });

});