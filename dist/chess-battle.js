// DAWG Chess fight choreography. Every routine named in chess-fights.js lives here: how each
// piece attacks (two variants each), how each defends, how each falls (and the twist each kind of
// damage adds), each victory pose, and the special scenes (en passant, promotion, castling, check
// and the checkmate finisher). The pieces themselves are the actors: they lean, squash, leap and
// spin as rigid bodies, with enchanted weapons floating at their side. `S` is the stage crew
// (ThreeChess): tweens on fight time, camera shots, hits, rings, trails, beams, sigils, debris.
// A routine is an async function of the duel `X` = {S, A (attacker), D (defender), P (the
// defender's square), start (where the attacker stands), dir (attacker → defender), side, ...}.
import {T,texture,merge} from './three-kit.js';
import {NAMES} from './chess-fights.js';

const GOLD=0xffd36b,RED=0xff2448,PI=Math.PI;
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),up=(p,y)=>p.clone().setY(y),mix=(a,b,k)=>a.clone().lerp(b,k),along=(p,d,k)=>p.clone().addScaledVector(d,k);
const ease=k=>k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2,easeOut=k=>1-Math.pow(1-k,3),easeIn=k=>k*k*k,back=k=>1+2.7*Math.pow(k-1,3)+1.7*Math.pow(k-1,2);
const squash=(g,s)=>g.scale.set(1+(1-s)*.55,s,1+(1-s)*.55),yawOf=d=>Math.atan2(d.x,d.z),sqPos=(s,y=0)=>V((s&7)-3.5,y,(s>>3)-3.5);
const world=o=>o.getWorldPosition(V());
const hdr=(c,k=2)=>new T.Color(c).multiplyScalar(k);

// ── Props ────────────────────────────────────────────────────────────────────────────────────
const metal=(S,c=0xdde4ff)=>S.own(new T.MeshStandardMaterial({color:c,metalness:1,roughness:.2,emissive:c,emissiveIntensity:.12}));
const lit=(S,c,k=2.4)=>S.own(new T.MeshBasicMaterial({color:hdr(c,k),toneMapped:false}));
// All weapons point along +z (the way their owner faces) unless turned.
function spear(S,c){const g=new T.Group();g.add(new T.Mesh(S.own(new T.CylinderGeometry(.02,.02,1.05,8).rotateX(PI/2)),metal(S,0x8a6a48)),new T.Mesh(S.own(new T.ConeGeometry(.06,.26,10).rotateX(PI/2).translate(0,0,.64)),lit(S,c)));return g;}
function shield(S,c){const g=new T.Group();g.add(new T.Mesh(S.own(new T.CylinderGeometry(.24,.24,.04,24).rotateX(PI/2)),metal(S,0xcfd6f0)),new T.Mesh(S.own(new T.TorusGeometry(.24,.025,8,28)),lit(S,c,1.8)),new T.Mesh(S.own(new T.SphereGeometry(.07,12,8).translate(0,0,.03)),lit(S,c)));return g;}
function lance(S,c){const g=new T.Group();g.add(new T.Mesh(S.own(new T.ConeGeometry(.075,1.7,14).rotateX(PI/2).translate(0,0,.6)),metal(S)),new T.Mesh(S.own(new T.CylinderGeometry(.15,.11,.08,16).rotateX(PI/2).translate(0,0,-.2)),lit(S,c,1.8)),new T.Mesh(S.own(new T.ConeGeometry(.03,.3,8).rotateX(PI/2).translate(0,0,1.45)),lit(S,c)));return g;}
// A blade pointing up from its hilt.
function blade(S,c,len=.8,w=.06){const g=new T.Group(),b=new T.ConeGeometry(w,len,4).translate(0,len/2+.08,0);b.scale(1,1,.3);g.add(new T.Mesh(S.own(b),lit(S,c,2.6)),new T.Mesh(S.own(new T.BoxGeometry(w*3.4,.035,.05).translate(0,.07,0)),metal(S,GOLD)),new T.Mesh(S.own(new T.CylinderGeometry(.02,.02,.14,8)),metal(S,0x4a3a5a)));return g;}
function barrel(S,c){const g=new T.Group();g.add(new T.Mesh(S.own(new T.CylinderGeometry(.11,.14,.7,18,1,true).rotateX(PI/2).translate(0,0,.35)),S.own(new T.MeshStandardMaterial({color:0x2a2c3a,metalness:.9,roughness:.3,side:T.DoubleSide}))),new T.Mesh(S.own(new T.TorusGeometry(.125,.025,8,20).translate(0,0,.68)),lit(S,c,1.8)),new T.Mesh(S.own(new T.TorusGeometry(.15,.02,8,20).translate(0,0,.12)),metal(S,GOLD)));return g;}
function horseshoe(S,c){return new T.Mesh(S.own(new T.TorusGeometry(.13,.035,8,18,PI*1.35).rotateZ(-PI*.175)),lit(S,c,2.6));}
function crown(S,k=1){const parts=[new T.CylinderGeometry(.15,.13,.1,20,1,true)];for(let i=0;i<8;i++){const a=i/8*PI*2;parts.push(new T.ConeGeometry(.032,.1,6).translate(Math.sin(a)*.14,.09,Math.cos(a)*.14));}const m=new T.Mesh(S.own(merge(parts)),S.own(new T.MeshStandardMaterial({color:GOLD,metalness:1,roughness:.18,emissive:GOLD,emissiveIntensity:.55,side:T.DoubleSide})));m.scale.setScalar(k);return m;}
function slab(S,c){return new T.Mesh(S.geo.box,S.own(new T.MeshStandardMaterial({color:c==='w'?0xd8d0ec:0x2a2638,roughness:.5,metalness:.3,emissive:S.teamColor(c),emissiveIntensity:.25})));}
function crack(S,p,r=1.3){S.crackTex=S.crackTex||texture(256,256,(c,w)=>{c.clearRect(0,0,w,w);c.translate(w/2,w/2);c.strokeStyle='#05030a';c.lineCap='round';for(let i=0;i<9;i++){let a=i/9*PI*2+Math.random()*.4,x=0,y=0;c.lineWidth=5;c.beginPath();c.moveTo(0,0);for(let j=0;j<5;j++){a+=(Math.random()-.5)*.9;x+=Math.cos(a)*22;y+=Math.sin(a)*22;c.lineTo(x,y);}c.stroke();}c.fillStyle='#05030a';c.beginPath();c.arc(0,0,12,0,PI*2);c.fill();});
 const m=S.add(new T.Mesh(S.own(new T.PlaneGeometry(2,2).rotateX(-PI/2)),S.own(new T.MeshBasicMaterial({map:S.crackTex,transparent:true,opacity:.85,depthWrite:false}))));m.position.set(p.x,.012,p.z);m.scale.setScalar(r);m.rotation.y=Math.random()*6;return m;}

/** Hands each fighter its weapons for the scene. */
export function gearUp(X){const {S,A}=X,g=A.g,c=A.col,G=A.gear;
 if(A.t==='p'){G.spear=S.attach(g,spear(S,c));G.spear.position.set(-.3,.4,.1);G.shield=S.attach(g,shield(S,c));G.shield.position.set(.3,.4,.2);}
 if(A.t==='n'){G.lance=S.attach(g,lance(S,c));G.lance.position.set(-.32,.72,.1);G.lance.visible=false;}
 if(A.t==='r'){G.barrel=S.attach(g,barrel(S,c));G.barrel.position.set(0,.5,.16);G.barrel.scale.set(1,1,.01);G.barrel.visible=false;}
 if(A.t==='q'){G.blades=[-1,1].map(s=>{const b=S.attach(g,blade(S,c,.75));b.position.set(s*.42,.45,.05);b.rotation.z=-s*.25;return b;});}
 if(A.t==='k'){G.sword=S.attach(g,blade(S,c,1.25,.09));G.sword.position.set(-.48,.25,.1);}}
const orbOf=F=>F.g.localToWorld(V(.24,1.04,.05));
const recoil=(X,amt)=>{X.D.g.position.copy(X.P).addScaledVector(X.dir,amt);X.D.g.rotation.x=-Math.min(.35,amt*1.6);};
// A piece taken by the king kneels before the blow.
async function kneel(X){const {S,D}=X,g=D.g;S.breakGuard(D);await S.tween(.3,k=>{const e=easeOut(k);g.rotation.x=.42*e;squash(g,1-.2*e);g.position.y=0;});}
// The royal guard: two golden phantoms flank the defender with crossed halberds of light.
function guards(X){const {S,P,side}=X,out=[];for(const s of [-1,1]){const p=along(P,side,s*.8),body=S.models.p.body,m=S.add(new T.Mesh(body,S.glowMat(GOLD,1.3,0)));m.position.copy(p);m.rotation.y=yawOf(side)*1+(s>0?PI:0);m.scale.setScalar(1.25);out.push(m);S.ring(p,GOLD,{r1:.9,dur:.35});S.streak(up(p,1.5),up(along(P,side,-s*.5),.5),GOLD,{w:.035,dur:.9});}
 S.tween(.2,k=>{for(const m of out)m.material.opacity=.75*k;});return {off:()=>S.tween(.3,k=>{for(const m of out)m.material.opacity=.75*(1-k);}).then(()=>out.forEach(m=>S.drop(m)))};}

