// Domino Dynasty: one-shot chain-reaction puzzles on a pegboard. Every room is a tall side-view
// contraption (10 m wide, 16 m tall) full of fixed toys: shelves, standing dominoes, brass balls,
// ramps, springs, fans, boxing gloves, see-saws, switches with trapdoors, and conveyor belts.
// Somewhere is the golden bone (in its capsule) and somewhere else the bin. You peg a few pieces
// of your own into the board, press GO, and the chain runs by itself: the room is won when the
// bone ends up in the bin. Test runs are free and unlimited; stars reward using no more pieces
// than par and getting it first try.
// The physics is small and completely deterministic: a fixed 120 Hz step and no randomness, so
// the same placements always give the same chain and a solution can be shared as a short code.
// Units are meters, x right, y up.
export const DOMINO={fps:120,g:14,grid:.5,W:10,H:16,ballR:.38,boneR:.36,domH:1.3,domW:.22,maxRun:24,hold:.45,spring:12.5,springTilt:12,springSide:3,fan:9,fanTorque:3.2,fanLen:3.6,fanH:1.7,kick:2.6,punch:8.5,settle:.9,won:2.8,failed:1.7,slow:.32,slowMax:1.2,reach:1.6,skipAfter:3,sawLen:3,sawLim:.36};
const H=1/DOMINO.fps,G=DOMINO.grid,TIP=Math.atan(DOMINO.domW/DOMINO.domH),LIM=DOMINO.sawLim,SAWI=.3;
const DIRS=['up','down','left','right'],STEP={up:[0,1],down:[0,-1],left:[-1,0],right:[1,0]};
// The pieces a palette can offer: a domino, a ball, a plank sloping down-right (dir 1) or
// down-left (dir -1), a spring pad (straight up, or tilted to throw right or left), a fan or a
// boxing glove facing right (1) or left (-1).
const P={domino:{type:'domino'},ball:{type:'ball'},rampR:{type:'plank',dir:1},rampL:{type:'plank',dir:-1},spring:{type:'spring',dir:0},springR:{type:'spring',dir:1},springL:{type:'spring',dir:-1},fanR:{type:'fan',dir:1},fanL:{type:'fan',dir:-1},gloveR:{type:'glove',dir:1},gloveL:{type:'glove',dir:-1}};
export const PIECE_LABEL={domino:'DOMINO',ball:'BALL',plank:'RAMP',spring:'SPRING',fan:'FAN',glove:'GLOVE'};
export const pieceOf=name=>P[name];
export const WORLDS=[{name:'The Pawn Shop',tag:'DOMINOES · BALLS · RAMPS · SPRINGS'},{name:'The Kennel',tag:'FANS · GLOVES · SEE-SAWS'},{name:'The Record Shop',tag:'SWITCHES · TRAPDOORS · BELTS'}];

// Room building blocks. Shelves and floors are named by their top surface.
const floor=(x=0,w=10)=>({x,y:0,w,h:.5,kind:'floor'});
const sh=(x,top,w)=>({x,y:top-.3,w,h:.3,kind:'shelf'});
const crate=(x,y,w,h)=>({x,y,w,h,kind:'crate'});
const belt=(x,top,w,v)=>({x,y:top-.3,w,h:.3,kind:'belt',belt:v});
const row=(x0,n,top,start=0,sp=.75)=>Array.from({length:n},(_,i)=>({x:Math.round((x0+i*sp*(start<0?-1:1))*100)/100,y:top,start:i===0?start:0}));
const doms=(xs,top)=>xs.map(x=>({x,y:top,start:0}));
const ball=(x,top)=>({x,y:top+DOMINO.ballR});
const bone=(x,top)=>({x,y:top+DOMINO.boneR});
const plank=(x1,y1,x2,y2)=>({x1,y1,x2,y2});
// Where a ball of radius r rests in the cup at a see-saw's low end (side 1 = right end).
const sawRest=(s,side,r)=>{const a=s.tilt*DOMINO.sawLim,u=1.15,h=r+.07;return {x:s.x+Math.cos(a)*side*u-Math.sin(a)*h,y:s.y+Math.sin(a)*side*u+Math.cos(a)*h};};
// The bin: an open-topped box standing on a surface; `open` leaves one side wall off so the bone
// can roll in. The zone is what the bone has to end up inside.
const bin=(x,top,open='')=>({x,y:top,w:1.8,h:1.2,open});
const L=(name,world,par,tip,o)=>({name,world,par,tip,W:DOMINO.W,H:DOMINO.H,boxes:[],doms:[],balls:[],planks:[],springs:[],fans:[],gloves:[],saws:[],switches:[],doors:[],...o});

export const LEVELS=[
 // ── World 1: The Pawn Shop ── dominoes, balls and ramps, springs.
 L('Missing Link',0,1,'One domino is missing from the top row. Drag it into the gap, then press GO.',{
  boxes:[floor(),sh(.4,12.5,8.6),sh(1.4,7,7.6)],
  doms:[...row(1.25,4,12.5,1),...row(5.75,3,12.5),...row(7.2,6,7,0,-.75)],balls:[ball(8.15,12.5)],
  planks:[plank(10,9.6,8.2,8.5)],bone:bone(2.1,7),bin:bin(.15,.5),palette:['domino']}),
 L('Top Shelf',0,1,'New piece: the RAMP. The ball drops off the shelf into the crate and dies. Give it a slope to roll down.',{
  boxes:[floor(),sh(0,13,4.4),sh(6.8,11,2.2),sh(2.2,5,4.2),sh(6.2,8.4,2.6),crate(6.2,8.4,.2,.9),crate(8.6,8.4,.2,.9)],
  doms:[...row(.9,3,13,1),...row(7.5,2,11,0,.7)],balls:[ball(3.4,13),ball(8.7,11)],
  planks:[plank(10,7.4,7.6,6.2)],bone:bone(2.7,5),bin:bin(.15,.5),palette:['rampR']}),
 L('Marble Run',0,2,'Two ramps this time. Balls only roll downhill, so mind which way each one slopes.',{
  boxes:[floor(),sh(0,13.5,3),crate(5.4,10,.5,4.5),sh(2.4,7,2.6),crate(2.4,7,.2,.7),crate(4.8,7,.2,.7),sh(2,4.2,4.6)],
  doms:[...row(.8,2,13.5,1),...row(4.4,3,4.2,0,-.75)],balls:[ball(2.3,13.5)],
  bone:bone(2.35,4.2),bin:bin(.15,.5),palette:['rampR','rampL']}),
 L('Pogo',0,1,'New piece: the SPRING. This one is tilted: it throws up and to the right. The ball needs to reach that last shelf.',{
  boxes:[floor(),sh(0,11.5,3),sh(6.2,4.5,2.8),crate(6.2,.5,.3,3.7)],
  doms:[...row(.8,2,11.5,1),...row(6.95,3,4.5,0,.7)],balls:[ball(2.3,11.5)],
  planks:[plank(6.6,9.6,3.6,8.1),plank(.3,5.2,2.3,4.2)],bone:bone(8.72,4.5),bin:bin(8.05,.5),palette:['springR']}),
 L('Closing Time',0,3,'Everything so far. The top row has nothing to push, the ball needs a way across, and the bottom row has a hole in it.',{
  boxes:[floor(),sh(5.6,13,4.4),sh(1,11,2.2),sh(3.6,5,4.2),sh(1.2,8.4,2.6),crate(1.2,8.4,.2,.9),crate(3.6,8.4,.2,.9)],
  doms:[...row(9.1,3,13,-1),...row(2.5,2,11,0,-.7),...doms([4.25,6.5],5)],balls:[ball(1.35,11)],
  planks:[plank(0,7.4,2.4,6.2)],bone:bone(7.2,5),bin:bin(8.05,.5),palette:['ball','rampL','domino']}),
 // ── World 2: The Kennel ── fans, boxing gloves, see-saws.
 L('Windy Bunks',1,1,'New piece: the FAN. Nothing in here is pushing anything. Bring some wind.',{
  boxes:[floor(),sh(0,12,3.4),sh(5,9.5,4)],
  doms:[...row(7.8,2,9.5,0,.7)],balls:[ball(2,12)],
  planks:[plank(10,6.5,7,5)],bone:bone(8.75,9.5),bin:bin(2.8,.5),palette:['fanR']}),
 L('Knockout',1,1,'New piece: the GLOVE. Knock something onto its back and it punches whatever is in front.',{
  boxes:[floor(),sh(0,12,6),sh(3.4,6.5,4.2)],
  doms:[...row(.8,4,12,1,.7),...row(6.6,3,6.5,0,-.7)],balls:[ball(5,12)],
  planks:[plank(10,8.5,7.5,7.25)],bone:bone(4.5,6.5),bin:bin(.15,.5),palette:['gloveR']}),
 L('Fetch',1,1,'New toy: the SEE-SAW. Drop something heavy on the high end and the low end throws. The fan does the rest.',{
  boxes:[floor(),sh(4.6,12.5,5.4),crate(3,9.5,.3,4.5)],
  doms:[...row(9.2,2,12.5,-1,.7),...doms([6.25],12.5)],balls:[ball(5.4,12.5)],fans:[{x:5.9,y:3.4,dir:1}],
  saws:[{x:5.6,y:1.1,tilt:-1}],bone:sawRest({x:5.6,y:1.1,tilt:-1},1,DOMINO.boneR),bin:bin(8.05,.5),palette:['domino']}),
 L('Bath Day',1,2,'The wind only blows one way, and the bone has to go the other. Something in here needs a punch.',{
  boxes:[floor(),sh(0,12.5,3.6),sh(5.4,9.5,4.6)],
  balls:[ball(1.6,12.5)],
  bone:bone(7.3,9.5),bin:bin(.15,.5),palette:['fanR','gloveL']}),
 L('Top Dog',1,2,'The see-saw only throws if something lands on its high end. Build the drop, then catch the bone in the air.',{
  boxes:[floor(),sh(4.6,12.5,5.4)],
  doms:[...row(9.2,5,12.5,-1,.7)],balls:[ball(5.5,12.5)],
  saws:[{x:5,y:1.1,tilt:1}],bone:sawRest({x:5,y:1.1,tilt:1},-1,DOMINO.boneR),bin:bin(.8,.5),palette:['rampR','fanL']}),
 // ── World 3: The Record Shop ── switches and trapdoors, conveyor belts.
 L('Trapdoor Blues',2,1,'New toy: the SWITCH. Press the red button and the trapdoor drops whatever is standing on it.',{
  boxes:[floor(),sh(0,12,1),sh(2,12,8),sh(3,6.5,7)],doors:[{x:1,y:11.7,w:1,sw:0}],
  switches:[{x:4,y:6.5}],doms:[...row(9.2,4,6.5,-1,.7)],
  bone:bone(1.5,12),bin:bin(.6,.5),palette:['ball']}),
 L('B-Side',2,1,'New toy: the BELT. It carries whatever lands on it and drops it off the far end.',{
  boxes:[floor(),sh(0,13.5,3.4),belt(3.6,9.5,4.6,2.2),sh(2.4,5,4.4)],doms:[...row(.8,3,13.5,1,.7),...row(5.4,3,5,0,-.7)],balls:[ball(2.9,13.5)],
  bone:bone(3.3,5),bin:bin(.5,.5),palette:['rampL']}),
 L('Drop the Needle',2,2,'The button switches the fan on. Get something onto it, and give the wind something to push.',{
  boxes:[floor(),sh(0,12.5,4),sh(7.6,8,2.4),sh(0,4,6.2)],
  switches:[{x:9.1,y:8}],fans:[{x:.5,y:4.9,dir:1,sw:0}],
  doms:[...row(.8,3,12.5,1,.7),...row(4.6,2,4,0,.7)],balls:[ball(3,12.5)],
  bone:bone(5.9,4),bin:bin(6.3,.5),palette:['rampR','ball']}),
 L('Remix',2,2,'Belt, button, trapdoor. The bone is ready to drop; it just needs the floor to go.',{
  boxes:[floor(),sh(0,13,4.6),sh(7.4,10,2.6),sh(3.4,8,1.2),sh(5.6,8,1),belt(1,4.5,5.6,-2.4)],doors:[{x:4.6,y:7.7,w:1,sw:0}],
  switches:[{x:9.2,y:10}],doms:[...row(.8,2,13,1,.7),...doms([3.75],13)],balls:[ball(4.25,13)],
  bone:bone(5.1,8),bin:bin(.15,.5),palette:['domino','rampR']}),
 L('Platinum',2,3,'The long way round: dominoes, belt, button, trapdoor, and then it is up to you. Four pieces on offer; three will do.',{
  boxes:[floor(),sh(5.4,13.5,4.6),belt(.8,9.5,4.4,2.2),sh(5.6,6,1.4),sh(7,8,1),crate(7,8,.2,.5),sh(9,8,1)],doors:[{x:8,y:7.7,w:1,sw:0}],
  switches:[{x:6.4,y:6}],doms:[...row(9.2,2,13.5,-1,.7),...doms([6.25],13.5)],balls:[ball(5.75,13.5)],
  bone:bone(8.5,8),bin:bin(.6,.5,'right'),palette:['domino','springL','fanL','rampL']})];
