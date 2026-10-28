// Three.js presentation for Flappy DAWG. FlappyGame owns every rule in its 420×560 logical
// field; this module maps that field into a neon city. Each gate is a gap in a wall of towers.
// First person is a cockpit view through the gaps; third person is a three-quarter chase.
// Field pixels become meters at 30 px per meter: x → world x, (520 − y) → world y, depth is z.
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,quality,fitFov,radial,glowStops,skylineTexture,wetGround,skyMaterial,buildingShells,facadeMaterials,Stage,Particles,CameraRig,Hud,AmbientLoop} from './three-kit.js';
import {heatLabel} from './difficulty.js';
import {worldLook,hash} from './world.js';
import {loadModel} from './three-kit.js';
import {loadBuildings,loadSet,STREET,TRAFFIC,building,prop} from './city-art.js';
import {seededRandom} from './mobile-core.js';

export const PX=30;
export const fieldToWorld=(x,y)=>({x:x/PX,y:(520-y)/PX});
const SKY_LIMIT=(520-10)/PX,WALL_DEPTH=9;

export class ThreeFlappy {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.cameraMode='first';this.clock=performance.now();this.status='';this.statusSince=performance.now();this.asset=null;this.assetKey='';this.gates=new Map();this.free=[];this.travel=0;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d flappy3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="d3-meter"><b class="d3-dist">0</b><small>GATES</small></div><div class="d3-gold"><i></i><b>0</b></div>');this.view.append(this.hud.root);this.ui={gates:this.hud.q('.d3-dist'),perfect:this.hud.q('.d3-gold b')};
  this.rig=new CameraRig(this.camera);this.rig.setMode(this.cameraMode);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D SKYLINE · LIVE');return this;
 }
 setCamera(mode){this.cameraMode=mode==='third'?'third':'first';this.rig?.setMode(this.cameraMode);}
 build(){
  const s=this.scene,high=this.quality==='high';this.stage.neonEnvironment(.7);s.fog=new T.FogExp2(0x121633,.03);
  this.sky=new T.Mesh(new T.SphereGeometry(300,32,16),skyMaterial());s.add(this.sky);
  this.skyline=new T.Mesh(new T.CylinderGeometry(160,160,90,48,1,true),new T.MeshBasicMaterial({map:skylineTexture(),transparent:true,side:T.BackSide,fog:false,depthWrite:false}));this.skyline.material.map.repeat.set(4,1);s.add(this.skyline);
  this.moon=new T.Sprite(new T.SpriteMaterial({map:radial([[0,'#fffaf0'],[.32,'#fff2d6'],[.36,'#ffe3b366'],[1,'#ffd09000']]),fog:false,depthWrite:false,color:new T.Color(1.6,1.5,1.4)}));this.moon.scale.set(40,40,1);s.add(this.moon);
  this.hemi=new T.HemisphereLight(0x9fb2ff,0x20142e,1.1);const key=new T.DirectionalLight(0xdfe6ff,2);key.position.set(6,20,12);const rim=new T.DirectionalLight(0xff4fc0,1.6);rim.position.set(-8,6,-10);s.add(this.hemi,key,rim);
  this.facades=facadeMaterials();this.towerGeo=new T.BoxGeometry(1,1,1).translate(0,.5,0);
  this.frameMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.frameGeo=new T.BoxGeometry(1,.12,1);
  // Street far below, and a faint laser grid where the sky ends.
  const street=new T.Mesh(new T.PlaneGeometry(400,60).rotateX(-Math.PI/2),wetGround({color:0x0d1120,metalness:.5,roughness:.4,envMapIntensity:1,repeat:[40,6],q:this.quality}));street.position.set(0,-.02,0);s.add(street);this.street=street;
  this.laneMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,transparent:true,opacity:.7});this.lanes=new T.InstancedMesh(new T.PlaneGeometry(2,.12).rotateX(-Math.PI/2),this.laneMat,60);this.lanes.frustumCulled=false;s.add(this.lanes);
  this.limit=new T.Mesh(new T.PlaneGeometry(400,40).rotateX(Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(1,.3,.7),transparent:true,opacity:.12,depthWrite:false,side:T.DoubleSide,toneMapped:false}));this.limit.position.y=SKY_LIMIT;s.add(this.limit);
  // Background towers recycled along the route, either side of the flight path.
  this.shells=buildingShells();this.stage.extraGeometries.push(...this.shells.map(sh=>sh.g));this.city=Array.from({length:high?40:26},()=>{const m=new T.Mesh(this.shells[0].g,this.facades[0]);m.userData={a:null};s.add(m);return m;});
  this.holder=new T.Group();s.add(this.holder);this.flame=new T.Sprite(new T.SpriteMaterial({map:radial(glowStops),color:new T.Color(2.4,1.2,.4),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.flame.scale.set(.9,.9,1);this.holder.add(this.flame);
  this.glowTex=radial(glowStops);this.particles=new Particles(s,high?400:220,this.glowTex);this.m4=new T.Matrix4();
  // CC0 art in the background: a far skyline that scrolls slower (parallax), traffic on the street
  // below and lamps along it. The procedural city stays in front and until this has loaded.
  this.stage.hdrEnvironment(undefined,.5);this.farCity=[];this.traffic=[];this.lamps=[];this.trafficT=0;
  Promise.all([loadBuildings(),Promise.all(TRAFFIC.map(p=>loadModel(p).catch(()=>null))),loadSet({lamp:STREET.post})]).then(([buildings,cars,set])=>{if(this.dead)return;const rnd=seededRandom(0xf1a9),add=o=>{s.add(o);return o;};
   if(buildings.length)this.farCity=Array.from({length:high?18:12},(_,i)=>({obj:add(building(buildings,rnd,{x:0,z:-(30+rnd()*24),height:18+rnd()*28})),base:i*13}));
   const fleet=cars.filter(Boolean);if(fleet.length)this.traffic=Array.from({length:high?10:6},(_,i)=>{const dir=i%2?1:-1;return {obj:add(prop(fleet[i%fleet.length],{x:0,z:dir>0?2.4:-2.4,size:2.6,facing:dir>0?Math.PI/2:-Math.PI/2})),base:i*21,speed:dir*(2.5+rnd()*3)};});
   if(set.lamp)this.lamps=Array.from({length:12},(_,i)=>{const side=i%2?1:-1;return {obj:add(prop(set.lamp,{x:0,z:side*5,size:4.2,facing:side>0?Math.PI:0})),base:i*9};});}).catch(()=>{});
 }
 // One gate: a wall of towers above and below the gap, trimmed with glowing frames at the opening.
 makeGate(){const g=new T.Group(),upper=new T.Mesh(this.towerGeo,this.facades[0]),lower=new T.Mesh(this.towerGeo,this.facades[1]),top=new T.Mesh(this.frameGeo,this.frameMat),bottom=new T.Mesh(this.frameGeo,this.frameMat);g.add(upper,lower,top,bottom);g.userData={upper,lower,top,bottom};this.scene.add(g);return g;}
 placeGate(g,o,i){const u=g.userData,w=o.width/PX,top=fieldToWorld(0,o.center-o.gap/2).y,bot=fieldToWorld(0,o.center+o.gap/2).y,h=SKY_LIMIT+6;
  g.position.set((o.x+o.width/2)/PX,0,0);u.lower.scale.set(w,Math.max(.01,bot),WALL_DEPTH);u.upper.position.y=top;u.upper.scale.set(w,h-top,WALL_DEPTH);
  u.top.position.set(-w/2,top,0);u.top.scale.set(.16,1,WALL_DEPTH+.1);u.bottom.position.set(-w/2,bot,0);u.bottom.scale.set(.16,1,WALL_DEPTH+.1);u.upper.material=this.facades[i%4];u.lower.material=this.facades[(i+2)%4];}
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;const next=createDawgAsset(d);next.root.scale.setScalar(.42);next.root.rotation.y=Math.PI/2;next.root.position.y=-.35;if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.holder.add(next.root);}
 event(e,g){if(!this.ready)return;const p=fieldToWorld(g.x,g.y),st=this.stage,hud=this.hud,fx=this.rig.first?p.x+1.2:p.x;
  if(e.type==='score'){this.particles.burst(fx,p.y,0,e.perfect?36:14,e.perfect?0xffd25e:0xb9ff5e,{speed:4,life:.6,gravity:-2});hud.pop(e.perfect?'PERFECT +15':'+10',e.perfect?'gold':'dodge');if(e.perfect)st.flashOnce(0xffd25e,.15,this.reduced);}
  else if(e.type==='flap'){this.particles.burst(p.x-.4,p.y-.3,0,5,0xffa04d,{speed:2,life:.35,gravity:-4,up:-1});}
  else if(e.type==='heat'){hud.banner(heatLabel(e.tier));st.flashOnce(0xff7a3d,.2,this.reduced);}
  else if(e.type==='over'){this.particles.burst(fx,p.y,0,80,0xff4f6a,{speed:8,life:1});st.shake(.9);st.flashOnce(0xff3355,.5,this.reduced);}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<2500));return true;}
 render(g,d,now){
  this.stage.resize();this.prepare(d);const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  const look=worldLook(g.worldSeed),glow=new T.Color(look.glow),accent=new T.Color(look.accent);this.frameMat.color.copy(glow).multiplyScalar(2.4);this.laneMat.color.copy(accent).multiplyScalar(1.6);
  const fog=new T.Color(look.sky).lerp(new T.Color(look.floor),.4).multiplyScalar(.6);this.scene.fog.color.copy(fog);const u=this.sky.material.uniforms;u.uTop.value.copy(new T.Color(look.sky)).multiplyScalar(.35);u.uHorizon.value.copy(fog);u.uGlow.value.copy(glow).multiplyScalar(.45);this.skyline.material.color.copy(glow).lerp(new T.Color(1,1,1),.6);
  // The field scrolls past a fixed bird, so the world's travel distance is accumulated from speed.
  const speed=132+(204-132)*(g.heat||0);if(g.status==='playing')this.travel+=speed*dt/PX;
  const live=new Set();g.obstacles.forEach((o,i)=>{let gate=this.gates.get(o);if(!gate){gate=this.free.pop()||this.makeGate();gate.visible=true;this.gates.set(o,gate);}live.add(o);this.placeGate(gate,o,i+g.gates);});
  for(const [o,gate]of this.gates)if(!live.has(o)){gate.visible=false;this.free.push(gate);this.gates.delete(o);}
  const S=8;for(let i=0;i<this.lanes.count;i++){const x=((i*S-this.travel)%(60*S/2)+60*S/2)%(60*S/2)-20;this.m4.makeTranslation(x,.01,(i%2?1:-1)*3);this.lanes.setMatrixAt(i,this.m4);}this.lanes.instanceMatrix.needsUpdate=true;
  // Background towers: slot a always holds the same tower, so the skyline is stable as it scrolls.
  const half=this.city.length/2,firstSlot=Math.floor(this.travel/7)-3;for(let j=0;j<half;j++){const a=firstSlot+j,slot=((a%half)+half)%half;for(let side=0;side<2;side++){const m=this.city[slot*2+side];if(m.userData.a!==a){m.userData.a=a;const sh=this.shells[Math.floor(hash(g.worldSeed,a*2+side+700)*this.shells.length)];m.geometry=sh.g;m.material=this.facades[Math.floor(hash(g.worldSeed,a*2+side+701)*4)];m.userData.z=(side?1:-1)*(WALL_DEPTH/2+4+hash(g.worldSeed,a*2+side+702)*14);}m.position.set(a*7-this.travel+30,-2,m.userData.z);}}
  const p=fieldToWorld(g.x,g.y),tilt=Math.max(-.6,Math.min(.9,-g.vy/700));this.trafficT+=dt;
  // Loaded background art wraps around the bird: far city at half speed, street things at full speed.
  const wrap=(list,step,rate)=>{const span=list.length*step;for(const it of list){it.obj.position.x=p.x+((it.base+(it.speed||0)*this.trafficT-this.travel*rate)%span+span)%span-span*.3;}};
  if(this.farCity.length)wrap(this.farCity,13,.55);if(this.traffic.length)wrap(this.traffic,21,1);if(this.lamps.length)wrap(this.lamps,9,1);this.holder.position.set(p.x,p.y,0);this.holder.rotation.z=reduced?0:tilt;this.flame.position.set(-.45,-.15,0);this.flame.scale.setScalar(g.status==='playing'&&!reduced?.7+Math.random()*.4:.6);
  if(this.asset){this.asset.root.visible=this.rig.mix<.55;setDawgPose(this.asset,real,g.status==='playing'?'run':'idle');}
  const first={pos:new T.Vector3(p.x-.2,p.y+.12,0),at:new T.Vector3(p.x+10,p.y+(reduced?0:-g.vy/220),0)};
  const third={pos:new T.Vector3(p.x-4.2,p.y+1.6,7.5),at:new T.Vector3(p.x+4,p.y,0)};
  this.rig.update(dt,third,first,{follow:this.rig.mix>.5?30:6,roll:reduced?0:-tilt*.25*this.rig.mix});this.stage.applyShake(real,reduced);this.rig.aim();
  const cam=this.camera;cam.fov+=(fitFov(this.rig.mix>.5?82:55,cam.aspect,this.rig.mix>.5?70:56)-cam.fov)*Math.min(1,dt*6);cam.near=.05;cam.updateProjectionMatrix();
  this.sky.position.copy(cam.position);this.skyline.position.set(cam.position.x,-6,cam.position.z);this.moon.position.set(cam.position.x+80,90,cam.position.z-200);this.street.position.x=cam.position.x;this.limit.position.x=cam.position.x;
  this.particles.update(dt,{x:g.status==='playing'?-speed/PX:0,y:0,z:0});this.hud.set(this.ui.gates,'g',String(g.gates));this.hud.set(this.ui.perfect,'p',String(g.perfect));this.hud.live(g.status==='playing');
  this.stage.render(dt,real,{reduced,aberration:.0018});
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();try{this.asset?.dispose();}catch{}this.stage?.dispose();}
}
