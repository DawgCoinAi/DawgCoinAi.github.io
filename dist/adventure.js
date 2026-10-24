// A small point-and-click / text-parser adventure engine in the classic Sierra style: verbs on
// hotspots, a typed command line, an inventory, a wallet, a clock ticking toward sunrise, a
// score, multiple-choice conversations, comedy deaths with "try again", and several endings.
// The story itself lives in a content module (after-hours.js); this file knows no story.
import {seededRandom} from './mobile-core.js';

export const VERBS=['look','talk','take','use','give','buy','drink','eat','wear','open','push','go'];
// Words players type, mapped to the engine's verbs. Longer phrases are matched first.
const VERB_WORDS=[
 ['pick up','take'],['talk to','talk'],['speak to','talk'],['chat with','talk'],['look at','look'],['put on','wear'],['walk to','go'],['go to','go'],['taxi to','go'],['ride to','go'],['head to','go'],
 ['look','look'],['l','look'],['examine','look'],['x','look'],['inspect','look'],['check','look'],['read','look'],['view','look'],['search','look'],
 ['take','take'],['get','take'],['grab','take'],['steal','take'],['pocket','take'],
 ['talk','talk'],['speak','talk'],['chat','talk'],['ask','talk'],['flirt','talk'],['greet','talk'],['hi','talk'],['hello','talk'],
 ['use','use'],['apply','use'],['play','use'],['combine','use'],['put','use'],['insert','use'],['comb','use'],['call','use'],['climb','use'],['wake','use'],['ring','use'],
 ['give','give'],['hand','give'],['offer','give'],['show','give'],['buy','buy'],['purchase','buy'],['order','buy'],['pay','buy'],
 ['drink','drink'],['sip','drink'],['eat','eat'],['bite','eat'],['chew','eat'],['wear','wear'],['open','open'],['jump','push'],['toss','use'],['throw','use'],['push','push'],['press','push'],['pull','push'],['go','go'],['enter','go'],['leave','go'],['exit','go'],['walk','go'],['taxi','go']];
const FILLER=/\b(the|a|an|some|my|your|at|to|with|on|onto|into|in|from|please|quickly|it)\b/g;
// Dog things a DAWG might type. Every one gets a reply, wherever you are.
export const DOG_WORDS=['bark','howl','woof','sit','beg','roll over','play dead','wag','sniff','fetch','lick','dance','scratch','growl','whine','stay','shake','high five','chase tail','dig'];
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9$ ]+/g,' ').replace(/\s+/g,' ').trim();

// Parse a typed command into {verb, target, item, word}: "give whiskey to rufus", "use comb on mirror".
export function parse(text){const t=norm(text);if(!t)return null;
 if(['i','inv','inventory','items','pockets'].includes(t))return {verb:'inventory'};
 if(['score','points'].includes(t))return {verb:'score'};if(['time','clock','what time is it'].includes(t))return {verb:'time'};
 if(['hint','help','clue','what now','stuck'].includes(t))return {verb:'hint'};if(['look','l','look around','where am i'].includes(t))return {verb:'look'};
 if(['wallet','money','cash','$'].includes(t))return {verb:'wallet'};if(['map','taxi','cab','hail taxi','call taxi'].includes(t))return {verb:'taxi'};
 for(const w of DOG_WORDS)if(t===w||t.startsWith(w+' '))return {verb:'dog',word:w,target:t.slice(w.length).replace(FILLER,' ').trim()};
 const hit=VERB_WORDS.find(([w])=>t===w||t.startsWith(w+' '));if(!hit)return {verb:'unknown',raw:t};const [word,verb]=hit;let rest=t.slice(word.length).trim();
 // "use X on Y", "give X to Y", "put X in Y": the first noun is the item, the second the target.
 const two=rest.match(/^(.+?)\s+(?:on|to|with|in|into|onto|at)\s+(.+)$/);
 if(two&&['use','give'].includes(verb))return {verb,item:two[1].replace(FILLER,' ').trim(),target:two[2].replace(FILLER,' ').trim(),word};
 rest=rest.replace(FILLER,' ').replace(/\s+/g,' ').trim();if(word==='comb'&&!rest)return {verb:'use',item:'comb',target:'',word};return {verb,target:rest,word};}

