// Three.js presentation for Echo Heist: each heist as a lit diorama seen from above, with sliding
// vault doors, glowing plates and switches, laser grids, guards with sight cones, and your crew:
// you in full colour, your past selves as cyan holograms walking the paths they'll take this loop.
// HeistGame owns every rule; this only reads it. Engine (x, y) maps to world (x, 0, y).
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,quality,radial,glowStops,texture,Stage,Particles,CameraRig,Hud,AmbientLoop,pbr,castShadows,contactShadow,lightShaft} from './three-kit.js';
import {HEIST,HEISTS,LOOP_FRAMES,HeistGame,heistMap,guardAt} from './heist-engine.js';
import {npcDawg} from './npc-dawg.js';
const WALL_H=1.5,CYAN=0x5ee7ff;

export class ThreeHeist {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.clock=performance.now();this.status='';this.statusSince=performance.now();this.level=-1;this.crew=[];this.crewKey='';this.marks=[];this.facing=[];}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d heist3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="hx-top"><b class="hx-name"></b><span class="hx-crew"></span></div><div class="hx-clock"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/><circle class="hx-ring" cx="22" cy="22" r="19" pathLength="100"/></svg><b class="hx-time">30</b></div><p class="hx-tip" hidden></p>');this.view.append(this.hud.root);
  this.ui={name:this.hud.q('.hx-name'),crew:this.hud.q('.hx-crew'),ring:this.hud.q('.hx-ring'),time:this.hud.q('.hx-time'),tip:this.hud.q('.hx-tip'),clock:this.hud.q('.hx-clock')};
  this.rig=new CameraRig(this.camera);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  const s=this.scene,high=this.quality==='high';this.stage.studioEnvironment(.5);this.stage.hdrEnvironment(undefined,.45);s.background=new T.Color(0x05060c);s.fog=new T.Fog(0x05060c,26,60);
  s.add(new T.HemisphereLight(0xb4c2ff,0x1a1028,1.2));this.key=new T.DirectionalLight(0xfff0e0,2.4);this.key.position.set(-6,14,8);s.add(this.key,this.key.target);this.stage.sunShadow(this.key,{size:12,far:40,map:2048,radius:3});
  this.glowTex=radial(glowStops);this.particles=new Particles(s,high?420:200,this.glowTex);
  this.holo=new T.MeshBasicMaterial({color:new T.Color(CYAN).multiplyScalar(.55),transparent:true,opacity:.5,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
  this.coneMat=new T.MeshBasicMaterial({color:new T.Color(2.2,.25,.4),transparent:true,opacity:.22,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,side:T.DoubleSide});
  this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D HEIST · LIVE');return this;}
 setCamera(){}
 // The heist's set: floor, walls, doors, plates, switches, lasers, loot, van and guards.
 build(level){const s=this.scene,m=heistMap(level),high=this.quality==='high';if(this.set){this.set.traverse(o=>{if(o.geometry&&!o.userData.shared)o.geometry.dispose?.();});s.remove(this.set);}for(const g of this.guards||[])g.asset.dispose();
  const set=this.set=new T.Group();s.add(set);this.level=level;this.ghostLines=null;
  const floorTex=texture(256,256,(c,w,h)=>{c.fillStyle='#3a4058';c.fillRect(0,0,w,h);c.strokeStyle='#545c7c';c.lineWidth=3;c.strokeRect(1.5,1.5,w-3,h-3);c.fillStyle='#ffffff06';for(let i=0;i<60;i++)c.fillRect((i*53)%w,(i*97)%h,3,3);});floorTex.wrapS=floorTex.wrapT=T.RepeatWrapping;floorTex.repeat.set(m.W,m.H);
  const floor=new T.Mesh(new T.PlaneGeometry(m.W,m.H).rotateX(-Math.PI/2),pbr({map:floorTex,color:0xdfe4f4,roughness:.38,metalness:.35,clearcoat:.6,clearcoatRoughness:.2,envMapIntensity:.8},this.quality));floor.position.set(m.W/2,0,m.H/2);floor.receiveShadow=high;set.add(floor);
  const walls=[];for(let r=0;r<m.H;r++)for(let c=0;c<m.W;c++)if(m.rows[r][c]==='#')walls.push([c,r]);
  const wallMat=pbr({color:0x3a4060,roughness:.5,metalness:.45,envMapIntensity:.8},this.quality),wall=new T.InstancedMesh(new T.BoxGeometry(1,WALL_H,1).translate(.5,WALL_H/2,.5),wallMat,walls.length),M=new T.Matrix4();walls.forEach(([c,r],i)=>{M.makeTranslation(c,0,r);wall.setMatrixAt(i,M);});castShadows(wall,this.quality);set.add(wall);
  // Neon strips along the foot of every wall that faces the floor.
  const edges=[];for(const [c,r] of walls)for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=m.rows[r+dr]?.[c+dc];if(n&&n!=='#')edges.push([c,r,dc,dr]);}
  const strip=new T.InstancedMesh(new T.BoxGeometry(1,.035,.05),new T.MeshBasicMaterial({color:new T.Color(1.6,.45,2),toneMapped:false}),Math.max(1,edges.length)),Q=new T.Quaternion(),Y=new T.Vector3(0,1,0),one=new T.Vector3(1,1,1);
  edges.forEach(([c,r,dc,dr],i)=>{Q.setFromAxisAngle(Y,dc?Math.PI/2:0);M.compose(new T.Vector3(c+.5+dc*.52,.02,r+.5+dr*.52),Q,one);strip.setMatrixAt(i,M);});set.add(strip);
  const wallAt=(c,r)=>m.rows[r]?.[c]==='#';
  this.doors=m.doors.map(d=>{const across=wallAt(d.c,d.r-1)&&wallAt(d.c,d.r+1),g=new T.Mesh(new T.BoxGeometry(across?.22:1,WALL_H,across?1:.22),pbr({color:0x8a6b3a,roughness:.3,metalness:.9,emissive:0xff9a3d,emissiveIntensity:.15},this.quality));g.position.set(d.c+.5,WALL_H/2,d.r+.5);castShadows(g,this.quality);set.add(g);return {d,g,y:WALL_H/2};});
  const pad=(c,r,color)=>{const p=new T.Mesh(new T.CylinderGeometry(.38,.42,.06,28),new T.MeshStandardMaterial({color:0x10141f,emissive:color,emissiveIntensity:.4,roughness:.3,metalness:.6}));p.position.set(c+.5,.03,r+.5);set.add(p);return p;};
  this.plates=m.plates.map(p=>({p,mesh:pad(p.c,p.r,0x5effc1)}));
  this.switches=m.switches.map(w=>{const base=pad(w.c,w.r,0x5ec8ff),con=new T.Mesh(new T.BoxGeometry(.4,.55,.25),pbr({color:0x30384e,roughness:.4,metalness:.7,emissive:0x5ec8ff,emissiveIntensity:.25},this.quality));con.position.set(w.c+.5,.3,w.r+.18);set.add(con);return {w,mesh:base,con};});
  this.lasers=m.lasers.map(L=>{const vertical=wallAt(L.c-1,L.r)&&wallAt(L.c+1,L.r),g=new T.Group();for(let i=0;i<3;i++){const b=new T.Mesh(new T.CylinderGeometry(.018,.018,1,6).rotateZ(Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(3,.15,.3),toneMapped:false}));b.position.y=.25+i*.4;if(!vertical)b.rotation.y=Math.PI/2;g.add(b);}g.position.set(L.c+.5,0,L.r+.5);set.add(g);return {L,g};});
  const gem=new T.OctahedronGeometry(.22,0);this.gemMat=pbr({color:0xffd25e,emissive:0xffa630,emissiveIntensity:.6,roughness:.15,metalness:1,clearcoat:1},this.quality);this.gemGeo=gem;
  this.loot=m.loot.map(L=>{const g=new T.Mesh(gem,this.gemMat),glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(2,1.4,.4),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));glow.scale.set(1.2,1.2,1);g.add(glow);g.position.set(L.c+.5,.55,L.r+.5);set.add(g);return {L,g};});
  for(const [c,r] of m.van){const z=new T.Mesh(new T.PlaneGeometry(.94,.94).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(.2,.9,.5),transparent:true,opacity:.3,toneMapped:false,depthWrite:false}));z.position.set(c+.5,.02,r+.5);set.add(z);
   const van=new T.Group(),body=new T.Mesh(new T.BoxGeometry(.8,.55,.5),pbr({color:0x1d2233,roughness:.25,metalness:.8,clearcoat:1},this.quality)),glass=new T.Mesh(new T.BoxGeometry(.3,.22,.52),new T.MeshBasicMaterial({color:new T.Color(.4,1.4,1.6),toneMapped:false}));body.position.y=.38;glass.position.set(.18,.55,0);van.add(body,glass);van.position.set(c+.5,0,r+.5-.05);van.scale.setScalar(.8);set.add(van);}
  this.guards=m.guards.map((gd,i)=>{const asset=createDawgAsset(npcDawg('Night guard '+(level*3+i)));asset.root.scale.setScalar(.78);castShadows(asset.root,this.quality);const holder=new T.Group();holder.add(asset.root);set.add(holder);
   const cone=new T.Mesh(new T.CircleGeometry(gd.range,32,-gd.cone*Math.PI/360,gd.cone*Math.PI/180).rotateX(-Math.PI/2),this.coneMat);cone.position.y=.04;set.add(cone);const torch=lightShaft(0xff4466,{length:1.5,radius:.6,top:.05,opacity:.25,apex:[0,1.2,0]});if(high)holder.add(torch);return {gd,asset,holder,cone};});
  this.alarmMark=new T.Mesh(new T.RingGeometry(.35,.5,32).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(3,.2,.3),transparent:true,toneMapped:false,depthWrite:false}));this.alarmMark.visible=false;set.add(this.alarmMark);
  this.ui.tip.textContent=m.tip;this.ui.tip.hidden=false;this.tipUntil=performance.now()+7000;}
 // Your crew: you in your own colours, past selves as holograms of the same DAWG.
 syncCrew(g,d){const key=g.level+':'+g.members.length+':'+(d?assetKey(d):'');if(key===this.crewKey)return;this.crewKey=key;for(const c of this.crew){c.holder.removeFromParent();c.asset.dispose();c.shadow?.removeFromParent();}this.crew=[];if(!d)return;
  g.members.forEach((p,k)=>{const you=k===g.members.length-1,asset=createDawgAsset(d);asset.root.scale.setScalar(.78);if(!you)asset.root.traverse(o=>{if(o.isMesh){o.material=this.holo;o.castShadow=false;}});else castShadows(asset.root,this.quality);
   const holder=new T.Group();holder.add(asset.root);this.set.add(holder);const shadow=you?contactShadow(.8):null;if(shadow)this.set.add(shadow);const bag=new T.Mesh(this.gemGeo,this.gemMat);bag.scale.setScalar(.6);bag.position.y=1.25;bag.visible=false;holder.add(bag);this.crew.push({asset,holder,shadow,bag,you,lx:p.x,ly:p.y,yaw:Math.PI});});
  this.ghostPaths(g);}
 // Where each past self will walk this loop if you stay out of their way: a dotted cyan line.
 ghostPaths(g){if(this.ghostLines){this.ghostLines.removeFromParent();this.ghostLines.geometry.dispose();}this.ghostLines=null;if(!g.recs.length)return;const sim=new HeistGame(()=>.5,0);sim.level=g.level;sim.recs=g.recs.slice();sim.setup();sim.status='playing';const pts=[];
  const last=g.recs.map(()=>null);for(let f=0;f<LOOP_FRAMES&&sim.status==='playing'&&sim.frame===f;f+=1){sim.step();if(sim.frame!==f+1)break;if(f%8)continue;sim.members.slice(0,-1).forEach((p,k)=>{const q=[p.x,.05,p.y];if(last[k])pts.push(...last[k],...q);last[k]=q;});}
  if(!pts.length)return;const geo=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(pts,3));this.ghostLines=new T.LineSegments(geo,new T.LineDashedMaterial({color:CYAN,dashSize:.12,gapSize:.1,transparent:true,opacity:.55}));this.ghostLines.computeLineDistances();this.set.add(this.ghostLines);}
 prepare(d){this.dawg=d;}
 event(e,g){if(!this.ready)return;const st=this.stage,hud=this.hud,P=this.particles,rd=this.reduced;
  if(e.type==='loot'){P.burst(e.x,.6,e.y,30,0xffd25e,{speed:3,life:.6,gravity:-4});hud.pop('PRIZE','gold');}
  else if(e.type==='deliver'){P.burst(e.x,.5,e.y,40,0x5effc1,{speed:4,life:.7});hud.pop('IN THE VAN','dodge');}
  else if(e.type==='alarm'){st.shake(.6);st.flashOnce(0xff2244,.45,rd);hud.banner(e.line.toUpperCase());this.alarmAt={x:e.x,y:e.y,until:performance.now()+1800};P.burst(e.x,.4,e.y,50,0xff2d55,{speed:5,life:.8});}
  else if(e.type==='loop'){hud.banner(`LOOP ${e.crew+1} · CREW MEMBER ${e.crew+1}`);st.flashOnce(CYAN,.2,rd);this.crewKey='';}
  else if(e.type==='planfail'){hud.banner(e.lives?`THE PLAN FELL APART · ${e.lives} LEFT`:'THE PLAN FELL APART');st.shake(.8);st.flashOnce(0xff2244,.5,rd);this.crewKey='';}
  else if(e.type==='clear'){hud.banner(`${e.name.toUpperCase()} · +${e.points.toLocaleString()}`);st.flashOnce(0xffd25e,.4,rd);for(let i=0;i<4;i++)P.burst(g.members.at(-1)?.x??3,.8+i*.3,g.members.at(-1)?.y??3,50,[0xffd25e,0x5ee7ff,0xff4fd8,0x5effc1][i],{speed:7,life:1.2});}
  else if(e.type==='over'){st.shake(.5);}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<2500));return true;}
 render(g,d,now){
  this.stage.resize();const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced,m=heistMap(g.level),t=g.frame/HEIST.fps;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  if(g.level!==this.level){this.build(g.level);this.crewKey='';}if(g.frame<2&&this.lastFrame>2)this.crewKey='';this.lastFrame=g.frame;this.syncCrew(g,d||this.dawg);
  // The set reacts: doors sink into the floor, pads glow when held, lasers die with their switch.
  for(const x of this.doors){const open=g.open[x.d.id],goal=open?-WALL_H/2+.04:WALL_H/2;x.y+=(goal-x.y)*Math.min(1,dt*10);x.g.position.y=x.y;}
  for(const x of this.plates)x.mesh.material.emissiveIntensity=g.open[x.p.id]?.9:.25;for(const x of this.switches){const on=g.laserOff[x.w.id];x.mesh.material.emissiveIntensity=on?.9:.25;x.con.material.emissiveIntensity=on?.8:.2;}
  for(const x of this.lasers){x.g.visible=!g.laserOff[x.L.id];if(x.g.visible&&!reduced)x.g.children.forEach((b,i)=>{b.scale.y=1;b.material.color.setRGB(2.6+Math.sin(real*30+i)*.5,.15,.3);});}
  for(const x of this.loot){x.g.visible=!g.taken.includes(x.L.id);x.g.rotation.y=real*1.6;x.g.position.y=.55+Math.sin(real*2+x.L.id)*.06;}
  for(const x of this.guards){const a=guardAt(x.gd,t);x.holder.position.set(a.x,0,a.y);x.holder.rotation.y=Math.PI/2-a.a;x.cone.position.set(a.x,.04,a.y);x.cone.rotation.y=-a.a;setDawgPose(x.asset,real,'walk');}
  g.members.forEach((p,k)=>{const c=this.crew[k];if(!c)return;const dx=p.x-c.lx,dy=p.y-c.ly,moving=Math.hypot(dx,dy)>1e-4;if(moving)c.yaw=Math.atan2(dx,dy);c.lx=p.x;c.ly=p.y;c.holder.position.set(p.x,0,p.y);c.holder.rotation.y=c.yaw;c.bag.visible=p.carry.length>0;if(c.shadow)c.shadow.position.set(p.x,.015,p.y);setDawgPose(c.asset,real,moving?'run':'idle');
   if(!c.you&&!reduced)c.asset.root.position.y=Math.sin(real*3+k)*.03;});
  if(this.alarmAt&&now<this.alarmAt.until){this.alarmMark.visible=true;this.alarmMark.position.set(this.alarmAt.x,.05,this.alarmAt.y);this.alarmMark.scale.setScalar(1+((now/400)%1)*1.5);this.alarmMark.material.opacity=1-((now/400)%1);}else this.alarmMark.visible=false;
  // Camera: the whole heist from above, or (on narrow screens) a closer view that follows you.
  const you=g.members.at(-1)||{x:m.W/2,y:m.H/2},cam=this.camera,aspect=cam.aspect||1,pitch=1.02,vf=50,hf=2*Math.atan(Math.tan(vf*Math.PI/360)*aspect);
  const needW=(m.W+1.5)/2/Math.tan(hf/2),needH=(m.H+2)/2/Math.tan(vf*Math.PI/360)/Math.sin(pitch),full=Math.max(needW,needH),dist=Math.min(full,Math.max(needH,13)),follow=full>dist?1:0;
  const cx=follow?Math.max(m.W/2-(m.W/2-(dist*Math.tan(hf/2)-1)),Math.min(m.W/2+(m.W/2-(dist*Math.tan(hf/2)-1)),you.x)):m.W/2,cz=m.H/2;
  const at=new T.Vector3(cx,0,cz+.3),pos=new T.Vector3(cx,Math.sin(pitch)*dist,cz+.3+Math.cos(pitch)*dist);
  this.rig.update(dt,{pos,at},null,{follow:4});this.stage.applyShake(real,reduced);this.rig.aim();cam.fov=vf;cam.near=.1;cam.far=120;cam.updateProjectionMatrix();this.stage.followSun?.(this.key,cx,0,cz);
  // HUD.
  const left=Math.max(0,HEIST.loop-t);this.hud.set(this.ui.name,'n',m.name.toUpperCase());this.hud.set(this.ui.crew,'c',`CREW ${g.recs.length+1} / ${m.crew} · ${'♥'.repeat(g.lives)}${'♡'.repeat(Math.max(0,HEIST.lives-g.lives))}${g.takes?' · TAKE '+(g.takes+1):''}`);
  this.hud.set(this.ui.time,'t',left<10?left.toFixed(1):String(Math.ceil(left)));this.ui.ring.style.strokeDashoffset=String(100-left/HEIST.loop*100);this.ui.clock.classList.toggle('hx-late',left<5);
  if(this.tipUntil&&now>this.tipUntil){this.ui.tip.hidden=true;this.tipUntil=0;}
  this.particles.update(dt,{x:0,y:0,z:0});this.hud.live(g.status==='playing');this.stage.render(dt,real,{reduced,aberration:.0012});
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();for(const c of this.crew)try{c.asset.dispose();}catch{}for(const g of this.guards||[])try{g.asset.dispose();}catch{}this.stage?.dispose();}
}
