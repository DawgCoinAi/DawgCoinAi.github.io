// Three.js presentation for DAWG Turbo Pup. TurboGame owns the rules; this module reads the
// pup and the seeded course and draws a neon track floating over the city. Third person is
// the classic side view; the "first" view is a behind-the-back chase camera.
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,smooth,quality,fitFov,texture,radial,glowStops,skylineTexture,skyMaterial,buildingShells,facadeMaterials,Stage,Particles,CameraRig,Hud,AmbientLoop} from './three-kit.js';
import {TURBO,turboChunk,chunkAt,groundIn} from './turbo-engine.js';
import {worldLook,hash} from './world.js';
import {heatLabel} from './difficulty.js';

const W=1.8,DEPTH=3.2,AHEAD=6,BEHIND=2;
// Track surface between pits: one top strip and one front wall, sampled every half meter.
function strips(c){const runs=[];let run=[];for(let x=c.x0;x<=c.x0+c.len+1e-6;x+=.5){const xx=Math.min(x,c.x0+c.len-1e-4),y=groundIn(c,xx);if(y===null){if(run.length>1)runs.push(run);run=[];}else run.push([xx,y]);}if(run.length>1)runs.push(run);return runs;}
function ribbon(points,top){const pos=[],uv=[],idx=[];points.forEach(([x,y],i)=>{if(top){pos.push(x,y,W,x,y,-W);uv.push(x/4,0,x/4,1);}else{pos.push(x,y,W,x,y-DEPTH,W);uv.push(x/4,1,x/4,0);}if(i){const a=(i-1)*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}});
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(top?idx:idx.map((v,i)=>i%3===1?idx[i+1]:i%3===2?idx[i-1]:v));g.computeVertexNormals();return g;}
function edge(points,z,h=.09){const pos=[],idx=[];points.forEach(([x,y],i)=>{pos.push(x,y+.01,z,x,y-h,z);if(i){const a=(i-1)*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}});const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);return g;}
function loopRibbon(cx,R,inward){const pos=[],idx=[],n=72;for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,r=inward?R:R+.35,x=cx+r*Math.sin(a),y=R-r*Math.cos(a);pos.push(x,y,W,x,y,-W);if(i){const b=(i-1)*2;idx.push(...(inward?[b,b+2,b+1,b+1,b+2,b+3]:[b,b+1,b+2,b+1,b+3,b+2]));}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
const panel=()=>texture(256,256,(c,w,h)=>{c.fillStyle='#1a1f33';c.fillRect(0,0,w,h);c.strokeStyle='#2b3350';c.lineWidth=4;for(let i=0;i<=4;i++){c.beginPath();c.moveTo(i*64,0);c.lineTo(i*64,h);c.stroke();}c.strokeStyle='#ffffff10';c.lineWidth=2;c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();for(let i=0;i<900;i++){c.fillStyle=hash(81,i)>.5?'#ffffff08':'#00000020';c.fillRect(hash(82,i)*w,hash(83,i)*h,2,2);}},{repeat:true});
const chevrons=color=>texture(256,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle=color;for(let i=0;i<3;i++){const x=20+i*80;c.beginPath();c.moveTo(x,10);c.lineTo(x+46,h/2);c.lineTo(x,h-10);c.lineTo(x+22,h-10);c.lineTo(x+68,h/2);c.lineTo(x+22,10);c.closePath();c.fill();}},{repeat:true});

