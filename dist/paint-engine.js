// Paint the Town: a turf war in wet paint. Your DAWG never stops; off your own colour it lays a wet
// trail, and getting back onto your colour closes the loop and floods everything inside it: streets,
// rival paint, whole buildings and landmarks. Anyone who crosses an open trail cuts it: the owner is
// popped and the cutter's paint splashes out over the spot. You run faster on your own paint, a dash
// (on a cooldown) closes risky loops, paint bombs flood a radius and a shield saves your trail once.
// Bigger loops and unbroken streaks multiply the points, the last 30 seconds pay double, and the crew
// in last place gets an underdog boost. Three minutes, then the podium.
// The city comes from worldSeed; the engine's random drives the rivals and the pickups only. Everything
// runs on a fixed step (PAINT.tps a second), so the same seed and inputs give the same match.
export const PAINT={cols:30,rows:37,tps:30,seconds:180,podium:4,respawn:2.5,speed:6.2,boost:1.25,dashMult:2.4,dashTime:.45,dashCool:5,homeSize:3,
 loopPts:5,cutPts:100,capturePts:250,landmarkPts:400,pickupPts:50,heldPts:20,placePts:[4000,2000,1000,0,0],landmarkWeight:4,splash:2,bomb:3.2,maxPickups:3,
 underdogFrom:40,underdogPace:1.15,finalFrom:150,turnWait:4};
export const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]},OPP={up:'down',down:'up',left:'right',right:'left'};
const DIR_NAMES=['up','down','left','right'],SIDES={up:['left','right'],down:['right','left'],left:['down','up'],right:['up','down']};
const TPS=PAINT.tps,DASH_TICKS=Math.round(PAINT.dashTime*TPS),COOL_TICKS=Math.round(PAINT.dashCool*TPS),END=PAINT.seconds*TPS,PODIUM_TICKS=PAINT.podium*TPS;
// The match has a shape. Rivals start slow, with small loops and no interest in your trail; they
// wake up, then fight for turf, and the final push is flat out with pickups raining in.
// rate: rival pace against yours. legs: how big a loop they dare. hunt: how far hunters smell an
// open trail. drop: seconds between pickups. dash: whether rivals use their dash.
export const STAGES=[
 {from:0,rate:.55,legs:.55,hunt:0,drop:11,dash:false,name:'WARM-UP'},
 {from:30,rate:.72,legs:.8,hunt:4,drop:10,dash:false,name:'THE CREWS WAKE UP'},
 {from:80,rate:.87,legs:1,hunt:6,drop:8,dash:true,name:'TURF WAR'},
 {from:PAINT.finalFrom,rate:1,legs:1.15,hunt:8,drop:5,dash:true,name:'FINAL PUSH · DOUBLE POINTS'}];
export const stageAt=steps=>{const t=steps/TPS;let k=0;for(let i=1;i<STAGES.length;i++)if(t>=STAGES[i].from)k=i;return k;};
// Loop size tiers: the area a single loop floods multiplies its points.
export const TIERS=[{min:0,mult:1,name:''},{min:15,mult:1.5,name:'BIG LOOP'},{min:40,mult:2,name:'HUGE LOOP'},{min:90,mult:3,name:'MONSTER LOOP'}];
export const tierOf=area=>{let k=0;for(let i=1;i<TIERS.length;i++)if(area>=TIERS[i].min)k=i;return k;};
// Rival crews, each with a way of playing. legs: loop leg lengths. panic: how close a rival may get
// to their open trail before they run home. pace: their own speed factor.
export const PERSONA={
 hunter:{legs:[3,5],panic:3,pace:1.05,line:'cuts open trails'},
 glutton:{legs:[4,8],panic:2,pace:1,line:'huge greedy loops'},
 turtle:{legs:[2,3],panic:6,pace:.95,line:'small safe loops'},
 thief:{legs:[3,6],panic:4,pace:1,line:'steals from the leader'},
 collector:{legs:[3,5],panic:5,pace:1,line:'grabs every pickup'}};
export const CREWS=[
 {name:'Volt Crew',tag:'VOLT',color:'#3fd8ff',ai:'hunter'},
 {name:'Pink Static',tag:'STATIC',color:'#ff4fd8',ai:'glutton'},
 {name:'Lime Syndicate',tag:'LIME',color:'#a8ff4a',ai:'turtle'},
 {name:'Ultraviolet',tag:'ULTRA',color:'#a071ff',ai:'thief'},
 {name:'Tangerine Mob',tag:'TANGO',color:'#ff7a2e',ai:'collector'}];
export const YOU={name:'You',tag:'YOU',color:'#ffd23e'};
// Leagues: the ladder. Your best score decides which league a new match is played in (the shell
// passes it to setLeague). Each league pays more, has faster rivals, and adds a twist of its own.
export const LEAGUES=[
 {name:'BACK ALLEY',need:0,pace:1,mult:1,twist:'Rivals take it easy.'},
 {name:'NIGHT MARKET',need:12000,pace:1.06,mult:1.25,twist:'Pickups drop more often.'},
 {name:'NEON HEIGHTS',need:24000,pace:1.12,mult:1.5,twist:'Every crew starts shielded and the hunters never sleep.'},
 {name:'THE CROWN',need:40000,pace:1.18,mult:2,twist:'Double points for the whole last minute.'}];
