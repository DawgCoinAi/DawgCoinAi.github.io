// BITE NIGHT rivals. The AI never reads the player's inputs: it watches the rival's *state* through
// a reaction delay (longer at low levels), keeps a tally of the rival's habits, and answers with
// queued button presses that go through the same input buffer a human uses. Pure and seeded.
import {fighter,IN,finishersFor} from './fight-roster.js';
const {U,D,A,B,S,G}=IN,FW=256,BK=512,WALL=6.2;
//           react  block  anti-air punish throw  tech  idle frames     combo size, finisher chance
const LEVEL=[null,
 {delay:22,block:.2,aa:.08,punish:.1,thr:.05,tech:.05,idle:[26,60],combo:1,fin:.35,spec:.12,mix:.1},
 {delay:16,block:.42,aa:.22,punish:.3,thr:.1,tech:.15,idle:[14,36],combo:2,fin:.6,spec:.2,mix:.2},
 {delay:11,block:.62,aa:.45,punish:.55,thr:.16,tech:.35,idle:[6,20],combo:3,fin:.8,spec:.3,mix:.35},
 {delay:8,block:.78,aa:.65,punish:.78,thr:.2,tech:.55,idle:[3,12],combo:4,fin:.9,spec:.36,mix:.5},
 {delay:5,block:.9,aa:.82,punish:.93,thr:.22,tech:.75,idle:[1,7],combo:5,fin:1,spec:.4,mix:.6}];
