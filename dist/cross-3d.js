// Three.js presentation for DAWG Cross. CrossGame owns every rule; this module draws the
// crossing at street level: roads with traffic (CC0 Kenney cars), glowing canals with neon
// rafts, sidewalk blocks with gold, and a night city lining both sides.
// World units: one lane cell is C metres. Cell (x, row) sits at world ((x - 4) * C, 0, -row * C),
// so the player hops toward -z.
import {T,quality,fitFov,texture,radial,glowStops,skyMaterial,Stage,Particles,CameraRig,Hud,AmbientLoop,loadModel,cloneModel,fitModel,pbr,castShadows,lightShaft,contactShadow,contactShadowMaterial} from './three-kit.js';
import {crossLane,laneObjects} from './pack-engine.js';
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {loadBuildings,loadSet,STREET,TRAFFIC,building,prop} from './city-art.js';
import {heatLabel} from './difficulty.js';
import {worldLook,hash} from './world.js';
import {seededRandom} from './mobile-core.js';

const C=2,COLS=9,AHEAD=16,BEHIND=6,HALF=(COLS*C)/2+C;
const wx=x=>(x-4)*C,wz=row=>-row*C;
const asphalt=()=>texture(128,128,(c,w,h)=>{c.fillStyle='#17161f';c.fillRect(0,0,w,h);for(let i=0;i<500;i++){c.fillStyle=`rgba(255,255,255,${Math.random()*.05})`;c.fillRect(Math.random()*w,Math.random()*h,2,2);}c.fillStyle='#ffe45e';for(let x=8;x<w;x+=32)c.fillRect(x,h/2-2,16,4);},{repeat:true});
const sidewalk=()=>texture(128,128,(c,w,h)=>{c.fillStyle='#2a2838';c.fillRect(0,0,w,h);c.strokeStyle='#ffffff22';c.lineWidth=2;for(let x=0;x<=w;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();},{repeat:true});
const water=()=>texture(128,128,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0a2a4a');g.addColorStop(1,'#071a33');c.fillStyle=g;c.fillRect(0,0,w,h);c.strokeStyle='#5ee7ff55';c.lineWidth=3;for(let y=10;y<h;y+=22){c.beginPath();for(let x=0;x<=w;x+=8)c.lineTo(x,y+Math.sin(x/10+y)*3);c.stroke();}},{repeat:true});

export class ThreeCross {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.cameraMode='third';this.clock=performance.now();this.status='';this.statusSince=performance.now();this.lanes=new Map();this.seed=null;this.camZ=0;this.camX=0;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d cross3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="d3-meter"><b class="d3-dist">0</b><small>ROWS</small></div><div class="d3-gold"><i></i><b>0</b></div>');this.view.append(this.hud.root);
  this.ui={rows:this.hud.q('.d3-dist'),gold:this.hud.q('.d3-gold b')};
  this.rig=new CameraRig(this.camera);this.rig.setMode('third');this.ambient=new AmbientLoop(now=>this.render(this.lastGame,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D STREETS · LIVE');return this;
 }
 setCamera(){this.rig?.setMode('third');}
 build(){const s=this.scene,high=this.quality==='high';this.stage.neonEnvironment(.6);this.stage.hdrEnvironment(undefined,.55);s.fog=new T.FogExp2(0x0a0b1c,.028);
  this.sky=new T.Mesh(new T.SphereGeometry(200,24,12),skyMaterial());s.add(this.sky);
  s.add(new T.HemisphereLight(0xa9b4ff,0x1a1028,.95));this.blobMat=contactShadowMaterial(.7);const key=this.key=new T.DirectionalLight(0xfff1e0,2.2);key.position.set(-8,20,10);s.add(key,key.target);this.stage.sunShadow(key,{size:16,far:60});
  const q=this.quality;this.mats={road:pbr({map:asphalt(),roughness:.5,metalness:.2,envMapIntensity:.8,clearcoat:.45,clearcoatRoughness:.3},q),walk:new T.MeshStandardMaterial({map:sidewalk(),roughness:.8,envMapIntensity:.4}),
   water:pbr({map:water(),emissive:0x2fb8ff,emissiveMap:water(),emissiveIntensity:.45,roughness:.12,metalness:.3,envMapIntensity:1.3,clearcoat:1,clearcoatRoughness:.05},q),
   curb:new T.MeshStandardMaterial({color:0x3a3650,roughness:.6}),raft:new T.MeshStandardMaterial({color:0x2a1f3a,roughness:.4,metalness:.3,emissive:0xff5fc8,emissiveIntensity:.25}),raftRail:new T.MeshBasicMaterial({color:new T.Color(2.2,.8,2),toneMapped:false}),
   carBody:[0xff5f6d,0xffb547,0x5ee7ff,0xc18cff].map(c=>pbr({color:c,metalness:.6,roughness:.28,emissive:c,emissiveIntensity:.12,clearcoat:1,clearcoatRoughness:.08},q))};
  this.mats.water.map.repeat.set(4,1);this.mats.water.emissiveMap.repeat.set(4,1);
  this.geo={lane:new T.PlaneGeometry(COLS*C+HALF*2,C).rotateX(-Math.PI/2),raft:new T.BoxGeometry(1,.3,C*.78),car:new T.BoxGeometry(1,.9,C*.7).translate(0,.55,0)};
  this.glowTex=radial(glowStops);this.coinMat=new T.MeshStandardMaterial({color:0xffc83d,metalness:1,roughness:.2,emissive:0xff8a00,emissiveIntensity:.6});this.coinGeo=new T.CylinderGeometry(.42,.42,.1,24).rotateX(Math.PI/2);
  this.player=new T.Group();s.add(this.player);this.shadow=new T.Mesh(new T.CircleGeometry(.6,20).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.45,depthWrite:false}));this.shadow.position.y=.03;s.add(this.shadow);
  this.particles=new Particles(s,high?300:180,this.glowTex);
  // CC0 art: traffic, street props and the city; the boxes above stand in until it arrives.
  this.art=null;Promise.all([Promise.all(TRAFFIC.map(p=>loadModel(p).catch(()=>null))),loadBuildings(),loadSet({lamp:STREET.post,signal:STREET.signal,cone:STREET.cone})]).then(([cars,buildings,props])=>{if(this.dead)return;this.art={cars:cars.filter(Boolean),buildings,props};this.resetLanes();}).catch(()=>{});
 }
 resetLanes(){for(const l of this.lanes.values())l.group.removeFromParent();this.lanes.clear();}
 // One lane's scenery: surface, curbs, city on both sides, and (for roads) a pool of vehicles.
 lane(g,row){let l=this.lanes.get(row);if(l)return l;const info=crossLane(row,g.worldSeed),grp=new T.Group(),z=wz(row),art=this.art,rnd=(i)=>hash(g.worldSeed+row*7,i);
  const surface=new T.Mesh(this.geo.lane,info.type==='road'?this.mats.road:info.type==='river'?this.mats.water:this.mats.walk);surface.position.set(0,info.type==='river'?-.12:0,z);grp.add(surface);
  if(info.type!=='river')for(const side of [-1,1]){const curb=new T.Mesh(new T.BoxGeometry(.3,.18,C),this.mats.curb);curb.position.set(side*(COLS*C/2+.4),.09,z);grp.add(curb);}
  // The city: a building on each side of every other row, set back from the street.
  if(art?.buildings.length&&row%2===0)for(const side of [-1,1]){const lr=seededRandom(((g.worldSeed*31+row*977+(side>0?1:2))>>>0)||1);grp.add(building(art.buildings,lr,{x:side*(HALF+4+lr()*3),z,height:8+lr()*18,facing:side>0?-Math.PI/2:Math.PI/2}));}
  if(art?.props.lamp&&info.type==='park'&&row%3===0)for(const side of [-1,1]){grp.add(prop(art.props.lamp,{x:side*(COLS*C/2+1.2),z,size:4,facing:side>0?-Math.PI/2:Math.PI/2}));const glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(1.2,1,.8),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));glow.position.set(side*(COLS*C/2-.2),3.8,z);glow.scale.set(2.2,2.2,1);grp.add(glow);if(this.quality==='high'){const shaft=lightShaft(0xffd9a8,{length:3.9,radius:1.5,top:.15,opacity:.22});shaft.position.set(side*(COLS*C/2-.2),3.85,z);grp.add(shaft);}}
  if(art?.props.signal&&info.type==='road'&&rnd(20)<.25){const side=rnd(21)<.5?-1:1;grp.add(prop(art.props.signal,{x:side*(COLS*C/2+1),z:z+C*.4,size:4,facing:side>0?-Math.PI/2:Math.PI/2}));}
  const coin=info.type==='park'&&info.coin!==null?new T.Mesh(this.coinGeo,this.coinMat):null;if(coin){coin.position.set(wx(info.coin),.7,z);grp.add(coin);}
  castShadows(grp,this.quality);l={info,group:grp,coin,movers:[]};this.scene.add(grp);this.lanes.set(row,l);return l;}
 // Vehicles or rafts for a lane, pooled: as many as the lane shows at once.
 mover(l,i){if(l.movers[i])return l.movers[i];const info=l.info,dir=info.direction;let m;
  if(info.type==='road'){const cars=this.art?.cars||[];if(cars.length){const car=fitModel(cloneModel(cars[(info.color+i)%cars.length]),Math.max(2.4,info.length*C*.92));m=new T.Group();m.add(car);m.rotation.y=dir>0?Math.PI/2:-Math.PI/2;}else{m=new T.Mesh(this.geo.car,this.mats.carBody[info.color%4]);m.scale.x=info.length*C*.92;}
   const lights=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(1.3,1.2,.9),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));lights.scale.set(1.1,.7,1);lights.position.set(0,.6,0);m.userData.lights=lights;this.scene.add(lights);}
  else{m=new T.Group();const deck=new T.Mesh(this.geo.raft,this.mats.raft);deck.scale.x=info.length*C;deck.position.y=.02;const rail=new T.Mesh(new T.BoxGeometry(1,.06,.08),this.mats.raftRail);rail.scale.x=info.length*C;rail.position.set(0,.2,C*.39);const rail2=rail.clone();rail2.position.z=-C*.39;m.add(deck,rail,rail2);}
  castShadows(m,this.quality,false);if(info.type==='road'&&this.quality==='high'){const len=info.length*C*.95,blob=contactShadow(1,1,this.blobMat);if(m.isMesh)blob.scale.set(1.08,1,C*.95);else blob.scale.set(C*.95,1,len*1.08);blob.position.y=.02;m.add(blob);}l.group.add(m);l.movers[i]=m;return m;}
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;try{const next=createDawgAsset(d),b=new T.Box3().setFromObject(next.root),h=b.getSize(new T.Vector3()).y||1;next.root.scale.setScalar(1.5/h);next.root.rotation.y=Math.PI;castShadows(next.root,this.quality,false);if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.player.add(next.root);}catch{}}
 event(e,g){if(!this.ready)return;const p=this.player.position,st=this.stage,hud=this.hud;
  if(e.type==='step')this.particles.burst(p.x,.2,p.z,8,0xffffff,{speed:2,life:.3,up:1});
  else if(e.type==='coin'){this.particles.burst(p.x,.8,p.z,30,0xffc14d,{speed:4,life:.7});hud.pop('+25');st.shake(.1);}
  else if(e.type==='heat'){hud.banner(heatLabel(e.tier));st.flashOnce(0xff7a3d,.2,this.reduced);}
  else if(e.type==='over'){this.particles.burst(p.x,1,p.z,90,0xff4f6a,{speed:7,life:1});st.shake(.8);st.flashOnce(0xff3355,.5,this.reduced);}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.reduced=reduced;this.prepare(d);const now=performance.now();this.ambient.drew(now);this.render(g,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<2500));return true;}
 render(g,now){
  this.stage.resize();const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}if(this.seed!==g.worldSeed){this.seed=g.worldSeed;this.resetLanes();}
  const look=worldLook(g.worldSeed),glow=new T.Color(look.glow),accent=new T.Color(look.accent),u=this.sky.material.uniforms;u.uTop.value.set(0x03040c);u.uHorizon.value.copy(glow).multiplyScalar(.12);u.uGlow.value.copy(accent).multiplyScalar(.15);this.scene.fog.color.copy(glow).multiplyScalar(.05);
  // Player: glide between cells during a hop, with a little arc.
  const f=g.hop>0?1-g.hop/.13:1,px=g.from.x+(g.x-g.from.x)*f,prow=g.from.row+(g.row-g.from.row)*f,arc=g.hop>0&&!reduced?Math.sin(f*Math.PI)*.8:0;
  this.player.position.set(wx(px),arc,wz(prow));this.stage.followSun(this.key,wx(px)*.5,0,wz(prow)-3);this.shadow.position.set(wx(px),.03,wz(prow));this.shadow.scale.setScalar(1-arc*.4);
  if(this.asset)setDawgPose(this.asset,real,g.hop>0?'run':'idle');
  // Lanes around the player; drop the ones far behind or ahead.
  const base=Math.max(0,Math.floor(prow));for(let r=base-BEHIND;r<=base+AHEAD;r++){if(r<-2)continue;const l=this.lane(g,r);
   if(l.coin){l.coin.visible=!g.collected.has(r);l.coin.rotation.y=reduced?0:real*3;}
   if(l.info.type!=='park'){const objs=laneObjects(l.info,g.time);objs.forEach((o,i)=>{const m=this.mover(l,i);m.visible=true;m.position.set(wx(o.x+o.width/2),l.info.type==='river'?-.05+(reduced?0:Math.sin(real*2+i)*.04):0,wz(r));if(m.userData.lights){m.userData.lights.visible=true;m.userData.lights.position.set(m.position.x+l.info.direction*o.width*C*.5,.6,m.position.z);}});for(let i=objs.length;i<l.movers.length;i++){l.movers[i].visible=false;if(l.movers[i].userData.lights)l.movers[i].userData.lights.visible=false;}}}
  for(const [r,l] of this.lanes)if(r<base-BEHIND-2||r>base+AHEAD+2){l.group.removeFromParent();for(const m of l.movers)m.userData.lights?.removeFromParent();this.lanes.delete(r);}
  // Camera: behind and above, easing after the player.
  this.camZ+=(wz(prow)-this.camZ)*Math.min(1,dt*(reduced?20:5));this.camX+=(wx(px)*.6-this.camX)*Math.min(1,dt*4);
  const third={pos:new T.Vector3(this.camX,10.5,this.camZ+11),at:new T.Vector3(this.camX*.9,0,this.camZ-6)};this.rig.update(dt,third,third,{follow:20});this.stage.applyShake(real,reduced);this.rig.aim();
  const cam=this.camera;cam.fov+=(fitFov(50,cam.aspect,56)-cam.fov)*Math.min(1,dt*6);cam.updateProjectionMatrix();this.sky.position.copy(cam.position);
  this.mats.water.map.offset.x=(real*.08)%1;this.mats.water.emissiveMap.offset.x=this.mats.water.map.offset.x;
  this.particles.update(dt);this.hud.set(this.ui.rows,'r',String(g.furthest));this.hud.set(this.ui.gold,'g',String(g.coins));this.hud.live(g.status==='playing');
  this.stage.render(dt,real,{reduced,aberration:.0015});
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();this.stage?.dispose();}
}
