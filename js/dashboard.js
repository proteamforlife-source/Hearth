// ─── DASHBOARD.JS ────────────────────────────────────────────────────────
function renderDashboard(){
  if(!el('pg-d')||!userName)return;
  el('dashContent').innerHTML='<div style="text-align:center;padding:30px;color:var(--muted)">Loading...</div>';
  var today=todayKey(),todayDates=getWeekDates(0),todayIdx=new Date().getDay()-1;if(todayIdx<0)todayIdx=6;
  db.ref('planner/'+dKey(todayDates[0])+'/'+todayIdx+'/D').once('value',function(snap){
    var dinners=[];snap.forEach(function(c){dinners.push(c.val());});
    var winner=null,maxV=0;dinners.forEach(function(m){var vc=m.votes?Object.keys(m.votes).length:0;if(vc>=maxV){maxV=vc;winner=m;}});
    db.ref('dinnerQ/'+today).once('value',function(dqSnap){
      var dqData=dqSnap.val()||{},myAnswer=dqData[userName]||null;
      var nextEv=null;var sorted=events.slice().sort(function(a,b){return(a.date||'9999')<(b.date||'9999')?-1:1;});for(var i=0;i<sorted.length;i++){if(sorted[i].date>=today){nextEv=sorted[i];break;}}
      var todayItems=[];if(personalData&&personalData.days&&personalData.days[today]&&personalData.days[today].items)todayItems=Object.values(personalData.days[today].items);
      var answersList=buildDinnerAnswers(dqData);
      var lastRead=personalData.lastRead||{};
      var now=new Date();now.setHours(0,0,0,0);
      var weekEnd=new Date(now);weekEnd.setDate(weekEnd.getDate()+7);
      var dueSoon=bills.filter(function(b){
        if(b.paid)return false;
        var d=new Date(b.due+'T00:00:00');
        return d>=now&&d<=weekEnd;
      }).sort(function(a,b){return a.due<b.due?-1:1;});
      db.ref('chatGroups').once('value',function(grpSnap){
        var myGroups=['family'];
        grpSnap.forEach(function(c){var g=c.val();if(g.members&&g.members[userName])myGroups.push(g.id);});
        Object.keys(members).forEach(function(n){if(n!==userName)myGroups.push([userName,n].sort().join('_'));});
        var allMsgs=[],pending=myGroups.length;
        if(!pending){buildDash([],answersList,todayItems,winner,dinners,nextEv,dqData,{},{},myAnswer,dueSoon);return;}
        myGroups.forEach(function(cid){
          db.ref('chats/'+cid).limitToLast(10).once('value',function(msgSnap){
            msgSnap.forEach(function(c){var m=c.val();m._cid=cid;allMsgs.push(m);});
            pending--;
            if(pending===0){
              allMsgs.sort(function(a,b){return b.ts-a.ts;});
              buildDash(allMsgs,answersList,todayItems,winner,dinners,nextEv,dqData,lastRead,myGroups,myAnswer,dueSoon);
            }
          });
        });
      });
    });
  });
}

