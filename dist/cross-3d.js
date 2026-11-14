// Three.js presentation for DAWG Cross. CrossGame owns every rule; this module draws the
// crossing at street level: wet roads with traffic (CC0 Kenney cars), glowing canals with neon
// decks, lit plazas with gold, and a night city lining both sides.
// World units: one lane cell is C metres. Cell (x, row) sits at world ((x - 4) * C, 0, -row * C),
// so the player hops toward -z.
// Everything that repeats (lanes, cars, decks, buildings, lamps, trees, coins, light pools) is
// drawn through instanced meshes, so a whole street costs a few dozen draw calls on any profile.
import {T,quality,fitFov,texture,radial,glowStops,skyMaterial,Stage,Particles,CameraRig,Hud,AmbientLoop,loadModel,pbr,merge} from './three-kit.js';
import {crossLane,laneObjects} from './pack-engine.js';
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {loadBuildings,loadSet,STREET,TRAFFIC,nightify} from './city-art.js';
import {heatLabel} from './difficulty.js';
import {worldLook,hash} from './world.js';
import {seededRandom} from './mobile-core.js';

const C=2,COLS=9,AHEAD=17,BEHIND=6,EDGE=COLS*C/2,WIDE=44;
const wx=x=>(x-4)*C,wz=row=>-row*C;
const TURN={up:0,left:Math.PI/2,right:-Math.PI/2,down:Math.PI};
const noise=(c,w,h,n,a)=>{for(let i=0;i<n;i++){c.fillStyle=`rgba(255,255,255,${Math.random()*a})`;c.fillRect(Math.random()*w,Math.random()*h,2,2);}};
// Road: wet asphalt, a dashed divider on each edge so neighbouring lanes share one line.
const asphalt=()=>texture(256,128,(c,w,h)=>{c.fillStyle='#14141d';c.fillRect(0,0,w,h);noise(c,w,h,900,.06);c.fillStyle='#0c0c13';c.fillRect(0,h*.3,w,h*.08);c.fillRect(0,h*.62,w,h*.08);c.fillStyle='#e9e4d2';c.fillRect(20,0,108,4);c.fillRect(20,h-4,108,4);},{repeat:true});
// Plaza: pale paving with a kerb line on both edges (the kerbs glow through the emissive map).
const paving=()=>texture(256,128,(c,w,h)=>{c.fillStyle='#34334e';c.fillRect(0,0,w,h);noise(c,w,h,500,.05);c.strokeStyle='#22213a';c.lineWidth=2;for(let x=0;x<=w;x+=32){c.beginPath();c.moveTo(x,10);c.lineTo(x,h-10);c.stroke();}for(const y of [h*.36,h*.64]){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}c.fillStyle='#8f8cb8';c.fillRect(0,0,w,9);c.fillRect(0,h-9,w,9);},{repeat:true});
const pavingGlow=()=>texture(256,128,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.fillStyle='#fff';c.fillRect(0,3,w,3);c.fillRect(0,h-6,w,3);},{repeat:true});
const water=lit=>texture(256,128,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,lit?'#0c5f86':'#0f4a78');g.addColorStop(.5,lit?'#06304c':'#0a3157');g.addColorStop(1,lit?'#0c5f86':'#0f4a78');c.fillStyle=g;c.fillRect(0,0,w,h);c.strokeStyle=lit?'#9af2ff':'#5ee7ff88';c.lineWidth=lit?2:3;for(let y=16;y<h-8;y+=24){c.beginPath();for(let x=0;x<=w;x+=8)c.lineTo(x,y+Math.sin(x/(w/(Math.PI*4))+y)*4);c.stroke();}c.fillStyle=lit?'#c8fbff':'#bdf6ff';c.fillRect(0,0,w,3);c.fillRect(0,h-3,w,3);},{repeat:true});
const deckTex=()=>texture(128,64,(c,w,h)=>{c.fillStyle='#3a2a52';c.fillRect(0,0,w,h);c.fillStyle='#4b3868';for(let x=0;x<w;x+=16)c.fillRect(x,0,13,h);c.fillStyle='#1c1230';c.fillRect(0,0,w,5);c.fillRect(0,h-5,w,5);},{repeat:true});

