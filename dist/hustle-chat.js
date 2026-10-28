// Street Hustle's talk, on the street: your contact and anyone who stops you stand in the scene
// with chat bubbles over their heads, the street wire arrives like a text, and what just
// happened shows as a caption. Buttons in the bubbles drive the same actions as the panels below.
import {GOODS,DISTRICTS} from './engine.js';

const $=id=>document.getElementById(id);
const CONTACTS=['Lou','Mags','Dex','Sunny','Bishop','Coco','Ziggy','Nash'];
const money=n=>(n<0?'−$':'$')+Math.abs(Math.round(n)).toLocaleString('en-US');
// Who you're dealing with tonight.
export function contactName(w){const c=w.contract;return CONTACTS[Math.abs((w.seed>>>0)+c.deadline*7+c.good*13+c.destination*31)%CONTACTS.length];}
export function encounterSpeaker(trade){const p=trade.world.pending;return !p?null:p.kind==='toll'?'Knuckles':p.kind==='stop'?'Officer Bramble':p.kind==='favor'?'Promoter Pip':contactName(trade.world);}
// Characters to stand on the street: always your contact; the crew boss or promoter when they stop you.
export function hustleCast(trade){if(!trade||trade.status==='over')return [];const cast=[{id:'contact',name:contactName(trade.world)}],who=encounterSpeaker(trade);if(who&&who!==cast[0].name)cast.push({id:'crew',name:who});return cast;}

