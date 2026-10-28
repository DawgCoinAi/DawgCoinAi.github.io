// Three.js presentation for Drift Dawgs. KartGame owns every rule; this module draws the
// seeded circuit as a neon raceway in a night city. Third person is the classic chase cam;
// first person sits in the driver's seat.
// World units: one track meter is one meter. Track (x, y) sits at world (x, 0, -y), and a kart
// with heading θ faces (cos θ, 0, -sin θ), so rotation.y = θ.
import {T,quality,fitFov,texture,radial,glowStops,skylineTexture,skyMaterial,pbr,castShadows,contactShadow,contactShadowMaterial,Stage,Particles,CameraRig,Hud,AmbientLoop} from './three-kit.js';
import {KART,trackAt,trackPoint,ordinal} from './kart-engine.js';
import {heatLabel} from './difficulty.js';
import {worldLook} from './world.js';
import {loadKartArt,kartRig,dressTrack} from './kart-art.js';
import {makeDawg} from './dawg-career.js';

const ICONS={boost:'⚡',bone:'🦴',rocket:'🚀'},LABELS={boost:'BOOST',bone:'BONE',rocket:'ROCKET'};
const asphalt=()=>texture(256,256,(c,w,h)=>{c.fillStyle='#15141f';c.fillRect(0,0,w,h);for(let i=0;i<900;i++){c.fillStyle=`rgba(255,255,255,${Math.random()*.05})`;c.fillRect(Math.random()*w,Math.random()*h,2,2);}
 c.fillStyle='#ffffffcc';c.fillRect(0,0,6,h);c.fillRect(w-6,0,6,h);c.fillStyle='#ffe45ecc';c.fillRect(w/2-3,0,6,h*.5);},{repeat:true});
