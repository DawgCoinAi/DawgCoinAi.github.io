// The quest board on the Play screen: today's three, this week's three, the quest streak, and a
// toast when one lands. It owns the 'quests' save and calls the pure rules in quests.js.
import {dailyQuests,weeklyQuests,freshQuests,rollover,progress,applyRun,applyFeatNow,applySocial,validQuests,dayKey} from './quests.js';
// A readable name for a feat that arrived without one: 'kart.photo_finish' → 'Photo finish'.
const pretty=id=>{const t=String(id).split('.').pop().replace(/_/g,' ');return t.charAt(0).toUpperCase()+t.slice(1);};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export class QuestBoard {
 // io: {read, write, announce(text,label), earnRep(n), open() → game ids, info(id) → {title,best,par}, play(id)}
 constructor(host,io){this.host=host;this.io=io;this.names={};const saved=io.read('quests',null);this.state=rollover(validQuests(saved)?saved:freshQuests());
  host?.addEventListener?.('click',e=>{const b=e.target.closest?.('[data-quest-game]');if(b)this.io.play?.(b.dataset.questGame);});}
 quests(){return dailyQuests(dayKey(),this.io.open(),this.io.info);}
 commit({state,completed}){this.state=state;this.io.write('quests',state);let rep=0;for(const c of completed){rep+=c.reward;this.io.announce(c.all?c.text.toUpperCase():(c.feat?'FEAT · ':c.weekly?'WEEKLY QUEST · ':'QUEST · ')+(c.feat?this.names[c.feat]||pretty(c.feat):c.text),'+'+c.reward+' REP');}
  if(rep)this.io.earnRep(rep);this.render();return completed;}
 run(run){return this.commit(applyRun(this.state,run,this.quests()));}
 feat(id,name){if(name)this.names[id]=name;return this.commit(applyFeatNow(this.state,id,this.quests()));}
 social(){return this.commit(applySocial(this.state,this.quests()));}
 render(){const el=this.host;if(!el||!('innerHTML' in el))return;this.state=rollover(this.state);const p=progress(this.state,this.quests()),all=p.daily.every(q=>q.done);
  const row=q=>`<li class="quest${q.done?' done':''}"><span class="quest-check" aria-hidden="true">${q.done?'✓':''}</span><span class="quest-text">${esc(q.text)}${q.need>1?` <b>${q.have}/${q.need}</b>`:''}</span><span class="quest-reward">+${q.reward}</span>${q.game&&!q.done?`<button type="button" class="quest-go" data-quest-game="${esc(q.game)}" aria-label="Play ${esc(this.io.info(q.game).title)}">PLAY</button>`:''}<i class="quest-bar"><em style="transform:scaleX(${(q.have/q.need).toFixed(3)})"></em></i></li>`;
  el.hidden=false;el.innerHTML=`<header class="quest-head"><h2 class="section-title">Today’s quests</h2><span class="quest-streak" title="Days in a row with all three done">${this.state.streak?'🔥 '+this.state.streak+' DAY'+(this.state.streak===1?'':'S'):'FINISH ALL 3 TO START A STREAK'}</span></header>
<ul class="quest-list">${p.daily.map(row).join('')}</ul>${all?'<p class="quest-note">All done. New quests at midnight; your friends get the same ones.</p>':''}
<details class="quest-week"><summary>This week <b>${p.weekly.filter(q=>q.done).length}/3</b></summary><ul class="quest-list">${p.weekly.map(row).join('')}</ul></details>`;}
}
