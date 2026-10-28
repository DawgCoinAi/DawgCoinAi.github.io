// Domino Dynasty: one-shot chain-reaction puzzles. Each level is a side-view room full of fixed
// props (shelves, standing dominoes, balls on ledges, ramps, springs, fans), a golden bone and a
// bin. You place up to three pieces from a palette, press GO once, and the chain runs on its own:
// win when the bone ends up in the bin. Fewer pieces and a faster chain score more.
// The physics is deliberately small and completely deterministic: a fixed 120 Hz step, no
// randomness anywhere, so the same placements always give the same chain and a solution can be
// shared as a short code. Units are meters, x right, y up; the room floor is the box at y = 0.
export const DOMINO={fps:120,g:14,grid:.5,ballR:.32,boneR:.3,domH:1.1,domW:.18,fuses:10,maxRun:25,hold:.45,spring:11,fan:8,fanTorque:3,kick:2.4,settle:1,won:1.6,failed:1.2};
const H=1/DOMINO.fps,G=DOMINO.grid,TIP=Math.atan(DOMINO.domW/DOMINO.domH);
const DIRS=['up','down','left','right'],STEP={up:[0,1],down:[0,-1],left:[-1,0],right:[1,0]};
// Piece palettes are small: a domino, a ball, a plank sloping down-right (dir 1) or down-left
// (dir -1), a spring pad, or a fan blowing right (1) or left (-1).
const P={domino:{type:'domino'},ball:{type:'ball'},rampR:{type:'plank',dir:1},rampL:{type:'plank',dir:-1},spring:{type:'spring'},fanR:{type:'fan',dir:1},fanL:{type:'fan',dir:-1}};
export const PIECE_LABEL={domino:'DOMINO',ball:'BALL',plank:'PLANK',spring:'SPRING',fan:'FAN'};
const floor=(x,w)=>({x,y:0,w,h:.5,kind:'floor'}),shelf=(x,y,w)=>({x,y,w,h:.3,kind:'shelf'}),crate=(x,y,w,h)=>({x,y,w,h,kind:'crate'}),wall=(x,y,w,h)=>({x,y,w,h,kind:'wall'});
const row=(xs,y,start=-1,dir=1)=>xs.map((x,i)=>({x,y,start:i===start?dir:0}));
// A bin is a zone the bone has to end up in; its walls are ordinary boxes.
const bin=(x,y,w,h)=>({x,y,w,h});
export const LEVELS=[
 {name:'The Pawn Shop',tip:'One domino is missing from the row. Put it back, then hold GO.',W:16,H:10,boxes:[floor(0,16),shelf(2,4,7.5),wall(9.9,.5,.2,1.2),wall(12.1,.5,.2,1.2)],
  doms:[...row([2.6,3.4,4.2,5.8,6.6,7.4,8.2],4.3,0)],balls:[],planks:[],springs:[],fans:[],bone:{x:9.1,y:4.6},bin:bin(10.1,.5,2,1.2),palette:['domino']},
 {name:'Kennel Row',tip:'The ball drops off the shelf and dies on the floor. Give it somewhere to roll.',W:16,H:10,boxes:[floor(0,13.2),floor(14.6,1.4),shelf(.5,5.5,6.5)],
  doms:row([1.2,2,2.8,3.6,4.4,5.2],5.8,0),balls:[{x:6.5,y:6.12}],planks:[],springs:[],fans:[],bone:{x:11.5,y:.8},bin:bin(13.2,-.2,1.4,.7),palette:['rampR','fanR']},
 {name:'Velvet Lounge',tip:'The bone sits high on its column. Something has to send the ball up there.',W:16,H:10,boxes:[floor(0,16),crate(9.6,.5,.5,4),wall(10.6,.5,.2,1.2),wall(12.8,.5,.2,1.2)],
  doms:row([2,2.8,3.6,4.4],.5,0),balls:[{x:5.3,y:.82}],planks:[],springs:[],fans:[],bone:{x:9.6,y:4.8},bin:bin(10.8,.5,2,1.2),palette:['spring','domino']},
 {name:'Night Market',tip:'Nothing is pushing anything here. Bring some wind.',W:16,H:10,boxes:[floor(0,16),shelf(1,6,3),shelf(6.5,3,6.5),wall(13.2,.5,.2,1.2),wall(15.4,.5,.2,1.2)],
  doms:row([8,8.8,9.6,10.4,11.2,12],3.3),balls:[{x:3.6,y:6.62}],planks:[],springs:[],fans:[],bone:{x:12.75,y:3.6},bin:bin(13.4,.5,2,1.2),palette:['fanR','ball']},
 {name:'Barber’s Back Room',tip:'The ball falls short of the middle shelf, and the row down there has a hole in it.',W:16,H:10,boxes:[floor(0,16),shelf(1,7,5),shelf(7.5,4,3.8),wall(11.2,.5,.2,1.2),wall(13.4,.5,.2,1.2)],
  doms:[...row([1.6,2.4,3.2,4,4.8],7.3,0),...row([8.3,9.9],4.3)],balls:[{x:5.6,y:7.62}],planks:[],springs:[],fans:[],bone:{x:10.9,y:4.6},bin:bin(11.4,.5,2,1.2),palette:['domino','rampR','ball']},
 {name:'Boiler Room',tip:'The spring throws the ball straight up, once. Make that one throw count.',W:16,H:10,boxes:[floor(0,16),shelf(1,8,2),shelf(8,3.5,5),wall(13.2,.5,.2,1.2),wall(15.4,.5,.2,1.2)],
  doms:[...row([1.6],8.3,0),...row([8.6,9.4,10.2,11,11.8],3.8)],balls:[{x:2.6,y:8.62}],planks:[],springs:[{x:6.3,y:.5}],fans:[],bone:{x:12.6,y:4.1},bin:bin(13.4,.5,2,1.2),palette:['fanR','rampR']},
 {name:'Record Shop',tip:'Everything here runs the other way.',W:16,H:10,boxes:[floor(0,1.4),floor(2.8,13.2),shelf(9,5.5,6.5)],
  doms:row([14.8,14,13.2,12.4,11.6,10.8],5.8,0,-1),balls:[{x:9.5,y:6.12}],planks:[],springs:[],fans:[],bone:{x:4.5,y:.8},bin:bin(1.4,-.2,1.4,.7),palette:['rampL','fanL','domino']},
 {name:'Rooftop Garden',tip:'A long way round: along the floor, up to the shelf, across the gap, into the bin.',W:16,H:10,boxes:[floor(0,16),shelf(8,4,3.5),shelf(11.6,4,3.4),wall(13.6,.5,.2,1.2),wall(15.8,.5,.2,1.2)],
  doms:[...row([1.5,2.3,3.1,3.9],.5,0),...row([8.4,9.2,10],4.3),...row([12,12.8,13.6],4.3)],balls:[{x:4.7,y:.82}],planks:[],springs:[],fans:[],bone:{x:14.2,y:4.6},bin:bin(13.8,.5,2,1.2),palette:['spring','domino','fanR']},
 {name:'The Vault',tip:'Three pieces on offer. You may not need them all.',W:16,H:10,boxes:[floor(0,16),shelf(.5,7.5,3),shelf(5,3.5,5.5),crate(11,.5,.6,4),wall(11.8,.5,.2,1.2),wall(14,.5,.2,1.2)],
  doms:[...row([1.1,1.9,2.7],7.8,0),...row([5.5,6.3,7.9,8.7],3.8)],balls:[{x:3.3,y:7.82},{x:9.6,y:4.12}],planks:[],springs:[],fans:[],bone:{x:11,y:4.8},bin:bin(12,.5,2,1.2),palette:['rampR','domino','spring']}];
