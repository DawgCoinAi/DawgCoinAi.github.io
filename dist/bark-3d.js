// Three.js presentation for Last Bark Standing: a neon rooftop high over the city, its edge lit by
// a ring that shrinks and reddens, twenty DAWGs (yours in full, the rest as rivals with their own
// coats), bark shockwaves, a charge meter and the live count. BarkGame owns every rule; this only
// reads it. Engine (x, y) maps to world (x, 0, y). Third person follows you from behind and above.
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,quality,fitFov,radial,glowStops,skylineTexture,skyMaterial,Stage,Particles,CameraRig,Hud,AmbientLoop,pbr,castShadows,contactShadow,lightShaft} from './three-kit.js';
import {BARK,roofRadius} from './bark-engine.js';
import {npcDawg} from './npc-dawg.js';
const STYLE_COLOR={brawler:0xff6a3d,bully:0xff2d55,coward:0x5ec8ff,drifter:0xb9ff5e};

export class ThreeBark {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.clock=performance.now();this.status='';this.statusSince=performance.now();this.cast=[];this.castSeed=-1;this.asset=null;this.assetKey='';this.waves=[];}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d bark3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="bk-left"><b class="bk-alive">20</b><small>ON THE ROOF</small><span class="bk-kos">0 KNOCKED OFF</span></div><div class="bk-clock"><b>90</b></div><div class="bk-charge" hidden><i></i><span>BARK</span></div><div class="bk-shrink" hidden>THE ROOF IS SHRINKING</div>');this.view.append(this.hud.root);
  this.ui={alive:this.hud.q('.bk-alive'),kos:this.hud.q('.bk-kos'),clock:this.hud.q('.bk-clock b'),charge:this.hud.q('.bk-charge'),chargeFill:this.hud.q('.bk-charge i'),chargeText:this.hud.q('.bk-charge span'),shrink:this.hud.q('.bk-shrink')};
  this.rig=new CameraRig(this.camera);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D ROOFTOP · LIVE');return this;}
 setCamera(){}
 build(){const s=this.scene,high=this.quality==='high',R=BARK.radius;this.stage.neonEnvironment(.7);this.stage.hdrEnvironment(undefined,.55);s.fog=new T.FogExp2(0x0b0a1c,.012);
  this.sky=new T.Mesh(new T.SphereGeometry(300,32,16),skyMaterial());const u=this.sky.material.uniforms;u.uTop.value.set(0x05040f);u.uHorizon.value.set(0x1c1038);u.uGlow.value.set(0xff4fd8).multiplyScalar(.28);s.add(this.sky);
  this.skyline=new T.Mesh(new T.CylinderGeometry(170,170,110,48,1,true),new T.MeshBasicMaterial({map:skylineTexture(),transparent:true,side:T.BackSide,fog:false,depthWrite:false}));this.skyline.material.map.repeat.set(5,1);this.skyline.position.y=-30;s.add(this.skyline);
  this.moon=new T.Sprite(new T.SpriteMaterial({map:radial([[0,'#fffaf0'],[.3,'#fff2d6'],[.36,'#ffe3b355'],[1,'#ffd09000']]),fog:false,depthWrite:false,color:new T.Color(1.6,1.5,1.4)}));this.moon.scale.set(40,40,1);this.moon.position.set(-80,70,-200);s.add(this.moon);
  s.add(new T.HemisphereLight(0xa9b4ff,0x1a1028,1));this.key=new T.DirectionalLight(0xfff0e0,2);this.key.position.set(-8,16,10);s.add(this.key,this.key.target);this.stage.sunShadow(this.key,{size:14,far:50,map:2048,radius:3});
  // The roof: a concrete disc with a painted helipad ring, a parapet lip, vents and a water tower.
  const roofTex=(c,w,h)=>{c.fillStyle='#2a2d3a';c.fillRect(0,0,w,h);for(let i=0;i<900;i++){c.fillStyle=i%2?'#ffffff07':'#00000012';c.fillRect((i*73)%w,(i*151)%h,2,2);}c.strokeStyle='#ffffff10';c.lineWidth=2;for(let i=0;i<8;i++){c.beginPath();c.moveTo(0,i*h/8);c.lineTo(w,i*h/8);c.moveTo(i*w/8,0);c.lineTo(i*w/8,h);c.stroke();}};
  const tex=new T.CanvasTexture((()=>{const c=document.createElement('canvas');c.width=c.height=512;roofTex(c.getContext('2d'),512,512);return c;})());tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(4,4);
  const roof=new T.Mesh(new T.CircleGeometry(R+.6,96).rotateX(-Math.PI/2),pbr({map:tex,color:0xc8ccdc,roughness:.55,metalness:.2,clearcoat:.3,clearcoatRoughness:.5,envMapIntensity:.6},this.quality));roof.receiveShadow=high;s.add(roof);
  const lip=new T.Mesh(new T.TorusGeometry(R+.55,.14,10,96).rotateX(Math.PI/2),pbr({color:0x3a3f52,roughness:.5,metalness:.5},this.quality));lip.position.y=.08;s.add(lip);
  const paint=new T.Mesh(new T.RingGeometry(3.2,3.5,64).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0xffd25e,transparent:true,opacity:.35,toneMapped:false,depthWrite:false}));paint.position.y=.012;s.add(paint);
  const H=new T.Mesh(new T.PlaneGeometry(2.4,2.4).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#ffd25e';x.font='900 110px Impact,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('D',64,70);return new T.CanvasTexture(c);})(),transparent:true,opacity:.4,toneMapped:false,depthWrite:false}));H.position.y=.013;s.add(H);
  // Below: the building's own facade dropping away, and towers around.
  const faceTex=skylineTexture();const bodyMat=pbr({color:0x1a1d2e,roughness:.3,metalness:.7,envMapIntensity:.8},this.quality);const body=new T.Mesh(new T.CylinderGeometry(R+.6,R+.6,120,48,1,true),bodyMat);body.position.y=-60;s.add(body);
  const win=new T.InstancedMesh(new T.PlaneGeometry(.5,.7),new T.MeshBasicMaterial({color:new T.Color(1.6,1.2,.7),toneMapped:false,side:T.DoubleSide}),high?480:200);const M=new T.Matrix4(),Q=new T.Quaternion(),Y=new T.Vector3(0,1,0),one=new T.Vector3(1,1,1);let n=0;
  for(let i=0;i<win.count;i++){const a=(i*2.399)%(Math.PI*2),y=-2.5-((i*37)%110);if((i*7)%3===0)continue;Q.setFromAxisAngle(Y,a);M.compose(new T.Vector3(Math.cos(a-Math.PI/2)*(R+.62),y,Math.sin(a-Math.PI/2)*(R+.62)),Q,one);win.setMatrixAt(n++,M);}win.count=n;s.add(win);
  const box=new T.BoxGeometry(1,1,1).translate(0,.5,0),tmat=pbr({color:0x30364a,roughness:.4,metalness:.6,emissive:0x202a44,emissiveIntensity:.3},this.quality);for(let i=0;i<(high?26:14);i++){const a=i*2.399,d=30+((i*53)%70),h=25+((i*97)%90),m=new T.Mesh(box,tmat);m.scale.set(8+(i*5)%9,h,8+(i*3)%7);m.position.set(Math.cos(a)*d,-70,Math.sin(a)*d);s.add(m);const bc=new T.Sprite(new T.SpriteMaterial({map:radial(glowStops),color:new T.Color(3,.3,.3),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));bc.scale.set(4,4,1);bc.position.set(Math.cos(a)*d,-70+h+1,Math.sin(a)*d);s.add(bc);}
  // Props on the roof edge: vents, an aerial, a water tower (outside the ring so nothing blocks play).
  const vent=pbr({color:0x5a6072,roughness:.45,metalness:.7},this.quality);for(let i=0;i<6;i++){const a=i*1.05+.4,m=new T.Mesh(box,vent);m.scale.set(.8,.5,.6);m.position.set(Math.cos(a)*(R+.15),0,Math.sin(a)*(R+.15));castShadows(m,this.quality);s.add(m);}
  const tower=new T.Group(),tank=new T.Mesh(new T.CylinderGeometry(1.2,1.1,2,16),pbr({color:0x6a4a3a,roughness:.7,metalness:.3},this.quality));tank.position.y=3.6;const legs=new T.Mesh(new T.CylinderGeometry(.08,.08,2.6,6),vent);for(let i=0;i<4;i++){const l=legs.clone();l.position.set(Math.cos(i*1.57)*.9,1.3,Math.sin(i*1.57)*.9);tower.add(l);}tower.add(tank);tower.position.set(0,-2.2,-(R+5.5));castShadows(tower,this.quality);s.add(tower);
  // The ring: a glowing band at the roof's live edge, plus a faint wall rising from it.
  this.ring=new T.Mesh(new T.TorusGeometry(R,.09,8,96).rotateX(Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(.4,2.4,1.6),toneMapped:false}));this.ring.position.y=.06;s.add(this.ring);
  this.wall=new T.Mesh(new T.CylinderGeometry(R,R,3,96,1,true),new T.MeshBasicMaterial({color:new T.Color(.3,1.8,1.2),transparent:true,opacity:.12,side:T.DoubleSide,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending}));this.wall.position.y=1.5;s.add(this.wall);
  this.glowTex=radial(glowStops);this.particles=new Particles(s,high?600:260,this.glowTex);
  this.waveGeo=new T.RingGeometry(.6,1,48,1,-Math.PI/2,Math.PI).rotateX(-Math.PI/2);this.holder=new T.Group();s.add(this.holder);this.shadow=contactShadow(.9);s.add(this.shadow);
  this.capsule=new T.CapsuleGeometry(.22,.4,4,10).translate(0,.45,0);this.capMats={};for(const [k,c] of Object.entries(STYLE_COLOR))this.capMats[k]=new T.MeshStandardMaterial({color:c,roughness:.5,metalness:.2,emissive:c,emissiveIntensity:.15});}
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;const next=createDawgAsset(d);next.root.scale.setScalar(.72);castShadows(next.root,this.quality);if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.holder.add(next.root);}
 // Rivals: full DAWG models on high, coloured capsules with ears on low.
 syncCast(g){if(this.castSeed===g.worldSeed)return;this.castSeed=g.worldSeed;for(const c of this.cast){c.holder.removeFromParent();c.asset?.dispose();}this.cast=[];
  for(const d of g.dawgs){if(!d.k)continue;const holder=new T.Group();let asset=null;if(this.quality==='high'){asset=createDawgAsset(npcDawg(d.name+' '+g.worldSeed));asset.root.scale.setScalar(.72);castShadows(asset.root,this.quality);holder.add(asset.root);}
   else{const m=new T.Mesh(this.capsule,this.capMats[d.style]);holder.add(m);}
   const tag=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(STYLE_COLOR[d.style]).multiplyScalar(1.2),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));tag.scale.set(.5,.5,1);tag.position.y=1.5;holder.add(tag);
   this.scene.add(holder);this.cast.push({k:d.k,holder,asset,tag});}}
 event(e,g){if(!this.ready)return;const st=this.stage,hud=this.hud,P=this.particles,rd=this.reduced;
  if(e.type==='bark'){this.waves.push({x:e.x,y:e.y,a:e.face,r:e.range,t:0,mega:e.mega,you:!e.k});P.burst(e.x+Math.cos(e.face)*.6,.6,e.y+Math.sin(e.face)*.6,e.mega?60:16+e.charge*20,e.mega?0xffd25e:!e.k?0xffffff:0xff9ad8,{speed:3+e.charge*6,life:.4});if(!e.k){st.shake(e.mega?.5:.12+e.charge*.2);if(e.mega)hud.pop('MEGA BARK','big');else if(e.hits)hud.pop(e.hits>1?e.hits+' HIT':'HIT','dodge');}}
  else if(e.type==='hit'&&!e.k){st.shake(.35);st.flashOnce(0xff3355,.25,rd);}
  else if(e.type==='fall'){P.burst(e.x,.3,e.y,24,0xffffff,{speed:3,life:.6,gravity:-6});}
  else if(e.type==='out'){if(e.byYou){hud.pop(e.name.toUpperCase()+' OFF THE ROOF','gold');st.flashOnce(0xffd25e,.15,rd);}if(e.left<=3&&e.k)hud.banner(e.left===1?'LAST BARK STANDING':`FINAL ${e.left}`);}
  else if(e.type==='shrink'){hud.banner(e.t===BARK.grace?'THE ROOF IS SHRINKING':e.t>=80?'LAST STAND':'KEEP TO THE MIDDLE');this.shrinkUntil=performance.now()+2200;}
  else if(e.type==='win'){hud.banner('LAST BARK STANDING');for(let i=0;i<4;i++)P.burst(g.you.x,1+i*.4,g.you.y,60,[0xffd25e,0xff4fd8,0x5ec8ff,0xffffff][i],{speed:8,life:1.3});st.flashOnce(0xffd25e,.4,rd);}
  else if(e.type==='over'&&g.place!==1){st.shake(.7);st.flashOnce(0xff2244,.5,rd);}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<3000));return true;}
 render(g,d,now){
  this.stage.resize();this.prepare(d);this.syncCast(g);const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced,R=roofRadius(g.time),you=g.you;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  // The ring tightens and turns from teal to red as it closes.
  const danger=1-(R-BARK.minRadius)/(BARK.radius-BARK.minRadius),rc=new T.Color(.4,2.4,1.6).lerp(new T.Color(3,.3,.5),danger);this.ring.scale.set(R/BARK.radius,1,R/BARK.radius);this.ring.material.color.copy(rc).multiplyScalar(reduced?1:1+.25*Math.sin(real*(4+danger*8)));this.wall.scale.set(R/BARK.radius,1,R/BARK.radius);this.wall.material.color.copy(rc).multiplyScalar(.5);this.wall.material.opacity=.03+danger*.1;
  // Everyone on the roof: yours from the asset, rivals from the cast; falling DAWGs drop and spin.
  const place=(holder,p,asset,moving)=>{holder.position.set(p.x,p.fall?-Math.pow(p.fall*3.4,2):0,p.y);holder.rotation.set(0,-p.face+Math.PI/2,0);if(p.fall&&!reduced){holder.rotation.x=p.fall*5;holder.rotation.z=p.fall*3;}holder.visible=p.alive;if(asset)setDawgPose(asset,real,p.charge>0?'arm':moving?'run':'idle');};
  place(this.holder,you,this.asset,Math.hypot(you.vx,you.vy)>.6);this.shadow.position.set(you.x,.015,you.y);this.shadow.visible=you.alive&&!you.fall;
  for(const c of this.cast){const p=g.dawgs[c.k];place(c.holder,p,c.asset,Math.hypot(p.vx,p.vy)>.6);c.tag.material.opacity=p.charge>0?.6+.4*Math.sin(real*20):.35;c.tag.scale.setScalar(.4+p.charge*.6);}
  // Bark shockwaves: a half ring that expands along the bark's direction and fades.
  for(const w of this.waves){w.t+=dt;if(!w.mesh){w.mesh=new T.Mesh(this.waveGeo,new T.MeshBasicMaterial({color:new T.Color(w.mega?0xffd25e:w.you?0xffffff:0xff9ad8).multiplyScalar(2),transparent:true,opacity:.8,toneMapped:false,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}));w.mesh.position.set(w.x,.1,w.y);w.mesh.rotation.y=-w.a;this.scene.add(w.mesh);}
   const k=Math.min(1,w.t/.3);w.mesh.scale.setScalar(.3+w.r*k);w.mesh.material.opacity=.8*(1-k);}
  this.waves=this.waves.filter(w=>{if(w.t<.3)return true;w.mesh?.removeFromParent();w.mesh?.material.dispose();return false;});
  // Camera: behind and above you, pulled back as the crowd thins; a slow orbit while you wait.
  const idle=g.status==='ready',ang=idle?real*.25:you.face,back=9.5-danger*2.5,pos=new T.Vector3(you.x-Math.cos(ang)*back,8.5-danger*2,you.y-Math.sin(ang)*back),at=new T.Vector3(you.x+Math.cos(ang)*2.5,.4,you.y+Math.sin(ang)*2.5);
  if(you.fall||!you.alive){pos.set(you.x*.5,9,you.y*.5+10);at.set(0,0,0);}
  this.rig.update(dt,{pos,at},null,{follow:you.fall?3:7});this.stage.applyShake(real,reduced);this.rig.aim();const cam=this.camera;cam.fov+=(fitFov(54,cam.aspect,76)-cam.fov)*Math.min(1,dt*5);cam.near=.1;cam.far=600;cam.updateProjectionMatrix();this.stage.followSun?.(this.key,you.x,0,you.y);
  this.sky.position.copy(cam.position);this.skyline.position.set(cam.position.x,-30,cam.position.z);
  // HUD.
  this.hud.set(this.ui.alive,'a',String(g.alive));this.hud.set(this.ui.kos,'k',g.kos+' KNOCKED OFF');this.hud.set(this.ui.clock,'c',String(Math.max(0,Math.ceil(BARK.length-g.time))));
  const charging=you.charge>0&&you.alive;this.ui.charge.hidden=!charging;if(charging){this.ui.chargeFill.style.transform=`scaleX(${you.charge.toFixed(3)})`;this.ui.charge.classList.toggle('bk-mega',you.charge>=.98);this.hud.set(this.ui.chargeText,'ct',you.charge>=.98?'MEGA':'BARK');}
  this.ui.shrink.hidden=!(this.shrinkUntil&&now<this.shrinkUntil);
  this.particles.update(dt,{x:0,y:0,z:0});this.hud.live(g.status==='playing');this.stage.render(dt,real,{reduced,aberration:.0015+danger*.002});
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();try{this.asset?.dispose();}catch{}for(const c of this.cast)try{c.asset?.dispose();}catch{}this.stage?.dispose();}
}
