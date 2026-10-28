// Three.js presentation for Don't Look Down. ClimbGame owns every rule; this draws the outside of a
// 500 m glass tower at night with the city falling away below, the hooks and ledges near the
// camera, the leash, and the parts that make a fall hurt: a live red drop counter, a laser line at
// this run's peak, and the tower's verdict. Engine meters are world units; the tower face is z = 0.
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,quality,fitFov,texture,radial,glowStops,skylineTexture,skyMaterial,Stage,Particles,CameraRig,Hud,AmbientLoop} from './three-kit.js';
import {CLIMB,FLOORS,floorOf,tower,hookPos} from './climb-engine.js';

// Sky and haze per floor: street neon at the bottom, a violet dusk, then storm cloud at the top.
const FLOOR_LOOK=[[0x120a26,0x2a1640,0xff4fd8],[0x140c2c,0x33194a,0xff7ab0],[0x16103a,0x3a1e52,0xffa04d],[0x0f1440,0x2a2f6a,0x5ec8ff],[0x0b1638,0x1f3a6e,0x4fffd2],[0x0a1230,0x223a70,0x9fb2ff],[0x0b0f24,0x2a3350,0xb9ff5e],[0x090c1c,0x262a44,0xffd25e],[0x06070f,0x1c1d2c,0x8a7dff],[0x0a0618,0x3a1a40,0xffd25e]];
const HOOK_COLOR={hook:0xffd25e,rusty:0xc8642a,slick:0x6fe8ff,swing:0xff4fd8,spring:0x7dff5e};
const towerTexture=lit=>texture(256,512,(c,w,h)=>{c.fillStyle=lit?'#000':'#0d1222';c.fillRect(0,0,w,h);const pw=32,ph=32;
 for(let y=0;y<16;y++)for(let x=0;x<8;x++){const px=x*pw,py=y*ph,n=(x*7+y*13+x*y*3)%23;if(lit){if(n<3){c.fillStyle=['#ffd9a0','#fff0d0','#a8d8ff'][n];c.globalAlpha=.3+n*.15;c.fillRect(px+3,py+3,pw-6,ph-9);c.globalAlpha=1;}}
  else{const g=c.createLinearGradient(px,py,px+pw,py+ph);g.addColorStop(0,'#33405e');g.addColorStop(.45,'#1a2136');g.addColorStop(1,'#0e1322');c.fillStyle=g;c.fillRect(px+2,py+2,pw-4,ph-7);c.fillStyle='#ffffff14';c.fillRect(px+2,py+2,pw-4,2);}}
 if(!lit){c.fillStyle='#070a12';for(let x=0;x<=8;x++)c.fillRect(x*pw-1,0,3,h);for(let y=0;y<=16;y++)c.fillRect(0,y*ph-5,w,6);c.fillStyle='#2a3350';for(let y=0;y<=16;y++)c.fillRect(0,y*ph-5,w,1);}});
const signTex=(text,color)=>texture(512,96,(c,w,h)=>{c.clearRect(0,0,w,h);c.font='900 58px "DAWG display","Arial Narrow",Impact,sans-serif';c.textAlign='center';c.textBaseline='middle';c.shadowColor=color;c.shadowBlur=16;c.fillStyle=color;const s=Math.min(1,(w-30)/c.measureText(text).width);c.save();c.translate(w/2,h/2);c.scale(s,1);c.fillText(text,0,0);c.restore();});