// ── How each piece attacks ───────────────────────────────────────────────────────────────────
export const ATTACK={
 // Pawn: scurries in, two quick jabs, then winds right back for the thrust.
 async 'spear-combo'(X){const {S,A,D,P,start,stop,dir,ac}=X,g=A.g,sp=A.gear.spear,tip=up(along(P,dir,-.25),.5);
  S.cam({at:()=>up(mix(g.position,P,.5),.5),yaw:1.25,pitch:.16,w:3.6,h:2.4,dur:.3});S.sfx('scurry');
  await S.tween(.42,k=>{g.position.lerpVectors(start,stop,ease(k));g.position.y=Math.abs(Math.sin(k*PI*3))*.16;g.rotation.x=.14;});S.dust(stop,6);
  for(let i=0;i<2;i++){await S.tween(.1,k=>{g.rotation.x=-.25*k;sp.position.z=.1-.25*k;});
   await S.tween(.06,k=>{g.rotation.x=-.25+.6*k;sp.position.z=-.15+.7*k;g.position.copy(stop).addScaledVector(dir,.16*k);});
   S.hit(tip,.3,ac);S.sfx('clang');S.streak(up(stop,.45),tip,ac,{w:.05,dur:.15});recoil(X,.07*(i+1));
   await S.tween(.1,k=>{g.rotation.x=.35*(1-k);sp.position.z=.55-.45*k;g.position.copy(stop).addScaledVector(dir,.16*(1-k));});}
  S.cam({at:up(mix(stop,P,.5),.5),yaw:.95,pitch:.1,w:2.7,h:1.9,dur:.3,dolly:-.2});S.sfx('charge');
  await S.tween(.34,k=>{const e=easeOut(k);g.rotation.x=-.5*e;g.position.copy(stop).addScaledVector(dir,-.32*e);sp.position.z=.1-.5*e;squash(g,1-.14*e);});
  S.cam({at:up(P,.55),yaw:1.9,pitch:.12,w:3.2,h:2.1,dur:.1});S.sfx('whoosh');S.streak(up(g.position,.45),up(along(P,dir,.5),.5),ac,{w:.09,dur:.3});
  await S.tween(.07,k=>{g.rotation.x=-.5+1*k;g.position.copy(stop).addScaledVector(dir,-.32+.7*k);sp.position.z=-.4+1.15*k;squash(g,.86+.2*k);});
  S.finalHit(X,1);await S.tween(.2,k=>{g.rotation.x=.5*(1-k);sp.position.z=.75-.65*k;squash(g,1);});},
 // Pawn: shield up, a dash that staggers the defender, then a leap and the spear comes down.
 async 'shield-bash'(X){const {S,A,D,P,start,dir,ac}=X,g=A.g,sh=A.gear.shield,sp=A.gear.spear;
  S.cam({at:()=>up(mix(g.position,P,.5),.5),yaw:1.35,pitch:.14,w:3.8,h:2.5,dur:.3});
  await S.tween(.28,k=>{const e=easeOut(k);sh.position.set(.3-.3*e,.4,.2+.2*e);squash(g,1-.2*e);g.rotation.x=.2*e;g.position.copy(start).addScaledVector(dir,-.16*e);});S.sfx('charge');
  S.cam({at:up(P,.55),yaw:.5,pitch:.22,w:3.2,h:2.4,dur:.2});const s0=g.position.clone(),s1=along(P,dir,-.6);
  await S.tween(.2,k=>{g.position.lerpVectors(s0,s1,easeIn(k));squash(g,.9);g.rotation.x=.3;if(Math.random()<.6)S.dust(g.position,2);});
  S.hit(up(along(P,dir,-.3),.45),.6,ac);S.sfx('clang');S.ring(P,ac,{r1:1.4,dur:.3});
  await S.tween(.22,k=>{const e=easeOut(k);D.g.position.copy(P).addScaledVector(dir,.36*e);D.g.rotation.x=-.4*Math.sin(k*PI);D.g.rotation.z=Math.sin(k*9)*.14*(1-k);g.position.copy(s1).addScaledVector(dir,-.14*e);squash(g,1);g.rotation.x=0;});
  S.cam({at:()=>up(g.position,g.position.y*.6+.6),yaw:1.75,pitch:-.03,w:3.4,h:3.3,dur:.18});S.sfx('whoosh');const j0=g.position.clone(),j1=along(P,dir,-.25),y0=g.rotation.y;
  await S.tween(.28,k=>{const e=easeOut(k);g.position.lerpVectors(j0,j1,k*.7);g.position.y=1.5*e;g.rotation.y=y0+PI*2*e;sp.rotation.x=1.3*e;sp.position.set(-.3+.3*e,.4,.1+.2*e);});S.slow(.14,.3);
  const top=g.position.clone();S.streak(up(top,1.6),up(D.g.position,.3),ac,{w:.08,dur:.3});
  await S.tween(.08,k=>{g.position.lerpVectors(top,j1,k);g.position.y=1.5*(1-k)+.25*k;g.rotation.x=.5*k;});
  X.P.copy(up(D.g.position,0));S.finalHit(X,1.1);S.dust(X.P,12);await S.tween(.2,k=>{g.position.y=.25*(1-k);g.rotation.x=.5*(1-k);});},
 // Knight: paws the ground, gallops, somersaults clean over the defender and kicks back with both hind hooves.
 async 'leap-kick'(X){const {S,A,D,P,start,dir,ac}=X,g=A.g;
  S.cam({at:up(start,.6),yaw:.9,pitch:.1,w:2.7,h:2.3,dur:.3,dolly:-.12});
  for(let i=0;i<2;i++){await S.tween(.13,k=>{g.rotation.x=.25*Math.sin(k*PI);g.position.y=.08*Math.sin(k*PI);});S.dust(along(start,dir,.2),4);S.sfx('thud');}
  await S.tween(.2,k=>{g.rotation.x=-.5*easeOut(k);g.position.y=.12*easeOut(k);});S.sfx('gallop');
  S.cam({at:()=>up(mix(g.position,P,.35),.5+g.position.y*.55),yaw:1.5,pitch:.06,w:4.8,h:3.6,dur:.22});const run=along(start,dir,.35),land=along(P,dir,.95);
  await S.tween(.2,k=>{g.position.lerpVectors(start,run,k);g.position.y=Math.abs(Math.sin(k*PI*2))*.14;g.rotation.x=-.5+.75*k;});let slowed=false;
  await S.tween(.5,k=>{g.position.lerpVectors(run,land,k);g.position.y=Math.sin(k*PI)*1.8;g.rotation.x=.25+k*PI*2;D.g.rotation.x=-.45*Math.sin(k*PI);if(!slowed&&k>.36){slowed=true;S.slow(.22,.3);S.sfx('whoosh');}if(Math.random()<.5)S.puff(up(g.position,g.position.y+.4),1,ac,{speed:.5,life:.4,gravity:0,up:0});});
  g.rotation.x=0;S.dust(land,14);S.ring(land,ac,{r1:1.3,dur:.3});S.sfx('thud');S.stage.shake(.25);
  await S.tween(.1,k=>{squash(g,1-.2*Math.sin(k*PI));});
  // The kick: pitch forward, hooves fly out behind.
  S.cam({at:up(mix(P,land,.4),.5),yaw:2.05,pitch:.1,w:3.2,h:2.2,dur:.12});const shoes=[-1,1].map(s=>{const h=S.add(horseshoe(S,ac));h.position.copy(up(along(land,X.side,s*.14),.4));h.rotation.y=yawOf(dir);return h;});
  await S.tween(.12,k=>{g.rotation.x=-.2*Math.sin(k*PI);});S.sfx('whoosh');
  await S.tween(.07,k=>{g.rotation.x=.95*k;g.position.y=.25*k;for(const [i,h] of shoes.entries()){h.position.lerpVectors(up(along(land,X.side,(i?1:-1)*.14),.4),up(along(P,dir,.3),.55),k);h.scale.setScalar(1+k*.8);}});
  X.hitDir=dir.clone().negate();S.finalHit(X,1.1);shoes.forEach(h=>S.drop(h));await S.tween(.22,k=>{g.rotation.x=.95*(1-k);g.position.y=.25*(1-k);});},
 // Knight: levels a lance and rides straight through; the blow lands a beat after it has passed.
 async 'lance-pass'(X){const {S,A,D,P,start,dir,side,ac}=X,g=A.g,ln=A.gear.lance,y0=g.rotation.y;ln.visible=true;
  S.cam({at:up(start,.65),yaw:2.45,pitch:.1,w:2.9,h:2.3,dur:.3});
  await S.tween(.3,k=>{const e=easeOut(k);ln.scale.setScalar(.2+.8*e);ln.rotation.x=-1.3*(1-e);g.rotation.x=-.3*Math.sin(k*PI);});S.sfx('charge');
  await S.tween(.2,k=>{g.position.copy(start).addScaledVector(dir,-.28*easeOut(k));g.rotation.x=-.22*k;});
  S.cam({at:up(P,.55),yaw:1.57,pitch:.09,w:5.4,h:3,dur:.14});S.sfx('gallop');const c0=g.position.clone(),c1=along(P,dir,1.2);let struck=false;
  await S.tween(.26,k=>{const e=easeIn(k)*.5+k*.5;g.position.lerpVectors(c0,c1,e).addScaledVector(side,-.36*Math.sin(e*PI));g.position.y=Math.abs(Math.sin(k*PI*3))*.1;g.rotation.x=.28;if(Math.random()<.7)S.dust(g.position,1);
   if(!struck&&e>.52){struck=true;S.hit(up(P,.6),.45,ac);S.sfx('clang');S.slow(.12,.35);D.g.rotation.y+=.5;}});
  S.streak(up(c0,.72),up(c1,.72),ac,{w:.13,dur:.6});
  S.cam({at:up(mix(P,c1,.45),.55),yaw:2.25,pitch:.13,w:3.6,h:2.5,dur:.2});
  await S.tween(.26,k=>{const e=easeOut(k);g.rotation.y=y0+PI*e;g.rotation.x=.28*(1-k);g.rotation.z=-.3*Math.sin(k*PI);g.position.copy(c1).addScaledVector(dir,.3*e);if(k<.7)S.dust(g.position,2);ln.rotation.x=-1.3*e;});
  S.slashArc(up(P,.6),{yaw:yawOf(dir),tilt:PI/2,r:.75,arc:3,color:0xffffff,dur:.3});S.sfx('tick');await S.wait(.18);S.finalHit(X,1);await S.wait(.1);},
 // Bishop: rises on a circle of runes, a sigil opens before the staff and a beam burns across the board.
 async 'sigil-beam'(X){const {S,A,D,P,start,dir,mid,ac}=X,g=A.g;
  S.cam({at:up(start,.8),yaw:.75,pitch:.12,w:2.9,h:2.7,dur:.35,dolly:-.1});const floor=S.sigil(up(start,.03),ac,.2);S.sfx('chime');
  await S.tween(.4,k=>{const e=easeOut(k);g.position.y=.3*e;floor.scale.setScalar(.2+.9*e);floor.rotation.y=k*3;if(Math.random()<.5)S.motes(up(start,.1),1,ac);});
  const o=orbOf(A),sg=S.sigil(along(o,dir,.3),ac,.1,{flat:false}),ball=S.glowBall(ac,.05);sg.rotation.y=yawOf(dir);ball.position.copy(along(o,dir,.25));S.sfx('charge');
  await S.tween(.4,k=>{sg.scale.setScalar(.1+.5*easeOut(k));sg.rotation.z=k*5;ball.scale.setScalar(.05+.17*k);floor.rotation.y+=.08;g.rotation.x=-.18*k;});
  S.cam({at:up(mid,.75),yaw:1.8,pitch:.1,w:4.4,h:2.9,dur:.1});const bm=S.beam(ac),src=ball.position.clone(),tgt=up(P,.6),ts=S.sigil(up(P,.04),ac,.95);S.sfx('zap');S.hit(tgt,.5,ac);
  await S.tween(.5,k=>{const r=(.06+.12*Math.min(1,k*5))*(1-.25*Math.sin(k*60));bm.set(src,tgt,r);sg.rotation.z+=.3;ts.rotation.y-=.2;D.g.position.copy(P).addScaledVector(dir,.3*k).addScaledVector(X.side,Math.sin(k*70)*.03);D.g.rotation.x=-.3*k;g.rotation.x=.12;S.stage.shake(.22);if(Math.random()<.6)S.sparks(tgt,3,ac);});
  S.finalHit(X,1);await S.tween(.16,k=>{bm.set(src,tgt,.18*(1-k));bm.opacity(1-k);for(const m of [sg,floor,ts])m.material.opacity=1-k;ball.scale.setScalar(.22*(1-k)+.001);g.position.y=.3*(1-k);g.rotation.x=.12*(1-k);});bm.off();[sg,floor,ts,ball].forEach(m=>S.drop(m));},
 // Bishop: lifts the defender in a column of light, lets it hang, and slams it into its square.
 async 'levitation-slam'(X){const {S,A,D,P,start,dir,ac}=X,g=A.g,d=D.g,near=along(start,dir,.3);
  S.cam({at:()=>up(mix(g.position,d.position,.55),.7+d.position.y*.5),yaw:1.35,pitch:.1,w:4.2,h:3.8,dur:.3});S.sfx('chime');
  const sg=S.sigil(up(P,.04),ac,.2),col=S.add(new T.Mesh(S.geo.tube,S.glowMat(ac,1.2,0)));col.position.copy(up(P,0));col.lookAt(up(P,5));col.scale.set(.55,.55,3);
  await S.tween(.35,k=>{const e=easeOut(k);g.position.lerpVectors(start,near,e);g.position.y=.2*e;g.rotation.x=-.25*e;sg.scale.setScalar(.2+.8*e);sg.rotation.y=k*3;col.material.opacity=.22*e;});S.sfx('charge');
  await S.tween(.55,k=>{const e=ease(k);d.position.y=1.7*e;d.rotation.y+=.05;d.rotation.z=Math.sin(k*14)*.12;d.rotation.x=Math.sin(k*9)*.1;sg.rotation.y+=.12;if(Math.random()<.6)S.motes(up(P,d.position.y*.5),1,ac);});S.slow(.2,.3);
  await S.tween(.16,k=>{g.rotation.x=-.25-.2*k;g.position.y=.2+.15*k;d.rotation.z=Math.sin(k*30)*.1;});
  S.cam({at:up(P,.5),yaw:1.75,pitch:.2,w:3.8,h:2.8,dur:.1});S.sfx('whoosh');S.streak(up(P,2.2),up(P,.2),ac,{w:.3,dur:.3});
  await S.tween(.08,k=>{g.rotation.x=-.45+1.05*k;d.position.y=1.7*(1-easeIn(k));});d.position.y=0;d.rotation.set(0,d.rotation.y,0);squash(d,.5);
  S.finalHit(X,1.2);crack(S,P,1.1);S.dust(P,20);S.debris(up(P,.1),6,0x8a7ab0,{speed:2.5,up:3,size:.07});
  await S.tween(.2,k=>{g.rotation.x=.6*(1-k);g.position.y=.35*(1-k);col.material.opacity=.22*(1-k);sg.material.opacity=1-k;squash(d,.5+.5*k);d.position.y=Math.sin(k*PI)*.35;});S.drop(col);S.drop(sg);},
 // Rook: grinds forward, runs out a cannon, lights the fuse and fires.
 async cannon(X){const {S,A,D,P,start,dir,mid,ac}=X,g=A.g,br=A.gear.barrel;br.visible=true;
  S.cam({at:up(start,.55),yaw:2.5,pitch:.1,w:2.9,h:2.3,dur:.3});S.sfx('crumble');const s1=along(start,dir,.2);
  await S.tween(.26,k=>{g.position.lerpVectors(start,s1,k);g.rotation.z=Math.sin(k*20)*.03;if(Math.random()<.5)S.dust(g.position,1);});
  await S.tween(.22,k=>{br.scale.z=.01+.99*back(k);g.rotation.x=-.1*k;});S.sfx('tick');
  const fuse=S.glowBall(0xffa040,.03);S.sfx('charge');
  await S.tween(.4,k=>{fuse.position.copy(g.localToWorld(V(0,.62,.2)));fuse.scale.setScalar(.03+.08*k*(1+.3*Math.sin(k*50)));squash(g,1-.1*k);if(Math.random()<.5)S.sparks(fuse.position,1,0xffa040);});S.drop(fuse);
  S.cam({at:up(mid,.6),yaw:1.5,pitch:.12,w:4.8,h:2.9,dur:.07});const muzzle=g.localToWorld(V(0,.5,.9)),ball=S.glowBall(ac,.13),tgt=up(P,.55);ball.position.copy(muzzle);
  S.hit(muzzle,.55,0xffc070);S.sfx('boom');S.puff(muzzle,26,0x9a94aa,{speed:2.2,life:1.1,gravity:.6,up:.5,spread:.6});S.streak(muzzle,tgt,ac,{w:.1,dur:.35});
  const r0=g.position.clone();S.tween(.3,k=>{const e=k<.25?k/.25:1-(k-.25)/.75;g.position.copy(r0).addScaledVector(dir,-.4*easeOut(Math.min(1,k*3)));g.rotation.x=-.1-.3*e;squash(g,1);br.scale.z=1-.25*e;});
  await S.tween(.09,k=>{ball.position.lerpVectors(muzzle,tgt,k);});S.drop(ball);
  S.finalHit(X,1.15);S.puff(tgt,30,0xffa040,{speed:6,life:.5,up:2});await S.tween(.3,k=>{g.rotation.x=-.1*(1-k);br.scale.z=1-k*.99;});},
 // Rook: two heavy hops, a crouch, then the whole keep goes up and comes down like a hammer.
 async 'ground-pound'(X){const {S,A,D,P,start,dir,ac}=X,g=A.g,h1=mix(start,P,.22),spot=along(P,dir,-.62);
  S.cam({at:()=>up(mix(g.position,P,.5),.5),yaw:1.3,pitch:.14,w:4,h:2.8,dur:.3});let a=start;
  for(const b of [h1,mix(start,P,.4)]){const p0=a;await S.tween(.17,k=>{g.position.lerpVectors(p0,b,k);g.position.y=Math.sin(k*PI)*.28;});a=b;S.sfx('thud');S.ring(b,ac,{r1:.9,dur:.25});S.dust(b,6);S.stage.shake(.18);await S.tween(.07,k=>squash(g,1-.14*Math.sin(k*PI)));}
  await S.tween(.24,k=>{squash(g,1-.32*easeOut(k));});S.sfx('charge');
  S.cam({at:()=>up(mix(g.position,P,.4),.5+g.position.y*.6),yaw:1.2,pitch:-.04,w:4.2,h:4.8,dur:.18});const j0=g.position.clone(),y0=g.rotation.y;
  await S.tween(.3,k=>{const e=easeOut(k);g.position.lerpVectors(j0,spot,e*.9);g.position.y=2.7*e;squash(g,.68+.45*Math.min(1,k*3));g.rotation.y=y0+e*PI*2;D.g.rotation.x=-.4*e;});squash(g,1);S.slow(.22,.28);
  const top=g.position.clone();await S.tween(.15,k=>{g.position.y=2.7+.08*Math.sin(k*PI);});S.sfx('whoosh');
  S.cam({at:up(P,.5),yaw:1.65,pitch:.16,w:4.4,h:3,dur:.08});
  await S.tween(.08,k=>{g.position.lerpVectors(top,spot,k);g.position.y=2.7*(1-easeIn(k));squash(g,1.15);});g.position.copy(spot);squash(g,.62);
  S.finalHit(X,1.35);S.sfx('boom');S.ring(spot,0xffffff,{r1:4.4,dur:.7,width:.1});crack(S,mix(spot,P,.5),1.6);S.dust(spot,30);S.debris(up(spot,.1),14,0x8a7ab0,{speed:3.5,up:4,size:.09});D.g.position.y=.55;
  await S.tween(.22,k=>{squash(g,.62+.38*back(k));});},
 // Queen: vanishes and strikes from three sides, then drops out of the air with both blades crossed.
 async 'blink-dance'(X){const {S,A,D,P,start,dir,side,mid,ac}=X,g=A.g,[b0,b1]=A.gear.blades,hitAt=up(P,.65);
  S.cam({at:up(mid,.7),yaw:1.3,pitch:.2,w:4.4,h:3.1,dur:.3});
  await S.tween(.22,k=>{const e=easeOut(k);squash(g,1-.14*e);g.rotation.x=.22*e;b0.rotation.z=.25+.6*e;b1.rotation.z=-.25-.6*e;});
  const spots=[along(P,side,.9),along(P,dir,.9),along(P,side,-.9)];
  for(const [i,p] of spots.entries()){S.ghost(g,ac);S.sfx('blink');S.motes(up(g.position,.6),8,ac);await S.tween(.05,k=>{g.scale.set(1-k*.95,1+k*.4,1-k*.95);});
   g.position.copy(p);S.face(A,P);S.ring(p,ac,{r1:.8,dur:.25});if(i)S.cam({at:up(P,.65),yaw:1.57+(i===1?.75:-.5),pitch:.16,w:3.8,h:2.8,dur:.12});
   await S.tween(.05,k=>{g.scale.set(.05+k*.95,1.4-k*.4,.05+k*.95);});
   S.slashArc(up(mix(p,P,.55),.65),{yaw:g.rotation.y,tilt:i%2?.6:-.6,r:.85,color:ac,dur:.22});S.hit(hitAt,.32,ac);S.sfx('clang');D.g.rotation.y+=1.3;D.g.rotation.z=(i%2?1:-1)*.18;
   await S.tween(.11,k=>{g.rotation.x=.3*Math.sin(k*PI);b0.rotation.x=1.4*Math.sin(k*PI);b1.rotation.x=1.4*Math.sin(k*PI);});}
  S.ghost(g,ac);S.sfx('blink');const sky=up(along(P,dir,-.15),2.2),end=along(P,dir,-.55);g.position.copy(sky);S.face(A,P);g.rotation.x=1.1;
  S.cam({at:up(P,1.1),yaw:1.1,pitch:-.1,w:3.4,h:4,dur:.1});S.slow(.2,.28);await S.tween(.14,k=>{g.position.y=2.2+.1*Math.sin(k*PI);b0.rotation.z=1.2;b1.rotation.z=-1.2;});S.sfx('whoosh');
  await S.tween(.08,k=>{g.position.lerpVectors(sky,end,easeIn(k));g.rotation.x=1.1*(1-k);});
  for(const t of [.75,-.75])S.slashArc(hitAt,{yaw:g.rotation.y,tilt:PI/2,roll:t,r:1.1,arc:2.8,color:0xffffff,dur:.3});
  S.finalHit(X,1.1);D.g.rotation.z=0;await S.tween(.2,k=>{squash(g,1-.16*Math.sin(k*PI));b0.rotation.z=1.2-.95*k;b1.rotation.z=-1.2+.95*k;});},
 // Queen: spins up into a whirl of blades, carves past the defender, and stops with her back turned.
 async 'blade-storm'(X){const {S,A,D,P,start,dir,side,ac}=X,g=A.g,[b0,b1]=A.gear.blades,y0=g.rotation.y,end=along(P,dir,.95);let spin=0,last=0;
  S.cam({at:()=>up(mix(g.position,P,.5),.65),yaw:1.25,pitch:.24,w:4.4,h:3,dur:.3});S.sfx('charge');
  const whirl=(k,dt)=>{spin+=dt*(8+k*26);g.rotation.y=y0+spin;last+=dt;if(last>.07){last=0;S.slashArc(up(g.position,.6),{yaw:g.rotation.y,r:.95,arc:3.4,color:ac,dur:.16,width:.16});}};
  await S.tween(.4,(k,dt)=>{whirl(k*.6,dt);const e=easeOut(k);b0.position.set(-.42-.35*e,.45+.15*e,.05);b1.position.set(.42+.35*e,.45+.15*e,.05);b0.rotation.z=.25+1.3*e;b1.rotation.z=-.25-1.3*e;g.position.y=.12*e;});S.sfx('whoosh');
  let hits=0;await S.tween(.55,(k,dt)=>{whirl(1,dt);const e=ease(k);g.position.lerpVectors(start,end,e).addScaledVector(side,Math.sin(e*PI)*.62);g.position.y=.12;
   if(hits<3&&e>.38+hits*.11){hits++;S.hit(up(P,.65),.3,ac);S.sfx('clang');D.g.rotation.y-=1.5;D.g.rotation.z=(hits%2?1:-1)*.2;D.g.position.copy(P).addScaledVector(side,-.08*hits);}});
  S.cam({at:up(mix(P,end,.5),.65),yaw:2.3,pitch:.1,w:3.4,h:2.5,dur:.16});
  await S.tween(.2,k=>{const e=easeOut(k);g.rotation.y=yawOf(dir)+(1-e)*1.5;g.position.y=.12*(1-e);b0.position.set(-.42-.35*(1-e),.45,.05);b1.position.set(.42+.35*(1-e),.45,.05);b0.rotation.z=1.55-1.3*e;b1.rotation.z=-1.55+1.3*e;squash(g,1-.1*Math.sin(k*PI));});
  S.sfx('tick');await S.wait(.2);for(const t of [.5,-.5,1.57])S.slashArc(up(D.g.position,.65),{yaw:yawOf(dir)+1.57,tilt:t,r:.9,color:0xffffff,dur:.26});D.g.rotation.z=0;S.finalHit(X,1.05);await S.wait(.1);},
 // King: three heavy steps, the guard pins the defender, the great sword rises and falls once.
 async executioner(X){const {S,A,D,P,start,stop,dir,ac}=X,g=A.g,sw=A.gear.sword;
  S.cam({at:()=>up(g.position,.75),yaw:2.55,pitch:.03,w:2.7,h:2.7,dur:.35});let a=start;
  for(let i=1;i<=3;i++){const b=mix(start,stop,i/3),p0=a;await S.tween(.2,k=>{g.position.lerpVectors(p0,b,ease(k));g.position.y=Math.sin(k*PI)*.07;g.rotation.z=(i%2?1:-1)*.07*Math.sin(k*PI);});a=b;S.sfx('thud');S.ring(b,ac,{r1:.8,dur:.3,width:.1});S.dust(b,4);S.stage.shake(.14);}
  const gd=guards(X);S.sfx('royal');S.cam({at:up(mix(stop,P,.5),.8),yaw:1.0,pitch:-.08,w:3,h:3.6,dur:.35,dolly:-.1});const tip=S.glowBall(0xffffff,.02);
  await Promise.all([kneel(X),S.tween(.5,k=>{const e=ease(k);sw.position.set(-.48+.48*e,.25+1.0*e,.1);sw.scale.setScalar(1+.55*e);g.rotation.x=-.28*e;squash(g,1+.06*e);tip.position.copy(sw.localToWorld(V(0,1.3,0)));tip.scale.setScalar(.02+.1*e);if(Math.random()<.5)S.motes(tip.position,1,GOLD);})]);
  await S.wait(.16);S.cam({at:up(P,.6),yaw:1.6,pitch:.15,w:4.4,h:3.2,dur:.08});S.sfx('whoosh');S.drop(tip);
  S.slashArc(up(mix(stop,P,.6),1.0),{yaw:yawOf(dir)+PI/2,tilt:PI/2,r:1.7,arc:2.4,color:0xffffff,dur:.35,width:.3});S.streak(up(stop,2.4),up(P,.1),ac,{w:.16,dur:.4});
  await S.tween(.07,k=>{sw.rotation.x=1.85*k;g.rotation.x=-.28+.75*k;});
  S.finalHit(X,1.5);S.ring(P,GOLD,{r1:4.2,dur:.7,width:.1});crack(S,P,1.2);gd.off();
  await S.tween(.3,k=>{g.rotation.x=.47*(1-k);sw.rotation.x=1.85*(1-k);sw.position.set(-.48*k,1.25-1.0*k,.1);sw.scale.setScalar(1.55-.55*k);squash(g,1);});},
 // King: does not even walk over. The sword points, a great crown of light forms overhead and drops.
 async 'royal-decree'(X){const {S,A,D,P,start,dir,ac}=X,g=A.g,sw=A.gear.sword;
  S.cam({at:up(start,.85),yaw:2.4,pitch:.02,w:2.8,h:3,dur:.35,dolly:-.08});S.sfx('royal');
  await S.tween(.4,k=>{const e=ease(k);sw.position.set(-.48+.3*e,.25+.75*e,.1+.1*e);g.rotation.x=-.2*e;squash(g,1+.05*e);});
  const tipP=sw.localToWorld(V(0,1.3,0));S.streak(tipP,up(tipP,6),GOLD,{w:.05,dur:.7});const gd=guards(X);
  S.cam({at:up(P,1.3),yaw:1.25,pitch:-.06,w:3.8,h:4.4,dur:.35});const seal=S.sigil(up(P,2.7),GOLD,.2),cr=S.add(crown(S,.2));cr.position.copy(up(P,2.7));
  await Promise.all([kneel(X),S.tween(.5,k=>{const e=easeOut(k);seal.scale.setScalar(.2+1.2*e);seal.rotation.y=k*4;cr.scale.setScalar(.2+2.6*e);cr.rotation.y=-k*3;if(Math.random()<.6)S.motes(up(P,2.6),1,GOLD);})]);
  await S.wait(.14);S.sfx('whoosh');
  await S.tween(.09,k=>{g.rotation.x=-.2+.55*k;sw.rotation.x=1.5*k;});
  S.cam({at:up(P,.6),yaw:1.6,pitch:.18,w:4.4,h:3.2,dur:.08});const bm=S.beam(GOLD);
  await S.tween(.08,k=>{cr.position.y=2.7-2.3*easeIn(k);bm.set(up(P,6),up(P,0),.5*k);});
  S.finalHit(X,1.5);S.ring(P,GOLD,{r1:4.2,dur:.7,width:.1});crack(S,P,1.2);gd.off();
  await S.tween(.3,k=>{bm.set(up(P,6),up(P,0),.5*(1-k));bm.opacity(1-k);cr.material.opacity=1-k;cr.material.transparent=true;cr.scale.setScalar(2.8+k);seal.material.opacity=1-k;g.rotation.x=.35*(1-k);sw.rotation.x=1.5*(1-k);sw.position.set(-.18-.3*k,1-.75*k,.2-.1*k);squash(g,1);});bm.off();S.drop(cr);S.drop(seal);}};

