// DAWG Chat, the pure core: the same checks the server runs (supabase/migrations/20261114000000_chat.sql
// and 20261115000000_chat_v2.sql) for text, moments, pace, roles, rooms, mentions, replies and edits,
// plus merging pages and formatting. No DOM here; dist/chat.js is the view and re-exports all of this.
import {gameById} from './games.js';
import {timeAgo} from './shell.js';
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
export function errorHint(message){const m=String(message||''),muted=m.match(/muted for (\d+) more minutes?/),slow=m.match(/slow mode (\d+) seconds/);
 return muted?`You’re muted in chat for ${muted[1]} more minute${muted[1]==='1'?'':'s'}.`
  :/slow down/.test(m)?WHY.gap:/too many messages/.test(m)?WHY.burst:/duplicate message/.test(m)?WHY.repeat
  :/message not allowed/.test(m)?WHY.words:/message too long/.test(m)?WHY.long:/empty message/.test(m)?WHY.empty:/bad moment/.test(m)?WHY.moment
  :/public boards/.test(m)?'Turn on “Show me on public boards” in Me to post. You can still read along.'
  :/no such message/.test(m)?'That message is gone.':/your own message/.test(m)?'That’s your own message.':/not your message/.test(m)?'You can only delete your own messages.'
  :/too many reports/.test(m)?'That’s a lot of reports for one day. Thanks; we’ll take it from here.':/only the arcade owner/.test(m)?'Only the arcade owner can do that.'
  :/no player/.test(m)?'No player has that code.':/sign in first|cloud connection|Failed to fetch|NetworkError/i.test(m)?'Chat needs the cloud connection. Try again in a moment.'
  :/banned from chat/.test(m)?'You’re banned from DAWG Chat.':/agree to the chat rules|rules changed/.test(m)?'Read and agree to the chat rules first.'
  :/room is locked/.test(m)?'This room is locked. Only the owner and mods can post here.':slow?`Slow mode is on here. Wait ${slow[1]} more second${slow[1]==='1'?'':'s'}.`
  :/too late to edit/.test(m)?'Messages can be edited for 5 minutes.':/only staff/.test(m)?'Only the owner and mods can do that.':/can not moderate/.test(m)?'You can’t moderate that player.'
  :/mods can time out/.test(m)?'Mods can time out for 5 minutes, 1 hour or 1 day.':/no such room/.test(m)?'That room is closed.':/10 pins/.test(m)?'A room holds 10 pins at most. Unpin one first.'
  :/room names/.test(m)?'Room names are 2 to 24 lowercase letters, numbers and dashes.':/twenty rooms/.test(m)?'Twenty rooms at most.':/lobby stays open/.test(m)?'The lobby stays open.'
  :/rules are 10 to 2000/.test(m)?'Rules are 10 to 2000 characters.':/unknown role/.test(m)?'Unknown role.'
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
  level:level>=1&&level<=99?level:1,mine:r.mine===true,reactions,my:EMOJI.includes(r.my_reaction)?r.my_reaction:null,
  role:normRole(r.role),room:roomSlugOk(r.room)?r.room:ROOM,edited:r.edited===true,pinned:r.pinned===true,kind:r.kind==='announce'?'announce':'msg',mentionsMe:r.mentions_me===true,
  reply:Number.isSafeInteger(Number(r.reply_id))&&Number(r.reply_id)>0?{id:Number(r.reply_id),player:typeof r.reply_player==='string'?cleanText(r.reply_player).slice(0,24):'',body:typeof r.reply_body==='string'?cleanText(r.reply_body).slice(0,90):''}:null};
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
  const first=newDay||p.mine!==m.mine||p.code!==m.code||p.player!==m.player||m.at-p.at>300000||!!p.moment||!!m.moment||p.kind==='announce'||m.kind==='announce'||!!m.reply;
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

