// Three.js presentation for DAWG Dash. RunnerGame stays the only source of rules, input,
// time, collisions, scoring and checkpoints: this module reads the game and draws it.
// Its own animation frames only run while no run is ticking (idle orbit, crash camera).
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,smooth,quality,fitFov,merge,texture,radial,glowStops,skylineTexture,buildingShells,facadeMaterials,signMaterials,skyMaterial,auraMaterial,Stage,Particles,CameraRig,Hud,AmbientLoop} from './three-kit.js';
import {worldLook,hash} from './world.js';
import {heatLabel} from './difficulty.js';

export {fitFov};
export const dashQuality=quality;
export const LANE=2.4,DEPTH=.62,ROAD_HALF=4.4,WALK=3.2;
export const dashPoint=(lane,z)=>({x:(lane-1)*LANE,z:-z*DEPTH});
// Recycled scenery: slot a always sits at world distance a*spacing, so a building, sign
// or gate keeps the same look while the camera passes it and after a checkpoint resume.
export const slotZ=(a,spacing,travelled)=>travelled-a*spacing;
export const firstSlot=(spacing,travelled,behind=2)=>Math.floor(travelled/spacing)-behind;
export const jumpLift=jump=>jump>0?Math.sin((1-jump/.85)*Math.PI)*1.75:0;
export const slideAmount=slide=>{if(slide<=0)return 0;const q=1-slide/.85;return q<.12?q/.12:q>.82?(1-q)/.18:1;};