// Placements that solve every level (tests prove it; the demo plays them): {i: palette index, gx, gy}.
export const DOMINO_SOLUTIONS=[
 [{i:0,gx:10,gy:9}],
 [{i:0,gx:16,gy:8}],
 [{i:0,gx:18,gy:1}],
 [{i:0,gx:10,gy:12}],
 [{i:0,gx:18,gy:9},{i:1,gx:14,gy:11}],
 [{i:0,gx:10,gy:9}],
 [{i:0,gx:18,gy:9}],
 [{i:0,gx:15,gy:1},{i:1,gx:22,gy:9}],
 [{i:0,gx:10,gy:12},{i:1,gx:14,gy:8}]];

export const pieceOf=name=>P[name];
export const cells=(lv)=>({gx:Math.round(lv.W/G),gy:Math.round(lv.H/G)});
// The surface directly under a point: the highest box top at or below y covering x.
function surfaceUnder(lv,x,y){let best=null;for(const b of lv.boxes){const top=b.y+b.h;if(x>=b.x&&x<=b.x+b.w&&top<=y+1e-6&&(best===null||top>best))best=top;}return best;}
const overlaps=(a,b)=>a.x<b.x+b.w-1e-6&&a.x+a.w>b.x+1e-6&&a.y<b.y+b.h-1e-6&&a.y+a.h>b.y+1e-6;
// Everything a level starts with, as footprints, so placed pieces can't sit inside it.
function fixedRects(lv){const r=[...lv.boxes];for(const d of lv.doms)r.push({x:d.x-DOMINO.domW/2,y:d.y,w:DOMINO.domW,h:DOMINO.domH});for(const b of lv.balls)r.push({x:b.x-DOMINO.ballR,y:b.y-DOMINO.ballR,w:DOMINO.ballR*2,h:DOMINO.ballR*2});
 r.push({x:lv.bone.x-DOMINO.boneR,y:lv.bone.y-DOMINO.boneR,w:DOMINO.boneR*2,h:DOMINO.boneR*2});for(const s of lv.springs)r.push({x:s.x-.4,y:s.y,w:.8,h:.3});for(const f of lv.fans)r.push({x:f.x-.3,y:f.y-.3,w:.6,h:.6});return r;}