// ── How each piece meets the attack ──────────────────────────────────────────────────────────
export const BRACE={
 // Pawn: plants its feet behind a little shield.
 async 'shield-wall'(X){const {S,D}=X,g=D.g,sh=S.attach(g,shield(S,D.col));sh.position.set(.3,.4,.2);sh.scale.setScalar(.01);D.guard.push(sh);S.sfx('tick');
  await S.tween(.26,k=>{const e=back(k);sh.scale.setScalar(Math.max(.01,e*1.15));sh.position.set(.3-.3*k,.42,.2+.2*k);squash(g,1-.16*k);g.rotation.x=.12*k;});},
 // Knight: rears and snorts.
 async 'rear-up'(X){const {S,D}=X,g=D.g;S.sfx('gallop');await S.tween(.34,k=>{g.rotation.x=-.6*Math.sin(k*PI);g.position.y=.3*Math.sin(k*PI);if(k>.3&&k<.6)S.puff(g.localToWorld(V(0,1,.4)),1,0xffffff,{speed:1,life:.3,gravity:0,up:.3});});S.dust(g.position,6);g.rotation.x=.15;},
 // Bishop: a ward of light closes around it.
 async ward(X){const {S,D,P}=X,bub=S.add(new T.Mesh(S.geo.ball,S.glowMat(D.col,1.1,0)));bub.position.copy(up(P,.65));bub.userData.orb=true;D.guard.push(bub);const sg=S.sigil(up(P,.035),D.col,.2);D.guard.push(sg);S.sfx('chime');
  await S.tween(.32,k=>{const e=easeOut(k);bub.scale.set(.85*e,1.0*e,.85*e);bub.material.opacity=.26*e;sg.scale.setScalar(.2+.6*e);sg.rotation.y=k*2;D.g.position.y=.12*e;});},
 // Rook: drops low and throws up a wall of stone slabs.
 async portcullis(X){const {S,D,P,dir,side}=X,g=D.g,slabs=[-1,0,1].map(i=>{const m=S.add(slab(S,D.c));m.scale.set(.34,.7,.12);m.position.copy(along(along(P,dir,-.55+Math.abs(i)*.1),side,i*.4));m.position.y=-.4;m.rotation.y=yawOf(dir)+i*.35;D.guard.push(m);return m;});S.sfx('crumble');
  await S.tween(.3,k=>{squash(g,1-.14*Math.sin(k*PI*.5));for(const [i,m] of slabs.entries())m.position.y=-.4+.75*back(Math.max(0,Math.min(1,k*1.4-i*.12)));});S.dust(along(P,dir,-.5),6);},
 // Queen: she is not waiting to be hit. A lunge and a cut that the attacker has to turn aside.
 async riposte(X){const {S,A,D,P,start,dir}=X,g=D.g,bl=[-1,1].map(s=>{const b=S.attach(g,blade(S,D.col,.7));b.position.set(s*.4,.45,.1);b.rotation.z=-s*.25;b.userData.keep=true;D.guard.push(b);return b;});const clash=up(mix(P,start,.62),.7);
  S.sfx('whoosh');await S.tween(.14,k=>{g.position.lerpVectors(P,mix(P,start,.42),easeIn(k));g.rotation.x=.3*k;bl[0].rotation.x=1.3*k;bl[1].rotation.x=1.3*k;});
  S.slashArc(clash,{yaw:g.rotation.y,tilt:.5,r:.8,color:D.col,dur:.2});S.hit(clash,.35,D.col);S.sfx('clang');
  await S.tween(.22,k=>{const e=easeOut(k);g.position.lerpVectors(mix(P,start,.42),P,e);g.rotation.x=.3*(1-e);A.g.position.copy(start).addScaledVector(dir,-.2*Math.sin(k*PI));A.g.rotation.x=-.3*Math.sin(k*PI);bl[0].rotation.x=1.3*(1-e);bl[1].rotation.x=1.3*(1-e);bl[0].rotation.z=.25+.7*e;bl[1].rotation.z=-.25-.7*e;});},
 // King: sword up, standing its ground.
 async guard(X){const {S,D}=X,g=D.g,sw=S.attach(g,blade(S,D.col,1.1,.08));sw.position.set(-.45,.3,.15);D.guard.push(sw);S.sfx('royal');await S.tween(.3,k=>{const e=easeOut(k);sw.position.set(-.45+.45*e,.3+.5*e,.15+.25*e);sw.rotation.z=-1.57*e;squash(g,1+.05*e);});}};

