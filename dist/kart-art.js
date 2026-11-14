// Drift Dawgs art. Three themed circuits are built here from the engine's track data: the road
// and its furniture (kerbs, sponsor walls, tunnel, ramp, start gantry, stands with a crowd) and
// a world around it (a sunset harbour, a rainy neon district, a deck above the clouds). The karts
// are CC0 models (Kenney Car kit) with a 3D DAWG at the wheel. Nothing here knows the rules.
import {T,texture,radial,glowStops,merge,lightShaft,skylineTexture,facadeMaterials,buildingShells,signMaterials,loadModel,cloneModel,fitModel} from './three-kit.js';
import {createDawgAsset} from './dawg-graphics-model.js';
import {KART,trackAt,trackPoint,trackHeight,wallAt} from './kart-engine.js';
import {seededRandom} from './mobile-core.js';
import {hash} from './world.js';

export const KARTS=['cars/kart-oozi.glb','cars/kart-oobi.glb','cars/kart-oodi.glb','cars/kart-ooli.glb','cars/kart-oopi.glb'];
const KART_LENGTH=2.3;
export async function loadKartArt(){return {karts:await Promise.all(KARTS.map(loadModel))};}

// A kart facing +x (the renderer's forward), its wheels, and a seat where the driver sits.
// Kenney karts face +z with a placeholder "character" node; that becomes the DAWG. The paint is
// glossed up and pulled toward the driver's colour so six karts read as six racers.
export function kartRig(scene,{dawg=null,color=null}={}){const model=cloneModel(scene,{ownMaterials:true});model.rotation.y=Math.PI/2;
 const holder=new T.Group();holder.add(model);fitModel(holder,KART_LENGTH);const rig=new T.Group(),body=new T.Group();body.add(holder);rig.add(body);
 const wheels=[];let seat=null;model.traverse(o=>{if(/^wheel-/.test(o.name))wheels.push({node:o,front:/front/.test(o.name)});if(o.name==='character')seat=o;});
 const tint=color?new T.Color(color):null;model.traverse(o=>{if(o.isMesh){const m=o.material;m.metalness=.35;m.roughness=.28;m.envMapIntensity=1.15;if(tint&&!/^wheel-/.test(o.name)&&o!==seat){m.color.lerp(tint,.38);m.emissive=tint.clone();m.emissiveIntensity=.07;}}});
 let driver=null;if(seat&&dawg){try{holder.updateMatrixWorld(true);const box=new T.Box3().setFromObject(seat),size=box.getSize(new T.Vector3()),centre=box.getCenter(new T.Vector3());seat.visible=false;
   driver=createDawgAsset(dawg);const root=driver.root,b=new T.Box3().setFromObject(root),h=b.getSize(new T.Vector3()).y||1;root.scale.multiplyScalar(KART_LENGTH*.46/h);
   root.rotation.y=Math.PI/2;root.updateMatrixWorld(true);const b2=new T.Box3().setFromObject(root);const lean=new T.Group();lean.position.set(centre.x,box.min.y-size.y*.08,centre.z);root.position.set(-(b2.min.x+b2.max.x)/2+0,-b2.min.y,-(b2.min.z+b2.max.z)/2);lean.add(root);body.add(lean);driver.lean=lean;}catch{driver=null;if(seat)seat.visible=true;}}
 return {root:rig,body,wheels,driver,seat};}

// ── Looks: sky, light and mood per circuit family.
export const LOOKS={
 harbour:{top:0x243a7a,horizon:0xff9052,glow:0xffc070,fog:0xd98a66,fogD:.0025,sun:0xffb47a,sunI:2.6,sunDir:[-.75,.32,-.5],hemi:[0xffd2a8,0x35304a,1.25],exposure:1.02,accent:0xffa23e,rail:0xfff0d0,kerb:['#ff5136','#fff3df'],road:'#514d55',base:-2.6,night:false,sat:1.12,warm:1},
 neon:{top:0x02030a,horizon:0x24104e,glow:0xff2f9a,fog:0x150a2c,fogD:.0052,sun:0xa8b8ff,sunI:1.5,sunDir:[.5,.8,.3],hemi:[0x8c9cff,0x2a1440,1.25],exposure:1.08,accent:0xff3fa8,rail:0x4be3ff,kerb:['#ff2f8a','#e9f6ff'],road:'#2c2e44',base:-.12,night:true,sat:1.18,warm:0},
 skyway:{top:0x0f3fb8,horizon:0x9fd6ff,glow:0xffffff,fog:0xa9d2ff,fogD:.0017,sun:0xfff4de,sunI:3,sunDir:[.45,.62,.5],hemi:[0xcfe6ff,0x6a7fa8,1.5],exposure:.98,accent:0x2f8bff,rail:0xffffff,kerb:['#2f7bff','#ffffff'],road:'#5a5f6c',base:null,night:false,sat:1.1,warm:.4}};
// Original dog-town sponsors for the boards and banners.
export const BRANDS=[['BARKLEY TYRES','#ffd23e','#17171d'],['ZOOMIES ENERGY','#ff3f86','#ffffff'],['KIBBLE KING','#ff8a2b','#2a1206'],['FETCH FM 99.5','#39d5f5','#06202e'],['TAILWIND OILS','#b9ff5e','#10220a'],['MUTT MOTORS','#b98cff','#170a2c'],['HOWL COLA','#f23838','#ffffff'],['GOOD BOY GARAGE','#f4f6ff','#1c2c62']];

const speckle=(c,w,h,n,seed,light=.06,dark=.12,size=2)=>{for(let i=0;i<n;i++){c.fillStyle=hash(seed,i)>.5?`rgba(255,255,255,${(hash(seed+1,i)*light).toFixed(3)})`:`rgba(0,0,0,${(hash(seed+1,i)*dark).toFixed(3)})`;c.fillRect(hash(seed+2,i)*w,hash(seed+3,i)*h,size,size);}};
// Asphalt, 11 m wide by 24 m long: aggregate, patched seams, a rubbered-in racing line and tyre
// streaks, edge lines and a broken centre line.
const asphaltTex=(base,wet)=>texture(512,1024,(c,w,h)=>{c.fillStyle=base;c.fillRect(0,0,w,h);speckle(c,w,h,16000,41,.09,.2);
 for(let i=0;i<7;i++){c.fillStyle=`rgba(0,0,0,${.05+hash(51,i)*.08})`;c.fillRect(hash(52,i)*w,hash(53,i)*h,40+hash(54,i)*120,30+hash(55,i)*90);}
 for(const [x0,amp,wd,a]of [[w*.5,70,150,.2],[w*.5,70,70,.22]]){c.strokeStyle=`rgba(8,8,12,${a})`;c.lineWidth=wd;c.beginPath();for(let y=-20;y<=h+20;y+=16){const x=x0+Math.sin(y/h*Math.PI*2)*amp;y<0?c.moveTo(x,y):c.lineTo(x,y);}c.stroke();}
 for(let i=0;i<26;i++){const x=60+hash(61,i)*(w-120),y=hash(62,i)*h,l=60+hash(63,i)*220;c.strokeStyle=`rgba(0,0,0,${.12+hash(64,i)*.2})`;c.lineWidth=5+hash(65,i)*5;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+20,y+l*.3,x-20,y+l*.6,x+hash(66,i)*40-20,y+l);c.stroke();}
 c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=1.5;for(let i=0;i<9;i++){c.beginPath();let x=hash(71,i)*w,y=hash(72,i)*h;c.moveTo(x,y);for(let k=0;k<6;k++){x+=(hash(73,i*9+k)-.5)*50;y+=hash(74,i*9+k)*40;c.lineTo(x,y);}c.stroke();}
 c.fillStyle='#f2f4fa';c.fillRect(8,0,9,h);c.fillRect(w-17,0,9,h);c.fillStyle=wet?'#ffe45e':'#f6e9b0';for(let y=0;y<h;y+=256)c.fillRect(w/2-4,y,8,120);
 speckle(c,w,h,5000,81,.05,.1,3);},{repeat:true});
