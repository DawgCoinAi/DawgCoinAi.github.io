// Street Hustle's open city in 3D: a coastal dog-town you drive through. Sun-bleached stucco by
// day, neon and wet tarmac by night, palms down Ocean Drive, cranes over the docks, glass towers
// uptown. Rules live in hustle-world.js; this module draws them, takes input (keyboard, touch
// steering, auto-drive) and reports what happened (parked, busted, wants the phone) to its owner.
import {T,quality as detectQuality,fitFov,skyMaterial,Stage,Particles,loadModel,cloneModel,fitModel,contactShadowMaterial} from './three-kit.js';
import {STORE_SIGNS,roadTexture,palmGrove,storeSign,skylineBand,glowTexture} from './city-art.js';
import {WorldSim,autopilot,NODES,EDGES,ALLEYS,BEACH,RECTS,STOPS,CUTS,XS,ZS,ROAD_HALF,WALK,ALLEY_HALF,NODE_R,districtAt,routeTo,evadeTime,rectAt,clampPoint} from './hustle-world.js';
import {RADIO,DRIVE_CASH_CAP} from './hustle-drive.js';
import {DISTRICTS} from './engine.js';
import {WEATHER} from './world.js';
import {music} from './arcade-music.js';

const CAR_MODELS=['cars/sedan.glb','cars/taxi.glb','cars/van.glb','cars/suv.glb','cars/delivery.glb','cars/truck.glb'];
const PLAYER_MODEL='cars/hatchback-sports.glb',COP_MODEL='cars/police.glb',MPH=2.237,CURB=.16;
const money=n=>(n<0?'−$':'$')+Math.abs(Math.round(n)).toLocaleString('en-US');
const store={get(k,f){try{const v=localStorage.getItem(k);return v===null?f:v;}catch{return f;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const wrap=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;};
const rnd=seed=>{let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
const rgb=hex=>{const c=new T.Color(hex);return [c.r,c.g,c.b];};
// The sky each kind of night brings (the trade engine's weather index).
export const LOOKS=[
 {name:'clear',top:0x1d63c4,horizon:0xffe6c2,glow:0xfff2d2,sun:0xfff3d0,dir:[-.62,.46,-.32],hemi:[0xe4f1ff,0xa08c70,1.55],key:[0xfff0d2,3.1],fog:0xcfe2f0,density:.0021,water:0x1c86b4,night:0,exposure:1,windows:0,lamps:0,ground:0x6f6a62,rain:false},
 {name:'rain',top:0x05040f,horizon:0x4a1660,glow:0xff4fc0,sun:0xff7ad9,dir:[-.7,.2,-.4],hemi:[0x9a8cff,0x1a1028,1.1],key:[0xc8a8ff,.75],fog:0x1a0c2a,density:.0075,water:0x0c1430,night:1,exposure:1.05,windows:1.25,lamps:1.25,ground:0x1b1824,rain:true},
 {name:'fog',top:0x7d8fa3,horizon:0xd3dadf,glow:0xf0ece2,sun:0xfff6e6,dir:[-.5,.38,-.5],hemi:[0xe2eaf2,0x70706e,1.55],key:[0xfff2e2,1],fog:0xbcc7cf,density:.0105,water:0x4a6474,night:.3,exposure:.95,windows:.3,lamps:.5,ground:0x5d5d5c,rain:false},
 {name:'dusk',top:0x2a1a58,horizon:0xff6a3d,glow:0xffa25a,sun:0xffd08a,dir:[-.86,.085,-.22],hemi:[0xffc9a8,0x4a3050,1.25],key:[0xff9a5a,2.5],fog:0xc0685a,density:.003,water:0x24467a,night:.55,exposure:1,windows:.75,lamps:.8,ground:0x4a3f48,rain:false},
 {name:'night',top:0x020309,horizon:0x16204a,glow:0x5ee7ff,sun:0xcfe0ff,dir:[-.45,.5,-.5],hemi:[0x7a8cff,0x0c0a18,1],key:[0x9fb8ff,.7],fog:0x070a18,density:.0052,water:0x0a1226,night:1,exposure:1.05,windows:1.4,lamps:1.3,ground:0x15151e,rain:false}
];
const SIGNS=[...STORE_SIGNS,['CHEW CHEW DINER','#ff8a3d'],['WOOF WASH','#5ee7ff'],['BARKADE','#b9ff5e'],['SIT & STAY INN','#ff9ad5'],['WAG TOWER','#ffe45e'],['LEASH LOUNGE','#c78bff'],['BISCUIT BANK','#5effc1'],['TREAT STREET','#ff5f7a']];
const DISTRICT_COLORS=['#ffc861','#ff5fc8','#5ee7ff','#fff6e0','#b9ff5e'];
// Stucco, brick and glass tints per district (multiplied over light facades).
const TINTS=[[0xd9a58a,0xe8d3b0,0xc98f7a,0xb7c4c9,0xf0e2c8],[0xf2a6c8,0x9fd8e8,0xf7e3a1,0xc8b6f2,0xffffff,0xffb59a],[0x9aa7ad,0xb5683f,0x7f96a8,0xc9c2b2,0x8a5a48],[0xffffff,0xdfeaf2,0xf3e9dc,0xcfe0ee],[0xa9b28f,0xc7a66b,0x8d8fa8,0xb98a8a,0x7fa39a]];
const HEIGHTS=[[9,17],[13,32],[6,11],[22,56],[8,15]];

// Collects quads into one geometry: a whole city's worth of boxes in a single draw call.
class Mesher{constructor(){this.p=[];this.n=[];this.u=[];this.c=[];this.i=[];}
 quad(v,n,col,uv){const k=this.p.length/3;for(let j=0;j<4;j++){this.p.push(v[j][0],v[j][1],v[j][2]);this.n.push(n[0],n[1],n[2]);this.u.push(uv?uv[j][0]:0,uv?uv[j][1]:0);this.c.push(col[0],col[1],col[2]);}this.i.push(k,k+1,k+2,k,k+2,k+3);}
 flat(x0,z0,x1,z1,y,col,uv){this.quad([[x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0]],[0,1,0],col,uv);}
 // Box sides; uv(len, face) returns [u0,u1] for a wall `len` metres wide, vScale maps height to v.
 walls(x0,y0,z0,x1,y1,z1,col,uv=null,vScale=1/64){const f=(a,b,c,d,n,len,k)=>{const u=uv?uv(len,k):[0,0];this.quad([a,b,c,d],n,col,[[u[0],y0*vScale],[u[1],y0*vScale],[u[1],y1*vScale],[u[0],y1*vScale]]);};
  f([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],z1-z0,0);f([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],z1-z0,1);
  f([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],x1-x0,2);f([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],x1-x0,3);}
 box(x0,y0,z0,x1,y1,z1,col,top=col){this.walls(x0,y0,z0,x1,y1,z1,col);this.flat(x0,z0,x1,z1,y1,top);}
 build(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(this.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.u,2));g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));g.setIndex(this.i);g.computeBoundingSphere();return g;}}