const minutesToClock=m=>{const total=(22*60+m)%(24*60),h=Math.floor(total/60),mm=total%60;return `${(h+11)%12+1}:${String(mm).padStart(2,'0')} ${h<12?'AM':'PM'}`;};
export const clock=minutesToClock;

export class Adventure {
 constructor(content,saved=null,{seed=Date.now()}={}){this.c=content;this.state=saved&&validState(content,saved)?structuredClone(saved):this.fresh(seed);this.lines=[];}
 fresh(seed){const c=this.c;return {v:1,seed:seed>>>0,rolls:0,loc:c.start,inv:[...c.startItems],flags:{},money:c.startMoney,minute:0,score:0,awards:[],visited:[c.start],deaths:0,ending:null,dead:null,choice:null,log:[],checkpoint:null};}
 // ── State helpers used by the story's handlers ─────────────────────────────────────────────
 get location(){return this.c.locations[this.state.loc];}
 get over(){return !!(this.state.ending||this.state.dead);}
 rnd(){const r=seededRandom((this.state.seed+this.state.rolls*2654435761)>>>0)();this.state.rolls++;return r;}
 say(text,who=null){this.lines.push({text,who});}
 has(id){return this.state.inv.includes(id);}
 give(id,quiet=false){if(!this.has(id)){this.state.inv.push(id);if(!quiet)this.say(`You got: ${this.c.items[id].name}.`,'*');}}
 drop(id){this.state.inv=this.state.inv.filter(x=>x!==id);}
 flag(k,v){if(v===undefined)return this.state.flags[k];this.state.flags[k]=v;return v;}
 pay(n){if(this.state.money<n){this.say(`That's $${n}. Your wallet has $${this.state.money} and a strong sense of denial.`);return false;}this.state.money-=n;return true;}
 earn(n){this.state.money+=n;}
 award(id){const a=this.c.awards[id];if(!a||this.state.awards.includes(id))return;this.state.awards.push(id);this.state.score+=a.points;this.say(`+${a.points} points · ${a.label}`,'+');}
 time(n){this.state.minute+=n;}
 die(id){const d=this.c.deaths[id];this.state.dead=id;this.state.deaths++;this.say(d.text,'☠');}
 end(id){const e=this.c.endings[id];if(e.bonus)this.award('ending_'+id);this.state.ending=id;}
 go(loc,quiet=false){this.state.loc=loc;if(!this.state.visited.includes(loc))this.state.visited.push(loc);this.state.checkpoint=null;this.state.checkpoint=this.snapshot();if(!quiet)this.describe();}
 choose(id){this.state.choice=id;}
 snapshot(){const {checkpoint,log,...rest}=this.state;return structuredClone(rest);}
 describe(){const l=this.location;this.say(typeof l.description==='function'?l.description(this):l.description,'›');for(const h of this.hotspots())if(h.mention){const m=typeof h.mention==='function'?h.mention(this):h.mention;if(m)this.say(m);}}
 hotspots(){const l=this.location;return Object.entries(l.hotspots).map(([id,h])=>({id,...h})).filter(h=>!h.when||h.when(this));}
 items(){return this.state.inv.map(id=>({id,...this.c.items[id]}));}
 // Match a typed noun to a hotspot here or an item in your pockets.
 // Exact names beat whole words inside the noun, which beat partial words; on a tie, things in
 // your pockets win when preferItems is set ("drink whiskey"), otherwise things in the room do.
 find(noun,preferItems=false){const n=norm(noun);if(!n)return null;const words=x=>[x.name,...(x.aliases||[])].map(norm).filter(Boolean),pad=' '+n+' ';
  const score=x=>Math.max(0,...words(x).map(w=>w===n?1000:pad.includes(' '+w+' ')?w.length*2:n.length>=3&&w.includes(n)?n.length:0));
  let best=null;const consider=(kind,id,h,bias)=>{const v=score(h);if(v&&(!best||v+bias>best.v))best={kind,id,h,v:v+bias};};
  for(const h of this.hotspots())consider('hotspot',h.id,h,preferItems?0:.5);for(const it of this.items())consider('item',it.id,it,preferItems?.5:0);
  if(!best)return null;const {v,...hit}=best;return hit;}
 // ── Commands ──────────────────────────────────────────────────────────────────────────────
 command(text){this.lines=[];const p=parse(text);if(!p)return this.lines;this.say('> '+text,'>');this.run(p);return this.finish();}
 // Clicks from the scene: {verb, target (hotspot id), item (item id)}.
 act(verb,target=null,item=null){this.lines=[];this.run({verb,target,item,ids:true});return this.finish();}
 answer(option){this.lines=[];const id=this.state.choice;if(!id||this.over)return this.lines;this.state.choice=null;const d=this.c.dialogs[id];d.answer(this,option);this.time(this.c.costs.talk);return this.finish();}
 options(){const id=this.state.choice;if(!id)return null;const d=this.c.dialogs[id],o=d.ask(this);return {id,who:o.who,prompt:o.prompt,options:o.options.filter(x=>!x.when||x.when(this))};}
 finish(){const s=this.state;if(!this.over&&s.minute>=this.c.sunrise){this.say(this.c.sunriseText,'☀');this.end(this.c.sunriseEnding);}s.log=[...s.log,...this.lines].slice(-60);return this.lines;}
 run(p){const s=this.state;if(this.over){this.say(s.dead?'You are, regrettably, dead. Try again?':'The night is over. Start a new one?');return;}if(s.choice){this.say('Answer the question first. They are waiting, and so is the narrator.');return;}const c=this.c;
  switch(p.verb){
   case 'inventory':this.say(s.inv.length?'You are carrying: '+this.items().map(i=>i.name).join(', ')+`. And $${s.money}.`:'Your pockets contain lint and ambition.');return;
   case 'score':this.say(`Score: ${s.score} of ${c.maxScore}.`);return;
   case 'time':this.say(`It's ${clock(s.minute)}. Sunrise at 6:00 AM.`);return;
   case 'wallet':this.say(`$${s.money}. Enough for ${s.money>=5?'a taxi and a dream':'a dream'}.`);return;
   case 'hint':this.say(c.hint(this),'?');return;
   case 'taxi':this.say(c.taxiText(this));return;
   case 'dog':{const t=p.target&&this.find(p.target,true);if(t?.kind==='item'){this.run({verb:'use',target:p.target});return;}const h=t?.kind==='hotspot'&&t.h.dog;if(typeof h==='function'){h(this,p.word);this.time(c.costs.act);return;}this.say(c.dog(this,p.word));this.time(1);return;}
   case 'unknown':this.say(c.unknown(this,p.raw));return;}
  if(p.verb==='look'&&!p.target&&!p.item){this.describe();return;}
  if(p.verb==='go'){const dest=p.ids?p.target:c.placeFor(this,p.target);if(dest)this.travel(dest);else this.say(c.noPlace(this,p.target));return;}
  // Resolve the target and the item (clicks pass ids; typing passes words).
  let target,item;
  // Clicks on things in your pockets pass "item:<id>" as the target.
  if(p.ids){const pocket=String(p.target||'').startsWith('item:')?p.target.slice(5):null;target=pocket?(this.has(pocket)?{kind:'item',id:pocket,h:c.items[pocket]}:null):p.target&&this.location.hotspots[p.target]?{kind:'hotspot',id:p.target,h:this.location.hotspots[p.target]}:null;if(target&&target.h?.when&&!target.h.when(this))target=null;item=p.item&&this.has(p.item)?{kind:'item',id:p.item,h:c.items[p.item]}:null;}
  else{target=p.target?this.find(p.target,!['buy','talk','push','open'].includes(p.verb)):null;item=p.item?this.find(p.item,true):null;if(p.item&&!item){this.say(`You don't have "${p.item}". You check twice. Still no.`);return;}if(item&&item.kind!=='item'){this.say(`You'd have to be holding the ${item.h.name} first.`);return;}
   if(p.target&&!target){this.say(c.notHere(this,p.target));return;}
   // "use comb" with no target uses it on itself; "give whiskey" with one obvious person is fine too.
   if(['use','give'].includes(p.verb)&&!p.item&&target?.kind==='item'){item=target;target=null;}}
  if(!target&&!item){this.say(c.what(this,p.verb));return;}
  // Items in your pockets: look at, eat, drink, wear or use them on their own.
  if(target?.kind==='item'&&!item){const it=c.items[target.id],h=it[p.verb];if(p.verb==='look'){this.say(typeof it.look==='function'?it.look(this):it.look||it.description);return;}if(typeof h==='function'){h(this);this.time(c.costs.act);return;}this.say(c.cantDo(this,p.verb,it.name));return;}
  if(item&&!target){const it=c.items[item.id],h=it[p.verb]||it.use;if(typeof h==='function'){h(this);this.time(c.costs.act);return;}this.say(`Use the ${it.name} on what? Try "use ${it.name.toLowerCase()} on …".`);return;}
  const h=target.h,verb=p.verb,cost=verb==='talk'?c.costs.talk:c.costs.act;
  if(item){const table=(verb==='give'?h.give:h.use)||h.use||h.give,fn=table?.[item.id]||table?.['*'];if(fn){fn(this,item.id);this.time(cost);return;}this.say(c.noUse(this,c.items[item.id].name,h.name));this.time(1);return;}
  const fn=h[verb];if(typeof fn==='function'){fn(this,p.word);this.time(cost);return;}if(verb==='use'&&typeof h.use?.['*']==='function'){h.use['*'](this,null);this.time(cost);return;}if(typeof fn==='string'){this.say(fn);this.time(verb==='look'?1:cost);return;}
  this.say(c.cantDo(this,verb,h.name));}
 travel(dest){const c=this.c,s=this.state;if(dest===s.loc){this.say('You are already here. Impressive commitment.');return;}const route=c.route(this,dest);if(!route.ok){this.say(route.why);return;}if(route.fare&&!this.pay(route.fare))return;if(route.text)this.say(route.text);this.time(route.minutes);if(s.minute>=c.sunrise)return;this.go(dest);c.arrive?.(this,dest);}
 // Back to the moment you arrived at the current place (or the start), keeping the death count.
 retry(){const s=this.state,cp=s.checkpoint;if(!s.dead||!cp)return false;const deaths=s.deaths,log=s.log;this.state={...structuredClone(cp),deaths,log,checkpoint:structuredClone(cp)};this.lines=[];this.say('Let’s pretend that didn’t happen. The narrator certainly will.','↺');this.describe();return true;}
 save(){return structuredClone(this.state);}
 start(){this.lines=[];this.state.checkpoint=this.snapshot();this.say(this.c.intro,'›');this.describe();this.state.log=[...this.lines];return this.lines;}
}

