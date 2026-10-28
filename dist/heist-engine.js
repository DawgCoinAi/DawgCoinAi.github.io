// Echo Heist: a heist planned one 30-second loop at a time. Each loop you play one crew member;
// every earlier loop replays exactly as you played it (its inputs, not its positions), all at once.
// Plates hold doors open, switches kill laser grids, guards patrol with sight cones that walls and
// closed doors block. What you do now can change the world your past selves move through.
// Everything runs on a fixed 60 Hz step, so the same inputs always give the same heist.
// Map units: one tile is one meter, x right, y down; a tile (c, r) is centered at (c + .5, r + .5).
export const HEIST={fps:60,loop:30,speed:3.6,radius:.25,lives:3,fast:5};
export const LOOP_FRAMES=HEIST.fps*HEIST.loop;
const DIRS=['up','down','left','right'],BIT={up:1,down:2,left:4,right:8};
// '#' wall · S start · V van · $ loot · A–C doors held open by plates a–c · 1/2 switches that kill
// lasers ~ / = · guards walk closed loops of tile waypoints.
export const HEISTS=[
 {name:'The Pawn Shop',crew:2,tip:'Loop one: stand on the plate. Loop two: walk through the door your past self is holding open.',map:[
  '#############',
  '#S....#.....#',
  '#.....A..$..#',
  '#..a..#.....#',
  '#V....#######',
  '#############']},
 {name:'Laser Lounge',crew:2,tip:'One of you holds the switch. The other walks the dark corridor.',map:[
  '#############',
  '#S.....#...$#',
  '#......~....#',
  '#......#....#',
  '#V..1..######',
  '#############']},
 {name:'Night Shift',crew:2,tip:'The guard sees what’s in front of him. Time your run behind his back.',guards:[{path:[[8,1],[12,1],[12,4],[8,4]],speed:1.8,range:3.6,cone:80}],map:[
  '##############',
  '#S....#......#',
  '#.....A...$..#',
  '#..a..#......#',
  '#V....#......#',
  '##############']},
 {name:'The Vault',crew:4,tip:'Two doors, one laser, two prizes. Every one of you has a job.',map:[
  '###############',
  '#S...#....#..$#',
  '#....A....B...#',
  '#.a..#.b..#...#',
  '#V...#....#.1.#',
  '#....#~####...#',
  '#....#.$#.....#',
  '###############']},
 {name:'Kennel Reserve',crew:3,tip:'A door, a laser, a guard, and two prizes. The whole plan, in one take.',guards:[{path:[[8,1],[14,1],[14,3],[8,3]],speed:2,range:3.8,cone:80}],map:[
  '#################',
  '#S....#.........#',
  '#.....A....$....#',
  '#..a..#.........#',
  '#.....###~###...#',
  '#V..1.#.....#...#',
  '#.....#..$..#...#',
  '#################']}];

// A heist's map, parsed once.
const PARSED=new Map();
export function heistMap(i){if(PARSED.has(i))return PARSED.get(i);const h=HEISTS[i],rows=h.map,H=rows.length,W=rows[0].length,doors=[],plates=[],switches=[],lasers=[],loot=[],van=[];let start=null;
 for(let r=0;r<H;r++)for(let c=0;c<W;c++){const ch=rows[r][c];
  if(ch==='S')start={x:c+.5,y:r+.5};else if(ch==='V')van.push([c,r]);else if(ch==='$')loot.push({id:loot.length,c,r});
  else if(ch>='A'&&ch<='C')doors.push({id:ch.charCodeAt(0)-65,c,r});else if(ch>='a'&&ch<='c')plates.push({id:ch.charCodeAt(0)-97,c,r});
  else if(ch==='1'||ch==='2')switches.push({id:+ch-1,c,r});else if(ch==='~'||ch==='=')lasers.push({id:ch==='~'?0:1,c,r});}
 const guards=(h.guards||[]).map(g=>{const pts=g.path.map(([c,r])=>({x:c+.5,y:r+.5})),segs=pts.map((p,k)=>{const q=pts[(k+1)%pts.length];return {p,q,len:Math.hypot(q.x-p.x,q.y-p.y)};});return {...g,pts,segs,total:segs.reduce((s,x)=>s+x.len,0)};});
 const m={i,name:h.name,crew:h.crew,tip:h.tip,W,H,rows,start,van,loot,doors,plates,switches,lasers,guards};PARSED.set(i,m);return m;}