// Placements that solve every room (the tests prove it; the attract demo plays them), and a
// second, different answer for each: {i: palette index, gx, gy} in half-meter cells.
export const DOMINO_SOLUTIONS=[
 [{i:0,gx:9,gy:25}],
 [{i:0,gx:10,gy:24}],
 [{i:0,gx:10,gy:17},{i:1,gx:15,gy:13}],
 [{i:0,gx:8,gy:1}],
 [{i:0,gx:13,gy:26},{i:1,gx:10,gy:24},{i:2,gx:11,gy:10}],
 [{i:0,gx:1,gy:25}],
 [{i:0,gx:8,gy:24}],
 [{i:0,gx:15,gy:25}],
 [{i:0,gx:1,gy:26},{i:1,gx:17,gy:19}],
 [{i:0,gx:5,gy:24},{i:1,gx:14,gy:5}],
 [{i:0,gx:12,gy:13}],
 [{i:0,gx:17,gy:13}],
 [{i:0,gx:11,gy:19},{i:1,gx:4,gy:8}],
 [{i:0,gx:5,gy:26},{i:1,gx:12,gy:23}],
 [{i:0,gx:15,gy:27},{i:1,gx:17,gy:1},{i:3,gx:11,gy:5}]];
export const DOMINO_ALTS=[
 [{i:0,gx:10,gy:25}],
 [{i:0,gx:11,gy:23}],
 [{i:0,gx:9,gy:18},{i:1,gx:14,gy:12}],
 [{i:0,gx:9,gy:1}],
 [{i:0,gx:12,gy:26},{i:1,gx:9,gy:25},{i:2,gx:10,gy:10}],
 [{i:0,gx:12,gy:20}],
 [{i:0,gx:7,gy:24}],
 [{i:0,gx:14,gy:25}],
 [{i:0,gx:12,gy:20},{i:1,gx:18,gy:19}],
 [{i:0,gx:4,gy:22},{i:1,gx:10,gy:6}],
 [{i:0,gx:11,gy:13}],
 [{i:0,gx:16,gy:16}],
 [{i:0,gx:12,gy:22},{i:1,gx:6,gy:8}],
 [{i:0,gx:6,gy:26},{i:1,gx:11,gy:22}],
 [{i:0,gx:14,gy:27},{i:1,gx:17,gy:1},{i:2,gx:14,gy:3}]];

// A room seen in a mirror: the daily room can be flipped left to right, so even a room you know
// plays differently. Ramps, fans, gloves, tilted springs, belts and see-saws all swap sides.
const FLIP={rampR:'rampL',rampL:'rampR',fanR:'fanL',fanL:'fanR',gloveR:'gloveL',gloveL:'gloveR',springR:'springL',springL:'springR'};
export function mirrorLevel(lv){const W=lv.W,fx=x=>Math.round((W-x)*1000)/1000;return {...lv,mirrored:true,boxes:lv.boxes.map(b=>({...b,x:fx(b.x+b.w),...(b.belt?{belt:-b.belt}:{})})),doms:lv.doms.map(d=>({...d,x:fx(d.x),start:-d.start})),balls:lv.balls.map(b=>({...b,x:fx(b.x)})),planks:lv.planks.map(p=>({x1:fx(p.x1),y1:p.y1,x2:fx(p.x2),y2:p.y2})),springs:lv.springs.map(s=>({...s,x:fx(s.x),dir:-(s.dir||0)})),fans:lv.fans.map(f=>({...f,x:fx(f.x),dir:-f.dir})),gloves:lv.gloves.map(q=>({...q,x:fx(q.x),dir:-q.dir})),saws:lv.saws.map(s=>({...s,x:fx(s.x),tilt:-s.tilt})),switches:lv.switches.map(q=>({...q,x:fx(q.x)})),doors:lv.doors.map(d=>({...d,x:fx(d.x+d.w)})),bone:{x:fx(lv.bone.x),y:lv.bone.y},bin:{...lv.bin,x:fx(lv.bin.x+lv.bin.w),open:lv.bin.open==='left'?'right':lv.bin.open==='right'?'left':''},palette:lv.palette.map(n=>FLIP[n]||n),_solid:undefined,_fixed:undefined};}
export const mirrorPlaced=(lv,placed)=>placed.map(p=>({i:p.i,gx:Math.round(lv.W/G)-p.gx,gy:p.gy}));
const MIRRORS=[];const mirrored=i=>MIRRORS[i]??=mirrorLevel(LEVELS[i]);
// The room of the day: one room picked by the seed, perhaps mirrored, with one house rule.
// 'blind' hides the forecast, 'budget' locks the tray at par, 'mirror' always flips the room.
export const TWISTS=[{id:'plain',name:'House rules',text:'No twist today. Three stars or bust.'},{id:'blind',name:'Lights low',text:'No forecast: pieces show no dotted path.'},{id:'budget',name:'Tight budget',text:'You cannot place more pieces than par.'},{id:'mirror',name:'Mirror room',text:'The room is flipped left to right.'}];
export function DAILY_TWIST(seed){const s=(seed>>>0),h=Math.imul(s^(s>>>15),0x2c1b3c6d)>>>0,k=Math.imul(h^(h>>>12),0x297a2d39)>>>0,room=1+k%(LEVELS.length-1),t=(k>>>8)%4,mirror=t===3||((k>>>12)&1)===1;return {room,mirror,rule:TWISTS[t].id,name:TWISTS[t].name+(mirror&&t!==3?' · mirrored':''),text:TWISTS[t].text+(mirror&&t!==3?' And the room is flipped.':'')};}
// Feats: specific things worth doing, awarded once a run. `test(game, winEvent)` runs on every win.
export const FEATS=[
 {id:'domino.first',name:'First Try',text:'Clear a room on your first GO.',test:(g,e)=>e.first},
 {id:'domino.perfect',name:'Three Stars',text:'Clear a room at par on the first try.',test:(g,e)=>e.stars===3},
 {id:'domino.spare',name:'Spare Parts',text:'Clear a room with a piece still in the tray.',test:(g,e)=>e.pieces<g.lv.palette.length},
 {id:'domino.quick',name:'Short Fuse',text:'Bin the bone in under three seconds.',test:(g,e)=>e.time<3},
 {id:'domino.long',name:'Long Run',text:'Topple ten dominoes in one winning chain.',test:(g,e)=>g.sim.knocks>=10},
 {id:'domino.pow',name:'Knockout',text:'Win a room with a glove punch in the chain.',test:g=>g.sim.gloves.some(x=>x.f>0)},
 {id:'domino.air',name:'Air Mail',text:'Win a room with a spring or see-saw throw in the chain.',test:g=>g.sim.springs.some(x=>x.cool)||g.sim.thrown>0},
 {id:'domino.comeback',name:'So Close, Then',text:'Miss by a whisker, then clear the room on the very next GO.',test:g=>g.wasNear===1},
 {id:'domino.stars10',name:'Ten Stars',text:'Bank ten stars in one run.',test:g=>g.totalStars>=10},
 {id:'domino.shop',name:'Shop Cleared',text:'Clear all five rooms of one shop in a single run.',test:g=>WORLDS.some((_,w)=>LEVELS.every((l,i)=>l.world!==w||g.stars[i]>0))},
 {id:'domino.dynasty',name:'Dynasty',text:'Clear all fifteen rooms in a single run.',test:g=>g.stars.every(s=>s>0)}];
