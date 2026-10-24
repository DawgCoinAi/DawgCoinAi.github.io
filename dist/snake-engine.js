import {snakeGarden} from './world.js';
export const SNAKE_COLS=15,SNAKE_ROWS=18;
const DIR={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const opposite=(a,b)=>DIR[a][0]+DIR[b][0]===0&&DIR[a][1]+DIR[b][1]===0;
export class SnakeGame {
 constructor(random=Math.random,worldSeed=0){this.worldSeed=worldSeed;this.rocks=snakeGarden(worldSeed);this.random=random;this.status='ready';this.body=[{x:7,y:9},{x:6,y:9},{x:5,y:9}];this.dir='right';this.queued=null;this.elapsed=0;this.time=0;this.score=0;this.coins=0;this.reason='';this.events=[];this.food=null;this.placeFood();}
 get interval(){return Math.max(.11,.24-this.coins*.004)*(1+(this.career?.thinking||0));}
 start(){if(['ready','paused'].includes(this.status))this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 move(dir){if(this.status!=='playing'||!DIR[dir]||this.queued||opposite(dir,this.dir))return false;if(dir!==this.dir)this.queued=dir;return true;}
 placeFood(){const occupied=new Set([...this.body,...this.rocks].map(p=>p.x+','+p.y)),free=[];for(let y=0;y<SNAKE_ROWS;y++)for(let x=0;x<SNAKE_COLS;x++)if(!occupied.has(x+','+y))free.push({x,y});this.food=free.length?free[Math.floor(this.random()*free.length)]:null;}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 tick(dt){if(this.status!=='playing')return;this.time+=dt;this.elapsed+=dt;while(this.elapsed>=this.interval&&this.status==='playing'){this.elapsed-=this.interval;if(this.queued){this.dir=this.queued;this.queued=null;}const [dx,dy]=DIR[this.dir],head={x:this.body[0].x+dx,y:this.body[0].y+dy};const eating=this.food&&head.x===this.food.x&&head.y===this.food.y;
   if(head.x<0||head.x>=SNAKE_COLS||head.y<0||head.y>=SNAKE_ROWS){this.end('The edge of the block bites back. Plan your turn earlier.');return;}
   if(this.rocks.some(p=>p.x===head.x&&p.y===head.y)){this.end('A garden wall stopped your pack. Read the layout before turning.');return;}
   if(this.body.slice(0,eating?undefined:-1).some(p=>p.x===head.x&&p.y===head.y)){this.end('Caught your own tail. Leave yourself an exit.');return;}
   this.body.unshift(head);if(eating){this.coins++;this.score+=25;this.events.push({type:'coin'});this.placeFood();if(!this.food){this.score+=1000;this.end('PERFECT RUN. You filled the entire neon block.');}}else this.body.pop();
  }
 }
}