const isStr=x=>typeof x==='string',int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
export function validState(c,s){try{
 if(!s||s.v!==1||!c.locations[s.loc]||!Array.isArray(s.inv)||!s.inv.every(i=>c.items[i])||new Set(s.inv).size!==s.inv.length)return false;
 if(!int(s.money,0,1e6)||!int(s.minute,0,c.sunrise+600)||!int(s.score,0,c.maxScore)||!int(s.seed,0,0xffffffff)||!int(s.rolls,0,1e7)||!int(s.deaths,0,1e5))return false;
 if(!Array.isArray(s.awards)||!s.awards.every(a=>c.awards[a])||s.awards.reduce((n,a)=>n+c.awards[a].points,0)!==s.score)return false;
 if(!Array.isArray(s.visited)||!s.visited.every(l=>c.locations[l]))return false;
 if(typeof s.flags!=='object'||Array.isArray(s.flags)||!Object.entries(s.flags).every(([k,v])=>c.flags.includes(k)&&['boolean','number'].includes(typeof v)))return false;
 if(s.ending!==null&&!c.endings[s.ending])return false;if(s.dead!==null&&!c.deaths[s.dead])return false;if(s.choice!==null&&!c.dialogs[s.choice])return false;
 if(!Array.isArray(s.log)||s.log.length>80||!s.log.every(l=>l&&isStr(l.text)&&l.text.length<1200))return false;
 if(s.checkpoint!==null&&(typeof s.checkpoint!=='object'||!validState(c,{...s.checkpoint,log:[],checkpoint:null})))return false;
 return true;}catch{return false;}}
