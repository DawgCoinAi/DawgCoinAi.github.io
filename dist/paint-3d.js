// Three.js presentation for Paint the Town: a night-market city that changes colour as it is won.
// The street is one wet-asphalt plane whose shader reads the engine's ownership grid: paint is a
// thick glossy film with soft organic edges that floods outward from wherever a loop closed.
// Buildings, parked cars, trees, the fountain and the billboard take the colour of whoever
// encloses them (paint climbs the walls). Open trails are glowing wet ribbons, the camera rides
// close on your DAWG and pulls back to frame a loop while your trail is out.
// PaintGame owns every rule; this only reads it. Engine cell (x, y) is centred at world (x + .5, 0, y + .5).
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,quality,radial,glowStops,texture,merge,facade,signTexture,buildingShells,facadeMaterials,Stage,Particles,CameraRig,Hud,AmbientLoop,pbr,castShadows,contactShadow,lightShaft,loadModel,cloneModel,fitModel} from './three-kit.js';
import {PAINT,DIRS,TIERS,STAGES,LEAGUES,FEATS,hash} from './paint-engine.js';
import {npcDawg} from './npc-dawg.js';

const PLACE=['','1ST','2ND','3RD','4TH','5TH'],FOV=38,PITCH=1.03,FLOOD=.04,NOISE=`
float pHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float pNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(pHash(i),pHash(i+vec2(1.,0.)),f.x),mix(pHash(i+vec2(0.,1.)),pHash(i+vec2(1.,1.)),f.x),f.y);}`;
const SHOPS=['NOODLES','ARCADE','BARK BAR','RECORDS','24/7','BONES','SNACKS','KARAOKE','TEA','PAWS'];
const hex=c=>'#'+c.getHexString();

// The street material: standard PBR with the paint film mixed in from the ownership texture.
// uOwn holds, per cell: owner now, owner before, and the moment the flood reaches it.
function groundMaterial(map,uniforms,q){
 const m=pbr({map,color:0xffffff,roughness:.62,metalness:.08,envMapIntensity:.85},q);
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vCell;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCell=(modelMatrix*vec4(transformed,1.)).xz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
uniform sampler2D uOwn;uniform vec3 uCols[8];uniform vec2 uGrid;uniform float uTime;varying vec2 vCell;${NOISE}
vec2 pCell(vec2 c){if(c.x<0.||c.y<0.||c.x>=uGrid.x||c.y>=uGrid.y)return vec2(-1.,0.);vec4 d=texture2D(uOwn,(c+.5)/uGrid);float on=step(d.b,uTime);return vec2(mix(d.g,d.r,on),on*step(.001,d.b)*exp(-max(0.,uTime-d.b)*2.6));}
vec3 pCol(float id){return uCols[int(max(id,0.)+.5)];}`)
  .replace('#include <color_fragment>',`#include <color_fragment>
vec2 pp=vCell+(vec2(pNoise(vCell*1.3),pNoise(vCell*1.3+17.))-.5)*.46+(vec2(pNoise(vCell*5.),pNoise(vCell*5.+9.))-.5)*.13;
vec2 pb=floor(pp-.5),pf=pp-.5-pb;
vec2 c00=pCell(pb),c10=pCell(pb+vec2(1.,0.)),c01=pCell(pb+vec2(0.,1.)),c11=pCell(pb+vec2(1.,1.));
vec4 pa=step(0.,vec4(c00.x,c10.x,c01.x,c11.x)),pw=vec4((1.-pf.x)*(1.-pf.y),pf.x*(1.-pf.y),(1.-pf.x)*pf.y,pf.x*pf.y)*pa;
float pP=pw.x+pw.y+pw.z+pw.w,pMask=smoothstep(.45,.55,pP);
vec4 pk=pw*pw;pk=pk*pk*pk;float pks=pk.x+pk.y+pk.z+pk.w+1e-6;
vec3 paintCol=(pCol(c00.x)*pk.x+pCol(c10.x)*pk.y+pCol(c01.x)*pk.z+pCol(c11.x)*pk.w)/pks;
float pFresh=(c00.y*pk.x+c10.y*pk.y+c01.y*pk.z+c11.y*pk.w)/pks;
vec4 pid=vec4(c00.x,c10.x,c01.x,c11.x);float pTop=pk.x>=max(pk.y,max(pk.z,pk.w))?pid.x:pk.y>=max(pk.z,pk.w)?pid.y:pk.z>=pk.w?pid.z:pid.w;
float pSeam=smoothstep(.12,.5,1.-dot(pk,1.-step(.5,abs(pid-pTop)))/pks);
vec2 pGrad=vec2((pa.y-pa.x)*(1.-pf.y)+(pa.w-pa.z)*pf.y,(pa.z-pa.x)*(1.-pf.x)+(pa.w-pa.y)*pf.x);
float pEdge=pMask*(1.-pMask)*4.,pStreet=dot(diffuseColor.rgb,vec3(.3,.6,.1));
float pN0=pNoise(vCell*2.6),pLit=dot(normalize(pGrad+1e-4),vec2(.55,-.83));
vec3 pWet=paintCol*(.44+pStreet*1.25)*(.86+.18*pN0)*(1.-.5*pSeam)*(1.+pEdge*pLit*.45);
float pShade=smoothstep(.16,.5,pP)*(1.-pMask);
diffuseColor.rgb=mix(diffuseColor.rgb*(1.-.6*pShade),pWet,pMask);`)
  .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.1+.14*pNoise(vCell*4.),pMask);')
  .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,0.,pMask);')
  .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec2 pRip=vec2(pNoise(vCell*2.6+vec2(.35,0.))-pN0,pNoise(vCell*2.6+vec2(0.,.35))-pN0)*pMask*1.1;\nnormal=normalize(normal-(viewMatrix*vec4(pGrad.x*pEdge*1.1+pRip.x,0.,pGrad.y*pEdge*1.1+pRip.y,0.)).xyz);')
  .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=paintCol*pMask*(.035+pFresh*.8)+vec3(1.)*pFresh*pMask*.12;');};
 m.customProgramCacheKey=()=>'paint-ground';return m;}

// A wall or roof material that can be flooded with paint from the street up. uPLevel is the
// world height the paint has climbed to; uPOld is the coat underneath.
function paintable(m){const u=m.userData.u={uPCol:{value:new T.Color()},uPOld:{value:new T.Color()},uPOldOn:{value:0},uPLevel:{value:-1}};
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWp=(modelMatrix*vec4(transformed,1.)).xyz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
uniform vec3 uPCol,uPOld;uniform float uPOldOn,uPLevel;varying vec3 vWp;${NOISE}`)
  .replace('#include <color_fragment>',`#include <color_fragment>
float bN=pNoise(vec2(vWp.x+vWp.z,vWp.x-vWp.z)*2.3),bLvl=uPLevel-.3+bN*.4+pow(abs(sin((vWp.x+vWp.z)*4.+bN*4.)),5.)*.45;
float bM=(1.-smoothstep(bLvl-.05,bLvl+.05,vWp.y))*step(0.,uPLevel),bOn=max(uPOldOn,bM);
vec3 bCoat=mix(uPOld,uPCol,bM);
diffuseColor.rgb=mix(diffuseColor.rgb,bCoat*(.42+.4*bN),bOn*.88);`)
  .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.2,bOn);')
  .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance=totalEmissiveRadiance*(1.-.3*bOn)+bCoat*bOn*.07+uPCol*smoothstep(.16,0.,abs(vWp.y-bLvl))*step(0.,uPLevel)*1.3;');};
 m.customProgramCacheKey=()=>'paint-wall';return m;}

