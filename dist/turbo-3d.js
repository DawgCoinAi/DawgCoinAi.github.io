// Three.js presentation for DAWG Turbo Pup. TurboGame owns the rules; this module reads the pup and
// the seeded course and draws a ribbon of track through four skies from a chase camera that rides
// the track's own frame, so loops and corkscrews turn the world over. Nothing here changes a rule.
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,smooth,quality,fitFov,texture,radial,glowStops,merge,pbr,Stage,Particles,Hud,AmbientLoop} from './three-kit.js';
import {TURBO,STAGES,FEATS,RIVALS,stageName,kmh,turboChunk,chunkAt,frameIn,crossSection,halfWidthIn,laneX,deckHeight,railHeight,floorIn} from './turbo-engine.js';
import {hash} from './world.js';
import {npcDawg} from './npc-dawg.js';
import {heatLabel} from './difficulty.js';

const LW=TURBO.lane,AHEAD=4,GROUND=-90,CP=TURBO.checkpoint;
// Four postcards, one per checkpoint, then round again.
const ZONES=[
 {name:'SUNSET BOARDWALK',top:'#1d2f7a',mid:'#c8527a',horizon:'#ffab5e',sun:'#ffd9a0',sunDir:[-.35,.13,.92],sunSize:.0035,fog:'#8a4f63',fogD:.003,hemiSky:'#ffc9a8',hemiGround:'#3a2a55',hemi:1.25,key:'#ffd2a0',keyI:3,env:.55,clouds:.55,stars:0,aurora:0,ground:[1,0,0],gA:'#12314f',gB:'#ff9d5c',edgeA:'#ff8a3d',edgeB:'#3fe0ff',tints:['#ffd28a','#ff9a6a','#ffe7b8'],lit:.42,density:.5,tall:[-40,6],wall:'#3b3050',exposure:1.02},
 {name:'NEON DOWNTOWN',top:'#04051a',mid:'#1c0f4a',horizon:'#7a2bb8',sun:'#e8ecff',sunDir:[.5,.5,.7],sunSize:.0012,fog:'#170b38',fogD:.0034,hemiSky:'#7f8cff',hemiGround:'#3a1048',hemi:.95,key:'#c8d4ff',keyI:2,env:.8,clouds:.18,stars:1,aurora:0,ground:[0,1,0],gA:'#090a1c',gB:'#ffb060',edgeA:'#ff3fc0',edgeB:'#3fe8ff',tints:['#5ee7ff','#ff5fc8','#ffd27a','#b9ff5e'],lit:.5,density:1,tall:[-20,95],wall:'#151a33',exposure:1.05},
 {name:'STORM SKYWAY',top:'#070b16',mid:'#27324a',horizon:'#6f84a8',sun:'#dfe8ff',sunDir:[.2,.3,.93],sunSize:.0,fog:'#2c3649',fogD:.0044,hemiSky:'#a9bedf',hemiGround:'#1b2233',hemi:1.1,key:'#cfe0ff',keyI:1.7,env:.5,clouds:1,stars:0,aurora:0,ground:[0,0,1],gA:'#2c3850',gB:'#93a6c8',edgeA:'#ffe45e',edgeB:'#ffffff',tints:['#dfe8ff','#ffe9a0'],lit:.16,density:.55,tall:[10,130],wall:'#1a2030',exposure:1.05,storm:1},
 {name:'AURORA REACH',top:'#020a14',mid:'#06323a',horizon:'#1f8f86',sun:'#e8fff4',sunDir:[-.5,.42,.75],sunSize:.001,fog:'#082c36',fogD:.0033,hemiSky:'#8fffe0',hemiGround:'#10243a',hemi:.95,key:'#bfffe8',keyI:2.1,env:.7,clouds:.12,stars:1,aurora:1,ground:[1,0,0],gA:'#041a24',gB:'#5effc1',edgeA:'#5effc1',edgeB:'#c78bff',tints:['#5effc1','#8eeaff','#c78bff'],lit:.34,density:.7,tall:[-30,60],wall:'#10222c',exposure:1.05}];
