// BITE NIGHT engine: a pure, deterministic one-on-one fighting game. Fixed 60 Hz steps, seeded,
// inputs in → state out: the same seed and input log always replays the same match. No DOM, no
// rendering, no clocks. Renderers and the play screen only read `game` and the events of a step.
import {FIGHTERS,fighter,IN,stageOf,FINISHERS,finisher,finishersFor,MOD_IDS,FIGHTER_IDS,STAGE_IDS,STARTERS,CALL} from './fight-roster.js';
import {CINE_DUR} from './fight-cine.js';
import {aiInit,aiInput} from './fight-ai.js';

export const K={WALL:6.2,G:.0115,JUMP:.212,JUMPX:.062,METER:300,EX:100,SUPER:200,ROUND:60*60,INTRO:100,KO:100,FINISH:400,END:90,BUF:8,DASH:14,BACK:16,TECH:9,JMAX:9,CAP:13,CLOSE:1.7,FAR:3.2,UNDER:.3,UNDERT:420,BODY:.36,WINS:2};
export const FEATS=[
 {id:'fight.debut',name:'Opening Night',text:'Win a match'},
 {id:'fight.untouched',name:'Untouched',text:'Win a round without taking a hit'},
 {id:'fight.whisker',name:'By a Whisker',text:'Win a round with a sliver of health left'},
 {id:'fight.combo8',name:'Eight Is Enough',text:'Land an 8-hit combo'},
 {id:'fight.juggle',name:'Keep It Up',text:'Hit an airborne rival 4 times in one combo'},
 {id:'fight.curtain',name:'Curtain Call',text:'Perform a finishing move'},
 {id:'fight.dive',name:'Stage Dive',text:'Finish a rival with the stage itself'},
 {id:'fight.rub',name:'Good Sport',text:'End a match with a Belly Rub'},
 {id:'fight.snap',name:'Snap Happy',text:'Snap Guard 3 attacks in one match'},
 {id:'fight.tech',name:'Slippery',text:'Slip out of a throw'},
 {id:'fight.underdawg',name:'Underdawg',text:'Win a round after going Underdawg'},
 {id:'fight.super',name:'Showstopper',text:'Knock a rival out with a super'},
 {id:'fight.wall',name:'Property Damage',text:'Slam a rival into the stage hazard'},
 {id:'fight.read',name:'Mind Reader',text:'Land 3 counter-hits in one match'},
 {id:'fight.sweep',name:'Clean Sweep',text:'Win a match two rounds to none'},
 {id:'fight.tower',name:'Top of the Tower',text:'Beat the House at the top of the tower'},
 {id:'fight.daily',name:'Tonight’s Main Event',text:'Win the daily challenge'}
];
export const FEAT_IDS=FEATS.map(f=>f.id);
const A=IN.A,B=IN.B,S=IN.S,G=IN.G;
const sign=x=>x<0?-1:1,clamp=(x,a,b)=>x<a?a:x>b?b:x;
const mv=(f,id=f.mv)=>id?fighter(f.id).moves[id]:null;
const air=f=>f.y>0||f.vy>0;
const emit=(g,type,o)=>g.events.push({type,...o});
function feat(g,side,id){if(!g.human.includes(side)||g.feats.includes(id)||g.training)return;g.feats.push(id);emit(g,'feat',{id,name:FEATS.find(f=>f.id===id).name});}

function newFighter(id,side,meter=0){const F=fighter(id);return {id,side,x:side?1.7:-1.7,y:0,vx:0,vy:0,face:side?-1:1,hp:F.hp,max:F.hp,meter,st:'idle',t:0,mv:null,mt:0,hitN:0,lastHit:-99,conn:0,tech:0,stun:0,jug:0,ch:0,sh:0,cd:0,cl:[],ah:0,inv:0,tp:0,ud:0,udUsed:0,low:0,ws:0,arm:0,jx:0,airUsed:0,
 in:0,prev:0,dir:5,pb:[99,99,99,99],dirs:[5],taps:[],th:null,hurt:0};}
const STATS=()=>({dealt:0,best:0,snaps:0,techs:0,reads:0,perfect:0,clutch:0,superKO:0,throws:0,under:0});

/** A new match. p: [fighterId, fighterId]; cpu: AI level per side (0 = human input). */
export function createMatch({seed=1,p=['biscuit','moxie'],stage='rooftop',cpu=[0,3],simple=[true,true],mod=null,training=false,human=null,mode='versus'}={}){
 if(!fighter(p[0])||!fighter(p[1])||!stageOf(stage))throw new Error('Unknown fighter or stage');
 const g={v:1,seed:seed>>>0,rs:seed>>>0,frame:0,phase:'intro',pt:0,round:1,wins:[0,0],timer:K.ROUND,stage,mode,mod:MOD_IDS.includes(mod)?mod:null,training:!!training,simple:[!!simple[0],!!simple[1]],cpu:[cpu[0]|0,cpu[1]|0],
  human:human||[0,1].filter(i=>!(cpu[i]|0)),f:[newFighter(p[0],0),newFighter(p[1],1)],proj:[],events:[],hitstop:0,freeze:0,hazUsed:0,fin:null,result:null,feats:[],stats:[STATS(),STATS()],rounds:[],first:0,last:null,need:mod==='sudden'?1:K.WINS};
 g.ai=[cpu[0]?aiInit(cpu[0],seed^0x9e3779b9):null,cpu[1]?aiInit(cpu[1],seed^0x51ed270b):null];
 if(g.mod==='sudden')for(const f of g.f){f.hp=f.max=Math.round(f.max/2);}
 emit(g,'round',{round:1});return g;
}
function resetRound(g){const m=[g.f[0].meter,g.f[1].meter];g.f=[newFighter(g.f[0].id,0,m[0]),newFighter(g.f[1].id,1,m[1])];if(g.mod==='sudden')for(const f of g.f)f.hp=f.max=Math.round(f.max/2);g.proj=[];g.timer=K.ROUND;g.hazUsed=0;g.first=0;g.phase='intro';g.pt=0;emit(g,'round',{round:g.round});}