export class HustleChat {
 constructor(){this.captionFor='';this.anchors=null;this.seen=null;this.newsFor='';
  // The wire is a phone: folded to its title bar on small screens until you open it.
  const narrow=(globalThis.window?.innerWidth||1024)<640;this.phone(!narrow);$('hustlePhoneToggle').onclick=()=>this.phone($('hustleWire').classList.contains('collapsed'));
  $('hustleCard').onclick=()=>{$('hustleCard').hidden=true;};
  $('hustleAsk').onclick=()=>$('streetWire').click();$('hustleDeliver').onclick=()=>$('deliverOrder').click();
  $('hustleCaption').onclick=()=>{$('hustleCaption').hidden=true;};}
 phone(open){$('hustleWire').classList.toggle('collapsed',!open);$('hustlePhoneToggle').setAttribute('aria-expanded',String(open));if(open)$('hustlePhoneDot').hidden=true;}
 // Job cards: a short title card when a drive lands or a contact order pays out (not on page load).
 jobCards(trade){const w=trade.world,d=w.lastDrive,c=w.contract,drive=d?d.day+'|'+d.result+'|'+d.cash:'',order=c.status==='done'?c.deadline+'|'+c.good+'|'+c.reward:'';
  if(!this.seen){this.seen={drive,order};return;}let card=null;
  if(order&&order!==this.seen.order)card=['JOB COMPLETE','PAID '+money(c.reward),`${contactName(w)} got the ${GOODS[c.good].name}. +12 rep, and the street knows you deliver.`];
  else if(drive&&drive!==this.seen.drive&&d.day===trade.day){const t={clean:['CLEAN RUN','Nobody looked twice on the way over.'],escaped:['SHOOK THE CRUISERS','Lost them in traffic. Heat cooled off.'],tailed:['STILL TAILED','A cruiser followed you in. Heat +6.'],busted:['PULLED OVER','A patrol DAWG wants a word.']}[d.result];
   card=['ARRIVED · '+DISTRICTS[trade.district].name.toUpperCase(),t[0],t[1]+(d.cash?` +${money(d.cash)} picked up on the road.`:'')+(d.nearMisses?` ${d.nearMisses} near miss${d.nearMisses===1?'':'es'}.`:'')];}
  this.seen={drive,order};if(!card)return;const el=$('hustleCard');$('hustleCardKicker').textContent=card[0];$('hustleCardTitle').textContent=card[1];$('hustleCardText').textContent=card[2];el.dataset.tone=card[0]==='JOB COMPLETE'?'paid':d?.result||'';el.hidden=false;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(this.cardTimer);this.cardTimer=setTimeout(()=>{el.hidden=true;},5200);this.cardTimer?.unref?.();}
 render(trade){const w=trade.world,c=w.contract,over=trade.status==='over',enc=trade.encounter(),who=contactName(w);
  $('hustleChat').hidden=over;if(over)return;this.jobCards(trade);
  $('hustlePhoneClock').textContent='NIGHT '+String(trade.day).padStart(2,'0')+' · '+DISTRICTS[trade.district].name.toUpperCase();if(w.news!==this.newsFor){if(this.newsFor&&$('hustleWire').classList.contains('collapsed'))$('hustlePhoneDot').hidden=false;this.newsFor=w.news;}
  // The wire: tonight's news, plus the tip if you asked.
  $('hustleNews').textContent=w.news;const tip=w.lastTalk===trade.day?trade.logs.find(l=>l.day===trade.day&&l.message.startsWith('Street wire:')):null;
  $('hustleTip').hidden=!tip;$('hustleTip').textContent=tip?tip.message.replace(/^Street wire:\s*/,''):'';$('hustleAsk').hidden=!!tip||trade.blocked;$('hustleAsk').disabled=$('streetWire').disabled;
  // Your contact's order, in their words.
  $('hustleContactName').textContent=who;const good=GOODS[c.good].name,dest=DISTRICTS[c.destination].name,have=trade.bag[c.good];
  $('hustleContactText').textContent=c.status==='done'?`Pleasure doing business. I'll have something new for you tomorrow night.`:c.status==='expired'?`You missed the drop. No hard feelings… new lead tomorrow.`:
   trade.district===c.destination?(have>=c.quantity?`You made it. ${c.quantity} ${good}, right? Hand it over: ${money(c.reward)} is yours.`:`I'm here in ${dest}. Still need ${c.quantity} ${good}; you've got ${have}.`):`Need ${c.quantity} ${good} in ${dest} by night ${c.deadline}. Pays ${money(c.reward)}. You've got ${have}.`;
  $('hustleDeliver').hidden=c.status!=='open'||trade.district!==c.destination;$('hustleDeliver').disabled=$('deliverOrder').disabled;
  $('hustleContact').hidden=!!enc&&encounterSpeaker(trade)===who;
  // Who stopped you: the encounter card itself becomes their bubble.
  $('tradeEncounter').dataset.speaker=enc?encounterSpeaker(trade):'';$('encounterWho').textContent=enc?encounterSpeaker(trade):'';
  // What just happened tonight, briefly.
  const last=trade.logs[0],key=last?last.day+'|'+last.message:'';if(key!==this.captionFor){this.captionFor=key;const show=last&&last.day===trade.day&&!last.message.startsWith('Street wire:');$('hustleCaption').hidden=!show;$('hustleCaption').textContent=show?last.message:'';clearTimeout(this.captionTimer);if(show){this.captionTimer=setTimeout(()=>{$('hustleCaption').hidden=true;},7000);this.captionTimer?.unref?.();}}
  this.place(this.anchors);}
 // Follows the characters around the screen (anchors from the 3D street, or fixed spots in 2D).
 place(anchors){this.anchors=anchors;const at=(id,fx,fy)=>anchors?.[id]||{x:fx,y:fy},put=(el,a,minTop=10)=>{const box=el.parentElement?.clientWidth,half=el.offsetWidth&&box?Math.min(48,el.offsetWidth/box*50+1.5):22,x=Math.max(half,Math.min(100-half,a.x)),below=a.y<minTop+22;el.classList.toggle('below',below);el.style.left=x.toFixed(1)+'%';el.style.top=(below?a.y+6:a.y-4).toFixed(1)+'%';el.style.setProperty?.('--tail',(a.x-x).toFixed(1)+'%');};
  if(!$('hustleContact').hidden)put($('hustleContact'),at('contact',26,46));
  // Whoever stopped you talks from a sheet along the bottom, its tail pointing up at them.
  const enc=$('tradeEncounter');if(!enc.hidden){const speaker=enc.dataset.speaker,slot=speaker&&speaker===$('hustleContactName').textContent?'contact':'crew',a=at(slot,58,44),x=Math.max(30,Math.min(70,a.x));enc.style.left=x.toFixed(1)+'%';enc.style.setProperty?.('--tail',(a.x-x).toFixed(1)+'%');$('hustleCaption').hidden=true;}}
}