// ── How each piece falls ─────────────────────────────────────────────────────────────────────
// The twist: what this attacker's kind of damage does to the defender before it goes.
async function twist(X){const {S,D,ac}=X,g=D.g,h=X.hitDir,O=g.position.clone(),dmg=X.M.damage,y0=g.rotation.y;g.scale.setScalar(1);
 if(dmg==='pierce')await S.tween(.26,k=>{const e=easeOut(k);g.position.copy(O).addScaledVector(h,.6*e);g.position.y=O.y*(1-e);g.rotation.x=-.5*Math.sin(k*PI);if(k<.7)S.sparks(up(g.position,.05),2,GOLD);});
 else if(dmg==='trample')await S.tween(.34,k=>{g.rotation.y=y0+easeOut(k)*PI*4;g.position.copy(O).addScaledVector(h,.35*k);g.position.y=O.y*(1-k)+Math.sin(k*PI)*.55;});
 else if(dmg==='arcane'){const sg=S.sigil(up(O,.04),ac,.9);await S.tween(.36,k=>{g.position.y=O.y*(1-k)+Math.sin(k*PI)*.9;g.rotation.z=Math.sin(k*22)*.09;sg.rotation.y=k*4;sg.material.opacity=1-k;if(Math.random()<.6)S.motes(up(O,.5),1,ac);});S.drop(sg);}
 else if(dmg==='crush'){S.dust(O,10);await S.tween(.32,k=>{const s=k<.25?1-k/.25*.62:.38+.62*easeOut((k-.25)/.75)+.2*Math.sin(k*20)*(1-k);squash(g,s);g.position.y=O.y*Math.max(0,1-k*5);});}
 else if(dmg==='slash'){for(const [i,t] of [.6,-.6,1.5].entries()){S.slashArc(up(O,D.h*.5),{yaw:y0+i,tilt:t,r:.75,color:ac,dur:.18});S.sfx('tick');await S.tween(.08,k=>{g.rotation.z=(i%2?1:-1)*.22*Math.sin(k*PI);g.position.y=O.y*(1-k);});}}
 else{const seal=S.sigil(up(O,2),GOLD,.7);S.sfx('chime');await S.tween(.3,k=>{seal.position.y=2-1.95*easeIn(k);seal.rotation.y=k*3;g.rotation.x=.42+.25*k;squash(g,.8-.1*k);g.position.y=0;});S.ring(O,GOLD,{r1:1.4,dur:.3});S.drop(seal);}
 g.position.y=Math.max(0,g.position.y<.02?0:g.position.y);g.scale.setScalar(1);}