// ── Input reading: relative directions on a numpad (6 = toward the rival), press ages, motions.
function read(f,bits,frame,frozen){
 const fw=bits&(f.face>0?IN.R:IN.L),bk=bits&(f.face>0?IN.L:IN.R),x=fw&&!bk?1:bk&&!fw?-1:0,y=bits&IN.U?1:bits&IN.D?-1:0,dir=5+x+3*y;
 if(dir!==f.dir){if(dir===2||dir===4||dir===6||dir===8){f.taps.push([dir,frame]);if(f.taps.length>6)f.taps.shift();}}
 f.dirs.push(dir);if(f.dirs.length>24)f.dirs.shift();
 [A,B,S,G].forEach((b,i)=>{if(bits&b&&!(f.prev&b))f.pb[i]=0;else if(!frozen&&f.pb[i]<99)f.pb[i]++;});
 f.in=bits;f.prev=bits;f.dir=dir;
}
function motion(f){const d=f.dirs,n=d.length,cur=d[n-1];let downAt=-1,backAt=-1,edges=0,first=-1;
 for(let i=Math.max(0,n-18);i<n;i++){const v=d[i];if(v===2||v===1)downAt=i;if(v===4||v===7)backAt=i;if(v<=3&&(i===0||d[i-1]>3)){edges++;if(first<0)first=i;}}
 let d2=-1;for(let i=Math.max(0,n-16);i<n;i++)if(d[i]===2||d[i]===3)d2=i;
 if((cur===6||cur===3)&&downAt>=0&&n-downAt<=15&&downAt>backAt)return '236';
 if((cur===4||cur===1)&&d2>=0&&n-d2<=15){for(let i=d2+1;i<n;i++)if(d[i]===1||d[i]===4)return '214';}
 if(cur===6&&backAt>=0&&n-backAt<=13)return '46';
 if(cur<=3&&edges>=2)return '22';
 return null;}
const both=(f,a,b)=>f.pb[a]<K.BUF&&f.pb[b]<K.BUF&&Math.abs(f.pb[a]-f.pb[b])<=3;
const use=(f,...i)=>{for(const k of i)f.pb[k]=99;};
const SLOT_OF={'236':0,'46':1,'214':2,'22':3};
const slotByDir=d=>d<=3?3:d===6||d===9?1:d===4||d===7?2:0;

// What the buffered buttons ask for right now: {id, tech} for a move, or 'UD'.
function choose(g,f,ctx){
 const F=fighter(f.id),p=f.pb,W=K.BUF,a=p[0]<W,b=p[1]<W,s=p[2]<W,dir=f.dir,finish=g.phase==='finish';
 if(ctx==='air'){if(b){use(f,1);return {id:'jH'};}if(a){use(f,0);return {id:'jL'};}return null;}
 if(both(f,0,2)&&!finish){if(f.meter>=K.SUPER||g.training){use(f,0,2);return {id:F.super};}}
 const mo=(a||b)&&!finish?motion(f):null;
 if(mo){const base=F.specials[SLOT_OF[mo]],ex=both(f,0,1)&&(f.meter>=K.EX||g.training);use(f,0,1);f.dirs=[dir];return {id:ex?base+'+':base,tech:1};}
 if(both(f,1,2)&&!finish){const base=F.specials[slotByDir(dir)],ex=f.meter>=K.EX||g.training;use(f,1,2);return {id:ex?base+'+':base};}
 if(both(f,0,1)){use(f,0,1);return {id:'throw'};}
 if(s&&!(finish&&g.simple[f.side])&&!(p[3]<W&&Math.abs(p[3]-p[2])<=3)){use(f,2);return {id:F.specials[slotByDir(dir)]};}
 if(b){use(f,1);return {id:dir<=3?'2H':dir===4||dir===7?'4H':dir===6||dir===9?'6H':'5H'};}
 if(a){use(f,0);return {id:dir<=3?'2L':'5L'};}
 return null;}
function start(g,f,o,id,tech=0){
 const m=mv(f,id);if(!m)return false;
 if(m.cost&&!g.training){if(f.meter<m.cost)return false;f.meter-=m.cost;}
 if(!air(f)&&o.x!==f.x&&!m.hidden)f.face=sign(o.x-f.x);
 f.st='atk';f.mv=id;f.mt=0;f.hitN=0;f.lastHit=-99;f.conn=0;f.arm=0;f.tech=tech?1:0;f.low=m.crouch?1:0;f.t=0;if(!air(f))f.vx=0;
 if(m.kind==='super'&&!m.hidden){g.freeze=38;emit(g,'super',{side:f.side,id,name:m.name});}
 emit(g,'move',{side:f.side,id,kind:m.kind,name:m.name,ex:!!m.ex,w:m.w});return true;}
function canUnder(g,f){return g.phase==='fight'&&!f.udUsed&&f.hp>0&&f.hp<=f.max*K.UNDER&&!['thrown','down','ko','dizzy','throwing'].includes(f.st);}
function goUnder(g,f,o){f.udUsed=1;f.ud=K.UNDERT;f.inv=22;f.meter=Math.min(K.METER,f.meter+60);g.stats[f.side].under=1;use(f,2,3);
 if(['hit','bstun','launch','atk','block','dash'].includes(f.st)){f.st=air(f)?'jump':'idle';f.mv=null;f.stun=0;f.airUsed=1;}
 if(Math.abs(o.x-f.x)<2.4&&!['down','thrown','ko'].includes(o.st)&&Math.abs(o.y-f.y)<2){o.st=air(o)?'launch':'hit';o.stun=26;o.mv=null;o.vx=sign(o.x-f.x)*.17;if(air(o)){o.vy=.1;o.jug=K.JMAX+1;}}
 g.freeze=26;emit(g,'underdawg',{side:f.side});}