// Where a guard is, and which way it faces, at a loop time.
export function guardAt(g,t){let d=(t*g.speed)%g.total;for(const s of g.segs){if(d<=s.len){const k=s.len?d/s.len:0;return {x:s.p.x+(s.q.x-s.p.x)*k,y:s.p.y+(s.q.y-s.p.y)*k,a:Math.atan2(s.q.y-s.p.y,s.q.x-s.p.x)};}d-=s.len;}const s=g.segs[0];return {x:s.p.x,y:s.p.y,a:0};}

// Recordings are stored run-length encoded: [[bits, frames], …].
export const encode=bits=>{const out=[];for(const b of bits){const last=out[out.length-1];if(last&&last[0]===b)last[1]++;else out.push([b,1]);}return out;};
export const decode=rle=>{const out=[];for(const [b,n] of rle)for(let i=0;i<n;i++)out.push(b);return out;};

export class HeistGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.score=0;this.reason='';this.events=[];this.input={up:false,down:false,left:false,right:false};
  this.level=0;this.lives=HEIST.lives;this.takes=0;this.totalTakes=0;this.cleared=0;this.recs=[];this.cur=[];this.acc=0;this.setup();}
 get map(){return heistMap(this.level);}
 get frame(){return this.cur.length;}
 get loopTime(){return this.cur.length/HEIST.fps;}
 get crewIndex(){return this.recs.length;}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 press(dir,down){if(!DIRS.includes(dir))return false;this.input[dir]=!!down;return true;}
 move(dir){return this.press(dir,true);}
 // Fresh loop: everyone back at the start, the world reset, ghosts ready to replay.
 setup(){const m=this.map;this.cur=[];this.acc=0;this.members=[...this.recs.map(r=>({bits:decode(r)})),{bits:null}].map((x,k)=>({...x,k,x:m.start.x+(k%3-1)*.14,y:m.start.y+Math.floor(k/3)*.14,carry:[],home:false,caught:false}));
  this.taken=[];this.delivered=[];this.alarm=null;this.updateWorld();}
 // Doors open while their plate is occupied; lasers are off while their switch is.
 updateWorld(){const m=this.map,on=(c,r)=>this.members.some(p=>Math.floor(p.x)===c&&Math.floor(p.y)===r);
  this.open=m.doors.map(d=>m.plates.some(p=>p.id===d.id&&on(p.c,p.r)));this.laserOff=[0,1].map(id=>m.switches.some(s=>s.id===id&&on(s.c,s.r)));}
 solid(c,r){const m=this.map;if(c<0||r<0||c>=m.W||r>=m.H)return true;const ch=m.rows[r][c];if(ch==='#')return true;if(ch>='A'&&ch<='C')return !this.open[ch.charCodeAt(0)-65];return false;}
 blocked(x,y){const R=HEIST.radius;for(const [dx,dy] of [[-R,-R],[R,-R],[-R,R],[R,R]])if(this.solid(Math.floor(x+dx),Math.floor(y+dy)))return true;return false;}
 // Clear line of sight between two points (walls and closed doors block it).
 sees(ax,ay,bx,by){const d=Math.hypot(bx-ax,by-ay),n=Math.ceil(d/.12);for(let i=1;i<n;i++){const x=ax+(bx-ax)*i/n,y=ay+(by-ay)*i/n;if(this.solid(Math.floor(x),Math.floor(y)))return false;}return true;}
 bits(){let b=0;for(const d of DIRS)if(this.input[d])b|=BIT[d];return b;}
 tick(dt){if(this.status!=='playing')return;const you=this.members[this.members.length-1],fast=you.home&&!you.carry.length&&you.idle>=HEIST.fps&&!this.bits()?HEIST.fast:1;this.acc+=dt*fast;
  while(this.acc>=1/HEIST.fps&&this.status==='playing'){this.acc-=1/HEIST.fps;this.step();}}
 step(){const f=this.cur.length,m=this.map,you=this.members[this.members.length-1];this.time+=1/HEIST.fps;const mine=this.bits();this.cur.push(mine);you.idle=mine?0:(you.idle||0)+1;
  for(const p of this.members){const b=p.bits?p.bits[f]||0:this.cur[f];let vx=(b&8?1:0)-(b&4?1:0),vy=(b&2?1:0)-(b&1?1:0);if(!vx&&!vy)continue;const n=Math.hypot(vx,vy),s=HEIST.speed/HEIST.fps/n;
   const nx=p.x+vx*s;if(!this.blocked(nx,p.y))p.x=nx;const ny=p.y+vy*s;if(!this.blocked(p.x,ny))p.y=ny;}
  this.updateWorld();const t=(f+1)/HEIST.fps;
  for(const p of this.members){const c=Math.floor(p.x),r=Math.floor(p.y);
   for(const L of m.loot)if(L.c===c&&L.r===r&&!this.taken.includes(L.id)){this.taken.push(L.id);p.carry.push(L.id);this.events.push({type:'loot',k:p.k,x:p.x,y:p.y});}
   if(m.van.some(([vc,vr])=>vc===c&&vr===r)){if(p.carry.length){this.delivered.push(...p.carry);this.events.push({type:'deliver',k:p.k,n:p.carry.length,x:p.x,y:p.y});p.carry=[];}if(p===you&&f>30)p.home=true;}
   else if(p===you)p.home=false;
   if(m.lasers.some(L=>L.c===c&&L.r===r&&!this.laserOff[L.id]))return this.trip(p,'laser');}
  for(const g of m.guards){const at=guardAt(g,t);for(const p of this.members){const dx=p.x-at.x,dy=p.y-at.y,d=Math.hypot(dx,dy);if(d>g.range)continue;let da=Math.abs(Math.atan2(dy,dx)-at.a);if(da>Math.PI)da=2*Math.PI-da;if(d<.6||da<=g.cone*Math.PI/360&&this.sees(at.x,at.y,p.x,p.y))return this.trip(p,'guard');}}
  if(this.delivered.length===m.loot.length)return this.clear();
  if(this.cur.length>=LOOP_FRAMES)this.loopEnd();}
 // Caught: this take is thrown away and the same crew member tries again.
 trip(p,how){const ghost=p.k<this.members.length-1;this.alarm={k:p.k,how,ghost,x:p.x,y:p.y};this.takes++;this.totalTakes++;
  this.events.push({type:'alarm',k:p.k,how,ghost,x:p.x,y:p.y,line:ghost?PARADOX[this.totalTakes%PARADOX.length]:how==='laser'?'Lasers: still lasers.':'Spotted. Smooth.'});this.setup();}
 loopEnd(){const m=this.map;this.recs.push(encode(this.cur));this.events.push({type:'loop',crew:this.recs.length});
  if(this.recs.length>=m.crew){this.lives--;this.recs=[];this.events.push({type:'planfail',lives:this.lives});if(this.lives<=0){this.setup();return this.end(`The plan fell apart on ${m.name}. ${this.cleared} heist${this.cleared===1?'':'s'} pulled off. Your past selves are disappointed in you.`);}}
  this.setup();}
 clear(){const m=this.map,left=Math.max(0,HEIST.loop-this.loopTime),spare=m.crew-this.recs.length-1,pts=Math.max(150,1000*(this.level+1)+m.loot.length*250+Math.floor(left)*20+spare*300-this.takes*25);
  this.score+=pts;this.cleared++;this.events.push({type:'clear',name:m.name,points:pts,crew:this.recs.length+1});this.takes=0;this.recs=[];
  if(this.level>=HEISTS.length-1){this.setup();return this.end(`Every heist pulled off. ${this.totalTakes} take${this.totalTakes===1?'':'s'} thrown away getting there. Legendary crew.`);}
  this.level++;this.setup();this.events.push({type:'heist',name:this.map.name,tip:this.map.tip,crew:this.map.crew});}
}
// What the game says when your present self ruins your past self's take.
const PARADOX=['You got your own past self caught. Iconic.','Paradox. Your earlier take was fine until you showed up.','Past you did everything right. Present you did not.','You closed the door on yourself. Literally.'];