ZONES.forEach((z,i)=>{z.name=STAGES[i];});
const zoneAt=s=>ZONES[((Math.floor(Math.max(0,s)/CP)%ZONES.length)+ZONES.length)%ZONES.length];
const NOISE='float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(17.,9.);a*=.5;}return s;}';
// Sky: three-stop gradient, a sun or moon with a wide glow, drifting cloud banks, stars, an aurora and lightning.
const SKY={uniforms:{uTop:{value:new T.Color()},uMid:{value:new T.Color()},uHorizon:{value:new T.Color()},uSun:{value:new T.Color()},uSunDir:{value:new T.Vector3(0,.3,1)},uSunSize:{value:.03},uClouds:{value:.5},uStars:{value:0},uAurora:{value:0},uFlash:{value:0},uTime:{value:0}},
 vertexShader:'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`uniform vec3 uTop,uMid,uHorizon,uSun,uSunDir;uniform float uSunSize,uClouds,uStars,uAurora,uFlash,uTime;varying vec3 vDir;${NOISE}
 void main(){vec3 d=normalize(vDir);float y=d.y;vec3 col=mix(uHorizon,uMid,smoothstep(-.02,.22,y));col=mix(col,uTop,smoothstep(.16,.75,y));col=mix(col,uHorizon*.55,smoothstep(0.,-.25,y));
 float sd=max(dot(d,normalize(uSunDir)),0.);col+=uSun*(pow(sd,8.)*.16+pow(sd,90.)*.35);col+=uSun*2.2*smoothstep(1.-uSunSize,1.-uSunSize*.8,sd)*step(.0001,uSunSize);
 float st=step(.9972,h21(floor(d.xz/(abs(y)+.35)*150.)))*smoothstep(.02,.3,y);col+=vec3(.9,.92,1.)*st*uStars*(.5+.5*sin(uTime*2.+d.x*80.));
 vec2 cu=d.xz/(max(y,0.)+.16);float c=fbm(cu*1.4+vec2(uTime*.012,0.));float cm=smoothstep(1.02-uClouds*.62,1.25-uClouds*.5,c+.42)*smoothstep(-.02,.12,y);
 vec3 cc=mix(uMid*.55+uHorizon*.25,uHorizon*1.05+uSun*.35*pow(sd,3.),smoothstep(.45,.9,c));col=mix(col,cc*(1.+uFlash*2.5),cm*.92);
 float au=fbm(vec2(d.x*2.4+uTime*.03,d.z*1.2))*smoothstep(.08,.3,y)*smoothstep(.85,.4,y);float band=pow(smoothstep(.35,.8,au+.25*sin(d.x*9.+uTime*.2+au*6.)),2.);col+=mix(vec3(.1,1.,.6),vec3(.6,.3,1.),smoothstep(.3,.7,y))*band*uAurora*.75;
 col+=uFlash*vec3(.5,.56,.7)*smoothstep(-.1,.5,y);gl_FragColor=vec4(col,1.);}`};
// The world far below: open water with the sun on it, a grid of city lights, or a sea of cloud.
const FLOOR={uniforms:{uA:{value:new T.Color()},uB:{value:new T.Color()},uFog:{value:new T.Color()},uMode:{value:new T.Vector3(1,0,0)},uSunDir:{value:new T.Vector3(0,.3,1)},uSun:{value:new T.Color()},uTime:{value:0},uFlash:{value:0}},
 vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
 fragmentShader:`uniform vec3 uA,uB,uFog,uMode,uSunDir,uSun;uniform float uTime,uFlash;varying vec3 vW;${NOISE}
 void main(){vec2 p=vW.xz;vec3 v=vW-cameraPosition;float dist=length(v);vec2 vd=normalize(v.xz);
 float w=fbm(p*.045+vec2(uTime*.07,uTime*.05));float w2=fbm(p*.16-vec2(uTime*.11,0.));float glit=pow(max(dot(vd,normalize(uSunDir.xz)),0.),40.)*smoothstep(.42,.78,w2+w*.4);
 vec3 sea=uA*(.55+.75*w)+uB*.1*smoothstep(.5,.9,w2)+(uSun*1.4+uB)*glit*1.3;
 vec2 g=abs(fract(p/64.)-.5);float road=smoothstep(.455,.47,max(g.x,g.y));vec2 c2=floor(p/7.);float lamp=road*step(.45,h21(c2))*smoothstep(.5,.15,length(fract(p/7.)-.5));float blk=step(.72,h21(floor(p/16.)))*smoothstep(.45,.2,length(fract(p/16.)-.5))*(1.-road);
 float far=smoothstep(900.,260.,dist);vec3 city=uA*(.7+.5*h21(floor(p/64.)))+uB*(lamp*1.6+road*.12)*far+vec3(.35,.8,1.)*blk*.5*far;
 float cl=fbm(p*.012+vec2(uTime*.02,0.));float cl2=fbm(p*.045+vec2(0.,uTime*.03));vec3 cloud=mix(uA,uB,smoothstep(.3,.85,cl*.7+cl2*.4))*(1.+uFlash*1.6*smoothstep(.5,.8,cl));
 vec3 col=sea*uMode.x+city*uMode.y+cloud*uMode.z;float f=1.-exp(-dist*dist*.0000034);gl_FragColor=vec4(mix(col,uFog,clamp(f,0.,1.)),1.);}`};
// Towers: one instanced box with windows drawn in the shader, lit per instance, fogged by hand.
const TOWER={uniforms:{uFog:{value:new T.Color()},uFogD:{value:.004},uSunDir:{value:new T.Vector3(0,.3,1)},uKey:{value:new T.Color()},uAmb:{value:new T.Color()},uFlash:{value:0}},
 vertexShader:'attribute vec3 aTint;attribute vec4 aLook;varying vec3 vL;varying vec3 vN;varying vec3 vW;varying vec3 vTint;varying vec4 vLook;varying vec3 vS;void main(){vec3 sc=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));vS=sc;vL=position*sc;vN=normalize(mat3(instanceMatrix)*normal);vec4 w=modelMatrix*instanceMatrix*vec4(position,1.);vW=w.xyz;vTint=aTint;vLook=aLook;gl_Position=projectionMatrix*viewMatrix*w;}',
 fragmentShader:`uniform vec3 uFog,uSunDir,uKey,uAmb;uniform float uFogD,uFlash;varying vec3 vL;varying vec3 vN;varying vec3 vW;varying vec3 vTint;varying vec4 vLook;varying vec3 vS;float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
 void main(){vec3 n=normalize(vN);float dist=length(vW-cameraPosition);float side=step(abs(normal_y(n)),.5);vec2 uv=abs(vN.y)>.5?vL.xz:(abs(dFdx(vL.x))+abs(dFdy(vL.x))>abs(dFdx(vL.z))+abs(dFdy(vL.z))?vL.xy:vL.zy);
 vec2 q=uv/vec2(2.4,3.2)+vLook.x*37.;vec2 cell=floor(q),f=fract(q);float win=smoothstep(.14,.2,f.x)*smoothstep(.86,.8,f.x)*smoothstep(.22,.3,f.y)*smoothstep(.82,.74,f.y)*side;
 float r=h21(cell+vLook.x*91.);float lit=step(1.-vLook.y,r*(.7+.3*h21(vec2(cell.y,vLook.x))));float lod=smoothstep(520.,140.,dist);
 float diff=max(dot(n,normalize(uSunDir)),0.);vec3 wall=vLook.z*vec3(1.)*.0+uAmb*(.55+.45*n.y)+uKey*diff*.5;vec3 base=mix(vec3(.02,.025,.045),vec3(.06,.07,.1),h21(vec2(vLook.x,3.)))*3.*wall+wall*.02;
 vec3 col=base*(1.-win*.55*lod)+vTint*win*lit*(.5+.9*h21(cell*1.7))*mix(vLook.y*.9,1.,lod);
 float cap=smoothstep(vS.y*.5-2.5,vS.y*.5-.5,vL.y)*vLook.w;col+=vec3(1.6,.12,.1)*cap;col*=1.+uFlash*.8;
 float fg=1.-exp(-dist*dist*uFogD*uFogD);gl_FragColor=vec4(mix(col,uFog,clamp(fg,0.,1.)),1.);}`.replace('step(abs(normal_y(n)),.5)','step(abs(n.y),.5)')};

// ── Track surface helpers. `at` turns (frame, sideways, height) into a world point and a local basis.
const O={p:new T.Vector3(),r:new T.Vector3(),n:new T.Vector3(),t:new T.Vector3()};
function at(f,x,h=0,flat=true,out=O){
 const [cx,cy,a]=flat?[x,0,0]:crossSection(x),ca=Math.cos(a),sa=Math.sin(a),r=f.r,u=f.u;
 out.n.set(u[0]*ca-r[0]*sa,u[1]*ca-r[1]*sa,u[2]*ca-r[2]*sa);out.r.set(r[0]*ca+u[0]*sa,r[1]*ca+u[1]*sa,r[2]*ca+u[2]*sa);out.t.fromArray(f.t);
 out.p.set(f.p[0]+r[0]*cx+u[0]*cy+out.n.x*h,f.p[1]+r[1]*cx+u[1]*cy+out.n.y*h,f.p[2]+r[2]*cx+u[2]*cy+out.n.z*h);return out;
}
const M=new T.Matrix4(),VX=new T.Vector3();
const basisMatrix=(o,m=M)=>m.makeBasis(VX.copy(o.r).negate(),o.n,o.t).setPosition(o.p);
function grid(rows,cols,pos,uv,flip){const idx=[];for(let i=0;i<rows-1;i++)for(let j=0;j<cols-1;j++){const a=i*cols+j,b=a+1,d=a+cols,e=d+1;if(flip)idx.push(a,d,b,b,d,e);else idx.push(a,b,d,b,e,d);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
// A strip of surface following the course from sA to sB; fn(s, column) gives [sideways, height, u].
function strip(c,sA,sB,step,cols,fn,{flip=false}={}){
 const n=Math.max(1,Math.ceil((sB-sA)/step)),rows=n+1,pos=new Float32Array(rows*cols*3),uv=new Float32Array(rows*cols*2),flat=!c.pipe;
 for(let i=0;i<rows;i++){const s=sA+(sB-sA)*i/n,f=frameIn(c,s);for(let j=0;j<cols;j++){const [x,h,ux]=fn(s,j),k=i*cols+j;at(f,x,h,flat);pos[k*3]=O.p.x;pos[k*3+1]=O.p.y;pos[k*3+2]=O.p.z;uv[k*2]=ux??j/(cols-1);uv[k*2+1]=s/8;}}
 return grid(rows,cols,pos,uv,flip);
}
const deckTex=()=>texture(512,512,(c,w,h)=>{
 const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'#232a44');g.addColorStop(.5,'#2e3656');g.addColorStop(1,'#232a44');c.fillStyle=g;c.fillRect(0,0,w,h);
 for(let i=0;i<2600;i++){c.fillStyle=hash(81,i)>.5?'#ffffff09':'#00000022';c.fillRect(hash(82,i)*w,hash(83,i)*h,2+hash(84,i)*3,2);}
 c.fillStyle='#0d1020';for(let y=0;y<h;y+=128)c.fillRect(0,y,w,3);c.fillStyle='#ffffff14';for(let y=3;y<h;y+=128)c.fillRect(0,y,w,2);
 // Faint arrows in every lane sell the direction of travel at speed.
 c.fillStyle='#ffffff10';for(const x of [w/6,w/2,w*5/6])for(const y of [70,326]){c.beginPath();c.moveTo(x,y);c.lineTo(x+34,y+52);c.lineTo(x+12,y+52);c.lineTo(x,y+30);c.lineTo(x-12,y+52);c.lineTo(x-34,y+52);c.closePath();c.fill();}
},{repeat:true});
const deckGlow=()=>texture(512,512,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.fillStyle='#fff';for(const x of [w/3,w*2/3])for(let y=0;y<h;y+=128)c.fillRect(x-4,y+18,8,74);c.fillStyle='#8a8a8a';c.fillRect(0,0,6,h);c.fillRect(w-6,0,6,h);},{repeat:true});
const underTex=()=>texture(128,256,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.fillStyle='#fff';c.fillRect(10,112,w-20,14);},{repeat:true});
const chevrons=(color,bg='#00000000')=>texture(256,256,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle=bg;c.fillRect(0,0,w,h);c.fillStyle=color;for(let i=0;i<2;i++){const y=i*128+118;c.beginPath();c.moveTo(18,y);c.lineTo(w/2,y-92);c.lineTo(w-18,y);c.lineTo(w-18,y-44);c.lineTo(w/2,y-136);c.lineTo(18,y-44);c.closePath();c.fill();}},{repeat:true});
const stripes=()=>texture(128,128,(c,w,h)=>{c.fillStyle='#16060a';c.fillRect(0,0,w,h);c.fillStyle='#ff2d4a';c.lineWidth=0;for(let i=-2;i<5;i++){c.beginPath();c.moveTo(i*64,h);c.lineTo(i*64+32,h);c.lineTo(i*64+32+h,0);c.lineTo(i*64+h,0);c.closePath();c.fill();}},{repeat:true});
const signTex=(text,color)=>texture(512,256,(c,w,h)=>{c.fillStyle='#07060ee6';c.beginPath();c.roundRect(6,6,w-12,h-12,22);c.fill();c.lineWidth=8;c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=24;c.stroke();c.font='900 74px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff8ea';c.fillText(text,w/2,h/2-28);c.fillStyle=color;c.font='900 68px system-ui,sans-serif';c.fillText('▲ ▲ ▲',w/2,h/2+62);});
const CSS=`.turbo3d .tp-speed{position:absolute;left:16px;top:var(--d3-top);display:flex;align-items:baseline;gap:6px;text-shadow:0 2px 10px #000d,0 3px 0 #000a}
.turbo3d .tp-speed b{font:900 clamp(30px,5vw,56px)/1 var(--display);letter-spacing:-1px;color:#f4fbff;font-variant-numeric:tabular-nums;font-style:italic}
.turbo3d .tp-speed small{font:800 11px var(--mono);letter-spacing:2px;color:#7ff3ff}
.turbo3d .tp-speed[data-hot="1"] b{color:#fff3c4;text-shadow:0 0 22px #ffb43a,0 3px 0 #000a}
.turbo3d .tp-zone{position:absolute;left:18px;top:calc(var(--d3-top) + clamp(38px,6vw,64px));font:700 10px var(--mono);letter-spacing:2.5px;color:#ffffffd0;text-shadow:0 1px 6px #000,0 1px 0 #000;white-space:nowrap}
.turbo3d .tp-clock{position:absolute;left:50%;top:var(--d3-top);transform:translateX(-50%);display:grid;justify-items:center;padding:5px 16px 6px;border-radius:14px;background:#0b0a16c4;border:1px solid #7ff3ff55;box-shadow:0 0 24px #0008}
.turbo3d .tp-clock b{font:900 clamp(22px,3.6vw,36px)/1 var(--display);color:#eaffff;font-variant-numeric:tabular-nums}
.turbo3d .tp-clock small{font:700 8px var(--mono);letter-spacing:3px;color:#9fdcff}
.turbo3d .tp-clock[data-low="1"]{border-color:#ff4f6a;animation:tpPulse .5s ease-in-out infinite alternate}.turbo3d .tp-clock[data-low="1"] b{color:#ffb9c4}
.turbo3d .tp-clock[data-up="1"]{border-color:#b9ff5e;box-shadow:0 0 30px #b9ff5e88}.turbo3d .tp-clock[data-up="1"] b{color:#d8ffa6}
@keyframes tpPulse{from{box-shadow:0 0 8px #ff4f6a44}to{box-shadow:0 0 30px #ff4f6acc}}
.turbo3d .tp-turbo{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + var(--d3-bottom));transform:translateX(-50%);display:grid;justify-items:center;gap:5px;font:800 10px var(--mono);letter-spacing:4px;color:#7ff3ff;text-shadow:0 0 10px #000}
.turbo3d .tp-turbo em{display:block;width:min(46vw,230px);height:10px;border-radius:9px;background:#05101ccc;border:1px solid #7ff3ff66;overflow:hidden;transform:skewX(-18deg)}
.turbo3d .tp-turbo s{display:block;height:100%;transform-origin:left;background:linear-gradient(90deg,#3fe0ff,#b9ff5e,#ffd25e);box-shadow:0 0 14px #7ff3ff}
.turbo3d .tp-turbo[data-on="1"]{color:#ffe08a}.turbo3d .tp-turbo[data-on="1"] em{border-color:#ffd25e;box-shadow:0 0 22px #ffb43aaa}
.turbo3d .tp-turbo[data-empty="1"]{color:#8a93ad}.turbo3d .tp-turbo small{font:700 8px var(--mono);letter-spacing:2px;opacity:.8}
.turbo3d .d3-combo{top:calc(var(--d3-top) + 54px)}.turbo3d .d3-pops{top:34%}
.turbo3d .tp-tip{position:absolute;left:50%;top:calc(var(--d3-top) + 74px);transform:translateX(-50%);max-width:min(92%,560px);padding:7px 14px;border-radius:10px;background:#0b0a16d9;border:1px solid #ffd25e88;color:#fff3c4;font:800 clamp(10px,1.7vw,13px) var(--mono);letter-spacing:1.5px;text-align:center;box-shadow:0 0 22px #000a}
.turbo3d .tp-tip.tp-in{animation:tpTip 3s ease forwards}@keyframes tpTip{0%{opacity:0;transform:translate(-50%,-8px)}8%,86%{opacity:1;transform:translate(-50%,0)}100%{opacity:0}}
.turbo3d .tp-feat{position:absolute;left:50%;top:22%;transform:translateX(-50%);display:grid;justify-items:center;gap:3px;padding:10px 22px 12px;border-radius:16px;background:linear-gradient(180deg,#2a1d05ee,#120d04ee);border:1px solid #ffd25e;box-shadow:0 0 40px #ffb43a77;text-align:center;max-width:92%}
.turbo3d .tp-feat small{font:800 9px var(--mono);letter-spacing:4px;color:#ffd25e}.turbo3d .tp-feat b{font:900 clamp(18px,3.4vw,30px)/1.05 var(--display);color:#fff6d8;text-shadow:0 0 18px #ffb43a}.turbo3d .tp-feat span{font:600 11px var(--mono);color:#ffe9b0}
.turbo3d .tp-feat.tp-in{animation:tpFeat 3.4s cubic-bezier(.2,.9,.3,1.2) forwards}@keyframes tpFeat{0%{opacity:0;transform:translate(-50%,10px) scale(.8)}8%,88%{opacity:1;transform:translate(-50%,0) scale(1)}100%{opacity:0}}
.turbo3d .tp-cock{position:absolute;inset:0;--coat:#c58a4d;--pl:0%;--pr:0%;--lean:0deg;overflow:hidden}
.turbo3d .tp-paw{position:absolute;bottom:-9%;width:clamp(86px,19vmin,170px);aspect-ratio:1/1.25;border-radius:48% 48% 40% 40%;background:radial-gradient(ellipse at 50% 22%,color-mix(in srgb,var(--coat) 82%,#fff) 0 30%,var(--coat) 62%,color-mix(in srgb,var(--coat) 55%,#000) 100%);box-shadow:0 -6px 26px #0008,inset 0 -18px 30px #0005;transition:transform .05s linear}
.turbo3d .tp-paw::after{content:'';position:absolute;left:14%;right:14%;top:7%;height:20%;border-radius:50%;background:repeating-linear-gradient(90deg,#0000 0 21%,#0004 21% 26%)}
.turbo3d .tp-paw.l{left:max(4%,calc(50% - 300px));transform:translateY(var(--pl)) rotate(calc(-9deg + var(--lean)))}.turbo3d .tp-paw.r{right:max(4%,calc(50% - 300px));transform:translateY(var(--pr)) rotate(calc(9deg + var(--lean)))}
.turbo3d .tp-nose{position:absolute;left:50%;bottom:-3.2%;width:clamp(70px,13vmin,120px);aspect-ratio:1.9/1;transform:translateX(-50%) rotate(var(--lean));border-radius:50% 50% 46% 46%;background:radial-gradient(ellipse at 50% 30%,#3a3442,#0d0b12 70%);box-shadow:0 0 0 clamp(14px,3vmin,26px) color-mix(in srgb,var(--coat) 78%,#fff),0 -8px 30px #0009}
.turbo3d .tp-ear{position:absolute;top:-7%;width:clamp(50px,11vmin,110px);aspect-ratio:1/1.5;background:linear-gradient(180deg,color-mix(in srgb,var(--coat) 60%,#000),var(--coat));opacity:.9;filter:blur(1px)}.turbo3d .tp-ear.l{left:-2%;border-radius:0 0 90% 30%;transform:rotate(calc(8deg + var(--lean)))}.turbo3d .tp-ear.r{right:-2%;border-radius:0 0 30% 90%;transform:rotate(calc(-8deg + var(--lean)))}
.turbo3d .tp-cock[data-hurt="1"]{box-shadow:inset 0 0 120px 30px #ff2448aa}.turbo3d .tp-cock[data-boost="1"]{box-shadow:inset 0 0 110px 10px #ffd25e55}
.turbo3d .tp-radar{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + var(--d3-bottom) + 58px);transform:translateX(-50%);display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:min(78vw,420px)}
.turbo3d .tp-radar b{display:grid;place-items:center;height:30px;border-radius:9px;background:#0b0a16b0;border:1px solid #ffffff2e;font:900 clamp(10px,1.9vw,13px) var(--mono);letter-spacing:1px;color:#b9ff5e;white-space:nowrap}
.turbo3d .tp-radar b[data-mine="1"]{border-color:#b9ff5e;box-shadow:0 0 14px #b9ff5e55}
.turbo3d .tp-radar b[data-kind=bad]{background:#3a0612d9;border-color:#ff4f6a;color:#ffc2cc}.turbo3d .tp-radar b[data-kind=jump]{background:#3a2a06d9;border-color:#ffd25e;color:#fff0b8}.turbo3d .tp-radar b[data-kind=roll]{background:#33083ad9;border-color:#ff7af0;color:#ffd3fa}
.turbo3d .tp-radar b[data-now="1"]{animation:tpNow .22s ease-in-out infinite alternate}@keyframes tpNow{to{filter:brightness(1.7);transform:scale(1.06)}}
.turbo3d .tp-fp{position:absolute;right:16px;top:calc(var(--d3-top) + 112px);font:800 9px var(--mono);letter-spacing:3px;color:#b9ff5e;font-style:normal;text-shadow:0 1px 6px #000}
@media (prefers-reduced-motion:reduce){.turbo3d .tp-radar b[data-now="1"],.turbo3d .tp-tip.tp-in,.turbo3d .tp-feat.tp-in{animation-duration:.01s}}
.turbo3d .tp-style{position:absolute;right:16px;top:calc(var(--d3-top) + 122px);font:800 10px var(--mono);letter-spacing:2px;color:#ffd6f5;text-shadow:0 1px 6px #000}
@media (max-width:520px){.turbo3d .tp-clock{padding:4px 11px 5px}.turbo3d .tp-zone{font-size:8px;letter-spacing:1.5px}.turbo3d .d3-pop{font-size:20px}.turbo3d .d3-pop.d3-big{font-size:26px}}`;

export class ThreeTurbo {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.chunks=new Map();this.asset=null;this.assetKey='';this.cameraMode='third';this.status='';this.statusSince=performance.now();this.clock=performance.now();this.zoneIdx=-1;this.trail=[];this.camH=0;this.camX=0;this.camRoll=0;this.kick=0;this.flash=0;this.nextBolt=4;this.towerSlot=null;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d turbo3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;this.camera.far=1900;this.scene.add(this.camera);
  const style=document.createElement('style');style.textContent=CSS;this.view.append(style);
  this.hud=new Hud('<div class="tp-speed"><b>0</b><small>KM/H</small></div><div class="tp-zone"></div><div class="tp-clock"><b>0.0</b><small>TIME</small></div><div class="d3-gold"><i></i><b>0</b></div><div class="d3-combo" hidden><b>×2</b><small>COMBO</small><em><s></s></em></div><div class="tp-turbo"><span>TURBO</span><em><s></s></em><small></small></div><div class="tp-tip" hidden></div><div class="tp-feat" hidden><small>FEAT UNLOCKED</small><b></b><span></span></div><div class="tp-cock" hidden><i class="tp-ear l"></i><i class="tp-ear r"></i><i class="tp-paw l"></i><i class="tp-paw r"></i><i class="tp-nose"></i><div class="tp-radar"><b></b><b></b><b></b></div><em class="tp-fp">SNOUT CAM</em></div>');this.view.append(this.hud.root);
  const q=s=>this.hud.q(s);this.ui={speed:q('.tp-speed'),speedN:q('.tp-speed b'),zone:q('.tp-zone'),clock:q('.tp-clock'),clockN:q('.tp-clock b'),gold:q('.d3-gold b'),combo:q('.d3-combo'),comboN:q('.d3-combo b'),comboBar:q('.d3-combo s'),turbo:q('.tp-turbo'),bar:q('.tp-turbo s'),hint:q('.tp-turbo small'),tip:q('.tp-tip'),feat:q('.tp-feat'),featN:q('.tp-feat b'),featT:q('.tp-feat span'),cock:q('.tp-cock'),radar:[...this.hud.root.querySelectorAll('.tp-radar b')]};this.tips={};
  this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D COURSE · LIVE');globalThis.__turbo=this;return this;
 }
 setCamera(mode){this.cameraMode=mode==='first'?'first':'third';}
 build(){
  const s=this.scene,high=this.quality==='high',st=this.stage;st.neonEnvironment(.7);st.bloomBase=.5;s.fog=new T.FogExp2(0x241047,.0045);
  this.sky=new T.Mesh(new T.SphereGeometry(1500,32,20),new T.ShaderMaterial({...SKY,uniforms:T.UniformsUtils.clone(SKY.uniforms),side:T.BackSide,depthWrite:false,fog:false}));this.sky.renderOrder=-10;this.sky.frustumCulled=false;s.add(this.sky);
  this.floor=new T.Mesh(new T.PlaneGeometry(3600,3600).rotateX(-Math.PI/2),new T.ShaderMaterial({...FLOOR,uniforms:T.UniformsUtils.clone(FLOOR.uniforms),fog:false}));this.floor.frustumCulled=false;s.add(this.floor);
  this.hemi=new T.HemisphereLight(0xffffff,0x202040,1);this.key=new T.DirectionalLight(0xffffff,2.5);s.add(this.hemi,this.key,this.key.target);st.sunShadow(this.key,{size:16,far:90,map:2048,radius:3});
  // Materials shared by every chunk.
  const map=deckTex(),glow=deckGlow();this.trackMat=pbr({map,emissiveMap:glow,emissive:0xffffff,emissiveIntensity:1.2,metalness:.55,roughness:.34,envMapIntensity:1.1,color:0xc9d2f2,clearcoat:.6,clearcoatRoughness:.2},this.quality);
  this.deckMat=pbr({map,emissiveMap:glow,emissive:0xffc24a,emissiveIntensity:1.3,metalness:.55,roughness:.36,envMapIntensity:.9,color:0xa98a58,clearcoat:.6,clearcoatRoughness:.2},this.quality);
  this.underMat=new T.MeshStandardMaterial({color:0x10131f,metalness:.7,roughness:.5,emissive:0xffffff,emissiveMap:underTex(),emissiveIntensity:1.4,envMapIntensity:.4});
  this.darkMat=new T.MeshStandardMaterial({color:0x1a1e30,metalness:.75,roughness:.42,envMapIntensity:.7});
  this.edgeA=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.edgeB=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.goldEdge=new T.MeshBasicMaterial({color:new T.Color(2.6,1.7,.45),toneMapped:false});
  this.lipMat=new T.MeshBasicMaterial({color:new T.Color(3,1.5,.2),toneMapped:false});this.railMat=new T.MeshBasicMaterial({color:new T.Color(1.5,2.6,3),toneMapped:false});
  const hz=stripes();this.hazMat=new T.MeshStandardMaterial({map:hz,emissiveMap:hz,emissive:0xffffff,emissiveIntensity:1.5,metalness:.3,roughness:.5});this.laserMat=new T.MeshBasicMaterial({color:new T.Color(3.4,.35,.5),toneMapped:false});this.spikeMat=new T.MeshStandardMaterial({color:0x4a0f1c,emissive:0xff2448,emissiveIntensity:1.6,metalness:.5,roughness:.3});
  this.padTex=chevrons('#8ff6ff');this.padMat=new T.MeshBasicMaterial({map:this.padTex,transparent:true,toneMapped:false,color:new T.Color(1.8,2.5,2.8),depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide});
  this.rampTex=chevrons('#1a1206','#ffc23d');this.rampMat=new T.MeshBasicMaterial({map:this.rampTex,toneMapped:false,color:new T.Color(1.9,1.5,.7),side:T.DoubleSide});
  const warn=(word,arrow,color)=>new T.MeshBasicMaterial({map:texture(512,256,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle=color;c.font='900 150px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(arrow+' '+word+' '+arrow,w/2,h/2+8);}),transparent:true,toneMapped:false,color:new T.Color(1.5,1.5,1.5),depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide});this.warnJump=warn('JUMP','▲','#ffd25e');this.warnRoll=warn('ROLL','▼','#ff7af0');
  this.springMat=new T.MeshStandardMaterial({color:0xffd25e,emissive:0xffa000,emissiveIntensity:1.3,metalness:.8,roughness:.25});
  this.hoopGeo=new T.TorusGeometry(1.45,.11,8,36);this.hoopMat=new T.MeshBasicMaterial({color:new T.Color(2.6,1.3,3.2),toneMapped:false});
  this.signMat=new T.MeshBasicMaterial({map:signTex('HIGH ROAD','#ffd25e'),toneMapped:false,color:new T.Color(1.5,1.5,1.5),side:T.DoubleSide,transparent:true});
  this.gateMat=new T.MeshBasicMaterial({map:texture(1024,128,(c,w,h)=>{c.fillStyle='#07060e';c.fillRect(0,0,w,h);c.font='900 84px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#b9ff5e';c.shadowColor='#b9ff5e';c.shadowBlur=18;c.fillText('CHECKPOINT  ▸▸  CHECKPOINT',w/2,h/2+4);}),toneMapped:false,color:new T.Color(1.7,1.7,1.7),side:T.DoubleSide});
  // Gold, pooled into one instanced mesh.
  this.coinCap=high?420:260;this.coins=new T.InstancedMesh(new T.CylinderGeometry(.46,.46,.1,high?20:12).rotateX(Math.PI/2),new T.MeshStandardMaterial({color:0xffc83d,metalness:1,roughness:.18,emissive:0xff9a10,emissiveIntensity:.55,envMapIntensity:1.6}),this.coinCap);this.coins.frustumCulled=false;s.add(this.coins);
  // Patrol bots, pooled.
  this.botBody=pbr({color:0x6a2f8c,metalness:.6,roughness:.3,emissive:0x5a1a8c,emissiveIntensity:.9,clearcoat:1,clearcoatRoughness:.1},this.quality);this.botEye=new T.MeshBasicMaterial({color:new T.Color(3,.9,3.4),toneMapped:false});this.bots=[];
  this.glowTex=radial(glowStops);this.particles=new Particles(s,high?700:320,this.glowTex);this.particles.points.material.size=.3;
  // The pup: holder rides the track frame, pivot carries flips and rolls about the pup's middle.
  this.holder=new T.Group();this.holder.matrixAutoUpdate=false;this.pivot=new T.Group();this.pivot.position.y=TURBO.body;this.scaler=new T.Group();this.scaler.scale.setScalar(1.3);this.scaler.add(this.pivot);this.holder.add(this.scaler);s.add(this.holder);
  
  this.halo=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(.6,1.3,1.5),transparent:true,opacity:.3,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.halo.scale.set(2.4,2.4,1);this.pivot.add(this.halo);
  this.blob=new T.Mesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:radial([[0,'#000000c0'],[.55,'#00000060'],[1,'#00000000']]),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}));this.blob.matrixAutoUpdate=false;s.add(this.blob);
  // Speed trail in the DAWG's colours.
  this.TRAIL=26;const tg=new T.BufferGeometry();tg.setAttribute('position',new T.BufferAttribute(new Float32Array(this.TRAIL*12),3).setUsage(T.DynamicDrawUsage));tg.setAttribute('color',new T.BufferAttribute(new Float32Array(this.TRAIL*12),3).setUsage(T.DynamicDrawUsage));const ti=[];for(let i=0;i<this.TRAIL-1;i++)for(const o of [0,2]){const a=i*4+o;ti.push(a,a+1,a+4,a+1,a+5,a+4);}tg.setIndex(ti);
  this.trailMesh=new T.Mesh(tg,new T.MeshBasicMaterial({vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false}));this.trailMesh.frustumCulled=false;s.add(this.trailMesh);this.trailA=new T.Color(.7,1.6,.4);this.trailB=new T.Color(.3,1.2,1.8);
  // Speed lines ride with the camera.
  this.LINES=high?70:36;this.lines=new T.InstancedMesh(new T.PlaneGeometry(.028,1).rotateX(Math.PI/2),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false,fog:false}),this.LINES);this.lines.frustumCulled=false;this.lines.renderOrder=5;this.camera.add(this.lines);
  this.lineData=Array.from({length:this.LINES},(_,i)=>({a:hash(7,i)*Math.PI*2,r:2.4+hash(8,i)*5.5,z:-3-hash(9,i)*46,l:.6+hash(10,i)}));
  // Skyline: instanced towers recycled along the course.
  this.TOWERS=high?150:84;this.coat=new T.Color(0xc58a4d);const tgeo=new T.BoxGeometry(1,1,1).translate(0,.5,0);tgeo.setAttribute('aTint',new T.InstancedBufferAttribute(new Float32Array(this.TOWERS*3),3));tgeo.setAttribute('aLook',new T.InstancedBufferAttribute(new Float32Array(this.TOWERS*4),4));
  this.towers=new T.InstancedMesh(tgeo,new T.ShaderMaterial({...TOWER,uniforms:T.UniformsUtils.clone(TOWER.uniforms),fog:false}),this.TOWERS);this.towers.frustumCulled=false;s.add(this.towers);
  // The next checkpoint gate.
  this.gate=new T.Group();this.gate.matrixAutoUpdate=false;{const w=TURBO.half*2+1.6,post=new T.BoxGeometry(.5,7,.5),beam=new T.BoxGeometry(w+.5,.5,.5),sign=new T.PlaneGeometry(w-.6,1.3);for(const x of [-w/2,w/2]){const m=new T.Mesh(post,this.darkMat);m.position.set(x,3.5,0);this.gate.add(m);const g=new T.Mesh(new T.BoxGeometry(.12,7,.12),this.edgeA);g.position.set(x,3.5,-.3);this.gate.add(g);}const b=new T.Mesh(beam,this.darkMat);b.position.y=7;const sg=new T.Mesh(sign,this.gateMat);sg.position.set(0,6.1,-.1);sg.rotation.y=Math.PI;this.gate.add(b,sg);}s.add(this.gate);
  this.rivals=[];this.col={};for(const k of ['top','mid','horizon','sun','fog','hemiSky','hemiGround','key','gA','gB','edgeA','edgeB','wall'])this.col[k]=new T.Color();this.num={sunSize:.03,fogD:.004,hemi:1,keyI:2,env:.6,clouds:.4,stars:0,aurora:0,exposure:1};this.vec={sunDir:new T.Vector3(0,.3,1),ground:new T.Vector3(1,0,0)};
  this.m4=new T.Matrix4();this.q=new T.Quaternion();this.q2=new T.Quaternion();this.v=new T.Vector3();this.v2=new T.Vector3();this.v3=new T.Vector3();this.sc=new T.Vector3(1,1,1);this.tmp=new T.Color();this.P={p:new T.Vector3(),r:new T.Vector3(),n:new T.Vector3(),t:new T.Vector3()};this.C={p:new T.Vector3(),r:new T.Vector3(),n:new T.Vector3(),t:new T.Vector3()};
 }
 // Builds the meshes for one course chunk; disposed again once it is behind the camera.
 chunkMesh(c){
  const grp=new T.Group(),geos=[],parts={},flat=!c.pipe,high=this.stage.quality==='high',a=c.s0,b=c.s0+c.len,step=c.loop||c.twist?1:2,H=i=>hash(c.k*977+13,i);grp.userData={geos,rings:[],coins:[]};
  const push=(key,g)=>(parts[key]??=[]).push(g);
  const solid=(key,geo,f,x,h,{yaw=0,pitch=0}={})=>{at(f,x,h,flat);basisMatrix(O);if(yaw||pitch)M.multiply(this.m4.makeRotationFromEuler(new T.Euler(pitch,yaw,0)));geo.applyMatrix4(M);push(key,geo);};
  const W=s=>halfWidthIn(c,s),cols=c.pipe?19:7;
  // Deck runs between the gaps: top, underside, raised neon kerbs.
  const runs=[];let from=a;for(const [p,q]of c.gaps){runs.push([from,p]);from=q;}runs.push([from,b]);
  for(const [p,q]of runs){if(q-p<.5)continue;
   push('track',strip(c,p,q,step,cols,(s,j)=>{const x=-W(s)+2*W(s)*j/(cols-1);return [x,0,x/(LW*3)+.5];}));
   push('under',strip(c,p,q,step*2,c.pipe?9:2,(s,j)=>{const n=c.pipe?8:1,x=-W(s)+2*W(s)*j/n;return [x,-.42,j/n];},{flip:true}));
   for(const side of [-1,1]){const kerb=(s,j)=>{const w=W(s);return [[side*(w-.34),.02],[side*(w-.34),.26],[side*w,.26],[side*w,-.42]][j];};push(side<0?'edgeA':'edgeB',strip(c,p,q,step,4,kerb,{flip:side<0}));}}
  for(const [p,q]of c.gaps)for(const [s,dir]of [[p,-1],[q,1]]){const f=frameIn(c,s+dir*.2);solid('lip',new T.BoxGeometry(TURBO.half*2,.3,.4),f,0,.05);}
  // Pylons carry the deck down into the haze; none inside a loop or a corkscrew.
  for(let s=Math.ceil(a/36)*36;s<b;s+=36){if(c.loop&&s>c.loop[0]-6&&s<c.loop[1]+6||c.twist&&s>c.twist[0]&&s<c.twist[1]||c.gaps.some(([p,q])=>s>p-2&&s<q+2))continue;const f=frameIn(c,s),g=new T.CylinderGeometry(.5,.9,120,8).translate(f.p[0],f.p[1]-60.6,f.p[2]);push('dark',g);}
  // Lamp posts whip past on alternating sides; ribs of light make a tunnel over some stretches.
  const dressed=!c.loop&&!c.twist;
  if(dressed)for(let s=Math.ceil(a/18)*18,i=0;s<b;s+=18,i++){if(c.gaps.some(([p,q])=>s>p-3&&s<q+3))continue;const side=(Math.round(s/18)%2?1:-1),w=W(s),f=frameIn(c,s);if(c.decks.some(d=>d.side===side&&s>d.s0-4&&s<d.s1+4))continue;
   solid('dark',new T.BoxGeometry(.16,4.6,.16).translate(0,2.3,0),f,side*(w+.25),0);solid('dark',new T.BoxGeometry(1.5,.12,.16).translate(-side*-.75*-1,4.6,0),f,side*(w+.25),0);solid(side<0?'edgeA':'edgeB',new T.BoxGeometry(.9,.1,.3).translate(side*.9*-1*-1*-1,4.5,0),f,side*(w+.25),0);}
  if(dressed&&['rows','hill','sweep','start'].includes(c.kind)&&(c.k===0||H(1)<.55)){const s0=a+(c.k?18:34),s1=b-18;for(let s=s0,i=0;s<=s1;s+=7,i++){const f=frameIn(c,s),g=new T.TorusGeometry(TURBO.half+1.3,.13,5,18,Math.PI);solid(i%2?'edgeA':'edgeB',g,f,0,-.2);}}
  // High road: its own deck, gold kerbs, amber lips at the gaps, a sign at the fork.
  for(const d of c.decks){const x0=d.side*(LW-2.1),x1=d.side*(LW*3+2.1),lo=Math.min(x0,x1),hi=Math.max(x0,x1),runs=[];let f0=d.s0;for(const [p,q]of d.gaps){runs.push([f0,p]);f0=q;}runs.push([f0,d.s1]);const y=s=>deckHeight(d,Math.min(Math.max(s,d.s0),d.s1))??TURBO.deckH;
   for(const [p,q]of runs){push('deck',strip(c,p,q,2,5,(s,j)=>{const x=lo+(hi-lo)*j/4;return [x,y(s)+.02,(x-d.side*LW*2)/(LW*3)+.5];}));push('under',strip(c,p,q,4,2,(s,j)=>[j?hi:lo,y(s)-.4,j],{flip:true}));
    for(const sd of [0,1]){const e=sd?hi:lo,sg=sd?1:-1;push('gold',strip(c,p,q,2,4,(s,j)=>[[e-sg*.3,y(s)+.04],[e-sg*.3,y(s)+.28],[e,y(s)+.28],[e,y(s)-.4]][j],{flip:!sd}));}}
   for(const [p,q]of d.gaps)for(const [s,dir]of [[p,-1],[q,1]])solid('lip',new T.BoxGeometry(hi-lo,.3,.4),frameIn(c,s+dir*.2),(lo+hi)/2,TURBO.deckH+.05);
   for(let s=d.s0+TURBO.deckUp;s<d.s1;s+=24){if(d.gaps.some(([p,q])=>s>p-2&&s<q+2))continue;const f=frameIn(c,s);at(f,d.side*(LW*3+2.4),TURBO.deckH-.4,true);push('dark',new T.CylinderGeometry(.35,.6,120,8).translate(O.p.x,O.p.y-60,O.p.z));}}
  for(const sg of c.signs){const f=frameIn(c,sg.s),m=new T.Mesh(new T.PlaneGeometry(5.6,2.8),this.signMat);geos.push(m.geometry);at(f,sg.side*(TURBO.half+3.4),5.4,true);basisMatrix(O,m.matrix);m.matrix.multiply(this.m4.makeRotationY(Math.PI));m.matrixAutoUpdate=false;grp.add(m);solid('dark',new T.BoxGeometry(.2,5,.2).translate(0,2.5,0),f,sg.side*(TURBO.half+3.4),0);}
  // Rails: a bright bar with a ramp at each end, on struts.
  for(const r of c.rails){const x=r.lane*LW,y=s=>railHeight(r,s)??0;push('rail',strip(c,r.s0,r.s1,2,4,(s,j)=>[[x-.11,y(s)-.1],[x-.11,y(s)+.06],[x+.11,y(s)+.06],[x+.11,y(s)-.1]][j]));for(let s=r.s0+8;s<r.s1-6;s+=8)solid('dark',new T.BoxGeometry(.12,TURBO.railH-.1,.12).translate(0,(TURBO.railH-.1)/2,0),frameIn(c,s),x,0);}
  // Hazards: everything red hurts.
  for(const h of c.hazards){const f=frameIn(c,h.s);
   if(h.type==='block'){solid('haz',new T.BoxGeometry(2.1,1.15,.55).translate(0,.58,0),f,laneX(c,h.lane),0);solid('laser',new T.BoxGeometry(2.1,.08,.6).translate(0,1.2,0),f,laneX(c,h.lane),0);}
   if(h.lane===null&&(h.type==='hurdle'||h.type==='bar'))for(const back of [22,44]){if(h.s-back<a+2)continue;solid(h.type==='bar'?'warnRoll':'warnJump',new T.PlaneGeometry(LW*2.6,3.4).rotateX(-Math.PI/2).rotateY(Math.PI),frameIn(c,h.s-back),0,.045);}
   if(h.type==='block'){}else if(h.type==='hurdle'){solid('haz',new T.BoxGeometry(TURBO.half*2-.8,.5,.3).translate(0,.45,0),f,0,0);solid('laser',new T.BoxGeometry(TURBO.half*2-.8,.07,.34).translate(0,.74,0),f,0,0);for(const x of [-1,1])solid('dark',new T.BoxGeometry(.3,.8,.4).translate(0,.4,0),f,x*(TURBO.half-.5),0);}
   else if(h.type==='bar'){solid('laser',new T.BoxGeometry(TURBO.half*2-.6,.22,.22).translate(0,1.45,0),f,0,0);solid('laser',new T.BoxGeometry(TURBO.half*2-.6,.1,.1).translate(0,1.95,0),f,0,0);for(const x of [-1,1])solid('dark',new T.BoxGeometry(.35,2.4,.45).translate(0,1.2,0),f,x*(TURBO.half-.3),0);}
   else if(h.type==='spikes'){const x=laneX(c,h.lane);for(let s=h.s+.4;s<h.s+h.len;s+=high?.9:1.3){const fs=frameIn(c,s);for(const dx of [-.7,0,.7])solid('spike',new T.ConeGeometry(.24,.62,5).translate(0,.31,0),fs,x+dx,0);}}}
  // Boost pads, kickers and springs.
  for(const p of c.pads){const d=p.d?c.decks[0]:null,f=frameIn(c,p.s),w=d?LW*3:p.lane===null?LW*3:LW*.86,x=d?d.side*LW*2:p.lane===null?0:laneX(c,p.lane),g=new T.PlaneGeometry(w,5,1,1).rotateX(-Math.PI/2).rotateY(Math.PI);g.attributes.uv.array.set([0,1,w/2.2,1,0,0,w/2.2,0]);solid('pad',g,f,x,(d?TURBO.deckH:0)+.05);}
  for(const r of c.ramps){const d=r.d?c.decks[0]:null,w=d?LW*3+3:r.lane===null?TURBO.half*2-.4:LW*.9,x=d?d.side*LW*2:r.lane===null?0:laneX(c,r.lane),L=5,Hh=1.1,f=frameIn(c,r.s-L/2),y=d?TURBO.deckH:0;
   const top=new T.PlaneGeometry(w,Math.hypot(L,Hh),1,1).rotateX(-Math.PI/2).rotateY(Math.PI);top.attributes.uv.array.set([0,2.4,w/2.4,2.4,0,0,w/2.4,0]);solid('ramp',top,f,x,y+Hh/2+.04,{pitch:-Math.atan2(Hh,L)});solid('dark',new T.BoxGeometry(w,Hh,.2).translate(0,Hh/2,L/2-.1),f,x,y);}
  for(const sp of c.springs){const f=frameIn(c,sp.s);solid('spring',new T.CylinderGeometry(.5,.5,.5,14),f,laneX(c,sp.lane),.25);solid('laser',new T.CylinderGeometry(.85,.85,.12,18),f,laneX(c,sp.lane),.56);}
  const mats={track:this.trackMat,under:this.underMat,edgeA:this.edgeA,edgeB:this.edgeB,lip:this.lipMat,dark:this.darkMat,deck:this.deckMat,gold:this.goldEdge,rail:this.railMat,haz:this.hazMat,laser:this.laserMat,spike:this.spikeMat,pad:this.padMat,warnJump:this.warnJump,warnRoll:this.warnRoll,ramp:this.rampMat,spring:this.springMat};
  for(const [key,list]of Object.entries(parts)){for(const g of list){if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute('uv',new T.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));}
   const geo=merge(list);geos.push(geo);const m=new T.Mesh(geo,mats[key]);m.frustumCulled=false;if(high){m.receiveShadow=key==='track'||key==='deck';m.castShadow=key==='haz'||key==='spike'||key==='spring';}if(key==='pad'||key==='warnJump'||key==='warnRoll')m.renderOrder=1;grp.add(m);}
  // Hoops to fly through.
  for(const r of c.rings){const f=frameIn(c,r.s),m=new T.Mesh(this.hoopGeo,this.hoopMat);at(f,laneX(c,r.l),r.h,true);basisMatrix(O,m.matrix);m.matrixAutoUpdate=false;m.userData.id=r.id;grp.add(m);grp.userData.rings.push(m);}
  // Coin positions and facings are worked out once.
  for(const coin of c.coins){const f=frameIn(c,coin.s);at(f,laneX(c,coin.l),coin.h-(flat?0:0),flat||Math.abs(coin.l)<2);basisMatrix(O);grp.userData.coins.push({id:coin.id,s:coin.s,p:O.p.clone(),q:new T.Quaternion().setFromRotationMatrix(M)});}
  this.scene.add(grp);return grp;
 }
 syncChunks(g){const k=chunkAt(g.worldSeed,g.s).k,keep=new Set();for(let i=Math.max(0,k-1);i<=k+AHEAD;i++){const key=g.worldSeed+':'+i;keep.add(key);if(!this.chunks.has(key)){this.chunks.set(key,this.chunkMesh(turboChunk(g.worldSeed,i)));if(this.chunks.size>2&&g.status==='playing')break;}}
  for(const [key,grp]of this.chunks)if(!keep.has(key)){grp.removeFromParent();for(const geo of grp.userData.geos)geo.dispose();this.chunks.delete(key);}return k;}
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;const next=createDawgAsset(d);next.root.position.y=-TURBO.body;if(this.stage.quality==='high')next.root.traverse(o=>{if(o.isMesh)o.castShadow=true;});if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.pivot.add(next.root);
  // The trail and aura take the DAWG's own colours.
  const pick=re=>{let c=null;next.root.traverse(o=>{if(!c&&o.isMesh&&re.test(o.material?.name||''))c=o.material.color;});return c;};const a=pick(/Outfit/)||pick(/Accent/),b=pick(/Accent/)||pick(/Footwear/),coat=pick(/Coat/);if(coat)this.ui.cock.style.setProperty('--coat','#'+coat.getHexString(T.SRGBColorSpace));
  const vivid=(c,fb)=>{if(!c)return fb;const hsl={};c.getHSL(hsl);return new T.Color().setHSL(hsl.h,Math.max(.75,hsl.s),.55).multiplyScalar(2.2);};this.trailA=vivid(a,this.trailA);this.trailB=vivid(b,this.trailB);}
 pop(text,kind){this.hud.pop(text,kind);}
 event(e,g){
  if(!this.ready)return;const st=this.stage,P=this.P.p,x=P.x,y=P.y+.8,z=P.z,red=this.reduced,part=this.particles,pts=e.points?' +'+e.points:'';
  switch(e.type){
   case 'coin':part.burst(x,y,z,5,0xffc14d,{speed:3,up:1.5,life:.35,gravity:0,stick:0});break;
   case 'pad':part.burst(x,y-.5,z,26,0x7ff3ff,{speed:7,life:.5,gravity:0,up:.3,stick:0});this.kick=1;st.shake(.22);st.flashOnce(0x7ff3ff,.08,red);break;
   case 'boost':this.pop('TURBO!','shield');this.kick=1.3;st.shake(.3);st.flashOnce(0xffe08a,.12,red);break;
   case 'empty':break;
   case 'air':if(e.big){this.pop('BIG AIR'+pts,'big');st.shake(.35);this.kick=1.2;}else this.pop('AIR'+pts,'magnet');part.burst(x,y-.6,z,24,0xffd25e,{speed:6,stick:0});break;
   case 'spring':this.pop('BOING!','magnet');st.shake(.25);part.burst(x,y-.6,z,24,0xffd25e,{speed:7,stick:0});break;
   case 'flip':this.pop((e.n>1?e.n+'× ':'')+'FLIP'+pts,'magnet');part.burst(x,y,z,18,0xff7af0,{speed:5,life:.5,gravity:0,stick:0});break;
   case 'perfect':this.pop('PERFECT LANDING'+pts,'big');part.burst(x,y-.7,z,50,0xb9ff5e,{speed:9,life:.7,up:1,stick:0});st.flashOnce(0xb9ff5e,.14,red);this.kick=1;break;
   case 'clean':this.pop('CLEAN'+pts,'dodge');part.burst(x,y-.7,z,16,0xb9ff5e,{speed:5,life:.4,stick:0});break;
   case 'stumble':this.pop('SLOPPY!','dodge');st.shake(.5);part.burst(x,y-.7,z,20,0x9aa3c7,{speed:5,life:.5,stick:0});break;
   case 'slam':this.pop('SLAM'+pts,'dodge');st.shake(.55);part.burst(x,y-.7,z,46,0xb9ff5e,{speed:10,life:.6,up:1,stick:0});break;
   case 'land':if(e.hard){st.shake(.25);part.burst(x,y-.7,z,14,0x9aa3c7,{speed:4,life:.4,up:.6,stick:0});}break;
   case 'ring':this.pop('HOOP'+pts,'magnet');part.burst(x,y,z,34,0xc77dff,{speed:7,life:.6,gravity:0,up:0,stick:0});st.flashOnce(0xb46bff,.08,red);break;
   case 'smash':this.pop('SMASH'+pts,'dodge');st.shake(.4);part.burst(x,y,z,50,0xff4fd8,{speed:11,life:.8,stick:0});break;
   case 'grindstart':this.pop('GRIND!','shield');break;
   case 'grind':this.pop('GRIND'+pts,'shield');break;
   case 'wall':this.pop('WALL RIDE'+pts,'shield');st.shake(.2);break;
   case 'loop':this.pop('LOOP'+pts,'big');st.flashOnce(0x48e6ff,.16,red);this.kick=1;break;
   case 'twist':this.pop('CORKSCREW'+pts,'big');st.flashOnce(0xff7af0,.16,red);this.kick=1;break;
   case 'near':this.pop('CLOSE CALL'+pts,'dodge');break;
   case 'limbo':this.pop('LIMBO'+pts,'dodge');break;
   case 'overtake':this.pop('PASSED '+(e.name||'RIVAL')+pts,'shield');break;
   case 'feat':{const ft=FEATS.find(x=>x.id===e.id);if(ft)this.showFeat(ft);st.flashOnce(0xffd25e,.12,red);break;}
   case 'draft':this.pop('SLIPSTREAM','shield');break;
   case 'combobreak':this.pop('COMBO ×'+Math.min(TURBO.maxCombo,e.n)+' BANKED','dodge');break;
   case 'checkpoint':this.hud.banner('+'+e.add+' S · '+e.stage);st.flashOnce(0xb9ff5e,.2,red);this.kick=1;this.clockUp=performance.now();part.burst(x,y,z,60,0xb9ff5e,{speed:10,life:.9,gravity:0,stick:0});break;
   case 'hurt':this.pop(e.lost?'OUCH! −'+e.lost+' GOLD':'OUCH! −'+e.time+' S','big');st.shake(.8);st.flashOnce(0xff3355,.32,red);part.burst(x,y,z,Math.min(40,10+e.lost*2),0xffc14d,{speed:9,life:.9,up:4,stick:0});break;
   case 'heat':this.hud.banner(heatLabel(e.tier));break;
   case 'over':st.shake(.6);st.flashOnce(0xff3355,.3,red);break;
  }
 }
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:this.lastGame.status==='over'&&t-this.statusSince<4000));return true;}
 // Eases every sky, fog and light value toward the zone the pup is in.
 look(g,dt){
  const idx=Math.floor(g.distance/CP),z=zoneAt(g.distance),snap=this.zoneIdx<0||this.seed!==g.worldSeed,k=snap?1:Math.min(1,dt*1.1);
  if(idx!==this.zoneIdx||snap){this.zoneIdx=idx;this.seed=g.worldSeed;}
  const c=this.col,n=this.num;for(const key in c)c[key].lerp(this.tmp.set(z[key]),k);for(const key in n)n[key]+=(z[key]-n[key])*k;this.vec.sunDir.lerp(this.v.fromArray(z.sunDir).normalize(),k).normalize();this.vec.ground.lerp(this.v.fromArray(z.ground),k);
  // Lightning over the skyway.
  if(z.storm&&!this.reduced&&g.status==='playing'){this.nextBolt-=dt;if(this.nextBolt<=0){this.nextBolt=2.5+Math.random()*5;this.flash=1;}}this.flash=Math.max(0,this.flash-dt*(this.flash>.6?9:2.2));const fl=this.flash*(Math.sin(performance.now()*.08)>.2?1:.35);
  const su=this.sky.material.uniforms;su.uTop.value.copy(c.top);su.uMid.value.copy(c.mid);su.uHorizon.value.copy(c.horizon);su.uSun.value.copy(c.sun);su.uSunDir.value.copy(this.vec.sunDir);su.uSunSize.value=n.sunSize;su.uClouds.value=n.clouds;su.uStars.value=n.stars;su.uAurora.value=n.aurora;su.uFlash.value=fl;
  const fu=this.floor.material.uniforms;fu.uA.value.copy(c.gA);fu.uB.value.copy(c.gB);fu.uFog.value.copy(c.fog);fu.uMode.value.copy(this.vec.ground);fu.uSunDir.value.copy(this.vec.sunDir);fu.uSun.value.copy(c.sun);fu.uFlash.value=fl;
  const tu=this.towers.material.uniforms;tu.uFog.value.copy(c.fog);tu.uFogD.value=n.fogD*.62;tu.uSunDir.value.copy(this.vec.sunDir);tu.uKey.value.copy(c.key);tu.uAmb.value.copy(c.hemiSky).lerp(c.wall,.55);tu.uFlash.value=fl;
  this.scene.fog.color.copy(c.fog);this.scene.fog.density=n.fogD;this.hemi.color.copy(c.hemiSky);this.hemi.groundColor.copy(c.hemiGround);this.hemi.intensity=n.hemi*(1+fl*.8);this.key.color.copy(c.key);this.key.intensity=n.keyI;this.scene.environmentIntensity=n.env;this.stage.r.toneMappingExposure=n.exposure;
  this.edgeA.color.copy(c.edgeA).multiplyScalar(1.7);this.edgeB.color.copy(c.edgeB).multiplyScalar(1.7);this.trackMat.emissive.copy(c.edgeB).lerp(this.tmp.set(0xffffff),.45);
  return z;
 }
 render(g,d,now){
  this.stage.resize();this.prepare(d);const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;this.particles.reduced=this.hud.reduced=this.reduced;const real=now/1000,reduced=this.reduced,seed=g.worldSeed;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}const since=(now-this.statusSince)/1000;
  const zone=this.look(g,dt);
  const k=this.syncChunks(g),c=chunkAt(seed,g.s),f=frameIn(c,g.s),speed=g.status==='playing'?g.v:0,fast=smooth((speed-30)/24);
  // The pup on the surface.
  const P=at(f,g.x,g.h,!c.pipe,this.P);basisMatrix(P,this.holder.matrix);this.placePup(g,c,f,real,dt,since);
  // Gold through one instanced mesh; hoops vanish once flown through.
  const got=this.gotSet(g);let n=0;this.q2.setFromAxisAngle(this.v.set(0,1,0),reduced?0:real*4);
  for(let i=Math.max(0,k-1);i<=k+AHEAD&&n<this.coinCap;i++){const grp=this.chunks.get(seed+':'+i);if(!grp)continue;for(const coin of grp.userData.coins){if(n>=this.coinCap)break;if(coin.s<g.s-12||coin.s>g.s+330||got.has(coin.id))continue;this.q.copy(coin.q).multiply(this.q2);this.m4.compose(coin.p,this.q,this.sc);this.coins.setMatrixAt(n++,this.m4);}
   for(const m of grp.userData.rings)m.visible=!got.has(m.userData.id);}
  this.coins.count=n;this.coins.instanceMatrix.needsUpdate=true;
  this.placeBots(g,k,real);this.placeRivals(g,real,dt);this.placeGate(g);this.placeTowers(g);
  // Scrolling chevrons on pads and kickers.
  if(!reduced){this.padTex.offset.y=-(real*1.6%1);this.rampTex.offset.y=-(real*.9%1);}
  this.updateTrail(g,P,fast,dt);this.updateLines(speed,dt,g);
  // Wind and sparks.
  if(g.status==='playing'&&!reduced){if(g.grind)this.particles.burst(P.p.x,P.p.y+.05,P.p.z,2,0xffd27a,{speed:4,life:.3,up:1.5,stick:0});if(g.wall)this.particles.burst(P.p.x,P.p.y+.1,P.p.z,1,0x7ff3ff,{speed:3,life:.3,up:1,stick:0});if(g.boosting)this.particles.burst(P.p.x-P.t.x*.8,P.p.y+.7-P.t.y*.8,P.p.z-P.t.z*.8,2,0xffc14d,{speed:2.5,life:.35,gravity:0,up:0,stick:0});}
  this.particles.update(dt,undefined,-1e6);
  this.placeCamera(g,c,f,dt,since,real,fast);this.updateHud(g,zone,now);this.coach(g,c);this.cockpit(g,c,real);
  this.kick=Math.max(0,this.kick-dt*1.6);
  this.stage.render(dt,real,{reduced,aberration:.0006+fast*.0014+this.kick*.002});
 }
 showFeat(ft){const ui=this.ui;this.hud.set(ui.featN,'fn',ft.name.toUpperCase());this.hud.set(ui.featT,'ft',ft.text);ui.feat.hidden=false;ui.feat.classList.remove('tp-in');void ui.feat.offsetWidth;ui.feat.classList.add('tp-in');clearTimeout(this.featTimer);this.featTimer=setTimeout(()=>{ui.feat.hidden=true;},3400);}
 // A technique is spelled out the first couple of times the player is about to need it.
 tip(key,text){const n=this.tips[key]||0;if(n>=2||this.tipUntil>performance.now())return;this.tips[key]=n+1;const el=this.ui.tip;el.textContent=text;el.hidden=false;el.classList.remove('tp-in');void el.offsetWidth;el.classList.add('tp-in');this.tipUntil=performance.now()+3200;clearTimeout(this.tipTimer);this.tipTimer=setTimeout(()=>{el.hidden=true;},3000);}
 coach(g,c){
  if(g.status!=='playing')return;const touch=matchMedia('(pointer:coarse)').matches,next=turboChunk(g.worldSeed,c.k+1),soon=(list,test)=>[c,next].some(ch=>ch[list].some(o=>test(o,ch)));
  if(!g.grounded&&g.air>.25&&g.h>2&&!g.tricks)this.tip('flip',touch?'TAP IN THE AIR TO FLIP · LAND IT CLEAN':'↑ IN THE AIR TO FLIP · LAND IT CLEAN');
  else if(soon('hazards',o=>o.type==='bar'&&o.s-g.s>20&&o.s-g.s<70))this.tip('roll',touch?'SWIPE DOWN TO ROLL UNDER THE BAR':'↓ ROLLS UNDER THE BAR');
  else if(soon('hazards',o=>o.type==='hurdle'&&o.s-g.s>20&&o.s-g.s<70))this.tip('jump',touch?'TAP TO JUMP THE HURDLE':'↑ JUMPS THE HURDLE');
  else if(soon('decks',o=>o.s0-g.s>10&&o.s0-g.s<80))this.tip('deck','THE '+(soon('decks',o=>o.side>0)?'RIGHT':'LEFT')+' LANE CLIMBS TO THE HIGH ROAD: MORE GOLD, JUMP THE GAPS');
  else if(c.pipe&&g.s>c.pipe[0]+6&&g.s<c.pipe[1]-50&&!g.wall)this.tip('wall','STEER PAST THE OUTER LANE TO RIDE THE WALL');
  else if(soon('rails',o=>o.s0-g.s>10&&o.s0-g.s<60))this.tip('rail','STAY IN THE LANE WITH THE RAIL TO GRIND OVER THE SPIKES');
  else if(g.fuel>.7&&!g.boosting&&g.time>6)this.tip('turbo',touch?'HOLD THE SCREEN TO BURN TURBO':'HOLD SPACE TO BURN TURBO');
  else if(soon('hazards',o=>o.type==='bot'&&o.s-g.s>20&&o.s-g.s<60))this.tip('bot',touch?'SWIPE DOWN: ROLL THROUGH PURPLE BOTS':'↓ ROLLS THROUGH PURPLE BOTS');
 }
 // First person: paws on the deck, and a lane radar that names what is coming in each lane.
 cockpit(g,c,real){
  const ui=this.ui,on=this.cameraMode==='first'&&g.status==='playing';ui.cock.hidden=!on;if(!on)return;
  const run=g.grounded&&!g.rolling?Math.sin(g.time*g.v*.42):0,lift=g.grounded?0:Math.min(1,g.air*3),tuck=g.rolling>0?1:0,st=ui.cock.style;
  st.setProperty('--pl',((run*9)-lift*18+tuck*30).toFixed(1)+'%');st.setProperty('--pr',((-run*9)-lift*18+tuck*30).toFixed(1)+'%');st.setProperty('--lean',(-(this.lean||0)*14).toFixed(1)+'deg');ui.cock.dataset.hurt=g.invuln>TURBO.invuln-.5?'1':'0';ui.cock.dataset.boost=g.boosting?'1':'0';
  const next=turboChunk(g.worldSeed,c.k+1),reach=Math.max(60,g.v*2.6),cells=[null,null,null];
  if(g.h<3&&!g.locked)for(const ch of [c,next])for(const b of ch.hazards){const d=b.s+(b.len||0)-g.s;if(d<0||b.s-g.s>reach||g.smashed.includes(b.id))continue;for(let l=-1;l<=1;l++){if(b.lane!==null&&b.lane!==l&&b.type!=='bot')continue;const dist=Math.max(0,b.s-g.s);if(!cells[l+1]||dist<cells[l+1].d)cells[l+1]={d:dist,type:b.type};}}
  const label={block:'✕',spikes:'▲▲',bar:'▼ ROLL',hurdle:'▲ JUMP',bot:'◆ ROLL'};
  ui.radar.forEach((el,i)=>{const cell=cells[i],mine=g.lane===i-1;this.hud.set(el,'r'+i,cell?label[cell.type]+' '+Math.round(cell.d)+'m':mine?'●':'');el.dataset.kind=cell?(cell.type==='bar'||cell.type==='bot'?'roll':cell.type==='hurdle'?'jump':'bad'):'';el.dataset.mine=mine?'1':'0';el.dataset.now=cell&&cell.d<g.v*.9?'1':'0';});
 }
 gotSet(g){const key=g.collected.length+':'+(g.collected[g.collected.length-1]||'')+':'+g.worldSeed;if(key!==this.gotKey){this.gotKey=key;this.got=new Set(g.collected);}return this.got;}
 placePup(g,c,f,real,dt,since){
  const a=this.asset,v=this.pivot,playing=g.status==='playing',over=g.status==='over',first=this.cameraMode==='first'&&playing,P=this.P;
  // Lean into lane changes; pitch with the roll, the flip and the dive.
  const lean=Math.max(-.5,Math.min(.5,(laneX(c,g.lane)-g.x)*.28));this.lean=(this.lean||0)+(lean-(this.lean||0))*Math.min(1,dt*14);
  let rx=0,ry=0,rz=-this.lean,sy=1,pose='run',t=g.time*Math.max(.7,g.v/15);
  if(!playing&&!over){pose='idle';t=real;}
  else if(over){pose='idle';t=real;}
  else if(g.invuln>TURBO.invuln-.55){const u=(TURBO.invuln-g.invuln)/.55;ry=u*Math.PI*2;rx=-.5*Math.sin(u*Math.PI);pose='still';}
  else if(g.rolling>0){this.spin=(this.spin||0)+dt*g.v*1.1;rx=this.spin;sy=.72;pose='still';}
  else if(g.stomping){rx=1.15;sy=1.12;pose='still';}
  else if(g.flip>0){rx=-g.flip*Math.PI*2;sy=.82;pose='still';}
  else if(g.grind){ry=.95;rz=-.12+Math.sin(real*9)*.04;rx=-.18;sy=.9;pose='idle';}
  else if(!g.grounded){rx=-Math.max(-.5,Math.min(.45,g.vy*.03));pose='run';t=.12;}
  else rx=.1+Math.min(.22,Math.max(0,(g.v-30)*.008))+(g.boosting?.12:0);
  if(!g.rolling)this.spin=0;
  v.rotation.set(rx,ry,rz);v.scale.set(1,sy,1);v.position.y=TURBO.body*(g.rolling>0?.72:1);
  if(a){a.root.visible=!first;setDawgPose(a,t,pose);}
  this.holder.visible=!(g.invuln>0&&!this.reduced&&playing&&Math.floor(real*18)%2===0);
  
  this.halo.material.opacity=first?0:.1*smooth((g.v-34)/20);this.halo.material.color.copy(this.trailB).multiplyScalar(.35);
  // Shadow blob on whatever is underneath; the sun follows the pup.
  const fl=floorIn(c,g.s,g.x,g.h);this.blob.visible=fl!==null;if(fl!==null){const B=at(f,g.x,fl+.04,!c.pipe,this.C),s=1.9/(1+(g.h-fl)*.35);basisMatrix(B,this.blob.matrix);this.blob.matrix.scale(this.v.set(s,1,s));}
  this.key.position.copy(P.p).addScaledVector(this.vec.sunDir,40);this.key.target.position.copy(P.p);this.key.target.updateMatrixWorld();
 }
 makeBot(){const g=new T.Group(),body=new T.Mesh(new T.SphereGeometry(.62,16,12).scale(1,.8,1).translate(0,.75,0),this.botBody),eye=new T.Mesh(new T.BoxGeometry(.7,.14,.1),this.botEye),ring=new T.Mesh(new T.TorusGeometry(.8,.05,6,24).rotateX(Math.PI/2),this.botEye);eye.position.set(0,.8,-.56);ring.position.y=.45;g.add(body,eye,ring);g.matrixAutoUpdate=false;if(this.stage.quality==='high')body.castShadow=true;this.scene.add(g);return g;}
 placeBots(g,k,real){let used=0;const seed=g.worldSeed;for(let i=Math.max(0,k-1);i<=k+2;i++){const ch=turboChunk(seed,i);for(const b of ch.hazards){if(b.type!=='bot'||g.smashed.includes(b.id)||b.s<g.s-10)continue;let bot=this.bots[used];if(!bot){bot=this.makeBot();this.bots.push(bot);}bot.visible=true;const x=laneX(ch,b.lane)+Math.sin(g.time*b.sp+b.ph)*b.amp;at(frameIn(ch,b.s),x,.15+(this.reduced?0:Math.sin(real*5+b.ph)*.12),!ch.pipe);basisMatrix(O,bot.matrix);used++;}}for(let i=used;i<this.bots.length;i++)this.bots[i].visible=false;}
 // Rival pups: real DAWGs on the full profile, glowing stand-ins on the light one.
 placeRivals(g,real,dt){
  const seed=g.worldSeed,high=this.quality==='high',cols=[0xff5fc8,0x5ee7ff,0xffd25e];
  g.rivals.forEach((r,i)=>{let o=this.rivals[i];if(!o){const holder=new T.Group();holder.matrixAutoUpdate=false;let asset=null;if(high){asset=createDawgAsset(npcDawg('Turbo rival '+['Blitz','Comet','Dynamo'][i]));asset.root.traverse(m=>{if(m.isMesh)m.castShadow=true;});holder.add(asset.root);}else{const m=new T.Mesh(new T.CapsuleGeometry(.42,.8,4,10).translate(0,.85,0),new T.MeshStandardMaterial({color:cols[i],emissive:cols[i],emissiveIntensity:.8,roughness:.4}));holder.add(m);}
    const tag=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(cols[i]).multiplyScalar(1.4),transparent:true,opacity:.5,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));tag.position.y=.9;tag.scale.set(3,3,1);holder.add(tag);this.scene.add(holder);o=this.rivals[i]={holder,asset};}
   const d=r.s-g.s;o.holder.visible=d>-40&&d<340;if(!o.holder.visible)return;const ch=chunkAt(seed,r.s);
   // Rivals hop what they cannot steer round, and fly the big gaps.
   let h=0;for(const rp of ch.ramps)if(!rp.d&&rp.lane===null&&r.s>rp.s&&r.s<rp.s+38){const u=(r.s-rp.s)/38;h=Math.max(h,4*u*(1-u)*4.2);}for(const b of ch.hazards)if(b.lane===null&&Math.abs(r.s-b.s)<5){const u=(r.s-b.s+5)/10;h=Math.max(h,b.type==='bar'?0:4*u*(1-u)*1.4);}
   at(frameIn(ch,r.s),r.x,h,!ch.pipe);basisMatrix(O,o.holder.matrix);if(o.asset&&d<160)setDawgPose(o.asset,g.time*1.9+i,'run');});
 }
 placeGate(g){const s=g.cp*CP,c=chunkAt(g.worldSeed,s);this.gate.visible=s-g.s<380&&!(c.loop&&s>c.loop[0]&&s<c.loop[1]);if(!this.gate.visible)return;at(frameIn(c,s),0,c.gaps.some(([p,q])=>s>p&&s<q)?-.5:0,true);basisMatrix(O,this.gate.matrix);}
 // Towers stand either side of the course, a slot every 26 m, restyled per zone; none may block the track.
 placeTowers(g){
  const SLOT=26,per=6,slots=Math.floor(this.TOWERS/per),first=Math.floor(g.s/SLOT)-3,seed=g.worldSeed;if(this.towerSlot===first&&this.towerSeed===seed)return;const fresh=this.towerSeed!==seed;this.towerSlot=first;this.towerSeed=seed;this.towerAt??=new Int32Array(slots).fill(-99999);
  const tint=this.towers.geometry.attributes.aTint,look=this.towers.geometry.attributes.aLook;let changed=false;
  for(let j=0;j<slots;j++){const a=first+j,slot=((a%slots)+slots)%slots;if(this.towerAt[slot]===a&&!fresh)continue;this.towerAt[slot]=a;changed=true;const s=a*SLOT,z=zoneAt(s),ch=chunkAt(seed,Math.max(0,s)),f=frameIn(ch,Math.max(0,s));
   for(let i=0;i<per;i++){const idx=slot*per+i,h=n=>hash(seed^0x51ed,a*61+i*7+n),side=i%2?1:-1;let ok=h(0)<z.density;
    const lat=side*(26+Math.pow(h(1),1.5)*(i<2?60:230)),x=f.p[0]+Math.cos(f.psi)*-lat,zz=f.p[2]+Math.sin(f.psi)*lat,w=9+h(2)*13,dpt=9+h(3)*13,top=f.p[1]+z.tall[0]+Math.pow(h(4),1.7)*(z.tall[1]-z.tall[0])+Math.abs(lat)*.05;
    // Keep clear of the ribbon anywhere near this slot.
    if(ok)for(let q=-260;q<=260&&ok;q+=20){const ss=s+q;if(ss<0)continue;const fq=frameIn(chunkAt(seed,ss),ss),dx=fq.p[0]-x,dz=fq.p[2]-zz;if(dx*dx+dz*dz<(22+w)*(22+w)&&top>fq.p[1]-14)ok=false;}
    if(!ok||top<GROUND+8){this.m4.makeScale(0,0,0);this.towers.setMatrixAt(idx,this.m4);continue;}
    this.q.setFromAxisAngle(this.v.set(0,1,0),h(5)*Math.PI);this.m4.compose(this.v.set(x,GROUND,zz),this.q,this.v2.set(z.storm?w*.55:w,top-GROUND,z.storm?dpt*.55:dpt));this.towers.setMatrixAt(idx,this.m4);
    const tc=this.tmp.set(z.tints[Math.floor(h(6)*z.tints.length)]);tint.setXYZ(idx,tc.r*1.5,tc.g*1.5,tc.b*1.5);look.setXYZW(idx,h(7),z.lit*(.5+h(8)),0,z.storm?1:h(9)<.2?1:0);}}
  if(changed){this.towers.instanceMatrix.needsUpdate=true;tint.needsUpdate=true;look.needsUpdate=true;}
 }
 updateTrail(g,P,fast,dt){
  const N=this.TRAIL,pos=this.trailMesh.geometry.attributes.position,col=this.trailMesh.geometry.attributes.color,show=g.status==='playing'&&!this.reduced&&this.cameraMode!=='first';this.trailMesh.visible=show;if(!show){this.trail.length=0;return;}
  this.trail.unshift({p:P.p.clone().addScaledVector(P.n,.75),r:P.r.clone()});if(this.trail.length>N)this.trail.length=N;const power=.5+fast*.9+(g.boosting?.9:0);
  for(let i=0;i<N;i++){const t=this.trail[Math.min(i,this.trail.length-1)],u=i/(N-1),w=.07*(1-u*.6),c=this.tmp.copy(this.trailA).lerp(this.trailB,u).multiplyScalar((1-u)*(1-u)*power*(i<this.trail.length?1:0));
   [-.42-w,-.42+w,.42-w,.42+w].forEach((o,j)=>{pos.setXYZ(i*4+j,t.p.x+t.r.x*o,t.p.y+t.r.y*o,t.p.z+t.r.z*o);col.setXYZ(i*4+j,c.r,c.g,c.b);});}
  pos.needsUpdate=true;col.needsUpdate=true;
 }
 updateLines(speed,dt,g){const k=this.reduced?0:smooth((speed-32)/22)*(g.locked?.6:1)+(g.boosting?.35:0),mat=this.lines.material;mat.opacity+=(Math.min(1,k)*(this.cameraMode==='first'?.42:.26)-mat.opacity)*Math.min(1,dt*5);this.lines.visible=mat.opacity>.01;if(!this.lines.visible)return;
  mat.color.copy(this.trailB).lerp(this.tmp.set(0xffffff),.7);for(let i=0;i<this.LINES;i++){const L=this.lineData[i];L.z+=speed*dt*1.5;if(L.z>1){L.z=-48;L.a=Math.random()*Math.PI*2;L.r=2.4+Math.random()*5.5;}this.q.setFromAxisAngle(this.v.set(0,0,1),L.a+Math.PI/2);this.m4.compose(this.v2.set(Math.cos(L.a)*L.r,Math.sin(L.a)*L.r,L.z),this.q,this.v3.set(1,1,L.l*(2+speed*.16)));this.lines.setMatrixAt(i,this.m4);}this.lines.instanceMatrix.needsUpdate=true;}
 placeCamera(g,c,f,dt,since,real,fast){
  const cam=this.camera,seed=g.worldSeed,P=this.P,ready=g.status==='ready',over=g.status==='over',portrait=cam.aspect<1,first=this.cameraMode==='first'&&!ready&&!over;
  const [, ,ang]=c.pipe?crossSection(g.x):[0,0,0];this.camH+=(g.h-this.camH)*Math.min(1,dt*(g.h<this.camH?9:5));this.camX+=(g.x-this.camX)*Math.min(1,dt*8);this.camRoll+=(ang*.55-this.camRoll)*Math.min(1,dt*5);
  let fov=60;
  if(ready||over){
   // A slow orbit round the pup on the start line, and a pull-back when the clock runs out.
   const a=ready?real*.25+.6:2.6+since*.2,R=ready?(portrait?6.2:5.2):7+Math.min(4,since*1.5),hgt=ready?1.9:3;cam.position.copy(P.p).addScaledVector(P.t,-Math.cos(a)*R).addScaledVector(P.r,Math.sin(a)*R).addScaledVector(P.n,hgt);cam.up.copy(P.n);this.v.copy(P.p).addScaledVector(P.n,1.1);this.stage.applyShake(real,this.reduced);cam.lookAt(this.v);fov=portrait?58:46;}
  else if(first){
   const eye=g.rolling>0?1.05:1.75;this.eye=(this.eye??eye)+(eye-this.eye)*Math.min(1,dt*12);cam.position.copy(P.p).addScaledVector(P.n,this.eye).addScaledVector(P.t,-.25);const sa=g.s+24,ca=chunkAt(seed,sa),A=at(frameIn(ca,sa),this.camX*.85,this.camH*.75+.2,true,this.C);cam.up.copy(P.n).add(this.v3.copy(A.n)).normalize();if(g.invuln>TURBO.invuln-.4)this.stage.applyShake(real,this.reduced);cam.lookAt(A.p);fov=(portrait?74:70)+fast*8+this.kick*4;}
  else{
   // Chase: the camera sits on the track frame a little behind the pup, so it banks, loops and rolls with it.
   const back=(portrait?8.6:7)+fast*1.6-this.kick*.8,up=(portrait?3.9:2.9)+this.camH*.55,sb=g.s-back,cb=chunkAt(seed,sb),B=at(frameIn(cb,sb),this.camX*.72,up,true,this.C);cam.position.copy(B.p);
   this.v2.copy(B.n).multiplyScalar(Math.cos(this.camRoll)).addScaledVector(B.r,-Math.sin(this.camRoll));const sa=g.s+(portrait?13:17),ca=chunkAt(seed,sa),A=at(frameIn(ca,sa),this.camX*.55,this.camH*.7+(portrait?.2:.9),true,this.C);
   // The up vector blends the frame behind and ahead, which keeps a loop from snapping.
   cam.up.copy(this.v2).add(this.v3.copy(A.n)).add(P.n).normalize();this.stage.applyShake(real,this.reduced);cam.lookAt(A.p);fov=62+fast*17+this.kick*7+(g.boosting?4:0);}
  cam.fov+=(fitFov(fov,cam.aspect,first?84:ready||over?46:62)-cam.fov)*Math.min(1,dt*(ready?20:6));cam.updateProjectionMatrix();
  this.sky.position.copy(cam.position);this.floor.position.set(cam.position.x,GROUND,cam.position.z);
 }
 updateHud(g,zone,now){
  const h=this.hud,ui=this.ui,playing=g.status==='playing';h.set(ui.speedN,'v',String(kmh(g.v)));ui.speed.dataset.hot=g.v>44?'1':'0';h.set(ui.zone,'z','ZONE '+(g.zone+1)+' · '+stageName(g.zone)+' · NEXT '+STAGES[(g.zone+1)%STAGES.length]+' '+Math.max(0,Math.ceil((g.zone+1)*CP-g.distance))+' M');
  h.set(ui.clockN,'t',g.clock.toFixed(1));ui.clock.dataset.low=g.clock<8&&playing?'1':'0';ui.clock.dataset.up=now-(this.clockUp||-1e9)<900?'1':'0';h.set(ui.gold,'g',String(g.gold));
  ui.bar.style.transform=`scaleX(${g.fuel.toFixed(3)})`;ui.turbo.dataset.on=g.boosting?'1':'0';ui.turbo.dataset.empty=g.fuel<TURBO.ignite?'1':'0';h.set(ui.hint,'h',g.fuel<TURBO.ignite?'TRICKS + GOLD REFILL':matchMedia('(pointer:coarse)').matches?'HOLD THE SCREEN':'HOLD SPACE');
  ui.combo.hidden=!(g.combo>=2&&playing);if(g.combo>=2){h.set(ui.comboN,'c','×'+Math.min(TURBO.maxCombo,g.combo));ui.comboBar.style.transform=`scaleX(${Math.max(0,g.comboTime/TURBO.comboWindow).toFixed(2)})`;}h.live(playing);
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;clearTimeout(this.featTimer);clearTimeout(this.tipTimer);this.ambient?.stop();this.hud?.dispose();try{this.asset?.dispose();for(const r of this.rivals)r?.asset?.dispose();for(const grp of this.chunks.values())for(const geo of grp.userData.geos)geo.dispose();}catch{}this.stage?.dispose();}
}
