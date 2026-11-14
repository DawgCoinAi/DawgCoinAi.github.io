// Test backend for DAWG Chat, loaded only with ?debug=chat. It stands in for the server
// functions and for Realtime, in memory (nothing is sent anywhere), and applies the same rules
// as the SQL through chat-core.js, so the whole chat can be tried before the migration is run.
//   &chatrole=member|mod|owner   who you are (default member)
//   &chatrules=1                 you haven't agreed to the rules yet
//   &chatv1=1                    only the v1 functions exist (one room, no staff tools)
//   &chatmissing=1               no chat functions at all ("Chat opens soon")
//   &chatnolive=1                Realtime is down (polling only)
//   &chatbots=1                  other players type and post every few seconds
// From the console: __dawgChat.debugIncoming('hi'), .debugBot(), .debugTyping('Moxie'),
// .debugTimeout(minutes), .debugBan(), .debugLock(), .debugSlow(seconds).
import {EMOJI,LIMITS,checkPost,rateHint,postKey,normRole,isStaff,canModerate,TIMEOUTS,mentionTokens,mentionHandle,cleanText,DEFAULT_ROOMS} from './chat-core.js';

const NAMES=['Biscuit','Moxie','Nova','TopX','Pepper','Waffles','Rex','Luna','Guest 3FA9C210','Ziggy'];
const LINES=['anyone beaten 40k on Neon Pinball yet?','that last loop in Turbo Pup is evil','gg','who wants a chess match','first gold medal today!!','the Warden got me again','lol','new here, what should I play first?','Drift Dawgs rooftop shortcut is so good',
 'http://example.com is just text here, not a link','<b>markup</b> shows as plain text','ok one more run','posting my score, come beat it','good boy energy only','brb walking the actual dog'];
const ROOM_LINES={'bite-night':['Thunder Fetch is broken lol','who mains Moxie?','rooftop stage is the best one','rematch me, I was lagging'],'it-learns':['it learned my dodge pattern in 2 runs','wave 9 is brutal','tip: change your rhythm every wave'],
 help:['how do I unlock Drift Dawgs?','play any game to level up, it opens at level 6','thanks!'],'looking-for-match':['chess anyone? code 3FA9C210','DAWG Dash match, same course, loser buys treats']};
const code=i=>(0x3FA9C210+i*7919).toString(16).toUpperCase().padStart(8,'0').slice(-8);
const ROLE_OF={3:'owner',1:'mod'};

// A viewer in the shape games ship as dist/<game>-replay.js (see CHAT-CONTRACT).
export const demoReplay={
 MOMENT_KINDS:['finisher'],
 validMoment:d=>!!d&&d.v===1&&typeof d.winner==='string'&&typeof d.loser==='string'&&Number.isFinite(d.seed),
 draw(c,d,t){const w=c.canvas.width,h=c.canvas.height;c.fillStyle='#14171b';c.fillRect(0,0,w,h);c.fillStyle='#252a32';c.fillRect(0,h*.78,w,h*.22);
  const hit=Math.min(1,t/1.2),x=w*(.2+.42*hit);c.fillStyle='#c6ff3a';c.fillRect(x-18,h*.48,36,h*.3);c.fillStyle='#ff5b2e';c.save();c.translate(w*.72+hit*w*.08,h*.63);c.rotate(hit*1.3);c.fillRect(-18,-h*.15,36,h*.3);c.restore();
  c.fillStyle='#fff';c.font='800 '+Math.round(h*.12)+'px sans-serif';c.textAlign='center';if(hit>=1)c.fillText(d.winner.toUpperCase()+' WINS',w/2,h*.28);},
 async playMoment(host,d){const cv=document.createElement('canvas');cv.width=640;cv.height=360;cv.style.cssText='width:100%;height:100%;display:block';host.append(cv);const c=cv.getContext('2d'),t0=performance.now();
  let on=true;const timer=setInterval(()=>{if(on)demoReplay.draw(c,d,((performance.now()-t0)/1000)%3);},33);demoReplay.draw(c,d,0);globalThis.__dawgChatDemo={playing:true};
  return {stop(){on=false;clearInterval(timer);cv.remove();globalThis.__dawgChatDemo={playing:false};}};},
 momentPoster(d){const cv=document.createElement('canvas');cv.width=320;cv.height=180;demoReplay.draw(cv.getContext('2d'),d,2);return cv;}
};