function paint(w,h,draw,{repeat=false,color=true}={}){const el=document.createElement('canvas');el.width=w;el.height=h;draw(el.getContext('2d'),w,h);const t=new T.CanvasTexture(el);if(color)t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
// A facade tile: 16 m of wall across, 64 m (20 floors) up, shopfronts along the bottom. The lit
// copy holds only the glowing windows. Variants: stucco, banded brick, balconies, glass curtain.
function facadeTexture(v,lit,scale){const W=256*scale,H=512*scale,r=rnd(900+v*17);
 const t=paint(W,H,(c,w,h)=>{const floors=20,fh=h/floors,bays=4,bw=w/bays;
  c.fillStyle=lit?'#000':v===3?'#27506a':v===1?'#d9d2c6':'#ece6dc';c.fillRect(0,0,w,h);
  if(!lit&&v!==3){for(let i=0;i<1400*scale;i++){c.fillStyle=r()>.5?'rgba(255,255,255,.05)':'rgba(40,30,20,.05)';c.fillRect(r()*w,r()*h,2+r()*5,1+r()*3);}
   for(let f=1;f<floors;f++){c.fillStyle=v===1?'rgba(60,40,30,.22)':'rgba(40,30,30,.10)';c.fillRect(0,h-f*fh-1,w,v===1?3:2);}}
  for(let f=0;f<floors;f++){const y=h-(f+1)*fh;
   if(f===0){ // shopfronts: big panes, a door, a sill
    for(let b=0;b<bays;b++){const x=b*bw;if(lit){c.fillStyle=['#ffd9a0','#bfeaff','#ffc0e0','#fff0c0'][Math.floor(r()*4)];c.globalAlpha=.85;c.fillRect(x+bw*.1,y+fh*.18,bw*.8,fh*.62);c.globalAlpha=1;}
     else{c.fillStyle='#22303c';c.fillRect(x+bw*.08,y+fh*.14,bw*.84,fh*.7);c.fillStyle='rgba(160,210,240,.22)';c.fillRect(x+bw*.1,y+fh*.18,bw*.8,fh*.3);c.fillStyle='#1a1f26';c.fillRect(x+bw*.48,y+fh*.14,bw*.04,fh*.7);c.fillStyle='rgba(30,25,25,.5)';c.fillRect(x,y+fh*.9,bw,fh*.1);}}
    continue;}
   for(let b=0;b<bays;b++){const x=b*bw,on=r()>.52,tone=r();
    if(v===3){ // curtain wall: panes edge to edge
     if(lit){if(on&&tone>.35){c.fillStyle=tone>.9?'#8eeaff':'#ffe2b0';c.globalAlpha=.25+tone*.5;c.fillRect(x+1,y+2,bw-2,fh-3);c.globalAlpha=1;}}
     else{c.fillStyle=`rgb(${28+tone*30|0},${78+tone*40|0},${110+tone*45|0})`;c.fillRect(x+1,y+1,bw-2,fh-2);c.fillStyle='rgba(255,255,255,.10)';c.fillRect(x+1,y+1,bw-2,fh*.25);}
     continue;}
    const wx=x+bw*(v===2?.14:.22),ww=bw*(v===2?.72:.56),wy=y+fh*.2,wh=fh*(v===2?.62:.55);
    if(lit){if(on){c.fillStyle=tone>.92?'#8eeaff':tone>.84?'#ff9ad5':tone>.5?'#ffd9a0':'#fff0cf';c.globalAlpha=.55+tone*.45;c.fillRect(wx,wy,ww,wh);c.globalAlpha=1;}}
    else{c.fillStyle='#33475a';c.fillRect(wx,wy,ww,wh);c.fillStyle='rgba(190,225,250,.28)';c.fillRect(wx,wy,ww,wh*.42);c.fillStyle='rgba(255,255,255,.55)';c.fillRect(wx-2,wy+wh,ww+4,Math.max(2,fh*.05));
     if(v===2){c.fillStyle='rgba(70,60,60,.55)';c.fillRect(x+bw*.08,wy+wh*.72,bw*.84,fh*.09);}
     if(v===0&&tone>.7){c.fillStyle='rgba(40,120,110,.55)';c.fillRect(wx-bw*.07,wy,bw*.06,wh);c.fillRect(wx+ww+bw*.01,wy,bw*.06,wh);}}}}
 });t.wrapS=T.RepeatWrapping;t.wrapT=T.ClampToEdgeWrapping;return t;}
function asphaltTexture(){const r=rnd(5);return paint(256,256,(c,w,h)=>{c.fillStyle='#2b2930';c.fillRect(0,0,w,h);for(let i=0;i<1800;i++){const v=38+r()*38|0;c.fillStyle=`rgba(${v},${v},${v+6},.35)`;c.fillRect(r()*w,r()*h,2,2);}for(let i=0;i<5;i++){c.fillStyle='rgba(10,10,16,.3)';c.beginPath();c.ellipse(r()*w,r()*h,10+r()*26,14+r()*40,r()*3,0,7);c.fill();}},{repeat:true});}
function iconTexture(kind,color){return paint(256,256,(c,w)=>{c.clearRect(0,0,w,w);c.shadowColor=color;c.shadowBlur=26;c.fillStyle='#0a0a14e0';c.beginPath();c.arc(128,128,92,0,7);c.fill();c.lineWidth=9;c.strokeStyle=color;c.stroke();c.shadowBlur=8;c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';
  if(kind==='market'){c.font='900 124px system-ui,sans-serif';c.fillText('$',128,136);}
  else{c.lineWidth=13;c.lineCap='round';c.strokeStyle='#fff';c.beginPath();c.moveTo(84,172);c.lineTo(150,106);c.stroke();c.fillStyle=color;c.beginPath();c.arc(164,92,26,0,7);c.fill();c.fillStyle='#fff';for(const [x,y] of [[70,96],[92,70],[60,128]]){c.beginPath();c.arc(x,y,7,0,7);c.fill();}}});}
function beamTexture(){return paint(8,128,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#ffffff00');g.addColorStop(.75,'#ffffff55');g.addColorStop(1,'#ffffffcc');c.fillStyle=g;c.fillRect(0,0,w,h);});}
function headlightTexture(){return paint(128,256,(c,w,h)=>{const g=c.createRadialGradient(64,236,4,64,150,170);g.addColorStop(0,'#ffffffee');g.addColorStop(.35,'#ffffff66');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.beginPath();c.moveTo(48,250);c.lineTo(80,250);c.lineTo(126,10);c.lineTo(2,10);c.closePath();c.fill();});}
function arrowTexture(){return paint(64,64,(c,w)=>{c.clearRect(0,0,w,w);c.strokeStyle='#fff';c.lineWidth=11;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(12,44);c.lineTo(32,18);c.lineTo(52,44);c.stroke();});}

// Builds the static city into `w` (the HustleWorld): ground, blocks, buildings, signs, palms, lamps,
// landmarks, stop markers. Everything static is merged into a handful of meshes.
export function buildCity(w){const s=w.scene,high=w.quality==='high',R=rnd(20260);
  // Ground: tarmac, junctions, alleys; block slabs with their curbs; sand down to the water.
  const road=new Mesher(),plain=new Mesher(),props=new Mesher(),glow=new Mesher(),W=ROAD_HALF,grey=[.62,.6,.57],white=[.86,.86,.84];
  for(const e of EDGES){const a=NODES[e.a],b=NODES[e.b];if(e.horizontal){const x0=a.x+W,x1=b.x-W;road.flat(x0,a.z-W,x1,a.z+W,0,[1,1,1],[[0,x0/16],[0,x1/16],[1,x1/16],[1,x0/16]]);}else{const z0=a.z+W,z1=b.z-W;road.flat(a.x-W,z0,a.x+W,z1,0,[1,1,1],[[0,z1/16],[1,z1/16],[1,z0/16],[0,z0/16]]);}}
  for(const n of NODES){plain.flat(n.x-W,n.z-W,n.x+W,n.z+W,0,[1,1,1],[[0,0],[.9,0],[.9,.9],[0,.9]]);
   // Zebra crossings on every arm that has a street.
   for(const m of n.links){const o=NODES[m],dx=Math.sign(o.x-n.x),dz=Math.sign(o.z-n.z);for(let k=-3;k<=3;k++){const c=k*1.8;if(dx)props.flat(n.x+dx*(W+.6)-(dx<0?2.6:0),n.z+c-.45,n.x+dx*(W+.6)+(dx>0?2.6:0),n.z+c+.45,.012,white);else props.flat(n.x+c-.45,n.z+dz*(W+.6)-(dz<0?2.6:0),n.x+c+.45,n.z+dz*(W+.6)+(dz>0?2.6:0),.012,white);}}}
  for(const a of ALLEYS){const x0=Math.min(a.x0,a.x1)-ALLEY_HALF,x1=Math.max(a.x0,a.x1)+ALLEY_HALF,z0=Math.min(a.z0,a.z1)-ALLEY_HALF,z1=Math.max(a.z0,a.z1)+ALLEY_HALF;plain.flat(x0,z0,x1,z1,CURB+.012,[.72,.7,.72],[[x0/14,z1/14],[x1/14,z1/14],[x1/14,z0/14],[x0/14,z0/14]]);}
  // Slabs: everything between the streets, raised a curb's height (the sidewalks are their rims).
  const slab=(x0,z0,x1,z1)=>props.box(x0,-.3,z0,x1,CURB,z1,[.42,.41,.4],grey);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)slab(XS[i]+W,ZS[j]+W,XS[i+1]-W,ZS[j+1]-W);
  for(const [ka,kb] of CUTS){const a=NODES[ka],b=NODES[kb];if(a.j===b.j)slab(a.x+W,a.z-W,b.x-W,a.z+W);else slab(a.x-W,a.z+W,a.x+W,b.z-W);}
  slab(XS[0]-W,ZS[0]-W-60,XS[4]+W+60,ZS[0]-W);slab(XS[0]-W,ZS[4]+W,XS[4]+W+60,ZS[4]+W+60);slab(XS[4]+W,ZS[0]-W,XS[4]+W+60,ZS[4]+W);
  // Ocean Drive's seaward sidewalk, then the beach sloping into the surf.
  const sand=[.93,.8,.6];props.box(XS[0]-W-WALK,-.3,ZS[0]-W-60,XS[0]-W,CURB,ZS[4]+W+60,[.42,.41,.4],grey);props.flat(BEACH.x0-2,ZS[0]-W-60,XS[0]-W-WALK,ZS[4]+W+60,.02,sand);
  props.quad([[BEACH.x0-34,-1.1,ZS[4]+W+60],[BEACH.x0-2,.02,ZS[4]+W+60],[BEACH.x0-2,.02,ZS[0]-W-60],[BEACH.x0-34,-1.1,ZS[0]-W-60]],[.03,1,0],sand);
  // Buildings: rows of lots round every block, set back behind the sidewalk, never on anything drivable.
  const fac=[0,1,2,3].map(()=>new Mesher()),lots=[],signSpots=[];
  const stalls=STOPS.map(q=>({x:q.x+Math.cos(q.h)*5.4,z:q.z+Math.sin(q.h)*5.4,q})),free=(x0,z0,x1,z1)=>!RECTS.some(r=>x0<r.x1+.4&&x1>r.x0-.4&&z0<r.z1+.4&&z1>r.z0-.4)&&!stalls.some(q=>q.x>x0-4.5&&q.x<x1+4.5&&q.z>z0-4.5&&q.z<z1+4.5);
  const lot=(x0,z0,x1,z1,face,scale=1)=>{if(!free(x0,z0,x1,z1))return;const cx=(x0+x1)/2,cz=(z0+z1)/2,d=districtAt(cx,cz),[lo,hi]=HEIGHTS[d],h=Math.min(63,(lo+Math.pow(R(),1.6)*(hi-lo))*scale),tints=TINTS[d],tint=rgb(tints[Math.floor(R()*tints.length)]);
   const v=d===3?(R()<.62?3:2):d===2?1:d===1?(R()<.45?2:0):d===4?(R()<.5?1:0):Math.floor(R()*3),off=Math.floor(R()*4)/4,m=fac[v],col=v===3?[1,1,1]:tint;
   m.walls(x0,CURB,z0,x1,h,z1,col,len=>[off,off+Math.max(1,Math.round(len/4))/4]);props.flat(x0,z0,x1,z1,h,[.34,.33,.35]);
   // Roof clutter and a parapet give the skyline some teeth.
   props.box(x0,h,z0,x1,h+.5,z0+.4,[.5,.48,.46]);props.box(x0,h,z1-.4,x1,h+.5,z1,[.5,.48,.46]);if(R()<.7){const rx=x0+2+R()*(x1-x0-7),rz=z0+2+R()*(z1-z0-7);props.box(rx,h,rz,rx+3+R()*2,h+1.4+R()*2,rz+3,[.55,.55,.58]);}
   if(d===3&&h>40){glow.box(cx-.3,h,cz-.3,cx+.3,h+7,cz+.3,[2.4,.5,.5]);}
   // Awnings over the shopfronts on the street side.
   if(face&&v!==3&&R()<.75){const ac=rgb([0xff5f7a,0x2fb7a6,0xffc861,0xff8a3d,0x5e8cff,0xffffff][Math.floor(R()*6)]),[fx,fz]=face,y0=3.3,y1=3.75;if(fx)props.box(fx>0?x1:x0-1.5,y0,z0+1,fx>0?x1+1.5:x0,y1,z1-1,ac);else props.box(x0+1,y0,fz>0?z1:z0-1.5,x1-1,y1,fz>0?z1+1.5:z0,ac);}
   if(face&&d===1){const [fx,fz]=face,nc=rgb(['#ff5fc8','#5ee7ff','#b9ff5e','#ffc861'][Math.floor(R()*4)]).map(c=>c*2.2),t=.18;if(fx)glow.box(fx>0?x1:x0-t,h-.6,z0,fx>0?x1+t:x0,h-.3,z1,nc);else glow.box(x0,h-.6,fz>0?z1:z0-t,x1,h-.3,fz>0?z1+t:z0,nc);}
   lots.push({x0,z0,x1,z1,h,d});if(face)signSpots.push({x:face[0]?(face[0]>0?x1+.25:x0-.25):cx,z:face[1]?(face[1]>0?z1+.25:z0-.25):cz,nx:face[0],nz:face[1],w:Math.abs(face[0]?z1-z0:x1-x0),h,d});};
  const SET=W+WALK+.4;
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){const x0=XS[i]+SET,x1=XS[i+1]-SET,z0=ZS[j]+SET,z1=ZS[j+1]-SET,n=5,wd=(x1-x0)/n,dn=18+R()*8,ds=18+R()*8;
   for(let k=0;k<n;k++){lot(x0+k*wd,z0,x0+(k+1)*wd-.6,z0+dn+R()*5,[0,-1]);lot(x0+k*wd,z1-ds-R()*5,x0+(k+1)*wd-.6,z1,[0,1]);}
   const zz0=z0+dn+7,zz1=z1-ds-7,m=3,l=(zz1-zz0)/m;for(let k=0;k<m;k++){lot(x0,zz0+k*l,x0+17+R()*7,zz0+(k+1)*l-.6,[-1,0]);lot(x1-17-R()*7,zz0+k*l,x1,zz0+(k+1)*l-.6,[1,0]);}
   const d=districtAt((x0+x1)/2,(z0+z1)/2);if(d===3||d===1)lot((x0+x1)/2-14,(z0+z1)/2-14,(x0+x1)/2+14,(z0+z1)/2+14,null,d===3?1.25:1.1);}
  // The far sides of the outer streets, so the city has edges instead of a void.
  for(let x=XS[0]+SET;x<XS[4]+60;x+=25){lot(x,ZS[0]-SET-22-R()*6,x+24,ZS[0]-SET,[0,1]);lot(x,ZS[4]+SET,x+24,ZS[4]+SET+22+R()*6,[0,-1]);}
  for(let z=ZS[0]-SET;z<ZS[4]+SET-20;z+=25)lot(XS[4]+SET,z,XS[4]+SET+22+R()*6,z+24,[-1,0]);
  // The docks: container stacks and gantry cranes on the north-west waterfront.
  const crate=[0xc8553d,0x2f7f9f,0xd9a441,0x4c8f5a,0x8a4f8f,0xd0d0d0];for(let k=0;k<26;k++){const x=BEACH.x0+2+R()*26,z=ZS[0]-W-52+R()*42,n=1+Math.floor(R()*3),c=rgb(crate[Math.floor(R()*6)]);for(let y=0;y<n;y++)props.box(x,.02+y*2.6,z,x+2.5,.02+y*2.6+2.5,z+6.1,c.map(v=>v*(1-y*.08)));}
  for(const cz of [ZS[0]-W-40,ZS[0]-W-14]){const cx=BEACH.x0-10,red=[.82,.25,.18];for(const o of [-5,5]){props.box(cx+o-.6,-1,cz-5,cx+o+.6,24,cz-3.8,red);props.box(cx+o-.6,-1,cz+3.8,cx+o+.6,24,cz+5,red);}props.box(cx-22,24,cz-1,cx+12,25.6,cz+1,red);props.box(cx-6,25.6,cz-1.6,cx+6,28,cz+1.6,[.9,.9,.88]);glow.box(cx-22.4,25,cz-.3,cx-22,25.6,cz+.3,[3,.4,.3]);}
  // The pier, straight out from Center Street.
  props.box(BEACH.x0-70,-2,-6,BEACH.x0-2,.5,6,[.5,.38,.28],[.62,.48,.34]);
  // The tunnel under Low Road: roof, walls and strip lights.
  const tz=ZS[4],tx0=XS[1]+NODE_R+3,tx1=XS[2]-NODE_R-3;props.box(tx0,6.2,tz-W-WALK-.5,tx1,7.4,tz+W+WALK+.5,[.36,.36,.4],[.3,.42,.3]);props.box(tx0,CURB,tz-W-WALK-.5,tx1,6.2,tz-W-WALK+.1,[.3,.3,.34]);props.box(tx0,CURB,tz+W+WALK-.1,tx1,6.2,tz+W+WALK+.5,[.3,.3,.34]);
  for(let x=tx0+6;x<tx1-4;x+=12)for(const o of [-4.5,4.5])glow.box(x,6.02,tz+o-.25,x+5,6.14,tz+o+.25,[2.6,2.3,1.5]);for(const x of [tx0-.2,tx1])glow.box(x,5.6,tz-W-WALK,x+.2,6.2,tz+W+WALK,[.6,2.6,.9]);
  // Dealer stalls and spray shops at the marked spots.
  for(const {x:bx,z:bz,q} of stalls){const c=rgb(q.kind==='market'?DISTRICT_COLORS[q.district]:'#ff5fc8');if(rectAt(bx,bz,-1.2))continue;
   props.box(bx-2.2,CURB,bz-2.2,bx+2.2,CURB+1,bz+2.2,[.3,.24,.2]);props.box(bx-2.6,CURB+2.5,bz-2.6,bx+2.6,CURB+2.8,bz+2.6,c.map(v=>v*.8));for(const [px,pz] of [[-2.3,-2.3],[2.3,-2.3],[-2.3,2.3],[2.3,2.3]])props.box(bx+px-.08,CURB,bz+pz-.08,bx+px+.08,CURB+2.5,bz+pz+.08,[.2,.2,.22]);glow.box(bx-2.6,CURB+2.8,bz-2.6,bx+2.6,CURB+2.88,bz+2.6,c.map(v=>v*2));}
  const mats=w.mats={};
  mats.road=new T.MeshStandardMaterial({map:roadTexture(),vertexColors:true,roughness:.5,metalness:.2});mats.plain=new T.MeshStandardMaterial({map:asphaltTexture(),vertexColors:true,roughness:.6,metalness:.15});
  mats.props=new T.MeshStandardMaterial({vertexColors:true,roughness:.85,metalness:.02});mats.glow=new T.MeshBasicMaterial({vertexColors:true,toneMapped:false});
  const texScale=high?2:1;mats.fac=[0,1,2,3].map(v=>new T.MeshStandardMaterial({map:facadeTexture(v,false,texScale),emissiveMap:facadeTexture(v,true,texScale),emissive:0xffffff,emissiveIntensity:0,vertexColors:true,roughness:v===3?.22:.82,metalness:v===3?.7:.03,envMapIntensity:v===3?1.3:.5}));
  const add=(m,mat,shadow=false)=>{if(!m.p.length)return null;const mesh=new T.Mesh(m.build(),mat);if(high){mesh.receiveShadow=true;mesh.castShadow=shadow;}s.add(mesh);return mesh;};
  add(road,mats.road);add(plain,mats.plain);add(props,mats.props,true);add(glow,mats.glow);fac.forEach((m,v)=>add(m,mats.fac[v],true));w.lots=lots;
  // Neon signs: one merged mesh per sign text, hung on street-facing walls; billboards on tall roofs.
  const signCount=high?64:30,byText=new Map();w.signMats=[];
  for(let k=signSpots.length-1;k>0;k--){const j=Math.floor(R()*(k+1));[signSpots[k],signSpots[j]]=[signSpots[j],signSpots[k]];}let placed=0;
  for(const q of signSpots){if(placed>=signCount)break;if(q.w<12||q.d===2&&R()<.6)continue;
   const [text,color]=SIGNS[Math.floor(R()*SIGNS.length)];let b=byText.get(text);if(!b){const proto=storeSign(text,color,1);b={m:new Mesher(),mat:proto.material,aspect:proto.geometry.parameters.height,n:0};proto.geometry.dispose();byText.set(text,b);}
   const big=q.h>24&&R()<.5,sw=Math.min(q.w-2,big?13:6+R()*3),h=sw*b.aspect,y=big?q.h+1+h/2:Math.min(q.h-1.2,4.6+R()*2.6),rx=q.nz,rz=-q.nx,x=q.x+(big?-q.nx*1.2:0),z=q.z+(big?-q.nz*1.2:0);
   b.m.quad([[x-rx*sw/2,y-h/2,z-rz*sw/2],[x+rx*sw/2,y-h/2,z+rz*sw/2],[x+rx*sw/2,y+h/2,z+rz*sw/2],[x-rx*sw/2,y+h/2,z-rz*sw/2]],[q.nx,0,q.nz],[1,1,1],[[0,0],[1,0],[1,1],[0,1]]);b.n++;placed++;}
  for(const b of byText.values()){if(!b.n)continue;const mesh=new T.Mesh(b.m.build(),b.mat);s.add(mesh);w.signMats.push(b.mat);}
  // Palms: both sides of Ocean Drive, lines down Main Bark and Hilltop, clusters on the sand and in the plazas.
  const palms=[];for(let z=ZS[0]-40;z<ZS[4]+40;z+=high?13:19){if(!NODES.some(n=>n.i===0&&Math.abs(n.z-z)<12)){palms.push([XS[0]+8.6,z,.9+R()*.3,R()*6]);}palms.push([XS[0]-8.8,z+5,.95+R()*.35,R()*6]);if(R()<.5)palms.push([BEACH.x0+4+R()*20,z+R()*8,.8+R()*.4,R()*6]);}
  for(const e of EDGES){if(e.horizontal||NODES[e.a].i!==2&&NODES[e.a].i!==4)continue;const a=NODES[e.a];for(let z=a.z+22;z<a.z+120;z+=high?24:48)for(const o of [-8.7,8.7])palms.push([a.x+o,z,.8+R()*.25,R()*6]);}
  for(const [a,b] of CUTS){const A=NODES[a],B=NODES[b];for(let k=1;k<6;k++)palms.push([A.x+(B.x-A.x)*k/6+(R()-.5)*8,A.z+(B.z-A.z)*k/6+(R()-.5)*8,.85+R()*.4,R()*6]);}
  w.palms=palmGrove(palms);w.palms.children.forEach(m=>{m.position.y=CURB;if(high)m.castShadow=true;});s.add(w.palms);
  // Street lamps: poles, glows, and at night a pool of light on the tarmac under each.
  const lamps=[];for(const e of EDGES){const a=NODES[e.a],step=high?28:42;for(let u=NODE_R+10,k=0;u<140-NODE_R-6;u+=step,k++){const side=k%2?1:-1,x=e.horizontal?a.x+u:a.x+side*8.3,z=e.horizontal?a.z+side*8.3:a.z+u;lamps.push({x,z,px:e.horizontal?x:a.x+side*4.6,pz:e.horizontal?a.z+side*4.6:z,tunnel:e.tunnel});}}
  const outdoor=lamps.filter(l=>!l.tunnel),m4=new T.Matrix4(),poles=new T.InstancedMesh(new T.CylinderGeometry(.07,.1,6.2,6).translate(0,3.1+CURB,0),new T.MeshStandardMaterial({color:0x2a2a34,roughness:.6,metalness:.6}),outdoor.length);outdoor.forEach((l,i)=>poles.setMatrixAt(i,m4.makeTranslation(l.x,0,l.z)));s.add(poles);
  w.lampGlow=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(outdoor.flatMap(l=>[(l.x+l.px)/2,6.3,(l.z+l.pz)/2]),3)),new T.PointsMaterial({map:w.glowTex,size:2,color:0xffe2a8,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));s.add(w.lampGlow);
  w.lampPools=new T.InstancedMesh(new T.PlaneGeometry(15,15).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:w.glowTex,color:0xffc980,transparent:true,opacity:.3,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),outdoor.length);outdoor.forEach((l,i)=>w.lampPools.setMatrixAt(i,m4.makeTranslation(l.px,.03,l.pz)));w.lampPools.renderOrder=1;s.add(w.lampPools);
  // The big wheel at the end of the pier.
  const wheel=w.wheel=new T.Group(),wm=new T.MeshStandardMaterial({color:0xf2f2f2,roughness:.5,metalness:.4}),rim=new T.Mesh(new T.TorusGeometry(17,.35,6,40),wm);wheel.add(rim);for(let k=0;k<8;k++){const sp=new T.Mesh(new T.BoxGeometry(34,.22,.22),wm);sp.rotation.z=k*Math.PI/8;wheel.add(sp);}
  const cabins=[];for(let k=0;k<16;k++){const a=k/16*Math.PI*2;cabins.push(Math.cos(a)*17,Math.sin(a)*17,0);}w.cabins=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(cabins,3)),new T.PointsMaterial({map:w.glowTex,size:5,color:0xff7ad9,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));wheel.add(w.cabins);
  wheel.position.set(BEACH.x0-58,20.5,0);wheel.rotation.y=Math.PI/2;s.add(wheel);const legs=new T.Mesh(new T.CylinderGeometry(.4,2.6,20,4,1,true),wm);legs.position.set(BEACH.x0-58,10.4,0);s.add(legs);
  // Markers at the stops: a ring on the ground, a beam and a floating icon.
  const beamTex=beamTexture();
  w.markers=STOPS.map(q=>{const color=q.kind==='market'?DISTRICT_COLORS[q.district]:'#ff5fc8',g=new T.Group(),c=new T.Color(color);
   const ring=new T.Mesh(new T.RingGeometry(q.r-1.1,q.r-.5,48).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:c.clone().multiplyScalar(1.15),transparent:true,opacity:.85,depthWrite:false,toneMapped:false,side:T.DoubleSide}));ring.position.y=CURB+.05;
   const beam=new T.Mesh(new T.CylinderGeometry(1.3,1.3,26,16,1,true),new T.MeshBasicMaterial({map:beamTex,color:c.clone().multiplyScalar(.8),transparent:true,opacity:.3,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false,fog:false}));beam.position.y=13;
   const icon=new T.Sprite(new T.SpriteMaterial({map:iconTexture(q.kind,color),transparent:true,depthWrite:false,toneMapped:false,fog:false}));icon.position.y=6.4;icon.scale.setScalar(3.4);g.add(ring,beam,icon);g.position.set(q.x,0,q.z);s.add(g);return {g,ring,beam,icon,stop:q};});
  // GPS chevrons laid along the route.
  w.arrows=new T.InstancedMesh(new T.PlaneGeometry(2.6,2.6).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:arrowTexture(),color:new T.Color(2.2,1.9,.5),transparent:true,depthWrite:false,toneMapped:false,opacity:.9}),40);w.arrows.count=0;w.arrows.frustumCulled=false;w.arrows.renderOrder=2;s.add(w.arrows);
  // Pedestrians: little dawgs on the sidewalks, one instanced mesh.
  const pm=new Mesher(),wht=[1,1,1],dk=[.35,.3,.3];pm.box(-.24,.42,-.16,.24,1.02,.16,wht);pm.box(-.22,1.02,-.2,.22,1.44,.2,wht);pm.box(-.1,1.1,.2,.1,1.28,.36,[.9,.85,.8]);pm.box(-.24,1.4,-.08,-.1,1.66,.06,dk);pm.box(.1,1.4,-.08,.24,1.66,.06,dk);pm.box(-.2,0,-.1,-.06,.42,.06,dk);pm.box(.06,0,-.1,.2,.42,.06,dk);
  const count=high?90:40;w.peds=new T.InstancedMesh(pm.build(),new T.MeshStandardMaterial({vertexColors:true,roughness:.8}),count);w.peds.frustumCulled=false;if(high)w.peds.castShadow=true;s.add(w.peds);const coat=[0xf2c48a,0xd9a05b,0x8a5a3c,0xf5f0e6,0x4a4a55,0xc98f7a,0xffd27a,0x9fd8e8,0xff9ad5,0xb9ff5e],col=new T.Color();
  w.walkers=Array.from({length:count},(_,i)=>{const e=EDGES[Math.floor(R()*EDGES.length)];w.peds.setColorAt(i,col.set(coat[Math.floor(R()*coat.length)]));return {e,side:R()<.5?-1:1,u:NODE_R+R()*(140-NODE_R*2),v:(R()<.5?-1:1)*(1+R()*.8),phase:R()*6,dodge:0};});}
export {Mesher,paint,headlightTexture,CAR_MODELS,PLAYER_MODEL,COP_MODEL,MPH,CURB,money,store,clamp,wrap,rnd,DISTRICT_COLORS};
