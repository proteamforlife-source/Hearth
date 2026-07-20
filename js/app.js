// ─── APP.JS — Init, tab routing, global event delegation ──────────────────
// Loaded LAST.

var tabs=['d','r','p','e','c','b','t','s','m'];
var pinBuffer='';
var pinCallback=null;
var cachedPin=null;
db.ref('settings/recipePin').on('value',function(snap){cachedPin=snap.val()?String(snap.val()):null;});
// ── RECIPE PROTECTION HELPERS ──
function attemptProtectedAction(recipeId,action){
  var rec=recipes.find(function(r){return r.id===recipeId;})||testRecipes.find(function(r){return r.id===recipeId;});
  if(!rec||!rec.locked||!cachedPin){action();return;}
  openPinModal(action);
}

function switchTab(id){
  tabs.forEach(function(t){el('pg-'+t).classList.remove('on');el('tb-'+t).classList.remove('on');});
  el('pg-'+id).classList.add('on');el('tb-'+id).classList.add('on');
  if(id==='p'){renderPlanner();setupPlannerListener();}
  if(id==='d')renderDashboard('switchTab');
  if(id==='c')renderCalendar();
  if(id==='m')renderMyPage();
  if(id==='b')renderBills();
}

function init(){
db.ref('members').on('value',function(snap){
      members={};snap.forEach(function(c){members[c.key]=c.val();});renderMemberList();if(userName)buildChatTabs();
    if(!userName){var sn=localStorage.getItem('fk_name'),sc=localStorage.getItem('fk_color')||'#B8967E';
    if(sn&&members[sn]){userName=sn;userColor=sc;el('authScreen').classList.add('h');el('userPill').innerHTML=avt(sn,sc,20)+'<span>'+esc(sn)+'</span>';loadPersonal();buildPresetTags();buildChatTabs();listenToConvo('family');db.ref('members/'+sn+'/lastSeen').set(Date.now());switchTab('d');setTimeout(function(){renderDashboard('members-timeout400');},400);}}
if(el('pg-d').classList.contains('on')&&userName)renderDashboard('members-inline');
  });
  db.ref('recipes').on('value',function(snap){recipes=[];testRecipes=[];snap.forEach(function(c){var v=c.val();if(v.testing)testRecipes.push(v);else recipes.push(v);});recipes.reverse();testRecipes.reverse();renderRecipes();buildCatFilter();buildTagFilter();renderTestRecipes();if(el('pg-d').classList.contains('on')&&userName)renderDashboard('recipes');});
  db.ref('events').on('value',function(snap){events=[];snap.forEach(function(c){events.push(c.val());});renderEvents();if(el('pg-d').classList.contains('on')&&userName)renderDashboard('events');});
  db.ref('shopping').on('value',function(snap){shopItems=[];snap.forEach(function(c){shopItems.push(c.val());});renderShopping();});
  db.ref('bills').on('value',function(snap){bills=[];snap.forEach(function(c){bills.push(c.val());});renderBills();if(el('pg-d').classList.contains('on')&&userName)renderDashboard('bills');});
  attachDinnerQListener();
  db.ref('planner/'+dKey(getWeekDates(0)[0])).on('value',function(){if(el('pg-d').classList.contains('on')&&userName)renderDashboard('planner-listener8');});
  setupPlannerListener();
  scheduleMidnightRollover();
}

var dinnerQRef=null;
function attachDinnerQListener(){
  if(dinnerQRef)dinnerQRef.off();
  dinnerQRef=db.ref('dinnerQ/'+todayKey());
  dinnerQRef.on('value',function(){if(el('pg-d').classList.contains('on')&&userName){if(document.querySelector('.dinner-q'))refreshDinnerQ();else renderDashboard('dinnerQ');}});
}

function scheduleMidnightRollover(){
  var now=new Date();
  var midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,0,0);
  var msUntilMidnight=midnight-now;
  setTimeout(function(){
    attachDinnerQListener();
    if(userName)renderDashboard('midnight');
    scheduleMidnightRollover();
  },msUntilMidnight);
}