// Resolves a placement to a concrete piece (snapped onto the surface below the cursor for things
// that stand), or null when it can't go there. `placed` are the other pieces already down.
export function resolve(lv,i,gx,gy,placed=[]){const name=lv.palette[i];if(!name)return null;const p=P[name],x=gx*G,y=gy*G;if(x<.5||x>lv.W-.5||y<.5||y>lv.H-.5)return null;
 let piece,foot;const fixed=fixedRects(lv),others=placed.filter(q=>q.i!==i).map(q=>resolve(lv,q.i,q.gx,q.gy)).filter(Boolean);
 if(p.type==='domino'||p.type==='ball'||p.type==='spring'){const top=surfaceUnder(lv,x,y);if(top===null||y-top>4)return null;
  if(p.type==='domino'){piece={type:'domino',x,y:top};foot={x:x-DOMINO.domW/2,y:top,w:DOMINO.domW,h:DOMINO.domH};}
  else if(p.type==='ball'){piece={type:'ball',x,y:top+DOMINO.ballR};foot={x:x-DOMINO.ballR,y:top,w:DOMINO.ballR*2,h:DOMINO.ballR*2};}
  else{piece={type:'spring',x,y:top};foot={x:x-.4,y:top,w:.8,h:.3};}}
 else if(p.type==='plank'){piece={type:'plank',dir:p.dir,x1:x-1,y1:y+.5*p.dir,x2:x+1,y2:y-.5*p.dir};for(let k=0;k<=8;k++){const px=piece.x1+(piece.x2-piece.x1)*k/8,py=piece.y1+(piece.y2-piece.y1)*k/8;if(fixed.some(b=>px>b.x+.02&&px<b.x+b.w-.02&&py>b.y+.02&&py<b.y+b.h-.02))return null;}foot={x:x-.3,y:y-.3,w:.6,h:.6};}
 else{piece={type:'fan',dir:p.dir,x,y,w:3,h:1.6};foot={x:x-.3,y:y-.3,w:.6,h:.6};}
 piece.foot=foot;if(fixed.some(b=>overlaps(foot,b)))return null;for(const o of others)if(overlaps(foot,o.foot))return null;return piece;}
// Share codes: 'D' + level + one triple per piece (palette index, cursor x, cursor y in base 36).
export const encodeCode=(level,placed)=>'D'+level.toString(36)+placed.map(p=>'-'+p.i+p.gx.toString(36)+p.gy.toString(36)).join('');
export function decodeCode(code){const m=/^D([0-9a-z])((?:-[0-2][0-9a-z][0-9a-z])*)$/i.exec(String(code||'').trim());if(!m)return null;const level=parseInt(m[1],36);if(!(level<LEVELS.length))return null;
 const placed=(m[2].match(/-[0-2][0-9a-z][0-9a-z]/gi)||[]).map(s=>({i:+s[1],gx:parseInt(s[2],36),gy:parseInt(s[3],36)}));if(!validPlacements(LEVELS[level],placed))return null;return {level,placed};}
function validPlacements(lv,placed){if(!Array.isArray(placed)||placed.length>lv.palette.length)return false;const c=cells(lv),seen=new Set();
 for(const p of placed){if(!p||!Number.isInteger(p.i)||p.i<0||p.i>=lv.palette.length||seen.has(p.i)||!Number.isInteger(p.gx)||!Number.isInteger(p.gy)||p.gx<0||p.gx>c.gx||p.gy<0||p.gy>c.gy)return false;seen.add(p.i);}
 return placed.every(p=>resolve(lv,p.i,p.gx,p.gy,placed));}

