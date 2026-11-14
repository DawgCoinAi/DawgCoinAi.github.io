// DAWG Chess in 3D: a marble board on a dais in a candle-lit chess hall, with columns, team
// banners, a gallery of watching DAWGs and your rival across the table. The pieces are original
// DAWG characters; when one captures, the two squares become a stage and the pieces themselves
// fight it out in a short film (see chess-fights.js for the fight book and chess-battle.js for the
// choreography). This file is the stage crew: board, room, lights, camera shots, time control
// (slow motion, hit-stop, skip), effects (rings, trails, beams, sigils, debris) and sound cues.
// The board only shows the game; ChessPlay owns the rules and waits on these animations.
import {T,quality,texture,radial,glowStops,pbr,lightShaft,Stage,Particles,merge} from './three-kit.js';
import {createDawgAsset,setDawgPose} from './dawg-graphics-model.js';
import {npcDawg} from './npc-dawg.js';
import {pieceModel} from './chess-pieces.js';
import {matchup,boardMismatch,NAMES} from './chess-fights.js';
import {ATTACK,BRACE,DEFEAT,VICTORY,gearUp,enPassant,promotion,castling,checkScene,checkmateScene} from './chess-battle.js';

export const WHITE=0x5ee7ff,BLACK=0xff4fd8,GOLD=0xffd36b;
export const sqPos=(s,y=0)=>new T.Vector3((s&7)-3.5,y,(s>>3)-3.5);
export const ease=k=>k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2,easeOut=k=>1-Math.pow(1-k,3),easeIn=k=>k*k*k;
const hdr=(c,k=2)=>new T.Color(c).multiplyScalar(k);
const UP=new T.Vector3(0,1,0);
// Sound cues: [frequency, seconds, wave, volume, delay ms].
const SFX={whoosh:[[240,.12,'sawtooth',.012],[150,.16,'sine',.02,40]],clang:[[1250,.07,'square',.02],[1890,.1,'triangle',.016,15]],thud:[[90,.16,'sine',.05]],boom:[[58,.4,'sine',.07],[120,.2,'sawtooth',.035]],
 zap:[[980,.2,'sawtooth',.016],[1470,.25,'square',.01,50]],chime:[[1320,.3,'sine',.02],[1760,.4,'sine',.014,90]],shatter:[[2100,.08,'square',.018],[2800,.12,'triangle',.014,40],[1700,.16,'triangle',.012,90]],
 crumble:[[110,.12,'sawtooth',.03],[84,.14,'sawtooth',.03,90],[70,.2,'sawtooth',.03,190]],gallop:[[170,.05,'triangle',.03],[150,.05,'triangle',.03,90],[190,.05,'triangle',.03,180],[160,.05,'triangle',.03,270]],
 charge:[[220,.3,'sawtooth',.012],[330,.28,'sawtooth',.012,120]],impact:[[70,.35,'sine',.08],[190,.14,'square',.035],[2400,.06,'square',.012]],fanfare:[[523,.14,'triangle',.03],[659,.14,'triangle',.03,110],[784,.3,'triangle',.03,220]],
 royal:[[196,.5,'sawtooth',.02],[294,.5,'sawtooth',.016],[392,.6,'triangle',.02,160]],blink:[[1900,.05,'sine',.018],[900,.08,'sine',.014,30]],scurry:[[420,.04,'triangle',.02],[460,.04,'triangle',.02,150],[500,.04,'triangle',.02,300]],
 fall:[[400,.5,'sine',.016]],tick:[[1500,.03,'square',.012]],doom:[[55,.9,'sawtooth',.05],[110,.9,'sine',.04]],crown:[[2200,.12,'triangle',.03],[1650,.2,'triangle',.022,120],[2200,.1,'triangle',.016,330],[2200,.08,'triangle',.01,470]]};

