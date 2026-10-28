// Three.js presentation for Maze Munch, Rush and Daily. MazeGame owns every rule; this module
// draws the maze as neon corridors. First person walks them at DAWG eye level with a minimap
// and rival warnings; third person is a tilted, north-up chase view.
// World units: one maze tile is one meter; tile (x, y) sits at world (x, 0, y), so north is -z.
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,smooth,quality,fitFov,texture,radial,glowStops,skyMaterial,pbr,Stage,Particles,CameraRig,Hud,AmbientLoop} from './three-kit.js';
import {heatLabel} from './difficulty.js';

export const HEADING={up:Math.PI,right:Math.PI/2,down:0,left:-Math.PI/2};
const STEP={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const RIVAL_COLORS=[0xff4f6a,0xff8ad8,0x48e6ff,0xffb43a];
const WALL_H=1.15,EYE=.48;
const floorTexture=()=>texture(256,256,(c,w,h)=>{c.fillStyle='#0c1020';c.fillRect(0,0,w,h);c.strokeStyle='#1e2846';c.lineWidth=3;c.strokeRect(1.5,1.5,w-3,h-3);c.strokeStyle='#ffffff0c';c.lineWidth=1;c.beginPath();c.moveTo(w/2,0);c.lineTo(w/2,h);c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();},{repeat:true});
const wallTexture=lit=>texture(128,128,(c,w,h)=>{c.fillStyle=lit?'#000':'#161c34';c.fillRect(0,0,w,h);if(!lit){c.fillStyle='#ffffff0a';for(let y=14;y<h;y+=18)c.fillRect(0,y,w,2);c.fillStyle='#0a0d1a';c.fillRect(0,0,3,h);c.fillRect(w-3,0,3,h);}
 c.fillStyle=lit?'#ffffff':'#2a3358';c.fillRect(0,0,w,7);c.fillRect(0,h-5,w,5);c.globalAlpha=lit?.55:1;c.fillRect(0,h*.55,w,3);c.globalAlpha=lit?.35:1;for(let x=16;x<w-10;x+=26)c.fillRect(x,h*.22,12,h*.2);c.globalAlpha=1;});

export class ThreeMaze {
 constructor(host,onFailure,{quality:q=quality()}={}){Object.assign(this,{host,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.cameraMode='first';this.mapRef=null;this.asset=null;this.assetKey='';this.clock=performance.now();this.status='';this.statusSince=performance.now();this.yaw=Math.PI;this.facing='up';}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d maze3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<canvas class="m3-map" width="168" height="184" aria-hidden="true"></canvas><div class="m3-warn" hidden>⚠ RIVAL BEHIND YOU</div>');this.view.append(this.hud.root);this.mapCanvas=this.hud.q('.m3-map');this.warn=this.hud.q('.m3-warn');
  this.rig=new CameraRig(this.camera);this.rig.setMode(this.cameraMode);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  this.build();this.host.append(this.view);this.ready=true;return this;
 }
 setCamera(mode){this.cameraMode=mode==='third'?'third':'first';this.rig?.setMode(this.cameraMode);}
 build(){
  const s=this.scene,high=this.quality==='high';this.stage.neonEnvironment(.6);s.fog=new T.FogExp2(0x0a0d1c,.06);
  this.sky=new T.Mesh(new T.SphereGeometry(120,24,12),skyMaterial());s.add(this.sky);
  const stars=[];for(let i=0;i<300;i++){const a=Math.random()*Math.PI*2,y=.2+Math.random()*.75;stars.push(Math.cos(a)*110*(1-y*.5),y*110,Math.sin(a)*110*(1-y*.5));}const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(stars,3));this.stars=new T.Points(sg,new T.PointsMaterial({color:0xe8e4ff,size:1.4,sizeAttenuation:false,fog:false,transparent:true,opacity:.8}));s.add(this.stars);
  this.hemi=new T.HemisphereLight(0x9fb2ff,0x1a1028,.75);s.add(this.hemi);this.lamp=new T.PointLight(0xffd6a0,4,5,1.6);s.add(this.lamp);
  this.moonLight=new T.DirectionalLight(0xc8d4ff,1.4);this.moonLight.position.set(-8,20,-6);s.add(this.moonLight,this.moonLight.target);
  const ftex=floorTexture();this.floor=new T.Mesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),pbr({map:ftex,metalness:.55,roughness:.3,envMapIntensity:.95,color:0x8a92b0,clearcoat:.6,clearcoatRoughness:.12},this.quality));this.floor.receiveShadow=true;this.floorTex=ftex;s.add(this.floor);
  this.wallMat=new T.MeshStandardMaterial({map:wallTexture(false),emissiveMap:wallTexture(true),emissive:0xffffff,emissiveIntensity:1.3,metalness:.45,roughness:.45,color:0x3a4266});
  this.capMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.wallGeo=new T.BoxGeometry(1,WALL_H,1).translate(0,WALL_H/2,0);this.capGeo=new T.BoxGeometry(1.02,.05,1.02).translate(0,WALL_H+.025,0);
  this.pelletMat=new T.MeshBasicMaterial({color:new T.Color(1.25,1.05,.75),toneMapped:false});this.powerMat=new T.MeshBasicMaterial({color:new T.Color(1,1.9,.75),toneMapped:false});
  this.pellets=new T.InstancedMesh(new T.SphereGeometry(.055,8,6),this.pelletMat,500);this.powers=new T.InstancedMesh(new T.SphereGeometry(.17,16,12),this.powerMat,16);for(const m of [this.pellets,this.powers]){m.frustumCulled=false;s.add(m);}
  this.goldMat=new T.MeshStandardMaterial({color:0xffc83d,metalness:1,roughness:.15,emissive:0xff8a00,emissiveIntensity:.45,envMapIntensity:1.8});this.loot=new T.Mesh(new T.CylinderGeometry(.24,.24,.06,24).rotateX(Math.PI/2),this.goldMat);s.add(this.loot);
  this.glowTex=radial(glowStops);this.particles=new Particles(s,high?400:220,this.glowTex);
  this.rivals=RIVAL_COLORS.map(color=>this.makeRival(color));
  this.holder=new T.Group();s.add(this.holder);
  this.dummy=new T.Object3D();
 }
 makeRival(color){
  const g=new T.Group(),mat=pbr({color,emissive:color,emissiveIntensity:.9,metalness:.3,roughness:.3,transparent:true,clearcoat:1,clearcoatRoughness:.1},this.quality),body=new T.Mesh(new T.CapsuleGeometry(.24,.32,6,14).translate(0,.42,0),mat),white=new T.MeshBasicMaterial({color:0xffffff}),dark=new T.MeshBasicMaterial({color:0x0a0a18});
  for(const x of [-.1,.1]){const eye=new T.Mesh(new T.SphereGeometry(.07,10,8),white),pupil=new T.Mesh(new T.SphereGeometry(.035,8,6),dark);eye.position.set(x,.58,.2);pupil.position.set(x,.58,.26);g.add(eye,pupil);}
  const glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTex||radial(glowStops),color:new T.Color(color).multiplyScalar(1.2),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));glow.scale.set(1.4,1.4,1);glow.position.y=.45;g.add(body,glow);g.userData={mat,color,glow};this.scene.add(g);return g;
 }
 // Rebuilds walls, floor and the minimap backdrop whenever the level's map changes.
 buildMap(game){
  this.mapRef=game.map;const rows=game.map.length,cols=game.map[0].length;this.rows=rows;this.cols=cols;
  this.walls?.removeFromParent();this.caps?.removeFromParent();this.walls?.dispose?.();this.caps?.dispose?.();
  const tiles=[];game.map.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#')tiles.push([x,y]);}));
  this.walls=new T.InstancedMesh(this.wallGeo,this.wallMat,tiles.length);this.caps=new T.InstancedMesh(this.capGeo,this.capMat,tiles.length);
  tiles.forEach(([x,y],i)=>{this.dummy.position.set(x,0,y);this.dummy.updateMatrix();this.walls.setMatrixAt(i,this.dummy.matrix);this.caps.setMatrixAt(i,this.dummy.matrix);});
  this.walls.castShadow=this.walls.receiveShadow=this.quality==='high';this.scene.add(this.walls);
  this.floor.scale.set(cols+8,1,rows+8);this.floor.position.set((cols-1)/2,0,(rows-1)/2);{const ml=this.moonLight,cx=(cols-1)/2,cz=(rows-1)/2;ml.target.position.set(cx,0,cz);ml.position.set(cx-8,20,cz-6);ml.target.updateMatrixWorld();this.stage.sunShadow(ml,{size:Math.max(cols,rows)*.62+1,far:50,map:2048,radius:2.5,bias:-.0004,normalBias:.02});}this.floorTex.repeat.set(cols+8,rows+8);
  // Minimap backdrop: walls drawn once per map.
  const mc=this.mapCanvas,cell=Math.floor(Math.min(mc.width/cols,mc.height/rows)),bg=document.createElement('canvas');bg.width=mc.width;bg.height=mc.height;const b=bg.getContext('2d');b.fillStyle='#0a0c18e6';b.fillRect(0,0,bg.width,bg.height);
  this.mapCell=cell;this.mapOff=[(mc.width-cols*cell)/2,(mc.height-rows*cell)/2];b.fillStyle='#4a3a78';tiles.forEach(([x,y])=>b.fillRect(this.mapOff[0]+x*cell,this.mapOff[1]+y*cell,cell,cell));this.mapBg=bg;
 }
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;const next=createDawgAsset(d);next.root.scale.setScalar(.48);next.root.traverse(o=>{if(o.isMesh)o.castShadow=false;});if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.holder.add(next.root);}
 event(e,g){
  if(!this.ready)return;const st=this.stage,hud=this.hud,at=(x,y)=>[x,.45,y];
  if(e.type==='pellet'){if(Math.random()<.4)this.particles.burst(...at(e.x,e.y),5,0xffd6a0,{speed:1.5,life:.35,gravity:-2,up:.6});}
  else if(e.type==='power'){this.particles.burst(...at(e.x,e.y),40,0x9cff6a,{speed:4,life:.8,gravity:-1});hud.pop('POWER UP! HUNT THEM','shield');st.flashOnce(0x5b7bff,.25,this.reduced);}
  else if(e.type==='eat'){this.particles.burst(...at(e.x,e.y),50,0x7ff3ff,{speed:5,life:.8});hud.pop('+'+e.bonus+(e.combo>1?' ×'+e.combo:''),'big');st.shake(.3);}
  else if(e.type==='hit'){this.particles.burst(...at(e.x,e.y),70,0xff4f6a,{speed:6,life:.9});hud.pop('CAUGHT!','big');st.shake(.8);st.flashOnce(0xff3355,.5,this.reduced);}
  else if(e.type==='loot'){this.particles.burst(...at(e.x,e.y),40,0xffc14d,{speed:5});hud.pop('+'+e.bonus+' LOOT','gold');}
  else if(e.type==='lootSpawn'){hud.pop('GOLD DROP ON THE MAP','gold');}
  else if(e.type==='dash'){st.shake(.15);}
  else if(e.type==='level'){hud.banner('BLOCK CLEARED');st.flashOnce(0xb9ff5e,.3,this.reduced);}
  else if(e.type==='heat'){hud.banner(heatLabel(e.tier));st.flashOnce(0xff7a3d,.2,this.reduced);}
  else if(e.type==='over'){st.shake(1);st.flashOnce(0xff3355,.5,this.reduced);}
 }
 draw(g,d,reduced=false,look=null){
  if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;this.look=look||this.look;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<2500));return true;
 }
 render(g,d,now){
  this.stage.resize();this.prepare(d);if(g.map!==this.mapRef)this.buildMap(g);const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  const glow=new T.Color(g.district?.color||'#a684ef'),accent=new T.Color(g.district?.secondary||'#7be1d2');this.capMat.color.copy(glow).multiplyScalar(1.6);this.wallMat.emissive.copy(glow).multiplyScalar(.9);this.hemi.color.copy(glow).lerp(new T.Color(0x9fb2ff),.75);
  const u=this.sky.material.uniforms;u.uTop.value.set(0x05060f);u.uHorizon.value.copy(glow).multiplyScalar(.18);u.uGlow.value.copy(accent).multiplyScalar(.25);this.scene.fog.color.copy(glow).multiplyScalar(.08);
  // Pellets and power pellets through instanced meshes.
  let n=0,pw=0;const pulse=reduced?1:1+Math.sin(real*6)*.2;
  for(const [k,c]of g.pellets){const i=k.indexOf(','),x=+k.slice(0,i),y=+k.slice(i+1);if(c==='o'){if(pw<16){this.dummy.position.set(x,.32,y);this.dummy.scale.setScalar(pulse);this.dummy.updateMatrix();this.powers.setMatrixAt(pw++,this.dummy.matrix);}}else if(n<500){this.dummy.position.set(x,.3,y);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.pellets.setMatrixAt(n++,this.dummy.matrix);}}
  this.pellets.count=n;this.powers.count=pw;this.pellets.instanceMatrix.needsUpdate=true;this.powers.instanceMatrix.needsUpdate=true;this.dummy.scale.setScalar(1);
  this.loot.visible=!!g.loot;if(g.loot){this.loot.position.set(g.loot.x,.4+Math.sin(real*3)*.06,g.loot.y);this.loot.rotation.y=real*3;}
  // Rivals: frightened ones turn blue and flicker as the power runs out.
  g.ghosts.forEach((gh,i)=>{const r=this.rivals[i],p=g.position(gh),u=r.userData,scared=g.power>0&&gh.cooldown<=0,ending=scared&&g.power<2&&Math.floor(real*8)%2===0;r.position.set(p.x,reduced?0:Math.abs(Math.sin(real*7+i))*.05,p.y);r.rotation.y=HEADING[gh.dir]??0;
   const col=scared?(ending?0xffffff:0x3a5bff):u.color;u.mat.color.set(col);u.mat.emissive.set(col);u.mat.opacity=gh.cooldown>0?.35:1;u.glow.material.color.set(col).multiplyScalar(1.2);});
  this.placePlayer(g,real,dt);this.placeCamera(g,dt,real);this.particles.update(dt);this.updateHud(g,real);
  this.stage.render(dt,real,{reduced,aberration:.0018+(g.dashTime>0?.006:0)});
 }
 placePlayer(g,real,dt){
  const p=g.position(g.player),moving=g.player.moving&&g.status==='playing';if(STEP[g.player.dir])this.facing=g.player.dir;
  // Turn smoothly toward the heading instead of snapping on every corner.
  const target=HEADING[this.facing];let diff=((target-this.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;this.yaw+=diff*Math.min(1,dt*(this.reduced?30:this.rig?.mix>.5?6.5:12));
  this.holder.position.set(p.x,0,p.y);this.holder.rotation.y=this.yaw;if(this.asset){this.asset.root.visible=this.rig.mix<.55;setDawgPose(this.asset,g.status==='ready'?real:g.time*1.4,moving?'run':'idle');}
  this.holder.visible=!(g.invincible>0&&!this.reduced&&Math.floor(real*10)%2===0);this.lamp.position.set(p.x,.9,p.y);this.px=p.x;this.py=p.y;
 }
 placeCamera(g,dt,real){
  const p={x:this.px,y:this.py},f=[Math.sin(this.yaw),Math.cos(this.yaw)],bob=this.reduced||!g.player.moving||g.status!=='playing'?0:Math.abs(Math.sin(real*7))*.018;
  const first={pos:new T.Vector3(p.x-f[0]*.42,EYE+.04+bob,p.y-f[1]*.42),at:new T.Vector3(p.x+f[0]*3,EYE-.12,p.y+f[1]*3)};
  const third={pos:new T.Vector3(p.x,7.5,p.y+4.6),at:new T.Vector3(p.x,0,p.y-.6)};
  this.rig.update(dt,third,first,{follow:this.rig.mix>.5?16:7,snap:g.status==='ready'&&this.rig.mix>.99});this.stage.applyShake(real,this.reduced);this.rig.aim();
  const cam=this.camera,fov=this.rig.mix>.5?64+(g.dashTime>0?6:0):50;cam.fov+=(fitFov(fov,cam.aspect,this.rig.mix>.5?60:56)-cam.fov)*Math.min(1,dt*6);cam.near=.05;cam.updateProjectionMatrix();
  this.sky.position.copy(cam.position);this.stars.position.copy(cam.position);
 }
 updateHud(g,real){
  const mc=this.mapCanvas,c=mc.getContext('2d'),cell=this.mapCell,[ox,oy]=this.mapOff,first=this.rig.mix>.5;mc.hidden=!first;this.hud.live(g.status==='playing'||g.status==='paused');
  if(first&&this.mapBg){c.clearRect(0,0,mc.width,mc.height);c.drawImage(this.mapBg,0,0);c.fillStyle='#ffd6a0';for(const [k,v]of g.pellets){const i=k.indexOf(',');const x=+k.slice(0,i),y=+k.slice(i+1);const r=v==='o'?cell*.36:cell*.14;c.fillRect(ox+x*cell+cell/2-r,oy+y*cell+cell/2-r,r*2,r*2);}
   if(g.loot){c.fillStyle='#ffc83d';c.fillRect(ox+g.loot.x*cell+1,oy+g.loot.y*cell+1,cell-2,cell-2);}
   g.ghosts.forEach((gh,i)=>{const q=g.position(gh);c.fillStyle=g.power>0?'#5b7bff':'#'+RIVAL_COLORS[i].toString(16).padStart(6,'0');c.beginPath();c.arc(ox+(q.x+.5)*cell,oy+(q.y+.5)*cell,cell*.42,0,Math.PI*2);c.fill();});
   const p=g.position(g.player),cx=ox+(p.x+.5)*cell,cy=oy+(p.y+.5)*cell,a=-this.yaw+Math.PI;c.save();c.translate(cx,cy);c.rotate(a);c.fillStyle='#b9ff5e';c.beginPath();c.moveTo(0,-cell*.7);c.lineTo(cell*.5,cell*.45);c.lineTo(-cell*.5,cell*.45);c.closePath();c.fill();c.restore();}
  // Warn when a rival closes in from outside the field of view.
  let behind=false;if(first&&g.status==='playing'&&g.power<=0){const p=g.position(g.player);for(const gh of g.ghosts){if(gh.cooldown>0)continue;const q=g.position(gh),dx=q.x-p.x,dy=q.y-p.y,dist=Math.hypot(dx,dy);if(dist<3.2&&dist>.3){const ang=Math.acos((dx*Math.sin(this.yaw)+dy*Math.cos(this.yaw))/dist);if(ang>1.2)behind=true;}}}
  this.warn.hidden=!behind;
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();try{this.asset?.dispose();}catch{}this.stage?.dispose();}
}