export const leagueFor=best=>{let k=0;for(let i=1;i<LEAGUES.length;i++)if(best>=LEAGUES[i].need)k=i;return k;};
// Today's course: one rule bent for the day, picked by the seed. Applied when game.daily is true.
export const TWISTS=[
 {id:'bombs',name:'BOMB SQUAD',text:'Only paint bombs drop, twice as often.'},
 {id:'shields',name:'SECOND COATS',text:'Every crew starts shielded and only shields drop.'},
 {id:'rush',name:'RUSH HOUR',text:'Everyone runs 15% faster.'},
 {id:'gold',name:'GOLD RUSH',text:'Landmarks pay triple.'}];
export const DAILY_TWIST=seed=>TWISTS[Math.floor(hash(seed>>>0,97)*TWISTS.length)];
// Feats: specific things to pull off in one match. The engine pushes {type:'feat', id} the first
// time each lands in a run and keeps the ids in game.feats.
export const FEATS=[
 {id:'paint.block',name:'Wet Walls',text:'Flood a whole building by looping round it.',event:'claim with a block inside'},
 {id:'paint.landmark',name:'Tourist Trap',text:'Paint a landmark.',event:'claim with a landmark inside'},
 {id:'paint.trio',name:'Landmark Baron',text:'Hold all three landmarks at once.',event:'claim that leaves you owning every landmark'},
 {id:'paint.monster',name:'Monster Loop',text:'Flood 90 or more in a single loop.',event:'claim of tier 3'},
 {id:'paint.streak',name:'Hot Streak',text:'Close 10 loops in a row without being popped.',event:'claim with streak 10'},
 {id:'paint.dash',name:'Photo Finish',text:'Close a loop of 15 or more in the middle of a dash.',event:'claim while dashing'},
 {id:'paint.nerve',name:'Nerves of Steel',text:'Close a loop of 15 or more with a rival two cells from your trail.',event:'close-call claim'},
 {id:'paint.cut3',name:'Cut Above',text:'Cut three open trails in one match.',event:'third cut'},
 {id:'paint.capture',name:'Boxed In',text:'Capture a rival inside your loop.',event:'claim with a capture'},
 {id:'paint.bomb',name:'Splash Zone',text:'Set off a paint bomb with your trail out, so the blast closes your loop.',event:'bomb pickup mid-trail'},
 {id:'paint.shield',name:'Second Coat',text:'Let a shield save your trail from a cut.',event:'shield spent on you'},
 {id:'paint.clean',name:'Untouchable',text:'Finish a match without being popped once.',event:'whistle with no pops'},
 {id:'paint.win',name:'Town Painter',text:'Finish first.',event:'whistle in 1st place'},
 {id:'paint.crown',name:'Majority Rule',text:'Hold 40% of the city at the whistle.',event:'whistle with a 40% share'}];
export const PICKUPS=['bomb','shield'],LANDMARKS=['statue','fountain','billboard'],BLOCK_KINDS=['tower','shop','lot','park',...LANDMARKS];
// Seeded unit floats for the city layout (worldSeed plus any counters).
export function hash(seed,...n){let h=(seed>>>0)^0x9e3779b9;for(const k of n){h=Math.imul(h^(k+1),0x85ebca6b)>>>0;h^=h>>>13;h=Math.imul(h,0xc2b2ae35)>>>0;h^=h>>>16;}return (h>>>0)/4294967296;}
// The city for a seed. The map is 4×5 districts of 7×7 cells with a one-cell ring road round the
// lot. Each district is a crew's home plaza, a landmark plaza (a 3×3 statue, fountain or billboard),
// an open square, or a block (tower, shop, parking lot or park) with streets on every side.
// Blocks can't be walked through, but they can be owned: flood a loop round one and it is yours.
// A landmark's cells weigh four each when the city is divided up.
const CITIES=new Map(),M=7,MX=4,MY=5;
export function paintCity(seed=0){if(CITIES.has(seed))return CITIES.get(seed);const W=PAINT.cols,H=PAINT.rows,N=W*H,walls=new Array(N).fill(0),block=new Array(N).fill(-1),weight=new Array(N).fill(1);
 const rivals=3+(hash(seed,1)>.4?1:0),corners=[[0,0],[3,4],[3,0],[0,4]],turn=Math.floor(hash(seed,2)*4),first=Math.floor(hash(seed,3)*CREWS.length);
 const districts=[[1+Math.floor(hash(seed,4)*2),2],...Array.from({length:rivals},(_,i)=>corners[(i+turn)%4])],taken=new Set(districts.map(([x,y])=>y*MX+x));
 const homes=districts.map(([mx,my])=>({x:1+mx*M+3,y:1+my*M+3})),crews=Array.from({length:rivals},(_,i)=>(first+i)%CREWS.length);
 const order=Array.from({length:MX*MY},(_,i)=>i).sort((a,b)=>hash(seed,5,a)-hash(seed,5,b)).filter(m=>!taken.has(m)),blocks=[],marks=[];
 const add=(x,y,w,h,kind)=>{const id=blocks.length;blocks.push({id,x,y,w,h,kind,landmark:LANDMARKS.includes(kind)});for(let r=y;r<y+h;r++)for(let c=x;c<x+w;c++){walls[r*W+c]=1;block[r*W+c]=id;if(LANDMARKS.includes(kind))weight[r*W+c]=PAINT.landmarkWeight;}};
 // Landmarks first, spread out: no two in touching districts when the shuffle allows it.
 for(const kind of LANDMARKS){const far=m=>marks.every(o=>Math.max(Math.abs(o%MX-m%MX),Math.abs((o/MX|0)-(m/MX|0)))>=2),m=order.find(m=>!marks.includes(m)&&far(m))??order.find(m=>!marks.includes(m));marks.push(m);add(1+(m%MX)*M+2,1+(m/MX|0)*M+2,3,3,kind);}
 for(const m of order){if(marks.includes(m))continue;const r=hash(seed,6,m);if(r<.12)continue;const k=hash(seed,7,m),kind=k<.42?'tower':k<.66?'shop':k<.84?'lot':'park',w=3+Math.floor(hash(seed,8,m)*3),h=3+Math.floor(hash(seed,9,m)*3);
  add(1+(m%MX)*M+1+Math.floor(hash(seed,10,m)*(M-w-1)),1+(m/MX|0)*M+1+Math.floor(hash(seed,11,m)*(M-h-1)),w,h,kind);}
 const city={seed,W,H,walls,block,weight,homes,crews,blocks,rivals,total:weight.reduce((a,b)=>a+b,0),open:walls.filter(w=>!w).length};CITIES.set(seed,city);return city;}

