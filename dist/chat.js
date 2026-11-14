// DAWG Chat: rooms where players meet, talk and share game moments (finishing moves, scores),
// with an owner and mods who keep the peace. This file is the view; the pure rules (the same
// checks the server runs) live in chat-core.js and are re-exported here.
// Other players' messages are untrusted: everything is rendered as text, nothing is linked,
// and a moment only plays through its game's own viewer after that viewer accepts the recipe.
// The server decides every permission (supabase/migrations/20261115000000_chat_v2.sql); the
// view only hides buttons a player can't use. Without the v2 functions it runs as v1 (one
// room, no staff tools); without Realtime it polls.
import {gameById} from './games.js';
import {posterOf} from './shell.js';
import {isMatchGame} from './matches.js';
import {EMOJI,ROOM,LIMITS,cleanText,checkPost,postKey,rateHint,reasonText,errorHint,isMissing,normalizeRow,mergeMessages,groupFlags,timeLabel,validScore,scoreMoment,replayPath,
 DEFAULT_ROOMS,normalizeRoom,roomSlugOk,normRole,isStaff,badgeOf,TIMEOUTS,timeoutLabel,can,canEdit,lastEditable,mentionHandle,mentionParts,mentionQuery,mentionSuggest,applyMention,
 postGate,waitLabel,presenceRooms,typingLine,unreadIndex,REPORT_REASONS,EMOJI_PICKER,logLine} from './chat-core.js';
export * from './chat-core.js';