// The camera follows whoever is going out.
const follow=(X,w=4.4,h=3.2,yaw=1.4)=>X.S.cam({at:()=>up(X.D.g.position,Math.min(2.4,.55+X.D.g.position.y*.6)),yaw,pitch:.2,w,h,dur:.22});

export const DEFEAT={
 // Pawn: launched, and every kind of blow launches it differently.
 async launched(X){const {S,D,ac,dc}=X,g=D.g,h=X.hitDir,O=g.position.clone(),dmg=X.M.damage,y0=g.rotation.y;g.scale.setScalar(1);S.sfx('fall');
  const helm=()=>S.debris(up(O,.72),1,GOLD,{shape:'ball',size:.13,speed:1.5,up:4.5,life:1.2,dir:h});
  if(dmg==='pierce'){// skewered: skids the length of the board on its back, sparks all the way
   follow(X,6,3.2,1.5);helm();const end=along(O,h,4.2);await S.tween(.6,k=>{const e=easeOut(k);g.position.lerpVectors(O,end,e);g.position.y=.12+Math.sin(Math.min(1,k*3)*PI)*.3;g.rotation.x=-1.45*Math.min(1,k*4);g.rotation.y=y0+k*5;if(k<.8)S.sparks(up(g.position,.04),2,GOLD);g.scale.setScalar(k>.7?Math.max(.001,1-(k-.7)/.3):1);});}
  else if(dmg==='trample'){// punted to the rafters, a twinkle and gone
   X.S.cam({at:()=>up(g.position,g.position.y*.75+.5),yaw:1.3,pitch:-.08,w:4,h:5,dur:.2});helm();const end=along(O,h,1.6);await S.tween(.62,k=>{const e=easeOut(k);g.position.lerpVectors(O,end,e);g.position.y=5.2*e;g.rotation.x=-k*16;g.scale.setScalar(Math.max(.001,1-e*.85));});
   const star=S.glowBall(0xffffff,.02);star.position.copy(g.position);g.visible=false;S.sfx('chime');await S.tween(.22,k=>{star.scale.setScalar(.02+.28*Math.sin(k*PI));});S.drop(star);}
  else if(dmg==='arcane'){// floats up in a bubble of the caster's colour, and pops
   follow(X,3.6,3.6);const bub=S.add(new T.Mesh(S.geo.ball,S.glowMat(ac,1.2,.3)));await S.tween(.6,k=>{const e=easeOut(k);g.position.y=O.y*(1-k)+1.5*e;g.rotation.z=Math.sin(k*12)*.25;g.rotation.y=y0+k*3;bub.position.copy(up(g.position,g.position.y+.35));bub.scale.setScalar(.2+.45*e+(k>.8?(k-.8)*1.2:0));});
   S.drop(bub);S.sfx('blink');S.puff(up(g.position,g.position.y+.35),50,ac,{speed:5,life:.7,gravity:1,up:.5});S.ring(up(O,0),ac,{r1:1.6,dur:.4});g.visible=false;await S.wait(.2);}
  else if(dmg==='crush'){// flattened like a coin, then flips off the board
   follow(X,3.8,3);S.dust(O,10);await S.tween(.1,k=>{g.scale.set(1+.7*k,1-.88*k,1+.7*k);g.position.y=0;});await S.wait(.2);helm();S.sfx('tick');
   const end=along(O,h,2.2);await S.tween(.55,k=>{g.position.lerpVectors(O,end,k);g.position.y=Math.sin(k*PI)*2.2;g.rotation.x=k*22;const s=Math.max(.001,1-easeIn(k));g.scale.set(1.7*s,.12*s+.02,1.7*s);});}
  else if(dmg==='slash'){// spun like a top until it wobbles over
   follow(X,3.4,2.8);helm();await S.tween(.7,k=>{g.rotation.y=y0+(1-Math.pow(1-k,2))*30;g.rotation.z=k*k*1.2*Math.sin(k*18)*.5+easeIn(k)*1.2;g.position.y=.25*Math.sin(Math.min(1,k*2)*PI)+.1*easeIn(k);if(Math.random()<.5)S.sparks(up(g.position,.05),1,ac);});
   S.dust(O,8);S.sfx('thud');await S.tween(.2,k=>{g.scale.setScalar(Math.max(.001,1-k));});S.motes(up(O,.3),16,dc);}
  else{// dismissed: still bowing, it is swept backwards off the board in a trail of gold
   follow(X,5,3,1.5);const end=along(O,h,3.8);await S.tween(.7,k=>{const e=ease(k);g.position.lerpVectors(O,end,e);g.position.y=0;g.rotation.x=.6;squash(g,.8);if(Math.random()<.7)S.motes(up(g.position,.2),1,GOLD);if(k>.7)g.scale.multiplyScalar(Math.max(.001,1-(k-.7)/.3));});}
  g.visible=false;},
 // Knight: rears, staggers, and goes down on its side.
 async collapse(X){const {S,D,dc}=X,g=D.g;follow(X);await twist(X);const O=up(g.position,0);S.sfx('fall');
  await S.tween(.26,k=>{g.rotation.x=-.75*Math.sin(k*PI*.5);g.position.y=.22*Math.sin(k*PI);});
  await S.tween(.3,k=>{g.rotation.x=-.75*(1-k);g.rotation.z=Math.sin(k*PI*3)*.28;});
  await S.tween(.24,k=>{g.rotation.z=easeIn(k)*PI/2;g.position.y=.2*easeIn(k);});S.sfx('thud');S.dust(O,18);S.stage.shake(.3);S.ring(O,dc,{r1:1.3,dur:.3});
  await S.tween(.16,k=>{g.rotation.x=Math.sin(k*PI)*.16;});await S.tween(.3,k=>{g.scale.setScalar(Math.max(.001,1-k));if(Math.random()<.7)S.motes(up(O,.25),1,dc);});g.visible=false;},
 // Bishop: turns to light, cracks, and bursts into shards that drift upward.
 async 'shatter-light'(X){const {S,D,dc}=X,g=D.g;follow(X,4,3.6);await twist(X);const O=up(g.position,0),body=g.children.find(c=>c.userData.slot==='body'),glow=S.add(new T.Mesh(body.geometry,S.glowMat(0xffffff,1.6,0)));glow.position.copy(g.position);glow.rotation.copy(g.rotation);S.sfx('chime');
  await S.tween(.3,k=>{glow.material.opacity=k;glow.scale.setScalar(1+.04*k+Math.sin(k*40)*.01);g.rotation.z=Math.sin(k*50)*.03;glow.rotation.copy(g.rotation);if(k>.5&&Math.random()<.5)S.sfx('tick');});
  g.visible=false;S.drop(glow);S.sfx('shatter');S.hit(up(O,.7),.5,dc,{sparks:false});S.debris(up(O,.65),26,dc,{shape:'shard',glow:true,size:.11,speed:2.6,up:1.2,gravity:1.6,life:1.1,spread:.7,bounce:0});S.puff(up(O,.7),60,0xffffff,{speed:5,life:.6,gravity:0,up:.5});
  const col=S.beam(dc);S.ring(O,dc,{r1:2.2,dur:.5});await S.tween(.5,k=>{col.set(up(O,0),up(O,5),.35*(1-k));col.opacity(1-k);});col.off();},
 // Rook: comes apart block by block from the battlements down.
 async crumble(X){const {S,D,dc}=X,g=D.g;follow(X,4.4,3);await twist(X);const O=up(g.position,0),h=X.hitDir,mat=S.own(new T.MeshStandardMaterial({color:D.c==='w'?0xf0e8da:0x23212e,roughness:.4,metalness:D.c==='w'?.1:.6,emissive:dc,emissiveIntensity:.12})),rows=4,per=7;g.visible=false;S.sfx('crumble');
  for(let r=0;r<rows;r++)for(let i=0;i<per;i++){const a=(i+(r%2)*.5)/per*PI*2,m=new T.Mesh(S.geo.box,mat);m.position.set(O.x+Math.sin(a)*.24,.14+.1+r*.19,O.z+Math.cos(a)*.24);m.rotation.y=a;m.scale.set(.2,.18,.13);S.add(m);
   S.debris(null,1,0,{mesh:m,delay:(rows-1-r)*.13+Math.random()*.08,speed:1.3,up:1.2,dir:h.clone().multiplyScalar(.6),life:1.15+(rows-1-r)*.13,bounce:.3});}
  for(let r=0;r<rows;r++){await S.wait(.13);S.dust(O,5);S.sfx('thud');S.stage.shake(.12);}
  await S.wait(.3);S.ring(O,dc,{r1:1.6,dur:.4});S.dust(O,14);await S.wait(.2);},
 // Queen: the tiara flies, the blades fall and stand in the board, and she spins away into light.
 async 'last-dance'(X){const {S,D,dc}=X,g=D.g;follow(X,4,3.4);await twist(X);const O=up(g.position,0),y0=g.rotation.y;S.sfx('fall');
  const tiara=crown(S,.8);tiara.position.copy(up(O,1.2));S.add(tiara);S.debris(null,1,0,{mesh:tiara,speed:1.2,up:4.2,dir:X.hitDir.clone().multiplyScalar(.5),life:1.3,bounce:.45}).forEach(c=>{c.onLand=()=>{S.sfx('crown');S.sparks(tiara.position,10,GOLD);};});
  const blades=D.guard.filter(o=>o.userData.keep).map((b,i)=>{const w=world(b);S.add(b);b.position.copy(w);b.rotation.set(0,0,0);return {b,w,to:along(O,X.side,(i?1:-1)*.75).setY(.72)};});
  await S.tween(.75,k=>{const e=easeOut(k);g.rotation.y=y0+e*PI*7;g.position.y=.35*Math.sin(k*PI);g.scale.set(Math.max(.001,1-easeIn(k)),1+k*.7,Math.max(.001,1-easeIn(k)));if(Math.random()<.9)S.puff(V(O.x+Math.cos(k*24)*.45,.2+k*1.6,O.z+Math.sin(k*24)*.45),1,k<.5?GOLD:dc,{speed:.6,life:.6,gravity:1,up:.4,spread:.1});
   for(const {b,w,to} of blades){const q=Math.min(1,k*2.2);b.position.lerpVectors(w,to,q);b.position.y=w.y+(to.y-w.y)*q+Math.sin(q*PI)*.9;b.rotation.z=PI*Math.min(1,q*1.1)+q*PI*2*(q<1?1:0);if(q>=1&&!b.userData.stuck){b.userData.stuck=true;b.rotation.set(0,0,PI);S.sfx('clang');S.sparks(up(to,.05),8,dc);}}});
  g.visible=false;S.ring(O,dc,{r1:1.8,dur:.45});S.puff(up(O,.9),40,dc,{speed:3,life:.8,gravity:1.5,up:1});await S.tween(.3,k=>{for(const {b} of blades)b.scale.setScalar(Math.max(.001,1-k));});blades.forEach(({b})=>S.drop(b));},
 // King (it cannot be captured in a real game; the checkmate scene uses the same fall).
 async 'crown-fall'(X){const {S,D}=X;follow(X);await twist(X);await kingFall(S,D.g,X.hitDir,D.col,false);D.g.visible=false;}};

