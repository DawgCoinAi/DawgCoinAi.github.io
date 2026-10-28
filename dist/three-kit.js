// Shared Three.js toolkit for the arcade's 3D games. Renderers built on it only read engine
// state: the stage, particles, camera rig and HUD never touch rules, time or saves.
import {T} from './dawg-graphics-model.js';
import {EffectComposer,RenderPass,UnrealBloomPass,OutputPass,ShaderPass} from './vendor/three.js';
import {hash} from './world.js';

export {T};
export const smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
export function quality(env=globalThis){
 const coarse=!!env.matchMedia?.('(pointer: coarse)').matches,cores=env.navigator?.hardwareConcurrency||4,memory=env.navigator?.deviceMemory||8;
 return coarse||cores<=4||memory<=4?'low':'high';
}
// Keeps the play area in frame on portrait screens by widening the vertical field of view.
export function fitFov(base,aspect,minHorizontal=64){
 const need=2*Math.atan(Math.tan(minHorizontal*Math.PI/360)/Math.max(.2,aspect))*180/Math.PI;
 return Math.min(84,Math.max(base,need));
}

// Bakes several static parts that share a material into one geometry, so they cost one draw call.
export function merge(parts){const out=new T.BufferGeometry();for(const name of ['position','normal','uv']){const arrays=parts.map(g=>(g.index?g.toNonIndexed():g).getAttribute(name).array),size=parts[0].getAttribute(name).itemSize,data=new Float32Array(arrays.reduce((n,a)=>n+a.length,0));let at=0;for(const a of arrays){data.set(a,at);at+=a.length;}out.setAttribute(name,new T.BufferAttribute(data,size));}for(const g of parts)g.dispose();return out;}
export function canvas(w,h){const el=document.createElement('canvas');el.width=w;el.height=h;return el;}
export function texture(w,h,draw,{repeat=false,color=true}={}){const el=canvas(w,h);draw(el.getContext('2d'),w,h);const t=new T.CanvasTexture(el);if(color)t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
export function radial(stops){return texture(128,128,(c,w)=>{const g=c.createRadialGradient(64,64,0,64,64,64);for(const [at,col]of stops)g.addColorStop(at,col);c.fillStyle=g;c.fillRect(0,0,w,w);});}
export const glowStops=[[0,'#ffffff'],[.25,'#ffffffaa'],[.6,'#ffffff22'],[1,'#ffffff00']];
export function facade(variant,lit){
 // One 512px tile covers 16 m of wall; the emissive copy holds only the lit windows.
 return texture(512,512,(c,w,h)=>{
  c.fillStyle=lit?'#000':['#151a2b','#1b1529','#111e26','#1d1722'][variant];c.fillRect(0,0,w,h);
  if(!lit){for(let y=0;y<16;y++){c.fillStyle='#ffffff12';c.fillRect(0,y*32+28,w,2);c.fillStyle='#00000040';c.fillRect(0,y*32+30,w,2);}c.fillStyle='#ffffff10';for(let x=0;x<4;x++)c.fillRect(x*128,0,5,h);for(let i=0;i<5000;i++){c.fillStyle=hash(variant+70,i)>.5?'#ffffff06':'#0000001a';c.fillRect(hash(variant+71,i)*w,hash(variant+72,i)*h,3,3);}}
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const r=hash(variant*977+31,y*16+x)*(.75+.25*hash(variant*13+5,y)),on=r>.66;
   if(lit&&!on)continue;c.fillStyle=on?(r>.93?'#8eeaff':r>.86?'#ff9ad5':r>.8?'#c3ff8f':'#ffcf96'):'#080b14';c.globalAlpha=on&&lit?.55+hash(variant,x*31+y)*.45:1;c.fillRect(x*32+7,y*32+6,18,21);}
  c.globalAlpha=1;
 },{repeat:true});
}
export const SIGNS=[['DAWG','#b9ff5e'],['AFTER HOURS','#ff5fc8'],['RAMEN','#ff8a3d'],['ARCADE','#5ee7ff'],['24/7','#ffe45e'],['$DAWG','#b9ff5e'],['BARK BAR','#c78bff'],['HOTEL','#ff5f7a'],['NOODLES','#5effc1'],['PAWN','#ffd27a'],['KARAOKE','#ff7af0'],['GOLD','#ffd25e']];
export function signTexture(text,color,vertical){
 const chars=[...text],w=vertical?120:Math.max(260,text.length*62),h=vertical?Math.max(3,chars.length)*96+36:130;
 return {map:texture(w,h,(c)=>{c.fillStyle='#07060dd8';c.beginPath();c.roundRect(4,4,w-8,h-8,14);c.fill();c.lineWidth=5;c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=18;c.stroke();
  c.font=`900 ${vertical?78:82}px system-ui, sans-serif`;c.textAlign='center';c.textBaseline='middle';c.lineWidth=7;
  const glyph=(s,x,y)=>{c.shadowBlur=26;c.strokeStyle=color;c.strokeText(s,x,y);c.shadowBlur=6;c.fillStyle='#fff6fb';c.fillText(s,x,y);};
  if(vertical)chars.forEach((ch,i)=>glyph(ch,w/2,66+i*96));else glyph(text,w/2,h/2+4);}),aspect:w/h};
}
// Neon sign materials (horizontal and vertical blade variants) ready to put on planes.
export function signMaterials(){return SIGNS.flatMap(([text,col])=>[false,true].map(vertical=>{const t=signTexture(text,col,vertical);return {mat:new T.MeshBasicMaterial({map:t.map,transparent:true,toneMapped:false,color:new T.Color(1.9,1.9,1.9),side:T.DoubleSide,depthWrite:false}),aspect:t.aspect,vertical,color:col};}));}
export function skylineTexture(){
 return texture(2048,256,(c,w,h)=>{c.clearRect(0,0,w,h);let x=0,i=0;while(x<w){const bw=24+hash(40,i)*70,bh=40+hash(41,i)*190;c.fillStyle='#0b0f1d';c.fillRect(x,h-bh,bw,bh);if(hash(42,i)>.6){c.fillRect(x+bw/2-2,h-bh-26,4,26);}
  for(let y=h-bh+8;y<h-6;y+=9)for(let k=4;k<bw-4;k+=8)if(hash(43,i*977+y*7+k)>.78){c.fillStyle=hash(44,i+y+k)>.5?'#ffcf9655':'#8eeaff44';c.fillRect(x+k,y,3,4);}x+=bw+hash(45,i)*6;i++;}},{repeat:true});
}
// Twelve building shells with metric UVs, so facade windows keep their size on every shell.
export function buildingShells(count=12){return Array.from({length:count},(_,i)=>{const w=5+hash(301,i)*3.4,h=11+Math.pow(hash(302,i),1.6)*44,d=7+hash(303,i)*4,g=new T.BoxGeometry(w,h,d),uv=g.attributes.uv,n=g.attributes.normal;for(let k=0;k<uv.count;k++){const sideFace=Math.abs(n.getX(k))>.5,top=Math.abs(n.getY(k))>.5;uv.setXY(k,uv.getX(k)*(sideFace?d:w)/16,uv.getY(k)*(top?d:h)/16);}g.translate(0,h/2,0);return {g,w,h,d};});}
export function facadeMaterials(){return [0,1,2,3].map(v=>new T.MeshStandardMaterial({map:facade(v,false),emissiveMap:facade(v,true),emissive:0xffffff,emissiveIntensity:.62,roughness:.7,metalness:.25,envMapIntensity:.25,color:0x8a8fa6}));}

