// Seeded, three-lane runner. Every obstacle row keeps one lane completely open, and a trail of
// gold leads into it. The safe lane is never the whole story: gold bones sit over crates and
// under arches, late swerves count as close calls, and every trick feeds a flow multiplier
// that drains if the DAWG plays it safe for too long.
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';
export const RUNNER={air:.85,turn:.12,buffer:.2,trail:7,near:.3,flow:7,maxMult:5,perMult:3,points:{dodge:30,near:50,prize:100},prizeGold:3,firstPerson:1.25};
// Feats: specific things to pull off in one run. Each is awarded once per run as {type:'feat', id}.
export const FEATS=[
 {id:'runner.dodge25',name:'Untouchable',text:'Dodge 25 obstacles in one run',test:g=>g.dodged>=25},
 {id:'runner.near5',name:'Whisker Close',text:'Pull off 5 close calls',test:g=>g.nears>=5},
 {id:'runner.prize3',name:'High Roller',text:'Grab 3 prize bones off the obstacles',test:g=>g.prizes>=3},
 {id:'runner.flow5',name:'In The Zone',text:'Build your flow to ×5',test:g=>g.mult>=RUNNER.maxMult},
 {id:'runner.streak20',name:'Twenty Straight',text:'Chain 20 tricks without breaking flow',test:g=>g.bestStreak>=20},
 {id:'runner.km',name:'First Kilometer',text:'Run 1,000 meters',test:g=>g.distance>=1000},
 {id:'runner.marathon',name:'Night Marathon',text:'Run 2,500 meters',test:g=>g.distance>=2500},
 {id:'runner.gold100',name:'Gold Rush',text:'Collect 100 gold in one run',test:g=>g.coins>=100},
 {id:'runner.clean',name:'Not A Scratch',text:'Run 800 meters without losing a shield',test:g=>g.distance>=800&&g.hits===0},
 {id:'runner.helmet',name:'Eyes On The Road',text:'Land 15 tricks in first person',test:g=>g.fpTricks>=15}
];
export const runnerMult=streak=>Math.min(RUNNER.maxMult,1+Math.floor(streak/RUNNER.perMult));
export class RunnerGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.distance=0;this.lane=1;this.visualLane=1;this.jump=0;this.slide=0;this.turnCooldown=0;this.shield=0;this.magnet=0;this.coins=0;this.dodged=0;this.hits=0;this.spawned=0;this.rows=[];this.events=[];this.reason='';this.score=0;
  this.bonus=0;this.streak=0;this.bestStreak=0;this.flow=0;this.nears=0;this.prizes=0;this.buffer=null;this.swerveLane=-1;this.swerveAge=9;this.fp=false;this.fpTricks=0;this.feats=[];for(const z of [90,150,210])this.spawn(z);}
 checkFeats(){for(const f of FEATS)if(!this.feats.includes(f.id)&&f.test(this)){this.feats.push(f.id);this.events.push({type:'feat',id:f.id,name:f.name});}}
 get x(){return 210+(this.visualLane-1)*112;}get y(){return 463;}
 get heat(){return heatOf(this.distance,FULL_HEAT.runner);}
 get speed(){return ramp(25,40,this.heat);}
 get mult(){return runnerMult(this.streak);}
 spawn(z){const safe=Math.floor(this.random()*3),other=[0,1,2].filter(l=>l!==safe),types=['crate','bar','block'];this.spawned++;const obstacles=other.filter((_,i)=>i===0||this.random()>.32).map(lane=>({lane,type:types[Math.floor(this.random()*types.length)]}));
  const power=this.spawned%7===0?(this.spawned%14===0?'magnet':'shield'):null,risky=obstacles.filter(o=>o.type!=='block'),roll=this.random();
  // A gold bone over a crate or under an arch: worth far more than the gold in the safe lane.
  const prize=!power&&this.spawned>3&&risky.length&&roll<.45?risky[Math.floor(roll/.45*risky.length)].lane:-1;
  this.rows.push({id:this.spawned,z,safe,obstacles,power,prize,got:0});}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 // A press that cannot happen yet (mid-turn, mid-air) is remembered for a moment and replayed.
 move(dir){if(this.status!=='playing')return false;if(this.act(dir)){this.buffer=null;return true;}if(['up','down','left','right'].includes(dir))this.buffer={dir,t:RUNNER.buffer};return false;}
 act(dir){
  if(dir==='up'){if(this.jump>0)return false;this.slide=0;this.jump=RUNNER.air;this.events.push({type:'jump'});return true;}
  // Sliding out of a jump drops the DAWG straight back to the street.
  if(dir==='down'){if(this.slide>0)return false;const drop=this.jump>0;this.jump=0;this.slide=RUNNER.air;this.events.push({type:'slide',drop});return true;}
  const change=dir==='left'?-1:dir==='right'?1:0;if(!change||this.turnCooldown>0||this.lane+change<0||this.lane+change>2)return false;
  this.swerveLane=this.lane;this.swerveAge=0;this.lane+=change;this.turnCooldown=RUNNER.turn;this.events.push({type:'turn',dir});return true;}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 trick(type){this.streak++;this.bestStreak=Math.max(this.bestStreak,this.streak);this.flow=RUNNER.flow;// Tricks landed in first person pay a quarter more.
  const mult=this.mult,points=Math.round(RUNNER.points[type]*mult*(this.fp?RUNNER.firstPerson:1));if(this.fp)this.fpTricks++;this.bonus+=points;return {type,points,mult,streak:this.streak,fp:this.fp};}
 gold(){this.coins++;this.events.push({type:'coin'});}
 tick(dt){if(this.status!=='playing')return;this.time+=dt;const step=this.speed*dt;this.distance+=step;this.jump=Math.max(0,this.jump-dt);this.slide=Math.max(0,this.slide-dt);this.turnCooldown=Math.max(0,this.turnCooldown-dt);this.magnet=Math.max(0,this.magnet-dt);this.swerveAge=Math.min(9,this.swerveAge+dt);this.visualLane+=(this.lane-this.visualLane)*Math.min(1,dt*18);
  if(this.buffer){if(this.act(this.buffer.dir)||(this.buffer.t-=dt)<=0)this.buffer=null;}
  if(this.flow>0&&(this.flow-=dt)<=0){this.flow=0;if(this.mult>1)this.events.push({type:'flowbreak',streak:this.streak});this.streak=0;}
  for(const row of this.rows){row.z-=step;
   // The gold trail runs up to the row along its open lane.
   while(row.got!==undefined&&row.got<2&&row.z<=RUNNER.trail*(2-row.got)){row.got++;if(this.lane===row.safe||this.magnet>0)this.gold();}
   if(row.z>0)continue;const obstacle=row.obstacles.find(o=>o.lane===this.lane),safe=!obstacle||obstacle.type==='crate'&&this.jump>0||obstacle.type==='bar'&&this.slide>0;
   if(!safe){if(this.shield){this.shield=0;this.hits++;this.streak=0;this.flow=0;this.events.push({type:'shield'});}else{this.score=Math.floor(this.distance)+this.coins*25+this.bonus;this.end(obstacle.type==='crate'?'A crate caught your paws. Swipe up to jump or change lanes.':obstacle.type==='bar'?'Duck under the neon arch. Swipe down to slide or change lanes.':'Roadblock. Change lanes; jumping will not clear this one.');return;}}
   else if(obstacle){this.dodged++;this.events.push(this.trick('dodge'));if(row.prize===obstacle.lane){this.prizes++;this.coins+=RUNNER.prizeGold;this.events.push(this.trick('prize'));}}
   else if(this.swerveAge<=RUNNER.near&&row.obstacles.some(o=>o.lane===this.swerveLane)){this.nears++;this.swerveAge=9;this.events.push(this.trick('near'));}
   if(this.lane===row.safe||this.magnet>0)this.gold();
   if(row.power&&this.lane===row.safe){if(row.power==='shield')this.shield=1;else this.magnet=10+(this.career?.magnet||0);this.events.push({type:'power',power:row.power});}
  }
  trackHeat(this,this.heat);this.rows=this.rows.filter(r=>r.z>0);const last=this.rows.at(-1);if(!last||last.z<210)this.spawn((last?.z||160)+ramp(50,36,this.heat)+this.random()*ramp(18,10,this.heat));this.score=Math.floor(this.distance)+this.coins*25+this.bonus;this.checkFeats();
 }
}