// The king goes over backwards and its crown comes off, hits the board, bounces and rings.
async function kingFall(S,g,dir,color,slowmo=true){const O=up(g.position,0),top=up(O,(g.userData.h||1.3)-.12),trim=g.children.find(c=>c.userData.slot==='trim'),cr=S.add(crown(S,1.25)),end=along(O,dir,1.15).setY(.07),y0=g.rotation.y,fall=yawOf(dir)-y0;cr.position.copy(top);cr.userData.crown=true;if(trim)trim.visible=false;
 if(slowmo){S.slow(1.5,.22);S.cam({at:()=>up(cr.position,Math.max(.25,cr.position.y*.8)),yaw:1.45,pitch:.1,w:3.2,h:2.6,dur:.3});}S.sfx('fall');
 // Tips over away from the blow: pitch and roll together, whichever way it happens to face.
 const tip=k=>{const e=easeIn(Math.min(1,k));g.rotation.set(-Math.cos(fall)*e*PI/2,y0,Math.sin(fall)*e*PI/2);g.position.copy(O).addScaledVector(dir,.25*e);g.position.y=.2*e;};
 await S.tween(.75,k=>{cr.position.lerpVectors(top,end,k);cr.position.y=top.y+(end.y-top.y)*k+Math.sin(k*PI)*1.25;cr.rotation.set(k*9,k*4,k*5);tip(k*1.25);});
 S.slowT=0;S.hit(cr.position.clone(),.6,GOLD);S.sfx('crown');S.ring(end,GOLD,{r1:1.8,dur:.5});S.dust(O,14);const b1=along(end,dir,.45);
 await S.tween(.3,k=>{cr.position.lerpVectors(end,b1,k);cr.position.y=.07+Math.sin(k*PI)*.38;cr.rotation.set(9+k*4,4,5+k*2);});S.sparks(cr.position,8,GOLD);
 await S.tween(.36,k=>{cr.rotation.set(Math.sin(k*18)*.5*(1-k),4+k*3,Math.cos(k*18)*.5*(1-k));cr.position.y=.07;});
 if(!slowmo){await S.tween(.25,k=>{g.scale.setScalar(Math.max(.001,1-k));cr.scale.setScalar(Math.max(.001,1.25*(1-k)));});if(trim)trim.visible=true;}return cr;}

