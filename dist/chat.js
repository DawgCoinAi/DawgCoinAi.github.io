// DAWG Chat: one public room where players talk and share game moments (finishing moves,
// scores). The first half of this file is the pure core: the same checks the server runs in
// supabase/migrations/20261114000000_chat.sql (text, moment shape and size, posting pace), plus
// merging pages and formatting. The second half is the Chat view.
// Other players' messages are untrusted: everything is rendered as text, nothing is linked,
// and a moment only plays through its game's own viewer after that viewer accepts the recipe.
import {gameById} from './games.js';
import {posterOf,timeAgo} from './shell.js';
import {isMatchGame} from './matches.js';

export const EMOJI=['🔥','😂','👏','💀','🐶','💜'];
export const ROOM='lobby';
// gap, window and repeat are milliseconds; data is bytes of compact JSON.
export const LIMITS={body:240,title:60,text:120,data:1500,string:40,array:64,keys:32,gap:3000,burst:20,window:300000,repeat:120000,page:50};
const JUNK=/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g;
// Control and invisible direction characters become spaces; runs of spaces collapse.
export const cleanText=s=>String(s??'').replace(JUNK,' ').replace(/\s+/g,' ').trim();
// The word rules player names follow (name_ok in the SQL), applied to chat text.
const SWAP={0:'o',1:'i',3:'e',4:'a',5:'s',7:'t','@':'a',$:'s',_:' ','.':' ','-':' '};
const BAD=[/(fuck|nigg|bitch|whore|retard|hitler|nazi|pussy|cunt([^h]|$)|(?<![a-z0-9_])kys(?![a-z0-9_]))/,
 /(dick|cock|shit|slut|porn)(s|head|face|hole|bag|lord|wad|ty|y|z|er|ers)?(?![a-z0-9_])/,
 /(?<![a-z0-9_])(rape|raper|rapist|fag|fags|faggot)(?![a-z0-9_])/];
export function textOk(s){const t=String(s??'').toLowerCase().replace(/[013457@$_.-]/g,c=>SWAP[c]);return !BAD.some(r=>r.test(t));}

const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&[Object.prototype,null].includes(Object.getPrototypeOf(o));
const bytes=s=>new TextEncoder().encode(s).length;
// A moment's replay recipe: a flat object of short strings, finite numbers, booleans and short
// arrays of numbers, at most 1500 bytes as JSON. No nesting, no nulls, no markup.
export function validData(d){
 if(!plain(d))return false;const keys=Object.keys(d);if(keys.length>LIMITS.keys)return false;
 for(const k of keys){if(!/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(k))return false;const v=d[k];
  if(typeof v==='string'){if(v.length>LIMITS.string||/[<>]/.test(v)||v.replace(JUNK,'')!==v)return false;}
  else if(typeof v==='number'){if(!Number.isFinite(v))return false;}
  else if(Array.isArray(v)){if(v.length>LIMITS.array||!v.every(n=>typeof n==='number'&&Number.isFinite(n)))return false;}
  else if(typeof v!=='boolean')return false;}
 let json;try{json=JSON.stringify(d);}catch{return false;}return bytes(json)<=LIMITS.data;
}
// Returns a clean copy of a moment {kind, game, title, text, data}, or null if anything is off.
export function validMoment(m){
 if(!plain(m)||Object.keys(m).some(k=>!['kind','game','title','text','data'].includes(k)))return null;
 if(typeof m.kind!=='string'||!/^[a-z][a-z0-9_]{1,15}$/.test(m.kind))return null;
 if(typeof m.game!=='string'||!/^[a-z][a-z0-9_-]{1,15}$/.test(m.game))return null;
 if(typeof m.title!=='string'||(m.text!==undefined&&typeof m.text!=='string'))return null;
 const title=cleanText(m.title),text=cleanText(m.text??'');
 if(!title||title.length>LIMITS.title||text.length>LIMITS.text||/[<>]/.test(m.title+(m.text??'')))return null;
 if(!textOk(title+' '+text)||!validData(m.data))return null;
 return {kind:m.kind,game:m.game,title,text,data:JSON.parse(JSON.stringify(m.data))};
}
// Checks a post before it is sent: {ok, body, moment} or {ok:false, reason}.
export function checkPost(body,moment){
 if(typeof (body??'')!=='string')return {ok:false,reason:'empty'};const clean=cleanText(body);
 if(clean.length>LIMITS.body)return {ok:false,reason:'long'};
 let mom=null;if(moment!==null&&moment!==undefined){mom=validMoment(moment);if(!mom)return {ok:false,reason:'moment'};}
 if(!clean&&!mom)return {ok:false,reason:'empty'};
 if(!textOk(clean))return {ok:false,reason:'words'};
 return {ok:true,body:clean,moment:mom};
}
export const postKey=(body,moment)=>cleanText(body)+'\u0001'+(moment?JSON.stringify(moment):'');
// The server's pace rules, from this device's own send log [{at, key}]: one message every 3 s,
// 20 in 5 minutes, the same message again only after 2 minutes. wait is milliseconds.
export function rateHint(sent,now,key){
 const log=(sent||[]).filter(s=>now-s.at<LIMITS.window&&s.at<=now),last=log[log.length-1];
 if(last&&now-last.at<LIMITS.gap)return {ok:false,reason:'gap',wait:LIMITS.gap-(now-last.at)};
 if(log.length>=LIMITS.burst)return {ok:false,reason:'burst',wait:LIMITS.window-(now-log[log.length-LIMITS.burst].at)};
 const twin=key===undefined?null:[...log].reverse().find(s=>s.key===key&&now-s.at<LIMITS.repeat);
 if(twin)return {ok:false,reason:'repeat',wait:LIMITS.repeat-(now-twin.at)};
 return {ok:true,reason:'',wait:0};
}
const WHY={gap:'One message every 3 seconds.',burst:'That’s 20 messages in 5 minutes. Take a breather.',repeat:'You just said that. Give it a couple of minutes.',
 empty:'Type a message first.',long:'Messages are 240 characters at most.',words:'That message isn’t allowed in DAWG Chat. Keep it friendly.',moment:'That moment couldn’t be shared.'};
