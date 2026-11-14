// Three.js presentation for Neon Snake. SnakeGame owns every rule; this module only reads it.
// The arena is a stadium floor floating over a night city. The snake is a ribbon of light: glossy
// links with a bright core that spill glow on the floor. Third person frames the whole arena from
// a steep, north-up angle (it is portrait-shaped, so it fills a phone). First person rides just
// behind DAWG's ears: the body becomes tall walls of light, the next cells of your path are lit on
// the floor (red where they are blocked), and a heading-up radar shows the whole arena.
// World units: one grid cell is one meter; cell (x, y) sits at world (x, 0, y), north is -z.
import {T,quality,fitFov,texture,radial,glowStops,skyMaterial,pbr,lightShaft,Stage,Particles,CameraRig,Hud,AmbientLoop} from './three-kit.js';
import {SNAKE_COLS,SNAKE_ROWS,SNAKE,FEATS} from './snake-engine.js';
import {heatLabel} from './difficulty.js';
import {hash} from './world.js';
import {createDawgAsset,assetKey} from './dawg-graphics-model.js';
import {loadBuildings,cityRing} from './city-art.js';
import {seededRandom} from './mobile-core.js';

const W=SNAKE_COLS,H=SNAKE_ROWS,CX=(W-1)/2,CZ=(H-1)/2;
const HEADING={up:Math.PI,right:Math.PI/2,down:0,left:-Math.PI/2},LEFT={up:'left',left:'down',down:'right',right:'up'},RIGHT={up:'right',right:'down',down:'left',left:'up'};
const hdr=(hex,k=1)=>new T.Color(hex).multiplyScalar(k);
// Each arena of the ladder has its own light: [floor lines, rail, body head, body tail].
const ARENAS=[[0x59ffa0,0x7dffb0,0xb4ff5c,0x35d6ff],[0xa77bff,0xc49bff,0xff7af0,0x7a6bff],[0xff8a3d,0xff5a3d,0xffe45e,0xff7a3d],[0xff4f6a,0xff2d4f,0xffffff,0xff6fa0]].map(a=>a.map(c=>new T.Color(c)));
const RIVAL=[0xff3d5a,0xff9a2a,0xd24dff].map(c=>new T.Color(c)),POWER={phase:0xc78bff,slow:0x5ee7ff,magnet:0xff5f9a};
const gridTexture=()=>texture(128,128,(c,w,h)=>{c.fillStyle='#070a16';c.fillRect(0,0,w,h);c.fillStyle='#0b1124';c.fillRect(5,5,w-10,h-10);c.strokeStyle='#ffffff';c.globalAlpha=.5;c.lineWidth=2;c.strokeRect(1,1,w-2,h-2);},{repeat:true});
const gridGlow=()=>texture(128,128,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.strokeStyle='#fff';c.lineWidth=3;c.strokeRect(1.5,1.5,w-3,h-3);c.fillStyle='#ffffff18';c.fillRect(8,8,w-16,h-16);},{repeat:true});
const crowd=()=>texture(256,64,(c,w,h)=>{c.fillStyle='#05060c';c.fillRect(0,0,w,h);for(let i=0;i<900;i++){const r=hash(91,i);c.fillStyle=r>.9?'#ffffff':r>.6?'#7dffb0':r>.3?'#5ee7ff':'#ff7af0';c.globalAlpha=.25+hash(92,i)*.75;c.fillRect(hash(93,i)*w,hash(94,i)*h,2,2);}},{repeat:true});
const streets=()=>texture(512,512,(c,w,h)=>{c.fillStyle='#04050b';c.fillRect(0,0,w,h);for(let i=0;i<16;i++){c.fillStyle=i%4?'#ffb45a22':'#ffb45a55';c.fillRect(0,i*32+14,w,i%4?2:4);c.fillRect(i*32+14,0,i%4?2:4,h);}for(let i=0;i<2600;i++){const r=hash(95,i);c.fillStyle=r>.8?'#8eeaff':r>.5?'#ffcf96':'#ff9ad5';c.globalAlpha=.3+hash(96,i)*.6;c.fillRect(hash(97,i)*w,hash(98,i)*h,2,2);}},{repeat:true});
const STYLE=`.snake3d .s3-stage{position:absolute;left:18px;top:calc(var(--d3-top) + clamp(38px,6vw,66px));font:800 10px var(--mono);letter-spacing:2px;color:#fff;text-shadow:0 1px 6px #000,0 1px 0 #000}
.snake3d .s3-fp{position:absolute;left:50%;top:var(--d3-top);transform:translateX(-50%);padding:5px 12px;border-radius:999px;background:#0b0a16c8;border:1px solid #5ee7ff88;color:#c8f8ff;font:800 11px var(--mono);letter-spacing:2px;white-space:nowrap}
.snake3d .s3-radar{position:absolute;left:14px;top:calc(var(--d3-top) + clamp(60px,9vw,92px));width:clamp(150px,36vmin,250px);height:auto;border-radius:50%;border:1px solid #7dffb088;background:#050812e0;box-shadow:0 0 24px #000a}
.snake3d .s3-powers{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + var(--d3-bottom) + 8px);transform:translateX(-50%);display:flex;gap:6px}
.snake3d .s3-powers span{padding:5px 10px;border-radius:999px;background:#0b0a16d0;border:1px solid currentColor;font:800 10px var(--mono);letter-spacing:1px;white-space:nowrap}
.snake3d .s3-warn{position:absolute;left:50%;top:27%;transform:translateX(-50%);padding:8px 16px;border-radius:999px;background:#2a0a14e0;border:1px solid #ff4f6a;color:#ffe0e5;font:900 clamp(14px,2.8vw,22px)/1 var(--display);letter-spacing:1px;box-shadow:0 0 24px #ff4f6a88;white-space:nowrap}
.snake3d .s3-warn[data-soft="1"]{background:#0b1a12e0;border-color:#7dffb0;color:#dfffe9;box-shadow:0 0 18px #7dffb055}
.snake3d .s3-edge{position:absolute;top:44%;padding:10px 12px;border-radius:14px;background:#141003d9;border:1px solid #ffd25e;color:#ffe08a;font:900 clamp(16px,3vw,24px)/1 var(--display);box-shadow:0 0 22px #ffb43a66}
.snake3d .s3-edge[data-side=left]{left:10px}.snake3d .s3-edge[data-side=right]{right:10px}.snake3d .s3-edge[data-side=back]{left:50%;top:auto;bottom:30%;transform:translateX(-50%)}
.snake3d .s3-tip{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + var(--d3-bottom) + 96px);transform:translateX(-50%);max-width:82%;padding:8px 14px;border-radius:12px;background:#0b0a16d9;border:1px solid #ffd25e88;color:#ffe9b0;font:700 12px/1.35 var(--mono);text-align:center}
.snake3d .s3-boost{position:absolute;right:14px;bottom:calc(env(safe-area-inset-bottom) + var(--d3-bottom) + 84px);width:84px;height:84px;border-radius:50%;border:2px solid #ffd25eaa;background:#171003d9;color:#ffe9b0;font:900 13px var(--display);letter-spacing:1px;pointer-events:auto;touch-action:none;cursor:pointer;box-shadow:0 0 22px #ffb43a55}
.snake3d .s3-boost small{display:block;font:700 9px var(--mono);opacity:.8}.snake3d .s3-boost[data-on="1"]{background:#ffd25e;color:#1a1203;box-shadow:0 0 34px #ffb43a}
.snake3d [hidden]{display:none!important}@media (pointer:fine){.snake3d .s3-boost{width:64px;height:64px;font-size:11px}}`;

