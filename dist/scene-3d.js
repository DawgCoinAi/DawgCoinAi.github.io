// Street Hustle's district in 3D: a coastal boulevard at golden hour, sunset or neon night (one
// look per district), with the ocean and a far skyline down one side, palms and storefront neon,
// traffic with head and tail lights, DAWGs strolling the sidewalks, and a camera that drifts
// between a few cinematic framings. Your DAWG and tonight's contact stand on the corner; chat
// bubbles follow them via screen anchors. It draws over the 2D city canvas, which stays as the
// fallback. Scenes only read state; the trade engine owns everything else.
import {T,quality,fitFov,skyMaterial,Stage,Particles,loadModel} from './three-kit.js';
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {loadBuildings,loadSet,STREET,TRAFFIC,prop,styledBuildings,SKIES,STORE_SIGNS,roadTexture,palmGrove,storeSign,skylineBand,glowTexture,fitBuilding} from './city-art.js';
import {seededRandom} from './mobile-core.js';
import {npcDawg} from './npc-dawg.js';
// Where characters stand on the corner, by slot: your contact, then whoever stops you.
const SPOTS=[[8.1,.3,3,.15],[10.3,.3,1.3,-.45]];
// People out on the boulevard (stable names, so the same DAWGs walk the same streets).
const WALKERS=['Biscuit','Pepper','Waffles','Juno','Rocco','Mochi'];
// Camera framings the street drifts between: [position, look-at].
const SHOTS=[[[7,2.5,14.5],[6.6,1.9,-6]],[[7.4,1.4,10.4],[9.4,1.9,2.4]],[[-4,6.2,15.5],[6,1.2,-10]],[[12.6,1.75,10.5],[6,2,-1]]];

