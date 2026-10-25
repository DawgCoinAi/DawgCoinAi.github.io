// 3D street scenes for Street Hustle and After Hours: a night street with CC0 Kenney buildings,
// lamps and traffic, the player's DAWG on the sidewalk, a neon sign naming the place, rain when
// the weather turns, and a rooftop view for the roof. It draws over the game's 2D scene canvas,
// which stays as the fallback. Scenes only read state; the games own everything else.
import {T,quality,fitFov,texture,radial,glowStops,skyMaterial,Stage,Particles,loadModel} from './three-kit.js';
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {loadBuildings,loadSet,STREET,TRAFFIC,building,prop} from './city-art.js';
import {seededRandom} from './mobile-core.js';
import {npcDawg} from './npc-dawg.js';
// Where characters stand on the sidewalk, by slot: your contact, then whoever stops you.
const SPOTS=[[-3.2,.25,3.4,.6],[.4,.25,1.6,-.2]];

const signTexture=(text,color)=>texture(512,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#0b0a16e6';c.beginPath();c.roundRect(4,4,w-8,h-8,22);c.fill();c.lineWidth=6;c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=18;c.stroke();
 c.font='900 64px "DAWG display","Arial Narrow",Impact,sans-serif';c.textAlign='center';c.textBaseline='middle';const s=Math.min(1,(w-60)/Math.max(1,c.measureText(text).width));c.save();c.translate(w/2,h/2+4);c.scale(s,1);c.fillStyle=color;c.fillText(text,0,0);c.restore();});