// Flattens a loaded model into one geometry per material, normalised to rest on y = 0, centred on
// x/z and scaled so `fit(size)` is one unit. Each result draws every copy in a single call.
function bake(model,fit=d=>Math.max(d.x,d.y,d.z)){
 model.updateMatrixWorld(true);const groups=new Map();
 model.traverse(o=>{if(!o.isMesh||Array.isArray(o.material)||!o.geometry?.attributes?.position)return;let g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(g.index)g=g.toNonIndexed();if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute('uv',new T.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);});
 const parts=[...groups].map(([material,gs])=>({material,geometry:merge(gs)})),box=new T.Box3();for(const p of parts){p.geometry.computeBoundingBox();box.union(p.geometry.boundingBox);}
 if(box.isEmpty())return null;const dim=box.getSize(new T.Vector3()),c=box.getCenter(new T.Vector3()),s=1/(fit(dim)||1);for(const p of parts){p.geometry.translate(-c.x,-box.min.y,-c.z);p.geometry.scale(s,s,s);}
 return {parts,size:dim.multiplyScalar(s)};
}
// A set of instanced meshes filled again every frame: begin(), put(matrix[, color]) ..., end().
class Batch {
 constructor(scene,parts,cap,{shadow=false,receive=false,order=0}={}){this.cap=cap;this.n=0;this.meshes=parts.map(p=>{const m=new T.InstancedMesh(p.geometry,p.material,cap);m.count=0;m.frustumCulled=false;m.castShadow=shadow;m.receiveShadow=receive;m.renderOrder=order;m.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(m);return m;});}
 begin(){this.n=0;}
 put(matrix,color){if(this.n>=this.cap)return;for(const m of this.meshes){m.setMatrixAt(this.n,matrix);if(color)m.setColorAt(this.n,color);}this.n++;}
 end(){for(const m of this.meshes){m.count=this.n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}}
}

