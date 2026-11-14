import {snakeGarden} from './world.js';
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';
export const SNAKE_COLS=15,SNAKE_ROWS=18;
const DIR={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const opposite=(a,b)=>DIR[a][0]+DIR[b][0]===0&&DIR[a][1]+DIR[b][1]===0;
export class SnakeGame {
 constructor(random=Math.random,worldSeed=0){this.worldSeed=worldSeed;this.garden=snakeGarden(worldSeed);this.rocks=[...this.garden];this.smashed=[];this.charged=false;this.random=random;this.status='ready';this.body=[{x:7,y:9},{x:6,y:9},{x:5,y:9}];this.dir='right';this.queued=null;this.queued2=null;this.steps=0;this.par=0;this.streak=0;this.bestStreak=0;this.elapsed=0;this.time=0;this.score=0;this.coins=0;this.reason='';this.events=[];this.food=null;this.placeFood();}
 get heat(){return heatOf(this.coins,FULL_HEAT.snake);}
 get interval(){return ramp(.24,.11,this.heat)*(1+(this.career?.thinking||0));}
 start(){if(['ready','paused'].includes(this.status))this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 // Two turns can wait in line, so a quick corner (up, then left) never loses its second press.
 move(dir){if(this.status!=='playing'||!DIR[dir])return false;if(!this.queued){if(opposite(dir,this.dir))return false;if(dir!==this.dir)this.queued=dir;return true;}
  if(this.queued2||dir===this.queued||opposite(dir,this.queued))return false;this.queued2=dir;return true;}
 placeFood(){const occupied=new Set([...this.body,...this.rocks].map(p=>p.x+','+p.y)),free=[];for(let y=0;y<SNAKE_ROWS;y++)for(let x=0;x<SNAKE_COLS;x++)if(!occupied.has(x+','+y))free.push({x,y});this.food=free.length?free[Math.floor(this.random()*free.length)]:null;this.steps=0;this.par=this.food?Math.abs(this.food.x-this.body[0].x)+Math.abs(this.food.y-this.body[0].y):0;}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 tick(dt){if(this.status!=='playing')return;this.time+=dt;trackHeat(this,this.heat);this.elapsed+=dt;while(this.elapsed>=this.interval&&this.status==='playing'){this.elapsed-=this.interval;if(this.queued){this.dir=this.queued;this.queued=this.queued2;this.queued2=null;}this.steps++;const [dx,dy]=DIR[this.dir],head={x:this.body[0].x+dx,y:this.body[0].y+dy};const eating=this.food&&head.x===this.food.x&&head.y===this.food.y;
   if(head.x<0||head.x>=SNAKE_COLS||head.y<0||head.y>=SNAKE_ROWS){this.end('The edge of the block bites back. Plan your turn earlier.');return;}
   const rock=this.rocks.find(p=>p.x===head.x&&p.y===head.y);
   // Three direct lines in a row charge the head: a charged pack smashes one crystal for +50 instead of dying on it.
   if(rock){if(!this.charged){this.end('A crystal stopped your pack. Charge up with three direct lines to smash one.');return;}this.charged=false;this.streak=0;this.smashed.push(this.garden.indexOf(rock));this.rocks=this.rocks.filter(p=>p!==rock);this.score+=50;this.events.push({type:'smash',x:rock.x,y:rock.y});}
   if(this.body.slice(0,eating?undefined:-1).some(p=>p.x===head.x&&p.y===head.y)){this.end('Caught your own tail. Leave yourself an exit.');return;}
   this.body.unshift(head);if(eating){// A direct line to the gold (within two steps of the shortest path) builds a streak worth up to +25.
    const quick=this.steps<=this.par+2;this.streak=quick?this.streak+1:0;this.bestStreak=Math.max(this.bestStreak,this.streak);const bonus=quick?5*Math.min(this.streak,5):0;this.coins++;this.score+=25+bonus;this.events.push({type:'coin',quick,streak:this.streak,bonus});if(this.streak>=3&&!this.charged&&this.rocks.length){this.charged=true;this.events.push({type:'charge'});}this.placeFood();if(!this.food){this.score+=1000;this.end('PERFECT RUN. You filled the entire neon block.');}}else this.body.pop();
  }
 }
}