// Geometry helpers.
const segClosest=(px,py,x1,y1,x2,y2)=>{const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy;const t=l2?Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l2)):0;return {x:x1+dx*t,y:y1+dy*t,t};};
// Closest points between two segments, by sampling then refining (robust and plenty for dominoes).
function segSeg(a1,a2,b1,b2){let best={d:Infinity,s:0,t:0};for(let i=0;i<=8;i++){const s=i/8,px=a1.x+(a2.x-a1.x)*s,py=a1.y+(a2.y-a1.y)*s,c=segClosest(px,py,b1.x,b1.y,b2.x,b2.y),d=Math.hypot(px-c.x,py-c.y);if(d<best.d)best={d,s,t:c.t};}
 for(let k=0;k<3;k++){const span=1/8/Math.pow(2,k);for(const s of [best.s-span,best.s+span]){if(s<0||s>1)continue;const px=a1.x+(a2.x-a1.x)*s,py=a1.y+(a2.y-a1.y)*s,c=segClosest(px,py,b1.x,b1.y,b2.x,b2.y),d=Math.hypot(px-c.x,py-c.y);if(d<best.d)best={d,s,t:c.t};}}return best;}
export const domTip=(d,a=d.a)=>({x:d.x+Math.sin(a)*DOMINO.domH,y:d.y+Math.cos(a)*DOMINO.domH});

