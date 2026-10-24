// Shared, renderer-independent Three.js character asset. No gameplay randomness.
import * as T from './vendor/three.js';
import {buildDawgModel} from './dawg-model.js';
import {weavePixels,embedWeaveMap} from './dawg-normal-map.js';
import {levelOf} from './dawg-career.js';
import {lookOf,lookHash} from './dawg-fashion.js';
export const GRAPHICS_VERSION=2;
export const assetKey=d=>`${GRAPHICS_VERSION}:${d.id}:${d.genome?.version||1}:${lookHash(d)}:${levelOf(d)>=25?2:levelOf(d)>=10?1:0}`;
const color=rgb=>new T.Color().setRGB(...rgb.slice(0,3),T.SRGBColorSpace);
function fabricTexture(){
 const size=64,data=weavePixels(size);
 const tex=new T.DataTexture(data,size,size,T.RGBAFormat);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(5,5);tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.generateMipmaps=true;tex.anisotropy=2;tex.needsUpdate=true;return tex;
}
function material(m,weave){
 const coat=/Coat|Muzzle/.test(m.name),cloth=/Outfit|Footwear|Accent/.test(m.name),eye=/Eye cream|Ink|Nose/.test(m.name);
 const out=new T.MeshPhysicalMaterial({name:m.name,color:color(m.color),metalness:m.metallic,roughness:coat?.87:m.roughness,transparent:m.color[3]<1,opacity:m.color[3],clearcoat:eye?.7:cloth&&m.roughness<.4?.5:0,clearcoatRoughness:eye?.13:.32,sheen:cloth&&m.metallic<.5?.5:coat?.15:0,sheenColor:color(m.color),sheenRoughness:.8});
 if(cloth&&m.metallic<.5){out.normalMap=weave;out.normalScale.set(.16,.16);}
 if(m.emissive){out.emissive=color(m.emissive);out.emissiveIntensity=1.3;}
 return out;
}
function smoothGeometry(type){
 if(type==='sphere')return new T.SphereGeometry(1,24,18);
 if(type==='box')return new T.RoundedBoxGeometry(2,2,2,2,.11);
 if(type==='cylinder')return new T.CylinderGeometry(1,1,2,24);
 if(type==='cone')return new T.ConeGeometry(1,2,24);
 if(type==='torus')return new T.TorusGeometry(1,.12,10,40);
 throw Error('Unknown DAWG mesh: '+type);
}
function prepareTangents(g){
 if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
 g.computeTangents();const t=g.attributes.tangent,n=g.attributes.normal;
 for(let i=0;i<t.count;i++){const v=new T.Vector3(t.getX(i),t.getY(i),t.getZ(i));if(!Number.isFinite(v.lengthSq())||v.lengthSq()<.1){const normal=new T.Vector3().fromBufferAttribute(n,i);v.crossVectors(Math.abs(normal.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0),normal).normalize();}else v.normalize();t.setXYZW(i,v.x,v.y,v.z,t.getW(i)<0?-1:1);}
}
export function createDawgAsset(d){
 const source=buildDawgModel(d),root=new T.Group();root.name='DAWG_Character';root.userData={...source.extras,graphicsVersion:GRAPHICS_VERSION,rig:'shared skeleton; weighted torso, sleeves and trousers; rigid accessories'};
 const weave=fabricTexture(),materials=source.materials.map(m=>material(m,weave)),geometries=new Map(),objects=source.nodes.map(n=>{const o=n.geometry?new T.Mesh(geometries.get(n.geometry)||(()=>{const g=smoothGeometry(n.geometry);prepareTangents(g);geometries.set(n.geometry,g);return g;})(),materials[n.material]):new T.Bone();o.name=T.PropertyBinding.sanitizeNodeName(n.name).replace(/\s+/g,'_');o.position.fromArray(n.translation);o.quaternion.fromArray(n.rotation);o.scale.fromArray(n.scale);if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}return o;});
 source.nodes.forEach((n,i)=>(n.parent===null?root:objects[n.parent]).add(objects[i]));
 const byName=raw=>objects[source.nodes.findIndex(n=>n.name===raw)],body=byName('Body / idle pivot'),head=byName('Head / look pivot');
 const spine=new T.Bone();spine.name='Spine';spine.position.y=.18;body.add(spine);head.position.y-=.18;spine.add(head);
 const limbs=[];
 for(const side of ['Left','Right'])for(const kind of ['arm','leg']){
  const upper=byName(side+' '+kind+' / swing'),lower=new T.Bone();lower.name=side+(kind==='arm'?'_Elbow':'_Knee');lower.position.y=-.18;upper.add(lower);
  if(kind==='arm'){upper.position.y-=.18;spine.add(upper);}
  // The extremities follow the new elbow/knee; the garment flexes across both bones.
  for(const child of [...upper.children])if(child.isMesh&&(kind==='arm'?/paw/.test(child.name):/shoe|sole|lace|sock|cuff|hover/.test(child.name))){child.position.y+=.18;lower.add(child);}
  limbs.push({upper,lower,kind,side});
 }
 const bones=[];root.traverse(o=>{if(o.isBone)bones.push(o);});root.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones),skins=[];
 const skin=(mesh,a,b,invert=false)=>{const geom=mesh.geometry.clone(),p=geom.getAttribute('position'),indices=[],weights=[];
  for(let i=0;i<p.count;i++){const v=T.MathUtils.smoothstep(p.getY(i),-.65,.7),w=invert?1-v:v*.72;indices.push(w===1?0:bones.indexOf(a),w===0?0:bones.indexOf(b),0,0);weights.push(1-w,w,0,0);}
  geom.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geom.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geom.applyMatrix4(mesh.matrixWorld);const skinned=new T.SkinnedMesh(geom,mesh.material);skinned.name=mesh.name;skinned.castShadow=skinned.receiveShadow=true;root.add(skinned);mesh.removeFromParent();root.updateMatrixWorld(true);skinned.bind(skeleton,new T.Matrix4());skins.push(skinned);return skinned;
 };
 skin(byName('Jacket torso'),body,spine);
 for(const limb of limbs)skin(byName(limb.side+(limb.kind==='arm'?' sleeve':' trousers')),limb.upper,limb.lower,true);
 // Small fitted details read at sprite size and distinguish shoes from bare primitives.
 const buttonMaterial=materials.find(m=>m.name==='Gold hardware'),buttonGeo=new T.SphereGeometry(1,10,8);
 for(let i=0;i<4;i++){const button=new T.Mesh(buttonGeo,buttonMaterial);button.name='Jacket_snap_'+i;button.scale.set(.016,.016,.008);button.position.set(-.033,.23-i*.08,.19);body.add(button);}
 const base=new Map();root.traverse(o=>{if(o.isBone)base.set(o,{p:o.position.clone(),q:o.quaternion.clone()});});
 const asset={root,source,bones,skeleton,skins,body,head,spine,limbs,base,look:lookOf(d),key:assetKey(d)};
 asset.clips=['Idle','Walk','Run'].map(name=>animationClip(asset,name));setDawgPose(asset,0,'still');
 asset.dispose=()=>{const gs=new Set(),ms=new Set(),ts=new Set([weave]);root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});for(const g of geometries.values())gs.add(g);for(const g of gs)g.dispose();for(const m of materials)ms.add(m);for(const m of ms)m.dispose();for(const t of ts)t.dispose();skeleton.dispose();root.clear();};
 return asset;
}
const rotation=new T.Quaternion(),euler=new T.Euler();
function offset(asset,bone,x=0,y=0,z=0){rotation.setFromEuler(euler.set(x,y,z));bone.quaternion.copy(asset.base.get(bone).q).multiply(rotation);}
export function setDawgPose(a,time,kind='idle'){
 for(const [bone,b]of a.base){bone.position.copy(b.p);bone.quaternion.copy(b.q);}
 if(kind!=='still'){
  const moving=kind==='walk'||kind==='run',run=kind==='run',phase=time*(run?13:7.8),stride=moving?(run?.64:.38):0;
  a.body.position.y+=moving?Math.abs(Math.sin(phase))*(run?.04:.018):Math.sin(time*2.1)*.009;
  offset(a,a.spine,moving?-.05:Math.sin(time*1.8)*.014,Math.sin(moving?phase:time*.7)*(moving?.035:.025));
  offset(a,a.head,moving?.035:Math.sin(time*1.1)*.018,Math.sin(time*.9)*.035,Math.sin(time*1.4)*.018);
  for(const l of a.limbs){const sign=l.side==='Left'?1:-1,swing=Math.sin(phase)*stride*sign*(l.kind==='arm'?-1:1);offset(a,l.upper,swing,0,0);offset(a,l.lower,l.kind==='arm'?(run?-.48:-.12):moving?Math.max(0,-Math.sin(phase)*sign)*stride*.85:0);}
 }
 a.root.updateMatrixWorld(true);a.skeleton.update();
}
function animationClip(a,name){const duration=name==='Idle'?Math.PI*2/2.1:name==='Walk'?Math.PI*2/7.8:Math.PI*2/13,count=24,times=Array.from({length:count+1},(_,i)=>i/count*duration),tracks=[],values=new Map(a.bones.map(b=>[b,[]]));const body=[];
 for(const t of times){setDawgPose(a,t,name.toLowerCase());for(const b of a.bones)values.get(b).push(...b.quaternion.toArray());body.push(...a.body.position.toArray());}
 for(const [bone,v]of values){v.splice(v.length-4,4,...v.slice(0,4));}body.splice(body.length-3,3,...body.slice(0,3));
 for(const [bone,v]of values)tracks.push(new T.QuaternionKeyframeTrack(bone.name+'.quaternion',times,v));tracks.push(new T.VectorKeyframeTrack(a.body.name+'.position',times,body));return new T.AnimationClip(name,duration,tracks);
}
export async function exportModernGLB(d){
 const a=createDawgAsset(d),scene=new T.Scene();scene.name=a.root.name;scene.userData=a.root.userData;
 try{a.root.traverse(o=>{if(o.material)o.material.normalMap=null;});for(const child of [...a.root.children])scene.add(child);const bytes=new Uint8Array(await new T.GLTFExporter().parseAsync(scene,{binary:true,animations:a.clips,onlyVisible:true}));return await embedWeaveMap(bytes);}
 finally{for(const child of [...scene.children])a.root.add(child);a.dispose();}
}

export {T};
