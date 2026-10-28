// Three.js presentation for Domino Dynasty: each room as a lit diorama seen from the front, with
// wooden shelves, ivory dominoes that pivot at their base, chrome balls, a glowing golden bone, the
// bin, and the pieces you place as a ghost under the cursor. DominoGame owns every rule; this only
// reads it. Engine (x, y) maps to world (x, y, 0); the room's back wall is at z = -1.6.
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,quality,radial,glowStops,texture,Stage,Particles,CameraRig,Hud,AmbientLoop,pbr,castShadows,contactShadow} from './three-kit.js';
import {DOMINO,LEVELS,PIECE_LABEL,resolve,domTip} from './domino-engine.js';
const DEPTH=.7,BACK=-1.6,G=DOMINO.grid;
// Wallpaper and trim per room, so every level reads as its own place.
const LOOK=[[0x2b1d3a,0xffb347,'#3a2750','#4a3364'],[0x1c2a2e,0x7dff5e,'#223a3a','#2b4a48'],[0x3a1626,0xff5fc8,'#4a1c33','#5e2541'],[0x1a1f3c,0x5ec8ff,'#22284e','#2c3462'],[0x2e2216,0xffd25e,'#3c2c1c','#4c3824'],[0x2a1a1a,0xff8a3d,'#3a2222','#4a2c2c'],[0x1b1b2f,0xc78bff,'#24243e','#2e2e4e'],[0x16301f,0x5effc1,'#1c3a28','#244a34'],[0x101018,0xffd25e,'#17172a','#202036']];
const wallpaper=(a,b)=>texture(256,256,(c,w,h)=>{c.fillStyle=a;c.fillRect(0,0,w,h);c.fillStyle=b;for(let y=0;y<h;y+=32)for(let x=0;x<w;x+=32){c.beginPath();c.arc(x+16+(y/32%2)*16,y+16,9,0,7);c.fill();}c.fillStyle='#00000022';for(let x=0;x<w;x+=64)c.fillRect(x,0,2,h);});
const wood=()=>texture(256,64,(c,w,h)=>{c.fillStyle='#8a5a30';c.fillRect(0,0,w,h);for(let i=0;i<40;i++){c.strokeStyle=i%2?'#7a4c26':'#9a6a3a';c.lineWidth=1+(i%3);c.beginPath();c.moveTo(0,i*1.7);c.bezierCurveTo(w*.3,i*1.7+6,w*.6,i*1.7-5,w,i*1.7+2);c.stroke();}});
const signTex=(text,color)=>texture(512,96,(c,w,h)=>{c.clearRect(0,0,w,h);c.font='900 54px "DAWG display","Arial Narrow",Impact,sans-serif';c.textAlign='center';c.textBaseline='middle';c.shadowColor=color;c.shadowBlur=18;c.fillStyle=color;const s=Math.min(1,(w-40)/c.measureText(text).width);c.save();c.translate(w/2,h/2);c.scale(s,1);c.fillText(text,0,0);c.restore();});

