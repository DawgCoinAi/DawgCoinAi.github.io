// Test backend for DAWG Chat, loaded only with ?debug=chat. It stands in for the server
// functions in memory (nothing is sent anywhere) so the whole chat can be tried before the
// migration is run: paging, posting with the real pace rules, reactions, reports, deletes,
// score cards and a playable moment from a pretend game called "demo".
// ?debug=chat&chatowner=1 also shows the arcade owner's tools; &chatmissing=1 answers like a
// server where the chat migration hasn't been run (the "Chat opens soon" state).
import {EMOJI,LIMITS,checkPost,rateHint,postKey} from './chat.js';

const NAMES=['Biscuit','Moxie','Nova','TopX','Pepper','Waffles','Rex','Luna','Guest 3FA9C210','Ziggy'];
const LINES=['anyone beaten 40k on Neon Pinball yet?','that last loop in Turbo Pup is evil','gg','who wants a chess match','first gold medal today!!','the Warden got me again','lol','new here, what should I play first?','Drift Dawgs rooftop shortcut is so good',
 'http://example.com is just text here, not a link','<b>markup</b> shows as plain text','ok one more run','posting my score, come beat it','good boy energy only','brb walking the actual dog'];
const code=i=>(0x3FA9C210+i*7919).toString(16).toUpperCase().padStart(8,'0').slice(-8);

// A viewer in the shape games ship as dist/<game>-replay.js (see CHAT-CONTRACT).
export const demoReplay={
 MOMENT_KINDS:['finisher'],
 validMoment:d=>!!d&&d.v===1&&typeof d.winner==='string'&&typeof d.loser==='string'&&Number.isFinite(d.seed),
 draw(c,d,t){const w=c.canvas.width,h=c.canvas.height;c.fillStyle='#120f2b';c.fillRect(0,0,w,h);c.fillStyle='#2e2b55';c.fillRect(0,h*.78,w,h*.22);
  const hit=Math.min(1,t/1.2),x=w*(.2+.42*hit);c.fillStyle='#b9ff5e';c.fillRect(x-18,h*.48,36,h*.3);c.fillStyle='#ff5fc8';c.save();c.translate(w*.72+hit*w*.08,h*.63);c.rotate(hit*1.3);c.fillRect(-18,-h*.15,36,h*.3);c.restore();
  c.fillStyle='#fff';c.font='900 '+Math.round(h*.12)+'px sans-serif';c.textAlign='center';if(hit>=1)c.fillText(d.winner.toUpperCase()+' WINS',w/2,h*.28);},
 async playMoment(host,d){const cv=document.createElement('canvas');cv.width=640;cv.height=360;cv.style.cssText='width:100%;height:100%;display:block';host.append(cv);const c=cv.getContext('2d'),t0=performance.now();
  let on=true;const timer=setInterval(()=>{if(on)demoReplay.draw(c,d,((performance.now()-t0)/1000)%3);},33);demoReplay.draw(c,d,0);globalThis.__dawgChatDemo={playing:true};
  return {stop(){on=false;clearInterval(timer);cv.remove();globalThis.__dawgChatDemo={playing:false};}};},
 momentPoster(d){const cv=document.createElement('canvas');cv.width=320;cv.height=180;demoReplay.draw(cv.getContext('2d'),d,2);return cv;}
};

