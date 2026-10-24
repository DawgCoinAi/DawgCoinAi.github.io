// Drift Dawgs art built from CC0 models (Kenney Car, Racing and City kits): karts with spinning
// wheels and a 3D DAWG at the wheel, barriers, light posts, grandstands, a start gantry and a
// city around the circuit. kart-3d.js shows its built-in karts until this has loaded.
import {T,loadModel,cloneModel,fitModel} from './three-kit.js';
import {createDawgAsset} from './dawg-graphics-model.js';
import {KART,trackAt,trackPoint} from './kart-engine.js';
import {seededRandom} from './mobile-core.js';

export const KARTS=['cars/kart-oozi.glb','cars/kart-oobi.glb','cars/kart-oodi.glb','cars/kart-ooli.glb','cars/kart-oopi.glb'];
export const BUILDINGS='abcdefghijklmn'.split('').map(l=>`city/low-detail-building-${l}.glb`).concat(['city/low-detail-building-wide-a.glb','city/low-detail-building-wide-b.glb','city/building-skyscraper-a.glb','city/building-skyscraper-b.glb','city/building-skyscraper-e.glb']);
export const PROPS={barrierRed:'racing/barrierRed.glb',barrierWhite:'racing/barrierWhite.glb',post:'racing/lightPostModern.glb',stand:'racing/grandStandCovered.glb',gantry:'racing/overheadLights.glb',flag:'racing/flagCheckers.glb',billboard:'racing/billboard.glb'};
const KART_LENGTH=2.3;

export async function loadKartArt(){const [karts,buildings,props]=await Promise.all([Promise.all(KARTS.map(loadModel)),Promise.all(BUILDINGS.map(p=>loadModel(p).catch(()=>null))),Promise.all(Object.entries(PROPS).map(async([k,p])=>[k,await loadModel(p).catch(()=>null)]))]);
 return {karts,buildings:buildings.filter(Boolean),props:Object.fromEntries(props)};}

// A kart facing +x (the renderer's forward), its wheels, and a seat where the driver sits.
// Kenney karts face +z with a placeholder "character" node; that becomes the DAWG.
export function kartRig(scene,{dawg=null,reduced=false}={}){const model=cloneModel(scene,{ownMaterials:true});model.rotation.y=Math.PI/2;
 const holder=new T.Group();holder.add(model);fitModel(holder,KART_LENGTH);const rig=new T.Group();rig.add(holder);
 const wheels=[];let seat=null;model.traverse(o=>{if(/^wheel-/.test(o.name))wheels.push({node:o,front:/front/.test(o.name)});if(o.name==='character')seat=o;});
 model.traverse(o=>{if(o.isMesh){o.material.metalness=.12;o.material.roughness=.55;o.material.envMapIntensity=.55;}});
 let driver=null;if(seat&&dawg){try{holder.updateMatrixWorld(true);const box=new T.Box3().setFromObject(seat),size=box.getSize(new T.Vector3()),centre=box.getCenter(new T.Vector3());seat.visible=false;
   driver=createDawgAsset(dawg);const root=driver.root,b=new T.Box3().setFromObject(root),h=b.getSize(new T.Vector3()).y||1;root.scale.multiplyScalar(KART_LENGTH*.46/h);
   root.rotation.y=Math.PI/2;root.updateMatrixWorld(true);const b2=new T.Box3().setFromObject(root);root.position.set(centre.x-(b2.min.x+b2.max.x)/2,box.min.y-b2.min.y-size.y*.08,centre.z-(b2.min.z+b2.max.z)/2);root.rotation.y=Math.PI/2;rig.add(root);}catch{driver=null;if(seat)seat.visible=true;}}
 return {root:rig,wheels,driver};}

// Instanced copies of a single-mesh prop (barriers): geometry and material shared, one draw call.
function instanced(scene,count){let mesh=null;scene.traverse(o=>{if(!mesh&&o.isMesh)mesh=o;});if(!mesh)return null;const geo=mesh.geometry.clone();mesh.updateWorldMatrix(true,false);geo.applyMatrix4(mesh.matrixWorld);const im=new T.InstancedMesh(geo,mesh.material,count);im.frustumCulled=false;return im;}
// Night city: darken the daytime palette and let its light cells (the windows) glow in a neon
// tint. Materials are shared by every copy of a building, so this runs once per model.
const TINTS=[0x6fd8ff,0xff7ad9,0xb9ff5e,0xffc861,0xa58bff];
function nightify(scene,rnd){scene.traverse(o=>{if(!o.isMesh||o.material.userData.night)return;const m=o.material;m.userData.night=true;m.color.multiplyScalar(.16);m.emissive=new T.Color(TINTS[Math.floor(rnd()*TINTS.length)]);m.emissiveMap=m.map;m.emissiveIntensity=.22;m.envMapIntensity=.2;m.roughness=.6;});return scene;}
const outwardSign=(t,s)=>{const q=trackAt(t,s);return (-Math.sin(q.ang)*q.x+Math.cos(q.ang)*q.y)>0?1:-1;};
function farFromTrack(t,x,y,min){for(let i=0;i<t.pts.length;i+=3){const p=t.pts[i];if((p[0]-x)**2+(p[1]-y)**2<min*min)return false;}return true;}

