// Paint the Town: territory painting on a neon city grid. Your DAWG never stops; outside your
// territory it leaves a wet paint trail, and stepping back onto your own paint closes the loop and
// claims everything the trail and your territory enclose. Rival crews do the same. Anyone who
// crosses an open trail cuts it: the trail's owner is popped, loses the trail, and respawns at home.
// Enclosing a rival's paint repaints it yours; enclosing the rival itself is a capture. Three minutes, then the city is divided up.
// The city (walls and homes) comes from worldSeed; the engine's random is used by the rivals only.
// Movement runs on a fixed step (PAINT.fps cells a second), so the same inputs give the same match.
export const PAINT={cols:28,rows:36,fps:8,seconds:180,respawn:2,cellPts:10,capturePts:150,cutPts:100,homeSize:3};
export const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]},OPP={up:'down',down:'up',left:'right',right:'left'};
const DIR_NAMES=['up','down','left','right'];
// Rival crews: a greedy expander, a hunter who chases open trails, a cautious looper, and two more.
export const CREWS=[
 {name:'Volt Crew',color:'#5ee7ff',ai:'hunter'},
 {name:'Pink Static',color:'#ff4fd8',ai:'greedy'},
 {name:'Lime Syndicate',color:'#b9ff5e',ai:'cautious'},
 {name:'Ultraviolet',color:'#9f6bff',ai:'greedy'},
 {name:'Tangerine Mob',color:'#ff8a3d',ai:'hunter'}];
export const YOU={name:'You',color:'#ffd25e'};
// Seeded unit floats for the city layout (worldSeed plus any counters).
export function hash(seed,...n){let h=(seed>>>0)^0x9e3779b9;for(const k of n){h=Math.imul(h^(k+1),0x85ebca6b)>>>0;h^=h>>>13;h=Math.imul(h,0xc2b2ae35)>>>0;h^=h>>>16;}return (h>>>0)/4294967296;}
// The city for a seed: a few building blocks as walls, a home cell per crew, and how many rivals.
const CITIES=new Map();
export function paintCity(seed=0){if(CITIES.has(seed))return CITIES.get(seed);const W=PAINT.cols,H=PAINT.rows,walls=new Array(W*H).fill(0),rivals=3+Math.floor(hash(seed,1)*3);
 const spots=[[W/2,H/2],[4,4],[W-5,H-5],[W-5,4],[4,H-5],[W/2,3]],homes=spots.slice(0,rivals+1).map(([x,y],i)=>({x:Math.round(x)+Math.round((hash(seed,2,i)-.5)*(i?3:0)),y:Math.round(y)+Math.round((hash(seed,3,i)-.5)*(i?3:0))}));
 const blocks=[],want=5+Math.floor(hash(seed,4)*3);
 for(let a=0;a<80&&blocks.length<want;a++){const w=3+Math.floor(hash(seed,5,a)*3),h=3+Math.floor(hash(seed,6,a)*4),x=2+Math.floor(hash(seed,7,a)*(W-w-4)),y=2+Math.floor(hash(seed,8,a)*(H-h-4)),b={x,y,w,h};
  const near=(bx,by,bw,bh,gap)=>b.x<bx+bw+gap&&bx<b.x+b.w+gap&&b.y<by+bh+gap&&by<b.y+b.h+gap;
  if(homes.some(hm=>near(hm.x-1,hm.y-1,3,3,3))||blocks.some(o=>near(o.x,o.y,o.w,o.h,2)))continue;blocks.push(b);for(let r=y;r<y+h;r++)for(let c=x;c<x+w;c++)walls[r*W+c]=1;}
 const city={seed,W,H,walls,homes,blocks,rivals,open:walls.filter(w=>!w).length};CITIES.set(seed,city);return city;}