export class DominoGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.score=0;this.reason='';this.events=[];
  this.level=0;this.fuses=DOMINO.fuses;this.cleared=0;this.codes=[];this.input={up:false,down:false,left:false,right:false,act:false};this.holdT={};this.acc=0;this.setup();}
 get lv(){return LEVELS[this.level];}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 // A fresh level: nothing placed, the cursor over the middle of the room.
 setup(){const lv=this.lv;this.phase='place';this.phaseT=0;this.placed=[];this.cursor={gx:Math.round(lv.W/G/2),gy:Math.round(lv.H/G/2)};this.fails=0;this.sim=null;this.runT=0;this.holdT={};this.actT=-1;this.events.push({type:'level',name:lv.name,tip:lv.tip,level:this.level});}
 // Inputs. Directions are held: one cell at once, then repeating. 'act' places or picks up on a
 // short press and starts the chain when held.
 press(dir,down){if(dir==='act'){if(down){if(this.actT<0)this.actT=0;}else if(this.actT>=0){const t=this.actT;this.actT=-1;if(t<DOMINO.hold)this.act();}return true;}
  if(!DIRS.includes(dir))return false;down=!!down;if(down&&!this.input[dir]){this.nudge(dir);this.holdT[dir]=0;}this.input[dir]=down;if(!down)delete this.holdT[dir];return true;}
 move(dir){if(dir==='act')return this.act();if(!DIRS.includes(dir))return false;return this.nudge(dir);}
 nudge(dir){if(this.status!=='playing'||this.phase!=='place')return false;const c=cells(this.lv),[dx,dy]=STEP[dir],gx=Math.max(1,Math.min(c.gx-1,this.cursor.gx+dx)),gy=Math.max(1,Math.min(c.gy-1,this.cursor.gy+dy));if(gx===this.cursor.gx&&gy===this.cursor.gy)return false;this.cursor={gx,gy};return true;}
 // Pointing at a cell moves the cursor there; pointing at the cursor again acts.
 aim(gx,gy){if(this.status!=='playing'||this.phase!=='place')return false;const c=cells(this.lv);gx=Math.max(1,Math.min(c.gx-1,Math.round(gx)));gy=Math.max(1,Math.min(c.gy-1,Math.round(gy)));if(gx===this.cursor.gx&&gy===this.cursor.gy)return this.act();this.cursor={gx,gy};return false;}
 point(gx,gy){if(this.status!=='playing'||this.phase!=='place')return false;const c=cells(this.lv);gx=Math.max(1,Math.min(c.gx-1,Math.round(gx)));gy=Math.max(1,Math.min(c.gy-1,Math.round(gy)));if(gx===this.cursor.gx&&gy===this.cursor.gy)return false;this.cursor={gx,gy};return true;}
 nextIndex(){const used=new Set(this.placed.map(p=>p.i));return this.lv.palette.findIndex((_,i)=>!used.has(i));}
 under(){return this.placed.findIndex(p=>p.gx===this.cursor.gx&&p.gy===this.cursor.gy);}
 // What the cursor would do: pick up the piece under it, or place the next one (if it fits).
 preview(){const k=this.under();if(k>=0)return {kind:'pickup',piece:resolve(this.lv,this.placed[k].i,this.placed[k].gx,this.placed[k].gy,this.placed),index:this.placed[k].i};const i=this.nextIndex();if(i<0)return {kind:'none'};const piece=resolve(this.lv,i,this.cursor.gx,this.cursor.gy,this.placed);return {kind:piece?'place':'blocked',piece,index:i,name:this.lv.palette[i]};}
 act(){if(this.status!=='playing'||this.phase!=='place')return false;const k=this.under();if(k>=0){const [p]=this.placed.splice(k,1);this.events.push({type:'pickup',i:p.i,x:p.gx*G,y:p.gy*G});return true;}
  const i=this.nextIndex();if(i<0){this.events.push({type:'nope',why:'No pieces left'});return false;}const piece=resolve(this.lv,i,this.cursor.gx,this.cursor.gy,this.placed);if(!piece){this.events.push({type:'nope',why:'It won’t fit there'});return false;}
  this.placed.push({i,gx:this.cursor.gx,gy:this.cursor.gy});this.events.push({type:'place',i,x:piece.x??(piece.x1+piece.x2)/2,y:piece.y??(piece.y1+piece.y2)/2,name:this.lv.palette[i]});return true;}
 setPlaced(placed){if(!validPlacements(this.lv,placed))return false;this.placed=placed.map(p=>({i:p.i,gx:p.gx,gy:p.gy}));return true;}
 // GO: freeze the placements into a simulation and give the starter its kick.
 go(){if(this.status!=='playing'||this.phase!=='place')return false;this.actT=-1;const w=this.world();this.sim={t:0,balls:w.balls.map(b=>({...b})),doms:w.doms.map(d=>({x:d.x,y:d.y,a:0,av:d.start*DOMINO.kick,s:0})),springs:w.springs.map(()=>({cool:0})),quiet:0};
  this.phase='run';this.phaseT=0;this.runT=0;this.events.push({type:'go'});return true;}
 // The level's props plus the placed pieces, as the simulation sees them.
 world(){const key=this.level+':'+JSON.stringify(this.placed);if(this._world?.key===key)return this._world;const lv=this.lv,w={key,boxes:lv.boxes.slice(),doms:lv.doms.map(d=>({...d})),balls:[{x:lv.bone.x,y:lv.bone.y,vx:0,vy:0,r:DOMINO.boneR,m:1.6,e:.25,bone:true},...lv.balls.map(b=>({x:b.x,y:b.y,vx:0,vy:0,r:DOMINO.ballR,m:1,e:.35,bone:false}))],planks:lv.planks.slice(),springs:lv.springs.slice(),fans:lv.fans.slice(),pieces:[]};
  for(const p of this.placed){const q=resolve(lv,p.i,p.gx,p.gy,this.placed);if(!q)continue;w.pieces.push(q);if(q.type==='domino')w.doms.push({x:q.x,y:q.y,start:0,placed:true});else if(q.type==='ball')w.balls.push({x:q.x,y:q.y,vx:0,vy:0,r:DOMINO.ballR,m:1,e:.35,bone:false,placed:true});else if(q.type==='plank')w.planks.push({x1:q.x1,y1:q.y1,x2:q.x2,y2:q.y2,placed:true});else if(q.type==='spring')w.springs.push({x:q.x,y:q.y,placed:true});else w.fans.push({x:q.x,y:q.y,w:q.w,h:q.h,dir:q.dir,placed:true});}
  this._world=w;return w;}
 tick(dt){if(this.status!=='playing')return;this.acc+=dt;while(this.acc>=H&&this.status==='playing'){this.acc-=H;this.step();}}
 step(){this.time+=H;
  if(this.phase==='place'){for(const d of DIRS)if(this.input[d]){this.holdT[d]=(this.holdT[d]||0)+H;if(this.holdT[d]>=.28){this.holdT[d]-=.09;this.nudge(d);}}
   if(this.actT>=0){this.actT+=H;if(this.actT>=DOMINO.hold){this.actT=-1;this.go();}}return;}
  if(this.phase==='run'){this.runT+=H;this.physics();return;}
  this.phaseT+=H;if(this.phase==='won'&&this.phaseT>=DOMINO.won){if(this.level>=LEVELS.length-1){this.events.push({type:'dynasty'});return this.end(`Every room cleared. ${this.fuses} fuse${this.fuses===1?'':'s'} to spare. A dynasty.`);}this.level++;this.setup();}
  else if(this.phase==='failed'&&this.phaseT>=DOMINO.failed){this.phase='place';this.phaseT=0;this.sim=null;}}
 // One 1/120 s step of the chain.
 physics(){const s=this.sim,w=this.world(),lv=this.lv,g=DOMINO.g;s.t+=H;
  // Balls: gravity, fans, then collisions with boxes, planks, walls, springs, each other and dominoes.
  for(const b of s.balls){b.vy-=g*H;if(!b.bone)for(const f of w.fans)if(Math.abs(b.x-f.x)<f.w/2&&Math.abs(b.y-f.y)<f.h/2)b.vx+=f.dir*DOMINO.fan*H;b.x+=b.vx*H;b.y+=b.vy*H;b.rest=false;
   if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx)*b.e;}if(b.x>lv.W-b.r){b.x=lv.W-b.r;b.vx=-Math.abs(b.vx)*b.e;}if(b.y>lv.H-b.r){b.y=lv.H-b.r;b.vy=-Math.abs(b.vy)*b.e;}if(b.y<b.r){b.y=b.r;b.vy=Math.abs(b.vy)*b.e;}
   // Springs fire before the surface under them gets a say, so a ball dropping onto a pad launches.
   w.springs.forEach((sp,k)=>{const st=s.springs[k];st.cool=Math.max(0,st.cool-H);if(Math.abs(b.x-sp.x)<.4+b.r*.5&&b.y-b.r<sp.y+.32&&b.y>sp.y&&b.vy<=.5){if(!st.cool){b.y=sp.y+.3+b.r;b.vy=DOMINO.spring;b.vx*=.6;st.cool=99;this.events.push({type:'spring',x:sp.x,y:sp.y});}}});
   for(const bx of w.boxes){const cx=Math.max(bx.x,Math.min(bx.x+bx.w,b.x)),cy=Math.max(bx.y,Math.min(bx.y+bx.h,b.y));this.contact(b,cx,cy,0,0);}
   for(const p of w.planks){const c=segClosest(b.x,b.y,p.x1,p.y1,p.x2,p.y2);this.contact(b,c.x,c.y,0,0);}}
  for(let i=0;i<s.balls.length;i++)for(let j=i+1;j<s.balls.length;j++){const a=s.balls[i],b=s.balls[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1e-9,pen=a.r+b.r-d;if(pen<=0)continue;const nx=dx/d,ny=dy/d,ma=a.m/(a.m+b.m);a.x-=nx*pen*(1-ma);a.y-=ny*pen*(1-ma);b.x+=nx*pen*ma;b.y+=ny*pen*ma;
   const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(vn<0){const j2=-(1+.5)*vn/(1/a.m+1/b.m);a.vx-=j2*nx/a.m;a.vy-=j2*ny/a.m;b.vx+=j2*nx/b.m;b.vy+=j2*ny/b.m;if(-vn>1.5)this.events.push({type:'hit',x:a.x+nx*a.r,y:a.y+ny*a.r,v:-vn});}}
  // Dominoes: gravity about the base edge, fans, then they lean on each other and knock balls.
  const I=1.4*DOMINO.domH*DOMINO.domH/3;
  s.doms.forEach((d,k)=>{if(d.s===2)return;for(const f of w.fans)if(Math.abs(d.x-f.x)<f.w/2&&Math.abs(d.y+.5-f.y)<f.h/2)d.av+=f.dir*DOMINO.fanTorque*H;
   const a=d.a;if(a!==0||d.av!==0){const sg=a>0?1:a<0?-1:(d.av>0?1:-1);d.av+=(3*g/(2*DOMINO.domH))*Math.sin(a-sg*TIP)*H;d.av*=1-(Math.abs(a)<TIP?3:.4)*H;}d.pa=a;d.a+=d.av*H;
   if(Math.abs(d.a)<.004&&Math.abs(d.av)<.02){d.a=0;d.av=0;}if(Math.abs(d.a)>TIP&&d.s===0){d.s=1;this.events.push({type:'knock',x:d.x,y:d.y+DOMINO.domH*.6,dir:d.a>0?1:-1});}
   if(Math.abs(d.a)>=Math.PI/2){d.a=Math.sign(d.a)*Math.PI/2;d.av=0;d.s=2;this.events.push({type:'flat',x:d.x,y:d.y,dir:d.a>0?1:-1});}
   // The tip ran into a box: stop and lean on it.
   const t=domTip(d);if(d.s!==2&&w.boxes.some(bx=>t.x>bx.x&&t.x<bx.x+bx.w&&t.y>bx.y&&t.y<bx.y+bx.h)){let lo=d.pa,hi=d.a;for(let q=0;q<10;q++){const mid=(lo+hi)/2,tt=domTip(d,mid);if(w.boxes.some(bx=>tt.x>bx.x&&tt.x<bx.x+bx.w&&tt.y>bx.y&&tt.y<bx.y+bx.h))hi=mid;else lo=mid;}d.a=lo;d.av=0;d.s=2;}});
  for(let pass=0;pass<2;pass++)for(let i=0;i<s.doms.length;i++)for(let j=i+1;j<s.doms.length;j++){const A=s.doms[i],B=s.doms[j];if(A.s===2&&B.s===2||Math.abs(A.y-B.y)>.05||Math.abs(A.x-B.x)>DOMINO.domH+DOMINO.domW)continue;
   const r=segSeg({x:A.x,y:A.y},domTip(A),{x:B.x,y:B.y},domTip(B));const pen=DOMINO.domW-r.d;if(pen<=0)continue;const sg=B.x>A.x?1:-1,dA=r.s*DOMINO.domH,dB=r.t*DOMINO.domH;
   // Relative speed of the touching points along the line between the bases; stop them crossing.
   const tA=Math.cos(A.a)*sg,tB=Math.cos(B.a)*sg,vA=A.av*dA*tA,vB=B.av*dB*tB,vrel=vA-vB;
   if(vrel>0){const j2=vrel/((dA*tA)*(dA*tA)/I+(dB*tB)*(dB*tB)/I+1e-9);if(A.s!==2)A.av-=j2*dA*tA/I;if(B.s!==2){B.av+=j2*dB*tB/I;if(B.s===0&&Math.abs(B.av)>.4&&!B.hit){B.hit=1;this.events.push({type:'tap',x:B.x,y:B.y+DOMINO.domH*.7});}}}
   const share=A.s===2?0:B.s===2?1:.5;if(dA>.05&&A.s!==2)A.a-=sg*pen*share/dA;if(dB>.05&&B.s!==2)B.a+=sg*pen*(1-share)/dB;}
  for(const b of s.balls)for(const d of s.doms){if(d.s===2)continue;const t=domTip(d),c=segClosest(b.x,b.y,d.x,d.y,t.x,t.y),dist=Math.hypot(b.x-c.x,b.y-c.y),pen=b.r+DOMINO.domW/2-dist;if(pen<=0)continue;
   const nx=(b.x-c.x)/(dist||1e-9),ny=(b.y-c.y)/(dist||1e-9),dd=c.t*DOMINO.domH,tx=Math.cos(d.a),ty=-Math.sin(d.a),tn=tx*nx+ty*ny,vrel=(b.vx-d.av*dd*tx)*nx+(b.vy-d.av*dd*ty)*ny;b.x+=nx*pen;b.y+=ny*pen;
   if(vrel<0){const j2=-(1+.3)*vrel/(1/b.m+(dd*tn)*(dd*tn)/I);b.vx+=j2*nx/b.m;b.vy+=j2*ny/b.m;d.av-=j2*dd*tn/I;if(-vrel>1.2)this.events.push({type:'hit',x:c.x,y:c.y,v:-vrel});}}
  const bone=s.balls[0],bn=lv.bin;if(!s.moved&&Math.hypot(bone.vx,bone.vy)>.5){s.moved=1;this.events.push({type:'bone',x:bone.x,y:bone.y});}
  if(bone.x>bn.x+bone.r*.5&&bone.x<bn.x+bn.w-bone.r*.5&&bone.y>bn.y&&bone.y<bn.y+bn.h)return this.win();
  const quiet=s.balls.every(b=>Math.hypot(b.vx,b.vy)<.05)&&s.doms.every(d=>d.s===2||Math.abs(d.av)<.02);s.quiet=quiet?s.quiet+H:0;
  if(s.t>=DOMINO.maxRun||s.t>.5&&s.quiet>=DOMINO.settle)this.fail(s.t>=DOMINO.maxRun?'Time ran out with the bone still out of the bin.':'Everything stopped. The bone stayed put.');}
 contact(b,cx,cy,sx,sy){const dx=b.x-cx,dy=b.y-cy,d=Math.hypot(dx,dy);if(d>=b.r)return;let nx,ny;if(d<1e-9){nx=0;ny=1;}else{nx=dx/d;ny=dy/d;}b.x+=nx*(b.r-d);b.y+=ny*(b.r-d);
  const vn=(b.vx-sx)*nx+(b.vy-sy)*ny,tx=-ny,ty=nx;let vt=b.vx*tx+b.vy*ty;
  // A hard landing scrubs off most of the sideways speed; rolling resistance takes the rest slowly.
  if(vn<0){const bounce=-vn>1?-(1+b.e)*vn:-vn;b.vx+=bounce*nx;b.vy+=bounce*ny;if(-vn>3)vt*=Math.max(.4,1-(-vn-3)*.1);if(-vn>2.2)this.events.push({type:'thud',x:cx,y:cy,v:-vn});}
  vt-=Math.min(Math.abs(vt),.8*H)*Math.sign(vt);const vn2=b.vx*nx+b.vy*ny;b.vx=vn2*nx+vt*tx;b.vy=vn2*ny+vt*ty;b.rest=ny>.7;}
 win(){const s=this.sim,unused=this.lv.palette.length-this.placed.length,pts=Math.max(200,1000+unused*400+Math.max(0,600-Math.round(s.t*40))-this.fails*150),code=encodeCode(this.level,this.placed);
  this.score+=pts;this.cleared++;this.codes.push(code);this.phase='won';this.phaseT=0;this.events.push({type:'win',points:pts,code,time:s.t,unused,name:this.lv.name});}
 fail(why){this.fails++;this.fuses--;this.phase='failed';this.phaseT=0;this.events.push({type:'fail',why,fuses:this.fuses});if(this.fuses<=0)this.end(`Out of fuses in ${this.lv.name}. ${this.cleared} room${this.cleared===1?'':'s'} cleared.`);}
 lastCode(){return this.codes[this.codes.length-1]||'';}
}