// ── v2: rooms, roles, mentions, replies, edits, moderation ────────────────────────────────────
// The rooms every arcade starts with (the server's chat_rooms seeds the same five).
export const DEFAULT_ROOMS=[
 {slug:'lobby',title:'lobby',topic:'Hang out with the whole pack.'},
 {slug:'bite-night',title:'bite-night',topic:'BITE NIGHT: finishers, matchups and rematches.'},
 {slug:'it-learns',title:'it-learns',topic:'IT LEARNS: how far did the House let you get?'},
 {slug:'help',title:'help',topic:'Stuck? Ask the pack.'},
 {slug:'looking-for-match',title:'looking-for-match',topic:'Find someone to play. Post your game and friend code.'}];
export const roomSlugOk=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9-]{1,23}$/.test(s);
// One row from chat_rooms, checked; null if it isn't a room.
export function normalizeRoom(r){
 if(!r||!roomSlugOk(r.slug))return null;const slow=Math.floor(Number(r.slow_seconds)||0),last=Number(r.last_id);
 return {slug:r.slug,title:cleanText(r.title).slice(0,32)||r.slug,topic:cleanText(r.topic).slice(0,120),locked:r.locked===true,archived:r.archived===true,
  slow:slow>0&&slow<=3600?slow:0,lastId:Number.isSafeInteger(last)&&last>0?last:0,sort:Number.isFinite(Number(r.sort))?Number(r.sort):100};
}
// A game a moment comes from belongs in its own room as well as wherever it was posted.
export const roomForGame=game=>game==='fight'?'bite-night':game==='nemesis'?'it-learns':null;

// Roles: the owner (arcade_owners), mods (made by the owner) and members.
export const ROLES=['member','mod','owner'];
export const normRole=r=>r==='owner'||r==='mod'?r:'member';
export const isStaff=r=>r==='owner'||r==='mod';
export const badgeOf=r=>r==='owner'?'OWNER':r==='mod'?'MOD':'';
// Time-out lengths in minutes: mods get three, the owner also a week.
export const TIMEOUTS={mod:[5,60,1440],owner:[5,60,1440,10080]};
export const timeoutLabel=m=>m<60?m+' min':m<1440?m/60+' h':m<10080?m/1440+' day'+(m===1440?'':'s'):m/10080+' week'+(m===10080?'':'s');
// The server's chat_can_moderate: nobody moderates the owner, only the owner moderates mods,
// and nobody moderates themselves.
export function canModerate(me,target,self=false){me=normRole(me);target=normRole(target);return isStaff(me)&&!self&&target!=='owner'&&(target==='member'||me==='owner');}
// What a player with role `me` may do, mirroring the checks in the SQL functions. The server
// decides; this only decides which buttons to show.
export function can(me,action,{target='member',mine=false}={}){
 me=normRole(me);const owner=me==='owner',staff=isStaff(me);
 switch(action){
  case 'post':case 'react':case 'report':return true;
  case 'delete':return mine||canModerate(me,target)||owner;
  case 'timeout':return canModerate(me,target,mine);
  case 'ban':case 'unban':return owner&&canModerate(me,target,mine);
  case 'setRole':return owner&&!mine&&normRole(target)!=='owner';
  case 'pin':case 'slow':case 'queue':case 'log':case 'sanctions':case 'postLocked':return staff;
  case 'lock':case 'rooms':case 'rules':case 'announce':case 'archive':return owner;
  default:return false;}
}
// Edits: your own message, within 5 minutes, not while it is still sending.
export const EDIT_MS=300000;
export const canEdit=(m,now=Date.now())=>!!m&&m.mine===true&&!m.pending&&!!m.body&&now-m.at<EDIT_MS;
// The newest of your own messages you can still edit (Up arrow in an empty composer).
export const lastEditable=(list,now=Date.now())=>[...(list||[])].reverse().find(m=>canEdit(m,now))||null;