const roughTex=()=>texture(256,256,(c,w,h)=>{c.fillStyle='#8a8a8a';c.fillRect(0,0,w,h);for(let i=0;i<30;i++){const x=hash(811,i)*w,y=hash(812,i)*h,r=12+hash(813,i)*40,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#0c0c0c');g.addColorStop(1,'#0c0c0c00');c.fillStyle=g;c.beginPath();c.ellipse(x,y,r,r*.6,hash(815,i)*3,0,7);c.fill();}speckle(c,w,h,3000,816,.1,.1);},{repeat:true,color:false});
const kerbTex=(a,b)=>texture(64,128,(c,w,h)=>{c.fillStyle=b;c.fillRect(0,0,w,h);c.fillStyle=a;c.fillRect(0,0,w,h/2);speckle(c,w,h,500,91,.08,.14);c.fillStyle='rgba(0,0,0,.18)';c.fillRect(0,0,6,h);},{repeat:true});
const checker=()=>texture(128,32,(c,w,h)=>{for(let x=0;x<16;x++)for(let y=0;y<4;y++){c.fillStyle=(x+y)%2?'#ffffff':'#111111';c.fillRect(x*8,y*8,8,8);}},{repeat:true});
const gridTex=()=>texture(256,512,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#ffffff';c.lineWidth=5;c.font='900 30px system-ui,sans-serif';c.textAlign='center';c.fillStyle='#ffffff';
 // 21 m of road ending at the line: kart i sits 4 + 5·row metres back, 2.4 m either side.
 for(let i=0;i<6;i++){const row=Math.floor(i/2),x=((i%2?-2.4:2.4)+5.5)/11*w,v=(((-4-row*5+1.3)/21)%1+1)%1,yy=(1-v)*h;c.beginPath();c.moveTo(x-34,yy+22);c.lineTo(x-34,yy);c.lineTo(x+34,yy);c.lineTo(x+34,yy+22);c.stroke();c.fillText(String(i+1),x,yy+46);}},{repeat:true});
const chevron=col=>texture(128,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle=col;c.lineWidth=18;c.lineCap='round';c.lineJoin='round';for(const y of [8,72]){c.beginPath();c.moveTo(20,y+48);c.lineTo(w/2,y+10);c.lineTo(w-20,y+48);c.stroke();}},{repeat:true});
// Wall, 1.05 m tall by 48 m long, drawn on its side (canvas x is up the wall): stacked tyres in
// the kerb colours with a sponsor board every other bay.
const wallTex=(look,seed)=>texture(128,2048,(c,w,h)=>{const bay=h/8;for(let i=0;i<8;i++){const y=i*bay;if(i%2){const [name,bg,fg]=BRANDS[Math.floor(hash(seed,i)*BRANDS.length)];c.fillStyle=bg;c.fillRect(0,y,w,bay);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(0,y,w,5);c.fillRect(0,y+bay-5,w,5);c.fillRect(0,y,7,bay);c.fillStyle='rgba(255,255,255,.25)';c.fillRect(w-7,y,7,bay);
   c.save();c.translate(w/2,y+bay/2);c.rotate(Math.PI/2);c.font='italic 900 62px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=fg;c.fillText(name,0,4,bay-30);c.restore();}
  else{c.fillStyle='#0d0d12';c.fillRect(0,y,w,bay);for(let r=0;r<3;r++)for(let k=0;k<8;k++){const cx=r*42+22,cy=y+k*32+16+(r%2)*16;c.fillStyle=(k+r+i)%3?'#17171d':(k%2?look.kerb[0]:look.kerb[1]);c.beginPath();c.ellipse(cx,cy,19,15,0,0,7);c.fill();c.fillStyle='#050507';c.beginPath();c.ellipse(cx,cy,9,6,0,0,7);c.fill();c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=2;c.beginPath();c.ellipse(cx,cy,19,15,0,3.4,5.2);c.stroke();}}}},{repeat:true});
const bannerTex=(i,sub)=>texture(1024,160,(c,w,h)=>{const [name,bg,fg]=BRANDS[i%BRANDS.length];c.fillStyle=bg;c.fillRect(0,0,w,h);c.fillStyle='rgba(0,0,0,.18)';for(let x=-h;x<w;x+=64){c.beginPath();c.moveTo(x,h);c.lineTo(x+h*.6,0);c.lineTo(x+h*.6+24,0);c.lineTo(x+24,h);c.fill();}
 c.font='italic 900 96px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=fg;c.fillText(sub||name,w/2,h/2+6,w-80);c.strokeStyle=fg;c.lineWidth=8;c.strokeRect(8,8,w-16,h-16);});
const plainTex=(base,n,seed,l=.08,d=.14)=>texture(256,256,(c,w,h)=>{c.fillStyle=base;c.fillRect(0,0,w,h);speckle(c,w,h,n,seed,l,d,3);},{repeat:true});
const woodTex=()=>texture(256,256,(c,w,h)=>{for(let i=0;i<8;i++){c.fillStyle=['#a9763f','#b98549','#9c6a37','#c08d52'][Math.floor(hash(95,i)*4)];c.fillRect(0,i*32,w,31);c.fillStyle='#3a2410';c.fillRect(0,i*32+31,w,1);c.fillRect(hash(96,i)*w,i*32,2,31);}speckle(c,w,h,2500,97,.08,.16,3);},{repeat:true});
const tunnelTex=(col,dark)=>texture(256,256,(c,w,h)=>{c.fillStyle=dark?'#000':'#1a1c26';c.fillRect(0,0,w,h);if(!dark){speckle(c,w,h,2500,98,.05,.2,3);c.fillStyle='#0b0c12';for(let x=0;x<w;x+=64)c.fillRect(x,0,3,h);c.fillRect(0,h-4,w,4);}c.fillStyle=col;for(const x of [26,118,138,230])c.fillRect(x-5,dark?20:14,10,h-(dark?40:28));if(!dark){c.fillStyle='#ffffff18';c.fillRect(0,0,w,3);}c.fillStyle=col;c.fillRect(0,120,w,dark?10:16);},{repeat:true});
const glassTex=()=>texture(256,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#bfe0ff');g.addColorStop(.5,'#6fa4e8');g.addColorStop(1,'#3f6fc0');c.fillStyle=g;c.fillRect(0,0,w,h);for(let y=0;y<8;y++)for(let x=0;x<8;x++){c.fillStyle=`rgba(255,255,255,${(hash(301,y*8+x)*.28).toFixed(2)})`;c.fillRect(x*32+2,y*32+2,28,28);}c.fillStyle='#e9f2ff';for(let i=0;i<=8;i++){c.fillRect(i*32-1,0,3,h);c.fillRect(0,i*32-1,w,3);}},{repeat:true});
const cloudTex=()=>texture(256,256,(c,w,h)=>{c.clearRect(0,0,w,h);for(let i=0;i<26;i++){const x=40+hash(401,i)*176,y=70+hash(402,i)*116,r=26+hash(403,i)*40,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,7);c.fill();}});
const waveTex=()=>texture(256,256,(c,w,h)=>{c.fillStyle='#8080ff';c.fillRect(0,0,w,h);for(let i=0;i<260;i++){const x=hash(501,i)*w,y=hash(502,i)*h,l=20+hash(503,i)*50;c.strokeStyle=hash(504,i)>.5?'rgba(170,150,255,.5)':'rgba(90,110,255,.5)';c.lineWidth=2+hash(505,i)*3;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+l/2,y+(hash(506,i)-.5)*10,x+l,y);c.stroke();}},{repeat:true,color:false});

// A strip swept along the track. profile(s) returns the cross-section as [d, y] points (y is
// above the road surface there, or absolute with a third truthy entry). Faces wind upward for
// sections listed right to left.
export function sweep(t,profile,{from=0,to=t.len,vScale=8,skip=null,flipV=false,step=t.ds}={}){
 const n=Math.max(1,Math.round((to-from)/step)),pos=[],uv=[],idx=[];let m=0;
 for(let i=0;i<=n;i++){const s=from+(to-from)*i/n,pr=profile(s),q=trackAt(t,s);m=pr.length;
  pr.forEach(([d,y,abs,u],j)=>{pos.push(q.x-Math.sin(q.ang)*d,abs?y:trackHeight(t,s,d)+y,-(q.y+Math.cos(q.ang)*d));uv.push(u??j/(m-1),(flipV?-s:s)/vScale);});
  if(i<n&&!(skip&&skip(s+(to-from)/n/2)))for(let j=0;j<m-1;j++){const a=i*m+j,b=a+m;idx.push(a,b,a+1,a+1,b,b+1);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
const world=(t,s,d=0,y=0)=>{const p=trackPoint(t,s,d);return new T.Vector3(p.x,trackHeight(t,s,d)+y,-p.y);};
// A local frame on the track: x runs along it, y is up, and a sideways offset d is local -z.
const frame=(t,s,d=0)=>{const p=trackPoint(t,s,d);return new T.Matrix4().makeRotationY(p.ang).setPosition(p.x,trackHeight(t,s,d),-p.y);};
const box=(w,h,d,x=0,y=0,z=0)=>new T.BoxGeometry(w,h,d).translate(x,y+h/2,z);
function instances(geo,mat,items){const im=new T.InstancedMesh(geo,mat,Math.max(1,items.length)),o=new T.Object3D(),c=new T.Color();im.count=items.length;items.forEach((it,i)=>{o.position.set(it.x,it.y,it.z);o.rotation.set(it.rx||0,it.ry||0,it.rz||0);o.scale.set(it.sx??it.s??1,it.sy??it.s??1,it.sz??it.s??1);o.updateMatrix();im.setMatrixAt(i,o.matrix);if(it.c!==undefined)im.setColorAt(i,c.set(it.c));});im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;im.frustumCulled=false;return im;}
const clearOf=(t,x,y,min)=>{for(let i=0;i<t.pts.length;i+=3){const p=t.pts[i];if((p[0]-x)**2+(p[1]-y)**2<min*min)return false;}return true;};
const around=(t,a,b)=>{const g=Math.abs(a-b)%t.len;return Math.min(g,t.len-g);};

// Builds the whole circuit. Returns the group plus update(real, dt, camera, game) for everything
// that moves (crowd, water, boats, blimp, rain, the hoop) and the start lights.
export function buildCircuit(t,{quality='high',glowTex}={}){
 const high=quality==='high',look=LOOKS[t.theme]||LOOKS.neon,g=new T.Group(),rnd=seededRandom((t.seed^0xc17e)>>>0),W=KART.width/2,j=t.jump,G0=j.s,G1=j.s+j.gap,span={from:G1,to:G0+t.len},anim=[],bag={dark:[],pale:[],accent:[],wood:[]};
 const accent=new T.Color(look.accent),inTunnel=s=>{const u=((s%t.len)+t.len)%t.len;return t.tunnel&&u>t.tunnel.s0&&u<t.tunnel.s1;},nearJump=(s,m=0)=>{const u=((s%t.len)+t.len)%t.len;return u>G0-26-m&&u<G1+14+m;},nearStart=(s,m=40)=>around(t,s,0)<m;
 const std=o=>new T.MeshStandardMaterial(o),add=(geo,mat,{shadow=false,y=0}={})=>{const m=new T.Mesh(geo,mat);m.receiveShadow=shadow&&high;m.position.y=y;g.add(m);return m;},put=(list,geo,M)=>{list.push(geo.applyMatrix4(M));};
 // ── Road.
 const roadMap=asphaltTex(look.road,look.night);roadMap.anisotropy=8;
 const road=std({map:roadMap,roughness:look.night?.34:.72,roughnessMap:look.night?roughTex():null,metalness:look.night?.25:.05,envMapIntensity:look.night?1.25:.5});if(road.roughnessMap){road.roughnessMap.repeat.set(1,1);}
 add(sweep(t,()=>[[-W,0],[W,0]],{...span,vScale:24}),road,{shadow:true});
 const kerbMap=kerbTex(...look.kerb),kerb=std({map:kerbMap,roughness:.6,emissive:0xffffff,emissiveMap:kerbMap,emissiveIntensity:look.night?.12:0});
 for(const side of [1,-1])add(sweep(t,()=>side>0?[[W,.03],[W+.95,.07]]:[[-W-.95,.07],[-W,.03]],{...span,vScale:3.2,skip:s=>Math.abs(trackAt(t,s).curve)<.0075}),kerb,{shadow:true});
 const runoffTex=t.theme==='harbour'?plainTex('#b59565',6000,111,.1,.16):t.theme==='neon'?plainTex('#191b2c',5000,112,.06,.2):plainTex('#8d98ab',5000,113,.1,.12);runoffTex.repeat.set(1,1);
 const runoff=std({map:runoffTex,roughness:.9,side:T.DoubleSide});
 for(const side of [1,-1])add(sweep(t,s=>side>0?[[W,-.02],[wallAt(t,s,1),-.02]]:[[-wallAt(t,s,-1),-.02],[-W,-.02]],{...span,vScale:5}),runoff,{shadow:true});
 // Sponsor walls with a lit rail on top, and a skirt down to whatever the circuit stands on.
 const wallMap=wallTex(look,t.seed&255),wall=std({map:wallMap,roughness:.55,metalness:.1,side:T.DoubleSide,emissive:0xffffff,emissiveMap:wallMap,emissiveIntensity:look.night?.3:.04}),rail=new T.MeshBasicMaterial({color:new T.Color(look.rail).multiplyScalar(look.night?1.9:1.05),toneMapped:!look.night?true:false,side:T.DoubleSide});
 const skirtTex=t.theme==='harbour'?plainTex('#6b5a4c',4000,121):t.theme==='neon'?plainTex('#22243a',4000,122):plainTex('#c7d3e6',3000,123);const skirt=std({map:skirtTex,roughness:.85,side:T.DoubleSide,metalness:t.theme==='skyway'?.5:0});
 for(const side of [1,-1]){const wd=s=>side*wallAt(t,s,side);
  add(sweep(t,s=>[[wd(s),0],[wd(s),1.05]],{...span,vScale:48,flipV:side>0,skip:inTunnel}),wall);
  add(sweep(t,s=>[[wd(s),1.06],[wd(s)+side*.28,1.06]],{...span,skip:inTunnel}),rail);
  if(side<0||t.theme!=='harbour')add(sweep(t,s=>{const o=side<0&&t.theme==='harbour'?-4.6:0;return look.base===null?[[wd(s)+side*.3+o,-.02],[wd(s)+side*.3+o,-2.2],[wd(s)+side*-1.2,-3.4]]:[[wd(s)+side*.3+o,-.02],[wd(s)+side*(.3+1.2)+o,look.base,true]];},{...span,vScale:6,step:t.ds*2}),skirt);}
 // The far abutment and the lip get end caps so the gap reads as a real break in the road.
 for(const s of [G0,G1]){const M=frame(t,s),d=look.base===null?3:Math.max(1,trackHeight(t,s)-look.base);put(bag.dark,box(.5,d,KART.wall*2+.6,s===G0?-.25:.25,-d,0),M);}
 // Start line, grid boxes and the gantry with its lights.
 add(sweep(t,()=>[[-W,.035],[W,.035]],{from:-1.1,to:1.1,vScale:2.2}),new T.MeshBasicMaterial({map:checker()}));
 add(sweep(t,()=>[[-W,.03],[W,.03]],{from:-22,to:-1,vScale:21}),new T.MeshBasicMaterial({map:gridTex(),transparent:true,opacity:.75,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
 const lights=[];{const M=frame(t,3),w=KART.wall+.9;for(const z of [-w,w])put(bag.dark,box(.55,7.4,.55,0,0,z),M);put(bag.dark,box(.7,1.5,w*2+.5,0,6.3,0),M);put(bag.dark,box(.4,.9,5.2,-.5,5.1,0),M);
  const head=add(new T.PlaneGeometry(w*2-.6,1.2).rotateY(-Math.PI/2).translate(-.37,7.05,0).applyMatrix4(M),new T.MeshBasicMaterial({map:bannerTex(0,'DRIFT DAWGS · '+t.name.toUpperCase()),toneMapped:false}));head.material.map.anisotropy=8;
  for(let i=0;i<4;i++){const mat=new T.MeshBasicMaterial({color:0x220808});lights.push(mat);g.add(new T.Mesh(new T.SphereGeometry(.34,14,10).translate(-.75,5.55,(i-1.5)*1.15).applyMatrix4(M),mat));}}
 // Boost pads and the arrows up the ramp scroll forward.
 const padMap=chevron('#ffffff'),padMat=new T.MeshBasicMaterial({map:padMap,color:look.night?new T.Color(.5,2.1,2.6):new T.Color(.25,1.05,1.3),transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2});
 for(const pad of t.pads)add(sweep(t,()=>[[pad.d-1.3,.04],[pad.d+1.3,.04]],{from:pad.s-1.5,to:pad.s+1.5,vScale:1.5}),padMat);
 const rampMap=chevron('#ffffff'),rampMat=new T.MeshBasicMaterial({map:rampMap,color:look.night?new T.Color(2.2,1.2,.3):new T.Color(1.15,.62,.12),transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2});
 add(sweep(t,()=>[[-3.4,.04],[3.4,.04]],{from:G0-18,to:G0-.4,vScale:4.4}),rampMat);anim.push(real=>{padMap.offset.y=-real*1.6%1;rampMap.offset.y=-real*1.1%1;});
 // The hoop over the gap and the launch gate at the lip.
 const hoopMat=new T.MeshBasicMaterial({color:accent.clone().multiplyScalar(2.2),toneMapped:false}),apex=world(t,G0+j.gap*.55,0,0);apex.y=trackHeight(t,G0)+3.6;
 const hoop=new T.Mesh(new T.TorusGeometry(5,.32,10,40),hoopMat);hoop.position.copy(apex);hoop.rotation.y=trackAt(t,G0+j.gap*.55).ang+Math.PI/2;g.add(hoop);const hoop2=new T.Mesh(new T.TorusGeometry(5.7,.1,6,40),new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}));hoop2.position.copy(apex);hoop2.rotation.copy(hoop.rotation);g.add(hoop2);
 anim.push(real=>{const p=1.5+Math.sin(real*5)*.5;hoopMat.color.copy(accent).multiplyScalar(look.night?p*1.4:p);hoop2.rotation.z=real*.6;});
 {const M=frame(t,G0-1.5),w=KART.wall+.5;for(const z of [-w,w]){put(bag.dark,box(.6,6,.6,0,0,z),M);put(bag.accent,box(.3,1.2,.3,0,6,z),M);}}
 // Tunnel: a lit arch with portals.
 if(t.tunnel){const {s0,s1}=t.tunnel,col=t.theme==='harbour'?'#ffb45e':t.theme==='neon'?'#ff4fc0':'#9fd8ff',tm=tunnelTex(col,false),te=tunnelTex(col,true),mat=std({map:tm,emissive:0xffffff,emissiveMap:te,emissiveIntensity:2.2,roughness:.45,metalness:.4,side:T.DoubleSide});
  add(sweep(t,s=>{const l=-wallAt(t,s,-1),r=wallAt(t,s,1);return [[l,0],[l,3.9],[l+2.6,6],[r-2.6,6],[r,3.9],[r,0]];},{from:s0,to:s1,vScale:7}),mat);
  for(const s of [s0,s1]){const M=frame(t,s),w=KART.wall+.7;for(const z of [-w,w])put(bag.dark,box(1.2,7.4,1.4,0,-.5,z),M);put(bag.dark,box(1.2,1.6,w*2+1.4,0,6.3,0),M);put(bag.accent,box(1.3,.22,w*2,0,6.05,0),M);}}
 // Banner arches, floodlights and their glow.
 const banners=[];for(let k=1;k<=6;k++){const s=t.len*k/7+20;if(inTunnel(s-8)||inTunnel(s+8)||nearJump(s,12)||nearStart(s,30))continue;banners.push(s);}
 banners.forEach((s,i)=>{const M=frame(t,s),w=Math.max(wallAt(t,s,1),wallAt(t,s,-1))+.8;for(const z of [-w,w])put(bag.dark,box(.4,6.6,.4,0,0,z),M);put(bag.dark,box(.3,.25,w*2,0,6.5,0),M);
  const b=add(new T.PlaneGeometry(w*2-.5,1.5).rotateY(-Math.PI/2).translate(-.05,5.6,0).applyMatrix4(M),new T.MeshBasicMaterial({map:bannerTex(i+1+(t.seed&3)),side:T.DoubleSide,toneMapped:!look.night,color:look.night?0xffffff:0xd8d8d8}));b.material.map.anisotropy=4;});
 const lamps=[],poles=[];for(let s=18,i=0;s<t.len-8;s+=high?36:54,i++){if(inTunnel(s)||nearJump(s))continue;const side=i%2?1:-1,d=side*(wallAt(t,s,side)+1),p=world(t,s,d);poles.push({x:p.x,y:p.y,z:p.z,ry:trackAt(t,s).ang+(side>0?Math.PI/2:-Math.PI/2)});const q=world(t,s,d-side*1.6,8.6);lamps.push(q);}
 g.add(instances(merge([box(.24,9,.24),box(.2,.2,2,0,8.8,.9),box(.7,.16,1,0,8.6,1.6)]),std({color:0x2a2c3c,metalness:.6,roughness:.4}),poles));
 const glowPos=[];for(const q of lamps)glowPos.push(q.x,q.y,q.z);
 if(look.night||t.theme==='harbour'){const pts=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(glowPos,3)),new T.PointsMaterial({map:glowTex,size:look.night?2.6:2.4,color:new T.Color(look.night?0xcfe0ff:0xffd9a0).multiplyScalar(1.1),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,fog:false}));pts.frustumCulled=false;g.add(pts);
  if(high){const shaft=lightShaft(look.night?0xaac4ff:0xffcf96,{length:9,radius:4.2,opacity:look.night?.22:.12,fade:[30,120]}),im=instances(shaft.geometry,shaft.material,lamps.map(q=>({x:q.x,y:q.y,z:q.z})));im.renderOrder=2;g.add(im);}}
 // Grandstands on the outside of the start and by the landing, and the people in them.
 const crowd=[],palette=[0xff5f6d,0xffb547,0x5ee7ff,0xc18cff,0x5cff9b,0xffffff,0xff8ad0,0xffe45e,0x4f7dff];
 const stand=(s,side,len=15)=>{const d=side*(wallAt(t,s,side)+2.6),M=frame(t,s,d),z=k=>-side*k;for(let r=0;r<5;r++){put(bag.pale,box(len,.55+r*.62,1.25,0,-.3,z(r*1.25+.6)),M);for(let x=-len/2+.6;x<len/2;x+=high?.95:1.9)if(rnd()<.86){const v=new T.Vector3(x+(rnd()-.5)*.3,.55+r*.62-.3,z(r*1.25+.6)).applyMatrix4(M);crowd.push({x:v.x,y:v.y,z:v.z,ph:rnd()*6.28,c:palette[Math.floor(rnd()*palette.length)],s:.85+rnd()*.3,cheer:s});}}
  put(bag.dark,box(len,.2,7.4,0,5.2,z(3.4)),M);for(const x of [-len/2+.3,len/2-.3]){put(bag.dark,box(.3,5.6,.3,x,-.3,z(6.6)),M);put(bag.dark,box(.3,5.6,.3,x,-.3,z(.2)),M);}put(bag.accent,box(len,.5,.12,0,4.7,z(-.25)),M);};
 for(const s of [-34,-16,2,20])stand(s,-1);stand(G1+26,-1,13);stand(G1+26,1,13);
 const fan=new T.SphereGeometry(.26,8,6).scale(1,1.5,1).translate(0,.4,0),crowdMesh=instances(fan,std({roughness:.8}),crowd);g.add(crowdMesh);
 {const o=new T.Object3D();let frameNo=0;anim.push((real,dt,cam,game)=>{if(++frameNo%(high?1:2))return;const you=game?((game.you.p%t.len)+t.len)%t.len:0;crowd.forEach((c,i)=>{const near=game&&around(t,c.cheer,you)<45?1:.35,hop=Math.max(0,Math.sin(real*(5+near*4)+c.ph))*.34*near;o.position.set(c.x,c.y+hop,c.z);o.scale.setScalar(c.s);o.updateMatrix();crowdMesh.setMatrixAt(i,o.matrix);});crowdMesh.instanceMatrix.needsUpdate=true;});}
 // Shortcut sign: an arrow board at the mouth of the cut.
 if(t.cut){const c=t.cut,M=frame(t,c.s0+8,c.side*(KART.wall+KART.cut*.4));put(bag.dark,box(.2,3.2,.2,0,0,0),M);const sign=add(new T.PlaneGeometry(3.6,1.3).rotateY(-Math.PI/2).translate(-.12,3.3,0).applyMatrix4(M),new T.MeshBasicMaterial({map:bannerTex(4,'SHORTCUT? »'),toneMapped:!look.night}));sign.material.side=T.DoubleSide;}
 // Corner boards: arrows above the outside wall of every real corner, pointing the way round.
 const arrowMap=chevron('#ffffff'),arrowMat=new T.MeshBasicMaterial({map:arrowMap,color:look.night?new T.Color(2.4,.5,.9):new T.Color(1,.25,.2),transparent:true,side:T.DoubleSide,toneMapped:!look.night,alphaTest:.3});
 for(const side of [1,-1])add(sweep(t,s=>[[side*wallAt(t,s,side),1.15],[side*wallAt(t,s,side),2.25]],{...span,vScale:1.6,skip:s=>inTunnel(s)||!(trackAt(t,s+6).curve*side<-.0115)}),arrowMat);
 // The racing line (drawn for the driver's-eye view): arrows along the fast way round, cool on
 // the straights and hot where a corner wants a drift.
 const lineOf=s=>Math.max(-3.2,Math.min(3.2,trackAt(t,s+8).curve*250)),lineMap=chevron('#ffffff'),lineGeo=sweep(t,s=>{const d=lineOf(s);return [[d-.5,.05],[d+.5,.05]];},{from:G1+8,to:G0+t.len-3,vScale:3}),lc=[],ln=lineGeo.attributes.position.count/2;
 for(let i=0;i<ln;i++){const s=G1+8+(G0+t.len-3-G1-8)*i/(ln-1),hot=Math.min(1,Math.abs(trackAt(t,s+10).curve)/.016),r=.25+hot*1.5,gg=1.5-hot*.75,b=1.9-hot*1.7;lc.push(r,gg,b,r,gg,b);}lineGeo.setAttribute('color',new T.Float32BufferAttribute(lc,3));
 const lineMat=new T.MeshBasicMaterial({map:lineMap,vertexColors:true,transparent:true,opacity:0,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-3}),line=add(lineGeo,lineMat);line.visible=false;line.renderOrder=1;anim.push(real=>{lineMap.offset.y=-real*1.4%1;});
 // ── The world around it.
 const dress={harbour:dressHarbour,neon:dressNeon,skyway:dressSkyway}[t.theme]||dressNeon;
 dress({t,g,look,rnd,high,anim,bag,add,put,std,glowTex,nearJump,nearStart,inTunnel,accent,W,G0,G1});
 for(const [k,mat]of [['dark',std({color:0x262a3c,metalness:.55,roughness:.45})],['pale',std({color:t.theme==='neon'?0x3a3d58:0xd9dde8,roughness:.8})],['accent',new T.MeshBasicMaterial({color:accent.clone().multiplyScalar(look.night?2:1.1),toneMapped:!look.night})],['wood',std({map:woodTex(),roughness:.8})]])if(bag[k].length){const m=add(merge(bag[k]),mat);m.castShadow=high&&k!=='accent';}
 return {group:g,look,lights,line,update:(real,dt,cam,game)=>{for(const f of anim)f(real,dt,cam,game);}};
}

// Sunset harbour: the circuit rings a quay island in open water. Boardwalk and bulbs on the
// outside, containers, cranes, palms and a big wheel on the inside, boats and a lighthouse offshore.
function dressHarbour({t,g,look,rnd,high,anim,bag,add,put,std,glowTex,nearJump,nearStart,inTunnel,G0,G1}){
 const wave=waveTex();wave.repeat.set(60,60);const water=add(new T.PlaneGeometry(2400,2400).rotateX(-Math.PI/2),std({color:0x1d5a78,roughness:.16,metalness:.55,normalMap:wave,normalScale:new T.Vector2(.5,.5),envMapIntensity:1.5,emissive:0x7a3520,emissiveIntensity:.22}),{y:-1.9});water.receiveShadow=false;anim.push(real=>{wave.offset.set(real*.012,real*.02);});
 // The sun's road on the water.
 const glit=add(new T.PlaneGeometry(90,900).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:texture(64,256,(c,w,h)=>{const gr=c.createLinearGradient(0,0,w,0);gr.addColorStop(0,'#0000');gr.addColorStop(.5,'#ffb060');gr.addColorStop(1,'#0000');c.fillStyle=gr;c.fillRect(0,0,w,h);c.globalCompositeOperation='destination-in';const v=c.createLinearGradient(0,0,0,h);v.addColorStop(0,'#000f');v.addColorStop(1,'#0000');c.fillStyle=v;c.fillRect(0,0,w,h);}),transparent:true,blending:T.AdditiveBlending,depthWrite:false,opacity:.5,fog:false}),{y:-1.85});glit.rotation.y=Math.atan2(look.sunDir[0],look.sunDir[2])+Math.PI;glit.position.set(look.sunDir[0]*520,-1.85,look.sunDir[2]*520);
 // The island: a flat apron inside the circuit rising to a hill, with an inlet cut under the jump.
 const n=t.pts.length,pos=[],uv=[],idx=[];for(let i=0;i<n;i++){const s=i*t.ds,d=wallAt(t,s,1)+.25,p=trackPoint(t,s,d),inlet=s>G0-3&&s<G1+3,h=inlet?-3:trackHeight(t,s,d)-.04;pos.push(p.x,h,-p.y,p.x*.55,inlet?-3:h+.2,-p.y*.55,p.x*.2,inlet?-1:h+5,-p.y*.2);for(const k of [1,.55,.2])uv.push(p.x*k/14,p.y*k/14);const a=i*3,b=((i+1)%n)*3;idx.push(a,a+1,b,b,a+1,b+1,a+1,a+2,b+1,b+1,a+2,b+2);}
 const c0=pos.length/3;pos.push(0,7,0);uv.push(0,0);for(let i=0;i<n;i++)idx.push(i*3+2,c0,((i+1)%n)*3+2);
 const land=new T.BufferGeometry();land.setAttribute('position',new T.Float32BufferAttribute(pos,3));land.setAttribute('uv',new T.Float32BufferAttribute(uv,2));land.setIndex(idx);land.computeVertexNormals();
 const lt=texture(256,256,(c,w,h)=>{c.fillStyle='#8a9a58';c.fillRect(0,0,w,h);for(let i=0;i<5000;i++){c.fillStyle=['#7c8f4c','#9aa862','#b3a36b','#6f8446'][Math.floor(hash(131,i)*4)];c.fillRect(hash(132,i)*w,hash(133,i)*h,4,4);}},{repeat:true});add(land,std({map:lt,roughness:.95,side:T.DoubleSide}),{shadow:true});
 // Boardwalk outside the wall with a rope rail and a string of bulbs.
 const wood=woodTex(),deck=std({map:wood,roughness:.8,side:T.DoubleSide});add(sweep(t,s=>[[-wallAt(t,s,-1)-4.6,-.02],[-wallAt(t,s,-1)-.28,-.02]],{from:G1,to:G0+t.len,vScale:4}),deck,{shadow:true});
 const bulbs=[],cols=[],warm=[[1,.75,.4],[1,.45,.35],[.5,.9,1],[1,.95,.6]];for(let s=G1+4,i=0;s<G0+t.len-4;s+=1.6,i++){if(inTunnel(s))continue;const sag=Math.abs(Math.sin(s/12*Math.PI))*1.1,p=trackPoint(t,s,-KART.wall-4.3);bulbs.push(p.x,trackHeight(t,s,-KART.wall-4.3)+3.8-sag,-p.y);cols.push(...warm[i%4]);}
 for(let s=G1+6;s<G0+t.len-4;s+=12)if(!inTunnel(s))put(bag.wood,box(.16,3.9,.16),frame(t,s,-KART.wall-4.3));
 const bg=new T.BufferGeometry();bg.setAttribute('position',new T.Float32BufferAttribute(bulbs,3));bg.setAttribute('color',new T.Float32BufferAttribute(cols,3));const bp=new T.Points(bg,new T.PointsMaterial({map:glowTex,size:1.1,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));bp.frustumCulled=false;g.add(bp);
 // Inside: palms along the wall, container stacks, two cranes, market stalls after the start.
 const trunks=[],crowns=[],cont=[],stalls=[],awn=[],cc=[0xd1483c,0x2f7fc4,0xe2a53a,0x3f9d6b,0xe9e4d8,0x8a4fc0];
 for(let s=10,i=0;s<t.len;s+=high?11:20,i++){if(nearJump(s,6)||inTunnel(s))continue;const d=wallAt(t,s,1)+2+rnd()*1.5,p=trackPoint(t,s,d),y=trackHeight(t,s,wallAt(t,s,1))-.1,h=.8+rnd()*.5;trunks.push({x:p.x,y,z:-p.y,sy:h,rz:(rnd()-.5)*.2,ry:rnd()*6});crowns.push({x:p.x,y:y+6.4*h,z:-p.y,ry:rnd()*6,s:.9+rnd()*.4});}
 g.add(instances(new T.CylinderGeometry(.14,.26,6.5,6).translate(0,3.25,0),std({color:0x7a5a3c,roughness:.9}),trunks));
 const frond=merge([0,1,2,3,4,5,6].map(k=>new T.ConeGeometry(.5,3.4,4).scale(1,1,.18).rotateZ(-1.15).translate(1.5,-.35,0).rotateY(k/7*Math.PI*2)));g.add(instances(frond,std({color:0x3f8f4a,roughness:.8,side:T.DoubleSide}),crowns));
 for(let k=0;k<(high?26:14);k++){const s=rnd()*t.len;if(nearJump(s,14)||nearStart(s,70))continue;const d=wallAt(t,s,1)+8+rnd()*16,p=trackPoint(t,s,d);if(Math.hypot(p.x,p.y)<34)continue;const y=trackHeight(t,s,wallAt(t,s,1))-.05,ry=p.ang+(rnd()<.5?0:Math.PI/2),stack=1+Math.floor(rnd()*3);for(let q=0;q<stack;q++)cont.push({x:p.x,y:y+q*2.6,z:-p.y,ry,c:cc[Math.floor(rnd()*cc.length)]});}
 const ct=texture(128,64,(c,w,h)=>{c.fillStyle='#fff';c.fillRect(0,0,w,h);c.fillStyle='rgba(0,0,0,.16)';for(let x=0;x<w;x+=8)c.fillRect(x,0,3,h);c.fillStyle='rgba(0,0,0,.3)';c.fillRect(0,0,w,3);c.fillRect(0,h-3,w,3);});g.add(instances(box(6.1,2.6,2.44),std({map:ct,roughness:.6,metalness:.3}),cont));
 for(let k=0;k<2;k++){const s=t.len*(.3+k*.42),d=wallAt(t,s,1)+14,M=frame(t,s,d);M.elements[13]=trackHeight(t,s,wallAt(t,s,1));if(nearJump(s,20))continue;for(const [x,z]of [[-5,-4],[5,-4],[-5,4],[5,4]])put(bag.accent,box(.8,22,.8,x,0,z),M);put(bag.accent,box(11,1.2,9,0,22,0),M);put(bag.dark,box(1.4,1.4,34,0,23.2,6),M);put(bag.dark,box(2.4,2.2,3,0,20.6,-2),M);put(bag.dark,box(.15,9,.15,0,14,18),M);}
 for(let s=44;s<128;s+=5.2){const d=wallAt(t,s,1)+4.6,p=trackPoint(t,s,d),y=trackHeight(t,s,wallAt(t,s,1))-.05;stalls.push({x:p.x,y,z:-p.y,ry:p.ang});awn.push({x:p.x,y:y+2.5,z:-p.y,ry:p.ang,c:[0xff5a4a,0xffffff,0x3fb6e8,0xffc83d][Math.floor(rnd()*4)]});}
 g.add(instances(box(3.6,1.1,2.4),std({map:wood,roughness:.8}),stalls));g.add(instances(new T.CylinderGeometry(2.2,2.9,.9,4,1).rotateY(Math.PI/4).scale(1,1,.8),std({roughness:.7}),awn));
 // The big wheel on the hill turns slowly, rim lit.
 const wheel=new T.Group(),rimMat=new T.MeshBasicMaterial({color:new T.Color(1.9,1.1,.5),toneMapped:false});wheel.add(new T.Mesh(new T.TorusGeometry(15,.28,6,48),rimMat),new T.Mesh(new T.TorusGeometry(12.6,.14,6,48),rimMat));const spokes=[];for(let k=0;k<12;k++)spokes.push(new T.BoxGeometry(.14,30,.14).rotateZ(k/12*Math.PI));wheel.add(new T.Mesh(merge(spokes),std({color:0xf4efe6,metalness:.4,roughness:.5})));
 const cabs=[];for(let k=0;k<16;k++)cabs.push({x:Math.cos(k/16*6.283)*15,y:Math.sin(k/16*6.283)*15,z:0,c:cc[k%cc.length]});const cabins=instances(box(1.5,1.5,1.5,0,-1.6,0),std({roughness:.5}),cabs);wheel.add(cabins);wheel.position.set(0,24,0);wheel.rotation.y=.6;g.add(wheel);
 for(const z of [-2.4,2.4]){const leg=box(.7,26,.7,0,0,0);const lm=new T.Mesh(leg,std({color:0xe9e4d8,roughness:.6}));lm.position.set(Math.sin(.6)*z,0,Math.cos(.6)*z);g.add(lm);}
 {const o=new T.Object3D();anim.push(real=>{const a=real*.12;cabs.forEach((c,i)=>{const th=i/16*6.283+a;o.position.set(Math.cos(th)*15,Math.sin(th)*15,0);o.updateMatrix();cabins.setMatrixAt(i,o.matrix);});cabins.instanceMatrix.needsUpdate=true;wheel.children[0].rotation.z=wheel.children[1].rotation.z=wheel.children[2].rotation.z=a;});}
 // Offshore: sailboats that bob, one of them under way through the inlet's mouth, a lighthouse.
 const hulls=[],sails=[];for(let k=0;k<(high?16:9);k++){const a=rnd()*6.283,r=230+rnd()*260,x=Math.cos(a)*r,z=Math.sin(a)*r;if(!clearOf(t,x,-z,40))continue;hulls.push({x,y:-1.9,z,ry:rnd()*6,s:1+rnd()*.8});}
 const jm=trackAt(t,G0+7),jx=jm.x+Math.sin(jm.ang)*26,jz=-(jm.y-Math.cos(jm.ang)*26);hulls.push({x:jx,y:-1.9,z:jz,ry:jm.ang+Math.PI/2,s:1.3});
 const hullGeo=merge([new T.CylinderGeometry(1.1,.5,7,5,1).rotateZ(Math.PI/2).scale(1,.5,1).translate(0,.5,0),box(2,.8,1.2,-.6,.9,0)]),sailGeo=merge([new T.ConeGeometry(2.2,7,3).scale(1,1,.08).translate(.4,5.2,0),new T.CylinderGeometry(.07,.07,8,5).translate(0,4.6,0)]);
 const hullMesh=instances(hullGeo,std({color:0xf2ede2,roughness:.5}),hulls),sailMesh=instances(sailGeo,std({color:0xfff6e8,roughness:.7,side:T.DoubleSide,emissive:0xff9a5c,emissiveIntensity:.18}),hulls);g.add(hullMesh,sailMesh);
 {const o=new T.Object3D();anim.push(real=>{hulls.forEach((b,i)=>{const drift=i===hulls.length-1?Math.sin(real*.15)*14:0;o.position.set(b.x-Math.sin(jm.ang)*drift,b.y+Math.sin(real*1.3+i)*.18,b.z+Math.cos(jm.ang)*drift*-1);o.rotation.set(Math.sin(real*.9+i)*.05,b.ry,Math.sin(real*1.1+i*2)*.06);o.scale.setScalar(b.s);o.updateMatrix();hullMesh.setMatrixAt(i,o.matrix);sailMesh.setMatrixAt(i,o.matrix);});hullMesh.instanceMatrix.needsUpdate=sailMesh.instanceMatrix.needsUpdate=true;});}
 const far=trackPoint(t,t.len*.62,-90),lh=new T.Group();lh.add(new T.Mesh(new T.CylinderGeometry(9,13,5,9).translate(0,.5,0),std({color:0x5c5148,roughness:1})),new T.Mesh(new T.CylinderGeometry(1.5,2.6,20,12).translate(0,13,0),std({map:texture(8,64,(c,w,h)=>{for(let i=0;i<4;i++){c.fillStyle=i%2?'#e33d32':'#f6f1e6';c.fillRect(0,i*16,w,16);}}),roughness:.6})),new T.Mesh(new T.SphereGeometry(1.3,10,8).translate(0,24.4,0),new T.MeshBasicMaterial({color:new T.Color(2.4,2,1.2),toneMapped:false})));
 const beam=lightShaft(0xffe2a8,{length:150,radius:10,top:.6,opacity:.2,fade:[200,700]});beam.rotation.z=Math.PI/2+.05;const pivot=new T.Group();pivot.position.y=24.4;pivot.add(beam);lh.add(pivot);lh.position.set(far.x,-1.9,-far.y);g.add(lh);anim.push(real=>{pivot.rotation.y=real*.5;});
 const sky=[];for(let k=0;k<(high?26:14);k++){const a=rnd()*6.283,r=520+rnd()*160;sky.push(Math.cos(a)*r,70+rnd()*190,Math.sin(a)*r);}
 const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(sky,3));const sp=new T.Points(sg,new T.PointsMaterial({map:cloudTex(),size:300,transparent:true,depthWrite:false,opacity:.75,color:0xffb08a,fog:false}));sp.frustumCulled=false;sp.renderOrder=-1;g.add(sp);
 backdrop(g,0xffa868,.55,-6);
}

// Rainy neon district at night: lit towers and signs press in on both sides, cabs drift overhead,
// searchlights sweep, and a cross street runs under the jump.
function dressNeon({t,g,look,rnd,high,anim,bag,add,put,std,glowTex,nearJump,inTunnel,G0,G1}){
 const wet=roughTex();wet.repeat.set(90,90);add(new T.PlaneGeometry(1800,1800).rotateX(-Math.PI/2),std({color:0x0b0d1a,roughness:.3,roughnessMap:wet,metalness:.55,envMapIntensity:1.1}),{y:-.14});
 const shells=buildingShells(8),mats=facadeMaterials(),lists=shells.map(()=>[]),signs=signMaterials(),rings=high?[[20,22],[44,30],[78,40],[125,60]]:[[22,30],[56,46]];let placed=0;
 for(const [d0,spacing]of rings)for(let s=rnd()*spacing;s<t.len;s+=spacing*(.7+rnd()*.5))for(const side of [1,-1]){const off=KART.wall+KART.cut+d0-12+rnd()*10,p=trackPoint(t,s,side*off);if(!clearOf(t,p.x,p.y,KART.wall+KART.cut+7)||side>0&&Math.hypot(p.x,p.y)<12)continue;
  const k=Math.floor(rnd()*shells.length),sc=1.5+rnd()*1.1,sh=shells[k],ry=p.ang+(side<0?Math.PI:0)+(rnd()-.5)*.25;lists[k].push({x:p.x,y:-.14,z:-p.y,ry,sx:sc,sy:.8+rnd()*1.3+(d0>60?.8:0),sz:sc});
  if(d0<30&&placed<(high?18:9)&&rnd()<.6){const sg=signs[Math.floor(rnd()*signs.length)],hgt=sg.vertical?7:2.4,m=new T.Mesh(new T.PlaneGeometry(hgt*sg.aspect,hgt),sg.mat);m.position.set(p.x+Math.sin(ry)*(sh.d*sc/2+.25),Math.min(sh.h*.7,7+rnd()*9),-p.y+Math.cos(ry)*(sh.d*sc/2+.25));m.rotation.y=ry;g.add(m);placed++;}}
 shells.forEach((sh,k)=>{if(lists[k].length)g.add(instances(sh.g,mats[k%4],lists[k]));});
 // Giant sponsor screens on the outside of the big corners.
 for(let k=0;k<3;k++){const s=t.len*(.2+k*.3),p=trackPoint(t,s,-(KART.wall+15)),tex=bannerTex(k+2);tex.wrapS=T.RepeatWrapping;const m=new T.Mesh(new T.PlaneGeometry(22,5.5),new T.MeshBasicMaterial({map:tex,toneMapped:false,color:new T.Color(1.5,1.5,1.5)}));m.position.set(p.x,13+trackHeight(t,s),-p.y);m.rotation.y=p.ang+Math.PI;g.add(m);put(bag.dark,box(23,.6,.6,0,9.6+0,0),new T.Matrix4().makeRotationY(p.ang).setPosition(p.x,trackHeight(t,s),-p.y));put(bag.dark,box(.8,10,.8,0,-1,0),new T.Matrix4().makeRotationY(p.ang).setPosition(p.x,trackHeight(t,s),-p.y));anim.push(real=>{tex.offset.x=real*.05*(k%2?1:-1)%1;});}
 // Sky cabs: points of light on slow orbits.
 const N=high?40:20,cp=new Float32Array(N*3),cc=new Float32Array(N*3),orb=Array.from({length:N},(_,i)=>({r:60+rnd()*220,h:22+rnd()*40,a:rnd()*6.28,w:(.04+rnd()*.06)*(i%2?1:-1)}));orb.forEach((o,i)=>{const c=i%3?[1.6,.5,.4]:[1.5,1.4,1];cc.set(c,i*3);});
 const cg=new T.BufferGeometry();cg.setAttribute('position',new T.BufferAttribute(cp,3));cg.setAttribute('color',new T.BufferAttribute(cc,3));const cabs=new T.Points(cg,new T.PointsMaterial({map:glowTex,size:2.6,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,fog:false}));cabs.frustumCulled=false;g.add(cabs);
 anim.push(real=>{orb.forEach((o,i)=>{const a=o.a+real*o.w;cp[i*3]=Math.cos(a)*o.r;cp[i*3+1]=o.h+Math.sin(real*.3+i)*2;cp[i*3+2]=Math.sin(a)*o.r;});cg.attributes.position.needsUpdate=true;});
 // Searchlights.
 for(let k=0;k<(high?4:2);k++){const a=k*1.7+.4,sh=lightShaft([0xff4fc0,0x4be3ff,0xb9ff5e,0xffb547][k],{length:190,radius:9,top:.8,opacity:.16,fade:[300,900]});sh.rotation.z=Math.PI;const piv=new T.Group();piv.add(sh);piv.position.set(Math.cos(a)*260,0,Math.sin(a)*260);g.add(piv);anim.push(real=>{piv.rotation.x=Math.sin(real*.4+k)*.5;piv.rotation.z=Math.cos(real*.3+k*2)*.5;});}
 // The cross street under the jump, with traffic.
 const q=trackAt(t,G0+7),M=new T.Matrix4().makeRotationY(q.ang+Math.PI/2).setPosition(q.x,-.1,-q.y),st=texture(64,256,(c,w,h)=>{c.fillStyle='#15172a';c.fillRect(0,0,w,h);c.fillStyle='#ffd25e';c.fillRect(30,0,4,h/2);c.fillStyle='#ffffff';c.fillRect(2,0,3,h);c.fillRect(w-5,0,3,h);},{repeat:true});st.repeat.set(1,24);st.wrapT=T.RepeatWrapping;
 add(new T.PlaneGeometry(240,12).rotateX(-Math.PI/2).applyMatrix4(M),new T.MeshBasicMaterial({map:(()=>{st.rotation=Math.PI/2;st.center.set(.5,.5);return st;})(),color:0x9a9ab0}));
 const cars=Array.from({length:high?10:6},(_,i)=>({u:rnd()*240-120,lane:i%2?2.6:-2.6,v:(i%2?1:-1)*(14+rnd()*8),c:[0xff5f6d,0x5ee7ff,0xffe45e,0xffffff,0xc18cff][i%5]})),carMesh=instances(merge([box(4.2,1,1.8,0,.3,0),box(2.2,.8,1.6,-.2,1.3,0)]),std({roughness:.3,metalness:.5,emissive:0x222233}),cars.map(()=>({x:0,y:0,z:0})));cars.forEach((c,i)=>carMesh.setColorAt(i,new T.Color(c.c)));g.add(carMesh);
 {const o=new T.Object3D(),v=new T.Vector3();anim.push((real,dt)=>{cars.forEach((c,i)=>{c.u+=c.v*dt;if(c.u>120)c.u-=240;if(c.u<-120)c.u+=240;v.set(c.u,0,c.lane).applyMatrix4(M);o.position.copy(v);o.rotation.y=q.ang+Math.PI/2+(c.v<0?Math.PI:0);o.updateMatrix();carMesh.setMatrixAt(i,o.matrix);});carMesh.instanceMatrix.needsUpdate=true;});}
 // Rain: streaks that fall around the camera.
 const R=high?700:320,rp=new Float32Array(R*6),drops=Array.from({length:R},()=>({x:(rnd()-.5)*70,y:rnd()*30,z:(rnd()-.5)*70,v:26+rnd()*14})),rg=new T.BufferGeometry();rg.setAttribute('position',new T.BufferAttribute(rp,3));
 const rain=new T.LineSegments(rg,new T.LineBasicMaterial({color:0x9fb8ff,transparent:true,opacity:.34,depthWrite:false,fog:false}));rain.frustumCulled=false;g.add(rain);
 anim.push((real,dt,cam)=>{if(!cam)return;const cx=cam.position.x,cy=cam.position.y,cz=cam.position.z;drops.forEach((d,i)=>{d.y-=d.v*dt;if(d.y<-3)d.y+=30;const x=cx+((d.x-cx)%70+105)%70-35,z=cz+((d.z-cz)%70+105)%70-35,y=cy-6+d.y;rp[i*6]=x;rp[i*6+1]=y;rp[i*6+2]=z;rp[i*6+3]=x+.12;rp[i*6+4]=y+1.1;rp[i*6+5]=z;});rg.attributes.position.needsUpdate=true;});
 backdrop(g,0x9a7cff,.9,40);
}

// Above the clouds: the deck rides on pylons between glass towers. Balloons, a blimp with a
// banner, and a cloud sea below.
function dressSkyway({t,g,look,rnd,high,anim,bag,add,put,std,glowTex,nearJump,G0,G1}){
 const ct=cloudTex(),floor=texture(512,512,(c,w,h)=>{c.fillStyle='#dcecff';c.fillRect(0,0,w,h);for(let i=0;i<260;i++){const x=hash(601,i)*w,y=hash(602,i)*h,r=20+hash(603,i)*60,gr=c.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,hash(604,i)>.45?'rgba(255,255,255,.7)':'rgba(150,180,225,.5)');gr.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gr;c.beginPath();c.arc(x,y,r,0,7);c.fill();}},{repeat:true});floor.repeat.set(9,9);
 add(new T.PlaneGeometry(3000,3000).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:floor,color:0xf2f7ff}),{y:-46});anim.push(real=>{floor.offset.set(real*.0016,real*.0009);});
 // Puffs drifting between the deck and the floor.
 const puffs=[];for(let k=0;k<(high?90:45);k++){const a=rnd()*6.283,r=40+rnd()*420;puffs.push(Math.cos(a)*r,-40+rnd()*26,Math.sin(a)*r);}for(let k=0;k<(high?30:16);k++){const a=rnd()*6.283,r=420+rnd()*200;puffs.push(Math.cos(a)*r,10+rnd()*120,Math.sin(a)*r);}
 const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(puffs,3));const pm=new T.Points(pg,new T.PointsMaterial({map:ct,size:70,transparent:true,depthWrite:false,opacity:.9,color:0xffffff}));pm.frustumCulled=false;pm.renderOrder=1;g.add(pm);
 // Pylons under the deck.
 const pyl=[];for(let s=8;s<t.len;s+=30){if(nearJump(s,-8))continue;const p=trackPoint(t,s,0);pyl.push({x:p.x,y:trackHeight(t,s)-3.2,z:-p.y,ry:p.ang});}
 g.add(instances(merge([new T.BoxGeometry(3,60,5).translate(0,-30,0),new T.BoxGeometry(2.4,1.6,KART.wall*2).translate(0,.4,0)]),std({color:0xdfe6f2,roughness:.6,metalness:.3}),pyl));
 // Glass towers rise through the clouds; rooftops carry pads and beacons.
 const glass=glassTex(),tower=std({map:glass,roughness:.12,metalness:.75,envMapIntensity:1.6,color:0xdfeaff}),tw=[],caps=[],beacons=[];
 for(let k=0;k<(high?90:48);k++){let x,z,top;if(k<(high?34:20)){const s=t.len*(k+rnd()*.6)/(high?34:20),side=k%2?1:-1,p=trackPoint(t,s,side*(22+rnd()*30));x=p.x;z=-p.y;top=trackHeight(t,s)+(k%2?-3-rnd()*16:8+rnd()*38);}else{const a=rnd()*6.283,r=30+rnd()*330;x=Math.cos(a)*r;z=Math.sin(a)*r;top=-18+rnd()*52;}if(!clearOf(t,x,-z,KART.wall+KART.cut+10))continue;const w=10+rnd()*12,d=10+rnd()*12;tw.push({x,y:top-110,z,sx:w,sy:110,sz:d,ry:rnd()*1.57,c:[0xffffff,0xcfe3ff,0xffe9d2,0xbfd6ff][Math.floor(rnd()*4)]});caps.push({x,y:top,z,sx:w*.7,sy:1,sz:d*.7,ry:tw[tw.length-1].ry});if(rnd()<.5)beacons.push(x,top+5.5,z);}
 const tg=new T.BoxGeometry(1,1,1).translate(0,.5,0),uv=tg.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*1.5,uv.getY(i)*10);g.add(instances(tg,tower,tw));g.add(instances(merge([box(1,.6,1),new T.CylinderGeometry(.02,.02,5,4).translate(.3,3,.3)]),std({color:0x59657c,roughness:.7}),caps));
 const bgm=new T.BufferGeometry();bgm.setAttribute('position',new T.Float32BufferAttribute(beacons,3));const bm=new T.PointsMaterial({map:glowTex,size:3,color:new T.Color(2.4,.3,.3),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});const bp=new T.Points(bgm,bm);bp.frustumCulled=false;g.add(bp);anim.push(real=>{bm.opacity=.35+.65*(Math.sin(real*3)>0?1:0);});
 // Glass screens above the walls.
 const screen=new T.MeshStandardMaterial({color:0xcfe6ff,transparent:true,opacity:.2,roughness:.05,metalness:.9,side:T.DoubleSide,depthWrite:false,envMapIntensity:2});for(const side of [1,-1])add(sweep(t,s=>[[side*wallAt(t,s,side),1.1],[side*wallAt(t,s,side),2.3]],{from:G1,to:G0+t.len}),screen);
 // Hot-air balloons and the blimp.
 const bl=[],bcol=[0xff5f6d,0xffb547,0x5ee7ff,0xc18cff,0x5cff9b,0xff8ad0];for(let k=0;k<(high?14:8);k++){const a=rnd()*6.283,r=70+rnd()*260;bl.push({x:Math.cos(a)*r,y:12+rnd()*44,z:Math.sin(a)*r,s:1.2+rnd()*1.2,c:bcol[k%6],ph:rnd()*6});}
 const env=instances(new T.SphereGeometry(5,14,12).scale(1,1.18,1),std({roughness:.6,map:texture(64,8,(c,w,h)=>{for(let i=0;i<8;i++){c.fillStyle=i%2?'#ffffff':'#d8d8d8';c.fillRect(i*8,0,8,h);}})}),bl),bask=instances(box(1.4,1.2,1.4,0,-8.6,0),std({color:0x7a5a3c,roughness:.9}),bl);g.add(env,bask);
 {const o=new T.Object3D();anim.push(real=>{bl.forEach((b,i)=>{o.position.set(b.x,b.y+Math.sin(real*.3+b.ph)*2.5,b.z);o.rotation.y=real*.05+b.ph;o.scale.setScalar(b.s);o.updateMatrix();env.setMatrixAt(i,o.matrix);bask.setMatrixAt(i,o.matrix);});env.instanceMatrix.needsUpdate=bask.instanceMatrix.needsUpdate=true;});}
 const blimp=new T.Group(),hull=new T.Mesh(new T.SphereGeometry(7,20,14).scale(2.6,1,1),std({color:0xf4f6ff,roughness:.35,metalness:.2}));blimp.add(hull,new T.Mesh(merge([box(5,.3,8,-15,-.2,0),box(5,7,.3,-15,-3.5,0),box(6,2,2.4,2,-8.6,0)]),std({color:0x2f8bff,roughness:.5})));
 for(const z of [7.05,-7.05]){const b=new T.Mesh(new T.PlaneGeometry(22,3.4),new T.MeshBasicMaterial({map:bannerTex(1),side:T.FrontSide}));b.position.set(0,0,z);b.rotation.y=z>0?0:Math.PI;blimp.add(b);}
 g.add(blimp);anim.push(real=>{const a=real*.03;blimp.position.set(Math.cos(a)*150,48+Math.sin(real*.2)*3,Math.sin(a)*150);blimp.rotation.y=-a-Math.PI/2;});
 backdrop(g,0xffffff,0,0,true);
}
// A ring of far silhouettes so the horizon is never empty.
function backdrop(g,tint,opacity,y,skip){if(skip||!opacity)return;const tex=skylineTexture();tex.repeat.set(6,1);const m=new T.Mesh(new T.CylinderGeometry(640,640,150,48,1,true),new T.MeshBasicMaterial({map:tex,transparent:true,side:T.BackSide,fog:false,depthWrite:false,color:tint,opacity}));m.position.y=y+60;m.renderOrder=-2;g.add(m);}