export class PaintGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.score=0;this.reason='';this.events=[];this.city=paintCity(worldSeed);const {W,H}=this.city;
  this.steps=0;this.acc=0;this.owner=new Array(W*H).fill(-1);this.trail=new Array(W*H).fill(-1);
  this.players=this.city.homes.map((h,k)=>{const crew=k?CREWS[k-1]:YOU;return {k,name:crew.name,color:crew.color,ai:k?crew.ai:null,x:h.x,y:h.y,dir:spawnDir(h,W,H),queued:null,trail:[],alive:true,respawnAt:0,cells:0,captures:0,cuts:0,pops:0,plan:null};});
  for(const p of this.players)this.homeBlock(p);this.recount();}
 get you(){return this.players[0];}
 get left(){return Math.max(0,PAINT.seconds-this.steps/PAINT.fps);}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 press(dir,down){if(!down)return false;return this.move(dir);}
 // Steering queues a direction; it applies on the next cell. A U-turn onto your own trail is ignored.
 move(dir){if(!DIRS[dir])return false;const p=this.you;if(dir===OPP[p.dir]&&p.trail.length)return false;p.queued=dir;return true;}
 idx(x,y){return y*this.city.W+x;}
 open(x,y){const {W,H,walls}=this.city;return x>=0&&y>=0&&x<W&&y<H&&!walls[y*W+x];}
 // A fresh 3×3 of paint around a crew's home (walls stay walls).
 homeBlock(p){const h=this.city.homes[p.k],r=(PAINT.homeSize-1)/2;for(let y=h.y-r;y<=h.y+r;y++)for(let x=h.x-r;x<=h.x+r;x++)if(this.open(x,y)){const i=this.idx(x,y);if(this.trail[i]>=0&&this.trail[i]!==p.k){const t=this.players[this.trail[i]];t.trail=t.trail.filter(j=>j!==i);}this.trail[i]=-1;this.owner[i]=p.k;}}
 recount(){for(const p of this.players)p.cells=0;for(const o of this.owner)if(o>=0)this.players[o].cells++;this.score=this.points(this.you);}
 points(p){return p.cells*PAINT.cellPts+p.captures*PAINT.capturePts+p.cuts*PAINT.cutPts;}
 // Each crew's share of the paintable city, in order of the players list.
 shares(){return this.players.map(p=>p.cells/this.city.open);}
 rank(){return [...this.players].sort((a,b)=>b.cells-a.cells||a.k-b.k);}
 tick(dt){if(this.status!=='playing')return;this.acc+=dt;while(this.acc>=1/PAINT.fps&&this.status==='playing'){this.acc-=1/PAINT.fps;this.step();}}
 step(){this.steps++;this.time=this.steps/PAINT.fps;const P=this.players;
  for(const p of P){if(!p.alive&&this.steps>=p.respawnAt)this.respawn(p);if(p.alive&&p.ai)p.queued=this.think(p);}
  // Everyone moves one cell (a wall just holds you until you turn).
  const moved=[];for(const p of P){if(!p.alive)continue;if(p.queued&&(p.queued!==OPP[p.dir]||!p.trail.length))p.dir=p.queued;p.queued=null;const [dx,dy]=DIRS[p.dir],nx=p.x+dx,ny=p.y+dy;if(!this.open(nx,ny)){if(!p.k)this.events.push({type:'bump',x:p.x,y:p.y});continue;}p.x=nx;p.y=ny;moved.push(p);}
  // Crossing an open trail cuts it (your own included); two crews laying paint on one cell both pop.
  for(const p of moved){if(!p.alive)continue;const i=this.idx(p.x,p.y),t=this.trail[i];if(t>=0&&P[t].alive)this.pop(P[t],t===p.k?null:p);}
  const at=new Map();for(const p of moved)if(p.alive&&this.owner[this.idx(p.x,p.y)]!==p.k){const i=this.idx(p.x,p.y);(at.get(i)||at.set(i,[]).get(i)).push(p);}
  for(const ps of at.values())if(ps.length>1)for(const p of ps)this.pop(p,null);
  // Back on your own paint with a trail behind you: the loop closes. Otherwise the trail grows.
  for(const p of moved){if(!p.alive)continue;const i=this.idx(p.x,p.y);if(this.owner[i]===p.k){if(p.trail.length)this.claim(p);}else{p.trail.push(i);this.trail[i]=p.k;}}
  this.score=this.points(this.you);
  if(this.steps%PAINT.fps===0&&this.left<=5&&this.left>0)this.events.push({type:'clock',left:this.left});
  if(this.steps>=PAINT.seconds*PAINT.fps)this.finish();}
 // Popped: the trail is wiped, the crew is out for two seconds, and the cutter (if any) scores.
 pop(v,cutter){if(!v.alive)return;for(const i of v.trail)if(this.trail[i]===v.k)this.trail[i]=-1;v.trail=[];v.alive=false;v.plan=null;v.respawnAt=this.steps+PAINT.respawn*PAINT.fps;v.pops++;
  if(cutter){cutter.cuts++;this.events.push({type:'cut',k:cutter.k,victim:v.k,x:v.x,y:v.y,you:!cutter.k,onYou:!v.k});}else this.events.push({type:'pop',k:v.k,x:v.x,y:v.y,onYou:!v.k});}
 respawn(p){const h=this.city.homes[p.k];p.x=h.x;p.y=h.y;p.dir=spawnDir(h,this.city.W,this.city.H);p.queued=null;p.alive=true;p.plan=null;this.homeBlock(p);this.recount();this.events.push({type:'respawn',k:p.k,x:p.x,y:p.y});}
 // Flood from the city's edge through everything that isn't this crew's paint or trail; whatever
 // the flood can't reach is enclosed, and it all becomes this crew's. Walls block the flood.
 claim(p){const {W,H,walls}=this.city,k=p.k,out=new Uint8Array(W*H),queue=[];const seed=i=>{if(!out[i]&&!walls[i]&&this.owner[i]!==k&&this.trail[i]!==k){out[i]=1;queue.push(i);}};
  for(let x=0;x<W;x++){seed(x);seed((H-1)*W+x);}for(let y=0;y<H;y++){seed(y*W);seed(y*W+W-1);}
  for(let q=0;q<queue.length;q++){const i=queue[q],x=i%W,y=(i-x)/W;if(x>0)seed(i-1);if(x<W-1)seed(i+1);if(y>0)seed(i-W);if(y<H-1)seed(i+W);}
  // A rival caught inside the loop while out on its trail is captured: popped, and worth a bonus.
  let captured=0;for(const o of this.players){if(o===p||!o.alive||!o.trail.length)continue;const i=this.idx(o.x,o.y);if(!out[i]&&!walls[i]){this.pop(o,null);captured++;this.events.push({type:'capture',k,victim:o.k,x:o.x,y:o.y,you:!k,onYou:!o.k});}}
  const gained=[];let taken=0;for(let i=0;i<W*H;i++){if(out[i]||walls[i]||this.owner[i]===k)continue;if(this.owner[i]>=0)taken++;this.owner[i]=k;gained.push(i);}
  for(const i of p.trail)this.trail[i]=-1;p.trail=[];p.captures+=captured;this.recount();
  this.events.push({type:'claim',k,gained,taken,captured,x:p.x,y:p.y,you:!k});
  // A crew painted out of the city entirely is popped and starts over at home.
  for(const o of this.players)if(o!==p&&o.alive&&!o.cells){this.pop(o,null);this.events.push({type:'wipe',k:o.k,by:k});}}
 finish(){const order=this.rank(),you=this.you,place=order.indexOf(you)+1,share=Math.round(you.cells/this.city.open*100),n=this.players.length,ord=['','1st','2nd','3rd','4th','5th','6th'][place],lead=order[0];
  this.end(`${share}% of the city is yours: ${ord} of ${n} crews. ${place===1?'The whole town is wearing your colour.':lead.name+' took '+Math.round(lead.cells/this.city.open*100)+'%.'} ${you.cuts} cut${you.cuts===1?'':'s'}, ${you.captures} capture${you.captures===1?'':'s'}.`);}
 // Nearest cell (Manhattan) owned by the crew, or null if it has none.
 nearestOwn(p){const {W,H}=this.city;let best=null,bd=1e9;for(let i=0;i<W*H;i++){if(this.owner[i]!==p.k)continue;const x=i%W,y=(i-x)/W,d=Math.abs(x-p.x)+Math.abs(y-p.y);if(d<bd){bd=d;best={x,y,d};}}return best;}
 // Rival autopilot. greedy: long rectangular loops, blind to danger. hunter: goes for any open
 // trail nearby, otherwise medium loops. cautious: short loops, and bolts home when a rival is close.
 think(p,rnd=this.random,ai=p.ai){const {W,H}=this.city,legs=ai==='greedy'?[3,7]:ai==='hunter'?[3,5]:[2,4];
  const opts=DIR_NAMES.filter(d=>d!==OPP[p.dir]&&this.open(p.x+DIRS[d][0],p.y+DIRS[d][1])&&this.trail[this.idx(p.x+DIRS[d][0],p.y+DIRS[d][1])]!==p.k);
  if(!opts.length)return p.trail.length?p.dir:OPP[p.dir];
  const toward=(gx,gy)=>{let best=opts[0],bd=1e9;for(const d of opts){const dd=Math.abs(p.x+DIRS[d][0]-gx)+Math.abs(p.y+DIRS[d][1]-gy)+rnd()*.5;if(dd<bd){bd=dd;best=d;}}return best;};
  const onTrail=p.trail.length>0;let threat=1e9;for(const o of this.players)if(o!==p&&o.alive)threat=Math.min(threat,Math.abs(o.x-p.x)+Math.abs(o.y-p.y));
  // Hunters chase the nearest open rival trail within reach.
  if(ai==='hunter'){let best=null,bd=7;for(const o of this.players){if(o===p||!o.alive||o.trail.length<2)continue;for(const i of o.trail){const x=i%W,y=(i-x)/W,d=Math.abs(x-p.x)+Math.abs(y-p.y);if(d<bd){bd=d;best={x,y};}}}if(best)return toward(best.x,best.y);}
  if(onTrail){const panic=ai==='cautious'?5:ai==='hunter'?3:2;if(p.plan&&p.plan.leg<3&&threat>panic&&p.trail.length<legs[1]*3){const plan=p.plan;plan.run++;if(plan.run<plan.len[plan.leg]){if(opts.includes(p.dir))return p.dir;}else{plan.leg++;plan.run=0;const turned=turn(p.dir,plan.cw);if(opts.includes(turned))return turned;}}
   p.plan=null;const home=this.nearestOwn(p);return home?toward(home.x,home.y):opts[Math.floor(rnd()*opts.length)];}
  // In our own paint: head for the nearest cell that isn't ours, and set up a loop for when we leave.
  p.plan={leg:0,run:0,cw:rnd()<.5,len:[0,0,0].map(()=>legs[0]+Math.floor(rnd()*(legs[1]-legs[0]+1)))};
  let best=null,bd=1e9;for(let i=0;i<W*H;i++){if(this.owner[i]===p.k||this.city.walls[i])continue;const x=i%W,y=(i-x)/W,d=Math.abs(x-p.x)+Math.abs(y-p.y)+(this.owner[i]>=0?2:0);if(d<bd){bd=d;best={x,y};}}
  return best?toward(best.x,best.y):opts[Math.floor(rnd()*opts.length)];}
}
const spawnDir=(h,W,H)=>Math.abs(h.x-W/2)>Math.abs(h.y-H/2)?(h.x<W/2?'right':'left'):(h.y<H/2?'down':'up');
const turn=(d,cw)=>({up:cw?'right':'left',right:cw?'down':'up',down:cw?'left':'right',left:cw?'up':'down'})[d];

