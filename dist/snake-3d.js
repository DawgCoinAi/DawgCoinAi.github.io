// Three.js presentation for Neon Snake. SnakeGame owns every rule; this module draws the
// garden as a neon arena. First person rides the head of the light-trail with a minimap;
// third person shows the whole arena from a tilted, north-up angle.
// World units: one grid cell is one meter; cell (x, y) sits at world (x, 0, y), north is -z.
import {T,quality,fitFov,texture,radial,glowStops,skyMaterial,Stage,Particles,CameraRig,Hud,AmbientLoop} from './three-kit.js';
import {SNAKE_COLS,SNAKE_ROWS} from './snake-engine.js';
import {heatLabel} from './difficulty.js';
import {worldLook} from './world.js';
import {createDawgAsset,assetKey} from './dawg-graphics-model.js';
import {loadBuildings,loadSet,STREET,cityRing,prop} from './city-art.js';
import {seededRandom} from './mobile-core.js';

const STEP={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const HEADING={up:Math.PI,right:Math.PI/2,down:0,left:-Math.PI/2};
const EYE=.55;
const gridTexture=()=>texture(128,128,(c,w,h)=>{c.fillStyle='#070a16';c.fillRect(0,0,w,h);c.strokeStyle='#ffffff';c.globalAlpha=.55;c.lineWidth=3;c.strokeRect(1.5,1.5,w-3,h-3);c.globalAlpha=.12;c.lineWidth=1;c.beginPath();c.moveTo(w/2,0);c.lineTo(w/2,h);c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();},{repeat:true});
const gridGlow=()=>texture(128,128,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.strokeStyle='#fff';c.lineWidth=3;c.strokeRect(1.5,1.5,w-3,h-3);},{repeat:true});