export class ThreeSnake {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.cameraMode='third';this.clock=performance.now();this.status='';this.statusSince=performance.now();this.yaw=HEADING.right;this.gulp=9;this.deadT=0;this.col=new T.Color();this.cDead=new T.Color(0xff3d6e);this.look=ARENAS[0].map(c=>c.clone());this.tips={};this.tipT=0;this.ghosts=[];this.energy=0;}
 async init(){
  if(!document.querySelector('style#s3-style')){const st=document.createElement('style');st.id='s3-style';st.textContent=STYLE;document.head.append(st);}
  this.stage=new Stage({quality:this.quality,className:'dash3d snake3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="d3-meter"><b class="d3-dist">0</b><small>LONG</small></div><div class="s3-stage"></div><div class="d3-gold"><i></i><b>0</b></div><div class="d3-combo" hidden><b>×2</b><small>DIRECT LINES</small></div><div class="s3-fp" hidden>RIDER CAM · SCORE ×'+SNAKE.firstPerson+'</div><canvas class="s3-radar" width="260" height="260" hidden aria-hidden="true"></canvas><div class="s3-warn" hidden></div><div class="s3-edge" hidden></div><div class="s3-powers"></div><div class="s3-tip" hidden></div><button class="s3-boost" type="button" data-snake="boost" aria-label="Hold to boost">BOOST<small>HOLD · SPACE</small></button>');this.view.append(this.hud.root);
  const q=s=>this.hud.q(s);this.ui={len:q('.d3-dist'),gold:q('.d3-gold b'),streak:q('.d3-combo'),streakN:q('.d3-combo b'),stage:q('.s3-stage'),fp:q('.s3-fp'),radar:q('.s3-radar'),warn:q('.s3-warn'),edge:q('.s3-edge'),powers:q('.s3-powers'),tip:q('.s3-tip'),boost:q('.s3-boost')};
  this.rig=new CameraRig(this.camera);this.rig.setMode(this.cameraMode);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D ARENA · LIVE');return this;
 }
 setCamera(mode){this.cameraMode=mode==='third'?'third':'first';this.rig?.setMode(this.cameraMode);}
 build(){
  const s=this.scene,high=this.quality==='high',add=o=>{s.add(o);return o;},glowTex=this.glowTex=radial(glowStops);this.stage.neonEnvironment(.7);this.stage.hdrEnvironment(undefined,.55);s.fog=new T.FogExp2(0x070914,.006);this.camera.far=400;
  this.sky=add(new T.Mesh(new T.SphereGeometry(200,24,12),skyMaterial()));
  // The city far below the floating floor, and towers rising around it (CC0 models, loaded in the background).
  const st=streets();st.repeat.set(5,5);this.streets=add(new T.Mesh(new T.PlaneGeometry(420,420).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:st,color:hdr(0xffffff,1.1),fog:true})));this.streets.position.set(CX,-46,CZ);
  loadBuildings().then(buildings=>{if(this.dead)return;const ring=cityRing(buildings,seededRandom(0x5a4e),{cx:CX,cz:CZ,radius:Math.max(W,H)*2.6,spread:26,count:high?40:22,minH:34,maxH:74,clear:(x,z)=>!(z>CZ&&Math.abs(x-CX)<W*1.2)});ring.position.y=-46;this.scene.add(ring);}).catch(()=>{});
  this.hemi=add(new T.HemisphereLight(0x9fb2ff,0x140c22,.75));this.key=new T.DirectionalLight(0xc8d4ff,1.6);this.key.position.set(CX-8,22,CZ+12);this.key.target.position.set(CX,0,CZ);s.add(this.key,this.key.target);this.stage.sunShadow(this.key,{size:Math.max(W,H)*.75+2,far:60,map:2048,radius:3});this.headLight=add(new T.PointLight(0xb9ff5e,6,6,1.6));
  // The floor: a glossy slab with glowing cell lines, on a platform with a lit underside.
  const g=gridTexture(),gl=gridGlow();g.repeat.set(W,H);gl.repeat.set(W,H);this.gridMat=pbr({map:g,emissiveMap:gl,emissive:0xffffff,emissiveIntensity:.6,metalness:.7,roughness:.16,envMapIntensity:1.3,clearcoat:1,clearcoatRoughness:.08},this.quality);
  const floor=add(new T.Mesh(new T.PlaneGeometry(W,H).rotateX(-Math.PI/2),this.gridMat));floor.position.set(CX,0,CZ);floor.receiveShadow=true;
  const slab=add(new T.Mesh(new T.BoxGeometry(W+3,1.6,H+3),new T.MeshStandardMaterial({color:0x0c1020,metalness:.7,roughness:.35})));slab.position.set(CX,-.82,CZ);
  this.underMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});const under=add(new T.Mesh(new T.BoxGeometry(W+3.2,.12,H+3.2),this.underMat));under.position.set(CX,-1.7,CZ);
  this.aura=add(new T.Sprite(new T.SpriteMaterial({map:glowTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,opacity:.35})));this.aura.position.set(CX,-6,CZ);this.aura.scale.set(70,70,1);
  // Barrier rails, warp curtains for the Warp Ring, and hazard tiles for The Crush.
  this.railMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});const wallMat=new T.MeshStandardMaterial({color:0x141a36,metalness:.7,roughness:.3});
  const sides=[[CX,-.75,W+1,.5],[CX,H-.25,W+1,.5],[-.75,CZ,.5,H+1],[W-.25,CZ,.5,H+1]];this.curtainMat=new T.MeshBasicMaterial({map:texture(8,64,(c,w,h)=>{const gr=c.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#ffffff00');gr.addColorStop(1,'#ffffffcc');c.fillStyle=gr;c.fillRect(0,0,w,h);}),color:hdr(0xa77bff,1.6),transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});
  for(const [x,z,w,d]of sides){const wall=add(new T.Mesh(new T.BoxGeometry(w,.7,d).translate(0,.35,0),wallMat));wall.castShadow=wall.receiveShadow=true;wall.position.set(x,0,z);const rail=add(new T.Mesh(new T.BoxGeometry(w,.07,d).translate(0,.74,0),this.railMat));rail.position.set(x,0,z);
   const cur=add(new T.Mesh(new T.PlaneGeometry(Math.max(w,d),2.6),this.curtainMat));cur.position.set(x,1.3,z);if(d>w)cur.rotation.y=Math.PI/2;}
  this.tiles=add(new T.InstancedMesh(new T.PlaneGeometry(.94,.94).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.75,depthWrite:false,toneMapped:false}),2*(W+H)*2));this.tiles.frustumCulled=false;this.tiles.position.y=.02;this.tiles.setColorAt(0,new T.Color(1,0,0));
  // Stadium: banks of crowd lights on three sides and four floodlight masts.
  this.crowdMat=new T.MeshBasicMaterial({map:crowd(),color:0xffffff,transparent:true,opacity:.8,depthWrite:false,toneMapped:false,side:T.DoubleSide});this.crowdMat.map.repeat.set(3,1);
  for(const [x,z,len,ry]of [[CX,-5.2,W+10,0],[-5.2,CZ,H+10,Math.PI/2],[W+4.2,CZ,H+10,-Math.PI/2]]){const bank=add(new T.Mesh(new T.PlaneGeometry(len,6),this.crowdMat));bank.position.set(x,2.2,z);bank.rotation.set(0,ry,0);bank.rotateX(-.75);}
  this.floodMat=new T.SpriteMaterial({map:glowTex,color:new T.Color(1.4,1.2,1),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});const mastMat=new T.MeshStandardMaterial({color:0x1b2238,metalness:.8,roughness:.3});
  for(const [x,z]of [[-2.4,-2.4],[W+1.4,-2.4],[-2.4,H+1.4],[W+1.4,H+1.4]]){const mast=add(new T.Mesh(new T.CylinderGeometry(.09,.14,6.4,8).translate(0,3.2-1.6,0),mastMat));mast.position.set(x,0,z);const lamp=add(new T.Sprite(this.floodMat));lamp.position.set(x+(CX-x)*.05,4.9,z+(CZ-z)*.05);lamp.scale.set(2.6,2.6,1);
   if(high){const shaft=add(lightShaft(0xdfe8ff,{length:6,radius:3.4,top:.2,opacity:.14}));shaft.position.copy(lamp.position);shaft.rotation.set(-(CZ-z)*.03,0,(CX-x)*.03);}}
  // Crystals: deadly, so hot magenta against the cool floor.
  this.rockMat=new T.MeshStandardMaterial({color:0x7a2a8c,metalness:.2,roughness:.3,emissive:0xff3fb4,emissiveIntensity:.95,flatShading:true});this.rockGeo=new T.IcosahedronGeometry(.47,0).scale(1,1.3,1).translate(0,.52,0);this.rocks=null;this.rockSeed=null;
  // Bodies: glossy links and joints (yours and the rivals' share the meshes), a bright core line on
  // top, and a pool of glow on the floor under each joint.
  const CAP=W*H+200;this.shellMat=pbr({color:0xffffff,metalness:.35,roughness:.18,clearcoat:1,clearcoatRoughness:.05,emissive:0x202020,emissiveIntensity:1},this.quality);
  this.links=add(new T.InstancedMesh(new T.CylinderGeometry(.3,.3,1,12,1,true).rotateX(Math.PI/2).scale(1,.78,1).translate(0,.26,0),this.shellMat,CAP));this.joints=add(new T.InstancedMesh(new T.SphereGeometry(.3,14,10).scale(1,.78,1).translate(0,.26,0),this.shellMat,CAP));
  this.cores=add(new T.InstancedMesh(new T.BoxGeometry(.13,.05,1).translate(0,.5,0),new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}),CAP));
  this.pools=add(new T.InstancedMesh(new T.PlaneGeometry(2.3,2.3).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:glowTex,color:0xffffff,transparent:true,opacity:.34,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),high?200:90));this.pools.position.y=.03;
  for(const m of [this.links,this.joints,this.cores,this.pools]){m.frustumCulled=false;m.setColorAt(0,new T.Color(1,1,1));m.count=0;}this.links.castShadow=this.joints.castShadow=true;
  // Your head: a light-cycle nose with a visor; DAWG rides it.
  this.headMat=pbr({color:0xe8fff2,emissive:0x7dffb0,emissiveIntensity:.7,metalness:.45,roughness:.18,clearcoat:1,clearcoatRoughness:.05},this.quality);this.head=add(new T.Group());const nose=new T.Mesh(new T.CapsuleGeometry(.34,.5,6,14).rotateX(Math.PI/2).scale(1.05,.8,1).translate(0,.3,.08),this.headMat);nose.castShadow=true;this.head.add(nose);
  this.visor=new T.Mesh(new T.BoxGeometry(.5,.09,.06),new T.MeshBasicMaterial({color:new T.Color(3,.6,1.6),toneMapped:false}));this.visor.position.set(0,.36,.62);this.head.add(this.visor);
  this.rivalHeads=[0,1,2].map(i=>{const h=add(new T.Group()),b=new T.Mesh(new T.ConeGeometry(.36,.9,4).rotateX(Math.PI/2).rotateZ(Math.PI/4).scale(1,.7,1).translate(0,.28,.1),new T.MeshStandardMaterial({color:RIVAL[i],emissive:RIVAL[i],emissiveIntensity:.8,metalness:.4,roughness:.25}));h.add(b);for(const sx of [-.14,.14]){const e=new T.Mesh(new T.SphereGeometry(.06,8,6),new T.MeshBasicMaterial({color:new T.Color(4,4,4),toneMapped:false}));e.position.set(sx,.4,.34);h.add(e);}h.visible=false;return h;});
  // Gold: a spinning coin in a tilted ring, under a beacon so it is found at a glance.
  this.goldMat=new T.MeshStandardMaterial({color:0xffc83d,metalness:1,roughness:.2,emissive:0xff8a00,emissiveIntensity:.5});this.food=add(new T.Group());this.coin=new T.Mesh(new T.CylinderGeometry(.3,.3,.08,28).rotateX(Math.PI/2),this.goldMat);this.halo=new T.Mesh(new T.TorusGeometry(.46,.025,8,36),new T.MeshBasicMaterial({color:hdr(0xffd25e,2),toneMapped:false}));this.food.add(this.coin,this.halo);
  this.foodGlow=add(new T.Sprite(new T.SpriteMaterial({map:glowTex,color:new T.Color(1.6,1.1,.4),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false})));this.foodGlow.scale.set(2,2,1);
  this.beacon=add(new T.Mesh(new T.CylinderGeometry(.07,.3,6,12,1,true).translate(0,3,0),new T.MeshBasicMaterial({color:new T.Color(1.3,.85,.25),transparent:true,opacity:.2,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false})));
  // Power-up: a faceted core inside two rings, in the colour of what it does.
  this.power=add(new T.Group());this.powerMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});this.powerCore=new T.Mesh(new T.OctahedronGeometry(.26,0),this.powerMat);const r1=new T.Mesh(new T.TorusGeometry(.42,.03,8,30),this.powerMat),r2=new T.Mesh(new T.TorusGeometry(.42,.03,8,30).rotateX(Math.PI/2),this.powerMat);this.power.add(this.powerCore,r1,r2);this.powerGlow=add(new T.Sprite(new T.SpriteMaterial({map:glowTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false})));this.powerGlow.scale.set(2.2,2.2,1);
  // Rider camera: the next cells of your path, lit on the floor.
  this.path=add(new T.InstancedMesh(new T.PlaneGeometry(.8,.8).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.5,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),6));this.path.position.y=.035;this.path.frustumCulled=false;this.path.setColorAt(0,new T.Color(1,1,1));this.path.count=0;
  this.particles=new Particles(s,high?500:240,glowTex);this.dummy=new T.Object3D();
 }
 buildRocks(g){this.rocks?.removeFromParent();this.rocks=new T.InstancedMesh(this.rockGeo,this.rockMat,Math.max(1,g.rocks.length));g.rocks.forEach((r,i)=>{this.dummy.position.set(r.x,0,r.y);this.dummy.rotation.set(0,(r.x*7+r.y*3)%6,0);this.dummy.scale.set(1,1,1);this.dummy.updateMatrix();this.rocks.setMatrixAt(i,this.dummy.matrix);});this.rocks.count=g.rocks.length;this.rocks.castShadow=this.rocks.receiveShadow=true;this.scene.add(this.rocks);this.rockSeed=g.worldSeed;this.dummy.rotation.set(0,0,0);}
 // Smoothly interpolated cells: each segment glides toward the one ahead of it between steps (and snaps across a warp).
 glide(body,dir,g){const f=g.status==='playing'?Math.min(1,g.elapsed/g.interval):0;return body.map((p,i)=>{const to=i===0?g.next(p,dir):body[i-1];if(Math.abs(to.x-p.x)+Math.abs(to.y-p.y)>1)return {x:p.x,y:p.y,cut:true};return {x:p.x+(to.x-p.x)*f,y:p.y+(to.y-p.y)*f};});}
 tip(id,text){if(this.tips[id])return;this.tips[id]=true;this.ui.tip.textContent=text;this.ui.tip.hidden=false;this.tipT=5;}
 event(e,g){if(!this.ready)return;const h=g.body[0],st=this.stage,hud=this.hud,P=this.particles;
  if(e.type==='coin'){this.gulp=0;this.energy=1;P.burst(h.x,.5,h.y,e.quick?30+8*Math.min(e.streak,5):24,e.hot?0xff8a3d:0xffc14d,{speed:4,life:.7});hud.pop((e.hot?'HOT ':'')+(e.quick?(e.streak>1?'DIRECT ×'+e.streak:'DIRECT'):'')+'  +'+(e.points??25+e.bonus),'gold');st.shake(.12);if(e.quick&&e.streak>=3)st.flashOnce(0xffd25e,.1,this.reduced);}
  else if(e.type==='charge'){hud.banner('CHARGED · SMASH A CRYSTAL');st.flashOnce(0xffd25e,.2,this.reduced);P.burst(h.x,.6,h.y,40,0xffd25e,{speed:3,life:.8,up:3});}
  else if(e.type==='smash'){P.burst(e.x,.6,e.y,110,0xff3fb4,{speed:8,life:1,up:3});P.burst(e.x,.6,e.y,40,0xffffff,{speed:11,life:.35});hud.pop('SMASH  +'+(e.points??50),'big');st.shake(.7);st.flashOnce(0xff3fb4,.3,this.reduced);}
  else if(e.type==='power'){P.burst(h.x,.6,h.y,50,POWER[e.kind],{speed:5,life:.8,up:2});hud.pop({phase:'PHASE · GHOST THROUGH ONE BODY',slow:'SLOW TIME',magnet:'GOLD MAGNET'}[e.kind],'shield');st.flashOnce(POWER[e.kind],.18,this.reduced);}
  else if(e.type==='phase'){P.burst(e.x,.6,e.y,70,0xc78bff,{speed:6,life:.8});hud.pop('GHOSTED THROUGH','big');st.flashOnce(0xc78bff,.3,this.reduced);}
  else if(e.type==='rival'){hud.banner(e.name+' DROPS IN · BOX IT IN');st.flashOnce(0xff3d5a,.18,this.reduced);this.tip('rival','RIVALS chase the gold. Cut across their nose or coil around them: a rider with nowhere to go pays '+SNAKE.trap+'+.');}
  else if(e.type==='trap'){for(const c of e.cells)P.burst(c.x,.4,c.y,14,0xffd25e,{speed:5,life:.9,up:3});hud.pop(e.name+' TRAPPED  +'+e.points,'big');st.shake(.8);st.flashOnce(0xffd25e,.35,this.reduced);}
  else if(e.type==='steal'){hud.pop(e.name+' STOLE THE GOLD','magnet');}
  else if(e.type==='stage'){hud.banner(e.name+({1:' · THE EDGES WARP',2:' · RIVAL RIDERS',3:' · THE WALLS CLOSE'}[e.stage%4]||' · OPEN FLOOR'));st.flashOnce(ARENAS[e.stage%4][0],.25,this.reduced);for(let i=0;i<8;i++)P.burst(hash(e.stage,i)*W,.3,hash(e.stage,i+9)*H,16,ARENAS[e.stage%4][0],{speed:4,life:1,up:5});}
  else if(e.type==='closing'){hud.banner('THE WALLS ARE CLOSING · GET OFF THE RED');}
  else if(e.type==='shrink'){st.shake(.6);st.flashOnce(0xff2d4f,.25,this.reduced);}
  else if(e.type==='warp'){P.burst(e.x,.5,e.y,26,0xa77bff,{speed:4,life:.5});}
  else if(e.type==='feat'){const f=FEATS.find(f=>f.id===e.id);hud.pop('★ '+(f?.name||'FEAT').toUpperCase(),'big');st.flashOnce(0xffd25e,.18,this.reduced);}
  else if(e.type==='heat'){hud.pop(heatLabel(e.tier),'big');st.flashOnce(0xff7a3d,.2,this.reduced);}
  else if(e.type==='over'){P.burst(h.x,.5,h.y,90,0xff4f6a,{speed:7,life:1});st.shake(.9);st.flashOnce(0xff3355,.5,this.reduced);}}
 // The player's DAWG rides the head of the light trail.
 prepare(d){if(!d||!this.ready)return;const key=assetKey(d);if(key===this.assetKey)return;try{const next=createDawgAsset(d);next.root.scale.setScalar(.46);next.root.position.set(0,.5,-.05);if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.head.add(next.root);}catch{}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.prepare(d);this.lastGame=g;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<2500));return true;}
 // Lays one body into the shared instanced meshes, starting at instance n; returns the next free instance.
 lay(seg,n,head,tail,{tall=1,dead=0,wave=-9,skip=0}={}){const d=this.dummy,col=this.col,last=seg.length-1;for(let i=skip;i<=last;i++){const p=seg[i],t=last?i/last:0,bulge=Math.exp(-((i-wave)**2)/3)*.4,s=(1-.32*t+bulge)*(1-dead*.7);col.copy(head).lerp(tail,t);if(dead)col.lerp(this.cDead,.8);else if(bulge>.02)col.lerp(col.clone().setRGB(1,.85,.35),Math.min(1,bulge*2.2));
   d.position.set(p.x,0,p.y);d.rotation.set(0,0,0);d.scale.set(s,s*tall,s);d.updateMatrix();this.joints.setMatrixAt(n,d.matrix);this.joints.setColorAt(n,col);
   const q=seg[i+1],linked=q&&!p.cut&&Math.abs(q.x-p.x)+Math.abs(q.y-p.y)<1.5;if(linked){const dx=q.x-p.x,dz=q.y-p.y,len=Math.hypot(dx,dz)||.001;d.position.set((p.x+q.x)/2,0,(p.y+q.y)/2);d.rotation.set(0,Math.atan2(dx,dz),0);d.scale.set(s,s*tall,len);}else d.scale.set(0,0,0);d.updateMatrix();this.links.setMatrixAt(n,d.matrix);this.links.setColorAt(n,col);
   if(linked){d.scale.set(1,1,d.scale.z);d.position.y=.26*s*tall*.78+(.26*s*tall-.26)-.01;d.updateMatrix();}this.cores.setMatrixAt(n,d.matrix);this.cores.setColorAt(n,this.col.clone().multiplyScalar(dead?.6:2.6));
   if(this.poolN<this.pools.instanceMatrix.count&&i%2===0){d.position.set(p.x,0,p.y);d.rotation.set(0,0,0);d.scale.set(1,1,1);d.updateMatrix();this.pools.setMatrixAt(this.poolN,d.matrix);this.pools.setColorAt(this.poolN++,col);}n++;}return n;}
 render(g,now){
  this.stage.resize();if(this.rockSeed!==g.worldSeed||!this.rocks||this.rockCount!==g.rocks.length){this.rockCount=g.rocks.length;this.buildRocks(g);}const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  const playing=g.status==='playing',over=g.status==='over',mix=this.rig.mix,first=mix>.5,A=ARENAS[g.arena||0],L=this.look,k=Math.min(1,dt*2);for(let i=0;i<4;i++)L[i].lerp(A[i],k);
  // Reactive light: the whole stadium pulses on the beat, harder as the snake grows, and kicks on every gold.
  this.energy=Math.max(0,this.energy-dt*1.6);const grow=Math.min(1,g.body.length/40),beat=reduced?0:Math.pow(Math.max(0,Math.sin(real*Math.PI*2.1*(g.boosting?2:1))),8),pulse=.25+grow*.55+beat*(.2+grow*.5)+this.energy*.7;
  this.gridMat.emissive.copy(L[0]);this.gridMat.emissiveIntensity=.35+pulse*.7;this.railMat.color.copy(L[1]).multiplyScalar(1.3+pulse*.9);this.underMat.color.copy(L[0]).multiplyScalar(.8+pulse);this.aura.material.color.copy(L[0]);this.aura.material.opacity=.16+pulse*.2;
  this.crowdMat.opacity=.45+pulse*.5;this.crowdMat.color.copy(L[0]).lerp(new T.Color(1,1,1),.5).multiplyScalar(1+pulse*.6);if(!reduced)this.crowdMat.map.offset.x=real*.01;this.floodMat.color.setRGB(1.2+pulse,1.05+pulse*.8,.9+pulse*.6);
  const u=this.sky.material.uniforms;u.uTop.value.set(0x03040a);u.uHorizon.value.copy(L[0]).multiplyScalar(.1);u.uGlow.value.copy(L[1]).multiplyScalar(.16);this.scene.fog.color.copy(L[0]).multiplyScalar(.05);
  this.curtainMat.opacity+=((g.wrap?.55+beat*.2:0)-this.curtainMat.opacity)*Math.min(1,dt*4);
  // Bodies.
  const seg=this.glide(g.body,g.dir,g),n0=seg.length-1;this.gulp+=dt;this.deadT=over?this.deadT+dt:0;this.poolN=0;const dead=over&&!reduced?Math.min(1,this.deadT*1.6):over?1:0;
  let n=this.lay(seg,0,L[2],L[3],{tall:1+mix*1.5,dead,wave:reduced?-9:this.gulp*26,skip:1});
  (g.rivals||[]).forEach((v,i)=>{const rs=this.glide(v.body,v.dir,{...g,elapsed:g.stepN%2?g.elapsed+g.interval:g.elapsed,interval:g.interval*2,next:(p,d)=>g.next(p,d),status:g.status}),c=RIVAL[v.kind];n=this.lay(rs,n,c,c.clone().multiplyScalar(.45),{tall:1+mix*1.5,skip:1});const hd=this.rivalHeads[i],dx=rs[0].x-(rs[1]?.x??rs[0].x),dz=rs[0].y-(rs[1]?.y??rs[0].y);hd.visible=true;hd.position.set(rs[0].x,0,rs[0].y);if(Math.abs(dx)+Math.abs(dz)>.01&&Math.abs(dx)+Math.abs(dz)<1.5)hd.rotation.y=Math.atan2(dx,dz);hd.children[0].material.color.copy(c);hd.children[0].material.emissive.copy(c);});
  for(let i=(g.rivals||[]).length;i<3;i++)this.rivalHeads[i].visible=false;
  for(const m of [this.links,this.joints,this.cores]){m.count=n;m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true;}this.pools.count=this.poolN;this.pools.instanceMatrix.needsUpdate=true;this.pools.instanceColor.needsUpdate=true;
  // The head and the look of its powers.
  const head=seg[0];let diff=((HEADING[g.dir]-this.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;this.yaw+=diff*Math.min(1,dt*(reduced?40:first?11:16));
  this.head.position.set(head.x,0,head.y);this.head.rotation.y=this.yaw;this.head.scale.setScalar(over?Math.max(.3,1-dead*.7):1);this.headMat.emissive.set(over?0xff3d6e:g.charged?0xffc83d:g.phase?0xc78bff:0x7dffb0);this.headMat.emissiveIntensity=(g.charged||g.phase)&&!reduced?1.2+Math.sin(real*10)*.5:.7;this.headMat.opacity=1;
  this.headLight.color.copy(g.charged?this.col.set(0xffc83d):g.boosting?this.col.set(0xff8a3d):L[2]);this.headLight.intensity=(g.charged?11:6)+pulse*4;this.headLight.position.set(head.x,1,head.y);this.shellMat.emissiveIntensity=g.phase&&!reduced?1.5+Math.sin(real*9):1;
  if(playing&&g.boosting&&!reduced&&Math.random()<.8){const b=seg[Math.min(2,n0)];this.particles.burst(b.x,.3,b.y,1,0xff8a3d,{speed:1.5,life:.5,up:1});}
  this.rockMat.emissiveIntensity=g.charged&&!reduced?1.2+Math.sin(real*8)*.6:.95;this.rockMat.emissive.set(g.charged?0xffb347:0xff3fb4);
  // Gold and power-up.
  if(g.food){this.food.visible=this.foodGlow.visible=this.beacon.visible=true;this.food.position.set(g.food.x,.5+(reduced?0:Math.sin(real*3)*.08),g.food.y);this.coin.rotation.y=reduced?0:real*3;this.halo.rotation.set(1.1,reduced?0:real*1.4,0);this.foodGlow.position.copy(this.food.position);this.foodGlow.scale.setScalar(g.magnet>0?3.4:2);this.beacon.position.set(g.food.x,0,g.food.y);this.beacon.material.opacity=reduced?.18:.16+Math.sin(real*4)*.06;}else this.food.visible=this.foodGlow.visible=this.beacon.visible=false;
  const pw=g.power;this.power.visible=this.powerGlow.visible=!!pw;if(pw){const blink=pw.ttl<12&&!reduced&&Math.floor(real*8)%2;this.power.visible=!blink;this.power.position.set(pw.x,.55,pw.y);this.power.rotation.set(reduced?0:real*1.3,reduced?0:real*2,0);this.powerMat.color.set(POWER[pw.kind]).multiplyScalar(2.2);this.powerGlow.position.copy(this.power.position);this.powerGlow.material.color.set(POWER[pw.kind]);}
  // The Crush: closed cells are solid red; the ring about to close flashes.
  let tn=0;const ring=g.ring||0,doomed=g.closing?ring+1:ring,flash=reduced||Math.floor(real*5)%2;if(doomed)for(let y=0;y<H;y++)for(let x=0;x<W;x++){const e=Math.min(x,y,W-1-x,H-1-y);if(e>=doomed)continue;this.dummy.position.set(x,0,y);this.dummy.rotation.set(0,0,0);this.dummy.scale.set(1,1,1);this.dummy.updateMatrix();this.tiles.setMatrixAt(tn,this.dummy.matrix);this.tiles.setColorAt(tn++,this.col.setRGB(e<ring?1.5:flash?1.8:.35,e<ring?.1:.25,.2));}this.tiles.count=tn;this.tiles.instanceMatrix.needsUpdate=true;if(tn)this.tiles.instanceColor.needsUpdate=true;
  // Rider camera aids: the cells ahead along your path (through a queued turn), red where blocked.
  const look=this.ahead(g);let pn=0;if(first&&playing)for(const c of look.cells){this.dummy.position.set(c.x,0,c.y);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.path.setMatrixAt(pn,this.dummy.matrix);this.path.setColorAt(pn++,this.col.setRGB(c.bad?2.4:.3,c.bad?.2:1.5,c.bad?.3:.7));}this.path.count=pn;this.path.instanceMatrix.needsUpdate=true;if(pn)this.path.instanceColor.needsUpdate=true;
  // Cameras: the whole arena from the south stand, or just behind DAWG's ears, level, looking down the lane.
  const f=[Math.sin(this.yaw),Math.cos(this.yaw)],firstPose={pos:new T.Vector3(head.x-f[0]*1.55,1.55,head.y-f[1]*1.55),at:new T.Vector3(head.x+f[0]*3.2,.25,head.y+f[1]*3.2)};
  const third={pos:new T.Vector3(CX,22.5,CZ+12.5),at:new T.Vector3(CX,0,CZ+.9)};
  this.rig.update(dt,third,firstPose,{follow:first?26:8});if(!first||over)this.stage.applyShake(real,reduced);this.rig.aim();
  const cam=this.camera;cam.fov+=(fitFov(first?70:44,cam.aspect,first?76:41)-cam.fov)*Math.min(1,dt*6);cam.near=.05;cam.updateProjectionMatrix();this.sky.position.copy(cam.position);
  this.particles.update(dt);this.updateHud(g,seg,look,first,playing,dt);this.stage.render(dt,real,{reduced,aberration:g.boosting?.004:.0018});
 }
 // What lies along the path the snake will take: the next five cells, how far the first blocked one is, and which sides are open.
 ahead(g){const cells=[];let p=g.body[0],dir=g.dir,turns=[g.queued,g.queued2].filter(Boolean),dist=0;for(let i=1;i<=5;i++){if(turns.length)dir=turns.shift();p=g.next(p,dir);const bad=g.blocked(p)&&!(g.body.at(-1).x===p.x&&g.body.at(-1).y===p.y&&i>=1&&g.body.length>3&&i===g.body.length);cells.push({x:p.x,y:p.y,bad});if(bad&&!dist)dist=i;if(bad)break;}
  const h=g.body[0],facing=g.queued2||g.queued||g.dir;return {cells,dist,left:!g.blocked(g.next(h,LEFT[g.dir])),right:!g.blocked(g.next(h,RIGHT[g.dir])),facing};}
 updateHud(g,seg,look,first,playing,dt){
  const h=this.hud,ui=this.ui;h.set(ui.len,'l',String(g.body.length));h.set(ui.gold,'g',String(g.coins));h.live(playing);const streak=g.streak||0;if(ui.streak.hidden===(streak>1))ui.streak.hidden=streak<2;h.set(ui.streakN,'s','×'+streak);
  h.set(ui.stage,'st',g.worldSeed?g.stageName+' · '+g.toNext+' GOLD TO '+SNAKE.stages[(g.arena+1)%SNAKE.stages.length]+(g.twist?' · '+g.twist.name:''):'CLASSIC FLOOR');
  const pw=(g.phase?'<span style="color:#c78bff">PHASE READY</span>':'')+(g.slow>0?'<span style="color:#5ee7ff">SLOW '+Math.ceil(g.slow)+'</span>':'')+(g.magnet>0?'<span style="color:#ff5f9a">MAGNET '+Math.ceil(g.magnet)+'</span>':'')+(g.charged?'<span style="color:#ffd25e">CHARGED</span>':'');if(this.pw!==pw){this.pw=pw;ui.powers.innerHTML=pw;}
  const on=g.boosting?'1':'0';if(ui.boost.dataset.on!==on)ui.boost.dataset.on=on;
  if(playing){if(g.coins>=2&&!g.boosting)this.tip('boost','TIP · hold BOOST (Space) for speed. Gold eaten while boosting is HOT: +10.');if(g.charged)this.tip('charge','CHARGED · three direct lines in a row. Ride through a crystal to smash it for +50.');if(g.power)this.tip('power','POWER-UP · violet phases you through one body, cyan slows time, pink pulls gold in.');if(g.wrap)this.tip('warp','WARP RING · ride off an edge and you come back on the far side.');}
  if(this.tipT>0){this.tipT-=dt;if(this.tipT<=0||!playing)ui.tip.hidden=true;}
  ui.fp.hidden=!first;ui.radar.hidden=!first;if(!first||!playing){ui.warn.hidden=ui.edge.hidden=true;if(!first)return;}
  // Heading-up radar: the arena turns so that up is always the way you are riding.
  const cv=ui.radar,c=cv.getContext('2d'),S=cv.width,cell=S/24.5,hd=seg[0];c.clearRect(0,0,S,S);c.save();c.translate(S/2,S/2);c.rotate(this.yaw-Math.PI);c.translate(-(CX+.5)*cell,-(CZ+.5)*cell);
  c.fillStyle='#0d1428';c.fillRect(0,0,W*cell,H*cell);c.strokeStyle=g.wrap?'#a77bff':'#7dffb0';c.lineWidth=2;c.strokeRect(0,0,W*cell,H*cell);
  const ring=g.closing?(g.ring||0)+1:g.ring||0;if(ring){c.fillStyle='#ff2d4f88';c.fillRect(0,0,W*cell,ring*cell);c.fillRect(0,(H-ring)*cell,W*cell,ring*cell);c.fillRect(0,0,ring*cell,H*cell);c.fillRect((W-ring)*cell,0,ring*cell,H*cell);}
  c.fillStyle='#ff3fb4';for(const r of g.rocks)c.fillRect(r.x*cell+1,r.y*cell+1,cell-2,cell-2);
  (g.rivals||[]).forEach(v=>{c.fillStyle='#'+RIVAL[v.kind].getHexString();for(const p of v.body)c.fillRect(p.x*cell+.5,p.y*cell+.5,cell-1,cell-1);});
  if(g.power){c.fillStyle='#'+new T.Color(POWER[g.power.kind]).getHexString();c.beginPath();c.arc((g.power.x+.5)*cell,(g.power.y+.5)*cell,cell*.5,0,7);c.fill();}
  if(g.food){c.fillStyle='#ffc83d';c.beginPath();c.arc((g.food.x+.5)*cell,(g.food.y+.5)*cell,cell*.6,0,7);c.fill();}
  c.fillStyle='#5cff9b';for(const p of seg.slice(1))c.fillRect(p.x*cell+.5,p.y*cell+.5,cell-1,cell-1);
  c.translate((hd.x+.5)*cell,(hd.y+.5)*cell);c.rotate(-this.yaw+Math.PI);c.fillStyle='#ffffff';c.beginPath();c.moveTo(0,-cell*1.1);c.lineTo(cell*.75,cell*.7);c.lineTo(-cell*.75,cell*.7);c.closePath();c.fill();c.restore();
  if(!playing)return;
  // Warning before a wall or a body, with the open side named; and an edge arrow to the gold when it is not ahead.
  const d=look.dist,warn=d>0&&d<=3;if(ui.warn.hidden===warn)ui.warn.hidden=!warn;if(warn){const open=look.left&&look.right?'◀ TURN ▶':look.left?'◀ TURN LEFT':look.right?'TURN RIGHT ▶':'NO WAY OUT';h.set(ui.warn,'w',(d===1?'NOW · ':'IN '+d+' · ')+open);ui.warn.dataset.soft=d===3?'1':'0';}
  let side='';if(g.food){const fx=g.food.x-g.body[0].x,fy=g.food.y-g.body[0].y,fw=Math.sin(HEADING[g.dir])*fx+Math.cos(HEADING[g.dir])*fy,rt=Math.sin(HEADING[RIGHT[g.dir]])*fx+Math.cos(HEADING[RIGHT[g.dir]])*fy;side=Math.abs(rt)>Math.max(1,fw)?rt>0?'right':'left':fw<0?'back':'';if(side)h.set(ui.edge,'e',side==='left'?'◀ GOLD '+Math.abs(rt):side==='right'?'GOLD '+Math.abs(rt)+' ▶':'GOLD BEHIND ▼');}
  if(ui.edge.hidden===!!side)ui.edge.hidden=!side;if(side)ui.edge.dataset.side=side;
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();try{this.asset?.dispose();}catch{}this.stage?.dispose();}
}
