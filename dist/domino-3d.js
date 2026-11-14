// Three.js presentation for Domino Dynasty: every room is a pegboard cabinet on a workbench, lit
// like a miniature set. Lacquered dominoes, brass balls, wooden ramps on pegs, coil springs, a toy
// fan, a boxing glove on a scissor arm, see-saws, a big red button with its trapdoor, a conveyor
// belt, the golden bone in its capsule and a bin that watches it come. DominoGame owns every rule;
// this only reads it. Engine (x, y) maps to world (x, y, 0); the pegboard is at z = BACK.
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,quality,radial,glowStops,texture,Stage,Particles,CameraRig,Hud,AmbientLoop,pbr,castShadows} from './three-kit.js';
import {DOMINO,LEVELS,WORLDS,PIECE_LABEL,pieceOf,domTip} from './domino-engine.js';
const DEPTH=.9,BACK=-.8,G=DOMINO.grid,FOV=30,YAW=.42,PX=80;
const hex=n=>'#'+n.toString(16).padStart(6,'0');
// One look per world: pegboard paint, woods, the lacquer colours a domino run cycles through.
const THEME=[
 {board:'#2c6e73',shade:'#235b60',hole:'#122f33',paint:'#3a8389',wood:0xc08a52,dark:0x6a4426,trim:0xffb347,dom:[0xf7ecd4,0xff6b57,0xffc23d,0x2fc4b2],bin:0xe2483d,lamp:0xffc27a,bg:['#2a1a10','#120b07'],mural:'pawn'},
 {board:'#e9b84a',shade:'#d9a23a',hole:'#7a5413',paint:'#f4cf73',wood:0xd9a86a,dark:0x7a5230,trim:0x39c6a8,dom:[0xffffff,0x3f9dff,0x8fd63a,0xff8f3a],bin:0x2f8fe8,lamp:0xfff0c8,bg:['#20303a','#0d151b'],mural:'kennel'},
 {board:'#57306e',shade:'#48265d',hole:'#24102f',paint:'#6b3f85',wood:0xb47a4c,dark:0x4a2c2a,trim:0xff4f9a,dom:[0xfff3e0,0xff4f9a,0x8d6bff,0x3dd6e8],bin:0xffb52e,lamp:0xffb0d0,bg:['#1c1030','#0a0614'],mural:'records'}];
const font=px=>`900 ${px}px "DAWG display","Arial Narrow",Impact,sans-serif`;
// The pegboard: paint, a tone-on-tone mural for the shop, and a peg hole every half meter.
function boardTexture(th){return texture(DOMINO.W*PX,DOMINO.H*PX,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,th.board);g.addColorStop(1,th.shade);c.fillStyle=g;c.fillRect(0,0,w,h);
  c.fillStyle=th.paint;c.strokeStyle=th.paint;c.globalAlpha=.55;c.lineCap='round';
  const disc=(x,y,r)=>{c.beginPath();c.arc(x*PX,h-y*PX,r*PX,0,7);c.fill();};
  if(th.mural==='pawn'){disc(5,14.2,.62);disc(4.05,13.1,.62);disc(5.95,13.1,.62);c.lineWidth=.14*PX;c.beginPath();c.moveTo(5*PX,h-14.9*PX);c.lineTo(5*PX,h-15.6*PX);c.stroke();
   c.font=font(1.5*PX);c.textAlign='center';c.fillText('PAWN',5*PX,h-9.3*PX);c.font=font(.62*PX);c.fillText('BUY  ·  SELL  ·  TOPPLE',5*PX,h-8.3*PX);
   c.lineWidth=.12*PX;c.beginPath();c.arc(1.6*PX,h-3.4*PX,.9*PX,0,7);c.stroke();c.beginPath();c.moveTo(1.6*PX,h-3.4*PX);c.lineTo(1.6*PX,h-4*PX);c.moveTo(1.6*PX,h-3.4*PX);c.lineTo(2.05*PX,h-3.2*PX);c.stroke();}
  else if(th.mural==='kennel'){const paw=(x,y,s,r)=>{c.save();c.translate(x*PX,h-y*PX);c.rotate(r);c.beginPath();c.ellipse(0,0,.34*s*PX,.28*s*PX,0,0,7);c.fill();for(const [dx,dy] of [[-.36,-.36],[-.13,-.52],[.13,-.52],[.36,-.36]]){c.beginPath();c.ellipse(dx*s*PX,dy*s*PX,.12*s*PX,.15*s*PX,0,0,7);c.fill();}c.restore();};
   paw(1.6,14.4,1.3,-.3);paw(3.1,12.9,1.3,.2);paw(7.9,10.4,1.3,.4);paw(8.6,3.4,1.3,-.2);paw(1.3,6.4,1.3,.3);c.font=font(1.5*PX);c.textAlign='center';c.fillText('KENNEL',5.4*PX,h-14.1*PX);c.font=font(.62*PX);c.fillText('GOOD DOGS ONLY',5.4*PX,h-13.2*PX);}
  else{const rec=(x,y,r)=>{disc(x,y,r);c.save();c.globalAlpha=1;c.fillStyle=th.board;disc(x,y,r*.34);c.restore();c.fillStyle=th.paint;c.globalAlpha=.55;disc(x,y,r*.06);};rec(2,13.6,1.25);rec(8.2,9.6,1.05);rec(1.7,3.2,.95);c.font=font(1.35*PX);c.textAlign='center';c.fillText('RECORDS',6*PX,h-14*PX);c.font=font(.62*PX);c.fillText('LOUD  ·  CHEAP  ·  ROUND',6*PX,h-13.1*PX);}
  c.globalAlpha=1;
  for(let y=.25;y<DOMINO.H;y+=G)for(let x=.25;x<DOMINO.W;x+=G){const px=x*PX,py=h-y*PX;c.fillStyle='#ffffff26';c.beginPath();c.arc(px+1.5,py+2,PX*.062,0,7);c.fill();c.fillStyle=th.hole;c.beginPath();c.arc(px,py,PX*.058,0,7);c.fill();}
  const v=c.createRadialGradient(w/2,h*.45,h*.2,w/2,h/2,h*.75);v.addColorStop(0,'#0000');v.addColorStop(1,'#0005');c.fillStyle=v;c.fillRect(0,0,w,h);});}
const woodTexture=(a,b,d)=>texture(512,128,(c,w,h)=>{c.fillStyle=a;c.fillRect(0,0,w,h);for(let i=0;i<46;i++){c.strokeStyle=i%3?b:d;c.globalAlpha=.25+(i%4)*.12;c.lineWidth=1+(i%3);const y=(i*37%h);c.beginPath();c.moveTo(0,y);c.bezierCurveTo(w*.3,y+7-(i%5)*3,w*.65,y-6+(i%4)*3,w,y+2);c.stroke();}c.globalAlpha=1;},{repeat:true});
const crateTexture=()=>texture(256,256,(c,w,h)=>{c.fillStyle='#b98550';c.fillRect(0,0,w,h);c.strokeStyle='#7a5230';c.lineWidth=5;for(let y=0;y<h;y+=64){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}c.lineWidth=22;c.strokeStyle='#9c6c3c';c.strokeRect(11,11,w-22,h-22);c.beginPath();c.moveTo(16,16);c.lineTo(w-16,h-16);c.stroke();c.fillStyle='#4a3020';for(const [x,y] of [[22,22],[w-22,22],[22,h-22],[w-22,h-22]]){c.beginPath();c.arc(x,y,5,0,7);c.fill();}},{repeat:true});
// A domino face: its lacquer colour with white pips either side of the bar.
const pipTexture=(col,seed)=>texture(96,192,(c,w,h)=>{c.fillStyle=col;c.fillRect(0,0,w,h);c.fillStyle='#ffffffee';c.fillRect(12,h/2-3,w-24,6);const pips=n=>[[.5,.5]].concat([[.25,.25],[.75,.75],[.75,.25],[.25,.75],[.25,.5],[.75,.5]]).slice(n%2?0:1,n+(n%2?0:1));
  [[1+seed%6,0],[1+(seed*5+2)%6,h/2]].forEach(([n,oy])=>{for(const [x,y] of pips(n)){c.beginPath();c.arc(x*w,oy+8+y*(h/2-16),8,0,7);c.fill();}});});
