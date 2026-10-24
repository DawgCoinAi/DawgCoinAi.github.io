// Three.js presentation for DAWG Dash. RunnerGame stays the only source of rules, input,
// time, collisions, scoring and checkpoints: this module reads the game and draws it.
// Its own animation frames only run while no run is ticking (idle orbit, crash camera).
import {T,createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {EffectComposer,RenderPass,UnrealBloomPass,OutputPass,ShaderPass} from './vendor/three.js';
import {worldLook,hash} from './world.js';

export const LANE=2.4,DEPTH=.62,ROAD_HALF=4.4,WALK=3.2;
export const dashPoint=(lane,z)=>({x:(lane-1)*LANE,z:-z*DEPTH});
// Recycled scenery: slot a always sits at world distance a*spacing, so a building, sign
// or gate keeps the same look while the camera passes it and after a checkpoint resume.
export const slotZ=(a,spacing,travelled)=>travelled-a*spacing;
export const firstSlot=(spacing,travelled,behind=2)=>Math.floor(travelled/spacing)-behind;
export const jumpLift=jump=>jump>0?Math.sin((1-jump/.85)*Math.PI)*1.75:0;
export function dashQuality(env=globalThis){
 const coarse=!!env.matchMedia?.('(pointer: coarse)').matches,cores=env.navigator?.hardwareConcurrency||4,memory=env.navigator?.deviceMemory||8;
 return coarse||cores<=4||memory<=4?'low':'high';
}
// Keeps the three lanes in frame on portrait screens by widening the vertical field of view.
export function fitFov(base,aspect,minHorizontal=64){
 const need=2*Math.atan(Math.tan(minHorizontal*Math.PI/360)/Math.max(.2,aspect))*180/Math.PI;
 return Math.min(84,Math.max(base,need));
}

const SIGNS=[['DAWG','#b9ff5e'],['AFTER HOURS','#ff5fc8'],['RAMEN','#ff8a3d'],['ARCADE','#5ee7ff'],['24/7','#ffe45e'],['$DAWG','#b9ff5e'],['BARK BAR','#c78bff'],['HOTEL','#ff5f7a'],['NOODLES','#5effc1'],['PAWN','#ffd27a'],['KARAOKE','#ff7af0'],['GOLD','#ffd25e']];
const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
const glowColor=(hex,boost)=>new T.Color(hex).multiplyScalar(boost);
// Bakes several static parts that share a material into one geometry, so they cost one draw call.
function merge(parts){const out=new T.BufferGeometry();for(const name of ['position','normal','uv']){const arrays=parts.map(g=>(g.index?g.toNonIndexed():g).getAttribute(name).array),size=parts[0].getAttribute(name).itemSize,data=new Float32Array(arrays.reduce((n,a)=>n+a.length,0));let at=0;for(const a of arrays){data.set(a,at);at+=a.length;}out.setAttribute(name,new T.BufferAttribute(data,size));}for(const g of parts)g.dispose();return out;}
function canvas(w,h){const el=document.createElement('canvas');el.width=w;el.height=h;return el;}
function texture(w,h,draw,{repeat=false,color=true}={}){const el=canvas(w,h);draw(el.getContext('2d'),w,h);const t=new T.CanvasTexture(el);if(color)t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
function radial(stops){return texture(128,128,(c,w)=>{const g=c.createRadialGradient(64,64,0,64,64,64);for(const [at,col]of stops)g.addColorStop(at,col);c.fillStyle=g;c.fillRect(0,0,w,w);});}
function facade(variant,lit){
 // One 512px tile covers 16 m of wall; the emissive copy holds only the lit windows.
 return texture(512,512,(c,w,h)=>{
  c.fillStyle=lit?'#000':['#151a2b','#1b1529','#111e26','#1d1722'][variant];c.fillRect(0,0,w,h);
  if(!lit){for(let y=0;y<16;y++){c.fillStyle='#ffffff12';c.fillRect(0,y*32+28,w,2);c.fillStyle='#00000040';c.fillRect(0,y*32+30,w,2);}c.fillStyle='#ffffff10';for(let x=0;x<4;x++)c.fillRect(x*128,0,5,h);for(let i=0;i<5000;i++){c.fillStyle=hash(variant+70,i)>.5?'#ffffff06':'#0000001a';c.fillRect(hash(variant+71,i)*w,hash(variant+72,i)*h,3,3);}}
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const r=hash(variant*977+31,y*16+x)*(.75+.25*hash(variant*13+5,y)),on=r>.66;
   if(lit&&!on)continue;c.fillStyle=on?(r>.93?'#8eeaff':r>.86?'#ff9ad5':r>.8?'#c3ff8f':'#ffcf96'):'#080b14';c.globalAlpha=on&&lit?.55+hash(variant,x*31+y)*.45:1;c.fillRect(x*32+7,y*32+6,18,21);}
  c.globalAlpha=1;
 },{repeat:true});
}
function signTexture(text,color,vertical){
 const chars=[...text],w=vertical?120:Math.max(260,text.length*62),h=vertical?Math.max(3,chars.length)*96+36:130;
 return {map:texture(w,h,(c)=>{c.fillStyle='#07060dd8';c.beginPath();c.roundRect(4,4,w-8,h-8,14);c.fill();c.lineWidth=5;c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=18;c.stroke();
  c.font=`900 ${vertical?78:82}px system-ui, sans-serif`;c.textAlign='center';c.textBaseline='middle';c.lineWidth=7;
  const glyph=(s,x,y)=>{c.shadowBlur=26;c.strokeStyle=color;c.strokeText(s,x,y);c.shadowBlur=6;c.fillStyle='#fff6fb';c.fillText(s,x,y);};
  if(vertical)chars.forEach((ch,i)=>glyph(ch,w/2,66+i*96));else glyph(text,w/2,h/2+4);}),aspect:w/h};
}
function roadTextures(){
 const puddles=Array.from({length:22},(_,i)=>({x:hash(71,i)*256,y:hash(72,i)*1024,rx:14+hash(73,i)*46,ry:40+hash(74,i)*120}));
 const map=texture(256,1024,(c,w,h)=>{c.fillStyle='#0d111b';c.fillRect(0,0,w,h);for(let i=0;i<9000;i++){const v=hash(5,i);c.fillStyle=v>.5?'#ffffff08':'#00000020';c.fillRect(hash(6,i)*w,hash(7,i)*h,2,2);}
  c.strokeStyle='#00000055';c.lineWidth=2;for(let i=0;i<14;i++){c.beginPath();let x=hash(8,i)*w,y=hash(9,i)*h;c.moveTo(x,y);for(let k=0;k<6;k++){x+=(hash(10,i*9+k)-.5)*40;y+=hash(11,i*9+k)*40;c.lineTo(x,y);}c.stroke();}
  for(const p of puddles){c.fillStyle='#05070d70';c.beginPath();c.ellipse(p.x,p.y,p.rx,p.ry,0,0,Math.PI*2);c.fill();}},{repeat:true});
 const rough=texture(256,1024,(c,w,h)=>{c.fillStyle='#c8c8c8';c.fillRect(0,0,w,h);c.filter='blur(6px)';for(const p of puddles){c.fillStyle='#5a5a5a';c.beginPath();c.ellipse(p.x,p.y,p.rx,p.ry,0,0,Math.PI*2);c.fill();}},{repeat:true,color:false});
 return {map,rough};
}
function pavement(){return texture(256,256,(c,w,h)=>{c.fillStyle='#171b28';c.fillRect(0,0,w,h);c.strokeStyle='#0a0d16';c.lineWidth=4;for(let i=0;i<=4;i++){c.beginPath();c.moveTo(0,i*64);c.lineTo(w,i*64);c.stroke();c.beginPath();c.moveTo(i*64,0);c.lineTo(i*64,h);c.stroke();}for(let i=0;i<1600;i++){c.fillStyle=hash(12,i)>.5?'#ffffff07':'#00000018';c.fillRect(hash(13,i)*w,hash(14,i)*h,2,2);}},{repeat:true});}
function skylineTexture(){
 return texture(2048,256,(c,w,h)=>{c.clearRect(0,0,w,h);let x=0,i=0;while(x<w){const bw=24+hash(40,i)*70,bh=40+hash(41,i)*190;c.fillStyle='#0b0f1d';c.fillRect(x,h-bh,bw,bh);if(hash(42,i)>.6){c.fillRect(x+bw/2-2,h-bh-26,4,26);}
  for(let y=h-bh+8;y<h-6;y+=9)for(let k=4;k<bw-4;k+=8)if(hash(43,i*977+y*7+k)>.78){c.fillStyle=hash(44,i+y+k)>.5?'#ffcf9655':'#8eeaff44';c.fillRect(x+k,y,3,4);}x+=bw+hash(45,i)*6;i++;}},{repeat:true});
}
function crateTexture(lit){return texture(256,160,(c,w,h)=>{c.fillStyle=lit?'#000':'#3a2a22';c.fillRect(0,0,w,h);if(!lit){c.fillStyle='#4d382c';for(let y=0;y<h;y+=20)c.fillRect(0,y,w,14);c.strokeStyle='#1c130f';c.lineWidth=10;c.strokeRect(5,5,w-10,h-10);c.beginPath();c.moveTo(10,10);c.lineTo(w-10,h-10);c.moveTo(w-10,10);c.lineTo(10,h-10);c.stroke();}
 c.fillStyle='#c6ff5c';c.font='900 70px system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('▲',w/2,h/2);c.fillRect(0,0,w,7);});}
function hazardTexture(lit){return texture(256,256,(c,w,h)=>{c.fillStyle=lit?'#000':'#16141c';c.fillRect(0,0,w,h);c.save();c.beginPath();c.rect(0,0,w,74);c.rect(0,h-74,w,74);c.clip();for(let i=-4;i<12;i++){c.fillStyle=i%2?(lit?'#000':'#16141c'):'#ff6a2a';c.beginPath();c.moveTo(i*36,0);c.lineTo(i*36+36,0);c.lineTo(i*36-40,h);c.lineTo(i*36-76,h);c.fill();}c.restore();
 c.fillStyle=lit?'#ff3d5a':'#2a1c26';c.font='900 96px system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('✕',w/2,h/2+4);});}
const GRADE={uniforms:{tDiffuse:{value:null},uTime:{value:0},uAberration:{value:.002},uVignette:{value:.85},uFlash:{value:0},uFlashColor:{value:new T.Color(1,1,1)}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uAberration,uVignette,uFlash;uniform vec3 uFlashColor;varying vec2 vUv;
 void main(){vec2 c=vUv-.5;float d=dot(c,c);vec2 off=c*uAberration*(.4+d*5.);vec3 col=vec3(texture2D(tDiffuse,vUv+off).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-off).b);
 col*=mix(1.,smoothstep(.75,.12,d),uVignette*.55);float n=fract(sin(dot(vUv*vec2(12.9898,78.233)+fract(uTime),vec2(1.)))*43758.5453);col+=(n-.5)*.03;gl_FragColor=vec4(mix(col,uFlashColor,uFlash),1.);}`};
const SKY={uniforms:{uTop:{value:new T.Color()},uHorizon:{value:new T.Color()},uGlow:{value:new T.Color()}},
 vertexShader:'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform vec3 uTop,uHorizon,uGlow;varying vec3 vDir;void main(){float h=clamp(vDir.y,-.2,1.);vec3 col=mix(uHorizon,uTop,smoothstep(0.,.55,h));col+=uGlow*pow(1.-abs(h),7.)*.9;gl_FragColor=vec4(col,1.);}'};
const AURA={uniforms:{uColor:{value:new T.Color()},uTime:{value:0},uAlpha:{value:0}},
 vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
 fragmentShader:'uniform vec3 uColor;uniform float uTime,uAlpha;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(vN,vV)),2.4);float bands=.75+.25*sin(vN.y*18.+uTime*6.);gl_FragColor=vec4(uColor*2.2,f*bands*uAlpha);}'};

export class ThreeDash {
 constructor(target,onFailure,{quality=dashQuality()}={}){this.target=target;this.onFailure=onFailure;this.quality=quality;this.ready=false;this.failed=false;this.dead=false;this.live=new Map();this.free={};this.frame=0;this.trauma=0;this.flash=0;this.flashColor=new T.Color(1,1,1);this.combo=0;this.lastJump=0;this.asset=null;this.assetKey='';this.lastGame=null;this.ambient=0;this.statusSince=performance.now();this.status='';this.district=-1;this.clock=performance.now();this.slowFrames=0;}
 async init(){
  const view=document.createElement('div');view.className='dash-gpu dash3d';view.setAttribute('aria-hidden','true');this.view=view;
  const el=this.canvas=canvas(420,560);el.className='d3-canvas';view.append(el);this.hud=this.makeHud();view.append(this.hud.root);
  const high=this.quality==='high';
  const r=this.r=new T.WebGLRenderer({canvas:el,antialias:false,powerPreference:'high-performance',stencil:false});
  r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=.92;r.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,high?1.75:1));r.shadowMap.enabled=high;r.shadowMap.type=T.PCFShadowMap;
  this.loss=e=>{e.preventDefault();this.fail();};el.addEventListener('webglcontextlost',this.loss);
  this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(60,.75,.1,520);this.camera.position.set(0,3,7);
  this.composer=new EffectComposer(r);this.composer.addPass(new RenderPass(this.scene,this.camera));
  this.bloom=new UnrealBloomPass(new T.Vector2(256,256),high?.85:.75,.55,.92);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
  this.grade=new ShaderPass(GRADE);this.composer.addPass(this.grade);
  this.build();this.target.parentElement.append(view);this.ready=true;this.onAsset?.('3D CITY · LIVE');return this;
 }
 makeHud(){
  const root=document.createElement('div');root.className='d3-hud';
  root.innerHTML='<div class="d3-meter"><b class="d3-dist">0</b><small>M</small></div><div class="d3-gold"><i></i><b>0</b></div><div class="d3-zone"></div><div class="d3-power" hidden><span></span><em><s></s></em></div><div class="d3-pops"></div><div class="d3-banner" hidden></div>';
  const q=s=>root.querySelector(s);return {root,dist:q('.d3-dist'),gold:q('.d3-gold b'),zone:q('.d3-zone'),power:q('.d3-power'),powerLabel:q('.d3-power span'),powerBar:q('.d3-power s'),pops:q('.d3-pops'),banner:q('.d3-banner'),cache:{}};
 }
 set(el,key,value){if(this.hud.cache[key]!==value){this.hud.cache[key]=value;el.textContent=value;}}
 pop(text,kind='gold'){if(this.reduced&&kind!=='big')return;const p=document.createElement('span');p.className='d3-pop d3-'+kind;p.textContent=text;p.style.setProperty('--x',((Math.random()-.5)*60).toFixed(0)+'px');this.hud.pops.append(p);setTimeout(()=>p.remove(),1100);while(this.hud.pops.children.length>6)this.hud.pops.firstChild.remove();}
 banner(text){const b=this.hud.banner;b.textContent=text;b.hidden=false;b.classList.remove('d3-show');void b.offsetWidth;b.classList.add('d3-show');clearTimeout(this.bannerTimer);this.bannerTimer=setTimeout(()=>{b.hidden=true;},2600);}
 build(){
  const s=this.scene,high=this.quality==='high',env=new T.Scene();
  // A neon light box baked into an environment map gives wet streets and gold coins colored reflections.
  env.background=new T.Color(0x05060c);for(const [x,y,z,w,h,col]of [[-6,3,-8,10,2,0xff4fc0],[6,4,-8,10,2,0x48e6ff],[0,7,6,14,1.5,0xb9ff5e],[-8,1,4,4,6,0x9f6bff],[8,2,4,4,6,0xff8a3d],[0,-3,0,30,.5,0x101828]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(col).multiplyScalar(3),side:T.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);env.add(m);}
  const pm=new T.PMREMGenerator(this.r);this.envMap=pm.fromScene(env,.03);pm.dispose();env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});s.environment=this.envMap.texture;s.environmentIntensity=.7;
  s.fog=new T.FogExp2(0x161a33,.0105);
  this.sky=new T.Mesh(new T.SphereGeometry(470,32,16),new T.ShaderMaterial({...SKY,uniforms:T.UniformsUtils.clone(SKY.uniforms),side:T.BackSide,depthWrite:false,fog:false}));s.add(this.sky);
  const starGeo=new T.BufferGeometry(),stars=[];for(let i=0;i<500;i++){const a=hash(91,i)*Math.PI*2,y=.12+hash(92,i)*.8,r=440;stars.push(Math.cos(a)*r*(1-y*.5),y*r,Math.sin(a)*r*(1-y*.5));}starGeo.setAttribute('position',new T.Float32BufferAttribute(stars,3));
  this.stars=new T.Points(starGeo,new T.PointsMaterial({color:0xe8e4ff,size:1.6,sizeAttenuation:false,fog:false,transparent:true,opacity:.75,depthWrite:false}));s.add(this.stars);
  this.moon=new T.Sprite(new T.SpriteMaterial({map:radial([[0,'#fffaf0'],[.32,'#fff2d6'],[.36,'#ffe3b366'],[1,'#ffd09000']]),fog:false,depthWrite:false,color:new T.Color(1.6,1.5,1.4)}));this.moon.scale.set(70,70,1);s.add(this.moon);
  this.skyline=new T.Mesh(new T.CylinderGeometry(300,300,150,64,1,true),new T.MeshBasicMaterial({map:skylineTexture(),transparent:true,side:T.BackSide,fog:false,depthWrite:false}));this.skyline.material.map.repeat.set(4,1);s.add(this.skyline);
  this.hemi=new T.HemisphereLight(0x8fa6ff,0x2a1730,1.1);s.add(this.hemi);
  this.key=new T.DirectionalLight(0xdfe6ff,2.4);this.key.position.set(-6,14,-10);s.add(this.key,this.key.target);
  if(high){this.key.castShadow=true;this.key.shadow.mapSize.set(1024,1024);Object.assign(this.key.shadow.camera,{left:-7,right:7,top:9,bottom:-9,near:1,far:40});this.key.shadow.bias=-.0004;this.key.shadow.normalBias=.03;}
  this.rimA=new T.DirectionalLight(0xff4fc0,2.2);this.rimA.position.set(6,3,-6);this.rimB=new T.DirectionalLight(0x48e6ff,2.2);this.rimB.position.set(-6,3,-6);this.back=new T.DirectionalLight(0xffd6b0,.55);this.back.position.set(0,4,8);s.add(this.rimA,this.rimB,this.back);
  // Street: one long wet strip whose textures scroll; curbs, lane paint and props are recycled.
  const {map,rough}=roadTextures();map.repeat.set(1,460/32);rough.repeat.set(1,460/32);this.roadTex=[map,rough];
  this.road=new T.Mesh(new T.PlaneGeometry(ROAD_HALF*2,460),new T.MeshStandardMaterial({map,roughnessMap:rough,roughness:1,metalness:.35,envMapIntensity:.55,color:0x8c94ad}));this.road.rotation.x=-Math.PI/2;this.road.position.z=-170;this.road.receiveShadow=high;s.add(this.road);
  const pave=pavement();pave.repeat.set(WALK/4,460/4);this.paveTex=pave;
  this.walks=[-1,1].map(side=>{const m=new T.Mesh(new T.BoxGeometry(WALK,.22,460),new T.MeshStandardMaterial({map:pave,roughness:.85,metalness:.1,envMapIntensity:.15,color:0x50566a}));m.position.set(side*(ROAD_HALF+WALK/2),.11,-170);s.add(m);return m;});
  this.curbMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.curbs=[-1,1].map(side=>{const m=new T.Mesh(new T.BoxGeometry(.09,.09,460),this.curbMat);m.position.set(side*ROAD_HALF,.2,-170);s.add(m);return m;});
  this.dashMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,transparent:true,opacity:.55});this.dashes=new T.InstancedMesh(new T.PlaneGeometry(.12,2.6).rotateX(-Math.PI/2),this.dashMat,2*44);this.dashes.position.y=.012;this.dashes.frustumCulled=false;s.add(this.dashes);
  this.streak=radial([[0,'#ffffffaa'],[.35,'#ffffff33'],[1,'#ffffff00']]);
  this.glowTex=radial([[0,'#ffffff'],[.25,'#ffffffaa'],[.6,'#ffffff22'],[1,'#ffffff00']]);
  this.shadowTex=radial([[0,'#000000b0'],[.55,'#00000060'],[1,'#00000000']]);
  this.shadowMat=new T.MeshBasicMaterial({map:this.shadowTex,transparent:true,depthWrite:false});this.shadowGeo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  // Buildings: twelve prebuilt shells with metric UVs share four facade materials.
  this.facades=[0,1,2,3].map(v=>new T.MeshStandardMaterial({map:facade(v,false),emissiveMap:facade(v,true),emissive:0xffffff,emissiveIntensity:.62,roughness:.7,metalness:.25,envMapIntensity:.25,color:0x8a8fa6}));
  this.shells=Array.from({length:12},(_,i)=>{const w=5+hash(301,i)*3.4,h=11+Math.pow(hash(302,i),1.6)*44,d=7+hash(303,i)*4,g=new T.BoxGeometry(w,h,d),uv=g.attributes.uv,n=g.attributes.normal;for(let k=0;k<uv.count;k++){const sideFace=Math.abs(n.getX(k))>.5,top=Math.abs(n.getY(k))>.5;uv.setXY(k,uv.getX(k)*(sideFace?d:w)/16,uv.getY(k)*(top?d:h)/16);}g.translate(0,h/2,0);return {g,w,h,d};});
  this.signs=SIGNS.flatMap(([text,col])=>[false,true].map(vertical=>{const t=signTexture(text,col,vertical);return {mat:new T.MeshBasicMaterial({map:t.map,transparent:true,toneMapped:false,color:new T.Color(1.9,1.9,1.9),side:T.DoubleSide,depthWrite:false}),aspect:t.aspect,vertical,color:col};}));
  this.signGeo=new T.PlaneGeometry(1,1);
  const loader=new T.TextureLoader();this.headTex=loader.load('assets/dawg-head-v2.webp',t=>{t.colorSpace=T.SRGBColorSpace;});
  this.billboardMat=new T.MeshBasicMaterial({map:this.headTex,transparent:true,toneMapped:false,color:new T.Color(1.35,1.35,1.35),depthWrite:false});this.frameMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});
  this.beaconTip=new T.MeshBasicMaterial({color:new T.Color(4,.35,.5),toneMapped:false});this.edgeA=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.edgeB=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.roofMat=new T.MeshStandardMaterial({color:0x252a3a,metalness:.6,roughness:.5});
  const edgeGeo=new T.BoxGeometry(.14,1,.14).translate(0,.5,0),acGeo=new T.BoxGeometry(1.4,.8,1.1).translate(0,.4,0),mastGeo=new T.CylinderGeometry(.04,.06,4,6).translate(0,2,0),tipGeo=new T.SphereGeometry(.12,10,8),roofGeo=merge([acGeo,acGeo.clone().scale(.7,1.3,.8).translate(1.6,0,.8),mastGeo.translate(-1.2,0,-1)]);
  this.buildings=[[],[]];this.BUILD_SPACING=9;this.BUILD_COUNT=high?27:20;
  for(let side=0;side<2;side++)for(let k=0;k<this.BUILD_COUNT;k++){const group=new T.Group(),body=new T.Mesh(this.shells[0].g,this.facades[0]),sign=new T.Mesh(this.signGeo,this.signs[0].mat),board=new T.Group();
   const frame=new T.Mesh(new T.PlaneGeometry(1.08,1.08),this.frameMat),face=new T.Mesh(new T.PlaneGeometry(1,1),this.billboardMat),panel=new T.Mesh(new T.PlaneGeometry(1.04,1.04),new T.MeshBasicMaterial({color:0x06040c}));panel.position.z=.01;face.position.z=.02;board.add(frame,panel,face);board.userData.frame=frame;
   const edge=new T.Mesh(edgeGeo,this.edgeA),roof=new T.Group(),props=new T.Mesh(roofGeo,this.roofMat),tip=new T.Mesh(tipGeo,this.beaconTip);tip.position.set(-1.2,4.05,-1);roof.add(props,tip);
   group.add(body,sign,board,edge,roof);group.userData={a:null,body,sign,board,edge,roof,tip};this.buildings[side].push(group);s.add(group);}
  // Lamps: pole, arm and an emissive head; their light is painted onto the wet road as a streak.
  this.lampMat=new T.MeshStandardMaterial({color:0x2a2f40,metalness:.8,roughness:.35});this.lampHeadMat=new T.MeshBasicMaterial({color:new T.Color(3,2.4,1.7),toneMapped:false});
  this.streakMat=new T.MeshBasicMaterial({map:this.streak,transparent:true,depthWrite:false,blending:T.AdditiveBlending,color:new T.Color(1,.75,.45),opacity:.55});
  const pole=new T.CylinderGeometry(.07,.09,6.4,8).translate(0,3.2,0),arm=new T.BoxGeometry(1.6,.08,.08).translate(-.8,6.3,0),head=new T.BoxGeometry(.7,.12,.3).translate(-1.5,6.22,0),streakGeo=new T.PlaneGeometry(1.6,9).rotateX(-Math.PI/2);
  this.LAMP_SPACING=16;this.LAMP_COUNT=15;
  // Every lamp on both sides is one instance of three batched meshes; arms reach over the road.
  if(!high)this.LAMP_COUNT=11;const n=this.LAMP_COUNT*2;this.lampParts=[new T.InstancedMesh(merge([pole,arm]),this.lampMat,n),new T.InstancedMesh(head,this.lampHeadMat,n),new T.InstancedMesh(streakGeo.translate(-1.6,.02,1.4),this.streakMat,n)];for(const m of this.lampParts){m.frustumCulled=false;s.add(m);}
  // Neon gates arch over the road every 64 m and alternate district colors.
  this.gateA=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.gateB=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.gateStreakA=new T.MeshBasicMaterial({map:this.streak,transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.5});this.gateStreakB=this.gateStreakA.clone();
  const pillar=new T.BoxGeometry(.35,7.2,.35).translate(0,3.6,0),beam=new T.BoxGeometry(ROAD_HALF*2+1.8,.32,.32),tube=new T.CylinderGeometry(.07,.07,ROAD_HALF*2+1.4,8).rotateZ(Math.PI/2),gStreak=new T.PlaneGeometry(ROAD_HALF*2,7).rotateX(-Math.PI/2);
  this.gates=[];this.GATE_SPACING=64;for(let k=0;k<6;k++){const g=new T.Group(),even=k%2===0;for(const side of [-1,1]){const p=new T.Mesh(pillar,this.lampMat);p.position.x=side*(ROAD_HALF+.9);g.add(p);const t=new T.Mesh(new T.CylinderGeometry(.06,.06,7,8),even?this.gateA:this.gateB);t.position.set(side*(ROAD_HALF+.65),3.5,0);g.add(t);}
   const b=new T.Mesh(beam,this.lampMat);b.position.y=7.2;const t=new T.Mesh(tube,even?this.gateA:this.gateB);t.position.set(0,6.9,.22);const t2=t.clone();t2.position.y=6.55;const st=new T.Mesh(gStreak,even?this.gateStreakA:this.gateStreakB);st.position.set(0,.03,2.5);g.add(b,t,t2,st);g.userData.flip=even;this.gates.push(g);s.add(g);}
  // Obstacles, coins and power-ups share geometry and materials and are pooled per type.
  this.crateMat=new T.MeshStandardMaterial({map:crateTexture(false),emissiveMap:crateTexture(true),emissive:0xffffff,emissiveIntensity:1.35,roughness:.6,metalness:.3});
  this.hazardMat=new T.MeshStandardMaterial({map:hazardTexture(false),emissiveMap:hazardTexture(true),emissive:0xffffff,emissiveIntensity:2,roughness:.5,metalness:.4});
  this.metalMat=new T.MeshStandardMaterial({color:0x3a3f52,metalness:.85,roughness:.3});this.barMat=new T.MeshBasicMaterial({color:new T.Color(.6,3.2,3.4),toneMapped:false});this.beaconMat=new T.MeshBasicMaterial({color:new T.Color(4,.4,.6),toneMapped:false});
  this.goldMat=new T.MeshStandardMaterial({color:0xffc83d,metalness:1,roughness:.18,emissive:0xff8a00,emissiveIntensity:.55,envMapIntensity:2.2});
  this.coinGeo=new T.CylinderGeometry(.56,.56,.12,40).rotateX(Math.PI/2);this.coinRim=new T.TorusGeometry(.56,.045,8,40);
  this.shieldMat=new T.MeshStandardMaterial({color:0x7ffcff,emissive:0x34e8ff,emissiveIntensity:2.4,metalness:.4,roughness:.2,transparent:true,opacity:.9});
  this.magnetMat=new T.MeshStandardMaterial({color:0xff4f6a,emissive:0xff2448,emissiveIntensity:1.8,metalness:.6,roughness:.25});this.tipMat=new T.MeshStandardMaterial({color:0xe8ecff,metalness:1,roughness:.15});
  this.glowMats={gold:this.additive(0xffb43a),shield:this.additive(0x48e6ff),magnet:this.additive(0xff4f8a)};
  // Player: holder carries jump, lean and flip; the rigged DAWG inside faces down the road.
  this.holder=new T.Group();this.pivot=new T.Group();this.pivot.position.y=1;this.holder.add(this.pivot);s.add(this.holder);this.playerShadow=new T.Mesh(this.shadowGeo,this.shadowMat);this.playerShadow.position.y=.03;s.add(this.playerShadow);
  this.aura=new T.Mesh(new T.SphereGeometry(1.25,32,20),new T.ShaderMaterial({...AURA,uniforms:T.UniformsUtils.clone(AURA.uniforms),transparent:true,depthWrite:false,blending:T.AdditiveBlending}));this.aura.position.y=1.05;this.aura.visible=false;this.holder.add(this.aura);
  // Particles and speed lines.
  const N=this.PARTICLES=high?700:360,pg=new T.BufferGeometry();this.pPos=new Float32Array(N*3);this.pCol=new Float32Array(N*3);this.pVel=new Float32Array(N*3);this.pLife=new Float32Array(N);this.pMax=new Float32Array(N);this.pBase=new Float32Array(N*3);this.pGrav=new Float32Array(N);this.pStick=new Float32Array(N);this.pNext=0;
  pg.setAttribute('position',new T.BufferAttribute(this.pPos,3).setUsage(T.DynamicDrawUsage));pg.setAttribute('color',new T.BufferAttribute(this.pCol,3).setUsage(T.DynamicDrawUsage));
  this.particles=new T.Points(pg,new T.PointsMaterial({size:.22,map:this.glowTex,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.particles.frustumCulled=false;s.add(this.particles);
  this.lines=new T.InstancedMesh(new T.PlaneGeometry(.03,4.5).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(1.6,2,2.4),transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),48);this.lines.frustumCulled=false;this.lineSeeds=Array.from({length:48},(_,i)=>({x:hash(501,i),y:hash(502,i),z:hash(503,i)}));s.add(this.lines);
  const R=this.RAIN=high?1400:600,rg=new T.BufferGeometry();this.rainPos=new Float32Array(R*6);this.rainSeed=Array.from({length:R},(_,i)=>[hash(601,i),hash(602,i),hash(603,i)]);rg.setAttribute('position',new T.BufferAttribute(this.rainPos,3).setUsage(T.DynamicDrawUsage));
  this.rain=new T.LineSegments(rg,new T.LineBasicMaterial({color:0xa9c4ff,transparent:true,opacity:.32,depthWrite:false,fog:false}));this.rain.frustumCulled=false;s.add(this.rain);
  this.colors={sky:new T.Color(),floor:new T.Color(),glow:new T.Color(),accent:new T.Color()};this.goal={sky:new T.Color(),floor:new T.Color(),glow:new T.Color(),accent:new T.Color()};this.m4=new T.Matrix4();this.v3=new T.Vector3();this.q=new T.Quaternion();this.e=new T.Euler();this.sc=new T.Vector3(1,1,1);
 }
 additive(color){return new T.SpriteMaterial({map:this.glowTex,color:new T.Color(color).multiplyScalar(1.6),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});}
 makeObject(type){
  const g=new T.Group(),shadow=new T.Mesh(this.shadowGeo,this.shadowMat);shadow.position.y=.025;g.add(shadow);
  if(type==='crate'){const box=new T.Mesh(new T.BoxGeometry(1.9,1.05,1.3).translate(0,.525,0),this.crateMat);box.castShadow=true;g.add(box);shadow.scale.set(2.6,1,2);}
  else if(type==='bar'){for(const x of [-1.08,1.08]){const p=new T.Mesh(new T.BoxGeometry(.16,2.2,.16).translate(0,1.1,0),this.metalMat);p.position.x=x;p.castShadow=true;g.add(p);}const tube=new T.Mesh(new T.CylinderGeometry(.08,.08,2.3,12).rotateZ(Math.PI/2),this.barMat);tube.position.y=1.42;const tube2=tube.clone();tube2.position.y=2.12;g.add(tube,tube2);const glow=new T.Sprite(this.additive(0x48e6ff));glow.scale.set(3.4,1.1,1);glow.position.y=1.42;g.add(glow);shadow.scale.set(2.8,1,.8);}
  else if(type==='block'){const wall=new T.Mesh(new T.BoxGeometry(2.1,2.5,.5).translate(0,1.25,0),this.hazardMat);wall.castShadow=true;g.add(wall);g.userData.beacons=[-.75,.75].map(x=>{const b=new T.Mesh(new T.SphereGeometry(.13,12,8),this.beaconMat.clone());b.position.set(x,2.62,0);g.add(b);return b;});shadow.scale.set(2.8,1,1.4);}
  else if(type==='coin'){const coin=new T.Group(),disc=new T.Mesh(this.coinGeo,this.goldMat),rim=new T.Mesh(this.coinRim,this.goldMat);coin.add(disc,rim);coin.position.y=1.05;g.add(coin);const glow=new T.Sprite(this.glowMats.gold);glow.scale.set(3,3,1);glow.position.y=1.05;g.add(glow);g.userData.spin=coin;g.userData.glow=glow;shadow.scale.set(.9,1,.9);}
  else if(type==='shield'){const gem=new T.Mesh(new T.OctahedronGeometry(.45,0),this.shieldMat);gem.position.y=1.45;const glow=new T.Sprite(this.glowMats.shield);glow.scale.set(2.8,2.8,1);glow.position.y=1.45;g.add(gem,glow);g.userData.spin=gem;shadow.scale.set(1.1,1,1.1);}
  else if(type==='magnet'){const m=new T.Group(),arc=new T.Mesh(new T.TorusGeometry(.34,.11,12,24,Math.PI),this.magnetMat);m.add(arc);for(const x of [-.34,.34]){const leg=new T.Mesh(new T.CylinderGeometry(.11,.11,.32,12).translate(0,-.16,0),this.magnetMat);leg.position.x=x;const tip=new T.Mesh(new T.CylinderGeometry(.115,.115,.14,12).translate(0,-.39,0),this.tipMat);tip.position.x=x;m.add(leg,tip);}m.position.y=1.5;const glow=new T.Sprite(this.glowMats.magnet);glow.scale.set(2.8,2.8,1);glow.position.y=1.4;g.add(m,glow);g.userData.spin=m;shadow.scale.set(1.1,1,1.1);}
  return g;
 }
 claim(key,type){let o=this.live.get(key);if(!o){o=(this.free[type]||=[]).pop()||this.makeObject(type);o.userData.type=type;o.visible=true;this.scene.add(o);this.live.set(key,o);}o.userData.seen=this.frame;return o;}
 sweep(){for(const [key,o]of this.live)if(o.userData.seen!==this.frame){o.visible=false;this.live.delete(key);this.free[o.userData.type].push(o);}}
 prepare(d){
  if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;
  const next=createDawgAsset(d);next.root.rotation.y=Math.PI;next.root.traverse(o=>{if(o.isMesh){o.castShadow=this.quality==='high';o.receiveShadow=false;}});
  if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;next.root.position.y=-1;this.pivot.add(next.root);
 }
 burst(x,y,z,count,color,{speed=5,life=.7,gravity=-6,up=2,spread=1,stick=.2}={}){
  if(this.reduced)count=Math.ceil(count/4);const c=new T.Color(color);
  for(let i=0;i<count;i++){const k=this.pNext=(this.pNext+1)%this.PARTICLES,a=Math.random()*Math.PI*2,u=Math.random()*2-1,r=Math.sqrt(1-u*u),v=speed*(.35+Math.random()*.65);
   this.pPos.set([x+(Math.random()-.5)*spread*.3,y,z],k*3);this.pVel.set([Math.cos(a)*r*v,Math.abs(u)*v*.6+up,Math.sin(a)*r*v],k*3);this.pLife[k]=this.pMax[k]=life*(.6+Math.random()*.5);this.pGrav[k]=gravity;this.pStick[k]=stick;this.pBase.set([c.r,c.g,c.b],k*3);}
 }
 event(e,g){
  if(!this.ready)return;const p=dashPoint(g.visualLane,0),lift=jumpLift(g.jump);
  if(e.type==='coin'){this.burst(p.x,1.2+lift,-.6,26,0xffc14d,{speed:6,up:2.5});this.pop('+25');}
  else if(e.type==='power'){const shield=e.power==='shield';this.burst(p.x,1.2+lift,-.4,60,shield?0x48e6ff:0xff4f8a,{speed:9,life:.9,gravity:-2});this.pop(shield?'SHIELD UP':'MAGNET',shield?'shield':'magnet');this.trauma=Math.max(this.trauma,.25);this.flashOnce(shield?0x48e6ff:0xff4f8a,.18);}
  else if(e.type==='shield'){this.burst(p.x,1.1+lift,-.8,90,0xb8fbff,{speed:12,life:.9,gravity:-3});this.pop('SHIELD SAVED YOU','big');this.trauma=Math.max(this.trauma,.75);this.flashOnce(0xffffff,.45);this.combo=0;}
  else if(e.type==='dodge'){this.combo++;this.pop(this.combo>1?'CLEAN ×'+this.combo:'CLEAN!','dodge');if(this.combo%5===0){this.burst(p.x,1.2+lift,-.4,40,0xb9ff5e,{speed:8});this.flashOnce(0xb9ff5e,.12);}}
  else if(e.type==='jump'){this.burst(p.x,.15,.1,14,0x9aa3c7,{speed:2.5,life:.5,gravity:-1,up:.6,stick:1});}
  else if(e.type==='slide'){this.burst(p.x,.15,.1,18,0xffa04d,{speed:3,life:.4,gravity:-4,up:.8,stick:1});}
  else if(e.type==='over'){this.burst(p.x,1.1,-.6,120,0xff4f6a,{speed:13,life:1.1,gravity:-5});this.trauma=1;this.flashOnce(0xff3355,.55);this.combo=0;}
 }
 flashOnce(color,amount){if(this.reduced)amount*=.4;this.flashColor.set(color);this.flash=Math.max(this.flash,amount);}
 draw(g,d,reduced=false){
  if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;this.lastDraw=performance.now();
  this.render(g,d,this.lastDraw);if(g.status!=='playing')this.idle();return true;
 }
 // Presentation-only frames while the run is not ticking: idle orbit and the crash camera.
 idle(){if(this.ambient||this.dead)return;const loop=now=>{this.ambient=0;if(this.dead||!this.lastGame||this.view.hidden||document.hidden)return;const g=this.lastGame,since=now-this.statusSince;
  if(g.status==='playing'||g.status==='paused')return;if(g.status==='over'&&since>3200)return;if(g.status==='ready'&&now-this.lastDraw>30000)return;
  if(now-this.lastDraw>=30&&now-(this.lastAmbient||0)>=30){this.lastAmbient=now;this.render(g,this.lastDawg,now);}this.ambient=requestAnimationFrame(loop);};this.ambient=requestAnimationFrame(loop);}
 resize(){const w=Math.max(1,this.view.clientWidth||420),h=Math.max(1,this.view.clientHeight||560);if(w===this.w&&h===this.h)return;this.w=w;this.h=h;const ratio=Math.max(.6,Math.min(globalThis.devicePixelRatio||1,this.quality==='high'?1.75:1,Math.sqrt(2.4e6/(w*h))));this.r.setPixelRatio(ratio);this.r.setSize(w,h,false);this.composer.setPixelRatio(ratio);this.composer.setSize(w,h);this.camera.aspect=w/h;}
 palette(g){const district=Math.floor(g.distance/800),look=worldLook(g.worldSeed,district);
  if(district!==this.district){const first=this.district<0||this.seed!==g.worldSeed;this.district=district;this.seed=g.worldSeed;this.look=look;this.goal.sky.set(look.sky);this.goal.floor.set(look.floor);this.goal.glow.set(look.glow);this.goal.accent.set(look.accent);
   if(first)for(const k in this.colors)this.colors[k].copy(this.goal[k]);else{this.banner('ENTERING '+look.label.toUpperCase());this.flashOnce(look.glow,.15);}}
  return look;}
 render(g,d,now){
  this.resize();this.prepare(d);const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;this.frame++;
  if(g.status!==this.status){this.statusFrom=this.status;this.status=g.status;this.statusSince=now;}
  const look=this.palette(g),reduced=this.reduced,c=this.colors,blend=Math.min(1,dt*1.5);for(const k in c)c[k].lerp(this.goal[k],blend);
  const travelled=g.distance*DEPTH,speed=g.speed,since=(now-this.statusSince)/1000,t=g.time,real=now/1000,high=this.quality==='high';
  // Atmosphere follows the district palette.
  const fogColor=c.sky.clone().lerp(c.floor,.4).multiplyScalar(.62);this.scene.fog.color.copy(fogColor);this.scene.fog.density=look.weather===2?.017:.0105;
  const u=this.sky.material.uniforms;u.uTop.value.copy(c.sky).multiplyScalar(.3);u.uHorizon.value.copy(fogColor);u.uGlow.value.copy(c.glow).multiplyScalar(look.weather===3?.6:.35);
  this.skyline.material.color.copy(c.glow).lerp(new T.Color(1,1,1),.65);this.curbMat.color.copy(c.glow).multiplyScalar(2.6);this.dashMat.color.copy(c.accent).multiplyScalar(1.7);
  this.gateA.color.copy(c.glow).multiplyScalar(3.2);this.gateB.color.copy(c.accent).multiplyScalar(3.2);this.gateStreakA.color.copy(c.glow);this.gateStreakB.color.copy(c.accent);
  this.hemi.color.copy(c.glow).lerp(new T.Color(0x8fa6ff),.5);this.hemi.groundColor.copy(c.floor);
  // Street textures scroll with the run so the road surface reads as speed.
  for(const tex of this.roadTex)tex.offset.y=travelled/32;this.paveTex.offset.y=travelled/4;
  for(let line=0;line<2;line++)for(let k=0;k<44;k++){const a=firstSlot(6,travelled,6)+k,z=slotZ(a,6,travelled);this.m4.makeTranslation((line?.5:-.5)*LANE,0,z);this.dashes.setMatrixAt(line*44+k,this.m4);}this.dashes.instanceMatrix.needsUpdate=true;
  this.placeBuildings(travelled,g.worldSeed);this.placeLamps(travelled);this.placeGates(travelled,real);
  // Rows: obstacles, coins and power-ups straight from the engine's state.
  const p=dashPoint(g.visualLane,0),lift=jumpLift(g.jump);
  if(g!==this.memoGame){this.memoGame=g;this.memo=new Map();this.ghosts=[];}const ids=new Set(g.rows.map(r=>r.id));for(const [id,row]of this.memo)if(!ids.has(id)){this.memo.delete(id);this.ghosts.push({id,obstacles:row.obstacles,z:Math.min(0,row.z)});}for(const row of g.rows)this.memo.set(row.id,row);
  const step=g.status==='playing'?g.speed*dt:0;this.ghosts=this.ghosts.filter(gh=>(gh.z-=step)>-15);for(const gh of this.ghosts)for(const o of gh.obstacles){const obj=this.claim('o'+gh.id+':'+o.lane,o.type),pt=dashPoint(o.lane,gh.z);obj.position.set(pt.x,0,pt.z);}
  for(const row of g.rows){const z=-row.z*DEPTH;if(z<-175)continue;
   for(const o of row.obstacles){const obj=this.claim('o'+row.id+':'+o.lane,o.type),pt=dashPoint(o.lane,row.z);obj.position.set(pt.x,0,pt.z);if(obj.userData.beacons){const on=Math.sin(real*9+row.id)>0;obj.userData.beacons.forEach((b,i)=>b.material.color.setRGB(on===!!i?4:.5,on===!!i?.3:.05,on===!!i?.5:.08));}}
   const cp=dashPoint(row.safe,row.z),coin=this.claim('c'+row.id,'coin');let cx=cp.x,cy=0,cz=cp.z;
   if(g.magnet>0&&row.z<38){const pull=smooth(1-row.z/38);cx+=(p.x-cx)*pull;cy=lift*pull;}coin.position.set(cx,cy+(reduced?0:Math.sin(real*3+row.id)*.12),cz);coin.userData.spin.rotation.y=reduced?0:real*3.4+row.id;
   if(row.power){const pw=this.claim('p'+row.id,row.power),pp=dashPoint(row.safe,row.z);pw.position.set(pp.x,reduced?0:Math.sin(real*2.4)*.15,pp.z-2.2);pw.userData.spin.rotation.y=real*2;}}
  this.sweep();
  this.placePlayer(g,p,lift,dt,since,real);
  this.updateParticles(dt,g,p,lift);this.updateLines(g,speed,travelled);this.updateRain(look,dt,real);
  this.placeCamera(g,p,lift,dt,since,speed);
  this.updateHud(g,look);
  this.trauma=Math.max(0,this.trauma-dt*1.5);this.flash=Math.max(0,this.flash-dt*2.6);
  const gu=this.grade.uniforms;gu.uTime.value=real;gu.uFlash.value=this.flash;gu.uFlashColor.value.copy(this.flashColor);gu.uAberration.value=reduced?.001:.0025+this.trauma*.012+Math.max(0,(speed-30)/10)*.003+(g.magnet>0?.003:0);
  this.bloom.strength=(high?.85:.75)+this.flash*.8;
  const start=performance.now();this.composer.render(dt);this.adapt(performance.now()-start,dt);
 }
 placeBuildings(travelled,seed){
  for(let side=0;side<2;side++){const list=this.buildings[side],sign=side?1:-1;for(let k=0;k<list.length;k++){const a=firstSlot(this.BUILD_SPACING,travelled,5)+k,o=list[((a%list.length)+list.length)%list.length],u=o.userData;
   if(u.a!==a){u.a=a;const h0=hash(seed,a*2+side+11),shell=this.shells[Math.floor(h0*this.shells.length)],gap=hash(seed,a*2+side+12);u.body.geometry=shell.g;u.body.material=this.facades[Math.floor(gap*4)];u.shell=shell;
    const x=sign*(ROAD_HALF+WALK+.6+shell.w/2+gap*2.5);u.x=x;u.body.position.set(0,0,0);u.body.rotation.y=0;
    const signRoll=hash(seed,a*2+side+13),sg=this.signs[Math.floor(hash(seed,a*2+side+14)*this.signs.length)];u.sign.visible=signRoll>.32;u.board.visible=signRoll<=.32&&hash(seed,a+side+15)>.45;
    if(u.sign.visible){u.sign.material=sg.mat;const edge=-sign*shell.w/2;if(sg.vertical){const hgt=Math.min(shell.h*.55,4.5+hash(seed,a+16)*5),wide=hgt*sg.aspect;u.sign.scale.set(wide,hgt,1);u.sign.position.set(edge-sign*(wide/2+.1),Math.min(shell.h-hgt/2-1,4+hgt/2+hash(seed,a+17)*6),shell.d/2-.4);u.sign.rotation.set(0,0,0);}
     else{const wdt=Math.min(shell.w*1.15,2.4+sg.aspect*1.6);u.sign.scale.set(wdt,wdt/sg.aspect,1);u.sign.position.set(0,shell.h+wdt/sg.aspect/2+.3,shell.d/2-.6);u.sign.rotation.set(0,-sign*.55,0);}}
    const edgeOn=hash(seed,a*2+side+18);u.edge.visible=edgeOn>.4;u.edge.material=edgeOn>.7?this.edgeB:this.edgeA;u.edge.scale.y=shell.h;u.edge.position.set(-sign*(shell.w/2+.04),0,shell.d/2+.04);
    u.roof.visible=this.quality==='high'&&!(u.sign.visible&&!sg.vertical);u.roof.position.set(hash(seed,a+19)*1.4-.7,shell.h,hash(seed,a+20)*1.4-.7);u.roof.rotation.y=hash(seed,a+21)*Math.PI;
    if(u.board.visible){const size=Math.min(shell.w*.85,5.5);u.board.scale.set(size,size,1);u.board.position.set(-sign*(shell.w/2+.05),Math.min(shell.h-size/2-1,6+size/2),0);u.board.rotation.set(0,-sign*Math.PI/2,0);u.board.userData.frame.material=this.frameMat;}}
   o.position.set(u.x,0,slotZ(a,this.BUILD_SPACING,travelled));}}
  this.frameMat.color.copy(this.colors.glow).multiplyScalar(2.4);this.edgeA.color.copy(this.colors.glow).multiplyScalar(2.2);this.edgeB.color.copy(this.colors.accent).multiplyScalar(2.2);
  const blink=Math.sin(performance.now()/260)>.3;this.beaconTip.color.setRGB(blink?4:.4,blink?.35:.04,blink?.5:.05);
 }
 placeLamps(travelled){let i=0;for(let side=0;side<2;side++){this.q.setFromEuler(this.e.set(0,side?0:Math.PI,0));for(let k=0;k<this.LAMP_COUNT;k++){const a=firstSlot(this.LAMP_SPACING,travelled,this.quality==='high'?3:2)+k;this.v3.set((side?1:-1)*(ROAD_HALF+.5),0,slotZ(a,this.LAMP_SPACING,travelled)-(side?this.LAMP_SPACING/2:0));this.m4.compose(this.v3,this.q,this.sc);for(const m of this.lampParts)m.setMatrixAt(i,this.m4);i++;}}for(const m of this.lampParts)m.instanceMatrix.needsUpdate=true;}
 placeGates(travelled,real){for(let k=0;k<this.gates.length;k++){const a=firstSlot(this.GATE_SPACING,travelled,2)+k,o=this.gates[((a%this.gates.length)+this.gates.length)%this.gates.length];o.position.z=slotZ(a,this.GATE_SPACING,travelled)-30;}
  const pulse=this.reduced?1:.75+.25*Math.sin(real*5);this.gateStreakA.opacity=.45*pulse;this.gateStreakB.opacity=.45*(1.75-pulse);}
 placePlayer(g,p,lift,dt,since,real){
  const h=this.holder,v=this.pivot,a=this.asset,over=g.status==='over',ready=g.status==='ready';h.position.set(p.x,lift,0);v.rotation.set(0,0,0);
  if(a){if(ready)setDawgPose(a,real,'idle');else if(over)setDawgPose(a,0,'still');else setDawgPose(a,g.time,'run');}
  if(g.jump>0&&!this.reduced){const q=1-g.jump/.85;v.rotation.x=-smooth(Math.min(1,q*1.15))*Math.PI*2;}
  if(g.slide>0){const q=1-g.slide/.85,amt=q<.12?q/.12:q>.82?(1-q)/.18:1;v.rotation.x=amt*1.25;h.position.y=-amt*.52;if(!this.reduced&&Math.random()<.6)this.burst(p.x+(Math.random()-.5)*.6,.08,.9,2,0xffa04d,{speed:2.5,life:.35,gravity:-3,up:.5,stick:1});}
  v.rotation.z=-(g.lane-g.visualLane)*.42;
  if(over){const k=Math.min(1,since/0.55);h.position.z=k*1.6;h.position.y=Math.sin(k*Math.PI)*1.1-k*.55;v.rotation.x=k*1.55;v.rotation.z=k*.6;}
  if(this.jumpWas>0&&g.jump===0&&g.status==='playing'){this.burst(p.x,.1,.1,16,0x9aa3c7,{speed:3,life:.45,gravity:-1,up:.4,stick:1});this.trauma=Math.max(this.trauma,.12);}this.jumpWas=g.jump;
  this.playerShadow.position.set(p.x,.03,h.position.z);const s=1.5/(1+lift*.55);this.playerShadow.scale.set(s,1,s*.8);
  this.aura.visible=!!(g.shield||g.magnet>0);if(this.aura.visible){const u=this.aura.material.uniforms;u.uColor.value.set(g.shield?0x48e6ff:0xff4f8a);u.uTime.value=real;u.uAlpha.value=g.magnet>0&&g.magnet<3?(Math.sin(real*14)>0?.9:.3):.85;}
  this.key.position.set(p.x-6,14,-10);this.key.target.position.set(p.x,0,-4);
 }
 placeCamera(g,p,lift,dt,since,speed){
  const cam=this.camera,ready=g.status==='ready',over=g.status==='over',real=performance.now()/1000;
  const chase=new T.Vector3(p.x*.78,2.55+lift*.35,5.1),look=new T.Vector3(p.x*.9,1.45+lift*.25,-9);
  let pos=chase,at=look;
  if(ready){const a=Math.sin(real*.35)*.55;pos=new T.Vector3(p.x+Math.sin(a)*2.4,1.75,-4.6+Math.abs(Math.sin(a))*.6);at=new T.Vector3(p.x,1.25,0);}
  else if(g.status==='playing'&&this.statusFrom==='ready'&&since<1.1){const k=smooth(since/1.1),a=Math.PI*k,R=4.6+(chase.z-4.6)*k;pos=new T.Vector3(p.x+Math.sin(a)*R*(1-k)+(chase.x-p.x)*k,1.75+(chase.y-1.75)*k+Math.sin(k*Math.PI)*1.4,-Math.cos(a)*R);at=new T.Vector3(p.x,1.25,0).lerp(look,k*k*k);}
  else if(over){const k=smooth(Math.min(1,since/1.4));const side=p.x>0?-1:1;pos=chase.clone().lerp(new T.Vector3(p.x+side*3.4,2.1,-3.6),k);at=look.clone().lerp(new T.Vector3(p.x,.9,1),k);}
  const follow=ready||over?1:Math.min(1,dt*9);cam.position.lerp(pos,this.camInit?follow:1);this.camInit=true;
  if(!this.reduced&&this.trauma>0){const s=this.trauma*this.trauma*.45;cam.position.x+=(Math.sin(real*71)+Math.sin(real*37))*.5*s;cam.position.y+=(Math.sin(real*63)+Math.sin(real*29))*.5*s;}
  const roll=this.reduced?0:-(g.lane-g.visualLane)*.05;cam.up.set(Math.sin(roll),Math.cos(roll),0);cam.lookAt(at);
  const base=this.reduced?60:58+Math.max(0,speed-25)/15*9+(g.magnet>0?3:0)+this.trauma*4;cam.fov+=((fitFov(ready?50:base,cam.aspect))-cam.fov)*Math.min(1,dt*4);cam.updateProjectionMatrix();
  this.sky.position.copy(cam.position);this.stars.position.copy(cam.position);this.skyline.position.set(cam.position.x,-8,cam.position.z);this.skyline.rotation.y=(g.distance*.00002)%1;this.moon.position.set(cam.position.x+150,170,cam.position.z-330);
 }
 updateParticles(dt,g,p,lift){
  const N=this.PARTICLES;for(let i=0;i<N;i++){if(this.pLife[i]<=0){if(this.pCol[i*3]!==0){this.pCol[i*3]=this.pCol[i*3+1]=this.pCol[i*3+2]=0;}continue;}
   this.pLife[i]-=dt;const k=i*3,f=Math.max(0,this.pLife[i]/this.pMax[i]);this.pVel[k+1]+=this.pGrav[i]*dt;
   // Particles stay attached to the street: everything drifts toward the camera with the run.
   this.pPos[k]+=this.pVel[k]*dt;this.pPos[k+1]=Math.max(.02,this.pPos[k+1]+this.pVel[k+1]*dt);this.pPos[k+2]+=this.pVel[k+2]*dt+(g.status==='playing'?g.speed*DEPTH*dt*this.pStick[i]:0);
   this.pCol[k]=this.pBase[k]*f*1.8;this.pCol[k+1]=this.pBase[k+1]*f*1.8;this.pCol[k+2]=this.pBase[k+2]*f*1.8;}
  const geo=this.particles.geometry;geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;
  if(g.status==='playing'&&!this.reduced&&g.jump===0&&g.slide===0&&Math.random()<.35)this.burst(p.x+(Math.random()-.5)*.5,.06,.4,1,g.shield?0x48e6ff:0xb9ff5e,{speed:1,life:.35,gravity:0,up:.2,stick:1});
 }
 updateLines(g,speed,travelled){
  const playing=g.status==='playing'&&!this.reduced,amount=playing?Math.min(1,Math.max(0,(speed-27)/10)+(g.magnet>0?.45:0)+this.trauma*.3):0;this.lines.material.opacity=amount*.55;this.lines.visible=amount>.01;if(!this.lines.visible)return;
  const cam=this.camera.position;for(let i=0;i<this.lineSeeds.length;i++){const s=this.lineSeeds[i],side=s.x<.5?-1:1,x=cam.x+side*(1.6+s.y*4.5),y=Math.max(.3,cam.y-2.6+s.z*5.5),z=cam.z-2-(40-((s.y*40+travelled*2.2)%40));this.m4.makeTranslation(x,y,z);this.lines.setMatrixAt(i,this.m4);}this.lines.instanceMatrix.needsUpdate=true;
 }
 updateRain(look,dt,real){
  const on=!this.reduced&&(look.weather===1||look.weather===4);this.rain.visible=on;if(!on)return;const cam=this.camera.position,R=this.RAIN,fall=real*26;
  for(let i=0;i<R;i++){const [a,b,c]=this.rainSeed[i],x=cam.x+(a-.5)*44,z=cam.z-c*70+4,y=((b*30-fall)%30+30)%30-2,k=i*6;this.rainPos[k]=x;this.rainPos[k+1]=y;this.rainPos[k+2]=z;this.rainPos[k+3]=x-.06;this.rainPos[k+4]=y+.8;this.rainPos[k+5]=z-.35;}
  this.rain.geometry.attributes.position.needsUpdate=true;
 }
 updateHud(g,look){
  const h=this.hud;this.set(h.dist,'d',String(Math.floor(g.distance)));this.set(h.gold,'g',String(g.coins));this.set(h.zone,'z',look.label.toUpperCase());
  const label=g.magnet>0?'MAGNET':g.shield?'SHIELD':'';if(h.cache.p!==label){h.cache.p=label;h.power.hidden=!label;h.power.dataset.kind=label.toLowerCase();h.powerLabel.textContent=label;}
  if(label)h.powerBar.style.transform=`scaleX(${g.magnet>0?Math.min(1,g.magnet/(10+(g.career?.magnet||0))).toFixed(3):1})`;
  h.root.classList.toggle('d3-live',g.status==='playing');
 }
 // Drops to the light profile if frames run long, so phones and older laptops stay smooth.
 adapt(ms,dt){if(this.quality!=='high'||!dt)return;this.slowFrames=dt>.024?this.slowFrames+1:Math.max(0,this.slowFrames-2);if(this.slowFrames>90){this.quality='low';this.r.shadowMap.enabled=false;this.key.castShadow=false;this.w=0;this.bloom.strength=.8;}}
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){
  if(this.dead)return;this.dead=true;this.ready=false;cancelAnimationFrame(this.ambient);clearTimeout(this.bannerTimer);this.canvas?.removeEventListener('webglcontextlost',this.loss);
  try{this.asset?.dispose();const gs=new Set(),ms=new Set(),ts=new Set();this.scene?.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material||[])){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});for(const list of Object.values(this.free))for(const o of list)o.traverse(x=>{if(x.geometry)gs.add(x.geometry);if(x.material)ms.add(x.material);});
   for(const sh of this.shells||[])gs.add(sh.g);for(const g of gs)g.dispose();for(const m of ms)m.dispose();for(const t of ts)t.dispose();this.envMap?.dispose();this.composer?.dispose();this.r?.forceContextLoss();this.r?.dispose();}catch{}
  this.view?.remove();
 }
}