const actionable=f=>f.st==='idle'||f.st==='walk'||f.st==='crouch'||f.st==='block';
function ground(g,f,o){
 if(o.x!==f.x)f.face=sign(o.x-f.x);
 const c=choose(g,f,'ground');if(c&&start(g,f,o,c.id,c.tech))return;
 const d=f.dir,bits=f.in;f.low=0;
 if(bits&G&&g.mod!=='nog'){f.st='block';f.low=d<=3?1:0;f.vx=0;return;}
 if(d>=7){f.st='pre';f.t=0;f.jx=d===9?1:d===7?-1:0;f.vx=0;return;}
 if(d<=3){f.st='crouch';f.low=1;f.vx=0;return;}
 const tp=f.taps,n=tp.length;
 if(g.phase!=='finish'&&n>=2&&tp[n-1][1]===g.frame&&tp[n-2][0]===tp[n-1][0]&&g.frame-tp[n-2][1]<=14&&(tp[n-1][0]===6||tp[n-1][0]===4)){const fw=tp[n-1][0]===6;f.st=fw?'dash':'bdash';f.t=0;if(!fw)f.inv=Math.max(f.inv,7);emit(g,'dash',{side:f.side,fw});return;}
 const F=fighter(f.id);
 if(d===6){f.st='walk';f.vx=F.walk*f.face;}else if(d===4){f.st='walk';f.vx=-F.walk*.78*f.face;}else{f.st='idle';f.vx=0;}
}
function endCombo(g,f){if(f.ch>=2)emit(g,'comboend',{side:1-f.side,hits:f.ch,dmg:Math.round(f.cd)});f.ch=0;f.sh=0;f.cd=0;f.cl=[];f.jug=0;f.ah=0;f.ws=0;
 if(g.training&&g.phase==='fight'){f.hp=f.max;g.f[1-f.side].meter=K.METER;}}
function toIdle(g,f){f.st='idle';f.mv=null;f.stun=0;f.low=0;f.t=0;}

function tick(g,f,o){
 f.t++;if(f.inv>0)f.inv--;if(f.tp>0)f.tp--;if(f.ud>0)f.ud--;if(f.hurt>0)f.hurt--;
 const F=fighter(f.id),grav=K.G*(g.mod==='moon'?.62:1);
 if(both(f,3,2)&&canUnder(g,f)){goUnder(g,f,o);return;}
 switch(f.st){
  case 'idle':case 'walk':case 'crouch':case 'block':if(f.ch)endCombo(g,f);ground(g,f,o);break;
  case 'pre':if(f.t>=3){f.st='jump';f.vy=K.JUMP;f.vx=f.jx*K.JUMPX*f.face*(F.walk/.055*.5+.5);f.y=.001;f.airUsed=0;emit(g,'jump',{side:f.side});}break;
  case 'jump':if(!f.airUsed){const c=choose(g,f,'air');if(c){f.airUsed=1;start(g,f,o,c.id);}}break;
  case 'dash':f.vx=(F.walk*1.6+.045)*f.face;if(f.t>6){const c=choose(g,f,'ground');if(c&&start(g,f,o,c.id,c.tech))break;}if(f.t>=K.DASH)toIdle(g,f);break;
  case 'bdash':f.vx=-.105*f.face*(f.t<12?1:.3);if(f.t>=K.BACK)toIdle(g,f);break;
  case 'atk':attack(g,f,o);break;
  case 'hit':case 'bstun':case 'rec':f.vx*=.82;if(--f.stun<=0){toIdle(g,f);f.vx=0;}break;
  case 'launch':break;
  case 'down':f.vx*=.7;if(g.phase==='fight'||g.phase==='intro'){const quick=f.in&(A|B|S|G|IN.U);if(f.t>=(quick?22:40)){f.st='wake';f.t=0;f.inv=16;}}break;
  case 'wake':if(f.t>=14){toIdle(g,f);f.tp=10;}break;
  case 'throwing':{const m=mv(f),T=m.thr;if(o.st!=='thrown'){toIdle(g,f);break;}
   o.x=clamp(f.x+f.face*.55,-K.WALL,K.WALL);o.vx=o.vy=0;o.y=m.airOnly?Math.max(0,o.y+(f.y+.6-o.y)*.2):0;
   if(o.th?.tech&&o.t<=K.TECH&&both(o,0,1)){use(o,0,1);for(const k of [f,o]){k.st='hit';k.stun=16;k.mv=null;k.th=null;}f.vx=-f.face*.1;o.vx=f.face*.1;o.tp=20;g.stats[o.side].techs++;emit(g,'tech',{side:o.side});feat(g,o.side,'fight.tech');break;}
   if(f.t>=T){const dmg=damage(g,f,o,m,m.dmg);o.th=null;o.st='launch';o.vx=f.face*m.launch[0];o.vy=m.launch[1];o.y=Math.max(o.y,.05);o.jug=K.JMAX+1;o.inv=999;f.st='rec';f.stun=16;f.mv=null;g.hitstop=10;g.stats[f.side].throws++;
    emit(g,'throw',{side:f.side,id:m.id,x:o.x,y:o.y+1,dmg,combo:o.ch,kind:m.kind});checkKO(g,f,o,m);}
   break;}
  case 'thrown':if(o.st!=='throwing'){f.st='launch';f.vy=.08;f.th=null;}break;
  case 'dizzy':case 'ko':case 'win':f.vx*=.8;break;
 }
 // Physics.
 f.x+=f.vx;
 if(air(f)){const k=f.st==='launch'?1+.06*Math.min(f.jug,K.JMAX):1;f.vy-=grav*k;f.y+=f.vy;
  if(f.y<=0){f.y=0;f.vy=0;land(g,f,o);}}
 if(f.x>K.WALL||f.x<-K.WALL){const s=sign(f.x);f.x=s*K.WALL;
  if(f.ws&&(f.st==='launch'||f.st==='hit')&&f.vx*s>.035)splat(g,f,o,s);else if(f.st==='launch')f.vx=0;}
}
function land(g,f,o){
 if(f.st==='launch'||f.st==='ko'){const ko=f.hp<=0&&g.phase!=='finish';f.st=ko?'ko':'down';f.t=0;f.vx*=.4;f.inv=999;if(!ko&&g.phase==='finish'){f.st='ko';}emit(g,'down',{side:f.side,x:f.x});}
 else if(f.st==='atk'){const m=mv(f);if(m.air){toIdle(g,f);f.vx=0;}else if(m.fall){if(f.mt<=m.s+m.a){f.mt=m.s+m.a;}f.vx=0;emit(g,'land',{side:f.side,x:f.x,heavy:1});}else f.vx*=.3;}
 else if(f.st==='jump'){toIdle(g,f);f.vx=0;emit(g,'land',{side:f.side,x:f.x});}
 else if(f.st==='thrown'){/* held */}
 else{f.vx=0;}
 if(f.st==='down'||f.st==='ko')f.y=0;
}
function splat(g,f,o,s){f.ws=0;f.st='launch';f.vx=-s*.02;f.vy=.15;f.y=Math.max(f.y,.3);f.jug+=1;g.hitstop=Math.max(g.hitstop,9);emit(g,'wall',{side:f.side,x:f.x,y:f.y+1,dir:s});
 const hz=stageOf(g.stage).hazard;if(hz.side===s&&!g.hazUsed&&g.phase==='fight'){g.hazUsed=1;const d=Math.min(f.hp-1>0?hz.dmg:0,Math.max(0,f.hp-1));f.hp-=d;f.cd+=d;g.stats[o.side].dealt+=d;emit(g,'hazard',{side:f.side,x:f.x,dmg:d,name:hz.name});feat(g,o.side,'fight.wall');}}