export class PaintGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.score=0;this.reason='';this.events=[];this.city=paintCity(worldSeed);const {W,H}=this.city;
  this.steps=0;this.acc=0;this.freeze=0;this.phase='play';this.podium=0;this.pickups=[];this.pickupId=0;this.nextPickup=8*TPS;this.auto=false;this.dog=-1;this.feats=[];this.league=0;this.daily=false;
  this.owner=new Array(W*H).fill(-1);this.trail=new Array(W*H).fill(-1);
  this.players=this.city.homes.map((h,k)=>{const crew=k?CREWS[this.city.crews[k-1]]:YOU;return {k,name:crew.name,tag:crew.tag,color:crew.color,ai:k?crew.ai:null,x:h.x,y:h.y,px:h.x,py:h.y,dir:spawnDir(h,W,H),prev:null,queued:null,queued2:null,wait:0,prog:0,trail:[],alive:true,respawnAt:0,
   cells:0,pts:0,captures:0,cuts:0,pops:0,loops:0,best:0,streak:0,dash:0,cool:0,shield:false,rest:0,plan:null};});
  for(const p of this.players)this.homeBlock(p);this.recount();}
 get you(){return this.players[0];}
 get left(){return Math.max(0,PAINT.seconds-this.steps/TPS);}
 get stage(){return stageAt(this.steps);}
 get final(){return this.steps>=(this.league===3?PAINT.seconds-60:PAINT.finalFrom)*TPS;}
 // The day's rule twist, when this is today's course.
 get twist(){return this.daily?DAILY_TWIST(this.worldSeed):null;}
 has(id){return this.twist?.id===id;}
 // Which league this match is played in (0–3); set before the match starts.
 setLeague(n){if(this.steps===0&&Number.isInteger(n)&&LEAGUES[n])this.league=n;return this.league;}
 award(id){if(this.feats.includes(id)||!FEATS.some(f=>f.id===id))return;this.feats.push(id);this.events.push({type:'feat',id});}
 // Points for a crew; yours are multiplied by the league.
 gain(p,pts){const n=Math.round(pts*(p.k?1:LEAGUES[this.league].mult));p.pts+=n;return n;}
 start(){if(this.status==='ready'&&this.steps===0&&(this.league===2||this.has('shields')))for(const p of this.players)p.shield=true;if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 press(dir,down){if(!down)return false;return this.move(dir);}
 // Steering queues up to two turns. A turn waits for its street to open (so you can call a corner
 // early), and a U-turn onto your own trail is ignored. 'dash' fires the dash.
 move(dir){if(dir==='dash')return this.dash();if(!DIRS[dir]||this.phase!=='play')return false;const p=this.you;if(dir===OPP[p.dir]&&p.trail.length&&!p.queued)return false;
  if(!p.queued||p.queued===dir){p.queued=dir;p.wait=0;}else p.queued2=dir;return true;}
 // A short burst of speed on a cooldown (half as long for the underdog).
 dash(p=this.you){if(this.phase!=='play'||!p.alive||p.cool>0)return false;p.dash=DASH_TICKS;p.cool=Math.round(COOL_TICKS*(this.dog===p.k?.5:1));this.events.push({type:'dash',k:p.k,x:p.x,y:p.y,you:!p.k});return true;}
 idx(x,y){return y*this.city.W+x;}
 inside(x,y){return x>=0&&y>=0&&x<this.city.W&&y<this.city.H;}
 open(x,y){return this.inside(x,y)&&!this.city.walls[y*this.city.W+x];}
 // Cells a second for a crew right now: faster on its own paint, in a dash, and as the underdog.
 speedOf(p){return PAINT.speed*(this.has('rush')?1.15:1)*(p.ai?STAGES[this.stage].rate*PERSONA[p.ai].pace*LEAGUES[this.league].pace:1)*(this.owner[this.idx(p.x,p.y)]===p.k?PAINT.boost:1)*(p.dash>0?PAINT.dashMult:1)*(this.dog===p.k?PAINT.underdogPace:1);}
 // A fresh 3×3 of paint around a crew's home.
 homeBlock(p){const h=this.city.homes[p.k],r=(PAINT.homeSize-1)/2;for(let y=h.y-r;y<=h.y+r;y++)for(let x=h.x-r;x<=h.x+r;x++)if(this.open(x,y))this.owner[this.idx(x,y)]=p.k;}
 // Area per crew (landmark cells weigh more), the score, and who the underdog is.
 recount(){const w=this.city.weight;for(const p of this.players)p.cells=0;for(let i=0;i<this.owner.length;i++)if(this.owner[i]>=0)this.players[this.owner[i]].cells+=w[i];this.score=this.you.pts;
  const was=this.dog;this.dog=this.steps>=PAINT.underdogFrom*TPS&&this.phase==='play'?this.rank().at(-1).k:-1;if(this.dog!==was&&this.dog>=0)this.events.push({type:'underdog',k:this.dog,you:!this.dog});}
 // Each crew's share of the city, in order of the players list.
 shares(){return this.players.map(p=>p.cells/this.city.total);}
 rank(){return [...this.players].sort((a,b)=>b.cells-a.cells||a.k-b.k);}
 standings(){return this.rank().map((p,i)=>({k:p.k,name:p.name,tag:p.tag,color:p.color,place:i+1,share:p.cells/this.city.total}));}
 blockOwner(b){return this.owner[this.idx(b.x,b.y)];}
 // How close the nearest live rival is to a crew's open trail (Infinity with no trail): the HUD's warning.
 trailThreat(p=this.you){if(!p.alive||!p.trail.length)return Infinity;const W=this.city.W;let best=Infinity;for(const o of this.players){if(o===p||!o.alive)continue;for(const i of p.trail){const x=i%W,d=Math.abs(x-o.x)+Math.abs((i-x)/W-o.y);if(d<best)best=d;}}return best;}
 tick(dt){if(this.status!=='playing')return;this.acc+=dt;while(this.acc>=1/TPS&&this.status==='playing'){this.acc-=1/TPS;this.step();}}
 // One fixed step. A hit-stop (after your cuts, captures and pops) holds everything, the clock included.
 step(){if(this.status!=='playing')return;if(this.phase==='podium'){if(--this.podium<=0)this.finish();return;}if(this.freeze>0){this.freeze--;return;}
  const was=this.stage;this.steps++;this.time=this.steps/TPS;if(this.stage!==was){this.events.push({type:'stage',stage:this.stage,name:STAGES[this.stage].name});}
  if(this.steps===PAINT.underdogFrom*TPS)this.recount();
  if(this.steps>=this.nextPickup)this.spawnPickup();
  for(const p of this.players){if(!p.alive){if(this.steps>=p.respawnAt)this.respawn(p);continue;}if(p.cool>0)p.cool--;if(p.dash>0)p.dash--;
   p.prog+=this.speedOf(p)/TPS;while(p.prog>=1&&p.alive&&this.status==='playing'){p.prog-=1;if(p.ai||this.auto){const d=this.think(p,this.random,p.ai||'turtle');p.queued=d;p.queued2=null;}if(!this.advance(p)){p.prog=0;break;}}}
  if(this.steps%TPS===0&&this.left<=5&&this.left>0)this.events.push({type:'clock',left:this.left});
  if(this.steps>=END)this.whistle();}
 // Blocked by a building or the edge of town: slide along it instead of stalling with a trail out.
 // Prefers the way you were heading before your last turn, then the side nearer your own paint.
 slide(p){const ok=d=>{const x=p.x+DIRS[d][0],y=p.y+DIRS[d][1];return this.open(x,y)&&this.trail[this.idx(x,y)]!==p.k;},sides=SIDES[p.dir].filter(ok);if(!sides.length)return null;
  if(sides.length===1)return sides[0];if(p.prev&&sides.includes(p.prev))return p.prev;const home=this.nearestOwn(p);if(!home)return sides[0];
  const dist=d=>Math.abs(p.x+DIRS[d][0]-home.x)+Math.abs(p.y+DIRS[d][1]-home.y);return dist(sides[1])<dist(sides[0])?sides[1]:sides[0];}
 // Moves a crew one cell and settles what that does. False when it couldn't move.
 advance(p){const q=p.queued;if(q){const rev=q===OPP[p.dir]&&p.trail.length;if(rev||q===p.dir){p.queued=p.queued2;p.queued2=null;p.wait=0;}else if(this.open(p.x+DIRS[q][0],p.y+DIRS[q][1])){p.prev=p.dir;p.dir=q;p.queued=p.queued2;p.queued2=null;p.wait=0;}else if(++p.wait>PAINT.turnWait){p.queued=p.queued2;p.queued2=null;p.wait=0;}}
  if(!this.open(p.x+DIRS[p.dir][0],p.y+DIRS[p.dir][1])){const side=this.slide(p);if(!side){if(!p.k)this.events.push({type:'bump',x:p.x,y:p.y});return false;}p.prev=p.dir;p.dir=side;if(!p.k)this.events.push({type:'slide',x:p.x,y:p.y,dir:side});}
  // Ground painted out from under you with no trail yet: the trail starts where you stand.
  const from=this.idx(p.x,p.y);if(!p.trail.length&&this.owner[from]!==p.k&&this.trail[from]<0){p.trail.push(from);this.trail[from]=p.k;}
  p.px=p.x;p.py=p.y;p.x+=DIRS[p.dir][0];p.y+=DIRS[p.dir][1];const i=this.idx(p.x,p.y),P=this.players;
  const pick=this.pickups.findIndex(u=>u.x===p.x&&u.y===p.y);if(pick>=0)this.collect(p,pick);if(!p.alive)return true;
  // Crossing an open trail cuts it: your own included.
  const t=this.trail[i];if(t>=0&&P[t].alive){if(t===p.k)this.hit(p,null,'self');else if(this.hit(P[t],p,'cut')){p.cuts++;this.gain(p,PAINT.cutPts);p.rest=this.steps+8*TPS;if(!p.k){this.freeze=4;if(p.cuts>=3)this.award('paint.cut3');}this.splash(p,p.x,p.y,PAINT.splash,'cut');}}
  if(!p.alive)return true;
  // Back on your own paint with a trail behind you: the loop closes. Otherwise the trail grows.
  if(this.owner[i]===p.k){if(p.trail.length)this.claim(p);}else if(this.trail[i]!==p.k&&this.trail[i]<0){p.trail.push(i);this.trail[i]=p.k;}else if(this.trail[i]>=0&&this.trail[i]!==p.k){/* a shielded rival's trail survived under you: walk over it */p.trail.push(i);this.dropTrailCell(this.trail[i],i);this.trail[i]=p.k;}
  this.score=this.you.pts;return true;}
 // A trail cell overwritten by another crew's trail (only after a shield save): the old owner keeps the rest.
 dropTrailCell(k,i){const o=this.players[k];o.trail=o.trail.filter(j=>j!==i);}
 // Something hit a crew's trail. A shield turns the trail into paint and the crew carries on; otherwise
 // the crew is popped: the trail is wiped and it sits out for a moment. True when it popped.
 hit(v,by,how){if(!v.alive)return false;if(v.shield){v.shield=false;const cells=v.trail;for(const i of cells){this.trail[i]=-1;this.owner[i]=v.k;}v.trail=[];this.recount();this.events.push({type:'shield',k:v.k,by:by?by.k:-1,x:v.x,y:v.y,cells,you:!!by&&!by.k,onYou:!v.k});if(!v.k)this.award('paint.shield');this.wipes(v);return false;}
  const trail=v.trail;for(const i of trail)if(this.trail[i]===v.k)this.trail[i]=-1;v.trail=[];v.alive=false;v.plan=null;v.prog=0;v.dash=0;v.streak=0;v.queued=v.queued2=null;v.respawnAt=this.steps+Math.round(PAINT.respawn*TPS);v.pops++;
  if(!v.k)this.freeze=6;this.events.push({type:how==='cut'?'cut':how==='capture'?'capture':how==='wipe'?'wipe':'pop',k:by?by.k:-1,victim:v.k,x:v.x,y:v.y,trail,you:!!by&&!by.k,onYou:!v.k});return true;}
 respawn(p){const h=this.city.homes[p.k];p.x=p.px=h.x;p.y=p.py=h.y;p.dir=spawnDir(h,this.city.W,this.city.H);p.queued=p.queued2=null;p.prog=0;p.alive=true;p.plan=null;this.homeBlock(p);this.recount();this.events.push({type:'respawn',k:p.k,x:p.x,y:p.y});this.wipes(p);}
 // A crew painted out of the city entirely is popped and starts over at home.
 wipes(by){for(const o of this.players)if(o!==by&&o.alive&&!o.cells)this.hit(o,by,'wipe');}
 // Paint splashes out over the streets within r of a point (buildings stay as they are). If the crew
 // had a trail out, standing in its own fresh paint closes the loop.
 splash(p,cx,cy,r,why){const cells=[],R=Math.ceil(r),k=p.k;for(let y=cy-R;y<=cy+R;y++)for(let x=cx-R;x<=cx+R;x++){if(!this.open(x,y)||(x-cx)**2+(y-cy)**2>r*r+.3)continue;const i=this.idx(x,y);if(this.owner[i]!==k){this.owner[i]=k;cells.push(i);}}
  this.recount();this.events.push({type:'splash',k,x:cx,y:cy,r,cells,why,you:!k});if(p.trail.length)this.claim(p);else this.wipes(p);return cells;}
 // Flood from the city's edge through everything that isn't this crew's paint or trail (buildings
 // included: they don't block the flood). Whatever the flood can't reach is enclosed, and it all
 // becomes this crew's: streets, rival paint, buildings, landmarks.
 claim(p){const {W,H,weight,block,blocks}=this.city,N=W*H,k=p.k,out=new Uint8Array(N),queue=[],close=this.trailThreat(p)<=2,dashed=p.dash>0;const seed=i=>{if(!out[i]&&this.owner[i]!==k&&this.trail[i]!==k){out[i]=1;queue.push(i);}};
  for(let x=0;x<W;x++){seed(x);seed((H-1)*W+x);}for(let y=0;y<H;y++){seed(y*W);seed(y*W+W-1);}
  for(let q=0;q<queue.length;q++){const i=queue[q],x=i%W,y=(i-x)/W;if(x>0)seed(i-1);if(x<W-1)seed(i+1);if(y>0)seed(i-W);if(y<H-1)seed(i+W);}
  // A rival caught on newly enclosed ground while out on its trail is captured: popped, and worth a
  // bonus. (One already wandering through your old paint is not: cut its trail instead.)
  let captured=0;for(const o of this.players){if(o===p||!o.alive||!o.trail.length)continue;const at=this.idx(o.x,o.y);if(!out[at]&&this.owner[at]!==k&&this.hit(o,p,'capture'))captured++;}
  const gained=[],got=new Set();let taken=0,area=0;for(let i=0;i<N;i++){if(out[i]||this.owner[i]===k)continue;if(this.owner[i]>=0)taken++;this.owner[i]=k;gained.push(i);area+=weight[i];if(block[i]>=0)got.add(block[i]);}
  for(const i of p.trail)this.trail[i]=-1;p.trail=[];p.plan=null;
  const tier=tierOf(area),marks=[...got].filter(b=>blocks[b].landmark),pts=this.gain(p,Math.round(area*PAINT.loopPts*TIERS[tier].mult*(1+.1*Math.min(p.streak,10))*(this.final?2:1)*(close?1.5:1))+captured*PAINT.capturePts+marks.length*PAINT.landmarkPts*(this.has('gold')?3:1));
  p.captures+=captured;p.loops++;p.streak++;p.best=Math.max(p.best,area);this.recount();if(!k&&(captured||tier>=2))this.freeze=Math.max(this.freeze,captured?6:3);
  this.events.push({type:'claim',k,gained,area,taken,captured,pts,tier,close,streak:p.streak,blocks:[...got],landmarks:marks,x:p.x,y:p.y,you:!k});
  if(!k){if(got.size>marks.length)this.award('paint.block');if(marks.length)this.award('paint.landmark');if(blocks.filter(b=>b.landmark).every(b=>this.blockOwner(b)===0))this.award('paint.trio');if(tier>=3)this.award('paint.monster');if(p.streak>=10)this.award('paint.streak');
   if(dashed&&area>=15)this.award('paint.dash');if(close&&area>=15)this.award('paint.nerve');if(captured)this.award('paint.capture');}
  this.wipes(p);}
 // Pickups drop on open streets away from every crew: a paint bomb or a shield.
 spawnPickup(){this.nextPickup=this.steps+Math.round(STAGES[this.stage].drop*TPS*(this.league===1?.75:1)*(this.has('bombs')?.5:1));if(this.pickups.length>=PAINT.maxPickups)return;const {W,H}=this.city;
  for(let a=0;a<24;a++){const x=1+Math.floor(this.random()*(W-2)),y=1+Math.floor(this.random()*(H-2));if(!this.open(x,y)||this.pickups.some(u=>u.x===x&&u.y===y)||this.players.some(p=>Math.abs(p.x-x)+Math.abs(p.y-y)<4))continue;
   const u={id:++this.pickupId,x,y,kind:(this.random()<.55||this.has('bombs'))&&!this.has('shields')?'bomb':'shield'};this.pickups.push(u);this.events.push({type:'drop',id:u.id,kind:u.kind,x,y});return;}}
 collect(p,at){const [u]=this.pickups.splice(at,1);this.gain(p,PAINT.pickupPts);if(!p.k&&u.kind==='bomb'&&p.trail.length)this.award('paint.bomb');this.events.push({type:'pickup',k:p.k,id:u.id,kind:u.kind,x:u.x,y:u.y,you:!p.k});if(u.kind==='shield')p.shield=true;else this.splash(p,u.x,u.y,PAINT.bomb,'bomb');this.score=this.you.pts;}
 // The whistle: the city is divided up, held ground and the podium place pay out, and the crews
 // stand still for the podium before the match ends.
 whistle(){if(this.phase!=='play')return;this.phase='podium';this.podium=PODIUM_TICKS;this.dog=-1;const order=this.rank(),you=this.you,place=order.indexOf(you)+1;this.gain(you,you.cells*PAINT.heldPts+(PAINT.placePts[place-1]||0));this.score=you.pts;if(!you.pops)this.award('paint.clean');if(place===1)this.award('paint.win');if(you.cells/this.city.total>=.4)this.award('paint.crown');
  this.events.push({type:'whistle',place,standings:this.standings()});}
 finish(){const order=this.rank(),you=this.you,place=order.indexOf(you)+1,pc=p=>Math.round(p.cells/this.city.total*100),n=this.players.length,ord=['','1st','2nd','3rd','4th','5th'][place],lead=order[0],next=LEAGUES[this.league+1],gap=Math.round((you.cells-order[1].cells)/this.city.total*100);
  this.end(`${pc(you)}% of the city is yours: ${ord} of ${n} crews. ${place===1?'You beat '+order[1].name+' by '+gap+' point'+(gap===1?'':'s')+'.':lead.name+' took '+pc(lead)+'%.'} Biggest loop ${you.best}, ${you.loops} loop${you.loops===1?'':'s'}, ${you.cuts} cut${you.cuts===1?'':'s'}, ${you.captures} capture${you.captures===1?'':'s'}, ${this.feats.length} feat${this.feats.length===1?'':'s'}. ${LEAGUES[this.league].name} league${next?this.score>=next.need?': '+next.name+' unlocked!':': '+(next.need-this.score).toLocaleString('en-US')+' more in one match unlocks '+next.name+'.':', the top of the ladder.'}`);}
 // Nearest cell (Manhattan) owned by the crew, or null if it has none.
 nearestOwn(p){const {W,H,walls}=this.city;let best=null,bd=1e9;for(let i=0;i<W*H;i++){if(this.owner[i]!==p.k||walls[i])continue;const x=i%W,y=(i-x)/W,d=Math.abs(x-p.x)+Math.abs(y-p.y);if(d<bd){bd=d;best={x,y,d};}}return best;}
 // First step of the shortest street route from a crew to the nearest cell that passes goal(i),
 // moving only through cells that pass pass(i); null when there is none within depth.
 route(p,goal,pass,opts,depth=99){const {W,H,walls}=this.city,seen=new Uint8Array(W*H),q=[],first=[],dist=[];seen[this.idx(p.x,p.y)]=1;
  const visit=(i,d,n)=>{if(seen[i]||walls[i])return false;seen[i]=1;if(goal(i))return true;if(pass(i)&&n<depth){q.push(i);first.push(d);dist.push(n);}return false;};
  for(const d of opts)if(visit(this.idx(p.x+DIRS[d][0],p.y+DIRS[d][1]),d,1))return d;
  for(let h=0;h<q.length;h++){const i=q[h],x=i%W,y=(i-x)/W,d=first[h],n=dist[h]+1;if(x>0&&visit(i-1,d,n)||x<W-1&&visit(i+1,d,n)||y>0&&visit(i-W,d,n)||y<H-1&&visit(i+W,d,n))return d;}
  return null;}
 // Rival autopilot: where to turn next. Every crew leaves its paint, walks three legs of a box and
 // runs home, bolting early if a rival gets near its trail. hunter: goes for open trails nearby.
 // glutton: long legs, heads for unpainted ground. turtle: short legs, scares easily. thief: starts
 // its loops in the leader's paint. collector: detours for pickups.
 think(p,rnd=this.random,ai=p.ai){const st=STAGES[this.stage],per=PERSONA[ai],T=this.trail,O=this.owner,k=p.k;
  const can=d=>{const x=p.x+DIRS[d][0],y=p.y+DIRS[d][1];return this.open(x,y)&&T[this.idx(x,y)]!==k;},opts=DIR_NAMES.filter(d=>(d!==OPP[p.dir]||!p.trail.length)&&can(d));
  if(!opts.length)return p.dir;
  const clear=i=>T[i]<0,any=i=>T[i]!==k,go=(goal,pass=clear,depth)=>this.route(p,goal,pass,opts,depth),home=()=>go(i=>O[i]===k)??go(i=>O[i]===k,any)??opts[Math.floor(rnd()*opts.length)];
  if(ai==='hunter'&&st.hunt&&this.steps>=p.rest&&p.trail.length<6){const d=go(i=>T[i]>=0&&T[i]!==k&&this.players[T[i]].trail.length>2,clear,st.hunt);if(d){if(st.dash&&!p.cool&&rnd()<.3)this.dash(p);return d;}}
  if(p.trail.length){const plan=p.plan,danger=this.trailThreat(p);
   if(!plan||plan.leg>=3||danger<=per.panic||p.trail.length>=plan.max){if(plan)plan.leg=3;if(danger<=2&&st.dash&&!p.cool)this.dash(p);return home();}
   const ahead=d=>opts.includes(d)&&clear(this.idx(p.x+DIRS[d][0],p.y+DIRS[d][1]));
   if(++plan.run<plan.len[plan.leg]&&ahead(p.dir))return p.dir;
   plan.leg++;plan.run=0;const t=turnOf(p.dir,plan.cw);if(plan.leg<3&&ahead(t))return t;plan.leg=3;return home();}
  // On our own paint: plan the next box, then head for the edge of our colour.
  if(!p.plan||p.plan.leg||p.plan.run){const [a,b]=per.legs,len=()=>Math.max(2,Math.round((a+Math.floor(rnd()*(b-a+1)))*st.legs)),l=[len(),len(),len()];p.plan={leg:0,run:0,cw:rnd()<.5,len:l,max:l[0]+l[1]+l[2]+8};}
  const drop=this.pickups.length?go(i=>this.pickups.some(u=>this.idx(u.x,u.y)===i),clear,ai==='collector'?14:4):null;if(drop)return drop;
  let d=null;if(ai==='thief'){const lead=this.rank()[0];if(lead!==p)d=go(i=>O[i]===lead.k,clear,12);}
  return d??go(i=>O[i]<0,clear,ai==='glutton'?14:5)??go(i=>O[i]!==k)??go(i=>O[i]!==k,any)??opts[Math.floor(rnd()*opts.length)];}
}
const spawnDir=(h,W,H)=>Math.abs(h.x-W/2)>Math.abs(h.y-H/2)?(h.x<W/2?'right':'left'):(h.y<H/2?'down':'up');
const turnOf=(d,cw)=>({up:cw?'right':'left',right:cw?'down':'up',down:cw?'left':'right',left:cw?'up':'down'})[d];