export class ThreeChess {
 constructor(host,{onFailure,quality:q=quality(),sound=null,debug=false}={}){Object.assign(this,{host,onFailure,quality:q,sound,ready:false,dead:false,pieces:new Map(),tweens:[],flipped:false,view:'3d',cine:null,clock:performance.now(),skipping:false,
  cast:new Set(),chunks:[],trash:[],attached:[],hitstop:0,slowT:0,slowK:.3,timeScale:1,fighting:false,fightClock:0,dim:0,dimTarget:0,flinchT:9,flinchAmp:0,crowdHop:0,rivalAct:null,debug:debug?{}:null,pulse:[],selSq:-1,checkSq:-1});}
 get lite(){return this.quality!=='high';}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'chess3d',onFailure:()=>this.fail()}).init();this.view3d=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;this.host.prepend(this.view3d);this.stage.onDowngrade=()=>{this.quality='low';};this.stage.bloomBase=.5;
  const s=this.scene;this.stage.neonEnvironment(.4);this.stage.hdrEnvironment(undefined,.4);s.fog=new T.FogExp2(0x0a0716,.016);s.background=new T.Color(0x07050e);
  this.hemi=new T.HemisphereLight(0xd8d0ff,0x2a1840,.95);s.add(this.hemi);
  this.key=new T.SpotLight(0xfff2dc,40,34,.62,.55,1.25);this.key.position.set(0,13,3);this.key.target.position.set(0,0,0);s.add(this.key,this.key.target);
  if(this.quality==='high'){this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);this.key.shadow.bias=-.0003;this.key.shadow.normalBias=.015;this.key.shadow.radius=5;this.key.shadow.camera.near=4;this.key.shadow.camera.far=26;}
  this.rimA=new T.PointLight(WHITE,16,16,1.5);this.rimA.position.set(-6,3,5);this.rimB=new T.PointLight(BLACK,16,16,1.5);this.rimB.position.set(6,3,-5);s.add(this.rimA,this.rimB);
  // Fight lighting: a spotlight on the duel, a rim light in the attacker's colour, an impact flash.
  this.duelSpot=new T.SpotLight(0xfff6e8,0,14,.5,.6,1.1);this.duelSpot.position.set(0,6,0);s.add(this.duelSpot,this.duelSpot.target);
  this.duelRim=new T.PointLight(0xffffff,0,7,1.6);this.flashLight=new T.PointLight(0xffffff,0,9,1.6);this.checkLight=new T.PointLight(0xff2448,0,5,1.6);s.add(this.duelRim,this.flashLight,this.checkLight);
  this.lightBase={hemi:this.hemi.intensity,key:this.key.intensity,rim:16};
  this.glowTex=radial(glowStops);this.particles=new Particles(s,this.quality==='high'?1100:420,this.glowTex);
  this.fx=new T.Group();s.add(this.fx);
  this.geo={box:new T.BoxGeometry(1,1,1),shard:new T.TetrahedronGeometry(1,0),ball:new T.SphereGeometry(1,14,10),disc:new T.CircleGeometry(1,40).rotateX(-Math.PI/2),tube:new T.CylinderGeometry(1,1,1,12,1,true).rotateX(Math.PI/2).translate(0,0,.5)};
  this.sigilTex=texture(512,512,(c,w)=>{c.clearRect(0,0,w,w);c.strokeStyle='#fff';c.fillStyle='#fff';c.translate(w/2,w/2);c.lineWidth=9;for(const r of [240,205,120]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}
   c.lineWidth=6;for(const off of [0,Math.PI/6]){c.beginPath();for(let i=0;i<=6;i++){const a=off+i*Math.PI*2/3*2;c[i?'lineTo':'moveTo'](Math.cos(a)*200,Math.sin(a)*200);}c.stroke();}
   c.font='700 30px serif';c.textAlign='center';c.textBaseline='middle';const runes='ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒ';for(let i=0;i<18;i++){c.save();c.rotate(i/18*Math.PI*2);c.fillText(runes[i],0,-222);c.restore();}
   for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.arc(Math.cos(a)*120,Math.sin(a)*120,14,0,Math.PI*2);c.fill();}},{color:false});
  this.buildRoom();this.buildBoard();
  // Two team finishes: warm pearl with gold trim and ice-blue lights; black chrome with rose trim and hot pink lights.
  this.mats={w:pbr({color:0xd9d0c0,roughness:.34,metalness:.04,clearcoat:.7,clearcoatRoughness:.2,emissive:0xfff0d0,emissiveIntensity:.02},this.quality),
   b:pbr({color:0x1b1a2b,roughness:.3,metalness:.45,clearcoat:1,clearcoatRoughness:.1,emissive:0x2a1050,emissiveIntensity:.3},this.quality)};
  this.models={};for(const t of 'prbqkn')this.models[t]=pieceModel(t);
  this.trimMats={w:new T.MeshStandardMaterial({color:GOLD,metalness:1,roughness:.2,emissive:GOLD,emissiveIntensity:.14}),b:new T.MeshStandardMaterial({color:0xff7fdc,metalness:1,roughness:.16,emissive:BLACK,emissiveIntensity:.5})};
  this.glowMats={w:new T.MeshBasicMaterial({color:hdr(WHITE,1.9),toneMapped:false}),b:new T.MeshBasicMaterial({color:hdr(BLACK,2.1),toneMapped:false})};this.darkMat=new T.MeshStandardMaterial({color:0x0a0810,roughness:.5,metalness:.2});
  this.aim=new T.Vector3(0,.3,0);this.ready=true;return this;}
 teamColor(c){return c==='w'?WHITE:BLACK;}
 // ── The hall ──────────────────────────────────────────────────────────────────────────────
 buildRoom(){this.shafts=[];const s=this.scene,high=this.quality==='high',stone=pbr({color:0x2c2644,roughness:.62,metalness:.12},this.quality),dark=new T.MeshStandardMaterial({color:0x120e20,roughness:.8,metalness:.1,side:T.BackSide});
  const floor=new T.Mesh(new T.CircleGeometry(21,64).rotateX(-Math.PI/2),pbr({map:texture(1024,1024,(c,w)=>{const q=w/16;for(let y=0;y<16;y++)for(let x=0;x<16;x++){c.fillStyle=(x+y)%2?'#1b1530':'#120d20';c.fillRect(x*q,y*q,q,q);}c.strokeStyle='#ffd36b22';c.lineWidth=2;for(let i=0;i<=16;i++){c.strokeRect(i*q,0,0,w);c.strokeRect(0,i*q,w,0);}},{repeat:true}),roughness:.26,metalness:.4,clearcoat:.9,clearcoatRoughness:.1},this.quality));floor.material.map.repeat.set(3,3);floor.position.y=-1.6;floor.receiveShadow=true;s.add(floor);
  // The dais the board stands on: a lacquered drum on two stone steps, with gold inlay.
  const table=new T.Mesh(new T.CylinderGeometry(7.2,7.6,1.5,64),pbr({color:0x1f1530,roughness:.36,metalness:.3,clearcoat:1,clearcoatRoughness:.08,sheen:.3,sheenColor:new T.Color(0x6a4a9a)},this.quality));table.position.y=-.86;table.receiveShadow=true;s.add(table);
  const steps=new T.Mesh(merge([new T.CylinderGeometry(8.6,8.9,.45,64).translate(0,-1.38,0),new T.CylinderGeometry(10,10.3,.22,64).translate(0,-1.5,0)]),stone);steps.receiveShadow=true;s.add(steps);
  const gold=new T.MeshBasicMaterial({color:hdr(GOLD,.9),toneMapped:false});s.add(new T.Mesh(merge([new T.TorusGeometry(7.25,.05,8,96).rotateX(Math.PI/2).translate(0,-.1,0),new T.TorusGeometry(8.65,.035,8,96).rotateX(Math.PI/2).translate(0,-1.15,0),new T.TorusGeometry(12.5,.05,8,96).rotateX(Math.PI/2).translate(0,-1.58,0)]),gold));
  // Twelve columns, a gallery behind them and the outer wall.
  const cols=[],N=12,R=15.2;for(let i=0;i<N;i++){const a=(i+.5)/N*Math.PI*2,x=Math.sin(a)*R,z=Math.cos(a)*R;cols.push(new T.CylinderGeometry(.62,.72,13,16).translate(x,4.9,z),new T.CylinderGeometry(1,1,.5,16).translate(x,-1.35,z),new T.BoxGeometry(1.9,.5,1.9).rotateY(a).translate(x,11.6,z),new T.TorusGeometry(.72,.09,8,20).rotateX(Math.PI/2).translate(x,3.1,z));}
  const columns=new T.Mesh(merge(cols),stone);columns.castShadow=false;s.add(columns);
  s.add(new T.Mesh(new T.CylinderGeometry(20.5,20.5,20,48,1,true).translate(0,8.4,0),dark));
  const parapet=new T.Mesh(merge([new T.CylinderGeometry(16.5,16.5,1.1,48,1,true).translate(0,2.75,0),new T.RingGeometry(16.5,20.5,48).rotateX(-Math.PI/2).translate(0,2.2,0),new T.RingGeometry(16.5,20.5,48).rotateX(Math.PI/2).translate(0,2.2,0)]),new T.MeshStandardMaterial({color:0x241d3a,roughness:.6,metalness:.2,side:T.DoubleSide}));s.add(parapet);
  s.add(new T.Mesh(new T.TorusGeometry(16.5,.05,6,96).rotateX(Math.PI/2).translate(0,3.3,0),gold));
  // The gallery: rows of DAWG silhouettes with glowing eyes; they jump when a blow lands.
  const crowdTex=texture(2048,256,(c,w,h)=>{c.clearRect(0,0,w,h);const eyes=['#5ee7ff','#ff4fd8','#ffd36b','#b9ff5e'];for(const [row,y,r,shade] of [[0,110,34,'#191330'],[1,170,44,'#2a2048']]){for(let x=(row?0:42);x<w;x+=row?92:84){const j=Math.sin(x*12.9+row)*10,cy=y+j*.6;c.fillStyle=shade;c.beginPath();c.ellipse(x,cy+r*1.9,r*1.25,r*1.5,0,0,Math.PI*2);c.fill();c.beginPath();c.arc(x,cy,r,0,Math.PI*2);c.fill();
     const pointy=Math.sin(x*7.3)>0;for(const sx of [-1,1]){c.beginPath();if(pointy){c.moveTo(x+sx*r*.35,cy-r*.75);c.lineTo(x+sx*r*.95,cy-r*1.6);c.lineTo(x+sx*r*.98,cy-r*.3);}else c.ellipse(x+sx*r*.95,cy+r*.1,r*.3,r*.75,sx*.25,0,Math.PI*2);c.fill();}
     c.fillStyle=eyes[Math.abs(Math.floor(Math.sin(x*3.1+row)*40))%4];c.shadowColor=c.fillStyle;c.shadowBlur=10;for(const sx of [-1,1]){c.beginPath();c.arc(x+sx*r*.36,cy-r*.05,r*.11,0,Math.PI*2);c.fill();}c.shadowBlur=0;}}},{repeat:true});crowdTex.repeat.set(4,1);
  this.crowd=new T.Mesh(new T.CylinderGeometry(17.4,17.4,3,48,1,true),new T.MeshBasicMaterial({map:crowdTex,transparent:true,side:T.BackSide,toneMapped:false,color:new T.Color(1.25,1.25,1.25),depthWrite:false}));this.crowd.position.y=4.4;s.add(this.crowd);
  // Tall moonlit windows above the gallery, with shafts of light falling toward the board.
  const winTex=texture(128,512,(c,w,h)=>{c.clearRect(0,0,w,h);const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#bcd0ff');g.addColorStop(.6,'#6c7fd8');g.addColorStop(1,'#2a2a6a');c.fillStyle=g;c.beginPath();c.moveTo(8,h);c.lineTo(8,w/2);c.arc(w/2,w/2,w/2-8,Math.PI,0);c.lineTo(w-8,h);c.fill();c.fillStyle='#120e20';c.fillRect(w/2-3,0,6,h);for(let y=90;y<h;y+=84)c.fillRect(0,y,w,5);});
  const wins=[];for(let i=0;i<N;i++){const a=i/N*Math.PI*2;wins.push(new T.PlaneGeometry(2.4,8).rotateY(a+Math.PI).translate(Math.sin(a)*20.2,11.4,Math.cos(a)*20.2));}
  s.add(new T.Mesh(merge(wins),new T.MeshBasicMaterial({map:winTex,transparent:true,toneMapped:false,color:new T.Color(.75,.8,.95)})));
  if(high){for(const a of [.52,2.62,3.66,5.76]){const p=new T.Vector3(Math.sin(a)*19,13,Math.cos(a)*19),b=lightShaft(0xaec4ff,{length:22,radius:3.4,top:.5,opacity:.1});b.position.copy(p);b.lookAt(Math.sin(a)*3,-1,Math.cos(a)*3);b.rotateX(-Math.PI/2);s.add(b);this.shafts.push([b,.1]);}
   const beam=lightShaft(0xfff0d8,{length:14,radius:5.4,top:.35,opacity:.07});beam.position.copy(this.key.position);beam.lookAt(0,0,0);beam.rotateX(-Math.PI/2);s.add(beam);this.shafts.push([beam,.07]);}
  // Banners between the columns: ice blue on white's side of the hall, hot pink on black's.
  const banner=(col,glyph)=>new T.MeshBasicMaterial({map:texture(256,768,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,col[0]);g.addColorStop(1,col[1]);c.fillStyle=g;c.beginPath();c.moveTo(0,0);c.lineTo(w,0);c.lineTo(w,h-90);c.lineTo(w/2,h);c.lineTo(0,h-90);c.fill();c.strokeStyle='#ffd36b';c.lineWidth=12;c.stroke();c.fillStyle='#ffd36b';c.fillRect(0,0,w,26);c.font='180px serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=col[2];c.fillText(glyph,w/2,h*.36);c.font='900 44px Impact, sans-serif';c.fillText('DAWG',w/2,h*.62);}),transparent:true,side:T.DoubleSide,toneMapped:false,color:new T.Color(.8,.8,.8)});
  const flags={w:[],b:[]};for(let i=0;i<N;i++){const a=i/N*Math.PI*2,z=Math.cos(a),team=Math.abs(z)<.1?(i%2?'w':'b'):z>0?'w':'b';flags[team].push(new T.PlaneGeometry(2.3,6.9).rotateY(a+Math.PI).translate(Math.sin(a)*15.6,7.4,Math.cos(a)*15.6));}
  s.add(new T.Mesh(merge(flags.w),banner(['#0e3a5c','#1a7fa8','#e9fbff'],'♔')),new T.Mesh(merge(flags.b),banner(['#4a0d44','#a31c86','#ffe3f8'],'♚')));
  // Candles on every column and along the gallery rail, as one cloud of flickering points.
  const flames=[];for(let i=0;i<N;i++){const a=(i+.5)/N*Math.PI*2;flames.push(Math.sin(a)*14.4,3.5,Math.cos(a)*14.4);for(let j=0;j<3;j++){const b=a+(j-1)*.14;flames.push(Math.sin(b)*16.4,3.6,Math.cos(b)*16.4);}}
  const fg=new T.BufferGeometry();fg.setAttribute('position',new T.Float32BufferAttribute(flames,3));this.candles=new T.Points(fg,new T.PointsMaterial({size:1.5,map:this.glowTex,color:hdr(0xffb060,1.6),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));s.add(this.candles);
  this.hallA=new T.PointLight(0xffb878,14,40,1.2);this.hallA.position.set(-10,9,0);this.hallB=new T.PointLight(0xffb878,14,40,1.2);this.hallB.position.set(10,9,0);s.add(this.hallA,this.hallB);
  // The club's sign hangs over the far gallery.
  const sign=()=>new T.Mesh(new T.PlaneGeometry(9,1.8),new T.MeshBasicMaterial({map:texture(1024,200,(c,w,h)=>{c.clearRect(0,0,w,h);c.font='900 120px Impact, "Arial Narrow", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#b9ff5e';c.shadowColor='#b9ff5e';c.shadowBlur=30;c.fillText('DAWG CHESS CLUB',w/2,h/2+6);}),transparent:true,toneMapped:false}));
  const a=sign();a.position.set(0,7.6,-16.2);const b=sign();b.position.set(0,7.6,16.2);b.rotation.y=Math.PI;s.add(a,b);}
 buildBoard(){const s=this.scene,tex=texture(1024,1024,(c,w)=>{const q=w/8;for(let r=0;r<8;r++)for(let f=0;f<8;f++){const light=(r+f)%2===0;const g=c.createLinearGradient(f*q,r*q,(f+1)*q,(r+1)*q);g.addColorStop(0,light?'#f1eaff':'#5d4a98');g.addColorStop(1,light?'#d6cbf0':'#473676');c.fillStyle=g;c.fillRect(f*q,r*q,q,q);
    c.globalAlpha=.09;for(let i=0;i<14;i++){c.strokeStyle=light?'#ffffff':'#8a6bd1';c.lineWidth=1+Math.random()*2;c.beginPath();c.moveTo(f*q+Math.random()*q,r*q);c.bezierCurveTo(f*q+Math.random()*q,r*q+q*.3,f*q+Math.random()*q,r*q+q*.7,f*q+Math.random()*q,r*q+q);c.stroke();}c.globalAlpha=1;c.strokeStyle='#1a122c55';c.lineWidth=2;c.strokeRect(f*q,r*q,q,q);}});
  this.board=new T.Mesh(new T.BoxGeometry(8,.22,8).translate(0,-.11,0),[...Array(6)].map((_,i)=>i===2?pbr({map:tex,roughness:.5,metalness:.02,clearcoat:.25,clearcoatRoughness:.35,envMapIntensity:.45},this.quality):new T.MeshStandardMaterial({color:0x140f22,roughness:.4,metalness:.5})));this.board.receiveShadow=true;s.add(this.board);
  const frame=new T.Mesh(new T.BoxGeometry(8.9,.3,8.9).translate(0,-.16,0),pbr({color:0x0c0914,roughness:.25,metalness:.7,clearcoat:1,clearcoatRoughness:.06},this.quality));frame.receiveShadow=true;s.add(frame);
  // The board's edge is a light strip: gold at rest, the attacker's colour during a fight.
  this.edgeMat=new T.MeshBasicMaterial({color:hdr(GOLD,1.5),toneMapped:false});this.edgeColor=hdr(GOLD,1.5);this.edgeTarget=this.edgeColor.clone();
  s.add(new T.Mesh(merge([[8.9,.05,0,4.45],[8.9,.05,0,-4.45],[.05,8.9,4.45,0],[.05,8.9,-4.45,0]].map(([w,d,x,z])=>new T.BoxGeometry(w,.05,d).translate(x,0,z))),this.edgeMat));
  const glyph=t=>new T.MeshBasicMaterial({map:texture(64,64,(c,w)=>{c.clearRect(0,0,w,w);c.font='700 40px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffd36bcc';c.fillText(t,w/2,w/2+2);}),transparent:true,depthWrite:false});
  this.labels=new T.Group();for(let i=0;i<8;i++){const f=new T.Mesh(new T.PlaneGeometry(.3,.3).rotateX(-Math.PI/2),glyph('abcdefgh'[i]));f.position.set(i-3.5,.01,4.22);const r=new T.Mesh(new T.PlaneGeometry(.3,.3).rotateX(-Math.PI/2),glyph(String(8-i)));r.position.set(-4.22,.01,i-3.5);this.labels.add(f,r);}s.add(this.labels);
  // Square markers: selection, moves, captures, last move, hint, check.
  this.markGeo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);this.dotGeo=new T.CircleGeometry(.17,24).rotateX(-Math.PI/2);this.capGeo=new T.RingGeometry(.36,.46,32).rotateX(-Math.PI/2);
  const mk=(r,g,b,o)=>new T.MeshBasicMaterial({color:new T.Color(r,g,b),transparent:true,opacity:o,toneMapped:false,depthWrite:false});
  this.markMats={sel:mk(.7,1.6,.4,.55),last:mk(1.6,1.2,.4,.28),dot:mk(.7,1.6,.4,.85),cap:mk(1.8,.4,.6,.9),hint:mk(.4,1.4,1.8,.5),check:mk(2,.2,.3,.55),to:mk(.5,1.3,.3,.2),hover:mk(1.6,1.6,1.6,.9)};
  this.hoverGeo=new T.RingGeometry(.6,.68,4,1,Math.PI/4).rotateX(-Math.PI/2);this.hoverMark=new T.Mesh(this.hoverGeo,this.markMats.hover);this.hoverMark.visible=false;s.add(this.hoverMark);
  this.markGroup=new T.Group();s.add(this.markGroup);}
 // An outline on the square under the pointer (-1 hides it).
 hover(sq){if(!this.hoverMark)return;this.hoverMark.visible=sq>=0;if(sq>=0)this.hoverMark.position.copy(sqPos(sq,.014));}
 // The rival DAWG sits across the table from you.
 setRival(name){if(this.rivalName===name)return;this.rivalName=name;this.rival?.root.removeFromParent();this.rival?.dispose();try{const a=createDawgAsset(npcDawg(name)),b=new T.Box3().setFromObject(a.root),h=b.getSize(new T.Vector3()).y||1;a.root.scale.setScalar(3.4/h);this.rival=a;this.rivalArms=a.limbs.filter(l=>l.kind==='arm');this.scene.add(a.root);}catch{this.rival=null;}}
 // 'lean' (thinking), 'cheer' (it took something), 'slam' (it lost something), 'gloat' / 'despair' (game over).
 rivalReact(kind){this.rivalAct={kind,t:0};}
 setFlipped(f){this.flipped=!!f;}
 setView(v){this.view=v==='top'?'top':'3d';}
 homeYaw(c){return c==='w'?Math.PI:0;}
 makePiece(p){const t=p.toLowerCase(),c=p===p.toUpperCase()?'w':'b',g=new T.Group(),model=this.models[t];
  for(const [slot,mat] of [['body',this.mats[c]],['trim',this.trimMats[c]],['glow',this.glowMats[c]],['dark',this.darkMat]]){if(!model[slot])continue;const m=new T.Mesh(model[slot],mat);m.castShadow=slot!=='glow';m.receiveShadow=slot==='body';m.userData.slot=slot;g.add(m);}
  // White faces the far side of the board, black faces the near side.
  g.rotation.order='YXZ';g.rotation.y=this.homeYaw(c);g.userData={p,t,c,vis:1,h:model.height,seed:Math.random()*9};this.scene.add(g);return g;}
 // Puts every piece on its square at once (new games, undo, loading a save).
 setPosition(board){if(this.tweens.length)this.skip();this.cleanup();this.keepsake?.removeFromParent();this.keepsake=null;for(const g of this.pieces.values())g.removeFromParent();this.pieces.clear();board.forEach((p,s)=>{if(!p)return;const g=this.makePiece(p);g.position.copy(sqPos(s));this.pieces.set(s,g);});}
 // The guard against drift: if what is drawn is not the engine's board, redraw it. Returns true when it already matched.
 verify(board){const shown=new Map();for(const [s,g] of this.pieces)shown.set(s,g.userData.p);const bad=boardMismatch(shown,board),stray=[...this.pieces].some(([s,g])=>{const p=sqPos(s);return Math.abs(g.position.x-p.x)+Math.abs(g.position.z-p.z)>.02;});
  if(bad.length||stray){this.setPosition(board);return false;}for(const g of this.pieces.values()){g.visible=true;if(!g.parent)this.scene.add(g);}return true;}
 // Which square is under a screen point, or -1.
 pick(x,y){if(!this.ready)return -1;const r=this.view3d.getBoundingClientRect(),v=new T.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),ray=new T.Raycaster();ray.setFromCamera(v,this.camera);const p=new T.Vector3();if(!ray.ray.intersectPlane(new T.Plane(UP,0),p))return -1;
  const file=Math.floor(p.x+4),rank=Math.floor(p.z+4);return file>=0&&file<8&&rank>=0&&rank<8?rank*8+file:-1;}
 marks({selected=-1,moves=[],captures=[],last=null,hint=null,check=-1}={}){for(const m of this.markGroup.children)m.removeFromParent();this.markGroup.clear();this.pulse=[];this.selSq=selected;const add=(geo,mat,s,y=.005)=>{const m=new T.Mesh(geo,mat);m.position.copy(sqPos(s,y));this.markGroup.add(m);return m;};
  if(last){add(this.markGeo,this.markMats.last,last[0]);add(this.markGeo,this.markMats.last,last[1]);}if(hint){add(this.markGeo,this.markMats.hint,hint[0],.007);add(this.markGeo,this.markMats.hint,hint[1],.007);}
  if(check>=0)add(this.markGeo,this.markMats.check,check,.008);if(selected>=0)add(this.markGeo,this.markMats.sel,selected,.009);for(const s of moves){add(this.markGeo,this.markMats.to,s,.006);this.pulse.push(add(this.dotGeo,this.markMats.dot,s,.012));}for(const s of captures){add(this.markGeo,this.markMats.to,s,.006);this.pulse.push(add(this.capGeo,this.markMats.cap,s,.012));}this.checkSq=check;}
 // ── Time: tweens run on fight time, which slow motion, hit-stop and skipping all bend ───────
 tween(dur,fn){if(this.skipping||dur<=0){fn(1,0);return Promise.resolve();}return new Promise(res=>this.tweens.push({e:0,dur,fn,res}));}
 wait(s){return this.tween(s,()=>{});}
 skip(){this.skipping=true;this.hitstop=0;this.slowT=0;let guard=0;while(this.tweens.length&&guard++<400){const t=this.tweens.shift();try{t.fn(1,0);}catch{}t.res();}}
 slow(seconds,k=.3){if(this.skipping)return;this.slowT=seconds;this.slowK=k;}
 sfx(name){if(this.skipping||!this.sound)return;for(const [f,d,w,v,delay] of SFX[name]||[]){if(delay)setTimeout(()=>{if(!this.skipping)this.sound(f,d,w,v);},delay/this.timeScale);else this.sound(f,d,w,v);}}
 // ── Effects ────────────────────────────────────────────────────────────────────────────────
 own(x){this.trash.push(x);return x;}
 glowMat(color,k=2,opacity=1){return this.own(new T.MeshBasicMaterial({color:hdr(color,k),transparent:true,opacity,toneMapped:false,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));}
 add(o){this.fx.add(o);return o;}
 drop(o){o?.removeFromParent();}
 // Fastens a prop to a piece for the length of the scene.
 attach(g,o){g.add(o);this.attached.push(o);return o;}
 puff(p,n,color,o={}){if(this.skipping)return;this.particles.burst(p.x,p.y,p.z,Math.max(1,Math.round(n*(this.lite?.3:.6))),color,o);}
 sparks(p,n=24,color=GOLD){this.puff(p,n,color,{speed:7,life:.35,gravity:-9,up:1.5,spread:.3});this.puff(p,Math.ceil(n/3),0xffffff,{speed:4,life:.2,gravity:0,up:.5,spread:.2});}
 dust(p,n=14){this.puff(new T.Vector3(p.x,.06,p.z),n,0x9a8fb0,{speed:1.6,life:.8,gravity:.4,up:.25,spread:1.4});}
 motes(p,n,color){this.puff(p,n,color,{speed:.9,life:1,gravity:1.4,up:.6,spread:1.2});}
 // A shockwave ring spreading across the squares.
 ring(p,color,{r0=.25,r1=2.6,dur=.5,y=.03,width=.16,k=1.3}={}){if(this.skipping)return;const m=this.add(new T.Mesh(this.own(new T.RingGeometry(1-width,1,48).rotateX(-Math.PI/2)),this.glowMat(color,k)));m.position.set(p.x,y,p.z);m.scale.setScalar(r0);this.tween(dur,q=>{const e=easeOut(q);m.scale.setScalar(r0+(r1-r0)*e);m.material.opacity=1-q;}).then(()=>this.drop(m));}
 // A blade's trail: an arc of light swept around a point.
 slashArc(p,{yaw=0,tilt=0,roll=0,r=.9,arc=2.4,color=0xffffff,dur=.22,width=.22}={}){if(this.skipping)return;const m=this.add(new T.Mesh(this.own(new T.RingGeometry(r*(1-width),r,28,1,-arc/2,arc)),this.glowMat(color,2.6)));m.position.copy(p);m.rotation.order='YXZ';m.rotation.set(-Math.PI/2+tilt,yaw,roll);
  this.tween(dur,q=>{m.rotation.z=roll+(q-.5)*1.2;m.material.opacity=1-q*q;m.scale.setScalar(1+q*.25);}).then(()=>this.drop(m));}
 // A streak between two points that fades: thrusts, dashes, shots.
 streak(a,b,color,{w=.07,dur=.25}={}){if(this.skipping)return;const m=this.add(new T.Mesh(this.geo.tube,this.glowMat(color,2.4)));m.position.copy(a);m.lookAt(b);m.scale.set(w,w,a.distanceTo(b));this.tween(dur,q=>{m.material.opacity=1-q;m.scale.x=m.scale.y=w*(1-q*.7);}).then(()=>this.drop(m));}
 // A beam the caller animates: returns {set(a,b,radius), fade(), off()}.
 beam(color){const outer=this.add(new T.Mesh(this.geo.tube,this.glowMat(color,2))),core=this.add(new T.Mesh(this.geo.tube,this.glowMat(0xffffff,2.5)));const set=(a,b,r)=>{for(const [m,k] of [[outer,1],[core,.4]]){m.position.copy(a);m.lookAt(b);m.scale.set(r*k,r*k,a.distanceTo(b));}};
  return {set,opacity:o=>{outer.material.opacity=o;core.material.opacity=o;},off:()=>{this.drop(outer);this.drop(core);}};}
 // A spinning circle of runes, flat on the board or facing any direction.
 sigil(p,color,r=1,{flat=true,k=1.8}={}){const m=this.add(new T.Mesh(flat?this.own(new T.PlaneGeometry(2,2).rotateX(-Math.PI/2)):this.own(new T.PlaneGeometry(2,2)),this.own(new T.MeshBasicMaterial({map:this.sigilTex,color:hdr(color,k),transparent:true,opacity:1,toneMapped:false,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}))));m.position.copy(p);m.scale.setScalar(r);return m;}
 glowBall(color,r=.12,k=2.6){const m=this.add(new T.Mesh(this.geo.ball,this.own(new T.MeshBasicMaterial({color:hdr(color,k),toneMapped:false}))));m.scale.setScalar(r);return m;}
 // A soft transparent copy of a piece's body left behind as an afterimage.
 ghost(g,color,dur=.35){if(this.skipping)return;const body=g.children.find(c=>c.userData.slot==='body');if(!body)return;const m=this.add(new T.Mesh(body.geometry,this.glowMat(color,1.2,.6)));m.position.copy(g.position);m.rotation.copy(g.rotation);m.scale.copy(g.scale);this.tween(dur,q=>{m.material.opacity=.6*(1-q);m.scale.multiplyScalar(1+.01);}).then(()=>this.drop(m));}
 // Tumbling chunks with simple physics: stone blocks, glass shards, a helmet, a crown.
 debris(p,n,color,{speed=3,up=2.5,dir=null,size=.1,life=1.1,shape='box',glow=false,gravity=-11,spread=.3,bounce=.35,delay=0,mesh=null}={}){const out=[];if(this.skipping)return out;n=mesh?1:Math.max(1,Math.round(n*(this.lite?.5:1)));
  const mat=mesh?null:glow?this.glowMat(color,2.2):this.own(new T.MeshStandardMaterial({color,roughness:.5,metalness:.3,emissive:color,emissiveIntensity:.15,transparent:true}));
  for(let i=0;i<n;i++){const m=mesh||new T.Mesh(this.geo[shape]||this.geo.box,mat);if(!mesh){m.position.set(p.x+(Math.random()-.5)*spread,p.y+(Math.random()-.5)*spread,p.z+(Math.random()-.5)*spread);m.scale.setScalar(size*(.6+Math.random()*.8));m.rotation.set(Math.random()*6,Math.random()*6,0);}
   const a=Math.random()*Math.PI*2,v=new T.Vector3(Math.cos(a),0,Math.sin(a)).multiplyScalar(speed*(.3+Math.random()*.7));v.y=up*(.5+Math.random()*.8);if(dir)v.addScaledVector(dir,speed);
   const c={m,v,w:new T.Vector3((Math.random()-.5)*14,(Math.random()-.5)*14,(Math.random()-.5)*14),life,max:life,gravity,bounce,delay:typeof delay==='function'?delay(i):delay,s:m.scale.x,floor:size*.4};this.add(m);this.chunks.push(c);out.push(c);}return out;}
 // An impact: hit-stop, shake, a flash of light, sparks, and everyone watching flinches.
 hit(p,power=1,color=0xffffff,{sparks=true}={}){if(this.skipping)return;this.hitstop=Math.max(this.hitstop,.03+.07*power);this.stage.shake(Math.min(1,.2+.42*power));this.stage.flashOnce(0xffffff,Math.min(.4,.04+.14*power),false);
  this.flashLight.position.set(p.x,p.y+.3,p.z);this.flashLight.color.set(color);this.flashLight.intensity=12*power;if(sparks)this.sparks(p,Math.round(10+14*power),GOLD);this.puff(p,Math.round(10*power),color,{speed:5,life:.5,up:1.5,spread:.4});
  this.flinchT=0;this.flinchAmp=.1+.12*power;this.flinchAt=p.clone();if(power>=.9)this.crowdHop=1;}
 title(text,red=false,sub=''){if(this.skipping)return;for(const old of this.host.querySelectorAll('.chess-title'))old.remove();const el=document.createElement('div');el.className='chess-title'+(red?' is-red':'');el.textContent=text;if(sub){const s=document.createElement('small');s.textContent=sub;s.style.cssText='display:block;margin-top:6px;font:700 clamp(9px,1.5vw,13px)/1 var(--ui-mono,monospace);letter-spacing:3px;opacity:.85;text-transform:uppercase';el.append(s);}this.host.append(el);setTimeout(()=>el.remove(),1900);}
 // ── Camera shots ───────────────────────────────────────────────────────────────────────────
 // A shot frames a box w×h around `at` (a point or a function returning one). yaw swings the camera
 // around the fight: 0 is behind the attacker, π/2 side-on, π behind the defender. pitch tilts it
 // up from the floor. dur 0 is a cut; drift orbits and dolly pushes in (negative) over time.
 cam({at,yaw=Math.PI/2,pitch=.25,w=3.4,h=2.4,dur=0,drift=0,dolly=0,fov=40}){if(this.skipping&&this.cine){Object.assign(this.cine,{at,yaw,pitch,w,h,drift:0,dolly:0,fov,t:1,dur:0});return;}
  this.cine={at,yaw,pitch,w,h,drift,dolly,fov,t:0,dur,fromPos:this.camera.position.clone(),fromAim:this.aim.clone(),fromFov:this.camera.fov};this.host.classList.add('cinematic');}
 endCinema(){this.cine=null;this.host.classList.remove('cinematic');}
 // Sets which way shots are measured from: `back` points from the action toward camera yaw 0.
 axis(back,side){this.shotBack=back.clone().setY(0).normalize();this.shotSide=side.clone().setY(0).normalize();}
 // Shots for scenes that are not duels are measured from the player's side of the board.
 playerAxis(){const f=this.flipped?-1:1;this.axis(new T.Vector3(0,0,f),new T.Vector3(f,0,0));}
 // Lights down on the hall, up on the two squares; the board's edge takes the attacker's colour.
 arena(on,{at=null,color=0xffffff,line=null}={}){this.dimTarget=on?1:0;this.stageLine=on?line:null;this.edgeTarget=on?hdr(color,2.2):hdr(GOLD,1.5);
  if(on&&at){this.duelSpot.position.set(at.x,6.5,at.z);this.duelSpot.target.position.set(at.x,0,at.z);this.duelSpot.target.updateMatrixWorld();this.duelRim.color.set(color);this.duelAt=at.clone();}}
 // ── Moves ──────────────────────────────────────────────────────────────────────────────────
 // Slides (or, for knights, leaps) a piece from one square to another.
 async glide(g,from,to,{lift=.35,dur=.42}={}){const a=sqPos(from),b=sqPos(to),h=g.userData.t==='n'?1.1:lift;await this.tween(dur,k=>{const e=ease(k);g.position.lerpVectors(a,b,e);g.position.y=Math.sin(Math.PI*e)*h;});g.position.copy(b);
  if(!this.reduced)this.puff(new T.Vector3(b.x,.05,b.z),10,this.teamColor(g.userData.c),{speed:2,life:.4,gravity:0,up:.4,spread:.4});}
 // Plays a move on the board: m = {from,to,piece,captured,promo,flag}. mode: 'full', 'quick' or 'off'.
 async play(m,{battle=true,mode=battle?'full':'off',reduced=false}={}){this.reduced=reduced;this.skipping=false;const g=this.pieces.get(m.from);if(!g)return;if(reduced)mode='off';
  const capSq=m.flag==='e'?m.to+(m.piece==='P'?8:-8):m.to,victim=m.captured?this.pieces.get(capSq):null,castle=m.flag==='k'||m.flag==='q';
  // Whatever a scene does, it ends: a watchdog skips anything that runs long (a hidden tab, a stuck frame).
  const dog=setTimeout(()=>this.skip(),this.debug?.freezeAt!=null?240000:11000);this.cast.add(g);if(victim)this.cast.add(victim);
  try{
   if(victim&&mode!=='off')await this.battle(g,victim,m,capSq,mode);
   else{if(victim){this.pieces.delete(capSq);this.shatter(victim);}
    if(castle){const rf=m.flag==='k'?m.to+1:m.to-2,rt=m.flag==='k'?m.to-1:m.to+1,rook=this.pieces.get(rf);if(rook){this.cast.add(rook);this.pieces.delete(rf);this.pieces.set(rt,rook);if(mode==='off')await Promise.all([this.glide(g,m.from,m.to),this.glide(rook,rf,rt,{lift:.7,dur:.5})]);else await castling(this,g,rook,m,rf,rt);rook.position.copy(sqPos(rt));}else await this.glide(g,m.from,m.to);}
    else await this.glide(g,m.from,m.to);}
   if(victim){this.pieces.delete(capSq);victim.removeFromParent();}this.pieces.delete(m.from);this.pieces.set(m.to,g);this.settle(g,m.to);
   if(m.promo){if(mode==='off'){g.removeFromParent();const n=this.makePiece(m.promo);n.position.copy(sqPos(m.to));this.pieces.set(m.to,n);}else await promotion(this,m.to,m.promo,mode);}
   if(victim&&mode!=='off')this.rivalReact(g.userData.c===(this.flipped?'w':'b')?'cheer':'slam');
  }catch(e){console.error('chess scene',e);}
  finally{clearTimeout(dog);this.cleanup();const now=this.pieces.get(m.to);if(now)this.settle(now,m.to);}}
 // Puts a piece squarely back on its square, facing home.
 settle(g,sq){g.position.copy(sqPos(sq));g.rotation.set(0,this.homeYaw(g.userData.c),0);g.scale.setScalar(1);g.visible=true;g.userData.vis=1;}
 // The plain capture, when battles are off.
 shatter(g,big=false){const p=g.position;this.particles.burst(p.x,.5,p.z,big?90:40,this.teamColor(g.userData.c),{speed:big?8:5,life:.9,gravity:-6,up:3,spread:.5});this.cast.add(g);this.tween(.35,k=>{g.scale.setScalar(Math.max(.001,1-k));g.position.y=k*.6;}).then(()=>g.removeFromParent());}
 // Ends any scene: props away, lights and time back to normal.
 cleanup(){for(const o of this.attached)o.removeFromParent();this.attached=[];for(const o of [...this.fx.children])o.removeFromParent();this.chunks=[];for(const x of this.trash)x.dispose?.();this.trash=[];
  this.endCinema();this.arena(false);this.shotScale=1;this.hitstop=0;this.slowT=0;this.timeScale=1;this.fighting=false;this.cast.clear();this.checkLight.intensity=0;this.flashLight.intensity=0;this.skipping=false;
  for(const [s,g] of this.pieces){g.visible=true;if(!g.parent)this.scene.add(g);}}
 // ── The duel ───────────────────────────────────────────────────────────────────────────────
 fighter(g){g.rotation.order='YXZ';return {g,t:g.userData.t,c:g.userData.c,col:this.teamColor(g.userData.c),h:g.userData.h,gear:{},guard:[]};}
 face(F,p){F.g.rotation.set(0,Math.atan2(p.x-F.g.position.x,p.z-F.g.position.z),0);}
 begin(seconds=1){this.sceneN=(this.sceneN||0)+1;this.fighting=true;this.fightClock=0;this.timeScale=seconds;}
 async battle(att,vic,m,capSq,mode){const quick=mode==='quick',ep=m.flag==='e',roll=this.debug?.variant??Math.floor(Math.random()*2),M=matchup(att.userData.t,vic.userData.t,roll),flip=this.flipped?-1:1;
  const P=sqPos(capSq),from=sqPos(m.from),dir=P.clone().sub(from).setY(0),dist=dir.length()||1;dir.normalize();
  let side=new T.Vector3(-dir.z,0,dir.x);if(Math.abs(side.z)>.05?side.z*flip<0:side.x*P.x>0)side.negate();
  const gap=Math.min(dist,1.7),start=P.clone().addScaledVector(dir,-gap),mid=P.clone().addScaledVector(dir,-gap/2),A=this.fighter(att),D=this.fighter(vic);
  const X={S:this,A,D,P,start,dir,side,mid,M,quick,ep,to:sqPos(m.to),ac:A.col,dc:D.col,hitDir:dir.clone(),stop:P.clone().addScaledVector(dir,-.84)};this.X=X;
  this.begin(quick?2:1);this.shotScale=Math.max(.7,Math.min(1,Math.max(A.h,D.h)/1.25));this.axis(dir.clone().negate(),side);this.arena(true,{at:mid,color:A.col,line:[start.clone().addScaledVector(dir,-.6),P.clone().addScaledVector(dir,1.1)]});
  // The arena opens: a title card, the attacker crosses the board to the duel, both pieces wake up.
  if(!quick){this.title(ep?'EN PASSANT':M.card,false,ep?'Caught in passing':M.title);this.sfx('doom');}
  this.cam({at:mid.clone().setY(.6),yaw:1.15,pitch:.42,w:4.6,h:3.2,dur:quick?.25:.5,drift:.12});
  if(dist>gap+.05){this.streak(from.clone().setY(.5),start.clone().setY(.5),A.col,{w:.1,dur:.4});this.sfx('whoosh');await this.tween(.26,k=>{att.position.lerpVectors(from,start,easeOut(k));});}
  att.position.copy(start);this.face(A,P);this.face(D,start);gearUp(X);
  if(!quick){this.ring(start,A.col,{r1:1.1,dur:.4});this.ring(P,D.col,{r1:1.1,dur:.4});await this.tween(.3,k=>{const h=Math.sin(k*Math.PI)*.22,s=1+Math.sin(k*Math.PI)*.12;att.position.y=h;vic.position.y=h*.7;att.scale.setScalar(s);vic.scale.setScalar(s);});
   await BRACE[M.brace](X);}
  // The attack ends on its decisive blow; then the defender goes out in its own way.
  if(ep)await enPassant(X);else await ATTACK[M.attack](X);
  await DEFEAT[M.defeat](X);vic.visible=false;
  if(!quick&&!m.promo)await VICTORY[M.victory](X);
  // The victor takes the square.
  const a=att.position.clone(),b=X.to,y0=att.rotation.y,y1=this.homeYaw(att.userData.c),dy=Math.atan2(Math.sin(y1-y0),Math.cos(y1-y0));this.cam({at:b.clone().setY(.5),yaw:1.2,pitch:.5,w:4.4,h:3.2,dur:.35});
  await this.tween(.32,k=>{const e=ease(k);att.position.lerpVectors(a,b,e);att.position.y=Math.sin(e*Math.PI)*.3;att.rotation.set(att.rotation.x*(1-e),y0+dy*e,att.rotation.z*(1-e));att.scale.setScalar(1);});this.dust(b,6);}
 // The decisive blow of a duel: the heavy impact, the defender's guard breaking, a breath of slow motion.
 finalHit(X,power=1,at=null){const p=at||X.P.clone().setY(.6);this.hit(p,1.1*power,X.ac);this.sfx('impact');this.ring(X.P,X.ac,{r1:3.2,dur:.6});if(!this.lite)this.ring(X.P,0xffffff,{r1:1.8,dur:.35,width:.08});this.breakGuard(X.D);this.slow(.55,.28);}
 breakGuard(D){for(const o of D.guard){if(o.userData.keep)continue;const w=new T.Vector3();o.getWorldPosition(w);this.puff(w,14,D.col,{speed:4,life:.5,up:1.5});o.removeFromParent();}D.guard=D.guard.filter(o=>o.userData.keep);}
 // ── Other scenes ───────────────────────────────────────────────────────────────────────────
 // A check: `from` lists the squares of the pieces giving it.
 async check(s,from=[]){if(this.reduced)return;this.skipping=false;const dog=setTimeout(()=>this.skip(),this.debug?.freezeAt!=null?240000:6000);const g=this.pieces.get(s);if(g)this.cast.add(g);try{await checkScene(this,s,from);}catch(e){console.error('chess scene',e);}finally{clearTimeout(dog);this.cleanup();if(g)this.settle(g,s);}}
 // Checkmate: the full finisher on the losing king at square s.
 async checkmate(s,winner,from=[]){this.skipping=false;const dog=setTimeout(()=>this.skip(),this.debug?.freezeAt!=null?240000:14000);const g=this.pieces.get(s);if(g)this.cast.add(g);let crown=null;try{crown=await checkmateScene(this,s,winner,from);}catch(e){console.error('chess scene',e);}finally{clearTimeout(dog);this.cleanup();if(crown&&!this.skippedOut){this.keepsake=crown;this.scene.add(crown);}this.rivalReact(winner===(this.flipped?'w':'b')?'gloat':'despair');}}
 // ── Frame ─────────────────────────────────────────────────────────────────────────────────
 frame(now,{reduced=false}={}){if(!this.ready||this.dead)return false;const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;this.reduced=reduced;
  // Fight time: frozen by hit-stop (and the debug freeze), stretched by slow motion, sped up in quick mode.
  let frozen=false;if(this.fighting){if(this.debug?.freezeAt!=null&&this.fightClock>=this.debug.freezeAt)frozen=true;else this.fightClock+=dt;}
  let sdt=0;if(!frozen){if(this.hitstop>0)this.hitstop-=dt;else{sdt=dt*this.timeScale*(this.slowT>0?this.slowK:1);if(this.slowT>0)this.slowT-=dt;}}const cdt=frozen?0:dt;
  if(sdt>0)for(const t of [...this.tweens]){t.e+=sdt;const k=Math.min(1,t.e/t.dur);try{t.fn(k,sdt);}catch(e){console.error('chess tween',e);}if(k>=1){const i=this.tweens.indexOf(t);if(i>=0)this.tweens.splice(i,1);t.res();}}
  for(let i=this.chunks.length-1;i>=0&&sdt>0;i--){const c=this.chunks[i];if(c.delay>0){c.delay-=sdt;continue;}c.life-=sdt;c.v.y+=c.gravity*sdt;c.m.position.addScaledVector(c.v,sdt);c.m.rotation.x+=c.w.x*sdt;c.m.rotation.y+=c.w.y*sdt;c.m.rotation.z+=c.w.z*sdt;
   if(c.m.position.y<c.floor&&c.v.y<0){c.m.position.y=c.floor;c.v.y*=-c.bounce;c.v.x*=.6;c.v.z*=.6;c.w.multiplyScalar(.5);c.onLand?.(c);c.onLand=null;}if(c.life<.3)c.m.scale.setScalar(Math.max(.001,c.s*c.life/.3));if(c.life<=0){c.m.removeFromParent();this.chunks.splice(i,1);}}
  this.stage.resize();const real=now/1000,cam=this.camera,aspect=cam.aspect||1,flip=this.flipped?-1:1;
  // Lights ease between the resting hall and the arena.
  this.dim+=(this.dimTarget-this.dim)*Math.min(1,dt*6);const d=this.dim,L=this.lightBase;this.hemi.intensity=L.hemi*(1-d*.6);this.key.intensity=L.key*(1-d*.9);this.rimA.intensity=this.rimB.intensity=L.rim*(1-d*.6);this.duelSpot.intensity=d*2.4;this.duelRim.intensity=d*5;this.stage.bloomBase=.5-d*.36;
  if(this.duelAt&&d>.01){const c=this.cine?cam.position:this.duelAt;this.duelRim.position.set(this.duelAt.x+(this.duelAt.x-c.x)*.4,2.4,this.duelAt.z+(this.duelAt.z-c.z)*.4);}
  this.flashLight.intensity*=Math.max(0,1-dt*9);this.edgeColor.lerp(this.edgeTarget,Math.min(1,dt*5));this.edgeMat.color.copy(this.edgeColor).multiplyScalar(d>.05?1+Math.sin(real*9)*.18:1);
  for(const [m,o] of this.shafts)m.material.uniforms.uOpacity.value=o*Math.max(0,1-d*1.2);if(this.candles)this.candles.material.size=1.5+Math.sin(real*11)*.06+Math.sin(real*23)*.04;
  if(this.crowd){this.crowdHop=Math.max(0,this.crowdHop-dt*2.2);this.crowd.position.y=4.4+Math.abs(Math.sin(this.crowdHop*Math.PI*2))*.35*this.crowdHop+(reduced?0:Math.sin(real*1.3)*.03);}
  this.frameRival(real,dt,reduced,flip);
  // The resting camera is fitted to the view: far enough back that all eight ranks and both
  // sides of the board show at any shape of screen, from a folded phone to a wide monitor.
  const top=this.view==='top',vfov=top?36:40,tanV=Math.tan(vfov*Math.PI/360),tanH=tanV*aspect,el=top?Math.PI/2-.001:.74,dist=Math.max((top?4.95:5.3)/tanH,(top?4.95:4.3)/tanV);
  let pos=new T.Vector3(0,Math.sin(el)*dist,Math.cos(el)*dist*flip),at=new T.Vector3(0,top?0:.3,top?0:-.9*flip),fov=vfov;
  if(this.cine){const c=this.cine;c.t+=cdt;const f=typeof c.at==='function'?c.at():c.at,cf=c.fov,tv=Math.tan(cf*Math.PI/360),th=tv*aspect,yaw=c.yaw+c.drift*c.t,D=(this.shotScale||1)*Math.max(c.w/2/th,c.h/2/tv)*Math.max(.45,1+c.dolly*c.t),ch=Math.cos(c.pitch);
   const to=f.clone().addScaledVector(this.shotBack,Math.cos(yaw)*ch*D).addScaledVector(this.shotSide,Math.sin(yaw)*ch*D);to.y=Math.max(.22,f.y+Math.sin(c.pitch)*D);
   const k=c.dur>0?ease(Math.min(1,c.t/c.dur)):1;pos=c.fromPos.clone().lerp(to,k);at=c.fromAim.clone().lerp(f,k);fov=c.fromFov+(cf-c.fromFov)*k;cam.position.copy(pos);this.aim.copy(at);}
  else{if(!reduced&&!top)pos.x+=Math.sin(real*.15)*.25;cam.position.lerp(pos,Math.min(1,dt*4));this.aim.lerp(at,Math.min(1,dt*4));fov=cam.fov+(vfov-cam.fov)*Math.min(1,dt*5);}
  this.stage.applyShake(real,reduced);cam.lookAt(this.aim);cam.fov=fov;cam.updateProjectionMatrix();
  if(this.checkSq>=0&&!this.cine&&!reduced){const p=sqPos(this.checkSq);this.checkLight.position.set(p.x,1.4,p.z);this.checkLight.intensity=8+Math.sin(real*6)*6;}else if(!this.cine)this.checkLight.intensity=0;
  this.framePieces(real,dt,reduced);
  if(this.pulse.length){const k=reduced?1:1+Math.sin(real*5)*.12;for(const m of this.pulse)m.scale.setScalar(k);}if(this.cine)this.hoverMark.visible=false;
  this.markGroup.visible=!this.cine;this.labels.visible=!this.cine;this.particles.update(sdt>0?sdt:frozen?0:dt*.2);this.stage.render(dt,real,{reduced,aberration:this.cine?.002:.001});return true;}
 // Everyone not in the scene: idles, lifts when selected, ducks out of the camera's way, turns to
 // watch a duel and flinches when a blow lands.
 framePieces(real,dt,reduced){const cine=!!this.cine,camP=this.camera.position,f=this.aim,line=this.stageLine,seg=new T.Vector3().subVectors(f,camP),len2=seg.lengthSq()||1,tmp=new T.Vector3();this.flinchT+=dt;
  for(const [sq,g] of this.pieces){if(this.cast.has(g)||g.userData.fallen)continue;const u=g.userData,home=sqPos(sq);let vis=1,yaw=this.homeYaw(u.c),y=sq===this.selSq&&!cine?.32+(reduced?0:Math.sin(real*5)*.04):0;
   if(cine){tmp.subVectors(home,camP);tmp.y+=.5;const t=tmp.dot(seg)/len2,off=tmp.addScaledVector(seg,-t).length();if((t>.04&&t<.93&&off<.85)||home.distanceTo(camP)<1.7)vis=0;
    if(line){const a=line[0],b=line[1],ab=tmp.subVectors(b,a),q=Math.max(0,Math.min(1,new T.Vector3().subVectors(home,a).dot(ab)/(ab.lengthSq()||1)));if(home.distanceTo(new T.Vector3().copy(a).addScaledVector(ab,q))<1.15)vis=0;}
    if(this.duelAt&&this.dim>.3){const dx=this.duelAt.x-home.x,dz=this.duelAt.z-home.z;if(dx*dx+dz*dz<30)yaw=Math.atan2(dx,dz);}
    if(this.flinchAt&&this.flinchT<1){const w=(this.flinchT-home.distanceTo(this.flinchAt)*.05)/.26;if(w>0&&w<1)y+=Math.sin(w*Math.PI)*this.flinchAmp;}}
   u.vis+=(vis-u.vis)*Math.min(1,dt*(vis?7:12));const s=Math.max(.001,u.vis),breath=reduced?0:Math.sin(real*1.7+u.seed)*.012;g.scale.set(s,s*(1+breath),s);
   g.position.x=home.x;g.position.z=home.z;g.position.y=Math.abs(y-g.position.y)<.002?y:g.position.y+(y-g.position.y)*Math.min(1,dt*14);
   const want=yaw+(reduced||cine?0:Math.sin(real*.6+u.seed*3)*.05),dy=Math.atan2(Math.sin(want-g.rotation.y),Math.cos(want-g.rotation.y));g.rotation.set(0,g.rotation.y+dy*Math.min(1,dt*6),0);}}
 // The rival: breathes, leans in over the board, cheers a capture, slams the table over a loss.
 frameRival(real,dt,reduced,flip){const r=this.rival;if(!r)return;setDawgPose(r,real,reduced?'still':'idle');const root=r.root,act=this.rivalAct;let lean=.06+Math.sin(real*.5)*.03,y=0,arms=0,z=0;
  if(act&&!reduced){act.t+=dt;const t=act.t;if(act.kind==='cheer'||act.kind==='gloat'){const n=act.kind==='gloat'?3.2:1.5;if(t<n){y=Math.abs(Math.sin(t*9))*.35;arms=-2.6;lean=-.1;}else this.rivalAct=null;}
   else if(act.kind==='slam'||act.kind==='despair'){const n=act.kind==='despair'?3:1.1;if(t<n){const k=Math.min(1,t/.16);lean=.55*k*(t<.5?1:Math.max(0,1-(t-.5)/(n-.5)));arms=-1.2*k;z=.5*k;if(!act.done&&t>.16){act.done=true;this.stage.shake(.25);this.dust(new T.Vector3(0,-.1,-5.6*flip),10);this.sound?.(70,.2,'sine',.05);}}else this.rivalAct=null;}
   else if(act.kind==='lean'){lean=.3;z=.3;if(t>2.5)this.rivalAct=null;}}
  root.position.set(0,-.62+y,(-6.9+z)*flip);root.rotation.set(lean,flip>0?0:Math.PI,0,'YXZ');if(arms)for(const l of this.rivalArms||[])l.upper.rotateX(arms);}
 fail(){if(this.dead)return;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.skip();this.rival?.dispose();this.view3d?.remove();this.stage?.dispose();}
}