export const HEIST_FIELDS=['level','lives','takes','totalTakes','cleared','recs','cur','input'];
const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b,rle=(r,max)=>Array.isArray(r)&&r.every(x=>Array.isArray(x)&&x.length===2&&int(x[0],0,15)&&int(x[1],1,LOOP_FRAMES))&&r.reduce((s,x)=>s+x[1],0)<=max;
export function validHeistSnapshot(s){if(!int(s.level,0,HEISTS.length-1)||!int(s.lives,1,HEIST.lives)||!int(s.takes,0,1e6)||!int(s.totalTakes,s.takes,1e7)||!int(s.cleared,0,HEISTS.length)||!int(s.score,0,1e8))return false;
 return Array.isArray(s.recs)&&s.recs.length<heistMap(s.level).crew&&s.recs.every(r=>rle(r,LOOP_FRAMES)&&r.reduce((a,x)=>a+x[1],0)===LOOP_FRAMES)&&Array.isArray(s.cur)&&s.cur.length<LOOP_FRAMES&&s.cur.every(b=>int(b,0,15))&&s.input&&DIRS.every(d=>typeof s.input[d]==='boolean');}
// After a restore: rebuild the loop in progress by replaying it to the saved frame.
export function resumeHeist(g){const cur=g.cur,input={...g.input},status=g.status;g.setup();g.status='playing';for(const b of cur){for(const d of DIRS)g.input[d]=!!(b&BIT[d]);g.step();if(g.cur.length===0)break;}g.input=input;g.status=status;g.events=[];return g;}
// Plans that pull off every heist (tests prove it; the attract demo plays them): per crew member,
// [direction(s) or 'wait', seconds].
export const HEIST_PLANS=[
 [[['right',.61],['down',.56]],
  [['down',.28],['right',2.22],['left',2.22],['down',.56]]],
 [[['down',.84],['right',.9]],
  [['down',.28],['right',2.78],['up',.28],['down',.28],['left',2.78],['down',.56]]],
 [[['right',.61],['down',.56]],
  [['down',.28],['wait',.4],['right',2.5],['left',2.5],['down',.56]]],
 [[['down',.56],['right',.2]],
  [['down',.28],['right',1.67],['down',.28]],
  [['down',.28],['right',3.02],['down',.56]],
  [['down',.24],['right',3.37],['up',.28],['down',.28],['left',1.94],['down',1.11],['right',.28],['left',.28],['up',1.11],['left',1.39],['down',.56]]],
 [[['right',.64],['down',.56]],
  [['down',1.11],['right',.83]],
  [['down',.28],['wait',6.3],['right',2.74],['left',.56],['down',1.11],['up',1.11],['left',2.22],['down',.83]]]];
export const planFrames=script=>{const out=[];for(const [d,sec] of script){const b=d==='wait'?0:d.split('+').reduce((a,x)=>a|BIT[x],0);for(let i=0;i<Math.round(sec*60);i++)out.push(b);}return out;};