export class ThreeCross {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.cameraMode='third';this.clock=performance.now();this.status='';this.statusSince=performance.now();this.rows=new Map();this.seed=null;this.camZ=0;this.camX=0;this.yaw=0;this.land=1;this.wasHop=0;this.deadT=0;this.zoom=0;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d cross3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="d3-meter"><b class="d3-dist">0</b><small>ROWS</small></div><div class="d3-gold"><i></i><b>0</b></div><div class="d3-combo" hidden><b>0</b><small>CLOSE CALLS</small></div><div class="m3-warn" hidden></div>');this.view.append(this.hud.root);
  this.ui={rows:this.hud.q('.d3-dist'),gold:this.hud.q('.d3-gold b'),close:this.hud.q('.d3-combo'),closeN:this.hud.q('.d3-combo b'),warn:this.hud.q('.m3-warn')};
  this.rig=new CameraRig(this.camera);this.rig.setMode('third');this.ambient=new AmbientLoop(now=>this.render(this.lastGame,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D STREETS · LIVE');return this;
 }
 setCamera(){this.rig?.setMode('third');}
 build(){const s=this.scene,high=this.quality==='high',q=this.quality;this.stage.neonEnvironment(.6);this.stage.hdrEnvironment(undefined,.55);s.fog=new T.FogExp2(0x0a0b1c,.024);
  this.sky=new T.Mesh(new T.SphereGeometry(200,24,12),skyMaterial());s.add(this.sky);
  this.hemi=new T.HemisphereLight(0xb4bcff,0x221430,1.05);s.add(this.hemi);const key=this.key=new T.DirectionalLight(0xfff1e0,2.3);key.position.set(-8,20,10);s.add(key,key.target);this.stage.sunShadow(key,{size:18,far:60});
  this.rim=new T.DirectionalLight(0xff5fc8,.9);this.rim.position.set(10,6,-14);s.add(this.rim);
  // Lane surfaces: one instanced strip per kind.
  const strip=new T.PlaneGeometry(WIDE,C).rotateX(-Math.PI/2),rep=t=>{t.repeat.set(WIDE/8,1);return t;},wm=rep(water(false)),we=rep(water(true));
  this.waterTex=[wm,we];this.kerb=new T.MeshStandardMaterial({map:rep(paving()),emissiveMap:rep(pavingGlow()),emissive:0xffffff,emissiveIntensity:.6,roughness:.72,metalness:.1,envMapIntensity:.5});
  this.lanes={road:new Batch(s,[{geometry:strip,material:pbr({map:rep(asphalt()),roughness:.38,metalness:.25,envMapIntensity:1,clearcoat:.7,clearcoatRoughness:.22},q)}],32,{receive:true}),
   park:new Batch(s,[{geometry:strip,material:this.kerb}],32,{receive:true}),
   river:new Batch(s,[{geometry:strip,material:pbr({map:wm,emissive:0x48d4ff,emissiveMap:we,emissiveIntensity:1.15,roughness:.1,metalness:.35,envMapIntensity:1.4,clearcoat:1,clearcoatRoughness:.04},q)}],32)};
  // The play field ends at the two glowing lines; past them the street falls into shade.
  const sideGeo=merge([-1,1].map(side=>new T.PlaneGeometry((WIDE-COLS*C)/2,90).rotateX(-Math.PI/2).translate(side*(EDGE+(WIDE-COLS*C)/4),.015,0)));this.shade=new T.Mesh(sideGeo,new T.MeshBasicMaterial({color:0x04040a,transparent:true,opacity:.42,depthWrite:false}));this.shade.renderOrder=1;s.add(this.shade);
  this.lineMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.lines=new T.Mesh(merge([-1,1].map(side=>new T.BoxGeometry(.1,.05,90).translate(side*(EDGE+.05),.03,0))),this.lineMat);s.add(this.lines);
  // Decks: a planked raft with glowing rails, and gold coins.
  const rails=merge([-1,1].map(side=>new T.BoxGeometry(1,.07,.09).translate(0,.24,side*C*.39)));
  this.decks=new Batch(s,[{geometry:new T.BoxGeometry(1,.26,C*.8).translate(0,.02,0),material:new T.MeshStandardMaterial({map:deckTex(),roughness:.55,metalness:.25,emissive:0x6a2a8a,emissiveIntensity:.18})},{geometry:rails,material:this.railMat=new T.MeshBasicMaterial({color:new T.Color(1.5,.5,1.3),toneMapped:false})}],40,{shadow:high,receive:true});
  this.coins=new Batch(s,[{geometry:new T.CylinderGeometry(.44,.44,.1,24).rotateX(Math.PI/2),material:new T.MeshStandardMaterial({color:0xffc83d,metalness:1,roughness:.18,emissive:0xff8a00,emissiveIntensity:.7,envMapIntensity:1.6})}],8,{shadow:high});
  // Light pools on the ground: headlights, tail lights, lamp light and the glow under decks.
  this.glowTex=radial(glowStops);this.pools=new Batch(s,[{geometry:new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),material:new T.MeshBasicMaterial({map:this.glowTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false})}],160,{order:2});
  for(const m of this.pools.meshes)m.setColorAt(0,new T.Color(1,1,1));
  // Lamp heads and coin halos as camera-facing points.
  this.glowPos=new Float32Array(48*3);const gg=new T.BufferGeometry();gg.setAttribute('position',new T.BufferAttribute(this.glowPos,3).setUsage(T.DynamicDrawUsage));this.glows=new T.Points(gg,new T.PointsMaterial({size:2.6,map:this.glowTex,color:new T.Color(1.25,1.02,.75),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.glows.frustumCulled=false;s.add(this.glows);
  // Neon trees for the plazas: a trunk and two stacked crowns, one draw for the lot.
  const tree=merge([new T.CylinderGeometry(.09,.13,1.1,6).translate(0,.55,0),new T.IcosahedronGeometry(.85,1).scale(1,.85,1).translate(0,1.7,0),new T.IcosahedronGeometry(.6,1).translate(.15,2.5,.1)]);
  this.treeMat=new T.MeshStandardMaterial({color:0x1f6a52,roughness:.75,emissive:0x1aa678,emissiveIntensity:.28,flatShading:true});this.trees=new Batch(s,[{geometry:tree,material:this.treeMat}],40,{shadow:high});
  // Stand-in traffic until the CC0 cars arrive (and if they never do).
  this.carBox=new Batch(s,[{geometry:new T.BoxGeometry(.5,.42,1).translate(0,.3,0),material:pbr({color:0xff5f6d,metalness:.6,roughness:.28,emissive:0xff5f6d,emissiveIntensity:.15,clearcoat:1,clearcoatRoughness:.08},q)}],80,{shadow:high});
  // The blackout: everything behind its red front has lost power.
  this.dark=new T.Mesh(new T.PlaneGeometry(WIDE,70).rotateX(-Math.PI/2).translate(0,.06,35),new T.MeshBasicMaterial({color:0x020207,transparent:true,opacity:.84,depthWrite:false}));this.dark.renderOrder=3;s.add(this.dark);
  this.front=new T.Mesh(merge([new T.PlaneGeometry(WIDE,2.4).translate(0,1.2,0),new T.BoxGeometry(WIDE,.08,.16).translate(0,.1,0)]),new T.MeshBasicMaterial({map:texture(8,64,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#ff224400');g.addColorStop(.75,'#ff224455');g.addColorStop(1,'#ff5a6aff');c.fillStyle=g;c.fillRect(0,0,w,h);}),color:new T.Color(1.6,.5,.6),transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false}));this.front.renderOrder=4;s.add(this.front);
  this.cars=[];this.buildings=[];this.lamp=null;
  this.player=new T.Group();s.add(this.player);this.shadow=new T.Mesh(new T.CircleGeometry(.72,20).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.5,depthWrite:false}));this.shadow.renderOrder=2;s.add(this.shadow);
  this.particles=new Particles(s,high?320:180,this.glowTex);this.d=new T.Object3D();this.col=new T.Color();
  // CC0 art: traffic, lamps and the city, baked into instanced batches as it arrives.
  Promise.all(TRAFFIC.map(p=>loadModel(p).catch(()=>null))).then(cars=>{if(this.dead)return;this.cars=cars.filter(Boolean).map(m=>bake(m,d=>d.z)).filter(Boolean).map(b=>({size:b.size,batch:new Batch(s,b.parts,36,{shadow:high})}));}).catch(()=>{});
  loadBuildings().then(list=>{if(this.dead)return;const rnd=seededRandom(0xc7055);this.buildings=list.slice(0,high?12:8).map(m=>bake(nightify(m,rnd))).filter(Boolean).map(b=>({size:b.size,batch:new Batch(s,b.parts,24)}));}).catch(()=>{});
  loadSet({lamp:STREET.post}).then(set=>{if(this.dead||!set.lamp)return;const b=bake(set.lamp,d=>d.y);if(b)this.lamp={size:b.size,batch:new Batch(s,b.parts,24)};}).catch(()=>{});
 }
 // What stands on one row: its lane, and the scenery either side (stable for a seed).
 row(g,r){let info=this.rows.get(r);if(info)return info;const lane=crossLane(r,g.worldSeed),h=i=>hash((g.worldSeed||0)+r*7919,i);info={lane,sides:[]};
  for(const side of [-1,1]){const k=side>0?10:0;info.sides.push({side,model:Math.floor(h(k)*64),x:side*(EDGE+7.5+h(k+1)*3.5),height:9+h(k+2)*19,turn:(h(k+3)-.5)*.3,tree:h(k+4),treeX:side*(EDGE+2.6+h(k+5)*1.8),treeS:.85+h(k+6)*.5});}
  this.rows.set(r,info);return info;}
 put(batch,x,y,z,ry,sx,sy,sz,color){const d=this.d;d.position.set(x,y,z);d.rotation.set(0,ry,0);d.scale.set(sx,sy,sz);d.updateMatrix();batch.put(d.matrix,color);}
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;try{const next=createDawgAsset(d),b=new T.Box3().setFromObject(next.root),h=b.getSize(new T.Vector3()).y||1;next.root.scale.setScalar(2/h);next.root.rotation.y=Math.PI;if(this.quality==='high')next.root.traverse(o=>{if(o.isMesh&&!o.material?.transparent)o.castShadow=true;});if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.player.add(next.root);}catch{}}
 event(e,g){if(!this.ready)return;const p=this.player.position,st=this.stage,hud=this.hud;
  if(e.type==='step'||e.type==='hop')this.particles.burst(p.x,.15,p.z,e.type==='step'?9:5,0xdfe4ff,{speed:1.8,life:.3,up:.8});
  else if(e.type==='coin'){this.particles.burst(p.x,.8,p.z,34,0xffc14d,{speed:4.5,life:.7});hud.pop('+25','gold');st.shake(.12);st.flashOnce(0xffd25e,.1,this.reduced);}
  else if(e.type==='close'){this.particles.burst(p.x,.6,p.z,16,0x7ff3ff,{speed:5,life:.4,up:.5});hud.pop('CLOSE CALL +5','dodge');st.shake(.22);}
  else if(e.type==='hurry'){hud.pop('KEEP MOVING!','big');st.flashOnce(0xff3355,.18,this.reduced);}
  else if(e.type==='heat'){hud.banner(heatLabel(e.tier));st.flashOnce(0xff7a3d,.2,this.reduced);}
  else if(e.type==='over'&&e.cause==='sweep'){this.particles.burst(p.x,.6,p.z,70,0xff2244,{speed:5,life:1.1,up:3});st.shake(.6);st.flashOnce(0x1a0008,.7,this.reduced);}
  else if(e.type==='over'){const wet=e.cause==='water'||e.cause==='drift';this.particles.burst(p.x,wet?.1:.8,p.z,wet?110:90,wet?0x6fe6ff:0xff4f6a,wet?{speed:5,life:1,up:5,gravity:-11}:{speed:8,life:1});if(e.cause==='car')this.particles.burst(p.x,.5,p.z,40,0xffffff,{speed:10,life:.35});st.shake(wet?.5:.9);st.flashOnce(wet?0x35c8ff:0xff3355,wet?.35:.5,this.reduced);}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.reduced=reduced;this.prepare(d);const now=performance.now();this.ambient.drew(now);this.render(g,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<2500));return true;}
 render(g,now){
  this.stage.resize();const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced,high=this.quality==='high';this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}if(this.seed!==g.worldSeed){this.seed=g.worldSeed;this.rows.clear();}
  const look=worldLook(g.worldSeed),glow=new T.Color(look.glow),accent=new T.Color(look.accent),u=this.sky.material.uniforms;u.uTop.value.set(0x03040c);u.uHorizon.value.copy(glow).multiplyScalar(.16);u.uGlow.value.copy(accent).multiplyScalar(.2);this.scene.fog.color.copy(glow).multiplyScalar(.06);
  this.kerb.emissive.copy(accent).multiplyScalar(.9);this.lineMat.color.copy(glow).multiplyScalar(1.7);this.treeMat.emissive.copy(accent).multiplyScalar(.45);this.rim.color.copy(glow);
  // Player: glide between cells during a hop with an arc, stretch in the air, squash on landing.
  const over=g.status==='over',f=g.hop>0?1-g.hop/.13:1,px=g.from.x+(g.x-g.from.x)*f,prow=g.from.row+(g.row-g.from.row)*f,arc=g.hop>0&&!reduced?Math.sin(f*Math.PI)*.85:0,here=this.row(g,g.row).lane;
  if(this.wasHop>0&&g.hop<=0)this.land=0;this.wasHop=g.hop;this.land+=dt;this.deadT=over?this.deadT+dt:0;
  const wet=over&&(g.cause==='water'||g.cause==='drift'),flat=over&&g.cause==='car',bob=here.type==='river'&&g.hop<=0&&!over&&!reduced?Math.sin(real*2.2)*.04-.03:0;
  const squash=reduced?0:Math.exp(-this.land*16)*.28,stretch=reduced?0:Math.sin(f*Math.PI)*.2*(g.hop>0?1:0);
  let diff=((TURN[g.facing||'up']-this.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;this.yaw+=diff*Math.min(1,dt*(reduced?40:22));
  const sink=wet?Math.min(1.7,this.deadT*3.2):0;this.player.position.set(wx(px),arc+bob-sink,wz(prow));this.player.rotation.set(0,this.yaw,0);
  this.player.scale.set(flat?1.35:1+squash*.6-stretch*.3,flat?.12:1-squash+stretch,flat?1.35:1+squash*.6-stretch*.3);this.player.visible=!(wet&&this.deadT>.6);
  this.stage.followSun(this.key,wx(px)*.5,0,wz(prow)-3);this.shadow.position.set(wx(px),here.type==='river'?.2:.03,wz(prow));this.shadow.scale.setScalar(1-arc*.4);this.shadow.visible=!wet;
  if(this.asset)setDawgPose(this.asset,real,g.hop>0?'run':'idle');
  // Fill the instanced batches for the rows around the player.
  const base=Math.max(0,Math.floor(prow)),L=this.lanes,d=this.d,col=this.col;for(const b of [L.road,L.park,L.river,this.decks,this.coins,this.pools,this.trees,this.carBox,...this.cars.map(c=>c.batch),...this.buildings.map(c=>c.batch)])b.begin();this.lamp?.batch.begin();
  let gp=0;const gpos=this.glowPos,halo=(x,y,z)=>{if(gp<48){gpos[gp*3]=x;gpos[gp*3+1]=y;gpos[gp*3+2]=z;gp++;}},pool=(x,z,w,l,r,gr,b)=>{d.position.set(x,.035,z);d.rotation.set(0,0,0);d.scale.set(w,1,l);d.updateMatrix();this.pools.put(d.matrix,col.setRGB(r,gr,b));};
  if(!wet)pool(wx(px),wz(prow),2.6,2.6,accent.r*.55,accent.g*.55,accent.b*.55);
  for(let r=base-BEHIND;r<=base+AHEAD;r++){if(r<-3)continue;const info=this.row(g,r),lane=info.lane,z=wz(r);
   this.put(L[lane.type],0,lane.type==='river'?-.14:0,z,0,1,1,1);
   for(const sd of info.sides){
    if(r%2===0&&this.buildings.length){const b=this.buildings[sd.model%this.buildings.length];this.put(b.batch,sd.x,0,z,(sd.side>0?-Math.PI/2:Math.PI/2)+sd.turn,sd.height,sd.height,sd.height);}
    if(lane.type==='park'){if(this.lamp){const lx=sd.side*(EDGE+1.1);this.put(this.lamp.batch,lx,0,z,sd.side>0?-Math.PI/2:Math.PI/2,4.2,4.2,4.2);halo(sd.side*(EDGE-.2),3.95,z);pool(sd.side*(EDGE-1.2),z,7,3.4,.5,.38,.2);}
     if(sd.tree<.8)this.put(this.trees,sd.treeX,0,z+(sd.tree-.4)*.8,sd.tree*9,sd.treeS,sd.treeS,sd.treeS);}}
   if(lane.type==='park'&&lane.coin!==null&&!g.collected.has(r)){const cy=.75+(reduced?0:Math.sin(real*3+r)*.08);this.put(this.coins,wx(lane.coin),cy,z,reduced?0:real*3,1,1,1);halo(wx(lane.coin),cy,z);pool(wx(lane.coin),z,2.4,2.4,.6,.4,.1);}
   if(lane.type==='park')continue;
   const dir=lane.direction,span=lane.speed*dir*g.time+lane.phase;
   for(const o of laneObjects(lane,g.time)){const cx=wx(o.x+o.width/2),len=o.width*C;if(Math.abs(cx)>WIDE/2+len)continue;
    if(lane.type==='river'){const y=-.06+(reduced?0:Math.sin(real*2+o.x*.7+r)*.035);this.put(this.decks,cx,y,z,0,len,1,1);pool(cx,z,len*1.5,C*1.9,.5,.12,.42);continue;}
    // A car keeps its model for as long as it is on the street, whatever its place in the list.
    const id=Math.round((o.x-span)/lane.period),ry=dir>0?Math.PI/2:-Math.PI/2,L2=Math.max(2.4,len*.92);
    if(this.cars.length){const car=this.cars[(((id+lane.color)%this.cars.length)+this.cars.length)%this.cars.length];this.put(car.batch,cx,0,z,ry,L2,L2,L2);}
    else this.put(this.carBox,cx,0,z,ry,C*.75,2,L2,col.set([0xff5f6d,0xffb547,0x5ee7ff,0xc18cff][lane.color%4]));
    pool(cx+dir*(L2/2+1.5),z,4.2,1.7,.95,.85,.6);pool(cx-dir*(L2/2+.3),z,1.5,1.5,.9,.08,.06);}}
  for(const b of [L.road,L.park,L.river,this.decks,this.coins,this.pools,this.trees,this.carBox,...this.cars.map(c=>c.batch),...this.buildings.map(c=>c.batch)])b.end();this.lamp?.batch.end();
  this.glows.geometry.setDrawRange(0,gp);this.glows.geometry.attributes.position.needsUpdate=true;
  for(const r of this.rows.keys())if(r<base-BEHIND-6||r>base+AHEAD+6)this.rows.delete(r);
  // Camera: behind and above, easing after the player; it leans in when the run ends.
  this.camZ+=(wz(prow)-this.camZ)*Math.min(1,dt*(reduced?20:5.5));this.camX+=(wx(px)*.6-this.camX)*Math.min(1,dt*4);this.zoom+=((over?1:0)-this.zoom)*Math.min(1,dt*2.5);
  const zm=reduced?0:this.zoom*.32,third={pos:new T.Vector3(this.camX,10.8-zm*6,this.camZ+10.5-zm*5),at:new T.Vector3(this.camX*.9,0,this.camZ-5.5+zm*5)};this.rig.update(dt,third,third,{follow:20});this.stage.applyShake(real,reduced);this.rig.aim();
  const cam=this.camera;cam.fov+=(fitFov(48,cam.aspect,58)-cam.fov)*Math.min(1,dt*6);cam.updateProjectionMatrix();this.sky.position.copy(cam.position);this.shade.position.z=this.lines.position.z=this.camZ-10;
  const sweepZ=wz(g.sweep??-6)+.7;this.dark.position.z=this.front.position.z=sweepZ;this.front.material.opacity=reduced?.8:.7+Math.sin(real*9)*.2;
  const off=(real*.05)%1;for(const t of this.waterTex)t.offset.x=off;
  this.particles.update(dt);const hud=this.hud,ui=this.ui,limit=15+(g.career?.idle||0),left=limit-g.idle,near=g.furthest>0&&g.row-(g.sweep??-6)<2.4,warn=g.status==='playing'&&(left<=5||near);
  hud.set(ui.rows,'r',String(g.furthest));hud.set(ui.gold,'g',String(g.coins));hud.live(g.status==='playing');if(ui.warn.hidden===warn)ui.warn.hidden=!warn;if(warn)hud.set(ui.warn,'w',near?'THE BLACKOUT IS ON YOUR TAIL':'KEEP MOVING · '+Math.max(1,Math.ceil(left)));
  const close=g.close||0;if(ui.close.hidden===(close>0))ui.close.hidden=!close;hud.set(ui.closeN,'c',String(close));
  this.stage.render(dt,real,{reduced,aberration:.0015});
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();try{this.asset?.dispose();}catch{}this.stage?.dispose();}
}
