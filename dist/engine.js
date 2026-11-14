import {proceduralMaze,seededRandom} from './world.js';
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
// Districts for seeded runs: each is a themed neighbourhood with its own palette and props.
export const MAZE_THEMES = [
  {theme:'market',name:'Night Market',tag:'LANTERNS & NOODLE STEAM',color:'#ff7a59',secondary:'#ffd166'},
  {theme:'arcade',name:'Arcade Row',tag:'NEON TUBES & HIGH SCORES',color:'#b06bff',secondary:'#3ee8f0'},
  {theme:'docks',name:'Harbour Docks',tag:'CONTAINERS & COLD FOG',color:'#3fb8ff',secondary:'#ffb347'},
  {theme:'garden',name:'Rooftop Garden',tag:'HEDGES & FIREFLIES',color:'#7be36a',secondary:'#ff8ad8'}
];
// What each twist is called and how it plays, for the HUD cards.
export const TWIST_INFO = {
  portals:{name:'TELEPORT TUNNELS',text:'Step on a swirl to pop out at its twin. Rivals cannot follow.'},
  gates:{name:'ONE-WAY GATES',text:'Arrows only let you through one way. Rivals obey them too.'},
  dark:{name:'BLACKOUT',text:'The lights are out. Your torch shows the way, and rivals lose you at a distance.'},
  shutters:{name:'SHUTTER DOORS',text:'Shortcuts roll open and slam shut on a timer.'},
  boss:{name:'BOSS: THE WARDEN',text:'Bigger, faster, shrugs off tackles. Catch it three times in beast mode.'},
  mirror:{name:'MIRROR MILE',text:'For twelve seconds mid-run, left and right swap. You get a warning.'},
  double:{name:'DOUBLE TROUBLE',text:'Six rivals instead of four. Tackles pay double.'},
  treasure:{name:'TREASURE HUNT',text:'Five chests are hidden in the maze. Find all five for a jackpot.'},
  rocket:{name:'STREET ROCKET',text:'Dash recharges in three seconds and tackles pay triple.'}
};
export const RIVALS = [
  {name:'Shade',role:'STALKER',hint:'follows your trail'},
  {name:'Pounce',role:'AMBUSHER',hint:'cuts you off ahead'},
  {name:'Beat',role:'PATROL',hint:'walks a loop until it spots you'},
  {name:'Jitters',role:'PANICKER',hint:'charges, then bolts when close'}
];
const CAMPAIGN=[[],['portals'],['gates'],['dark'],['boss'],['shutters']],TWIST_CYCLE=['portals','gates','dark','shutters'];
// The campaign adds one twist per district, then stacks them; a boss arrives every fifth level.
export function twistsFor(mode,level,daily=''){
  if(mode==='daily')return daily==='fog'?['dark']:['mirror','double','treasure','rocket'].includes(daily)?[daily]:[];
  if(mode!=='classic')return [];
  if(level<=CAMPAIGN.length)return [...CAMPAIGN[level-1]];
  const list=[TWIST_CYCLE[level%4],TWIST_CYCLE[(level+1)%4]];if(level>=12)list.push(TWIST_CYCLE[(level+2)%4]);if(level%5===0)list.push('boss');return list;
}
export const SHUTTER_PERIOD=6,SHUTTER_OPEN=3.4;
// The campaign ladder: every level is a named stage in one of the four districts.
const STAGE_NAMES=['Opening Night','Tunnel Vision','One Way Out','Blackout','The Warden','Shutter Speed','Rat Run','Dead of Night','Dock Strike','Warden’s Return','Neon Gauntlet','Lights Out'];
export function stageFor(level){const n=Math.max(1,Math.floor(level)||1),t=MAZE_THEMES[(n-1)%4],lap=Math.floor((n-1)/STAGE_NAMES.length);return {level:n,name:STAGE_NAMES[(n-1)%STAGE_NAMES.length]+(lap?' '+'I'.repeat(Math.min(3,lap))+'I':''),district:t.name,theme:t.theme,twists:twistsFor('classic',n)};}
// Feats: specific things to pull off in a run. `run` holds the counters they are judged on.
const feat=(id,name,text,test)=>({id,mode:id.split('.')[0],name,text,test});
export const FEATS=[
 feat('classic.clean','Untouchable','Clear a district without being caught',g=>g.run.cleanClears>=1),
 feat('classic.chain30','Thirty Straight','Eat 30 treats without a gap',g=>g.bestChain>=30),
 feat('classic.sweep','Clean Sweep','Catch four rivals on one power treat',g=>g.run.sweep>=4),
 feat('classic.tackle3','Linebacker','Dash-tackle 3 rivals in one run',g=>g.run.tackles>=3),
 feat('classic.close5','Whisker Close','Earn 5 close calls in one run',g=>g.run.escapes>=5),
 feat('classic.tunnels','Frequent Flyer','Ride 5 teleport tunnels in one run',g=>g.run.teleports>=5),
 feat('classic.bags','Bag Chaser','Grab both gold bags in one district',g=>g.run.levelLoot>=2),
 feat('classic.docks','Dock Worker','Reach the Harbour Docks (stage 3)',g=>g.level>=3),
 feat('classic.warden','Jailbreak','Bring down the Warden',g=>g.run.bosses>=1),
 feat('classic.stage6','Night Owl','Reach stage 6',g=>g.level>=6),
 feat('rush.x5','Top Gear','Reach the ×5 multiplier',g=>g.mult>=5),
 feat('rush.chain40','Conveyor','Eat 40 treats without a gap',g=>g.bestChain>=40),
 feat('rush.clear','Block Party','Clear a whole block inside the clock',g=>g.stats.clears>=1),
 feat('rush.overtime','Overtime','Earn 10 extra seconds in one run',g=>g.run.extended>=10),
 feat('rush.frenzy','Photo Finish','Score 500 in the final ten seconds',g=>g.run.frenzyScore>=500),
 feat('rush.clean','Ghost Run','Finish a run without being caught',g=>g.status==='over'&&g.run.hits===0&&g.stats.dots>=60),
 feat('rush.hunter','Pack Hunter','Catch 4 rivals in one run',g=>g.stats.caught>=4),
 feat('rush.tackle3','Bulldozer','Dash-tackle 3 rivals in one run',g=>g.run.tackles>=3),
 feat('rush.3k','Three Grand','Score 3,000 in one run',g=>g.score>=3000),
 feat('rush.6k','Six Grand','Score 6,000 in one run',g=>g.score>=6000),
 feat('daily.clear','Daily Bread','Clear today’s maze',g=>g.run.dailyClear>=1),
 feat('daily.fast','Early Finish','Clear it with 20 seconds to spare',g=>g.run.dailyClear>=1&&g.time>=20),
 feat('daily.clean','Spotless','Finish without being caught',g=>g.status==='over'&&g.run.hits===0&&g.stats.dots>=60),
 feat('daily.chain30','Thirty Straight','Eat 30 treats without a gap',g=>g.bestChain>=30),
 feat('daily.twist','Twist Master','Master today’s twist: catch a rival in the fog, stay clean through the mirror, tackle 3 of the six, find every chest, or rocket-tackle 4',g=>g.dailyTwist==='fog'?g.stats.caught>=1:g.dailyTwist==='mirror'?g.run.mirrorDone>=1&&g.run.mirrorHits===0:g.dailyTwist==='double'?g.run.tackles>=3:g.dailyTwist==='treasure'?g.run.jackpot>=1:g.dailyTwist==='rocket'?g.run.tackles>=4:false),
 feat('daily.close3','Narrow Escape','Earn 3 close calls',g=>g.run.escapes>=3),
 feat('daily.bag','Finders Keepers','Grab a gold bag',g=>g.stats.loot>=1),
 feat('daily.hunter','Turned Tables','Catch 3 rivals',g=>g.stats.caught>=3),
 feat('daily.2k','Two Grand','Score 2,000',g=>g.score>=2000),
 feat('daily.4k','Four Grand','Score 4,000',g=>g.score>=4000)
];
export const FEAT_IDS=FEATS.map(f=>f.id);
export const RUN_KEYS=['cleanClears','sweep','tackles','escapes','teleports','levelLoot','bosses','extended','frenzyScore','hits','levelHits','dailyClear','mirrorDone','mirrorHits','jackpot'];
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
import {heatOf,ramp,trackHeat,FULL_HEAT} from './difficulty.js';
const SPAWNS=[[10,9],[9,11],[11,11],[10,5],[10,9],[10,5]],CORNERS=[[1,1],[19,1],[19,21],[1,21]];
export class MazeGame {
  constructor(mode='classic',random=Math.random,options={}){
    this.mode=mode;this.random=random;this.worldSeed=options.worldSeed||0;this.score=0;this.lives=3;this.level=options.startLevel||1;this.dashRecharge=options.dashRecharge||6;this.lootMultiplier=options.lootMultiplier||1;this.rivalSpeed=options.rivalSpeed||1;
    this.dailyTwist=options.twist||'';this.tackleBonus=options.tackleBonus||100;
    // Movement pace and the score bonus for the view are set by the presentation each frame (street level
    // plays slower, so its coins pay more); neither is saved.
    this.pace=1;this.viewBonus=1;
    // Rush is a 60 second sprint; the Daily is one 90 second maze to clear.
    this.timeLimit=mode==='daily'?90:60;this.time=this.timeLimit;this.status='ready';this.events=[];
    this.stats={dots:0,caught:0,dashes:0,loot:0,clears:0};
    this.dashCooldown=0;this.chain=0;this.chainTime=0;this.bestChain=0;this.mult=1;this.moveTime=0;this.idleTime=0;this.escapeCool=0;this.twists=[];this.feats=[];this.run=Object.fromEntries(RUN_KEYS.map(k=>[k,0]));this.loadLevel();
  }
  // Awards each feat of this mode the first time its test passes in the run.
  checkFeats(){for(const f of FEATS){if(f.mode!==this.mode||this.feats.includes(f.id))continue;let ok=false;try{ok=!!f.test(this);}catch{}if(ok){this.feats.push(f.id);this.events.push({type:'feat',id:f.id,name:f.name});}}}
  get timed(){return this.mode==='rush'||this.mode==='daily';}
  get district(){
    if(!this.worldSeed)return ARCADE_DISTRICTS[(this.level-1)%3];
    return MAZE_THEMES[(this.level-1+(this.mode==='classic'?0:this.worldSeed%4))%4];
  }
  has(twist){return this.twists.includes(twist);}
  get dark(){return this.has('dark');}
  // Mirror Mile flips left and right between 25 and 37 seconds into the run.
  get mirrored(){const t=this.timeLimit-this.time;return this.has('mirror')&&t>=25&&t<37;}
  get frenzy(){return this.mode==='rush'&&this.time<=10;}
  wall(x,y){
    const c=this.map[y]?.[x];if(c===undefined)return true;if(c!=='#')return false;
    if(!this.shutterIndex.size)return true;const i=this.shutterIndex.get(key(x,y));return i===undefined||!this.shutterState[i];
  }
  loadLevel(){
    this.map=this.worldSeed?proceduralMaze(this.worldSeed,this.level):mapForLevel(this.level);this.pellets=new Map();
    this.map.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='.'||c==='o')this.pellets.set(key(x,y),c);}));
    this.total=this.pellets.size;this.loot=null;this.lootSpawns=0;if(this.run){this.run.levelLoot=0;this.run.levelHits=0;}
    this.twists=this.worldSeed?twistsFor(this.mode,this.level,this.dailyTwist):[];this.buildTwists();
    this.resetActors();this.status='ready';
  }
  // Twist furniture is placed from the level's own seed, so a restored run rebuilds the same streets.
  buildTwists(){
    this.gates=new Map();this.portals=new Map();this.shutters=[];this.shutterIndex=new Map();this.shutterState=[];this.twistClock=0;this.chests=[];
    if(!this.twists.length)return;
    const random=seededRandom((this.worldSeed^Math.imul(this.level+11,0x9e3779b1))>>>0),open=(x,y)=>this.map[y]?.[x]!==undefined&&this.map[y][x]!=='#';
    const near=(x,y,list,d)=>list.some(([a,b])=>Math.abs(a-x)+Math.abs(b-y)<d),homes=[[10,15],...SPAWNS],taken=[];
    const order=list=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
    const straight=[],cells=[];
    for(let y=1;y<this.map.length-1;y++)for(let x=1;x<this.map[0].length-1;x++){
      if(!open(x,y))continue;cells.push([x,y]);if(this.map[y][x]==='o'||near(x,y,homes,4))continue;
      const h=open(x-1,y)&&open(x+1,y),v=open(x,y-1)&&open(x,y+1),n=open(x-1,y)+open(x+1,y)+open(x,y-1)+open(x,y+1);
      if(n===2&&(h||v))straight.push([x,y,h?'h':'v']);
    }
    if(this.has('gates')){
      // A gate only goes where the rest of the maze stays connected without it, so nothing is ever cut off.
      const blocked=new Set(),connected=()=>{const seen=new Set(['10,15']),q=[[10,15]];for(let i=0;i<q.length;i++)for(const[dx,dy]of Object.values(DIRS)){const x=q[i][0]+dx,y=q[i][1]+dy,k=key(x,y);if(open(x,y)&&!blocked.has(k)&&!seen.has(k)){seen.add(k);q.push([x,y]);}}return seen.size===cells.length-blocked.size;};
      for(const[x,y,axis]of order(straight)){if(this.gates.size>=5)break;if(near(x,y,taken,5))continue;const k=key(x,y);blocked.add(k);if(!connected()){blocked.delete(k);continue;}
        this.gates.set(k,axis==='h'?(random()<.5?'left':'right'):(random()<.5?'up':'down'));taken.push([x,y]);}
    }
    if(this.has('portals')){
      const picks=[];for(const[x,y]of order(straight)){if(picks.length>=4)break;if(near(x,y,taken,4)||near(x,y,picks,9))continue;picks.push([x,y]);}
      for(let i=0;i+1<picks.length;i+=2){const[a,b]=[picks[i],picks[i+1]];this.portals.set(key(...a),{x:b[0],y:b[1],pair:i/2});this.portals.set(key(...b),{x:a[0],y:a[1],pair:i/2});taken.push(a,b);}
    }
    if(this.has('shutters')){
      // Shutters are wall tiles between two streets: closed they are ordinary wall, open they are a shortcut.
      const spots=[];for(let y=2;y<this.map.length-2;y++)for(let x=2;x<this.map[0].length-2;x++){if(open(x,y)||near(x,y,homes,3))continue;const h=open(x-1,y)&&open(x+1,y)&&!open(x,y-1)&&!open(x,y+1),v=open(x,y-1)&&open(x,y+1)&&!open(x-1,y)&&!open(x+1,y);if(h||v)spots.push([x,y]);}
      for(const[x,y]of order(spots)){if(this.shutters.length>=6)break;if(near(x,y,this.shutters.map(s=>[s.x,s.y]),4))continue;this.shutterIndex.set(key(x,y),this.shutters.length);this.shutters.push({x,y});this.shutterState.push(0);}
    }
    if(this.has('treasure')){for(const[x,y]of order(cells)){if(this.chests.length>=5)break;if(near(x,y,homes,4)||near(x,y,this.chests.map(c=>[c.x,c.y]),6))continue;this.chests.push({x,y});}}
  }
  resetActors(){
    this.player=actor(10,15);this.wanted='left';
    const count=this.has('double')?6:4;
    this.ghosts=SPAWNS.slice(0,count).map(([x,y],i)=>{const g=actor(x,y);g.type=i;g.cooldown=1.5+i*.5;g.wp=i%4;g.mood='idle';return g;});
    if(this.has('boss')){const b=this.ghosts[0],hp=this.bossHp??3;b.boss=true;b.hp=hp;if(hp<=0)b.cooldown=30;}
    this.power=0;this.invincible=2;this.combo=0;this.dashTime=0;this.corner=0;this.mult=1;this.moveTime=0;this.idleTime=0;
  }
  start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
  pause(){if(this.status==='playing')this.status='paused';}
  dash(){
    if(this.status!=='playing'||this.dashCooldown>0)return false;
    this.dashTime=.68;this.dashCooldown=this.dashRecharge;this.stats.dashes++;
    this.events.push({type:'dash',...this.position(this.player)});return true;
  }
  direction(dir){
    if(!DIRS[dir])return;if(this.mirrored&&(dir==='left'||dir==='right'))dir=reverse[dir];this.wanted=dir;const p=this.player;
    // Reversing mid-step is instant, unless it would back through a one-way gate.
    if(p.moving&&reverse[p.dir]===dir){const gate=this.gates.get(key(p.x,p.y));if(gate&&gate!==dir)return;[p.x,p.tx]=[p.tx,p.x];[p.y,p.ty]=[p.ty,p.y];p.progress=1-p.progress;p.dir=dir;}
  }
  enterable(x,y,d){if(this.wall(x,y))return false;const gate=this.gates.get(key(x,y));return !gate||gate===d;}
  options(e){return Object.keys(DIRS).filter(d=>this.enterable(e.x+DIRS[d][0],e.y+DIRS[d][1],d));}
  position(e){return{x:e.x+(e.tx-e.x)*(e.moving?e.progress:0),y:e.y+(e.ty-e.y)*(e.moving?e.progress:0)};}
  // Each rival has one readable habit. `mood` and `aim` are what the renderers telegraph.
  ghostDirection(g){
    let opts=this.options(g);if(opts.length>1)opts=opts.filter(d=>d!==reverse[g.dir]);
    const p=this.player,kind=g.type%4,far=Math.abs(g.x-p.x)+Math.abs(g.y-p.y);let target={x:p.x,y:p.y},mood='stalk',wander=0;
    if(this.power>0)mood='scared';
    else if(this.dark&&far>7){mood='lost';wander=1;}
    else if(kind===1){
      mood='ambush';if(far>2){const d=DIRS[p.dir];let x=p.x,y=p.y;for(let i=0;i<4&&!this.wall(x+d[0],y+d[1]);i++){x+=d[0];y+=d[1];}target={x,y};}
    }else if(kind===2){
      if(far<=5||g.mood==='alert'&&far<=8)mood='alert';
      else{mood='patrol';let c=CORNERS[(g.wp||0)%4];if(Math.abs(g.x-c[0])+Math.abs(g.y-c[1])<=1){g.wp=((g.wp||0)+1)%4;c=CORNERS[g.wp];}target={x:c[0],y:c[1]};}
    }else if(kind===3){
      if(far<5){mood='panic';const c=CORNERS.reduce((a,b)=>Math.abs(b[0]-p.x)+Math.abs(b[1]-p.y)>Math.abs(a[0]-p.x)+Math.abs(a[1]-p.y)?b:a);target={x:c[0],y:c[1]};}
      else{mood='charge';wander=.3;}
    }
    g.mood=mood;g.aim=target;
    if(wander&&this.random()<wander)return opts[Math.floor(this.random()*opts.length)];
    const distances=new Map([[key(target.x,target.y),0]]),queue=[target];
    for(let i=0;i<queue.length;i++){const t=queue[i],n=distances.get(key(t.x,t.y));for(const[dx,dy]of Object.values(DIRS)){const x=t.x+dx,y=t.y+dy,k=key(x,y);if(!this.wall(x,y)&&!distances.has(k)){distances.set(k,n+1);queue.push({x,y});}}}
    const distance=d=>distances.get(key(g.x+DIRS[d][0],g.y+DIRS[d][1]))??999;
    opts.sort((a,b)=>(distance(a)-distance(b))*(this.power>0?-1:1));return opts[0];
  }
  rivalPace(g,heat){
    if(this.power>0)return g.boss?2.9:2.4;
    const kind=g.type%4,habit=g.boss?1.1:kind===1?1.04:kind===2?(g.mood==='alert'?1.08:.86):kind===3?(g.mood==='panic'?1.18:1):1;
    return ramp(3.1,4.7,heat)*habit*(this.frenzy?1.1:1);
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
  addTime(seconds,why){if(!this.timed||this.status!=='playing')return;const before=this.time;this.time=Math.min(this.timeLimit+30,this.time+seconds);if(this.time>before)this.run.extended+=this.time-before;if(this.time>before)this.events.push({type:'extend',seconds:Math.round((this.time-before)*10)/10,why});}
  collect(){
    const p=this.player,k=key(p.x,p.y);
    if(this.loot&&p.x===this.loot.x&&p.y===this.loot.y){const bonus=this.loot.value;this.score+=bonus;this.stats.loot++;this.run.levelLoot++;this.events.push({type:'loot',bonus,x:p.x,y:p.y});this.loot=null;}
    const chest=this.chests.findIndex(c=>c.x===p.x&&c.y===p.y);
    if(chest>=0){this.chests.splice(chest,1);this.score+=300;this.events.push({type:'chest',bonus:300,left:this.chests.length,x:p.x,y:p.y});if(!this.chests.length){this.run.jackpot=1;this.score+=1500;this.events.push({type:'jackpot',bonus:1500,x:p.x,y:p.y});}}
    const item=this.pellets.get(k);if(!item)return;
    // Rush pays every coin through the multiplier, doubled again in the last ten seconds.
    const rate=(this.mode==='rush'?this.mult*(this.frenzy?2:1):1)*(this.viewBonus||1);
    this.pellets.delete(k);this.stats.dots++;{const pay=Math.round((item==='o'?50:10)*rate);this.score+=pay;if(this.frenzy)this.run.frenzyScore+=pay;}
    // Eating without a gap builds a chain: every tenth coin pays out, and in Rush every twentieth buys time.
    this.chain++;this.chainTime=1.6;this.bestChain=Math.max(this.bestChain,this.chain);
    if(item==='o'){this.power=7+(this.career?.power||0);this.combo=0;this.events.push({type:'power',x:p.x,y:p.y});}
    else this.events.push({type:'pellet',x:p.x,y:p.y,chain:this.chain});
    if(this.chain%10===0){const bonus=Math.round(Math.min(200,this.chain*2)*rate);this.score+=bonus;if(this.frenzy)this.run.frenzyScore+=bonus;this.events.push({type:'chain',chain:this.chain,bonus,x:p.x,y:p.y});if(this.mode==='rush'&&this.chain%20===0)this.addTime(2,'chain');}
    const eaten=this.total-this.pellets.size;
    if(!this.loot&&this.lootSpawns<2&&eaten>=(this.lootSpawns+1)*80)this.spawnLoot();
    if(this.pellets.size===0)this.cleared();
  }
  cleared(){
    this.score+=500;this.stats.clears++;if(!this.run.levelHits)this.run.cleanClears++;this.checkFeats();
    if(this.mode==='rush'&&this.status==='playing'){
      // Rush never stops for a results card: the next block loads under your feet and the clock gets a refill.
      const power=this.power,mult=this.mult;this.level++;this.loadLevel();this.status='playing';this.power=power;this.mult=mult;this.events.push({type:'level',auto:true});this.addTime(8,'clear');return;
    }
    if(this.mode==='daily'){const bonus=Math.round(this.time)*20;this.score+=bonus;this.run.dailyClear=1;this.status='over';this.checkFeats();this.events.push({type:'level'},{type:'dailyClear',bonus,seconds:Math.round(this.time)},{type:'over'});return;}
    this.status='level';this.events.push({type:'level'});
  }
  // Heat follows pellets cleared across levels (3 levels to full), or the clock in timed modes.
  get heat(){if(this._pelletMap!==this.map){this._pelletMap=this.map;this._pelletTotal=Math.max(1,this.map.join('').replace(/[^.o]/g,'').length);}
    const cleared=this.mode==='daily'?0:(this.level-1)+(1-Math.min(1,this.pellets.size/this._pelletTotal)),timed=this.timed?(this.timeLimit-this.time)/this.timeLimit*FULL_HEAT.maze:0;return heatOf(Math.max(cleared,timed),FULL_HEAT.maze);}
  nextLevel(){if(this.status!=='level')return;this.level++;this.bossHp=undefined;this.loadLevel();this.start();}
  tickTwists(dt){
    if(this.shutters.length){
      this.twistClock+=dt;const want=this.twistClock%SHUTTER_PERIOD<SHUTTER_OPEN?1:0,actors=[this.player,...this.ghosts];
      this.shutters.forEach((s,i)=>{if(this.shutterState[i]===want)return;
        // A shutter never closes on anyone: it waits until the doorway is empty.
        if(!want&&actors.some(a=>a.x===s.x&&a.y===s.y||a.moving&&a.tx===s.x&&a.ty===s.y))return;
        this.shutterState[i]=want;this.events.push({type:'shutter',open:!!want,x:s.x,y:s.y});});
    }
    if(this.has('mirror')){const t=this.timeLimit-this.time,was=t-dt;for(const[at,type]of [[22,'mirrorSoon'],[25,'mirrorOn'],[37,'mirrorOff']])if(was<at&&t>=at){this.events.push({type});if(type==='mirrorOff')this.run.mirrorDone=1;}}
  }
  tick(dt){
    if(this.status!=='playing')return;dt=Math.min(Math.max(dt,0),.05);
    if(this.timed){const before=this.time;this.time=Math.max(0,this.time-dt);if(this.time===0){this.status='over';this.checkFeats();this.events.push({type:'over'});return;}if(this.mode==='rush'&&before>10&&this.time<=10)this.events.push({type:'frenzy'});}
    this.power=Math.max(0,this.power-dt);this.invincible=Math.max(0,this.invincible-dt);
    this.dashTime=Math.max(0,this.dashTime-dt);this.dashCooldown=Math.max(0,this.dashCooldown-dt);this.corner=Math.max(0,this.corner-dt);this.escapeCool=Math.max(0,this.escapeCool-dt);
    if(this.chain>0){this.chainTime-=dt;if(this.chainTime<=0){this.events.push({type:'chainEnd',chain:this.chain});this.chain=0;this.chainTime=0;}}
    if(this.loot){this.loot.time-=dt;if(this.loot.time<=0){this.events.push({type:'lootExpired'});this.loot=null;}}
    this.tickTwists(dt);
    const heat=this.heat;trackHeat(this,heat);const speed=ramp(4.8,6,heat)*this.pace*(this.dashTime>0?2.2:1)*(this.corner>0?1.3:1);
    this.move(this.player,speed*dt,()=>{const p=this.player,opts=this.options(p),dir=opts.includes(this.wanted)?this.wanted:opts.includes(p.dir)?p.dir:null;
      // A buffered turn taken cleanly at a corner earns a short burst, so tight cornering is faster than waiting.
      if(dir&&dir!==p.dir&&dir!==reverse[p.dir]&&this._rolling)this.corner=.2;return dir;},()=>this.arrive());
    this._rolling=this.player.moving;
    if(this.status!=='playing')return;
    if(this.mode==='rush'){
      // The multiplier climbs while the DAWG keeps moving and drops the moment it stands still.
      if(this.player.moving){this.idleTime=0;this.moveTime+=dt;if(this.moveTime>=3&&this.mult<5){this.moveTime=0;this.mult++;this.events.push({type:'mult',mult:this.mult});}}
      else{this.idleTime+=dt;if(this.idleTime>.5&&(this.mult>1||this.moveTime>0)){if(this.mult>1)this.events.push({type:'multLost'});this.mult=1;this.moveTime=0;}}
    }
    this.ghosts.forEach(g=>{if(g.cooldown>0){g.cooldown-=dt;return;}this.move(g,this.rivalPace(g,heat)*this.rivalSpeed*this.pace*dt,()=>this.ghostDirection(g));});
    const p=this.position(this.player);
    for(const g of this.ghosts){
      if(g.cooldown>0){g.close=false;continue;}const q=this.position(g),gap=Math.hypot(p.x-q.x,p.y-q.y);
      if(gap>.65){
        // A rival that got within a tile and then lost you is a close call worth points.
        if(this.power<=0&&gap<1.2)g.close=true;else if(g.close&&gap>2){g.close=false;if(this.escapeCool<=0&&this.power<=0){this.escapeCool=2.5;this.run.escapes++;this.score+=50;this.events.push({type:'escape',bonus:50,x:p.x,y:p.y});}}
        continue;
      }
      g.close=false;
      if(this.power>0){
        this.combo++;this.stats.caught++;this.run.sweep=Math.max(this.run.sweep,this.combo);const bonus=200*2**Math.min(this.combo-1,3);this.score+=bonus;
        this.events.push({type:'eat',bonus,x:q.x,y:q.y,combo:this.combo});if(this.mode==='rush')this.addTime(3,'catch');
        if(g.boss){g.hp--;this.bossHp=g.hp;this.events.push({type:'bossHit',hp:g.hp,x:q.x,y:q.y});if(g.hp<=0){this.run.bosses++;this.score+=2000;this.events.push({type:'bossDown',bonus:2000,x:q.x,y:q.y});}}
        this.sendHome(g,g.boss&&g.hp<=0?30:3);
      }else if(this.dashTime>0){
        // Dash tackle: a dash straight through a rival sends it home, pays out and gives half the dash back. The boss only staggers.
        if(g.boss){g.cooldown=.9;this.events.push({type:'clang',x:q.x,y:q.y});continue;}
        this.sendHome(g,2.5);this.run.tackles++;this.score+=this.tackleBonus;this.dashCooldown=Math.min(this.dashCooldown,this.dashRecharge/2);
        this.events.push({type:'tackle',bonus:this.tackleBonus,x:q.x,y:q.y});
      }else if(this.invincible<=0){
        this.events.push({type:'hit',x:p.x,y:p.y});this.run.hits++;this.run.levelHits++;if(this.mirrored)this.run.mirrorHits++;if(this.chain>0)this.events.push({type:'chainEnd',chain:this.chain});this.chain=0;this.chainTime=0;
        if(this.timed){this.score=Math.max(0,this.score-150);this.resetActors();}
        else{this.lives--;if(this.lives<=0){this.status='over';this.events.push({type:'over'});}else this.resetActors();}
        break;
      }
    }
    this.checkFeats();
  }
  sendHome(g,cooldown){const keep={type:g.type,wp:g.wp||0,boss:g.boss,hp:g.hp},[x,y]=SPAWNS[g.type]||SPAWNS[0];Object.assign(g,actor(x,y),{mood:'idle',close:false});g.type=keep.type;g.wp=keep.wp;if(keep.boss){g.boss=true;g.hp=keep.hp;}g.cooldown=cooldown;delete g.aim;}
  arrive(){
    this.collect();if(this.status!=='playing')return;
    const p=this.player,exit=this.portals.get(key(p.x,p.y));
    if(exit){this.run.teleports++;this.events.push({type:'teleport',x:p.x,y:p.y,tx:exit.x,ty:exit.y,pair:exit.pair});p.x=p.tx=exit.x;p.y=p.ty=exit.y;this.collect();}
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