// The street map for a city: asphalt, lane lines down every avenue, crosswalks, sidewalks round
// every block, parking bays, park grass, landmark plazas and each crew's home emblem.
function cityTexture(g,S){const {W,H,blocks,homes}=g.city,r=(n,i)=>hash(g.worldSeed+77,n,i);
 return texture(W*S,H*S,(c,w,h)=>{c.fillStyle='#272c42';c.fillRect(0,0,w,h);
  for(let i=0;i<60;i++){const x=r(1,i)*w,y=r(2,i)*h,R=S*(1+r(3,i)*3),gr=c.createRadialGradient(x,y,0,x,y,R);gr.addColorStop(0,r(4,i)>.5?'#0d0f1a66':'#2a2f4455');gr.addColorStop(1,'#00000000');c.fillStyle=gr;c.fillRect(x-R,y-R,R*2,R*2);}
  for(let i=0;i<W*H*5;i++){c.fillStyle=r(5,i)>.5?'#ffffff0c':'#00000026';c.fillRect(r(6,i)*w,r(7,i)*h,S*.05,S*.05);}
  // Avenues run along the district lines; a dashed centre line each, and a solid edge line round town.
  c.strokeStyle='#f2c96a48';c.lineWidth=S*.06;c.setLineDash([S*.55,S*.5]);c.beginPath();for(let m=1;m<4;m++){c.moveTo((1+m*7)*S,S*.6);c.lineTo((1+m*7)*S,h-S*.6);}for(let m=1;m<5;m++){c.moveTo(S*.6,(1+m*7)*S);c.lineTo(w-S*.6,(1+m*7)*S);}c.stroke();c.setLineDash([]);
  c.strokeStyle='#ffffff30';c.lineWidth=S*.05;c.strokeRect(S*.35,S*.35,w-S*.7,h-S*.7);
  // Crosswalks on the four arms of every crossing.
  c.fillStyle='#e8ecff20';for(let mx=1;mx<4;mx++)for(let my=1;my<5;my++){const X=(1+mx*7)*S,Y=(1+my*7)*S;for(let k=-3;k<=3;k++){if(!k)continue;const o=k*S*.26;c.fillRect(X+o-S*.07,Y-S*1.75,S*.14,S*.55);c.fillRect(X+o-S*.07,Y+S*1.2,S*.14,S*.55);c.fillRect(X-S*1.75,Y+o-S*.07,S*.55,S*.14);c.fillRect(X+S*1.2,Y+o-S*.07,S*.55,S*.14);}
   c.fillStyle='#0b0d16aa';c.beginPath();c.arc(X+S*.9,Y+S*.8,S*.2,0,7);c.fill();c.strokeStyle='#ffffff22';c.lineWidth=1.5;c.stroke();c.fillStyle='#e8ecff20';}
  // Home emblems: a ring and a paw in the crew's colour.
  homes.forEach((hm,k)=>{const X=(hm.x+.5)*S,Y=(hm.y+.5)*S,col=g.players[k].color;c.strokeStyle=col+'aa';c.lineWidth=S*.12;c.beginPath();c.arc(X,Y,S*2.5,0,7);c.stroke();c.lineWidth=S*.04;c.beginPath();c.arc(X,Y,S*2.85,0,7);c.stroke();
   c.fillStyle=col+'66';c.beginPath();c.ellipse(X,Y+S*.25,S*.55,S*.45,0,0,7);c.fill();for(const [dx,dy] of [[-.6,-.3],[-.22,-.62],[.22,-.62],[.6,-.3]]){c.beginPath();c.arc(X+dx*S,Y+dy*S,S*.2,0,7);c.fill();}});
  for(const b of blocks){const x=b.x*S,y=b.y*S,bw=b.w*S,bh=b.h*S;c.save();
   if(b.landmark){const X=x+bw/2,Y=y+bh/2;c.fillStyle='#2b2740';c.beginPath();c.arc(X,Y,S*2.9,0,7);c.fill();c.strokeStyle='#ffd27a55';c.lineWidth=S*.06;for(const R of [2.9,2.3,1.7]){c.beginPath();c.arc(X,Y,S*R,0,7);c.stroke();}for(let a=0;a<16;a++){c.beginPath();c.moveTo(X+Math.cos(a*Math.PI/8)*S*1.7,Y+Math.sin(a*Math.PI/8)*S*1.7);c.lineTo(X+Math.cos(a*Math.PI/8)*S*2.9,Y+Math.sin(a*Math.PI/8)*S*2.9);c.stroke();}}
   else if(b.kind==='lot'){c.fillStyle='#232736';c.fillRect(x,y,bw,bh);c.strokeStyle='#ffffffb0';c.lineWidth=S*.05;c.strokeRect(x+S*.12,y+S*.12,bw-S*.24,bh-S*.24);c.strokeStyle='#ffffff66';for(let i=1;i<b.w;i++){c.beginPath();c.moveTo(x+i*S,y+S*.12);c.lineTo(x+i*S,y+S*1.1);c.moveTo(x+i*S,y+bh-S*.12);c.lineTo(x+i*S,y+bh-S*1.1);c.stroke();}}
   else if(b.kind==='park'){c.fillStyle='#1d3a2a';c.beginPath();c.roundRect(x+S*.08,y+S*.08,bw-S*.16,bh-S*.16,S*.5);c.fill();for(let i=0;i<220;i++){c.fillStyle=r(8,i+b.id*300)>.5?'#2f6a3f77':'#12281c88';c.fillRect(x+S*.2+r(9,i+b.id*300)*(bw-S*.5),y+S*.2+r(10,i+b.id*300)*(bh-S*.5),S*.12,S*.12);}c.strokeStyle='#c9b98a66';c.lineWidth=S*.3;c.beginPath();c.moveTo(x,y+bh/2);c.bezierCurveTo(x+bw*.3,y+bh*.2,x+bw*.7,y+bh*.8,x+bw,y+bh/2);c.stroke();}
   else{c.fillStyle='#3a3f55';c.beginPath();c.roundRect(x+S*.04,y+S*.04,bw-S*.08,bh-S*.08,S*.18);c.fill();c.strokeStyle='#00000030';c.lineWidth=1;for(let i=1;i<b.w*3;i++){c.beginPath();c.moveTo(x+i*S/3,y);c.lineTo(x+i*S/3,y+bh);c.stroke();}for(let i=1;i<b.h*3;i++){c.beginPath();c.moveTo(x,y+i*S/3);c.lineTo(x+bw,y+i*S/3);c.stroke();}c.strokeStyle='#9aa3c4';c.lineWidth=S*.05;c.beginPath();c.roundRect(x+S*.04,y+S*.04,bw-S*.08,bh-S*.08,S*.18);c.stroke();}
   c.restore();}
 });}
// A flat roof seen from above: parapet, vents, a skylight or two, a helipad on the big ones.
function roofTexture(seed,w,h){const S=64;return texture(Math.round(w*S),Math.round(h*S),(c,W,H)=>{c.fillStyle='#262a3c';c.fillRect(0,0,W,H);for(let i=0;i<500;i++){c.fillStyle=hash(seed,1,i)>.5?'#ffffff0d':'#0000002a';c.fillRect(hash(seed,2,i)*W,hash(seed,3,i)*H,3,3);}
  c.strokeStyle='#4c536e';c.lineWidth=10;c.strokeRect(5,5,W-10,H-10);c.strokeStyle='#12141f';c.lineWidth=3;c.strokeRect(12,12,W-24,H-24);
  for(let i=0;i<3;i++){const x=24+hash(seed,4,i)*(W-90),y=24+hash(seed,5,i)*(H-80);if(hash(seed,6,i)>.5){c.fillStyle='#ffd9a0';c.shadowColor='#ffc46a';c.shadowBlur=14;c.fillRect(x,y,40,26);c.shadowBlur=0;c.strokeStyle='#1a1c28';c.lineWidth=3;c.strokeRect(x,y,40,26);c.beginPath();c.moveTo(x+20,y);c.lineTo(x+20,y+26);c.stroke();}else{c.fillStyle='#151824';c.beginPath();c.arc(x+18,y+18,16,0,7);c.fill();c.strokeStyle='#59607c';c.lineWidth=3;c.stroke();}}
  if(w>=3.4&&h>=3.4&&hash(seed,7)>.4){c.strokeStyle='#f2c96a';c.lineWidth=5;c.beginPath();c.arc(W/2,H/2,Math.min(W,H)*.26,0,7);c.stroke();c.font='900 '+Math.min(W,H)*.3+'px system-ui,sans-serif';c.fillStyle='#f2c96a';c.textAlign='center';c.textBaseline='middle';c.fillText('D',W/2,H/2+2);}});}
function tagSprite(text,color,you){const map=texture(256,80,(c)=>{c.fillStyle='#07080fd0';c.beginPath();c.roundRect(6,8,244,50,25);c.fill();c.lineWidth=4;c.strokeStyle=color;c.stroke();c.fillStyle=color;c.beginPath();c.arc(34,33,11,0,7);c.fill();c.fillStyle=you?'#fff6d0':'#fff';c.font='900 30px system-ui,sans-serif';c.textAlign='left';c.textBaseline='middle';c.fillText(text,54,35);c.fillStyle=color;c.beginPath();c.moveTo(118,58);c.lineTo(138,58);c.lineTo(128,74);c.fill();}),s=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));s.scale.set(1.9,.6,1);s.renderOrder=20;return s;}
const boardArt=(text,sub,bg,fg)=>texture(512,256,(c,w,h)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);for(let i=0;i<26;i++){c.fillStyle=['#ff4fd8','#3fd8ff','#a8ff4a','#ffd23e','#a071ff','#ff7a2e'][i%6]+'55';c.beginPath();c.arc(hash(9,i)*w,hash(10,i)*h,10+hash(11,i)*44,0,7);c.fill();}c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font='900 '+(text.length>6?78:112)+'px system-ui,sans-serif';c.lineWidth=12;c.strokeStyle='#07080f';c.strokeText(text,w/2,h*.42);c.fillText(text,w/2,h*.42);c.font='900 34px system-ui,sans-serif';c.lineWidth=7;c.strokeText(sub,w/2,h*.8);c.fillText(sub,w/2,h*.8);});