// ── How each piece celebrates ────────────────────────────────────────────────────────────────
const hero=(X,h=2.6)=>X.S.cam({at:()=>up(X.A.g.position,.6+X.A.g.position.y*.5),yaw:2.5,pitch:.02,w:2.4,h,dur:.3,drift:.35});
export const VICTORY={
 async 'spear-salute'(X){const {S,A,ac}=X,g=A.g,sp=A.gear.spear;hero(X);S.sfx('fanfare');await S.tween(.5,k=>{g.position.y=Math.abs(Math.sin(k*PI*2))*.32;sp.rotation.x=-1.5*Math.min(1,k*3);sp.position.set(-.3,.55+.25*Math.min(1,k*3),.1);if(k>.3&&Math.random()<.4)S.motes(g.localToWorld(V(-.3,1.5,.1)),1,ac);});},
 async 'rear-howl'(X){const {S,A,ac}=X,g=A.g;hero(X,2.8);S.sfx('gallop');await S.tween(.55,k=>{const e=Math.sin(Math.min(1,k*1.3)*PI*.5);g.rotation.x=-.65*e*(k>.85?(1-k)/.15:1);g.position.y=.18*e;if(k>.25&&k<.8)S.puff(g.localToWorld(V(0,1.05,.45)),1,ac,{speed:1.2,life:.5,gravity:1,up:1.2});});S.dust(g.position,6);},
 async halo(X){const {S,A,ac}=X,g=A.g;hero(X,2.9);S.sfx('chime');const sg=S.sigil(up(g.position,A.h+.35),ac,.1);await S.tween(.55,k=>{const e=easeOut(k);g.position.y=.28*Math.sin(k*PI);sg.position.y=g.position.y+A.h+.3;sg.scale.setScalar(.1+.4*e);sg.rotation.y=k*5;sg.material.opacity=k>.7?(1-k)/.3:1;if(Math.random()<.5)S.motes(orbOf(A),1,ac);});S.drop(sg);},
 async stomp(X){const {S,A,ac}=X,g=A.g,O=g.position.clone();hero(X,2.4);await S.tween(.26,k=>{g.position.y=Math.sin(k*PI)*.5;squash(g,1+.1*Math.sin(k*PI));});S.sfx('boom');S.ring(O,ac,{r1:2,dur:.4});S.dust(O,12);S.stage.shake(.3);await S.tween(.28,k=>{squash(g,1-.22*Math.sin(k*PI)*(1-k));});squash(g,1);},
 async flourish(X){const {S,A,ac}=X,g=A.g,y0=g.rotation.y,[b0,b1]=A.gear.blades;hero(X,2.8);S.sfx('whoosh');await S.tween(.55,(k)=>{const e=easeOut(k);g.rotation.y=y0+e*PI*4;g.position.y=.14*Math.sin(k*PI);b0.rotation.z=.25+1.2*Math.sin(k*PI);b1.rotation.z=-.25-1.2*Math.sin(k*PI);if(k<.7&&Math.random()<.35)S.slashArc(up(g.position,.7),{yaw:g.rotation.y,r:.9,arc:3,color:ac,dur:.2,width:.14});});g.rotation.y=y0;},
 async 'sword-plant'(X){const {S,A,ac}=X,g=A.g,sw=A.gear.sword;hero(X,3);S.sfx('royal');await S.tween(.22,k=>{sw.position.set(-.48+.48*k,.25+.5*k,.1+.3*k);sw.rotation.x=PI*k;});await S.tween(.07,k=>{sw.position.y=.75-.0*k+.55*(1-k)*0+.55*k*0;sw.position.set(0,.75+.55-.0,.4);sw.position.y=1.3-.05*k;});
  S.ring(up(g.localToWorld(V(0,0,.4)),0),GOLD,{r1:2.4,dur:.5});S.sfx('clang');S.stage.shake(.2);S.sparks(up(g.localToWorld(V(0,0,.4)),.05),10,GOLD);await S.tween(.3,k=>{g.rotation.x=-.14*Math.sin(k*PI*.5);squash(g,1+.05*Math.sin(k*PI));});}};

// ── Special scenes ───────────────────────────────────────────────────────────────────────────
/** En passant: the attacker slips past onto the square behind and stabs the passing pawn in the back. */
export async function enPassant(X){const {S,A,D,P,start,to,ac}=X,g=A.g,sp=A.gear.spear,d=D.g,y0=d.rotation.y;
 S.cam({at:up(mix(start,P,.5),.5),yaw:1.1,pitch:.36,w:4.2,h:3,dur:.3});
 await S.tween(.3,k=>{d.position.y=Math.abs(Math.sin(k*PI*2))*.1;d.rotation.y=y0+Math.sin(k*PI*2)*.25;});
 S.ghost(g,ac);S.sfx('blink');S.streak(up(start,.4),up(to,.4),ac,{w:.08,dur:.35});await S.tween(.16,k=>{g.position.lerpVectors(start,to,easeOut(k));squash(g,.85);});squash(g,1);S.face(A,P);S.dust(to,6);
 const hd=P.clone().sub(to).setY(0).normalize();X.hitDir=hd;S.cam({at:up(mix(to,P,.5),.5),yaw:1.3,pitch:.12,w:3,h:2.2,dur:.2,dolly:-.15});
 await S.tween(.3,k=>{d.rotation.y=y0+Math.sin(k*PI*3)*.7;d.position.y=0;g.rotation.x=-.4*easeOut(k);sp.position.z=.1-.45*easeOut(k);});S.sfx('whoosh');
 await S.tween(.07,k=>{g.rotation.x=-.4+.85*k;sp.position.z=-.35+1.05*k;g.position.copy(to).addScaledVector(hd,.2*k);});S.finalHit(X,1);
 await S.tween(.18,k=>{g.rotation.x=.45*(1-k);sp.position.z=.7-.6*k;g.position.copy(to).addScaledVector(hd,.2*(1-k));});}