function attack(g,f,o){
 const m=mv(f);f.mt++;const t=f.mt,end=m.s+m.a+m.r;
 // Kara: the first frames of a normal can still become a throw, a super or an amped special.
 if(t<=3&&m.kind==='normal'&&!air(f)&&!f.conn&&(both(f,0,1)||both(f,0,2)||both(f,1,2))){const c=choose(g,f,'ground');if(c&&c.id!==f.mv&&start(g,f,o,c.id,c.tech))return;}
 for(const adv of [m.adv,m.adv2])if(adv&&t>=adv[0]&&t<=adv[1])f.vx=adv[2]*f.face;else if(adv&&t===adv[1]+1)f.vx=0;
 if(!m.adv&&!air(f))f.vx*=.8;
 if(m.hop&&t===m.hop[0]){f.vx=m.hop[1]*f.face;f.vy=m.hop[2];f.y=Math.max(f.y,.001);emit(g,'jump',{side:f.side});}
 if(m.dive&&t===m.dive[0]){f.vx=m.dive[1]*f.face;f.vy=m.dive[2];}
 if(m.tele&&t===m.tele[0]){const [,mode,dist]=m.tele,from=f.x;f.origin=from;
  if(mode==='fwd')f.x=clamp(f.x+f.face*Math.min(dist,Math.max(0,Math.abs(o.x-f.x)-.8)),-K.WALL,K.WALL);
  else if(mode==='back')f.x=clamp(f.x-f.face*dist,-K.WALL,K.WALL);
  else if(mode==='behind'){const side=sign(o.x-f.x);let x=o.x+side*dist;if(Math.abs(x)>K.WALL)x=o.x-side*dist;f.x=x;f.face=sign(o.x-f.x)||f.face;}
  else if(mode==='above'){f.x=clamp(o.x-f.face*.15,-K.WALL,K.WALL);f.y=dist;f.vy=0;f.vx=0;}
  emit(g,'tele',{side:f.side,from,to:f.x,y:f.y});}
 if(t===m.s+1){
  if(m.proj)spawn(g,f,o,m);
  if(m.gain){f.meter=Math.min(K.METER,f.meter+m.gain);}if(m.heal){const h=Math.min(m.heal,f.max-f.hp);f.hp+=h;emit(g,'heal',{side:f.side,amount:h});}
  if(m.eat){const n=g.proj.length;g.proj=g.proj.filter(p=>p.o===f.side||p.pierce||Math.abs(p.x-f.x)>m.x1+.4);if(g.proj.length<n)emit(g,'projend',{x:f.x+f.face,y:1.2});}
 }
 // Cancels: after a move connects it can chain into its listed follow-ups.
 const free=m.free&&t>=m.free;
 if((f.conn&&t>m.s&&t>f.lastHit&&m.cancel.length)||free){const keep=[...f.pb],c=choose(g,f,air(f)?'air':'ground');
  if(c){const n=mv(f,c.id);let id=c.id;if(!free){if(m.cancel.includes(id)){}else if(id==='5L'&&m.id==='5L'&&m.cancel.includes('5LL'))id='5LL';else if(id==='5L'&&m.id==='5LL')id='5LLL';
    else if(n.kind==='special'&&m.cancel.includes('sp')&&m.kind==='normal'){}else if(n.kind==='super'&&m.cancel.includes('su')&&(f.conn===1||m.kind==='normal')){}else id=null;}
   if(id&&start(g,f,o,id,c.tech))return;f.pb=keep;}}
 const falling=m.fall&&t>m.s;
 if(falling&&air(f))return;
 if(falling&&!air(f)&&t<m.s+m.a)f.mt=m.s+m.a;
 if(f.mt>=end){if(air(f)){f.st='jump';f.airUsed=1;f.mv=null;}else{toIdle(g,f);f.vx=0;}}
}
function spawn(g,f,o,m){const p=m.proj,n=p.n||1;
 for(let i=0;i<n;i++){const x=p.at==='foe'?clamp(o.x+(i-(n-1)/2)*.9,-K.WALL,K.WALL):p.at==='origin'?f.origin??f.x:f.x+f.face*(p.dx??.7);
  g.proj.push({o:f.side,k:p.k,mv:m.id,x:p.k==='beam'?x:clamp(x,-K.WALL-.5,K.WALL+.5),y:p.y+(p.at==='foe'?i*.7:0),vx:(p.vx||0)*f.face,vy:p.vy||0,life:p.life,age:0,w:p.w,h:p.h,dmg:p.dmg,hs:p.hs,bs:p.bs,lv:p.lv,hits:p.hits,gap:p.gap,cd:p.trap?14:0,trap:p.trap?1:0,kd:p.kd?1:0,launch:p.launch||null,gnd:p.gnd?1:0,ret:p.ret||0,pierce:p.pierce?1:0,last:p.last||null,face:f.face,tech:f.tech,kind:m.kind,total:p.hits});}
 emit(g,'proj',{side:f.side,k:p.k,x:f.x,y:p.y});}