export class ThreeDomino {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.clock=performance.now();this.status='';this.statusSince=performance.now();this.level=-1;this.worldKey='';this.squash=[];this.dawgKey='';}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d domino3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="dm-top"><b class="dm-name"></b><span class="dm-room"></span></div><div class="dm-fuses"></div><div class="dm-tray"><div class="dm-pieces"></div><span class="dm-hint"></span></div><p class="dm-tip" hidden></p>');this.view.append(this.hud.root);
  this.ui={name:this.hud.q('.dm-name'),room:this.hud.q('.dm-room'),fuses:this.hud.q('.dm-fuses'),pieces:this.hud.q('.dm-pieces'),hint:this.hud.q('.dm-hint'),tip:this.hud.q('.dm-tip')};
  this.rig=new CameraRig(this.camera);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  const s=this.scene,high=this.quality==='high';this.stage.studioEnvironment(.45);this.stage.hdrEnvironment(undefined,.4);s.background=new T.Color(0x05060c);s.fog=new T.Fog(0x05060c,30,70);
  s.add(new T.HemisphereLight(0xd8dcff,0x3a2a20,1.15));this.key=new T.DirectionalLight(0xfff0dc,1.7);this.key.position.set(-3,12,14);s.add(this.key,this.key.target);this.stage.sunShadow(this.key,{size:11,far:40,map:2048,radius:3});
  this.lamp=new T.PointLight(0xffb070,high?12:8,18,1.6);s.add(this.lamp);this.fill=new T.PointLight(0x9fb4ff,high?6:4,20,1.4);s.add(this.fill);
  this.glowTex=radial(glowStops);this.particles=new Particles(s,high?500:220,this.glowTex);
  this.mats={ivory:pbr({color:0xd9d2c0,roughness:.45,metalness:.05,clearcoat:.4},this.quality),placed:pbr({color:0xffd25e,roughness:.3,metalness:.4,emissive:0xff9a2a,emissiveIntensity:.25,clearcoat:.8},this.quality),starter:pbr({color:0xff4f6e,roughness:.35,metalness:.1,emissive:0xff2244,emissiveIntensity:.3},this.quality),
   chrome:pbr({color:0xe8ecf4,roughness:.12,metalness:1,envMapIntensity:1.4},this.quality),gold:pbr({color:0xffd25e,roughness:.18,metalness:1,emissive:0xffa630,emissiveIntensity:.55,clearcoat:1},this.quality),shelf:pbr({map:wood(),roughness:.6,metalness:.05},this.quality),crate:pbr({color:0x3c4660,roughness:.45,metalness:.7},this.quality),
   bin:pbr({color:0x2a3048,roughness:.3,metalness:.8,emissive:0x5ec8ff,emissiveIntensity:.18},this.quality),fan:pbr({color:0x30384e,roughness:.4,metalness:.8},this.quality),spring:pbr({color:0x7dff5e,roughness:.35,metalness:.6,emissive:0x3fff2a,emissiveIntensity:.25},this.quality),
   ghostOk:new T.MeshBasicMaterial({color:0x5effc1,transparent:true,opacity:.45,depthWrite:false}),ghostNo:new T.MeshBasicMaterial({color:0xff3d6e,transparent:true,opacity:.45,depthWrite:false}),ghostUp:new T.MeshBasicMaterial({color:0x5ee7ff,transparent:true,opacity:.5,depthWrite:false})};
  this.domGeo=new T.BoxGeometry(DOMINO.domW,DOMINO.domH,DEPTH*.8).translate(0,DOMINO.domH/2,0);this.ballGeo=new T.SphereGeometry(1,24,16);
  this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D ROOM · LIVE');return this;}
 setCamera(){}
 // The room itself: wallpaper, floor, the neon sign, the level's fixed props, bin and bone.
 build(g){const s=this.scene,lv=g.lv,high=this.quality==='high',look=LOOK[g.level%LOOK.length];if(this.set){this.set.traverse(o=>{if(o.geometry&&o.geometry!==this.domGeo&&o.geometry!==this.ballGeo)o.geometry.dispose?.();});s.remove(this.set);}
  const set=this.set=new T.Group();s.add(set);this.level=g.level;this.worldKey='';this.fans=[];this.springs=[];this.lamp.position.set(lv.W/2,lv.H-1,2.5);this.fill.position.set(lv.W*.3,2.5,4);
  const wp=wallpaper(look[2],look[3]);wp.colorSpace=T.SRGBColorSpace;wp.wrapS=wp.wrapT=T.RepeatWrapping;wp.repeat.set(lv.W/2,lv.H/2);const back=new T.Mesh(new T.PlaneGeometry(lv.W+2,lv.H+2),pbr({map:wp,roughness:.85,metalness:0},this.quality));back.position.set(lv.W/2,lv.H/2,BACK);back.receiveShadow=high;set.add(back);
  const fl=new T.Mesh(new T.PlaneGeometry(lv.W+2,6).rotateX(-Math.PI/2),pbr({color:0x1a1622,roughness:.55,metalness:.25,clearcoat:.2,clearcoatRoughness:.5},this.quality));fl.position.set(lv.W/2,0,BACK+3);fl.receiveShadow=high;set.add(fl);
  for(const side of [-1,1]){const w=new T.Mesh(new T.BoxGeometry(.4,lv.H+2,4),pbr({color:look[0],roughness:.7},this.quality));w.position.set(side>0?lv.W+.2:-.2,lv.H/2,BACK+2);set.add(w);}
  const sign=new T.Mesh(new T.PlaneGeometry(6,1.1),new T.MeshBasicMaterial({map:signTex(lv.name.toUpperCase(),'#'+look[1].toString(16).padStart(6,'0')),transparent:true,toneMapped:false,color:new T.Color(1.8,1.8,1.8),depthWrite:false}));sign.position.set(lv.W/2,lv.H-.9,BACK+.05);set.add(sign);
  this.signLight=new T.PointLight(look[1],high?6:3,9,1.8);this.signLight.position.set(lv.W/2,lv.H-1,BACK+1);set.add(this.signLight);
  for(const b of lv.boxes){const m=b.kind==='shelf'?this.mats.shelf:b.kind==='crate'?this.mats.crate:b.kind==='wall'?this.mats.bin:this.mats.crate,mesh=new T.Mesh(new T.BoxGeometry(b.w,b.h,b.kind==='floor'?3.2:DEPTH*(b.kind==='shelf'?1.6:1.4)),b.kind==='floor'?pbr({color:0x2a2034,roughness:.6,metalness:.15,clearcoat:.15},this.quality):m);mesh.position.set(b.x+b.w/2,b.y+b.h/2,b.kind==='floor'?BACK+1.6:0);castShadows(mesh,this.quality);set.add(mesh);
   if(b.kind==='shelf')for(const x of [b.x+.3,b.x+b.w-.3]){const br=new T.Mesh(new T.BoxGeometry(.12,.5,.12),this.mats.crate);br.position.set(x,b.y-.25,BACK+.1);set.add(br);}}
  const bn=lv.bin,zone=new T.Mesh(new T.PlaneGeometry(bn.w,bn.h),new T.MeshBasicMaterial({color:new T.Color(.2,1.2,1.6),transparent:true,opacity:.18,toneMapped:false,depthWrite:false,side:T.DoubleSide}));zone.position.set(bn.x+bn.w/2,bn.y+bn.h/2,BACK+.08);set.add(zone);
  const label=new T.Mesh(new T.PlaneGeometry(2.2,.5),new T.MeshBasicMaterial({map:signTex('BIN','#5ee7ff'),transparent:true,toneMapped:false,depthWrite:false}));label.position.set(bn.x+bn.w/2,bn.y+bn.h+.35,BACK+.06);set.add(label);
  for(const p of lv.planks)set.add(this.plankMesh(p,false));for(const f of lv.fans)this.fanMesh(f,false,set);for(const sp of lv.springs)this.springMesh(sp,false,set);
  this.ui.tip.textContent=lv.tip;this.ui.tip.hidden=false;this.tipUntil=performance.now()+8000;}
 plankMesh(p,placed){const len=Math.hypot(p.x2-p.x1,p.y2-p.y1),m=new T.Mesh(new T.BoxGeometry(len,.12,DEPTH),placed?this.mats.placed:this.mats.shelf);m.position.set((p.x1+p.x2)/2,(p.y1+p.y2)/2,0);m.rotation.z=Math.atan2(p.y2-p.y1,p.x2-p.x1);castShadows(m,this.quality);return m;}
 fanMesh(f,placed,parent){const gp=new T.Group();gp.position.set(f.x,f.y,0);const body=new T.Mesh(new T.BoxGeometry(.5,.6,.5),placed?this.mats.placed:this.mats.fan);body.position.y=-.1;gp.add(body);const cage=new T.Mesh(new T.TorusGeometry(.42,.03,8,24).rotateY(Math.PI/2),this.mats.fan);gp.add(cage);
  const blades=new T.Group();for(let i=0;i<3;i++){const b=new T.Mesh(new T.BoxGeometry(.05,.72,.14),this.mats.chrome);b.rotation.x=i*Math.PI*2/3;blades.add(b);}gp.add(blades);const post=new T.Mesh(new T.BoxGeometry(.1,.5,.1),this.mats.fan);post.position.y=-.5;gp.add(post);castShadows(gp,this.quality);parent.add(gp);
  const wind=[];for(let i=0;i<8;i++){const sp=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(.5,1.2,1.5),transparent:true,opacity:.35,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));sp.scale.set(.35,.35,1);parent.add(sp);wind.push(sp);}(this.fans??=[]).push({f,blades,wind});return gp;}
 springMesh(sp,placed,parent){const gp=new T.Group();gp.position.set(sp.x,sp.y,0);const coil=new T.Mesh(new T.CylinderGeometry(.22,.26,.22,12,1,true),placed?this.mats.placed:this.mats.spring);coil.position.y=.11;gp.add(coil);const pad=new T.Mesh(new T.BoxGeometry(.8,.08,DEPTH),this.mats.crate);pad.position.y=.26;gp.add(pad);castShadows(gp,this.quality);parent.add(gp);(this.springs??=[]).push({sp,gp,sq:0});return gp;}
 boneMesh(){const gp=new T.Group(),shaft=new T.Mesh(new T.CylinderGeometry(.075,.075,.42,10).rotateZ(Math.PI/2),this.mats.gold);gp.add(shaft);for(const [x,y] of [[-.21,.07],[-.21,-.07],[.21,.07],[.21,-.07]]){const k=new T.Mesh(new T.SphereGeometry(.1,12,10),this.mats.gold);k.position.set(x,y,0);gp.add(k);}
  const glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(2,1.4,.4),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));glow.scale.set(1.6,1.6,1);gp.add(glow);castShadows(gp,this.quality);return gp;}
 // Dominoes, balls and the placed pieces: rebuilt when the set of placements changes.
 syncWorld(g){const w=g.world();if(w.key===this.worldKey)return;this.worldKey=w.key;if(this.dyn){this.dyn.removeFromParent();}const dyn=this.dyn=new T.Group();this.set.add(dyn);for(const x of this.fans||[])if(x.placed)for(const s of x.wind)s.removeFromParent();this.fans=(this.fans||[]).filter(x=>!x.placed);this.springs=(this.springs||[]).filter(x=>!x.placed);
  this.doms=w.doms.map(d=>{const m=new T.Mesh(this.domGeo,d.start?this.mats.starter:d.placed?this.mats.placed:this.mats.ivory);m.position.set(d.x,d.y,0);castShadows(m,this.quality);dyn.add(m);const sh=contactShadow(.9,.7);sh.position.set(d.x,d.y+.016,0);dyn.add(sh);return {d,m,sh};});
  this.balls=w.balls.map(b=>{const m=b.bone?this.boneMesh():new T.Mesh(this.ballGeo,b.placed?this.mats.placed:this.mats.chrome);if(!b.bone)m.scale.setScalar(b.r);castShadows(m,this.quality);m.position.set(b.x,b.y,0);dyn.add(m);const sh=contactShadow(b.r*2.4,b.r*1.6);dyn.add(sh);return {b,m,sh,roll:0};});
  for(const p of w.planks)if(p.placed)dyn.add(this.plankMesh(p,true));for(const f of w.fans)if(f.placed){this.fanMesh(f,true,dyn);this.fans.at(-1).placed=true;}for(const sp of w.springs)if(sp.placed){this.springMesh(sp,true,dyn);this.springs.at(-1).placed=true;}
  this.ghost?.removeFromParent();this.ghost=null;this.ghostKey='';}
 // The ghost of the next piece under the cursor, green when it fits, red when it doesn't.
 syncGhost(g){const show=g.phase==='place'&&g.status!=='over',pv=show?g.preview():{kind:'none'},key=show?g.cursor.gx+':'+g.cursor.gy+':'+pv.kind+':'+(pv.name||pv.index):'';if(key===this.ghostKey)return;this.ghostKey=key;this.ghost?.removeFromParent();this.ghost=null;if(!show)return;
  const gp=this.ghost=new T.Group();this.set.add(gp);const mat=pv.kind==='place'?this.mats.ghostOk:pv.kind==='pickup'?this.mats.ghostUp:this.mats.ghostNo;
  const ring=new T.Mesh(new T.RingGeometry(.2,.3,24),mat);ring.position.set(g.cursor.gx*G,g.cursor.gy*G,.5);gp.add(ring);
  const piece=pv.piece||(pv.kind==='blocked'?{type:pv.name==='rampR'||pv.name==='rampL'?'plank':pv.name==='fanR'||pv.name==='fanL'?'fan':pv.name,x:g.cursor.gx*G,y:g.cursor.gy*G,x1:g.cursor.gx*G-1,x2:g.cursor.gx*G+1,y1:g.cursor.gy*G+.5,y2:g.cursor.gy*G-.5}:null);if(!piece)return;
  let m;if(piece.type==='domino')m=new T.Mesh(this.domGeo,mat);else if(piece.type==='ball'){m=new T.Mesh(this.ballGeo,mat);m.scale.setScalar(DOMINO.ballR);}else if(piece.type==='plank'){m=new T.Mesh(new T.BoxGeometry(Math.hypot(piece.x2-piece.x1,piece.y2-piece.y1),.12,DEPTH),mat);m.rotation.z=Math.atan2(piece.y2-piece.y1,piece.x2-piece.x1);m.position.set((piece.x1+piece.x2)/2,(piece.y1+piece.y2)/2,0);gp.add(m);return;}
  else if(piece.type==='spring'){m=new T.Mesh(new T.BoxGeometry(.8,.3,DEPTH),mat);m.position.y=.15;}else{m=new T.Mesh(new T.BoxGeometry(.6,.7,.5),mat);const z=new T.Mesh(new T.PlaneGeometry(3,1.6),mat);z.material=mat.clone();z.material.opacity=.12;z.position.set(0,0,0);m.add(z);}
  if(piece.type!=='plank'){m.position.x+=piece.x;m.position.y+=piece.y;gp.add(m);}}
 syncDawg(g,d){const key=d?assetKey(d):'';if(key===this.dawgKey)return;this.dawgKey=key;if(this.dawg){this.dawg.holder.removeFromParent();this.dawg.asset.dispose();}this.dawg=null;if(!d)return;const asset=createDawgAsset(d);asset.root.scale.setScalar(.8);castShadows(asset.root,this.quality);const holder=new T.Group();holder.add(asset.root);holder.position.set(-.1,.5,1.2);holder.rotation.y=.5;this.scene.add(holder);this.dawg={asset,holder};}
 prepare(d){this.dawg0=d;}
 event(e,g){if(!this.ready)return;const st=this.stage,hud=this.hud,P=this.particles,rd=this.reduced;
  if(e.type==='level'){if(this.level!==e.level)this.build(g);}
  else if(e.type==='go'){hud.banner('GO!');st.flashOnce(0xffd25e,.25,rd);this.tipUntil=0;this.ui.tip.hidden=true;}
  else if(e.type==='place'){P.burst(e.x,e.y+.3,.2,16,0x5effc1,{speed:2,life:.5,gravity:-3});hud.pop(PIECE_LABEL[g.lv.palette[e.i]==='rampR'||g.lv.palette[e.i]==='rampL'?'plank':g.lv.palette[e.i]==='fanR'||g.lv.palette[e.i]==='fanL'?'fan':g.lv.palette[e.i]]||'PLACED','dodge');}
  else if(e.type==='pickup'){P.burst(e.x,e.y+.3,.2,10,0x5ee7ff,{speed:2,life:.4});}
  else if(e.type==='nope'){st.shake(.15);hud.pop(e.why.toUpperCase(),'shield');}
  else if(e.type==='knock'){P.burst(e.x,e.y,.1,6,0xfff2d0,{speed:1.2,life:.35,gravity:-2});}
  else if(e.type==='flat'){P.burst(e.x+e.dir*.8,e.y+.05,.2,8,0xc8b8a0,{speed:1.5,life:.4,gravity:-4});}
  else if(e.type==='hit'||e.type==='thud'){const k=Math.min(1,e.v/8);P.burst(e.x,e.y,.2,Math.round(8+k*20),e.type==='thud'?0xffb070:0xffffff,{speed:2+k*4,life:.5,gravity:-5});if(k>.35)st.shake(k*.5);}
  else if(e.type==='spring'){P.burst(e.x,e.y+.3,.2,22,0x7dff5e,{speed:3,life:.5});const s=this.springs?.find(x=>Math.abs(x.sp.x-e.x)<.01&&Math.abs(x.sp.y-e.y)<.01);if(s)s.sq=1;}
  else if(e.type==='bone'){P.burst(e.x,e.y,.2,30,0xffd25e,{speed:3,life:.7,gravity:-3});hud.pop('THE BONE!','gold');}
  else if(e.type==='win'){hud.banner(`${e.name.toUpperCase()} · +${e.points.toLocaleString()}`);st.flashOnce(0xffd25e,.45,rd);const bn=g.lv.bin;for(let i=0;i<4;i++)P.burst(bn.x+bn.w/2,bn.y+.6+i*.2,.3,45,[0xffd25e,0x5ee7ff,0xff4fd8,0x5effc1][i],{speed:6,life:1.2});this.cheerUntil=performance.now()+2200;}
  else if(e.type==='fail'){hud.banner(e.fuses?`${e.why.toUpperCase()}`:'OUT OF FUSES');st.shake(.5);st.flashOnce(0xff2244,.4,rd);}
  else if(e.type==='dynasty'){hud.banner('A DYNASTY');st.flashOnce(0xffd25e,.6,rd);}
  else if(e.type==='over'){st.shake(.4);}}
 // Where a screen point lands on the play plane, as a cursor cell.
 pick(clientX,clientY){const r=this.stage.canvas.getBoundingClientRect(),nx=((clientX-r.left)/r.width)*2-1,ny=-((clientY-r.top)/r.height)*2+1,ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(nx,ny),this.camera);const hit=new T.Vector3();if(!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),0),hit))return null;return {gx:Math.round(hit.x/G),gy:Math.round(hit.y/G)};}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing'||g.phase==='place')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:g.phase==='place'&&g.status==='playing'?t-this.ambient.lastDraw<60000:t-this.statusSince<2500));return true;}
 render(g,d,now){
  this.stage.resize();const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced,lv=g.lv;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  if(g.level!==this.level)this.build(g);this.syncWorld(g);this.syncGhost(g);this.syncDawg(g,d||this.dawg0);
  const sim=g.sim,w=g.world();
  // Dominoes pivot at their base; balls roll; the bone spins and glows; springs squash; fans turn.
  this.doms.forEach((x,k)=>{const st=sim?sim.doms[k]:null,a=st?st.a:0;x.m.rotation.z=-a;const tip=domTip(x.d,a);x.sh.scale.set(.5+Math.abs(Math.sin(a))*DOMINO.domH,1,.7);x.sh.position.x=(x.d.x+tip.x)/2;});
  this.balls.forEach((x,k)=>{const st=sim?sim.balls[k]:x.b;const dx=st.x-x.m.position.x;x.m.position.set(st.x,st.y,0);x.sh.position.set(st.x,.016+this.floorUnder(lv,st.x,st.y),0);const drop=Math.max(0,st.y-x.b.r-this.floorUnder(lv,st.x,st.y));x.sh.material.opacity=Math.max(0,.7-drop*.25);
   if(x.b.bone){x.m.rotation.z=(x.m.rotation.z||0)-dx/.35;x.m.rotation.y=reduced?0:Math.sin(real*1.3)*.5;x.m.children[5].material.opacity=.6+Math.sin(real*4)*.25;}else x.m.rotation.z-=dx/x.b.r;});
  for(const s of this.springs||[]){s.sq=Math.max(0,s.sq-dt*5);s.gp.scale.y=1-s.sq*.55;}
  for(const x of this.fans||[]){const on=!!sim;x.blades.rotation.x+=dt*(on?22:1.5)*x.f.dir;x.wind.forEach((sp,i)=>{const t=((real*1.4+i/8)%1);sp.visible=on&&!reduced;sp.position.set(x.f.x+x.f.dir*(.3+t*(x.f.w/2-.3)),x.f.y+Math.sin(i*2.1+real*3)*.5,.1+(i%3)*.15);sp.material.opacity=.35*(1-t);});}
  if(this.dawg){const cheer=this.cheerUntil&&now<this.cheerUntil;setDawgPose(this.dawg.asset,real,cheer?'arm':'idle');this.dawg.holder.rotation.y=.5+(sim?Math.sin(real*2)*.1:0);}
  // Camera: the whole room, from a touch above and to the right so the shelves show their depth.
  const cam=this.camera,aspect=cam.aspect||1,vf=46,hf=2*Math.atan(Math.tan(vf*Math.PI/360)*aspect),dist=Math.max((lv.W/2+.8)/Math.tan(hf/2),(lv.H/2+1)/Math.tan(vf*Math.PI/360))*1.02*(this.zoom||1);
  const at=new T.Vector3(lv.W/2+(this.aimX||0),lv.H/2+.2+(this.aimY||0),0),pos=new T.Vector3(lv.W/2+1.4+(this.aimX||0),lv.H/2+1.6+(this.aimY||0),dist);this.rig.update(dt,{pos,at},null,{follow:4});this.stage.applyShake(real,reduced);this.rig.aim();cam.fov=vf;cam.near=.1;cam.far=120;cam.updateProjectionMatrix();this.stage.followSun?.(this.key,lv.W/2,0,0);
  // HUD.
  this.hud.set(this.ui.name,'n',lv.name.toUpperCase());this.hud.set(this.ui.room,'r',`ROOM ${g.level+1} / ${LEVELS.length}`);this.hud.set(this.ui.fuses,'f','⚡'.repeat(Math.max(0,g.fuses))+'·'.repeat(Math.max(0,DOMINO.fuses-g.fuses)));
  const used=new Set(g.placed.map(p=>p.i)),next=g.nextIndex(),tray=lv.palette.map((n,i)=>`<i class="${used.has(i)?'dm-used':i===next?'dm-next':''}">${PIECE_LABEL[n==='rampR'||n==='rampL'?'plank':n==='fanR'||n==='fanL'?'fan':n]}${n==='rampL'||n==='fanL'?' ←':n==='rampR'||n==='fanR'?' →':''}</i>`).join('');this.hud.set(this.ui.pieces,'p',tray);if(this.ui.pieces.innerHTML!==tray)this.ui.pieces.innerHTML=tray;
  const hint=g.status==='over'?'':g.phase==='run'?`CHAIN ${sim.t.toFixed(1)} S`:g.phase==='won'?`CODE ${g.lastCode()}`:g.phase==='failed'?'TRY AGAIN':next<0&&!g.placed.length?'HOLD GO':'TAP OR ENTER TO DROP · HOLD FOR GO';this.hud.set(this.ui.hint,'h',hint);
  if(this.tipUntil&&now>this.tipUntil){this.ui.tip.hidden=true;this.tipUntil=0;}
  this.particles.update(dt,{x:0,y:0,z:0},-1);this.hud.live(g.status==='playing');this.stage.render(dt,real,{reduced,aberration:.0012});
 }
 floorUnder(lv,x,y){let best=0;for(const b of lv.boxes){const top=b.y+b.h;if(x>=b.x-.1&&x<=b.x+b.w+.1&&top<=y+.01&&top>best)best=top;}return best;}
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();try{this.dawg?.asset.dispose();}catch{}this.stage?.dispose();}
}