export class ThreePaint {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.t0=performance.now();this.clock=this.t0;this.status='';this.statusSince=this.t0;this.seed=null;this.game=null;this.crew=[];this.crewKey='';this.lastMap=0;this.later=[];this.origin=[];this.zoom={w:4.3,d:5.5};this.punch=0;this.focus=new T.Vector3();}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d paint3d',onFailure:()=>this.fail(),exposure:1.05}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;this.stage.onDowngrade=()=>{this.quality='low';};
  this.hud=new Hud('<div class="pt-top"><b class="pt-time">3:00</b><span class="pt-stage"></span></div><ol class="pt-board"></ol><div class="pt-mapbox"><canvas class="pt-map" width="180" height="222" aria-hidden="true"></canvas></div><div class="pt-share" aria-hidden="true"></div><span class="pt-dash"><i></i><b>DASH</b><small>SPACE</small></span><div class="pt-kit"><span class="pt-shield" hidden>SHIELD</span><span class="pt-streak" hidden></span><span class="pt-dog" hidden>UNDERDOG BOOST</span></div><ul class="pt-feed" aria-hidden="true"></ul><p class="pt-warn" hidden>TRAIL EXPOSED · GET HOME</p><p class="pt-tip" hidden></p><p class="pt-feat" hidden></p><div class="pt-podium" hidden></div>');this.view.append(this.hud.root);
  const q=s=>this.hud.q(s);this.ui={time:q('.pt-time'),stage:q('.pt-stage'),board:q('.pt-board'),share:q('.pt-share'),map:q('.pt-map'),tip:q('.pt-tip'),feat:q('.pt-feat'),warn:q('.pt-warn'),dash:q('.pt-dash'),dashFill:q('.pt-dash i'),shield:q('.pt-shield'),streak:q('.pt-streak'),dog:q('.pt-dog'),feed:q('.pt-feed'),podium:q('.pt-podium')};this.mapCtx=this.ui.map.getContext('2d');
  // The dash button is the one touchable part of the HUD: it presses Space for you, so the shell's own input path handles it.
  this.ui.dash.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));});
  this.rig=new CameraRig(this.camera);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  const s=this.scene,high=this.quality==='high';this.stage.neonEnvironment(.75);this.stage.hdrEnvironment(undefined,.55);s.background=new T.Color(0x070818);s.fog=new T.Fog(0x070818,42,120);
  s.add(new T.HemisphereLight(0xa9b6ff,0x2c1c44,1.5));this.key=new T.DirectionalLight(0xffe6c8,2.3);this.key.position.set(-7,15,8);s.add(this.key,this.key.target);this.stage.sunShadow(this.key,{size:13,far:48,map:2048,radius:3});
  const rim=new T.DirectionalLight(0x6f8cff,.9);rim.position.set(8,6,-10);s.add(rim);
  this.glowTex=radial(glowStops);this.particles=new Particles(s,high?900:260,this.glowTex);this.particles.points.material.size=.3;this.stage.bloomBase=high?.5:.45;
  this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D CITY · LIVE');return this;}
 setCamera(){}
 prepare(d){this.dawg=d;}
 col(k){return this.colors[k]??this.colors[0];}

 // ── The city for this match: street, sidewalks, blocks, landmarks, props, lights.
 build(g){const s=this.scene,{W,H,blocks}=g.city,high=this.quality==='high',q=this.quality,N=W*H;
  if(this.set){this.set.traverse(o=>{if(o.geometry&&!o.userData.shared)o.geometry.dispose?.();for(const m of [].concat(o.material||[])){if(m.userData?.shared)continue;for(const v of Object.values(m))if(v?.isTexture&&!v.userData?.shared)v.dispose();m.dispose?.();}});s.remove(this.set);}
  const set=this.set=new T.Group();s.add(set);this.seed=g.worldSeed;this.colors=g.players.map(p=>new T.Color(p.color));this.W=W;this.H=H;this.glowTex.userData.shared=true;this.mapSrc=null;
  // Ownership texture and the street.
  this.own=new Float32Array(N*4);this.ownTex=new T.DataTexture(this.own,W,H,T.RGBAFormat,T.FloatType);this.ownTex.minFilter=this.ownTex.magFilter=T.NearestFilter;this.shown=new Int8Array(N);
  this.gu={uOwn:{value:this.ownTex},uCols:{value:Array.from({length:8},(_,i)=>this.col(i).clone())},uGrid:{value:new T.Vector2(W,H)},uTime:{value:0}};
  const ground=this.groundMat=groundMaterial(cityTexture(g,high?40:24),this.gu,q),floor=new T.Mesh(new T.PlaneGeometry(W,H).rotateX(-Math.PI/2),ground);floor.position.set(W/2,0,H/2);floor.receiveShadow=high;set.add(floor);
  const outer=new T.Mesh(new T.PlaneGeometry(W+160,H+160).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x0c0e1c,roughness:.85,metalness:.1}));outer.position.set(W/2,-.03,H/2);set.add(outer);
  // Raised sidewalks under every block except parking lots: the same material, so they flood too.
  const slabs=blocks.filter(b=>b.kind!=='lot').map(b=>{const geo=new T.BoxGeometry(b.w-.04,.07,b.h-.04).translate(b.x+b.w/2,.035,b.y+b.h/2),p=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/W,1-p.getZ(i)/H);return geo;});
  if(slabs.length){const m=new T.Mesh(merge(slabs),ground);m.receiveShadow=high;set.add(m);}
  // A neon kerb round town and the skyline beyond it.
  const kerb=new T.MeshBasicMaterial({color:new T.Color(1.5,.45,2.1),toneMapped:false});set.add(new T.Mesh(merge([[W/2,-.12,W+.5,.12],[W/2,H+.12,W+.5,.12],[-.12,H/2,.12,H+.5],[W+.12,H/2,.12,H+.5]].map(([x,z,w,d])=>new T.BoxGeometry(w,.1,d).translate(x,.05,z))),kerb));
  const shells=buildingShells(14),mats=this.facades??=facadeMaterials().map(m=>{m.userData.shared=true;for(const v of Object.values(m))if(v?.isTexture)v.userData.shared=true;return m;});for(let i=0;i<(high?30:18);i++){const sh=shells[i%shells.length],n=high?30:18,t=i/n*Math.PI*2,r=.5+((i*7)%5)*.09,m=new T.Mesh(sh.g,mats[i%mats.length]);m.scale.setScalar(.36);m.position.set(W/2+Math.cos(t)*(W/2+7+r*12),0,H/2+Math.sin(t)*(H/2+7+r*12));m.rotation.y=(i*1.7)%Math.PI;m.userData.shared=true;set.add(m);}
  // Blocks.
  this.blocks=[];this.bulbAt=[];const bulbs=[],pools=[],trunks=[],crowns=[],poleGeo=[];
  const wallTex=[0,1,2,3].map(v=>[facade(v,false),facade(v,true)]);
  const festoon=(b,id,y0)=>{const cs=[[b.x+.14,b.y+.14],[b.x+b.w-.14,b.y+.14],[b.x+b.w-.14,b.y+b.h-.14],[b.x+.14,b.y+b.h-.14]],from=bulbs.length;cs.forEach(([x,z],i)=>{poleGeo.push(new T.CylinderGeometry(.025,.035,y0,6).translate(x,y0/2,z));pools.push([x,z]);const [x2,z2]=cs[(i+1)%4],n=Math.max(3,Math.round(Math.hypot(x2-x,z2-z)/.42));for(let k=1;k<n;k++){const t=k/n;bulbs.push({x:x+(x2-x)*t,y:y0-.03-Math.sin(t*Math.PI)*.2,z:z+(z2-z)*t,c:(i+k+id)%3});}});this.bulbAt[id]=[from,bulbs.length];};
  for(const b of blocks){const cx=b.x+b.w/2,cz=b.y+b.h/2,rec={b,owner:-1,level:-1,goal:-1,at:0,mats:[],height:0,tint:[],fade:1};this.blocks.push(rec);
   const wall=(geo,opts,roofMap)=>{const v=(b.id*3+1)%4,side=paintable(pbr({map:wallTex[v][0],emissiveMap:wallTex[v][1],emissive:0xffffff,emissiveIntensity:.95,roughness:.55,metalness:.3,envMapIntensity:.5,color:0xb9bed6,...opts},q)),roof=paintable(pbr({map:roofMap,roughness:.7,metalness:.15,envMapIntensity:.4,emissiveMap:roofMap,emissive:0xffffff,emissiveIntensity:.25},q));
    geo.clearGroups();geo.addGroup(0,12,0);geo.addGroup(12,12,1);geo.addGroup(24,12,0);rec.mats.push(side,roof);return new T.Mesh(geo,[side,roof]);};
   const metric=(geo,w,h,d)=>{const uv=geo.attributes.uv,n=geo.attributes.normal;for(let k=0;k<uv.count;k++){const sideFace=Math.abs(n.getX(k))>.5,top=Math.abs(n.getY(k))>.5;if(!top)uv.setXY(k,uv.getX(k)*(sideFace?d:w)/3.4,uv.getY(k)*h/3.4);}return geo;};
   if(b.kind==='tower'||b.kind==='shop'){const tower=b.kind==='tower',h=rec.height=tower?2.5+hash(g.worldSeed,31,b.id)*1.7:1.25+hash(g.worldSeed,31,b.id)*.6,w=b.w-.62,d=b.h-.62,m=wall(metric(new T.BoxGeometry(w,h,d),w,h,d),{},roofTexture(g.worldSeed+b.id,w,d));m.position.set(cx,h/2+.07,cz);castShadows(m,q);const grp=rec.group=new T.Group();set.add(grp);grp.add(m);
    // Roof kit: an air unit and a tank or mast, and a neon line round the parapet in the owner's colour.
    const kit=[new T.BoxGeometry(.5,.26,.36).translate(cx-w*.22,h+.2,cz-d*.2),new T.CylinderGeometry(.2,.2,.42,10).translate(cx+w*.24,h+.28,cz+d*.18)];if(tower)kit.push(new T.CylinderGeometry(.02,.03,1.1,5).translate(cx+w*.3,h+.62,cz-d*.3));const km=new T.Mesh(merge(kit),pbr({color:0x596079,roughness:.5,metalness:.6},q));castShadows(km,q);grp.add(km);
    const trim=new T.MeshBasicMaterial({color:new T.Color(0x8fa0ff).multiplyScalar(1.3),toneMapped:false}),tm=new T.Mesh(merge([[0,-d/2,w+.06,.06],[0,d/2,w+.06,.06],[-w/2,0,.06,d+.06],[w/2,0,.06,d+.06]].map(([dx,dz,tw,td])=>new T.BoxGeometry(tw,.06,td).translate(cx+dx,h+.1,cz+dz))),trim);grp.add(tm);rec.tint.push(c=>trim.color.copy(c).multiplyScalar(1.9));
    const sign=signTexture(SHOPS[(b.id*5+g.worldSeed)%SHOPS.length],['#ff5fc8','#5ee7ff','#ffe45e','#b9ff5e','#ff8a3d'][b.id%5],false),sh=tower?.5:.42,sm=new T.Mesh(new T.PlaneGeometry(sh*sign.aspect,sh),new T.MeshBasicMaterial({map:sign.map,transparent:true,toneMapped:false,color:new T.Color(1.7,1.7,1.7),depthWrite:false}));sm.position.set(cx,Math.min(h-.3,tower?1.5:.95),cz+d/2+.03);if(sm.geometry.parameters.width>w)sm.scale.setScalar(w/sm.geometry.parameters.width);grp.add(sm);
    festoon(b,b.id,.95);}
   else if(b.kind==='lot'){rec.height=.5;const bays=[];for(let i=0;i<b.w;i++){bays.push([b.x+i+.5,b.y+.62,0]);bays.push([b.x+i+.5,b.y+b.h-.62,Math.PI]);}const picks=bays.filter((_,i)=>hash(g.worldSeed,41,b.id*20+i)>.42).slice(0,high?5:3);
    for(const [i,[x,z,ry]] of picks.entries()){const path='cars/'+['sedan','taxi','van','suv','hatchback-sports','delivery'][Math.floor(hash(g.worldSeed,42,b.id*20+i)*6)]+'.glb';loadModel(path).then(src=>{if(this.dead||this.set!==set)return;const o=fitModel(cloneModel(src,{ownMaterials:true}),.92),holder=new T.Group();holder.add(o);holder.position.set(x,.01,z);holder.rotation.y=ry;castShadows(holder,q);set.add(holder);const ms=[];o.traverse(n=>{if(n.isMesh)ms.push(...[].concat(n.material));});const paint=c=>{for(const m of ms){m.color.copy(c).multiplyScalar(1.15);m.emissive?.copy(c).multiplyScalar(.12);}};rec.tint.push(paint);if(rec.owner>=0)paint(this.col(rec.owner));}).catch(()=>{});}
    festoon(b,b.id,.95);}
   else if(b.kind==='park'){rec.height=1.2;const n=Math.max(3,Math.round(b.w*b.h/3)),from=crowns.length;for(let i=0;i<n;i++){const x=b.x+.5+hash(g.worldSeed,51,b.id*40+i)*(b.w-1),z=b.y+.5+hash(g.worldSeed,52,b.id*40+i)*(b.h-1),sc=.75+hash(g.worldSeed,53,b.id*40+i)*.5;trunks.push([x,z,sc]);crowns.push([x,z,sc,i%3]);}rec.trees=[from,crowns.length];festoon(b,b.id,.95);}
   else{rec.height=2.2;rec.landmark=true;const stone=paintable(pbr({color:0x6b6f8c,roughness:.4,metalness:.5,envMapIntensity:.6},q));rec.mats.push(stone);const plinth=new T.Mesh(new T.CylinderGeometry(1.25,1.4,.3,24),stone);plinth.position.set(cx,.15,cz);castShadows(plinth,q);set.add(plinth);
    const ring=new T.Mesh(new T.TorusGeometry(1.42,.045,8,48).rotateX(Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(2,1.6,.7),toneMapped:false}));ring.position.set(cx,.1,cz);set.add(ring);rec.tint.push(c=>ring.material.color.copy(c).multiplyScalar(2.4));
    const beam=lightShaft(0xffe0a0,{length:9,radius:1.3,top:.5,opacity:.2,fade:[30,90]});beam.rotation.x=Math.PI;beam.position.set(cx,.2,cz);set.add(beam);rec.tint.push(c=>{beam.material.uniforms.uColor.value.copy(c);beam.material.uniforms.uOpacity.value=.42;});
    const gold=pbr({color:0xffcf6a,roughness:.22,metalness:1,envMapIntensity:1.4},q);
    if(b.kind==='statue'){const bone=merge([new T.CapsuleGeometry(.16,1.1,6,12),new T.SphereGeometry(.27,14,10).translate(-.17,.68,0),new T.SphereGeometry(.27,14,10).translate(.17,.68,0),new T.SphereGeometry(.27,14,10).translate(-.17,-.68,0),new T.SphereGeometry(.27,14,10).translate(.17,-.68,0)]),m=new T.Mesh(bone,gold);m.position.set(cx,1.35,cz);m.rotation.z=.5;castShadows(m,q);set.add(m);rec.spin=m;const col=new T.Mesh(new T.CylinderGeometry(.14,.3,.5,10),stone);col.position.set(cx,.5,cz);set.add(col);}
    else if(b.kind==='fountain'){const basin=new T.Mesh(new T.TorusGeometry(1.02,.14,10,36).rotateX(Math.PI/2),stone);basin.position.set(cx,.36,cz);set.add(basin);const water=new T.Mesh(new T.CircleGeometry(1.02,36).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(.35,1.25,1.6),toneMapped:false,transparent:true,opacity:.85}));water.position.set(cx,.4,cz);set.add(water);rec.tint.push(c=>water.material.color.copy(c).multiplyScalar(1.7));const spout=new T.Mesh(new T.CylinderGeometry(.09,.16,.9,10),gold);spout.position.set(cx,.75,cz);set.add(spout);rec.jet=[cx,1.2,cz];}
    else{const legs=new T.Mesh(merge([new T.BoxGeometry(.1,1.5,.1).translate(-.95,.95,0),new T.BoxGeometry(.1,1.5,.1).translate(.95,.95,0),new T.BoxGeometry(2.9,1.5,.08).translate(0,2.2,-.05)]),pbr({color:0x3a3f55,roughness:.4,metalness:.8},q));legs.position.set(cx,.1,cz-.1);legs.rotation.x=-.32;castShadows(legs,q);set.add(legs);
     const face=new T.Mesh(new T.PlaneGeometry(2.76,1.38),new T.MeshBasicMaterial({map:boardArt('PAINT','THE TOWN','#141627','#ffd23e'),toneMapped:false,color:new T.Color(1.25,1.25,1.25)}));face.position.set(0,2.2,0);legs.add(face);rec.tint.push((c,k)=>{face.material.map.dispose();const p=this.lastGame?.players[k];face.material.map=boardArt(p?.tag||'YOU',p?.k?'RUNS THIS TOWN':'YOU RUN THIS TOWN',hex(c),'#ffffff');face.material.needsUpdate=true;});}}}
  // Festoon lights round every block (one draw), their poles, and the pools of light under them.
  if(poleGeo.length)set.add(new T.Mesh(merge(poleGeo),new T.MeshStandardMaterial({color:0x2a2e40,roughness:.5,metalness:.7})));
  this.bulbs=new T.InstancedMesh(new T.SphereGeometry(.05,6,5),new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}),Math.max(1,bulbs.length));this.bulbCols=[new T.Color(2.2,1.5,.7),new T.Color(2.2,.7,1.6),new T.Color(.7,1.7,2.2)];const M=this.M=new T.Matrix4();bulbs.forEach((b,i)=>{M.makeTranslation(b.x,b.y,b.z);this.bulbs.setMatrixAt(i,M);this.bulbs.setColorAt(i,this.bulbCols[b.c]);});this.bulbs.count=bulbs.length;this.bulbs.frustumCulled=false;set.add(this.bulbs);
  const pool=new T.InstancedMesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:this.glowTex,color:new T.Color(1,.72,.42),transparent:true,opacity:.2,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),Math.max(1,pools.length));pools.forEach(([x,z],i)=>{M.makeScale(2.6,1,2.6);M.setPosition(x,.09,z);pool.setMatrixAt(i,M);});pool.count=pools.length;pool.renderOrder=1;pool.frustumCulled=false;set.add(pool);
  // Trees: trunks and round crowns, which take the owner's colour.
  if(crowns.length){const tr=new T.InstancedMesh(new T.CylinderGeometry(.06,.09,.5,6).translate(0,.25,0),new T.MeshStandardMaterial({color:0x4a3526,roughness:.9}),trunks.length);trunks.forEach(([x,z,sc],i)=>{M.makeScale(sc,sc,sc);M.setPosition(x,.07,z);tr.setMatrixAt(i,M);});tr.frustumCulled=false;set.add(tr);
   this.crowns=new T.InstancedMesh(new T.IcosahedronGeometry(.42,1).translate(0,.78,0),pbr({color:0xffffff,roughness:.75,metalness:0},q),crowns.length);this.leaf=[new T.Color(0x2f8f4e),new T.Color(0x3fa35c),new T.Color(0x24764a)];crowns.forEach(([x,z,sc,c],i)=>{M.makeScale(sc,sc*1.1,sc);M.setPosition(x,.07,z);this.crowns.setMatrixAt(i,M);this.crowns.setColorAt(i,this.leaf[c]);});this.crowns.frustumCulled=false;castShadows(this.crowns,q);castShadows(tr,q);set.add(this.crowns);}else this.crowns=null;
  // Home rings, pickup pool, trail ribbons.
  this.homeMarks=g.city.homes.map((h,k)=>{const r=new T.Mesh(new T.RingGeometry(1.25,1.34,40).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:this.col(k).clone().multiplyScalar(1.8),toneMapped:false,transparent:true,opacity:.75,depthWrite:false}));r.position.set(h.x+.5,.085,h.y+.5);r.renderOrder=2;set.add(r);return r;});
  this.pickups=new Map();this.pickPool=[];
  const strip=texture(64,4,(c,w,h)=>{const gr=c.createLinearGradient(0,0,w,0);gr.addColorStop(0,'#ffffff00');gr.addColorStop(.22,'#ffffff66');gr.addColorStop(.4,'#ffffffff');gr.addColorStop(.6,'#ffffffff');gr.addColorStop(.78,'#ffffff66');gr.addColorStop(1,'#ffffff00');c.fillStyle=gr;c.fillRect(0,0,w,h);});
  this.ribbons=g.players.map((p,k)=>{const Q=260,geo=new T.BufferGeometry(),pos=new Float32Array(Q*12),uv=new Float32Array(Q*8),idx=new Uint16Array(Q*6);for(let i=0;i<Q;i++){uv.set([0,0,1,0,0,1,1,1],i*8);idx.set([i*4,i*4+2,i*4+1,i*4+1,i*4+2,i*4+3],i*6);}geo.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));geo.setAttribute('uv',new T.BufferAttribute(uv,2));geo.setIndex(new T.BufferAttribute(idx,1));geo.setDrawRange(0,0);
   const m=new T.Mesh(geo,new T.MeshBasicMaterial({map:strip,color:this.col(k).clone().multiplyScalar(1.3),transparent:true,depthWrite:false,toneMapped:false,side:T.DoubleSide}));m.frustumCulled=false;m.renderOrder=3;set.add(m);return {mesh:m,pos,Q,base:this.col(k).clone().multiplyScalar(1.3)};});
  this.crewKey='';this.coached??=new Set();this.reset(g);}
 // A line of coaching at the bottom of the screen for a few seconds.
 tip(text,ms=5000){this.ui.tip.textContent=text;this.ui.tip.hidden=false;this.tipUntil=performance.now()+ms;}
 // Advanced moves, each explained once, the first time you are close to pulling one off.
 coach(g){const you=g.you,W=this.W,say=(id,text)=>{if(this.coached.has(id))return false;this.coached.add(id);this.tip(text,5200);return true;};if(!you.alive||this.tipUntil)return;
  if(you.trail.length>=5&&!you.cool&&g.trailThreat()<=6&&say('dash','A rival is closing on your trail. DASH home: Space, a tap, or the button.'))return;
  for(const p of g.players)if(p.k&&p.alive&&p.trail.length>2&&p.trail.some(i=>Math.abs(i%W-you.x)+Math.abs(Math.floor(i/W)-you.y)<=3)&&say('cut','That is an open trail. Cross it to cut '+p.tag+': your paint splashes out and banks your own loop.'))return;
  for(const b of g.city.blocks)if(b.landmark&&g.blockOwner(b)!==0&&Math.abs(b.x+1-you.x)+Math.abs(b.y+1-you.y)<=5&&say('landmark','Landmarks count as 36 blocks and pay +'+PAINT.landmarkPts+'. Loop all the way round one.'))return;
  for(const u of g.pickups)if(Math.abs(u.x-you.x)+Math.abs(u.y-you.y)<=4&&say(u.kind,u.kind==='bomb'?'Paint bomb. Grab it with your trail out and the blast closes your loop for you.':'Shield. It turns your trail into paint the next time someone cuts it.'))return;
  if(you.streak>=3)say('streak','Every loop in a row adds 10%. Bigger loops multiply too, and a close call with a rival near your trail pays half as much again.');}
 // A new match in the same city: clear the paint state.
 reset(g){this.game=g;const N=this.W*this.H;for(let i=0;i<N;i++){const o=g.owner[i];this.own[i*4]=o;this.own[i*4+1]=o;this.own[i*4+2]=0;this.own[i*4+3]=0;this.shown[i]=o;}this.ownTex.needsUpdate=true;this.later.length=0;this.origin=[];
  for(const r of this.blocks){const o=g.blockOwner(r.b);r.owner=-2;this.paintBlock(r,o,0,true);}this.intro=false;const sky=[0x070818,0x0c0622,0x04121c,0x160c05][g.league]??0x070818;this.scene.background.set(sky);this.scene.fog.color.set(sky);this.ui.podium.hidden=true;this.ui.feed.replaceChildren();this.podiumShown=false;this.camReady=false;}
 // A block changes hands: the new colour climbs it from the street, and its props follow.
 paintBlock(r,o,at,snap=false){if(r.owner===o)return;const was=r.owner;r.owner=o;const col=o>=0?this.col(o):null;
  for(const m of r.mats){const u=m.userData.u;if(was>=0&&!snap){u.uPOld.value.copy(this.col(was));u.uPOldOn.value=1;}else u.uPOldOn.value=0;if(col)u.uPCol.value.copy(col);u.uPLevel.value=col?(snap?r.height+3:-.001):-1;}
  r.level=col?(snap?r.height+3:0):-1;r.goal=col?r.height+3:-1;r.at=at;r.pending=!!col&&!snap;if(snap&&col)this.dressBlock(r,o);}
 dressBlock(r,o){r.pending=false;if(o<0)return;const c=this.col(o),tmp=this.tmpC??=new T.Color();for(const f of r.tint)f(c,o);
  const span=this.bulbAt[r.b.id];if(span){for(let i=span[0];i<span[1];i++){tmp.copy(c).multiplyScalar(i%2?2.4:1.5);this.bulbs.setColorAt(i,tmp);}this.bulbs.instanceColor.needsUpdate=true;}
  if(r.trees&&this.crowns){for(let i=r.trees[0];i<r.trees[1];i++){tmp.copy(c).multiplyScalar(.75+.25*(i%3)/2);this.crowns.setColorAt(i,tmp);}this.crowns.instanceColor.needsUpdate=true;}}
 // One DAWG per crew: yours from the Kennel, rivals as stable NPCs, each pushing a roller in its colour.
 syncCrew(g,d){const key=g.worldSeed+':'+g.players.length+':'+(d?assetKey(d):'');if(key===this.crewKey)return;this.crewKey=key;for(const c of this.crew){c.holder.removeFromParent();c.asset.dispose();}this.crew=[];const high=this.quality==='high';
  g.players.forEach((p,k)=>{const asset=createDawgAsset(k?npcDawg(p.name+' painter'):d||npcDawg('Paint crew')),box=new T.Box3().setFromObject(asset.root),tall=k?1.25:1.5,sc=tall/Math.max(.5,box.max.y-box.min.y);asset.root.scale.setScalar(sc);asset.root.position.y=-box.min.y*sc;castShadows(asset.root,this.quality);
   const holder=new T.Group(),body=new T.Group();body.add(asset.root);holder.add(body);const col=this.col(k),hot=col.clone().multiplyScalar(1.8);
   // The roller rig: a fat wet drum out front on a forked handle.
   const rig=new T.Group(),dz=.62*tall/1.5+.2,drum=new T.Mesh(new T.CylinderGeometry(.17,.17,.78,18).rotateZ(Math.PI/2),pbr({color:col,roughness:.18,metalness:.05,emissive:col,emissiveIntensity:.55,clearcoat:1},this.quality));drum.position.set(0,.17,dz);
   const steel=new T.MeshStandardMaterial({color:0xd6dbee,metalness:.9,roughness:.25}),fork=new T.Mesh(merge([new T.BoxGeometry(.04,.04,.6).translate(0,.42,.42),new T.BoxGeometry(.84,.04,.04).translate(0,.3,.72),new T.BoxGeometry(.04,.2,.04).translate(-.41,.22,.74),new T.BoxGeometry(.04,.2,.04).translate(.41,.22,.74)]),steel);fork.position.z=dz-.74;rig.add(drum,fork);body.add(rig);castShadows(rig,this.quality);
   const ring=new T.Mesh(new T.RingGeometry(.52,.64,36).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:hot.clone(),toneMapped:false,transparent:true,opacity:.9,depthWrite:false}));ring.position.y=.09;ring.renderOrder=4;holder.add(ring);
   const aura=new T.Mesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:this.glowTex,color:hot.clone(),transparent:true,opacity:k?.16:.24,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));aura.scale.setScalar(k?2.4:3.2);aura.position.y=.1;aura.renderOrder=2;holder.add(aura);holder.add(contactShadow(1.1));
   const tag=tagSprite(p.tag,p.color,!k);tag.position.y=tall+.75;holder.add(tag);
   const bubble=new T.Mesh(new T.SphereGeometry(tall*.62,20,14),new T.MeshBasicMaterial({color:new T.Color(.5,1.6,2),transparent:true,opacity:.22,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));bubble.position.y=tall*.5;bubble.visible=false;holder.add(bubble);
   if(!k&&high){const light=new T.PointLight(col,2.2,6,1.6);light.position.y=1.4;holder.add(light);}
   this.set.add(holder);this.crew.push({asset,holder,body,drum,ring,aura,tag,bubble,k,tall,x:p.x+.5,z:p.y+.5,yaw:0,scale:1,spray:0,hot});});}

 feed(html){const li=document.createElement('li');li.innerHTML=html;this.ui.feed.append(li);while(this.ui.feed.children.length>3)this.ui.feed.firstChild.remove();setTimeout(()=>li.remove(),4200);}
 event(e,g){if(!this.ready||!this.set)return;const st=this.stage,hud=this.hud,P=this.particles,rd=this.reduced,t=this.now||0,W=g.city.W,pl=k=>g.players[k],chip=k=>k<0?'':`<b style="color:${pl(k).color}">${pl(k).tag}</b>`;
  const dissolve=(cells,col)=>{cells.forEach((i,n)=>{if(n%2&&cells.length>24)return;const x=i%W;this.later.push({t:t+n*.012,x:x+.5,z:(i-x)/W+.5,n:4,col,up:2.4,speed:1.6});});};
  if(e.type==='claim'){this.origin[e.k]={x:e.x,y:e.y,t};const col=pl(e.k).color,n=e.gained.length,stepN=Math.max(1,Math.floor(n/(rd?5:this.quality==='high'?22:10)));
   for(let j=0;j<n;j+=stepN){const i=e.gained[j],x=i%W,y=(i-x)/W,d=Math.hypot(x-e.x,y-e.y);this.later.push({t:t+Math.min(1,d*FLOOD),x:x+.5,z:y+.5,n:e.you?7:4,col,up:3.2,speed:2.4});}
   P.burst(e.x+.5,.3,e.y+.5,e.you?46:18,col,{speed:5,life:.7,up:3});
   if(e.you){hud.pop('+'+e.pts.toLocaleString(),'gold');if(e.tier)hud.banner(TIERS[e.tier].name+(e.close?' · CLOSE CALL':'')+(e.streak>2?' · STREAK ×'+Math.min(10,e.streak):''));else if(e.close)hud.pop('CLOSE CALL ×1.5','dodge');if(e.captured)hud.banner('CAPTURED · +'+PAINT.capturePts*e.captured);if(e.landmarks.length){hud.banner('LANDMARK PAINTED · +'+PAINT.landmarkPts);st.flashOnce(0xffd23e,.3,rd);}else if(e.blocks.length&&!e.tier)hud.pop('BUILDING PAINTED','shield');
    this.punch=Math.min(1,.25+e.tier*.25+(e.captured?.4:0));st.flashOnce(pl(0).color,.1+e.tier*.06,rd);if(e.tier>=2)st.shake(.35);}
   else if(e.landmarks.length)this.feed(chip(e.k)+' painted a landmark');}
  else if(e.type==='splash'){this.origin[e.k]={x:e.x,y:e.y,t};const col=pl(e.k).color;P.burst(e.x+.5,.4,e.y+.5,e.why==='bomb'?90:50,col,{speed:e.why==='bomb'?8:6,life:.9,up:4.5});P.burst(e.x+.5,.4,e.y+.5,20,'#ffffff',{speed:4,life:.4,up:3});if(e.why==='bomb'){st.shake(e.you?.6:.25);if(e.you){st.flashOnce(col,.3,rd);hud.banner('PAINT BOMB');this.punch=.8;}}}
  else if(e.type==='cut'){const v=pl(e.victim);P.burst(e.x+.5,.6,e.y+.5,60,v.color,{speed:6,life:.8,up:4});dissolve(e.trail,v.color);
   if(e.you){hud.banner('CUT '+v.tag+' · +'+PAINT.cutPts);st.flashOnce(0xffffff,.32,rd);st.shake(.5);this.punch=1;}else if(e.onYou){st.shake(.9);st.flashOnce(0xff2244,.5,rd);hud.banner('CUT BY '+pl(e.k).tag);}this.feed(chip(e.k)+' cut '+chip(e.victim));}
  else if(e.type==='pop'){const v=pl(e.victim);P.burst(e.x+.5,.6,e.y+.5,40,v.color,{speed:4.5,life:.7,up:3});dissolve(e.trail,v.color);if(e.onYou){st.shake(.7);st.flashOnce(0xff2244,.45,rd);hud.banner('YOU CROSSED YOUR OWN TRAIL');}}
  else if(e.type==='capture'){const v=pl(e.victim);P.burst(e.x+.5,.6,e.y+.5,70,v.color,{speed:6,life:.9,up:5});dissolve(e.trail,v.color);if(e.onYou){st.shake(.9);st.flashOnce(0xff2244,.5,rd);hud.banner('SURROUNDED BY '+pl(e.k).tag);}else if(e.you){st.flashOnce(0xffffff,.35,rd);st.shake(.5);}this.feed(chip(e.k)+' captured '+chip(e.victim));}
  else if(e.type==='wipe'){if(e.onYou)hud.banner('PAINTED OUT OF TOWN');else this.feed(chip(e.victim)+' was painted out of town');}
  else if(e.type==='shield'){this.origin[e.k]={x:e.x,y:e.y,t};P.burst(e.x+.5,.8,e.y+.5,50,'#7ff3ff',{speed:5,life:.6,up:2});if(e.onYou){hud.banner('SHIELD SAVED YOUR TRAIL');st.flashOnce(0x7ff3ff,.3,rd);}else if(e.you)hud.pop('SHIELDED','shield');}
  else if(e.type==='respawn'){this.origin[e.k]={x:e.x,y:e.y,t};const c=this.crew[e.k];if(c){c.x=e.x+.5;c.z=e.y+.5;c.scale=0;}P.burst(e.x+.5,.4,e.y+.5,30,pl(e.k).color,{speed:3,life:.6,up:3});if(!e.k)st.flashOnce(pl(0).color,.18,rd);}
  else if(e.type==='pickup'){P.burst(e.x+.5,.7,e.y+.5,26,e.kind==='bomb'?'#ffffff':'#7ff3ff',{speed:4,life:.5,up:3});if(e.you&&e.kind==='shield')hud.banner('SHIELD UP');else if(!e.you)this.feed(chip(e.k)+(e.kind==='bomb'?' set off a paint bomb':' picked up a shield'));}
  else if(e.type==='drop'){P.burst(e.x+.5,2.5,e.y+.5,16,e.kind==='bomb'?'#ffd23e':'#7ff3ff',{speed:2,life:.7,up:-2,gravity:-9});}
  else if(e.type==='dash'){const c=this.crew[e.k];if(c)P.burst(c.x,.5,c.z,e.you?26:12,'#ffffff',{speed:3.5,life:.35,up:1});if(e.you)this.punch=Math.max(this.punch,.5);}
  else if(e.type==='feat'){const f=FEATS.find(f=>f.id===e.id);if(f){const el=this.ui.feat;el.textContent='FEAT · '+f.name.toUpperCase()+' · '+f.text;el.hidden=false;el.classList.remove('pt-show');void el.offsetWidth;el.classList.add('pt-show');clearTimeout(this.featTimer);this.featTimer=setTimeout(()=>{el.hidden=true;},3600);st.flashOnce(0xffd23e,.16,rd);}}
  else if(e.type==='underdog'){if(e.you)hud.banner('UNDERDOG BOOST · FASTER, QUICKER DASH');}
  else if(e.type==='clock')hud.pop(String(Math.ceil(e.left)),'big');
  else if(e.type==='stage'){hud.banner(e.name);st.flashOnce(e.stage===3?0xff3d6e:0x5ee7ff,.22,rd);}
  else if(e.type==='slide'){P.burst(e.x+.5,.2,e.y+.5,6,g.you.color,{speed:1.6,life:.3});}
  else if(e.type==='whistle'){st.shake(.4);st.flashOnce(0xffffff,.4,rd);this.showPodium(g,e);}}
 showPodium(g,e){this.podiumShown=true;const top=e.standings[0].share||1,el=this.ui.podium;
  el.innerHTML=`<h3>${e.place===1?'THE TOWN IS YOURS':PLACE[e.place]+' PLACE'}</h3>`+e.standings.map(s=>`<div class="pt-row${s.k?'':' pt-me'}"><i>${s.place}</i><b style="color:${s.color}">${s.tag}</b><span><u style="width:${Math.max(3,s.share/top*100).toFixed(1)}%;background:${s.color}"></u></span><em>${Math.round(s.share*100)}%</em></div>`).join('');el.hidden=false;}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<4000));return true;}
 // The ownership texture follows the engine: a cell that changed hands is revealed when the
 // flood from the last loop, splash or respawn of that crew reaches it. Blocks follow their cells.
 syncGround(g,t){const W=this.W,N=W*this.H,own=this.own;let dirty=false;
  for(let i=0;i<N;i++){const o=g.owner[i];if(o===this.shown[i])continue;const src=o>=0?this.origin[o]:null,x=i%W,y=(i-x)/W,delay=src&&t-src.t<.3?Math.min(1.1,Math.hypot(x-src.x,y-src.y)*FLOOD):0;
   own[i*4+1]=this.shown[i];own[i*4]=o;own[i*4+2]=Math.max(.002,t+delay);this.shown[i]=o;dirty=true;}
  if(dirty)this.ownTex.needsUpdate=true;
  for(const r of this.blocks){const o=g.blockOwner(r.b);if(o!==r.owner){const src=o>=0?this.origin[o]:null,delay=src&&t-src.t<.3?Math.min(1.1,Math.hypot(r.b.x+r.b.w/2-src.x,r.b.y+r.b.h/2-src.y)*FLOOD):0;this.paintBlock(r,o,t+delay);}
   if(r.level<r.goal&&t>=r.at){if(r.pending)this.dressBlock(r,r.owner);r.level=Math.min(r.goal,r.level+(this.dt||.016)*(1.6+r.height*.9));for(const m of r.mats)m.userData.u.uPLevel.value=r.level;}}}
 // Open trails as wet ribbons: square-jointed quads through the trail cells, ending at the roller.
 syncRibbons(g,t){g.players.forEach((p,k)=>{const rb=this.ribbons[k],c=this.crew[k];if(!rb||!c)return;const n=p.trail.length,W=this.W,pos=rb.pos;let q=0;
   if(n&&p.alive){const pts=[];if(n===1)pts.push(p.px+.5,p.py+.5);for(let i=0;i<n-1;i++){const j=p.trail[i],x=j%W;pts.push(x+.5,(j-x)/W+.5);}pts.push(c.x,c.z);const hw=k?.19:.23;
    for(let i=0;i+3<pts.length&&q<rb.Q;i+=2){let ax=pts[i],az=pts[i+1],bx=pts[i+2],bz=pts[i+3],dx=bx-ax,dz=bz-az;const L=Math.hypot(dx,dz);if(L<.001)continue;dx/=L;dz/=L;ax-=dx*hw;az-=dz*hw;bx+=dx*hw;bz+=dz*hw;const px=-dz*hw,pz=dx*hw;pos.set([ax+px,.06,az+pz,ax-px,.06,az-pz,bx+px,.06,bz+pz,bx-px,.06,bz-pz],q*12);q++;}
    rb.mesh.geometry.attributes.position.needsUpdate=true;}
   rb.mesh.geometry.setDrawRange(0,q*6);const warn=!k&&this.warn&&Math.sin(t*20)>0;rb.mesh.material.color.copy(warn?this.warnCol??=new T.Color(3,.5,.6):rb.base).multiplyScalar(this.reduced?1:.85+.15*Math.sin(t*9+k));});}
 syncPickups(g,t){const live=new Set(g.pickups.map(u=>u.id));for(const [id,o] of this.pickups)if(!live.has(id)){o.visible=false;this.pickPool.push(o);this.pickups.delete(id);}
  for(const u of g.pickups){let o=this.pickups.get(u.id);if(!o){o=this.pickPool.pop()||this.makePickup();this.pickups.set(u.id,o);o.visible=true;o.userData.bomb.visible=u.kind==='bomb';o.userData.shield.visible=u.kind==='shield';o.userData.ring.material.color.copy(u.kind==='bomb'?this.bombCol??=new T.Color(2.2,1.7,.5):this.shieldCol??=new T.Color(.5,1.8,2.2));o.userData.beam.material.uniforms.uColor.value.set(u.kind==='bomb'?0xffd23e:0x7ff3ff);o.position.set(u.x+.5,0,u.y+.5);o.userData.born=t;}
   const d=o.userData,k=Math.min(1,(t-d.born)*3),bob=this.reduced?0:Math.sin(t*3+u.id)*.1;d.float.position.y=.75+bob+(1-k)*3;d.float.rotation.y=t*1.6;d.float.scale.setScalar(.4+.6*k);d.ring.scale.setScalar(1+(this.reduced?0:.18*Math.sin(t*5+u.id)));}}
 makePickup(){const o=new T.Group(),fl=new T.Group(),q=this.quality;
  const can=texture(128,64,(c,w,h)=>{c.fillStyle='#16182a';c.fillRect(0,0,w,h);['#ff4fd8','#3fd8ff','#a8ff4a','#ffd23e'].forEach((col,i)=>{c.fillStyle=col;c.fillRect(i*32,14,32,36);});c.fillStyle='#fff';c.fillRect(0,12,w,3);c.fillRect(0,49,w,3);});
  const bomb=new T.Group(),body=new T.Mesh(new T.SphereGeometry(.34,18,14),pbr({map:can,emissiveMap:can,emissive:0xffffff,emissiveIntensity:.9,roughness:.25,metalness:.2,clearcoat:1},q)),cap=new T.Mesh(new T.CylinderGeometry(.1,.12,.14,10),new T.MeshStandardMaterial({color:0xd6dbee,metalness:.9,roughness:.3}));cap.position.y=.36;const spark=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(3,2,.6),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));spark.scale.setScalar(.5);spark.position.y=.5;bomb.add(body,cap,spark);
  const shield=new T.Group(),gem=new T.Mesh(new T.OctahedronGeometry(.36,0),pbr({color:0x7ff3ff,emissive:0x35d6ff,emissiveIntensity:1.6,roughness:.1,metalness:.3,clearcoat:1},q)),halo=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(.6,2,2.4),transparent:true,opacity:.7,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));halo.scale.setScalar(1.3);gem.scale.set(1,1.25,.6);shield.add(gem,halo);
  fl.add(bomb,shield);const ring=new T.Mesh(new T.RingGeometry(.5,.6,28).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(2,2,2),toneMapped:false,transparent:true,opacity:.9,depthWrite:false}));ring.position.y=.09;ring.renderOrder=4;
  const beam=lightShaft(0xffffff,{length:6,radius:.5,top:.3,opacity:.28,fade:[30,90]});beam.rotation.x=Math.PI;beam.position.y=.1;o.add(fl,ring,beam);o.userData={float:fl,bomb,shield,ring,beam,born:0};this.set.add(o);return o;}
 render(g,d,now){
  this.stage.resize();const dt=this.dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const t=this.now=(now-this.t0)/1000,reduced=this.reduced,{W,H}=g.city;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  if(g.worldSeed!==this.seed||g.players.length!==this.ribbons?.length)this.build(g);else if(g!==this.game)this.reset(g);this.syncCrew(g,d||this.dawg);
  const live=g.status==='playing'&&g.phase==='play',frozen=g.freeze>0,you=g.you;this.gu.uTime.value=t;
  this.warn=live&&g.trailThreat()<=5;this.syncGround(g,t);this.syncPickups(g,t);
  // Crews: glide between cells on the engine's own progress, lean into turns, spray behind the roller.
  g.players.forEach((p,k)=>{const c=this.crew[k];if(!c)return;const tx=p.px+(p.x-p.px)*Math.min(1,p.prog)+.5,tz=p.py+(p.y-p.py)*Math.min(1,p.prog)+.5,jump=Math.abs(tx-c.x)+Math.abs(tz-c.z)>3,f=jump?1:Math.min(1,dt*(live?22:8));c.x+=(tx-c.x)*f;c.z+=(tz-c.z)*f;
   const [dx,dz]=DIRS[p.dir],yaw=Math.atan2(dx,dz);let dy=yaw-c.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));c.yaw+=dy*Math.min(1,dt*16);
   c.holder.visible=p.alive;c.scale+=(1-c.scale)*Math.min(1,dt*7);c.holder.scale.setScalar(Math.max(.01,c.scale));c.holder.position.set(c.x,0,c.z);c.body.rotation.y=c.yaw;c.body.rotation.z=reduced?0:-dy*.35;c.body.position.y=p.dash>0?.08:0;
   const moving=live&&p.alive&&!frozen;if(moving)c.drum.rotation.x+=dt*(p.dash>0?30:13);setDawgPose(c.asset,t*(p.dash>0?1.5:1)+k,moving?'run':'idle');
   if(!reduced){c.ring.material.opacity=.65+Math.sin(t*5+k)*.3;c.ring.scale.setScalar(1+.08*Math.sin(t*5+k));}c.bubble.visible=p.shield;if(p.shield)c.bubble.scale.setScalar(1+.05*Math.sin(t*7));
   c.tag.visible=p.alive&&(k>0||g.status!=='playing'||g.time<3);
   // Spray: a wet mist off the roller while a trail is out, heavier in a dash.
   if(moving&&!reduced){c.spray+=dt*(p.dash>0?70:p.trail.length?(k?12:30):k?0:6);while(c.spray>=1){c.spray-=1;this.particles.burst(c.x-dx*.3+(Math.random()-.5)*.5,.12,c.z-dz*.3+(Math.random()-.5)*.5,1,p.dash>0&&Math.random()<.4?'#ffffff':p.color,{speed:1.3,life:.45,up:1.4,gravity:-4});}}});
  const ring=this.crew[0]?.ring;if(ring)ring.material.color.copy(this.warn&&Math.sin(t*18)>0?this.warnCol??=new T.Color(3,.5,.6):this.crew[0].hot);
  this.syncRibbons(g,t);
  for(const m of this.homeMarks)m.rotation.y=t*.4;
  for(const r of this.blocks){if(r.spin&&!reduced)r.spin.rotation.y=t*.5;if(r.jet&&!reduced&&Math.random()<.5)this.particles.burst(r.jet[0],r.jet[1],r.jet[2],1,r.owner>=0?g.players[r.owner].color:'#7fe9ff',{speed:1.5,life:.8,up:3.4,gravity:-8});}
  // Timed splashes riding the flood front.
  if(this.later.length){const keep=[];for(const b of this.later){if(b.t<=t)this.particles.burst(b.x,.12,b.z,b.n,b.col,{speed:b.speed,life:.55,gravity:-6,up:b.up});else keep.push(b);}this.later=keep;}
  // Camera: close on you; while a trail is out it pulls back to frame the loop; at the whistle (and
  // before the start) it rises over the whole city.
  const me=this.crew[0]||{x:W/2,z:H/2},cam=this.camera,aspect=cam.aspect||1,vf=FOV*Math.PI/180,hHalf=Math.atan(Math.tan(vf/2)*aspect);let wantW=aspect<1?4.4:6,wantD=aspect<1?6:3.8,cx=me.x,cz=me.z;
  const wide=g.status==='ready'||g.phase==='podium'||g.status==='over';
  if(wide){wantW=W/2+1.5;wantD=H/2+1.5;cx=W/2;cz=H/2+(aspect<1?1:0);}
  else if(you.trail.length>1&&you.alive){let x0=me.x,x1=me.x,z0=me.z,z1=me.z;for(const i of you.trail){const x=i%W+.5,z=(i-i%W)/W+.5;if(x<x0)x0=x;if(x>x1)x1=x;if(z<z0)z0=z;if(z>z1)z1=z;}wantW=Math.min(aspect<1?8:11,Math.max(wantW+1,(x1-x0)/2+3));wantD=Math.min(aspect<1?10.5:7,Math.max(wantD+1,(z1-z0)/2+3.4));cx=me.x*.55+(x0+x1)/2*.45;cz=me.z*.55+(z0+z1)/2*.45;}
  else{const [dx,dz]=DIRS[you.dir];cx+=dx*1.1;cz+=dz*1.1-(aspect<1?.6:.2);}
  if(!wide){const mx=Math.min(W/2,wantW*.72),mz=Math.min(H/2,wantD*.62);cx=Math.max(mx,Math.min(W-mx,cx));cz=Math.max(mz,Math.min(H-mz*.7,cz));}
  const zf=Math.min(1,dt*(wide?1.6:2.6));this.zoom.w+=(wantW-this.zoom.w)*zf;this.zoom.d+=(wantD-this.zoom.d)*zf;this.focus.x+=(cx-this.focus.x)*Math.min(1,dt*(wide?2:5));this.focus.z+=(cz-this.focus.z)*Math.min(1,dt*(wide?2:5));if(!this.camReady){this.camReady=true;this.focus.set(cx,0,cz);this.zoom.w=wantW;this.zoom.d=wantD;}
  const pitch=wide?1.25:PITCH,dist=Math.max(this.zoom.w/Math.tan(hHalf),this.zoom.d*Math.sin(pitch)/Math.tan(vf/2))*(1-.06*this.punch);this.punch=Math.max(0,this.punch-dt*2.2);
  const at=this.atV??=new T.Vector3(),pos=this.posV??=new T.Vector3();at.set(this.focus.x,.4,this.focus.z);pos.set(at.x,at.y+Math.sin(pitch)*dist,at.z+Math.cos(pitch)*dist);
  this.rig.update(dt,{pos,at},null,{follow:wide?3:9});this.stage.applyShake(t*3,reduced);this.rig.aim();cam.fov=FOV;cam.near=.5;cam.far=260;cam.updateProjectionMatrix();this.stage.followSun?.(this.key,this.focus.x,0,this.focus.z);
  // A building between the camera and your DAWG ducks down so you are never hidden behind it.
  const back=Math.cos(pitch)/Math.sin(pitch);for(const r of this.blocks){if(!r.group)continue;const b=r.b,hide=!wide&&you.alive&&me.x>b.x-.5&&me.x<b.x+b.w+.5&&me.z<b.y+.4&&me.z>b.y-r.height*back-1.4,goal=hide?.16:1;if(r.fade!==goal){r.fade+=(goal-r.fade)*Math.min(1,dt*9);if(Math.abs(r.fade-goal)<.01)r.fade=goal;r.group.scale.y=r.fade;}}
  this.drawHud(g,t,now,live);
  this.particles.update(frozen?0:dt,{x:0,y:0,z:0});this.hud.live(g.status==='playing');this.stage.render(dt,t,{reduced,aberration:.0011});
 }
 drawHud(g,t,now,live){const left=g.left,you=g.you,shares=g.shares(),order=g.rank(),ui=this.ui,hud=this.hud;
  hud.set(ui.time,'t',Math.floor(Math.ceil(left)/60)+':'+String(Math.ceil(left)%60).padStart(2,'0'));ui.time.classList.toggle('pt-late',left<=10&&left>0);hud.set(ui.stage,'s',STAGES[g.stage].name+' · '+LEAGUES[g.league].name);
  if(live&&!this.intro&&g.time<2){this.intro=true;const tw=g.twist;hud.banner(tw?'TODAY · '+tw.name:LEAGUES[g.league].name+' LEAGUE');this.tip(tw?tw.text+' Loop out of your colour and back to flood everything inside.':g.league?LEAGUES[g.league].twist+' Points ×'+LEAGUES[g.league].mult+'.':'Leave your colour, loop back, and everything inside floods. Circle a building and it is yours.',7000);}
  if(live&&now-(this.lastCoach||0)>300){this.lastCoach=now;this.coach(g);}
  const board=order.map(p=>p.k+':'+Math.round(shares[p.k]*100)+(p.alive?'':'x')).join(',')+'|'+g.dog;if(hud.cache.board!==board){hud.cache.board=board;ui.board.innerHTML=order.map(p=>`<li class="${p.k?'':'pt-me'}${p.alive?'':' pt-out'}"><i style="background:${p.color}"></i><b>${p.tag}</b><em>${Math.round(shares[p.k]*100)}%</em>${g.dog===p.k?'<u>▲</u>':''}</li>`).join('');}
  const bar=g.players.map(p=>Math.round(shares[p.k]*1000)).join(',');if(hud.cache.bar!==bar){hud.cache.bar=bar;ui.share.innerHTML=order.map(p=>`<i style="flex:${Math.max(0,shares[p.k])} 0 0;background:${p.color}"></i>`).join('')+`<i style="flex:${Math.max(0,1-shares.reduce((a,b)=>a+b,0))} 0 0"></i>`;}
  const cool=you.cool/(PAINT.dashCool*PAINT.tps),dk=Math.round((1-Math.min(1,cool))*40);if(hud.cache.dk!==dk){hud.cache.dk=dk;ui.dashFill.style.transform=`scaleX(${dk/40})`;ui.dash.classList.toggle('pt-ready',dk>=40);}
  if(ui.shield.hidden===you.shield)ui.shield.hidden=!you.shield;const streak=you.streak>1?(you.streak>=10?'STREAK MAX · +100%':'STREAK ×'+you.streak+' · +'+you.streak*10+'%'):'';if(hud.cache.streak!==streak){hud.cache.streak=streak;ui.streak.textContent=streak;ui.streak.hidden=!streak;}const dog=g.dog===0;if(ui.dog.hidden===dog)ui.dog.hidden=!dog;
  if(ui.warn.hidden===this.warn)ui.warn.hidden=!this.warn;if(this.tipUntil&&now>this.tipUntil){ui.tip.hidden=true;this.tipUntil=0;}if(this.podiumShown&&g.phase==='play'&&g.status!=='over'){ui.podium.hidden=true;this.podiumShown=false;}
  if(now-this.lastMap>90){this.lastMap=now;this.drawMap(g,t);}}
 // The tactical map: soft-edged territory, blocks in their owner's colour, trails, pickups,
 // landmarks, every crew, and a red ping on anyone closing on your open trail.
 drawMap(g,t){const c=this.mapCtx,{W,H,walls,blocks}=g.city,S=6,cw=W*S,ch=H*S;if(!this.mapSrc){this.mapSrc=document.createElement('canvas');this.mapSrc.width=W;this.mapSrc.height=H;this.mapImg=this.mapSrc.getContext('2d').createImageData(W,H);this.rgb=g.players.map(p=>{const col=new T.Color(p.color);return [col.r,col.g,col.b].map(v=>Math.round(Math.pow(v,1/2.2)*255));});}
  const px=this.mapImg.data;for(let i=0;i<W*H;i++){const o=g.owner[i];if(o>=0){const [r,gg,b]=this.rgb[o]||this.rgb[0];px[i*4]=r;px[i*4+1]=gg;px[i*4+2]=b;px[i*4+3]=walls[i]?255:205;}else{px[i*4]=20;px[i*4+1]=23;px[i*4+2]=38;px[i*4+3]=255;}}
  this.mapSrc.getContext('2d').putImageData(this.mapImg,0,0);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.fillStyle='#0a0c18';c.fillRect(0,0,cw,ch);c.drawImage(this.mapSrc,0,0,cw,ch);
  for(const b of blocks){c.strokeStyle='#05060dcc';c.lineWidth=1.5;c.beginPath();c.roundRect(b.x*S+1,b.y*S+1,b.w*S-2,b.h*S-2,3);c.stroke();if(g.blockOwner(b)<0){c.fillStyle=b.landmark?'#4a4066':'#343a55';c.fill();}
   if(b.landmark){c.fillStyle='#ffe9a8';c.font='900 13px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('★',(b.x+b.w/2)*S,(b.y+b.h/2)*S+1);}}
  for(const p of g.players){if(!p.trail.length)continue;c.strokeStyle=p.k?p.color:'#fff';c.lineWidth=p.k?2:2.6;c.lineJoin='round';c.beginPath();p.trail.forEach((i,n)=>{const x=(i%W+.5)*S,y=(Math.floor(i/W)+.5)*S;n?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();}
  for(const u of g.pickups){const x=(u.x+.5)*S,y=(u.y+.5)*S;c.fillStyle=u.kind==='bomb'?'#ffd23e':'#7ff3ff';c.strokeStyle='#05060d';c.lineWidth=1.5;c.beginPath();c.moveTo(x,y-5);c.lineTo(x+5,y);c.lineTo(x,y+5);c.lineTo(x-5,y);c.closePath();c.fill();c.stroke();}
  const you=g.you;for(const p of g.players){if(!p.alive)continue;const x=(p.x+.5)*S,y=(p.y+.5)*S;if(p.k){let near=1e9;if(you.alive)for(const i of you.trail){const d=Math.abs(i%W-p.x)+Math.abs(Math.floor(i/W)-p.y);if(d<near)near=d;}if(near<=6){const k=(t*1.6)%1;c.strokeStyle=`rgba(255,60,90,${1-k})`;c.lineWidth=2.5;c.beginPath();c.arc(x,y,5+k*14,0,7);c.stroke();}
    c.fillStyle=p.color;c.strokeStyle='#05060d';c.lineWidth=2;c.beginPath();c.arc(x,y,4.2,0,7);c.fill();c.stroke();}
   else{const k=.5+.5*Math.sin(t*6);c.strokeStyle='#ffffff';c.lineWidth=2;c.beginPath();c.arc(x,y,7+k*3,0,7);c.stroke();c.fillStyle=p.color;c.strokeStyle='#05060d';c.beginPath();c.arc(x,y,5,0,7);c.fill();c.stroke();const [dx,dy]=DIRS[p.dir];c.fillStyle='#fff';c.beginPath();c.arc(x+dx*7,y+dy*7,2,0,7);c.fill();}}}
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;clearTimeout(this.featTimer);this.ambient?.stop();this.hud?.dispose();for(const c of this.crew)try{c.asset.dispose();}catch{}this.stage?.dispose();}
}