const FEAT_IDS=FEATS.map(f=>f.id);

export const cells=lv=>({gx:Math.round(lv.W/G),gy:Math.round(lv.H/G)});
const binWalls=b=>{const r=[];if(b.open!=='left')r.push({x:b.x-.15,y:b.y,w:.15,h:b.h,kind:'bin'});if(b.open!=='right')r.push({x:b.x+b.w,y:b.y,w:.15,h:b.h,kind:'bin'});return r;};
const gloveBox=q=>({x:q.x-.4,y:q.y,w:.8,h:.8});
const switchZone=q=>({x:q.x-.45,y:q.y,w:.9,h:.26});
const fanZone=f=>({x:f.dir>0?f.x:f.x-DOMINO.fanLen,y:f.y-DOMINO.fanH/2,w:DOMINO.fanLen,h:DOMINO.fanH});
const inRect=(x,y,r,pad=0)=>x>r.x-pad&&x<r.x+r.w+pad&&y>r.y-pad&&y<r.y+r.h+pad;
const circleRect=(b,r)=>{const cx=Math.max(r.x,Math.min(r.x+r.w,b.x)),cy=Math.max(r.y,Math.min(r.y+r.h,b.y));return Math.hypot(b.x-cx,b.y-cy)<b.r;};
const overlaps=(a,b)=>a.x<b.x+b.w-1e-6&&a.x+a.w>b.x+1e-6&&a.y<b.y+b.h-1e-6&&a.y+a.h>b.y+1e-6;
// Solid, standable surfaces of a room (belts and trapdoors are solid but nothing can be pegged on them).
const solids=lv=>lv._solid??=[...lv.boxes,...binWalls(lv.bin)];
function surfaceUnder(lv,x,y){let best=null,ok=true;for(const b of solids(lv)){const top=b.y+b.h;if(x>=b.x&&x<=b.x+b.w&&top<=y+1e-6&&(best===null||top>best)){best=top;ok=b.kind!=='belt'&&b.kind!=='bin';}}
 for(const d of lv.doors)if(x>=d.x&&x<=d.x+d.w&&d.y+.3<=y+1e-6&&(best===null||d.y+.3>best)){best=d.y+.3;ok=false;}return ok?best:null;}
// Everything a room starts with, as footprints, so placed pieces can't sit inside it.
function fixedRects(lv){if(lv._fixed)return lv._fixed;const r=[...solids(lv)];for(const d of lv.doors)r.push({x:d.x,y:d.y,w:d.w,h:.3});for(const d of lv.doms)r.push({x:d.x-DOMINO.domW/2,y:d.y,w:DOMINO.domW,h:DOMINO.domH});for(const b of lv.balls)r.push({x:b.x-DOMINO.ballR,y:b.y-DOMINO.ballR,w:DOMINO.ballR*2,h:DOMINO.ballR*2});
 r.push({x:lv.bone.x-DOMINO.boneR,y:lv.bone.y-DOMINO.boneR,w:DOMINO.boneR*2,h:DOMINO.boneR*2});r.push({x:lv.bin.x,y:lv.bin.y,w:lv.bin.w,h:lv.bin.h});
 for(const s of lv.springs)r.push({x:s.x-.4,y:s.y,w:.8,h:.3});for(const f of lv.fans)r.push({x:f.x-.35,y:f.y-.35,w:.7,h:.7});for(const q of lv.gloves)r.push(gloveBox(q));for(const q of lv.switches)r.push(switchZone(q));
 for(const s of lv.saws)r.push({x:s.x-DOMINO.sawLen/2-.1,y:s.y-.6,w:DOMINO.sawLen+.2,h:1.5});return lv._fixed=r;}
// Resolves a placement to a concrete piece (dropped onto the surface below the cell for things
// that stand), or null when it can't go there. `placed` are the other pieces already down.
export function resolve(lv,i,gx,gy,placed=[]){const name=lv.palette[i];if(!name)return null;const p=P[name],x=gx*G,y=gy*G;if(x<.5||x>lv.W-.5||y<.5||y>lv.H-.5)return null;
 let piece,foot;const fixed=fixedRects(lv);
 if(p.type==='plank'){piece={type:'plank',dir:p.dir,x1:x-1,y1:y+.5*p.dir,x2:x+1,y2:y-.5*p.dir};for(let k=0;k<=8;k++){const px=piece.x1+(piece.x2-piece.x1)*k/8,py=piece.y1+(piece.y2-piece.y1)*k/8;if(fixed.some(b=>px>b.x+.02&&px<b.x+b.w-.02&&py>b.y+.02&&py<b.y+b.h-.02))return null;}foot={x:x-.7,y:y-.3,w:1.4,h:.6};}
 else if(p.type==='fan'){piece={type:'fan',dir:p.dir,x,y};foot={x:x-.35,y:y-.35,w:.7,h:.7};}
 else{const top=surfaceUnder(lv,x,y);if(top===null||y-top>3)return null;
  if(p.type==='domino'){piece={type:'domino',x,y:top};foot={x:x-DOMINO.domW/2,y:top,w:DOMINO.domW,h:DOMINO.domH};}
  else if(p.type==='ball'){piece={type:'ball',x,y:top+DOMINO.ballR};foot={x:x-DOMINO.ballR,y:top,w:DOMINO.ballR*2,h:DOMINO.ballR*2};}
  else if(p.type==='spring'){piece={type:'spring',dir:p.dir,x,y:top};foot={x:x-.4,y:top,w:.8,h:.3};}
  else{piece={type:'glove',dir:p.dir,x,y:top};foot=gloveBox(piece);}}
 piece.foot=foot;if(fixed.some(b=>overlaps(foot,b)))return null;
 for(const q of placed){if(q.i===i)continue;const o=resolve(lv,q.i,q.gx,q.gy);if(o&&overlaps(foot,o.foot))return null;}return piece;}
// Magnetism: the legal cell nearest a point in the room (meters), within reach, for palette
// piece i. Standing pieces settle on the cell just above the surface they land on, so one spot
// always has one name.
export function snap(lv,i,x,y,placed=[],reach=DOMINO.reach){const name=lv.palette[i];if(!name)return null;const stand=!['plank','fan'].includes(P[name].type),c=cells(lv),n=Math.ceil(reach/G);let best=null,bd=reach*reach+1e-9;const cx=Math.round(x/G),cy=Math.round(y/G);
 for(let gx=Math.max(1,cx-n);gx<=Math.min(c.gx-1,cx+n);gx++)for(let gy=Math.max(1,cy-n-(stand?6:0));gy<=Math.min(c.gy-1,cy+n);gy++){const q=resolve(lv,i,gx,gy,placed);if(!q)continue;
  let d;if(stand){if(Math.abs(gy*G-q.y-(q.type==='ball'?-DOMINO.ballR:0))>G+1e-6)continue;const py=q.type==='ball'?q.y-DOMINO.ballR:q.y,dy=y<py?py-y:Math.max(0,y-py-1.3);d=(gx*G-x)**2+dy*dy*.6;}else d=(gx*G-x)**2+(gy*G-y)**2;
  if(d<bd){bd=d;best={gx,gy};}}return best;}