export const reasonText=reason=>WHY[reason]||'';
// Server refusals in plain words.
export function errorHint(message){const m=String(message||'');const muted=m.match(/muted for (\d+) more minutes?/);
 return muted?`You’re muted in chat for ${muted[1]} more minute${muted[1]==='1'?'':'s'}.`
  :/slow down/.test(m)?WHY.gap:/too many messages/.test(m)?WHY.burst:/duplicate message/.test(m)?WHY.repeat
  :/message not allowed/.test(m)?WHY.words:/message too long/.test(m)?WHY.long:/empty message/.test(m)?WHY.empty:/bad moment/.test(m)?WHY.moment
  :/public boards/.test(m)?'Turn on “Show me on public boards” in Me to post. You can still read along.'
  :/no such message/.test(m)?'That message is gone.':/your own message/.test(m)?'That’s your own message.':/not your message/.test(m)?'You can only delete your own messages.'
  :/too many reports/.test(m)?'That’s a lot of reports for one day. Thanks; we’ll take it from here.':/only the arcade owner/.test(m)?'Only the arcade owner can do that.'
  :/no player/.test(m)?'No player has that code.':/sign in first|cloud connection|Failed to fetch|NetworkError/i.test(m)?'Chat needs the cloud connection. Try again in a moment.'
  :'Chat hiccup. Try again in a moment.';}
// True when the chat functions aren't on the server yet (the migration hasn't been run).
export const isMissing=e=>!!e&&(e.status===404||e.code==='PGRST202'||e.code==='42883'||/Could not find the function|does not exist/i.test(e.message||''));

// One row from chat_recent, checked and trimmed; null if it isn't a message.
export function normalizeRow(r){
 if(!r||typeof r!=='object')return null;const id=Number(r.id),at=new Date(r.created_at).getTime();
 if(!Number.isSafeInteger(id)||id<=0||!Number.isFinite(at))return null;
 const body=typeof r.body==='string'?cleanText(r.body).slice(0,LIMITS.body):'',moment=r.moment?validMoment(r.moment):null;
 if(!body&&!moment)return null;
 const reactions={};if(plain(r.reactions))for(const e of EMOJI){const n=Number(r.reactions[e]);if(Number.isSafeInteger(n)&&n>0)reactions[e]=n;}
 const code=typeof r.friend_code==='string'&&/^[A-F0-9]{8}$/.test(r.friend_code)?r.friend_code:'',level=Math.floor(Number(r.level));
 return {id,at,body,moment,player:cleanText(r.player).slice(0,24)||'Guest',code,avatar:plain(r.avatar)?r.avatar:null,
  level:level>=1&&level<=99?level:1,mine:r.mine===true,reactions,my:EMOJI.includes(r.my_reaction)?r.my_reaction:null};
}
// Merges a page into the list, oldest first, one entry per id (the page's copy wins). With
// head:true the page is the newest window of the room, so messages inside that window that
// didn't come back (deleted, reported away) are dropped. Messages still being sent stay last.
export function mergeMessages(have,page,{head=false,limit=LIMITS.page}={}){
 const by=new Map(),sending=(have||[]).filter(m=>m.pending);let floor=Infinity;
 if(head)floor=page.length<limit?-Infinity:Math.min(...page.map(m=>m.id));
 for(const m of have||[])if(!m.pending&&m.id<floor)by.set(m.id,m);
 for(const m of page)by.set(m.id,m);
 return [...[...by.values()].sort((a,b)=>a.id-b.id),...sending];
}
const dayKey=at=>{const d=new Date(at);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();};
export function dayLabel(at,now=Date.now()){const d=new Date(at),t=new Date(now),start=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime(),days=Math.round((start(t)-start(d))/86400000);
 return days<=0?'Today':days===1?'Yesterday':d.toLocaleDateString('en-US',{month:'short',day:'numeric'});}
// Layout flags per message: first = starts a group (shows the author), day = a new day starts here.
export function groupFlags(list,now=Date.now()){
 return list.map((m,i)=>{const p=list[i-1],newDay=!p||dayKey(p.at)!==dayKey(m.at);
  const first=newDay||p.mine!==m.mine||p.code!==m.code||p.player!==m.player||m.at-p.at>300000||!!p.moment||!!m.moment;
  return {first,day:newDay?dayLabel(m.at,now):null};});
}
export const timeLabel=(at,now=Date.now())=>timeAgo(at,now);
// How many messages from other players arrived after the last one this player has seen.
export const unreadCount=(list,seenId)=>list.filter(m=>!m.mine&&!m.pending&&m.id>(seenId||0)).length;
const fmt=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString('en-US');
const MEDAL=['','bronze medal','silver medal','gold medal'];
// The built-in moment: a finished run. data: {v:1, score, medal 0–3, best}.
export function validScore(d){return validData(d)&&d.v===1&&Number.isSafeInteger(d.score)&&d.score>=0&&[0,1,2,3].includes(d.medal??0)&&typeof (d.best??false)==='boolean';}
export function scoreMoment(game,score,{medal=0,best=false,detail=''}={}){
 const title=gameById(game)?.title||game,n=Math.max(0,Math.floor(Number(score)||0));
 return {kind:'score',game,title:`${game==='trade'?'$':''}${fmt(n)} in ${title}`.slice(0,LIMITS.title),
  text:[best?'new personal best':'',MEDAL[medal]||'',cleanText(detail).replace(/[<>]/g,'')].filter(Boolean).join(' · ').slice(0,LIMITS.text),data:{v:1,score:n,medal:[1,2,3].includes(medal)?medal:0,best:!!best}};
}
// Where a game's moment viewer lives (see CHAT-CONTRACT: dist/<game>-replay.js).
export const replayPath=game=>typeof game==='string'&&/^[a-z][a-z0-9_-]{1,15}$/.test(game)?`./${game}-replay.js`:null;

