// 3D sets for After Hours: each location is a small stage built from CC0 Kenney furniture and
// market models, lit like a late-night set, with a neon sign, every character as a 3D DAWG and
// your own DAWG in the foreground. Hotspot anchors are projected to screen so the play screen can
// place its buttons over the right things. Sets only read the story; the engine owns the rules.
import {T,quality,fitFov,texture,radial,glowStops,skyMaterial,Stage,Particles,loadModel,cloneModel,fitModel} from './three-kit.js';
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {loadBuildings,building} from './city-art.js';
import {seededRandom} from './mobile-core.js';

const signTexture=(text,color)=>texture(512,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#0b0a16e6';c.beginPath();c.roundRect(4,4,w-8,h-8,22);c.fill();c.lineWidth=6;c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=18;c.stroke();
 c.font='900 64px "DAWG display","Arial Narrow",Impact,sans-serif';c.textAlign='center';c.textBaseline='middle';const s=Math.min(1,(w-60)/Math.max(1,c.measureText(text).width));c.save();c.translate(w/2,h/2+4);c.scale(s,1);c.fillStyle=color;c.shadowBlur=24;c.fillText(text,0,0);c.restore();});
export {dnaFor,npcDawg} from './npc-dawg.js';
import {npcDawg} from './npc-dawg.js';
// Story ground coordinates (x across, z depth) to world space, shared with the 2D fallback.
export const SET={width:14,depth:9,back:-4.2};
// Framed art for the walls: a few lines of neon-ish text on a dark card, picked per location.
const ART=[['DOGS PLAYING','POKER','#ffd36b'],['LIVE','TONIGHT','#ff5fc8'],['NO','CATS','#5ee7ff'],['GOOD','BOY','#b9ff5e'],['FETCH','CLUB','#ff8a3d'],['HOWL','AT THE MOON','#c78bff'],['TAIL','WAGGERS','#ffe45e'],['BARK','LESS','#5ee7ff']];
const artTexture=([a,b,col])=>texture(256,320,(c,w,h)=>{c.fillStyle='#120d1c';c.fillRect(0,0,w,h);c.strokeStyle='#c9a76a';c.lineWidth=14;c.strokeRect(7,7,w-14,h-14);c.fillStyle=col;c.shadowColor=col;c.shadowBlur=16;c.textAlign='center';c.font='900 46px Impact, "Arial Narrow", sans-serif';c.fillText(a,w/2,h*.42,w-40);c.font='900 34px Impact, "Arial Narrow", sans-serif';c.fillText(b,w/2,h*.62,w-40);});
export function fallbackAnchor([x,z]){return {x:50+x/7*44,y:58+(z+1)/4.5*30};}

