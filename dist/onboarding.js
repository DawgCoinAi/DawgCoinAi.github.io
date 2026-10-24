// First visit: meet (or reroll) your DAWG, pick a player name, pick a first game. Shown once,
// only to players with no runs yet; "Skip intro" ends it at any step.
import {makeKennel,makeDawg} from './dawg-career.js';
import {NAME_RULE} from './rankings.js';
import {gameById} from './games.js';
import {posterOf,BLURBS} from './shell.js';

const $=id=>document.getElementById(id);
export const ONBOARD_KEY='dawg-onboarded';
export const STARTERS=['runner','classic','flappy','daily'];
// Brand-new players only: never seen the intro and no run or record anywhere.
export function needsOnboarding(records,seen){return !seen&&!(records?.runs>0)&&!Object.entries(records||{}).some(([k,v])=>k!=='runs'&&v>0);}

export class Onboarding {
 constructor({kennel,openDialog,avatar,onName,onPick,onDawg}){Object.assign(this,{kennel,openDialog,avatar,onName,onPick,onDawg});this.dialog=$('onboardDialog');
  $('onboardReroll').onclick=()=>this.reroll();$('onboardKeep').onclick=()=>this.step(2);
  $('onboardNameForm').addEventListener('submit',async e=>{e.preventDefault();const name=$('onboardName').value.trim();if(!name){this.step(3);return;}
   if(!NAME_RULE.test(name)){$('onboardNameNote').textContent='Use 3–16 letters, numbers, spaces, _ . or -.';return;}$('onboardNameNote').textContent='';await this.onName?.(name);this.step(3);});
  $('onboardSkipName').onclick=()=>this.step(3);$('onboardSkip').onclick=()=>this.finish();
  this.dialog.addEventListener('cancel',()=>this.finish());
  $('onboardGames').replaceChildren(...STARTERS.map(id=>{const b=document.createElement('button');b.type='button';b.dataset.game=id;b.style.setProperty('--poster',`url(${posterOf(id)})`);const t=document.createElement('strong');t.textContent=gameById(id).title;const s=document.createElement('small');s.textContent=BLURBS[id].split('. ')[0]+'.';b.append(t,s);b.onclick=()=>{this.finish();this.onPick?.(id);};return b;}));}
 static seen(){try{return !!localStorage.getItem(ONBOARD_KEY);}catch{return true;}}
 start(){this.step(1);this.openDialog('onboardDialog');}
 step(n){for(const s of this.dialog.querySelectorAll?.('[data-step]')||[])s.hidden=Number(s.dataset.step)!==n;[...($('onboardSteps').children||[])].forEach((dot,i)=>dot.classList?.toggle('on',i<n));
  if(n===1)this.drawDawg();if(n===2)setTimeout(()=>$('onboardName').focus(),50);if(n===3)this.dialog.querySelector?.('#onboardGames button')?.focus();}
 drawDawg(){const d=this.kennel.active;this.avatar($('onboardDawg'),d);$('onboardDawgName').textContent=d?.name||'';}
 // A new player may roll a different starting DAWG; the first one is simply replaced.
 reroll(){try{this.kennel.state=makeKennel(makeDawg());this.kennel.save();this.kennel.render?.();this.onDawg?.();this.drawDawg();}catch{}}
 finish(){try{localStorage.setItem(ONBOARD_KEY,'1');}catch{}if(this.dialog.open)this.dialog.close();}
}
