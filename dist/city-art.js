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

// ── Street Hustle's coastal city: skies per district, palms, sun-or-neon buildings, wet roads.
// Shared by the district street (scene-3d.js) and the drive between districts (hustle-drive-3d.js).
// night: neon-lit windows and bright lamps; day looks keep the models' own colors in warm light.
export const SKIES={
 sunset:{top:0x2a1a58,horizon:0xff6a3d,glow:0xffa25a,sun:0xffd08a,fog:0x8a4a5a,fogDensity:.006,hemi:[0xffd2b0,0x40284a,1.35],key:[0xffb070,1.9],water:0x24467a,lamps:.55,night:false,ground:0x3a3140,sand:0xd2a274},
 neon:{top:0x05040f,horizon:0x4a1660,glow:0xff4fc0,sun:0xff7ad9,fog:0x1a0c2a,fogDensity:.012,hemi:[0x9a8cff,0x1a1028,1.05],key:[0xc8a8ff,.8],water:0x0c1430,lamps:1.2,night:true,ground:0x1b1824,sand:0x5a4a5e},
 harbor:{top:0x15233a,horizon:0x6a86a2,glow:0xb4dcff,sun:0xdcecff,fog:0x52627a,fogDensity:.009,hemi:[0xc4d6ee,0x2a3040,1.2],key:[0xc8dcff,1.1],water:0x1c3450,lamps:.9,night:false,ground:0x2c3138,sand:0x8a8478},
 golden:{top:0x3a5aa0,horizon:0xffb45a,glow:0xffd27a,sun:0xfff2c0,fog:0xb08a72,fogDensity:.004,hemi:[0xfff0d8,0x5a4838,1.6],key:[0xffd8a0,2.3],water:0x2c5a96,lamps:.3,night:false,ground:0x4a4040,sand:0xe2b886},
 midnight:{top:0x020309,horizon:0x16204a,glow:0x5ee7ff,sun:0xbcd0ff,fog:0x070a18,fogDensity:.014,hemi:[0x7a8cff,0x0c0a18,.9],key:[0x9fb8ff,.6],water:0x0a1226,lamps:1.3,night:true,ground:0x15151e,sand:0x3a3644}
};
// Original storefront signs for the strip (dog-town puns, no real brands).
export const STORE_SIGNS=[['BONE ZONE','#ff5fc8'],['TAILWAG MOTEL','#5ee7ff'],['SUNDOG SURF','#ffc861'],['KIBBLE KING','#b9ff5e'],['FETCH CLUB','#c78bff'],['HOWL BAR','#ff7a59'],['RUFF HOUSE','#ffe45e'],['PAWN & PAW','#5effc1'],['GOOD BOY GYM','#ff9ad5'],['MUTT MART','#8eeaff']];
const styled=new Map();
// A styled copy of each building model with its own materials, cached per look ('day' or 'night').
export function styledBuildings(buildings,mode='day'){let cache=styled.get(mode);if(!cache){cache=new Map();styled.set(mode,cache);}
 return buildings.map((src,i)=>{if(cache.has(src))return cache.get(src);const c=cloneModel(src,{ownMaterials:true});c.traverse(o=>{if(!o.isMesh)return;const m=o.material;
  if(mode==='night'){m.color.multiplyScalar(.2);m.emissive=new T.Color(TINTS[i%TINTS.length]);m.emissiveMap=m.map;m.emissiveIntensity=.13;m.envMapIntensity=.3;m.roughness=.55;}
  else{m.color.multiplyScalar(.92);m.emissive=new T.Color(0xffc890);m.emissiveMap=m.map;m.emissiveIntensity=.05;m.envMapIntensity=.55;m.roughness=.62;}});cache.set(src,c);return c;});}