// Dress a circuit: barriers along both walls, light posts, the start gantry and grandstand,
// billboards on the straights and a city outside. Deterministic for the track seed.
export function dressTrack(t,art,{quality='high'}={}){const g=new T.Group(),rnd=seededRandom((t.seed^0xc17e)>>>0),dummy=new T.Object3D(),place=(obj,s,d,face=0,y=0)=>{const p=trackPoint(t,s,d);obj.position.set(p.x,y,-p.y);obj.rotation.y=p.ang+face;return obj;};
 const W=KART.wall;
 // Barriers: alternating red and white, two metres apart, just inside the walls.
 const step=2.2,n=Math.floor(t.len/step);for(const [name,odd] of [['barrierRed',0],['barrierWhite',1]]){const src=art.props[name];if(!src)continue;const im=instanced(fitModel(cloneModel(src),1),n);if(!im)continue;const box=new T.Box3().setFromBufferAttribute(im.geometry.attributes.position),len=Math.max(box.max.x-box.min.x,box.max.z-box.min.z)||1,alongX=box.max.x-box.min.x>=box.max.z-box.min.z;let k=0;
  for(let i=odd;i<n;i+=2)for(const side of [1,-1]){if(k>=n)break;const p=trackPoint(t,i*step,side*(W-.15));dummy.position.set(p.x,0,-p.y);dummy.rotation.set(0,p.ang+(alongX?0:Math.PI/2),0);dummy.scale.setScalar(step/len*.98);dummy.updateMatrix();im.setMatrixAt(k++,dummy.matrix);}im.count=k;im.instanceMatrix.needsUpdate=true;g.add(im);}
 // Light posts with a warm glow, alternating sides every 30 m.
 const glowTex=art.glowTex;if(art.props.post)for(let s=15,i=0;s<t.len-10;s+=30,i++){const side=i%2?1:-1,post=fitModel(cloneModel(art.props.post),7);const holder=new T.Group();holder.add(post);place(holder,s,side*(W+1.4),side>0?Math.PI:0);g.add(holder);
  if(glowTex){const sp=new T.Sprite(new T.SpriteMaterial({map:glowTex,color:new T.Color(1.2,1,.75),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));const p=trackPoint(t,s,side*(W-.6));sp.position.set(p.x,6.6,-p.y);sp.scale.set(2.8,2.8,1);g.add(sp);}}
 // Start: gantry over the line, flags either side, a covered grandstand on the outside.
 const out=outwardSign(t,0);if(art.props.gantry){const gantry=fitModel(cloneModel(art.props.gantry),W*2+2);const h=new T.Group();h.add(gantry);place(h,-1,0,Math.PI/2);g.add(h);}
 if(art.props.flag)for(const side of [1,-1]){const f=fitModel(cloneModel(art.props.flag),3.2);const h=new T.Group();h.add(f);place(h,2,side*(W+.6),0);g.add(h);}
 if(art.props.stand)for(const s of [-34,6,46]){const st=fitModel(cloneModel(art.props.stand),16);const h=new T.Group();h.add(st);place(h,s,out*(W+9),out>0?Math.PI:0);g.add(h);}
 // Billboards on the two straightest stretches, on the outside.
 if(art.props.billboard)for(const pad of t.pads){const s=(pad.s+40)%t.len,o=outwardSign(t,s),b=fitModel(cloneModel(art.props.billboard),9);const h=new T.Group();h.add(b);place(h,s,o*(W+5),o>0?Math.PI:0);g.add(h);}
 // City: buildings in rings outside the barriers, never on the road.
 const rings=quality==='high'?[[W+16,24],[W+38,34],[W+70,44]]:[[W+18,30],[W+48,52]];
 if(art.buildings.length)for(const [d,spacing] of rings)for(let s=rnd()*spacing;s<t.len;s+=spacing*(.75+rnd()*.5))for(const side of [1,-1]){const off=d+rnd()*10,p=trackPoint(t,s,side*off);if(!farFromTrack(t,p.x,p.y,W+10))continue;
  const src=nightify(art.buildings[Math.floor(rnd()*art.buildings.length)],rnd),tall=/skyscraper/.test(src.name||'')||rnd()<.2,b=fitModel(cloneModel(src),tall?26+rnd()*20:10+rnd()*12);const h=new T.Group();h.add(b);h.position.set(p.x,0,-p.y);h.rotation.y=p.ang+(side>0?Math.PI:0)+(rnd()-.5)*.3;g.add(h);}
 return g;}