// Cinematic grade, applied after tone mapping in display space: lens fringing that grows toward the
// edges, a filmic S-curve, a touch of saturation, split toning (cool shadows, warm highlights),
// an oval vignette and luminance-weighted film grain that also dithers away gradient banding.
export const GRADE={uniforms:{tDiffuse:{value:null},uTime:{value:0},uAberration:{value:.002},uVignette:{value:.85},uFlash:{value:0},uFlashColor:{value:new T.Color(1,1,1)},
  uRes:{value:new T.Vector2(1280,800)},uContrast:{value:.22},uSaturation:{value:1.08},uGrain:{value:.035},uShadowTint:{value:new T.Vector3(-.006,.002,.018)},uHighTint:{value:new T.Vector3(.016,.006,-.012)}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uAberration,uVignette,uFlash,uContrast,uSaturation,uGrain;uniform vec3 uFlashColor,uShadowTint,uHighTint;uniform vec2 uRes;varying vec2 vUv;
 float h12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
 void main(){vec2 c=vUv-.5;float d=dot(c,c);vec2 off=c*uAberration*(.4+d*5.);vec3 col=vec3(texture2D(tDiffuse,vUv+off).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-off).b);
 col=clamp(col,0.,1.);float l=dot(col,vec3(.2126,.7152,.0722));col=max(mix(vec3(l),col,uSaturation),0.);
 vec3 s=col*col*(3.-2.*col);col=mix(col,s,uContrast);
 col+=uShadowTint*(1.-smoothstep(0.,.42,l))+uHighTint*smoothstep(.5,1.,l);
 vec2 vc=c*vec2(uRes.x/max(1.,uRes.y)*.82,1.);float vd=dot(vc,vc);col*=mix(1.,smoothstep(.62,.08,vd),uVignette*.5);
 vec2 px=floor(vUv*uRes);float t=floor(fract(uTime*.37)*97.);float n=h12(px+t*17.31)+h12(px*1.37+t*3.7)-1.;col+=n*uGrain*(.35+.65*(1.-l));
 gl_FragColor=vec4(mix(col,uFlashColor,uFlash),1.);}`};
export const SKY={uniforms:{uTop:{value:new T.Color()},uHorizon:{value:new T.Color()},uGlow:{value:new T.Color()}},
 vertexShader:'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform vec3 uTop,uHorizon,uGlow;varying vec3 vDir;void main(){float h=clamp(vDir.y,-.2,1.);vec3 col=mix(uHorizon,uTop,smoothstep(0.,.55,h));col+=uGlow*pow(1.-abs(h),7.)*.9;gl_FragColor=vec4(col,1.);}'};
export const AURA={uniforms:{uColor:{value:new T.Color()},uTime:{value:0},uAlpha:{value:0}},
 vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
 fragmentShader:'uniform vec3 uColor;uniform float uTime,uAlpha;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(vN,vV)),2.4);float bands=.75+.25*sin(vN.y*18.+uTime*6.);gl_FragColor=vec4(uColor*2.2,f*bands*uAlpha);}'};
// ── Material and atmosphere helpers renderers can opt into.
// PBR material: MeshPhysical (clearcoat, sheen) on high, MeshStandard on the light profile, which
// drops the physical-only options so phones keep the cheaper shader.
const PHYSICAL_ONLY=['clearcoat','clearcoatRoughness','sheen','sheenColor','sheenRoughness','iridescence','transmission','thickness','ior','specularIntensity','specularColor','anisotropy'];
export function pbr(opts={},q='high'){if(q==='high')return new T.MeshPhysicalMaterial(opts);const o={...opts};for(const k of PHYSICAL_ONLY)delete o[k];return new T.MeshStandardMaterial(o);}
// Soft contact shadow: a dark radial blob on a ground-aligned plane, scaled per object. Grounds
// things on every profile, including where real shadow maps are off.
let blobTex=null;
// Marks every mesh under obj as a shadow caster (and receiver) on the high profile only.
export function castShadows(obj,q='high',receive=true){if(q!=='high'||!obj)return obj;obj.traverse(o=>{if(o.isMesh&&!o.material?.transparent){o.castShadow=true;if(receive)o.receiveShadow=true;}});return obj;}
export function contactShadowMaterial(strength=.75){blobTex??=radial([[0,'#000000ff'],[.35,'#000000b8'],[.7,'#00000040'],[1,'#00000000']]);return new T.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,opacity:strength,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2});}
export function contactShadow(w=1,d=w,mat=contactShadowMaterial()){const m=new T.Mesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),mat);m.scale.set(w,1,d);m.position.y=.015;m.renderOrder=-1;return m;}
// A cheap volumetric-looking light shaft: an open additive cone that fades along its length and
// toward its silhouette, so it reads as lit haze without any raymarching. Apex at the origin,
// pointing down -y; place and rotate it like a spotlight.
// Works on a plain mesh or an InstancedMesh (one draw for a whole row of lamps), and fades out
// with view distance (uFade: start, end) since it ignores scene fog.
const SHAFT={uniforms:{uColor:{value:new T.Color()},uOpacity:{value:.35},uTime:{value:0},uApexY:{value:0},uFade:{value:new T.Vector2(40,110)}},
 vertexShader:'uniform float uApexY;varying float vAlong;varying float vDist;varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vAlong=clamp((uApexY-position.y)/HEIGHT,0.,1.);vP=position;vec4 p=vec4(position,1.);vec3 n=normal;\n#ifdef USE_INSTANCING\np=instanceMatrix*p;n=mat3(instanceMatrix)*n;\n#endif\nvec4 mv=modelViewMatrix*p;vN=normalize(normalMatrix*n);vV=normalize(-mv.xyz);vDist=length(mv.xyz);gl_Position=projectionMatrix*mv;}',
 fragmentShader:'uniform vec3 uColor;uniform float uOpacity,uTime;uniform vec2 uFade;varying float vAlong;varying float vDist;varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){float edge=pow(abs(dot(normalize(vN),normalize(vV))),1.6);float fall=(1.-vAlong)*(1.-vAlong)*smoothstep(0.,.08,vAlong);float dust=.85+.15*sin(vP.y*3.1+uTime*.7+vP.x*2.);float far=1.-smoothstep(uFade.x,uFade.y,vDist);gl_FragColor=vec4(uColor*edge*fall*dust*far*uOpacity,1.);}'};
// `apex` moves the cone's tip off the origin (for baking into lamp geometry); `fade` is [start, end].
export function lightShaft(color=0xffffff,{length=8,radius=2.4,top=.12,opacity=.35,segments=24,apex=[0,0,0],fade=[40,110]}={}){
 const g=new T.CylinderGeometry(top,radius,length,segments,1,true).translate(apex[0],apex[1]-length/2,apex[2]);
 const mat=new T.ShaderMaterial({uniforms:T.UniformsUtils.clone(SHAFT.uniforms),vertexShader:SHAFT.vertexShader.replace('HEIGHT',length.toFixed(3)),fragmentShader:SHAFT.fragmentShader,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,fog:false,toneMapped:false});
 mat.uniforms.uColor.value.set(color);mat.uniforms.uOpacity.value=opacity;mat.uniforms.uApexY.value=apex[1];mat.uniforms.uFade.value.set(...fade);const m=new T.Mesh(g,mat);m.renderOrder=2;return m;}
// Wet asphalt / polished floor: low roughness with a noisy roughness map so reflections of the
// environment break up into puddles. Pass a base map to keep the game's own texture.
export function wetGround({color=0x2a2f40,map=null,roughness=.55,metalness=.2,envMapIntensity=.9,repeat=[1,1],q='high'}={}){
 const rough=texture(256,256,(c,w,h)=>{c.fillStyle='#b4b4b4';c.fillRect(0,0,w,h);for(let i=0;i<36;i++){const x=hash(811,i)*w,y=hash(812,i)*h,r=10+hash(813,i)*38;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#141414');g.addColorStop(1,'#14141400');c.fillStyle=g;c.beginPath();c.ellipse(x,y,r,r*(.5+hash(814,i)*.6),hash(815,i)*3,0,7);c.fill();}for(let i=0;i<4000;i++){c.fillStyle=hash(816,i)>.5?'#ffffff14':'#00000014';c.fillRect(hash(817,i)*w,hash(818,i)*h,2,2);}},{repeat:true,color:false});
 rough.repeat.set(...repeat);return pbr({color,map,roughnessMap:rough,roughness,metalness,envMapIntensity,clearcoat:.35,clearcoatRoughness:.25},q);}
export const skyMaterial=()=>new T.ShaderMaterial({...SKY,uniforms:T.UniformsUtils.clone(SKY.uniforms),side:T.BackSide,depthWrite:false,fog:false});
export const auraMaterial=()=>new T.ShaderMaterial({...AURA,uniforms:T.UniformsUtils.clone(AURA.uniforms),transparent:true,depthWrite:false,blending:T.AdditiveBlending});

/** Renderer, scene, camera, bloom and color grading in one view element that fills its stage. */
// ── Loaded art: CC0 models (Kenney) and an HDR environment (Poly Haven). See assets/CREDITS.md.
export const MODELS='assets/models/',ENV_HDR='assets/env/shanghai_bund_1k.hdr';
const modelCache=new Map(),hdrCache=new Map();
let gltfLoader=null;
// Load a GLB once; every caller gets the same parsed scene to clone from.
export function loadModel(path){if(!modelCache.has(path)){gltfLoader??=new T.GLTFLoader();modelCache.set(path,gltfLoader.loadAsync(MODELS+path).then(g=>{g.scene.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;if(o.material?.map)o.material.map.anisotropy=4;}});return g.scene;}).catch(e=>{modelCache.delete(path);throw e;}));}return modelCache.get(path);}
export const loadModels=paths=>Promise.all(paths.map(loadModel));
// A copy that shares geometry and textures with the original but has its own materials, so it
// can be tinted without touching other copies.
export function cloneModel(scene,{ownMaterials=false}={}){const c=scene.clone(true);if(ownMaterials)c.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();});return c;}
export function loadHdr(url,renderer){const key=url;if(!hdrCache.has(key))hdrCache.set(key,new T.HDRLoader().loadAsync(url).then(tex=>{const pm=new T.PMREMGenerator(renderer);const env=pm.fromEquirectangular(tex).texture;pm.dispose();tex.dispose();return env;}).catch(e=>{hdrCache.delete(key);throw e;}));return hdrCache.get(key);}
// Fit a model into a box of the given size (largest side), resting on y = 0 and centred on x/z.
export function fitModel(obj,size){const box=new T.Box3().setFromObject(obj),dim=box.getSize(new T.Vector3()),s=size/Math.max(dim.x,dim.y,dim.z);obj.scale.multiplyScalar(s);box.setFromObject(obj);const c=box.getCenter(new T.Vector3());obj.position.x-=c.x;obj.position.z-=c.z;obj.position.y-=box.min.y;return obj;}
const TONE={neutral:T.NeutralToneMapping,aces:T.ACESFilmicToneMapping,agx:T.AgXToneMapping};
export class Stage {
 constructor({quality:q=quality(),className='',onFailure,tone='neutral',exposure=1}={}){this.quality=q;this.tone=tone;this.exposure=exposure;this.className=className;this.onFailure=onFailure;this.trauma=0;this.flash=0;this.flashColor=new T.Color(1,1,1);this.slowFrames=0;this.dead=false;this.failed=false;this.extraGeometries=[];}
 init(){
  const high=this.quality==='high',view=this.view=document.createElement('div');view.className=('dash-gpu '+this.className).trim();view.setAttribute('aria-hidden','true');
  const el=this.canvas=canvas(420,560);el.className='d3-canvas';view.append(el);
  const r=this.r=new T.WebGLRenderer({canvas:el,antialias:false,powerPreference:'high-performance',stencil:false});
  // Khronos PBR Neutral keeps neon hues saturated (ACES skews magentas and cyans and AgX greys them)
  // while still rolling highlights off softly; the grade pass adds the filmic contrast back.
  r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=TONE[this.tone]??T.NeutralToneMapping;r.toneMappingExposure=this.exposure;r.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,high?1.75:1));r.shadowMap.enabled=high;r.shadowMap.type=T.PCFShadowMap;
  this.loss=e=>{e.preventDefault();this.fail();};el.addEventListener('webglcontextlost',this.loss);
  this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(60,.75,.1,520);this.camera.position.set(0,3,7);
  // The composer bypasses the canvas' own antialiasing, so on high the scene renders into a
  // 4x multisampled half-float target instead (WebGL2); phones keep the plain target.
  const msaa=high&&r.capabilities?.isWebGL2!==false?new T.WebGLRenderTarget(420,560,{type:T.HalfFloatType,samples:4}):undefined;if(msaa)msaa.texture.name='Stage.msaa';
  this.composer=new EffectComposer(r,msaa);this.composer.addPass(new RenderPass(this.scene,this.camera));
  // Only real emissives (HDR values above ~1) cross the bloom threshold, so lit walls stay crisp.
  this.bloomBase=high?.8:.7;this.bloom=new UnrealBloomPass(new T.Vector2(256,256),this.bloomBase,.6,1);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
  this.grade=new ShaderPass(GRADE);this.composer.addPass(this.grade);
  return this;
 }
 // A neon light box baked into an environment map gives wet surfaces and metals colored reflections.
 // Swap in a real HDR environment (CC0, Poly Haven) once it loads; the procedural one stays
 // until then, and on failure. Shared across renderers, so it downloads once.
 hdrEnvironment(url=ENV_HDR,intensity=.9,{background=false,blur=.35}={}){return loadHdr(url,this.r).then(tex=>{if(this.dead)return;this.envMap?.dispose?.();this.scene.environment=tex;this.scene.environmentIntensity=intensity;if(background){this.scene.background=tex;this.scene.backgroundBlurriness=blur;this.scene.backgroundIntensity=.55;}}).catch(()=>{});}
 neonEnvironment(intensity=.7){
  const env=new T.Scene();env.background=new T.Color(0x05060c);for(const [x,y,z,w,h,col]of [[-6,3,-8,10,2,0xff4fc0],[6,4,-8,10,2,0x48e6ff],[0,7,6,14,1.5,0xb9ff5e],[-8,1,4,4,6,0x9f6bff],[8,2,4,4,6,0xff8a3d],[0,-3,0,30,.5,0x101828]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(col).multiplyScalar(3),side:T.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);env.add(m);}
  const pm=new T.PMREMGenerator(this.r);this.envMap=pm.fromScene(env,.03);pm.dispose();env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.scene.environment=this.envMap.texture;this.scene.environmentIntensity=intensity;
 }
 resize(){const w=Math.max(1,this.view.clientWidth||420),h=Math.max(1,this.view.clientHeight||560);if(w===this.w&&h===this.h)return false;this.w=w;this.h=h;const ratio=Math.max(.6,Math.min(globalThis.devicePixelRatio||1,this.quality==='high'?1.75:1,Math.sqrt(2.4e6/(w*h))));this.r.setPixelRatio(ratio);this.r.setSize(w,h,false);this.composer.setPixelRatio(ratio);this.composer.setSize(w,h);this.grade.uniforms.uRes.value.set(w*ratio,h*ratio);this.camera.aspect=w/h;return true;}
 // Soft PCF shadows from a directional light on high, with tight bounds around the play area
 // (half-size `size`, depth `far`) so texels stay small. A no-op on the light profile.
 sunShadow(light,{size=12,far=60,map=2048,radius=4,bias=-.0003,normalBias=.025}={}){if(this.quality!=='high'||!light)return light;light.castShadow=true;light.shadow.mapSize.set(map,map);Object.assign(light.shadow.camera,{left:-size,right:size,top:size,bottom:-size,near:.5,far});light.shadow.camera.updateProjectionMatrix();light.shadow.radius=radius;light.shadow.bias=bias;light.shadow.normalBias=normalBias;return light;}
 // A soft studio light box (three's RoomEnvironment) for scenes that want neutral, daylight-like
 // reflections rather than the neon box.
 studioEnvironment(intensity=.6){const pm=new T.PMREMGenerator(this.r),room=new T.RoomEnvironment();this.envMap?.dispose?.();this.envMap=pm.fromScene(room,.04);pm.dispose();room.traverse?.(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});this.scene.environment=this.envMap.texture;this.scene.environmentIntensity=intensity;}
 // Keeps a shadow-casting sun centred on the action: the light keeps its direction (offset from
 // its target) while both move to (x, y, z). Snaps to whole shadow texels so edges don't shimmer.
 followSun(light,x,y,z){if(!light?.castShadow)return;const cam=light.shadow.camera,step=(cam.right-cam.left)/light.shadow.mapSize.x||0,q=v=>step?Math.round(v/step)*step:v,t=light.target.position,dx=light.position.x-t.x,dy=light.position.y-t.y,dz=light.position.z-t.z;t.set(q(x),y,q(z));light.position.set(t.x+dx,t.y+dy,t.z+dz);light.target.updateMatrixWorld();}
 shake(amount){this.trauma=Math.max(this.trauma,amount);}
 flashOnce(color,amount,reduced=false){if(reduced)amount*=.4;this.flashColor.set(color);this.flash=Math.max(this.flash,amount);}
 // Applies trauma shake to the camera position; call after the camera is placed, before lookAt.
 applyShake(real,reduced){if(reduced||this.trauma<=0)return;const s=this.trauma*this.trauma*.45,c=this.camera.position;c.x+=(Math.sin(real*71)+Math.sin(real*37))*.5*s;c.y+=(Math.sin(real*63)+Math.sin(real*29))*.5*s;}
 render(dt,real,{aberration=.0025,reduced=false}={}){
  this.trauma=Math.max(0,this.trauma-dt*1.5);this.flash=Math.max(0,this.flash-dt*2.6);
  const gu=this.grade.uniforms;gu.uTime.value=real;gu.uFlash.value=this.flash;gu.uFlashColor.value.copy(this.flashColor);gu.uAberration.value=reduced?.001:aberration+this.trauma*.012;
  this.bloom.strength=this.bloomBase+this.flash*.8;this.composer.render(dt);this.adapt(dt);
 }
 // Drops to the light profile if frames run long, so phones and older laptops stay smooth.
 adapt(dt){if(this.quality!=='high'||!dt)return;this.slowFrames=dt>.024?this.slowFrames+1:Math.max(0,this.slowFrames-2);if(this.slowFrames>90){this.quality='low';this.r.shadowMap.enabled=false;this.scene.traverse(o=>{if(o.isLight&&o.castShadow)o.castShadow=false;});this.w=0;this.bloomBase=.75;this.onDowngrade?.();}}
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();}
 dispose(){
  if(this.dead)return;this.dead=true;this.canvas?.removeEventListener('webglcontextlost',this.loss);
  try{const gs=new Set(this.extraGeometries),ms=new Set(),ts=new Set();this.scene?.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material||[])){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});
   for(const g of gs)g.dispose();for(const m of ms)m.dispose();for(const t of ts)t.dispose();this.envMap?.dispose();this.composer?.dispose();this.r?.forceContextLoss();this.r?.dispose();}catch{}
  this.view?.remove();
 }
}

/** Pooled additive particles. `stick` 1 keeps a particle on the moving ground, 0 lets it float. */
export class Particles {
 constructor(scene,count,glowTex){
  this.N=count;this.pos=new Float32Array(count*3);this.col=new Float32Array(count*3);this.vel=new Float32Array(count*3);this.life=new Float32Array(count);this.max=new Float32Array(count);this.base=new Float32Array(count*3);this.grav=new Float32Array(count);this.stick=new Float32Array(count);this.next=0;this.reduced=false;
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(this.pos,3).setUsage(T.DynamicDrawUsage));g.setAttribute('color',new T.BufferAttribute(this.col,3).setUsage(T.DynamicDrawUsage));
  this.points=new T.Points(g,new T.PointsMaterial({size:.22,map:glowTex,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.points.frustumCulled=false;scene.add(this.points);
 }
 burst(x,y,z,count,color,{speed=5,life=.7,gravity=-6,up=2,spread=1,stick=.2}={}){
  if(this.reduced)count=Math.ceil(count/4);const c=new T.Color(color);
  for(let i=0;i<count;i++){const k=this.next=(this.next+1)%this.N,a=Math.random()*Math.PI*2,u=Math.random()*2-1,r=Math.sqrt(1-u*u),v=speed*(.35+Math.random()*.65);
   this.pos.set([x+(Math.random()-.5)*spread*.3,y,z],k*3);this.vel.set([Math.cos(a)*r*v,Math.abs(u)*v*.6+up,Math.sin(a)*r*v],k*3);this.life[k]=this.max[k]=life*(.6+Math.random()*.5);this.grav[k]=gravity;this.stick[k]=stick;this.base.set([c.r,c.g,c.b],k*3);}
 }
 // drift moves the world past the camera (for runners); floor keeps particles above the ground.
 update(dt,drift={x:0,y:0,z:0},floor=.02){
  for(let i=0;i<this.N;i++){if(this.life[i]<=0){if(this.col[i*3]!==0)this.col[i*3]=this.col[i*3+1]=this.col[i*3+2]=0;continue;}
   this.life[i]-=dt;const k=i*3,f=Math.max(0,this.life[i]/this.max[i]),s=this.stick[i];this.vel[k+1]+=this.grav[i]*dt;
   this.pos[k]+=(this.vel[k]+drift.x*s)*dt;this.pos[k+1]=Math.max(floor,this.pos[k+1]+(this.vel[k+1]+drift.y*s)*dt);this.pos[k+2]+=(this.vel[k+2]+drift.z*s)*dt;
   this.col[k]=this.base[k]*f*1.8;this.col[k+1]=this.base[k+1]*f*1.8;this.col[k+2]=this.base[k+2]*f*1.8;}
  const g=this.points.geometry;g.attributes.position.needsUpdate=true;g.attributes.color.needsUpdate=true;
 }
}

/**
 * Third/first-person camera with a smooth handover. Each frame the game supplies both poses;
 * `mix` eases toward the chosen mode so switching never cuts.
 */
export class CameraRig {
 constructor(camera){this.camera=camera;this.mode='third';this.mix=0;this.pos=new T.Vector3();this.at=new T.Vector3();this.started=false;}
 setMode(mode){this.mode=mode==='first'?'first':'third';}
 get first(){return this.mix>.5;}
 update(dt,third,first,{follow=9,snap=false,roll=0}={}){
  const goal=this.mode==='first'&&first?1:0;this.mix+=(goal-this.mix)*Math.min(1,dt*5);if(Math.abs(goal-this.mix)<.001)this.mix=goal;
  const k=smooth(this.mix),pos=first?third.pos.clone().lerp(first.pos,k):third.pos,at=first?third.at.clone().lerp(first.at,k):third.at;
  const f=snap||!this.started?1:Math.min(1,dt*(this.mix>0&&this.mix<1?Math.max(follow,12):follow));this.started=true;
  this.camera.position.lerp(pos,f);this.at.copy(at);this.roll=roll;
 }
 aim(){const r=this.roll||0;this.camera.up.set(Math.sin(r),Math.cos(r),0);this.camera.lookAt(this.at);}
}

/** DOM HUD layer over the canvas: cached text updates, floating callouts and a district banner. */
export class Hud {
 constructor(html){const root=this.root=document.createElement('div');root.className='d3-hud';root.innerHTML=html+'<div class="d3-pops"></div><div class="d3-banner" hidden></div>';this.pops=root.querySelector('.d3-pops');this.bannerEl=root.querySelector('.d3-banner');this.cache={};this.reduced=false;}
 q(selector){return this.root.querySelector(selector);}
 set(el,key,value){if(this.cache[key]!==value){this.cache[key]=value;el.textContent=value;}}
 pop(text,kind='gold'){if(this.reduced&&kind!=='big')return;const p=document.createElement('span');p.className='d3-pop d3-'+kind;p.textContent=text;p.style.setProperty('--x',((Math.random()-.5)*60).toFixed(0)+'px');this.pops.append(p);setTimeout(()=>p.remove(),1100);while(this.pops.children.length>6)this.pops.firstChild.remove();}
 banner(text){const b=this.bannerEl;b.textContent=text;b.hidden=false;b.classList.remove('d3-show');void b.offsetWidth;b.classList.add('d3-show');clearTimeout(this.timer);this.timer=setTimeout(()=>{b.hidden=true;},2600);}
 live(on){this.root.classList.toggle('d3-live',on);}
 dispose(){clearTimeout(this.timer);}
}

/**
 * Presentation-only frames while a game is not ticking (idle orbit, crash camera).
 * `keep(now)` decides whether to continue; frames are capped near 30 fps.
 */
export class AmbientLoop {
 constructor(render){this.render=render;this.id=0;this.last=0;this.lastDraw=0;}
 drew(now){this.lastDraw=now;}
 start(keep){if(this.id)return;const loop=now=>{this.id=0;if(!keep(now))return;if(now-this.lastDraw>=30&&now-this.last>=30){this.last=now;this.render(now);}this.id=requestAnimationFrame(loop);};this.id=requestAnimationFrame(loop);}
 stop(){cancelAnimationFrame(this.id);this.id=0;}
}