export function install(chat){
 const params=new URLSearchParams(location.search),flag=k=>!!params.get(k),now=Date.now();
 const ME=8,myRole=normRole(params.get('chatrole'));
 // You: a public player with a name, so mentions and badges work without the cloud.
 if(!chat.rankings.profile)chat.rankings.profile={name:'Rover',code:'C0FFEE00',public:true};
 const myCode='C0FFEE00',myName='Rover';
 // The real cloud may sign in a guest in the background; chat speaks as Rover either way.
 Object.defineProperty(chat,'myName',{get:()=>myName,configurable:true});Object.defineProperty(chat,'hiddenFromBoards',{get:()=>false,configurable:true});
 const people=NAMES.map((name,i)=>({i,name,code:code(i),level:1+i*4,role:ROLE_OF[i]||'member'}));people[ME]={i:ME,name:myName,code:myCode,level:7,role:myRole};
 const by=c=>people.find(p=>p.code===c);
 const rooms=DEFAULT_ROOMS.map((r,i)=>({...r,sort:(i+1)*10,locked:false,slow_seconds:0,archived:false}));
 const rows=[],reports=new Map(),reactions=new Map(),mutes=new Map(),bans=new Map(),log=[],sent=[],lastIn={};let next=1,logId=1,rules='1. Be kind. No insults, slurs, threats or bullying.\n2. Keep it clean.\n3. No spam or flooding.\n4. Never share personal details.\n5. Mods keep the peace; their call is final.',rulesV=1,agreed=flag('chatrules')?0:1;
 const add=(who,body,moment,ago,extra={})=>{const p=people[who];const r={id:next++,room:'lobby',created_at:new Date(Date.now()-ago*1000).toISOString(),body,moment,author:p.code,reply_to:null,edited:false,pinned:false,kind:'msg',mentions:mentionTokens(body),...extra};rows.push(r);return r;};
 for(let i=0;i<118;i++)add(i*7%NAMES.length===ME?0:i*7%NAMES.length,LINES[(i*7+3)%LINES.length],null,90000-i*700);
 for(const [room,lines] of Object.entries(ROOM_LINES))lines.forEach((l,i)=>add((i*3+1)%8,l,null,4000-i*300,{room}));
 add(1,'',{kind:'score',game:'pinball',title:'48,200 in Neon Pinball',text:'new personal best · gold medal · wizard mode',data:{v:1,score:48200,medal:3,best:true}},1500);reactions.set(rows.at(-1).id,new Map([['a','🔥'],['b','🔥'],['c','🔥'],['d','🔥'],['e','👏'],['f','👏']]));
 const fin=add(0,'watch this',{kind:'finisher',game:'demo',title:'BISCUIT finished MOXIE',text:'Thunder Fetch · flawless · round 2',data:{v:1,winner:'biscuit',loser:'moxie',move:'thunder_fetch',stage:'rooftop',seed:12345}},900);reactions.set(fin.id,new Map([['a','💀'],['b','💀'],[myCode,'💀'],['c','😂']]));
 add(2,'',{kind:'finisher',game:'fight',title:'NOVA finished REX',text:'Moon Howl · round 3',data:{v:1,winner:'nova',loser:'rex',move:'moon_howl',stage:'docks',seed:77}},700);
 add(4,'',{kind:'feat',game:'mystery',title:'Pepper found the secret room',text:'a game this arcade doesn’t know yet',data:{v:1}},500);
 const welcome=add(3,'Welcome to DAWG Chat! Be kind, post your best runs, and have fun. 🐶',null,320,{kind:'announce'});welcome.pinned=true;welcome.pinned_at=Date.now()-300000;
 add(3,'be nice, post your best runs',null,280);
 const q=add(5,'gg all, who’s up for a Dash match?',null,120);reactions.set(q.id,new Map([['a','💜']]));
 add(2,`@${mentionHandle(myName)} you in? same course, loser buys treats`,null,90,{reply_to:q.id});
 add(6,'Rex here. that Warden is a menace',null,40);
 const meNow=()=>people[ME];
 const fail=text=>{throw new Error(text);},vis=r=>!r.deleted&&!(r.hidden&&r.author!==myCode)&&!reports.get(r.id)?.has(myCode);
 const timedOut=c=>(mutes.get(c)?.until||0)>Date.now();
 const logIt=(action,target,extra={})=>log.push({id:logId++,at:new Date().toISOString(),actor:myName,actor_code:myCode,action,target:target?by(target)?.name||target:null,target_code:target||null,reason:'',detail:null,...extra});
 const shape=r=>{const p=by(r.author),re=reactions.get(r.id)||new Map(),counts={};for(const e of re.values())counts[e]=(counts[e]||0)+1;const o=r.reply_to?rows.find(x=>x.id===r.reply_to):null,ov=o&&!o.deleted&&!o.hidden;
  return {id:r.id,room:r.room,created_at:r.created_at,body:r.body,moment:r.moment,player:p?.name||'Guest',friend_code:r.author,avatar:null,level:p?.level||1,role:p?.role||'member',mine:r.author===myCode,reactions:counts,my_reaction:re.get(myCode)||null,
   reply_id:r.reply_to,reply_player:ov?by(o.author)?.name:null,reply_body:ov?(o.body||o.moment?.title||'').slice(0,90):null,edited:!!r.edited,pinned:!!r.pinned,kind:r.kind,mentions_me:mentionTokens(r.body).includes(mentionHandle(myName).toLowerCase())&&r.author!==myCode};};
 const room=s=>rooms.find(r=>r.slug===s);
 const touch=r=>{if(live.ok)setTimeout(()=>live.h?.onChange({id:r.id,room:r.room,deleted:!!r.deleted,hidden:!!r.hidden,pinned_at:r.pinned?1:null},'UPDATE'),30);};
 const insertSignal=r=>{if(live.ok)setTimeout(()=>live.h?.onChange({id:r.id,room:r.room,deleted:false,hidden:false},'INSERT'),30);};
 const meJson=()=>({role:meNow().role,code:myCode,rules,rules_version:rulesV,agreed:agreed>=rulesV,muted_until:timedOut(myCode)?new Date(mutes.get(myCode).until).toISOString():null,banned:bans.has(myCode),ban_reason:bans.get(myCode)?.reason||null});
 const staff=()=>isStaff(meNow().role)||fail('only staff can do that'),owner=()=>meNow().role==='owner'||fail('only the arcade owner can do that');
 const target=c=>{const p=by(String(c||'').trim().toUpperCase());if(!p)fail('no player with that friend code');return p;};
 const moderatable=p=>canModerate(meNow().role,p.role,p.code===myCode)||fail('you can not moderate that player');
 const V2={
  chat_me:()=>meJson(),
  chat_agree:a=>{if(a.p_version!==rulesV)fail('the rules changed, read them again');agreed=rulesV;return meJson();},
  chat_rooms:()=>rooms.filter(r=>!r.archived||isStaff(meNow().role)).map(r=>({...r,last_id:Math.max(0,...rows.filter(x=>x.room===r.slug&&!x.deleted).map(x=>x.id)),last_at:null})),
  chat_feed:a=>rows.filter(r=>r.room===(a.p_room||'lobby')&&vis(r)&&(a.p_before==null||r.id<a.p_before)&&(a.p_after==null||r.id>a.p_after)&&(!a.p_pinned||r.pinned))
   .sort((x,y)=>a.p_pinned?(y.pinned_at-x.pinned_at):y.id-x.id).slice(0,Math.min(Math.max(a.p_limit||50,1),100)).map(shape),
  chat_mentions:a=>rows.filter(r=>r.id>(a.p_after||0)&&!r.deleted&&r.author!==myCode&&mentionTokens(r.body).includes(mentionHandle(myName).toLowerCase())).sort((x,y)=>y.id-x.id).map(r=>({id:r.id,room:r.room,created_at:r.created_at,player:by(r.author)?.name,body:r.body})),
  chat_staff:()=>people.filter(p=>isStaff(p.role)).sort((a,b)=>(a.role==='owner'?0:1)-(b.role==='owner'?0:1)).map(p=>({player:p.name,friend_code:p.code,avatar:null,role:p.role,since:null})),
  chat_send:a=>{const me=meNow(),r=room(a.p_room||'lobby');if(bans.has(myCode))fail('banned from chat');if(timedOut(myCode))fail(`chat muted for ${Math.ceil((mutes.get(myCode).until-Date.now())/60000)} more minutes`);
   if(!isStaff(me.role)&&agreed<rulesV)fail('agree to the chat rules first');if(!r||r.archived)fail('no such room');if(r.locked&&!isStaff(me.role))fail('room is locked');if(a.p_announce&&me.role!=='owner')fail('only the arcade owner can do that');
   const c=checkPost(a.p_body,a.p_moment);if(!c.ok)fail({long:'message too long',empty:'empty message',words:'message not allowed',moment:'bad moment'}[c.reason]);
   const pace=rateHint(sent,Date.now(),postKey(c.body,c.moment));if(!pace.ok&&pace.reason==='gap')fail('slow down');
   if(r.slow_seconds&&!isStaff(me.role)&&lastIn[r.slug]&&Date.now()-lastIn[r.slug]<r.slow_seconds*1000)fail(`slow mode ${Math.ceil((lastIn[r.slug]+r.slow_seconds*1000-Date.now())/1000)} seconds`);
   if(!pace.ok)fail({burst:'too many messages',repeat:'duplicate message'}[pace.reason]);
   if(a.p_reply&&!rows.some(x=>x.id===a.p_reply&&x.room===r.slug&&!x.deleted))fail('no such message');
   sent.push({at:Date.now(),key:postKey(c.body,c.moment)});lastIn[r.slug]=Date.now();
   const row=add(ME,c.body,c.moment,0,{room:r.slug,reply_to:a.p_reply||null,kind:a.p_announce?'announce':'msg'});if(row.kind==='announce')logIt('announce',null,{room:r.slug});insertSignal(row);return {id:row.id};},
  chat_post:a=>V2.chat_send({p_room:'lobby',p_body:a.p_body,p_moment:a.p_moment}),
  chat_edit:a=>{const r=rows.find(x=>x.id===a.p_id&&!x.deleted);if(!r)fail('no such message');if(r.author!==myCode)fail('that is not your message');if(Date.now()-new Date(r.created_at)>300000)fail('too late to edit');
   const c=checkPost(a.p_body,r.moment);if(!c.ok)fail({long:'message too long',empty:'empty message',words:'message not allowed'}[c.reason]||'empty message');r.body=c.body;r.edited=true;touch(r);return {id:r.id};},
  chat_react:a=>{if(bans.has(myCode))fail('banned from chat');const r=rows.find(x=>x.id===a.p_id&&!x.deleted);if(!r)fail('no such message');if(a.p_emoji!==null&&!EMOJI.includes(a.p_emoji))fail('unknown reaction');
   const re=reactions.get(r.id)||new Map();reactions.set(r.id,re);if(a.p_emoji===null||re.get(myCode)===a.p_emoji)re.delete(myCode);else re.set(myCode,a.p_emoji);touch(r);
   const counts={};for(const e of re.values())counts[e]=(counts[e]||0)+1;return {reactions:counts,mine:re.get(myCode)||null};},
  chat_report:a=>{if(bans.has(myCode))fail('banned from chat');const r=rows.find(x=>x.id===a.p_id&&!x.deleted);if(!r)fail('no such message');if(r.author===myCode)fail('that is your own message');
   const set=reports.get(r.id)||new Map();set.set(myCode,a.p_reason||'');reports.set(r.id,set);return {hidden:false};},
  chat_delete:a=>{const r=rows.find(x=>x.id===a.p_id&&!x.deleted);if(!r)fail('no such message');if(r.author!==myCode){const p=by(r.author);if(!(canModerate(meNow().role,p?.role)||meNow().role==='owner'))fail('that is not your message');logIt('delete',r.author,{room:r.room});}
   r.deleted=true;r.pinned=false;touch(r);return null;},
  chat_timeout:a=>{staff();const p=target(a.p_code);moderatable(p);const m=Number(a.p_minutes)||0;if(meNow().role==='mod'&&![0,...TIMEOUTS.mod].includes(m))fail('mods can time out for 5 minutes, 1 hour or 1 day');
   if(m)mutes.set(p.code,{until:Date.now()+m*60000,reason:a.p_reason||'',by:myName,since:Date.now()});else mutes.delete(p.code);logIt(m?'timeout':'untimeout',p.code,{reason:a.p_reason||'',detail:{minutes:m}});return {name:p.name,code:p.code,minutes:m};},
  chat_mute:a=>{owner();return V2.chat_timeout({p_code:a.p_code,p_minutes:a.p_minutes,p_reason:''});},
  chat_ban:a=>{owner();const p=target(a.p_code);moderatable(p);bans.set(p.code,{reason:a.p_reason||'',by:myName,since:Date.now()});if(p.role==='mod')p.role='member';logIt('ban',p.code,{reason:a.p_reason||''});return {name:p.name,code:p.code};},
  chat_unban:a=>{owner();const p=target(a.p_code);bans.delete(p.code);logIt('unban',p.code);return {name:p.name,code:p.code};},
  chat_set_role:a=>{owner();const p=target(a.p_code);if(!['mod','member'].includes(a.p_role))fail('unknown role');if(p.role==='owner')fail('you can not moderate that player');if(a.p_role==='mod'&&bans.has(p.code))fail('banned from chat');
   p.role=a.p_role;logIt(a.p_role==='mod'?'make_mod':'remove_mod',p.code);return {name:p.name,code:p.code,role:a.p_role};},
  chat_sanctions:()=>{staff();return [...[...bans].map(([c,b])=>({kind:'ban',player:by(c)?.name,friend_code:c,until:null,reason:b.reason,by_player:b.by,since:b.since})),
   ...[...mutes].filter(([c])=>timedOut(c)).map(([c,m])=>({kind:'timeout',player:by(c)?.name,friend_code:c,until:new Date(m.until).toISOString(),reason:m.reason,by_player:m.by,since:m.since}))];},
  chat_report_queue:()=>{staff();return [...reports].filter(([id,set])=>set.size&&!set.resolved&&rows.find(r=>r.id===id&&!r.deleted)).map(([id,set])=>{const r=rows.find(x=>x.id===id),p=by(r.author);
   return {message_id:id,room:r.room,created_at:r.created_at,body:r.body,moment_title:r.moment?.title||null,player:p?.name,friend_code:r.author,role:p?.role,reporters:set.size,reasons:[...set.values()].filter(Boolean),latest:new Date().toISOString(),hidden:!!r.hidden};});},
  chat_resolve_report:a=>{staff();const r=rows.find(x=>x.id===a.p_id);if(!r)fail('no such message');if(!['dismiss','delete'].includes(a.p_action))fail('unknown action');
   if(a.p_action==='delete'&&!r.deleted)V2.chat_delete({p_id:r.id});else r.hidden=false;const set=reports.get(r.id);if(set)set.resolved=true;logIt('report_'+a.p_action,r.author,{room:r.room});touch(r);},
  chat_pin:a=>{staff();const r=rows.find(x=>x.id===a.p_id&&!x.deleted);if(!r)fail('no such message');if(a.p_on&&rows.filter(x=>x.room===r.room&&x.pinned&&!x.deleted).length>=10)fail('a room holds 10 pins at most');
   r.pinned=!!a.p_on;r.pinned_at=Date.now();logIt(a.p_on?'pin':'unpin',r.author,{room:r.room});touch(r);},
  chat_room_settings:a=>{staff();const own=meNow().role==='owner';if(!own&&(a.p_locked!=null||a.p_title!=null||a.p_topic!=null||a.p_archived!=null))fail('only the arcade owner can do that');
   const r=room(a.p_room);if(!r)fail('no such room');if(a.p_title!=null&&!/^[a-z0-9][a-z0-9-]{1,31}$/.test(cleanText(a.p_title)))fail('room names are 2 to 32 lowercase letters');if(a.p_archived&&r.slug==='lobby')fail('the lobby stays open');
   const d={};for(const [k,col] of [['p_slow','slow_seconds'],['p_locked','locked'],['p_title','title'],['p_topic','topic'],['p_archived','archived']])if(a[k]!=null){r[col]=a[k];d[k.slice(2)]=a[k];}
   logIt('room',null,{room:r.slug,detail:d});return r;},
  chat_room_create:a=>{owner();const s=String(a.p_slug||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9-]{1,23}$/.test(s))fail('room names are 2 to 24 lowercase letters');if(rooms.filter(r=>!r.archived).length>=20)fail('twenty rooms at most');
   const had=room(s);if(had)had.archived=false;else rooms.push({slug:s,title:s,topic:cleanText(a.p_topic),sort:100+rooms.length,locked:false,slow_seconds:0,archived:false});logIt('room_create',null,{room:s});return {slug:s};},
  chat_set_rules:a=>{owner();const t=String(a.p_text||'').trim();if(t.length<10||t.length>2000)fail('rules are 10 to 2000 characters');rules=t;rulesV++;logIt('rules',null,{detail:{version:rulesV}});return meJson();},
  chat_mod_log:a=>{staff();return [...log].reverse().filter(e=>a.p_before==null||e.id<a.p_before).slice(0,a.p_limit||50);},
 };
 const V1={chat_recent:a=>V2.chat_feed({p_room:'lobby',p_before:a.p_before,p_limit:a.p_limit}),chat_post:a=>V2.chat_post(a),chat_react:a=>V2.chat_react(a),chat_report:a=>V2.chat_report(a),chat_delete:a=>V2.chat_delete(a),chat_mute:a=>V2.chat_mute(a)};
 chat.replayLoader=game=>game==='demo'?demoReplay:null;
 chat.mock=async(name,a={})=>{
  await new Promise(r=>setTimeout(r,90));
  const missing=()=>{const e=new Error('Could not find the function public.'+name+' in the schema cache');e.status=404;e.code='PGRST202';throw e;};
  if(flag('chatmissing'))missing();
  const fn=flag('chatv1')?V1[name]:(V2[name]||V1[name]);if(!fn)missing();
  return JSON.parse(JSON.stringify(fn(a)??null));
 };
 // Realtime stand-in: presence (who's in which room), typing and change signals.
 const live={ok:false,h:null,meta:null,
  start(){if(flag('chatnolive')){this.h.onStatus(false,'CHANNEL_ERROR');return;}this.ok=true;this.h.onStatus(true,'SUBSCRIBED');this.sync();},
  track(meta){this.meta=meta;this.sync();},typing(){},stop(){this.ok=false;},
  sync(){if(!this.ok)return;const state={},place=['lobby','lobby','bite-night','lobby','help','lobby','it-learns','looking-for-match','lobby','bite-night'];
   people.forEach((p,i)=>{if(i===ME||i===8||i===9&&bans.has(p.code))return;state[p.code]=[{code:p.code,name:p.name,level:p.level,role:p.role,room:place[i]}];});
   if(this.meta)state[myCode]=[{...this.meta,role:meNow().role}];this.h.onPresence(state);}};
 chat.liveFactory=h=>{live.h=h;return live;};
 // Console helpers for trying things by hand.
 chat.debugIncoming=(text='incoming!',who=6,roomSlug=chat.room)=>{const r=add(who,text,null,0,{room:roomSlug});if(live.ok)live.h.onChange({id:r.id,room:r.room},'INSERT');else chat.refresh();return r.id;};
 chat.debugTyping=(name='Moxie',roomSlug=chat.room)=>{const p=people.find(x=>x.name===name)||people[1];live.h?.onTyping({code:p.code,name:p.name,room:roomSlug});};
 chat.debugBot=()=>{const i=[1,2,5,6,7][Math.floor(Math.random()*5)],lines=ROOM_LINES[chat.room]||LINES;chat.debugTyping(people[i].name);setTimeout(()=>chat.debugIncoming(lines[Math.floor(Math.random()*lines.length)],i),1800);};
 chat.debugTimeout=(m=60)=>{mutes.set(myCode,{until:Date.now()+m*60000,reason:'test',by:'TopX',since:Date.now()});chat.rpc('chat_me').then(v=>{chat.me={...chat.me,...v};chat.composerState();});};
 chat.debugBan=()=>{bans.set(myCode,{reason:'test ban',by:'TopX',since:Date.now()});chat.rpc('chat_me').then(v=>{chat.me={...chat.me,...v};chat.composerState();});};
 chat.debugLift=()=>{mutes.delete(myCode);bans.delete(myCode);chat.rpc('chat_me').then(v=>{chat.me={...chat.me,...v};chat.composerState();});};
 chat.debugLock=(on=true,slug=chat.room)=>{room(slug).locked=on;chat.loadRooms().then(()=>chat.composerState());};
 chat.debugSlow=(s=10,slug=chat.room)=>{room(slug).slow_seconds=s;chat.loadRooms().then(()=>chat.composerState());};
 chat.debugReport=(id,n=3)=>{const set=reports.get(id)||new Map();for(let i=0;i<n;i++)set.set('X'+i,['Spam or flooding','Harassment or bullying','Hate or slurs'][i%3]);reports.set(id,set);};
 chat.debugRows=rows;chat.debugLimits=LIMITS;
 if(flag('chatbots'))setInterval(()=>{if(chat.viewing&&!document.hidden)chat.debugBot();},7000);
 // Reports waiting for staff, so the queue has something in it.
 const spam=add(7,'FREE TREATS click my profile for free treats!!!',null,200);chat.debugReport(spam.id,2);
 chat.v2=null;chat.wake();
}
