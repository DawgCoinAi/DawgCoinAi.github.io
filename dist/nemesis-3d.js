// Three.js presentation for IT LEARNS. A 5×5 floor of glass tiles floats in the dark under the
// House: a huge mechanical eye in turning rings that tracks you, narrows as it reads you and burns
// red when a guess is armed. Marked tiles heat up through the beat and erupt in pillars of light;
// a prediction that lands is a beam from the eye. NemesisGame owns every rule; this only reads it.
// Tile (c, r) sits at world (c − 2, 0, r − 2) × SP.
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,quality,fitFov,radial,glowStops,texture,Stage,Particles,CameraRig,Hud,AmbientLoop,pbr,castShadows,contactShadow,lightShaft} from './three-kit.js';
import {NEM,MOVES,phaseOf} from './nemesis-engine.js';
const N=NEM.n,SP=1.5,pos=(c,r)=>[(c-(N-1)/2)*SP,(r-(N-1)/2)*SP],tpos=t=>pos(t%N,Math.floor(t/N));
const COOL=new T.Color(.25,1.5,1.9),WARM=new T.Color(2.4,1.3,.3),HOT=new T.Color(3,.25,.3);

export class ThreeNemesis {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.clock=performance.now();this.status='';this.statusSince=performance.now();this.asset=null;this.assetKey='';this.px=0;this.pz=0;this.hop=1;this.from=[0,0];this.pillars=[];this.stampUntil=0;this.beam=0;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d nemesis3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="nm-top"><div class="nm-hearts"></div><b class="nm-mult">×1</b></div><div class="nm-read"><span>IT’S READING YOU</span><i><em></em></i><b>0%</b></div><div class="nm-beat"><i></i></div><div class="nm-phase" hidden></div><div class="nm-stamp" hidden><b></b><small></small></div><p class="nm-armed" hidden>IT’S GUESSING. DON’T DO THE USUAL.</p>');this.view.append(this.hud.root);
  const q=s=>this.hud.q(s);this.ui={hearts:q('.nm-hearts'),mult:q('.nm-mult'),readFill:q('.nm-read em'),readPct:q('.nm-read b'),read:q('.nm-read'),beat:q('.nm-beat i'),phase:q('.nm-phase'),stamp:q('.nm-stamp'),stampB:q('.nm-stamp b'),stampS:q('.nm-stamp small'),armed:q('.nm-armed')};
  this.rig=new CameraRig(this.camera);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D ARENA · LIVE');return this;}
 setCamera(){}
 build(){const s=this.scene,high=this.quality==='high';this.stage.studioEnvironment(.35);this.stage.hdrEnvironment(undefined,.35);s.background=new T.Color(0x030408);s.fog=new T.FogExp2(0x030408,.018);
  s.add(new T.HemisphereLight(0x9fb4ff,0x120a1e,.95));this.key=new T.DirectionalLight(0xdfe8ff,1.3);this.key.position.set(-5,12,7);s.add(this.key,this.key.target);this.stage.sunShadow(this.key,{size:8,far:40,map:2048,radius:3});
  this.glowTex=radial(glowStops);this.particles=new Particles(s,high?700:300,this.glowTex);
  // The floor: 25 glass tiles on a dark slab, each with its own glow plate for the marks.
  const slab=new T.Mesh(new T.BoxGeometry(N*SP+.9,.5,N*SP+.9),pbr({color:0x0d1018,roughness:.35,metalness:.85,envMapIntensity:.9},this.quality));slab.position.y=-.33;slab.receiveShadow=high;s.add(slab);
  const rim=new T.Mesh(new T.BoxGeometry(N*SP+1,.05,N*SP+1),new T.MeshBasicMaterial({color:new T.Color(.3,1.4,1.8),toneMapped:false}));rim.position.y=-.6;s.add(rim);this.rim=rim;
  const hazard=texture(128,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#ffffff55';c.fillRect(0,0,w,h);c.save();c.beginPath();c.rect(10,10,w-20,h-20);c.clip();c.strokeStyle='#ffffffcc';c.lineWidth=9;for(let i=-h;i<w+h;i+=26){c.beginPath();c.moveTo(i,h);c.lineTo(i+h,0);c.stroke();}c.restore();c.strokeStyle='#fff';c.lineWidth=7;c.strokeRect(5,5,w-10,h-10);});
  const tileGeo=new T.BoxGeometry(SP*.92,.12,SP*.92),plateGeo=new T.PlaneGeometry(SP*.9,SP*.9).rotateX(-Math.PI/2);this.tiles=[];
  // One sheet of light under the glass: the seams between tiles glow.
  const seams=new T.Mesh(new T.PlaneGeometry(N*SP,N*SP).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:texture(512,512,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.strokeStyle='#7fe6ff';c.lineWidth=5;c.shadowColor='#3fd0ff';c.shadowBlur=14;for(let i=0;i<=N;i++){const p=i*w/N;c.beginPath();c.moveTo(p,0);c.lineTo(p,h);c.moveTo(0,p);c.lineTo(w,p);c.stroke();}}),transparent:true,opacity:.75,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));seams.position.y=.004;s.add(seams);this.seams=seams;
  for(let t=0;t<N*N;t++){const [x,z]=tpos(t),m=new T.Mesh(tileGeo,pbr({color:0x2c3854,roughness:.16,metalness:.55,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.2,emissive:0x0c1830,emissiveIntensity:.6},this.quality));m.position.set(x,-.06,z);m.receiveShadow=high;s.add(m);
   const plate=new T.Mesh(plateGeo,new T.MeshBasicMaterial({map:hazard,color:new T.Color(0,0,0),transparent:true,opacity:0,toneMapped:false,depthWrite:false,blending:T.AdditiveBlending}));plate.position.set(x,.012,z);s.add(plate);this.tiles.push({m,plate,heat:0});}
  const hall=new T.Group();s.add(hall);const mono=pbr({color:0x10131c,roughness:.3,metalness:.9,envMapIntensity:1},this.quality),box=new T.BoxGeometry(1,1,1).translate(0,.5,0),nM=high?18:10,lights=[];
  for(let i=0;i<nM;i++){const a=i/nM*Math.PI*2+.2,d=15+((i*37)%5),h=14+((i*53)%14),w=2.2+((i*17)%3)*.6,m=new T.Mesh(box,mono);m.scale.set(w,h,w);m.position.set(Math.cos(a)*d,-12,Math.sin(a)*d);m.rotation.y=-a;hall.add(m);
   for(let j=0;j<(high?9:4);j++)lights.push([Math.cos(a)*(d-w*.52),-11+((i*7+j*13)%(h-2)),Math.sin(a)*(d-w*.52),-a+Math.PI/2,((i+j)%5)]);}
  const lm=new T.InstancedMesh(new T.PlaneGeometry(.5,.12),new T.MeshBasicMaterial({color:new T.Color(.4,1.6,2),toneMapped:false,side:T.DoubleSide}),lights.length),M=new T.Matrix4(),Q=new T.Quaternion(),Y=new T.Vector3(0,1,0),one=new T.Vector3(1,1,1);lights.forEach((l,i)=>{Q.setFromAxisAngle(Y,l[3]);M.compose(new T.Vector3(l[0],l[1],l[2]),Q,one);lm.setMatrixAt(i,M);});hall.add(lm);this.statusLights=lm;
  const pit=new T.Mesh(new T.CircleGeometry(40,64).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:texture(512,512,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.translate(w/2,h/2);c.strokeStyle='#1d6f8f';c.lineWidth=2;for(let r=20;r<260;r+=22){c.beginPath();c.arc(0,0,r,0,7);c.stroke();}for(let i=0;i<24;i++){c.rotate(Math.PI/12);c.beginPath();c.moveTo(18,0);c.lineTo(256,0);c.stroke();}const g=c.createRadialGradient(0,0,0,0,0,256);g.addColorStop(0,'#3fd0ff55');g.addColorStop(.5,'#3fd0ff11');g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(-256,-256,512,512);}),transparent:true,opacity:.9,toneMapped:false,depthWrite:false,fog:false}));pit.position.y=-13;hall.add(pit);this.pit=pit;
  const ringMat=pbr({color:0x1a2030,roughness:.3,metalness:1,envMapIntensity:1.2},this.quality),ringGlow=new T.MeshBasicMaterial({color:new T.Color(.3,1.4,1.9),toneMapped:false});this.orbit=[10.5,12.6].map((r,i)=>{const g=new T.Group(),a=new T.Mesh(new T.TorusGeometry(r,.22,10,120),ringMat),b=new T.Mesh(new T.TorusGeometry(r,.035,6,120),ringGlow);b.position.z=.24;g.add(a,b);g.rotation.x=Math.PI/2+(i?.22:-.16);g.position.y=-1.4-i*1.2;hall.add(g);return g;});this.ringGlow=ringGlow;
  if(high)for(const [x,z] of [[-7,-5],[7,-5],[-8,5],[8,5]]){const sh=lightShaft(0x6fd8ff,{length:18,radius:2.6,top:.2,opacity:.1,apex:[0,16,0]});sh.position.set(x,0,z);hall.add(sh);}
  // Far below and around: slow drifting motes, so the floor reads as hanging in a vast dark room.
  const motes=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(Array.from({length:(high?900:350)*3},(_,i)=>{const n=Math.floor(i/3),k=i%3,a=n*2.399,r=7+((n*61)%40);return k===0?Math.cos(a)*r:k===1?-12+((n*37)%34):Math.sin(a)*r;}),3)),new T.PointsMaterial({size:.09,color:new T.Color(.5,1.2,1.6),transparent:true,opacity:.7,toneMapped:false,depthWrite:false}));s.add(motes);this.motes=motes;
  // The House: an iris and pupil in a steel socket, inside three turning rings, with a beam for predictions.
  const eye=this.eye=new T.Group();eye.position.set(0,5.2,-9);eye.scale.setScalar(1.45);s.add(eye);const steel=pbr({color:0x2a3144,roughness:.25,metalness:1,envMapIntensity:1.3},this.quality);
  eye.add(new T.Mesh(new T.SphereGeometry(1.9,48,32),pbr({color:0x0a0c12,roughness:.08,metalness:.9,clearcoat:1,envMapIntensity:1.4},this.quality)));
  this.gaze=new T.Group();eye.add(this.gaze);this.irisMat=new T.MeshBasicMaterial({color:COOL.clone(),toneMapped:false,map:texture(256,256,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.translate(w/2,h/2);for(let i=0;i<220;i++){c.rotate(Math.PI*2/220+((i*7)%5)*.002);const g=c.createLinearGradient(52,0,126,0);g.addColorStop(0,'#ffffff');g.addColorStop(.5,i%3?'#9a9a9a':'#e8e8e8');g.addColorStop(1,'#3a3a3a');c.strokeStyle=g;c.lineWidth=1+((i*13)%3);c.beginPath();c.moveTo(52,0);c.lineTo(124,((i*29)%9)-4);c.stroke();}c.strokeStyle='#fff';c.lineWidth=5;c.beginPath();c.arc(0,0,122,0,7);c.stroke();c.lineWidth=3;c.beginPath();c.arc(0,0,56,0,7);c.stroke();})});const iris=new T.Mesh(new T.RingGeometry(.42,.95,48),this.irisMat);iris.position.z=1.84;this.gaze.add(iris);this.iris=iris;
  const pupil=new T.Mesh(new T.CircleGeometry(.42,40),new T.MeshBasicMaterial({color:0x000000}));pupil.position.z=1.845;this.gaze.add(pupil);this.pupil=pupil;
  const halo=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:COOL.clone(),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));halo.scale.set(6,6,1);halo.material.opacity=.45;halo.position.z=-1.2;eye.add(halo);this.halo=halo;
  this.rings=[2.5,3,3.6].map((r,i)=>{const m=new T.Mesh(new T.TorusGeometry(r,.07+i*.02,10,96),steel);m.rotation.set(i*.9,i*.5,0);eye.add(m);return m;});
  const lidGeo=new T.SphereGeometry(1.93,40,20,0,Math.PI*2,0,Math.PI*.5);this.lids=[1,-1].map(sg=>{const l=new T.Mesh(lidGeo,steel);l.rotation.x=sg>0?-1.25:Math.PI+1.25;eye.add(l);return l;});
  this.beamMesh=new T.Mesh(new T.CylinderGeometry(.05,.22,1,10,1,true).translate(0,.5,0),new T.MeshBasicMaterial({color:HOT.clone(),transparent:true,opacity:0,toneMapped:false,depthWrite:false,blending:T.AdditiveBlending}));s.add(this.beamMesh);
  this.sight=new T.Mesh(new T.CylinderGeometry(.012,.012,1,6,1,true).translate(0,.5,0),new T.MeshBasicMaterial({color:COOL.clone(),transparent:true,opacity:.25,toneMapped:false,depthWrite:false,blending:T.AdditiveBlending}));s.add(this.sight);
  this.spot=new T.Mesh(new T.RingGeometry(.5,.58,40).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:COOL.clone(),transparent:true,opacity:.6,toneMapped:false,depthWrite:false,blending:T.AdditiveBlending}));this.spot.position.y=.02;s.add(this.spot);
  for(const sx of [-1,1]){const p=new T.Mesh(new T.CylinderGeometry(.12,.2,13,10),steel);p.position.set(sx*6.5,-.2,-7.4);p.rotation.z=sx*.18;s.add(p);}
  this.bone=new T.Group();const bm=pbr({color:0xffd25e,emissive:0xffa630,emissiveIntensity:.9,roughness:.2,metalness:1},this.quality);this.boneMat=bm;const shaft=new T.Mesh(new T.CylinderGeometry(.06,.06,.42,8).rotateZ(Math.PI/2),bm);this.bone.add(shaft);for(const sx of [-1,1])for(const sz of [-1,1]){const k=new T.Mesh(new T.SphereGeometry(.1,10,8),bm);k.position.set(sx*.23,0,sz*.07);this.bone.add(k);}
  const bg=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(2.2,1.6,.4),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));bg.scale.set(1.3,1.3,1);this.bone.add(bg);this.boneGlow=bg;this.bone.visible=false;s.add(this.bone);
  this.holder=new T.Group();s.add(this.holder);this.shadow=contactShadow(.9);s.add(this.shadow);
  this.pillarGeo=new T.CylinderGeometry(SP*.4,SP*.44,1,20,1,true).translate(0,.5,0);}
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;const next=createDawgAsset(d);next.root.scale.setScalar(.8);castShadows(next.root,this.quality);if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.holder.add(next.root);}
 pillar(t,color){const [x,z]=tpos(t),m=new T.Mesh(this.pillarGeo,new T.MeshBasicMaterial({color:color.clone(),transparent:true,opacity:.9,toneMapped:false,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}));m.position.set(x,0,z);this.scene.add(m);this.pillars.push({m,t:0});}
 stamp(text,sub,kind){const u=this.ui;u.stampB.textContent=text;u.stampS.textContent=sub||'';u.stamp.className='nm-stamp nm-'+kind;u.stamp.hidden=false;void u.stamp.offsetWidth;u.stamp.classList.add('nm-show');this.stampUntil=performance.now()+(kind==='bad'?2600:1300);}
 event(e,g){if(!this.ready)return;if(e.type==='feat'){this.hud.pop('FEAT · '+String(e.name).toUpperCase(),'gold');return;}const st=this.stage,hud=this.hud,P=this.particles,rd=this.reduced;
  if(e.type==='hop'){this.from=[this.px,this.pz];this.hop=0;}
  else if(e.type==='blast'){for(const t of e.marks){this.pillar(t,HOT);const [x,z]=tpos(t);if(!rd)P.burst(x,.2,z,8,0xff4466,{speed:4,life:.45,gravity:-2,up:1});}st.shake(.1);}
  else if(e.type==='hit'){st.shake(e.how==='predicted'?1:.7);st.flashOnce(0xff1133,e.how==='predicted'?.6:.4,rd);const [x,z]=pos(g.c,g.r);P.burst(x,.6,z,70,0xff3355,{speed:8,life:.9});
   if(e.how==='predicted'){this.beam=.5;this.beamTo=[x,z];this.stamp('PREDICTED',e.line,'bad');}else if(e.how==='baited')this.stamp('BAITED',e.line,'bad');else this.stamp('BLASTED','','bad');}
  else if(e.type==='outsmart'){const [x,z]=tpos(e.t);this.pillar(e.t,WARM);P.burst(x,.4,z,36,0xffd25e,{speed:5,life:.7});this.stamp('OUTSMARTED','×'+e.mult+'  +'+e.points,'good');st.flashOnce(0xffd25e,.18,rd);}
  else if(e.type==='bone'){const [x,z]=tpos(e.t);P.burst(x,.5,z,30,0xffd25e,{speed:4,life:.6});hud.pop('+'+e.points,'gold');}
  else if(e.type==='phase'){this.ui.phase.textContent=e.name;this.ui.phase.hidden=false;this.phaseUntil=performance.now()+2200;st.flashOnce(e.name==='MIRROR'?0xff4fd8:0x5ec8ff,.25,rd);}
  else if(e.type==='bump'){st.shake(.08);}
  else if(e.type==='over'){st.shake(.6);}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<3500));return true;}
 render(g,d,now){
  this.stage.resize();this.prepare(d);const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  const ph=phaseOf(g.beat),k=g.status==='playing'?Math.min(1,g.t/g.beatLen):0,armed=g.guess>=0,read=g.read;
  // Tiles: marks heat from dull red to white-hot as the beat runs out. In a BLACKOUT they fade early.
  const hidden=ph.blackout&&k>.45;for(let t=0;t<N*N;t++){const tile=this.tiles[t],goal=g.marks.includes(t)&&!hidden?.35+.65*k*k:0;tile.heat+=(goal-tile.heat)*Math.min(1,dt*(goal>tile.heat?22:8));const h=tile.heat;tile.plate.material.opacity=h>0.01?1:0;tile.plate.material.color.setRGB(2.3*h,.1*h+.7*h*h*k,.12*h);tile.m.position.y=-.06-(reduced?0:h*.03);}
  // You: a hop between tiles with a little arc.
  const [tx,tz]=pos(g.c,g.r);this.hop=Math.min(1,this.hop+dt/.11);const e=1-(1-this.hop)*(1-this.hop);this.px=this.from[0]+(tx-this.from[0])*e;this.pz=this.from[1]+(tz-this.from[1])*e;if(this.hop>=1){this.px=tx;this.pz=tz;this.from=[tx,tz];}
  const up=reduced?0:Math.sin(this.hop*Math.PI)*.45;this.holder.position.set(this.px,up,this.pz);this.shadow.position.set(this.px,.014,this.pz);
  if(this.asset){const dir=g.cur;if(g.moved&&dir)this.yaw=[0,Math.PI,0,-Math.PI/2,Math.PI/2][dir];this.holder.rotation.y+=(((this.yaw??0)-this.holder.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*14);setDawgPose(this.asset,real,this.hop<1?'run':'idle');}
  // The House watches: the eye tracks you, the iris tightens with how well it reads you, red when a guess is armed.
  const eye=this.eye,look=new T.Vector3(this.px,.5,this.pz).sub(eye.position).normalize();this.gaze.rotation.y+=(Math.atan2(look.x,look.z)-this.gaze.rotation.y)*Math.min(1,dt*6);this.gaze.rotation.x+=(-Math.asin(look.y)-this.gaze.rotation.x)*Math.min(1,dt*6);
  const col=armed?HOT:COOL.clone().lerp(WARM,Math.min(1,read*1.3)),pulse=armed&&!reduced?1+.25*Math.sin(real*18):1;this.irisMat.color.copy(col).multiplyScalar(pulse);this.halo.material.color.copy(col).multiplyScalar(.35+read*.3);this.halo.scale.setScalar(6+read*1.5+(armed?1:0));
  const tight=1-.45*read-(armed?.2:0);this.pupil.scale.setScalar(tight);this.iris.scale.setScalar(1+(armed&&!reduced?.04*Math.sin(real*22):0));this.rim.material.color.copy(col).multiplyScalar(.8);
  this.rings.forEach((r,i)=>{r.rotation.x+=dt*(.25+i*.12)*(1+read*2);r.rotation.y+=dt*(.18-i*.07)*(1+read*2);});const lid=1.25-(armed?.28:0)-k*.06;this.lids[0].rotation.x=-lid;this.lids[1].rotation.x=Math.PI+lid;
  {const a=eye.position,b=new T.Vector3(this.px,.9+up,this.pz),v=b.clone().sub(a),len=v.length();this.sight.position.copy(a);this.sight.scale.set(armed?3:1,len,armed?3:1);this.sight.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());this.sight.material.color.copy(col);this.sight.material.opacity=armed?.55+(reduced?0:.25*Math.sin(real*18)):.14+read*.2;
   this.spot.position.set(this.px,.02,this.pz);this.spot.material.color.copy(col);this.spot.rotation.y=real*1.5;this.spot.scale.setScalar(armed?1.15+(reduced?0:.1*Math.sin(real*18)):1);this.spot.material.opacity=armed?.9:.35+read*.3;}
  this.seams.material.color.copy(col).lerp(new T.Color(1,1,1),.35);this.ringGlow.color.copy(col).multiplyScalar(.9);this.orbit.forEach((o,i)=>{o.rotation.z+=dt*(i?-.05:.07)*(1+read*2);});this.statusLights.material.color.copy(col).multiplyScalar(reduced?1:.75+.25*Math.sin(real*3));this.pit.rotation.y=real*.02;
  if(!reduced)eye.position.y=5.2+Math.sin(real*.8)*.15;this.motes.rotation.y=real*.01;
  // The prediction beam, and the pillars of light.
  if(this.beam>0&&this.beamTo){this.beam-=dt;const a=eye.position,b=new T.Vector3(this.beamTo[0],.3,this.beamTo[1]),v=b.clone().sub(a),len=v.length();this.beamMesh.position.copy(a);this.beamMesh.scale.set(1,len,1);this.beamMesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());this.beamMesh.material.opacity=Math.max(0,this.beam/.5);}else this.beamMesh.material.opacity=0;
  for(const p of this.pillars){p.t+=dt;const q=Math.min(1,p.t/.38);p.m.scale.set(1-.5*q,.4+7*Math.sin(q*Math.PI*.6),1-.5*q);p.m.material.opacity=.9*(1-q);}
  this.pillars=this.pillars.filter(p=>{if(p.t<.38)return true;p.m.removeFromParent();p.m.material.dispose();return false;});
  // Bait: a gold bone; a rigged one flickers faintly red if you look closely.
  const b=g.bone;this.bone.visible=!!b;if(b){const [x,z]=tpos(b.t);this.bone.position.set(x,.5+Math.sin(real*3)*.06,z);this.bone.rotation.y=real*2;const sick=b.rigged&&Math.sin(real*13)>.72;this.boneGlow.material.color.setRGB(sick?2.6:2.2,sick?.5:1.6,.4);this.boneMat.emissive.setHex(sick?0xff3030:0xffa630);this.bone.scale.setScalar(b.ttl===1&&!reduced?.8+.2*Math.sin(real*20):1);}
  // Camera: over your shoulder toward the eye, wide enough for the whole floor on a portrait screen.
  const cam=this.camera,portrait=(cam.aspect||1)<.9,third={pos:new T.Vector3(this.px*.18,portrait?9.8:6.6,portrait?11.4:10.4),at:new T.Vector3(this.px*.1,portrait?1.4:1.7,-1.6)};
  if(g.status==='ready'){third.pos.set(Math.sin(real*.2)*3,7.5,9.5);}
  this.rig.update(dt,third,null,{follow:5});this.stage.applyShake(real,reduced);this.rig.aim();cam.fov+=(fitFov(portrait?58:50,cam.aspect,portrait?52:60)-cam.fov)*Math.min(1,dt*5);cam.near=.1;cam.far=200;cam.updateProjectionMatrix();this.stage.followSun?.(this.key,0,0,0);
  // HUD.
  const u=this.ui,hearts='♥'.repeat(Math.max(0,g.hearts))+'♡'.repeat(Math.max(0,NEM.hearts-g.hearts));this.hud.set(u.hearts,'h',hearts);this.hud.set(u.mult,'m','×'+g.mult);u.mult.classList.toggle('nm-hot',g.mult>=4);
  u.readFill.style.transform=`scaleX(${read.toFixed(3)})`;this.hud.set(u.readPct,'r',Math.round(read*100)+'%');u.read.classList.toggle('nm-armed-on',armed);u.beat.style.transform=`scaleX(${(1-k).toFixed(3)})`;
  u.armed.hidden=!(armed&&g.status==='playing');if(this.phaseUntil&&now>this.phaseUntil){u.phase.hidden=true;this.phaseUntil=0;}if(ph.mirror&&g.status==='playing'){u.phase.hidden=false;u.phase.textContent='MIRROR  ⇄';}
  if(this.stampUntil&&now>this.stampUntil){u.stamp.hidden=true;this.stampUntil=0;}
  this.particles.update(dt,{x:0,y:0,z:0});this.hud.live(g.status==='playing');this.stage.render(dt,real,{reduced,aberration:.0012+(armed?.0018:0)});
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();try{this.asset?.dispose();}catch{}this.stage?.dispose();}
}