export class ThreeAfterHours {
 constructor(host,{onFailure,quality:q=quality()}={}){this.host=host;this.onFailure=onFailure;this.quality=q;this.ready=false;this.dead=false;this.key='';this.clock=performance.now();this.items=[];this.npcs=new Map();this.cast=[];this.anchors={};}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'ah3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;this.host.prepend(this.view);
  const s=this.scene;this.stage.neonEnvironment(.55);this.stage.hdrEnvironment(undefined,.35);s.fog=new T.FogExp2(0x07060f,.022);
  this.sky=new T.Mesh(new T.SphereGeometry(200,24,12),skyMaterial());s.add(this.sky);
  this.hemi=new T.HemisphereLight(0xb6b0ff,0x1a1020,.9);s.add(this.hemi);this.keyLight=new T.DirectionalLight(0xffffff,1.1);this.keyLight.position.set(-4,10,8);s.add(this.keyLight);
  this.neonLight=new T.PointLight(0xff5fc8,18,16,1.6);this.neonLight.position.set(0,4.2,-3);s.add(this.neonLight);this.fill=new T.PointLight(0xffd6a0,10,14,1.6);this.fill.position.set(3,3.2,3);s.add(this.fill);
  this.glowTex=radial(glowStops);this.particles=new Particles(s,this.quality==='high'?300:150,this.glowTex);
  this.player=new T.Group();this.player.position.set(-1.2,0,2.6);this.player.rotation.y=Math.PI*.82;s.add(this.player);
  this.buildings=await loadBuildings().catch(()=>[]);if(this.dead)return this;this.ready=true;return this;}
 clear(){for(const o of this.items)o.removeFromParent();this.items=[];this.lasers=[];this.crowd=[];for(const n of this.cast)n.group.removeFromParent();this.cast=[];}
 add(o){this.scene.add(o);this.items.push(o);return o;}
 // Builds a location's set. Models stream in; the room is usable before they arrive.
 build(loc,l){this.clear();const set=l.set,rnd=seededRandom(loc.length*977+set.props.length),neon=new T.Color(set.neonColor||'#ff5fc8'),token=this.token={};
  this.neonLight.color.copy(neon);this.neonLight.intensity=set.bright?8:20;this.hemi.intensity=set.bright?1.6:.75;this.keyLight.intensity=set.bright?1.5:.8;this.fill.intensity=set.bright?6:10;this.scene.fog.density=set.outdoor?.018:.012;
  const floorMat=new T.MeshStandardMaterial({color:new T.Color(set.floor||'#221a26'),roughness:set.bright?.6:.32,metalness:set.bright?.05:.35,envMapIntensity:1});
  const floor=this.add(new T.Mesh(new T.PlaneGeometry(set.roof?40:SET.width+4,set.roof?18:SET.depth+2).rotateX(-Math.PI/2),floorMat));floor.position.z=set.roof?2:.4;
  if(!set.outdoor){const wallMat=new T.MeshStandardMaterial({color:new T.Color(set.wall||'#2a2030'),roughness:.85});
   const back=this.add(new T.Mesh(new T.PlaneGeometry(SET.width+4,7),wallMat));back.position.set(0,3.5,SET.back-.4);
   for(const side of [-1,1]){const w=this.add(new T.Mesh(new T.PlaneGeometry(SET.depth+2,7),wallMat));w.position.set(side*(SET.width/2+1.6),3.5,.2);w.rotation.y=-side*Math.PI/2*.82;}
   const strip=this.add(new T.Mesh(new T.BoxGeometry(SET.width+4,.06,.06),new T.MeshBasicMaterial({color:neon.clone().multiplyScalar(1.6),toneMapped:false})));strip.position.set(0,.05,SET.back-.35);
   const crown=strip.clone();crown.position.y=5.6;this.add(crown);}
  else{// Outdoors: brick walls for the alley, a whole city for the roof.
   if(set.roof){const rail=this.add(new T.Mesh(new T.BoxGeometry(30,.9,.25),new T.MeshStandardMaterial({color:0x3a3650,emissive:neon,emissiveIntensity:.3})));rail.position.set(0,.45,-4.4);
    for(let i=0;i<46&&this.buildings.length;i++){const a=(i/46-.5)*Math.PI*1.4,r=40+rnd()*100,h=24+rnd()*56,b=this.add(building(this.buildings,rnd,{x:Math.sin(a)*r,z:-Math.cos(a)*r,height:h}));b.position.y=-h*.8-4+rnd()*h*.25;}
    const deck=this.add(new T.Mesh(new T.BoxGeometry(12,.3,3),new T.MeshStandardMaterial({color:0x111018,roughness:.4,metalness:.5})));deck.position.set(0,.15,-3.4);}
   else{const brick=new T.MeshStandardMaterial({color:0x2b1c22,roughness:.9});for(const [x,z,ry,w] of [[0,SET.back-.4,0,18],[-8,0,Math.PI/2,10],[8,0,-Math.PI/2,10]]){const m=this.add(new T.Mesh(new T.PlaneGeometry(w,9),brick));m.position.set(x,4.5,z);m.rotation.y=ry;}
    for(let i=0;i<8&&this.buildings.length;i++){const b=this.add(building(this.buildings,rnd,{x:-20+i*6,z:-16-rnd()*8,height:18+rnd()*20}));}}}
  // The sign: a neon panel high on the back wall.
  const sign=this.add(new T.Mesh(new T.PlaneGeometry(5.4,1.35),new T.MeshBasicMaterial({map:signTexture(set.neon||l.name.toUpperCase(),set.neonColor||'#ff5fc8'),transparent:true,toneMapped:false})));sign.position.set(set.roof?0:2.6,set.roof?3.6:4.5,SET.back-.3);
  if(!set.outdoor)for(let i=0;i<3;i++){const art=ART[Math.floor(rnd()*ART.length)],m=this.add(new T.Mesh(new T.PlaneGeometry(1.1,1.4),new T.MeshStandardMaterial({map:artTexture(art),emissive:0xffffff,emissiveMap:artTexture(art),emissiveIntensity:.35,roughness:.6})));m.position.set(-5.6+i*1.6,3.2+(i%2)*.25,SET.back-.32);m.rotation.z=(rnd()-.5)*.06;}
  const halo=this.add(new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:neon,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,opacity:.55})));halo.position.copy(sign.position);halo.scale.set(9,3.6,1);
  // Furniture and the hotspots that are things.
  // Each set gets its own copies of the materials, dimmed for the dark interiors.
  const place=([path,[x,z],ry,size])=>loadModel(path).then(m=>{if(this.token!==token||this.dead)return;const o=fitModel(cloneModel(m,{ownMaterials:true}),size),h=new T.Group();h.add(o);h.position.set(x,0,z);h.rotation.y=ry||0;
   if(!set.bright)o.traverse(n=>{if(n.isMesh)for(const mat of [].concat(n.material)){mat.color?.multiplyScalar(set.outdoor?.45:.62);if('roughness' in mat)mat.roughness=Math.min(1,mat.roughness*.8);}});this.add(h);}).catch(()=>{});
  for(const p of set.props)place(p);for(const h of Object.values(l.hotspots))if(h.prop)place([h.prop,h.at,0,h.size||1.4]);
  this.decor(set,rnd,neon);this.rebuildCast=true;}
 // Procedural dressing that the furniture packs don't cover: bottles, slots, lamps, lasers, a crowd.
 decor(set,rnd,neon){const glow=(col,o=1)=>new T.MeshBasicMaterial({color:new T.Color(col).multiplyScalar(o),toneMapped:false}),lasers=this.lasers=[];
  for(const kind of set.decor||[]){
   if(kind==='bottles'){const [bx,bz]=set.bottlesAt||[-1,SET.back-.1];const shelf=this.add(new T.Mesh(new T.BoxGeometry(4.6,.08,.5),new T.MeshStandardMaterial({color:0x3a2a22,roughness:.6})));shelf.position.set(bx,2.4,bz);const s2=shelf.clone();s2.position.y=3.1;this.add(s2);
    const geo=new T.CylinderGeometry(.07,.09,.42,8);for(let i=0;i<22;i++){const col=[0xffb35e,0x5ee7ff,0xb9ff5e,0xff5fc8,0xffe45e][Math.floor(rnd()*5)],b=this.add(new T.Mesh(geo,glow(col,.9)));b.position.set(bx-2.1+(i%11)*.42+rnd()*.1,i<11?2.65:3.35,bz);}
    const back=this.add(new T.Mesh(new T.PlaneGeometry(4.8,1.6),glow(neon.getHex(),.25)));back.position.set(bx,2.85,bz-.26);}
   if(kind==='slots')for(let i=0;i<4;i++){const g=new T.Group(),body=new T.Mesh(new T.BoxGeometry(.9,1.9,.7),new T.MeshStandardMaterial({color:0x5a1a6a,metalness:.6,roughness:.3})),screen=new T.Mesh(new T.PlaneGeometry(.66,.5),new T.MeshBasicMaterial({map:texture(128,96,(c,w,h)=>{c.fillStyle='#14081c';c.fillRect(0,0,w,h);c.font='bold 44px sans-serif';c.textAlign='center';c.textBaseline='middle';['🍒','🦴','7'].forEach((s,j)=>{c.fillStyle=['#ff5f7a','#fff','#ffe45e'][j];c.fillText(s,w*(j+.5)/3,h/2);});}),toneMapped:false})),top=new T.Mesh(new T.BoxGeometry(.9,.25,.7),glow([0xffe45e,0xff5fc8,0x5ee7ff,0xb9ff5e][i],1.2));
    body.position.y=.95;screen.position.set(0,1.25,.36);top.position.y=2.02;g.add(body,screen,top);g.position.set(3.2+i*1.05,0,-3.4);g.rotation.y=-.12;this.add(g);}
   if(kind==='pendants'||kind==='chandelier'){const n=kind==='chandelier'?1:4;for(let i=0;i<n;i++){const x=n===1?0:[-5.4,-3.2,-1,5.8][i],cord=this.add(new T.Mesh(new T.CylinderGeometry(.015,.015,1.4,4),new T.MeshBasicMaterial({color:0x111111})));cord.position.set(x,5.3,-.6);
     const bulb=this.add(new T.Mesh(kind==='chandelier'?new T.TorusGeometry(.8,.08,8,24):new T.ConeGeometry(.35,.4,12,1,true),kind==='chandelier'?glow(0xffe2a0,1.6):new T.MeshStandardMaterial({color:0x22222a,side:T.DoubleSide,emissive:0xffc070,emissiveIntensity:.25})));bulb.position.set(x,4.55,-.6);if(kind==='chandelier')bulb.rotation.x=Math.PI/2;
     const halo=this.add(new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:0xffc070,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,opacity:.7})));halo.position.set(x,4.35,-.6);halo.scale.set(kind==='chandelier'?3.2:1.6,kind==='chandelier'?2:1.6,1);}}
   if(kind==='candles')for(let i=0;i<10;i++){const side=i<5?-1:1,x=side*(2.4+((i%5)*.35)),c=this.add(new T.Mesh(new T.CylinderGeometry(.06,.06,.4+rnd()*.3,8),new T.MeshStandardMaterial({color:0xfff4e0})));c.position.set(x,1.1,-3.5);const f=this.add(new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:0xffb35e,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false})));f.position.set(x,1.45,-3.5);f.scale.set(.35,.5,1);}
   if(kind==='lasers')for(let i=0;i<6;i++){const beam=this.add(new T.Mesh(new T.CylinderGeometry(.02,.02,14,4),glow([0xff5fc8,0x5ee7ff,0xb9ff5e][i%3],1.8)));beam.position.set(-3+i*1.2,4.5,-3.6);lasers.push({beam,phase:rnd()*6,speed:.6+rnd()*.8});}
   if(kind==='crowd'){const mat=new T.MeshStandardMaterial({color:0x0c0a14,roughness:.9}),geo=new T.CapsuleGeometry(.28,.7,4,8),head=new T.SphereGeometry(.24,10,8);this.crowd=[];for(let i=0;i<16;i++){const g=new T.Group(),b=new T.Mesh(geo,mat),h=new T.Mesh(head,mat);b.position.y=.65;h.position.y=1.35;g.add(b,h);
     if(i%3===0){const stick=new T.Mesh(new T.CylinderGeometry(.03,.03,.5,4),glow([0xb9ff5e,0xff5fc8,0x5ee7ff][i%3===0?(i/3)%3:0],2));stick.position.set(.3,1.5,0);stick.rotation.z=-.5;g.add(stick);}
     g.position.set(-5.5+(i%8)*1.5+rnd()*.4,0,(set.crowdZ??-1.6)-Math.floor(i/8)*1.1-rnd()*.3);g.rotation.y=Math.PI+(rnd()-.5)*.4;this.add(g);this.crowd.push({g,phase:rnd()*6});}}}}
 npc(seed){if(!this.npcs.has(seed)){try{const a=createDawgAsset(npcDawg(seed)),b=new T.Box3().setFromObject(a.root),h=b.getSize(new T.Vector3()).y||1;a.root.scale.setScalar(1.6/h);const group=new T.Group();group.add(a.root);this.npcs.set(seed,{asset:a,group});}catch{this.npcs.set(seed,null);}}return this.npcs.get(seed);}
 // Characters present right now (some come and go with the story).
 castFor(hotspots){for(const n of this.cast)n.group.removeFromParent();this.cast=[];for(const h of hotspots)if(h.npc){const n=this.npc(h.npc.seed);if(!n)continue;const g=n.group,[x,z]=h.at;g.position.set(x,h.npc.pose==='sit'?.1:0,z);g.scale.setScalar(h.npc.scale||1);g.rotation.set(0,Math.atan2(-x*.25,4),0);
   if(h.npc.pose==='sleep'){g.rotation.set(0,0,Math.PI/2);g.position.y=.95;}this.scene.add(g);this.cast.push({id:h.id,name:h.name,group:g,asset:n.asset,pose:h.npc.pose});}}
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;try{const next=createDawgAsset(d),b=new T.Box3().setFromObject(next.root),h=b.getSize(new T.Vector3()).y||1;next.root.scale.setScalar(1.75/h);if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.player.add(next.root);}catch{}}
 // view: {loc, location, hotspots, speaker, dawg, reduced, mood ('death'|'ending'|null)}
 draw(v){if(!this.ready||this.dead)return false;if(v.loc!==this.key){this.key=v.loc;this.build(v.loc,v.location);}
  const castKey=v.hotspots.filter(h=>h.npc).map(h=>h.id).join(',');if(this.rebuildCast||castKey!==this.castKey){this.rebuildCast=false;this.castKey=castKey;this.castFor(v.hotspots);}
  this.prepare(v.dawg);const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-this.clock)/1000)),real=now/1000,reduced=!!v.reduced;this.clock=now;this.stage.resize();
  const set=v.location.set,tint=new T.Color(set.neonColor||'#ff5fc8'),u=this.sky.material.uniforms;u.uTop.value.set(0x03040c);u.uHorizon.value.copy(tint).multiplyScalar(set.outdoor?.18:.06);u.uGlow.value.copy(tint).multiplyScalar(.1);this.scene.fog.color.copy(tint).multiplyScalar(.035);
  for(const n of this.cast){const talking=v.speaker&&v.speaker===n.name;setDawgPose(n.asset,real+n.name.length,reduced||n.pose==='sleep'?'still':'idle');if(talking&&!reduced)n.group.position.y=(n.pose==='sleep'?.95:n.pose==='sit'?.1:0)+Math.abs(Math.sin(real*9))*.05;}
  if(this.asset)setDawgPose(this.asset,real,reduced?'still':'idle');
  if(!reduced){for(const l of this.lasers||[]){l.beam.rotation.z=Math.sin(real*l.speed+l.phase)*.9;l.beam.rotation.x=.5+Math.cos(real*l.speed*.7+l.phase)*.3;}for(const c of this.crowd||[])c.g.position.y=Math.max(0,Math.sin(real*7.5+c.phase))*.12;}
  if(v.mood==='death'){this.stage.flashOnce('#ff2a4f',.5,reduced);v.mood=null;}else if(v.mood==='ending'){this.stage.flashOnce('#ffe45e',.6,reduced);if(!reduced)for(let i=0;i<40;i++)this.particles.burst((Math.random()-.5)*10,3+Math.random()*3,(Math.random()-.5)*4-1,1,[0xffe45e,0xff5fc8,0x5ee7ff][i%3],{speed:4,life:1.6,gravity:-6,up:3,spread:1});}
  if(!reduced&&!set.outdoor&&Math.random()<.25)this.particles.burst((Math.random()-.5)*12,3+Math.random()*2,(Math.random()-.5)*6,1,tint.getHex(),{speed:.15,life:3,gravity:.05,up:.05,spread:.2});
  if(set.outdoor&&!set.roof&&!reduced)for(let i=0;i<2;i++)this.particles.burst((Math.random()-.5)*14,8,(Math.random()-.5)*8,1,0x9fc4ff,{speed:.2,life:.7,gravity:-24,up:0,spread:.1});
  const cam=this.camera,aspect=cam.aspect||1.6;cam.position.set(0,set.roof?3.6:4.1,aspect<1?12.5:9.6);if(!reduced){cam.position.x+=Math.sin(real*.2)*.35;cam.position.y+=Math.sin(real*.33)*.08;}cam.lookAt(0,set.roof?1.2:1.3,-1);cam.fov=fitFov(46,aspect,58);cam.updateProjectionMatrix();this.sky.position.copy(cam.position);
  this.particles.update(dt);this.stage.render(dt,real,{reduced,aberration:.0012});
  // Project each hotspot to a percentage of the view, for the play screen's buttons.
  const p=new T.Vector3(),out={};for(const h of v.hotspots){const [x,z]=h.at;p.set(x,h.npc?1.9*(h.npc.scale||1):Math.max(.6,(h.size||1.4)*.6),z).project(cam);out[h.id]={x:(p.x+1)*50,y:(1-p.y)*50,visible:p.z<1};}p.set(this.player.position.x,2.1,this.player.position.z).project(cam);out.player={x:(p.x+1)*50,y:(1-p.y)*50,visible:true};this.anchors=out;
  return true;}
 fail(){if(this.dead)return;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;for(const n of this.npcs.values())n?.asset.dispose();this.asset?.dispose();this.view?.remove();this.stage?.dispose();}
}