// ── Hits.
const height=f=>f.st==='down'||f.st==='ko'?.45:air(f)?1.5:f.low?1.15:1.75;
function hurtbox(f){const F=fighter(f.id),h=height(f)*F.scale;return [f.x-K.BODY,f.x+K.BODY,f.y,f.y+h];}
const overlap=(a0,a1,b0,b1)=>a0<=b1&&b0<=a1;
function scaleOf(g,att,def,m){let s=Math.max(m.kind==='super'?.5:.35,1-.1*def.sh);s*=fighter(att.id).pow;if(att.ud>0)s*=1.2;if(g.mod==='glass')s*=1.5;return s;}
function damage(g,att,def,m,base,tech=att.tech){
 if(g.phase==='finish')return 0;
 let d=base*scaleOf(g,att,def,m)*(tech?1.1:1);if(def.hurt===-1)d*=1.2;d=Math.round(d);
 if(g.training)d=Math.min(d,def.hp-1);d=Math.max(0,Math.min(d,def.hp));def.hp-=d;def.cd+=d;def.ch++;g.stats[att.side].dealt+=d;g.stats[att.side].best=Math.max(g.stats[att.side].best,def.ch);
 const gain=(g.mod==='amped'?3:1);att.meter=Math.min(K.METER,att.meter+d*.28*gain*(att.ud>0?1.5:1)*(m.kind==='super'?0:1));def.meter=Math.min(K.METER,def.meter+d*.16*gain);
 if(g.mod==='vampire'&&d>0){att.hp=Math.min(att.max,att.hp+Math.round(d*.3));}
 if(!g.first&&d>0){g.first=1;emit(g,'first',{side:att.side});}
 if(def.ch>=8)feat(g,att.side,'fight.combo8');
 return d;}
// One attack (a strike or a projectile) meets the defender. Returns true if it connected.
function strike(g,att,def,m,src){
 const P=src?.proj||null,lv=P?P.lv:m.lv,x=P?P.x:def.x-att.face*.3,isLast=P?P.hits<=1:att.hitN+1>=m.hits;
 const spec=P?{...P,...(isLast&&P.last?P.last:{})}:{...m,...(isLast&&m.last?m.last:{})};
 if(def.inv>0||def.st==='thrown'||def.st==='throwing'&&!P)return false;
 if((spec.gnd||lv==='low')&&air(def))return false;
 if(def.st==='atk'){const dm=mv(def),t=def.mt;
  if(dm.lowp&&t>=dm.lowp[0]&&t<=dm.lowp[1]&&lv!=='low'&&!spec.gnd)return false;
  if(dm.inv&&t>=dm.inv[0]&&t<=dm.inv[1])return false;
  if(dm.counter&&t>dm.s&&t<=dm.s+dm.a&&dm.counter.lv.includes(P?'proj':lv)){
   if(!P){att.st='hit';att.stun=44;att.mv=null;att.vx=0;if(air(att)){att.st='launch';att.vy=.05;att.jug=0;}}
   def.face=sign(att.x-def.x)||def.face;def.inv=10;start(g,def,att,dm.counter.then);g.hitstop=12;g.stats[def.side].reads++;emit(g,'counter',{side:def.side,x:def.x,y:1.2});if(g.stats[def.side].reads>=3)feat(g,def.side,'fight.read');return true;}
  if(dm.armor&&t>=dm.armor[0]&&t<=dm.armor[1]&&def.arm<(dm.armorHits||1)&&lv!=='throw'){def.arm++;const d=Math.min(def.hp-1,Math.round(spec.dmg*.6*fighter(att.id).pow));def.hp-=Math.max(0,d);g.stats[att.side].dealt+=Math.max(0,d);g.hitstop=Math.max(g.hitstop,7);emit(g,'armor',{side:def.side,x,y:def.y+1.1,dmg:d});return true;}
 }
 const blocking=(def.st==='block'||def.st==='bstun')&&!air(def)&&lv!=='throw'&&!(lv==='low'&&!def.low)&&!(lv==='over'&&def.low);
 const multi=(P?P.total>1:m.hits>1)&&!isLast;if(multi){spec.push=.012;if(!spec.launch&&air(def))spec.launch=[.004,.075];}
 const str=m.w||2,away=sign(def.x-(P?P.x-P.face:att.x))||att.face;
 if(blocking){const snap=def.st==='block'&&def.pb[3]<=5,iron=g.mod==='iron';let chip=snap||iron||def.ud>0?0:Math.round((spec.dmg||0)*(m.kind==='normal'?0:.14));chip=Math.max(0,Math.min(chip,def.hp-1));
  if(g.phase==='finish')chip=0;def.hp-=chip;def.st='bstun';def.stun=Math.max(4,(spec.bs||12)-(snap?5:0));def.vx=away*(spec.push||.06)*.9;if(Math.abs(def.x)>=K.WALL-.02&&!P)att.vx=-att.face*(spec.push||.06);
  def.meter=Math.min(K.METER,def.meter+(snap?18:4));att.meter=Math.min(K.METER,att.meter+3);g.hitstop=Math.max(g.hitstop,snap?9:3+str);
  if(snap){g.stats[def.side].snaps++;if(g.stats[def.side].snaps>=3)feat(g,def.side,'fight.snap');}
  emit(g,snap?'snap':'block',{side:def.side,x,y:def.y+(def.low?.7:1.2),chip,w:str});return true;}
 // A clean hit.
 const counter=def.st==='atk'&&def.mt<=mv(def).s+mv(def).a&&!P;def.hurt=counter?-1:0;
 const first=P?P.total===P.hits:att.hitN===0;
 if(first){if(def.ch>0)def.sh++;if(air(def))def.jug+=spec.jp||1;def.cl.push(m.id);}
 if(air(def))def.ah++;
 const dmg=damage(g,att,def,m,spec.dmg||0,P?P.tech:att.tech);
 if(counter){g.stats[att.side].reads++;if(g.stats[att.side].reads>=3)feat(g,att.side,'fight.read');}
 if(def.ah>=4)feat(g,att.side,'fight.juggle');
 const stale=def.cl.filter(id=>id===m.id).length>=3,capped=def.sh>=K.CAP,blow=stale||capped;
 def.mv=null;def.low=0;def.th=null;def.hurt=12;def.ws=spec.wall?1:0;
 if(g.phase==='finish'){def.st='launch';def.vx=away*.07;def.vy=.17;def.y=Math.max(def.y,.02);def.inv=999;g.pt=Math.max(g.pt,K.FINISH-K.END);g.fin=g.fin||{id:null,kind:'plain'};emit(g,'plain',{side:att.side});}
 else if(air(def)||spec.launch||spec.kd||blow||def.hp<=0){
  const L=spec.launch||(spec.kd?[.03,.1]:air(def)?[.02,.168]:[.07,.17]),decay=Math.max(.45,1-.065*def.jug);
  def.st='launch';def.vx=away*Math.abs(L[0])*(L[0]<0?-1:1)+(spec.push>.12?away*spec.push*.6:0);def.vy=L[1]*decay;def.y=Math.max(def.y,.02);
  if(blow){def.vx=away*.09;def.vy=.2;def.inv=999;}if(def.jug>K.JMAX)def.inv=999;}
 else{def.st='hit';def.stun=Math.max(5,(spec.hs||18)-Math.max(0,def.sh-3)*2+(counter?4:0));def.vx=away*(spec.push||.06);if(Math.abs(def.x)>=K.WALL-.02&&!P)att.vx=-att.face*(spec.push||.06)*1.2;}
 g.hitstop=Math.max(g.hitstop,multi?3:[0,5,8,9,10][str]+(counter?3:0));
 emit(g,'hit',{side:def.side,by:att.side,id:m.id,x,y:P?P.y:def.y+(lv==='low'?.35:lv==='high'?1.35:1),dmg,w:str,lv,combo:def.ch,counter,proj:P?P.k:null,kind:m.kind,launch:def.st==='launch'});
 g.last={by:att.side,kind:m.kind,id:m.id};checkKO(g,att,def,m);return true;}