document.addEventListener('DOMContentLoaded',function(){
  tabs.forEach(function(id){
    el('tb-'+id).addEventListener('click',function(){
      switchTab(id);
    });
  });

  el('imgModal').querySelector('button').addEventListener('click',function(){el('imgModal').classList.remove('on');});

  var editBillCancel=el('editBillCancel');
  if(editBillCancel)editBillCancel.addEventListener('click',function(){el('editBillMod').classList.add('h');editBillId='';});

  var editBillSave=el('editBillSave');
  if(editBillSave)editBillSave.addEventListener('click',function(){
    if(!editBillId)return;
    db.ref('bills/'+editBillId).update({
      name:el('ebName').value.trim(),
      amount:parseFloat(el('ebAmt').value)||0,
      freq:el('ebFreq').value,
      due:el('ebDue').value,
      cat:el('ebCat').value,
      notes:el('ebNotes').value.trim()
    });
    el('editBillMod').classList.add('h');
    editBillId='';
  });
});

// ── GLOBAL EVENT DELEGATION ──
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.dataset.dci){if(!userName){t.checked=!t.checked;return;}var eid=t.dataset.dev,did=t.dataset.dci,ev=events.find(function(x){return x.id===eid;});if(!ev)return;var dishes=ev.dishes?Object.values(ev.dishes):[],dish=dishes.find(function(d){return d.id===did;});if(!dish)return;if(dish.by&&dish.by!==userName){alert(dish.by+' is already bringing this!');t.checked=false;return;}dish.by=dish.by===userName?'':userName;db.ref('events/'+eid+'/dishes/'+did+'/by').set(dish.by);return;}
  if(t.dataset.shid){if(!userName)return;var item=shopItems.find(function(s){return s.id===t.dataset.shid;});if(!item)return;item.done=!item.done;item.by=item.done?userName:'';db.ref('shopping/'+t.dataset.shid).update({done:item.done,by:item.by});return;}
  if(t.dataset.todoid){if(!userName)return;db.ref('personal/'+userName+'/todos/'+t.dataset.todoid+'/done').set(t.checked);setTimeout(renderMyPage,300);return;}
  if(t.dataset.photor){var file=t.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(ev2){db.ref('recipes/'+t.dataset.photor+'/photo').set(ev2.target.result);};reader.readAsDataURL(file);return;}
});

