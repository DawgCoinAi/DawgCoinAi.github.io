import {proceduralMaze,worldLook} from './world.js';
export const MAP = [
'#####################',
'#o........#........o#',
'#.###.###.#.###.###.#',
'#.#.....#...#.....#.#',
'#.#.###.#####.###.#.#',
'#...#...........#...#',
'###.#.#.#####.#.#.###',
'#.....#...#...#.....#',
'#.###.###.#.###.###.#',
'#...#...........#...#',
'###.#.###...###.#.###',
'#.....#.......#.....#',
'#.###.#.#####.#.###.#',
'#.#...#...#...#...#.#',
'#.#.#####.#.#####.#.#',
'#......... .........#',
'#.###.#.#####.#.###.#',
'#...#.#...#...#.#...#',
'###.#.###.#.###.#.###',
'#...#...........#...#',
'#.#####.#####.#####.#',
'#o.................o#',
'#####################'];
export const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const reverse={up:'down',down:'up',left:'right',right:'left'};
const key=(x,y)=>`${x},${y}`;
const actor=(x,y,dir='left')=>({x,y,tx:x,ty:y,progress:0,moving:false,dir,cooldown:0});
export const ARCADE_DISTRICTS = [
  {name:'Neon Quarter',tag:'ELECTRIC STREETS',color:'#aa7bff',secondary:'#39e8ed'},
  {name:'Toxic Gardens',tag:'AFTER-DARK JUNGLE',color:'#a4f44f',secondary:'#39dfac'},
  {name:'Sunset Syndicate',tag:'THE GOLDEN HOUR',color:'#ff8e76',secondary:'#ffc55d'}
];
export function mapForLevel(level) {
  if((level-1)%3===0)return [...MAP];
  const variant=(level-1)%3, rows=MAP.map(row=>[...row]);
  for(let y=2;y<MAP.length-2;y++)for(let x=2;x<20;x++){
    if(MAP[y][x]!=='#')continue;
    const across=MAP[y][x-1]!=='#'&&MAP[y][x+1]!=='#';
    const down=MAP[y-1][x]!=='#'&&MAP[y+1][x]!=='#';
    if((across||down)&&(x*7+y*3+variant*2)%7<2)rows[y][x]='.';
  }
  return rows.map(row=>row.join(''));
}
export class MazeGame {
  constructor(mode='classic',random=Math.random,options={}){
    this.mode=mode;this.random=random;this.worldSeed=options.worldSeed||0;this.score=0;this.lives=3;this.level=options.startLevel||1;this.dashRecharge=options.dashRecharge||6;this.lootMultiplier=options.lootMultiplier||1;this.rivalSpeed=options.rivalSpeed||1;
    this.time=60;this.status='ready';this.events=[];
    this.stats={dots:0,caught:0,dashes:0,loot:0,clears:0};
    this.dashCooldown=0;this.loadLevel();
  }
  get district(){if(this.worldSeed){const w=worldLook(this.worldSeed,this.level);return {name:w.label,tag:'REMIX '+w.code,color:w.glow,secondary:w.accent};}return ARCADE_DISTRICTS[(this.level-1)%3];}
  wall(x,y){return !this.map[y]||this.map[y][x]===undefined||this.map[y][x]==='#';}
  loadLevel(){
    this.map=this.worldSeed?proceduralMaze(this.worldSeed,this.level):mapForLevel(this.level);this.pellets=new Map();
    this.map.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='.'||c==='o')this.pellets.set(key(x,y),c);}));
    this.total=this.pellets.size;this.loot=null;this.lootSpawns=0;this.resetActors();this.status='ready';
  }
  resetActors(){
    this.player=actor(10,15);this.wanted='left';
    this.ghosts=[actor(10,9),actor(9,11),actor(11,11),actor(10,5)];
    this.ghosts.forEach((g,i)=>{g.type=i;g.cooldown=1.5+i*.5;});
    this.power=0;this.invincible=2;this.combo=0;this.dashTime=0;
  }
  start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
  pause(){if(this.status==='playing')this.status='paused';}
  dash(){
    if(this.status!=='playing'||this.dashCooldown>0)return false;
    this.dashTime=.68;this.dashCooldown=this.dashRecharge;this.stats.dashes++;
    this.events.push({type:'dash',...this.position(this.player)});return true;
  }
  direction(dir){
    if(!DIRS[dir])return;this.wanted=dir;const p=this.player;
    if(p.moving&&reverse[p.dir]===dir){[p.x,p.tx]=[p.tx,p.x];[p.y,p.ty]=[p.ty,p.y];p.progress=1-p.progress;p.dir=dir;}
  }
  options(e){return Object.keys(DIRS).filter(d=>!this.wall(e.x+DIRS[d][0],e.y+DIRS[d][1]));}
  position(e){return{x:e.x+(e.tx-e.x)*(e.moving?e.progress:0),y:e.y+(e.ty-e.y)*(e.moving?e.progress:0)};}
  ghostDirection(g){
    let opts=this.options(g);if(opts.length>1)opts=opts.filter(d=>d!==reverse[g.dir]);
    if(g.type===2&&this.random()<.42)return opts[Math.floor(this.random()*opts.length)];
    const p=this.player;let target={x:p.x,y:p.y};
    if(g.type===1){const d=DIRS[p.dir];target={x:p.x+d[0]*3,y:p.y+d[1]*3};if(this.wall(target.x,target.y))target={x:p.x,y:p.y};}
    if(g.type===3&&Math.abs(g.x-p.x)+Math.abs(g.y-p.y)<6)target={x:19,y:1};
    const distances=new Map([[key(target.x,target.y),0]]),queue=[target];
    for(let i=0;i<queue.length;i++){const t=queue[i],n=distances.get(key(t.x,t.y));for(const[dx,dy]of Object.values(DIRS)){const x=t.x+dx,y=t.y+dy,k=key(x,y);if(!this.wall(x,y)&&!distances.has(k)){distances.set(k,n+1);queue.push({x,y});}}}
    const distance=d=>distances.get(key(g.x+DIRS[d][0],g.y+DIRS[d][1]))??999;
    opts.sort((a,b)=>(distance(a)-distance(b))*(this.power>0?-1:1));return opts[0];
  }
  move(e,distance,choose,onArrive){
    let guard=0;while(distance>0&&guard++<10){
      if(!e.moving){const dir=choose();if(!dir)return;e.dir=dir;e.tx=e.x+DIRS[dir][0];e.ty=e.y+DIRS[dir][1];e.progress=0;e.moving=true;}
      const step=Math.min(distance,1-e.progress);e.progress+=step;distance-=step;
      if(e.progress>=.999999){e.x=e.tx;e.y=e.ty;e.moving=false;e.progress=0;if(onArrive)onArrive();if(this.status!=='playing')return;}
    }
  }
  spawnLoot(){
    const spots=[];this.map.forEach((row,y)=>[...row].forEach((c,x)=>{if(c!=='#'&&Math.abs(x-this.player.x)+Math.abs(y-this.player.y)>8)spots.push({x,y});}));
    const spot=spots[Math.floor(this.random()*spots.length)]||{x:10,y:9};
    this.loot={...spot,time:12,value:Math.round((400+this.level*100)*this.lootMultiplier)};this.lootSpawns++;
    this.events.push({type:'lootSpawn',...spot});
  }
  collect(){
    const p=this.player,k=key(p.x,p.y);
    if(this.loot&&p.x===this.loot.x&&p.y===this.loot.y){const bonus=this.loot.value;this.score+=bonus;this.stats.loot++;this.events.push({type:'loot',bonus,x:p.x,y:p.y});this.loot=null;}
    const item=this.pellets.get(k);if(!item)return;
    this.pellets.delete(k);this.stats.dots++;this.score+=item==='o'?50:10;
    if(item==='o'){this.power=7+(this.career?.power||0);this.combo=0;this.events.push({type:'power',x:p.x,y:p.y});}
    else this.events.push({type:'pellet',x:p.x,y:p.y});
    const eaten=this.total-this.pellets.size;
    if(!this.loot&&this.lootSpawns<2&&eaten>=(this.lootSpawns+1)*80)this.spawnLoot();
    if(this.pellets.size===0){this.score+=500;this.stats.clears++;this.status='level';this.events.push({type:'level'});}
  }
  nextLevel(){if(this.status!=='level')return;this.level++;this.loadLevel();this.start();}
  tick(dt){
    if(this.status!=='playing')return;dt=Math.min(Math.max(dt,0),.05);
    if((this.mode==='rush'||this.mode==='daily')){this.time=Math.max(0,this.time-dt);if(this.time===0){this.status='over';this.events.push({type:'over'});return;}}
    this.power=Math.max(0,this.power-dt);this.invincible=Math.max(0,this.invincible-dt);
    this.dashTime=Math.max(0,this.dashTime-dt);this.dashCooldown=Math.max(0,this.dashCooldown-dt);
    if(this.loot){this.loot.time-=dt;if(this.loot.time<=0){this.events.push({type:'lootExpired'});this.loot=null;}}
    const speed=(5.4+Math.min(this.level-1,7)*.22)*(this.dashTime>0?2.2:1);
    this.move(this.player,speed*dt,()=>{const opts=this.options(this.player);return opts.includes(this.wanted)?this.wanted:opts.includes(this.player.dir)?this.player.dir:null;},()=>this.collect());
    if(this.status!=='playing')return;
    this.ghosts.forEach(g=>{if(g.cooldown>0){g.cooldown-=dt;return;}this.move(g,(this.power>0?2.7:3.45+Math.min(this.level-1,7)*.25)*this.rivalSpeed*dt,()=>this.ghostDirection(g));});
    const p=this.position(this.player);
    for(const g of this.ghosts){
      if(g.cooldown>0)continue;const q=this.position(g);if(Math.hypot(p.x-q.x,p.y-q.y)>.65)continue;
      if(this.power>0){
        this.combo++;this.stats.caught++;const bonus=200*2**Math.min(this.combo-1,3);this.score+=bonus;
        const type=g.type;Object.assign(g,actor(10,9));g.type=type;g.cooldown=3;
        this.events.push({type:'eat',bonus,x:q.x,y:q.y,combo:this.combo});
      }else if(this.invincible<=0&&this.dashTime<=0){
        this.events.push({type:'hit',x:p.x,y:p.y});
        if((this.mode==='rush'||this.mode==='daily')){this.score=Math.max(0,this.score-150);this.resetActors();}
        else{this.lives--;if(this.lives<=0){this.status='over';this.events.push({type:'over'});}else this.resetActors();}
        break;
      }
    }
  }
}