const beltTexture=()=>texture(128,32,(c,w,h)=>{c.fillStyle='#22252e';c.fillRect(0,0,w,h);c.fillStyle='#ffd23e';for(let x=0;x<w;x+=32){c.beginPath();c.moveTo(x,h);c.lineTo(x+10,h);c.lineTo(x+22,0);c.lineTo(x+12,0);c.fill();}},{repeat:true});
const stripeTexture=()=>texture(128,32,(c,w,h)=>{c.fillStyle='#f4f1e8';c.fillRect(0,0,w,h);c.fillStyle='#e23b3b';for(let x=-32;x<w;x+=32){c.beginPath();c.moveTo(x,h);c.lineTo(x+16,h);c.lineTo(x+32,0);c.lineTo(x+16,0);c.fill();}},{repeat:true});
const labelTexture=(text,fg,bg)=>texture(256,96,(c,w,h)=>{c.clearRect(0,0,w,h);if(bg){c.fillStyle=bg;c.beginPath();c.roundRect(4,4,w-8,h-8,20);c.fill();}c.font=font(58);c.textAlign='center';c.textBaseline='middle';c.fillStyle=fg;c.fillText(text,w/2,h/2+3);});
const bokehTexture=th=>texture(512,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,th.bg[0]);g.addColorStop(1,th.bg[1]);c.fillStyle=g;c.fillRect(0,0,w,h);for(let i=0;i<34;i++){const x=(i*197)%w,y=(i*131)%h*.8,r=14+(i*53)%44,gr=c.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,hex(th.lamp)+'30');gr.addColorStop(.7,hex(th.lamp)+'18');gr.addColorStop(1,hex(th.lamp)+'00');c.fillStyle=gr;c.fillRect(x-r,y-r,r*2,r*2);}});
const CONFETTI=[0xffd25e,0xff4f9a,0x3dd6e8,0x8fd63a,0xff6b57,0xffffff];
const kindOf=n=>pieceOf(n)?.type||n;