// Saves. The city is rebuilt from worldSeed; these are the fields that change during a match.
export const PAINT_FIELDS=['steps','acc','freeze','phase','podium','owner','players','pickups','pickupId','nextPickup','feats','league','daily'];
const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b,dirOrNull=d=>d===null||!!DIRS[d];
const validPlan=q=>q===null||!!q&&typeof q==='object'&&int(q.leg,0,3)&&int(q.run,0,99)&&typeof q.cw==='boolean'&&Array.isArray(q.len)&&q.len.length===3&&q.len.every(n=>int(n,2,40))&&int(q.max,6,200);
export function validPaintSnapshot(s){const city=paintCity(s.worldSeed||0),{W,H,walls,weight,blocks}=city,N=W*H,n=city.rivals+1;
 if(!int(s.steps,0,END)||!(Number.isFinite(s.acc)&&s.acc>=0&&s.acc<1/TPS)||!int(s.freeze,0,12)||!['play','podium'].includes(s.phase)||!int(s.podium,0,PODIUM_TICKS)||(s.phase==='podium')!==(s.steps===END)||(s.phase==='podium'&&s.podium<1))return false;
 if(!Array.isArray(s.owner)||s.owner.length!==N||!s.owner.every(o=>int(o,-1,n-1)))return false;
 // A building is owned whole or not at all.
 for(const b of blocks){const o=s.owner[b.y*W+b.x];for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)if(s.owner[y*W+x]!==o)return false;}
 if(!Array.isArray(s.players)||s.players.length!==n)return false;const seen=new Set(),area=new Array(n).fill(0);for(let i=0;i<N;i++)if(s.owner[i]>=0)area[s.owner[i]]+=weight[i];
 for(let k=0;k<n;k++){const p=s.players[k];if(!p||typeof p!=='object'||p.k!==k||!dirOrNull(p.queued)||!dirOrNull(p.queued2)||!dirOrNull(p.prev)||!int(p.wait,0,PAINT.turnWait)||!int(p.x,0,W-1)||!int(p.y,0,H-1)||walls[p.y*W+p.x]||!int(p.px,0,W-1)||!int(p.py,0,H-1)||Math.abs(p.px-p.x)+Math.abs(p.py-p.y)>1&&p.alive||!DIRS[p.dir]
   ||typeof p.alive!=='boolean'||typeof p.shield!=='boolean'||!(Number.isFinite(p.prog)&&p.prog>=0&&p.prog<1)||!int(p.respawnAt,0,1e9)||!int(p.rest,0,1e9)||!int(p.pts,0,1e9)||!int(p.captures,0,1e6)||!int(p.cuts,0,1e6)||!int(p.pops,0,1e6)||!int(p.loops,0,1e6)||!int(p.best,0,city.total)||!int(p.streak,0,p.loops)
   ||!int(p.dash,0,DASH_TICKS)||!int(p.cool,0,COOL_TICKS)||!validPlan(p.plan)||!Array.isArray(p.trail)||p.cells!==area[k])return false;
  if(!p.alive&&p.trail.length)return false;
  for(const i of p.trail){if(!int(i,0,N-1)||walls[i]||s.owner[i]===k||seen.has(i))return false;seen.add(i);}
  if(p.trail.length&&p.trail.at(-1)!==p.y*W+p.x)return false;}
 if(!Array.isArray(s.pickups)||s.pickups.length>PAINT.maxPickups||!int(s.pickupId,s.pickups.length,1e6)||!int(s.nextPickup,0,END+20*TPS))return false;const at=new Set();
 for(const u of s.pickups){if(!u||!PICKUPS.includes(u.kind)||!int(u.id,1,s.pickupId)||!int(u.x,0,W-1)||!int(u.y,0,H-1)||walls[u.y*W+u.x]||at.has(u.y*W+u.x))return false;at.add(u.y*W+u.x);}
 if(!Array.isArray(s.feats)||new Set(s.feats).size!==s.feats.length||!s.feats.every(id=>FEATS.some(f=>f.id===id))||!int(s.league,0,LEAGUES.length-1)||typeof s.daily!=='boolean')return false;
 return s.score===s.players[0].pts;}
// After a restore: rebuild the trail grid from the players' trails.
export function resumePaint(g){g.trail.fill(-1);for(const p of g.players)for(const i of p.trail)g.trail[i]=p.k;g.time=g.steps/TPS;g.recount();g.events=[];return g;}