function roadTextures(){
 const puddles=Array.from({length:22},(_,i)=>({x:hash(71,i)*256,y:hash(72,i)*1024,rx:14+hash(73,i)*46,ry:40+hash(74,i)*120}));
 const map=texture(256,1024,(c,w,h)=>{c.fillStyle='#0d111b';c.fillRect(0,0,w,h);for(let i=0;i<9000;i++){const v=hash(5,i);c.fillStyle=v>.5?'#ffffff08':'#00000020';c.fillRect(hash(6,i)*w,hash(7,i)*h,2,2);}
  c.strokeStyle='#00000055';c.lineWidth=2;for(let i=0;i<14;i++){c.beginPath();let x=hash(8,i)*w,y=hash(9,i)*h;c.moveTo(x,y);for(let k=0;k<6;k++){x+=(hash(10,i*9+k)-.5)*40;y+=hash(11,i*9+k)*40;c.lineTo(x,y);}c.stroke();}
  for(const p of puddles){c.fillStyle='#05070d70';c.beginPath();c.ellipse(p.x,p.y,p.rx,p.ry,0,0,Math.PI*2);c.fill();}},{repeat:true});
 const rough=texture(256,1024,(c,w,h)=>{c.fillStyle='#c8c8c8';c.fillRect(0,0,w,h);c.filter='blur(6px)';for(const p of puddles){c.fillStyle='#5a5a5a';c.beginPath();c.ellipse(p.x,p.y,p.rx,p.ry,0,0,Math.PI*2);c.fill();}},{repeat:true,color:false});
 return {map,rough};
}
function pavement(){return texture(256,256,(c,w,h)=>{c.fillStyle='#171b28';c.fillRect(0,0,w,h);c.strokeStyle='#0a0d16';c.lineWidth=4;for(let i=0;i<=4;i++){c.beginPath();c.moveTo(0,i*64);c.lineTo(w,i*64);c.stroke();c.beginPath();c.moveTo(i*64,0);c.lineTo(i*64,h);c.stroke();}for(let i=0;i<1600;i++){c.fillStyle=hash(12,i)>.5?'#ffffff07':'#00000018';c.fillRect(hash(13,i)*w,hash(14,i)*h,2,2);}},{repeat:true});}
function crateTexture(lit){return texture(256,160,(c,w,h)=>{c.fillStyle=lit?'#000':'#3a2a22';c.fillRect(0,0,w,h);if(!lit){c.fillStyle='#4d382c';for(let y=0;y<h;y+=20)c.fillRect(0,y,w,14);c.strokeStyle='#1c130f';c.lineWidth=10;c.strokeRect(5,5,w-10,h-10);c.beginPath();c.moveTo(10,10);c.lineTo(w-10,h-10);c.moveTo(w-10,10);c.lineTo(10,h-10);c.stroke();}
 c.fillStyle='#c6ff5c';c.font='900 70px system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('▲',w/2,h/2);c.fillRect(0,0,w,7);});}
function hazardTexture(lit){return texture(256,256,(c,w,h)=>{c.fillStyle=lit?'#000':'#16141c';c.fillRect(0,0,w,h);c.save();c.beginPath();c.rect(0,0,w,74);c.rect(0,h-74,w,74);c.clip();for(let i=-4;i<12;i++){c.fillStyle=i%2?(lit?'#000':'#16141c'):'#ff6a2a';c.beginPath();c.moveTo(i*36,0);c.lineTo(i*36+36,0);c.lineTo(i*36-40,h);c.lineTo(i*36-76,h);c.fill();}c.restore();
 c.fillStyle=lit?'#ff3d5a':'#2a1c26';c.font='900 96px system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('✕',w/2,h/2+4);});}

export class ThreeDash {
 constructor(target,onFailure,{quality:q=quality()}={}){this.target=target;this.onFailure=onFailure;this.quality=q;this.ready=false;this.failed=false;this.dead=false;this.live=new Map();this.free={};this.frame=0;this.combo=0;this.asset=null;this.assetKey='';this.lastGame=null;this.statusSince=performance.now();this.status='';this.district=-1;this.clock=performance.now();this.cameraMode='third';}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;this.r=this.stage.r;
  this.hud=new Hud('<div class="d3-meter"><b class="d3-dist">0</b><small>M</small></div><div class="d3-gold"><i></i><b>0</b></div><div class="d3-zone"></div><div class="d3-power" hidden><span></span><em><s></s></em></div>');this.view.append(this.hud.root);
  this.ui={dist:this.hud.q('.d3-dist'),gold:this.hud.q('.d3-gold b'),zone:this.hud.q('.d3-zone'),power:this.hud.q('.d3-power'),powerLabel:this.hud.q('.d3-power span'),powerBar:this.hud.q('.d3-power s')};
  this.rig=new CameraRig(this.camera);this.rig.setMode(this.cameraMode);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D CITY · LIVE');return this;
 }
 setCamera(mode){this.cameraMode=mode==='first'?'first':'third';this.rig?.setMode(this.cameraMode);}
 build(){
  const s=this.scene,high=this.quality==='high';this.stage.neonEnvironment(.7);
  s.fog=new T.FogExp2(0x161a33,.0105);
  this.sky=new T.Mesh(new T.SphereGeometry(470,32,16),skyMaterial());s.add(this.sky);
  const starGeo=new T.BufferGeometry(),stars=[];for(let i=0;i<500;i++){const a=hash(91,i)*Math.PI*2,y=.12+hash(92,i)*.8,r=440;stars.push(Math.cos(a)*r*(1-y*.5),y*r,Math.sin(a)*r*(1-y*.5));}starGeo.setAttribute('position',new T.Float32BufferAttribute(stars,3));
  this.stars=new T.Points(starGeo,new T.PointsMaterial({color:0xe8e4ff,size:1.6,sizeAttenuation:false,fog:false,transparent:true,opacity:.75,depthWrite:false}));s.add(this.stars);
  this.moon=new T.Sprite(new T.SpriteMaterial({map:radial([[0,'#fffaf0'],[.32,'#fff2d6'],[.36,'#ffe3b366'],[1,'#ffd09000']]),fog:false,depthWrite:false,color:new T.Color(1.6,1.5,1.4)}));this.moon.scale.set(70,70,1);s.add(this.moon);
  this.skyline=new T.Mesh(new T.CylinderGeometry(300,300,150,64,1,true),new T.MeshBasicMaterial({map:skylineTexture(),transparent:true,side:T.BackSide,fog:false,depthWrite:false}));this.skyline.material.map.repeat.set(4,1);s.add(this.skyline);
  this.hemi=new T.HemisphereLight(0x8fa6ff,0x2a1730,1.1);s.add(this.hemi);
  this.key=new T.DirectionalLight(0xdfe6ff,2.4);this.key.position.set(-6,14,-10);s.add(this.key,this.key.target);
  if(high){this.key.castShadow=true;this.key.shadow.mapSize.set(1024,1024);Object.assign(this.key.shadow.camera,{left:-7,right:7,top:9,bottom:-9,near:1,far:40});this.key.shadow.bias=-.0004;this.key.shadow.normalBias=.03;}
  const rimA=new T.DirectionalLight(0xff4fc0,2.2);rimA.position.set(6,3,-6);const rimB=new T.DirectionalLight(0x48e6ff,2.2);rimB.position.set(-6,3,-6);const back=new T.DirectionalLight(0xffd6b0,.55);back.position.set(0,4,8);s.add(rimA,rimB,back);
  // Street: one long wet strip whose textures scroll; curbs, lane paint and props are recycled.
  const {map,rough}=roadTextures();map.repeat.set(1,460/32);rough.repeat.set(1,460/32);this.roadTex=[map,rough];
  this.road=new T.Mesh(new T.PlaneGeometry(ROAD_HALF*2,460),new T.MeshStandardMaterial({map,roughnessMap:rough,roughness:1,metalness:.35,envMapIntensity:.55,color:0x8c94ad}));this.road.rotation.x=-Math.PI/2;this.road.position.z=-170;this.road.receiveShadow=high;s.add(this.road);
  const pave=pavement();pave.repeat.set(WALK/4,460/4);this.paveTex=pave;
  for(const side of [-1,1]){const m=new T.Mesh(new T.BoxGeometry(WALK,.22,460),new T.MeshStandardMaterial({map:pave,roughness:.85,metalness:.1,envMapIntensity:.15,color:0x50566a}));m.position.set(side*(ROAD_HALF+WALK/2),.11,-170);s.add(m);}
  this.curbMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});for(const side of [-1,1]){const m=new T.Mesh(new T.BoxGeometry(.09,.09,460),this.curbMat);m.position.set(side*ROAD_HALF,.2,-170);s.add(m);}
  this.dashMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,transparent:true,opacity:.55});this.dashes=new T.InstancedMesh(new T.PlaneGeometry(.12,2.6).rotateX(-Math.PI/2),this.dashMat,2*44);this.dashes.position.y=.012;this.dashes.frustumCulled=false;s.add(this.dashes);
  this.streak=radial([[0,'#ffffffaa'],[.35,'#ffffff33'],[1,'#ffffff00']]);this.glowTex=radial(glowStops);
  this.shadowMat=new T.MeshBasicMaterial({map:radial([[0,'#000000b0'],[.55,'#00000060'],[1,'#00000000']]),transparent:true,depthWrite:false});this.shadowGeo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  // Buildings: twelve prebuilt shells with metric UVs share four facade materials.
  this.facades=facadeMaterials();this.shells=buildingShells();this.stage.extraGeometries.push(...this.shells.map(sh=>sh.g));this.signs=signMaterials();this.signGeo=new T.PlaneGeometry(1,1);
  this.headTex=new T.TextureLoader().load('assets/dawg-head-v2.webp',t=>{t.colorSpace=T.SRGBColorSpace;});
  this.billboardMat=new T.MeshBasicMaterial({map:this.headTex,transparent:true,toneMapped:false,color:new T.Color(1.35,1.35,1.35),depthWrite:false});this.frameMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});
  this.beaconTip=new T.MeshBasicMaterial({color:new T.Color(4,.35,.5),toneMapped:false});this.edgeA=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.edgeB=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.roofMat=new T.MeshStandardMaterial({color:0x252a3a,metalness:.6,roughness:.5});
  const edgeGeo=new T.BoxGeometry(.14,1,.14).translate(0,.5,0),acGeo=new T.BoxGeometry(1.4,.8,1.1).translate(0,.4,0),mastGeo=new T.CylinderGeometry(.04,.06,4,6).translate(0,2,0),tipGeo=new T.SphereGeometry(.12,10,8),roofGeo=merge([acGeo,acGeo.clone().scale(.7,1.3,.8).translate(1.6,0,.8),mastGeo.translate(-1.2,0,-1)]);
  this.buildings=[[],[]];this.BUILD_SPACING=9;this.BUILD_COUNT=high?27:20;
  for(let side=0;side<2;side++)for(let k=0;k<this.BUILD_COUNT;k++){const group=new T.Group(),body=new T.Mesh(this.shells[0].g,this.facades[0]),sign=new T.Mesh(this.signGeo,this.signs[0].mat),board=new T.Group();
   const frame=new T.Mesh(new T.PlaneGeometry(1.08,1.08),this.frameMat),face=new T.Mesh(new T.PlaneGeometry(1,1),this.billboardMat),panel=new T.Mesh(new T.PlaneGeometry(1.04,1.04),new T.MeshBasicMaterial({color:0x06040c}));panel.position.z=.01;face.position.z=.02;board.add(frame,panel,face);
   const edge=new T.Mesh(edgeGeo,this.edgeA),roof=new T.Group(),props=new T.Mesh(roofGeo,this.roofMat),tip=new T.Mesh(tipGeo,this.beaconTip);tip.position.set(-1.2,4.05,-1);roof.add(props,tip);
   group.add(body,sign,board,edge,roof);group.userData={a:null,body,sign,board,edge,roof};this.buildings[side].push(group);s.add(group);}
  // Every lamp on both sides is one instance of three batched meshes; arms reach over the road.
  this.lampMat=new T.MeshStandardMaterial({color:0x2a2f40,metalness:.8,roughness:.35});const lampHead=new T.MeshBasicMaterial({color:new T.Color(3,2.4,1.7),toneMapped:false}),streakMat=new T.MeshBasicMaterial({map:this.streak,transparent:true,depthWrite:false,blending:T.AdditiveBlending,color:new T.Color(1,.75,.45),opacity:.55});
  const pole=new T.CylinderGeometry(.07,.09,6.4,8).translate(0,3.2,0),arm=new T.BoxGeometry(1.6,.08,.08).translate(-.8,6.3,0),head=new T.BoxGeometry(.7,.12,.3).translate(-1.5,6.22,0),streakGeo=new T.PlaneGeometry(1.6,9).rotateX(-Math.PI/2).translate(-1.6,.02,1.4);
  this.LAMP_SPACING=16;this.LAMP_COUNT=high?15:11;const n=this.LAMP_COUNT*2;this.lampParts=[new T.InstancedMesh(merge([pole,arm]),this.lampMat,n),new T.InstancedMesh(head,lampHead,n),new T.InstancedMesh(streakGeo,streakMat,n)];for(const m of this.lampParts){m.frustumCulled=false;s.add(m);}
  // Neon gates arch over the road every 64 m and alternate district colors.
  this.gateA=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.gateB=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.gateStreakA=new T.MeshBasicMaterial({map:this.streak,transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.5});this.gateStreakB=this.gateStreakA.clone();
  const pillar=new T.BoxGeometry(.35,7.2,.35).translate(0,3.6,0),beam=new T.BoxGeometry(ROAD_HALF*2+1.8,.32,.32),tube=new T.CylinderGeometry(.07,.07,ROAD_HALF*2+1.4,8).rotateZ(Math.PI/2),post=new T.CylinderGeometry(.06,.06,7,8),gStreak=new T.PlaneGeometry(ROAD_HALF*2,7).rotateX(-Math.PI/2);
  this.gates=[];this.GATE_SPACING=64;for(let k=0;k<6;k++){const g=new T.Group(),mat=k%2===0?this.gateA:this.gateB;for(const side of [-1,1]){const p=new T.Mesh(pillar,this.lampMat);p.position.x=side*(ROAD_HALF+.9);const t=new T.Mesh(post,mat);t.position.set(side*(ROAD_HALF+.65),3.5,0);g.add(p,t);}
   const b=new T.Mesh(beam,this.lampMat);b.position.y=7.2;const t=new T.Mesh(tube,mat);t.position.set(0,6.9,.22);const t2=t.clone();t2.position.y=6.55;const st=new T.Mesh(gStreak,k%2===0?this.gateStreakA:this.gateStreakB);st.position.set(0,.03,2.5);g.add(b,t,t2,st);this.gates.push(g);s.add(g);}
  // Obstacles, coins and power-ups share geometry and materials and are pooled per type.
  this.crateMat=new T.MeshStandardMaterial({map:crateTexture(false),emissiveMap:crateTexture(true),emissive:0xffffff,emissiveIntensity:1.35,roughness:.6,metalness:.3});
  this.hazardMat=new T.MeshStandardMaterial({map:hazardTexture(false),emissiveMap:hazardTexture(true),emissive:0xffffff,emissiveIntensity:2,roughness:.5,metalness:.4});
  this.metalMat=new T.MeshStandardMaterial({color:0x3a3f52,metalness:.85,roughness:.3});this.barMat=new T.MeshBasicMaterial({color:new T.Color(.6,3.2,3.4),toneMapped:false});this.beaconMat=new T.MeshBasicMaterial({color:new T.Color(4,.4,.6),toneMapped:false});
  this.goldMat=new T.MeshStandardMaterial({color:0xffc83d,metalness:1,roughness:.18,emissive:0xff8a00,emissiveIntensity:.55,envMapIntensity:2.2});
  this.coinGeo=new T.CylinderGeometry(.56,.56,.12,40).rotateX(Math.PI/2);this.coinRim=new T.TorusGeometry(.56,.045,8,40);
  this.shieldMat=new T.MeshStandardMaterial({color:0x7ffcff,emissive:0x34e8ff,emissiveIntensity:2.4,metalness:.4,roughness:.2,transparent:true,opacity:.9});
  this.magnetMat=new T.MeshStandardMaterial({color:0xff4f6a,emissive:0xff2448,emissiveIntensity:1.8,metalness:.6,roughness:.25});this.tipMat=new T.MeshStandardMaterial({color:0xe8ecff,metalness:1,roughness:.15});
  this.glowMats={gold:this.additive(0xffb43a),shield:this.additive(0x48e6ff),magnet:this.additive(0xff4f8a)};
  // Player: holder carries jump and lane; pivot (at the body's centre) carries flips and leans.
  this.holder=new T.Group();this.pivot=new T.Group();this.pivot.position.y=1;this.holder.add(this.pivot);s.add(this.holder);this.playerShadow=new T.Mesh(this.shadowGeo,this.shadowMat);this.playerShadow.position.y=.03;s.add(this.playerShadow);
  this.aura=new T.Mesh(new T.SphereGeometry(1.25,32,20),auraMaterial());this.aura.position.y=1.05;this.aura.visible=false;this.holder.add(this.aura);
  this.particles=new Particles(s,high?700:360,this.glowTex);
  this.lines=new T.InstancedMesh(new T.PlaneGeometry(.03,4.5).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(1.6,2,2.4),transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),48);this.lines.frustumCulled=false;this.lineSeeds=Array.from({length:48},(_,i)=>({x:hash(501,i),y:hash(502,i),z:hash(503,i)}));s.add(this.lines);
  const R=this.RAIN=high?1400:600,rg=new T.BufferGeometry();this.rainPos=new Float32Array(R*6);this.rainSeed=Array.from({length:R},(_,i)=>[hash(601,i),hash(602,i),hash(603,i)]);rg.setAttribute('position',new T.BufferAttribute(this.rainPos,3).setUsage(T.DynamicDrawUsage));
  this.rain=new T.LineSegments(rg,new T.LineBasicMaterial({color:0xa9c4ff,transparent:true,opacity:.32,depthWrite:false,fog:false}));this.rain.frustumCulled=false;s.add(this.rain);
  this.colors={sky:new T.Color(),floor:new T.Color(),glow:new T.Color(),accent:new T.Color()};this.goal={sky:new T.Color(),floor:new T.Color(),glow:new T.Color(),accent:new T.Color()};this.m4=new T.Matrix4();this.v3=new T.Vector3();this.q=new T.Quaternion();this.e=new T.Euler();this.sc=new T.Vector3(1,1,1);
 }
 additive(color){return new T.SpriteMaterial({map:this.glowTex,color:new T.Color(color).multiplyScalar(1.6),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});}
 makeObject(type){
  const g=new T.Group(),shadow=new T.Mesh(this.shadowGeo,this.shadowMat);shadow.position.y=.025;g.add(shadow);
  if(type==='crate'){const box=new T.Mesh(new T.BoxGeometry(1.9,1.05,1.3).translate(0,.525,0),this.crateMat);box.castShadow=true;g.add(box);shadow.scale.set(2.6,1,2);}
  else if(type==='bar'){for(const x of [-1.08,1.08]){const p=new T.Mesh(new T.BoxGeometry(.16,2.2,.16).translate(0,1.1,0),this.metalMat);p.position.x=x;p.castShadow=true;g.add(p);}const tube=new T.Mesh(new T.CylinderGeometry(.08,.08,2.3,12).rotateZ(Math.PI/2),this.barMat);tube.position.y=1.42;const tube2=tube.clone();tube2.position.y=2.12;g.add(tube,tube2);const glow=new T.Sprite(this.additive(0x48e6ff));glow.scale.set(3.4,1.1,1);glow.position.y=1.42;g.add(glow);shadow.scale.set(2.8,1,.8);}
  else if(type==='block'){const wall=new T.Mesh(new T.BoxGeometry(2.1,2.5,.5).translate(0,1.25,0),this.hazardMat);wall.castShadow=true;g.add(wall);g.userData.beacons=[-.75,.75].map(x=>{const b=new T.Mesh(new T.SphereGeometry(.13,12,8),this.beaconMat.clone());b.position.set(x,2.62,0);g.add(b);return b;});shadow.scale.set(2.8,1,1.4);}
  else if(type==='coin'){const coin=new T.Group(),disc=new T.Mesh(this.coinGeo,this.goldMat),rim=new T.Mesh(this.coinRim,this.goldMat);coin.add(disc,rim);coin.position.y=1.05;g.add(coin);const glow=new T.Sprite(this.glowMats.gold);glow.scale.set(3,3,1);glow.position.y=1.05;g.add(glow);g.userData.spin=coin;shadow.scale.set(.9,1,.9);}
  else if(type==='shield'){const gem=new T.Mesh(new T.OctahedronGeometry(.45,0),this.shieldMat);gem.position.y=1.45;const glow=new T.Sprite(this.glowMats.shield);glow.scale.set(2.8,2.8,1);glow.position.y=1.45;g.add(gem,glow);g.userData.spin=gem;shadow.scale.set(1.1,1,1.1);}
  else if(type==='magnet'){const m=new T.Group(),arc=new T.Mesh(new T.TorusGeometry(.34,.11,12,24,Math.PI),this.magnetMat);m.add(arc);for(const x of [-.34,.34]){const leg=new T.Mesh(new T.CylinderGeometry(.11,.11,.32,12).translate(0,-.16,0),this.magnetMat);leg.position.x=x;const tip=new T.Mesh(new T.CylinderGeometry(.115,.115,.14,12).translate(0,-.39,0),this.tipMat);tip.position.x=x;m.add(leg,tip);}m.position.y=1.5;const glow=new T.Sprite(this.glowMats.magnet);glow.scale.set(2.8,2.8,1);glow.position.y=1.4;g.add(m,glow);g.userData.spin=m;shadow.scale.set(1.1,1,1.1);}
  return g;
 }
 claim(key,type){let o=this.live.get(key);if(!o){o=(this.free[type]||=[]).pop()||this.makeObject(type);o.userData.type=type;o.visible=true;this.scene.add(o);this.live.set(key,o);}o.userData.seen=this.frame;return o;}
 sweep(){for(const [key,o]of this.live)if(o.userData.seen!==this.frame){o.visible=false;this.live.delete(key);this.free[o.userData.type].push(o);}}
 prepare(d){
  if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;
  const next=createDawgAsset(d);next.root.rotation.y=Math.PI;next.root.traverse(o=>{if(o.isMesh){o.castShadow=this.stage.quality==='high';o.receiveShadow=false;}});
  if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;next.root.position.y=-1;this.pivot.add(next.root);
 }
 burst(...args){this.particles.burst(...args);}
 // In first person, effects that would sit inside the camera are pushed a little ahead of it.
 fxZ(z){return this.rig?.first?z-2.4:z;}
 event(e,g){
  if(!this.ready)return;const p=dashPoint(g.visualLane,0),lift=jumpLift(g.jump),st=this.stage,hud=this.hud;
  if(e.type==='coin'){this.burst(p.x,1.2+lift,this.fxZ(-.6),26,0xffc14d,{speed:6,up:2.5});hud.pop('+25');}
  else if(e.type==='power'){const shield=e.power==='shield';this.burst(p.x,1.2+lift,this.fxZ(-.4),60,shield?0x48e6ff:0xff4f8a,{speed:9,life:.9,gravity:-2});hud.pop(shield?'SHIELD UP':'MAGNET',shield?'shield':'magnet');st.shake(.25);st.flashOnce(shield?0x48e6ff:0xff4f8a,.18,this.reduced);}
  else if(e.type==='shield'){this.burst(p.x,1.1+lift,this.fxZ(-.8),90,0xb8fbff,{speed:12,life:.9,gravity:-3});hud.pop('SHIELD SAVED YOU','big');st.shake(.75);st.flashOnce(0xffffff,.45,this.reduced);this.combo=0;}
  else if(e.type==='dodge'){this.combo++;hud.pop(this.combo>1?'CLEAN ×'+this.combo:'CLEAN!','dodge');if(this.combo%5===0){this.burst(p.x,1.2+lift,this.fxZ(-.4),40,0xb9ff5e,{speed:8});st.flashOnce(0xb9ff5e,.12,this.reduced);}}
  else if(e.type==='jump'){this.burst(p.x,.15,.1,14,0x9aa3c7,{speed:2.5,life:.5,gravity:-1,up:.6,stick:1});}
  else if(e.type==='slide'){this.burst(p.x,.15,.1,18,0xffa04d,{speed:3,life:.4,gravity:-4,up:.8,stick:1});}
  else if(e.type==='heat'){hud.banner(heatLabel(e.tier));st.flashOnce(0xff7a3d,.2,this.reduced);st.shake(.2);}
  else if(e.type==='over'){this.burst(p.x,1.1,this.fxZ(-.6),120,0xff4f6a,{speed:13,life:1.1,gravity:-5});st.shake(1);st.flashOnce(0xff3355,.55,this.reduced);this.combo=0;}
 }
 draw(g,d,reduced=false){
  if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);
  this.render(g,d,now);if(g.status!=='playing')this.ambient.start(t=>!this.dead&&this.lastGame&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:this.lastGame.status==='over'&&t-this.statusSince<3200));return true;
 }
 palette(g){const district=Math.floor(g.distance/800),look=worldLook(g.worldSeed,district);
  if(district!==this.district||this.seed!==g.worldSeed){const first=this.district<0||this.seed!==g.worldSeed;this.district=district;this.seed=g.worldSeed;this.goal.sky.set(look.sky);this.goal.floor.set(look.floor);this.goal.glow.set(look.glow);this.goal.accent.set(look.accent);
   if(first)for(const k in this.colors)this.colors[k].copy(this.goal[k]);else{this.hud.banner('ENTERING '+look.label.toUpperCase());this.stage.flashOnce(look.glow,.15,this.reduced);}}
  return look;}
 render(g,d,now){
  this.stage.resize();this.prepare(d);const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;this.frame++;this.particles.reduced=this.hud.reduced=this.reduced;
  if(g.status!==this.status){this.statusFrom=this.status;this.status=g.status;this.statusSince=now;}
  const look=this.palette(g),reduced=this.reduced,c=this.colors,blend=Math.min(1,dt*1.5);for(const k in c)c[k].lerp(this.goal[k],blend);
  const travelled=g.distance*DEPTH,speed=g.speed,since=(now-this.statusSince)/1000,real=now/1000;
  // Atmosphere follows the district palette.
  const fogColor=c.sky.clone().lerp(c.floor,.4).multiplyScalar(.62);this.scene.fog.color.copy(fogColor);this.scene.fog.density=look.weather===2?.017:.0105;
  const u=this.sky.material.uniforms;u.uTop.value.copy(c.sky).multiplyScalar(.3);u.uHorizon.value.copy(fogColor);u.uGlow.value.copy(c.glow).multiplyScalar(look.weather===3?.6:.35);
  this.skyline.material.color.copy(c.glow).lerp(new T.Color(1,1,1),.65);this.curbMat.color.copy(c.glow).multiplyScalar(2.6);this.dashMat.color.copy(c.accent).multiplyScalar(1.7);
  this.gateA.color.copy(c.glow).multiplyScalar(3.2);this.gateB.color.copy(c.accent).multiplyScalar(3.2);this.gateStreakA.color.copy(c.glow);this.gateStreakB.color.copy(c.accent);
  this.hemi.color.copy(c.glow).lerp(new T.Color(0x8fa6ff),.5);this.hemi.groundColor.copy(c.floor);
  // Street textures scroll with the run so the road surface reads as speed.
  for(const tex of this.roadTex)tex.offset.y=travelled/32;this.paveTex.offset.y=travelled/4;
  for(let line=0;line<2;line++)for(let k=0;k<44;k++){const a=firstSlot(6,travelled,6)+k;this.m4.makeTranslation((line?.5:-.5)*LANE,0,slotZ(a,6,travelled));this.dashes.setMatrixAt(line*44+k,this.m4);}this.dashes.instanceMatrix.needsUpdate=true;
  this.placeBuildings(travelled,g.worldSeed);this.placeLamps(travelled);this.placeGates(travelled,real);
  // Rows: obstacles, coins and power-ups straight from the engine's state. Rows that pass the
  // DAWG keep sliding past the camera instead of vanishing on the player line.
  const p=dashPoint(g.visualLane,0),lift=jumpLift(g.jump);
  if(g!==this.memoGame){this.memoGame=g;this.memo=new Map();this.ghosts=[];}const ids=new Set(g.rows.map(r=>r.id));for(const [id,row]of this.memo)if(!ids.has(id)){this.memo.delete(id);this.ghosts.push({id,obstacles:row.obstacles,z:Math.min(0,row.z)});}for(const row of g.rows)this.memo.set(row.id,row);
  const step=g.status==='playing'?g.speed*dt:0;this.ghosts=this.ghosts.filter(gh=>(gh.z-=step)>-15);for(const gh of this.ghosts)for(const o of gh.obstacles){const pt=dashPoint(o.lane,gh.z);this.claim('o'+gh.id+':'+o.lane,o.type).position.set(pt.x,0,pt.z);}
  for(const row of g.rows){if(row.z*DEPTH>175)continue;
   for(const o of row.obstacles){const obj=this.claim('o'+row.id+':'+o.lane,o.type),pt=dashPoint(o.lane,row.z);obj.position.set(pt.x,0,pt.z);if(obj.userData.beacons){const on=Math.sin(real*9+row.id)>0;obj.userData.beacons.forEach((b,i)=>b.material.color.setRGB(on===!!i?4:.5,on===!!i?.3:.05,on===!!i?.5:.08));}}
   const cp=dashPoint(row.safe,row.z),coin=this.claim('c'+row.id,'coin');let cx=cp.x,cy=0;
   if(g.magnet>0&&row.z<38){const pull=smooth(1-row.z/38);cx+=(p.x-cx)*pull;cy=lift*pull;}coin.position.set(cx,cy+(reduced?0:Math.sin(real*3+row.id)*.12),cp.z);coin.userData.spin.rotation.y=reduced?0:real*3.4+row.id;
   if(row.power){const pw=this.claim('p'+row.id,row.power);pw.position.set(cp.x,reduced?0:Math.sin(real*2.4)*.15,cp.z-2.2);pw.userData.spin.rotation.y=real*2;}}
  this.sweep();
  this.placePlayer(g,p,lift,since,real);
  this.particles.update(dt,{x:0,y:0,z:g.status==='playing'?g.speed*DEPTH:0});
  if(g.status==='playing'&&!reduced&&g.jump===0&&g.slide===0&&!this.rig.first&&Math.random()<.35)this.burst(p.x+(Math.random()-.5)*.5,.06,.4,1,g.shield?0x48e6ff:0xb9ff5e,{speed:1,life:.35,gravity:0,up:.2,stick:1});
  this.updateLines(g,speed,travelled);this.updateRain(look,real);
  this.placeCamera(g,p,lift,dt,since,speed,real);
  this.updateHud(g,look);
  this.stage.render(dt,real,{reduced,aberration:.0025+Math.max(0,(speed-30)/10)*.003+(g.magnet>0?.003:0)});
 }
 placeBuildings(travelled,seed){
  for(let side=0;side<2;side++){const list=this.buildings[side],sign=side?1:-1;for(let k=0;k<list.length;k++){const a=firstSlot(this.BUILD_SPACING,travelled,5)+k,o=list[((a%list.length)+list.length)%list.length],u=o.userData;
   if(u.a!==a){u.a=a;const shell=this.shells[Math.floor(hash(seed,a*2+side+11)*this.shells.length)],gap=hash(seed,a*2+side+12);u.body.geometry=shell.g;u.body.material=this.facades[Math.floor(gap*4)];
    u.x=sign*(ROAD_HALF+WALK+.6+shell.w/2+gap*2.5);
    const signRoll=hash(seed,a*2+side+13),sg=this.signs[Math.floor(hash(seed,a*2+side+14)*this.signs.length)];u.sign.visible=signRoll>.32;u.board.visible=signRoll<=.32&&hash(seed,a+side+15)>.45;
    if(u.sign.visible){u.sign.material=sg.mat;const edge=-sign*shell.w/2;if(sg.vertical){const hgt=Math.min(shell.h*.55,4.5+hash(seed,a+16)*5),wide=hgt*sg.aspect;u.sign.scale.set(wide,hgt,1);u.sign.position.set(edge-sign*(wide/2+.1),Math.min(shell.h-hgt/2-1,4+hgt/2+hash(seed,a+17)*6),shell.d/2-.4);u.sign.rotation.set(0,0,0);}
     else{const wdt=Math.min(shell.w*1.15,2.4+sg.aspect*1.6);u.sign.scale.set(wdt,wdt/sg.aspect,1);u.sign.position.set(0,shell.h+wdt/sg.aspect/2+.3,shell.d/2-.6);u.sign.rotation.set(0,-sign*.55,0);}}
    const edgeOn=hash(seed,a*2+side+18);u.edge.visible=edgeOn>.4;u.edge.material=edgeOn>.7?this.edgeB:this.edgeA;u.edge.scale.y=shell.h;u.edge.position.set(-sign*(shell.w/2+.04),0,shell.d/2+.04);
    u.roof.visible=this.stage.quality==='high'&&!(u.sign.visible&&!sg.vertical);u.roof.position.set(hash(seed,a+19)*1.4-.7,shell.h,hash(seed,a+20)*1.4-.7);u.roof.rotation.y=hash(seed,a+21)*Math.PI;
    if(u.board.visible){const size=Math.min(shell.w*.85,5.5);u.board.scale.set(size,size,1);u.board.position.set(-sign*(shell.w/2+.05),Math.min(shell.h-size/2-1,6+size/2),0);u.board.rotation.set(0,-sign*Math.PI/2,0);}}
   o.position.set(u.x,0,slotZ(a,this.BUILD_SPACING,travelled));}}
  this.frameMat.color.copy(this.colors.glow).multiplyScalar(2.4);this.edgeA.color.copy(this.colors.glow).multiplyScalar(2.2);this.edgeB.color.copy(this.colors.accent).multiplyScalar(2.2);
  const blink=Math.sin(performance.now()/260)>.3;this.beaconTip.color.setRGB(blink?4:.4,blink?.35:.04,blink?.5:.05);
 }
 placeLamps(travelled){let i=0;for(let side=0;side<2;side++){this.q.setFromEuler(this.e.set(0,side?0:Math.PI,0));for(let k=0;k<this.LAMP_COUNT;k++){const a=firstSlot(this.LAMP_SPACING,travelled,this.quality==='high'?3:2)+k;this.v3.set((side?1:-1)*(ROAD_HALF+.5),0,slotZ(a,this.LAMP_SPACING,travelled)-(side?this.LAMP_SPACING/2:0));this.m4.compose(this.v3,this.q,this.sc);for(const m of this.lampParts)m.setMatrixAt(i,this.m4);i++;}}for(const m of this.lampParts)m.instanceMatrix.needsUpdate=true;}
 placeGates(travelled,real){for(let k=0;k<this.gates.length;k++){const a=firstSlot(this.GATE_SPACING,travelled,2)+k;this.gates[((a%this.gates.length)+this.gates.length)%this.gates.length].position.z=slotZ(a,this.GATE_SPACING,travelled)-30;}
  const pulse=this.reduced?1:.75+.25*Math.sin(real*5);this.gateStreakA.opacity=.45*pulse;this.gateStreakB.opacity=.45*(1.75-pulse);}
 placePlayer(g,p,lift,since,real){
  const h=this.holder,v=this.pivot,a=this.asset,over=g.status==='over',ready=g.status==='ready',first=this.rig.mix>.55;h.position.set(p.x,lift,0);v.rotation.set(0,0,0);
  if(a){a.root.visible=!first||ready;if(ready)setDawgPose(a,real,'idle');else if(over)setDawgPose(a,0,'still');else setDawgPose(a,g.time,'run');}
  // Flips belong to the chase view; in first person the camera rises with the jump instead.
  if(g.jump>0&&!this.reduced&&!first){const q=1-g.jump/.85;v.rotation.x=-smooth(Math.min(1,q*1.15))*Math.PI*2;}
  if(g.slide>0){const amt=slideAmount(g.slide);v.rotation.x=amt*1.25;h.position.y=-amt*.52;if(!this.reduced&&Math.random()<.6)this.burst(p.x+(Math.random()-.5)*.6,.08,first?-1.2:.9,2,0xffa04d,{speed:2.5,life:.35,gravity:-3,up:.5,stick:1});}
  v.rotation.z=-(g.lane-g.visualLane)*.42;
  if(over){const k=Math.min(1,since/.55);h.position.z=k*1.6;h.position.y=Math.sin(k*Math.PI)*1.1-k*.55;v.rotation.x=k*1.55;v.rotation.z=k*.6;}
  if(this.jumpWas>0&&g.jump===0&&g.status==='playing'){this.burst(p.x,.1,first?-1.5:.1,16,0x9aa3c7,{speed:3,life:.45,gravity:-1,up:.4,stick:1});this.stage.shake(.12);}this.jumpWas=g.jump;
  this.playerShadow.visible=!first||ready;this.playerShadow.position.set(p.x,.03,h.position.z);const s=1.5/(1+lift*.55);this.playerShadow.scale.set(s,1,s*.8);
  const powered=!!(g.shield||g.magnet>0);this.aura.visible=powered&&!first;if(powered){const u=this.aura.material.uniforms;u.uColor.value.set(g.shield?0x48e6ff:0xff4f8a);u.uTime.value=real;u.uAlpha.value=g.magnet>0&&g.magnet<3?(Math.sin(real*14)>0?.9:.3):.85;}
  this.key.position.set(p.x-6,14,-10);this.key.target.position.set(p.x,0,-4);
 }
 placeCamera(g,p,lift,dt,since,speed,real){
  const cam=this.camera,ready=g.status==='ready',over=g.status==='over',lean=g.lane-g.visualLane,slide=slideAmount(g.slide);
  let third={pos:new T.Vector3(p.x*.78,2.55+lift*.35,5.1),at:new T.Vector3(p.x*.9,1.45+lift*.25,-9)};
  // First person: eye height of the DAWG, rising with jumps, dropping on slides, bobbing with the stride.
  const bob=this.reduced||g.status!=='playing'||lift>0||slide>0?0:Math.abs(Math.sin(g.time*13))*.07;
  let first={pos:new T.Vector3(p.x,1.6+lift*.95-slide*.95+bob,-.15),at:new T.Vector3(p.x+lean*.6,1.35+lift*.4-slide*.6,-14)};
  const chase=third;
  if(ready){const a=Math.sin(real*.35)*.55,orbit={pos:new T.Vector3(p.x+Math.sin(a)*2.4,1.75,-4.6+Math.abs(Math.sin(a))*.6),at:new T.Vector3(p.x,1.25,0)};third=orbit;first=null;}
  else if(g.status==='playing'&&this.statusFrom==='ready'&&since<1.1){const k=smooth(since/1.1),a=Math.PI*k,R=4.6+(chase.pos.z-4.6)*k,swoop={pos:new T.Vector3(p.x+Math.sin(a)*R*(1-k)+(chase.pos.x-p.x)*k,1.75+(chase.pos.y-1.75)*k+Math.sin(k*Math.PI)*1.4,-Math.cos(a)*R),at:new T.Vector3(p.x,1.25,0).lerp(chase.at,k*k*k)};
   if(this.cameraMode==='first'){const target=first;first={pos:swoop.pos.clone().lerp(target.pos,k),at:swoop.at.clone().lerp(target.at,k)};}third=swoop;}
  else if(over){const k=smooth(Math.min(1,since/1.4)),side=p.x>0?-1:1;third={pos:chase.pos.clone().lerp(new T.Vector3(p.x+side*3.4,2.1,-3.6),k),at:chase.at.clone().lerp(new T.Vector3(p.x,.9,1),k)};
   // First-person crash: the view tips over and drops toward the street.
   first={pos:first.pos.clone().lerp(new T.Vector3(p.x,.45,.6),k),at:first.at.clone().lerp(new T.Vector3(p.x+side*4,.2,-6),k)};}
  const firstRoll=this.rig.mix>0?(over?smooth(Math.min(1,since/1.4))*.9:-lean*.12):0,roll=this.reduced?0:(-lean*.05)*(1-this.rig.mix)+firstRoll*this.rig.mix;
  this.rig.update(dt,third,first,{follow:ready||over?60:9,snap:ready&&!first,roll});this.stage.applyShake(real,this.reduced);this.rig.aim();
  const base=this.reduced?60:58+Math.max(0,speed-25)/15*9+(g.magnet>0?3:0)+this.stage.trauma*4,fov=ready?50:base+this.rig.mix*8;cam.fov+=(fitFov(fov,cam.aspect)-cam.fov)*Math.min(1,dt*4);cam.updateProjectionMatrix();
  this.sky.position.copy(cam.position);this.stars.position.copy(cam.position);this.skyline.position.set(cam.position.x,-8,cam.position.z);this.skyline.rotation.y=(g.distance*.00002)%1;this.moon.position.set(cam.position.x+150,170,cam.position.z-330);
 }
 updateLines(g,speed,travelled){
  const playing=g.status==='playing'&&!this.reduced,amount=playing?Math.min(1,Math.max(0,(speed-27)/10)+(g.magnet>0?.45:0)+this.stage.trauma*.3+this.rig.mix*.25):0;this.lines.material.opacity=amount*.55;this.lines.visible=amount>.01;if(!this.lines.visible)return;
  const cam=this.camera.position;for(let i=0;i<this.lineSeeds.length;i++){const s=this.lineSeeds[i],side=s.x<.5?-1:1;this.m4.makeTranslation(cam.x+side*(1.6+s.y*4.5),Math.max(.3,cam.y-2.6+s.z*5.5),cam.z-2-(40-((s.y*40+travelled*2.2)%40)));this.lines.setMatrixAt(i,this.m4);}this.lines.instanceMatrix.needsUpdate=true;
 }
 updateRain(look,real){
  const on=!this.reduced&&(look.weather===1||look.weather===4);this.rain.visible=on;if(!on)return;const cam=this.camera.position,fall=real*26;
  for(let i=0;i<this.RAIN;i++){const [a,b,c]=this.rainSeed[i],x=cam.x+(a-.5)*44,z=cam.z-c*70+4,y=((b*30-fall)%30+30)%30-2,k=i*6;this.rainPos[k]=x;this.rainPos[k+1]=y;this.rainPos[k+2]=z;this.rainPos[k+3]=x-.06;this.rainPos[k+4]=y+.8;this.rainPos[k+5]=z-.35;}
  this.rain.geometry.attributes.position.needsUpdate=true;
 }
 updateHud(g,look){
  const h=this.hud,ui=this.ui;h.set(ui.dist,'d',String(Math.floor(g.distance)));h.set(ui.gold,'g',String(g.coins));h.set(ui.zone,'z',look.label.toUpperCase());
  const label=g.magnet>0?'MAGNET':g.shield?'SHIELD':'';if(h.cache.p!==label){h.cache.p=label;ui.power.hidden=!label;ui.power.dataset.kind=label.toLowerCase();ui.powerLabel.textContent=label;}
  if(label)ui.powerBar.style.transform=`scaleX(${g.magnet>0?Math.min(1,g.magnet/(10+(g.career?.magnet||0))).toFixed(3):1})`;
  h.live(g.status==='playing');
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){
  if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();
  try{this.asset?.dispose();for(const list of Object.values(this.free))for(const o of list)this.scene.add(o);}catch{}
  this.stage?.dispose();
 }
}
