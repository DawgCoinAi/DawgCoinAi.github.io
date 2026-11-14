// Three.js presentation for Flappy DAWG: a jetpack flight down a skyline, high above the street.
// FlappyGame owns every rule in its 420×560 logical field; this module only reads it.
// Each gate is one skyscraper with a sky-gap cut through it, trimmed in neon. Third person is the
// classic side-on read of the field with real depth behind it; first person is a helmet camera
// behind DAWG's ears with a side-on radar, a ghost of the arc ahead and climb / drop cues.
// The sky changes every eight gates: golden hour, neon night, a storm, then fireworks.
// Field pixels become meters at 30 px per meter: x → world x, (520 − y) → world y, depth is z.
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,quality,fitFov,merge,texture,radial,glowStops,skylineTexture,skyMaterial,buildingShells,facadeMaterials,signMaterials,lightShaft,Stage,Particles,CameraRig,Hud,AmbientLoop} from './three-kit.js';
import {heatLabel} from './difficulty.js';
import {hash} from './world.js';
import {FLAPPY,FLAPPY_FEATS} from './pack-engine.js';

export const PX=30;
export const fieldToWorld=(x,y)=>({x:x/PX,y:(520-y)/PX});
const SKY_LIMIT=(520-10)/PX,MID=260/PX,STREET_Y=-30,BACK=-3.4,FRONT=1.3;
const hdr=(hex,k=1)=>new T.Color(hex).multiplyScalar(k);
// Sky, light and haze per zone. Everything in the scene leans toward the current look.
const LOOK_KEYS=['top','horizon','glow','fog','sun','hemi','ground','cloud','lip'];
const LOOKS=[
 {top:0x2a4d9c,horizon:0xff9548,glow:0xffd58a,fog:0xe09464,dens:.013,sun:0xffb36b,sunK:3.4,hemi:0xffdcb8,ground:0x6a4660,hemiK:1.15,win:.3,cloud:0xffc59a,stars:0,lip:0x8dff3a},
 {top:0x060920,horizon:0x4a1f86,glow:0xff4fc0,fog:0x1c1446,dens:.012,sun:0x9fb8ff,sunK:1.3,hemi:0x93a8ff,ground:0x24163a,hemiK:.85,win:1.05,cloud:0x5a4aa0,stars:1,lip:0x4dfff0},
 {top:0x070b12,horizon:0x2c3a48,glow:0x6f93aa,fog:0x1b252f,dens:.018,sun:0xa9bccb,sunK:.9,hemi:0x9fb4c4,ground:0x1a2028,hemiK:.75,win:.85,cloud:0x39454f,stars:0,lip:0xffe14d},
 {top:0x040716,horizon:0x1d2f7a,glow:0xffb43a,fog:0x10163c,dens:.011,sun:0xbfd0ff,sunK:1.5,hemi:0xa8b8ff,ground:0x2a1c3c,hemiK:.9,win:1.15,cloud:0x44559a,stars:1,lip:0xff7ad9}
].map(l=>{const o={...l};for(const k of LOOK_KEYS)o[k]=hdr(l[k]);return o;});
const TOWERS=[['#2c8f98','#0f3f52'],['#c9603f','#5a2230'],['#6a4cc4','#27175c'],['#c29a35','#5a3c14']];
// One 256×512 tile covers 4 × 8 m of curtain wall; the emissive copy holds only the lit windows.
const wall=(v,lit)=>texture(256,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,lit?'#000':TOWERS[v][0]);g.addColorStop(1,lit?'#000':TOWERS[v][1]);c.fillStyle=g;c.fillRect(0,0,w,h);
 for(let y=0;y<16;y++)for(let x=0;x<8;x++){const r=hash(v*71+9,y*8+x),on=r>.48;if(lit&&!on)continue;c.fillStyle=on?(r>.9?'#bff6ff':'#ffe2ad'):'#0a1322cc';c.globalAlpha=lit?.5+r*.5:on?.9:.55;c.fillRect(x*32+5,y*32+7,22,19);}c.globalAlpha=1;
 if(!lit){c.fillStyle='#ffffff30';for(let y=0;y<16;y++)c.fillRect(0,y*32,w,2);c.fillStyle='#00000038';for(let x=0;x<8;x++)c.fillRect(x*32,0,2,h);}},{repeat:true});