export class ThreeStreetScene {
 constructor(canvas,{onFailure,quality:q=quality()}={}){this.canvas=canvas;this.onFailure=onFailure;this.quality=q;this.ready=false;this.dead=false;this.key='';this.clock=performance.now();this.items=[];this.cars=[];this.npcs=new Map();this.anchors={};}
 async init(){
  // The scene sits in a wrapper around the 2D canvas so it covers only the picture.
  const wrap=document.createElement('div');wrap.className='scene3d-wrap';this.canvas.before(wrap);wrap.append(this.canvas);this.wrap=wrap;
  this.stage=new Stage({quality:this.quality,className:'dash3d scene3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;wrap.append(this.view);
  const s=this.scene;this.stage.neonEnvironment(.6);this.stage.hdrEnvironment(undefined,.5);s.fog=new T.FogExp2(0x0a0b1c,.03);
  this.sky=new T.Mesh(new T.SphereGeometry(200,24,12),skyMaterial());s.add(this.sky);s.add(new T.HemisphereLight(0xa9b4ff,0x1a1028,1.1));const key=new T.DirectionalLight(0xffffff,1.2);key.position.set(-6,14,8);s.add(key);
  this.glowTex=radial(glowStops);this.particles=new Particles(s,this.quality==='high'?500:250,this.glowTex);
  this.road=new T.Mesh(new T.PlaneGeometry(10,120).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x14131c,roughness:.35,metalness:.4,envMapIntensity:.9}));s.add(this.road);
  this.walk=new T.Group();for(const side of [-1,1]){const m=new T.Mesh(new T.BoxGeometry(5,.25,120),new T.MeshStandardMaterial({color:0x2a2838,roughness:.8}));m.position.set(side*7.5,.12,0);this.walk.add(m);}s.add(this.walk);
  this.lineMat=new T.MeshBasicMaterial({color:0xffe45e,toneMapped:false});for(let z=-58;z<60;z+=6){const l=new T.Mesh(new T.PlaneGeometry(.18,2.6).rotateX(-Math.PI/2),this.lineMat);l.position.set(0,.01,z);this.walk.add(l);}
  this.sign=new T.Mesh(new T.PlaneGeometry(6,1.5),new T.MeshBasicMaterial({transparent:true,toneMapped:false}));this.sign.position.set(-4.6,4.4,-6);this.sign.rotation.y=.5;s.add(this.sign);
  this.player=new T.Group();this.player.position.set(3.4,.25,4.2);this.player.rotation.y=-.5;s.add(this.player);
  this.art=await Promise.all([loadBuildings(),Promise.all(TRAFFIC.map(p=>loadModel(p).catch(()=>null))),loadSet({lamp:STREET.post})]).then(([buildings,cars,props])=>({buildings,cars:cars.filter(Boolean),props})).catch(()=>null);
  if(this.dead)return this;this.ready=true;return this;
 }
 // Rebuild the street for a new place: buildings, lamps and cars from a seed.
 setPlace({seed,tint,roof}){const s=this.scene,rnd=seededRandom((seed>>>0)||1);for(const o of this.items)o.removeFromParent();this.items=[];for(const c of this.cars)c.obj.removeFromParent();this.cars=[];const add=o=>{s.add(o);this.items.push(o);return o;};
  this.road.visible=this.walk.visible=!roof;const art=this.art;if(!art)return;
  if(roof){// A rooftop: a parapet, then the city spread out below.
   const deck=add(new T.Mesh(new T.BoxGeometry(30,.4,14),new T.MeshStandardMaterial({color:0x22202e,roughness:.7})));deck.position.set(0,-.2,4);
   const rail=add(new T.Mesh(new T.BoxGeometry(30,.9,.25),new T.MeshStandardMaterial({color:0x3a3650,emissive:new T.Color(tint),emissiveIntensity:.25})));rail.position.set(0,.45,-2.6);
   for(let i=0;i<54;i++){const a=(i/54-.5)*Math.PI*1.3,r=45+rnd()*110,h=24+rnd()*56;const b=add(building(art.buildings,rnd,{x:Math.sin(a)*r,z:-Math.cos(a)*r,height:h}));b.position.y=-h*.85-4+rnd()*h*.25;}return;}
  for(const side of [-1,1])for(let z=-56;z<20;z+=9+rnd()*5){add(building(art.buildings,rnd,{x:side*(13+rnd()*3),z,height:10+rnd()*24,facing:side>0?-Math.PI/2:Math.PI/2}));}
  if(art.props.lamp)for(let z=-50;z<14;z+=14)for(const side of [-1,1]){add(prop(art.props.lamp,{x:side*5.6,z:z+(side>0?7:0),size:5,facing:side>0?-Math.PI/2:Math.PI/2}));const g=add(new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(1.2,1,.8),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false})));g.position.set(side*4.3,4.8,z+(side>0?7:0));g.scale.set(2.6,2.6,1);}
  if(art.cars.length)for(let i=0;i<5;i++){const dir=i%2?1:-1,obj=prop(art.cars[Math.floor(rnd()*art.cars.length)],{x:dir*2.2,z:0,size:4.2,facing:dir>0?Math.PI:0});s.add(obj);this.cars.push({obj,dir,speed:6+rnd()*6,base:rnd()*120});}}
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;try{const next=createDawgAsset(d),b=new T.Box3().setFromObject(next.root),h=b.getSize(new T.Vector3()).y||1;next.root.scale.setScalar(1.7/h);if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.player.add(next.root);}catch{}}
 // Characters by name, built once and reused; each faces the camera from its sidewalk spot.
 castFor(cast=[]){const key=cast.map(c=>c.name).join('|');if(key===this.castKey)return;this.castKey=key;for(const n of this.npcs.values())n.group.visible=false;
  cast.slice(0,SPOTS.length).forEach((c,i)=>{let n=this.npcs.get(c.name);if(!n){try{const a=createDawgAsset(npcDawg(c.name)),b=new T.Box3().setFromObject(a.root),h=b.getSize(new T.Vector3()).y||1;a.root.scale.setScalar(1.7/h);const group=new T.Group();group.add(a.root);this.scene.add(group);n={asset:a,group};this.npcs.set(c.name,n);}catch{return;}}
   const [x,y,z,ry]=SPOTS[i];n.group.position.set(x,y,z);n.group.rotation.y=ry;n.group.visible=true;n.slot=c.id;});}
 // place: {seed, title, tint (css colour), roof, rain, dawg, reduced, cast:[{id,name}]}
 draw(place){if(!this.ready||this.dead)return false;const key=place.seed+'|'+place.title+'|'+!!place.roof;if(key!==this.key){this.key=key;this.setPlace(place);const tex=signTexture(String(place.title||'').toUpperCase(),place.tint||'#b9ff5e');this.sign.material.map?.dispose();this.sign.material.map=tex;this.sign.material.needsUpdate=true;this.sign.visible=!!place.title&&!place.roof;}
  this.prepare(place.dawg);const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-this.clock)/1000)),real=now/1000,reduced=!!place.reduced;this.clock=now;this.stage.resize();
  const tint=new T.Color(place.tint||'#b9ff5e'),u=this.sky.material.uniforms;u.uTop.value.set(0x03040c);u.uHorizon.value.copy(tint).multiplyScalar(.14);u.uGlow.value.copy(tint).multiplyScalar(.12);this.scene.fog.color.copy(tint).multiplyScalar(.04);this.lineMat.color.copy(tint).multiplyScalar(1.4);
  for(const c of this.cars){const z=((c.base+(reduced?0:real*c.speed*c.dir))%120+120)%120-80;c.obj.position.z=z;}
  if(this.asset)setDawgPose(this.asset,real,reduced?'still':'idle');
  this.castFor(place.roof?[]:place.cast);for(const n of this.npcs.values())if(n.group.visible)setDawgPose(n.asset,real+n.slot.length,reduced?'still':'idle');
  if(place.rain&&!reduced)for(let i=0;i<4;i++)this.particles.burst((Math.random()-.5)*16,9,(Math.random()-.5)*14-4,1,0x9fc4ff,{speed:.2,life:.7,gravity:-24,up:0,spread:.1});
  const roof=!!place.roof,pos=roof?new T.Vector3(0,3.2,9):new T.Vector3(1.8,2.6,11),at=roof?new T.Vector3(0,-2,-30):new T.Vector3(-1,2.2,-10);
  this.camera.position.copy(pos);if(!reduced){this.camera.position.x+=Math.sin(real*.25)*.5;this.camera.position.y+=Math.sin(real*.4)*.12;}this.camera.lookAt(at);this.camera.fov=fitFov(roof?60:52,this.camera.aspect,60);this.camera.updateProjectionMatrix();this.sky.position.copy(this.camera.position);
  this.particles.update(dt);this.stage.render(dt,real,{reduced,aberration:.0012});this.canvas.style.opacity='0';
  const p=new T.Vector3(),out={};for(const n of this.npcs.values())if(n.group.visible){p.set(n.group.position.x,n.group.position.y+1.95,n.group.position.z).project(this.camera);out[n.slot]={x:(p.x+1)*50,y:(1-p.y)*50};}
  p.set(this.player.position.x,2.1,this.player.position.z).project(this.camera);out.player={x:(p.x+1)*50,y:(1-p.y)*50};this.anchors=out;return true;}
 fail(){if(this.dead)return;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;for(const n of this.npcs.values())n.asset.dispose();this.ready=false;this.canvas.style.opacity='';this.view?.remove();this.stage?.dispose();}
}