// Mentions: @Name, with spaces in names written as _ (@Top_Dog), or @Guest_3FA9C210.
// Not inside words or e-mail addresses. Same pattern as chat_mentions_in in the SQL.
export const MENTION=/(^|[^A-Za-z0-9_])@([A-Za-z0-9](?:[A-Za-z0-9_.-]{0,22}[A-Za-z0-9])?)/g;
export const mentionHandle=name=>cleanText(name).replace(/ /g,'_');
export function mentionTokens(body){const out=[];for(const m of String(body||'').matchAll(MENTION)){const h=m[2].toLowerCase();if(!out.includes(h))out.push(h);if(out.length===5)break;}return out;}
export const mentions=(body,name)=>!!name&&mentionTokens(body).includes(mentionHandle(name).toLowerCase());
// Splits text into plain and mention parts for display: [{text, mention?}].
export function mentionParts(body){const s=String(body||''),out=[];let at=0;
 for(const m of s.matchAll(MENTION)){const start=m.index+m[1].length;if(start>at)out.push({text:s.slice(at,start)});out.push({text:'@'+m[2],mention:m[2].toLowerCase()});at=start+1+m[2].length;}
 if(at<s.length)out.push({text:s.slice(at)});return out;}
// The @word being typed at the caret, if any: {start, query}.
export function mentionQuery(text,caret){const before=String(text||'').slice(0,caret),m=before.match(/(^|[^A-Za-z0-9_])@([A-Za-z0-9_.-]{0,23})$/);return m?{start:before.length-m[2].length-1,query:m[2]}:null;}
// Who to suggest: names starting with the query first, then names containing it.
export function mentionSuggest(query,people,limit=6){const q=String(query||'').toLowerCase(),seen=new Set(),starts=[],has=[];
 for(const p of people||[]){const h=mentionHandle(p.name);const k=h.toLowerCase();if(!h||seen.has(k))continue;seen.add(k);if(k.startsWith(q))starts.push({...p,handle:h});else if(q&&k.includes(q))has.push({...p,handle:h});}
 return [...starts,...has].slice(0,limit);}
// Puts @handle in place of the @word being typed.
export function applyMention(text,start,caret,handle){const s=String(text||''),ins='@'+handle+' ',next=(s.slice(0,start)+ins+s.slice(caret)).slice(0,LIMITS.body);return {text:next,caret:Math.min(next.length,start+ins.length)};}

// Slow mode: how long (ms) until this player may post again in a room. Staff are exempt.
export function slowWait(lastAt,slowSeconds,now,role){if(isStaff(role)||!slowSeconds||!lastAt)return 0;return Math.max(0,lastAt+slowSeconds*1000-now);}
// Can this player post in this room right now, and if not, why: banned, rules, timeout,
// hidden (from public boards), locked, slow. wait is milliseconds where it applies.
export function postGate({me={},room={},hidden=false,lastAt=0,now=Date.now()}={}){
 const role=normRole(me.role);
 if(me.banned)return {ok:false,reason:'banned',wait:0};
 if(hidden)return {ok:false,reason:'hidden',wait:0};
 const until=me.muted_until?new Date(me.muted_until).getTime():0;if(until>now)return {ok:false,reason:'timeout',wait:until-now};
 if(!isStaff(role)&&me.agreed===false)return {ok:false,reason:'rules',wait:0};
 if(room.locked&&!isStaff(role))return {ok:false,reason:'locked',wait:0};
 const w=slowWait(lastAt,room.slow,now,role);if(w>0)return {ok:false,reason:'slow',wait:w};
 return {ok:true,reason:'',wait:0};
}
// "23 min", "5 h", "2 days".
export function waitLabel(ms){const s=Math.ceil(Math.max(0,ms)/1000);return s<60?s+' s':s<3600?Math.ceil(s/60)+' min':s<86400?Math.ceil(s/3600)+' h':Math.ceil(s/86400)+' days';}