// A box whose UVs are in tiles of 4 × 8 m, so windows keep their size on every tower.
function metricBox(w,h,d){const g=new T.BoxGeometry(w,h,d),uv=g.attributes.uv,n=g.attributes.normal;for(let k=0;k<uv.count;k++){const side=Math.abs(n.getX(k))>.5,top=Math.abs(n.getY(k))>.5;uv.setXY(k,uv.getX(k)*(side?d:w)/4,uv.getY(k)*(top?d:h)/8);}return g;}
const chevrons=()=>texture(128,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#fff';c.lineWidth=15;c.lineCap='round';c.lineJoin='round';for(const y of [14,62]){c.beginPath();c.moveTo(22,y);c.lineTo(64,y+40);c.lineTo(106,y);c.stroke();}},{repeat:true});
const cloudTex=()=>texture(256,128,(c,w,h)=>{for(let i=0;i<16;i++){const x=40+hash(61,i)*176,y=44+hash(62,i)*44,r=22+hash(63,i)*30,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#ffffffcc');g.addColorStop(.6,'#ffffff44');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,w,h);}});
const boltTex=()=>texture(64,256,(c,w,h)=>{c.strokeStyle='#fff';c.shadowColor='#bfe0ff';c.shadowBlur=12;c.lineWidth=4;c.beginPath();let x=32;c.moveTo(x,0);for(let y=20;y<=h;y+=20){x=Math.max(8,Math.min(56,x+(hash(77,y)-.5)*34));c.lineTo(x,y);}c.stroke();});
const STYLE=`.flappy3d .f3-zone{position:absolute;left:18px;top:calc(var(--d3-top) + clamp(38px,6vw,66px));font:800 10px var(--mono);letter-spacing:2px;color:#fff;text-shadow:0 1px 6px #000,0 1px 0 #000}
.flappy3d .f3-fp{position:absolute;left:50%;top:var(--d3-top);transform:translateX(-50%);padding:5px 12px;border-radius:999px;background:#0b0a16c8;border:1px solid #5ee7ff88;color:#c8f8ff;font:800 11px var(--mono);letter-spacing:2px;box-shadow:0 0 18px #5ee7ff44;white-space:nowrap}
.flappy3d .f3-radar{position:absolute;left:14px;top:calc(var(--d3-top) + clamp(60px,9vw,92px));width:clamp(150px,34vmin,250px);height:auto;border-radius:12px;border:1px solid #5ee7ff77;background:#060a18d9;box-shadow:0 0 24px #000a}
.flappy3d .f3-cue{position:absolute;left:50%;transform:translateX(-50%);padding:8px 18px;border-radius:999px;font:900 clamp(15px,3vw,24px)/1 var(--display);letter-spacing:2px;color:#07110a;background:#b9ff5e;box-shadow:0 0 26px #b9ff5eaa;white-space:nowrap}
.flappy3d .f3-cue[data-dir=up]{top:20%}.flappy3d .f3-cue[data-dir=down]{bottom:24%;background:#5ee7ff;box-shadow:0 0 26px #5ee7ffaa}.flappy3d .f3-cue[data-hot="1"]{background:#ff5470;color:#fff;box-shadow:0 0 30px #ff5470cc}
.flappy3d .f3-tip{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + var(--d3-bottom) + 96px);transform:translateX(-50%);max-width:82%;padding:8px 14px;border-radius:12px;background:#0b0a16d9;border:1px solid #ffd25e88;color:#ffe9b0;font:700 12px/1.35 var(--mono);text-align:center}
.flappy3d .f3-dive{position:absolute;right:14px;bottom:calc(env(safe-area-inset-bottom) + var(--d3-bottom) + 84px);width:84px;height:84px;border-radius:50%;border:2px solid #5ee7ffaa;background:#07101cd9;color:#dffaff;font:900 14px var(--display);letter-spacing:1px;pointer-events:auto;touch-action:none;cursor:pointer;box-shadow:0 0 22px #5ee7ff55;--cd:0;background-image:conic-gradient(#5ee7ff55 calc(var(--cd)*360deg),#0000 0)}
.flappy3d .f3-dive small{display:block;font:700 9px var(--mono);letter-spacing:1px;opacity:.8}.flappy3d .f3-dive[data-ready="0"]{opacity:.55}
@media (max-width:520px){.flappy3d .f3-fp{left:12px;transform:none;top:auto;bottom:calc(env(safe-area-inset-bottom) + var(--d3-bottom) + 150px);font-size:9px}}
.flappy3d [hidden]{display:none!important}@media (pointer:fine){.flappy3d .f3-dive{width:64px;height:64px;font-size:12px}}`;

export class ThreeFlappy {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.cameraMode='third';this.clock=performance.now();this.status='';this.statusSince=performance.now();this.asset=null;this.assetKey='';this.gates=new Map();this.free=[];this.travel=0;this.deadT=0;this.fall=0;this.spin=0;this.flapT=1;this.hist=[];this.look={...LOOKS[0]};for(const k of LOOK_KEYS)this.look[k]=LOOKS[0][k].clone();this.fwT=0;this.boltT=9;this.nextBolt=3;this.tips={};this.tipT=0;}
 async init(){
  if(!document.querySelector('style#f3-style')){const st=document.createElement('style');st.id='f3-style';st.textContent=STYLE;document.head.append(st);}
  this.stage=new Stage({quality:this.quality,className:'dash3d flappy3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="d3-meter"><b class="d3-dist">0</b><small>GATES</small></div><div class="f3-zone"></div><div class="d3-gold"><i></i><b>0</b></div><div class="d3-combo" hidden><b>×2</b><small>PERFECT STREAK</small></div><div class="f3-fp" hidden>HELMET CAM · SCORE ×'+FLAPPY.firstPerson+'</div><canvas class="f3-radar" width="300" height="190" hidden aria-hidden="true"></canvas><div class="f3-cue" hidden></div><div class="f3-tip" hidden></div><button class="f3-dive" type="button" data-flappy="down" aria-label="Dive">DIVE<small>↓ / S</small></button>');this.view.append(this.hud.root);
  this.ui={gates:this.hud.q('.d3-dist'),gold:this.hud.q('.d3-gold b'),streak:this.hud.q('.d3-combo'),streakN:this.hud.q('.d3-combo b'),zone:this.hud.q('.f3-zone'),fp:this.hud.q('.f3-fp'),radar:this.hud.q('.f3-radar'),cue:this.hud.q('.f3-cue'),tip:this.hud.q('.f3-tip'),dive:this.hud.q('.f3-dive')};
  this.rig=new CameraRig(this.camera);this.rig.setMode(this.cameraMode);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D SKYLINE · LIVE');return this;
 }
 setCamera(mode){this.cameraMode=mode==='third'?'third':'first';this.rig?.setMode(this.cameraMode);}
 build(){
  const s=this.scene,high=this.quality==='high',add=o=>{s.add(o);return o;},glowTex=this.glowTex=radial(glowStops);this.stage.neonEnvironment(.5);s.fog=new T.FogExp2(0xe09464,.013);this.camera.far=700;
  this.sky=add(new T.Mesh(new T.SphereGeometry(420,32,16),skyMaterial()));
  this.skyline=add(new T.Mesh(new T.CylinderGeometry(260,260,120,48,1,true),new T.MeshBasicMaterial({map:skylineTexture(),transparent:true,side:T.BackSide,fog:false,depthWrite:false})));this.skyline.material.map.repeat.set(5,1);
  this.sun=add(new T.Sprite(new T.SpriteMaterial({map:radial([[0,'#ffffff'],[.14,'#fff6d8'],[.2,'#ffd08a88'],[.5,'#ff9a4a22'],[1,'#ff7a3000']]),fog:false,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false})));this.sun.scale.set(190,190,1);
  const starPos=new Float32Array(260*3);for(let i=0;i<260;i++){const a=hash(11,i)*6.283,h=.08+hash(12,i)*.9,r=Math.sqrt(1-h*h);starPos.set([Math.cos(a)*r*380,h*380,Math.sin(a)*r*380],i*3);}const sg=new T.BufferGeometry();sg.setAttribute('position',new T.BufferAttribute(starPos,3));this.stars=add(new T.Points(sg,new T.PointsMaterial({size:1.6,sizeAttenuation:false,color:0xffffff,transparent:true,opacity:0,fog:false,depthWrite:false})));
  this.hemi=new T.HemisphereLight(0xffffff,0x444444,1);this.key=new T.DirectionalLight(0xffffff,3);this.key.position.set(14,9,10);this.rim=new T.DirectionalLight(0xff4fc0,1.1);this.rim.position.set(-8,6,-10);s.add(this.hemi,this.key,this.rim);
  // Gate parts. Lower towers stand on the street 30 m down; upper ones run up out of frame.
  this.wallMats=[0,1,2,3].map(v=>new T.MeshStandardMaterial({map:wall(v,false),emissiveMap:wall(v,true),emissive:0xffffff,emissiveIntensity:.5,roughness:.45,metalness:.35,envMapIntensity:.7}));
  const W=66/PX,D=FRONT-BACK;this.lowGeo=metricBox(W,48,D).translate(0,-24,(FRONT+BACK)/2);this.upGeo=metricBox(W,40,D).translate(0,20,(FRONT+BACK)/2);this.lowExt=metricBox(W,48,6).translate(0,-24,FRONT+3);this.upExt=metricBox(W,40,6).translate(0,20,FRONT+3);
  // Neon trim on the edges of the gap: along the front glass, and along both faces the lane passes through.
  this.lipGeo=merge([new T.BoxGeometry(W+.24,.16,.16).translate(0,0,FRONT+.04),new T.BoxGeometry(.16,.16,D).translate(-W/2-.04,0,(FRONT+BACK)/2),new T.BoxGeometry(.16,.16,D).translate(W/2+.04,0,(FRONT+BACK)/2)]);this.lipExt=new T.BoxGeometry(.16,.16,6).translate(-W/2-.04,0,FRONT+3);this.lipStill=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.lipMove=new T.MeshBasicMaterial({color:hdr(0xff8a2a,1.4),toneMapped:false});
  const chev=chevrons();this.chevStill=new T.MeshBasicMaterial({map:chev,transparent:true,depthWrite:false,toneMapped:false,color:0xffffff});this.chevMove=new T.MeshBasicMaterial({map:chev,transparent:true,depthWrite:false,toneMapped:false,color:hdr(0xff8a2a,1.1)});this.chevGeo=new T.PlaneGeometry(1.1,1.1);
  this.ringMat=new T.MeshBasicMaterial({color:new T.Color(1.9,1.3,.3),toneMapped:false,transparent:true,opacity:.95});this.ringGeo=new T.TorusGeometry(1,.06,8,44);
  this.signs=signMaterials().filter(m=>!m.vertical);this.signGeo=new T.PlaneGeometry(1,1);
  // The flight lane: a red minimum-altitude grid, the street far below it, and the ceiling haze.
  const grid=texture(128,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#fff';c.lineWidth=3;c.strokeRect(0,0,w,h);c.globalAlpha=.5;c.setLineDash([10,10]);c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();},{repeat:true});grid.repeat.set(140,10);
  this.floor=add(new T.Mesh(new T.PlaneGeometry(420,30).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:grid,color:hdr(0xff2d4f,1.5),transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide,toneMapped:false,blending:T.AdditiveBlending})));this.floor.position.set(0,0,-3);this.floorTex=grid;
  this.limit=add(new T.Mesh(new T.PlaneGeometry(420,30).rotateX(Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(1,.4,.8),transparent:true,opacity:.07,depthWrite:false,side:T.DoubleSide,toneMapped:false})));this.limit.position.set(0,SKY_LIMIT,-3);
  this.street=add(new T.Mesh(new T.PlaneGeometry(700,260).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x10131f,roughness:.35,metalness:.6,envMapIntensity:.8})));this.street.position.set(0,STREET_Y,-40);
  // Traffic far below: head and tail light streaks on two avenues.
  this.cars=add(new T.InstancedMesh(new T.PlaneGeometry(2.6,.5).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}),high?90:48));this.cars.frustumCulled=false;const cw=new T.Color(3,2.6,1.9),cr=new T.Color(3,.25,.2);for(let i=0;i<this.cars.count;i++)this.cars.setColorAt(i,i%2?cw:cr);
  this.avenue=add(new T.Mesh(new T.PlaneGeometry(700,9).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:hdr(0xffa24a,.5),toneMapped:false,transparent:true,opacity:.28})));this.avenue.position.set(0,STREET_Y+.02,-2);
  // The city: towers recycled along the route, close behind the lane and far behind it; in the
  // helmet camera a second row stands on the near side so the lane runs between two walls of glass.
  this.facades=facadeMaterials();this.hazeMat=new T.MeshBasicMaterial({color:0xffffff});this.shells=buildingShells();this.stage.extraGeometries.push(...this.shells.map(sh=>sh.g),this.lowGeo,this.upGeo,this.lowExt,this.upExt,this.lipGeo,this.lipExt,this.chevGeo,this.ringGeo,this.signGeo);
  this.city=Array.from({length:high?54:30},()=>{const m=add(new T.Mesh(this.shells[0].g,this.facades[0]));m.userData={a:null};return m;});
  this.roofSigns=Array.from({length:high?8:4},(_,i)=>{const sm=this.signs[(i*5)%this.signs.length],m=add(new T.Mesh(this.signGeo,sm.mat));m.scale.set(3.4*sm.aspect,3.4,1);return m;});
  // Clouds, two blimps, searchlights, rain, lightning and fireworks.
  const ct=cloudTex();this.clouds=Array.from({length:high?22:12},(_,i)=>{const m=add(new T.Sprite(new T.SpriteMaterial({map:ct,transparent:true,depthWrite:false,opacity:.5+hash(21,i)*.4,fog:false})));const k=12+hash(22,i)*26;m.scale.set(k*2,k,1);m.userData={x:hash(23,i)*240,y:-6+hash(24,i)*34,z:i%5===4?44+hash(25,i)*30:-(16+hash(25,i)*110),rate:.5+hash(26,i)*.5};return m;});
  this.blimps=[this.makeBlimp(0xff5fc8,'DAWG AIR'),this.makeBlimp(0x5ee7ff,'GOOD BOY')];this.blimps.forEach((b,i)=>{b.userData={x:60+i*90,y:i?15:12.5,z:i?16:-26};add(b);});
  this.beams=high?[0,1,2].map(i=>{const b=add(lightShaft(0xbfd8ff,{length:80,radius:5,top:.4,opacity:.22,fade:[60,260]}));b.userData={x:40+i*70,z:-30-i*18,ph:i*2.1};return b;}):[];
  const rn=high?240:120,rp=new Float32Array(rn*6);this.rainSeed=Array.from({length:rn},(_,i)=>[hash(31,i)*44-12,hash(32,i)*30,hash(33,i)*30-18,18+hash(34,i)*10]);const rg=new T.BufferGeometry();rg.setAttribute('position',new T.BufferAttribute(rp,3).setUsage(T.DynamicDrawUsage));this.rain=add(new T.LineSegments(rg,new T.LineBasicMaterial({color:0xbfd8ee,transparent:true,opacity:0,depthWrite:false})));this.rain.frustumCulled=false;
  this.bolt=add(new T.Sprite(new T.SpriteMaterial({map:boltTex(),transparent:true,opacity:0,depthWrite:false,fog:false,blending:T.AdditiveBlending,toneMapped:false,color:new T.Color(3,3.4,4)})));this.bolt.scale.set(14,56,1);
  this.fireworks=new Particles(s,high?700:320,glowTex);this.fireworks.points.material.size=1.5;this.fireworks.points.material.fog=false;
  // Thermals and downdrafts: columns of scrolling chevrons, drawn as two crossed panes.
  const wt=chevrons();wt.repeat.set(1,8);this.windTex=wt;const wm=c=>new T.MeshBasicMaterial({map:wt,color:c,transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});this.windUp=wm(hdr(0x4dffd2,1.2));this.windDown=wm(hdr(0xff4f7a,1.2));
  const pane=new T.PlaneGeometry(70/PX,SKY_LIMIT),pane2=new T.PlaneGeometry(3,SKY_LIMIT).rotateY(Math.PI/2);this.winds=Array.from({length:5},()=>{const g=new T.Group();g.add(new T.Mesh(pane,this.windUp),new T.Mesh(pane2,this.windUp));g.visible=false;return add(g);});this.stage.extraGeometries.push(pane,pane2);
  // Gold: thick coins that spin.
  this.coinMesh=add(new T.InstancedMesh(new T.CylinderGeometry(.3,.3,.09,20).rotateX(Math.PI/2),new T.MeshStandardMaterial({color:0xffd24a,metalness:1,roughness:.22,emissive:0xffa000,emissiveIntensity:.7}),24));this.coinMesh.frustumCulled=false;
  // The ghost of the arc ahead (helmet camera): where DAWG will be if nothing is pressed.
  this.arc=add(new T.InstancedMesh(new T.SphereGeometry(.06,8,6),new T.MeshBasicMaterial({color:hdr(0x7ff3ff,1.1),toneMapped:false,transparent:true,opacity:.9,depthWrite:false}),14));this.arc.frustumCulled=false;
  // DAWG: flying flat with a delta wing and a twin jet on the back.
  this.holder=add(new T.Group());this.pose=new T.Group();this.pose.rotation.z=-1.05;this.holder.add(this.pose);
  const wingGeo=new T.BufferGeometry();wingGeo.setAttribute('position',new T.BufferAttribute(new Float32Array([.55,0,0,-.45,0,0,-.95,0,1.75, .55,0,0,-.95,0,1.75,-.1,0,1.2]),3));wingGeo.computeVertexNormals();
  this.wingMat=new T.MeshStandardMaterial({color:0xf2f6ff,metalness:.5,roughness:.3,side:T.DoubleSide,emissive:0x66ddff,emissiveIntensity:.55});this.wingL=new T.Mesh(wingGeo,this.wingMat);this.wingR=new T.Mesh(wingGeo,this.wingMat);this.wingR.scale.z=-1;
  const tipGeo=new T.BoxGeometry(1.2,.05,.07).translate(-.5,0,0),tipMat=this.tipMat=new T.MeshBasicMaterial({color:hdr(0x5ee7ff,2.4),toneMapped:false});for(const w of [this.wingL,this.wingR]){const t=new T.Mesh(tipGeo,tipMat);t.position.set(-.22,.02,1.45);t.rotation.y=.33;w.add(t);w.position.set(-.05,.22,0);}
  const pack=this.pack=new T.Mesh(new T.CapsuleGeometry(.17,.42,4,10).rotateZ(Math.PI/2),new T.MeshStandardMaterial({color:0x2a3040,metalness:.85,roughness:.25}));pack.position.set(-.25,.36,0);
  this.flame=new T.Mesh(new T.ConeGeometry(.2,1,12,1,true).rotateZ(Math.PI/2).translate(-.5,0,0),new T.MeshBasicMaterial({color:new T.Color(3,1.6,.5),transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,side:T.DoubleSide}));this.flame.position.set(-.55,.34,0);
  this.flameGlow=new T.Sprite(new T.SpriteMaterial({map:glowTex,color:new T.Color(2.6,1.3,.4),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.flameGlow.position.set(-.75,.34,0);
  this.holder.add(this.wingL,this.wingR,pack,this.flame,this.flameGlow);this.birdLight=new T.PointLight(0xfff0d8,6,8,1.6);this.birdLight.position.set(.8,.9,2.2);this.holder.add(this.birdLight);
  this.bubble=new T.Mesh(new T.SphereGeometry(1.25,24,16),new T.MeshBasicMaterial({color:new T.Color(.35,1.1,1.5),transparent:true,opacity:.12,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.bubble.visible=false;this.holder.add(this.bubble);
  // The jet trail: a ribbon through where DAWG has just been.
  const TR=this.TR=26,tg=new T.BufferGeometry();this.trailPos=new Float32Array(TR*2*3);this.trailCol=new Float32Array(TR*2*3);tg.setAttribute('position',new T.BufferAttribute(this.trailPos,3).setUsage(T.DynamicDrawUsage));tg.setAttribute('color',new T.BufferAttribute(this.trailCol,3).setUsage(T.DynamicDrawUsage));const idx=[];for(let i=0;i<TR-1;i++)idx.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);tg.setIndex(idx);
  this.trail=add(new T.Mesh(tg,new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false})));this.trail.frustumCulled=false;
  this.particles=new Particles(s,high?400:220,glowTex);this.m4=new T.Matrix4();this.dummy=new T.Object3D();
 }
 makeBlimp(color,text){const g=new T.Group(),hull=new T.Mesh(new T.SphereGeometry(1,24,16).scale(7,2.1,2.1),new T.MeshStandardMaterial({color:0xe9edf5,metalness:.3,roughness:.4,emissive:color,emissiveIntensity:.12}));g.add(hull);
  const fin=new T.BoxGeometry(2.2,2.6,.14).translate(-6,0,0),finMat=new T.MeshStandardMaterial({color,roughness:.5,emissive:color,emissiveIntensity:.5});g.add(new T.Mesh(fin,finMat));const fin2=new T.Mesh(fin,finMat);fin2.rotation.x=Math.PI/2;g.add(fin2);
  const car=new T.Mesh(new T.BoxGeometry(2.4,.7,.9).translate(0,-2.3,0),new T.MeshStandardMaterial({color:0x202634,emissive:0xffd9a0,emissiveIntensity:.8}));g.add(car);
  const tex=texture(512,128,(c,w,h)=>{c.fillStyle='#07060d';c.fillRect(0,0,w,h);c.font='900 92px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.shadowColor='#fff';c.shadowBlur=18;c.fillStyle='#fff';c.fillText(text,w/2,h/2+6);});
  for(const side of [1,-1]){const p=new T.Mesh(new T.PlaneGeometry(7,1.75),new T.MeshBasicMaterial({map:tex,color:hdr(color,1.6),toneMapped:false}));p.position.set(0,.1,side*2.12);if(side<0)p.rotation.y=Math.PI;g.add(p);}return g;}
 // One gate: a tower with a sky-gap through it. Neon lips mark the exact edges of the gap, chevrons
 // on the glass point into it, and a gold ring marks the perfect line.
 makeGate(){const g=new T.Group(),u={};u.upper=new T.Mesh(this.upGeo,this.wallMats[0]);u.lower=new T.Mesh(this.lowGeo,this.wallMats[0]);u.upperX=new T.Mesh(this.upExt,this.wallMats[0]);u.lowerX=new T.Mesh(this.lowExt,this.wallMats[0]);
  u.top=new T.Mesh(this.lipGeo,this.lipStill);u.bottom=new T.Mesh(this.lipGeo,this.lipStill);u.topX=new T.Mesh(this.lipExt,this.lipStill);u.bottomX=new T.Mesh(this.lipExt,this.lipStill);u.ring=new T.Mesh(this.ringGeo,this.ringMat);
  // Chevrons on the front glass (side-on view) and on the approach face (helmet camera).
  u.chev=[0,1,2,3].map(i=>{const m=new T.Mesh(this.chevGeo,this.chevStill);if(i>1){m.rotation.y=-Math.PI/2;m.scale.set(2.6,1,1);}if(i%2)m.rotation.z=Math.PI;return m;});
  u.sign=new T.Mesh(this.signGeo,this.signs[0].mat);g.add(u.upper,u.lower,u.upperX,u.lowerX,u.top,u.bottom,u.topX,u.bottomX,u.ring,u.sign,...u.chev);g.userData=u;this.scene.add(g);return g;}
 placeGate(g,o,i,mix){const u=g.userData,w=o.width/PX,top=fieldToWorld(0,o.center-o.gap/2).y,bot=fieldToWorld(0,o.center+o.gap/2).y,moving=(o.amplitude||0)>1,first=mix>.5;
  g.position.set((o.x+o.width/2)/PX,0,0);u.lower.position.y=u.lowerX.position.y=bot;u.upper.position.y=u.upperX.position.y=top;
  if(u.i!==i){u.i=i;const mat=this.wallMats[i%4];u.upper.material=u.lower.material=u.upperX.material=u.lowerX.material=mat;const sm=this.signs[(i*7)%this.signs.length];u.sign.material=sm.mat;u.sign.scale.set(Math.min(2.1,1.5*sm.aspect),Math.min(2.1,1.5*sm.aspect)/sm.aspect,1);u.signOn=i%3!==1;}
  const lip=moving?this.lipMove:this.lipStill,chev=moving?this.chevMove:this.chevStill;u.top.material=u.bottom.material=u.topX.material=u.bottomX.material=lip;u.top.position.y=u.topX.position.y=top+.08;u.bottom.position.y=u.bottomX.position.y=bot-.08;
  u.upperX.visible=u.lowerX.visible=u.topX.visible=u.bottomX.visible=first;
  u.chev.forEach((m,k)=>{m.material=chev;const up=k%2===0,y=up?top+.9:bot-.9;if(k<2){m.position.set(0,y,FRONT+.02);m.visible=!first;}else{m.position.set(-w/2-.02,y,0);m.visible=first;}});
  u.sign.visible=u.signOn&&!first;u.sign.position.set(0,top+3.2,FRONT+.03);
  const r=this.perfectR||.9,pulse=this.reduced?1:1+Math.sin(this.real*5+i)*.05;u.ring.visible=!o.passed;u.ring.position.set(first?-w/2:0,fieldToWorld(0,o.center).y,0);u.ring.rotation.y=Math.PI/2-.6*(1-mix);u.ring.scale.setScalar(r*pulse);}
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;const next=createDawgAsset(d);next.root.scale.setScalar(1.3);next.root.rotation.y=Math.PI/2;next.root.position.y=-1.07;if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.pose.add(next.root);}
 tip(id,text){if(this.tips[id])return;this.tips[id]=true;this.ui.tip.textContent=text;this.ui.tip.hidden=false;this.tipT=4.5;}
 event(e,g){if(!this.ready)return;const p=fieldToWorld(g.x,g.y),st=this.stage,hud=this.hud,fx=this.rig.first?p.x+2.4:p.x,P=this.particles;
  if(e.type==='score'){P.burst(fx,p.y,0,e.perfect?30+6*Math.min(e.streak||1,5):12,e.perfect?0xffd25e:0xb9ff5e,{speed:e.perfect?5:3.5,life:.6,gravity:-2});const pts='  +'+(e.points??10+(e.bonus||0));hud.pop(e.threaded?(e.perfect?'PERFECT THREAD':'THREADED')+pts:e.perfect?(e.streak>1?'PERFECT ×'+e.streak:'PERFECT')+pts:'+'+(e.points??10),e.threaded?'big':e.perfect?'gold':'dodge');if(e.perfect||e.threaded){st.flashOnce(e.threaded?0x5ee7ff:0xffd25e,.12,this.reduced);if(e.threaded||e.streak>=3)st.shake(e.threaded?.3:.12);}}
  else if(e.type==='gold'){const c=fieldToWorld(e.x,e.y);P.burst(this.rig.first?c.x+1.5:c.x,c.y,0,e.line?46:12,0xffc83d,{speed:e.line?6:3,life:.5,gravity:-1});if(e.line)hud.pop('GOLD LINE  +'+e.line,'gold');}
  else if(e.type==='dive'){this.flapT=0;this.tips.dive=true;P.burst(p.x-.6,p.y+.2,0,26,0x7ff3ff,{speed:6,life:.45,gravity:0,up:0});st.shake(.18);}
  else if(e.type==='zone'){hud.banner(FLAPPY.zones[e.zone]+(e.zone===2?' · WATCH THE DOWNDRAFTS':e.zone===3?' · GOLD PAYS DOUBLE':e.zone===0?' · RIDE THE THERMALS':''));st.flashOnce(LOOKS[e.zone].glow,.22,this.reduced);}
  else if(e.type==='feat'){const f=FLAPPY_FEATS.find(f=>f.id===e.id);hud.pop('★ '+(f?.name||'FEAT').toUpperCase(),'big');st.flashOnce(0xffd25e,.18,this.reduced);}
  else if(e.type==='shield'){P.burst(p.x,p.y,0,e.got?40:70,0x7ff3ff,{speed:e.got?4:8,life:.7,gravity:-1});hud.pop(e.got?'SHIELD UP':'SHIELD BROKEN',e.got?'shield':'big');st.flashOnce(0x5ee7ff,e.got?.15:.4,this.reduced);if(!e.got)st.shake(.7);}
  else if(e.type==='flap'){this.flapT=0;P.burst(p.x-.9,p.y+.2,0,7,0xffa04d,{speed:2.4,life:.35,gravity:-4,up:-1});}
  else if(e.type==='heat'){hud.pop(heatLabel(e.tier),'big');st.flashOnce(0xff7a3d,.2,this.reduced);}
  else if(e.type==='over'){P.burst(fx,p.y,0,90,0xff4f6a,{speed:8,life:1});st.shake(.9);st.flashOnce(0xff3355,.5,this.reduced);}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<2500));return true;}
 render(g,d,now){
  this.stage.resize();this.prepare(d);const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=this.real=now/1000,reduced=this.reduced,high=this.quality==='high';this.particles.reduced=this.fireworks.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  const playing=g.status==='playing',over=g.status==='over',zone=g.zone||0,L=LOOKS[zone],k=Math.min(1,dt*1.4),A=this.look,mix=this.rig.mix,first=mix>.5;
  // Ease the whole look toward this zone's sky.
  for(const c of LOOK_KEYS)A[c].lerp(L[c],k);for(const n of ['dens','sunK','hemiK','win','stars'])A[n]+=(L[n]-A[n])*k;
  const u=this.sky.material.uniforms;u.uTop.value.copy(A.top);u.uHorizon.value.copy(A.horizon);u.uGlow.value.copy(A.glow).multiplyScalar(.55);this.scene.fog.color.copy(A.fog);this.scene.fog.density=A.dens;
  this.hemi.color.copy(A.hemi);this.hemi.groundColor.copy(A.ground);this.hemi.intensity=A.hemiK;this.key.color.copy(A.sun);this.key.intensity=A.sunK;this.rim.intensity=.5+A.stars*.9;
  this.sun.material.color.copy(A.sun).multiplyScalar(.5+A.sunK*.35);this.hazeMat.color.copy(A.fog).multiplyScalar(.5+A.stars*.25);this.stars.material.opacity=A.stars*.9;this.skyline.material.color.copy(A.fog).lerp(A.horizon,.35);
  for(const m of this.wallMats)m.emissiveIntensity=.25+A.win*.75;for(const m of this.facades)m.emissiveIntensity=.2+A.win*.6;this.lipStill.color.copy(A.lip).multiplyScalar(1.25);this.chevStill.color.copy(A.lip);
  this.perfectR=(27+(g.career?.perfect||0))/PX;const speed=g.speed??132;if(playing)this.travel+=speed*dt/PX;
  if(!reduced){this.windTex.offset.y=-real*1.6;this.floorTex.offset.x=this.travel/3;}
  const p=fieldToWorld(g.x,g.y),tilt=Math.max(-.55,Math.min(.75,-g.vy/750));
  // Gates.
  const live=new Set();g.obstacles.forEach(o=>{let gate=this.gates.get(o);if(!gate){gate=this.free.pop()||this.makeGate();gate.visible=true;gate.userData.n=this.gateSeq=(this.gateSeq||0)+1;this.gates.set(o,gate);}live.add(o);this.placeGate(gate,o,gate.userData.n,mix);});
  for(const [o,gate]of this.gates)if(!live.has(o)){gate.visible=false;this.free.push(gate);this.gates.delete(o);}
  // Gold and winds.
  let n=0;for(const c of g.coins||[]){if(c.got||n>=24)continue;const w=fieldToWorld(c.x,c.y);this.dummy.position.set(w.x,w.y+(reduced?0:Math.sin(real*4+c.x*.02)*.06),0);this.dummy.rotation.set(0,first?Math.PI/2+Math.sin(real*3)*.6:real*3,0);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.coinMesh.setMatrixAt(n++,this.dummy.matrix);}this.coinMesh.count=n;this.coinMesh.instanceMatrix.needsUpdate=true;
  const winds=g.winds||[];this.winds.forEach((wg,i)=>{const w=winds[i];wg.visible=!!w;if(!w)return;wg.position.set((w.x+w.w/2)/PX,SKY_LIMIT/2,0);const mat=w.f<0?this.windUp:this.windDown;wg.children[0].material=wg.children[1].material=mat;wg.rotation.z=w.f<0?Math.PI:0;wg.children[0].visible=!first;});
  // The city scrolls past at its real depth, so the far rows crawl and the near row rushes.
  const rows=3,per=this.city.length/rows,S=9,firstSlot=Math.floor(this.travel/S)-4;for(let j=0;j<per;j++){const a=firstSlot+j,slot=((a%per)+per)%per;for(let r=0;r<rows;r++){const m=this.city[slot*rows+r];if(m.userData.a!==a){m.userData.a=a;const sh=this.shells[Math.floor(hash(g.worldSeed,a*3+r+700)*this.shells.length)];m.geometry=sh.g;m.material=r===1?this.hazeMat:this.facades[Math.floor(hash(g.worldSeed,a*3+r+701)*4)];
     // Rooftops stay below the lane close by and rise toward it far away, so the sky stays open behind the gates.
     m.userData.h=sh.h;m.userData.s=(-STREET_Y+(r===1?-6+hash(g.worldSeed,a*3+r+703)*15:-16+hash(g.worldSeed,a*3+r+703)*13))/sh.h;m.userData.z=r===0?-(15+hash(g.worldSeed,a*3+r+702)*10):r===1?-(36+hash(g.worldSeed,a*3+r+702)*24):13+hash(g.worldSeed,a*3+r+702)*9;m.scale.set(1.5,m.userData.s,1.5);}
    m.visible=r<2||first;m.position.set(a*S-this.travel+24+(r===1?4:0),STREET_Y,m.userData.z);}}
  this.roofSigns.forEach((sgn,i)=>{const m=this.city[((i*4+1)%per)*rows];sgn.position.set(m.position.x,STREET_Y+m.userData.h*m.userData.s+1.9,m.position.z+2);sgn.visible=m.position.x>p.x-20;});
  const wrapX=(x,span)=>((x-this.travel)%span+span)%span-span*.3;
  for(const c of this.clouds){const d0=c.userData;c.position.set(p.x+wrapX(d0.x/d0.rate,240)*d0.rate,d0.y,d0.z);c.material.color.copy(A.cloud).multiplyScalar(d0.z>0?.8:1.15);// A sprite turns to face the camera, so from the helmet a wide cloud near the lane would swing across it: only the far ones show.
   c.visible=first?Math.abs(d0.z)>c.scale.x/2+8:d0.z<0;}
  this.blimps.forEach((b,i)=>{const d0=b.userData;b.position.set(p.x+((d0.x-this.travel*.55+real*.4)%180+180)%180-50,d0.y+(reduced?0:Math.sin(real*.5+i)*.4),d0.z);b.visible=i===0||first;});
  for(const b of this.beams){const d0=b.userData;b.position.set(p.x+wrapX(d0.x,210),STREET_Y+78,d0.z);b.rotation.set(reduced?0:Math.sin(real*.4+d0.ph)*.35,0,Math.PI+(reduced?0:Math.cos(real*.3+d0.ph)*.3));b.material.uniforms.uOpacity.value=.05+A.stars*.2;}
  for(let i=0;i<this.cars.count;i++){const dir=i%2?1:-1,lane=i%4<2?-2:-28,x=wrapX(i*7.7-dir*real*(9+i%5)+(dir>0?0:this.travel*2),this.cars.count*7.7*.5);this.m4.makeTranslation(p.x+x,STREET_Y+.05,lane+dir*1.6+(i%3)*.5);this.cars.setMatrixAt(i,this.m4);}this.cars.instanceMatrix.needsUpdate=true;
  // Storm: rain and lightning. Fireworks: bursts over the far skyline.
  const storm=zone===2?1:0;this.rain.material.opacity+=(storm*.5-this.rain.material.opacity)*k;if(this.rain.material.opacity>.02&&!reduced){const rp=this.rain.geometry.attributes.position.array;this.rainSeed.forEach((r,i)=>{const y=SKY_LIMIT+8-((real*r[3]+r[1])%30),x=p.x+r[0]-((real*6+r[1])%6);rp.set([x,y,r[2],x-.35,y-1.5,r[2]],i*6);});this.rain.geometry.attributes.position.needsUpdate=true;this.rain.visible=true;}else this.rain.visible=false;
  this.boltT+=dt;if(storm&&playing&&!reduced&&this.boltT>this.nextBolt){this.boltT=0;this.nextBolt=2.5+Math.random()*4;this.bolt.position.set(p.x+6+Math.random()*30,26,-40-Math.random()*40);this.stage.flashOnce(0xcfe4ff,.2);}this.bolt.material.opacity=Math.max(0,1-this.boltT*5)*(Math.floor(real*30)%2?.6:1);
  this.fwT-=dt;if(zone===3&&playing&&!reduced&&this.fwT<=0){this.fwT=.35+Math.random()*.5;const col=[0xff5fc8,0x5ee7ff,0xffd25e,0xb9ff5e,0xff8a3d][Math.floor(Math.random()*5)];this.fireworks.burst(p.x+4+Math.random()*34,10+Math.random()*16,-(26+Math.random()*40),high?70:36,col,{speed:9,life:1.5,gravity:-3,up:1,stick:1});}
  // DAWG. A burn squashes and springs back, the wings beat, a dive tucks them; a crash tumbles.
  this.flapT+=dt;if(over){this.deadT+=dt;this.fall=Math.min(p.y+12,this.fall+(4+this.deadT*26)*dt);this.spin+=dt*9;}else{this.deadT=0;this.fall=0;this.spin=0;}
  const boost=g.boost>0,beat=reduced?0:Math.exp(-this.flapT*9),sq=beat*.2;this.holder.position.set(p.x,p.y-this.fall,0);this.holder.rotation.z=reduced?0:over?tilt-this.spin:tilt*(first?.5:1);this.holder.scale.set(1+sq*.5,1-sq,1+sq*.5);
  const dihedral=first?(boost?.5:.1+beat*.3):boost?.95:.5-beat*.95+(reduced?0:Math.sin(real*7)*.05);this.wingL.position.y=this.wingR.position.y=first?-.78:.22;this.wingL.rotation.x=-dihedral;this.wingR.rotation.x=dihedral;this.tipMat.color.set(boost?0xffffff:0x5ee7ff).multiplyScalar(boost?3:2);
  const burn=playing?(boost?1.9:.5+beat*1.5):.2;this.flame.visible=this.flameGlow.visible=!over&&!first;this.trail.visible=!first;this.birdLight.intensity=first?2:6;this.wingMat.emissiveIntensity=first?.15:.55;this.flame.scale.set(burn*(reduced?1:.9+Math.random()*.2),.7+burn*.35,.7+burn*.35);this.flame.material.color.setRGB(boost?1.2:3,boost?2.6:1.6,boost?4:.5);this.flameGlow.scale.setScalar(.8+burn*.9);this.flameGlow.material.color.copy(this.flame.material.color).multiplyScalar(.8);
  this.bubble.visible=!!g.shield&&!over;this.bubble.scale.setScalar(reduced?1:1+Math.sin(real*5)*.05);this.holder.visible=!(this.asset&&g.ghost>0&&!reduced)||Math.floor(real*14)%2===0;
  // From the helmet camera the body would fill the screen: only the wings stay, low in the frame.
  this.pose.visible=this.pack.visible=!first;if(this.asset&&!first)setDawgPose(this.asset,real,playing?'walk':'idle');
  // Trail ribbon.
  if(playing||over){this.hist.unshift({t:real,y:p.y-this.fall});while(this.hist.length>this.TR)this.hist.pop();}const tp=this.trailPos,tc=this.trailCol,hot=boost?[.5,1.6,2.6]:[2.2,1,.3];for(let i=0;i<this.TR;i++){const h=this.hist[Math.min(i,this.hist.length-1)]||{t:real,y:p.y},age=real-h.t,x=p.x-.8-age*speed/PX,f=Math.max(0,1-i/(this.TR-1)),wd=(boost?.34:.2)*f+.02;tp.set([x,h.y+.34+wd,0,x,h.y+.34-wd,0],i*6);const c=f*f*(over?0:1);tc.set([hot[0]*c,hot[1]*c,hot[2]*c,hot[0]*c,hot[1]*c,hot[2]*c],i*6);}this.trail.geometry.attributes.position.needsUpdate=true;this.trail.geometry.attributes.color.needsUpdate=true;
  // Speed streaks while the dive burns, and lift sparkles inside a thermal.
  if(playing&&!reduced){if(boost&&Math.random()<.9)this.particles.burst(p.x+10+Math.random()*6,p.y+(Math.random()-.5)*7,first?(Math.random()-.5)*6:(Math.random()-.5)*2,1,0xbfefff,{speed:.4,life:.5,gravity:0,up:0,stick:1});if(g.lift<0&&Math.random()<.5)this.particles.burst(p.x+(Math.random()-.5),p.y-1,0,1,0x4dffd2,{speed:.6,life:.6,gravity:5,up:2,stick:0});}
  // The arc ahead: ballistic from here, in the helmet camera only.
  let an=0;if(first&&playing){for(let i=1;i<=14;i++){const t=i*.07,y=g.y+g.vy*t+440*t*t;if(y>516)break;this.dummy.position.set(p.x+.9+speed*t/PX,(520-y)/PX,0);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(1.3-i*.05);this.dummy.updateMatrix();this.arc.setMatrixAt(an++,this.dummy.matrix);}}this.arc.count=an;this.arc.instanceMatrix.needsUpdate=true;
  // Cameras. Side-on follows most of DAWG's height, so the character is large and the whole gap
  // still fits; the helmet camera sits behind the ears, level, aimed at DAWG's own altitude ahead.
  const cy=MID+(p.y-MID)*.62,third={pos:new T.Vector3(p.x+3.5,cy+1,17),at:new T.Vector3(p.x+3.7,cy-.1,0)};
  const firstPose={pos:new T.Vector3(p.x-1.5,p.y+.34,0),at:new T.Vector3(p.x+9,p.y+.1,0)};
  this.rig.update(dt,third,firstPose,{follow:first?30:7,roll:0});if(!first||over)this.stage.applyShake(real,reduced);this.rig.aim();
  const cam=this.camera;cam.fov+=(fitFov(first?66:42,cam.aspect,first?58:36)-cam.fov)*Math.min(1,dt*6);cam.near=.08;cam.updateProjectionMatrix();
  this.sky.position.copy(cam.position);this.stars.position.copy(cam.position);this.skyline.position.set(cam.position.x,STREET_Y+34,cam.position.z);this.sun.position.set(cam.position.x+(first?330:46),7+A.stars*70,cam.position.z-(first?120:330));this.street.position.x=this.avenue.position.x=this.floor.position.x=this.limit.position.x=cam.position.x;
  this.particles.update(dt,{x:playing?-speed/PX:0,y:0,z:0},-40);this.fireworks.update(dt,{x:playing?-speed/PX*.4:0,y:0,z:0},-40);this.updateHud(g,first,playing,dt);
  this.stage.render(dt,real,{reduced,aberration:boost?.004:.0016});
 }
 updateHud(g,first,playing,dt){const h=this.hud,ui=this.ui;h.set(ui.gates,'g',String(g.gates));h.set(ui.gold,'p',String(g.gold||0));h.set(ui.zone,'z',(g.stageName||'')+' · '+(g.toNext||0)+' TO '+FLAPPY.zones[((g.zone||0)+1)%FLAPPY.zones.length]+(g.twist?' · '+g.twist.name:''));h.live(playing);const streak=g.streak||0;if(ui.streak.hidden===(streak>1))ui.streak.hidden=streak<2;h.set(ui.streakN,'s','×'+streak);
  const cd=(g.diveCd||0)/FLAPPY.diveCooldown;if(this.cd!==cd){this.cd=cd;ui.dive.style.setProperty('--cd',cd.toFixed(2));ui.dive.dataset.ready=cd>0?'0':'1';}
  // Tips, shown once each, the first time the technique would pay.
  const o=g.obstacles.find(o=>o.x+o.width>g.x-g.radius),dist=o?o.x-g.x:999;if(playing){if(o&&g.gates>=2&&dist<230&&dist>90&&o.center-g.y>70)this.tip('dive','TIP · DIVE (↓ or swipe down) drops fast and burns forward. Thread a gate before it fades for +15.');if(g.lift<0)this.tip('thermal','THERMAL · stop tapping and let it carry you up to the gold.');if(g.lift>0)this.tip('down','DOWNDRAFT · it pushes you down. Burn early.');}
  if(this.tipT>0){this.tipT-=dt;if(this.tipT<=0||!playing)ui.tip.hidden=true;}
  ui.fp.hidden=!first;ui.radar.hidden=!first;if(!first){ui.cue.hidden=true;return;}
  // Side-on radar: the classic view of the next few seconds, with the ghost of the arc.
  const cv=ui.radar,c=cv.getContext('2d'),W=cv.width,H=cv.height,sx=x=>(x-60)*W/560,sy=y=>y*H/560;c.clearRect(0,0,W,H);c.fillStyle='#ff2d4f';c.fillRect(0,sy(520),W,2);
  for(const w of g.winds||[]){c.fillStyle=w.f<0?'#4dffd255':'#ff4f7a55';c.fillRect(sx(w.x),0,w.w*W/560,sy(520));}
  for(const b of g.obstacles){const x=sx(b.x),w=b.width*W/560;c.fillStyle=b.amplitude>1?'#ff8a2a':'#8dff3a';c.fillRect(x,0,w,sy(b.center-b.gap/2));c.fillRect(x,sy(b.center+b.gap/2),w,sy(520)-sy(b.center+b.gap/2));if(!b.passed){c.fillStyle='#ffd25e';c.fillRect(x+w/2-1,sy(b.center-27),2,sy(54));}}
  c.fillStyle='#ffd25e';for(const q of g.coins||[])if(!q.got){c.beginPath();c.arc(sx(q.x),sy(q.y),3,0,7);c.fill();}
  c.fillStyle='#7ff3ff';const sp=g.speed??132;for(let i=1;i<=12;i++){const t=i*.08,y=g.y+g.vy*t+440*t*t;if(y>520)break;c.fillRect(sx(g.x+sp*t)-1.5,sy(y)-1.5,3,3);}
  c.fillStyle='#fff';c.beginPath();c.moveTo(sx(g.x)+9,sy(g.y));c.lineTo(sx(g.x)-6,sy(g.y)-6);c.lineTo(sx(g.x)-6,sy(g.y)+6);c.closePath();c.fill();
  // Climb / drop cue: only when the next gap is really above or below where DAWG is flying.
  let dir='';if(o&&playing&&dist<300){const up=o.center-o.gap/2+g.radius+6,down=o.center+o.gap/2-g.radius-6;if(g.y>down)dir='up';else if(g.y<up)dir='down';}
  if(ui.cue.hidden===!!dir)ui.cue.hidden=!dir;if(dir){ui.cue.dataset.dir=dir;ui.cue.dataset.hot=dist<110?'1':'0';h.set(ui.cue,'cue',dir==='up'?'▲ CLIMB':'▼ DROP');}
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();try{this.asset?.dispose();}catch{}this.stage?.dispose();}
}