export const PAINT_FIELDS=['steps','acc','owner','players'];
const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
export function validPaintSnapshot(s){const city=paintCity(s.worldSeed||0),{W,H,walls}=city,n=city.rivals+1;
 if(!int(s.steps,0,PAINT.seconds*PAINT.fps)||!(Number.isFinite(s.acc)&&s.acc>=0&&s.acc<1/PAINT.fps)||!Array.isArray(s.owner)||s.owner.length!==W*H||!s.owner.every((o,i)=>int(o,-1,n-1)&&!(walls[i]&&o>=0)))return false;
 if(!Array.isArray(s.players)||s.players.length!==n)return false;const seen=new Set();
 for(let k=0;k<n;k++){const p=s.players[k];if(!p||p.k!==k||(p.queued!==null&&!DIRS[p.queued])||!int(p.x,0,W-1)||!int(p.y,0,H-1)||walls[p.y*W+p.x]||!DIRS[p.dir]||typeof p.alive!=='boolean'||!int(p.respawnAt,0,1e9)||!int(p.captures,0,1e6)||!int(p.cuts,0,1e6)||!int(p.pops,0,1e6)||!Array.isArray(p.trail))return false;
  if(p.cells!==s.owner.filter(o=>o===k).length)return false;if(!p.alive&&p.trail.length)return false;
  for(const i of p.trail){if(!int(i,0,W*H-1)||walls[i]||s.owner[i]===k||seen.has(i))return false;seen.add(i);}
  if(p.trail.length&&p.trail.at(-1)!==p.y*W+p.x)return false;}
 const y=s.players[0];return s.score===y.cells*PAINT.cellPts+y.captures*PAINT.capturePts+y.cuts*PAINT.cutPts;}
// After a restore: rebuild the trail grid from the players' trails.
export function resumePaint(g){g.trail.fill(-1);for(const p of g.players)for(const i of p.trail)g.trail[i]=p.k;g.time=g.steps/PAINT.fps;g.recount();g.events=[];return g;}