// Share codes: 'D' + room + one triple per piece (palette index, cell x, cell y in base 36).
export const encodeCode=(level,placed)=>'D'+level.toString(36)+placed.map(p=>'-'+p.i+p.gx.toString(36)+p.gy.toString(36)).join('');
export function decodeCode(code){const m=/^D([0-9a-z])((?:-[0-3][0-9a-z][0-9a-z])*)$/i.exec(String(code||'').trim());if(!m)return null;const level=parseInt(m[1],36);if(!(level<LEVELS.length))return null;
 const placed=(m[2].match(/-[0-3][0-9a-z][0-9a-z]/gi)||[]).map(s=>({i:+s[1],gx:parseInt(s[2],36),gy:parseInt(s[3],36)}));if(!validPlacements(LEVELS[level],placed))return null;return {level,placed};}
function validPlacements(lv,placed){if(!Array.isArray(placed)||placed.length>lv.palette.length)return false;const c=cells(lv),seen=new Set();
 for(const p of placed){if(!p||!Number.isInteger(p.i)||p.i<0||p.i>=lv.palette.length||seen.has(p.i)||!Number.isInteger(p.gx)||!Number.isInteger(p.gy)||p.gx<0||p.gx>c.gx||p.gy<0||p.gy>c.gy)return false;seen.add(p.i);}
 return placed.every(p=>resolve(lv,p.i,p.gx,p.gy,placed));}

// Geometry helpers.
const segClosest=(px,py,x1,y1,x2,y2)=>{const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy;const t=l2?Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l2)):0;return {x:x1+dx*t,y:y1+dy*t,t};};
// Closest points between two segments, by sampling then refining (robust and plenty for dominoes).
function segSeg(a1,a2,b1,b2){let best={d:Infinity,s:0,t:0};for(let i=0;i<=8;i++){const s=i/8,px=a1.x+(a2.x-a1.x)*s,py=a1.y+(a2.y-a1.y)*s,c=segClosest(px,py,b1.x,b1.y,b2.x,b2.y),d=Math.hypot(px-c.x,py-c.y);if(d<best.d)best={d,s,t:c.t};}
 for(let k=0;k<3;k++){const span=1/8/Math.pow(2,k);for(const s of [best.s-span,best.s+span]){if(s<0||s>1)continue;const px=a1.x+(a2.x-a1.x)*s,py=a1.y+(a2.y-a1.y)*s,c=segClosest(px,py,b1.x,b1.y,b2.x,b2.y),d=Math.hypot(px-c.x,py-c.y);if(d<best.d)best={d,s,t:c.t};}}return best;}
export const domTip=(d,a=d.a)=>({x:d.x+Math.sin(a)*DOMINO.domH,y:d.y+Math.cos(a)*DOMINO.domH});
// A see-saw's two ends at angle a (counter-clockwise, so positive lifts the right end).
export const sawEnds=(s,a)=>{const c=Math.cos(a)*DOMINO.sawLen/2,n=Math.sin(a)*DOMINO.sawLen/2;return {x1:s.x-c,y1:s.y-n,x2:s.x+c,y2:s.y+n};};
const NOOP=()=>{};

// A ball against something fixed (or a belt moving at `belt` m/s along its top).
function contact(b,cx,cy,emit,belt=0,pad=0){const dx=b.x-cx,dy=b.y-cy,d=Math.hypot(dx,dy),R=b.r+pad;if(d>=R)return false;let nx,ny;if(d<1e-9){nx=0;ny=1;}else{nx=dx/d;ny=dy/d;}b.x+=nx*(R-d);b.y+=ny*(R-d);
 const vn=b.vx*nx+b.vy*ny,tx=ny,ty=-nx;let vt=b.vx*tx+b.vy*ty;
 // A hard landing scrubs off most of the sideways speed; rolling resistance takes the rest slowly.
 if(vn<0){const bounce=-vn>1?-(1+b.e)*vn:-vn;b.vx+=bounce*nx;b.vy+=bounce*ny;if(-vn>3)vt*=Math.max(.45,1-(-vn-3)*.08);if(-vn>2.2)emit({type:'thud',x:cx,y:cy,v:-vn,bone:!!b.bone});}
 if(belt&&ny>.7){const want=belt*tx-vt;vt+=Math.max(-14*H,Math.min(14*H,want));}else vt-=Math.min(Math.abs(vt),.8*H)*Math.sign(vt);
 const vn2=b.vx*nx+b.vy*ny;b.vx=vn2*nx+vt*tx;b.vy=vn2*ny+vt*ty;return true;}
// A ball against a point on a see-saw (pivot px,py; state S with angle a and spin av).
function pivotContact(b,S,px,py,cx,cy,rad,emit){const dx=b.x-cx,dy=b.y-cy,d=Math.hypot(dx,dy)||1e-9,R=b.r+rad;if(d>=R)return false;const nx=dx/d,ny=dy/d;b.x+=nx*(R-d);b.y+=ny*(R-d);
 const rx=cx-px,ry=cy-py,vrel=(b.vx+S.av*ry)*nx+(b.vy-S.av*rx)*ny;
 if(vrel<0){const rn=rx*ny-ry*nx,e=b.vy<-3?.35:0;let j=-(1+e)*vrel/(1/b.m+rn*rn/SAWI);const nav=S.av-j*rn/SAWI;
  // Parked against an end stop and pushed further into it: the plank is as good as fixed.
  if(S.a>=LIM-1e-6&&nav>0||S.a<=-LIM+1e-6&&nav<0){if(S.av===0)j=-(1+e)*vrel*b.m;else S.av=0;}else S.av=nav;
  b.vx+=j*nx/b.m;b.vy+=j*ny/b.m;if(-vrel>2.5)emit({type:'thud',x:cx,y:cy,v:-vrel,bone:!!b.bone});}
 const tx=ny,ty=-nx;let vt=b.vx*tx+b.vy*ty;const vn=b.vx*nx+b.vy*ny;
 // Each end of the plank has a shallow cup: while the see-saw is parked, a ball out there stays put.
 if(S.av===0&&Math.abs(S.a)>LIM-1e-6&&Math.hypot(rx,ry)>.7&&Math.abs(vt)<1.5)vt=0;else vt-=Math.min(Math.abs(vt),.8*H)*Math.sign(vt);b.vx=vn*nx+vt*tx;b.vy=vn*ny+vt*ty;return true;}
// One step of one ball through a world w with moving-part state s. Used by the real chain and by
// the placement forecast (which passes a throwaway state and no dominoes).
function stepBall(b,w,s,lv,emit){b.vy-=DOMINO.g*H;
 w.fans.forEach(f=>{if(f.sw!==undefined&&!s.sw[f.sw])return;if(inRect(b.x,b.y,f.zone))b.vx+=f.dir*DOMINO.fan/b.m*H;});
 b.x+=b.vx*H;b.y+=b.vy*H;
 if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx)*b.e;}if(b.x>lv.W-b.r){b.x=lv.W-b.r;b.vx=-Math.abs(b.vx)*b.e;}if(b.y>lv.H-b.r){b.y=lv.H-b.r;b.vy=-Math.abs(b.vy)*b.e;}if(b.y<b.r){b.y=b.r;b.vy=Math.abs(b.vy)*b.e;}
 // Springs fire before the surface under them gets a say, so a ball dropping onto a pad launches.
 w.springs.forEach((sp,k)=>{const st=s.springs[k];if(!st.cool&&Math.abs(b.x-sp.x)<.4+b.r*.5&&b.y-b.r<sp.y+.32&&b.y>sp.y&&b.vy<=.5){b.y=sp.y+.3+b.r;if(sp.dir){b.vy=DOMINO.springTilt;b.vx=sp.dir*DOMINO.springSide+b.vx*.2;}else{b.vy=DOMINO.spring;b.vx*=.6;}st.cool=1;emit({type:'spring',x:sp.x,y:sp.y,dir:sp.dir||0});}});
 for(const bx of w.boxes)contact(b,Math.max(bx.x,Math.min(bx.x+bx.w,b.x)),Math.max(bx.y,Math.min(bx.y+bx.h,b.y)),emit,bx.belt||0);
 w.doors.forEach(d=>{if(s.sw[d.sw])return;contact(b,Math.max(d.x,Math.min(d.x+d.w,b.x)),Math.max(d.y,Math.min(d.y+.3,b.y)),emit);});
 w.gloves.forEach((q,k)=>{const bx=q.box;if(contact(b,Math.max(bx.x,Math.min(bx.x+bx.w,b.x)),Math.max(bx.y,Math.min(bx.y+bx.h,b.y)),emit)&&!s.gloves[k].f)s.gloves[k].trig=1;});
 for(const p of w.planks)contact(b,...((c)=>[c.x,c.y])(segClosest(b.x,b.y,p.x1,p.y1,p.x2,p.y2)),emit,0,.06);
 w.saws.forEach((sw,k)=>{const S=s.saws[k],e=sawEnds(sw,S.a),c=segClosest(b.x,b.y,e.x1,e.y1,e.x2,e.y2);pivotContact(b,S,sw.x,sw.y,c.x,c.y,.07,emit);});}