const kerb=()=>texture(64,128,(c,w,h)=>{c.fillStyle='#ffffff';c.fillRect(0,0,w,h);c.fillStyle='#ff2f6a';c.fillRect(0,0,w,h/2);},{repeat:true});
const checker=()=>texture(128,32,(c,w,h)=>{for(let x=0;x<16;x++)for(let y=0;y<4;y++){c.fillStyle=(x+y)%2?'#ffffff':'#111111';c.fillRect(x*8,y*8,8,8);}});
const boxFace=()=>texture(128,128,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#ff5fc8');g.addColorStop(.5,'#5ee7ff');g.addColorStop(1,'#b9ff5e');c.fillStyle=g;c.globalAlpha=.55;c.fillRect(0,0,w,h);c.globalAlpha=1;c.strokeStyle='#fff';c.lineWidth=8;c.strokeRect(4,4,w-8,h-8);c.font='900 90px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff';c.fillText('?',w/2,h/2+6);});
const chevron=()=>texture(128,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#fff';c.lineWidth=16;c.lineCap='round';for(const y of [30,70]){c.beginPath();c.moveTo(24,y+30);c.lineTo(w/2,y);c.lineTo(w-24,y+30);c.stroke();}});

// A strip that follows the track between two sideways offsets (flat) or up a wall (vertical).
function ribbon(t,d0,d1,{height=0,wall=false,vScale=8}={}){const n=t.pts.length,pos=[],uv=[],idx=[];
 for(let i=0;i<=n;i++){const s=i*t.ds,a=trackPoint(t,s,d0),b=trackPoint(t,s,wall?d0:d1);pos.push(a.x,0,-a.y,b.x,wall?height:0,-b.y);uv.push(0,s/vScale,1,s/vScale);if(i<n)idx.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}

function kartModel(color,glowTex){const g=new T.Group(),body=new T.MeshStandardMaterial({color,metalness:.55,roughness:.25,emissive:color,emissiveIntensity:.25}),dark=new T.MeshStandardMaterial({color:0x111118,metalness:.4,roughness:.6});
 const chassis=new T.Mesh(new T.BoxGeometry(1.9,.32,1.15).translate(0,.32,0),body);const nose=new T.Mesh(new T.BoxGeometry(.7,.22,.9).translate(1.15,.28,0),body);const spoiler=new T.Mesh(new T.BoxGeometry(.12,.35,1.3).translate(-1,.72,0),body);
 const seat=new T.Mesh(new T.BoxGeometry(.5,.45,.7).translate(-.35,.6,0),dark);g.add(chassis,nose,spoiler,seat);
 const wheelGeo=new T.CylinderGeometry(.27,.27,.26,16).rotateX(Math.PI/2);for(const [x,z]of [[.7,.62],[.7,-.62],[-.7,.65],[-.7,-.65]]){const w=new T.Mesh(wheelGeo,dark);w.position.set(x,.27,z);g.add(w);}
 // The driver: a round DAWG head with floppy ears.
 const fur=new T.MeshStandardMaterial({color:0xe9c79a,roughness:.7}),head=new T.Group();head.add(new T.Mesh(new T.SphereGeometry(.34,18,14),fur));
 for(const z of [-.3,.3]){const ear=new T.Mesh(new T.SphereGeometry(.13,10,8).scale(1,1.6,.6),new T.MeshStandardMaterial({color:0x5a3b2a,roughness:.8}));ear.position.set(-.05,-.05,z);ear.rotation.x=z>0?-.4:.4;head.add(ear);}
 const snout=new T.Mesh(new T.SphereGeometry(.14,10,8),new T.MeshStandardMaterial({color:0x2a1d16}));snout.position.set(.3,-.06,0);head.add(snout);head.position.set(-.3,1.1,0);g.add(head);
 const glow=new T.Sprite(new T.SpriteMaterial({map:glowTex,color:new T.Color(color).multiplyScalar(1.4),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));glow.scale.set(3.4,1.6,1);glow.position.y=.05;g.add(glow);
 return {g,head,body};}

export class ThreeKart {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.cameraMode='third';this.clock=performance.now();this.status='';this.statusSince=performance.now();this.trackSeed=null;this.camYaw=null;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d kart3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="d3-meter"><b class="d3-dist">6th</b><small>LAP 1/3</small></div><div class="d3-gold"><i></i><b>—</b></div><canvas class="m3-map" width="180" height="150" aria-hidden="true"></canvas>');this.view.append(this.hud.root);
  this.ui={place:this.hud.q('.d3-dist'),lap:this.hud.q('.d3-meter small'),item:this.hud.q('.d3-gold b'),map:this.hud.q('.m3-map')};
  this.rig=new CameraRig(this.camera);this.rig.setMode(this.cameraMode);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D RACEWAY · LIVE');return this;
 }
 setCamera(mode){this.cameraMode=mode==='first'?'first':'third';this.rig?.setMode(this.cameraMode);}
 build(){
  const s=this.scene;this.stage.neonEnvironment(.7);this.stage.hdrEnvironment(undefined,.55);s.fog=new T.FogExp2(0x070914,.0055);
  // Model karts and scenery load in the background; the built-in karts race until they arrive.
  this.art=null;loadKartArt().then(a=>{if(this.dead)return;a.glowTex=this.glowTex;this.art=a;this.dressed=false;this.modelKarts=false;}).catch(()=>{});
  this.sky=new T.Mesh(new T.SphereGeometry(600,24,12),skyMaterial());s.add(this.sky);
  this.skyline=new T.Mesh(new T.CylinderGeometry(420,420,170,64,1,true),new T.MeshBasicMaterial({map:skylineTexture(),transparent:true,side:T.BackSide,fog:false,depthWrite:false}));this.skyline.material.map.repeat.set(6,1);this.skyline.position.y=55;s.add(this.skyline);
  s.add(new T.HemisphereLight(0xa9b4ff,0x150c22,.9));const key=this.key=new T.DirectionalLight(0xfff0dc,1.3);key.position.set(14,28,9);s.add(key,key.target);this.stage.sunShadow(key,{size:18,far:80,map:2048,radius:3});this.blobMat=contactShadowMaterial(.7);
  this.groundMat=new T.MeshStandardMaterial({color:0x0a0c18,metalness:.3,roughness:.8,emissive:0xffffff,emissiveIntensity:.25});
  const grid=texture(128,128,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.strokeStyle='#ffffff';c.globalAlpha=.25;c.lineWidth=2;c.strokeRect(1,1,w-2,h-2);},{repeat:true});grid.repeat.set(120,120);this.groundMat.emissiveMap=grid;
  const ground=new T.Mesh(new T.PlaneGeometry(1200,1200).rotateX(-Math.PI/2),this.groundMat);ground.position.y=-.03;s.add(ground);
  this.roadMat=pbr({map:asphalt(),metalness:.2,roughness:.42,envMapIntensity:.85,clearcoat:.4,clearcoatRoughness:.28},this.quality);this.kerbMat=new T.MeshStandardMaterial({map:kerb(),emissive:0xffffff,emissiveMap:kerb(),emissiveIntensity:.06,roughness:.7,envMapIntensity:.25,side:T.DoubleSide});
  this.wallMat=pbr({color:0x22224a,metalness:.6,roughness:.3,side:T.DoubleSide,clearcoat:.8,clearcoatRoughness:.12},this.quality);this.railMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,side:T.DoubleSide});
  this.boxTex=boxFace();this.glowTex=radial(glowStops);
  this.boxGeo=new T.BoxGeometry(1.1,1.1,1.1);this.boxMat=new T.MeshStandardMaterial({map:this.boxTex,emissive:0xffffff,emissiveMap:this.boxTex,emissiveIntensity:.9,transparent:true,opacity:.85,metalness:.2,roughness:.1});
  this.coinMat=new T.MeshStandardMaterial({color:0xffc83d,metalness:1,roughness:.15,emissive:0xff8a00,emissiveIntensity:.45,envMapIntensity:1.8});
  this.padMat=new T.MeshBasicMaterial({map:chevron(),color:new T.Color(.6,2.2,2.6),transparent:true,depthWrite:false,toneMapped:false});
  this.boneMat=new T.MeshStandardMaterial({color:0xf4efe6,roughness:.5,emissive:0x443322,emissiveIntensity:.3});
  this.bones=Array.from({length:24},()=>{const g=new T.Group();g.add(new T.Mesh(new T.CylinderGeometry(.09,.09,.8,8).rotateZ(Math.PI/2),this.boneMat));for(const x of [-.4,.4])for(const z of [-.1,.1]){const k=new T.Mesh(new T.SphereGeometry(.14,8,6),this.boneMat);k.position.set(x,0,z);g.add(k);}g.position.y=.2;g.visible=false;s.add(g);return g;});
  const rocketMat=new T.MeshStandardMaterial({color:0xff4f6a,emissive:0xff2040,emissiveIntensity:1.5});
  this.rockets=Array.from({length:12},()=>{const m=new T.Mesh(new T.ConeGeometry(.22,.9,10).rotateZ(-Math.PI/2),rocketMat);m.visible=false;s.add(m);return m;});
  this.karts=[];this.particles=new Particles(s,this.quality==='high'?600:300,this.glowTex);this.dummy=new T.Object3D();this.trackGroup=new T.Group();s.add(this.trackGroup);
 }
 buildTrack(g){
  const t=g.track,grp=this.trackGroup;for(const c of [...grp.children]){grp.remove(c);c.geometry?.dispose();}this.dressed=false;
  const W=KART.width/2;const road=new T.Mesh(ribbon(t,-W,W,{vScale:24}),this.roadMat);road.receiveShadow=true;grp.add(road);
  for(const side of [1,-1])grp.add(new T.Mesh(ribbon(t,side*W,side*(W+.9),{vScale:4}),this.kerbMat));
  // Run-off between the kerbs and the barriers.
  const runoff=new T.MeshStandardMaterial({color:0x1a1530,roughness:.9,side:T.DoubleSide});for(const side of [1,-1])grp.add(new T.Mesh(ribbon(t,side*(W+.9),side*KART.wall),runoff));
  for(const side of [1,-1]){grp.add(new T.Mesh(ribbon(t,side*KART.wall,0,{wall:true,height:.9}),this.wallMat));const rail=new T.Mesh(ribbon(t,side*KART.wall,side*(KART.wall+.12)),this.railMat);rail.position.y=.92;grp.add(rail);}
  grp.children.forEach((m,i)=>{if(i<3)m.position.y=i?.012:.006;});
  // Start/finish line and gantry.
  const q=trackAt(t,0),line=new T.Mesh(new T.PlaneGeometry(2.2,KART.width).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:checker()}));line.position.set(q.x,.02,-q.y);line.rotation.y=q.ang;grp.add(line);
  const arch=new T.Group(),postMat=new T.MeshStandardMaterial({color:0x2a2350,metalness:.7,roughness:.3});for(const z of [-W-1.2,W+1.2]){const p=new T.Mesh(new T.BoxGeometry(.4,6,.4).translate(0,3,0),postMat);p.position.z=z;arch.add(p);}
  const banner=new T.Mesh(new T.BoxGeometry(.3,1.1,KART.width+3),new T.MeshBasicMaterial({map:texture(512,64,(c,w,h)=>{c.fillStyle='#0b0a16';c.fillRect(0,0,w,h);c.font='900 44px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#b9ff5e';c.shadowColor='#b9ff5e';c.shadowBlur=12;c.fillText('DRIFT DAWGS',w/2,h/2+2);}),toneMapped:false}));banner.position.y=6;arch.add(banner);arch.position.set(q.x,0,-q.y);arch.rotation.y=q.ang;grp.add(arch);
  // Item boxes, boost pads and coins.
  this.boxes=t.boxes.map(b=>{const p=trackPoint(t,b.s,b.d),m=new T.Mesh(this.boxGeo,this.boxMat);m.position.set(p.x,1,-p.y);grp.add(m);return m;});
  for(const pad of t.pads){const p=trackPoint(t,pad.s,pad.d),m=new T.Mesh(new T.PlaneGeometry(2.2,2.2).rotateX(-Math.PI/2),this.padMat);m.position.set(p.x,.03,-p.y);m.rotation.y=p.ang-Math.PI/2;grp.add(m);}
  this.coins=new T.InstancedMesh(new T.CylinderGeometry(.32,.32,.08,20).rotateX(Math.PI/2),this.coinMat,t.coins.length);this.coins.frustumCulled=false;grp.add(this.coins);
  // Minimap backdrop.
  const mc=this.ui.map,xs=t.pts.map(p=>p[0]),ys=t.pts.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),sc=Math.min((mc.width-20)/(maxX-minX),(mc.height-20)/(maxY-minY));
  this.mapAt=(x,y)=>[mc.width/2+(x-(minX+maxX)/2)*sc,mc.height/2-(y-(minY+maxY)/2)*sc];const bg=document.createElement('canvas');bg.width=mc.width;bg.height=mc.height;const b=bg.getContext('2d');b.fillStyle='#0a0c18d9';b.fillRect(0,0,bg.width,bg.height);
  b.strokeStyle='#ffffff55';b.lineWidth=5;b.lineJoin='round';b.beginPath();t.pts.forEach((p,i)=>{const [x,y]=this.mapAt(p[0],p[1]);i?b.lineTo(x,y):b.moveTo(x,y);});b.closePath();b.stroke();this.mapBg=bg;
  this.skyline.position.set((minX+maxX)/2,55,-(minY+maxY)/2);this.trackSeed=g.worldSeed;
  if(!this.karts.length)this.karts=g.karts.map(k=>{const m=kartModel(k.color,this.glowTex);castShadows(m.g,this.quality,false);const blob=contactShadow(3,2.2,this.blobMat);blob.position.y=.03;m.g.add(blob);this.scene.add(m.g);return m;});
 }
 // Replace the built-in karts with the model karts: the player's own DAWG drives kart one,
 // rivals get their own DAWGs (or the stock driver on low graphics settings).
 swapKarts(g){this.modelKarts=true;const rnd=i=>{try{return makeDawg();}catch{return null;}};
  this.karts.forEach((m,i)=>{const rig=kartRig(this.art.karts[i%this.art.karts.length],{dawg:i===0?this.dawg:this.quality==='high'?rnd(i):null});for(const c of [...m.g.children])if(!c.isSprite&&c.material!==this.blobMat)m.g.remove(c);castShadows(rig.root,this.quality,false);m.g.add(rig.root);m.wheels=rig.wheels;m.driver=rig.driver;m.head=rig.driver?.root||rig.root;});}
 pose(t,k){const p=trackPoint(t,k.p,k.d),q=trackAt(t,k.p);return {x:p.x,z:-p.y,yaw:q.ang+k.a};}
 event(e,g){if(!this.ready||!this.karts.length)return;const st=this.stage,hud=this.hud,me=this.pose(g.track,g.you),fx=Math.cos(me.yaw),fz=-Math.sin(me.yaw);
  if(e.type==='coin'){this.particles.burst(me.x+fx,1,me.z+fz,14,0xffc14d,{speed:3,life:.5});hud.pop('+50');}
  else if(e.type==='item'){hud.pop(ICONS[e.item]+' '+LABELS[e.item],'big');this.particles.burst(me.x+fx*2,1,me.z+fz*2,30,0x5ee7ff,{speed:5,life:.6});}
  else if(e.type==='miniturbo'){hud.pop(e.level===2?'SUPER TURBO!':'MINI-TURBO!','big');st.shake(.12);this.particles.burst(me.x-fx*1.2,.4,me.z-fz*1.2,40,e.level===2?0xff8a3d:0x5ec8ff,{speed:6,life:.5});}
  else if(e.type==='boost'||e.type==='pad'){if(!e.kart){st.shake(.1);st.flashOnce(0x5ee7ff,.12,this.reduced);}}
  else if(e.type==='hit'){hud.pop('DIRECT HIT +200','big');const k=g.karts[e.kart],p=this.pose(g.track,k);this.particles.burst(p.x,1,p.z,60,0xff4f6a,{speed:8,life:.8});}
  else if(e.type==='spin'){st.shake(.5);st.flashOnce(0xff3355,.3,this.reduced);this.particles.burst(me.x,1,me.z,40,0xffe45e,{speed:5,life:.7});}
  else if(e.type==='wall'){st.shake(.25);this.particles.burst(me.x,.5,me.z,16,0xffffff,{speed:4,life:.3});}
  else if(e.type==='bump')st.shake(.08);
  else if(e.type==='lap')hud.banner(e.final?'FINAL LAP!':'LAP '+e.lap+' / '+KART.laps);
  else if(e.type==='pass')hud.pop(ordinal(e.place).toUpperCase(),'big');
  else if(e.type==='heat'){hud.banner(heatLabel(e.tier));st.flashOnce(0xff7a3d,.2,this.reduced);}
  else if(e.type==='finish'){hud.banner(ordinal(e.place).toUpperCase()+' PLACE!');st.flashOnce(e.place===1?0xb9ff5e:0xffffff,.4,this.reduced);this.particles.burst(me.x,2,me.z,120,e.place===1?0xffc83d:0xb48cff,{speed:9,life:1.2});}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.dawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<2500));return true;}
 render(g,now){
  this.stage.resize();if(this.trackSeed!==g.worldSeed)this.buildTrack(g);const t=g.track,dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  const look=worldLook(g.worldSeed),glow=new T.Color(look.glow),accent=new T.Color(look.accent);this.railMat.color.copy(glow).multiplyScalar(1.8);this.groundMat.emissive.copy(accent).multiplyScalar(.35);this.skyline.material.color.copy(glow).lerp(this.skylineTint??=new T.Color(0x8a96ff),.75);
  const u=this.sky.material.uniforms;u.uTop.value.set(0x03040c);u.uHorizon.value.copy(glow).lerp(this.nightBlue??=new T.Color(0x1c1648),.7).multiplyScalar(.45);u.uGlow.value.copy(accent).lerp(this.nightBlue??=new T.Color(0x1c1648),.6).multiplyScalar(.2);this.scene.fog.color.copy(glow).multiplyScalar(.05);
  // Track furniture.
  this.boxes.forEach((m,i)=>{m.visible=!g.taken.some(x=>x.i===i);m.rotation.set(reduced?0:real*.8,reduced?.6:real*1.3,0);m.position.y=1+(reduced?0:Math.sin(real*2+i)*.12);});
  const lap=Math.floor(g.you.p/t.len)*1000;t.coins.forEach((c,i)=>{const p=trackPoint(t,c.s,c.d),gone=g.coinTaken.includes(lap+i);this.dummy.position.set(p.x,gone?-5:.7,-p.y);this.dummy.rotation.set(0,reduced?0:real*3+i,0);this.dummy.updateMatrix();this.coins.setMatrixAt(i,this.dummy.matrix);});this.coins.instanceMatrix.needsUpdate=true;this.dummy.rotation.set(0,0,0);
  this.bones.forEach((m,i)=>{const b=g.bones[i];m.visible=!!b;if(!b)return;const p=trackPoint(t,b.p,b.d);m.position.set(p.x,.2,-p.y);m.rotation.y=i;});
  this.rockets.forEach((m,i)=>{const r=g.rockets[i];m.visible=!!r;if(!r)return;const p=trackPoint(t,r.p,r.d);m.position.set(p.x,.8,-p.y);m.rotation.y=p.ang;if(!reduced)this.particles.burst(p.x,.8,-p.y,1,0xff8a3d,{speed:1,life:.3});});
  // Karts: heading, drift yaw, spin-outs, boost flames and drift sparks.
  if(this.art&&!this.dressed){this.trackGroup.add(castShadows(dressTrack(t,this.art,{quality:this.quality}),this.quality,false));this.dressed=true;}
  if(this.art&&!this.modelKarts)this.swapKarts(g);
  g.karts.forEach((k,i)=>{const m=this.karts[i],p=this.pose(t,k),drift=k.drift*.4,spin=k.spin>0?(1.1-k.spin)*Math.PI*4:0;m.g.position.set(p.x,0,p.z);m.g.rotation.set(0,p.yaw+drift+spin,(k.drift?-k.drift*.06:-k.steer*.04));
   // Wheels roll with distance and the front pair steers.
   if(m.wheels){m.roll=(m.roll||0)+k.v*dt/.3;for(const w of m.wheels){w.node.rotation.x=m.roll;if(w.front)w.node.rotation.y=(k.drift?k.drift*.5:k.steer*.35);}}
   const fx=Math.cos(p.yaw),fz=-Math.sin(p.yaw);if(reduced)return;
   if(k.boost>0)this.particles.burst(p.x-fx*1.3,.45,p.z-fz*1.3,2,i?0xff8a3d:0x5ee7ff,{speed:2,life:.25,up:.5});
   if(k.drift&&!i&&k.charge>.3){const c=k.charge>=1.8?0xff8a3d:k.charge>=.9?0x5ec8ff:0xffffff,sx=Math.sin(p.yaw)*.65,sz=Math.cos(p.yaw)*.65;for(const s of [-1,1])this.particles.burst(p.x-fx*.8+sx*s,.2,p.z-fz*.8+sz*s,1,c,{speed:2.5,life:.25,up:1});}});
  // Cameras: a chase cam that lags the kart's heading, or the driver's seat.
  const me=this.pose(t,g.you);this.stage.followSun(this.key,me.x,0,me.z);if(this.camYaw===null)this.camYaw=me.yaw;this.camYaw+=Math.atan2(Math.sin(me.yaw-this.camYaw),Math.cos(me.yaw-this.camYaw))*Math.min(1,dt*(reduced?20:5));
  const cx=Math.cos(this.camYaw),cz=-Math.sin(this.camYaw),fast=Math.min(1,g.you.v/KART.top);
  const third={pos:new T.Vector3(me.x-cx*(6.2+fast*1.2),2.7+fast*.3,me.z-cz*(6.2+fast*1.2)),at:new T.Vector3(me.x+cx*6,.9,me.z+cz*6)};
  const fwd=this.modelKarts?.45:.05,first={pos:new T.Vector3(me.x+Math.cos(me.yaw)*fwd,this.modelKarts?1.5:1.2,me.z-Math.sin(me.yaw)*fwd),at:new T.Vector3(me.x+Math.cos(me.yaw)*12,.8,me.z-Math.sin(me.yaw)*12)};
  this.karts[0].head.visible=this.rig.mix<.5;
  this.rig.update(dt,third,first,{follow:30,roll:this.rig.mix>.5?-g.you.steer*.04:0});this.stage.applyShake(real,reduced);this.rig.aim();
  const cam=this.camera,boosting=g.you.boost>0&&!reduced?8:0;cam.fov+=(fitFov((this.rig.mix>.5?78:66)+boosting,cam.aspect,70)-cam.fov)*Math.min(1,dt*5);cam.near=.05;cam.far=1500;cam.updateProjectionMatrix();this.sky.position.copy(cam.position);
  this.particles.update(dt);this.updateHud(g);this.stage.render(dt,real,{reduced,aberration:g.you.boost>0?.004:.0015});
 }
 updateHud(g){const h=this.hud,ui=this.ui;h.set(ui.place,'p',ordinal(g.place));h.set(ui.lap,'l','OF '+g.karts.length+' · LAP '+Math.min(KART.laps,g.lap+1)+'/'+KART.laps);h.set(ui.item,'i',g.you.item?ICONS[g.you.item]+' '+LABELS[g.you.item]:'—');h.live(g.status==='playing');
  if(!this.mapBg)return;const c=ui.map.getContext('2d');c.clearRect(0,0,ui.map.width,ui.map.height);c.drawImage(this.mapBg,0,0);
  for(let i=g.karts.length-1;i>=0;i--){const k=g.karts[i],p=trackPoint(g.track,k.p,k.d),[x,y]=this.mapAt(p.x,p.y);c.fillStyle=k.color;c.beginPath();c.arc(x,y,i?3.2:5,0,Math.PI*2);c.fill();if(!i){c.strokeStyle='#fff';c.lineWidth=2;c.stroke();}}}
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();this.stage?.dispose();}
}