document.addEventListener('click',function(e){
  var t=e.target;

  var vi=t.closest('[data-viewimg]');if(vi){el('imgModalImg').src=vi.dataset.viewimg;el('imgModal').classList.add('on');return;}
  var dqa=t.closest('[data-dqa]');if(dqa){if(!userName)return;db.ref('dinnerQ/'+todayKey()+'/'+userName).set(dqa.dataset.dqa,function(){refreshDinnerQ();});return;}
  var st2=t.closest('[data-switchtab]');if(st2&&!t.closest('[data-addmeal]')&&!t.closest('[data-quickdinner]')){switchTab(st2.dataset.switchtab);return;}
  var sc2=t.closest('[data-switchchat]');if(sc2){openChat();return;}
  var qd=t.closest('[data-quickdinner]');if(qd){var todayIdx2=new Date().getDay()-1;if(todayIdx2<0)todayIdx2=6;mealCtx={wk:dKey(getWeekDates(0)[0]),di:String(todayIdx2),slot:'D',recipeId:null,recipeType:null};el('mealModTitle').textContent='Suggest for Tonight';el('mealModInp').value='';el('mealModUrl').value='';el('mealSugList').innerHTML='';el('mealSugList').style.display='none';el('mealMod').classList.remove('h');return;}
  var uf=t.closest('[data-usefmt]');if(uf){try{var parsed=JSON.parse(uf.dataset.usefmt.replace(/&#39;/g,"'"));el('rName').value=parsed.name||'';el('rCat').value=parsed.category||'';el('rServings').value=parsed.servings||'';el('rIngs').value=(parsed.ingredients||[]).join(', ');el('rSteps').value=(parsed.steps||[]).join('\n');el('fmtResult').innerHTML='';el('fmtResult').classList.remove('on');el('fmtInput').value='';switchTab('r');window.scrollTo(0,0);alert('Recipe loaded!');}catch(err){}return;}
  var preset=t.closest('[data-preset]');if(preset&&preset.closest('#presetTags')){var pt=preset.dataset.preset,pi2=selectedPresetTags.indexOf(pt);if(pi2>-1)selectedPresetTags.splice(pi2,1);else selectedPresetTags.push(pt);buildPresetTags();return;}
  var catBtn=t.closest('[data-cat]');if(catBtn&&catBtn.closest('#catFilter')){activeCat=catBtn.dataset.cat;buildCatFilter();renderRecipes();return;}
  var tagBtn=t.closest('[data-tag]');if(tagBtn&&tagBtn.closest('#tagFilter')){activeTag=tagBtn.dataset.tag;buildTagFilter();renderRecipes();return;}
  var star=t.closest('.star[data-rid]');if(star){if(!userName)return;var srid=star.dataset.rid,sval=parseInt(star.dataset.star);db.ref('recipes/'+srid+'/ratings/'+userName).set({stars:sval,by:userName});star.closest('.stars').querySelectorAll('.star').forEach(function(s){s.classList.toggle('on',parseInt(s.dataset.star)<=sval);});var allRecs=recipes.concat(testRecipes),rec=allRecs.find(function(r){return r.id===srid;});if(rec){var rats=Object.assign({},rec.ratings||{});rats[userName]={stars:sval,by:userName};var vals=Object.values(rats).map(function(x){return x.stars;}),avg=vals.reduce(function(a,b){return a+b;},0)/vals.length,cnt=vals.length,avgEl=el('avgr-'+srid),cntEl=el('avgc-'+srid);if(avgEl)avgEl.querySelectorAll('.avg-star').forEach(function(s,i){s.classList.toggle('on',avg>=i+1);});if(cntEl)cntEl.textContent=avg.toFixed(1)+' ('+cnt+')';}return;}
  var togr=t.closest('[data-togr]');if(togr){var rb=el('rb-'+togr.dataset.togr);rb.classList.toggle('on');togr.textContent=rb.classList.contains('on')?'Hide':'View';return;}
  var togtr=t.closest('[data-togtr]');if(togtr){var trb=el('trb-'+togtr.dataset.togtr);trb.classList.toggle('on');togtr.textContent=trb.classList.contains('on')?'Hide':'View';return;}
  var togpr=t.closest('[data-togpr]');if(togpr){var prb=el('prb-'+togpr.dataset.togpr);prb.classList.toggle('on');togpr.textContent=prb.classList.contains('on')?'Hide':'View';return;}
  var cel=t.closest('[data-canceledit]');if(cel){el('ef-'+cel.dataset.canceledit).classList.remove('on');return;}

  // ── RECIPE EDIT ──
  var editr=t.closest('[data-editr]');
  if(editr){
    var erid=editr.dataset.editr;
    attemptProtectedAction(erid,function(){el('ef-'+erid).classList.add('on');});
    return;
  }

  // ── TESTING EDIT ──
  var editt=t.closest('[data-editt]');
  if(editt){
    var etid=editt.dataset.editt;
    attemptProtectedAction(etid,function(){el('tef-'+etid).classList.add('on');});
    return;
  }

  // ── RECIPE DELETE ──
  var delr=t.closest('[data-delr]');
  if(delr){
    if(userName!==ADMIN){alert('Only Mum can delete.');return;}
    var drid=delr.dataset.delr;
    attemptProtectedAction(drid,function(){
      if(!confirm('Remove this recipe?'))return;
      db.ref('recipes/'+drid).remove();
    });
    return;
  }

  // ── LOCK TOGGLE ──
  var lockr=t.closest('[data-lockr]');
  if(lockr){
    var lrid=lockr.dataset.lockr;
    var lrec=recipes.find(function(r){return r.id===lrid;})||testRecipes.find(function(r){return r.id===lrid;});
    if(!lrec)return;
    var nextLocked=!Boolean(lrec.locked);
    db.ref('recipes/'+lrid+'/locked').set(nextLocked);
    lrec.locked=nextLocked;
    return;
  }

var saver=t.closest('[data-saver]');if(saver){var rid2=saver.dataset.saver;attemptProtectedAction(rid2,function(){db.ref('recipes/'+rid2).update({name:el('en-'+rid2).value.trim(),cat:el('ec-'+rid2).value,tags:el('et-'+rid2).value.split(',').map(function(s){return s.trim().toLowerCase();}).filter(Boolean),servings:el('esv-'+rid2).value,diff:el('edf-'+rid2).value,ings:el('ei-'+rid2).value.split(',').map(function(s){return s.trim();}).filter(Boolean),steps:el('es-'+rid2).value.trim()});el('ef-'+rid2).classList.remove('on');});return;}  var cancelt=t.closest('[data-cancelt]');if(cancelt){el('tef-'+cancelt.dataset.cancelt).classList.remove('on');return;}
  var savet=t.closest('[data-savet]');if(savet){var tid=savet.dataset.savet;db.ref('recipes/'+tid).update({name:el('ten-'+tid).value.trim(),cat:el('tec-'+tid).value,tags:el('tet-'+tid)?el('tet-'+tid).value.split(',').map(function(s){return s.trim().toLowerCase();}).filter(Boolean):[],ings:el('tei-'+tid).value.split(',').map(function(s){return s.trim();}).filter(Boolean),steps:el('tes-'+tid).value.trim()});el('tef-'+tid).classList.remove('on');return;}
  var printr=t.closest('[data-printr]');if(printr){var pr2=recipes.find(function(r){return r.id===printr.dataset.printr;})||testRecipes.find(function(r){return r.id===printr.dataset.printr;});if(pr2)printRecipe(pr2);return;}
  var cookr=t.closest('[data-cookr]');if(cookr){var cr=recipes.find(function(r){return r.id===cookr.dataset.cookr;})||testRecipes.find(function(r){return r.id===cookr.dataset.cookr;});if(cr)startCook(cr);return;}
  var cookpr=t.closest('[data-cookpr]');if(cookpr){var myr2=personalData.myRecipes||{},pr3=myr2[cookpr.dataset.cookpr];if(pr3)startCook(pr3);return;}
  var addnote=t.closest('[data-addnote]');if(addnote){var nrid=addnote.dataset.addnote,ninp=el('ni-'+nrid);if(!ninp||!ninp.value.trim())return;var nid='n'+Date.now();db.ref('recipes/'+nrid+'/notes/'+nid).set({id:nid,text:ninp.value.trim(),by:userName||'Family',color:userColor});ninp.value='';return;}
  var addtnote=t.closest('[data-addtnote]');if(addtnote){var tnrid=addtnote.dataset.addtnote,tninp=el('tni-'+tnrid);if(!tninp||!tninp.value.trim())return;var tnid='n'+Date.now();db.ref('recipes/'+tnrid+'/notes/'+tnid).set({id:tnid,text:tninp.value.trim(),by:userName||'Family',color:userColor});tninp.value='';return;}
  var delnote=t.closest('[data-delnote]');if(delnote){db.ref('recipes/'+delnote.dataset.recid+'/notes/'+delnote.dataset.delnote).remove();return;}
  var approve=t.closest('[data-approve]');if(approve){if(userName!==ADMIN){alert('Only Mum can approve.');return;}db.ref('recipes/'+approve.dataset.approve+'/testing').set(false);alert('Recipe approved!');return;}
  var delev=t.closest('[data-delev]');if(delev){if(userName!==ADMIN){alert('Only Mum can delete.');return;}if(!confirm('Remove?'))return;db.ref('events/'+delev.dataset.delev).remove();return;}
  var deld=t.closest('[data-deld]');if(deld){db.ref('events/'+deld.dataset.dev+'/dishes/'+deld.dataset.deld).remove();return;}
  var dadd=t.closest('[data-dadd]');if(dadd){addDish(dadd.dataset.dadd);return;}
  var daci=t.closest('[data-recname]');if(daci){var evid2=daci.dataset.evid,inp2=el('dacinp-'+evid2);if(inp2)inp2.value=daci.dataset.recname;var dal=el('daclist-'+evid2);if(dal)dal.style.display='none';return;}
  var evinvite=t.closest('[data-evinvite]');if(evinvite){evInviteId=evinvite.dataset.evinvite;var ev2=events.find(function(x){return x.id===evInviteId;});el('evInviteTitle').textContent='Invite to '+(ev2?ev2.name:'Event');el('evInviteSelect').innerHTML=Object.keys(members).filter(function(n){return n!==userName;}).map(function(n){var m=members[n];return'<div class="mem-chip" data-invitemem="'+esc(n)+'">'+avt(n,m.color,18)+'<span>'+esc(n)+'</span></div>';}).join('');el('evInviteMod').classList.remove('h');return;}
  var invitemem=t.closest('[data-invitemem]');if(invitemem&&invitemem.closest('#evInviteSelect')){invitemem.classList.toggle('on');return;}

  // ── ADD TO PLANNER ──
  var addplan=t.closest('[data-addplan]');
  if(addplan){
    if(!userName){alert('Sign in first!');return;}
    var pname=addplan.dataset.planname||'';
    var today=new Date();
    var dayOpts='';
    for(var di=0;di<14;di++){
      var dd=new Date(today);
      dd.setDate(today.getDate()+di);
      var dk=dKey(dd);
      var dow=dd.getDay()-1;if(dow<0)dow=6;
      var wkk=dKey((function(d2){var m=new Date(d2);var dw=m.getDay()||7;m.setDate(m.getDate()-dw+1);return m;})(dd));
      dayOpts+='<option value="'+wkk+'|'+dow+'|'+dk+'"'+(di===0?' selected':'')+'>'+(di===0?'Today':di===1?'Tomorrow':dd.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}))+'</option>';
    }
    el('plannerModBox').innerHTML=
      '<h3 style="color:var(--terra);margin-bottom:11px">📅 Add to Planner</h3>'+
      '<div style="font-weight:700;font-size:.92rem;margin-bottom:9px">'+esc(pname)+'</div>'+
      '<select id="plannerModDay" style="width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:9px;font-size:.88rem;margin-bottom:9px;outline:none;font-family:inherit">'+dayOpts+'</select>'+
      '<select id="plannerModSlot" style="width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:9px;font-size:.88rem;margin-bottom:9px;outline:none;font-family:inherit">'+
        '<option value="D" selected>🍽 Dinner</option>'+
        '<option value="L">🥗 Lunch</option>'+
        '<option value="B">☀️ Breakfast</option>'+
        '<option value="S">🍎 Snack</option>'+
      '</select>'+
      '<input type="text" id="plannerModNotes" placeholder="Notes (optional)" style="width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:9px;font-size:.88rem;margin-bottom:12px;outline:none;font-family:inherit;box-sizing:border-box">'+
      '<div style="display:flex;gap:8px;justify-content:flex-end">'+
        '<button class="sm sx" id="plannerModCancel">Cancel</button>'+
        '<button class="btn" id="plannerModSave" style="padding:7px 18px">Add to Planner</button>'+
      '</div>';
    el('plannerMod').classList.remove('h');
    el('plannerModCancel').onclick=function(){el('plannerMod').classList.add('h');};
    el('plannerModSave').onclick=function(){
      var parts=el('plannerModDay').value.split('|');
      var wk2=parts[0],di2=parts[1],slot2=el('plannerModSlot').value;
      var notesVal=el('plannerModNotes').value.trim();
      var mid='m'+Date.now();
      var entry={id:mid,name:pname,votes:{},cooker:'',by:userName};
      if(notesVal)entry.notes=notesVal;
      db.ref('planner/'+wk2+'/'+di2+'/'+slot2+'/'+mid).set(entry);
      el('plannerMod').classList.add('h');
    };
    return;
  }

  var addmeal=t.closest('[data-addmeal]');if(addmeal){if(!userName){alert('Sign in first!');return;}var fromDetail=addmeal.dataset.fromdetail?true:false;mealCtx={wk:addmeal.dataset.wk,di:addmeal.dataset.di,slot:addmeal.dataset.slot,recipeId:null,recipeType:null,fromDetail:fromDetail,dk:addmeal.dataset.dk||''};el('mealModTitle').textContent='Suggest for '+DAYS[parseInt(addmeal.dataset.di)];el('mealModInp').value='';el('mealModUrl').value='';el('mealSugList').innerHTML='';el('mealSugList').style.display='none';if(fromDetail){el('dayDetailMod').classList.add('h');}el('mealMod').classList.remove('h');setTimeout(function(){el('mealModInp').focus();},80);return;}
  var mealrec=t.closest('[data-mealrec]');if(mealrec){el('mealModInp').value=mealrec.dataset.mealrec;if(mealrec.dataset.mealrecid){mealCtx.recipeId=mealrec.dataset.mealrecid;mealCtx.recipeType=mealrec.dataset.mealrectype||'recipe';}el('mealSugList').innerHTML='';el('mealSugList').style.display='none';return;}
  var vote=t.closest('[data-vote]');if(vote){if(!userName)return;var vref=db.ref('planner/'+vote.dataset.wk+'/'+vote.dataset.di+'/'+vote.dataset.slot+'/'+vote.dataset.vote+'/votes/'+userName);vref.once('value',function(s){if(s.val())vref.remove();else vref.set(true);setTimeout(function(){if(el('pg-d').classList.contains('on'))renderDashboard('vote');if(!el('dayDetailMod').classList.contains('h'))refreshDayDetail(parseInt(vote.dataset.di),vote.dataset.wk,'');},500);});return;}
  var cook=t.closest('[data-cook]');if(cook){if(!userName)return;var cref=db.ref('planner/'+cook.dataset.wk+'/'+cook.dataset.di+'/'+cook.dataset.slot+'/'+cook.dataset.cook+'/cooker');cref.once('value',function(s){cref.set(s.val()===userName?'':userName);setTimeout(function(){if(el('pg-d').classList.contains('on'))renderDashboard('cook');if(el('pg-p').classList.contains('on'))renderPlanner();if(!el('dayDetailMod').classList.contains('h'))refreshDayDetail(parseInt(cook.dataset.di),cook.dataset.wk,'');},400);});return;}
  var delmeal=t.closest('[data-delmeal]');if(delmeal){var dwk=delmeal.dataset.wk,ddi=parseInt(delmeal.dataset.di),dslot=delmeal.dataset.slot,dmid=delmeal.dataset.delmeal;db.ref('planner/'+dwk+'/'+ddi+'/'+dslot+'/'+dmid).remove(function(){if(!el('dayDetailMod').classList.contains('h')){refreshDayDetail(ddi,dwk,'');}});return;}
  // Week view day card tap — switch to day view for that day
  var weeknav=t.closest('[data-weeknav]');
  if(weeknav&&plannerView==='week'&&!t.closest('[data-addmeal]')&&!t.closest('[data-vote]')&&!t.closest('[data-cook]')&&!t.closest('[data-delmeal]')&&!t.closest('a')){
    var dk=weeknav.dataset.dk;
    if(dk){
      var picked=new Date(dk+'T00:00:00');
      var today=new Date();today.setHours(0,0,0,0);
      planDayOffset=Math.round((picked-today)/86400000);
      plannerView='day';
      ['day','week','month'].forEach(function(v){var b=el('pv-'+v);if(b)b.className='sm '+(plannerView===v?'st':'sx');});
      setupPlannerListener();renderPlanner();
    }
    return;
  }
  var clickday=t.closest('[data-dk]');if(clickday&&clickday.dataset.di!==undefined&&!t.closest('[data-addmeal]')&&!t.closest('[data-vote]')&&!t.closest('[data-cook]')&&!t.closest('[data-delmeal]')&&!t.closest('a')&&!t.closest('[data-plannerview]')){var cdi=parseInt(clickday.dataset.di),cwk=clickday.dataset.wk,cdk=clickday.dataset.dk;if(cwk)db.ref('planner/'+cwk+'/'+cdi).once('value',function(snap){openDayDetail(cdi,cwk,cdk,snap.val()||{},plannerView==='month');});return;}
  var convBtn=t.closest('[data-conv]');if(convBtn&&convBtn.closest('#chatTabs')){switchConvo(convBtn.dataset.conv,convBtn.dataset.cname,convBtn.dataset.gid||'');return;}
  var addmembers=t.closest('[data-addmembers]');if(addmembers){openAddMembers(addmembers.dataset.addmembers);return;}
  var gmem=t.closest('[data-gmem]');if(gmem&&gmem.closest('#groupMemSelect')){var gn=gmem.dataset.gmem,gi=groupSelectedMembers.indexOf(gn);if(gi>-1)groupSelectedMembers.splice(gi,1);else groupSelectedMembers.push(gn);buildGroupMemSelect();return;}
  var addmem=t.closest('[data-addmem]');if(addmem&&addmem.closest('#addMembersSelect')){var an=addmem.dataset.addmem,ai=addMembersSelected.indexOf(an);if(ai>-1)addMembersSelected.splice(ai,1);else addMembersSelected.push(an);buildAddMembersSelect();return;}
  var pickcolor=t.closest('[data-pickcolor]');if(pickcolor){var nc=pickcolor.dataset.pickcolor;userColor=nc;localStorage.setItem('fk_color',nc);db.ref('members/'+userName+'/color').set(nc);el('userPill').innerHTML=avt(userName,nc,20)+'<span>'+esc(userName)+'</span>';el('settingsMod').classList.add('h');el('settingsBtn').click();return;}
  var mypv=t.closest('[data-mypageview]');if(mypv){myPageView=mypv.dataset.mypageview;weekOffset=0;monthOffset=0;renderMyPage();return;}
  var deltodo=t.closest('[data-deltodo]');if(deltodo){db.ref('personal/'+userName+'/todos/'+deltodo.dataset.deltodo).remove();setTimeout(renderMyPage,300);return;}
  var dsh=t.closest('[data-dsh]');if(dsh){if(userName!==ADMIN)return;db.ref('shopping/'+dsh.dataset.dsh).remove();return;}
  var addd=t.closest('[data-addd]');if(addd){dayCtx={dk:addd.dataset.addd};el('dayModTitle').textContent='Add to '+addd.dataset.addd;el('dayModInp').value='';el('dayModType').value='B';el('dayMod').classList.remove('h');setTimeout(function(){el('dayModInp').focus();},80);return;}
  var dday=t.closest('[data-dday]');if(dday){db.ref('personal/'+userName+'/days/'+dday.dataset.dk+'/items/'+dday.dataset.dday).remove();return;}
  var addpr=t.closest('[data-addpr]');if(addpr){var pn=el('prName').value.trim();if(!pn){alert('Enter a name.');return;}var prec={id:'pr'+Date.now(),name:pn,cat:el('prCat').value||'General',tags:el('prTags').value.split(',').map(function(s){return s.trim().toLowerCase();}).filter(Boolean),by:userName||'Me',ings:el('prIngs').value.split(',').map(function(s){return s.trim();}).filter(Boolean),steps:el('prSteps').value.trim()};db.ref('personal/'+userName+'/myRecipes/'+prec.id).set(prec);['prName','prTags','prIngs','prSteps'].forEach(function(i){el(i).value='';});return;}
  var editpr=t.closest('[data-editpr]');if(editpr){el('pef-'+editpr.dataset.editpr).classList.add('on');return;}
  var cancelpr=t.closest('[data-cancelpr]');if(cancelpr){el('pef-'+cancelpr.dataset.cancelpr).classList.remove('on');return;}
  var savepr=t.closest('[data-savepr]');if(savepr){var pid=savepr.dataset.savepr;db.ref('personal/'+userName+'/myRecipes/'+pid).update({name:el('pen-'+pid).value.trim(),cat:el('pec-'+pid).value||'General',tags:el('pet-'+pid).value.split(',').map(function(s){return s.trim().toLowerCase();}).filter(Boolean),ings:el('pei-'+pid).value.split(',').map(function(s){return s.trim();}).filter(Boolean),steps:el('pes-'+pid).value.trim()});el('pef-'+pid).classList.remove('on');return;}
  var shrpr=t.closest('[data-shrpr]');if(shrpr){var myr3=personalData.myRecipes||{},sr=myr3[shrpr.dataset.shrpr];if(!sr)return;db.ref('recipes/'+sr.id).set(Object.assign({},sr,{by:userName,notes:{},ratings:{},testing:false}));alert('"'+sr.name+'" shared!');return;}
  var delpr=t.closest('[data-delpr]');if(delpr){if(!confirm('Remove?'))return;db.ref('personal/'+userName+'/myRecipes/'+delpr.dataset.delpr).remove();return;}
  var ptt=t.closest('[data-pushtotesting]');if(ptt){var mname=ptt.dataset.mname;if(!mname)return;var rec={id:'r'+Date.now(),name:mname,cat:'Other',ings:[],steps:'',by:userName||'Family',notes:{},ratings:{},photo:'',testing:true,tags:[]};db.ref('recipes/'+rec.id).set(rec);alert('"'+mname+'" added to Testing!');return;}
  var planview=t.closest('[data-plannerview]');if(planview){var pv=planview.dataset.plannerview;if(pv==='month'){plannerView='month';planMonthOffset=0;}else if(pv==='day'){// inherit from week view: jump to Monday of currently viewed week
    if(plannerView==='week'){planDayOffset=planWeekOffset*7;}else if(plannerView==='month'){planDayOffset=0;}// else already in day — keep planDayOffset as-is
    plannerView='day';}else{// switching to week: inherit from day view so week contains the viewed day
    if(plannerView==='day'){
      // find Monday of the target day, compare to Monday of current week
      var targetDay=new Date();targetDay.setDate(targetDay.getDate()+planDayOffset);targetDay.setHours(0,0,0,0);
      var tdow=targetDay.getDay()||7;var targetMon=new Date(targetDay);targetMon.setDate(targetDay.getDate()-tdow+1);
      var todayD=new Date();todayD.setHours(0,0,0,0);var tdow2=todayD.getDay()||7;var thisMon=new Date(todayD);thisMon.setDate(todayD.getDate()-tdow2+1);
      planWeekOffset=Math.round((targetMon-thisMon)/(7*86400000));
    }plannerView='week';}setupPlannerListener();renderPlanner();return;}
  var editbill=t.closest('[data-editbill]');if(editbill){openEditBill(editbill.dataset.editbill);return;}
  var paybill=t.closest('[data-paybill]');if(paybill){if(!userName)return;var bid=paybill.dataset.paybill,b=bills.find(function(x){return x.id===bid;});if(!b)return;var nextDue='';if(b.freq&&b.freq!=='once'){var d=new Date(b.due+'T00:00:00');if(b.freq==='weekly')d.setDate(d.getDate()+7);else if(b.freq==='fortnightly')d.setDate(d.getDate()+14);else if(b.freq==='monthly')d.setMonth(d.getMonth()+1);else if(b.freq==='quarterly')d.setMonth(d.getMonth()+3);else if(b.freq==='annual')d.setFullYear(d.getFullYear()+1);nextDue=lKey(d);}db.ref('bills/'+bid).update({paid:true,paidDate:todayKey(),paidBy:userName});billFilter='paid';if(nextDue){var alreadyExists=bills.some(function(x){return!x.paid&&x.name===b.name&&x.due===nextDue;});if(!alreadyExists){var newId='bi'+Date.now();db.ref('bills/'+newId).set(Object.assign({},b,{id:newId,paid:false,paidDate:'',paidBy:'',due:nextDue}));}}return;}
  var unpaybill=t.closest('[data-unpaybill]');if(unpaybill){var ubid=unpaybill.dataset.unpaybill,ub=bills.find(function(x){return x.id===ubid;});if(ub&&ub.freq&&ub.freq!=='once'){var ud=new Date(ub.due+'T00:00:00');if(ub.freq==='weekly')ud.setDate(ud.getDate()+7);else if(ub.freq==='fortnightly')ud.setDate(ud.getDate()+14);else if(ub.freq==='monthly')ud.setMonth(ud.getMonth()+1);else if(ub.freq==='quarterly')ud.setMonth(ud.getMonth()+3);else if(ub.freq==='annual')ud.setFullYear(ud.getFullYear()+1);var uNextDue=lKey(ud);var futureEntry=bills.find(function(x){return!x.paid&&x.name===ub.name&&x.due===uNextDue&&x.id!==ubid;});if(futureEntry){db.ref('bills/'+futureEntry.id).remove();}}db.ref('bills/'+ubid).update({paid:false,paidDate:'',paidBy:''});billFilter='all';return;}
  var caledit=t.closest('[data-caledit]');if(caledit){openCalEdit(caledit.dataset.caledit);return;}
  var caldel=t.closest('[data-caldel]');if(caldel){if(!confirm('Remove this?'))return;db.ref('calendarEvents/'+caldel.dataset.caldel).remove();setTimeout(renderCalendar,300);return;}
  var delbill=t.closest('[data-delbill]');if(delbill){if(userName!==ADMIN)return;if(!confirm('Remove this bill?'))return;db.ref('bills/'+delbill.dataset.delbill).remove();return;}

  // ── PIN KEYPAD ──
  var pk=t.closest('[data-pk]');
  if(pk&&pk.closest('#pinMod')){
    var key=pk.dataset.pk;
    if(key==='back'){pinBuffer=pinBuffer.slice(0,-1);}
    else if(key==='clear'){pinBuffer='';}
    else if(pinBuffer.length<4){pinBuffer+=key;}
    updatePinDots();
    if(pinBuffer.length===4){
if(cachedPin&&pinBuffer===cachedPin){var cb=pinCallback;closePinModal();if(cb)cb();}      else{el('pinErr').textContent='Incorrect PIN — try again';pinShake();pinBuffer='';updatePinDots();}
    }
    return;
  }
  if(t.closest('#pinCancel')){closePinModal();return;}
});

var editBillId='';

function openEditBill(bid){
  var b=bills.find(function(x){return x.id===bid;});
  if(!b)return;
  editBillId=bid;
  el('ebName').value=b.name||'';
  el('ebAmt').value=b.amount||'';
  el('ebFreq').value=b.freq||'monthly';
  el('ebDue').value=b.due||'';
  el('ebCat').value=b.cat||'other';
  el('ebNotes').value=b.notes||'';
  el('editBillMod').classList.remove('h');
}

function openPinModal(onSuccess){
  pinBuffer='';
  pinCallback=onSuccess;
  updatePinDots();
  el('pinErr').textContent='';
  el('pinPad').style.display='grid';
  el('pinSetupWrap').style.display='none';
  el('pinModTitle').textContent='🔒 Recipe Locked';
  el('pinModDesc').textContent='Enter your household PIN to continue';
  el('pinMod').classList.remove('h');
}

function updatePinDots(){
  for(var i=0;i<4;i++){
    var d=el('pd'+i);
    if(d)d.className='pin-dot2'+(i<pinBuffer.length?' filled':'');
  }
}

function closePinModal(){
  el('pinMod').classList.add('h');
  pinBuffer='';
  pinCallback=null;
  el('pinErr').textContent='';
}

function pinShake(){
  var box=el('pinModBox');
  box.classList.remove('pin-shake');
  void box.offsetWidth;
  box.classList.add('pin-shake');
  setTimeout(function(){box.classList.remove('pin-shake');},400);
}

init();