function buildDash(allMsgs,answersList,todayItems,winner,dinners,nextEv,dqData,lastRead,myGroups,myAnswer,dueSoon){
  var todayFmt=new Date().toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  var todayIdx=new Date().getDay()-1;if(todayIdx<0)todayIdx=6;
  var wkKey=dKey(getWeekDates(0)[0]);

  var billsCard='';
  if(dueSoon.length){
    billsCard='<div class="dash-card" data-switchtab="b" style="cursor:pointer;border-left:3px solid #e65100">'+
      '<h3>💳 Bills Due This Week</h3>'+
      dueSoon.map(function(b){
        var daysLeft=daysUntil(b.due);
        var urgency=daysLeft===0
          ?'<span style="color:#c62828;font-weight:700;font-size:.72rem">TODAY</span>'
          :daysLeft===1
          ?'<span style="color:#e65100;font-weight:700;font-size:.72rem">TOMORROW</span>'
          :'<span style="color:var(--muted);font-size:.72rem">'+fmtDate(b.due)+'</span>';
        return'<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">'+
          '<div><div style="font-size:.85rem;font-weight:600">'+esc(b.name)+'</div>'+urgency+'</div>'+
          '<div style="font-size:.88rem;font-weight:700;color:var(--terra)">'+(b.amount?'$'+parseFloat(b.amount).toFixed(2):'')+'</div>'+
        '</div>';
      }).join('')+
      '<div style="font-size:.74rem;color:var(--muted);margin-top:8px;text-align:right">Tap to manage →</div>'+
    '</div>';
  }

  var dqButtons=
    '<div class="dq-btns">'+
      '<button class="dq-btn yes'+(myAnswer==='yes'?' on':'')+'" data-dqa="yes">Yes</button>'+
      '<button class="dq-btn'+(myAnswer==='no'?' on':'')+'" data-dqa="no">No</button>'+
    '</div>';

  el('dashContent').innerHTML=
    '<div style="font-size:.82rem;color:var(--muted);font-weight:600;margin-bottom:12px;text-align:center">'+todayFmt+'</div>'+
    '<div class="dinner-q"><h3>Are you home for dinner tonight?</h3>'+
      dqButtons+
      (answersList?'<div class="dq-answers" style="margin-top:8px">'+answersList+'</div>':'')+
    '</div>'+
    '<div class="dash-grid">'+

      (function(){
        var html='<div class="dash-card"><h3>🍽 Tonight</h3>';
        if(!dinners.length){
          html+='<div style="color:var(--muted);font-size:.84rem;margin-bottom:8px">Nothing planned yet</div>';
          html+='<button class="sm st" style="font-size:.75rem;padding:5px 12px" data-quickdinner="1">+ Suggest a meal</button>';
        } else {
          dinners.forEach(function(m){
            var vc=m.votes?Object.keys(m.votes).length:0;
            var myV=m.votes&&m.votes[userName];
            var isW=winner&&m.id===winner.id;
            html+='<div style="display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:9px;margin-bottom:5px;background:'+(isW?'#eaf3ea':'var(--cream)')+';border:1.5px solid '+(isW?'var(--sage)':'var(--border)')+'">'+
              '<div style="flex:1;font-size:.84rem;font-weight:'+(isW?'700':'500')+'">'+esc(m.name)+'</div>'+
              '<button class="vbtn'+(myV?' voted':'')+'" data-vote="'+m.id+'" data-wk="'+wkKey+'" data-di="'+todayIdx+'" data-slot="D" style="font-size:.72rem;padding:3px 8px">👍 '+vc+'</button>'+
              '<button class="cclaim'+(m.cooker?' claimed':'')+'" data-cook="'+m.id+'" data-wk="'+wkKey+'" data-di="'+todayIdx+'" data-slot="D" style="font-size:.72rem;padding:3px 8px">'+(m.cooker?'👨‍🍳 '+esc(m.cooker):'Cook?')+'</button>'+
            '</div>';
          });
          html+='<button class="sm sx" style="font-size:.74rem;padding:4px 10px;margin-top:4px;width:100%" data-quickdinner="1">+ Suggest something else</button>';
        }
        html+='</div>';
        return html;
      })()+

      '<div class="dash-card" data-switchtab="m"><h3>📋 My Schedule</h3>'+
        (todayItems.length?todayItems.map(function(item){return'<div class="dash-sched-item mp-'+item.type+'">'+esc(item.text)+'</div>';}).join(''):'<div style="color:var(--muted);font-size:.84rem">Nothing today</div>')+
      '</div>'+

      billsCard+

      '<div class="dash-card" data-switchtab="m" style="grid-column:1/-1"><h3>✅ To-Do</h3>'+
        (function(){
          var todos=personalData.todos?Object.values(personalData.todos).filter(function(t){return!t.done;}):[];
          return todos.length?
            todos.slice(0,4).map(function(t){return'<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)"><input type="checkbox" class="shopchk" data-todoid="'+t.id+'" style="flex-shrink:0"><span style="font-size:.85rem;flex:1">'+esc(t.text)+'</span></div>';}).join('')+
            (todos.length>4?'<div style="font-size:.76rem;color:var(--muted);margin-top:6px">+'+(todos.length-4)+' more</div>':''):
            '<div style="color:var(--muted);font-size:.84rem">No tasks — enjoy!</div>';
        })()+
      '</div>'+

      (function(){
        var unread=(allMsgs||[]).filter(function(m){return m.by!==userName&&m.ts>((lastRead&&lastRead[m._cid])||0);});
        var html='<div class="dash-card" data-switchchat="1"><h3>💬 Messages';
        if(unread.length)html+=' <span style="background:var(--re);color:#fff;border-radius:10px;padding:1px 7px;font-size:.7rem">'+unread.length+' new</span>';
        html+='</h3>';
        if(!unread.length){
          html+='<div style="color:var(--muted);font-size:.84rem">All caught up ✓</div>';
        } else {
          html+=unread.slice(0,4).map(function(m){
            var col=members[m.by]?members[m.by].color:'#8A7A6E';
            return'<div class="dash-msg">'+avt(m.by,col,20)+'<span class="dash-msg-txt">'+esc(m.by)+': '+(m.photo?'📷 Photo':esc(m.text))+'</span><span class="dash-msg-time">'+new Date(m.ts).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'})+'</span></div>';
          }).join('');
          if(unread.length>4)html+='<div style="font-size:.76rem;color:var(--muted);margin-top:4px">+'+(unread.length-4)+' more</div>';
        }
        html+='</div>';
        return html;
      })()+

      '<div class="dash-card" data-switchtab="e"><h3>📅 Next Event</h3>'+
        (nextEv?'<div style="font-weight:700;color:var(--terra);font-size:.9rem">'+esc(nextEv.name)+'</div><div style="font-size:.78rem;color:var(--muted);margin-top:3px">'+fmtDate(nextEv.date)+'</div>':'<div style="color:var(--muted);font-size:.84rem">No upcoming events</div>')+
      '</div>'+

    '</div>';
}