const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const btn=(label,cls,on)=>{const b=el('button',cls,label);b.type='button';if(on)b.onclick=on;return b;};
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,String(v));}catch{}},
 json(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}},put(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
const SEEN='dawg-chat-seen2',KIND='dawg-chat-kind',MENTIONS='dawg-chat-mentions',ROOMKEY='dawg-chat-room';
const fmt=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString('en-US');
const MEDAL=['','bronze','silver','gold'];
const dayKey=at=>{const d=new Date(at);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();};
const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

// Live updates over Supabase Realtime: a signal when any chat message changes (the text is then
// fetched through chat_feed, which applies every rule), typing broadcasts and presence.
class Live {
 constructor(client,h){this.client=client;this.h=h;this.ok=false;this.meta=null;}
 start(key){
  try{const ch=this.client.channel('dawg-chat',{config:{presence:{key},broadcast:{self:false}}});this.ch=ch;
   ch.on('postgres_changes',{event:'*',schema:'public',table:'chat_messages'},p=>this.h.onChange(p.new&&Object.keys(p.new).length?p.new:p.old,p.eventType))
    .on('broadcast',{event:'typing'},m=>this.h.onTyping(m?.payload))
    .on('presence',{event:'sync'},()=>this.h.onPresence(ch.presenceState()))
    .subscribe(s=>{const ok=s==='SUBSCRIBED';this.ok=ok;if(ok&&this.meta)ch.track(this.meta).catch(()=>{});this.h.onStatus(ok,s);});
  }catch{this.ok=false;this.h.onStatus(false,'error');}
 }
 track(meta){this.meta=meta;if(!this.ok)return;if(meta)this.ch.track(meta).catch(()=>{});else this.ch.untrack().catch(()=>{});}
 typing(p){if(this.ok)this.ch.send({type:'broadcast',event:'typing',payload:p}).catch(()=>{});}
 stop(){try{this.client.removeChannel(this.ch);}catch{}this.ok=false;}
}

export class Chat {
 // rankings supplies the cloud client, the player's profile, player cards, friends and challenges.
 constructor({cloud,rankings,shell,announce,confirm,play,lastRun,medal}){Object.assign(this,{cloud,rankings,shell,announce,confirm,play,lastRun,medal});
  this.state='idle';this.v2=null;this.me={role:'member',agreed:true};this.rooms=DEFAULT_ROOMS.slice(0,1).map(r=>normalizeRoom(r));this.room=ROOM;
  this.list=[];this.rows=new Map();this.cache=new Map();this.sent=[];this.lastPost={};this.more=true;this.loadingOlder=false;this.fresh=0;
  this.replays=new Map();this.probes=0;this.playing=null;this.mock=null;this.replayLoader=null;this.liveFactory=null;this.live=null;this.tempId=Number.MAX_SAFE_INTEGER-100000;
  this.seen=store.json(SEEN,{});this.unreadN={};this.mentionSeen=new Set(store.json(MENTIONS,[]));this.mentionList=[];this.presence={rooms:{},total:0};this.typers=new Map();
  this.pins=[];this.staff=[];this.reply=null;this.editing=null;this.announceMode=false;this.suggest=[];this.suggestAt=0;this.divider=0;
  this.box=$('chatList');if(!this.box)return;
  $('chatNav').hidden=false;
  this.wire();
  const prev=shell.onView;shell.onView=v=>{prev?.(v);this.openView(v);};
  // The cloud connects a moment after the page loads; chat wakes up when it does.
  this.waiter=setInterval(()=>{if(this.reach){clearInterval(this.waiter);this.wake();}},1500);this.waiter.unref?.();
  for(const t of [globalThis,globalThis.visualViewport])t?.addEventListener?.('resize',()=>{const stick=this.atBottom();this.fit();if(stick)this.box.scrollTop=this.box.scrollHeight;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stopMoment();else if(this.viewing)this.refresh();});
  let debug='';try{debug=new URLSearchParams(location.search).get('debug')||'';}catch{}
  if(debug.split(',').includes('chat')){globalThis.__dawgChat=this;import('./chat-debug.js').then(m=>m.install(this)).catch(e=>console.error(e));}
  if(shell.view==='chat')this.openView('chat');
 }
 get api(){return this.cloud?.client&&this.cloud?.user?this.cloud.client:null;}
 get reach(){return !!(this.mock||this.api);}
 get viewing(){return this.shell.view==='chat';}
 get hiddenFromBoards(){return this.rankings?.profile?.public===false;}
 get myName(){const p=this.rankings?.profile;return p?.name||(p?.code?'Guest '+p.code:'You');}
 get myCode(){return this.me?.code||this.rankings?.profile?.code||'';}
 get role(){return normRole(this.me?.role);}
 get staffMode(){return this.v2&&isStaff(this.role);}
 get current(){return this.rooms.find(r=>r.slug===this.room)||normalizeRoom({slug:this.room,title:this.room});}
 async rpc(name,args){
  if(this.mock)return this.mock(name,args);const api=this.api;if(!api)throw new Error('cloud connection');
  const {data,error,status}=await api.rpc(name,args);
  if(error){const e=new Error(error.message||'');e.status=status;e.code=error.code;throw e;}return data;
 }
 wire(){
  const input=$('chatInput'),form=$('chatForm');
  $('chatQuick').replaceChildren(...EMOJI_PICKER.map(e=>{const b=btn(e,'chat-emoji',()=>this.insert(e));b.setAttribute('aria-label','Add '+e);return b;}));
  $('chatEmojiBtn').onclick=()=>{const q=$('chatQuick');q.hidden=!q.hidden;$('chatEmojiBtn').setAttribute('aria-expanded',String(!q.hidden));};
  $('chatAnnounce').onclick=()=>{this.announceMode=!this.announceMode;$('chatAnnounce').setAttribute('aria-pressed',String(this.announceMode));this.composerState();};
  input.addEventListener('input',()=>{this.count();this.mentionMenu();this.typing();});
  input.addEventListener('keydown',e=>this.keys(e));
  input.addEventListener('blur',()=>setTimeout(()=>this.closeSuggest(),150));
  form.addEventListener('submit',e=>{e.preventDefault();this.send();});
  $('chatNew').onclick=()=>this.toBottom(true);
  $('chatRoomsBtn').onclick=()=>this.drawer('rooms');$('chatPeopleBtn').onclick=()=>this.drawer('people');$('chatScrim').onclick=()=>this.drawer(null);
  $('chatRoomsClose').onclick=$('chatPeopleClose').onclick=()=>this.drawer(null);
  $('chatModBtn').onclick=$('chatModOpen').onclick=()=>this.openMod();
  $('chatRoomList').addEventListener('click',e=>{const s=e.target.closest('[data-room]')?.dataset.room;if(s){this.drawer(null);this.switchRoom(s);}});
  $('chatPeopleList').addEventListener('click',e=>{const b=e.target.closest('[data-code]');if(b)this.person({code:b.dataset.code,name:b.dataset.name,level:Number(b.dataset.level)||1,role:b.dataset.role},b);});
  $('chatPins').addEventListener('click',()=>this.pinList());
  $('chatContext').addEventListener('click',e=>{if(e.target.closest('[data-act=cancel]'))this.cancelContext();else if(this.reply)this.jumpTo(this.reply.id);});
  $('chatSuggest').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-i]');if(b){e.preventDefault();this.pickSuggest(Number(b.dataset.i));}});
  this.box.addEventListener('scroll',()=>this.onScroll(),{passive:true});
  this.box.addEventListener('click',e=>this.onClick(e));
  this.box.addEventListener('contextmenu',e=>{const row=e.target.closest('.chat-msg');if(row){e.preventDefault();this.openMenu(row);}});
  // Long-press opens the message menu on touch screens.
  this.box.addEventListener('pointerdown',e=>{const row=e.target.closest('.chat-msg');clearTimeout(this.press);if(!row||e.pointerType==='mouse'||e.target.closest('button'))return;this.pressAt={x:e.clientX,y:e.clientY};this.press=setTimeout(()=>this.openMenu(row),520);});
  for(const type of ['pointerup','pointercancel','pointerleave'])this.box.addEventListener(type,()=>clearTimeout(this.press));
  this.box.addEventListener('pointermove',e=>{if(this.pressAt&&Math.hypot(e.clientX-this.pressAt.x,e.clientY-this.pressAt.y)>10)clearTimeout(this.press);});
  document.addEventListener('pointerdown',e=>{const t=e.target;
   if(this.menu&&!this.menu.contains(t)&&!t.closest?.('.chat-more,.chat-hover'))this.closeMenu();
   if(this.pop&&!this.pop.contains(t)&&!t.closest?.('[data-act=card],[data-code]'))this.closePop();
   const q=$('chatQuick');if(!q.hidden&&!q.contains(t)&&t!==$('chatEmojiBtn'))q.hidden=true;});
  const esc=e=>{if(e.key!=='Escape'||!this.viewing)return;if(this.menu)this.closeMenu();else if(this.pop)this.closePop();else if(!$('chatMod').hidden)this.closeMod();else if(this.shellOpen)this.drawer(null);else if(this.reply||this.editing)this.cancelContext();};
  document.addEventListener('keydown',esc);
  // Keys pressed inside chat stay in chat: the arcade's game controls listen on the window, and
  // typing an arrow, E or V in the composer must not steer (or start) the selected game.
  $('viewChat').addEventListener('keydown',e=>{esc(e);e.stopPropagation();});
  // A finished run can go to chat from the results card.
  const b=$('resultsChat');b.onclick=()=>this.postRun(b);$('resultsDialog').addEventListener('close',()=>{b.disabled=false;b.textContent='POST TO CHAT';});
  this.count();
 }
 // ── Connecting, rooms and loading ───────────────────────────────────────────────────────
 wake(){this.peek();clearInterval(this.idle);this.idle=setInterval(()=>{if(!document.hidden&&!this.viewing&&this.state!=='soon')this.peek();},60000);if(this.viewing)this.openView('chat');}
 // Which chat is on the server: v2 (rooms, roles), v1 (one room) or none yet.
 async detect(){
  if(this.v2!==null&&this.state!=='soon')return true;
  try{this.me={...this.me,...await this.rpc('chat_me')};this.v2=true;this.installed=true;}
  catch(error){if(!isMissing(error)){if(this.v2===null)throw error;return true;}this.v2=false;this.me={role:'member',agreed:true};}
  if(this.v2){await this.loadRooms();this.startLive();this.loadStaff();}else{this.rooms=[normalizeRoom(DEFAULT_ROOMS[0])];this.room=ROOM;}
  this.renderRooms();this.header();return true;
 }
 async loadRooms(){if(!this.v2)return;try{const rows=(await this.rpc('chat_rooms'))||[];const rooms=rows.map(normalizeRoom).filter(Boolean);if(!rooms.length)return;this.rooms=rooms;
   for(const r of rooms)if(this.seen[r.slug]===undefined)this.seen[r.slug]=r.lastId;store.put(SEEN,this.seen);
   const saved=store.get(ROOMKEY);if(!this.roomPicked){this.roomPicked=true;if(roomSlugOk(saved)&&rooms.some(r=>r.slug===saved&&!r.archived))this.room=saved;}
   if(!rooms.some(r=>r.slug===this.room))this.room=ROOM;this.renderRooms();this.header();}catch{}}
 async loadStaff(){if(!this.v2)return;try{this.staff=((await this.rpc('chat_staff'))||[]).map(s=>({name:cleanText(s.player).slice(0,24),code:/^[A-F0-9]{8}$/.test(s.friend_code)?s.friend_code:'',role:normRole(s.role),avatar:s.avatar})).filter(s=>s.code);this.people();}catch{}}
 // A light check while the player is elsewhere in the arcade: unread rooms and mentions.
 async peek(){if(!this.reach||this.viewing)return;
  try{await this.detect();
   if(this.v2){await this.loadRooms();await this.loadMentions();}
   else{const rows=await this.rpc('chat_recent',{p_room:ROOM,p_before:null,p_limit:1});const m=(rows||[]).map(normalizeRow).filter(Boolean)[0];if(m&&!m.mine&&m.id>(this.seen[ROOM]||0))this.unreadN[ROOM]=Math.max(1,this.unreadN[ROOM]||0);}
   if(this.state==='idle'||this.state==='soon')this.state='known';this.installed=true;this.runButton();this.badge();
  }catch(error){if(isMissing(error)){this.state='soon';this.installed=false;this.runButton();}}}
 async loadMentions(){if(!this.v2)return;try{const rows=((await this.rpc('chat_mentions',{p_after:0}))||[]).filter(r=>Number.isSafeInteger(Number(r.id))&&roomSlugOk(r.room));
   const fresh=rows.filter(r=>!this.mentionSeen.has(Number(r.id)));const known=new Set(this.mentionList.map(m=>m.id));this.mentionList=fresh.map(r=>({id:Number(r.id),room:r.room,player:cleanText(r.player).slice(0,24)}));
   const newest=this.mentionList.find(m=>!known.has(m.id));if(newest&&this.mentionsLoaded&&!(this.viewing&&this.room===newest.room))this.announce?.(`${newest.player} mentioned you in #${newest.room}`,'DAWG CHAT');
   this.mentionsLoaded=true;this.badge();this.renderRooms();}catch{}}
 openView(view){
  clearInterval(this.poll);clearInterval(this.tick);clearTimeout(this.offline);
  if(view!=='chat'){this.stopMoment();this.closeMenu();this.closePop();this.closeMod();this.drawer(null);this.track(false);return;}
  this.fit();this.notices();
  if(!this.reach){this.setState('connecting');this.offline=setTimeout(()=>{if(!this.reach&&this.viewing)this.setState('offline');},7000);return;}
  if(this.state!=='ready'&&this.state!=='soon')this.setState('loading');
  this.detect().then(()=>{this.track(true);this.divider=this.seen[this.room]||0;return this.refresh();},error=>{this.setState('error',errorHint(error.message));})
   .then(()=>{if(this.viewing&&this.state==='ready'){this.toBottom(false);this.loadPins();}});
  this.poll=setInterval(()=>{if(document.hidden||!this.viewing||!this.reach||(this.state==='soon'&&Date.now()-this.soonAt<300000))return;
   // Realtime pushes changes; polling is the safety net (every 30 s), or the whole feed (every 5 s) without it.
   const live=this.live?.ok;if(!live||Date.now()-(this.lastFetch||0)>30000)this.refresh();if(this.v2&&(!live||Date.now()-(this.roomsAt||0)>60000)){this.roomsAt=Date.now();this.loadRooms();this.loadMentions();}},5000);
  this.tick=setInterval(()=>{this.typingShow();this.composerState();},1000);
 }
 feedArgs(extra){return this.v2?{p_room:this.room,p_before:null,p_after:null,p_limit:LIMITS.page,p_pinned:false,...extra}:{p_room:ROOM,p_before:null,p_limit:LIMITS.page,...extra};}
 feed(extra){if(this.v2)return this.rpc('chat_feed',this.feedArgs(extra));const {p_after,p_pinned,...rest}=this.feedArgs(extra);return this.rpc('chat_recent',rest);}
 // The newest window of the room. Also the check for whether chat is switched on yet.
 async refresh(){
  if(this.busy||!this.reach)return;this.busy=true;const room=this.room;
  try{const rows=await this.feed();if(room!==this.room)return;this.lastFetch=Date.now();
   const page=(rows||[]).map(normalizeRow).filter(Boolean),had=new Set(this.list.map(m=>m.id)),first=this.state!=='ready'||!this.list.length;
   const stick=first||this.atBottom();this.list=mergeMessages(this.list,page,{head:true});if(first&&page.length<LIMITS.page)this.more=false;
   const added=this.list.filter(m=>!m.pending&&!had.has(m.id)&&!m.mine).length;
   this.setState('ready');this.render();
   if(stick){if(first||this.box.scrollHeight-this.box.scrollTop-this.box.clientHeight>1)this.toBottom(!first);}else if(added){this.fresh+=added;this.pill();}
   this.markSeen();
  }catch(error){if(isMissing(error)&&!this.v2)this.setState('soon');else if(this.state!=='ready')this.setState('error',errorHint(error.message));}
  finally{this.busy=false;}
 }
 async older(){
  if(this.loadingOlder||!this.more||this.state!=='ready'||!this.list.length)return false;const oldest=this.list.find(m=>!m.pending);if(!oldest)return false;
  this.loadingOlder=true;this.box.classList.add('loading-older');const room=this.room;
  try{const rows=await this.feed({p_before:oldest.id});if(room!==this.room)return false;const page=(rows||[]).map(normalizeRow).filter(Boolean);
   if((rows||[]).length<LIMITS.page)this.more=false;
   // Keep the message the player was reading where it is while older ones are added above it.
   const from=this.box.scrollHeight-this.box.scrollTop;this.list=mergeMessages(this.list,page);this.render();this.box.scrollTop=this.box.scrollHeight-from;return page.length>0;
  }catch{return false;}finally{this.loadingOlder=false;this.box.classList.remove('loading-older');}
 }
 async switchRoom(slug){
  if(!roomSlugOk(slug)||slug===this.room&&this.state==='ready')return;
  this.cache.set(this.room,{list:this.list,more:this.more});this.stopMoment();this.closeMenu();this.closePop();this.cancelContext();
  this.room=slug;store.set(ROOMKEY,slug);this.divider=this.seen[slug]||0;const hit=this.cache.get(slug);
  this.list=hit?.list||[];this.more=hit?.more??true;this.rows.clear();this.box.replaceChildren();this.fresh=0;this.pill();this.pins=[];this.pinBar();
  this.header();this.renderRooms();this.track(true);this.people();this.typingShow();this.composerState();
  if(this.list.length){this.setState('ready');this.render();this.toBottom(false);}else this.setState('loading');
  await this.refresh();if(this.room===slug){this.toBottom(false);this.loadPins();}
 }
 setState(state,detail=''){
  this.state=state;if(state==='soon')this.soonAt=Date.now();this.installed=state==='ready'?true:state==='soon'?false:this.installed;this.runButton();
  const text={connecting:['Connecting to chat…',''],offline:['Chat needs the cloud connection','Your progress is still saved on this device. Chat comes back when you’re online.'],
   loading:null,soon:['Chat opens soon','The pack’s public chat is being switched on. Check back in a bit; your games and scores are all still here.'],error:['Couldn’t load chat',detail]}[state];
  $('chatStatus').textContent=state==='ready'?(this.live?.ok?'LIVE':''):state==='soon'?'OPENS SOON':'';$('chatStatus').dataset.state=state;
  this.composerState();if(state==='ready')return;this.stopMoment();this.rows.clear();
  if(state==='loading'){this.box.replaceChildren(...[0,1,2,3].map(i=>el('div','skeleton chat-skel'+(i%2?' right':''))));return;}
  const empty=el('div','empty-state chat-empty');empty.append(el('b','',text[0]),el('span','',text[1]));
  if(state==='error'||state==='offline')empty.append(el('br'),btn('TRY AGAIN','btn small',()=>this.openView('chat')));
  if(state==='soon')empty.append(el('br'),btn('PLAY SOMETHING','btn small primary',()=>this.shell.show('play')));
  this.box.replaceChildren(empty);$('chatNew').hidden=true;
 }
 // The view is exactly as tall as the space between the top bar and the bottom nav (or the
 // on-screen keyboard), whatever the shell's paddings are, so only the message list scrolls.
 fit(){const view=this.box.closest('.chat-view');if(!view||!this.viewing||!view.getBoundingClientRect)return;const vv=globalThis.visualViewport,nav=document.querySelector('.app-nav')?.getBoundingClientRect(),h=vv?.height||innerHeight;
  // With the keyboard up the visual viewport is shorter than the window: the nav is under the keyboard then.
  const keyboard=vv&&innerHeight-vv.height>120,under=!keyboard&&nav&&nav.height&&nav.top>innerHeight/2?nav.height:0,top=view.getBoundingClientRect().top+(vv?.offsetTop||0);
  view.style.height=Math.max(keyboard?200:340,Math.round(h-Math.max(0,top-(vv?.offsetTop||0))-under-(keyboard?4:10)))+'px';}
 // ── Header, rooms, people ───────────────────────────────────────────────────────────────
 header(){const r=this.current;$('chatTitle').textContent=(this.v2?'# ':'')+(this.v2?r.title:'DAWG Chat');
  const topic=[r.locked?'🔒 locked':'',r.slow?`🐢 slow mode ${r.slow}s`:'',r.topic].filter(Boolean).join(' · ');$('chatTopic').textContent=this.v2?topic:'The whole pack, live';
  $('chatModBtn').hidden=$('chatModOpen').hidden=!this.staffMode;$('chatRoomsBtn').hidden=!this.v2;$('chatShell').classList.toggle('v1',this.v2===false);
  const here=(this.presence.rooms[this.room]||[]).length;$('chatOnline').textContent=String(here);$('chatPeopleBtn').setAttribute('aria-label',`${here} here now, ${this.presence.total} in chat`);$('chatPeopleBtn').hidden=!this.v2;}
 roomUnread(slug){if(slug===this.room&&this.viewing)return 0;const n=this.unreadN[slug]||0;if(n)return n;const r=this.rooms.find(x=>x.slug===slug);return r&&r.lastId>(this.seen[slug]||0)?-1:0;}
 renderRooms(){const list=$('chatRoomList');if(!list)return;const staff=this.staffMode;
  list.replaceChildren(el('p','chat-side-label','ROOMS'),...this.rooms.filter(r=>!r.archived||staff).map(r=>{const b=btn('','chat-room'+(r.slug===this.room?' on':'')+(r.archived?' archived':''));b.dataset.room=r.slug;
   const n=this.roomUnread(r.slug),men=this.mentionList.filter(m=>m.room===r.slug).length,here=(this.presence.rooms[r.slug]||[]).length;
   b.append(el('span','chat-hash','#'),el('span','chat-room-name',r.title));if(r.locked)b.append(el('span','chat-room-flag','🔒'));
   if(men)b.append(el('b','chat-room-count mention','@'+men));else if(n>0)b.append(el('b','chat-room-count',n>99?'99+':String(n)));else if(n<0)b.append(el('i','chat-room-dot'));else if(here)b.append(el('small','chat-room-here',String(here)));
   if(r.slug===this.room)b.setAttribute('aria-current','true');b.classList.toggle('unread',!!n||!!men);b.setAttribute('aria-label',`#${r.title}${men?`, ${men} mentions`:n?', new messages':''}`);return b;}));
  this.badge();}
 badge(){const d=$('chatBadge');if(!d)return;const men=this.mentionList.length,unread=this.rooms.some(r=>this.roomUnread(r.slug));
  d.hidden=!men&&!unread;d.textContent=men?String(men>9?'9+':men):'';d.classList.toggle('chat-dot',!men);$('chatNav')?.setAttribute('aria-label',men?`Chat, ${men} mention${men>1?'s':''}`:unread?'Chat, new messages':'Chat');}
 people(){const box=$('chatPeopleList');if(!box)return;const here=this.presence.rooms[this.room]||[],others=this.presence.total-here.length,online=new Set(Object.values(this.presence.rooms).flat().map(p=>p.code));
  const row=p=>{const b=btn('','chat-person');b.dataset.code=p.code;b.dataset.name=p.name;b.dataset.level=p.level||1;b.dataset.role=p.role;try{b.append(this.rankings.face(p.avatar||null,28));}catch{}
   const t=el('span','chat-person-name',p.name);const badge=badgeOf(p.role);if(badge)t.append(el('em','chat-badge '+p.role,badge));b.append(t);if(p.level)b.append(el('small','',p.level?'LV '+p.level:''));if(online.has(p.code))b.classList.add('online');return b;};
  const parts=[el('p','chat-side-label',`HERE NOW · ${here.length}`)];if(here.length)parts.push(...here.map(row));else parts.push(el('p','chat-side-empty',this.live?.ok||this.mock?'Just you right now. Say hi; people drop in.':'Who’s here shows up when live chat connects.'));
  if(others>0)parts.push(el('p','chat-side-note',`${others} more in other rooms`));
  if(this.staff.length){parts.push(el('p','chat-side-label','STAFF'));parts.push(...this.staff.map(s=>row({...s,level:0})));}
  box.replaceChildren(...parts);this.header();}
 drawer(which){const shell=$('chatShell');shell.classList.toggle('show-rooms',which==='rooms');shell.classList.toggle('show-people',which==='people');this.shellOpen=!!which;$('chatScrim').hidden=!which;
  if(which==='people')this.people();}
 // ── Realtime: changes, typing, presence ─────────────────────────────────────────────────
 startLive(){if(this.live||!this.v2)return;const h={onChange:(r,t)=>this.onChange(r,t),onTyping:p=>this.onTyping(p),onPresence:s=>this.onPresence(s),
   onStatus:(ok,s)=>{this.liveDown=!ok&&s!=='SUBSCRIBED';if(this.state==='ready')$('chatStatus').textContent=ok?'LIVE':'';if(ok)this.track(this.viewing);}};
  try{this.live=this.liveFactory?this.liveFactory(h):this.api?.channel?new Live(this.api,h):null;this.live?.start(this.myCode||'guest-'+Math.random().toString(36).slice(2,8));}catch{this.live=null;}}
 track(on){if(!this.live)return;const p=this.rankings?.profile;
  this.live.track(on&&this.viewing&&this.myCode?{code:this.myCode,name:this.myName,level:this.rankings?.stats?.().level||1,role:this.role,room:this.room}:null);}
 onChange(row,type){if(!row||!roomSlugOk(row.room))return;const id=Number(row.id);
  if(row.room===this.room&&this.viewing){
   if(row.deleted===true||row.hidden===true){if(this.list.some(m=>m.id===id)){this.list=this.list.filter(m=>m.id!==id);this.render();}}
   clearTimeout(this.changeTimer);this.changeTimer=setTimeout(()=>this.refresh(),type==='INSERT'?120:400);
   if(row.pinned_at!==undefined&&type==='UPDATE')this.loadPins();return;}
  if(type==='INSERT'&&id>(this.seen[row.room]||0)){this.unreadN[row.room]=(this.unreadN[row.room]||0)+1;const r=this.rooms.find(x=>x.slug===row.room);if(r)r.lastId=Math.max(r.lastId,id);this.renderRooms();
   clearTimeout(this.mentionTimer);this.mentionTimer=setTimeout(()=>this.loadMentions(),800);}}
 onTyping(p){if(!p||typeof p.code!=='string'||p.code===this.myCode||!roomSlugOk(p.room))return;this.typers.set(p.code,{name:cleanText(p.name).slice(0,24)||'Someone',room:p.room,at:Date.now()});this.typingShow();}
 typingShow(){const now=Date.now(),names=[];for(const [code,t] of this.typers){if(now-t.at>4500)this.typers.delete(code);else if(t.room===this.room)names.push(t.name);}
  const line=$('chatTyping');const text=typingLine(names);if(line.textContent!==text){line.textContent=text;line.classList.toggle('on',!!text);}}
 typing(){if(!this.live||!$('chatInput').value.trim()||this.editing)return;const now=Date.now();if(now-(this.typedAt||0)<2500)return;this.typedAt=now;this.live.typing({code:this.myCode,name:this.myName,room:this.room});}
 onPresence(state){this.presence=presenceRooms(state);this.people();this.renderRooms();this.header();}
 // ── Notices, gates and the composer state ───────────────────────────────────────────────
 notices(){
  const box=$('chatNotice'),p=this.rankings?.profile,rows=[];if(!box)return;
  const note=(text,label,on)=>{const d=el('div','chat-note');d.append(el('span','',text));if(label)d.append(btn(label,'btn small',on));return d;};
  const toMe=()=>{this.shell.show('me');setTimeout(()=>$('playerName').focus(),50);};
  if(!store.get(KIND)&&this.v2===false)rows.push(note('Be kind. This room is public and everyone in the arcade can read it. Don’t share personal details; report anything nasty from a message’s ⋯ menu.','GOT IT',()=>{store.set(KIND,'1');this.notices();}));
  if(this.hiddenFromBoards)rows.push(note('You’re hidden from public boards, so you can read chat but not post.','CHANGE IN ME',toMe));
  else if(p&&!p.name)rows.push(note(`You’re chatting as Guest ${p.code||''}. Pick a name so the pack knows you.`,'PICK A NAME',toMe));
  box.replaceChildren(...rows);box.hidden=!rows.length;this.composerState();
 }
 // What stands between this player and the composer: a ban, the rules, a time-out, a locked room.
 composerState(){
  const form=$('chatForm'),gate=$('chatGate');if(!form||!gate)return;const ready=this.state==='ready';this.runButton();
  const g=postGate({me:this.v2?this.me:{role:'member',agreed:true},room:this.current,hidden:this.hiddenFromBoards,lastAt:this.lastPost[this.room]||0,now:Date.now()});
  const blocking=['banned','rules','timeout','locked'].includes(g.reason);form.hidden=!ready||this.hiddenFromBoards||blocking;gate.hidden=!ready||!blocking;
  $('chatAnnounce').hidden=!(this.v2&&can(this.role,'announce'));if(!can(this.role,'announce'))this.announceMode=false;
  form.classList.toggle('announce',this.announceMode);$('chatInput').placeholder=this.editing?'Edit your message':this.announceMode?'Announcement to the whole room':this.reply?`Reply to ${this.reply.player}`:this.v2?`Message #${this.current.title}`:'Message the pack';
  const send=$('chatSend');const slow=g.reason==='slow';send.textContent=slow?waitLabel(g.wait):this.editing?'SAVE':'SEND';send.classList.toggle('waiting',slow);
  if(!this.editing)send.disabled=slow||!cleanText($('chatInput').value||'');
  if(this.current.locked&&isStaff(this.role)&&ready)this.staticHint='🔒 Locked room: only staff can post.';else if(this.current.slow&&!isStaff(this.role))this.staticHint=`🐢 Slow mode: one message every ${this.current.slow} s.`;else this.staticHint='';
  const h=$('chatHint');if(h&&!this.hintTimer)h.textContent=this.staticHint;
  if(!blocking||!ready){gate.dataset.kind='';return;}if(gate.dataset.kind===g.reason+(g.reason==='timeout'?Math.ceil(g.wait/60000):''))return;gate.dataset.kind=g.reason+(g.reason==='timeout'?Math.ceil(g.wait/60000):'');
  const head=el('b'),text=el('p');const parts=[head,text];
  if(g.reason==='banned'){head.textContent='You’re banned from DAWG Chat';text.textContent=(this.me.ban_reason?`Reason: ${cleanText(this.me.ban_reason)}. `:'')+'You can still read along and play every game.';}
  else if(g.reason==='timeout'){head.textContent='You’re timed out';text.textContent=`You can post again in ${waitLabel(g.wait)}. Take a breather; the games are all still open.`;}
  else if(g.reason==='locked'){head.textContent=`#${this.current.title} is locked`;text.textContent='Only the owner and mods can post here right now. Every other room is open.';}
  else{head.textContent='Chat rules';text.textContent='One step before you post: read the rules and agree to them.';const rules=el('div','chat-rules-text',cleanRules(this.me.rules));
   const agree=btn('I AGREE','btn primary',async()=>{agree.disabled=true;try{this.me={...this.me,...await this.rpc('chat_agree',{p_version:this.me.rules_version})};store.set(KIND,'1');this.composerState();$('chatInput').focus();}catch(error){agree.disabled=false;this.flash(errorHint(error.message));try{this.me={...this.me,...await this.rpc('chat_me')};gate.dataset.kind='';this.composerState();}catch{}}});
   parts.push(rules,agree);}
  gate.replaceChildren(...parts);
 }
 // ── Rendering messages ──────────────────────────────────────────────────────────────────
 render(){
  const now=Date.now(),flags=groupFlags(this.list,now),wanted=[],alive=new Set(['start','unread']),cut=unreadIndex(this.list,this.divider);
  if(!this.list.length){this.rows.clear();const empty=el('div','empty-state chat-empty');const r=this.current;
   empty.append(el('b','',this.v2?`Welcome to #${r.title}`:'Nobody’s said anything yet'),el('span','',this.v2&&r.topic?r.topic+' Be the first to say something.':'Say hi, or finish a run and post your score. Someone has to bark first.'));this.box.replaceChildren(empty);return;}
  if(!this.more)wanted.push(this.keyed('start',()=>el('p','chat-start')));if(!this.more)this.rows.get('start').textContent=this.v2?`This is the start of #${this.current.title}.`:'This is the start of DAWG Chat.';
  this.list.forEach((m,i)=>{const f=flags[i];
   if(f.day){const k='day:'+dayKey(m.at);alive.add(k);const d=this.keyed(k,()=>el('p','chat-day'));d.textContent=f.day;wanted.push(d);}
   if(i===cut)wanted.push(this.keyed('unread',()=>{const d=el('p','chat-unread');d.append(el('span','','NEW MESSAGES'));return d;}));
   alive.add(m.id);let row=this.rows.get(m.id);if(!row){row=el('div','chat-msg');this.rows.set(m.id,row);}this.update(row,m,i===cut||f.first,now);wanted.push(row);});
  for(const [k,node] of this.rows)if(!alive.has(k)){if(this.playing?.row===node)this.stopMoment();node.remove();this.rows.delete(k);}
  // Put rows in order without touching ones that are already in place (a playing moment stays alive).
  for(const n of [...this.box.children])if(!wanted.includes(n))n.remove();
  let at=this.box.firstChild;for(const n of wanted){if(n===at)at=at.nextSibling;else this.box.insertBefore(n,at);}
 }
 keyed(key,make){let n=this.rows.get(key);if(!n){n=make();this.rows.set(key,n);}return n;}
 // A message row is rebuilt only when what it shows changes, and never while its moment plays.
 update(row,m,first,now){
  row.className='chat-msg'+(m.mine?' mine':'')+(m.pending?' pending':'')+(first?' first':'')+(m.kind==='announce'?' announce':'')+(m.mentionsMe&&!m.mine?' mentioned':'')+(m.pinned?' pinned':'')+(row.classList.contains('menu-open')?' menu-open':'')+(row.classList.contains('flash')?' flash':'');
  row.dataset.id=m.id;row._m=m;
  const sig=[m.body,m.edited,m.pinned,m.role,m.player,m.level,m.reply?.id,m.reply?.body,m.pending,!!m.moment,m.kind].join('|');
  if(row._sig!==sig&&this.playing?.row!==row){row._sig=sig;this.fill(row,m);row._rsig=null;}
  const time=row.querySelector('.chat-time');if(time){time.textContent=m.pending?'sending…':timeLabel(m.at,now);time.dateTime=new Date(m.at).toISOString();time.title=new Date(m.at).toLocaleString();}
  const rsig=JSON.stringify(m.reactions)+(m.my||'');if(row._rsig===rsig)return;row._rsig=rsig;
  row.querySelector('.chat-reacts')?.replaceChildren(...EMOJI.filter(e=>m.reactions[e]).map(e=>{const b=btn(e+' '+m.reactions[e],'chat-react');b.dataset.act='react';b.dataset.emoji=e;b.setAttribute('aria-pressed',String(m.my===e));b.setAttribute('aria-label',`${e} ${m.reactions[e]}${m.my===e?', yours':''}`);return b;}));
 }
 fill(row,m){
  const face=el('button','chat-face');face.type='button';face.dataset.act='card';face.setAttribute('aria-label',`${m.player}’s card`);try{face.append(this.rankings.face(m.avatar,36));}catch{}
  const main=el('div','chat-main'),meta=el('div','chat-meta'),who=btn(m.mine?'You':m.player,'chat-author');who.dataset.act='card';meta.append(who);
  const badge=badgeOf(m.role);if(badge)meta.append(el('em','chat-badge '+m.role,badge));
  if(!m.mine)meta.append(el('span','chat-level','LV '+m.level));if(m.kind==='announce')meta.append(el('em','chat-badge announce','📣 ANNOUNCEMENT'));
  if(m.pinned)meta.append(el('span','chat-pin-tag','📌 pinned'));meta.append(el('time','chat-time'));main.append(meta);
  if(m.reply){const q=btn('','chat-quote');q.dataset.act='jump';q.dataset.to=m.reply.id;q.append(el('b','',m.reply.player?'↩ '+m.reply.player:'↩'),el('span','',m.reply.body||'Original message deleted'));main.append(q);}
  if(m.body){const b=el('div','chat-bubble');for(const p of mentionParts(m.body)){if(p.mention){const s=el('span','chat-mention'+(p.mention===mentionHandle(this.myName).toLowerCase()?' me':''),p.text);b.append(s);}else b.append(document.createTextNode(p.text));}
   if(m.edited)b.append(el('small','chat-edited',' (edited)'));main.append(b);}
  if(m.moment)main.append(this.card(m));
  main.append(el('div','chat-reacts'));
  const hover=el('div','chat-hover');const react=btn('😊','chat-hover-btn');react.dataset.act='reactpick';react.setAttribute('aria-label','Add a reaction');
  const rep=btn('↩','chat-hover-btn');rep.dataset.act='reply';rep.setAttribute('aria-label','Reply');const more=btn('⋯','chat-hover-btn chat-more');more.dataset.act='menu';more.setAttribute('aria-label','Message options');more.setAttribute('aria-haspopup','menu');
  if(!m.pending)hover.append(react,rep,more);
  row.replaceChildren(face,main,hover);
 }
 // A moment card. Score cards are built in; other kinds get a WATCH button if the game ships a viewer.
 card(m){
  const mo=m.moment,game=gameById(mo.game),card=el('div','chat-card');card.dataset.kind=mo.kind;card.dataset.game=mo.game;
  const score=mo.kind==='score'&&game&&validScore(mo.data),text=el('div','chat-card-text'),acts=el('div','chat-card-acts');
  text.append(el('small','chat-card-kind',(score?'SCORE':mo.kind.replace(/_/g,' ').toUpperCase())+(game?' · '+game.title.toUpperCase():'')),el('b','',mo.title));if(mo.text)text.append(el('span','',mo.text));
  if(game){const stage=el('div','chat-stage'),img=el('img','chat-poster');img.src=posterOf(mo.game);img.alt='';img.loading='lazy';stage.append(img);
   if(score){const big=el('strong','chat-score',(mo.game==='trade'?'$':'')+fmt(mo.data.score));stage.append(big);if(mo.data.best)stage.append(el('em','chat-best','PERSONAL BEST'));if(mo.data.medal)card.dataset.medal=MEDAL[mo.data.medal];}
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
 async poster(card,mo){try{let hit=await this.replays.get(mo.game);if(hit?.path&&!hit.momentPoster){hit=await this.replayModule(mo.game);}if(!hit?.momentPoster||!hit.validMoment?.(mo.data))return;
   const p=hit.momentPoster(mo.data),stage=card?.querySelector('.chat-stage');if(!stage||stage.querySelector('.chat-host'))return;
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
   const handle=await mod.playMoment(host,mo.data,{quality:matchMedia('(max-width:700px)').matches?'low':'high',reduced:reduced()});
   if(ticket!==this.ticket||!row.isConnected){try{handle?.stop?.();}catch{}host.remove();stage.classList.remove('playing');return;}
   this.playing={row,host,handle,stage,button:w};w.textContent='STOP ■';w.disabled=false;
  }catch{w.remove();card.querySelector('.chat-host')?.remove();card.querySelector('.chat-stage')?.classList.remove('playing');this.flash('That moment can’t be replayed on this device.');}
  finally{if(w.isConnected&&this.playing?.row!==row){w.disabled=false;w.textContent='WATCH ▶';}}
 }
 // Only one moment plays at a time, and never off screen.
 stopMoment(){this.ticket=null;const p=this.playing;if(!p)return;this.playing=null;try{p.handle?.stop?.();}catch{}p.host.remove();p.stage.classList.remove('playing');if(p.button.isConnected){p.button.textContent='WATCH ▶';p.button.disabled=false;}this.poster(p.row.querySelector('.chat-card'),p.row._m.moment);}
 // ── Pins ────────────────────────────────────────────────────────────────────────────────
 async loadPins(){if(!this.v2)return;const room=this.room;try{const rows=await this.feed({p_pinned:true,p_limit:10});if(room!==this.room)return;this.pins=(rows||[]).map(normalizeRow).filter(Boolean);}catch{this.pins=[];}this.pinBar();}
 pinBar(){const bar=$('chatPins');if(!bar)return;bar.hidden=!this.pins.length;if(!this.pins.length)return;const p=this.pins[0];
  bar.replaceChildren(el('b','',`📌 ${this.pins.length} PINNED`),el('span','',`${p.player}: ${p.body||p.moment?.title||''}`));bar.setAttribute('aria-label',`${this.pins.length} pinned messages. Show them.`);}
 pinList(){if(!this.pins.length)return;const panel=this.box.parentElement,menu=el('div','chat-menu chat-pins-list');menu.setAttribute('role','menu');this.closeMenu();this.menu=menu;
  menu.append(el('small','chat-menu-label','PINNED IN #'+this.current.title.toUpperCase()));
  for(const p of this.pins){const b=btn('','chat-menu-item chat-pin-item',()=>{this.closeMenu();this.jumpTo(p.id);});b.append(el('b','',p.player),el('span','',p.body||p.moment?.title||''));menu.append(b);}
  panel.append(menu);menu.style.top='52px';menu.style.left='12px';menu.style.right='12px';}
 // ── Scrolling ───────────────────────────────────────────────────────────────────────────
 atBottom(){const b=this.box;return b.scrollHeight-b.scrollTop-b.clientHeight<70;}
 toBottom(smooth){const b=this.box;this.fresh=0;this.pill();
  clearTimeout(this.settle);if(smooth&&!reduced()&&b.scrollTo){b.scrollTo({top:b.scrollHeight,behavior:'smooth'});
   // Some browsers drop a smooth scroll (a background tab, a late image); land it anyway.
   const from=b.scrollTop;this.settle=setTimeout(()=>{if(b.scrollTop>=from&&!this.atBottom())b.scrollTop=b.scrollHeight;},650);}else b.scrollTop=b.scrollHeight;}
 pill(){const p=$('chatNew');p.hidden=!this.fresh;p.textContent=this.fresh===1?'1 new message ↓':this.fresh+' new messages ↓';}
 onScroll(){clearTimeout(this.press);if(this.menu&&Math.abs(this.box.scrollTop-this.menuTop)>24)this.closeMenu();if(this.pop&&Math.abs(this.box.scrollTop-this.popTop)>24)this.closePop();if(this.atBottom()&&this.fresh){this.fresh=0;this.pill();}
  if(this.box.scrollTop<160)this.older();
  const p=this.playing;if(p){const a=p.stage.getBoundingClientRect(),b=this.box.getBoundingClientRect();if(a.bottom<b.top+20||a.top>b.bottom-20)this.stopMoment();}}
 // Scrolls to a message (a reply's original, a pin), loading older pages until it is there.
 async jumpTo(id){for(let i=0;i<8&&!this.rows.get(id);i++){const first=this.list.find(m=>!m.pending);if(!first||first.id<id||!this.more)break;if(!await this.older())break;}
  const row=this.rows.get(id);if(!row){this.flash('That message is too far back or was removed.');return;}
  row.scrollIntoView({block:'center',behavior:reduced()?'auto':'smooth'});row.classList.add('flash');setTimeout(()=>row.classList.remove('flash'),1600);}
 markSeen(){const newest=[...this.list].reverse().find(m=>!m.pending);if(!newest||!this.viewing||document.hidden)return;
  this.seen[this.room]=Math.max(newest.id,this.seen[this.room]||0);store.put(SEEN,this.seen);this.unreadN[this.room]=0;const r=this.rooms.find(x=>x.slug===this.room);if(r)r.lastId=Math.max(r.lastId,newest.id);
  const ids=new Set(this.list.map(m=>m.id));const read=this.mentionList.filter(x=>x.room===this.room&&(ids.has(x.id)||x.id<=newest.id));
  if(read.length){for(const x of read)this.mentionSeen.add(x.id);store.put(MENTIONS,[...this.mentionSeen].slice(-200));this.mentionList=this.mentionList.filter(x=>!read.includes(x));}
  this.renderRooms();}
 // ── The composer ────────────────────────────────────────────────────────────────────────
 count(){const input=$('chatInput'),left=LIMITS.body-(input.value||'').length,c=$('chatCount');c.textContent=String(left);c.classList.toggle('low',left<=20);c.hidden=left>60;
  input.style.height='auto';input.style.height=Math.min(input.scrollHeight,112)+'px';input.style.overflowY=input.scrollHeight>112?'auto':'hidden';this.composerState();if(this.editing)$('chatSend').disabled=!cleanText(input.value||'')&&!this.editing.moment;}
 insert(text){const input=$('chatInput'),at=input.selectionStart??input.value.length;input.value=(input.value.slice(0,at)+text+input.value.slice(input.selectionEnd??at)).slice(0,LIMITS.body);const c=Math.min(input.value.length,at+text.length);input.focus();try{input.setSelectionRange(c,c);}catch{}this.count();}
 hint(text){const h=$('chatHint');if(!h)return;h.textContent=text||this.staticHint||'';h.classList.toggle('warn',!!text);clearTimeout(this.hintTimer);this.hintTimer=0;if(text)this.hintTimer=setTimeout(()=>{this.hintTimer=0;h.classList.remove('warn');h.textContent=this.staticHint||'';},6000);}
 // A short note anywhere in chat (the composer may be hidden).
 flash(text){if(!$('chatForm').hidden)this.hint(text);else this.announce?.(text,'DAWG CHAT');}
 keys(e){const input=$('chatInput');
  if(!$('chatSuggest').hidden&&this.suggest.length){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();this.suggestAt=(this.suggestAt+(e.key==='ArrowDown'?1:-1)+this.suggest.length)%this.suggest.length;this.drawSuggest();return;}
   if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();this.pickSuggest(this.suggestAt);return;}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.closeSuggest();return;}}
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();this.send();return;}
  if(e.key==='ArrowUp'&&!input.value&&!this.editing){const m=lastEditable(this.list);if(m){e.preventDefault();this.edit(m);}}
  if(e.key==='Escape'&&(this.reply||this.editing)){e.preventDefault();e.stopPropagation();this.cancelContext();}}
 // @mention autocomplete from people in chat right now, recent chatters and staff.
 mentionMenu(){const input=$('chatInput'),q=mentionQuery(input.value,input.selectionStart??input.value.length);if(!q||!this.v2){this.closeSuggest();return;}
  const people=[...(this.presence.rooms[this.room]||[]),...[...this.list].reverse().filter(m=>!m.mine).map(m=>({name:m.player,code:m.code,role:m.role,level:m.level})),...this.staff].filter(p=>p.code!==this.myCode);
  this.suggest=mentionSuggest(q.query,people);this.mentionAt=q;this.suggestAt=0;if(!this.suggest.length){this.closeSuggest();return;}this.drawSuggest();}
 drawSuggest(){const box=$('chatSuggest');box.hidden=false;box.replaceChildren(...this.suggest.map((p,i)=>{const b=btn('','chat-suggest-item'+(i===this.suggestAt?' on':''));b.dataset.i=i;b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===this.suggestAt));
  b.append(el('b','','@'+p.handle));const badge=badgeOf(p.role);if(badge)b.append(el('em','chat-badge '+p.role,badge));if(p.name!==p.handle)b.append(el('small','',p.name));return b;}));}
 pickSuggest(i){const p=this.suggest[i],input=$('chatInput');if(!p||!this.mentionAt)return;const r=applyMention(input.value,this.mentionAt.start,input.selectionStart??input.value.length,p.handle);input.value=r.text;input.focus();try{input.setSelectionRange(r.caret,r.caret);}catch{}this.closeSuggest();this.count();}
 closeSuggest(){const box=$('chatSuggest');if(box&&!box.hidden){box.hidden=true;box.replaceChildren();}this.suggest=[];}
 replyTo(m){if(m.pending)return;this.editing=null;this.reply={id:m.id,player:m.mine?'yourself':m.player,body:m.body||m.moment?.title||''};this.context();$('chatInput').focus();}
 edit(m){if(!canEdit(m))return;this.reply=null;this.editing=m;const input=$('chatInput');input.value=m.body;this.context();input.focus();try{input.setSelectionRange(input.value.length,input.value.length);}catch{}this.count();}
 cancelContext(){const was=this.editing;this.reply=null;this.editing=null;this.context();if(was){$('chatInput').value='';this.count();}}
 context(){const bar=$('chatContext');const on=this.reply||this.editing;bar.hidden=!on;if(on){const label=this.editing?'EDITING YOUR MESSAGE':'REPLYING TO '+this.reply.player.toUpperCase();
  bar.replaceChildren(el('b','',label),el('span','',this.editing?this.editing.body:this.reply.body),btn('✕','chat-context-x'));bar.lastChild.dataset.act='cancel';bar.lastChild.setAttribute('aria-label','Cancel');}this.composerState();}
 async send(){const input=$('chatInput'),raw=input.value;if(this.sending)return;
  if(this.editing){const m=this.editing,c=checkPost(raw,m.moment);if(!c.ok&&!(c.reason==='empty'&&m.moment)){this.hint(reasonText(c.reason));return;}
   this.sending=true;try{await this.rpc('chat_edit',{p_id:m.id,p_body:c.ok?c.body:''});this.patch(m,{body:c.ok?c.body:'',edited:true});this.cancelContext();input.value='';this.count();this.refresh();}catch(error){this.hint(errorHint(error.message));}finally{this.sending=false;}return;}
  if(!cleanText(raw))return;
  const r=await this.submit(raw,null,{show:true,reply:this.reply?.id||null,announce:this.announceMode});
  if(r.ok){if(input.value===raw)input.value='';this.reply=null;this.context();this.announceMode=false;$('chatAnnounce').setAttribute('aria-pressed','false');this.count();this.hint('');this.divider=0;}else this.hint(r.reason);input.focus();}
 // Games and the results card post moments through here: chat.post(moment) → {ok, reason}.
 // Moments go to the room you're in; a game's own room (BITE NIGHT → #bite-night) if you're not in chat.
 post(moment,body=''){return this.submit(body,moment,{show:this.viewing,toast:true});}
 async submit(body,moment,{show=false,toast=false,reply=null,announce=false}={}){
  const c=checkPost(body,moment);if(!c.ok)return {ok:false,reason:reasonText(c.reason)};
  if(this.state==='soon'||this.installed===false)return {ok:false,reason:'DAWG Chat opens soon.'};
  if(!this.reach)return {ok:false,reason:'Chat needs the cloud connection. Try again in a moment.'};
  try{await this.detect();}catch{}
  const room=this.v2?this.room:ROOM,gate=postGate({me:this.v2?this.me:{role:'member',agreed:true},room:this.rooms.find(r=>r.slug===room)||{},hidden:this.hiddenFromBoards,lastAt:this.lastPost[room]||0,now:Date.now()});
  if(!gate.ok){if(gate.reason==='rules'&&!this.viewing)return {ok:false,reason:'Open DAWG Chat and agree to the rules first.'};
   return {ok:false,reason:gate.reason==='slow'?errorHint(`slow mode ${Math.ceil(gate.wait/1000)} seconds`):gate.reason==='timeout'?errorHint(`muted for ${Math.ceil(gate.wait/60000)} more minutes`):gate.reason==='hidden'?errorHint('public boards'):errorHint({banned:'banned from chat',rules:'agree to the chat rules',locked:'room is locked'}[gate.reason])};}
  const key=postKey(c.body,c.moment),pace=rateHint(this.sent,Date.now(),key);if(!pace.ok)return {ok:false,reason:reasonText(pace.reason)};
  const p=this.rankings?.profile,temp={id:this.tempId++,at:Date.now(),body:c.body,moment:c.moment,player:this.myName,code:p?.code||'',avatar:this.rankings?.kennel?.active||null,level:this.rankings?.stats?.().level||1,mine:true,reactions:{},my:null,pending:true,
   role:this.role,room,kind:announce?'announce':'msg',reply:reply?(()=>{const o=this.list.find(m=>m.id===reply);return o?{id:o.id,player:o.player,body:o.body||o.moment?.title||''}:{id:reply,player:'',body:''};})():null};
  if(show&&this.state==='ready'&&room===this.room){this.list=[...this.list,temp];this.render();this.toBottom(true);}
  this.sending=true;
  try{if(this.v2)await this.rpc('chat_send',{p_room:room,p_body:c.body,p_moment:c.moment,p_reply:reply,p_announce:!!announce});else await this.rpc('chat_post',{p_body:c.body,p_moment:c.moment});
   this.sent.push({at:Date.now(),key});this.sent=this.sent.slice(-40);this.lastPost[room]=Date.now();this.installed=true;
   this.list=this.list.filter(m=>m!==temp);this.rows.get(temp.id)?.remove();this.rows.delete(temp.id);
   if(this.viewing&&room===this.room){this.busy=false;await this.refresh();this.toBottom(true);}
   if(toast&&!this.viewing)this.announce?.(this.v2?`POSTED TO #${room.toUpperCase()}`:'POSTED TO DAWG CHAT','DAWG CHAT');
   return {ok:true};
  }catch(error){this.list=this.list.filter(m=>m!==temp);if(this.state==='ready')this.render();
   if(isMissing(error)&&!this.v2){this.setState('soon');return {ok:false,reason:'DAWG Chat opens soon.'};}
   if(/public boards/.test(error.message))this.notices();
   if(/banned|muted|rules|locked/.test(error.message)){try{this.me={...this.me,...await this.rpc('chat_me')};this.composerState();}catch{}}
   const slow=String(error.message).match(/slow mode (\d+) seconds/);if(slow)this.lastPost[room]=Date.now()-(this.current.slow-Number(slow[1]))*1000;
   return {ok:false,reason:errorHint(error.message)};
  }finally{this.sending=false;}
 }
 // POST TO CHAT on the results card.
 runButton(){const b=$('resultsChat');if(b)b.hidden=!this.installed||this.hiddenFromBoards||!!this.me?.banned;}
 async postRun(b){const r=this.lastRun?.();if(!r||!gameById(r.game))return;b.disabled=true;
  const res=await this.post(scoreMoment(r.game,r.score,{medal:this.medal?.(r)||0,best:!!r.best,detail:r.detail||''}));
  if(res.ok)b.textContent='POSTED ✓';else{b.disabled=false;this.announce?.(res.reason,'DAWG CHAT');}}
 // ── Clicks, the message menu and the player card ────────────────────────────────────────
 onClick(e){const t=e.target.closest('[data-act]'),row=e.target.closest('.chat-msg'),m=row?._m;if(!t||!m)return;const act=t.dataset.act,mo=m.moment;
  if(act==='card'){if(m.code&&!m.pending)this.person({code:m.code,name:m.player,level:m.level,role:m.role,avatar:m.avatar,self:m.mine},t);}
  else if(act==='menu'){if(this.menu&&this.menuRow===row)this.closeMenu();else this.openMenu(row);}
  else if(act==='reactpick'){if(this.menu&&this.menuRow===row)this.closeMenu();else this.openMenu(row,{reactOnly:true});}
  else if(act==='reply')this.replyTo(m);
  else if(act==='jump')this.jumpTo(Number(t.dataset.to));
  else if(act==='react')this.react(m,t.dataset.emoji);
  else if(act==='watch')this.watch(row);
  else if(act==='play'&&gameById(mo?.game)){this.stopMoment();this.play?.(mo.game);}
  else if(act==='challenge'&&gameById(mo?.game)){if(!m.mine&&m.code&&isMatchGame(mo.game))this.rankings.startMatch({player:m.player,friend_code:m.code,avatar:m.avatar},mo.game);else this.rankings.pickFriend(mo.game);}}
 place(menu,anchor,{right=false}={}){const panel=menu.parentElement,a=anchor.getBoundingClientRect(),p=panel.getBoundingClientRect(),h=menu.offsetHeight,w=menu.offsetWidth;
  let top=a.bottom-p.top+4;if(top+h>p.height-8)top=Math.max(8,a.top-p.top-h-4);menu.style.top=Math.max(8,Math.min(top,p.height-h-8))+'px';
  const left=right?a.right-p.left-w:a.left-p.left;menu.style.left=Math.max(8,Math.min(left,p.width-w-8))+'px';}
 openMenu(row,{reactOnly=false}={}){
  const m=row._m;if(!m||m.pending)return;this.closeMenu();this.closePop();const menu=el('div','chat-menu');menu.setAttribute('role','menu');this.menu=menu;this.menuRow=row;this.menuTop=this.box.scrollTop;row.classList.add('menu-open');
  const item=(label,on,cls)=>{const b=btn(label,'chat-menu-item'+(cls?' '+cls:''),()=>{this.closeMenu();on();});b.setAttribute('role','menuitem');return b;};
  const reacts=el('div','chat-menu-reacts');reacts.append(...EMOJI.map(e=>{const b=btn(e,'chat-emoji',()=>{this.closeMenu();this.react(m,e);});b.setAttribute('aria-pressed',String(m.my===e));b.setAttribute('aria-label','React '+e);return b;}));menu.append(reacts);
  if(!reactOnly){const role=this.role,target=m.role;
   menu.append(item('↩  Reply',()=>this.replyTo(m)));
   if(canEdit(m)&&this.v2)menu.append(item('✎  Edit',()=>this.edit(m)));
   const copy=[m.body,m.moment?m.moment.title+(m.moment.text?' · '+m.moment.text:''):''].filter(Boolean).join(' · ');
   menu.append(item('⧉  Copy text',async()=>{try{await navigator.clipboard.writeText(copy);this.flash('Copied.');}catch{this.flash('Couldn’t copy on this device.');}}));
   if(m.code&&!m.mine)menu.append(item(`👤  ${m.player}`,()=>this.person({code:m.code,name:m.player,level:m.level,role:m.role,avatar:m.avatar},row.querySelector('.chat-author')||row)));
   if(m.mine)menu.append(item('🗑  Delete my message',()=>this.confirm('Delete your message?','It disappears for everyone.','DELETE',()=>this.remove(m)),'danger'));
   else menu.append(item('⚑  Report message',()=>this.reportPick(m),'danger'));
   if(this.v2&&isStaff(role)){menu.append(el('small','chat-menu-label',role==='owner'?'OWNER TOOLS':'MOD TOOLS'));
    menu.append(item(m.pinned?'📌  Unpin':'📌  Pin to #'+this.current.title,()=>this.pin(m,!m.pinned)));
    if(!m.mine&&can(role,'delete',{target}))menu.append(item('🗑  Delete for everyone',()=>this.remove(m,true),'danger'));
    if(!m.mine&&m.code&&can(role,'timeout',{target}))menu.append(item('⏱  Time out…',()=>this.person({code:m.code,name:m.player,level:m.level,role:m.role,avatar:m.avatar},row.querySelector('.chat-author')||row),'danger'));}
   else if(this.v2===false&&this.rankings?.owner&&!m.mine){menu.append(el('small','chat-menu-label','ARCADE OWNER'),item('Delete for everyone',()=>this.remove(m,true),'danger'));if(m.code)menu.append(item('Mute for 1 hour',()=>this.timeout({code:m.code,name:m.player},60),'danger'));}}
  this.box.parentElement.append(menu);const anchor=row.querySelector('.chat-hover')||row;this.place(menu,reactOnly?anchor:row,{right:m.mine});
  (menu.querySelector('.chat-menu-item')||menu.querySelector('.chat-emoji'))?.focus({preventScroll:true});
 }
 closeMenu(){clearTimeout(this.press);if(!this.menu)return;this.menu.remove();this.menuRow?.classList.remove('menu-open');this.menu=this.menuRow=null;}
 reportPick(m){const panel=this.box.parentElement,menu=el('div','chat-menu');menu.setAttribute('role','menu');this.closeMenu();this.menu=menu;
  menu.append(el('small','chat-menu-label','WHY ARE YOU REPORTING IT?'),...REPORT_REASONS.map(r=>{const b=btn(r,'chat-menu-item',()=>{this.closeMenu();this.report(m,r);});b.setAttribute('role','menuitem');return b;}));
  panel.append(menu);const row=this.rows.get(m.id);if(row)this.place(menu,row,{right:m.mine});menu.querySelector('.chat-menu-item')?.focus({preventScroll:true});}
 // The player card: who they are, and what you can do with them (friend, challenge, moderate).
 person(p,anchor){if(!p?.code)return;this.closeMenu();this.closePop();const self=p.self||p.code===this.myCode,role=normRole(p.role),me=this.role;
  const pop=el('div','chat-pop');pop.setAttribute('role','dialog');pop.setAttribute('aria-label',p.name);this.pop=pop;this.popTop=this.box.scrollTop;
  const head=el('div','chat-pop-head');try{head.append(this.rankings.face(p.avatar||null,48));}catch{}const id=el('div','chat-pop-id');const name=el('b','',p.name);const badge=badgeOf(role);if(badge)name.append(el('em','chat-badge '+role,badge));
  id.append(name,el('small','',`Level ${p.level||1} · ${p.code}`));head.append(id);pop.append(head);
  const acts=el('div','chat-pop-acts');
  acts.append(btn('VIEW CARD','btn small',()=>{this.closePop();this.rankings.showCode(p.code);}));
  if(!self){acts.append(btn('ADD FRIEND','btn small',async()=>{const r=await this.rankings.follow(p.code);if(r)this.flash(`Added ${p.name} as a friend.`);this.closePop();}),
   btn('CHALLENGE','btn small pink',()=>{this.closePop();this.rankings.pickGame({player:p.name,friend_code:p.code,avatar:p.avatar});}));
   if(this.v2)acts.append(btn('@ MENTION','btn small',()=>{this.closePop();this.insert('@'+mentionHandle(p.name)+' ');}));}
  pop.append(acts);
  if(this.v2&&!self&&can(me,'timeout',{target:role})){const mod=el('div','chat-pop-mod');mod.append(el('small','chat-menu-label','TIME OUT'));const row=el('div','chat-pop-row');
   row.append(...TIMEOUTS[me].map(mins=>btn(timeoutLabel(mins).toUpperCase(),'btn small',()=>this.confirm(`Time out ${p.name} for ${timeoutLabel(mins)}?`,'They can read chat but not post until it ends. It goes in the moderation log.','TIME OUT',()=>this.timeout(p,mins)))));mod.append(row);
   const row2=el('div','chat-pop-row');
   if(can(me,'ban',{target:role}))row2.append(btn('BAN','btn small danger',()=>this.confirm(`Ban ${p.name} from chat?`,'They can still read and play, but can’t post, react or report until you unban them.','BAN',()=>this.ban(p))));
   if(can(me,'setRole',{target:role}))row2.append(btn(role==='mod'?'REMOVE MOD':'MAKE MOD','btn small',()=>this.confirm(role==='mod'?`Remove ${p.name} as a mod?`:`Make ${p.name} a mod?`,role==='mod'?'They go back to being a member.':'Mods can delete messages, time players out, pin messages, set slow mode and handle reports.',role==='mod'?'REMOVE':'MAKE MOD',()=>this.setRole(p.code,role==='mod'?'member':'mod',p.name))));
   if(row2.children.length)mod.append(row2);pop.append(mod);}
  $('chatShell').append(pop);const a=anchor?.getBoundingClientRect?.()?anchor:this.box;const s=$('chatShell').getBoundingClientRect(),r=a.getBoundingClientRect(),h=pop.offsetHeight,w=pop.offsetWidth;
  let top=r.bottom-s.top+6;if(top+h>s.height-8)top=r.top-s.top-h-6;pop.style.top=Math.max(8,Math.min(top,s.height-h-8))+'px';pop.style.left=Math.max(8,Math.min(r.left-s.left,s.width-w-8))+'px';
  pop.querySelector('button')?.focus({preventScroll:true});}
 closePop(){if(!this.pop)return;this.pop.remove();this.pop=null;}
 patch(m,change){const i=this.list.findIndex(x=>x.id===m.id);if(i<0)return;this.list[i]={...this.list[i],...change};this.render();}
 async react(m,emoji){if(m.pending||!EMOJI.includes(emoji))return;const cur=this.list.find(x=>x.id===m.id)||m;
  // Shown at once, then corrected by the server's count.
  const next={...cur.reactions},off=cur.my===emoji;if(cur.my){next[cur.my]=(next[cur.my]||1)-1;if(!next[cur.my])delete next[cur.my];}if(!off)next[emoji]=(next[emoji]||0)+1;this.patch(cur,{reactions:next,my:off?null:emoji});
  try{const r=await this.rpc('chat_react',{p_id:m.id,p_emoji:off?null:emoji});const fixed=normalizeRow({id:m.id,created_at:new Date(m.at).toISOString(),body:'x',reactions:r?.reactions,my_reaction:r?.mine});if(fixed)this.patch(cur,{reactions:fixed.reactions,my:fixed.my});}
  catch(error){this.patch(cur,{reactions:cur.reactions,my:cur.my});this.flash(errorHint(error.message));}}
 drop(m){this.list=this.list.filter(x=>x.id!==m.id);this.render();}
 async report(m,reason=''){try{await this.rpc('chat_report',{p_id:m.id,p_reason:reason});this.drop(m);this.flash('Reported. Thanks for looking out for the pack; the mods will take a look.');}catch(error){this.flash(errorHint(error.message));}}
 async remove(m,staff=false){try{await this.rpc('chat_delete',{p_id:m.id});this.drop(m);this.flash(staff?'Message removed for everyone. It’s in the mod log.':'Message deleted.');if(m.pinned)this.loadPins();}catch(error){this.flash(errorHint(error.message));}}
 async pin(m,on){try{await this.rpc('chat_pin',{p_id:m.id,p_on:on});this.patch(m,{pinned:on});this.loadPins();this.flash(on?'Pinned.':'Unpinned.');}catch(error){this.flash(errorHint(error.message));}}
 async timeout(p,minutes){try{const r=this.v2?await this.rpc('chat_timeout',{p_code:p.code,p_minutes:minutes,p_reason:''}):await this.rpc('chat_mute',{p_code:p.code,p_minutes:minutes});this.closePop();
   this.flash(minutes?`${r?.name||p.name} is timed out for ${timeoutLabel(minutes)}.`:`${r?.name||p.name} can post again.`);this.modRefresh();}catch(error){this.flash(errorHint(error.message));}}
 async ban(p,reason=''){try{const r=await this.rpc('chat_ban',{p_code:p.code,p_reason:reason});this.closePop();this.flash(`${r?.name||p.name} is banned from chat.`);this.modRefresh();this.loadStaff();}catch(error){this.flash(errorHint(error.message));}}
 async setRole(code,role,name=code){try{const r=await this.rpc('chat_set_role',{p_code:code,p_role:role});this.closePop();this.flash(role==='mod'?`${r?.name||name} is now a mod.`:`${r?.name||name} is no longer a mod.`);await this.loadStaff();this.modRefresh();this.refresh();return true;}catch(error){this.flash(errorHint(error.message));this.modNote(errorHint(error.message));return false;}}
 // ── Moderation panel (owner and mods) ───────────────────────────────────────────────────
 openMod(tab){if(!this.staffMode)return;this.drawer(null);this.closeMenu();this.closePop();const panel=$('chatMod');panel.hidden=false;$('chatShell').classList.add('show-mod');this.modTab=tab||this.modTab||'reports';this.modDraw();}
 closeMod(){const panel=$('chatMod');if(!panel||panel.hidden)return;panel.hidden=true;$('chatShell').classList.remove('show-mod');}
 modRefresh(){if(!$('chatMod').hidden)this.modDraw();}
 modNote(text){this.modMsg=text||'';const n=$('chatMod').querySelector('.chat-mod-note');if(n)n.textContent=this.modMsg;}
 async modDraw(){const panel=$('chatMod'),owner=this.role==='owner';
  const tabs=[['reports','Reports'],['sanctions','Timeouts & bans'],['staff','Staff'],['room','Room'],['rules','Rules'],['log','Mod log']];
  const head=el('header','chat-mod-head');const title=el('div');title.append(el('span','eyebrow',owner?'OWNER':'MOD'),el('h2','','Moderation'));head.append(title,btn('✕','chat-icon chat-mod-x',()=>this.closeMod()));head.lastChild.setAttribute('aria-label','Close moderation');
  const bar=el('nav','chat-mod-tabs');bar.setAttribute('role','tablist');bar.append(...tabs.map(([k,l])=>{const b=btn(l,'chat-mod-tab',()=>{this.modTab=k;this.modMsg='';this.modDraw();});b.setAttribute('role','tab');b.setAttribute('aria-selected',String(k===this.modTab));return b;}));
  const body=el('div','chat-mod-body'),note=el('p','chat-mod-note',this.modMsg||'');note.setAttribute('role','status');body.append(el('div','skeleton'),el('div','skeleton'));panel.replaceChildren(head,bar,note,body);
  const tab=this.modTab;try{const parts=await this['mod_'+tab]();if(this.modTab===tab&&!panel.hidden)body.replaceChildren(...parts);}catch(error){body.replaceChildren(el('p','chat-side-empty',errorHint(error.message)));}}
 codeForm(label,button,on,{minutes=false,reason=true}={}){const f=el('form','chat-mod-form');const code=el('input');code.placeholder='Friend code';code.maxLength=14;code.autocomplete='off';code.setAttribute('aria-label','Friend code');f.append(el('label','chat-mod-label',label),code);
  let mins=null;if(minutes){mins=el('select');for(const m of TIMEOUTS[this.role]){const o=el('option','',timeoutLabel(m));o.value=m;mins.append(o);}mins.value='60';mins.setAttribute('aria-label','How long');f.append(mins);}
  let why=null;if(reason){why=el('input');why.placeholder='Reason (optional)';why.maxLength=200;why.setAttribute('aria-label','Reason');f.append(why);}
  const go=el('button','btn small primary',button);go.type='submit';f.append(go);
  f.onsubmit=async e=>{e.preventDefault();const c=String(code.value||'').trim().toUpperCase().replace(/^GUEST\s+/,'');if(!/^[A-F0-9]{8}$/.test(c)){this.modNote('Friend codes are 8 letters and numbers, like 3FA9C210.');return;}go.disabled=true;try{await on(c,mins?Number(mins.value):0,why?.value||'');code.value='';if(why)why.value='';}finally{go.disabled=false;}};return f;}
 async mod_reports(){const rows=(await this.rpc('chat_report_queue'))||[];if(!rows.length)return [el('p','chat-side-empty','No open reports. The pack is behaving.')];
  return rows.map(r=>{const card=el('div','chat-mod-card'+(r.hidden?' hidden-msg':''));const top=el('div','chat-mod-meta');const role=normRole(r.role);
   top.append(el('b','',cleanText(r.player)),...(badgeOf(role)?[el('em','chat-badge '+role,badgeOf(role))]:[]),el('span','',`#${roomSlugOk(r.room)?r.room:'lobby'} · ${timeLabel(new Date(r.created_at).getTime())}`));
   card.append(top,el('p','chat-mod-quote',cleanText(r.body)||cleanText(r.moment_title)||'(a game moment)'));
   const reasons=(Array.isArray(r.reasons)?r.reasons:[]).map(x=>cleanText(x)).filter(Boolean);card.append(el('small','chat-mod-why',`⚑ ${Number(r.reporters)||1} report${Number(r.reporters)===1?'':'s'}${reasons.length?' · '+[...new Set(reasons)].join(', '):''}${r.hidden?' · hidden for now':''}`));
   const acts=el('div','chat-mod-acts'),id=Number(r.message_id),who={code:r.friend_code,name:cleanText(r.player),role};
   const act=async(fn,done)=>{try{await fn();this.modNote(done);this.modDraw();this.refresh();}catch(error){this.modNote(errorHint(error.message));}};
   acts.append(btn('DISMISS','btn small',()=>act(()=>this.rpc('chat_resolve_report',{p_id:id,p_action:'dismiss',p_reason:''}),'Dismissed. The message stays.')),
    btn('DELETE','btn small danger',()=>act(()=>this.rpc('chat_resolve_report',{p_id:id,p_action:'delete',p_reason:''}),'Message removed.')));
   if(can(this.role,'timeout',{target:role}))acts.append(btn('DELETE + TIME OUT 1 H','btn small danger',()=>act(async()=>{await this.rpc('chat_resolve_report',{p_id:id,p_action:'delete',p_reason:''});await this.rpc('chat_timeout',{p_code:who.code,p_minutes:60,p_reason:reasons[0]||'reported'});},`Removed, and ${who.name} is timed out for an hour.`)));
   if(can(this.role,'ban',{target:role}))acts.append(btn('DELETE + BAN','btn small danger',()=>this.confirm(`Ban ${who.name}?`,'The message is removed and they can’t post, react or report until you unban them.','BAN',()=>act(async()=>{await this.rpc('chat_resolve_report',{p_id:id,p_action:'delete',p_reason:''});await this.rpc('chat_ban',{p_code:who.code,p_reason:reasons[0]||'reported'});},`Removed, and ${who.name} is banned.`))));
   card.append(acts);return card;});}
 async mod_sanctions(){const rows=(await this.rpc('chat_sanctions'))||[],owner=this.role==='owner',out=[];
  out.push(this.codeForm('Time out a player','TIME OUT',async(code,mins,why)=>{try{const r=await this.rpc('chat_timeout',{p_code:code,p_minutes:mins,p_reason:why});this.modNote(`${r?.name||code} is timed out for ${timeoutLabel(mins)}.`);this.modDraw();}catch(e){this.modNote(errorHint(e.message));}},{minutes:true}));
  if(owner)out.push(this.codeForm('Ban a player','BAN',async(code,_,why)=>{try{const r=await this.rpc('chat_ban',{p_code:code,p_reason:why});this.modNote(`${r?.name||code} is banned.`);this.modDraw();}catch(e){this.modNote(errorHint(e.message));}}));
  out.push(el('p','chat-side-label',`ACTIVE · ${rows.length}`));if(!rows.length)out.push(el('p','chat-side-empty','Nobody is timed out or banned.'));
  for(const r of rows){const card=el('div','chat-mod-card');const ban=r.kind==='ban';const top=el('div','chat-mod-meta');top.append(el('b','',cleanText(r.player)),el('em','chat-badge '+(ban?'ban':'timeout'),ban?'BANNED':'TIMED OUT'),el('span','',ban?'permanent':'for '+waitLabel(new Date(r.until).getTime()-Date.now())));
   card.append(top,el('small','chat-mod-why',[r.reason?'Reason: '+cleanText(r.reason):'',r.by_player?'by '+cleanText(r.by_player):'',r.friend_code].filter(Boolean).join(' · ')));
   if(!ban||owner)card.append(btn(ban?'UNBAN':'LIFT','btn small',async()=>{try{if(ban)await this.rpc('chat_unban',{p_code:r.friend_code});else await this.rpc('chat_timeout',{p_code:r.friend_code,p_minutes:0,p_reason:''});this.modNote(`${cleanText(r.player)} can post again.`);this.modDraw();}catch(e){this.modNote(errorHint(e.message));}}));
   out.push(card);}return out;}
 async mod_staff(){await this.loadStaff();const owner=this.role==='owner',out=[];
  if(owner)out.push(this.codeForm('Make a player a mod','MAKE MOD',async code=>{if(await this.setRole(code,'mod'))this.modNote('Done. They see the mod tools next time they open chat.');},{reason:false}),
   el('p','chat-mod-help','Mods can delete members’ messages, time players out (5 min, 1 h, 1 day), pin messages, set slow mode and handle reports. Only you can ban, lock rooms, make mods and change the rules. Tip: tap anyone’s name in chat to make them a mod from their card.'));
  out.push(el('p','chat-side-label',`STAFF · ${this.staff.length}`));
  for(const s of this.staff){const card=el('div','chat-mod-card row');card.append(el('b','',s.name),el('em','chat-badge '+s.role,badgeOf(s.role)),el('small','',s.code));
   if(owner&&s.role==='mod')card.append(btn('REMOVE','btn small',()=>this.confirm(`Remove ${s.name} as a mod?`,'They go back to being a member.','REMOVE',()=>this.setRole(s.code,'member',s.name))));out.push(card);}
  return out;}
 async mod_room(){const r=this.current,owner=this.role==='owner',out=[el('p','chat-side-label','#'+r.title.toUpperCase())];
  const save=async(args,done)=>{try{await this.rpc('chat_room_settings',{p_room:r.slug,p_slow:null,p_locked:null,p_title:null,p_topic:null,p_archived:null,...args});this.modNote(done);await this.loadRooms();this.header();this.composerState();this.modDraw();}catch(e){this.modNote(errorHint(e.message));}};
  const slow=el('div','chat-mod-field');slow.append(el('label','chat-mod-label','Slow mode'));const seg=el('div','chat-mod-seg');
  for(const s of [0,5,10,30,60,300]){const b=btn(s?(s<60?s+' s':s/60+' min'):'Off','chat-mod-chip',()=>save({p_slow:s},s?`Slow mode: one message every ${s<60?s+' seconds':s/60+' minutes'}.`:'Slow mode is off.'));b.setAttribute('aria-pressed',String(r.slow===s));seg.append(b);}slow.append(seg);out.push(slow);
  if(owner){const lock=btn(r.locked?'UNLOCK ROOM':'LOCK ROOM','btn small'+(r.locked?'':' danger'),()=>save({p_locked:!r.locked},r.locked?'Room unlocked.':'Room locked: only staff can post.'));
   const topic=el('form','chat-mod-form');const ti=el('input');ti.value=r.topic;ti.maxLength=120;ti.setAttribute('aria-label','Topic');const tb=el('button','btn small','SAVE TOPIC');tb.type='submit';topic.append(el('label','chat-mod-label','Topic'),ti,tb);topic.onsubmit=e=>{e.preventDefault();save({p_topic:ti.value},'Topic saved.');};
   const name=el('form','chat-mod-form');const ni=el('input');ni.value=r.title;ni.maxLength=32;ni.setAttribute('aria-label','Room name');const nb=el('button','btn small','RENAME');nb.type='submit';name.append(el('label','chat-mod-label','Name'),ni,nb);name.onsubmit=e=>{e.preventDefault();save({p_title:ni.value.trim().toLowerCase()},'Renamed.');};
   out.push(lock,topic,name);if(r.slug!==ROOM)out.push(btn(r.archived?'RESTORE ROOM':'ARCHIVE ROOM','btn small',()=>this.confirm(r.archived?`Restore #${r.title}?`:`Archive #${r.title}?`,r.archived?'It shows in everyone’s room list again.':'It disappears from members’ room lists. Messages are kept; you can restore it.',r.archived?'RESTORE':'ARCHIVE',()=>save({p_archived:!r.archived},r.archived?'Restored.':'Archived.'))));
   const make=el('form','chat-mod-form');const si=el('input');si.placeholder='new-room';si.maxLength=24;si.setAttribute('aria-label','New room name');const st=el('input');st.placeholder='Topic';st.maxLength=120;st.setAttribute('aria-label','New room topic');const sb=el('button','btn small primary','CREATE ROOM');sb.type='submit';
   make.append(el('label','chat-mod-label','New room'),si,st,sb);make.onsubmit=async e=>{e.preventDefault();try{const res=await this.rpc('chat_room_create',{p_slug:si.value.trim().toLowerCase(),p_topic:st.value});await this.loadRooms();this.modNote(`#${res?.slug||si.value} is open.`);si.value=st.value='';}catch(err){this.modNote(errorHint(err.message));}};
   out.push(el('p','chat-side-label','NEW ROOM'),make);}
  out.push(el('p','chat-side-label',`PINNED · ${this.pins.length}`));if(!this.pins.length)out.push(el('p','chat-side-empty','Nothing pinned. Pin from any message’s ⋯ menu.'));
  for(const p of this.pins){const card=el('div','chat-mod-card row pin');card.append(el('b','',p.player),el('span','chat-mod-quote',p.body||p.moment?.title||''),btn('UNPIN','btn small',()=>this.pin(p,false).then(()=>this.modDraw())));out.push(card);}
  return out;}
 async mod_rules(){const owner=this.role==='owner',out=[];try{this.me={...this.me,...await this.rpc('chat_me')};}catch{}
  if(!owner){out.push(el('div','chat-rules-text',cleanRules(this.me.rules)),el('p','chat-mod-help','Only the owner can change the rules.'));return out;}
  const f=el('form','chat-mod-form col');const ta=el('textarea');ta.value=this.me.rules||'';ta.maxLength=2000;ta.rows=9;ta.setAttribute('aria-label','Chat rules');const go=el('button','btn small primary','SAVE RULES');go.type='submit';
  f.append(el('label','chat-mod-label',`Chat rules · version ${this.me.rules_version||1}`),ta,el('p','chat-mod-help','Saving asks every member to read and agree again before they post.'),go);
  f.onsubmit=e=>{e.preventDefault();this.confirm('Save the new rules?','Every member agrees again before their next message.','SAVE',async()=>{try{this.me={...this.me,...await this.rpc('chat_set_rules',{p_text:ta.value})};this.modNote(`Saved. Rules are now version ${this.me.rules_version}.`);}catch(err){this.modNote(errorHint(err.message));}});};
  out.push(f);return out;}
 async mod_log(){const rows=(await this.rpc('chat_mod_log',{p_before:null,p_limit:60}))||[];if(!rows.length)return [el('p','chat-side-empty','No moderation yet. Everything staff do shows up here.')];
  return rows.map(r=>{const d=el('div','chat-log');const when=new Date(r.at);d.append(el('time','',isFinite(when)?when.toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):''),el('span','',logLine(r)));if(r.reason)d.append(el('small','','“'+cleanText(r.reason)+'”'));return d;});}
}
// The rules text, shown as plain lines.
function cleanRules(t){return String(t||'Be kind. Keep it clean. No spam. Never share personal details.').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').slice(0,2000);}