function checkKO(g,att,def,m){
 if(def.hp>0||g.phase!=='fight')return;def.hp=0;if(def.st!=='launch'){def.st='launch';def.vx=sign(def.x-att.x)*.06;def.vy=.17;def.y=Math.max(def.y,.02);}def.inv=999;def.th=null;
 if(att.hp<=0&&att.st!=='ko'){att.hp=1;}endRound(g,att.side,'ko',m);}
function grab(g,att,def,m){
 const front=(def.x-att.x)*att.face;if(front<-.25||front>m.x1+.1)return false;
 if(def.inv>0||def.tp>0)return false;
 if(m.airOnly){if(!air(def)||def.y<m.y[0]-1.2||def.y>m.y[1]||def.st==='thrown')return false;}
 else if(air(def)||['hit','bstun','launch','down','wake','thrown','ko','throwing'].includes(def.st)&&g.phase!=='finish')return false;
 if(def.st==='atk'){const dm=mv(def),t=def.mt;if(dm.inv&&t>=dm.inv[0]&&t<=dm.inv[1])return false;if(dm.counter&&t>dm.s&&t<=dm.s+dm.a&&dm.counter.lv.includes('throw')){att.st='hit';att.stun=44;att.mv=null;def.inv=10;start(g,def,att,dm.counter.then);g.hitstop=12;emit(g,'counter',{side:def.side,x:def.x,y:1.2});return true;}}
 if(g.phase==='finish'){strike(g,att,def,{...m,lv:'mid'},null);return true;}
 const free=actionable(def)||def.st==='dash'||def.st==='bdash'||def.st==='pre';
 if(def.ch===0){def.sh=0;def.cl=[];}
 att.st='throwing';att.t=0;att.vx=0;def.st='thrown';def.t=0;def.mv=null;def.vx=def.vy=0;def.th={tech:!!m.tech&&free};def.cl.push(m.id);
 emit(g,'grab',{side:att.side,id:m.id,x:def.x});return true;}
function resolve(g){
 const pend=[];
 for(const f of g.f){if(f.st!=='atk')continue;const m=mv(f),o=g.f[1-f.side],t=f.mt;
  const active=m.fall?t>m.s&&air(f):t>m.s&&t<=m.s+m.a;if(!active||!(m.dmg>0||m.lv==='throw'))continue;
  if(f.hitN>=m.hits||(f.hitN>0&&t-f.lastHit<m.gap))continue;
  if(m.flip&&f.hitN>0){const side=sign(f.x-o.x)||1;f.x=clamp(o.x-side*.9,-K.WALL,K.WALL);f.face=sign(o.x-f.x)||f.face;emit(g,'tele',{side:f.side,from:f.x,to:f.x,y:f.y});}
  const a0=f.x+f.face*m.x0,a1=f.x+f.face*m.x1,[h0,h1,y0,y1]=hurtbox(o);
  if(!overlap(Math.min(a0,a1),Math.max(a0,a1),h0,h1)||!overlap(f.y+m.y[0]-(o.st==='launch'?.3:0),f.y+m.y[1]+(o.st==='launch'?.9:0),y0,y1))continue;
  pend.push([f,o,m]);}
 for(const [f,o,m]of pend){if(f.st!=='atk'||f.mv!==m.id)continue;
  const ok=m.lv==='throw'?grab(g,f,o,m):strike(g,f,o,m,null);
  if(ok&&f.st==='atk'&&f.mv===m.id){f.hitN++;f.lastHit=f.mt;f.conn=o.st==='bstun'?2:1;}}
}
function projectiles(g){
 for(const p of g.proj){p.age++;p.life--;if(p.cd>0)p.cd--;if(p.ret&&p.age===p.ret){p.vx=-p.vx;}p.x+=p.vx;p.y+=p.vy;
  if((Math.abs(p.x)>K.WALL+1.2&&p.k!=='beam')||p.y<-.2)p.life=0;if(p.life<=0||p.cd>0)continue;
  const def=g.f[1-p.o],att=g.f[p.o],[h0,h1,y0,y1]=hurtbox(def);
  if(overlap(p.x-p.w,p.x+p.w,h0,h1)&&overlap(p.y,p.y+p.h,y0,y1)){const m=fighter(att.id).moves[p.mv];
   if(strike(g,att,def,m,{proj:p})){p.hits--;p.cd=p.gap;if(p.hits<=0)p.life=0;}}
 }
 // Projectiles from opposite sides cancel each other.
 for(const a of g.proj)for(const b of g.proj)if(a.o<b.o&&a.life>0&&b.life>0&&!a.trap&&!b.trap&&Math.abs(a.x-b.x)<a.w+b.w&&Math.abs(a.y-b.y)<.8){if(!a.pierce)a.life=0;if(!b.pierce)b.life=0;emit(g,'projend',{x:(a.x+b.x)/2,y:a.y});}
 g.proj=g.proj.filter(p=>p.life>0);
}
function separate(g){const [a,b]=g.f;const ghost=f=>{if(f.st!=='atk')return false;const m=mv(f);return m.ghost&&f.mt>=m.ghost[0]&&f.mt<=m.ghost[1];};
 if(ghost(a)||ghost(b)||a.st==='thrown'||b.st==='thrown'||['down','ko'].includes(a.st)||['down','ko'].includes(b.st))return;
 if(Math.abs(a.y-b.y)>1.3)return;const d=b.x-a.x,min=K.BODY*2;
 if(Math.abs(d)<min){const push=(min-Math.abs(d))/2,s=d===0?(a.side?1:-1)*-1:sign(d);a.x-=s*push;b.x+=s*push;
  for(const f of g.f)f.x=clamp(f.x,-K.WALL,K.WALL);const d2=b.x-a.x;if(Math.abs(d2)<min){if(Math.abs(a.x)>=K.WALL)b.x=a.x+s*min;else a.x=b.x-s*min;}}
}

