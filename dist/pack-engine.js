import {hash as worldHash} from './world.js';
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';
// Browser-independent rules for the quick-play games. Coordinates are logical pixels.
export const PACK_WIDTH=420, PACK_HEIGHT=560;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class FlappyGame {
 constructor(random=Math.random,worldSeed=0){this.worldSeed=worldSeed;this.random=random;this.status='ready';this.time=0;this.y=260;this.vy=0;this.x=108;this.radius=14;this.score=0;this.gates=0;this.perfect=0;this.obstacles=[];this.events=[];this.reason='';this.spawn(480);}
 get heat(){return heatOf(this.gates,FULL_HEAT.flappy);}
 spawn(x){const gap=ramp(202,154,this.heat),last=this.obstacles.at(-1);let center=150+this.random()*245;if(this.worldSeed&&last)center=clamp(center,last.center-105,last.center+105);const o={x,center,gap,width:66,passed:false};if(this.worldSeed){o.baseCenter=center;o.amplitude=this.gates>=4?this.random()*ramp(12,32,this.heat):0;o.phase=this.random()*6.28;}this.obstacles.push(o);}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 flap(){if(this.status!=='playing')return false;this.vy=-304;this.events.push({type:'flap',x:this.x,y:this.y});return true;}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 tick(dt){if(this.status!=='playing')return;this.time+=dt;this.vy+=880*dt;this.y+=this.vy*dt;const speed=ramp(132,204,this.heat);
  for(const o of this.obstacles){o.x-=speed*dt;if(o.baseCenter!==undefined)o.center=clamp(o.baseCenter+Math.sin(this.time*1.3+o.phase)*o.amplitude,150,395);
   if(this.x+this.radius>o.x&&this.x-this.radius<o.x+o.width&&(this.y-this.radius<o.center-o.gap/2||this.y+this.radius>o.center+o.gap/2)){this.end('Clipped a neon tower. Find your rhythm.');return;}
   if(!o.passed&&o.x+o.width<this.x-this.radius){o.passed=true;this.gates++;this.score+=10;const perfect=Math.abs(this.y-o.center)<27+(this.career?.perfect||0);if(perfect){this.score+=5;this.perfect++;}this.events.push({type:'score',perfect,x:this.x,y:this.y});}
  }
  this.obstacles=this.obstacles.filter(o=>o.x+o.width>-20);const last=this.obstacles.at(-1);if(!last||last.x<420-260)this.spawn(last?last.x+(this.worldSeed?ramp(240,205,this.heat)+this.random()*60:260):480);trackHeat(this,this.heat);
  if(this.y-this.radius<10||this.y+this.radius>520)this.end('The sky has limits. Your next score doesn’t.');
 }
}
function hash(n){let x=Math.imul(n^0x9e3779b9,0x85ebca6b);x^=x>>>13;return (Math.imul(x,0xc2b2ae35)>>>0)/4294967296;}
export function crossLane(row,seed=0){
 if(seed){const h=i=>worldHash(seed,row*31+i);if(row<=0||row%5===0||h(0)<.1)return {type:'park',row,coin:row>0&&row%5===0?Math.floor(h(1)*9):null};const river=h(2)<.3;const heat=heatOf(row,FULL_HEAT.cross);return {type:river?'river':'road',row,direction:h(3)>.5?1:-1,speed:(.68+h(4)*.55)*ramp(1,1.55,heat),length:river?ramp(2.9,2.2,heat):1.3+h(5)*.8,period:river?4.45:4.9+h(6)*1.5,phase:h(7)*6,color:Math.floor(h(8)*4)};}
 if(row<=0||row%5===0)return {type:'park',row,coin:row>0?Math.floor(hash(row+71)*9):null};
 const river=row%10===7||row%10===8,heat=heatOf(row,FULL_HEAT.cross);return {type:river?'river':'road',row,direction:row%2?1:-1,speed:(.72+hash(row+3)*.5)*ramp(1,1.55,heat),length:river?ramp(2.9,2.2,heat):1.3+hash(row+2)*.8,period:river?4.45:4.6+hash(row+1)*1.8,phase:hash(row+9)*6,color:Math.floor(hash(row+8)*4)};
}
export function laneObjects(lane,time){if(lane.type==='park')return [];const offset=((lane.phase+time*lane.speed*lane.direction)%lane.period+lane.period)%lane.period;const result=[];for(let x=offset-lane.period*2;x<12;x+=lane.period)result.push({x,width:lane.length});return result;}
export class CrossGame {
 constructor(worldSeed=0){this.worldSeed=worldSeed;this.status='ready';this.x=4;this.row=0;this.furthest=0;this.score=0;this.coins=0;this.time=0;this.idle=0;this.hop=0;this.from={x:4,row:0};this.collected=new Set();this.events=[];this.reason='';}
 get heat(){return heatOf(this.furthest,FULL_HEAT.cross);}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 move(dir){if(this.status!=='playing'||this.hop>0)return false;const d={up:[0,1],down:[0,-1],left:[-1,0],right:[1,0]}[dir];if(!d)return false;const nx=this.x+d[0],nr=this.row+d[1];if(nx<0||nx>8||nr<0||nr<this.furthest-7)return false;this.from={x:this.x,row:this.row};this.x=nx;this.row=nr;this.hop=.13;this.idle=0;
  if(this.row>this.furthest){this.score+=(this.row-this.furthest)*10;this.furthest=this.row;this.events.push({type:'step'});trackHeat(this,this.heat);}return true;}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 tick(dt){if(this.status!=='playing')return;this.time+=dt;this.idle+=dt;this.hop=Math.max(0,this.hop-dt);const lane=crossLane(this.row,this.worldSeed),objects=laneObjects(lane,this.time);
  if(this.hop<=0){
   if(lane.type==='road'&&objects.some(o=>this.x+.24>o.x&&this.x-.24<o.x+o.width)){this.end('That taxi had places to be. Watch the gaps.');return;}
   if(lane.type==='river'){const log=objects.find(o=>this.x>o.x-.08&&this.x<o.x+o.width+.08);if(!log){this.end('The canal wins this round. Land on a floating deck.');return;}this.x+=lane.speed*lane.direction*dt;if(this.x<-.4||this.x>8.4){this.end('Your ride drifted off the block. Hop before the edge.');return;}}
   if(lane.type==='park'&&lane.coin!==null&&Math.abs(this.x-lane.coin)<.45&&!this.collected.has(this.row)){this.collected.add(this.row);this.score+=25;this.coins++;this.events.push({type:'coin'});}
  }
  if(this.idle>=15+(this.career?.idle||0))this.end('The night moved on. Keep hopping to stay in the game.');
 }
}
export function stepPack(game,elapsed){if(!Number.isFinite(elapsed)||elapsed<=0)return;if(elapsed>.35){game.pause();return;}while(elapsed>0&&game.status==='playing'){const dt=Math.min(elapsed,1/120);game.tick(dt);elapsed-=dt;}}
export function packLayout(width,height,safe={}){const top=safe.top||0,bottom=safe.bottom||0,left=safe.left||0,right=safe.right||0;const landscape=width>height*1.18;const w=width-left-right-24,h=height-top-bottom-24;const availableW=w-(landscape?168:0),availableH=h-56-(landscape?0:92)-16;const stageWidth=Math.max(1,Math.floor(Math.min(480,availableW,availableH*.75)));return {landscape,stageWidth,stageHeight:stageWidth/.75};}