export const DOMINO_FIELDS=['level','fuses','cleared','phase','phaseT','placed','cursor','fails','sim','codes','runT','input','holdT','actT'];
const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b,fin=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
export function validDominoSnapshot(s){if(!int(s.level,0,LEVELS.length-1)||!int(s.fuses,1,DOMINO.fuses)||s.cleared!==s.level+(s.phase==='won'?1:0)||!int(s.fails,0,DOMINO.fuses)||!int(s.score,200*s.cleared,2800*s.cleared)||!['place','run','won','failed'].includes(s.phase)||!fin(s.phaseT,0,10)||!fin(s.runT,0,DOMINO.maxRun+1))return false;
 const lv=LEVELS[s.level],c=cells(lv);if(!s.cursor||!int(s.cursor.gx,0,c.gx)||!int(s.cursor.gy,0,c.gy)||!validPlacements(lv,s.placed))return false;
 if(!Array.isArray(s.codes)||s.codes.length!==s.cleared||!s.codes.every(x=>typeof x==='string'&&x.length<24))return false;
 if(!s.input||!DIRS.every(d=>typeof s.input[d]==='boolean')||typeof s.input.act!=='boolean'||!fin(s.actT,-1,10)||typeof s.holdT!=='object')return false;
 if(s.phase==='place')return s.sim===null;if(!s.sim||typeof s.sim!=='object')return false;const n=1+lv.balls.length+s.placed.filter(p=>lv.palette[p.i]==='ball').length,m=lv.doms.length+s.placed.filter(p=>lv.palette[p.i]==='domino').length,k=lv.springs.length+s.placed.filter(p=>lv.palette[p.i]==='spring').length;
 const sim=s.sim;return fin(sim.t,0,DOMINO.maxRun+1)&&fin(sim.quiet,0,10)&&Array.isArray(sim.balls)&&sim.balls.length===n&&sim.balls.every(b=>fin(b.x,0,lv.W)&&fin(b.y,-1,lv.H)&&fin(b.vx,-60,60)&&fin(b.vy,-60,60)&&fin(b.r,.1,1)&&fin(b.m,.1,10)&&fin(b.e,0,1)&&typeof b.bone==='boolean')&&sim.balls[0].bone===true
  &&Array.isArray(sim.doms)&&sim.doms.length===m&&sim.doms.every(d=>fin(d.x,0,lv.W)&&fin(d.y,0,lv.H)&&fin(d.a,-Math.PI/2,Math.PI/2)&&fin(d.av,-80,80)&&int(d.s,0,2))&&Array.isArray(sim.springs)&&sim.springs.length===k&&sim.springs.every(x=>fin(x.cool,0,100))&&placedMatch(lv,s.placed,sim);}
// The simulation's placed dominoes and balls must sit where the placements say they do.
function placedMatch(lv,placed,sim){let d=lv.doms.length,b=1+lv.balls.length;for(const p of placed){const q=resolve(lv,p.i,p.gx,p.gy,placed);if(!q)return false;if(q.type==='domino'){const x=sim.doms[d++];if(!x||Math.abs(x.x-q.x)>1e-9||Math.abs(x.y-q.y)>1e-9)return false;}else if(q.type==='ball'){const x=sim.balls[b++];if(!x||x.bone)return false;}}return true;}
