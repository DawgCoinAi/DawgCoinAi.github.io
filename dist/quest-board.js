// The quest board on the Play screen: today's three, this week's three, the quest streak, and a
// toast when one lands. It owns the 'quests' save and calls the pure rules in quests.js.
import {dailyQuests,weeklyQuests,freshQuests,rollover,progress,applyRun,applyFeatNow,applySocial,validQuests,dayKey,REWARD} from './quests.js';
// A readable name for a feat that arrived without one: 'kart.photo_finish' → 'Photo finish'.
const pretty=id=>{const t=String(id).split('.').pop().replace(/_/g,' ');return t.charAt(0).toUpperCase()+t.slice(1);};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export class QuestBoard {
 // io: {read, write, announce(text,label), earnRep(n), open() → game ids, info(id) → {title,best,par}, play(id)}
 constructor(host,io){this.host=host;this.io=io;this.names={};const saved=io.read('quests',null);this.state=rollover(validQuests(saved)?saved:freshQuests());
  this.recent=[];this.weekOpen=null;
  host?.addEventListener?.('click',e=>{const b=e.target.closest?.('[data-quest-game]');if(b)this.io.play?.(b.dataset.questGame);else if(e.target.closest?.('[data-quest-social]'))document.getElementById('friendsButton')?.click();});
  host?.addEventListener?.('toggle',e=>{if(e.target.classList?.contains('quest-week'))this.weekOpen=e.target.open;},true);}
 quests(){return dailyQuests(dayKey(),this.io.open(),this.io.info);}
 commit({state,completed}){this.state=state;this.recent=[...(this.recent||[]),...completed].slice(-12);this.io.write('quests',state);let rep=0;for(const c of completed){rep+=c.reward;this.io.announce(c.all?c.text.toUpperCase():(c.feat?'FEAT · ':c.weekly?'WEEKLY QUEST · ':'QUEST · ')+(c.feat?this.names[c.feat]||pretty(c.feat):c.text),'+'+c.reward+' REP');}
  if(rep)this.io.earnRep(rep);this.render();return completed;}
 run(run){return this.commit(applyRun(this.state,run,this.quests()));}
 feat(id,name){if(name)this.names[id]=name;return this.commit(applyFeatNow(this.state,id,this.quests()));}
 social(){return this.commit(applySocial(this.state,this.quests()));}
 // What the results card shows after a run: today's three with what just landed, then forgets it.
 summary(){const p=progress(rollover(this.state),this.quests()),just=new Set(this.recent.map(c=>c.id)),feats=this.recent.filter(c=>c.feat).map(c=>this.names[c.feat]||pretty(c.feat)),rep=this.recent.reduce((n,c)=>n+c.reward,0);this.recent=[];
  return {done:p.daily.filter(q=>q.done).length,total:p.daily.length,streak:this.state.streak,rep,feats,rows:p.daily.map(q=>({text:q.text,have:q.have,need:q.need,done:q.done,reward:q.reward,just:just.has(q.id)}))};}
 render(){const el=this.host;if(!el||!('innerHTML' in el))return;this.state=rollover(this.state);const p=progress(this.state,this.quests()),done=p.daily.filter(q=>q.done).length,all=done===p.daily.length,weekDone=p.weekly.filter(q=>q.done).length;
  const now=new Date(),left=Math.max(1,Math.ceil((new Date(now.getFullYear(),now.getMonth(),now.getDate()+1)-now)/36e5)),wide=globalThis.innerWidth>=900,open=this.weekOpen??wide;
  const row=q=>`<li class="quest${q.done?' done':''}" data-quest="${esc(q.id)}"><span class="quest-check" aria-hidden="true">${q.done?'✓':''}</span><span class="quest-text">${esc(q.text)}${q.need>1?` <b>${q.have}/${q.need}</b>`:''}</span><span class="quest-reward">+${q.reward}<small> REP</small></span>${q.game&&!q.done?`<button type="button" class="quest-go" data-quest-game="${esc(q.game)}" aria-label="Play ${esc(this.io.info(q.game).title)}">PLAY</button>`:q.id==='weekSocial'&&!q.done?'<button type="button" class="quest-go alt" data-quest-social aria-label="Go to Friends">FRIENDS</button>':''}<i class="quest-bar"><em style="transform:scaleX(${(q.have/q.need).toFixed(3)})"></em></i></li>`;
  el.hidden=false;el.innerHTML=`<div class="quest-col"><header class="quest-head"><h2 class="section-title">Today’s quests</h2><span class="quest-count" aria-label="${done} of ${p.daily.length} done"><b>${done}</b>/${p.daily.length}</span><span class="quest-streak" title="Days in a row with all three done">${this.state.streak?this.state.streak+'-DAY STREAK':'ALL 3 = +'+REWARD.allDaily+' REP'}</span></header>
<ul class="quest-list">${p.daily.map(row).join('')}</ul><p class="quest-note">${all?'All done. New quests at midnight; your friends get the same ones.':'New quests in '+left+' h. Your friends get the same three.'}</p></div>
<details class="quest-week"${open?' open':''}><summary><span class="section-title">This week</span><span class="quest-count"><b>${weekDone}</b>/3</span></summary><ul class="quest-list">${p.weekly.map(row).join('')}</ul></details>`;}
}