// ── The Chat view ─────────────────────────────────────────────────────────────────────────
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const btn=(label,cls,on)=>{const b=el('button',cls,label);b.type='button';if(on)b.onclick=on;return b;};
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,String(v));}catch{}}};
const SEEN='dawg-chat-seen',KIND='dawg-chat-kind';

export class Chat {
 // rankings supplies the cloud client, the player's profile, player cards and challenges.
 constructor({cloud,rankings,shell,announce,confirm,play,lastRun,medal}){Object.assign(this,{cloud,rankings,shell,announce,confirm,play,lastRun,medal});
  this.state='idle';this.list=[];this.rows=new Map();this.sent=[];this.more=true;this.loadingOlder=false;this.fresh=0;this.replays=new Map();this.probes=0;this.playing=null;this.mock=null;this.replayLoader=null;this.tempId=Number.MAX_SAFE_INTEGER-100000;
  this.box=$('chatList');if(!this.box)return;
  $('chatNav').hidden=false;
  this.wire();
  const prev=shell.onView;shell.onView=v=>{prev?.(v);this.openView(v);};
  // The cloud connects a moment after the page loads; chat wakes up when it does.
  this.waiter=setInterval(()=>{if(this.reach){clearInterval(this.waiter);this.wake();}},1500);this.waiter.unref?.();
  for(const t of [globalThis,globalThis.visualViewport])t?.addEventListener?.('resize',()=>{const stick=this.atBottom();this.fit();if(stick)this.box.scrollTop=this.box.scrollHeight;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stopMoment();else if(this.viewing)this.refresh();});
  let debug='';try{debug=new URLSearchParams(location.search).get('debug')||'';}catch{}
  if(debug.split(',').includes('chat')){globalThis.__dawgChat=this;import('./chat-debug.js').then(m=>m.install(this)).catch(()=>{});}
  if(shell.view==='chat')this.openView('chat');
 }
 get api(){return this.cloud?.client&&this.cloud?.user?this.cloud.client:null;}
 get reach(){return !!(this.mock||this.api);}
 get viewing(){return this.shell.view==='chat';}
 get hiddenFromBoards(){return this.rankings?.profile?.public===false;}
 get myName(){const p=this.rankings?.profile;return p?.name||(p?.code?'Guest '+p.code:'You');}
 async rpc(name,args){
  if(this.mock)return this.mock(name,args);const api=this.api;if(!api)throw new Error('cloud connection');
  const {data,error,status}=await api.rpc(name,args);
  if(error){const e=new Error(error.message||'');e.status=status;e.code=error.code;throw e;}return data;
 }
 wire(){
  const input=$('chatInput'),form=$('chatForm');
  $('chatQuick').replaceChildren(...EMOJI.map(e=>{const b=btn(e,'chat-emoji',()=>{const at=input.selectionStart??input.value.length;input.value=(input.value.slice(0,at)+e+input.value.slice(input.selectionEnd??at)).slice(0,LIMITS.body);input.focus();this.count();});b.setAttribute('aria-label','Add '+e);return b;}));
  input.addEventListener('input',()=>this.count());
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();this.send();}});
  form.addEventListener('submit',e=>{e.preventDefault();this.send();});
  $('chatNew').onclick=()=>this.toBottom(true);
  this.box.addEventListener('scroll',()=>this.onScroll(),{passive:true});
  this.box.addEventListener('click',e=>this.onClick(e));
  this.box.addEventListener('contextmenu',e=>{const row=e.target.closest('.chat-msg');if(row){e.preventDefault();this.openMenu(row);}});
  // Long-press opens the message menu on touch screens.
  this.box.addEventListener('pointerdown',e=>{const row=e.target.closest('.chat-msg');clearTimeout(this.press);if(!row||e.pointerType==='mouse'||e.target.closest('button'))return;const x=e.clientX,y=e.clientY;this.pressAt={x,y};this.press=setTimeout(()=>this.openMenu(row),520);});
  for(const type of ['pointerup','pointercancel','pointerleave'])this.box.addEventListener(type,()=>clearTimeout(this.press));
  this.box.addEventListener('pointermove',e=>{if(this.pressAt&&Math.hypot(e.clientX-this.pressAt.x,e.clientY-this.pressAt.y)>10)clearTimeout(this.press);});
  document.addEventListener('pointerdown',e=>{if(this.menu&&!this.menu.contains(e.target)&&!e.target.closest('.chat-more'))this.closeMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.menu)this.closeMenu();});
  // A finished run can go to chat from the results card.
  const b=$('resultsChat');b.onclick=()=>this.postRun(b);$('resultsDialog').addEventListener('close',()=>{b.disabled=false;b.textContent='POST TO CHAT';});
  this.count();
 }
 // ── Loading and polling ─────────────────────────────────────────────────────────────────
 wake(){this.peek();clearInterval(this.idle);this.idle=setInterval(()=>{if(!document.hidden&&!this.viewing&&this.state!=='soon')this.peek();},90000);if(this.viewing)this.openView('chat');}
 openView(view){
  clearInterval(this.poll);clearTimeout(this.offline);
  if(view!=='chat'){this.stopMoment();this.closeMenu();return;}
  this.notices();this.fit();
  if(!this.reach){this.setState('connecting');this.offline=setTimeout(()=>{if(!this.reach&&this.viewing)this.setState('offline');},7000);return;}
  if(this.state!=='ready'&&this.state!=='soon')this.setState('loading');
  this.refresh().then(()=>{if(this.viewing&&this.state==='ready')this.toBottom(false);});
  // Every 5 seconds while the tab is open and visible; every 5 minutes while chat isn't switched on yet.
  this.poll=setInterval(()=>{if(document.hidden||!this.viewing||!this.reach||(this.state==='soon'&&Date.now()-this.soonAt<300000))return;this.refresh();},5000);
 }
 // The newest window of the room. Also the check for whether chat is switched on yet.
 async refresh(){
  if(this.busy||!this.reach)return;this.busy=true;
  try{const rows=await this.rpc('chat_recent',{p_room:ROOM,p_before:null,p_limit:LIMITS.page});
   const page=(rows||[]).map(normalizeRow).filter(Boolean),had=new Set(this.list.map(m=>m.id)),first=this.state!=='ready';
   const stick=first||this.atBottom();this.list=mergeMessages(this.list,page,{head:true});if(first&&page.length<LIMITS.page)this.more=false;
   const added=this.list.filter(m=>!m.pending&&!had.has(m.id)&&!m.mine).length;
   this.setState('ready');this.render();
   if(stick){if(first||this.box.scrollHeight-this.box.scrollTop-this.box.clientHeight>1)this.toBottom(!first);}else if(added){this.fresh+=added;this.pill();}
   this.markSeen();
  }catch(error){if(isMissing(error))this.setState('soon');else if(this.state!=='ready')this.setState('error',errorHint(error.message));}
  finally{this.busy=false;}
 }
 // A light check while the player is elsewhere in the arcade: is there anything new?
 async peek(){if(!this.reach||this.viewing)return;
  try{const rows=await this.rpc('chat_recent',{p_room:ROOM,p_before:null,p_limit:1});const m=(rows||[]).map(normalizeRow).filter(Boolean)[0];
   if(this.state==='idle'||this.state==='soon')this.state='known';this.installed=true;this.runButton();
   this.dot(!!m&&!m.mine&&m.id>(Number(store.get(SEEN))||0));
  }catch(error){if(isMissing(error)){this.state='soon';this.installed=false;this.runButton();}}}
 async older(){
  if(this.loadingOlder||!this.more||this.state!=='ready'||!this.list.length)return;const oldest=this.list.find(m=>!m.pending);if(!oldest)return;
  this.loadingOlder=true;this.box.classList.add('loading-older');
  try{const rows=await this.rpc('chat_recent',{p_room:ROOM,p_before:oldest.id,p_limit:LIMITS.page});const page=(rows||[]).map(normalizeRow).filter(Boolean);
   if((rows||[]).length<LIMITS.page)this.more=false;
   // Keep the message the player was reading where it is while older ones are added above it.
   const from=this.box.scrollHeight-this.box.scrollTop;this.list=mergeMessages(this.list,page);this.render();this.box.scrollTop=this.box.scrollHeight-from;
  }catch{}finally{this.loadingOlder=false;this.box.classList.remove('loading-older');}
 }
 setState(state,detail=''){
  this.state=state;if(state==='soon')this.soonAt=Date.now();this.installed=state==='ready'?true:state==='soon'?false:this.installed;this.runButton();
  const text={connecting:['Connecting to chat…',''],offline:['Chat needs the cloud connection','Your progress is still saved on this device. Chat comes back when you’re online.'],
   loading:null,soon:['Chat opens soon','The pack’s public chat is being switched on. Check back in a bit; your games and scores are all still here.'],error:['Couldn’t load chat',detail]}[state];
  const form=$('chatForm');if(form)form.hidden=state!=='ready'||this.hiddenFromBoards;
  $('chatStatus').textContent=state==='ready'?'LIVE':state==='soon'?'OPENS SOON':'';$('chatStatus').dataset.state=state;
  if(state==='ready')return;this.stopMoment();this.rows.clear();
  if(state==='loading'){this.box.replaceChildren(el('div','skeleton'),el('div','skeleton'),el('div','skeleton'));return;}
  const empty=el('div','empty-state chat-empty');empty.append(el('b','',text[0]),el('span','',text[1]));
  if(state==='error'||state==='offline')empty.append(el('br'),btn('TRY AGAIN','btn small',()=>this.openView('chat')));
  if(state==='soon')empty.append(el('br'),btn('PLAY SOMETHING','btn small primary',()=>this.shell.show('play')));
  this.box.replaceChildren(empty);$('chatNew').hidden=true;
 }
 // The view is exactly as tall as the space between the top bar and the bottom nav (or the
 // on-screen keyboard), whatever the shell's paddings are, so only the message list scrolls.
 fit(){const view=this.box.closest('.chat-view');if(!view||!this.viewing||!view.getBoundingClientRect)return;const nav=document.querySelector('.app-nav')?.getBoundingClientRect(),h=globalThis.visualViewport?.height||innerHeight;
  const under=nav&&nav.height&&nav.top>innerHeight/2?nav.height:0,top=view.getBoundingClientRect().top+(globalThis.scrollY||0);view.style.height=Math.max(340,Math.round(h-top-under-10))+'px';}
 // ── Notices above the list ──────────────────────────────────────────────────────────────
 notices(){
  const box=$('chatNotice'),p=this.rankings?.profile,rows=[];if(!box)return;
  const note=(text,label,on)=>{const d=el('div','chat-note');d.append(el('span','',text));if(label)d.append(btn(label,'btn small',on));return d;};
  const toMe=()=>{this.shell.show('me');setTimeout(()=>$('playerName').focus(),50);};
  if(!store.get(KIND))rows.push(note('Be kind. This room is public and everyone in the arcade can read it. Don’t share personal details; report anything nasty from a message’s ⋯ menu.','GOT IT',()=>{store.set(KIND,'1');this.notices();}));
  if(this.hiddenFromBoards)rows.push(note('You’re hidden from public boards, so you can read chat but not post.','CHANGE IN ME',toMe));
  else if(p&&!p.name)rows.push(note(`You’re chatting as Guest ${p.code||''}.`.replace(' .','.'),'PICK A NAME',toMe));
  box.replaceChildren(...rows);box.hidden=!rows.length;const form=$('chatForm');if(form)form.hidden=this.state!=='ready'||this.hiddenFromBoards;
 }
 // ── Rendering ───────────────────────────────────────────────────────────────────────────
 render(){
  const now=Date.now(),flags=groupFlags(this.list,now),wanted=[],alive=new Set();
  if(!this.list.length){this.rows.clear();const empty=el('div','empty-state chat-empty');empty.append(el('b','','Nobody’s said anything yet'),el('span','','Say hi, or finish a run and post your score. Someone has to bark first.'));this.box.replaceChildren(empty);return;}
  if(!this.more)wanted.push(this.keyed('start',()=>el('p','chat-start','This is the start of DAWG Chat.')));
  this.list.forEach((m,i)=>{const f=flags[i];
   if(f.day){const k='day:'+dayKey(m.at);alive.add(k);const d=this.keyed(k,()=>el('p','chat-day'));d.textContent=f.day;wanted.push(d);}
   alive.add(m.id);let row=this.rows.get(m.id);if(!row){row=this.row(m);this.rows.set(m.id,row);}this.update(row,m,f,now);wanted.push(row);});
  alive.add('start');for(const [k,node] of this.rows)if(!alive.has(k)){if(this.playing?.row===node)this.stopMoment();node.remove();this.rows.delete(k);}
  // Put rows in order without touching ones that are already in place (a playing moment stays alive).
  for(const n of [...this.box.children])if(!wanted.includes(n))n.remove();
  let at=this.box.firstChild;for(const n of wanted){if(n===at)at=at.nextSibling;else this.box.insertBefore(n,at);}
 }
 keyed(key,make){let n=this.rows.get(key);if(!n){n=make();this.rows.set(key,n);}return n;}
 row(m){
  const row=el('div','chat-msg'+(m.mine?' mine':'')+(m.pending?' pending':''));row.dataset.id=m.id;
  const face=el('button','chat-face');face.type='button';face.dataset.act='card';face.setAttribute('aria-label',`${m.player}’s player card`);
  try{face.append(this.rankings.face(m.avatar,36));}catch{}
  const main=el('div','chat-main'),meta=el('div','chat-meta'),who=btn(m.mine?'You':m.player,'chat-author');who.dataset.act='card';
  meta.append(who,el('span','chat-level','LV '+m.level),el('time','chat-time'));main.append(meta);
  if(m.body)main.append(el('div','chat-bubble',m.body));
  if(m.moment)main.append(this.card(m));
  main.append(el('div','chat-reacts'));
  const more=btn('⋯','chat-more');more.dataset.act='menu';more.setAttribute('aria-label','Message options');more.setAttribute('aria-haspopup','menu');
  row.append(face,main,more);return row;
 }
 update(row,m,f,now){
  row.classList.toggle('first',f.first);row.classList.toggle('pending',!!m.pending);row._m=m;
  const time=row.querySelector('.chat-time');time.textContent=m.pending?'sending…':timeLabel(m.at,now);time.dateTime=new Date(m.at).toISOString();
  const sig=JSON.stringify(m.reactions)+(m.my||'');if(row._sig===sig)return;row._sig=sig;
  row.querySelector('.chat-reacts').replaceChildren(...EMOJI.filter(e=>m.reactions[e]).map(e=>{const b=btn(e+' '+m.reactions[e],'chat-react');b.dataset.act='react';b.dataset.emoji=e;b.setAttribute('aria-pressed',String(m.my===e));b.setAttribute('aria-label',`${e} ${m.reactions[e]}${m.my===e?', yours':''}`);return b;}));
 }
 // A moment card. Score cards are built in; other kinds get a WATCH button if the game ships a viewer.
 card(m){
  const mo=m.moment,game=gameById(mo.game),card=el('div','chat-card');card.dataset.kind=mo.kind;card.dataset.game=mo.game;
  const score=mo.kind==='score'&&game&&validScore(mo.data),text=el('div','chat-card-text'),acts=el('div','chat-card-acts');
  text.append(el('small','chat-card-kind',(score?'SCORE':mo.kind.replace(/_/g,' ').toUpperCase())+(game?' · '+game.title.toUpperCase():'')),el('b','',mo.title));if(mo.text)text.append(el('span','',mo.text));
  if(game){const stage=el('div','chat-stage'),img=el('img','chat-poster');img.src=posterOf(mo.game);img.alt='';img.loading='lazy';stage.append(img);
   if(score){const big=el('strong','chat-score',(mo.game==='trade'?'$':'')+fmt(mo.data.score));stage.append(big);if(mo.data.best)stage.append(el('em','chat-best','PERSONAL BEST'));if(mo.data.medal)card.dataset.medal=MEDAL[mo.data.medal].split(' ')[0];}
   card.append(stage);const play=btn(score?'PLAY':'PLAY '+game.title.toUpperCase(),'btn small primary');play.dataset.act='play';acts.append(play);
   if(score){const ch=btn(m.mine?'CHALLENGE A FRIEND':'CHALLENGE','btn small pink');ch.dataset.act='challenge';acts.append(ch);}}
  card.append(text,acts);
  if(!score)this.canReplay(mo.game).then(ok=>{if(!ok)return;
   if(!card.querySelector('.chat-stage')){const stage=el('div','chat-stage bare');card.prepend(stage);}
   const w=btn('WATCH ▶','btn small primary chat-watch');w.dataset.act='watch';acts.prepend(w);this.poster(card,mo);});
  return card;
 }
 // Does this game ship a moment viewer? Checked once per game, a handful of games per visit.
 canReplay(game){
  if(this.replays.has(game))return this.replays.get(game).then(Boolean);
  const path=replayPath(game);let job;
  if(this.replayLoader)job=Promise.resolve(this.replayLoader(game)).then(mod=>mod||(path?this.fetchReplay(path):null)).catch(()=>null);
  else job=path?this.fetchReplay(path):Promise.resolve(null);
  this.replays.set(game,job);return job.then(Boolean);
 }
 // The viewer sits beside index.html. The address is worked out from the page, not from this
 // file, so it is the same in development and in the deploy bundle (which lives in bundle/).
 async fetchReplay(path){if(this.probes>=12)return null;this.probes++;path=new URL(path,document.baseURI).href;
  try{const r=await fetch(path,{method:'HEAD'});if(!r.ok||!/javascript/.test(r.headers.get('content-type')||''))return null;return {path};}catch{return null;}}
 async replayModule(game){const hit=await this.replays.get(game);if(!hit)return null;if(hit.playMoment)return hit;
  const mod=await import(hit.path);this.replays.set(game,Promise.resolve(mod));return mod;}
 // A still for the card, if the viewer is already loaded and offers one.
 async poster(card,mo){try{const hit=await this.replays.get(mo.game);if(!hit?.momentPoster||!hit.validMoment?.(mo.data))return;
   const p=hit.momentPoster(mo.data),stage=card.querySelector('.chat-stage');if(!stage||stage.querySelector('.chat-host'))return;
   let node=null;if(typeof HTMLCanvasElement!=='undefined'&&p instanceof HTMLCanvasElement)node=p;else if(typeof p==='string'&&/^data:image\/(png|jpeg|webp);/.test(p)){node=el('img');node.src=p;node.alt='';}
   if(node){node.classList.add('chat-poster');stage.querySelector('.chat-poster')?.remove();stage.prepend(node);stage.classList.remove('bare');}}catch{}}
 async watch(row){
  const m=row._m,mo=m?.moment,card=row.querySelector('.chat-card'),w=card?.querySelector('.chat-watch');if(!mo||!w)return;
  if(this.playing?.row===row){this.stopMoment();return;}
  this.stopMoment();w.disabled=true;w.textContent='LOADING…';const ticket=this.ticket=Symbol();
  try{const mod=await this.replayModule(mo.game);
   if(!mod||typeof mod.playMoment!=='function'||(Array.isArray(mod.MOMENT_KINDS)&&!mod.MOMENT_KINDS.includes(mo.kind))||!mod.validMoment?.(mo.data))throw new Error('unplayable');
   if(ticket!==this.ticket||!row.isConnected)return;
   const stage=card.querySelector('.chat-stage'),host=el('div','chat-host');stage.append(host);stage.classList.add('playing');
   const handle=await mod.playMoment(host,mo.data,{quality:matchMedia('(max-width:700px)').matches?'low':'high',reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
   if(ticket!==this.ticket||!row.isConnected){try{handle?.stop?.();}catch{}host.remove();stage.classList.remove('playing');return;}
   this.playing={row,host,handle,stage,button:w};w.textContent='STOP ■';w.disabled=false;
  }catch{w.remove();card.querySelector('.chat-host')?.remove();card.querySelector('.chat-stage')?.classList.remove('playing');this.hint('That moment can’t be replayed on this device.');}
  finally{if(w.isConnected&&this.playing?.row!==row){w.disabled=false;w.textContent='WATCH ▶';}}
 }
 // Only one moment plays at a time, and never off screen.
 stopMoment(){this.ticket=null;const p=this.playing;if(!p)return;this.playing=null;try{p.handle?.stop?.();}catch{}p.host.remove();p.stage.classList.remove('playing');if(p.button.isConnected){p.button.textContent='WATCH ▶';p.button.disabled=false;}this.poster(p.row.querySelector('.chat-card'),p.row._m.moment);}
 // ── Scrolling ───────────────────────────────────────────────────────────────────────────
 atBottom(){const b=this.box;return b.scrollHeight-b.scrollTop-b.clientHeight<70;}
 toBottom(smooth){const b=this.box;this.fresh=0;this.pill();const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  clearTimeout(this.settle);if(smooth&&!reduced&&b.scrollTo){b.scrollTo({top:b.scrollHeight,behavior:'smooth'});
   // Some browsers drop a smooth scroll (a background tab, a late image); land it anyway.
   const from=b.scrollTop;this.settle=setTimeout(()=>{if(b.scrollTop>=from&&!this.atBottom())b.scrollTop=b.scrollHeight;},650);}else b.scrollTop=b.scrollHeight;}
 pill(){const p=$('chatNew');p.hidden=!this.fresh;p.textContent=this.fresh===1?'1 new message ↓':this.fresh+' new messages ↓';}
 onScroll(){clearTimeout(this.press);if(this.menu&&Math.abs(this.box.scrollTop-this.menuTop)>24)this.closeMenu();if(this.atBottom()&&this.fresh){this.fresh=0;this.pill();}
  if(this.box.scrollTop<120)this.older();
  const p=this.playing;if(p){const a=p.stage.getBoundingClientRect(),b=this.box.getBoundingClientRect();if(a.bottom<b.top+20||a.top>b.bottom-20)this.stopMoment();}}
 markSeen(){const newest=[...this.list].reverse().find(m=>!m.pending);if(newest&&this.viewing&&!document.hidden){store.set(SEEN,Math.max(newest.id,Number(store.get(SEEN))||0));this.dot(false);}}
 dot(on){const d=$('chatBadge');if(d)d.hidden=!on;$('chatNav')?.setAttribute('aria-label',on?'Chat, new messages':'Chat');}
 // ── Sending ─────────────────────────────────────────────────────────────────────────────
 count(){const input=$('chatInput'),left=LIMITS.body-(input.value||'').length,c=$('chatCount');c.textContent=String(left);c.classList.toggle('low',left<=20);
  input.style.height='auto';input.style.height=Math.min(input.scrollHeight,112)+'px';input.style.overflowY=input.scrollHeight>112?'auto':'hidden';$('chatSend').disabled=!cleanText(input.value||'');}
 hint(text){const h=$('chatHint');if(!h)return;h.textContent=text||'';clearTimeout(this.hintTimer);if(text)this.hintTimer=setTimeout(()=>{h.textContent='';},6000);}
 async send(){const input=$('chatInput'),raw=input.value;if(!cleanText(raw)||this.sending)return;
  const r=await this.submit(raw,null,{show:true});if(r.ok){if(input.value===raw)input.value='';this.count();this.hint('');}else this.hint(r.reason);input.focus();}
 // Games and the results card post moments through here: chat.post(moment) → {ok, reason}.
 post(moment,body=''){return this.submit(body,moment,{show:this.viewing,toast:true});}
 async submit(body,moment,{show=false,toast=false}={}){
  const c=checkPost(body,moment);if(!c.ok)return {ok:false,reason:reasonText(c.reason)};
  if(this.state==='soon'||this.installed===false)return {ok:false,reason:'DAWG Chat opens soon.'};
  if(!this.reach)return {ok:false,reason:'Chat needs the cloud connection. Try again in a moment.'};
  if(this.hiddenFromBoards)return {ok:false,reason:errorHint('public boards')};
  const key=postKey(c.body,c.moment),pace=rateHint(this.sent,Date.now(),key);if(!pace.ok)return {ok:false,reason:reasonText(pace.reason)};
  const p=this.rankings?.profile,temp={id:this.tempId++,at:Date.now(),body:c.body,moment:c.moment,player:this.myName,code:p?.code||'',avatar:this.rankings?.kennel?.active||null,level:this.rankings?.stats?.().level||1,mine:true,reactions:{},my:null,pending:true};
  if(show&&this.state==='ready'){this.list=[...this.list,temp];this.render();this.toBottom(true);}
  this.sending=true;
  try{await this.rpc('chat_post',{p_body:c.body,p_moment:c.moment});this.sent.push({at:Date.now(),key});this.sent=this.sent.slice(-40);this.installed=true;
   this.list=this.list.filter(m=>m!==temp);this.rows.get(temp.id)?.remove();this.rows.delete(temp.id);
   if(this.viewing){this.busy=false;await this.refresh();this.toBottom(true);}
   if(toast&&!this.viewing)this.announce?.('POSTED TO DAWG CHAT','DAWG CHAT');
   return {ok:true};
  }catch(error){this.list=this.list.filter(m=>m!==temp);if(this.state==='ready')this.render();
   if(isMissing(error)){this.setState('soon');return {ok:false,reason:'DAWG Chat opens soon.'};}
   if(/public boards/.test(error.message))this.notices();
   return {ok:false,reason:errorHint(error.message)};
  }finally{this.sending=false;}
 }
 // POST TO CHAT on the results card.
 runButton(){const b=$('resultsChat');if(b)b.hidden=!this.installed||this.hiddenFromBoards;}
 async postRun(b){const r=this.lastRun?.();if(!r||!gameById(r.game))return;b.disabled=true;
  const res=await this.post(scoreMoment(r.game,r.score,{medal:this.medal?.(r)||0,best:!!r.best,detail:r.detail||''}));
  if(res.ok)b.textContent='POSTED ✓';else{b.disabled=false;this.announce?.(res.reason,'DAWG CHAT');}}
 // ── Clicks and the message menu ─────────────────────────────────────────────────────────
 onClick(e){const t=e.target.closest('[data-act]'),row=e.target.closest('.chat-msg'),m=row?._m;if(!t||!m)return;const act=t.dataset.act,mo=m.moment;
  if(act==='card'){if(m.code&&!m.pending)this.rankings.showCode(m.code);}
  else if(act==='menu'){if(this.menu&&this.menuRow===row)this.closeMenu();else this.openMenu(row);}
  else if(act==='react')this.react(m,t.dataset.emoji);
  else if(act==='watch')this.watch(row);
  else if(act==='play'&&gameById(mo?.game)){this.stopMoment();this.play?.(mo.game);}
  else if(act==='challenge'&&gameById(mo?.game)){if(!m.mine&&m.code&&isMatchGame(mo.game))this.rankings.startMatch({player:m.player,friend_code:m.code,avatar:m.avatar},mo.game);else this.rankings.pickFriend(mo.game);}}
 openMenu(row){
  const m=row._m;if(!m||m.pending)return;this.closeMenu();const menu=el('div','chat-menu');menu.setAttribute('role','menu');this.menu=menu;this.menuRow=row;this.menuTop=this.box.scrollTop;row.classList.add('menu-open');
  const item=(label,on,cls)=>{const b=btn(label,'chat-menu-item'+(cls?' '+cls:''),()=>{this.closeMenu();on();});b.setAttribute('role','menuitem');return b;};
  const reacts=el('div','chat-menu-reacts');reacts.append(...EMOJI.map(e=>{const b=btn(e,'chat-emoji',()=>{this.closeMenu();this.react(m,e);});b.setAttribute('aria-pressed',String(m.my===e));b.setAttribute('aria-label','React '+e);return b;}));menu.append(reacts);
  const copy=[m.body,m.moment?m.moment.title+(m.moment.text?' · '+m.moment.text:''):''].filter(Boolean).join(' · ');
  menu.append(item('Copy text',async()=>{try{await navigator.clipboard.writeText(copy);this.hint('Copied.');}catch{this.hint('Couldn’t copy on this device.');}}));
  if(m.code&&!m.mine)menu.append(item(`${m.player}’s player card`,()=>this.rankings.showCode(m.code)));
  if(m.mine)menu.append(item('Delete my message',()=>this.remove(m),'danger'));
  else menu.append(item('Report message',()=>this.confirm('Report this message?','It disappears for you right away. When enough players report a message, it is hidden for everyone.','REPORT',()=>this.report(m)),'danger'));
  if(this.rankings?.owner&&!m.mine){menu.append(el('small','chat-menu-label','ARCADE OWNER'),item('Delete for everyone',()=>this.remove(m),'danger'));
   if(m.code)menu.append(item('Mute for 1 hour',()=>this.mute(m,60),'danger'),item('Mute for 1 day',()=>this.mute(m,1440),'danger'));}
  const panel=this.box.parentElement;panel.append(menu);
  // Below the message, or above it when there's no room; on the message's own side.
  const a=row.getBoundingClientRect(),p=panel.getBoundingClientRect(),h=menu.offsetHeight,w=menu.offsetWidth;let top=a.bottom-p.top+4;if(top+h>p.height-8)top=Math.max(8,a.top-p.top-h-4);
  menu.style.top=Math.max(8,Math.min(top,p.height-h-8))+'px';menu.style.left=Math.max(8,Math.min(m.mine?p.width-w-12:52,p.width-w-8))+'px';
  menu.querySelector('.chat-menu-item')?.focus({preventScroll:true});
 }
 closeMenu(){clearTimeout(this.press);if(!this.menu)return;this.menu.remove();this.menuRow?.classList.remove('menu-open');this.menu=this.menuRow=null;}
 patch(m,change){const i=this.list.findIndex(x=>x.id===m.id);if(i<0)return;this.list[i]={...this.list[i],...change};this.render();}
 async react(m,emoji){if(m.pending||!EMOJI.includes(emoji))return;
  // Shown at once, then corrected by the server's count.
  const next={...m.reactions},off=m.my===emoji;if(m.my){next[m.my]=(next[m.my]||1)-1;if(!next[m.my])delete next[m.my];}if(!off)next[emoji]=(next[emoji]||0)+1;this.patch(m,{reactions:next,my:off?null:emoji});
  try{const r=await this.rpc('chat_react',{p_id:m.id,p_emoji:off?null:emoji});const fixed=normalizeRow({id:m.id,created_at:new Date(m.at).toISOString(),body:'x',reactions:r?.reactions,my_reaction:r?.mine});if(fixed)this.patch(m,{reactions:fixed.reactions,my:fixed.my});}
  catch(error){this.patch(m,{reactions:m.reactions,my:m.my});this.hint(errorHint(error.message));}}
 drop(m){this.list=this.list.filter(x=>x.id!==m.id);this.render();}
 async report(m){try{await this.rpc('chat_report',{p_id:m.id,p_reason:''});this.drop(m);this.hint('Reported. Thanks for looking out for the pack.');}catch(error){this.hint(errorHint(error.message));}}
 async remove(m){try{await this.rpc('chat_delete',{p_id:m.id});this.drop(m);this.hint('Message deleted.');}catch(error){this.hint(errorHint(error.message));}}
 async mute(m,minutes){try{const r=await this.rpc('chat_mute',{p_code:m.code,p_minutes:minutes});this.hint(`${r?.name||m.player} is muted for ${minutes>=1440?'a day':'an hour'}.`);}catch(error){this.hint(errorHint(error.message));}}
}