export class ThreeDomino {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.clock=performance.now();this.status='';this.statusSince=performance.now();this.level=-1;this.world=-1;this.worldKey='';this.dawgKey='';this.cam={x:5,y:8,z:1};this.kick=0;this.roll=0;this.focus={x:5,y:8};this.inset={top:90,bottom:120,t:0};}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d domino3d',onFailure:()=>this.fail(),exposure:1.05}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;this.base=new T.PerspectiveCamera(FOV,1,.1,300);
  this.hud=new Hud('<div class="dm-top"><span class="dm-world"></span><b class="dm-name"></b></div><span class="dm-hint"></span><p class="dm-tip" hidden></p><i class="dm-bars" aria-hidden="true"></i>');this.view.append(this.hud.root);
  this.ui={top:this.hud.q('.dm-top'),world:this.hud.q('.dm-world'),name:this.hud.q('.dm-name'),hint:this.hud.q('.dm-hint'),tip:this.hud.q('.dm-tip')};
  this.rig=new CameraRig(this.camera);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  const s=this.scene,high=this.quality==='high',q=this.quality;this.stage.studioEnvironment(.55);if(high)this.stage.hdrEnvironment(undefined,.45);s.background=new T.Color(0x120b07);
  s.add(new T.HemisphereLight(0xfff4e2,0x6a4a30,1.05));this.key=new T.DirectionalLight(0xfff0d8,2.5);this.key.position.set(DOMINO.W/2-7,DOMINO.H/2+9,13);this.key.target.position.set(DOMINO.W/2,DOMINO.H/2,0);s.add(this.key,this.key.target);this.stage.sunShadow(this.key,{size:11,far:60,map:2048,radius:4,bias:-.0004,normalBias:.03});
  this.lamp=new T.PointLight(0xffc27a,high?40:24,22,1.7);this.lamp.position.set(DOMINO.W/2,DOMINO.H+1,3.5);s.add(this.lamp);this.fill=new T.PointLight(0xbfd4ff,high?16:10,26,1.5);this.fill.position.set(DOMINO.W+2,2.5,6);s.add(this.fill);
  this.glowTex=radial(glowStops);this.puffTex=radial([[0,'#ffffffcc'],[.5,'#ffffff66'],[1,'#ffffff00']]);this.particles=new Particles(s,high?520:200,this.glowTex);this.particles.points.material.size=.2;
  const share=g=>{g.userData.shared=true;return g;};
  this.geo={dom:share(new T.BoxGeometry(DOMINO.domW,DOMINO.domH,DEPTH*.86).translate(0,DOMINO.domH/2,0)),ball:share(new T.SphereGeometry(1,high?32:18,high?20:12)),unit:share(new T.BoxGeometry(1,1,1)),disc:share(new T.CylinderGeometry(1,1,1,high?28:14)),quad:share(new T.PlaneGeometry(1,1)),knob:share(new T.SphereGeometry(1,14,10))};
  const col=(c,o={})=>pbr({color:c,roughness:.35,metalness:.05,clearcoat:.7,clearcoatRoughness:.2,...o},q);
  this.mats={brass:pbr({color:0xe8b04a,roughness:.18,metalness:1,envMapIntensity:1.5},q),steel:pbr({color:0xc9d0da,roughness:.25,metalness:1,envMapIntensity:1.3},q),gold:pbr({color:0xffd25e,roughness:.2,metalness:1,emissive:0xffa630,emissiveIntensity:.45},q),
   glass:pbr({color:0xffffff,roughness:.05,metalness:0,transparent:true,opacity:.22,clearcoat:1,envMapIntensity:2,depthWrite:false},q),rubber:pbr({color:0x23252c,roughness:.8,metalness:0},q),red:col(0xe2302f),white:col(0xf6f2e8),yellow:col(0xffc928),placed:col(0xffd23e,{emissive:0xff9a1a,emissiveIntensity:.18}),starter:col(0xe2302f,{emissive:0xff2020,emissiveIntensity:.25}),
   crate:pbr({map:crateTexture(),roughness:.75,metalness:0},q),belt:pbr({map:beltTexture(),roughness:.7,metalness:.1},q),stripe:pbr({map:stripeTexture(),roughness:.45,metalness:.05,clearcoat:.5},q),dark:pbr({color:0x2a2c36,roughness:.5,metalness:.6},q),
   ghostOk:new T.MeshBasicMaterial({color:0x5effc1,transparent:true,opacity:.5,depthWrite:false}),ghostNo:new T.MeshBasicMaterial({color:0xff3d6e,transparent:true,opacity:.5,depthWrite:false}),ghostUp:new T.MeshBasicMaterial({color:0x5ee7ff,transparent:true,opacity:.55,depthWrite:false}),
   dot:new T.MeshBasicMaterial({color:new T.Color(1.6,1.6,1.6),transparent:true,opacity:.9,depthWrite:false,toneMapped:false}),zone:new T.MeshBasicMaterial({color:0x8fe8ff,transparent:true,opacity:.13,depthWrite:false,side:T.DoubleSide})};
  this.domMats=new Map();
  // Confetti and dust live outside the room group so they survive a rebuild.
  this.confetti=new T.InstancedMesh(new T.PlaneGeometry(.2,.12),new T.MeshBasicMaterial({side:T.DoubleSide,toneMapped:false}),high?150:60);this.confetti.frustumCulled=false;this.confetti.visible=false;this.confettiBits=[];s.add(this.confetti);
  this.puffs=Array.from({length:high?28:12},()=>{const sp=new T.Sprite(new T.SpriteMaterial({map:this.puffTex,color:0xe9d9bd,transparent:true,opacity:0,depthWrite:false}));sp.visible=false;sp.userData={life:0};s.add(sp);return sp;});this.puffNext=0;
  this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D ROOM · LIVE');return this;}
 setCamera(){}
 box(parent,w,h,d,mat,x,y,z=0){const m=new T.Mesh(this.geo.unit,mat);m.scale.set(w,h,d);m.position.set(x,y,z);parent.add(m);return m;}
 // World dressing shared by the five rooms of a shop: pegboard, cabinet, bench, lamp, backdrop.
 buildWorld(wi){const s=this.scene,th=this.th=THEME[wi],high=this.quality==='high',q=this.quality,W=DOMINO.W,Hh=DOMINO.H;if(this.shop){this.disposeGroup(this.shop,true);}this.world=wi;const shop=this.shop=new T.Group();s.add(shop);
  for(const k of ['wood','frame','board'])this.mats[k]?.map?.dispose();
  this.mats.wood=pbr({map:woodTexture(hex(th.wood),'#00000030','#ffffff30'),roughness:.55,metalness:0,clearcoat:.25,clearcoatRoughness:.5},q);this.mats.frame=pbr({map:woodTexture(hex(th.dark),'#00000040','#ffffff20'),roughness:.6,metalness:0,clearcoat:.2},q);this.mats.board=pbr({map:boardTexture(th),roughness:.82,metalness:0},q);this.mats.trim=pbr({color:th.trim,roughness:.3,metalness:.1,clearcoat:.8},q);this.mats.bin=pbr({color:th.bin,roughness:.28,metalness:.15,clearcoat:1,clearcoatRoughness:.15},q);
  this.mats.frame.map.repeat.set(3,1);
  const back=new T.Mesh(new T.PlaneGeometry(W,Hh),this.mats.board);back.position.set(W/2,Hh/2,BACK);back.receiveShadow=high;shop.add(back);
  // Cabinet: two posts, a header rail with the shop's plaque, and the bench it stands on.
  for(const x of [-.35,W+.35]){const p=this.box(shop,.7,Hh+1.1,2.4,this.mats.frame,x,Hh/2+.05,BACK+1.1);p.castShadow=p.receiveShadow=high;}
  const rail=this.box(shop,W+1.4,.8,2.4,this.mats.frame,W/2,Hh+.4,BACK+1.1);rail.castShadow=high;
  const plaque=new T.Mesh(new T.PlaneGeometry(5.2,.62),new T.MeshBasicMaterial({map:texture(1024,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.font=font(92);c.textAlign='center';c.textBaseline='middle';c.fillStyle=hex(th.trim);c.fillText(WORLDS[wi].name.toUpperCase(),w/2,h/2+4);}),transparent:true,toneMapped:false}));plaque.position.set(W/2,Hh+.4,BACK+2.32);shop.add(plaque);
  const bench=this.box(shop,W+60,.5,9,this.mats.frame,W/2,-.25,BACK+3.4);bench.receiveShadow=high;this.box(shop,W+60,.24,.3,this.mats.wood,W/2,-.12,BACK+7.9);
  const drop=new T.Mesh(new T.PlaneGeometry(90,50),new T.MeshBasicMaterial({map:bokehTexture(th),toneMapped:false}));drop.position.set(W/2,Hh/2+3,BACK-9);shop.add(drop);
  // The pendant lamp over the cabinet.
  const shade=new T.Mesh(new T.ConeGeometry(1.1,.9,24,1,true),pbr({color:th.trim,roughness:.4,metalness:.3,side:T.DoubleSide},q));shade.position.set(W/2,Hh+1.9,3.2);shop.add(shade);const bulb=new T.Mesh(this.geo.knob,new T.MeshBasicMaterial({color:new T.Color(th.lamp).multiplyScalar(3),toneMapped:false}));bulb.scale.setScalar(.26);bulb.position.set(W/2,Hh+1.6,3.2);shop.add(bulb);this.lamp.color.set(th.lamp);
  // Stock stacked either side of the cabinet (only seen on wide screens).
  if(high){const prop=(x,y,w,h,mat,d=1.6)=>{const m=this.box(shop,w,h,d,mat,x,y,BACK+1.3);m.castShadow=m.receiveShadow=true;return m;};
   for(const side of [-1,1]){const x0=side<0?-2.6:W+2.6;prop(x0,1,2.4,2,this.mats.crate);prop(x0+side*.3,2.8,1.8,1.6,this.mats.crate);prop(x0+side*2.6,.8,2,1.6,this.mats.crate);
    if(th.mural==='records')for(let i=0;i<5;i++){const r=new T.Mesh(this.geo.disc,i%2?this.mats.rubber:this.mats.trim);r.scale.set(.9,.06,.9);r.rotation.x=Math.PI/2;r.position.set(x0+side*(2+i*.12),2.5+(i%2)*.05,BACK+.6+i*.25);r.castShadow=true;shop.add(r);}
    else if(th.mural==='kennel'){const b=new T.Mesh(this.geo.disc,this.mats.trim);b.scale.set(.8,.35,.8);b.position.set(x0+side*2.6,1.78,BACK+1.3);b.castShadow=true;shop.add(b);for(let i=0;i<3;i++){const t=new T.Mesh(this.geo.ball,pbr({color:0xc8f03a,roughness:.9},q));t.scale.setScalar(.3);t.position.set(x0+side*(.2+i*.5),4-(i%2)*.0,BACK+1.3+(i-1)*.3);t.castShadow=true;shop.add(t);}}
    else{const c=new T.Mesh(this.geo.disc,this.mats.brass);c.scale.set(.7,.2,.7);c.rotation.x=Math.PI/2;c.position.set(x0+side*.3,4.4,BACK+1.3);c.castShadow=true;shop.add(c);const f=new T.Mesh(this.geo.disc,this.mats.white);f.scale.set(.58,.22,.58);f.rotation.x=Math.PI/2;f.position.set(x0+side*.3,4.4,BACK+1.32);shop.add(f);}}}}
 disposeGroup(gp,textures=false){gp.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose?.();if(textures&&o.material?.map&&!Object.values(this.mats).includes(o.material)){o.material.map.dispose();o.material.dispose();}});gp.removeFromParent();}
 // The room: its fixed furniture (shelves, crates, belts, trapdoors, buttons, see-saws) and the bin.
 build(g){const lv=g.lv,high=this.quality==='high';if(lv.world!==this.world)this.buildWorld(lv.world);if(this.set)this.disposeGroup(this.set);const set=this.set=new T.Group();this.scene.add(set);this.level=g.level;this.lvRef=lv;this.worldKey='';this.dyn=null;this.belts=[];this.doors=[];this.buttons=[];this.sawMeshes=[];this.ghost=null;this.ghostKey='';this.flag=null;this.flagKey='';
  for(const b of lv.boxes){if(b.kind==='floor')continue;
   if(b.kind==='belt'){const gp=new T.Group();gp.position.set(b.x+b.w/2,b.y+b.h/2,0);const mat=this.mats.belt.clone();mat.map=this.mats.belt.map.clone();mat.map.needsUpdate=true;mat.map.repeat.set(b.w/1.2,1);const top=this.box(gp,b.w-.2,b.h,DEPTH,mat,0,0);for(const sx of [-1,1]){const r=new T.Mesh(this.geo.disc,this.mats.steel);r.scale.set(b.h/2,DEPTH+.1,b.h/2);r.rotation.x=Math.PI/2;r.position.set(sx*(b.w/2-.15),0,0);gp.add(r);}castShadows(gp,this.quality);set.add(gp);this.belts.push({b,mat,rollers:gp.children.slice(1)});this.brackets(set,b,this.mats.dark);continue;}
   const m=this.box(set,b.w,b.h,b.kind==='crate'?DEPTH+.1:DEPTH+.25,b.kind==='crate'?this.mats.crate:this.mats.wood,b.x+b.w/2,b.y+b.h/2);castShadows(m,this.quality);if(b.kind==='shelf'){this.box(set,b.w,.06,.05,this.mats.trim,b.x+b.w/2,b.y+b.h-.03,(DEPTH+.25)/2+.02);this.brackets(set,b,this.mats.steel);}}
  // The workbench top inside the cabinet.
  const fl=this.box(set,lv.W,.5,3.2,this.mats.wood,lv.W/2,.25,BACK+1.6);fl.receiveShadow=high;
  for(const d of lv.doors){const hinge=new T.Group();hinge.position.set(d.x,d.y+.15,0);const flap=this.box(hinge,d.w,.3,DEPTH+.2,this.mats.stripe,d.w/2,0);castShadows(flap,this.quality);set.add(hinge);this.doors.push({d,hinge,a:0});}
  lv.switches.forEach(q=>{const gp=new T.Group();gp.position.set(q.x,q.y,0);const base=this.box(gp,.9,.14,.8,this.mats.yellow,0,.07),btn=new T.Mesh(this.geo.disc,this.mats.red);btn.scale.set(.3,.2,.3);btn.position.y=.2;gp.add(btn);castShadows(gp,this.quality);set.add(gp);this.buttons.push({q,btn,base});});
  lv.saws.forEach(sw=>{const base=new T.Mesh(new T.CylinderGeometry(.08,.5,sw.y-.5,3),this.mats.trim);base.rotation.y=Math.PI/6;base.scale.z=1.5;base.position.set(sw.x,.5+(sw.y-.5)/2,0);castShadows(base,this.quality);set.add(base);const arm=new T.Group();arm.position.set(sw.x,sw.y,0);const pl=this.box(arm,DOMINO.sawLen,.13,DEPTH,this.mats.wood,0,0);for(const sx of [-1,1]){const cup=new T.Mesh(new T.TorusGeometry(.36,.06,8,20),this.mats.trim);cup.rotation.x=Math.PI/2;cup.position.set(sx*1.15,.1,0);arm.add(cup);}const pin=new T.Mesh(this.geo.disc,this.mats.brass);pin.scale.set(.1,DEPTH+.2,.1);pin.rotation.x=Math.PI/2;arm.add(pin);castShadows(arm,this.quality);set.add(arm);this.sawMeshes.push({sw,arm});});
  this.buildBin(set,lv);
  this.ui.tip.textContent=lv.tip;this.ui.tip.hidden=false;this.tipUntil=performance.now()+9000;this.cam.snap=true;}
 brackets(set,b,mat){for(const x of b.w>2.4?[b.x+.4,b.x+b.w-.4]:[b.x+b.w/2]){const peg=this.box(set,.1,.1,-BACK-.3,mat,x,b.y+.1,(BACK+.1)/2-.2);peg.castShadow=this.quality==='high';const br=this.box(set,.08,.34,.08,mat,x,b.y-.17,BACK+.12);br.castShadow=this.quality==='high';}}
 // The bin: enamel walls, a low front lip so the bone shows inside, and a back panel with eyes.
 buildBin(set,lv){const bn=lv.bin,gp=this.binGroup=new T.Group(),m=this.mats.bin,d=DEPTH+.3;gp.position.set(bn.x+bn.w/2,bn.y,0);
  if(bn.open!=='left')this.box(gp,.15,bn.h,d,m,-bn.w/2-.075,bn.h/2);if(bn.open!=='right')this.box(gp,.15,bn.h,d,m,bn.w/2+.075,bn.h/2);
  this.box(gp,bn.w+.3,bn.h+.9,.12,m,0,(bn.h+.9)/2,-d/2+.06);this.box(gp,bn.w+.3,.42,.1,m,0,.21,d/2-.05);this.box(gp,bn.w+.3,.08,d,this.mats.white,0,.02);
  const tag=new T.Mesh(this.geo.quad,new T.MeshBasicMaterial({map:labelTexture('BIN','#ffffff'),transparent:true,toneMapped:false}));tag.scale.set(.9,.34,1);tag.position.set(0,.21,d/2+.01);gp.add(tag);
  this.eyes=[];for(const sx of [-1,1]){const eye=new T.Mesh(this.geo.knob,this.mats.white);eye.scale.set(.27,.27,.12);eye.position.set(sx*.42,bn.h+.42,-d/2+.16);gp.add(eye);const pupil=new T.Mesh(this.geo.knob,this.mats.rubber);pupil.scale.set(.12,.12,.08);pupil.position.set(sx*.42,bn.h+.42,-d/2+.27);gp.add(pupil);this.eyes.push({pupil,x:sx*.42,y:bn.h+.42});}
  castShadows(gp,this.quality);set.add(gp);this.binBounce=0;}
 domMat(i,seed){const th=this.th,key=this.world+':'+i+':'+seed%3;let m=this.domMats.get(key);if(!m){const c=th.dom[i%th.dom.length],face=pbr({map:pipTexture(hex(c),seed),roughness:.3,metalness:.02,clearcoat:.9,clearcoatRoughness:.12},this.quality),body=pbr({color:c,roughness:.3,metalness:.02,clearcoat:.9,clearcoatRoughness:.12},this.quality);m=[face,face,body,body,body,body];this.domMats.set(key,m);}return m;}
 plankMesh(p,placed){const len=Math.hypot(p.x2-p.x1,p.y2-p.y1),gp=new T.Group();gp.position.set((p.x1+p.x2)/2,(p.y1+p.y2)/2,0);gp.rotation.z=Math.atan2(p.y2-p.y1,p.x2-p.x1);this.box(gp,len,.13,DEPTH,placed?this.mats.placed:this.mats.wood,0,0);this.box(gp,len,.1,.06,placed?this.mats.white:this.mats.trim,0,.09,DEPTH/2-.03);this.box(gp,len,.1,.06,placed?this.mats.white:this.mats.trim,0,.09,-DEPTH/2+.03);
  for(const sx of [-1,1])this.box(gp,.09,.09,-BACK,this.mats.steel,sx*(len/2-.25),-.06,BACK/2);castShadows(gp,this.quality);return gp;}
 springMesh(sp,placed){const gp=new T.Group();gp.position.set(sp.x,sp.y,0);const body=new T.Group();gp.add(body);body.rotation.z=-(sp.dir||0)*.32;const pts=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*8;pts.push(new T.Vector3(Math.cos(a)*.24,.03+i/40*.2,Math.sin(a)*.24));}
  const coil=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),this.quality==='high'?80:40,.035,6),this.mats.steel);body.add(coil);const pad=new T.Mesh(this.geo.disc,placed?this.mats.placed:this.mats.red);pad.scale.set(.42,.08,.42);pad.position.y=.27;body.add(pad);const base=new T.Mesh(this.geo.disc,this.mats.dark);base.scale.set(.42,.05,.42);base.position.y=.025;gp.add(base);
  if(sp.dir){const ar=new T.Mesh(new T.ConeGeometry(.13,.3,4),new T.MeshBasicMaterial({color:new T.Color(2,1.6,.4),toneMapped:false}));ar.rotation.z=-sp.dir*.9;ar.position.set(sp.dir*.5,.75,DEPTH/2);gp.add(ar);}castShadows(gp,this.quality);return {gp,body,sq:0};}
 fanMesh(f,placed,parent){const gp=new T.Group();gp.position.set(f.x,f.y,0);const head=new T.Group();head.rotation.y=f.dir>0?0:Math.PI;gp.add(head);const body=new T.Mesh(this.geo.disc,placed?this.mats.placed:this.mats.trim);body.scale.set(.2,.34,.2);body.rotation.z=Math.PI/2;body.position.x=-.12;head.add(body);
  for(const [r,x] of [[.44,.1],[.36,.2],[.44,-.02]]){const ring=new T.Mesh(new T.TorusGeometry(r,.022,6,28),this.mats.steel);ring.rotation.y=Math.PI/2;ring.position.x=x;head.add(ring);}
  const blades=new T.Group();blades.position.x=.08;for(let i=0;i<3;i++){const b=new T.Mesh(this.geo.unit,this.mats.white);b.scale.set(.03,.36,.16);b.position.y=.2;const arm=new T.Group();arm.rotation.x=i*Math.PI*2/3;arm.add(b);blades.add(arm);}head.add(blades);const hub=new T.Mesh(this.geo.knob,this.mats.red);hub.scale.setScalar(.08);hub.position.x=.12;head.add(hub);
  this.box(gp,.1,.1,-BACK,this.mats.steel,-f.dir*.1,-.05,BACK/2);castShadows(gp,this.quality);parent.add(gp);const wind=[];if(this.quality==='high'||placed)for(let i=0;i<7;i++){const sp=new T.Sprite(new T.SpriteMaterial({map:this.puffTex,color:0xffffff,transparent:true,opacity:0,depthWrite:false}));sp.visible=false;parent.add(sp);wind.push(sp);}return {f,blades,wind,spin:0};}
 gloveMesh(q,placed){const gp=new T.Group();gp.position.set(q.x,q.y,0);const body=this.box(gp,.8,.62,DEPTH*.8,placed?this.mats.placed:this.mats.yellow,0,.31);this.box(gp,.82,.1,DEPTH*.8+.02,this.mats.dark,0,.05);const btn=new T.Mesh(this.geo.disc,this.mats.red);btn.scale.set(.16,.1,.16);btn.position.set(-q.dir*.18,.67,0);gp.add(btn);
  const arm=new T.Group();arm.position.set(q.dir*.38,.42,0);gp.add(arm);const rod=this.box(arm,.3,.1,.1,this.mats.steel,q.dir*.15,0);const fist=new T.Group();fist.position.x=q.dir*.3;arm.add(fist);const gl=new T.Mesh(this.geo.ball,this.mats.red);gl.scale.set(.3,.33,.3);fist.add(gl);const th=new T.Mesh(this.geo.ball,this.mats.red);th.scale.set(.14,.2,.14);th.position.set(-q.dir*.02,.2,.16);fist.add(th);const cuff=new T.Mesh(this.geo.disc,this.mats.white);cuff.scale.set(.2,.12,.2);cuff.rotation.z=Math.PI/2;cuff.position.x=-q.dir*.24;fist.add(cuff);castShadows(gp,this.quality);return {q,gp,rod,fist,btn};}
 boneMesh(){const gp=new T.Group(),inner=new T.Group();gp.add(inner);const shaft=new T.Mesh(new T.CylinderGeometry(.05,.05,.3,10).rotateZ(Math.PI/2),this.mats.gold);inner.add(shaft);for(const [x,y] of [[-.16,.055],[-.16,-.055],[.16,.055],[.16,-.055]]){const k=new T.Mesh(this.geo.knob,this.mats.gold);k.scale.setScalar(.085);k.position.set(x,y,0);inner.add(k);}
  const shell=new T.Mesh(this.geo.ball,this.mats.glass);shell.scale.setScalar(DOMINO.boneR);shell.renderOrder=2;gp.add(shell);const band=new T.Mesh(new T.TorusGeometry(DOMINO.boneR,.022,6,32),this.mats.brass);inner.add(band);
  const glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(1.7,1.2,.35),transparent:true,opacity:.5,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));glow.scale.set(1.9,1.9,1);gp.add(glow);castShadows(inner,this.quality);return {gp,inner,glow};}
 // Everything that moves or was placed: rebuilt when the set of placements changes.
 syncWorld(g){const w=g.world();if(w.key===this.worldKey)return;this.worldKey=w.key;if(this.dyn)this.disposeGroup(this.dyn);const dyn=this.dyn=new T.Group(),high=this.quality==='high';this.set.add(dyn);
  let run=0,last=null;this.doms=w.doms.map((d,k)=>{if(last&&(Math.abs(d.y-last.y)>.05||Math.abs(d.x-last.x)>1.6))run++;last=d;const pivot=new T.Group();pivot.position.set(d.x,d.y,0);const m=new T.Mesh(this.geo.dom,d.start?[this.mats.starter,this.mats.starter,this.mats.starter,this.mats.starter,this.mats.starter,this.mats.starter]:d.placed?[this.mats.placed,this.mats.placed,this.mats.placed,this.mats.placed,this.mats.placed,this.mats.placed]:this.domMat(k+run,k));m.rotation.y=YAW;m.castShadow=m.receiveShadow=high;pivot.add(m);dyn.add(pivot);return {d,pivot,m,pop:0};});
  this.arrows=[];for(const d of w.doms)if(d.start){const a=new T.Mesh(new T.ConeGeometry(.2,.46,4).rotateZ(-Math.PI/2*d.start),new T.MeshBasicMaterial({color:new T.Color(2.4,.5,.4),toneMapped:false}));a.position.set(d.x,d.y+DOMINO.domH+.45,0);dyn.add(a);this.arrows.push({a,x:d.x,dir:d.start});}
  this.balls=w.balls.map(b=>{if(b.bone){const bm=this.boneMesh();bm.gp.position.set(b.x,b.y,0);dyn.add(bm.gp);return {b,m:bm.gp,inner:bm.inner,glow:bm.glow,px:b.x};}const m=new T.Mesh(this.geo.ball,b.placed?this.mats.placed:this.mats.brass);m.scale.setScalar(b.r);m.castShadow=m.receiveShadow=high;m.position.set(b.x,b.y,0);dyn.add(m);return {b,m,px:b.x};});
  for(const p of w.planks)dyn.add(this.plankMesh(p,p.placed));
  this.springs=w.springs.map(sp=>{const x=this.springMesh(sp,sp.placed);dyn.add(x.gp);return {...x,sp};});this.fans=w.fans.map(f=>this.fanMesh(f,f.placed,dyn));this.gloves=w.gloves.map(q=>{const x=this.gloveMesh(q,q.placed);dyn.add(x.gp);return x;});
  this.ghost?.removeFromParent();this.ghost=null;this.ghostKey='';}
 // The ghost of the piece under the cursor (green fits, red doesn't, blue picks up), with the
 // engine's forecast drawn as a dotted path: where it rolls, how far it reaches, what it throws.
 syncGhost(g){const show=g.phase==='place'&&g.status!=='over'&&(g.held?!g.held.out:!!g.keyed),pv=show?g.preview():{kind:'none'},key=show?g.level+':'+g.cursor.gx+':'+g.cursor.gy+':'+pv.kind+':'+(pv.name||pv.index)+(g.held?'h':'')+this.worldKey:'';if(key===this.ghostKey)return;this.ghostKey=key;if(this.ghost)this.disposeGroup(this.ghost);this.ghost=null;if(!show)return;
  const gp=this.ghost=new T.Group();this.set.add(gp);const mat=pv.kind==='place'?this.mats.ghostOk:pv.kind==='pickup'?this.mats.ghostUp:this.mats.ghostNo,cx=g.cursor.gx*G,cy=g.cursor.gy*G,name=pv.name||g.lv.palette[pv.index],t=kindOf(name),dir=pieceOf(name)?.dir||0;
  const ring=new T.Mesh(new T.RingGeometry(.3,.4,28),mat);ring.position.set(cx,pv.piece?.y??cy,DEPTH/2+.1);if(pv.piece&&pv.piece.type==='plank')ring.position.y=cy;gp.add(ring);
  const p=pv.piece||{type:t,dir,x:cx,y:cy,x1:cx-1,x2:cx+1,y1:cy+.5*dir,y2:cy-.5*dir};let m;
  if(p.type==='domino'){m=new T.Mesh(this.geo.dom,mat);m.rotation.y=YAW;m.position.set(p.x,p.y,0);}
  else if(p.type==='ball'){m=new T.Mesh(this.geo.ball,mat);m.scale.setScalar(DOMINO.ballR);m.position.set(p.x,p.y,0);}
  else if(p.type==='plank'){m=this.box(gp,Math.hypot(p.x2-p.x1,p.y2-p.y1),.16,DEPTH,mat,(p.x1+p.x2)/2,(p.y1+p.y2)/2);m.rotation.z=Math.atan2(p.y2-p.y1,p.x2-p.x1);}
  else if(p.type==='spring'){m=this.box(gp,.84,.32,DEPTH*.8,mat,p.x,p.y+.16);m.rotation.z=-(p.dir||0)*.32;}
  else if(p.type==='glove'){m=this.box(gp,.8,.8,DEPTH*.8,mat,p.x,p.y+.4);const f=new T.Mesh(this.geo.ball,mat);f.scale.setScalar(.3);f.position.set(p.x+p.dir*.7,p.y+.42,0);gp.add(f);}
  else{m=new T.Mesh(this.geo.disc,mat);m.scale.set(.46,.3,.46);m.rotation.z=Math.PI/2;m.position.set(p.x,p.y,0);}
  if(m&&!m.parent)gp.add(m);
  const fc=pv.kind==='place'?g.forecast():null;if(!fc)return;const z=DEPTH/2+.12;
  const dots=pts=>pts.forEach(([x,y],i)=>{if(i%2&&pts.length>14)return;const d=new T.Mesh(this.geo.knob,this.mats.dot);d.scale.setScalar(.085*(1-i/pts.length*.5));d.position.set(x,y,z);gp.add(d);});
  if(fc.pts)dots(fc.pts);for(const a of fc.arcs||[])dots(a);
  if(fc.zone){const zn=new T.Mesh(this.geo.quad,this.mats.zone);zn.scale.set(fc.zone.w,fc.zone.h,1);zn.position.set(fc.zone.x+fc.zone.w/2,fc.zone.y+fc.zone.h/2,z-.02);gp.add(zn);if(fc.dir)for(let i=0;i<3;i++){const ar=new T.Mesh(new T.ConeGeometry(.16,.4,3).rotateZ(-Math.PI/2*fc.dir),this.mats.dot);ar.position.set(fc.zone.x+fc.zone.w*(fc.dir>0?.25+i*.25:.75-i*.25),fc.zone.y+fc.zone.h/2,z);gp.add(ar);}}}
 // Where the last chain died: a little flag, so the next try has something to aim at.
 syncFlag(g){const mk=g.phase==='place'||g.phase==='failed'?g.marker:null,key=mk?mk.x+':'+mk.y+':'+mk.near:'';if(key===this.flagKey)return;this.flagKey=key;if(this.flag)this.disposeGroup(this.flag,true);this.flag=null;if(!mk)return;const gp=this.flag=new T.Group();gp.position.set(mk.x,mk.y,DEPTH/2+.2);this.set.add(gp);
  const ring=new T.Mesh(new T.RingGeometry(.42,.5,32),new T.MeshBasicMaterial({color:mk.near?0xffd25e:0xff6b6b,transparent:true,opacity:.9,depthWrite:false,toneMapped:false}));gp.add(ring);
  const tag=new T.Mesh(new T.PlaneGeometry(mk.near?2.1:1.9,.6),new T.MeshBasicMaterial({map:labelTexture(mk.near?'SO CLOSE':'IT DIED HERE',mk.near?'#241300':'#ffffff',mk.near?'#ffd25e':'#c0392bdd'),transparent:true,toneMapped:false,depthWrite:false}));tag.position.set(Math.max(1.2-mk.x,Math.min(DOMINO.W-1.2-mk.x,0)),.95,0);gp.add(tag);}
 syncDawg(g,d){const key=d?assetKey(d):'';if(key===this.dawgKey)return;this.dawgKey=key;if(this.dawg){this.dawg.holder.removeFromParent();this.dawg.asset.dispose();}this.dawg=null;if(!d)return;const asset=createDawgAsset(d);asset.root.scale.setScalar(1.5);castShadows(asset.root,this.quality);const holder=new T.Group();holder.add(asset.root);holder.position.set(-3.2,0,BACK+4.6);holder.rotation.y=.7;this.scene.add(holder);this.dawg={asset,holder};}
 prepare(d){this.dawg0=d;}
 puff(x,y,size=.5,n=1,col=0xe9d9bd){for(let i=0;i<n;i++){const sp=this.puffs[this.puffNext=(this.puffNext+1)%this.puffs.length];sp.visible=true;sp.material.color.set(col);sp.position.set(x+(Math.random()-.5)*size*.6,y+Math.random()*size*.3,DEPTH/2+.05);sp.userData={life:.55+Math.random()*.25,max:.8,size:size*(.7+Math.random()*.6),vx:(Math.random()-.5)*1.2,vy:.5+Math.random()*.7};}}
 throwConfetti(x,y){const n=this.confetti.count=this.confetti.instanceMatrix.count,c=new T.Color();this.confettiBits=Array.from({length:n},(_,i)=>{this.confetti.setColorAt(i,c.set(CONFETTI[i%CONFETTI.length]));const a=Math.random()*Math.PI,v=5+Math.random()*8;return {x,y:y+.4,z:0,vx:Math.cos(a)*v*.7,vy:Math.sin(a)*v+3,vz:(Math.random()-.5)*3,r:Math.random()*6,rs:(Math.random()-.5)*14,life:2.6+Math.random()};});if(this.confetti.instanceColor)this.confetti.instanceColor.needsUpdate=true;this.confetti.visible=true;}
 event(e,g){if(!this.ready)return;const st=this.stage,hud=this.hud,P=this.particles,rd=this.reduced,spot=()=>{if(e.x!==undefined)this.action={x:e.x,y:e.y,t:performance.now()};};
  if(e.type==='level'){if(g.lv!==this.lvRef)this.build(g);}
  else if(e.type==='feat'){hud.pop('FEAT: '+e.name.toUpperCase(),'gold');}
  else if(e.type==='go'){hud.pop('GO!','big');this.tipUntil=0;this.ui.tip.hidden=true;this.kick=.6;const d=g.world().doms.find(x=>x.start);this.action=d?{x:d.x,y:d.y+.6,t:performance.now()}:null;}
  else if(e.type==='place'){P.burst(e.x,e.y+.2,DEPTH/2,14,0x5effc1,{speed:2,life:.45,gravity:-3});this.puff(e.x,e.y,.5,2);}
  else if(e.type==='pickup'){P.burst(e.x,e.y+.2,DEPTH/2,8,0x5ee7ff,{speed:2,life:.35});}
  else if(e.type==='grab'){if(this.tipUntil)this.tipUntil=Math.min(this.tipUntil,performance.now()+500);}
  else if(e.type==='nope'){st.shake(.12);hud.pop(e.why.toUpperCase(),'shield');}
  else if(e.type==='knock'){spot();this.puff(e.x+e.dir*.15,e.y-.75,.3);const d=this.doms?.find(x=>Math.abs(x.d.x-e.x)<.01&&Math.abs(x.d.y+DOMINO.domH*.6-e.y)<.01);if(d)d.pop=1;}
  else if(e.type==='flat'){this.puff(e.x+e.dir*1.1,e.y+.05,.55,2);}
  else if(e.type==='hit'||e.type==='thud'){const k=Math.min(1,e.v/10);if(e.type==='hit'||e.bone||k>.3)spot();P.burst(e.x,e.y,DEPTH/2,Math.round(4+k*16),e.type==='thud'?0xffc890:0xffffff,{speed:1.5+k*4,life:.4,gravity:-5});if(e.type==='thud'&&k>.25)this.puff(e.x,e.y+.05,.4+k*.5,2);if(k>.3){st.shake(k*.35);this.kick=Math.max(this.kick,k*.8);}}
  else if(e.type==='spring'){spot();P.burst(e.x,e.y+.3,DEPTH/2,20,0xfff0a0,{speed:3.5,life:.5});const s=this.springs?.find(x=>Math.abs(x.sp.x-e.x)<.01&&Math.abs(x.sp.y-e.y)<.01);if(s)s.sq=1;hud.pop('BOING','dodge');this.kick=Math.max(this.kick,.6);}
  else if(e.type==='glove'){spot();P.burst(e.x+e.dir*.6,e.y,DEPTH/2,34,0xffe9a0,{speed:6,life:.5});this.puff(e.x+e.dir*.5,e.y,.8,3,0xffffff);st.shake(.5);st.flashOnce(0xffffff,.18,rd);hud.pop('POW!','big');this.kick=1;}
  else if(e.type==='switch'){spot();P.burst(e.x,e.y+.2,DEPTH/2,16,0xff5a4a,{speed:2.5,life:.4});hud.pop('CLICK','shield');}
  else if(e.type==='door'){spot();this.puff(e.x,e.y,.7,3);st.shake(.2);}
  else if(e.type==='clack'){this.puff(e.x,e.y,.5,2);st.shake(Math.min(.4,e.v*.04));}
  else if(e.type==='bone'){spot();P.burst(e.x,e.y,DEPTH/2,26,0xffd25e,{speed:3,life:.7,gravity:-3});hud.pop('THE BONE!','gold');}
  else if(e.type==='slow'){this.slowUntil=performance.now()+2600;}
  else if(e.type==='win'){hud.banner(e.stars===3?'PERFECT!':e.stars===2?'GOT IT!':'IN THE BIN!');st.flashOnce(0xffd25e,.4,rd);const bn=g.lv.bin;this.throwConfetti(bn.x+bn.w/2,bn.y+bn.h);for(let i=0;i<3;i++)P.burst(bn.x+bn.w/2,bn.y+.6+i*.3,DEPTH/2,40,[0xffd25e,0x5ee7ff,0xff4fd8][i],{speed:6,life:1.1});this.cheerUntil=performance.now()+2600;this.binBounce=1;this.wonAt=performance.now();this.slowUntil=0;this.kick=1;}
  else if(e.type==='fail'){hud.banner(e.near?'SO CLOSE!':e.why.toUpperCase());this.wobble=performance.now();st.flashOnce(e.near?0xffb52e:0x7a2030,.25,rd);this.slowUntil=0;}
  else if(e.type==='skip'){hud.banner('SKIPPED');}
  else if(e.type==='dynasty'){hud.banner('A DYNASTY');st.flashOnce(0xffd25e,.6,rd);}
  else if(e.type==='over'){st.shake(.3);}}
 // The base camera frames the whole room between the HUD and the dock; picking uses it, so a
 // finger always lands on the same spot of the room however the live camera has zoomed.
 frame(lv){const st=this.stage,vw=st.w||420,vh=st.h||560,now=performance.now();if(now-this.inset.t>400){this.inset.t=now;const vr=this.view.getBoundingClientRect(),dock=this.view.parentElement?.querySelector('.dm-dock:not([hidden])'),top=this.ui.top.getBoundingClientRect();this.inset.top=Math.max(40,Math.min(vh*.3,top.bottom-vr.top+6));this.inset.bottom=dock?Math.min(vh*.35,dock.getBoundingClientRect().height+2):Math.min(120,vh*.16);}
  const top=this.inset.top,bottom=this.inset.bottom,uh=Math.max(120,vh-top-bottom),s=Math.min(vw/(lv.W+.5),uh/(lv.H+.7)),dist=vh/2/(s*Math.tan(FOV*Math.PI/360)),cy=lv.H/2+.1-(vh/2-(top+uh/2))/s;return {s,dist,cx:lv.W/2,cy,vw,vh};}
 pose(cam,f,cx,cy,zoom,roll=0){const d=f.dist/zoom;cam.fov=FOV;cam.aspect=f.vw/f.vh;cam.near=.5;cam.far=400;cam.position.set(cx+d*.05,cy+d*.11,d);cam.up.set(Math.sin(roll),Math.cos(roll),0);cam.lookAt(cx,cy,0);cam.updateProjectionMatrix();cam.updateMatrixWorld();}
 // Where a screen point lands on the play plane, in meters (and as a cell).
 pick(clientX,clientY){if(!this.lastGame)return null;const r=this.stage.canvas.getBoundingClientRect(),nx=((clientX-r.left)/r.width)*2-1,ny=-((clientY-r.top)/r.height)*2+1,f=this.frame(this.lastGame.lv);this.pose(this.base,f,f.cx,f.cy,1);const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(nx,ny),this.base);const hit=new T.Vector3();if(!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),0),hit))return null;return {x:hit.x,y:hit.y,gx:Math.round(hit.x/G),gy:Math.round(hit.y/G)};}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing'||g.phase==='place')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:g.phase==='place'&&g.status==='playing'?t-this.ambient.lastDraw<60000:t-this.statusSince<2500));return true;}
 render(g,d,now){
  this.stage.resize();const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced,lv=g.lv,high=this.quality==='high';this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  if(g.lv!==this.lvRef)this.build(g);this.syncWorld(g);this.syncGhost(g);this.syncFlag(g);this.syncDawg(g,d||this.dawg0);
  const sim=g.sim,w=g.world(),running=!!sim&&g.phase!=='place';
  // Dominoes pivot at their base; balls roll; the capsule tumbles; springs squash; fans turn.
  this.doms.forEach((x,k)=>{const st=sim?sim.doms[k]:null,a=st?st.a:0;x.pivot.rotation.z=-a;x.pop=Math.max(0,x.pop-dt*5);x.m.scale.setScalar(1+x.pop*.12);if(!sim&&!reduced&&x.d.start)x.pivot.rotation.z=-x.d.start*(.05+Math.sin(real*5)*.05);});
  let bonePos=null;this.balls.forEach((x,k)=>{const st=sim?sim.balls[k]:x.b,dx=st.x-x.px;x.px=st.x;x.m.position.set(st.x,st.y,0);
   if(x.b.bone){bonePos=st;x.inner.rotation.z-=dx/x.b.r;if(!sim&&!reduced)x.inner.rotation.y=Math.sin(real*1.4)*.5;x.glow.material.opacity=.42+Math.sin(real*4)*.12;const sp=sim?Math.hypot(st.vx,st.vy):0;if(sp>3&&!reduced&&Math.random()<.5)this.particles.burst(st.x,st.y,DEPTH/2,1,0xffd25e,{speed:.6,life:.5,gravity:-1});}
   else x.m.rotation.z-=dx/x.b.r;});
  this.springs.forEach((s,k)=>{s.sq=Math.max(0,s.sq-dt*4);const f=s.sq>.75?1-(1-s.sq)*2.2:s.sq>0?.45+(.75-s.sq)*.73:1;s.body.scale.y=s.sq>0?Math.max(.45,2.4*f*(s.sq>.75?.5:1)+.2):1;});
  for(const x of this.fans){const on=running&&(x.f.sw===undefined||!!sim.sw[x.f.sw]);x.spin+=((on?30:x.f.sw===undefined?3:0)-x.spin)*Math.min(1,dt*3);x.blades.rotation.x+=dt*x.spin;x.wind.forEach((sp,i)=>{const t=((real*1.3+i/x.wind.length)%1);sp.visible=on&&!reduced;sp.position.set(x.f.x+x.f.dir*(.5+t*(DOMINO.fanLen-.6)),x.f.y+Math.sin(i*2.4+real*2.5)*.55,.1+(i%3)*.2);sp.scale.set(.5+t*.9,.16,1);sp.material.opacity=.4*(1-t)*Math.min(1,t*6);});}
  this.gloves.forEach((x,k)=>{const f=sim?sim.gloves[k].f:0,ext=f>0?(f<.07?f/.07:Math.max(0,1-(f-.07)/.5)):0,L=.3+ext*.85;x.rod.scale.x=L;x.rod.position.x=x.q.dir*L/2;x.fist.position.x=x.q.dir*L;x.btn.position.y=f>0?.63:.67;});
  for(const x of this.doors){const open=!!sim&&g.phase!=='place'&&!!sim.sw[x.d.sw];x.a+=((open?1:0)-x.a)*Math.min(1,dt*(open?14:6));x.hinge.rotation.z=-x.a*1.45;}
  this.buttons.forEach((x,k)=>{const on=!!sim&&g.phase!=='place'&&!!sim.sw[k];x.btn.position.y=on?.12:.2;});
  this.sawMeshes.forEach((x,k)=>{x.arm.rotation.z=sim?sim.saws[k].a:x.sw.tilt*DOMINO.sawLim;});
  for(const x of this.belts){x.mat.map.offset.x-=dt*x.b.belt/1.2;for(const r of x.rollers)r.rotation.y-=dt*x.b.belt*4;}
  // The bin watches the bone and hops when it lands.
  const bn=lv.bin,bc={x:bn.x+bn.w/2,y:bn.y+bn.h/2};if(bonePos&&this.eyes){const dx=bonePos.x-bc.x,dy=bonePos.y-(bn.y+bn.h+.4),l=Math.hypot(dx,dy)||1,near=running&&l<5;for(const e of this.eyes){e.pupil.position.x=e.x+dx/l*.1;e.pupil.position.y=e.y+dy/l*.1;e.pupil.scale.setScalar(near?.15:.12);}this.binBounce=Math.max(0,this.binBounce-dt*1.6);const hop=this.binBounce>0?Math.sin(this.binBounce*Math.PI*3)*this.binBounce:near&&!reduced?Math.sin(real*14)*.03:0;this.binGroup.scale.set(1-hop*.12,1+hop*.2,1);}
  if(this.dawg){const cheer=this.cheerUntil&&now<this.cheerUntil;setDawgPose(this.dawg.asset,real,cheer?'arm':'idle');this.dawg.holder.rotation.y=.7+(sim?Math.sin(real*2)*.1:0);}
  for(const x of this.arrows||[]){x.a.visible=g.phase==='place';x.a.position.x=x.x+x.dir*(.2+Math.sin(real*5)*.14);}
  // Camera. Building: the whole room, leaning in around a carried piece on a small screen.
  // Running: it follows the action down the room, pushes in on big hits, and closes on the bin.
  const f=this.frame(lv),C=this.cam,hw=lv.W/2,hh=f.vh/2/f.s;let zt=1,tx=f.cx,ty=f.cy;
  if(g.phase==='place'&&g.held&&g.held.touch&&!g.held.out&&g.held.fx!==undefined){zt=Math.max(1,Math.min(1.9,62/f.s));tx=f.cx+(g.held.fx-f.cx)*(1-1/zt);ty=f.cy+(g.held.fy-f.cy)*(1-1/zt);}
  else if(running&&!reduced){const won=g.phase==='won',act=this.action&&now-this.action.t<1600?this.action:null,p=won?bc:sim.moved&&bonePos?bonePos:act||this.focus;this.focus={x:this.focus.x+(p.x-this.focus.x)*Math.min(1,dt*5),y:this.focus.y+(p.y-this.focus.y)*Math.min(1,dt*5)};
   zt=Math.max(1.12,Math.min(1.75,58/f.s))*(won?1.25:g.phase==='failed'?1:sim.slow?1.2:1);if(g.phase==='failed')zt=1;const vx=hw/zt*Math.min(1,f.vw/f.s/lv.W),vy=hh/zt;tx=Math.max(Math.min(f.cx,vx-.2),Math.min(Math.max(f.cx,lv.W-vx+.2),this.focus.x));ty=Math.max(Math.min(f.cy,f.cy-hh+vy),Math.min(Math.max(f.cy,f.cy+hh-vy),this.focus.y+.4));if(g.phase==='failed'){tx=f.cx;ty=f.cy;}}
  else this.focus={x:f.cx,y:f.cy};
  const ease=C.snap?1:Math.min(1,dt*(g.held?9:running?2.6:4));C.snap=false;C.x+=(tx-C.x)*ease;C.y+=(ty-C.y)*ease;C.z+=(zt-C.z)*ease;this.kick=Math.max(0,this.kick-dt*3);
  const wob=this.wobble&&now-this.wobble<900&&!reduced?Math.sin((now-this.wobble)/90)*.035*(1-(now-this.wobble)/900):0,flourish=this.wonAt&&now-this.wonAt<1400&&!reduced?Math.sin((now-this.wonAt)/1400*Math.PI*2)*.03:0;
  this.pose(this.camera,f,C.x,C.y,C.z*(1+(reduced?0:this.kick)*.035),wob+flourish);this.stage.applyShake(real,reduced);
  // Confetti and dust.
  if(this.confetti.visible){const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),sc=new T.Vector3(1,1,1),ps=new T.Vector3();let live=0;this.confettiBits.forEach((b,i)=>{b.life-=dt;if(b.life>0){live++;b.vy-=9*dt;b.vx*=1-dt*.8;b.vy*=1-dt*.9;b.x+=b.vx*dt;b.y=Math.max(.52,b.y+b.vy*dt);b.z+=b.vz*dt;b.r+=b.rs*dt;}sc.setScalar(b.life>0?Math.min(1,b.life):0);m.compose(ps.set(b.x,b.y,b.z+DEPTH/2),q.setFromEuler(e.set(b.r,b.r*.7,b.r*1.3)),sc);this.confetti.setMatrixAt(i,m);});this.confetti.instanceMatrix.needsUpdate=true;if(!live)this.confetti.visible=false;}
  for(const sp of this.puffs){const u=sp.userData;if(u.life<=0){sp.visible=false;continue;}u.life-=dt;const k=Math.max(0,u.life/u.max);sp.position.x+=u.vx*dt;sp.position.y+=u.vy*dt;const s2=u.size*(1.6-k);sp.scale.set(s2,s2,1);sp.material.opacity=.5*k;}
  // HUD.
  this.hud.set(this.ui.world,'w',`${WORLDS[lv.world].name.toUpperCase()} · ROOM ${g.level+1} / ${LEVELS.length}`);this.hud.set(this.ui.name,'n',lv.name.toUpperCase());
  const next=g.nextIndex(),hint=g.status==='over'?'':g.phase==='run'?(sim.slow?'…':`CHAIN ${sim.t.toFixed(1)} S`):g.phase==='won'?`CODE ${g.lastCode()}`:g.phase==='failed'?'YOUR PIECES STAY PUT · ADJUST AND GO AGAIN':g.held?(g.held.out?'DRAG IT INTO THE ROOM':g.preview().kind==='place'?'LET GO TO PEG IT IN':'NO ROOM THERE'):next<0?'PRESS GO · OR DRAG A PIECE TO MOVE IT':g.placed.length?'PRESS GO · OR ADD ANOTHER PIECE':'DRAG A PIECE FROM THE TRAY INTO THE ROOM';this.hud.set(this.ui.hint,'h',hint);
  if(this.tipUntil&&now>this.tipUntil){this.ui.tip.hidden=true;this.tipUntil=0;}const slow=!!this.slowUntil&&now<this.slowUntil&&running&&!!sim.slow;if(this.hud.cache.slow!==slow){this.hud.cache.slow=slow;this.hud.root.classList.toggle('dm-slowmo',slow);}
  this.particles.update(dt,{x:0,y:0,z:0},-1);this.hud.live(g.status==='playing');this.stage.render(dt,real,{reduced,aberration:.0006});
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();try{this.dawg?.asset.dispose();}catch{}try{for(const m of this.domMats?.values()||[]){m[0].map?.dispose();m[0].dispose();m[2].dispose();}}catch{}this.stage?.dispose();}
}