const number=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
const int=(n,a,b)=>Number.isInteger(n)&&number(n,a,b);
// Saves from before the flow rules lack the new fields and are refused, so that run starts fresh.
export function validRunnerSnapshot(s){return int(s.lane,0,2)&&number(s.visualLane,0,2)&&number(s.distance,0,1e8)&&number(s.jump,0,RUNNER.air)&&number(s.slide,0,RUNNER.air)&&!(s.jump>0&&s.slide>0)&&number(s.turnCooldown,0,RUNNER.turn)&&int(s.shield,0,1)&&number(s.magnet,0,14)&&int(s.coins,0,1e7)&&int(s.dodged,0,1e7)&&int(s.hits,0,1e7)&&int(s.spawned,3,1e7)
 &&int(s.bonus,0,1e9)&&int(s.streak,0,1e7)&&int(s.bestStreak,s.streak,1e7)&&number(s.flow,0,RUNNER.flow)&&int(s.nears,0,1e7)&&int(s.prizes,0,1e7)&&(s.buffer===null||!!s.buffer&&['up','down','left','right'].includes(s.buffer.dir)&&number(s.buffer.t,0,RUNNER.buffer))&&int(s.swerveLane,-1,2)&&number(s.swerveAge,0,9)&&(s.fpTricks===undefined||int(s.fpTricks,0,1e7))&&(s.feats===undefined||Array.isArray(s.feats)&&s.feats.length<=FEATS.length&&new Set(s.feats).size===s.feats.length&&s.feats.every(id=>FEATS.some(f=>f.id===id)))
 &&s.score===Math.floor(s.distance)+s.coins*25+s.bonus&&Array.isArray(s.rows)&&s.rows.length>=1&&s.rows.length<=8&&new Set(s.rows.map(r=>r?.id)).size===s.rows.length&&s.rows.every((r,i)=>r&&int(r.id,1,s.spawned)&&number(r.z,0,300)&&(!i||r.z>s.rows[i-1].z)&&int(r.safe,0,2)&&[null,'shield','magnet'].includes(r.power)&&(r.got===undefined||int(r.got,0,2))&&Array.isArray(r.obstacles)&&r.obstacles.length>=1&&r.obstacles.length<=2&&new Set(r.obstacles.map(o=>o?.lane)).size===r.obstacles.length&&r.obstacles.every(o=>o&&int(o.lane,0,2)&&o.lane!==r.safe&&['crate','bar','block'].includes(o.type))
  &&(r.prize===undefined||r.prize===-1||r.obstacles.some(o=>o.lane===r.prize&&o.type!=='block')));}
export const RUNNER_FIELDS=['distance','lane','visualLane','jump','slide','turnCooldown','shield','magnet','coins','dodged','hits','spawned','rows','bonus','streak','bestStreak','flow','nears','prizes','buffer','swerveLane','swerveAge','fpTricks','feats'];