export class ThreeStreetScene {
 constructor(canvas,{onFailure,quality:q=quality()}={}){this.canvas=canvas;this.onFailure=onFailure;this.quality=q;this.ready=false;this.dead=false;this.key='';this.clock=performance.now();this.items=[];this.cars=[];this.walkers=[];this.npcs=new Map();this.anchors={};this.camPos=new T.Vector3(7,2.5,14.5);this.camAt=new T.Vector3(6.6,1.9,-6);}
 async init(){
  // The scene sits in a wrapper around the 2D canvas so it covers only the picture.
  const wrap=document.createElement('div');wrap.className='scene3d-wrap';this.canvas.before(wrap);wrap.append(this.canvas);this.wrap=wrap;
  this.stage=new Stage({quality:this.quality,className:'dash3d scene3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;this.camera.far=900;wrap.append(this.view);
  const s=this.scene;this.stage.neonEnvironment(.6);this.stage.hdrEnvironment(undefined,.6);s.fog=new T.FogExp2(0x0a0b1c,.01);
  this.sky=new T.Mesh(new T.SphereGeometry(800,24,12),skyMaterial());s.add(this.sky);this.hemi=new T.HemisphereLight(0xa9b4ff,0x1a1028,1.1);s.add(this.hemi);this.sunLight=new T.DirectionalLight(0xffffff,1.2);this.sunLight.position.set(-30,14,-40);s.add(this.sunLight);
  this.glowTex=glowTexture();this.particles=new Particles(s,this.quality==='high'?500:250,this.glowTex);
  // Fixed set pieces: the road, sidewalks, the promenade and beach on the left, the ocean beyond.
  this.road=new T.Mesh(new T.PlaneGeometry(14,160).rotateX(-Math.PI/2),new T.MeshStandardMaterial({map:roadTexture(),roughness:.3,metalness:.45}));this.road.material.map.repeat.set(1,10);this.road.position.set(0,0,-50);s.add(this.road);
  this.walkMat=new T.MeshStandardMaterial({color:0x9a8e8a,roughness:.8});for(const [x,w] of [[9.75,5.5],[-8.75,3.5]]){const m=new T.Mesh(new T.BoxGeometry(w,.3,160),this.walkMat);m.position.set(x,.1,-50);s.add(m);}
  this.sand=new T.Mesh(new T.PlaneGeometry(40,160).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0xd2a274,roughness:1}));this.sand.position.set(-30.5,-.05,-50);this.sand.rotation.z=0;s.add(this.sand);
  this.ocean=new T.Mesh(new T.PlaneGeometry(3000,3000).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x24467a,metalness:.85,roughness:.16,envMapIntensity:1.1}));this.ocean.position.set(-1500,-.6,0);s.add(this.ocean);
  this.land=new T.Mesh(new T.PlaneGeometry(400,400).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x3a3140,roughness:.95}));this.land.position.set(212,-.02,-60);s.add(this.land);
  this.skyline=skylineBand(600,70);s.add(this.skyline);
  this.sun=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,transparent:true,depthWrite:false,fog:false,blending:T.AdditiveBlending,toneMapped:false}));s.add(this.sun);
  this.glitter=new T.Mesh(new T.PlaneGeometry(30,420),new T.MeshBasicMaterial({map:this.glowTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,fog:false}));this.glitter.rotation.x=-Math.PI/2;s.add(this.glitter);
  this.sign=storeSign('THE BLOCK','#b9ff5e',6);this.sign.position.set(4.2,5,-9);this.sign.rotation.y=-.35;s.add(this.sign);
  this.player=new T.Group();this.player.position.set(10.4,.3,5.4);this.player.rotation.y=-.95;s.add(this.player);
  // Moving lights: car head and tail lights in one points cloud.
  this.lightN=64;this.lightPos=new Float32Array(this.lightN*3);this.lightCol=new Float32Array(this.lightN*3);const lg=new T.BufferGeometry();lg.setAttribute('position',new T.BufferAttribute(this.lightPos,3).setUsage(T.DynamicDrawUsage));lg.setAttribute('color',new T.BufferAttribute(this.lightCol,3).setUsage(T.DynamicDrawUsage));
  this.lights=new T.Points(lg,new T.PointsMaterial({map:this.glowTex,size:.8,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.lights.frustumCulled=false;s.add(this.lights);
  this.art=await Promise.all([loadBuildings(),Promise.all(TRAFFIC.map(p=>loadModel(p).catch(()=>null))),loadSet({lamp:STREET.post})]).then(([buildings,cars,props])=>({buildings,cars:cars.filter(Boolean),props})).catch(()=>null);
  if(this.dead)return this;this.ready=true;return this;
 }
 // Paint the sky, water, light and fog for a district look (see SKIES in city-art.js).
 setLook(name){const L=SKIES[name]||SKIES.neon;this.look=L;const u=this.sky.material.uniforms;u.uTop.value.set(L.top);u.uHorizon.value.set(L.horizon);u.uGlow.value.set(L.glow);this.scene.fog.color.set(L.fog);this.scene.fog.density=L.fogDensity*1.4;
  this.hemi.color.set(L.hemi[0]);this.hemi.groundColor.set(L.hemi[1]);this.hemi.intensity=L.hemi[2];this.sunLight.color.set(L.key[0]);this.sunLight.intensity=L.key[1];this.stage.r.toneMappingExposure=L.night?.95:1.02;
  this.ocean.material.color.set(L.water);this.sand.material.color.set(L.sand);this.land.material.color.set(L.ground);this.walkMat.color.set(L.night?0x3a3648:0x9a8e8a);this.road.material.envMapIntensity=L.night?1.4:1;
  this.sun.material.color.set(L.sun).multiplyScalar(L.night?.9:1.25);const sz=L.night?36:58;this.sun.scale.set(sz,sz,1);this.glitter.material.color.set(L.sun).multiplyScalar(L.night?.35:.75);
  this.lights.material.size=L.night?.6:.42;}
 // Rebuild the street for a new place: buildings, signs, palms, lamps, cars and walkers from a seed.
 setPlace({seed,look}){const s=this.scene,rnd=seededRandom((seed>>>0)||1);for(const o of this.items){o.removeFromParent();if(o.userData.own)o.traverse(c=>{c.geometry?.dispose();for(const m of [].concat(c.material||[])){m.map?.dispose();m.dispose();}});}this.items=[];for(const c of this.cars)c.obj.removeFromParent();this.cars=[];const add=o=>{s.add(o);this.items.push(o);return o;};
  this.setLook(look);const L=this.look,art=this.art,low=this.quality!=='high';if(!art)return;
  // Inland blocks on the right, a few beach-side cafes on the left before the sand; neon on the fronts.
  if(art.buildings.length){const set=styledBuildings(art.buildings,L.night?'night':'day');let i=0;
   for(let z=-70;z<22;z+=8+rnd()*5){i++;const h=10+rnd()*(L.night?30:24),b=add(fitBuilding(set[Math.floor(rnd()*set.length)],{x:15+rnd()*4,z,height:h,facing:-Math.PI/2+(rnd()-.5)*.2}));b.userData.z=z;
    if(i%2===0&&z>-50){const [text,col]=STORE_SIGNS[Math.floor(rnd()*STORE_SIGNS.length)],sg=add(storeSign(text,col,4.4));sg.userData.own=true;sg.position.set(12.1,3.4+rnd()*2.4,z);sg.rotation.y=-Math.PI/2;}}}
  const palms=[];for(let z=-76;z<20;z+=7+rnd()*3)palms.push([-8.9,z,.8+rnd()*.4,rnd()*6]);for(let z=-60;z<16;z+=15+rnd()*6)palms.push([8.6,z,.75+rnd()*.3,rnd()*6]);const grove=add(palmGrove(palms,{dark:L.night}));grove.userData.own=true;grove.children.forEach(m=>{m.position.y=.25;});
  if(art.props.lamp)for(let z=-56;z<4;z+=13){add(prop(art.props.lamp,{x:7.4,z,size:5.6,facing:-Math.PI/2}));const g=add(new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(1.3,1.05,.8).multiplyScalar(L.lamps),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false})));g.position.set(5.9,5.5,z);g.scale.set(2.8,2.8,1);}
  // Traffic in four lanes, plus a couple parked at the kerb.
  if(art.cars.length){const civilian=art.cars.filter((_,i)=>TRAFFIC[i]!=='cars/police.glb'),pool=civilian.length?civilian:art.cars;
   for(let i=0;i<(low?5:8);i++){const lane=[-5.25,-1.75,1.75,5.25][i%4],dir=lane<0?1:-1,obj=prop(pool[Math.floor(rnd()*pool.length)],{x:lane,z:0,size:4.3,facing:dir>0?0:Math.PI});s.add(obj);this.cars.push({obj,dir,lane,speed:7+rnd()*7,base:rnd()*140});}
   for(const z of [-16,-29])add(prop(pool[Math.floor(rnd()*pool.length)],{x:6.3,z,size:4.2,facing:Math.PI}));}
  this.walkersFor(rnd,low?2:4);}
 // A few DAWGs out for a stroll; built once per name and reused.
 walkersFor(rnd,count){for(const w of this.walkers)w.group.visible=false;this.walkers.length=Math.min(this.walkers.length,WALKERS.length);
  for(let i=0;i<count;i++){let w=this.walkers[i];if(!w){try{const a=createDawgAsset(npcDawg(WALKERS[i])),b=new T.Box3().setFromObject(a.root),h=b.getSize(new T.Vector3()).y||1;a.root.scale.setScalar(1.6/h);const group=new T.Group();group.add(a.root);this.scene.add(group);w={asset:a,group};this.walkers[i]=w;}catch{break;}}
   w.group.visible=true;w.x=i%2?-8.4:11.8;w.dir=rnd()<.5?1:-1;w.speed=1.1+rnd()*.5;w.base=rnd()*80;}}
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;try{const next=createDawgAsset(d),b=new T.Box3().setFromObject(next.root),h=b.getSize(new T.Vector3()).y||1;next.root.scale.setScalar(1.7/h);if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.player.add(next.root);}catch{}}
 // Characters by name, built once and reused; each faces the camera from its corner spot.
 castFor(cast=[]){const key=cast.map(c=>c.name).join('|');if(key===this.castKey)return;this.castKey=key;for(const n of this.npcs.values())n.group.visible=false;
  cast.slice(0,SPOTS.length).forEach((c,i)=>{let n=this.npcs.get(c.name);if(!n){try{const a=createDawgAsset(npcDawg(c.name)),b=new T.Box3().setFromObject(a.root),h=b.getSize(new T.Vector3()).y||1;a.root.scale.setScalar(1.7/h);const group=new T.Group();group.add(a.root);this.scene.add(group);n={asset:a,group};this.npcs.set(c.name,n);}catch{return;}}
   const [x,y,z,ry]=SPOTS[i];n.group.position.set(x,y,z);n.group.rotation.y=ry;n.group.visible=true;n.slot=c.id;});}
 // place: {seed, title, tint (css colour), look (SKIES key), rain, dawg, reduced, cast:[{id,name}]}
 draw(place){if(!this.ready||this.dead)return false;const look=place.look||'neon',key=place.seed+'|'+place.title+'|'+look;if(key!==this.key){this.key=key;this.setPlace({seed:place.seed,look});
   const old=this.sign;this.sign=storeSign(String(place.title||'').toUpperCase(),place.tint||'#b9ff5e',6);this.sign.position.copy(old.position);this.sign.rotation.copy(old.rotation);old.removeFromParent();old.geometry.dispose();old.material.map?.dispose();old.material.dispose();this.scene.add(this.sign);this.sign.visible=!!place.title;this.shotAt=performance.now()/1000;this.shot=0;}
  this.prepare(place.dawg);const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-this.clock)/1000)),real=now/1000,reduced=!!place.reduced;this.clock=now;this.stage.resize();
  // Traffic flows both ways; each car shows its lights in its direction of travel.
  let L=0;const light=(x,y,z,r,g,b)=>{if(L<this.lightN){this.lightPos.set([x,y,z],L*3);this.lightCol.set([r,g,b],L*3);L++;}};
  for(const c of this.cars){const z=((c.base+(reduced?0:real*c.speed*c.dir))%140+140)%140-110;c.obj.position.z=z;for(const sx of [-.7,.7]){light(c.lane+sx,.85,z-2.2*c.dir,2,.15,.1);light(c.lane+sx,.8,z+2.2*c.dir,1.3,1.2,1);}}
  for(let i=L;i<this.lightN;i++)this.lightCol[i*3]=this.lightCol[i*3+1]=this.lightCol[i*3+2]=0;this.lights.geometry.attributes.position.needsUpdate=true;this.lights.geometry.attributes.color.needsUpdate=true;
  for(const w of this.walkers){if(!w.group.visible)continue;const z=((w.base+(reduced?0:real*w.speed*w.dir))%90+90)%90-74;w.group.position.set(w.x,.25,z);w.group.rotation.y=w.dir>0?0:Math.PI;setDawgPose(w.asset,real+w.base,reduced?'still':'walk');}
  if(this.asset)setDawgPose(this.asset,real,reduced?'still':'idle');
  this.castFor(place.cast);for(const n of this.npcs.values())if(n.group.visible)setDawgPose(n.asset,real+n.slot.length,reduced?'still':'idle');
  if(place.rain&&!reduced)for(let i=0;i<4;i++)this.particles.burst((Math.random()-.5)*16,9,(Math.random()-.5)*14-4,1,0x9fc4ff,{speed:.2,life:.7,gravity:-24,up:0,spread:.1});
  // Camera: holds a framing for a while, then glides to the next; reduced motion keeps the first.
  if(!reduced&&real-this.shotAt>9){this.shotAt=real;this.shot=(this.shot+1)%SHOTS.length;}const [p,a]=SHOTS[reduced?0:this.shot],f=reduced?1:Math.min(1,dt*.9);this.camPos.lerp(new T.Vector3(...p),f);this.camAt.lerp(new T.Vector3(...a),f);
  this.camera.position.copy(this.camPos);if(!reduced){this.camera.position.x+=Math.sin(real*.25)*.35;this.camera.position.y+=Math.sin(real*.4)*.08;}this.camera.lookAt(this.camAt);this.camera.fov=fitFov(52,this.camera.aspect,78);this.camera.updateProjectionMatrix();
  const cp=this.camera.position;this.sky.position.copy(cp);this.skyline.position.set(cp.x,this.skyline.position.y,cp.z);const sunDir=new T.Vector3(-.42,.055,-.9).normalize();this.sun.position.copy(cp).addScaledVector(sunDir,700);this.glitter.position.set(cp.x+sunDir.x*240,-.58,cp.z+sunDir.z*240);this.glitter.rotation.z=Math.atan2(sunDir.x,sunDir.z);
  this.particles.update(dt);this.stage.render(dt,real,{reduced,aberration:.0012});this.canvas.style.opacity='0';
  const v=new T.Vector3(),out={};for(const n of this.npcs.values())if(n.group.visible){v.set(n.group.position.x,n.group.position.y+1.95,n.group.position.z).project(this.camera);out[n.slot]={x:(v.x+1)*50,y:(1-v.y)*50};}
  v.set(this.player.position.x,2.1,this.player.position.z).project(this.camera);out.player={x:(v.x+1)*50,y:(1-v.y)*50};this.anchors=out;return true;}
 fail(){if(this.dead)return;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;for(const n of this.npcs.values())n.asset.dispose();for(const w of this.walkers)w.asset.dispose();this.ready=false;this.canvas.style.opacity='';this.view?.remove();this.stage?.dispose();}
}