export class DominoGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.score=0;this.reason='';this.events=[];this.rev=2;
  this.level=0;this.unlocked=0;this.best=LEVELS.map(()=>0);this.stars=LEVELS.map(()=>-1);this.pts=LEVELS.map(()=>0);this.codes=[];this.feats=[];this.fastest=0;this.wasNear=0;this._daily=false;this.twist=null;this.sel=-1;this.held=null;this.input={up:false,down:false,left:false,right:false,act:false};this.holdT={};this.acc=0;this.setup();}
 get lv(){return this.twist?.mirror?mirrored(this.level):LEVELS[this.level];}
 // Daily mode: the run is one room, picked and twisted by the seed.
 get daily(){return this._daily;}
 set daily(v){this._daily=!!v;this.twist=this._daily?DAILY_TWIST(this.worldSeed):null;this._world=null;this._fc=null;if(this._daily&&this.status==='ready'&&this.time===0&&!this.cleared){this.level=this.twist.room;this.unlocked=Math.max(this.unlocked,this.level);this.events=[];this.setup();}}
 get cleared(){return this.stars.filter(s=>s>0).length;}
 get totalStars(){return this.stars.reduce((a,s)=>a+Math.max(0,s),0);}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 // Progress kept between runs: the furthest room reached and the best stars in each. A new run
 // starts at the furthest room; earlier rooms stay one tap away.
 loadProgress(p){if(!validProgress(p))return false;this.unlocked=Math.max(this.unlocked,p.furthest);p.stars.forEach((s,i)=>{this.best[i]=Math.max(this.best[i],s);});if(!this._daily&&this.status==='ready'&&this.time===0&&!this.cleared){this.level=Math.min(this.unlocked,LEVELS.length-1);this.events=[];this.setup();}return true;}
 exportProgress(){return {furthest:this.unlocked,stars:this.best.slice()};}
 // A fresh room: nothing placed, the cursor over the middle of the room.
 setup(){const lv=this.lv;this.phase='place';this.phaseT=0;this.placed=[];this.cursor={gx:Math.round(lv.W/G/2),gy:Math.round(lv.H/G/2)};this.attempts=0;this.sim=null;this.runT=0;this.holdT={};this.actT=-1;this.sel=-1;this.held=null;this.keyed=false;this.marker=null;this._world=null;this.events.push({type:'level',name:lv.name,tip:lv.tip,level:this.level,world:lv.world});}
 // Any room up to the furthest one reached can be opened while building.
 jump(level){if(this._daily||this.status!=='playing'&&this.status!=='ready'||this.phase!=='place'||!Number.isInteger(level)||level<0||level>Math.min(this.unlocked,LEVELS.length-1)||level===this.level)return false;this.level=level;this.setup();return true;}
 canSkip(){return this.status==='playing'&&this.phase==='place'&&this.attempts>=DOMINO.skipAfter;}
 // Stuck? After a few tries a room can be left behind with no stars.
 skip(){if(!this.canSkip())return false;if(this.stars[this.level]<0)this.stars[this.level]=0;this.events.push({type:'skip',level:this.level});this.advance();return true;}
 // The line a run is remembered by.
 brag(){const f=this.fastest?`, fastest chain ${this.fastest.toFixed(1)} s`:'';return `${this.cleared} room${this.cleared===1?'':'s'}, ${this.totalStars}★${f}`;}
 advance(){if(this._daily){const s=this.stars[this.level];return this.end(s>0?`Room of the day (${this.lv.name}, ${this.twist.name}) cleared with ${s}★ in ${this.attempts} ${this.attempts===1?'try':'tries'}${this.fastest?`, chain ${this.fastest.toFixed(1)} s`:''}.`:`Room of the day (${this.lv.name}) skipped.`);}
  if(this.level>=LEVELS.length-1){const all=this.stars.every(s=>s>0);if(all)this.events.push({type:'dynasty'});return this.end(all?`A dynasty: all ${LEVELS.length} rooms, ${this.totalStars} of ${LEVELS.length*3}★${this.fastest?`, fastest chain ${this.fastest.toFixed(1)} s`:''}.`:`Reached the last room: ${this.brag()}.`);}
  this.level++;if(this.level>this.unlocked){this.unlocked=this.level;this.events.push({type:'unlock',level:this.level});}this.setup();}
 // Inputs. Directions are held: one cell at once, then repeating. 'act' places or picks up on a
 // short press and starts the chain when held.
 press(dir,down){if(dir==='act'){if(down){if(this.actT<0)this.actT=0;}else if(this.actT>=0){const t=this.actT;this.actT=-1;if(t<DOMINO.hold)this.act();}return true;}
  if(!DIRS.includes(dir))return false;down=!!down;if(down&&!this.input[dir]){this.nudge(dir);this.holdT[dir]=0;}this.input[dir]=down;if(!down)delete this.holdT[dir];return true;}
 move(dir){if(dir==='act')return this.act();if(!DIRS.includes(dir))return false;return this.nudge(dir);}
 building(){return this.status==='playing'&&this.phase==='place';}
 nudge(dir){if(!this.building())return false;const c=cells(this.lv),[dx,dy]=STEP[dir],gx=Math.max(1,Math.min(c.gx-1,this.cursor.gx+dx)),gy=Math.max(1,Math.min(c.gy-1,this.cursor.gy+dy));if(gx===this.cursor.gx&&gy===this.cursor.gy)return false;this.cursor={gx,gy};this.keyed=true;return true;}
 clampCell(gx,gy){const c=cells(this.lv);return {gx:Math.max(1,Math.min(c.gx-1,Math.round(gx))),gy:Math.max(1,Math.min(c.gy-1,Math.round(gy)))};}
 // Pointing at a cell moves the cursor there; pointing at the cursor again acts.
 aim(gx,gy){if(!this.building())return false;const c=this.clampCell(gx,gy);if(c.gx===this.cursor.gx&&c.gy===this.cursor.gy)return this.act();this.cursor=c;return false;}
 point(gx,gy){if(!this.building())return false;const c=this.clampCell(gx,gy);if(c.gx===this.cursor.gx&&c.gy===this.cursor.gy)return false;this.cursor=c;return true;}
 // Carrying with a finger: the cursor goes to the legal cell nearest the point (in meters), so a
 // piece clicks into the closest place it fits; with nothing in reach it follows the finger.
 carry(x,y){if(!this.building())return false;const i=this.held?this.held.i:this.nextIndex();const s=i>=0?snap(this.lv,i,x,y,this.placed):null,c=s||this.clampCell(x/G,y/G);this.cursor=c;return !!s;}
 nextIndex(){const used=new Set(this.placed.map(p=>p.i));if(this.sel>=0&&this.sel<this.lv.palette.length&&!used.has(this.sel))return this.sel;return this.lv.palette.findIndex((_,i)=>!used.has(i));}
 // Choose which tray piece the cursor drops next (keys 1–4, or a tap on the tray).
 select(i){if(!this.building()||!Number.isInteger(i)||i<0||i>=this.lv.palette.length)return false;this.sel=i;return true;}
 // Drag and drop. grab(i) picks a piece up off the tray or out of the room; the cursor then carries
 // it (carry() or point() moves it), and release() puts it down where it is, or back where it came
 // from if it won't fit there. release(false) hands it back to the tray.
 grab(i){if(!this.select(i))return false;const k=this.placed.findIndex(p=>p.i===i);let from=null;if(k>=0){const [p]=this.placed.splice(k,1);from={gx:p.gx,gy:p.gy};this.cursor={...from};}this.held={i,from};this.keyed=false;this.events.push({type:'grab',i});return true;}
 release(drop=true){const h=this.held;if(!h)return false;this.held=null;if(!this.building())return false;this.sel=h.i;
  if(drop&&resolve(this.lv,h.i,this.cursor.gx,this.cursor.gy,this.placed))return this.act();
  if(drop&&h.from&&resolve(this.lv,h.i,h.from.gx,h.from.gy,this.placed)){this.placed.push({i:h.i,...h.from});this.events.push({type:'nope',why:'It won’t fit there'});return false;}
  this.events.push({type:'pickup',i:h.i,x:this.cursor.gx*G,y:this.cursor.gy*G});return false;}
 // The placed piece nearest a point in the room (in meters), within reach; -1 when there is none.
 pieceNear(x,y,reach=1.1){let best=-1,bd=reach;for(const p of this.placed){const q=resolve(this.lv,p.i,p.gx,p.gy,this.placed);if(!q)continue;const cx=q.x??(q.x1+q.x2)/2,cy=(q.y??(q.y1+q.y2)/2)+(q.type==='domino'?DOMINO.domH/2:q.type==='glove'?.4:0),d=Math.hypot(cx-x,(cy-y)*.8);if(d<bd){bd=d;best=p.i;}}return best;}
 clearPlaced(){if(!this.building()||!this.placed.length)return false;this.placed=[];this.held=null;this.events.push({type:'pickup',i:-1,x:this.lv.W/2,y:this.lv.H/2});return true;}
 under(){return this.placed.findIndex(p=>p.gx===this.cursor.gx&&p.gy===this.cursor.gy);}
 // What the cursor would do: pick up the piece under it, or place the next one (if it fits).
 preview(){const k=this.under();if(k>=0)return {kind:'pickup',piece:resolve(this.lv,this.placed[k].i,this.placed[k].gx,this.placed[k].gy,this.placed),index:this.placed[k].i};const i=this.nextIndex();if(i<0)return {kind:'none'};const piece=resolve(this.lv,i,this.cursor.gx,this.cursor.gy,this.placed);return {kind:piece?'place':'blocked',piece,index:i,name:this.lv.palette[i]};}
 act(){if(!this.building())return false;const k=this.under();if(k>=0){const [p]=this.placed.splice(k,1);this.events.push({type:'pickup',i:p.i,x:p.gx*G,y:p.gy*G});return true;}
  const i=this.nextIndex();if(i<0){this.events.push({type:'nope',why:'No pieces left'});return false;}if(this.twist?.rule==='budget'&&this.placed.length>=this.lv.par){this.events.push({type:'nope',why:'Tight budget: par pieces only'});return false;}const piece=resolve(this.lv,i,this.cursor.gx,this.cursor.gy,this.placed);if(!piece){this.events.push({type:'nope',why:'It won’t fit there'});return false;}
  this.placed.push({i,gx:this.cursor.gx,gy:this.cursor.gy});this.events.push({type:'place',i,x:piece.x??(piece.x1+piece.x2)/2,y:piece.y??(piece.y1+piece.y2)/2,name:this.lv.palette[i]});return true;}
 setPlaced(placed){if(!validPlacements(this.lv,placed))return false;this.placed=placed.map(p=>({i:p.i,gx:p.gx,gy:p.gy}));return true;}
 // The first second or so of what the piece under the cursor will do once the chain reaches it,
 // as a dotted path for the renderer: where a ball will roll, how far a domino reaches, where a
 // ramp sends things, how high a spring throws, what a glove's punch does. Null when there is
 // nothing useful to show.
 forecast(){if(!this.building()||this.twist?.rule==='blind')return null;const pv=this.preview();if(pv.kind!=='place'||!pv.piece)return null;const key=this.level+':'+pv.index+':'+this.cursor.gx+':'+this.cursor.gy+':'+JSON.stringify(this.placed);if(this._fc?.key===key)return this._fc.v;
  const q=pv.piece,lv=this.lv,w=this.worldWith([...this.placed,{i:pv.index,gx:this.cursor.gx,gy:this.cursor.gy}]);let v=null;
  const probe=(x,y,vx,vy,n=150)=>{const b={x,y,vx,vy,r:DOMINO.ballR,m:1,e:.35},s={springs:w.springs.map(()=>({cool:0})),gloves:w.gloves.map(()=>({f:1,trig:0})),saws:w.saws.map(sw=>({a:sw.tilt*LIM,av:0})),sw:w.switches.map(()=>0)},pts=[[x,y]];for(let k=1;k<=n;k++){stepBall(b,w,s,lv,NOOP);if(k%6===0)pts.push([b.x,b.y]);}return Math.hypot(b.x-x,b.y-y)>.25?pts:null;};
  if(q.type==='ball')v={pts:probe(q.x,q.y,0,0)};
  else if(q.type==='plank')v={pts:probe(q.x1+.25*q.dir,q.y1+DOMINO.ballR+.2,0,0)};
  else if(q.type==='spring')v={pts:probe(q.x,q.y+.31+DOMINO.ballR,0,0)};
  else if(q.type==='glove')v={pts:probe(q.x+q.dir*.85,q.y+DOMINO.ballR+.02,q.dir*DOMINO.punch,2.2),zone:{x:q.dir>0?q.x+.4:q.x-1.5,y:q.y,w:1.1,h:1}};
  else if(q.type==='fan')v={zone:fanZone(q),dir:q.dir,pts:null};
  else if(q.type==='domino'){const arc=d=>Array.from({length:9},(_,k)=>{const a=d*k/8*Math.PI/2;return [q.x+Math.sin(a)*DOMINO.domH,q.y+Math.cos(a)*DOMINO.domH];});v={pts:null,arcs:[arc(1),arc(-1)]};}
  if(v&&!v.pts&&!v.zone&&!v.arcs)v=null;this._fc={key,v};return v;}
 // GO: freeze the placements into a simulation and give the starter its kick.
 go(){if(!this.building())return false;if(this.held)this.release(true);this.actT=-1;const w=this.world();
  this.sim={t:0,balls:w.balls.map(b=>({x:b.x,y:b.y,vx:0,vy:0,r:b.r,m:b.m,e:b.e,bone:b.bone})),doms:w.doms.map(d=>({x:d.x,y:d.y,a:0,av:d.start*DOMINO.kick,s:0,hit:0})),springs:w.springs.map(()=>({cool:0})),gloves:w.gloves.map(()=>({f:0,trig:0})),saws:w.saws.map(s=>({a:s.tilt*LIM,av:0})),sw:w.switches.map(()=>0),quiet:0,moved:0,knocks:0,thrown:0,slow:0,slowT:0,ref:w.balls.map(b=>[b.x,b.y]),refd:w.doms.map(()=>0)};
  this.attempts++;this.wasNear=this.marker?.near?1:0;this.marker=null;this.phase='run';this.phaseT=0;this.runT=0;this.events.push({type:'go',attempt:this.attempts});return true;}
 // The room's toys plus the placed pieces, as the simulation sees them.
 world(){const key=this.level+':'+JSON.stringify(this.placed);if(this._world?.key===key)return this._world;const w=this.worldWith(this.placed);w.key=key;return this._world=w;}
 worldWith(placed){const lv=this.lv,bn=lv.bin,w={boxes:solids(lv),doors:lv.doors,switches:lv.switches.map(q=>({...q,zone:switchZone(q)})),doms:lv.doms.map(d=>({...d})),
   balls:[{x:lv.bone.x,y:lv.bone.y,r:DOMINO.boneR,m:1.5,e:.25,bone:true},...lv.balls.map(b=>({x:b.x,y:b.y,r:DOMINO.ballR,m:1,e:.35,bone:false}))],planks:lv.planks.slice(),springs:lv.springs.slice(),
   fans:lv.fans.map(f=>({...f,zone:fanZone(f)})),gloves:lv.gloves.map(q=>({...q,box:gloveBox(q)})),saws:lv.saws,bin:bn,pieces:[]};
  for(const p of placed){const q=resolve(lv,p.i,p.gx,p.gy,placed);if(!q)continue;w.pieces.push(q);if(q.type==='domino')w.doms.push({x:q.x,y:q.y,start:0,placed:true});else if(q.type==='ball')w.balls.push({x:q.x,y:q.y,r:DOMINO.ballR,m:1,e:.35,bone:false,placed:true});else if(q.type==='plank')w.planks.push({x1:q.x1,y1:q.y1,x2:q.x2,y2:q.y2,placed:true});else if(q.type==='spring')w.springs.push({x:q.x,y:q.y,dir:q.dir,placed:true});else if(q.type==='glove')w.gloves.push({x:q.x,y:q.y,dir:q.dir,placed:true,box:gloveBox(q)});else w.fans.push({x:q.x,y:q.y,dir:q.dir,placed:true,zone:fanZone(q)});}
  return w;}
 // The chain slows right down for the bone's last approach to the bin (for a little while).
 tick(dt){if(this.status!=='playing')return;this.acc+=dt*(this.phase==='run'&&this.sim?.slow?DOMINO.slow:1);while(this.acc>=H&&this.status==='playing'){this.acc-=H;this.step();}}
 step(){this.time+=H;
  if(this.phase==='place'){for(const d of DIRS)if(this.input[d]){this.holdT[d]=(this.holdT[d]||0)+H;if(this.holdT[d]>=.28){this.holdT[d]-=.09;this.nudge(d);}}
   if(this.actT>=0){this.actT+=H;if(this.actT>=DOMINO.hold){this.actT=-1;this.go();}}return;}
  if(this.phase==='run'){this.runT+=H;this.physics();return;}
  this.phaseT+=H;
  // After a win the toys keep moving so the bone settles into the bin instead of freezing.
  if(this.phase==='won'){this.physics(true);if(this.phaseT>=DOMINO.won)this.advance();}
  else if(this.phase==='failed'&&this.phaseT>=DOMINO.failed){this.phase='place';this.phaseT=0;this.sim=null;}}
 // One 1/120 s step of the chain.
 physics(after=false){const s=this.sim,w=this.world(),lv=this.lv,g=DOMINO.g,emit=e=>this.events.push(e);s.t+=H;
  // Switches: pressed by a ball on the button or a domino falling across it. Trapdoors of the same
  // number drop, fans of that number start, gloves of that number punch.
  w.switches.forEach((q,k)=>{if(s.sw[k])return;if(s.balls.some(b=>circleRect(b,q.zone))||s.doms.some(d=>{if(!d.s)return false;const t=domTip(d);return inRect(t.x,t.y,q.zone,.12);})){s.sw[k]=1;emit({type:'switch',x:q.x,y:q.y,k});for(const d of w.doors)if(d.sw===k)emit({type:'door',x:d.x+d.w/2,y:d.y+.15,k});w.gloves.forEach((q2,j)=>{if(q2.sw===k&&!s.gloves[j].f)s.gloves[j].trig=1;});}});
  // Gloves: anything landing on the body, or a domino falling against its back, fires the punch.
  w.gloves.forEach((q,k)=>{const st=s.gloves[k];if(st.f){st.f=Math.min(9,st.f+H);return;}if(!st.trig&&!s.doms.some(d=>{if(!d.s)return false;const t=domTip(d);return inRect(t.x,t.y,q.box,.14);}))return;
   st.f=H;st.trig=0;const face=q.x+q.dir*.4,zone={x:q.dir>0?face:face-1.15,y:q.y-.05,w:1.15,h:1.1};let hit=0;
   for(const b of s.balls)if(inRect(b.x,b.y,zone,b.r*.3)){b.vx=q.dir*DOMINO.punch/Math.sqrt(b.m);b.vy=Math.max(b.vy,2.2);hit++;}
   for(const d of s.doms)if(d.s!==2&&Math.abs(d.y-q.y)<.05&&(d.x-face)*q.dir>-.05&&(d.x-face)*q.dir<1){d.av=q.dir*DOMINO.kick*1.7;hit++;}
   emit({type:'glove',x:face,y:q.y+.45,dir:q.dir,hit});});
  for(const b of s.balls)stepBall(b,w,s,lv,emit);
  for(let i=0;i<s.balls.length;i++)for(let j=i+1;j<s.balls.length;j++){const a=s.balls[i],b=s.balls[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1e-9,pen=a.r+b.r-d;if(pen<=0)continue;const nx=dx/d,ny=dy/d,ma=a.m/(a.m+b.m);a.x-=nx*pen*(1-ma);a.y-=ny*pen*(1-ma);b.x+=nx*pen*ma;b.y+=ny*pen*ma;
   const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(vn<0){const j2=-(1+.5)*vn/(1/a.m+1/b.m);a.vx-=j2*nx/a.m;a.vy-=j2*ny/a.m;b.vx+=j2*nx/b.m;b.vy+=j2*ny/b.m;if(-vn>1.5)emit({type:'hit',x:a.x+nx*a.r,y:a.y+ny*a.r,v:-vn});}}
  // See-saws: turned by what lands on them, stopped by their end stops.
  w.saws.forEach((sw,k)=>{const S=s.saws[k];S.av*=1-1.2*H;S.a+=S.av*H;if(Math.abs(S.a)>=LIM){if(Math.abs(S.av)>1.2){s.thrown=1;emit({type:'clack',x:sw.x+Math.sign(S.a)*-1.4,y:sw.y-.5,v:Math.abs(S.av)});}S.a=Math.sign(S.a)*LIM;S.av=0;}if(Math.abs(S.av)<.01)S.av=0;});
  // Dominoes: gravity about the base edge, fans, then they lean on each other and knock balls.
  const I=1.4*DOMINO.domH*DOMINO.domH/3,blocked=(x,y)=>w.boxes.some(bx=>inRect(x,y,bx))||w.gloves.some(q=>inRect(x,y,q.box))||w.doors.some(d=>!s.sw[d.sw]&&x>d.x&&x<d.x+d.w&&y>d.y&&y<d.y+.3);
  s.doms.forEach(d=>{if(d.s===2)return;for(const f of w.fans)if((f.sw===undefined||s.sw[f.sw])&&inRect(d.x,d.y+.6,f.zone))d.av+=f.dir*DOMINO.fanTorque*H;
   const a=d.a;if(a!==0||d.av!==0){const sg=a>0?1:a<0?-1:(d.av>0?1:-1);d.av+=(3*g/(2*DOMINO.domH))*Math.sin(a-sg*TIP)*H;d.av*=1-(Math.abs(a)<TIP?3:.4)*H;}d.pa=a;d.a+=d.av*H;
   if(Math.abs(d.a)<.004&&Math.abs(d.av)<.02){d.a=0;d.av=0;}if(Math.abs(d.a)>TIP&&d.s===0){d.s=1;emit({type:'knock',x:d.x,y:d.y+DOMINO.domH*.6,dir:d.a>0?1:-1,n:s.knocks++});}
   if(Math.abs(d.a)>=Math.PI/2){d.a=Math.sign(d.a)*Math.PI/2;d.av=0;d.s=2;emit({type:'flat',x:d.x,y:d.y,dir:d.a>0?1:-1});}
   // The tip ran into something solid: stop and lean on it.
   const t=domTip(d);if(d.s!==2&&blocked(t.x,t.y)){let lo=d.pa,hi=d.a;for(let q=0;q<10;q++){const mid=(lo+hi)/2,tt=domTip(d,mid);if(blocked(tt.x,tt.y))hi=mid;else lo=mid;}d.a=lo;d.av=0;d.s=2;}});
  for(let pass=0;pass<2;pass++)for(let i=0;i<s.doms.length;i++)for(let j=i+1;j<s.doms.length;j++){const A=s.doms[i],B=s.doms[j];if(A.s===2&&B.s===2||Math.abs(A.y-B.y)>.05||Math.abs(A.x-B.x)>DOMINO.domH+DOMINO.domW)continue;
   const r=segSeg({x:A.x,y:A.y},domTip(A),{x:B.x,y:B.y},domTip(B));const pen=DOMINO.domW-r.d;if(pen<=0)continue;const sg=B.x>A.x?1:-1,dA=r.s*DOMINO.domH,dB=r.t*DOMINO.domH;
   // Relative speed of the touching points along the line between the bases; stop them crossing.
   const tA=Math.cos(A.a)*sg,tB=Math.cos(B.a)*sg,vA=A.av*dA*tA,vB=B.av*dB*tB,vrel=vA-vB;
   if(vrel>0){const j2=vrel/((dA*tA)*(dA*tA)/I+(dB*tB)*(dB*tB)/I+1e-9);if(A.s!==2)A.av-=j2*dA*tA/I;if(B.s!==2){B.av+=j2*dB*tB/I;if(B.s===0&&Math.abs(B.av)>.4&&!B.hit){B.hit=1;emit({type:'tap',x:B.x,y:B.y+DOMINO.domH*.7});}}}
   const share=A.s===2?0:B.s===2?1:.5;if(dA>.05&&A.s!==2)A.a-=sg*pen*share/dA;if(dB>.05&&B.s!==2)B.a+=sg*pen*(1-share)/dB;}
  for(const b of s.balls)for(const d of s.doms){if(d.s===2)continue;const t=domTip(d),c=segClosest(b.x,b.y,d.x,d.y,t.x,t.y),dist=Math.hypot(b.x-c.x,b.y-c.y),pen=b.r+DOMINO.domW/2-dist;if(pen<=0)continue;
   const nx=(b.x-c.x)/(dist||1e-9),ny=(b.y-c.y)/(dist||1e-9),dd=c.t*DOMINO.domH,tx=Math.cos(d.a),ty=-Math.sin(d.a),tn=tx*nx+ty*ny,vrel=(b.vx-d.av*dd*tx)*nx+(b.vy-d.av*dd*ty)*ny;b.x+=nx*pen;b.y+=ny*pen;
   if(vrel<0){const j2=-(1+.3)*vrel/(1/b.m+(dd*tn)*(dd*tn)/I);b.vx+=j2*nx/b.m;b.vy+=j2*ny/b.m;d.av-=j2*dd*tn/I;if(-vrel>1.2)emit({type:'hit',x:c.x,y:c.y,v:-vrel});}}
  if(after)return;
  const bone=s.balls[0],bn=lv.bin,sp=Math.hypot(bone.vx,bone.vy);if(!s.moved&&sp>.5){s.moved=1;emit({type:'bone',x:bone.x,y:bone.y});}
  if(bone.x>bn.x+bone.r*.4&&bone.x<bn.x+bn.w-bone.r*.4&&bone.y>bn.y&&bone.y<bn.y+bn.h)return this.win();
  // Slow motion while the bone closes on the bin.
  const near=s.moved&&sp>1.2&&Math.hypot(bone.x-(bn.x+bn.w/2),bone.y-(bn.y+bn.h/2))<3&&s.slowT<DOMINO.slowMax;if(near&&!s.slow)emit({type:'slow',x:bone.x,y:bone.y});s.slow=near?1:0;if(near)s.slowT+=H/DOMINO.slow;
  // Quiet: nothing has really moved for a while (checked on positions, so a ball a fan pins to a wall counts as still).
  if(Math.round(s.t*DOMINO.fps)%30===0){const still=s.balls.every((b,k)=>Math.hypot(b.x-s.ref[k][0],b.y-s.ref[k][1])<.02)&&s.doms.every((d,k)=>d.s===2||Math.abs(d.a-s.refd[k])<.01)&&s.saws.every(S=>Math.abs(S.av)<.05);s.quiet=still?s.quiet+.25:0;s.ref=s.balls.map(b=>[b.x,b.y]);s.refd=s.doms.map(d=>d.a);}
  if(s.t>=DOMINO.maxRun||s.t>.5&&s.quiet>=DOMINO.settle)this.fail(s.t>=DOMINO.maxRun?'Time ran out.':!s.moved?'The chain stopped short.':this.missedBy(bone),bone);}
 // How far the bone finished from the bin's mouth.
 missDist(bone){const bn=this.lv.bin,dx=bone.x<bn.x?bn.x-bone.x:bone.x>bn.x+bn.w?bone.x-(bn.x+bn.w):0,dy=bone.y<bn.y?bn.y-bone.y:bone.y>bn.y+bn.h?bone.y-(bn.y+bn.h):0;return Math.hypot(dx,dy);}
 missedBy(bone){const d=this.missDist(bone);return d<.6?'So close: on the rim.':`Bone missed by ${d.toFixed(1)} m.`;}
 win(){const s=this.sim,lv=this.lv,par=this.placed.length<=lv.par,first=this.attempts===1,stars=1+(par?1:0)+(first?1:0),pts=400+300*stars+Math.max(0,300-Math.round(s.t*20)),code=encodeCode(this.level,this.placed);
  const gain=Math.max(0,pts-this.pts[this.level]);this.pts[this.level]+=gain;this.score+=gain;this.stars[this.level]=Math.max(this.stars[this.level],stars);this.best[this.level]=Math.max(this.best[this.level],stars);this.codes.push(code);if(this.codes.length>LEVELS.length*2)this.codes.shift();s.slow=0;
  if(this.level+1>this.unlocked&&this.level+1<=LEVELS.length){this.unlocked=this.level+1;}
  if(!this.fastest||s.t<this.fastest)this.fastest=Math.round(s.t*100)/100;
  // What stood between this clear and three stars, and how far the next shop is.
  const left=LEVELS.findIndex((l,i)=>i>this.level&&l.world!==lv.world),more=left-this.level-1,tease=this._daily?'':!par?`Three stars needs ${lv.par} piece${lv.par===1?'':'s'} or fewer`:!first?'Three stars needs it first try':left>=0&&more>0?`${more} more room${more===1?'':'s'} to ${WORLDS[LEVELS[left].world].name}`:left>=0?`Next: ${WORLDS[LEVELS[left].world].name}`:'';
  const e={type:'win',points:gain,stars,par,first,pieces:this.placed.length,parPieces:lv.par,attempts:this.attempts,code,time:s.t,name:lv.name,level:this.level,tease};this.phase='won';this.phaseT=0;this.lastWin=e;this.events.push(e);
  for(const f of FEATS)if(!this.feats.includes(f.id)&&f.test(this,e)){this.feats.push(f.id);this.events.push({type:'feat',id:f.id,name:f.name,text:f.text});}}
 fail(why,bone){const d=this.missDist(bone),near=!!this.sim.moved&&d<1.6;this.sim.slow=0;this.marker={x:Math.round(bone.x*100)/100,y:Math.round(bone.y*100)/100,near:near?1:0};this.phase='failed';this.phaseT=0;this.events.push({type:'fail',why,near,x:bone.x,y:bone.y,attempts:this.attempts});}
 lastCode(){return this.codes[this.codes.length-1]||'';}
}