export const GOODS=[{name:'Moon dust',icon:'✦',base:950,color:'#d2adff'},{name:'Neon buds',icon:'♧',base:120,color:'#c5f563'},{name:'Dream tabs',icon:'▧',base:340,color:'#ff9dd7'},{name:'Glow juice',icon:'◒',base:65,color:'#75e1ef'},{name:'Rocket shrooms',icon:'♠',base:560,color:'#ffa167'},{name:'Space treats',icon:'◆',base:30,color:'#f1d27e'}];
export const DISTRICTS=[{name:'The Block',desc:'Your old stomping ground',risk:.10,m:[1,1,1,1,1,1]},{name:'Neon Strip',desc:'Bright lights. Bigger margins.',risk:.24,m:[1.35,.8,1.5,1.2,.9,1.2]},{name:'The Docks',desc:'Supply lands after dark',risk:.32,m:[.7,1.2,.8,.7,1.35,.8]},{name:'Uptown',desc:'Premium tastes, premium prices',risk:.17,m:[1.5,1.3,1.1,1.6,1.5,1.5]},{name:'Underground',desc:'Volatile prices. No guarantees.',risk:.38,m:[.9,.7,.8,1.1,.7,.9]}];
export function validTradeState(s){
 if(!s||typeof s!=='object'||!['playing','over'].includes(s.status))return false;
 if(!['cash','debt','bank'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0)||!Number.isInteger(s.day)||s.day<1||s.day>30||!Number.isInteger(s.district)||!DISTRICTS[s.district]||![30,45,60,75,90].includes(s.capacity)||!Number.isFinite(s.heat)||s.heat<0||s.heat>100)return false;
 if(!Array.isArray(s.bag)||s.bag.length!==GOODS.length||!s.bag.every(n=>Number.isSafeInteger(n)&&n>=0)||s.bag.reduce((a,b)=>a+b,0)>s.capacity||!Array.isArray(s.prices)||s.prices.length!==GOODS.length||!s.prices.every(n=>Number.isSafeInteger(n)&&n>0))return false;
 if(s.cost!==undefined&&(!Array.isArray(s.cost)||s.cost.length!==GOODS.length||!s.cost.every(n=>Number.isFinite(n)&&n>=0)))return false;
 return typeof s.event==='string'&&s.event.length<2000&&Array.isArray(s.logs)&&s.logs.length<=12&&s.logs.every(l=>l&&Number.isInteger(l.day)&&l.day>=1&&l.day<=30&&typeof l.message==='string'&&l.message.length<2000);
}
export class TradeGame {
 constructor(random=Math.random,saved=null){this.random=random;
  if(validTradeState(saved)){for(const k of ['day','cash','debt','bank','capacity','heat','district','status','event'])this[k]=saved[k];this.bag=[...saved.bag];this.prices=[...saved.prices];this.logs=saved.logs.map(l=>({day:l.day,message:l.message}));this.cost=saved.cost?[...saved.cost]:this.bag.map((n,i)=>n*this.prices[i]);this.costEstimated=!!saved.costEstimated||!saved.cost&&this.used>0;return;}
  this.day=1;this.cash=1800;this.debt=2500;this.bank=0;this.capacity=30;this.heat=0;this.district=0;this.bag=GOODS.map(()=>0);this.cost=GOODS.map(()=>0);this.costEstimated=false;this.status='playing';this.logs=[];this.prices=[];this.event='The city is yours. Start small. Find your edge.';this.rollPrices();this.log('You arrived with $1,800 and a $2,500 debt.');
 }
 get used(){return this.bag.reduce((a,b)=>a+b,0);}
 get inventoryValue(){return this.bag.reduce((a,n,i)=>a+n*this.prices[i],0);}
 get netWorth(){return this.cash+this.bank+this.inventoryValue-this.debt;}
 averageCost(i){return this.bag[i]>0?this.cost[i]/this.bag[i]:0;}
 travelRisk(destination){return DISTRICTS[destination]?Math.min(1,DISTRICTS[destination].risk+Math.max(0,this.heat-6)/250):0;}
 log(message){this.logs.unshift({day:this.day,message});this.logs=this.logs.slice(0,12);}
 rollPrices(){this.prices=GOODS.map((g,i)=>Math.max(5,Math.round(g.base*DISTRICTS[this.district].m[i]*(.45+this.random()*1.25))));if(this.random()<.55){const i=Math.floor(this.random()*GOODS.length),up=this.random()>.5;this.prices[i]=Math.max(1,Math.round(this.prices[i]*(up?2.4:.35)));this.event=up?`${GOODS[i].name} shortage! Buyers are paying a premium.`:`${GOODS[i].name} flood the market. Prices just crashed.`;}else this.event='Markets are moving. Compare prices before you make a move.';}
 quantity(n,max){return n==='max'?max:Number.isFinite(Number(n))?Math.min(max,Math.max(0,Math.floor(Number(n)))):0;}
 buy(i,n){if(this.status!=='playing'||!Number.isInteger(i)||!GOODS[i])return 0;const max=Math.min(Math.floor(this.cash/this.prices[i]),this.capacity-this.used);n=this.quantity(n,max);if(n<=0)return 0;this.cash-=n*this.prices[i];this.bag[i]+=n;this.cost[i]+=n*this.prices[i];this.heat=Math.min(100,this.heat+n*.35);this.log(`Bought ${n} ${GOODS[i].name} for $${n*this.prices[i]}.`);return n;}
 sell(i,n){if(this.status!=='playing'||!Number.isInteger(i)||!GOODS[i])return 0;n=this.quantity(n,this.bag[i]);if(n<=0)return 0;const basis=n*this.averageCost(i),profit=n*this.prices[i]-basis;this.cost[i]=Math.max(0,this.cost[i]-basis);this.bag[i]-=n;if(!this.bag[i])this.cost[i]=0;this.cash+=n*this.prices[i];this.heat=Math.min(100,this.heat+n*.15);this.log(`Sold ${n} ${GOODS[i].name} for $${n*this.prices[i]}. ${profit>=0?'+':'−'}$${Math.round(Math.abs(profit))} vs. ${this.costEstimated?'estimated ':''}cost.`);if(!this.used)this.costEstimated=false;return n;}
 sellAll(){if(this.status!=='playing')return 0;let units=0;for(let i=0;i<GOODS.length;i++)units+=this.sell(i,'max');return units;}
 travel(destination){if(this.status!=='playing'||!Number.isInteger(destination)||!DISTRICTS[destination]||destination===this.district||this.day>=30)return false;const risk=this.travelRisk(destination);this.day++;this.district=destination;this.debt=Math.ceil(this.debt*1.03);this.bank=Math.floor(this.bank*1.005);this.heat=Math.max(0,this.heat-6);this.rollPrices();this.log(`Arrived at ${DISTRICTS[destination].name}. ${this.event}`);if(this.random()<risk){if(this.used>0&&this.random()<.6){let lost=0;this.bag=this.bag.map((n,i)=>{const take=Math.ceil(n*.22);if(n>0)this.cost[i]*=(n-take)/n;lost+=take;return n-take;});this.heat=Math.max(0,this.heat-15);this.event=`Rival crew hit your stash. Lost ${lost} units.`;}else{const loss=Math.floor(this.cash*.12);this.cash-=loss;this.event=`Trouble on the street. You lost $${loss} in cash.`;}this.log(this.event);}else if(this.random()<.15){const found=100+Math.floor(this.random()*400);this.cash+=found;this.event=`A favor paid back. You picked up $${found}.`;this.log(this.event);}if(this.day===30)this.log('Final night! Sell your stash and settle up before cashing out.');return true;}
 repay(){if(this.status!=='playing')return 0;const n=Math.min(this.cash,this.debt);this.cash-=n;this.debt-=n;if(n)this.log(`Repaid $${n} of your debt.`);return n;}
 deposit(){if(this.status!=='playing'||this.cash===0)return false;this.bank+=this.cash;this.cash=0;this.log('Cash moved to the safe. It earns 0.5% per night.');return true;}
 withdraw(){if(this.status!=='playing'||this.bank===0)return false;this.cash+=this.bank;this.bank=0;this.log('Savings withdrawn.');return true;}
 upgrade(){if(this.status!=='playing'||this.cash<1200||this.capacity>=90)return false;this.cash-=1200;this.capacity+=15;this.log('Bigger bag unlocked: +15 slots.');return true;}
 finish(){if(this.status!=='playing')return false;this.cash+=this.inventoryValue;this.bag=this.bag.map(()=>0);this.cost=this.cost.map(()=>0);this.cash+=this.bank;this.bank=0;const paid=Math.min(this.cash,this.debt);this.cash-=paid;this.debt-=paid;this.status='over';this.log('Stash sold. Savings withdrawn. Debt settled as far as possible.');return true;}
 save(){const state={};for(const k of ['day','cash','debt','bank','capacity','heat','district','status','event','costEstimated'])state[k]=this[k];return {...state,bag:[...this.bag],prices:[...this.prices],cost:[...this.cost],logs:this.logs.map(l=>({...l}))};}
}