// ── Rounds and the match.
function endRound(g,winner,how,m){
 const w=g.f[winner],l=g.f[1-winner],st=g.stats[winner];g.wins[winner]++;
 const perfect=w.hp===w.max,clutch=w.hp<=w.max*.1;if(perfect)st.perfect++;if(clutch)st.clutch++;if(how==='ko'&&m?.kind==='super')st.superKO++;
 g.rounds.push({winner,how,perfect,clutch,time:Math.ceil(g.timer/60)});
 if(how==='ko'){if(perfect)feat(g,winner,'fight.untouched');if(clutch)feat(g,winner,'fight.whisker');if(w.udUsed)feat(g,winner,'fight.underdawg');if(m?.kind==='super')feat(g,winner,'fight.super');}
 const match=g.wins[winner]>=g.need;g.phase='ko';g.pt=0;g.proj=[];g.koBy={winner,how,match,super:m?.kind==='super'};
 emit(g,how==='ko'?'ko':'time',{winner,perfect,clutch,match,super:m?.kind==='super'});}
function timeUp(g){const [a,b]=g.f,ra=a.hp/a.max,rb=b.hp/b.max;
 if(ra===rb){g.rounds.push({winner:-1,how:'draw'});g.phase='ko';g.pt=0;g.koBy={winner:-1,how:'draw',match:false};emit(g,'time',{winner:-1});return;}
 endRound(g,ra>rb?0:1,'time',null);}
function finishMatch(g,winner){
 const st=g.stats[winner],w=g.f[winner];g.phase='over';g.pt=0;
 const fin=g.fin?.id?finisher(g.fin.id):null,lost=g.wins[1-winner];
 const score=Math.round(1000+w.hp/w.max*500+st.perfect*400+st.clutch*150+st.best*40+(fin?fin.kind==='dive'?900:fin.kind==='rub'?600:750:0)+(lost===0?300:0)+st.snaps*30+st.reads*30);
 g.result={winner,loser:1-winner,wins:[...g.wins],finisher:fin?.id||null,kind:fin?.kind||'plain',score,best:st.best,perfect:st.perfect,rounds:g.rounds.length};
 feat(g,winner,'fight.debut');if(lost===0&&g.need>1)feat(g,winner,'fight.sweep');
 for(const f of g.f)if(f.st!=='ko'&&f.st!=='down'&&f.side===winner)f.st='win';
 emit(g,'over',{winner,score,finisher:g.result.finisher});}
function tryFinisher(g,w,l){
 if(!actionable(w)&&!['dash','bdash','pre','jump'].includes(w.st))return false;
 const list=finishersFor(w.id,g.stage),dist=Math.abs(l.x-w.x),p=w.pb;let pick=null;
 if(g.simple[w.side]&&p[2]===0){const d=w.dir;pick=w.in&G?list[4]:d>=7?list[3]:d<=3?list[0]:d===6?list[1]:d===4?list[2]:null;if(!pick){emit(g,'finhint',{side:w.side});use(w,2);return true;}}
 else if((p[0]===0||p[1]===0)&&w.taps.length>=3){const t=w.taps.slice(-3);if(g.frame-t[0][1]<=110){const s=t.map(x=>({6:'F',4:'B',2:'D',8:'U'})[x[0]]).join('')+' '+(p[1]===0?'B':'A'),hit=list.find(f=>f.seq===s);
   if(hit){const ok=hit.range==='any'||(hit.range==='close'?dist<=K.CLOSE:hit.range==='far'?dist>=K.FAR:dist>K.CLOSE&&dist<K.FAR);if(!ok){emit(g,'finrange',{side:w.side,need:hit.range});use(w,0,1);w.taps=[];return true;}pick=hit;}}}
 if(!pick)return false;
 use(w,0,1,2);w.taps=[];g.phase='cine';g.pt=0;g.proj=[];g.fin={id:pick.id,kind:pick.kind,dur:Math.round((CINE_DUR[pick.id]||7)*60),winner:w.side};
 for(const f of g.f){f.vx=f.vy=0;f.y=0;f.mv=null;}w.st='idle';l.st='dizzy';
 feat(g,w.side,pick.kind==='dive'?'fight.dive':pick.kind==='rub'?'fight.rub':'fight.curtain');if(pick.kind!=='curtain')feat(g,w.side,'fight.curtain');
 emit(g,'finisher',{id:pick.id,kind:pick.kind,name:pick.name,winner:w.side,loser:l.side});return true;}