const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b,fin=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
export function validProgress(p){return !!p&&typeof p==='object'&&int(p.furthest,0,LEVELS.length)&&Array.isArray(p.stars)&&p.stars.length<=LEVELS.length&&p.stars.every(s=>int(s,0,3));}
export const DOMINO_FIELDS=['daily','rev','feats','fastest','wasNear','level','unlocked','best','stars','pts','phase','phaseT','placed','cursor','attempts','sim','codes','runT','input','holdT','actT','marker'];
// Saves from before the pegboard rooms (no `rev`) are refused: the rooms they describe are gone.
export function validDominoSnapshot(s){const N=LEVELS.length;if(s.rev!==2||typeof s.daily!=='boolean'||!Array.isArray(s.feats)||new Set(s.feats).size!==s.feats.length||!s.feats.every(f=>FEAT_IDS.includes(f))||!fin(s.fastest,0,DOMINO.maxRun)||!int(s.wasNear,0,1)||!int(s.level,0,N-1)||!int(s.unlocked,s.level,N)||!int(s.attempts,0,1e5)||!['place','run','won','failed'].includes(s.phase)||!fin(s.phaseT,0,10)||!fin(s.runT,0,DOMINO.maxRun+1))return false;
 for(const [k,lo,hi] of [['best',0,3],['stars',-1,3],['pts',0,1600]])if(!Array.isArray(s[k])||s[k].length!==N||!s[k].every(v=>int(v,lo,hi)))return false;
 if(s.score!==s.pts.reduce((a,b)=>a+b,0)||s.pts.some((p,i)=>(p>0)!==(s.stars[i]>0))||s.stars.some((v,i)=>v>s.best[i]))return false;
 const lv=s.daily&&DAILY_TWIST(s.worldSeed||0).mirror?mirrored(s.level):LEVELS[s.level],c=cells(lv);if(!s.cursor||!int(s.cursor.gx,0,c.gx)||!int(s.cursor.gy,0,c.gy)||!validPlacements(lv,s.placed))return false;
 if(!Array.isArray(s.codes)||s.codes.length>N*2||!s.codes.every(x=>typeof x==='string'&&x.length<24))return false;
 if(s.marker!==null&&!(s.marker&&fin(s.marker.x,0,lv.W)&&fin(s.marker.y,0,lv.H)&&int(s.marker.near,0,1)))return false;
 if(!s.input||!DIRS.every(d=>typeof s.input[d]==='boolean')||typeof s.input.act!=='boolean'||!fin(s.actT,-1,10)||!s.holdT||typeof s.holdT!=='object')return false;
 if(s.phase==='place')return s.sim===null;if(s.phase!=='failed'&&s.attempts<1)return false;if(!s.sim||typeof s.sim!=='object')return false;
 const count=t=>s.placed.filter(p=>P[lv.palette[p.i]].type===t).length,sim=s.sim,arr=(a,n,ok)=>Array.isArray(a)&&a.length===n&&a.every(ok),nb=1+lv.balls.length+count('ball');
 return fin(sim.t,0,DOMINO.maxRun+DOMINO.won+1)&&fin(sim.quiet,0,10)&&int(sim.moved,0,1)&&int(sim.slow,0,1)&&fin(sim.slowT,0,10)&&int(sim.knocks,0,999)&&int(sim.thrown,0,1)
  &&arr(sim.balls,nb,b=>b&&fin(b.x,0,lv.W)&&fin(b.y,0,lv.H)&&fin(b.vx,-80,80)&&fin(b.vy,-80,80)&&fin(b.r,.1,1)&&fin(b.m,.1,10)&&fin(b.e,0,1)&&typeof b.bone==='boolean')&&sim.balls[0].bone===true&&sim.balls.slice(1).every(b=>!b.bone)
  &&arr(sim.ref,nb,r=>Array.isArray(r)&&r.length===2&&fin(r[0],0,lv.W)&&fin(r[1],0,lv.H))&&arr(sim.refd,lv.doms.length+count('domino'),a=>fin(a,-2,2))
  &&arr(sim.doms,lv.doms.length+count('domino'),d=>d&&fin(d.x,0,lv.W)&&fin(d.y,0,lv.H)&&fin(d.a,-Math.PI/2,Math.PI/2)&&fin(d.av,-80,80)&&int(d.s,0,2)&&int(d.hit,0,1)&&(d.pa===undefined||fin(d.pa,-2,2)))
  &&arr(sim.springs,lv.springs.length+count('spring'),x=>x&&int(x.cool,0,1))&&arr(sim.gloves,lv.gloves.length+count('glove'),x=>x&&fin(x.f,0,9)&&int(x.trig,0,1))
  &&arr(sim.saws,lv.saws.length,x=>x&&fin(x.a,-LIM,LIM)&&fin(x.av,-80,80))&&arr(sim.sw,lv.switches.length,x=>int(x,0,1))&&placedMatch(lv,s.placed,sim);}
// The simulation's placed dominoes must stand where the placements say they do.
function placedMatch(lv,placed,sim){let d=lv.doms.length;for(const p of placed){const q=resolve(lv,p.i,p.gx,p.gy,placed);if(!q)return false;if(q.type==='domino'){const x=sim.doms[d++];if(!x||Math.abs(x.x-q.x)>1e-9||Math.abs(x.y-q.y)>1e-9)return false;}}return true;}