function buildDinnerAnswers(dqData){
  var home=[],out=[];
  Object.entries(dqData).forEach(function(e){
    if(e[1]==='yes')home.push(e[0]);
    else if(e[1]==='no')out.push(e[0]);
  });
  if(!home.length&&!out.length)return'';
  var html='<div class="dq-groups">';
  if(home.length){
    html+='<div class="dq-group dq-home">'+
      '<span class="dq-group-label">Home tonight ('+home.length+')</span>'+
      home.map(function(n){return'<span class="dq-name dq-name-home">✓ '+esc(n)+'</span>';}).join('')+
    '</div>';
  }
  if(out.length){
    var awayLine=out.length===1
      ?'Away: '+esc(out[0])
      :out.length+' away';
    html+='<div class="dq-away">'+awayLine+'</div>';
  }
  html+='</div>';
  return html;
}
function refreshDinnerQ(){
  var dqEl=document.querySelector('.dinner-q');
  if(!dqEl)return;
  db.ref('dinnerQ/'+todayKey()).once('value',function(snap){
    var dqData=snap.val()||{};
    var myAnswer=dqData[userName]||null;
    // update buttons
    var btnsEl=dqEl.querySelector('.dq-btns');
    if(btnsEl){
      btnsEl.innerHTML=
        '<button class="dq-btn yes'+(myAnswer==='yes'?' on':'')+'" data-dqa="yes">Yes</button>'+
        '<button class="dq-btn'+(myAnswer==='no'?' on':'')+'" data-dqa="no">No</button>';
    }
    // update answers
    var answersEl=dqEl.querySelector('.dq-answers');
    var answersHtml=buildDinnerAnswers(dqData);
    if(answersEl){answersEl.innerHTML=answersHtml;}
    else{
      var d=document.createElement('div');
      d.className='dq-answers';d.style.marginTop='10px';d.innerHTML=answersHtml;
      dqEl.appendChild(d);
    }
  });
}
function openChat(){el('chatPanel').classList.add('open');}