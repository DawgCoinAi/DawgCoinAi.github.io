// Three.js presentation for Paint the Town: a neon city block grid seen from a high camera that
// follows you. The street is a glossy wet plane; every painted cell is a tile that pops in with a
// splash, open trails are bright wet strips, building blocks wear neon trim, and each crew's DAWG
// pushes a paint roller in its colour. PaintGame owns every rule; this only reads it.
// Engine cell (x, y) is centred at world (x + .5, 0, y + .5).
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,quality,fitFov,radial,glowStops,texture,buildingShells,facadeMaterials,Stage,Particles,CameraRig,Hud,AmbientLoop,pbr,castShadows,contactShadow,wetGround} from './three-kit.js';
import {PAINT,DIRS} from './paint-engine.js';
import {npcDawg} from './npc-dawg.js';
const POP=.32,PLACE=['','1ST','2ND','3RD','4TH','5TH','6TH'];

export class ThreePaint {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.clock=performance.now();this.status='';this.statusSince=performance.now();this.seed=null;this.crew=[];this.crewKey='';this.lastMap=0;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d paint3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="pt-top"><b class="pt-time">3:00</b><span class="pt-you"></span></div><div class="pt-share" aria-hidden="true"></div><canvas class="pt-map" width="84" height="108" aria-hidden="true"></canvas><p class="pt-tip" hidden></p>');this.view.append(this.hud.root);
  this.ui={time:this.hud.q('.pt-time'),you:this.hud.q('.pt-you'),share:this.hud.q('.pt-share'),map:this.hud.q('.pt-map'),tip:this.hud.q('.pt-tip')};this.mapCtx=this.ui.map.getContext('2d');
  this.rig=new CameraRig(this.camera);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  const s=this.scene,high=this.quality==='high';this.stage.neonEnvironment(.7);this.stage.hdrEnvironment(undefined,.5);s.background=new T.Color(0x05060c);s.fog=new T.Fog(0x05060c,22,48);
  s.add(new T.HemisphereLight(0x9fb0ff,0x1a1030,1.1));this.key=new T.DirectionalLight(0xfff0e0,2.2);this.key.position.set(-5,14,7);s.add(this.key,this.key.target);this.stage.sunShadow(this.key,{size:11,far:40,map:2048,radius:3});
  this.glowTex=radial(glowStops);this.particles=new Particles(s,high?480:200,this.glowTex);
  this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D CITY · LIVE');return this;}
 setCamera(){}
 // The city for this match's seed: street, curb, buildings, the paint and trail tile pools.
 build(g){const s=this.scene,{W,H,walls,blocks}=g.city,high=this.quality==='high';if(this.set){this.set.traverse(o=>{if(o.geometry&&!o.userData.shared)o.geometry.dispose?.();});s.remove(this.set);}
  const set=this.set=new T.Group();s.add(set);this.seed=g.worldSeed;
  // Street: wet asphalt with the cell grid painted on.
  const street=texture(256,256,(c,w,h)=>{c.fillStyle='#232738';c.fillRect(0,0,w,h);c.fillStyle='#ffffff10';for(let i=0;i<120;i++)c.fillRect((i*53)%w,(i*97)%h,2,2);c.strokeStyle='#ffffff26';c.lineWidth=4;c.strokeRect(0,0,w,h);});street.wrapS=street.wrapT=T.RepeatWrapping;street.repeat.set(W,H);
  const floor=new T.Mesh(new T.PlaneGeometry(W,H).rotateX(-Math.PI/2),wetGround({color:0xd8dcee,map:street,roughness:.42,metalness:.25,envMapIntensity:.9,repeat:[W/6,H/6],q:this.quality}));floor.position.set(W/2,0,H/2);floor.receiveShadow=high;set.add(floor);
  const outer=new T.Mesh(new T.PlaneGeometry(W+80,H+80).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x0b0d18,roughness:.9}));outer.position.set(W/2,-.02,H/2);set.add(outer);
  // A neon curb round the whole grid, and a skyline band beyond it.
  const curbMat=new T.MeshBasicMaterial({color:new T.Color(1.6,.5,2.2),toneMapped:false});for(const [x,z,w,d] of [[W/2,-.1,W+.4,.12],[W/2,H+.1,W+.4,.12],[-.1,H/2,.12,H+.4],[W+.1,H/2,.12,H+.4]]){const m=new T.Mesh(new T.BoxGeometry(w,.08,d),curbMat);m.position.set(x,.04,z);set.add(m);}
  // The rest of town: lit towers ringed round the grid, so the edges of the map aren't a void.
  const shells=buildingShells(14),mats=this.facades??=facadeMaterials();for(let i=0;i<28;i++){const sh=shells[i%shells.length],t=i/28*Math.PI*2,r=.42+((i*7)%5)*.07,x=W/2+Math.cos(t)*(W/2+6+r*12),z=H/2+Math.sin(t)*(H/2+6+r*12),m=new T.Mesh(sh.g,mats[i%mats.length]);m.scale.setScalar(.34);m.position.set(x,0,z);m.rotation.y=(i*1.7)%Math.PI;m.userData.shared=true;set.add(m);}
  // Buildings: dark glass blocks with lit windows and neon trim along the roof line.
  const win=texture(128,128,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);for(let y=0;y<4;y++)for(let x=0;x<4;x++){const r=((x*7+y*13)%11)/11;if(r>.5){c.fillStyle=r>.9?'#8eeaff':'#ffcf96';c.globalAlpha=.6+r*.4;c.fillRect(x*32+9,y*32+6,14,20);}}c.globalAlpha=1;});win.wrapS=win.wrapT=T.RepeatWrapping;
  const trims=[0xff4fd8,0x5ee7ff,0xb9ff5e,0xffd25e,0x9f6bff];blocks.forEach((b,i)=>{const h=2.2+((i*7)%4)*.9,tex=win.clone();tex.repeat.set(b.w,h);tex.needsUpdate=true;
   const side=pbr({color:0x1a1f33,roughness:.35,metalness:.6,emissiveMap:tex,emissive:0xffffff,emissiveIntensity:.5,envMapIntensity:.6},this.quality),roof=pbr({color:0x14172a,roughness:.5,metalness:.5,envMapIntensity:.5},this.quality),m=new T.Mesh(new T.BoxGeometry(b.w,h,b.h),[side,side,roof,roof,side,side]);m.position.set(b.x+b.w/2,h/2,b.y+b.h/2);castShadows(m,this.quality);set.add(m);
   const trim=new T.MeshBasicMaterial({color:new T.Color(trims[i%trims.length]).multiplyScalar(1.8),toneMapped:false});for(const [dx,dz,w,d] of [[0,-b.h/2,b.w,.08],[0,b.h/2,b.w,.08],[-b.w/2,0,.08,b.h],[b.w/2,0,.08,b.h]]){const t=new T.Mesh(new T.BoxGeometry(w,.08,d),trim);t.position.set(b.x+b.w/2+dx,h+.04,b.y+b.h/2+dz);set.add(t);}});
  // Paint tiles: one instance per cell, scaled to zero until painted. Trails: thinner, brighter strips.
  const N=W*H;this.tiles=new T.InstancedMesh(new T.BoxGeometry(.94,.06,.94),pbr({color:0xffffff,roughness:.22,metalness:.05,clearcoat:.9,clearcoatRoughness:.15,envMapIntensity:1},this.quality),N);this.tiles.receiveShadow=high;set.add(this.tiles);
  this.strips=new T.InstancedMesh(new T.BoxGeometry(.62,.1,.62),new T.MeshBasicMaterial({color:new T.Color(1.9,1.9,1.9),toneMapped:false}),N);set.add(this.strips);
  this.tileOwner=new Int8Array(N).fill(-2);this.tileAt=new Float32Array(N);this.stripOwner=new Int8Array(N).fill(-2);this.colors=g.players.map(p=>new T.Color(p.color));this.M=new T.Matrix4();
  const zero=new T.Matrix4().makeScale(0,0,0);for(let i=0;i<N;i++){this.tiles.setMatrixAt(i,zero);this.strips.setMatrixAt(i,zero);this.tiles.setColorAt(i,this.colors[0]);this.strips.setColorAt(i,this.colors[0]);}
  this.animating=new Set();this.homeMarks=g.city.homes.map((h,k)=>{const r=new T.Mesh(new T.RingGeometry(.5,.62,24).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:this.colors[k].clone().multiplyScalar(1.6),toneMapped:false,transparent:true,opacity:.8}));r.position.set(h.x+.5,.075,h.y+.5);set.add(r);return r;});
  this.ui.tip.textContent='Loop out and back to paint. Cross an open trail to cut it. Watch your own.';this.ui.tip.hidden=false;this.tipUntil=performance.now()+6000;this.crewKey='';}
 // One DAWG per crew: yours from the Kennel, rivals as stable NPCs, each pushing a roller.
 syncCrew(g,d){const key=g.worldSeed+':'+(d?assetKey(d):'');if(key===this.crewKey)return;this.crewKey=key;for(const c of this.crew){c.holder.removeFromParent();c.asset.dispose();}this.crew=[];
  g.players.forEach((p,k)=>{const asset=createDawgAsset(k?npcDawg(p.name+' painter'):d||npcDawg('Paint crew'));asset.root.scale.setScalar(.58);castShadows(asset.root,this.quality);const holder=new T.Group();holder.add(asset.root);
   const col=this.colors[k],roller=new T.Group(),drum=new T.Mesh(new T.CylinderGeometry(.13,.13,.46,14).rotateZ(Math.PI/2),pbr({color:col,roughness:.35,metalness:.2,emissive:col,emissiveIntensity:.5},this.quality)),arm=new T.Mesh(new T.BoxGeometry(.04,.04,.5),new T.MeshStandardMaterial({color:0xcfd4e8,metalness:.8,roughness:.3}));drum.position.set(0,.13,-.42);arm.position.set(0,.3,-.18);arm.rotation.x=.6;roller.add(drum,arm);holder.add(roller);
   const ring=new T.Mesh(new T.RingGeometry(.3,.4,20).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:col.clone().multiplyScalar(1.7),toneMapped:false,transparent:true,opacity:.9}));ring.position.y=.07;holder.add(ring);
   if(!k){const glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(1.6,1.2,.5),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,opacity:.55}));glow.scale.set(1.6,1.6,1);glow.position.y=.2;holder.add(glow);holder.add(contactShadow(.9));}
   this.set.add(holder);this.crew.push({asset,holder,drum,ring,k,x:p.x+.5,z:p.y+.5,yaw:0,shown:true,scale:1});});}
 prepare(d){this.dawg=d;}
 event(e,g){if(!this.ready)return;const st=this.stage,hud=this.hud,P=this.particles,rd=this.reduced,name=k=>g.players[k].name.toUpperCase();
  if(e.type==='claim'){const col=g.players[e.k].color,n=e.gained.length,W=g.city.W;const step=Math.max(1,Math.floor(n/(rd?4:12)));for(let j=0;j<n;j+=step){const i=e.gained[j],x=i%W;P.burst(x+.5,.15,(i-x)/W+.5,e.you?5:3,col,{speed:2.2,life:.5,gravity:-5,up:2.5});}
   if(e.you){if(n>=8)hud.pop('+'+n+' BLOCKS','gold');if(e.captured)hud.banner('CAPTURED · +'+PAINT.capturePts*e.captured);}}
  else if(e.type==='cut'){P.burst(e.x+.5,.4,e.y+.5,40,g.players[e.victim].color,{speed:4.5,life:.7});if(e.you){hud.pop('CUT · +'+PAINT.cutPts,'dodge');st.flashOnce(0xffd25e,.18,rd);}else if(e.onYou){st.shake(.7);st.flashOnce(0xff2244,.45,rd);hud.banner('CUT BY '+name(e.k));}}
  else if(e.type==='pop'){P.burst(e.x+.5,.4,e.y+.5,30,g.players[e.k].color,{speed:3.5,life:.6});if(e.onYou){st.shake(.6);st.flashOnce(0xff2244,.4,rd);hud.banner('YOU CROSSED A TRAIL');}}
  else if(e.type==='capture'){if(e.onYou)hud.banner('CAPTURED BY '+name(e.k));}
  else if(e.type==='wipe'){if(g.players[e.k].k===0)hud.banner('PAINTED OUT OF TOWN');}
  else if(e.type==='respawn'){const c=this.crew[e.k];if(c){c.x=e.x+.5;c.z=e.y+.5;c.scale=0;}P.burst(e.x+.5,.3,e.y+.5,20,g.players[e.k].color,{speed:2,life:.5});if(!e.k)st.flashOnce(0xffd25e,.15,rd);}
  else if(e.type==='clock')hud.pop(String(Math.ceil(e.left)),'big');
  else if(e.type==='over'){st.shake(.3);const place=g.rank().indexOf(g.you)+1;hud.banner(place===1?'THE TOWN IS YOURS':PLACE[place]+' OF '+g.players.length);}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<2500));return true;}
 // Paint and trail tiles follow the engine's grids; a freshly painted tile pops up from nothing.
 syncTiles(g,now,dt){const {W,H}=g.city,N=W*H,M=this.M,t=now/1000;let tm=false,sm=false;
  for(let i=0;i<N;i++){const o=g.owner[i];if(o!==this.tileOwner[i]){this.tileOwner[i]=o;if(o>=0){this.tiles.setColorAt(i,this.colors[o]);this.tileAt[i]=t;this.animating.add(i);}else{M.makeScale(0,0,0);this.tiles.setMatrixAt(i,M);}tm=true;}
   const s=g.trail[i];if(s!==this.stripOwner[i]){this.stripOwner[i]=s;const x=i%W,z=(i-x)/W;if(s>=0){this.strips.setColorAt(i,this.colors[s]);M.makeTranslation(x+.5,.1,z+.5);}else M.makeScale(0,0,0);this.strips.setMatrixAt(i,M);sm=true;}}
  for(const i of this.animating){const x=i%W,z=(i-x)/W,k=this.reduced?1:Math.min(1,(t-this.tileAt[i])/POP),e=1+Math.sin(k*Math.PI)*.25,sc=Math.max(.001,k*e);M.makeTranslation(x+.5,.03,z+.5);M.scale(new T.Vector3(sc,1,sc));this.tiles.setMatrixAt(i,M);if(k>=1)this.animating.delete(i);tm=true;}
  if(tm){this.tiles.instanceMatrix.needsUpdate=true;this.tiles.instanceColor.needsUpdate=true;}if(sm){this.strips.instanceMatrix.needsUpdate=true;this.strips.instanceColor.needsUpdate=true;}}
 render(g,d,now){
  this.stage.resize();const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced,{W,H}=g.city;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  if(g.worldSeed!==this.seed)this.build(g);this.syncCrew(g,d||this.dawg);this.syncTiles(g,now,dt);
  const live=g.status==='playing';
  g.players.forEach((p,k)=>{const c=this.crew[k];if(!c)return;const tx=p.x+.5,tz=p.y+.5,f=Math.min(1,dt*(live?16:8));c.x+=(tx-c.x)*f;c.z+=(tz-c.z)*f;const [dx,dz]=DIRS[p.dir];c.yaw=Math.atan2(dx,dz);
   c.holder.visible=p.alive;c.scale+=(1-c.scale)*Math.min(1,dt*7);c.holder.scale.setScalar(Math.max(.01,c.scale));c.holder.position.set(c.x,0,c.z);c.holder.rotation.y=c.yaw;c.drum.rotation.x+=dt*(live?9:2);
   setDawgPose(c.asset,real+k,live&&p.alive?'run':'idle');if(!reduced)c.ring.material.opacity=.6+Math.sin(real*5+k)*.3;});
  for(const m of this.homeMarks)m.rotation.y=real*.6;
  // Camera: high and angled, tracking you; wider on phones so the next block stays in view.
  const me=this.crew[0]||{x:W/2,z:H/2},cam=this.camera,aspect=cam.aspect||1,fov=fitFov(50,aspect,66),back=aspect<1?8.5:7,up=aspect<1?12.5:10.5,you={x:Math.max(3,Math.min(W-3,me.x)),z:Math.max(5,Math.min(H-2,me.z))};
  const pos=new T.Vector3(you.x,up,you.z+back),at=new T.Vector3(you.x,0,you.z-1.2);this.rig.update(dt,{pos,at},null,{follow:live?6:3});this.stage.applyShake(real,reduced);this.rig.aim();cam.fov=fov;cam.near=.1;cam.far=140;cam.updateProjectionMatrix();this.stage.followSun?.(this.key,you.x,0,you.z);
  // HUD: the clock, your share and rank, the share bar, and the minimap.
  const left=g.left,shares=g.shares(),place=g.rank().indexOf(g.you)+1;this.hud.set(this.ui.time,'t',Math.floor(left/60)+':'+String(Math.ceil(left%60)%60).padStart(2,'0'));this.ui.time.classList.toggle('pt-late',left<=10&&left>0);
  this.hud.set(this.ui.you,'y',`YOU ${Math.round(shares[0]*100)}% · ${PLACE[place]} OF ${g.players.length}${g.you.alive?'':' · RESPAWNING'}`);
  const bar=g.players.map(p=>Math.round(shares[p.k]*1000)).join(',');if(this.hud.cache.bar!==bar){this.hud.cache.bar=bar;this.ui.share.innerHTML=g.players.map(p=>`<i style="flex:${Math.max(0,shares[p.k])} 0 0;background:${p.color}"></i>`).join('')+`<i style="flex:${Math.max(0,1-shares.reduce((a,b)=>a+b,0))} 0 0"></i>`;}
  if(now-this.lastMap>120){this.lastMap=now;this.drawMap(g);}
  if(this.tipUntil&&now>this.tipUntil){this.ui.tip.hidden=true;this.tipUntil=0;}
  this.particles.update(dt,{x:0,y:0,z:0});this.hud.live(g.status==='playing');this.stage.render(dt,real,{reduced,aberration:.0012});
 }
 drawMap(g){const c=this.mapCtx,{W,H,walls}=g.city,S=3;c.fillStyle='#07080fcc';c.fillRect(0,0,W*S,H*S);
  for(let i=0;i<W*H;i++){const x=i%W,y=(i-x)/W;if(walls[i]){c.fillStyle='#3a4058';c.fillRect(x*S,y*S,S,S);continue;}const o=g.owner[i],t=g.trail[i];if(t>=0){c.fillStyle=g.players[t].color;c.fillRect(x*S,y*S,S,S);}else if(o>=0){c.fillStyle=g.players[o].color+'99';c.fillRect(x*S,y*S,S,S);}}
  for(const p of g.players){if(!p.alive)continue;c.fillStyle=p.k?'#fff':'#ffd25e';c.fillRect(p.x*S-1,p.y*S-1,S+2,S+2);c.fillStyle=p.color;c.fillRect(p.x*S,p.y*S,S,S);}}
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();for(const c of this.crew)try{c.asset.dispose();}catch{}this.stage?.dispose();}
}