export function install(chat){
 const params=new URLSearchParams(location.search),now=Date.now(),rows=[],reports=new Set(),sent=[];let next=1;
 const add=(who,body,moment,ago,extra={})=>rows.push({id:next++,created_at:new Date(now-ago*1000).toISOString(),body,moment,player:NAMES[who],friend_code:code(who),avatar:null,level:1+who*4,mine:false,reactions:{},my_reaction:null,...extra});
 for(let i=0;i<118;i++)add(i*7%NAMES.length,LINES[(i*7+3)%LINES.length],null,90000-i*700);
 add(1,'',{kind:'score',game:'pinball',title:'48,200 in Neon Pinball',text:'new personal best · gold medal · wizard mode',data:{v:1,score:48200,medal:3,best:true}},1500,{reactions:{'🔥':4,'👏':2}});
 add(0,'watch this',{kind:'finisher',game:'demo',title:'BISCUIT finished MOXIE',text:'Thunder Fetch · flawless · round 2',data:{v:1,winner:'biscuit',loser:'moxie',move:'thunder_fetch',stage:'rooftop',seed:12345}},900,{reactions:{'💀':3,'😂':1},my_reaction:'💀'});
 add(2,'',{kind:'finisher',game:'fight',title:'NOVA finished REX',text:'Moon Howl · round 3',data:{v:1,winner:'nova',loser:'rex',move:'moon_howl',stage:'docks',seed:77}},700);
 add(4,'',{kind:'feat',game:'mystery',title:'Pepper found the secret room',text:'a game this arcade doesn’t know yet',data:{v:1}},500);
 add(3,'welcome to the pack 🐶',null,300);add(3,'be nice, post your best runs',null,280);add(5,'gg all',null,60,{reactions:{'💜':1}});
 const fail=text=>{throw new Error(text);},visible=()=>rows.filter(r=>!r.deleted&&!reports.has(r.id));
 chat.replayLoader=game=>game==='demo'?demoReplay:null;
 if(params.get('chatowner'))chat.rankings.owner=true;
 chat.mock=async(name,a={})=>{
  await new Promise(r=>setTimeout(r,120));
  if(params.get('chatmissing')){const e=new Error('Could not find the function public.'+name+' in the schema cache');e.status=404;e.code='PGRST202';throw e;}
  if(name==='chat_recent')return visible().filter(r=>a.p_before==null||r.id<a.p_before).sort((x,y)=>y.id-x.id).slice(0,Math.min(Math.max(a.p_limit||50,1),100)).map(r=>({...r}));
  if(name==='chat_post'){const c=checkPost(a.p_body,a.p_moment);if(!c.ok)fail({long:'message too long',empty:'empty message',words:'message not allowed',moment:'bad moment'}[c.reason]);
   const pace=rateHint(sent,Date.now(),postKey(c.body,c.moment));if(!pace.ok)fail({gap:'slow down',burst:'too many messages',repeat:'duplicate message'}[pace.reason]);
   sent.push({at:Date.now(),key:postKey(c.body,c.moment)});add(0,c.body,c.moment,0,{player:chat.myName,friend_code:chat.rankings.profile?.code||'00000000',mine:true,level:chat.rankings.stats?.().level||1,avatar:chat.rankings.kennel?.active||null});return {id:next-1};}
  const r=rows.find(x=>x.id===a.p_id&&!x.deleted);
  if(name==='chat_react'){if(!r)fail('no such message');if(a.p_emoji!==null&&!EMOJI.includes(a.p_emoji))fail('unknown reaction');
   if(r.my_reaction){r.reactions[r.my_reaction]--;if(!r.reactions[r.my_reaction])delete r.reactions[r.my_reaction];}
   r.my_reaction=a.p_emoji===r.my_reaction?null:a.p_emoji;if(r.my_reaction)r.reactions[r.my_reaction]=(r.reactions[r.my_reaction]||0)+1;return {reactions:{...r.reactions},mine:r.my_reaction};}
  if(name==='chat_report'){if(!r)fail('no such message');if(r.mine)fail('that is your own message');reports.add(r.id);return {hidden:false};}
  if(name==='chat_delete'){if(!r)fail('no such message');if(!r.mine&&!chat.rankings.owner)fail('that is not your message');r.deleted=true;return null;}
  if(name==='chat_mute'){if(!chat.rankings.owner)fail('only the arcade owner can do that');return {name:rows.find(x=>x.friend_code===a.p_code)?.player||'Player',code:a.p_code,minutes:a.p_minutes};}
  fail('Could not find the function public.'+name);
 };
 // A message from someone else, for trying the "new messages" pill: __dawgChat.debugIncoming('hi')
 chat.debugIncoming=(text='incoming!')=>{add(6,text,null,0);return chat.refresh();};
 chat.debugLimits=LIMITS;
 chat.wake();
}
