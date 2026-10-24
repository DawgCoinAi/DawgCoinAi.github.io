// Shared night-city art from CC0 Kenney models: buildings with a neon-tinted night palette,
// placed in rings or rows around any 3D game, plus street props. Loaded on demand and cached
// by three-kit, so games that share models download them once.
import {T,loadModel,cloneModel,fitModel} from './three-kit.js';

export const BUILDINGS='abcdefghijklmn'.split('').map(l=>`city/low-detail-building-${l}.glb`).concat(['city/low-detail-building-wide-a.glb','city/low-detail-building-wide-b.glb','city/building-skyscraper-a.glb','city/building-skyscraper-b.glb','city/building-skyscraper-e.glb']);
export const STREET={post:'racing/lightPostModern.glb',billboard:'racing/billboard.glb',signal:'roads/traffic-light.glb',lamp:'roads/light-square.glb',cone:'roads/construction-cone.glb'};
export const TRAFFIC=['cars/sedan.glb','cars/taxi.glb','cars/police.glb','cars/van.glb','cars/hatchback-sports.glb','cars/delivery.glb'];

export const loadBuildings=()=>Promise.all(BUILDINGS.map(p=>loadModel(p).catch(()=>null))).then(a=>a.filter(Boolean));
export async function loadSet(map){const entries=await Promise.all(Object.entries(map).map(async([k,p])=>[k,await loadModel(p).catch(()=>null)]));return Object.fromEntries(entries);}

// Night palette: darken the daytime colors and let the light cells (windows) glow in a neon
// tint. Materials are shared by every copy of a model, so this runs once per model.
const TINTS=[0x6fd8ff,0xff7ad9,0xb9ff5e,0xffc861,0xa58bff];
export function nightify(scene,rnd=Math.random){scene.traverse(o=>{if(!o.isMesh||o.material.userData.night)return;const m=o.material;m.userData.night=true;m.color.multiplyScalar(.16);m.emissive=new T.Color(TINTS[Math.floor(rnd()*TINTS.length)]);m.emissiveMap=m.map;m.emissiveIntensity=.22;m.envMapIntensity=.2;m.roughness=.6;});return scene;}
// One building at (x, z), scaled to a height, turned to face `facing` radians.
export function building(buildings,rnd,{x,z,height,facing=0}){const src=nightify(buildings[Math.floor(rnd()*buildings.length)],rnd),b=fitModel(cloneModel(src),height),h=new T.Group();h.add(b);h.position.set(x,0,z);h.rotation.y=facing+(rnd()-.5)*.3;return h;}
// Buildings in a ring around a centre, facing inward; `clear(x, z)` returns false where none may stand.
export function cityRing(buildings,rnd,{cx=0,cz=0,radius,spread=12,count,minH=10,maxH=30,clear=()=>true}){const g=new T.Group();if(!buildings.length)return g;
 for(let i=0;i<count;i++){const a=i/count*Math.PI*2+rnd()*.2,r=radius+rnd()*spread,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(!clear(x,z))continue;g.add(building(buildings,rnd,{x,z,height:minH+rnd()*(maxH-minH),facing:Math.atan2(cx-x,cz-z)}));}return g;}
// A street prop at a position, fitted to a size.
export function prop(scene,{x,y=0,z,size,facing=0}){const p=fitModel(cloneModel(scene),size),h=new T.Group();h.add(p);h.position.set(x,y,z);h.rotation.y=facing;return h;}