/** Advance one 60 Hz frame with each side's input bits. Returns the events of this frame. */
export function step(g,in0=0,in1=0){
 g.events=[];if(g.phase==='over')return g.events;g.frame++;
 const frozen=g.freeze>0||g.hitstop>0,ins=[in0,in1];
 for(const f of g.f)read(f,g.phase==='intro'||g.phase==='cine'||(g.phase==='ko')?0:(g.phase==='finish'&&f.side!==g.koBy.winner?0:ins[f.side]),g.frame,frozen);
 if(g.freeze>0){g.freeze--;return g.events;}
 if(g.hitstop>0){g.hitstop--;return g.events;}
 g.pt++;
 if(g.phase==='cine'){if(g.pt>=g.fin.dur)finishMatch(g,g.fin.winner);return g.events;}
 if(g.phase==='intro'){if(g.pt>=K.INTRO){g.phase='fight';g.pt=0;emit(g,'fight',{round:g.round});}return g.events;}
 if(g.phase==='finish'){const w=g.f[g.koBy.winner],l=g.f[1-g.koBy.winner];if(l.st!=='launch'&&l.st!=='ko'&&tryFinisher(g,w,l))return g.events;}
 const [a,b]=g.f;tick(g,a,b);tick(g,b,a);separate(g);resolve(g);projectiles(g);
 if(g.phase==='fight'){if(!g.training&&--g.timer<=0)timeUp(g);}
 else if(g.phase==='ko'&&g.pt>=K.KO){const k=g.koBy;
  if(k.match&&k.how==='ko'){const w=g.f[k.winner],l=g.f[1-k.winner];g.phase='finish';g.pt=0;l.st='dizzy';l.y=0;l.vx=l.vy=0;l.inv=0;l.hp=0;l.jug=0;l.ch=0;l.sh=0;l.cl=[];l.x=clamp(l.x,-K.WALL+.6,K.WALL-.6);l.face=sign(w.x-l.x)||l.face;if(!actionable(w)&&!air(w)){toIdle(g,w);}w.taps=[];g.fin=null;emit(g,'finishwin',{winner:k.winner});}
  else if(k.match)finishMatch(g,k.winner);
  else{g.round++;resetRound(g);}}
 else if(g.phase==='finish'&&g.pt>=K.FINISH){const l=g.f[1-g.koBy.winner];if(l.st==='dizzy'){l.st='ko';emit(g,'down',{side:l.side,x:l.x});}finishMatch(g,g.koBy.winner);}
 return g.events;
}
/** Step with AI filling in the CPU sides; `human` is the input for side 0 (and side 1 if human). */
export function stepAuto(g,h0=0,h1=0){const i0=g.cpu[0]?aiInput(g,0):h0,i1=g.cpu[1]?aiInput(g,1):h1;return step(g,i0,i1);}
/** Replay a match from its config and input log: [[in0,in1], ...] (CPU sides are recomputed). */
export function replay(config,log){const g=createMatch(config);for(const [a,b]of log){stepAuto(g,a,b);if(g.phase==='over')break;}return g;}
// A compact fingerprint of everything that matters, for determinism checks.
export function hashState(g){let h=0x811c9dc5;const add=n=>{h^=Math.round(n*1000)&0xffffffff;h=Math.imul(h,0x01000193)>>>0;};
 add(g.frame);add(g.timer);add(g.round);add(g.wins[0]*3+g.wins[1]);add(g.proj.length);for(const f of g.f){add(f.x);add(f.y);add(f.hp);add(f.meter);add(f.st.length+f.st.charCodeAt(0));add(f.mt);add(f.ch);}for(const p of g.proj){add(p.x);add(p.y);}return h>>>0;}
// A combo trial is done when the rival's current combo contains its moves in order.
export function trialDone(g,side,moves){const cl=g.f[1-side].cl.map(id=>id.replace('+',''));let i=0;for(const id of cl)if(id===moves[i])i++;return i>=moves.length;}

// Today's challenge: the same fighter, rival, stage and twist for everyone on a given day.
export function DAILY_TWIST(seed){let a=(seed>>>0)||1;const r=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
 const pool=STARTERS.filter(id=>id!=='you'),me=pool[Math.floor(r()*pool.length)],rest=FIGHTER_IDS.filter(id=>id!==me&&id!=='you'),rival=rest[Math.floor(r()*rest.length)];
 return {seed:seed>>>0,fighter:me,rival,stage:STAGE_IDS[Math.floor(r()*STAGE_IDS.length)],mod:MOD_IDS[Math.floor(r()*MOD_IDS.length)],lvl:3+Math.floor(r()*2)};}
export const daySeed=(d=new Date())=>d.getUTCFullYear()*10000+(d.getUTCMonth()+1)*100+d.getUTCDate();

// ── The save: tower progress, the finisher gallery, trials and settings.
export const FIGHT_FIELDS=['v','tower','cleared','fins','trials','wins','losses','simple','diff','last','daily','feats','king','best'];
export function freshSave(){return {v:1,tower:0,cleared:[],fins:[],trials:[],wins:0,losses:0,simple:true,diff:2,last:'biscuit',daily:{day:0,won:false,streak:0},feats:[],king:false,best:0};}
const int=(n,a=0,b=1e9)=>Number.isInteger(n)&&n>=a&&n<=b,uniq=a=>new Set(a).size===a.length;
export function validFightSave(v){
 if(v===null)return true;if(!v||typeof v!=='object'||Array.isArray(v)||v.v!==1)return false;
 if(Object.keys(v).some(k=>!FIGHT_FIELDS.includes(k)))return false;
 const ids=(a,ok,max)=>Array.isArray(a)&&a.length<=max&&uniq(a)&&a.every(x=>typeof x==='string'&&ok(x));
 return int(v.tower,0,8)&&ids(v.cleared,x=>FIGHTER_IDS.includes(x),FIGHTER_IDS.length)&&ids(v.fins,x=>!!x.match(/^[a-z]+:[a-z_]+$/)&&FIGHTER_IDS.includes(x.split(':')[0])&&!!finisher(x.split(':')[1]),600)
  &&ids(v.trials,x=>/^[a-z]+\.t[1-3]$/.test(x)&&FIGHTER_IDS.includes(x.split('.')[0]),60)&&int(v.wins)&&int(v.losses)&&typeof v.simple==='boolean'&&int(v.diff,1,5)&&FIGHTER_IDS.includes(v.last)
  &&!!v.daily&&typeof v.daily==='object'&&int(v.daily.day,0,99991231)&&typeof v.daily.won==='boolean'&&int(v.daily.streak,0,1e5)&&Object.keys(v.daily).length===3
  &&ids(v.feats,x=>FEAT_IDS.includes(x),FEAT_IDS.length)&&typeof v.king==='boolean'&&int(v.best);}
export {FIGHTERS,FINISHERS,CALL};
