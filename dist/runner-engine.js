// Seeded, three-lane runner. Every obstacle row keeps one lane completely open.
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';
export class RunnerGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.distance=0;this.lane=1;this.visualLane=1;this.jump=0;this.slide=0;this.turnCooldown=0;this.shield=0;this.magnet=0;this.coins=0;this.dodged=0;this.hits=0;this.spawned=0;this.rows=[];this.events=[];this.reason='';this.score=0;for(const z of [90,150,210])this.spawn(z);}
 get x(){return 210+(this.visualLane-1)*112;}get y(){return 463;}
 get heat(){return heatOf(this.distance,FULL_HEAT.runner);}
 get speed(){return ramp(25,40,this.heat);}
 spawn(z){const safe=Math.floor(this.random()*3),other=[0,1,2].filter(l=>l!==safe),types=['crate','bar','block'];this.spawned++;const obstacles=other.filter((_,i)=>i===0||this.random()>.32).map(lane=>({lane,type:types[Math.floor(this.random()*types.length)]}));this.rows.push({id:this.spawned,z,safe,obstacles,power:this.spawned%7===0?(this.spawned%14===0?'magnet':'shield'):null});}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 move(dir){if(this.status!=='playing')return false;if(dir==='up'||dir==='down'){if(this.jump>0||this.slide>0)return false;this[dir==='up'?'jump':'slide']=.85;this.events.push({type:dir==='up'?'jump':'slide'});return true;}const change=dir==='left'?-1:dir==='right'?1:0;if(!change||this.turnCooldown>0||this.lane+change<0||this.lane+change>2)return false;this.lane+=change;this.turnCooldown=.12;return true;}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 tick(dt){if(this.status!=='playing')return;this.time+=dt;const step=this.speed*dt;this.distance+=step;this.jump=Math.max(0,this.jump-dt);this.slide=Math.max(0,this.slide-dt);this.turnCooldown=Math.max(0,this.turnCooldown-dt);this.magnet=Math.max(0,this.magnet-dt);this.visualLane+=(this.lane-this.visualLane)*Math.min(1,dt*18);
  for(const row of this.rows){row.z-=step;if(row.z>0)continue;const obstacle=row.obstacles.find(o=>o.lane===this.lane),safe=!obstacle||obstacle.type==='crate'&&this.jump>0||obstacle.type==='bar'&&this.slide>0;
   if(!safe){if(this.shield){this.shield=0;this.hits++;this.events.push({type:'shield'});}else{this.score=Math.floor(this.distance)+this.coins*25;this.end(obstacle.type==='crate'?'A crate caught your paws. Swipe up to jump or change lanes.':obstacle.type==='bar'?'Duck under the neon arch. Swipe down to slide or change lanes.':'Roadblock. Change lanes; jumping will not clear this one.');return;}}
   else if(obstacle){this.dodged++;this.events.push({type:'dodge'});}
   if(this.lane===row.safe||this.magnet>0){this.coins++;this.events.push({type:'coin'});}
   if(row.power&&this.lane===row.safe){if(row.power==='shield')this.shield=1;else this.magnet=10+(this.career?.magnet||0);this.events.push({type:'power',power:row.power});}
  }
  trackHeat(this,this.heat);this.rows=this.rows.filter(r=>r.z>0);const last=this.rows.at(-1);if(!last||last.z<210)this.spawn((last?.z||160)+50+this.random()*18);this.score=Math.floor(this.distance)+this.coins*25;
 }
}

const number=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
const int=(n,a,b)=>Number.isInteger(n)&&number(n,a,b);
export function validRunnerSnapshot(s){return int(s.lane,0,2)&&number(s.visualLane,0,2)&&number(s.distance,0,1e8)&&number(s.jump,0,.85)&&number(s.slide,0,.85)&&!(s.jump>0&&s.slide>0)&&number(s.turnCooldown,0,.12)&&int(s.shield,0,1)&&number(s.magnet,0,14)&&int(s.coins,0,1e7)&&int(s.dodged,0,1e7)&&int(s.hits,0,1e7)&&int(s.spawned,3,1e7)&&s.score===Math.floor(s.distance)+s.coins*25&&Array.isArray(s.rows)&&s.rows.length>=1&&s.rows.length<=6&&new Set(s.rows.map(r=>r?.id)).size===s.rows.length&&s.rows.every((r,i)=>r&&int(r.id,1,s.spawned)&&number(r.z,0,300)&&(!i||r.z>s.rows[i-1].z)&&int(r.safe,0,2)&&[null,'shield','magnet'].includes(r.power)&&Array.isArray(r.obstacles)&&r.obstacles.length>=1&&r.obstacles.length<=2&&new Set(r.obstacles.map(o=>o?.lane)).size===r.obstacles.length&&r.obstacles.every(o=>o&&int(o.lane,0,2)&&o.lane!==r.safe&&['crate','bar','block'].includes(o.type)));}
export const RUNNER_FIELDS=['distance','lane','visualLane','jump','slide','turnCooldown','shield','magnet','coins','dodged','hits','spawned','rows'];