// Canvas textures (kept here: three-kit is shared with other games).
function paint(w,h,draw,{repeat=false}={}){const el=document.createElement('canvas');el.width=w;el.height=h;draw(el.getContext('2d'),w,h);const t=new T.CanvasTexture(el);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
const noise=seed=>{let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
// Four-lane boulevard asphalt: double yellow in the middle, dashed lane lines, solid edges.
// Across the texture is the road's width (14 m); one tile runs 16 m along it.
export function roadTexture(){const r=noise(7);return paint(256,512,(c,w,h)=>{c.fillStyle='#2c2a33';c.fillRect(0,0,w,h);for(let i=0;i<2600;i++){const v=40+r()*40|0;c.fillStyle=`rgba(${v},${v},${v+8},.35)`;c.fillRect(r()*w,r()*h,2,2);}
 for(let i=0;i<6;i++){c.fillStyle='rgba(10,10,16,.35)';c.beginPath();c.ellipse(r()*w,r()*h,10+r()*30,20+r()*60,0,0,7);c.fill();}
 const x=d=>(d/14+.5)*w;c.fillStyle='#ffd34a';c.fillRect(x(-.18)-2,0,4,h);c.fillRect(x(.18)-2,0,4,h);c.fillStyle='#e8e8ee';c.fillRect(x(-6.8)-2,0,4,h);c.fillRect(x(6.8)-2,0,4,h);for(const d of [-3.5,3.5])for(let y=0;y<h;y+=128)c.fillRect(x(d)-2,y,4,64);},{repeat:true});}
// Palm trees: a curved trunk and a crown of drooping fronds, each one merged geometry for instancing.
export function palmParts(){const trunk=[],segs=7;for(let i=0;i<segs;i++){const g=new T.CylinderGeometry(.13-i*.008,.17-i*.008,1.12,7,1,true);g.rotateZ(-.03*i);g.translate(Math.pow(i/segs,2)*.9,.56+i*1.05,0);trunk.push(g);}
 const top=new T.Vector3(.8,segs*1.05,0),fronds=[];for(let i=0;i<9;i++){const g=new T.PlaneGeometry(.95,3.6,1,6),p=g.attributes.position;for(let k=0;k<p.count;k++){const y=p.getY(k)+1.8,t=y/3.6;p.setXYZ(k,p.getX(k)*(1-t*.6),y*.9,-t*t*1.9);}
  g.rotateX(-Math.PI/2+.5);g.rotateY(i/9*Math.PI*2+(i%2)*.2);g.translate(top.x-.05,top.y-.1,top.z);g.computeVertexNormals();fronds.push(g);}
 return {trunk:mergeParts(trunk),fronds:mergeParts(fronds),height:top.y};}
function mergeParts(parts){const out=new T.BufferGeometry();for(const name of ['position','normal','uv']){const arrays=parts.map(g=>(g.index?g.toNonIndexed():g).getAttribute(name).array),size=parts[0].getAttribute(name).itemSize,data=new Float32Array(arrays.reduce((n,a)=>n+a.length,0));let at=0;for(const a of arrays){data.set(a,at);at+=a.length;}out.setAttribute(name,new T.BufferAttribute(data,size));}for(const g of parts)g.dispose();out.computeBoundingSphere();return out;}
export function frondTexture(){return paint(64,256,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#2f5a2a';c.lineWidth=3;c.beginPath();c.moveTo(w/2,h);c.lineTo(w/2,0);c.stroke();for(let y=8;y<h;y+=7){const len=(w/2-2)*Math.sin(Math.PI*y/h)*.95+3;c.strokeStyle=y%14?'#3d7a34':'#4c8c3c';c.lineWidth=3;for(const s of [-1,1]){c.beginPath();c.moveTo(w/2,y);c.lineTo(w/2+s*len,y+10);c.stroke();}}});}
// A grove of palms as two instanced meshes; spots are [x, z, scale, yaw].
export function palmGrove(spots,{dark=false}={}){const parts=palmParts(),g=new T.Group(),n=spots.length;if(!n)return g;
 const trunkMat=new T.MeshStandardMaterial({color:dark?0x2a2026:0x7a5a44,roughness:.9}),frondMat=new T.MeshStandardMaterial({color:dark?0x6a8a70:0xffffff,map:frondTexture(),alphaTest:.45,side:T.DoubleSide,roughness:.8});
 const trunks=new T.InstancedMesh(parts.trunk,trunkMat,n),crowns=new T.InstancedMesh(parts.fronds,frondMat,n),m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),s=new T.Vector3(),p=new T.Vector3();
 spots.forEach(([x,z,scale=1,yaw=0],i)=>{q.setFromEuler(e.set(0,yaw,0));m.compose(p.set(x,0,z),q,s.setScalar(scale));trunks.setMatrixAt(i,m);crowns.setMatrixAt(i,m);});
 trunks.frustumCulled=crowns.frustumCulled=false;g.add(trunks,crowns);g.userData.height=parts.height;return g;}
// A neon storefront sign on a plane, width in metres.
export function storeSign(text,color,width=5){const w=Math.max(320,text.length*58),h=120,t=paint(w,h,c=>{c.fillStyle='#07060dd0';c.beginPath();c.roundRect(4,4,w-8,h-8,16);c.fill();c.lineWidth=5;c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=16;c.stroke();c.font='900 70px system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineWidth=6;c.strokeStyle=color;c.shadowBlur=22;c.strokeText(text,w/2,h/2+3);c.shadowBlur=4;c.fillStyle='#fff6fb';c.fillText(text,w/2,h/2+3);});
 return new T.Mesh(new T.PlaneGeometry(width,width*h/w),new T.MeshBasicMaterial({map:t,transparent:true,toneMapped:false,color:new T.Color(1.6,1.6,1.6),side:T.DoubleSide,depthWrite:false}));}
// A far-shore skyline painted on a cylinder band around the whole scene.
export function skylineBand(radius,height,tint='#ffb36b'){const r=noise(91),t=paint(2048,256,(c,w,h)=>{c.clearRect(0,0,w,h);let x=0;
  while(x<w){const bw=18+r()*60,bh=24+r()*170*(.4+.6*Math.abs(Math.sin(x/w*Math.PI*3)));c.fillStyle='#140f22';c.fillRect(x,h-bh,bw,bh);if(r()>.7)c.fillRect(x+bw/2-1,h-bh-22,3,22);for(let y=h-bh+6;y<h-4;y+=8)for(let k=3;k<bw-3;k+=7)if(r()>.8){c.fillStyle=r()>.5?tint:'#8eeaff';c.globalAlpha=.55;c.fillRect(x+k,y,3,3);c.globalAlpha=1;}x+=bw+r()*5;}},{repeat:true});t.repeat.set(3,1);
 const m=new T.Mesh(new T.CylinderGeometry(radius,radius,height,64,1,true),new T.MeshBasicMaterial({map:t,transparent:true,side:T.BackSide,depthWrite:false,fog:false,toneMapped:false}));m.position.y=height/2-2;return m;}
// A soft glow texture (radial) for sun discs, lamps and light points.
export function glowTexture(){return paint(128,128,(c,w)=>{const g=c.createRadialGradient(64,64,0,64,64,64);for(const [at,col] of [[0,'#ffffff'],[.22,'#ffffffcc'],[.5,'#ffffff33'],[1,'#ffffff00']])g.addColorStop(at,col);c.fillStyle=g;c.fillRect(0,0,w,w);});}
// A styled building (from styledBuildings) at (x, z), fitted to a height and turned to `facing`.
export function fitBuilding(src,{x,z,height,facing=0}){const b=fitModel(cloneModel(src),height),h=new T.Group();h.add(b);h.position.set(x,0,z);h.rotation.y=facing;return h;}