/** Promotion: the pawn rises in a column of gold, spins into a chrysalis of light and comes out as the new piece. */
export async function promotion(S,sq,promo,mode){const old=S.pieces.get(sq);if(!old)return;const pos=sqPos(sq),col=S.teamColor(old.userData.c),quick=mode==='quick';S.cast.add(old);S.begin(quick?2:1);S.playerAxis();S.arena(true,{at:pos,color:GOLD});
 S.title('PROMOTION',false,'Pawn becomes '+NAMES[promo.toLowerCase()]);S.sfx('royal');S.cam({at:()=>up(pos,.7+old.position.y*.5),yaw:.55,pitch:.22,w:3.2,h:3.4,dur:.4,drift:.5});
 const sg=S.sigil(up(pos,.04),GOLD,.2),bm=S.beam(GOLD);let spin=0;
 await S.tween(.7,(k,dt)=>{const e=ease(k);spin+=dt*(3+k*30);old.position.y=1.15*e;old.rotation.y=spin;sg.scale.setScalar(.2+.9*easeOut(k));sg.rotation.y=-k*4;bm.set(up(pos,0),up(pos,6),.32*e);bm.opacity(.5);if(Math.random()<.7)S.motes(up(pos,.2+Math.random()),1,GOLD);});
 const ball=S.glowBall(0xffffff,.05);ball.position.copy(up(pos,1.5));S.sfx('charge');
 await S.tween(.3,(k,dt)=>{spin+=dt*36;old.rotation.y=spin;old.scale.setScalar(Math.max(.001,1-easeIn(k)));ball.scale.setScalar(.05+.5*easeOut(k));});
 old.removeFromParent();const g=S.makePiece(promo);S.pieces.set(sq,g);S.cast.add(g);g.position.copy(up(pos,1.15));g.scale.setScalar(.01);
 S.hit(up(pos,1.5),.9,GOLD);S.sfx('shatter');S.debris(up(pos,1.5),16,GOLD,{shape:'shard',glow:true,size:.08,speed:3.5,up:1,gravity:-3,life:.9});S.ring(pos,GOLD,{r1:3,dur:.6});
 await S.tween(.38,(k,dt)=>{spin+=dt*30*(1-k);g.rotation.y=S.homeYaw(g.userData.c)+Math.sin((1-k)*6)*(1-k);g.scale.setScalar(Math.max(.01,back(k)*1.0));ball.scale.setScalar(.55*(1-k)+.001);bm.set(up(pos,0),up(pos,6),.32*(1-k));});S.drop(ball);bm.off();
 S.cam({at:up(pos,.7),yaw:.25,pitch:.03,w:2.6,h:2.8,dur:.25,drift:.3});await S.tween(.1,k=>{g.position.y=1.15*(1-easeIn(k));});g.position.y=0;S.sfx('thud');S.sfx('fanfare');S.dust(pos,14);S.ring(pos,col,{r1:2.2,dur:.45});S.stage.shake(.3);
 await S.tween(.45,k=>{squash(g,1-.2*Math.sin(Math.min(1,k*2.5)*PI)*(1-k));sg.material.opacity=1-k;if(Math.random()<.6)S.motes(up(pos,g.userData.h),1,GOLD);});S.drop(sg);g.scale.setScalar(1);}

/** Castling: the king vaults over while the rook grinds across beneath it, and a shield closes over them. */
export async function castling(S,king,rook,m,rf,rt){const a=sqPos(m.from),b=sqPos(m.to),ra=sqPos(rf),rb=sqPos(rt),mid=mix(a,ra,.5),col=S.teamColor(king.userData.c),long=m.flag==='q',y0=king.rotation.y;
 S.begin(1);S.playerAxis();S.arena(true,{at:mid,color:col});S.title(long?'CASTLES LONG':'CASTLES',false,'The king takes cover');S.sfx('royal');
 S.cam({at:up(mid,.6),yaw:.45,pitch:.3,w:long?6.4:5.4,h:3.2,dur:.35,drift:-.25});
 await S.tween(.2,k=>{squash(king,1-.2*easeOut(k));rook.rotation.z=.08*Math.sin(k*20);});S.sfx('crumble');S.sfx('whoosh');
 await S.tween(.55,k=>{const e=ease(k);king.position.lerpVectors(a,b,e);king.position.y=Math.sin(e*PI)*1.5;king.rotation.y=y0+e*PI*2;squash(king,1+.1*Math.sin(k*PI));
  rook.position.lerpVectors(ra,rb,easeIn(Math.min(1,k*1.15)));rook.rotation.x=(rb.x>ra.x?1:-1)*0;rook.rotation.z=(rb.x>ra.x?-1:1)*.16*Math.sin(Math.min(1,k*1.15)*PI);if(k<.85)S.sparks(up(rook.position,.04),2,GOLD);});
 king.position.copy(b);rook.position.copy(rb);king.rotation.set(0,y0,0);rook.rotation.set(0,rook.rotation.y,0);S.hit(up(mix(b,rb,.5),.3),.7,col);S.sfx('boom');S.ring(b,GOLD,{r1:2.4,dur:.5});S.dust(b,10);S.dust(rb,10);
 const dome=S.add(new T.Mesh(S.geo.ball,S.glowMat(GOLD,1.3,.45)));dome.position.copy(up(mix(b,rb,.5),0));
 await S.tween(.5,k=>{const e=easeOut(k);squash(king,1-.2*Math.sin(Math.min(1,k*2)*PI)*(1-k));squash(rook,1-.16*Math.sin(Math.min(1,k*2)*PI)*(1-k));dome.scale.set(1.5*e,1.5*e,1.1*e);dome.material.opacity=.45*(1-k);});S.drop(dome);king.scale.setScalar(1);rook.scale.setScalar(1);}

/** Check: red beams lock on from every piece giving it, and the king flinches. */
export async function checkScene(S,s,from=[]){const g=S.pieces.get(s),kp=sqPos(s);S.begin(1);S.playerAxis();S.title('CHECK!',true);S.sfx('zap');S.cam({at:up(kp,.7),yaw:.6,pitch:.3,w:3.6,h:2.9,dur:.3,dolly:-.12});
 S.checkLight.position.set(kp.x,1.6,kp.z);const beams=from.map(f=>({b:S.beam(RED),a:up(sqPos(f),.7)})),sg=S.sigil(up(kp,.04),RED,.2),tgt=up(kp,.75),away=from.length?kp.clone().sub(sqPos(from[0])).setY(0).normalize():V(0,0,1),rel=g?yawOf(away)-g.rotation.y:0;
 await S.tween(.3,k=>{for(const {b,a} of beams)b.set(a,mix(a,tgt,easeOut(k)),.02+.03*k);sg.scale.setScalar(.2+.65*easeOut(k));sg.rotation.y=k*3;S.checkLight.intensity=30*k;});
 S.hit(tgt,.45,RED);S.sfx('clang');
 await S.tween(.5,k=>{const e=Math.sin(Math.min(1,k*1.6)*PI);if(g){g.rotation.x=-Math.cos(rel)*.38*e;g.rotation.z=Math.sin(rel)*.38*e;g.position.copy(kp).addScaledVector(away,.14*e);g.position.y=.22*Math.sin(Math.min(1,k*2.2)*PI);}
  for(const {b,a} of beams){b.set(a,tgt,.05*(1-k)*(1+.4*Math.sin(k*50)));b.opacity(1-k*k);}sg.rotation.y+=.1;sg.material.opacity=1-k;S.checkLight.intensity=30*(1-k);});
 beams.forEach(({b})=>b.off());S.drop(sg);}

/** Checkmate: the threats lock on, the king looks for a way out that is not there, a pillar of the
 * winner's light comes down, and the crown falls to the board in slow motion. */
export async function checkmateScene(S,s,winner,from=[]){const g=S.pieces.get(s),kp=sqPos(s),wc=S.teamColor(winner),tgt=up(kp,.75);S.begin(1);S.playerAxis();S.arena(true,{at:kp,color:wc});
 S.title('CHECKMATE',true,winner==='w'?'White takes the crown':'Black takes the crown');S.sfx('doom');S.cam({at:up(kp,.8),yaw:.7,pitch:.3,w:4.6,h:3.5,dur:.5,drift:.3});
 const beams=from.map(f=>({b:S.beam(wc),a:up(sqPos(f),.7)})),away=from.length?kp.clone().sub(sqPos(from[0])).setY(0).normalize():V(0,0,winner==='w'?-1:1),y0=g?g.rotation.y:0;
 await S.tween(.75,k=>{for(const {b,a} of beams)b.set(a,mix(a,tgt,easeOut(Math.min(1,k*2.5))),.03+.02*Math.sin(k*40));if(g){g.rotation.y=y0+Math.sin(k*PI*3)*.9*(1-k*.3);g.position.x=kp.x+Math.sin(k*90)*.012;squash(g,1-.12*k);}if(k>.3&&Math.random()<.2)S.sfx('tick');});
 // The sentence: a seal opens overhead.
 S.cam({at:up(kp,1.3),yaw:1.2,pitch:-.1,w:3.6,h:4.4,dur:.35});S.sfx('royal');const seal=S.sigil(up(kp,3),wc,.2),bm=S.beam(wc);
 await S.tween(.5,k=>{seal.scale.setScalar(.2+1.3*easeOut(k));seal.rotation.y=k*5;if(g){g.rotation.y=y0;g.rotation.x=-.2*k;}if(Math.random()<.7)S.motes(up(kp,2.8),1,wc);});await S.wait(.12);
 S.cam({at:up(kp,.7),yaw:1.5,pitch:.14,w:4.4,h:3.2,dur:.08});S.sfx('whoosh');await S.tween(.08,k=>bm.set(up(kp,7),up(kp,0),.55*k));
 S.hit(tgt,1.6,wc);S.sfx('impact');S.sfx('boom');S.ring(kp,wc,{r1:5,dur:.8});S.ring(kp,0xffffff,{r1:2.6,dur:.4,width:.08});crack(S,kp,1.5);S.dust(kp,24);S.debris(up(kp,.1),12,0x8a7ab0,{speed:3.5,up:4,size:.08});beams.forEach(({b})=>b.off());
 S.tween(.35,k=>{bm.set(up(kp,7),up(kp,0),.55*(1-k));bm.opacity(1-k);seal.material.opacity=1-k;}).then(()=>{bm.off();S.drop(seal);});
 if(g){g.scale.setScalar(1);g.userData.fallen=true;await kingFall(S,g,away,S.teamColor(g.userData.c),true);}
 // The hall erupts.
 S.cam({at:V(0,.6,0),yaw:.35,pitch:.5,w:10.5,h:8.5,dur:.9,drift:.3});S.sfx('fanfare');S.crowdHop=1;S.flinchT=0;S.flinchAmp=.45;S.flinchAt=kp.clone();
 for(let i=0;i<5;i++){S.puff(V((Math.random()-.5)*7,3.5+Math.random()*1.5,(Math.random()-.5)*7),60,[GOLD,wc,0xffffff][i%3],{speed:5,life:2,gravity:-4,up:2,spread:2});await S.wait(.22);if(i===2){S.crowdHop=1;S.flinchT=0;}}
 await S.wait(.5);return g?S.fx.children.find(o=>o.userData.crown)||null:null;}