export class ThreeTurbo {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.chunks=new Map();this.asset=null;this.assetKey='';this.cameraMode='first';this.status='';this.statusSince=performance.now();this.clock=performance.now();this.district=-1;this.combo=0;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="d3-meter"><b class="d3-dist">0</b><small>M</small></div><div class="d3-gold"><i></i><b>0</b></div><div class="d3-zone"></div><div class="d3-power" hidden><span>TURBO</span><em><s></s></em></div>');this.view.append(this.hud.root);
  this.ui={dist:this.hud.q('.d3-dist'),gold:this.hud.q('.d3-gold b'),zone:this.hud.q('.d3-zone'),power:this.hud.q('.d3-power'),bar:this.hud.q('.d3-power s')};
  this.rig=new CameraRig(this.camera);this.rig.setMode(this.cameraMode);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D TRACK · LIVE');return this;
 }
 setCamera(mode){this.cameraMode=mode==='third'?'third':'first';this.rig?.setMode(this.cameraMode);}
 build(){
  const s=this.scene,high=this.quality==='high';this.stage.neonEnvironment(.8);s.fog=new T.FogExp2(0x141831,.0085);
  this.sky=new T.Mesh(new T.SphereGeometry(470,32,16),skyMaterial());s.add(this.sky);
  this.skyline=new T.Mesh(new T.CylinderGeometry(260,260,150,64,1,true),new T.MeshBasicMaterial({map:skylineTexture(),transparent:true,side:T.BackSide,fog:false,depthWrite:false}));this.skyline.material.map.repeat.set(5,1);s.add(this.skyline);
  this.moon=new T.Sprite(new T.SpriteMaterial({map:radial([[0,'#fffaf0'],[.32,'#fff2d6'],[.36,'#ffe3b366'],[1,'#ffd09000']]),fog:false,depthWrite:false,color:new T.Color(1.6,1.5,1.4)}));this.moon.scale.set(60,60,1);s.add(this.moon);
  this.hemi=new T.HemisphereLight(0x8fa6ff,0x2a1730,1.2);this.key=new T.DirectionalLight(0xdfe6ff,2.6);this.key.position.set(-8,16,12);s.add(this.hemi,this.key,this.key.target);
  if(high){this.key.castShadow=true;this.key.shadow.mapSize.set(1024,1024);Object.assign(this.key.shadow.camera,{left:-14,right:14,top:12,bottom:-8,near:1,far:60});this.key.shadow.bias=-.0004;}
  const rim=new T.DirectionalLight(0xff4fc0,2);rim.position.set(10,4,-8);const rim2=new T.DirectionalLight(0x48e6ff,1.6);rim2.position.set(-10,3,-6);s.add(rim,rim2);
  const tex=panel();tex.repeat.set(1,1);this.trackMat=new T.MeshStandardMaterial({map:tex,metalness:.5,roughness:.4,envMapIntensity:.9,color:0xb4bcd8,side:T.DoubleSide});this.wallMat=new T.MeshStandardMaterial({map:tex,metalness:.4,roughness:.6,color:0x4a5272,side:T.DoubleSide});
  this.edgeA=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,side:T.DoubleSide});this.edgeB=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,side:T.DoubleSide});
  this.pillarMat=new T.MeshStandardMaterial({color:0x232840,metalness:.7,roughness:.4});this.pillarGeo=new T.BoxGeometry(.7,40,.7).translate(0,-20-DEPTH,0);
  this.spikeMat=new T.MeshStandardMaterial({color:0x3a0f18,emissive:0xff2448,emissiveIntensity:2.2,metalness:.5,roughness:.3});this.spikeGeo=new T.ConeGeometry(.22,.7,6).translate(0,.35,0);
  this.springMat=new T.MeshStandardMaterial({color:0xffd25e,emissive:0xffa000,emissiveIntensity:1.2,metalness:.8,roughness:.25});this.springPad=new T.MeshStandardMaterial({color:0xff3d6a,emissive:0xff2448,emissiveIntensity:1.6});
  this.boostMat=new T.MeshBasicMaterial({map:chevrons('#7ff3ff'),transparent:true,toneMapped:false,color:new T.Color(2.2,2.6,2.8),depthWrite:false});this.rampMat=new T.MeshBasicMaterial({map:chevrons('#ffd25e'),transparent:true,toneMapped:false,color:new T.Color(2.4,2,1),depthWrite:false});
  this.loopMat=new T.MeshStandardMaterial({map:tex,metalness:.55,roughness:.38,envMapIntensity:.9,color:0x9aa3c2,side:T.DoubleSide});this.ringGeo=new T.TorusGeometry(TURBO.loopRadius,.07,8,96);this.ringOuter=new T.TorusGeometry(TURBO.loopRadius+.35,.05,8,96);
  // Gold coins and the bots are pooled: coins as one instanced mesh, bots as small groups.
  this.goldMat=new T.MeshStandardMaterial({color:0xffc83d,metalness:1,roughness:.22,emissive:0xff8a00,emissiveIntensity:.3,envMapIntensity:1.2});
  this.coinCap=320;this.coins=new T.InstancedMesh(new T.CylinderGeometry(.42,.42,.1,28).rotateX(Math.PI/2),this.goldMat,this.coinCap);this.coins.frustumCulled=false;s.add(this.coins);
  this.botBody=new T.MeshStandardMaterial({color:0x5b2a74,metalness:.6,roughness:.35,emissive:0x2a0838,emissiveIntensity:.8});this.botEye=new T.MeshBasicMaterial({color:new T.Color(3.6,.6,1.4),toneMapped:false});this.bots=[];
  this.glowTex=radial(glowStops);this.particles=new Particles(s,high?600:300,this.glowTex);
  this.holder=new T.Group();this.pivot=new T.Group();this.pivot.position.y=TURBO.body;this.holder.add(this.pivot);s.add(this.holder);
  this.ball=new T.Mesh(new T.SphereGeometry(.62,24,16),new T.MeshStandardMaterial({color:0xc58a4d,metalness:.3,roughness:.4,emissive:0x3a1a08}));const band=new T.Mesh(new T.TorusGeometry(.62,.08,8,32),new T.MeshBasicMaterial({color:new T.Color(1.6,2.6,1),toneMapped:false}));this.ball.add(band);this.ball.visible=false;this.pivot.add(this.ball);
  this.shadow=new T.Mesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:radial([[0,'#000000b0'],[.6,'#00000050'],[1,'#00000000']]),transparent:true,depthWrite:false}));s.add(this.shadow);
  // A neon city far below the track: rooftops behind it in the side view, towers either side in the chase view.
  this.facades=facadeMaterials();this.shells=buildingShells();this.stage.extraGeometries.push(...this.shells.map(sh=>sh.g));this.towers=[];this.CITY_SPACING=11;this.CITY_COUNT=high?26:18;
  for(let side=0;side<2;side++)for(let i=0;i<this.CITY_COUNT;i++){const m=new T.Mesh(this.shells[0].g,this.facades[0]);m.userData={a:null,side};this.towers.push(m);s.add(m);}
  this.colors={sky:new T.Color(),floor:new T.Color(),glow:new T.Color(),accent:new T.Color()};this.goal={sky:new T.Color(),floor:new T.Color(),glow:new T.Color(),accent:new T.Color()};this.m4=new T.Matrix4();this.q=new T.Quaternion();this.v=new T.Vector3();this.sc=new T.Vector3();
 }
 // Builds the meshes for one course chunk; disposed again once it is behind the camera.
 chunkMesh(c){
  const g=new T.Group(),geos=[];g.userData.geos=geos;const add=(geo,mat,setup)=>{geos.push(geo);const m=new T.Mesh(geo,mat);setup?.(m);g.add(m);return m;};
  for(const run of strips(c)){add(ribbon(run,true),this.trackMat,m=>{m.receiveShadow=true;});add(ribbon(run,false),this.wallMat);add(edge(run,W+.01),this.edgeA);add(edge(run,-W-.01),this.edgeB);}
  for(let x=Math.ceil(c.x0/12)*12;x<c.x0+c.len;x+=12){const y=groundIn(c,x);if(y!==null){const p=new T.Mesh(this.pillarGeo,this.pillarMat);p.position.set(x,y,0);g.add(p);}}
  for(const [a,b]of c.spikes)for(let x=a;x<=b;x+=.45)for(const z of [-1.2,-.4,.4,1.2]){const m=new T.Mesh(this.spikeGeo,this.spikeMat);m.position.set(x,groundIn(c,x)??0,z);g.add(m);}
  for(const sx of c.springs){const y=groundIn(c,sx)??0,coil=new T.Mesh(new T.CylinderGeometry(.42,.42,.55,16,1,true),this.springMat),pad=new T.Mesh(new T.CylinderGeometry(.6,.6,.12,20),this.springPad);geos.push(coil.geometry,pad.geometry);coil.position.set(sx,y+.28,0);pad.position.set(sx,y+.6,0);g.add(coil,pad);}
  const decal=(x,y,len,mat,slope=0)=>{const geo=new T.PlaneGeometry(len,W*1.6).rotateX(-Math.PI/2);geos.push(geo);const m=new T.Mesh(geo,mat);m.position.set(x,y+.03,0);m.rotation.z=Math.atan(slope);g.add(m);};
  for(const bx of c.boosts)decal(bx,groundIn(c,bx)??0,3,this.boostMat);
  if(c.ramp){const r=c.ramp,mid=(r.x0+r.x1)/2;decal(mid,groundIn(c,mid)??0,r.x1-r.x0,this.rampMat,r.h/(r.x1-r.x0));}
  if(c.loop){const cx=c.loop.cx,R=TURBO.loopRadius;add(loopRibbon(cx,R,true),this.loopMat);add(loopRibbon(cx,R,false),this.wallMat);for(const z of [W,-W]){const ring=new T.Mesh(this.ringGeo,z>0?this.edgeA:this.edgeB);ring.position.set(cx,R,z);g.add(ring);const o=new T.Mesh(this.ringOuter,z>0?this.edgeB:this.edgeA);o.position.set(cx,R,z);g.add(o);}}
  g.traverse(o=>{if(o.isMesh&&o.material!==this.edgeA&&o.material!==this.edgeB)o.castShadow=this.stage.quality==='high';});this.scene.add(g);return g;
 }
 syncChunks(g){const k=chunkAt(g.worldSeed,g.x).k,keep=new Set();for(let i=Math.max(0,k-BEHIND);i<=k+AHEAD;i++){const key=g.worldSeed+':'+i;keep.add(key);if(!this.chunks.has(key))this.chunks.set(key,this.chunkMesh(turboChunk(g.worldSeed,i)));}
  for(const [key,grp]of this.chunks)if(!keep.has(key)){grp.removeFromParent();for(const geo of grp.userData.geos)geo.dispose();this.chunks.delete(key);}return k;}
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;const next=createDawgAsset(d);next.root.rotation.y=Math.PI/2;next.root.position.y=-TURBO.body;next.root.traverse(o=>{if(o.isMesh)o.castShadow=this.stage.quality==='high';});if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.pivot.add(next.root);}
 event(e,g){
  if(!this.ready)return;const c=g.center,st=this.stage,hud=this.hud,fp=this.rig.first,bz=fp?-.5:0;
  if(e.type==='coin'){this.particles.burst(c.x,c.y,bz,e.regained?10:16,0xffc14d,{speed:5,up:2});if(!e.regained)hud.pop('+10');}
  else if(e.type==='bot'){this.particles.burst(c.x,c.y,bz,50,0xff4fd8,{speed:10,life:.8});hud.pop('BOT SMASHED +100','dodge');st.shake(.3);}
  else if(e.type==='loop'){this.combo++;hud.pop('LOOP! +250','big');st.flashOnce(0x48e6ff,.18,this.reduced);}
  else if(e.type==='boost'||e.type==='boostpad'){this.particles.burst(c.x-.6,c.y,bz,30,0x7ff3ff,{speed:7,life:.5,gravity:0,up:.3});if(e.type==='boost')hud.pop('TURBO!','shield');st.shake(.15);}
  else if(e.type==='kicker'){hud.pop('AIR!','magnet');this.particles.burst(c.x,c.y-.6,bz,24,0xffd25e,{speed:6});}
  else if(e.type==='spring'){hud.pop('BOING!','magnet');st.shake(.2);this.springAt=performance.now();}
  else if(e.type==='hurt'){hud.pop(`OUCH! −${e.lost} GOLD`,'big');st.shake(.6);st.flashOnce(0xff3355,.35,this.reduced);}
  else if(e.type==='slam'){this.particles.burst(c.x,g.y+.1,bz,36,0xb9ff5e,{speed:8,life:.6,up:1});st.shake(.4);}
  else if(e.type==='land'){this.particles.burst(c.x,g.y+.1,bz,10,0x9aa3c7,{speed:3,life:.4,up:.6});}
  else if(e.type==='heat'){hud.banner(heatLabel(e.tier));st.flashOnce(0xff7a3d,.2,this.reduced);}
  else if(e.type==='over'){this.particles.burst(c.x,c.y,bz,100,0xff4f6a,{speed:12,life:1.1});st.shake(1);st.flashOnce(0xff3355,.5,this.reduced);}
 }
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:this.lastGame.status==='over'&&t-this.statusSince<3200));return true;}
 palette(g){const district=Math.floor(g.distance/800),look=worldLook(g.worldSeed,district+3);if(district!==this.district||this.seed!==g.worldSeed){const first=this.district<0||this.seed!==g.worldSeed;this.district=district;this.seed=g.worldSeed;for(const k of ['sky','floor','glow','accent'])this.goal[k].set(look[k]);if(first)for(const k in this.colors)this.colors[k].copy(this.goal[k]);else this.hud.banner('ZONE '+(district+1)+' · '+look.label.toUpperCase());}return look;}
 render(g,d,now){
  this.stage.resize();this.prepare(d);const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;this.particles.reduced=this.hud.reduced=this.reduced;const real=now/1000,reduced=this.reduced;
  if(g.status!==this.status){this.statusFrom=this.status;this.status=g.status;this.statusSince=now;}const since=(now-this.statusSince)/1000;
  const look=this.palette(g),c=this.colors;for(const k in c)c[k].lerp(this.goal[k],Math.min(1,dt*1.5));
  const fog=c.sky.clone().lerp(c.floor,.4).multiplyScalar(.42);this.scene.fog.color.copy(fog);const u=this.sky.material.uniforms;u.uTop.value.copy(c.sky).multiplyScalar(.32);u.uHorizon.value.copy(fog);u.uGlow.value.copy(c.glow).multiplyScalar(.45);
  this.edgeA.color.copy(c.glow).multiplyScalar(1.5);this.edgeB.color.copy(c.accent).multiplyScalar(1.3);this.skyline.material.color.copy(c.glow).lerp(new T.Color(1,1,1),.6);this.hemi.groundColor.copy(c.floor);
  const k=this.syncChunks(g);
  // Coins (course coins not yet collected, then scattered gold) through one instanced mesh.
  let n=0;const spin=reduced?0:real*3.2;this.q.setFromAxisAngle(this.v.set(0,1,0),spin);this.sc.set(1,1,1);
  for(let i=Math.max(0,k-1);i<=k+AHEAD&&n<this.coinCap;i++)for(const coin of turboChunk(g.worldSeed,i).coins){if(n>=this.coinCap)break;if(g.collected.includes(coin.id))continue;this.m4.compose(this.v.set(coin.x,coin.y+(reduced?0:Math.sin(real*3+coin.x)*.08),0),this.q,this.sc);this.coins.setMatrixAt(n++,this.m4);}
  for(const s of g.scatter){if(n>=this.coinCap)break;this.m4.compose(this.v.set(s.x,s.y,0),this.q,this.sc.set(.8,.8,.8));this.coins.setMatrixAt(n++,this.m4);this.sc.set(1,1,1);}
  this.coins.count=n;this.coins.instanceMatrix.needsUpdate=true;
  this.placeCity(g.x,g.worldSeed);this.placeBots(g,k,real);this.placePup(g,real,since);
  this.particles.update(dt);if(g.status==='playing'&&!reduced&&g.vx>24&&Math.random()<.5)this.particles.burst(g.center.x-.5,g.center.y,(Math.random()-.5)*2,1,0x7ff3ff,{speed:1,life:.3,gravity:0,up:0});
  this.placeCamera(g,dt,since,real);this.updateHud(g,look);
  this.stage.render(dt,real,{reduced,aberration:.0022+Math.max(0,(g.vx-22)/12)*.004});
 }
 placeCity(x,seed){const S=this.CITY_SPACING,n=this.CITY_COUNT;for(const m of this.towers){const side=m.userData.side,i=this.towers.indexOf(m)%n,a=Math.floor(x/S)-4+i,slot=((a%n)+n)%n;if(slot!==i)continue;if(m.userData.a!==a){m.userData.a=a;const h=hash(seed,a*2+side+500),sh=this.shells[Math.floor(h*this.shells.length)];m.geometry=sh.g;m.material=this.facades[Math.floor(hash(seed,a*2+side+501)*4)];m.userData.z=side?24+hash(seed,a+502)*20:-(14+hash(seed,a+502)*26);m.userData.base=-34-hash(seed,a+503)*10;}m.position.set(a*S,m.userData.base,m.userData.z);}}
 placeBots(g,k,real){let used=0;for(let i=Math.max(0,k-1);i<=k+AHEAD;i++){const ch=turboChunk(g.worldSeed,i);for(const b of ch.bots){if(g.defeated.includes(b.id))continue;let bot=this.bots[used];if(!bot){bot=this.makeBot();this.bots.push(bot);}bot.visible=true;const bx=b.x+Math.sin(g.time*b.speed+b.phase)*b.range,by=groundIn(ch,bx)??0;bot.position.set(bx,by+(this.reduced?0:Math.abs(Math.sin(real*8+b.phase))*.08),0);bot.rotation.y=Math.cos(g.time*b.speed+b.phase)>0?-Math.PI/2:Math.PI/2;used++;}}for(let i=used;i<this.bots.length;i++)this.bots[i].visible=false;}
 makeBot(){const g=new T.Group(),body=new T.Mesh(new T.BoxGeometry(.9,.7,.8).translate(0,.55,0),this.botBody),eye=new T.Mesh(new T.BoxGeometry(.5,.14,.05),this.botEye),ant=new T.Mesh(new T.CylinderGeometry(.03,.03,.4,6).translate(0,1.1,0),this.botBody),tip=new T.Mesh(new T.SphereGeometry(.08,8,6),this.botEye);eye.position.set(0,.65,.42);tip.position.y=1.32;for(const x of [-.32,.32]){const w=new T.Mesh(new T.CylinderGeometry(.18,.18,.12,12).rotateZ(Math.PI/2),this.pillarMat);w.position.set(x,.18,0);w.rotation.y=Math.PI/2;g.add(w);}g.add(body,eye,ant,tip);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});this.scene.add(g);return g;}
 placePup(g,real,since){
  const h=this.holder,v=this.pivot,a=this.asset,curled=!g.loop&&(!g.grounded||g.rolling>0),over=g.status==='over',first=this.rig.mix>.55;
  h.position.set(g.x,g.y,0);v.rotation.set(0,0,0);
  if(g.loop)v.rotation.z=g.loop.phi;else if(g.grounded){const s=(groundIn(chunkAt(g.worldSeed,g.x),g.x+.1)??g.y)-g.y;v.rotation.z=Math.atan(s*10);}
  this.ball.visible=curled&&!over;if(this.ball.visible)this.ball.rotation.z=-(g.x/.62)%(Math.PI*2);
  if(a){a.root.visible=!this.ball.visible;if(g.status==='ready')setDawgPose(a,real,'idle');else if(over)setDawgPose(a,0,'still');else setDawgPose(a,g.time*Math.max(.6,g.vx/14),'run');}
  if(over){const k=Math.min(1,since/.6);h.position.y=g.y+Math.sin(k*Math.PI)*1.5;v.rotation.z=k*2.5;}
  // Flicker while invulnerable so the player can see they are safe for a moment.
  if(g.invuln>0&&!this.reduced)h.visible=Math.floor(real*16)%2===0;else h.visible=true;
  const gy=groundIn(chunkAt(g.worldSeed,g.x),g.x);this.shadow.visible=gy!==null&&!g.loop;if(this.shadow.visible){const lift=Math.max(0,g.y-gy);this.shadow.position.set(g.x,gy+.03,0);const s=1.6/(1+lift*.4);this.shadow.scale.set(s,1,s*.8);}
  this.key.position.set(g.x-8,g.y+16,12);this.key.target.position.set(g.x,g.y,0);
 }
 placeCamera(g,dt,since,real){
  const c=g.center,lead=Math.min(6,Math.max(1,g.vx*.22)),ready=g.status==='ready',over=g.status==='over';
  // Side view frames the pup a little behind centre so the player sees what is coming.
  let third={pos:new T.Vector3(c.x+lead,Math.max(3.2,c.y+3.6),10.5),at:new T.Vector3(c.x+lead,Math.max(.4,c.y+.2),0)};
  // During a loop the side camera pulls back and frames the whole ring.
  if(g.loop){const R=TURBO.loopRadius;third={pos:new T.Vector3(g.loop.cx+2,R+1.2,19),at:new T.Vector3(g.loop.cx+1,R*.9,0)};}
  // Chase view: behind and above; in a loop it holds at the entrance and watches the pup go round.
  let first=g.loop?{pos:new T.Vector3(g.loop.cx-9,3.6,3.5),at:new T.Vector3(g.loop.cx,TURBO.loopRadius,0)}:{pos:new T.Vector3(c.x-6.5,c.y+2.6,0),at:new T.Vector3(c.x+10,c.y+.6,0)};
  if(ready){const a=Math.sin(real*.35)*.6;third={pos:new T.Vector3(c.x+4.5*Math.sin(a+.6),1.8,4.5*Math.cos(a+.6)),at:new T.Vector3(c.x,1.1,0)};first=null;}
  if(over){const k=smooth(Math.min(1,since/1.2));third={pos:third.pos.clone().lerp(new T.Vector3(c.x+2,c.y+2,7),k),at:new T.Vector3(c.x,c.y+.5,0)};if(first)first={pos:first.pos.clone().lerp(new T.Vector3(c.x-3,c.y+2.5,4),k),at:new T.Vector3(c.x,c.y+.5,0)};}
  this.rig.update(dt,third,first,{follow:ready||over?60:g.loop?6:8,snap:ready});this.stage.applyShake(real,this.reduced);this.rig.aim();
  const cam=this.camera,fov=ready?48:(this.rig.mix>.5?68:46)+Math.max(0,g.vx-20)*.35;cam.fov+=(fitFov(fov,cam.aspect,this.rig.mix>.5?64:54)-cam.fov)*Math.min(1,dt*4);cam.updateProjectionMatrix();
  this.sky.position.copy(cam.position);this.skyline.position.set(cam.position.x,-30,cam.position.z);this.moon.position.set(cam.position.x+120,150,cam.position.z-320);
 }
 updateHud(g,look){const h=this.hud,ui=this.ui;h.set(ui.dist,'d',String(Math.floor(g.distance)));h.set(ui.gold,'g',String(g.gold));h.set(ui.zone,'z','ZONE '+(Math.floor(g.distance/800)+1)+' · '+look.label.toUpperCase());
  const charging=g.boostCooldown>0;ui.power.hidden=g.status!=='playing';ui.power.dataset.kind=charging?'magnet':'shield';ui.bar.style.transform=`scaleX(${(1-g.boostCooldown/2.5).toFixed(3)})`;h.live(g.status==='playing');}
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();try{this.asset?.dispose();for(const grp of this.chunks.values())for(const geo of grp.userData.geos)geo.dispose();}catch{}this.stage?.dispose();}
}