export class ThreeClimb {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.clock=performance.now();this.status='';this.statusSince=performance.now();this.asset=null;this.assetKey='';this.facing=1;this.fallShown=0;this.fallUntil=0;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d climb3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="cl-meter"><b class="cl-h">0</b><small>M</small><span class="cl-floor"></span></div><div class="cl-gauge" aria-hidden="true"><i class="cl-peak"></i><i class="cl-me"></i></div><div class="cl-fall" hidden><b></b><small></small></div><div class="cl-grip" hidden></div>');this.view.append(this.hud.root);
  this.ui={h:this.hud.q('.cl-h'),floor:this.hud.q('.cl-floor'),peak:this.hud.q('.cl-peak'),me:this.hud.q('.cl-me'),fall:this.hud.q('.cl-fall'),fallN:this.hud.q('.cl-fall b'),fallT:this.hud.q('.cl-fall small'),grip:this.hud.q('.cl-grip')};
  this.rig=new CameraRig(this.camera);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D TOWER · LIVE');return this;}
 setCamera(){}
 build(){const s=this.scene,high=this.quality==='high',t=tower(),W=CLIMB.half*2+3,H=CLIMB.top+60;this.stage.neonEnvironment(.8);this.stage.hdrEnvironment(undefined,.6);
  s.fog=new T.FogExp2(0x120a26,.012);this.sky=new T.Mesh(new T.SphereGeometry(300,32,16),skyMaterial());s.add(this.sky);
  this.skyline=new T.Mesh(new T.CylinderGeometry(180,180,120,48,1,true),new T.MeshBasicMaterial({map:skylineTexture(),transparent:true,side:T.BackSide,fog:false,depthWrite:false}));this.skyline.material.map.repeat.set(5,1);this.skyline.position.y=50;s.add(this.skyline);
  this.moon=new T.Sprite(new T.SpriteMaterial({map:radial([[0,'#fffaf0'],[.3,'#fff2d6'],[.36,'#ffe3b355'],[1,'#ffd09000']]),fog:false,depthWrite:false,color:new T.Color(1.7,1.6,1.5)}));this.moon.scale.set(46,46,1);s.add(this.moon);
  this.hemi=new T.HemisphereLight(0xa9b4ff,0x1a1028,.9);this.key=new T.DirectionalLight(0xdfe6ff,1.6);this.key.position.set(-8,14,16);this.rim=new T.DirectionalLight(0xff4fc0,1.4);this.rim.position.set(10,4,-6);s.add(this.hemi,this.key,this.key.target,this.rim);
  this.lamp=new T.PointLight(0xffc27a,5,7,1.8);s.add(this.lamp);
  // The glass face, its two steel spines, and the street far below.
  const face=towerTexture(false),glow=towerTexture(true);for(const m of [face,glow]){m.wrapS=m.wrapT=T.RepeatWrapping;m.repeat.set(W/10,H/10);}
  const wall=new T.Mesh(new T.PlaneGeometry(W,H),new T.MeshStandardMaterial({map:face,emissiveMap:glow,emissive:0xffffff,emissiveIntensity:.6,roughness:.18,metalness:.75,envMapIntensity:1.1}));wall.position.set(0,H/2-10,-1.4);s.add(wall);
  const spineMat=new T.MeshStandardMaterial({color:0x2a3048,roughness:.32,metalness:.9,envMapIntensity:1.2});for(const side of [-1,1]){const p=new T.Mesh(new T.BoxGeometry(1.2,H,2.4),spineMat);p.position.set(side*(CLIMB.half+.6),H/2-10,-.4);s.add(p);}
  this.trimMat=new T.MeshBasicMaterial({color:new T.Color(2.2,.6,1.8),toneMapped:false});for(const side of [-1,1]){const tr=new T.Mesh(new T.BoxGeometry(.08,H,.08),this.trimMat);tr.position.set(side*(CLIMB.half+.02),H/2-10,.82);s.add(tr);}
  const street=new T.Mesh(new T.PlaneGeometry(600,600).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x090b14,roughness:.12,metalness:.8,envMapIntensity:1.4}));street.position.y=-.02;s.add(street);
  this.cityLights=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(Array.from({length:(high?1600:700)*3},(_,i)=>{const k=i%3,n=Math.floor(i/3),a=n*2.399,r=70+((n*97)%300);return k===0?Math.cos(a)*r:k===1?.2+((n*31)%9)*.6:Math.sin(a)*r-40;}),3)),new T.PointsMaterial({size:.55,color:new T.Color(2,1.3,.9),sizeAttenuation:true,transparent:true,opacity:.9,toneMapped:false,depthWrite:false}));s.add(this.cityLights);
  const nb=[0,1,2].map(v=>{const a=towerTexture(false),b=towerTexture(true);for(const m of [a,b]){m.wrapS=m.wrapT=T.RepeatWrapping;m.repeat.set(3+v,30+v*6);}return new T.MeshStandardMaterial({map:a,emissiveMap:b,emissive:0xffffff,emissiveIntensity:.45,roughness:.22,metalness:.7,envMapIntensity:.9,color:[0x9aa6c8,0xc8b8d8,0x8fb0c0][v]});}),box=new T.BoxGeometry(1,1,1).translate(0,.5,0),rnd=(n=>()=>(n=(n*16807)%2147483647)/2147483647)(4242);this.beacons=[];
  for(let i=0;i<(high?34:18);i++){const side=i%2?1:-1,x=side*(28+rnd()*130),z=-30-rnd()*170+(rnd()<.25?150:0),h=60+Math.pow(rnd(),1.6)*460,w=14+rnd()*22,m=new T.Mesh(box,nb[i%3]);m.scale.set(w,h,w*(.7+rnd()*.6));m.position.set(x,0,z);s.add(m);
   const bc=new T.Sprite(new T.SpriteMaterial({map:radial(glowStops),color:new T.Color(3,.25,.3),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));bc.scale.set(5,5,1);bc.position.set(x,h+1.5,z);bc.userData.p=rnd()*6;s.add(bc);this.beacons.push(bc);}
  // Floor slabs with their names, and the ledges.
  const slabMat=new T.MeshStandardMaterial({color:0x1c2133,roughness:.45,metalness:.8});this.floorSigns=[];
  for(let f=1;f<=FLOORS.length;f++){const y=f*50-.6,slab=new T.Mesh(new T.BoxGeometry(W+1,.5,1.4),slabMat);slab.position.set(0,y+2.6,-1);s.add(slab);
   if(f<FLOORS.length){const look=FLOOR_LOOK[f],sp=new T.Mesh(new T.PlaneGeometry(8,1.5),new T.MeshBasicMaterial({map:signTex(`FLOOR ${f+1} · ${FLOORS[f].toUpperCase()}`,'#'+look[2].toString(16).padStart(6,'0')),transparent:true,toneMapped:false,depthWrite:false}));sp.position.set(0,y+3.6,-.25);s.add(sp);this.floorSigns.push(sp);}}
  const ledgeMat=new T.MeshStandardMaterial({color:0x323a52,roughness:.35,metalness:.85}),edgeMat=new T.MeshBasicMaterial({color:new T.Color(2.4,1.6,.3),toneMapped:false});this.ledges=t.ledges.map(l=>{const g=new T.Group(),w=l.x1-l.x0;const b=new T.Mesh(new T.BoxGeometry(w,.32,1.6),ledgeMat);b.position.y=-.16;const e=new T.Mesh(new T.BoxGeometry(w,.06,.06),edgeMat);e.position.set(0,-.02,.82);g.add(b,e);g.position.set((l.x0+l.x1)/2,l.y,0);if(l.id===0)g.visible=false;s.add(g);return g;});
  // Hooks: a bracket on the glass and a glowing ring; swing hooks ride a rail.
  const ring=new T.TorusGeometry(.34,.08,10,24),bracket=new T.BoxGeometry(.16,.16,1.3).translate(0,0,-.65),coil=new T.CylinderGeometry(.22,.22,.5,12,1,true),railGeo=new T.BoxGeometry(1,.1,.1);
  this.hookMats=Object.fromEntries(Object.entries(HOOK_COLOR).map(([k,c])=>[k,new T.MeshPhysicalMaterial({color:c,emissive:c,emissiveIntensity:k==='rusty'?.25:.9,roughness:k==='slick'?.05:k==='rusty'?.85:.3,metalness:k==='rusty'?.4:.9,clearcoat:k==='slick'?1:0})]));
  const steel=new T.MeshStandardMaterial({color:0x6d7590,roughness:.4,metalness:.9});
  this.hooks=t.hooks.map(h=>{const g=new T.Group(),r=new T.Mesh(ring,this.hookMats[h.type]);g.add(r,new T.Mesh(bracket,steel));if(h.type==='spring'){const c=new T.Mesh(coil,this.hookMats.spring);c.rotation.x=Math.PI/2;c.position.z=-.5;g.add(c);}
   if(h.type==='swing'){const rail=new T.Mesh(railGeo,steel);rail.scale.x=h.amp*2+.8;rail.position.set(h.x,h.y+.42,-.9);s.add(rail);g.userData.rail=rail;}g.position.set(h.x,h.y,0);g.userData.ring=r;s.add(g);return g;});
  this.glowTex=radial(glowStops);this.bones=t.bones.map(b=>{const sp=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(2.6,1.9,.5),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));sp.scale.set(1.1,1.1,1);sp.position.set(b.x,b.y,.3);s.add(sp);return sp;});
  // The leash, the peak line, and the DAWG.
  this.leash=new T.Mesh(new T.CylinderGeometry(.045,.045,1,6,1,true).translate(0,.5,0),new T.MeshBasicMaterial({color:new T.Color(2.4,2,1.2),toneMapped:false}));s.add(this.leash);
  this.peakLine=new T.Mesh(new T.PlaneGeometry(W,.07),new T.MeshBasicMaterial({color:new T.Color(3,.4,.6),transparent:true,opacity:.85,toneMapped:false,depthWrite:false}));this.peakLine.position.z=.6;s.add(this.peakLine);
  this.peakTag=new T.Mesh(new T.PlaneGeometry(3.2,.6),new T.MeshBasicMaterial({map:signTex('YOUR PEAK','#ff5d8f'),transparent:true,toneMapped:false,depthWrite:false}));this.peakTag.position.set(CLIMB.half-1.8,0,.62);s.add(this.peakTag);
  this.holder=new T.Group();s.add(this.holder);this.particles=new Particles(s,high?500:240,this.glowTex);this.v=new T.Vector3();this.up=new T.Vector3(0,1,0);
  this.rain=high?new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(Array.from({length:600*6},(_,i)=>{const n=Math.floor(i/6),k=i%6;const x=((n*37)%40)-20,y=((n*53)%60),z=((n*17)%12)-2;return k===0||k===3?x:k===1?y:k===4?y-.8:z;}),3)),new T.LineBasicMaterial({color:0x8fa8ff,transparent:true,opacity:.35})):null;if(this.rain)s.add(this.rain);
 }
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;const next=createDawgAsset(d);next.root.scale.setScalar(1.05);next.root.position.y=-1.1;if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.holder.add(next.root);}
 event(e,g){if(!this.ready)return;const st=this.stage,hud=this.hud,P=this.particles,rd=this.reduced;
  if(e.type==='grab'){P.burst(e.x,e.y,.2,10,HOOK_COLOR[e.kind]||0xffd25e,{speed:3,life:.35});}
  else if(e.type==='snap'){P.burst(this.hooks[e.hook].position.x,this.hooks[e.hook].position.y,.2,40,0xc8642a,{speed:6,life:.8,gravity:-12});hud.pop('SNAP!','big');st.shake(.45);}
  else if(e.type==='slip'){P.burst(e.x,e.y+1,.2,24,0x6fe8ff,{speed:3,life:.6,gravity:-10});hud.pop('SLIPPED','big');st.shake(.2);}
  else if(e.type==='spring'){P.burst(e.x,e.y,.2,30,0x7dff5e,{speed:7,life:.5});hud.pop('BOING!','dodge');st.shake(.25);}
  else if(e.type==='whiff'){if(e.near){hud.pop('SO CLOSE','big');st.flashOnce(0xff3366,.18,rd);}else hud.pop('MISS','gold');}
  else if(e.type==='bone'){P.burst(e.x,e.y,.3,26,0xffd25e,{speed:4,life:.6,gravity:-3});hud.pop('+50','gold');}
  else if(e.type==='wall'){st.shake(.15);}
  else if(e.type==='floor'){hud.banner(`FLOOR ${e.floor+1} · ${e.name.toUpperCase()}`);st.flashOnce(FLOOR_LOOK[e.floor][2],.18,rd);P.burst(g.x,g.y,.3,50,FLOOR_LOOK[e.floor][2],{speed:7,life:.9});}
  else if(e.type==='fall'){this.fallShown=e.meters;this.fallLine=e.line;this.fallUntil=performance.now()+2600;st.shake(Math.min(1,.3+e.meters/60));st.flashOnce(0xff2244,Math.min(.6,.15+e.meters/120),rd);P.burst(e.x,e.y,.3,Math.min(90,20+e.meters),0xff5d8f,{speed:8,life:.8});}
  else if(e.type==='land'){P.burst(e.x,e.y,.3,6,0xbfc8e6,{speed:2,life:.3});}
  else if(e.type==='summit'){hud.banner('THE PENTHOUSE');for(let i=0;i<5;i++)P.burst(g.x+(i-2)*2,g.y+2+i,.4,60,[0xffd25e,0xff4fd8,0x5ec8ff,0x7dff5e,0xffffff][i],{speed:9,life:1.4});st.flashOnce(0xffd25e,.5,rd);}
  else if(e.type==='over'){st.shake(.8);st.flashOnce(0xff3355,.5,rd);}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<3000));return true;}
 render(g,d,now){
  this.stage.resize();this.prepare(d);const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced,t=tower();this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  // Look: blend the sky and haze between this floor and the next.
  const fy=Math.max(0,g.y)/50,f0=Math.min(FLOORS.length-1,Math.floor(fy)),f1=Math.min(FLOORS.length-1,f0+1),k=fy-Math.floor(fy),L=i=>new T.Color(FLOOR_LOOK[f0][i]).lerp(new T.Color(FLOOR_LOOK[f1][i]),k);
  const fog=L(1).multiplyScalar(.7);this.scene.fog.color.copy(fog);this.scene.fog.density=.0055+Math.max(0,fy-6)*.003;const u=this.sky.material.uniforms;u.uTop.value.copy(L(0));u.uHorizon.value.copy(fog);u.uGlow.value.copy(L(2)).multiplyScalar(.5);this.trimMat.color.copy(L(2)).multiplyScalar(2.2);
  // Things near the camera only.
  const cy=g.y;for(let i=0;i<t.hooks.length;i++){const h=t.hooks[i],m=this.hooks[i],near=Math.abs(h.y-cy)<26;m.visible=near&&!g.broken.includes(i);if(m.userData.rail)m.userData.rail.visible=near;if(!near)continue;const p=hookPos(h,g.time);m.position.set(p.x,p.y,0);
   const r=m.userData.ring;r.rotation.y=g.hook===i?0:Math.sin(real*1.3+i)*.25;r.scale.setScalar(g.hook===i?1.25:1);
   if(h.type==='rusty'&&g.hook===i&&!reduced){m.position.x+=Math.sin(real*60)*.04*g.grip/CLIMB.rusty;}}
  for(let i=0;i<t.ledges.length;i++)this.ledges[i].visible=i>0&&Math.abs(t.ledges[i].y-cy)<30;
  for(let i=0;i<t.bones.length;i++){const b=this.bones[i];b.visible=!g.bones.includes(i)&&Math.abs(t.bones[i].y-cy)<26;if(b.visible)b.scale.setScalar(1+Math.sin(real*4+i)*.15);}
  // The DAWG and the leash.
  if(Math.abs(g.vx)>.6)this.facing=g.vx>0?1:-1;this.holder.position.set(g.x,g.y,.15);
  if(this.asset){const swinging=g.hook>=0,falling=!swinging&&!g.grounded;this.asset.root.rotation.y=this.facing>0?Math.PI/2:-Math.PI/2;this.holder.rotation.z=swinging?Math.atan2(g.x-(hookPos(t.hooks[g.hook],g.time).x),-(g.y-t.hooks[g.hook].y))*.6:falling&&!reduced?Math.sin(real*9)*.3:0;
   setDawgPose(this.asset,real*(falling?2:1),g.grounded?Math.abs(g.vx)>.5?'walk':'idle':swinging?'arm':'run');}
  if(g.hook>=0){const p=hookPos(t.hooks[g.hook],g.time),a=new T.Vector3(g.x,g.y+.35,.15),b=new T.Vector3(p.x,p.y,0);this.v.subVectors(b,a);const len=this.v.length();this.leash.visible=true;this.leash.position.copy(a);this.leash.scale.set(1,len,1);this.leash.quaternion.setFromUnitVectors(this.up,this.v.normalize());
   this.lamp.color.setHex(HOOK_COLOR[t.hooks[g.hook].type]);}else{this.leash.visible=false;this.lamp.color.setHex(0xffc27a);}
  this.lamp.position.set(g.x,g.y+1.2,2.5);
  this.peakLine.position.y=this.peakTag.position.y=g.maxY;this.peakLine.visible=this.peakTag.visible=g.maxY-g.y>3;this.peakTag.position.y=g.maxY+.4;
  // Camera: a steady side view that pulls back and tilts when you're falling hard.
  const dropping=g.hook<0&&!g.grounded&&g.vy<-16,pull=dropping?Math.min(1,(-g.vy-16)/20):0;this.pull=(this.pull||0)+(pull-(this.pull||0))*Math.min(1,dt*3);
  const camX=g.x*.45,third={pos:new T.Vector3(camX+9+this.pull*2,g.y+3+this.pull*4,19+this.pull*7),at:new T.Vector3(camX*.7,g.y+.8-this.pull*4,0)};
  this.rig.update(dt,third,null,{follow:dropping?14:5,roll:reduced?0:this.pull*.08*Math.sin(real*2.2)});this.stage.applyShake(real,reduced);this.rig.aim();
  const cam=this.camera;cam.fov+=(fitFov(50+this.pull*8,cam.aspect,66)-cam.fov)*Math.min(1,dt*4);cam.far=700;cam.updateProjectionMatrix();
  this.sky.position.copy(cam.position);this.moon.position.set(cam.position.x-90,cam.position.y+80,-220);this.skyline.position.set(cam.position.x,50-Math.min(40,g.y*.12),cam.position.z);
  if(this.rain){this.rain.visible=fy>7.5&&!reduced;this.rain.position.set(cam.position.x,cam.position.y-30+((-real*40)%20+20)%20,0);}
  // HUD: height, floor, the tower gauge, the live drop counter and the verdict.
  const H=Math.max(0,Math.floor(g.y));this.hud.set(this.ui.h,'h',String(H));this.hud.set(this.ui.floor,'f',FLOORS[floorOf(g.y)].toUpperCase());
  this.ui.me.style.bottom=(Math.min(1,g.y/CLIMB.top)*100).toFixed(2)+'%';this.ui.peak.style.bottom=(Math.min(1,g.maxY/CLIMB.top)*100).toFixed(2)+'%';
  const live=g.hook<0&&!g.grounded&&g.peak-g.y>4;let fall='',line='';if(live){fall='−'+Math.floor(g.peak-g.y)+' M';line='DON’T LOOK DOWN';}else if(now<this.fallUntil){fall='−'+this.fallShown+' M';line=this.fallLine||'';}
  this.ui.fall.hidden=!fall;this.hud.set(this.ui.fallN,'fn',fall);this.hud.set(this.ui.fallT,'ft',line);this.ui.fall.classList.toggle('cl-live',live);
  const hk=g.hook>=0?t.hooks[g.hook]:null,grip=hk&&(hk.type==='rusty'||hk.type==='slick')?Math.max(0,1-g.grip/(hk.type==='rusty'?CLIMB.rusty:CLIMB.slick)):null;this.ui.grip.hidden=grip===null;if(grip!==null){this.ui.grip.style.setProperty('--grip',grip.toFixed(3));this.hud.set(this.ui.grip,'gt',hk.type==='rusty'?'RUSTY · IT WON’T HOLD':'SLICK · SLIPPING');}
  for(const b of this.beacons)b.material.opacity=reduced?.8:.25+.75*Math.max(0,Math.sin(real*2.4+b.userData.p));
  this.particles.update(dt,{x:0,y:0,z:0});this.hud.live(g.status==='playing');
  this.stage.render(dt,real,{reduced,aberration:.0015+this.pull*.004});
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();try{this.asset?.dispose();}catch{}this.stage?.dispose();}
}