export function aiInit(lvl,seed){return {lvl:Math.max(1,Math.min(5,lvl|0)),rs:seed>>>0,q:[],wait:20,obs:[],hab:{jump:0,block:0,low:0,thr:0,proj:0,n:1},lastSt:'',fin:0,hold:0};}
function rnd(ai){let a=ai.rs=(ai.rs+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
const press=(q,b,n=2,gap=1)=>{q.push({b,n});if(gap)q.push({b:0,n:gap});};
// Tokens: A B S = buttons; 2 4 6 8 prefixes = directions; '236A' etc. = motions; 'w12' = wait.
function plan(ai,tokens){for(const tk of tokens){
  if(tk[0]==='w'){ai.q.push({b:0,n:Number(tk.slice(1))});continue;}
  if(tk==='?'){ai.q.push({check:1,n:1,b:0});continue;}
  let dir=0,btn=0,i=0;const mo=/^(236|214|22|46)/.exec(tk);
  if(mo){const m=mo[1];if(m==='236'){press(ai.q,D,2,0);press(ai.q,D|FW,2,0);press(ai.q,FW,1,0);dir=FW;}else if(m==='214'){press(ai.q,D,2,0);press(ai.q,D|BK,2,0);press(ai.q,BK,1,0);dir=BK;}else if(m==='22'){press(ai.q,D,2,1);press(ai.q,D,1,0);dir=D;}else{press(ai.q,BK,3,0);press(ai.q,FW,1,0);dir=FW;}i=m.length;}
  for(;i<tk.length;i++){const c=tk[i];if(c==='2')dir|=D;else if(c==='4')dir|=BK;else if(c==='6')dir|=FW;else if(c==='8')dir|=U;else if(c==='A')btn|=A;else if(c==='B')btn|=B;else if(c==='S')btn|=S;else if(c==='G')btn|=G;}
  if(dir&&btn&&!mo)ai.q.push({b:dir,n:1});press(ai.q,dir|btn,2,7);}}
const rel=(b,face)=>(b&~(FW|BK))|(b&FW?(face>0?IN.R:IN.L):0)|(b&BK?(face>0?IN.L:IN.R):0);
const SLOT_TOKEN=['S','6S','4S','2S'];

export function aiInput(g,side){
 const ai=g.ai[side],me=g.f[side],op=g.f[1-side],F=fighter(me.id),OF=fighter(op.id),P=LEVEL[ai.lvl],h=ai.hab;
 ai.obs.push({st:op.st,mv:op.mv,mt:op.mt,x:op.x,y:op.y,vy:op.vy});if(ai.obs.length>30)ai.obs.shift();
 const seen=ai.obs[Math.max(0,ai.obs.length-1-P.delay)],dist=Math.abs(seen.x-me.x),r=()=>rnd(ai);
 // Habits (a slow tally of what the rival tends to do).
 if(seen.st!==ai.lastSt){h.n++;if(seen.st==='pre'||seen.st==='jump')h.jump++;if(seen.st==='block')h.block++;if(seen.st==='throwing')h.thr++;if(seen.st==='atk'&&seen.mv){const m=OF.moves[seen.mv];if(m?.lv==='low')h.low++;if(m?.proj)h.proj++;}ai.lastSt=seen.st;if(h.n>60){for(const k of ['jump','block','low','thr','proj'])h[k]*=.6;h.n*=.6;}}
 const adapt=ai.lvl>=3?1:0,rate=k=>adapt*h[k]/h.n;
 if(g.phase==='intro'||g.phase==='ko'||g.phase==='cine'||g.phase==='over'){ai.q=[];return 0;}
 if(g.phase==='finish'){
  if(g.koBy.winner!==side)return 0;
  if(ai.q.length){const s=ai.q[0];const b=s.b;if(--s.n<=0)ai.q.shift();return rel(b,me.face);}
  if(g.pt<50)return 0;
  if(!ai.fin){ai.fin=1;const list=finishersFor(me.id,g.stage);if(r()<P.fin){const k=r(),pick=k<.26?0:k<.52?1:k<.78?2:k<.94?3:4;ai.q.push({b:0,n:8+Math.floor(r()*30)});
     if(pick===4){ai.q.push({b:G,n:3});press(ai.q,G|S,2,3);}else{const d=[D,FW,BK,U][pick];ai.q.push({b:d,n:2});press(ai.q,d|S,2,3);}return 0;}
   ai.q.push({b:FW,n:Math.min(70,Math.floor(Math.max(0,dist-1)/F.walk))});press(ai.q,B,2,3);return 0;}
  if(g.pt>200){ai.q.push({b:FW,n:20});press(ai.q,B,2,3);}
  return 0;}
 if(g.phase!=='fight')return 0;
 // Slip a throw (decided once, early in the window).
 if(me.st==='thrown'){if(me.t===2&&me.th?.tech&&r()<Math.min(.95,P.tech+rate('thr')*.6)){ai.q=[];press(ai.q,A|B,2,2);}}
 if(ai.q.length){const s=ai.q[0];
  if(s.check){ai.q.shift();if(!(op.st==='hit'||op.st==='launch'||op.st==='bstun'&&ai.lvl<4)){ai.q=[];ai.wait=4;return 0;}return 0;}
  const b=s.b;if(--s.n<=0)ai.q.shift();return rel(b,me.face);}
 const free=me.st==='idle'||me.st==='walk'||me.st==='crouch'||me.st==='block';
 if(me.st==='bstun'){return rel(G|(ai.hold&D),me.face);}
 if(me.st==='down'||me.st==='wake'){return ai.lvl>=3&&r()<.9?G:0;}
 if(!free)return 0;
 // Underdawg when cornered and hurt.
 if(me.hp<=me.max*.3&&!me.udUsed&&ai.lvl>=2&&r()<.04*ai.lvl){press(ai.q,G|S,2,2);return 0;}
 // Defence: react to what the rival was seen doing.
 const om=seen.st==='atk'&&seen.mv?OF.moves[seen.mv]:null,threat=om&&seen.mt<=om.s+om.a+2&&(om.x1+1.2>=dist||om.adv||om.tele||om.hop),
  shot=g.proj.find(p=>p.o!==side&&!p.trap&&Math.abs(p.x-me.x)<2.2&&(p.x-me.x)*p.vx<=0);
 if(threat||shot){const lv=shot?shot.lv:om.lv,pb=Math.min(.97,P.block+(lv==='low'?rate('low')*.5:0));
  if(lv==='throw'){if(r()<P.block*.8){if(r()<.5)plan(ai,['8']);else plan(ai,['A']);return 0;}}
  else if(r()<pb){const wrong=ai.lvl<=2&&r()<.35,low=lv==='low'?!wrong:lv==='over'?wrong:r()<.3;ai.hold=low?D:0;const n=shot?14:Math.max(8,om.s+om.a-seen.mt+10);ai.q.push({b:G|(low?D:0),n});
   // The best rivals answer invulnerable moves on a read.
   if(ai.lvl>=4&&om&&dist<1.4&&r()<.18&&me.meter>=100){ai.q=[];const up=F.specials.findIndex(id=>F.moves[id].inv&&F.moves[id].dmg>0);if(up>=0)plan(ai,[SLOT_TOKEN[up]]);}
   return rel(ai.q[0].b,me.face);}
  else if(ai.lvl<=2){ai.wait=6;}}
 if(ai.wait>0){ai.wait--;return 0;}
 const idle=()=>{ai.wait=P.idle[0]+Math.floor(r()*(P.idle[1]-P.idle[0]));};
 // Anti-air.
 if(seen.y>.5&&dist<2.1&&(seen.st==='jump'||seen.st==='atk')&&r()<Math.min(.95,P.aa+rate('jump')*.8)){const up=F.specials.findIndex(id=>{const m=F.moves[id];return m.y[1]>2.4&&m.dmg>0;});
  if(up>=0&&ai.lvl>=3&&r()<.6)plan(ai,[SLOT_TOKEN[up]]);else plan(ai,['2B']);idle();return 0;}
 // Punish a whiff or a long recovery.
 const whiff=om&&seen.mt>om.s+om.a&&om.r>=14;
 if((whiff||seen.st==='rec')&&dist<1.5&&r()<P.punish){combo(ai,me,F,P,r);idle();return 0;}
 if(whiff&&dist<3.2&&dist>=1.5&&r()<P.punish*.7){const reach=F.specials.findIndex(id=>{const m=F.moves[id];return m.dmg>0&&(m.adv||m.x1>2)&&m.lv!=='throw';});if(reach>=0){plan(ai,[SLOT_TOKEN[reach]]);idle();return 0;}}
 // Open up a turtle.
 if(seen.st==='block'&&dist<1.15&&r()<P.thr*(1+3*rate('block'))*2){const grab=F.specials.findIndex(id=>F.moves[id].lv==='throw'&&!F.moves[id].airOnly&&!F.moves[id].adv);if(grab>=0&&r()<.6)plan(ai,[SLOT_TOKEN[grab]]);else if(r()<.6)plan(ai,['AB']);else plan(ai,['6B']);idle();return 0;}
 // Neutral, by distance and archetype.
 const shooter=F.specials.findIndex(id=>F.moves[id].proj&&!F.moves[id].proj.trap&&F.moves[id].proj.vx),zoner=F.arche==='ZONER'||F.arche==='BOSS',k=r();
 if(dist>3.2){
  if(shooter>=0&&k<(zoner?.55:.25)*(.5+ai.lvl*.12)){plan(ai,[SLOT_TOKEN[shooter]]);idle();return 0;}
  if(zoner&&k<.75&&ai.lvl>=2){const tr=F.specials.findIndex(id=>F.moves[id].proj);plan(ai,[SLOT_TOKEN[tr>=0&&r()<.4?tr:shooter>=0?shooter:0]]);idle();return 0;}
  if(k>.9&&ai.lvl>=2){plan(ai,['9']);ai.q.push({b:U|FW,n:3});if(r()<.7){ai.q.push({b:0,n:22});press(ai.q,B,2,2);}return 0;}
  if(ai.lvl>=3&&k>.7){ai.q.push({b:FW,n:2},{b:0,n:2},{b:FW,n:2});return 0;}
  ai.q.push({b:FW,n:10+Math.floor(r()*14)});return 0;}
 if(dist>1.25){
  const far=F.specials.findIndex(id=>{const m=F.moves[id];return m.dmg>0&&m.lv!=='throw'&&(m.adv&&m.adv[2]>.08||m.x1>=dist-.2)&&!m.fall;});
  if(far>=0&&k<P.spec){plan(ai,[SLOT_TOKEN[far]]);idle();return 0;}
  if(zoner&&shooter>=0&&k<.5){plan(ai,[r()<.3?'4':'w2',SLOT_TOKEN[shooter]]);idle();return 0;}
  if(k>.92&&ai.lvl>=2){ai.q.push({b:U|FW,n:4},{b:0,n:20});press(ai.q,r()<.6?B:A,2,2);return 0;}
  if(k>.84){ai.q.push({b:BK,n:8+Math.floor(r()*10)});return 0;}
  if(k>.78&&ai.lvl<=2){idle();return 0;}
  ai.q.push({b:FW,n:5+Math.floor(r()*8)});return 0;}
 // Up close.
 if(k<P.mix*.25){plan(ai,['6B']);idle();return 0;}
 if(k<P.mix*.5){plan(ai,[r()<.5?'AB':'2A','w3',r()<.5?'2A':'A']);idle();return 0;}
 if(k<P.mix*.5+P.thr){plan(ai,['AB']);idle();return 0;}
 if(k>.93){ai.q.push({b:BK,n:2},{b:0,n:2},{b:BK,n:2},{b:0,n:10});return 0;}
 if(k>.86&&ai.lvl<=3){ai.q.push({b:G,n:12+Math.floor(r()*14)});return 0;}
 combo(ai,me,F,P,r);idle();return 0;
}
// A string sized to the level: single pokes at the bottom, cancels and juggles at the top.
function combo(ai,me,F,P,r){
 const sp=F.specials,strike=sp.findIndex(id=>{const m=F.moves[id];return m.dmg>0&&m.lv!=='throw'&&!m.fall&&!m.hop;}),k=r(),n=P.combo,meter=me.meter;
 const ender=meter>=200&&n>=4&&k<.6?'AS':strike>=0?(meter>=100&&n>=5&&k<.5?'B'+SLOT_TOKEN[strike].replace('S','')+'S':SLOT_TOKEN[strike]):null;
 if(n<=1){plan(ai,[k<.5?'A':k<.75?'2A':k<.9?'B':'4B']);return;}
 if(n===2){plan(ai,k<.5?['A','A']:k<.75?['2A','A']:k<.9?['B']:['4B']);return;}
 if(n===3){plan(ai,k<.4?['A','A','A']:k<.7&&ender?['A','A','?',ender]:k<.85?['2A','A','B']:['2B','w20','?','A','B']);return;}
 if(k<.35&&ender){plan(ai,['A','A','?',ender]);return;}
 if(k<.6){plan(ai,['2B','w22','?','A','w4','B','?',...(ender&&n>=5?[ender]:[])]);return;}
 if(k<.8&&ender){plan(ai,['2A','A','B','?',ender]);return;}
 plan(ai,['A','A','A','?',...(ender?[ender]:[])]);
}
