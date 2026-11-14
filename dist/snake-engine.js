import {snakeGarden} from './world.js';
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';
// Neon Snake: a light-cycle on a 15 × 18 arena. Every five gold opens the next arena of the
// ladder (the edges start to warp, a rival rider drops in, the walls close), power-ups phase you
// through a body, slow time or pull gold in, and holding BOOST trades safety for hot gold.
export const SNAKE_COLS=15,SNAKE_ROWS=18;
export const SNAKE={stageGold:5,stages:['THE STADIUM','WARP RING','RIVAL RUN','THE CRUSH'],boost:.55,slow:1.6,firstPerson:1.25,firstPersonPace:1.15,powers:['phase','slow','magnet'],rivals:['VIPER','COIL','MIRAGE'],trap:100};
// Feats: specific things to pull off in one run. Each is awarded once per run as {type:'feat', id}.
export const FEATS=[
 {id:'snake.long20',name:'Long Dawg',text:'Grow to 20 long',test:g=>g.body.length>=20},
 {id:'snake.direct5',name:'Laser Line',text:'Take 5 direct lines to the gold in a row',test:g=>g.streak>=5},
 {id:'snake.smash',name:'Crystal Breaker',text:'Charge up and smash a crystal',test:g=>g.smashed.length>=1},
 {id:'snake.trap',name:'Boxed In',text:'Trap a rival rider',test:g=>g.traps>=1},
 {id:'snake.trap3',name:'Snake Charmer',text:'Trap 3 rivals in one run',test:g=>g.traps>=3},
 {id:'snake.phase',name:'Ghost Rider',text:'Phase through a body and live',test:g=>g.phased>=1},
 {id:'snake.hot5',name:'Hot Streak',text:'Eat 5 gold while boosting',test:g=>g.hot>=5},
 {id:'snake.warp',name:'Wraparound',text:'Warp across the edge 8 times',test:g=>g.warps>=8},
 {id:'snake.crush',name:'Tight Squeeze',text:'Survive The Crush',test:g=>g.stage>=4},
 {id:'snake.helmet',name:'Head First',text:'Eat 8 gold in first person',test:g=>g.fpGold>=8}
];
export const SNAKE_FEATS=FEATS;
const TWISTS=[{id:'warp',name:'OPEN EDGES',text:'Every arena warps at the edges',wrap:true},{id:'pack',name:'PACK HUNT',text:'One more rival rider in every arena',rivals:1},{id:'power',name:'POWER HOUR',text:'A power-up after every second gold',power:2},{id:'hot',name:'HOT GOLD',text:'Boosted gold pays triple',hot:30}];
// The modifier a daily run on this seed plays with (applied only when game.daily is true).
export const DAILY_TWIST=seed=>TWISTS[(seed>>>0)%TWISTS.length];
const DIR={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]},NAMES=Object.keys(DIR),BACK={up:'down',down:'up',left:'right',right:'left'};
const opposite=(a,b)=>BACK[a]===b;
export class SnakeGame {
 constructor(random=Math.random,worldSeed=0){this.worldSeed=worldSeed;this.garden=snakeGarden(worldSeed);this.rocks=[...this.garden];this.smashed=[];this.charged=false;this.random=random;this.status='ready';this.body=[{x:7,y:9},{x:6,y:9},{x:5,y:9}];this.dir='right';this.queued=null;this.queued2=null;this.steps=0;this.par=0;this.streak=0;this.bestStreak=0;this.elapsed=0;this.time=0;this.score=0;this.coins=0;this.reason='';this.events=[];
  this.ring=0;this.closing=0;this.power=null;this.phase=false;this.slow=0;this.magnet=0;this.boosting=false;this.rivals=[];this.rivalWait=0;this.rivalSeq=0;this.stepN=0;this.traps=0;this.phased=0;this.hot=0;this.warps=0;this.fpGold=0;this.fp=false;this.daily=false;this.feats=[];this.food=null;this.placeFood();}
 get heat(){return heatOf(this.coins,FULL_HEAT.snake);}
 get twist(){return this.daily?DAILY_TWIST(this.worldSeed):null;}
 // The ladder: a new arena every five gold (generated worlds only). stage counts arenas cleared.
 get stage(){return this.worldSeed?Math.floor(this.coins/SNAKE.stageGold):0;}
 get arena(){return this.stage%SNAKE.stages.length;}
 get stageName(){const lap=Math.floor(this.stage/SNAKE.stages.length);return SNAKE.stages[this.arena]+(lap?' '+'I'.repeat(Math.min(3,lap+1)):'');}
 get toNext(){return SNAKE.stageGold-this.coins%SNAKE.stageGold;}
 get wrap(){return !!this.worldSeed&&this.ring===0&&(this.arena===1||!!this.twist?.wrap);}
 get rivalGoal(){return this.stage<2?0:Math.min(3,(this.stage>=6?2:1)+(this.twist?.rivals||0));}
 get interval(){return ramp(.24,.11,this.heat)*(1+(this.career?.thinking||0))*(this.boosting?SNAKE.boost:1)*(this.slow>0?SNAKE.slow:1)*(this.fp?SNAKE.firstPersonPace:1);}
 // First person pays a quarter more for everything.
 award(n){const p=this.fp?Math.round(n*SNAKE.firstPerson):n;this.score+=p;return p;}
 start(){if(['ready','paused'].includes(this.status))this.status='playing';}
 pause(){if(this.status==='playing'){this.status='paused';this.boosting=false;}}
 press(key,on){if(key==='boost')this.boosting=!!on&&this.status==='playing';}
 // Two turns can wait in line, so a quick corner (up, then left) never loses its second press.
 move(dir){if(this.status!=='playing'||!DIR[dir])return false;if(!this.queued){if(opposite(dir,this.dir))return false;if(dir!==this.dir)this.queued=dir;return true;}
  if(this.queued2||dir===this.queued||opposite(dir,this.queued))return false;this.queued2=dir;return true;}
 inside(p){const r=this.ring;return p.x>=r&&p.x<SNAKE_COLS-r&&p.y>=r&&p.y<SNAKE_ROWS-r;}
 blocked(p){return !this.inside(p)||this.rocks.some(k=>k.x===p.x&&k.y===p.y)||this.body.some(k=>k.x===p.x&&k.y===p.y)||this.rivals.some(v=>v.body.some(k=>k.x===p.x&&k.y===p.y));}
 freeCells(){const out=[];for(let y=0;y<SNAKE_ROWS;y++)for(let x=0;x<SNAKE_COLS;x++){const p={x,y};if(!this.blocked(p)&&!(this.power&&this.power.x===x&&this.power.y===y)&&!(this.food&&this.food.x===x&&this.food.y===y))out.push(p);}return out;}
 placeFood(){this.food=null;const free=this.freeCells();this.food=free.length?free[Math.floor(this.random()*free.length)]:null;this.steps=0;this.par=this.food?Math.abs(this.food.x-this.body[0].x)+Math.abs(this.food.y-this.body[0].y):0;}
 // The next cell in a direction, warped across the edge where the arena allows it.
 next(p,dir){const [dx,dy]=DIR[dir],q={x:p.x+dx,y:p.y+dy};if(this.wrap){q.x=(q.x+SNAKE_COLS)%SNAKE_COLS;q.y=(q.y+SNAKE_ROWS)%SNAKE_ROWS;}return q;}
 checkFeats(){for(const f of FEATS)if(!this.feats.includes(f.id)&&f.test(this)){this.feats.push(f.id);this.events.push({type:'feat',id:f.id,name:f.name});}}
 // The result line carries the brag: how long, how far up the ladder, how many rivals boxed in.
 end(reason){if(this.status!=='playing')return;this.status='over';this.boosting=false;this.reason=reason+(this.coins?' You grew to '+this.body.length+(this.worldSeed?' and reached '+this.stageName:'')+(this.traps?', trapping '+this.traps+' rival'+(this.traps===1?'':'s'):'')+'.':'');this.events.push({type:'over'});}
 // Rival riders move every other step. Each has its own idea of where to go; one with nowhere to go is trapped.
 moveRivals(){for(const v of this.rivals){const head=v.body[0],me=this.body[0],ahead=this.next(this.next(me,this.dir),this.dir),target=v.kind===1?ahead:v.kind===2&&v.roam?v.roam:this.food||me;let best=null,score=Infinity;
   for(const d of NAMES){if(opposite(d,v.dir))continue;const q=this.next(head,d);if(this.blocked(q))continue;const exits=NAMES.filter(e=>!opposite(e,d)&&!this.blocked(this.next(q,e))).length,s=Math.abs(q.x-target.x)+Math.abs(q.y-target.y)-(d===v.dir?.5:0)+(exits?0:40);if(s<score){score=s;best=d;}}
   if(!best){v.dead=true;this.traps++;const points=this.award(SNAKE.trap+v.body.length*5);this.events.push({type:'trap',name:SNAKE.rivals[v.kind],points,x:head.x,y:head.y,cells:v.body.map(p=>({...p}))});continue;}
   v.dir=best;const q=this.next(head,best);v.body.unshift(q);if(this.food&&q.x===this.food.x&&q.y===this.food.y){this.events.push({type:'steal',name:SNAKE.rivals[v.kind]});this.streak=0;this.placeFood();}else v.body.pop();
   if(v.kind===2&&(!v.roam||q.x===v.roam.x&&q.y===v.roam.y||this.stepN%24===0))v.roam={x:1+Math.floor(this.random()*(SNAKE_COLS-2)),y:1+Math.floor(this.random()*(SNAKE_ROWS-2))};}
  if(this.rivals.some(v=>v.dead)){this.rivals=this.rivals.filter(v=>!v.dead);this.rivalWait=14;}}
 spawnRival(){const kind=this.rivalSeq%SNAKE.rivals.length,me=this.body[0];for(const [x,dir] of me.x<SNAKE_COLS/2?[[SNAKE_COLS-2-this.ring,'left'],[1+this.ring,'right']]:[[1+this.ring,'right'],[SNAKE_COLS-2-this.ring,'left']])for(const y of me.y<SNAKE_ROWS/2?[SNAKE_ROWS-2-this.ring,1+this.ring]:[1+this.ring,SNAKE_ROWS-2-this.ring]){
    const cells=[0,1,2,3].map(i=>({x,y:y+(y<SNAKE_ROWS/2?i:-i)}));if(cells.some(c=>this.blocked(c)||this.food&&c.x===this.food.x&&c.y===this.food.y))continue;this.rivalSeq++;this.rivals.push({kind,dir,body:cells,roam:null});this.events.push({type:'rival',name:SNAKE.rivals[kind]});return;}
  this.rivalWait=6;}
 // The Crush closes the outer ring of the arena (never on top of the head), twice; the next arena opens it again.
 squeeze(){const want=this.arena===3?(this.coins%SNAKE.stageGold>=3?2:1):0;if(want<this.ring){this.ring=want;this.closing=0;return;}if(want===this.ring)return;
  // Eight steps of warning (the doomed ring flashes), then it closes as soon as the head is clear of it.
  if(!this.closing){this.closing=8;this.events.push({type:'closing',ring:this.ring+1});return;}if(this.closing>1){this.closing--;return;}
  const r=this.ring+1,h=this.body[0],safe=p=>p.x>=r&&p.x<SNAKE_COLS-r&&p.y>=r&&p.y<SNAKE_ROWS-r;if(!safe(h)||!safe(this.next(h,this.dir)))return;
  this.ring=r;this.closing=0;this.rivals=this.rivals.filter(v=>v.body.every(safe));this.events.push({type:'shrink',ring:r});if(this.power&&!safe(this.power))this.power=null;if(this.food&&!safe(this.food))this.placeFood();}
 tick(dt){if(this.status!=='playing')return;this.time+=dt;trackHeat(this,this.heat);this.elapsed+=dt;this.slow=Math.max(0,this.slow-dt);this.magnet=Math.max(0,this.magnet-dt);
  while(this.elapsed>=this.interval&&this.status==='playing'){this.elapsed-=this.interval;if(this.queued){this.dir=this.queued;this.queued=this.queued2;this.queued2=null;}this.steps++;this.stepN++;
   if(this.worldSeed){this.squeeze();if(this.rivals.length<this.rivalGoal){if(this.rivalWait>0)this.rivalWait--;else this.spawnRival();}else if(this.rivals.length>this.rivalGoal)this.rivals.length=this.rivalGoal;}
   const [dx,dy]=DIR[this.dir],raw={x:this.body[0].x+dx,y:this.body[0].y+dy},head=this.next(this.body[0],this.dir);if(head.x!==raw.x||head.y!==raw.y){this.warps++;this.events.push({type:'warp',x:head.x,y:head.y});}
   const near=this.food&&this.magnet>0&&Math.abs(head.x-this.food.x)+Math.abs(head.y-this.food.y)<=2,eating=this.food&&(head.x===this.food.x&&head.y===this.food.y||near);
   if(!this.inside(head)){this.end(this.ring?'The closing wall caught you. Stay inside the bright line.':'The edge of the block bites back. Plan your turn earlier.');return;}
   const rock=this.rocks.find(p=>p.x===head.x&&p.y===head.y);
   // Three direct lines in a row charge the head: a charged pack smashes one crystal for +50 instead of dying on it.
   if(rock){if(!this.charged){this.end('Hit a garden wall crystal. Charge up with three direct lines to smash one.');return;}this.charged=false;this.streak=0;this.smashed.push(this.garden.indexOf(rock));this.rocks=this.rocks.filter(p=>p!==rock);const points=this.award(50);this.events.push({type:'smash',x:rock.x,y:rock.y,points});}
   // A body in the way ends the run, unless a phase charge is held: then you ghost straight through it, once.
   const self=this.body.slice(0,eating?undefined:-1).some(p=>p.x===head.x&&p.y===head.y),rival=this.rivals.find(v=>v.body.some(p=>p.x===head.x&&p.y===head.y));
   if(self||rival){if(!this.phase){this.end(rival?SNAKE.rivals[rival.kind]+' cut you off. Box the rivals in before they box you.':'Caught your own tail. Leave yourself an exit.');return;}this.phase=false;this.phased++;this.events.push({type:'phase',x:head.x,y:head.y});}
   this.body.unshift(head);
   if(this.power&&head.x===this.power.x&&head.y===this.power.y){const kind=this.power.kind;this.power=null;if(kind==='phase')this.phase=true;else if(kind==='slow')this.slow=6;else this.magnet=8;this.award(10);this.events.push({type:'power',kind});}
   else if(this.power&&--this.power.ttl<=0)this.power=null;
   if(eating){// A direct line to the gold (within two steps of the shortest path) builds a streak worth up to +25.
    const quick=this.steps<=this.par+2,stage=this.stage,hot=this.boosting;this.streak=quick?this.streak+1:0;this.bestStreak=Math.max(this.bestStreak,this.streak);const bonus=quick?5*Math.min(this.streak,5):0;this.coins++;if(hot)this.hot++;if(this.fp)this.fpGold++;const points=this.award(25+bonus+(hot?this.twist?.hot||10:0));this.events.push({type:'coin',quick,streak:this.streak,bonus,hot,points});
    if(this.streak>=3&&!this.charged&&this.rocks.length){this.charged=true;this.events.push({type:'charge'});}
    if(this.stage!==stage){this.award(50);this.events.push({type:'stage',stage:this.stage,name:this.stageName});}
    this.placeFood();if(this.worldSeed&&!this.power&&this.coins%(this.twist?.power||3)===0){const free=this.freeCells();if(free.length){const c=free[Math.floor(this.random()*free.length)];this.power={...c,kind:SNAKE.powers[Math.floor(this.random()*SNAKE.powers.length)],ttl:60};}}
    if(!this.food){this.award(1000);this.end('PERFECT RUN. You filled the entire neon block.');}}else this.body.pop();
   if(this.status==='playing'&&this.rivals.length&&this.stepN%2===0)this.moveRivals();this.checkFeats();
  }
 }
}
// Save fields beyond the original snapshot; all optional on restore so older saves still load.
export const SNAKE_EXTRA=['ring','closing','power','phase','slow','magnet','rivals','rivalWait','rivalSeq','stepN','traps','phased','hot','warps','fpGold','fp','daily','feats'];
const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b,cell=p=>p&&int(p.x,0,SNAKE_COLS-1)&&int(p.y,0,SNAKE_ROWS-1);
export function validSnakeExtra(s){const u=v=>v===undefined;return (u(s.ring)||int(s.ring,0,2))&&(u(s.closing)||int(s.closing,0,8))&&(u(s.power)||s.power===null||cell(s.power)&&SNAKE.powers.includes(s.power.kind)&&int(s.power.ttl,1,60))&&(u(s.phase)||typeof s.phase==='boolean')&&(u(s.slow)||Number.isFinite(s.slow)&&s.slow>=0&&s.slow<=6)&&(u(s.magnet)||Number.isFinite(s.magnet)&&s.magnet>=0&&s.magnet<=8)
 &&(u(s.rivals)||Array.isArray(s.rivals)&&s.rivals.length<=3&&s.rivals.every(v=>v&&int(v.kind,0,2)&&NAMES.includes(v.dir)&&Array.isArray(v.body)&&v.body.length>=4&&v.body.length<=60&&v.body.every(cell)&&(v.roam===null||v.roam===undefined||cell(v.roam))))
 &&['rivalWait','rivalSeq','stepN','traps','phased','hot','warps','fpGold'].every(k=>u(s[k])||int(s[k],0,1e7))&&(u(s.fp)||typeof s.fp==='boolean')&&(u(s.daily)||typeof s.daily==='boolean')&&(u(s.feats)||Array.isArray(s.feats)&&s.feats.length<=FEATS.length&&new Set(s.feats).size===s.feats.length&&s.feats.every(id=>FEATS.some(f=>f.id===id)));}