// Presence: Supabase's presence state {key: [meta, ...]} → who is in which room.
export function presenceRooms(state){const rooms={},seen=new Set();
 for(const metas of Object.values(state||{}))for(const m of Array.isArray(metas)?metas:[]){
  const code=typeof m?.code==='string'&&/^[A-F0-9]{8}$/.test(m.code)?m.code:'';if(!code||seen.has(code))continue;seen.add(code);
  const room=roomSlugOk(m.room)?m.room:ROOM,lv=Math.floor(Number(m.level));
  (rooms[room]??=[]).push({code,name:cleanText(m.name).slice(0,24)||'Guest '+code,level:lv>=1&&lv<=99?lv:1,role:normRole(m.role)});}
 for(const list of Object.values(rooms))list.sort((a,b)=>ROLES.indexOf(b.role)-ROLES.indexOf(a.role)||a.name.localeCompare(b.name));
 return {rooms,total:seen.size};}
// Typing line for the people typing in this room (not you), newest first.
export function typingLine(names){const n=[...new Set((names||[]).map(x=>cleanText(x).slice(0,24)).filter(Boolean))];
 return !n.length?'':n.length===1?`${n[0]} is typing…`:n.length===2?`${n[0]} and ${n[1]} are typing…`:n.length===3?`${n[0]}, ${n[1]} and ${n[2]} are typing…`:'Several people are typing…';}
// Where the "New messages" line goes: before the first message from someone else newer than
// what this player had seen when they opened the room. -1 for none.
export const unreadIndex=(list,seenId)=>!seenId?-1:(list||[]).findIndex(m=>!m.pending&&!m.mine&&m.id>seenId);

export const REPORT_REASONS=['Spam or flooding','Harassment or bullying','Hate or slurs','Personal information','Something else'];
// A curated emoji set for the composer (reactions stay the six in EMOJI).
export const EMOJI_PICKER=['😀','😂','🤣','😅','😎','🤩','🥳','😤','😭','😱','🤔','🙃','😴','🤯','👀','🙏','👍','👎','👏','🙌','💪','🤝','✌️','🫡','🔥','💯','✨','⚡','💥','🏆','🥇','🎯','🎮','🕹️','🏁','🎉','💀','👻','🤖','🐶','🐕','🦴','🐾','💜','❤️','💚','🖤','⭐'];
// One mod-log entry in words.
export function logLine(e){const who=cleanText(e?.actor)||'Someone',to=cleanText(e?.target)||'a player',room=roomSlugOk(e?.room)?' in #'+e.room:'',d=e?.detail&&typeof e.detail==='object'?e.detail:{},mins=Number(d.minutes);
 switch(e?.action){
  case 'delete':return `${who} deleted a message by ${to}${room}`;
  case 'timeout':return `${who} timed out ${to} for ${Number.isFinite(mins)&&mins>0?timeoutLabel(mins):'a while'}`;
  case 'untimeout':return `${who} lifted ${to}’s time-out`;
  case 'ban':return `${who} banned ${to}`;case 'unban':return `${who} unbanned ${to}`;
  case 'make_mod':return `${who} made ${to} a mod`;case 'remove_mod':return `${who} removed ${to} as a mod`;
  case 'pin':return `${who} pinned a message by ${to}${room}`;case 'unpin':return `${who} unpinned a message${room}`;
  case 'report_dismiss':return `${who} dismissed reports on a message by ${to}${room}`;case 'report_delete':return `${who} removed a reported message by ${to}${room}`;
  case 'room':{const parts=[];if(d.slow!==undefined)parts.push(d.slow?`slow mode ${d.slow}s`:'slow mode off');if(d.locked!==undefined)parts.push(d.locked?'locked':'unlocked');if(d.archived!==undefined)parts.push(d.archived?'archived':'restored');if(d.title!==undefined)parts.push('renamed');if(d.topic!==undefined)parts.push('new topic');return `${who} changed #${e.room||'room'}: ${parts.join(', ')||'settings'}`;}
  case 'room_create':return `${who} opened #${e.room||'a new room'}`;
  case 'rules':return `${who} updated the chat rules`;
  case 'announce':return `${who} posted an announcement${room}`;
  default:return `${who}: ${cleanText(e?.action)||'action'}`;}
}