export class ThreeSnake {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.cameraMode='first';this.clock=performance.now();this.status='';this.statusSince=performance.now();this.yaw=HEADING.right;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d snake3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="d3-meter"><b class="d3-dist">0</b><small>LONG</small></div><div class="d3-gold"><i></i><b>0</b></div><canvas class="m3-map" width="150" height="180" aria-hidden="true"></canvas>');this.view.append(this.hud.root);
  this.ui={len:this.hud.q('.d3-dist'),gold:this.hud.q('.d3-gold b'),map:this.hud.q('.m3-map')};
  this.rig=new CameraRig(this.camera);this.rig.setMode(this.cameraMode);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D ARENA · LIVE');return this;
 }
 setCamera(mode){this.cameraMode=mode==='third'?'third':'first';this.rig?.setMode(this.cameraMode);}
 build(){
  const s=this.scene,W=SNAKE_COLS,H=SNAKE_ROWS;this.stage.neonEnvironment(.6);this.stage.hdrEnvironment(undefined,.5);s.fog=new T.FogExp2(0x070914,.011);
  // A night city around the arena and light posts on its corners (CC0 Kenney models), loaded in the background.
  Promise.all([loadBuildings(),loadSet({post:STREET.post})]).then(([buildings,set])=>{if(this.dead)return;const rnd=seededRandom(0x5a4e),cx=(W-1)/2,cz=(H-1)/2;
   // Outside the third-person camera, and never between it and the arena.
   this.scene.add(cityRing(buildings,rnd,{cx,cz,radius:Math.max(W,H)*2.3,spread:18,count:this.quality==='high'?34:20,minH:18,maxH:48,clear:(x,z)=>!(z>cz&&Math.abs(x-cx)<W)}));
   if(set.post)for(const [x,z] of [[-1.6,-1.6],[W+.6,-1.6],[-1.6,H+.6],[W+.6,H+.6]]){this.scene.add(prop(set.post,{x,z,size:5,facing:Math.atan2(cx-x,cz-z)+Math.PI}));const glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(1.2,1,.8),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));glow.position.set(x+(cx-x)*.06,4.6,z+(cz-z)*.06);glow.scale.set(2.4,2.4,1);this.scene.add(glow);}}).catch(()=>{});
  this.sky=new T.Mesh(new T.SphereGeometry(120,24,12),skyMaterial());s.add(this.sky);
  this.hemi=new T.HemisphereLight(0x9fb2ff,0x140c22,.8);s.add(this.hemi);this.headLight=new T.PointLight(0xb9ff5e,5,5,1.6);s.add(this.headLight);
  const g=gridTexture(),gl=gridGlow();g.repeat.set(W,H);gl.repeat.set(W,H);this.gridMat=new T.MeshStandardMaterial({map:g,emissiveMap:gl,emissive:0xffffff,emissiveIntensity:.35,metalness:.6,roughness:.3,envMapIntensity:.7});
  const floor=new T.Mesh(new T.PlaneGeometry(W,H).rotateX(-Math.PI/2),this.gridMat);floor.position.set((W-1)/2,0,(H-1)/2);s.add(floor);
  const outer=new T.Mesh(new T.PlaneGeometry(W+80,H+80).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x05060c,metalness:.5,roughness:.6}));outer.position.set((W-1)/2,-.02,(H-1)/2);s.add(outer);
  // Low barrier walls around the arena with a glowing top rail.
  this.railMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});const wallMat=new T.MeshStandardMaterial({color:0x1a2040,metalness:.6,roughness:.4});
  for(const [x,z,w,d]of [[(W-1)/2,-.75,W+1,.5],[(W-1)/2,H-.25,W+1,.5],[-.75,(H-1)/2,.5,H+1],[W-.25,(H-1)/2,.5,H+1]]){const wall=new T.Mesh(new T.BoxGeometry(w,.8,d).translate(0,.4,0),wallMat);wall.position.set(x,0,z);const rail=new T.Mesh(new T.BoxGeometry(w,.06,d).translate(0,.83,0),this.railMat);rail.position.set(x,0,z);s.add(wall,rail);}
  this.rockMat=new T.MeshStandardMaterial({color:0x2a2244,metalness:.3,roughness:.4,emissive:0x5b2a9a,emissiveIntensity:.5,flatShading:true});this.rockGeo=new T.IcosahedronGeometry(.46,0).translate(0,.4,0);this.rocks=null;this.rockSeed=null;
  this.bodyMat=new T.MeshStandardMaterial({color:0x5cff9b,emissive:0x2bff7a,emissiveIntensity:.8,metalness:.3,roughness:.3,transparent:true,opacity:.95});
  this.body=new T.InstancedMesh(new T.RoundedBoxGeometry(.8,.46,.8,3,.17).translate(0,.25,0),this.bodyMat,SNAKE_COLS*SNAKE_ROWS);this.body.frustumCulled=false;s.add(this.body);
  this.headMat=new T.MeshStandardMaterial({color:0xd8ffe9,emissive:0x7dffb0,emissiveIntensity:.7,metalness:.4,roughness:.25});this.head=new T.Mesh(new T.RoundedBoxGeometry(.9,.52,.9,3,.2).translate(0,.28,0),this.headMat);s.add(this.head);
  const visor=new T.Mesh(new T.BoxGeometry(.6,.1,.05),new T.MeshBasicMaterial({color:new T.Color(3,.6,1.6),toneMapped:false}));visor.position.set(0,.38,.44);this.head.add(visor);
  this.goldMat=new T.MeshStandardMaterial({color:0xffc83d,metalness:1,roughness:.2,emissive:0xff8a00,emissiveIntensity:.45});this.food=new T.Mesh(new T.CylinderGeometry(.3,.3,.07,28).rotateX(Math.PI/2),this.goldMat);s.add(this.food);
  this.glowTex=radial(glowStops);this.foodGlow=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(1.6,1.1,.4),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.foodGlow.scale.set(1.6,1.6,1);s.add(this.foodGlow);
  this.particles=new Particles(s,this.quality==='high'?400:220,this.glowTex);this.dummy=new T.Object3D();
 }
 buildRocks(g){this.rocks?.removeFromParent();this.rocks=new T.InstancedMesh(this.rockGeo,this.rockMat,Math.max(1,g.rocks.length));g.rocks.forEach((r,i)=>{this.dummy.position.set(r.x,0,r.y);this.dummy.rotation.set(0,(r.x*7+r.y*3)%6,0);this.dummy.updateMatrix();this.rocks.setMatrixAt(i,this.dummy.matrix);});this.rocks.count=g.rocks.length;this.scene.add(this.rocks);this.rockSeed=g.worldSeed;this.dummy.rotation.set(0,0,0);
  // Minimap backdrop: arena and rocks.
  const mc=this.ui.map,cell=Math.floor(Math.min(mc.width/SNAKE_COLS,mc.height/SNAKE_ROWS)),bg=document.createElement('canvas');bg.width=mc.width;bg.height=mc.height;const b=bg.getContext('2d');b.fillStyle='#0a0c18e6';b.fillRect(0,0,bg.width,bg.height);this.cell=cell;this.off=[(mc.width-SNAKE_COLS*cell)/2,(mc.height-SNAKE_ROWS*cell)/2];b.strokeStyle='#b48cff66';b.strokeRect(this.off[0],this.off[1],SNAKE_COLS*cell,SNAKE_ROWS*cell);b.fillStyle='#6b4aa8';for(const r of g.rocks)b.fillRect(this.off[0]+r.x*cell,this.off[1]+r.y*cell,cell,cell);this.mapBg=bg;}
 // Smoothly interpolated cells: each segment glides toward the one ahead of it between steps.
 segments(g){const f=g.status==='playing'?Math.min(1,g.elapsed/g.interval):0,d=STEP[g.queued||g.dir],b=g.body;return b.map((p,i)=>{const to=i===0?{x:p.x+d[0],y:p.y+d[1]}:b[i-1];return {x:p.x+(to.x-p.x)*f,y:p.y+(to.y-p.y)*f};});}
 event(e,g){if(!this.ready)return;const h=g.body[0],st=this.stage,hud=this.hud;
  if(e.type==='coin'){this.particles.burst(h.x,.5,h.y,30,0xffc14d,{speed:4,life:.7});hud.pop('+25');st.shake(.12);}
  else if(e.type==='heat'){hud.banner(heatLabel(e.tier));st.flashOnce(0xff7a3d,.2,this.reduced);}
  else if(e.type==='over'){this.particles.burst(h.x,.5,h.y,90,0xff4f6a,{speed:7,life:1});st.shake(.9);st.flashOnce(0xff3355,.5,this.reduced);}}
 // The player's DAWG rides the head of the light trail.
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;try{const next=createDawgAsset(d);next.root.scale.setScalar(.42);next.root.position.y=.5;if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.head.add(next.root);}catch{}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.prepare(d);this.lastGame=g;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<2500));return true;}
 render(g,now){
  this.stage.resize();if(this.rockSeed!==g.worldSeed||!this.rocks)this.buildRocks(g);const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  const look=worldLook(g.worldSeed),glow=new T.Color(look.glow),accent=new T.Color(look.accent);this.railMat.color.copy(glow).multiplyScalar(1.8);this.gridMat.emissive.copy(accent).multiplyScalar(.5);
  const u=this.sky.material.uniforms;u.uTop.value.set(0x04050c);u.uHorizon.value.copy(glow).multiplyScalar(.14);u.uGlow.value.copy(accent).multiplyScalar(.2);this.scene.fog.color.copy(glow).multiplyScalar(.06);
  const seg=this.segments(g);seg.slice(1).forEach((p,i)=>{const sc=1-Math.min(.35,i*.012);this.dummy.position.set(p.x,0,p.y);this.dummy.scale.set(sc,1,sc);this.dummy.updateMatrix();this.body.setMatrixAt(i,this.dummy.matrix);});this.body.count=seg.length-1;this.body.instanceMatrix.needsUpdate=true;this.dummy.scale.set(1,1,1);
  const head=seg[0],dir=g.queued&&g.status==='playing'?g.dir:g.dir;let diff=((HEADING[dir]-this.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;this.yaw+=diff*Math.min(1,dt*(reduced?40:14));
  this.head.position.set(head.x,0,head.y);this.head.rotation.y=this.yaw;this.head.visible=this.rig.mix<.55;this.headLight.position.set(head.x,1,head.y);
  if(g.food){this.food.visible=this.foodGlow.visible=true;this.food.position.set(g.food.x,.45+(reduced?0:Math.sin(real*3)*.08),g.food.y);this.food.rotation.y=reduced?0:real*3;this.foodGlow.position.copy(this.food.position);}else this.food.visible=this.foodGlow.visible=false;
  const f=[Math.sin(this.yaw),Math.cos(this.yaw)];
  const first={pos:new T.Vector3(head.x-f[0]*.3,EYE,head.y-f[1]*.3),at:new T.Vector3(head.x+f[0]*4,EYE-.2,head.y+f[1]*4)};
  const third={pos:new T.Vector3((SNAKE_COLS-1)/2,11.5,SNAKE_ROWS+9),at:new T.Vector3((SNAKE_COLS-1)/2,0,(SNAKE_ROWS-1)/2-.5)};
  this.rig.update(dt,third,first,{follow:this.rig.mix>.5?40:8});this.stage.applyShake(real,reduced);this.rig.aim();
  const cam=this.camera;cam.fov+=(fitFov(this.rig.mix>.5?80:46,cam.aspect,this.rig.mix>.5?72:50)-cam.fov)*Math.min(1,dt*6);cam.near=.05;cam.updateProjectionMatrix();this.sky.position.copy(cam.position);
  this.particles.update(dt);this.updateHud(g,seg);this.stage.render(dt,real,{reduced,aberration:.0018});
 }
 updateHud(g,seg){
  const h=this.hud,ui=this.ui;h.set(ui.len,'l',String(g.body.length));h.set(ui.gold,'g',String(g.coins));h.live(g.status==='playing');const first=this.rig.mix>.5;ui.map.hidden=!first;if(!first||!this.mapBg)return;
  const c=ui.map.getContext('2d'),cell=this.cell,[ox,oy]=this.off;c.clearRect(0,0,ui.map.width,ui.map.height);c.drawImage(this.mapBg,0,0);
  if(g.food){c.fillStyle='#ffc83d';c.beginPath();c.arc(ox+(g.food.x+.5)*cell,oy+(g.food.y+.5)*cell,cell*.4,0,Math.PI*2);c.fill();}
  c.fillStyle='#5cff9b';for(const p of seg.slice(1))c.fillRect(ox+p.x*cell+1,oy+p.y*cell+1,cell-2,cell-2);
  const hd=seg[0];c.save();c.translate(ox+(hd.x+.5)*cell,oy+(hd.y+.5)*cell);c.rotate(-this.yaw+Math.PI);c.fillStyle='#ffffff';c.beginPath();c.moveTo(0,-cell*.75);c.lineTo(cell*.55,cell*.5);c.lineTo(-cell*.55,cell*.5);c.closePath();c.fill();c.restore();
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();this.stage?.dispose();}
}
