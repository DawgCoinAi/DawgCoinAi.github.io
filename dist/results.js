// One results sheet for every game: score count-up, medals, personal-best burst, XP and level
// progress, the next unlock, where the run lands socially, and Rematch / Share / Challenge.
// It only renders; app.js decides what each button does.
import {gameById} from './games.js';
import {posterOf,fmt} from './shell.js';

const $=id=>document.getElementById(id);
const MEDALS=['BRONZE','SILVER','GOLD'];
// Medal state for a score against three targets: how many were reached and what's next.
export function medalState(score,targets){const t=(targets||[]).slice(0,3),earned=t.filter(x=>score>=x).length,next=t[earned];return {earned,label:earned?MEDALS[earned-1]+' MEDAL':'NO MEDAL YET',next,toNext:next?next-score:0,targets:t};}

export class ResultsSheet {
 constructor({openDialog,onRematch,onShare,onChallenge,onHome,onName,reduced=()=>false}){Object.assign(this,{openDialog,onRematch,onShare,onChallenge,onHome,onName,reduced});
  const dlg=$('resultsDialog');this.dialog=dlg;
  $('resultsRematch').onclick=()=>{const r=this.run;this.close();if(r)this.onRematch?.(r);};
  $('resultsShare').onclick=()=>this.run&&this.onShare?.(this.run);
  $('resultsChallenge').onclick=()=>this.run&&this.onChallenge?.(this.run);
  $('resultsHome').onclick=()=>{const r=this.run;this.close();if(r)this.onHome?.(r);};
  $('resultsName').addEventListener('submit',async e=>{e.preventDefault();const name=$('resultsNameInput').value.trim();if(!name)return;const ok=await this.onName?.(name);if(ok!==false)$('resultsName').hidden=true;});
 }
 get open(){return this.dialog.open;}
 close(){cancelAnimationFrame(this.raf);if(this.dialog.open)this.dialog.close();this.dialog.classList.remove('pb');}
 // run: {game, score, unit, best, targets, detail, xp, level:{level,pct,text}, unlock:{title,pct,left}|null, askName, canChallenge, again}
 show(run){this.run=run;const g=gameById(run.game),m=medalState(run.score,run.targets);
  $('resultsPoster').src=posterOf(run.game);$('resultsGame').textContent=(g?.title||run.game).toUpperCase();$('resultsTitle').textContent=run.title||(run.best?'New personal best!':m.earned===3?'Gold. Untouchable.':m.earned?m.label.toLowerCase().replace(/^./,c=>c.toUpperCase())+'!':'Run complete');
  $('resultsBest').hidden=!run.best;$('resultsUnit').textContent=run.unit||'POINTS';
  $('resultsMedals').replaceChildren(...m.targets.map((t,i)=>{const d=document.createElement('div');d.className='medal '+MEDALS[i].toLowerCase()+(i<m.earned?' earned':'');const b=document.createElement('b');b.textContent=['◆','✦','★'][i];const s=document.createElement('small');s.textContent=MEDALS[i]+' · '+fmt(t);d.append(b,s);return d;}));
  $('resultsDetail').textContent=[run.detail,m.next?fmt(m.toNext)+' to '+MEDALS[m.earned].toLowerCase():m.targets.length?'every medal earned':''].filter(Boolean).join(' · ');
  $('resultsXp').textContent='+'+fmt(run.xp||0);$('resultsLevelFill').style.setProperty('--p',(run.level?.pct||0)+'%');$('resultsLevel').textContent=run.level?.text||'';
  const u=run.unlock;$('resultsUnlock').hidden=!u;if(u){$('resultsUnlockTitle').textContent=u.title;$('resultsUnlockFill').style.setProperty('--p',u.pct+'%');$('resultsUnlockLeft').textContent=u.left;}
  $('resultsSocial').replaceChildren();$('resultsSocial').hidden=true;$('resultsName').hidden=!run.askName;$('resultsNameInput').value='';
  $('resultsChallenge').hidden=run.canChallenge===false;$('resultsRematch').textContent=run.again||'REMATCH ↻';
  this.dialog.classList.toggle('pb',!!run.best);this.burst(!!run.best);
  if(!this.dialog.open)this.openDialog('resultsDialog');this.countUp(run.score,run.format||fmt);}
 countUp(target,format){const el=$('resultsScore');cancelAnimationFrame(this.raf);if(this.reduced()||!(target>0)){el.textContent=format(target);return;}const start=performance.now(),dur=Math.min(1400,500+Math.log10(target+1)*220);
  const tick=now=>{const t=Math.min(1,(now-start)/dur),e=1-Math.pow(1-t,3);el.textContent=format(Math.round(target*e));if(t<1)this.raf=requestAnimationFrame(tick);};this.raf=requestAnimationFrame(tick);}
 // Confetti for a personal best; CSS does the motion.
 burst(on){this.dialog.querySelector('.confetti')?.remove();if(!on||this.reduced())return;const box=document.createElement('div');box.className='confetti';box.setAttribute('aria-hidden','true');
  const colors=['#b9ff5e','#ff5fc8','#5ee7ff','#ffd36b','#b48cff'];for(let i=0;i<28;i++){const s=document.createElement('i');s.style.setProperty('--x',(Math.random()*100).toFixed(1)+'%');s.style.setProperty('--d',(Math.random()*.6).toFixed(2)+'s');s.style.setProperty('--r',(Math.random()*720-360).toFixed(0)+'deg');s.style.background=colors[i%colors.length];box.append(s);}this.dialog.prepend(box);}
 // Social lines arrive after the run reaches the server.
 social(lines){if(!lines?.length||!this.dialog.open)return;const box=$('resultsSocial');box.replaceChildren(...lines.map(l=>{const p=document.createElement('div');p.className='social-line '+(l.dir||'');p.textContent=l.text;if(l.extra){const b=document.createElement('b');b.textContent=' '+l.extra;p.append(b);}return p;}));box.hidden=false;}
}
