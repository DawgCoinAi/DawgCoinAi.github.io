// DAWG Chess in 3D: a lit board in a late-night chess club, pieces turned on a lathe in pearl and
// obsidian, and your rival DAWG across the table. Captures cut to cinematic battles in the
// spirit of the old animated chess games: the two pieces become DAWG warriors (spear, lance,
// staff, hammer, orbs or sword), fight it out in slow motion on the square, and the loser is
// blasted off the board. Check, checkmate, promotion and castling get their own moments.
// The board only shows the game; ChessPlay owns the rules and waits on these animations.
import {T,quality,fitFov,texture,radial,glowStops,Stage,Particles,loadModel,cloneModel,fitModel} from './three-kit.js';
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {npcDawg} from './npc-dawg.js';
import {pieceModel} from './chess-pieces.js';

const WHITE=0x5ee7ff,BLACK=0xff4fd8,GOLD=0xffd36b;
export const sqPos=(s,y=0)=>new T.Vector3((s&7)-3.5,y,(s>>3)-3.5);
const ease=k=>k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2,easeOut=k=>1-Math.pow(1-k,3);
// What each piece fights with, and its battle name.
export const CLASS={p:{name:'PAWN',weapon:'spear'},n:{name:'KNIGHT',weapon:'lance'},b:{name:'BISHOP',weapon:'staff'},r:{name:'ROOK',weapon:'hammer'},q:{name:'QUEEN',weapon:'orbs'},k:{name:'KING',weapon:'sword'}};

function weapon(kind,color){const g=new T.Group(),glow=new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(2.2),toneMapped:false}),metal=new T.MeshStandardMaterial({color:0xdde4ff,metalness:1,roughness:.18}),wood=new T.MeshStandardMaterial({color:0x5a3a22,roughness:.7});
 if(kind==='spear'){g.add(new T.Mesh(new T.CylinderGeometry(.025,.025,1.3,8),wood),new T.Mesh(new T.ConeGeometry(.07,.24,10).translate(0,.76,0),glow));}
 if(kind==='lance'){g.add(new T.Mesh(new T.ConeGeometry(.09,1.6,14).translate(0,.5,0),metal),new T.Mesh(new T.CylinderGeometry(.16,.12,.08,16).translate(0,-.25,0),glow));}
 if(kind==='staff'){g.add(new T.Mesh(new T.CylinderGeometry(.03,.03,1.4,8),wood),new T.Mesh(new T.SphereGeometry(.12,16,12).translate(0,.76,0),glow));}
 if(kind==='hammer'){g.add(new T.Mesh(new T.CylinderGeometry(.035,.035,1.0,8),wood),new T.Mesh(new T.BoxGeometry(.42,.24,.24).translate(0,.52,0),metal),new T.Mesh(new T.BoxGeometry(.44,.05,.26).translate(0,.52,0),glow));}
 if(kind==='orbs'){for(let i=0;i<3;i++){const o=new T.Mesh(new T.SphereGeometry(.1,14,10),glow);o.position.set(Math.cos(i*2.1)*.3,.4,Math.sin(i*2.1)*.3);o.userData.orb=i;g.add(o);}}
 if(kind==='sword'){g.add(new T.Mesh(new T.BoxGeometry(.06,.16,.06),wood),new T.Mesh(new T.BoxGeometry(.28,.04,.06).translate(0,.1,0),metal),new T.Mesh(new T.BoxGeometry(.07,.95,.02).translate(0,.6,0),glow));}
 return g;}

export class ThreeChess {
 constructor(host,{onFailure,quality:q=quality()}={}){this.host=host;this.onFailure=onFailure;this.quality=q;this.ready=false;this.dead=false;this.pieces=new Map();this.tweens=[];this.flipped=false;this.view='3d';this.cine=null;this.clock=performance.now();this.warriors=new Map();this.skipping=false;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'chess3d',onFailure:()=>this.fail()}).init();this.view3d=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;this.host.prepend(this.view3d);
  const s=this.scene;this.stage.neonEnvironment(.45);this.stage.hdrEnvironment(undefined,.35);s.fog=new T.FogExp2(0x07060f,.03);s.background=new T.Color(0x06050c);
  this.hemi=new T.HemisphereLight(0xb6b0ff,0x140c22,.55);s.add(this.hemi);
  this.key=new T.SpotLight(0xfff2dc,26,30,.6,.55,1.4);this.key.position.set(0,12,4);this.key.target.position.set(0,0,0);s.add(this.key,this.key.target);
  if(this.quality==='high'){this.key.castShadow=true;this.key.shadow.mapSize.set(1024,1024);this.key.shadow.bias=-.0005;}
  this.rimA=new T.PointLight(WHITE,14,14,1.6);this.rimA.position.set(-6,3,5);this.rimB=new T.PointLight(BLACK,14,14,1.6);this.rimB.position.set(6,3,-5);s.add(this.rimA,this.rimB);
  this.arenaLight=new T.PointLight(0xfff0dd,0,6,1.8);s.add(this.arenaLight);this.checkLight=new T.PointLight(0xff2448,0,5,1.6);s.add(this.checkLight);
  this.glowTex=radial(glowStops);this.particles=new Particles(s,this.quality==='high'?900:450,this.glowTex);
  this.buildRoom();this.buildBoard();
  this.mats={w:new T.MeshPhysicalMaterial({color:0xcfc6e6,roughness:.3,metalness:.05,clearcoat:.8,clearcoatRoughness:.2,emissive:WHITE,emissiveIntensity:.02}),
   b:new T.MeshPhysicalMaterial({color:0x1a1424,roughness:.12,metalness:.35,clearcoat:1,clearcoatRoughness:.08,emissive:BLACK,emissiveIntensity:.09})};
  // Original DAWG pieces: body in the team's finish, gold or gunmetal trim, glowing eyes and gems.
  this.models={};for(const t of 'prbqkn')this.models[t]=pieceModel(t);
  this.trimMats={w:new T.MeshStandardMaterial({color:GOLD,metalness:1,roughness:.22,emissive:GOLD,emissiveIntensity:.08}),b:new T.MeshStandardMaterial({color:0x8a8fa8,metalness:1,roughness:.2,emissive:BLACK,emissiveIntensity:.06})};
  this.glowMats={w:new T.MeshBasicMaterial({color:new T.Color(WHITE).multiplyScalar(1.8),toneMapped:false}),b:new T.MeshBasicMaterial({color:new T.Color(BLACK).multiplyScalar(1.8),toneMapped:false})};this.darkMat=new T.MeshStandardMaterial({color:0x0a0810,roughness:.5,metalness:.2});
  this.ready=true;return this;}
 buildRoom(){const s=this.scene;
  const floor=new T.Mesh(new T.CircleGeometry(40,48).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x120d1c,roughness:.35,metalness:.4}));floor.position.y=-1.6;floor.receiveShadow=true;s.add(floor);
  const table=new T.Mesh(new T.CylinderGeometry(7.2,7.6,1.5,64),new T.MeshStandardMaterial({color:0x1d1426,roughness:.45,metalness:.3}));table.position.y=-.86;table.receiveShadow=true;s.add(table);
  const trim=new T.Mesh(new T.TorusGeometry(7.25,.05,8,96).rotateX(Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(GOLD).multiplyScalar(1.4),toneMapped:false}));trim.position.y=-.1;s.add(trim);
  // The club: a neon sign and hanging lamps far back in the dark.
  const sign=new T.Mesh(new T.PlaneGeometry(9,1.8),new T.MeshBasicMaterial({map:texture(1024,200,(c,w,h)=>{c.clearRect(0,0,w,h);c.font='900 120px Impact, "Arial Narrow", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#b9ff5e';c.shadowColor='#b9ff5e';c.shadowBlur=30;c.fillText('DAWG CHESS CLUB',w/2,h/2+6);}),transparent:true,toneMapped:false}));sign.position.set(0,7,-16);s.add(sign);
  for(let i=0;i<5;i++){const x=-12+i*6,b=new T.Mesh(new T.SphereGeometry(.25,16,10),new T.MeshBasicMaterial({color:new T.Color(2,1.6,1.1),toneMapped:false}));b.position.set(x,6,-10-(i%2)*3);s.add(b);const h=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:0xffc070,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,opacity:.6}));h.position.copy(b.position);h.scale.set(3,3,1);s.add(h);}
  // Kenney chairs and lamps, if they load.
  Promise.all(['furniture/loungeChair.glb','furniture/lampRoundFloor.glb'].map(p=>loadModel(p).catch(()=>null))).then(([chair,lamp])=>{if(this.dead)return;
   if(lamp)for(const [x,z] of [[-9,-6],[9,-6],[-10,6],[10,6]]){const m=fitModel(cloneModel(lamp),3.2);m.position.set(x,-1.6,z);s.add(m);}
   if(chair){this.chair=fitModel(cloneModel(chair),2.6);this.chair.position.set(0,-1.6,-9.2);s.add(this.chair);}});}
 buildBoard(){const s=this.scene,tex=texture(1024,1024,(c,w)=>{const q=w/8;for(let r=0;r<8;r++)for(let f=0;f<8;f++){const light=(r+f)%2===0;const g=c.createLinearGradient(f*q,r*q,(f+1)*q,(r+1)*q);g.addColorStop(0,light?'#d9cfee':'#2b2145');g.addColorStop(1,light?'#b9acd6':'#1c1530');c.fillStyle=g;c.fillRect(f*q,r*q,q,q);
    c.globalAlpha=.08;for(let i=0;i<14;i++){c.strokeStyle=light?'#ffffff':'#8a6bd1';c.lineWidth=1+Math.random()*2;c.beginPath();c.moveTo(f*q+Math.random()*q,r*q);c.bezierCurveTo(f*q+Math.random()*q,r*q+q*.3,f*q+Math.random()*q,r*q+q*.7,f*q+Math.random()*q,r*q+q);c.stroke();}c.globalAlpha=1;}});
  this.board=new T.Mesh(new T.BoxGeometry(8,.22,8).translate(0,-.11,0),[...Array(6)].map((_,i)=>i===2?new T.MeshPhysicalMaterial({map:tex,roughness:.42,metalness:.02,clearcoat:.35,clearcoatRoughness:.35}):new T.MeshStandardMaterial({color:0x140f22,roughness:.4,metalness:.5})));this.board.receiveShadow=true;s.add(this.board);
  const frame=new T.Mesh(new T.BoxGeometry(8.9,.3,8.9).translate(0,-.16,0),new T.MeshStandardMaterial({color:0x0c0914,roughness:.3,metalness:.7}));frame.receiveShadow=true;s.add(frame);
  for(const [w,d,x,z] of [[8.9,.04,0,4.45],[8.9,.04,0,-4.45],[.04,8.9,4.45,0],[.04,8.9,-4.45,0]]){const e=new T.Mesh(new T.BoxGeometry(w,.04,d),new T.MeshBasicMaterial({color:new T.Color(GOLD).multiplyScalar(1.5),toneMapped:false}));e.position.set(x,.0,z);s.add(e);}
  // File and rank letters on the frame.
  const glyph=t=>new T.MeshBasicMaterial({map:texture(64,64,(c,w)=>{c.clearRect(0,0,w,w);c.font='700 40px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffd36bcc';c.fillText(t,w/2,w/2+2);}),transparent:true,depthWrite:false});
  this.labels=new T.Group();for(let i=0;i<8;i++){const f=new T.Mesh(new T.PlaneGeometry(.3,.3).rotateX(-Math.PI/2),glyph('abcdefgh'[i]));f.position.set(i-3.5,.01,4.22);const r=new T.Mesh(new T.PlaneGeometry(.3,.3).rotateX(-Math.PI/2),glyph(String(8-i)));r.position.set(-4.22,.01,i-3.5);this.labels.add(f,r);}s.add(this.labels);
  // Square markers: selection, moves, captures, last move, hint, check.
  this.markGeo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);this.dotGeo=new T.CircleGeometry(.14,24).rotateX(-Math.PI/2);this.capGeo=new T.RingGeometry(.36,.46,32).rotateX(-Math.PI/2);
  this.markMats={sel:new T.MeshBasicMaterial({color:new T.Color(.7,1.6,.4),transparent:true,opacity:.55,toneMapped:false,depthWrite:false}),last:new T.MeshBasicMaterial({color:new T.Color(1.6,1.2,.4),transparent:true,opacity:.28,toneMapped:false,depthWrite:false}),
   dot:new T.MeshBasicMaterial({color:new T.Color(.7,1.6,.4),transparent:true,opacity:.85,toneMapped:false,depthWrite:false}),cap:new T.MeshBasicMaterial({color:new T.Color(1.8,.4,.6),transparent:true,opacity:.9,toneMapped:false,depthWrite:false}),
   hint:new T.MeshBasicMaterial({color:new T.Color(.4,1.4,1.8),transparent:true,opacity:.5,toneMapped:false,depthWrite:false}),check:new T.MeshBasicMaterial({color:new T.Color(2,.2,.3),transparent:true,opacity:.55,toneMapped:false,depthWrite:false})};
  this.markGroup=new T.Group();s.add(this.markGroup);}
 // The rival DAWG sits across the table.
 setRival(name){if(this.rivalName===name)return;this.rivalName=name;this.rival?.root.removeFromParent();this.rival?.dispose();try{const a=createDawgAsset(npcDawg(name)),b=new T.Box3().setFromObject(a.root),h=b.getSize(new T.Vector3()).y||1;a.root.scale.setScalar(3.2/h);a.root.position.set(0,-.6,-6.6);this.rival=a;this.scene.add(a.root);}catch{this.rival=null;}}
 setFlipped(f){this.flipped=!!f;}
 setView(v){this.view=v==='top'?'top':'3d';}
 makePiece(p){const t=p.toLowerCase(),c=p===p.toUpperCase()?'w':'b',g=new T.Group(),model=this.models[t];
  for(const [slot,mat] of [['body',this.mats[c]],['trim',this.trimMats[c]],['glow',this.glowMats[c]],['dark',this.darkMat]]){if(!model[slot])continue;const m=new T.Mesh(model[slot],mat);m.castShadow=slot!=='glow';m.receiveShadow=slot==='body';g.add(m);}
  // White faces the far side of the board, black faces the near side.
  g.rotation.y=c==='w'?Math.PI:0;g.userData={p,t,c};this.scene.add(g);return g;}
 // Puts every piece on its square at once (new games, undo, loading a save).
 setPosition(board){for(const g of this.pieces.values())g.removeFromParent();this.pieces.clear();board.forEach((p,s)=>{if(!p)return;const g=this.makePiece(p);g.position.copy(sqPos(s));this.pieces.set(s,g);});}
 // Which square is under a screen point, or -1.
 pick(x,y){if(!this.ready)return -1;const r=this.view3d.getBoundingClientRect(),v=new T.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),ray=new T.Raycaster();ray.setFromCamera(v,this.camera);const p=new T.Vector3();if(!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),p))return -1;
  const file=Math.floor(p.x+4),rank=Math.floor(p.z+4);return file>=0&&file<8&&rank>=0&&rank<8?rank*8+file:-1;}
 marks({selected=-1,moves=[],captures=[],last=null,hint=null,check=-1}={}){for(const m of this.markGroup.children)m.removeFromParent();this.markGroup.clear();const add=(geo,mat,s,y=.005)=>{const m=new T.Mesh(geo,mat);m.position.copy(sqPos(s,y));this.markGroup.add(m);};
  if(last){add(this.markGeo,this.markMats.last,last[0]);add(this.markGeo,this.markMats.last,last[1]);}if(hint){add(this.markGeo,this.markMats.hint,hint[0],.007);add(this.markGeo,this.markMats.hint,hint[1],.007);}
  if(check>=0)add(this.markGeo,this.markMats.check,check,.008);if(selected>=0)add(this.markGeo,this.markMats.sel,selected,.009);for(const s of moves)add(this.dotGeo,this.markMats.dot,s,.012);for(const s of captures)add(this.capGeo,this.markMats.cap,s,.012);this.checkSq=check;}
 // ── Animation ────────────────────────────────────────────────────────────────────────────
 tween(dur,fn){return new Promise(res=>{const t={t0:performance.now(),dur:dur*1000,fn,res};if(this.skipping||dur<=0){fn(1);res();return;}this.tweens.push(t);});}
 wait(s){return this.tween(s,()=>{});}
 skip(){this.skipping=true;for(const t of this.tweens){t.fn(1);t.res();}this.tweens=[];}
 // Slides (or, for knights, leaps) a piece from one square to another.
 async glide(g,from,to,{lift=.35,dur=.42}={}){const a=sqPos(from),b=sqPos(to),h=g.userData.t==='n'?1.1:lift;await this.tween(dur,k=>{const e=ease(k);g.position.lerpVectors(a,b,e);g.position.y=Math.sin(Math.PI*e)*h;});g.position.copy(b);
  if(!this.reduced)this.particles.burst(b.x,.05,b.z,10,g.userData.c==='w'?WHITE:BLACK,{speed:2,life:.4,gravity:0,up:.4,spread:.4});}
 // Plays a move on the board: m = {from,to,piece,captured,promo,flag}, battle = cinematic captures.
 async play(m,{battle=true,reduced=false}={}){this.reduced=reduced;this.skipping=false;const g=this.pieces.get(m.from);if(!g)return;
  const capSq=m.flag==='e'?m.to+(m.piece==='P'?8:-8):m.to,victim=m.captured?this.pieces.get(capSq):null;
  if(victim&&battle&&!reduced){await this.battle(g,victim,m.from,capSq,m.to);}
  else{if(victim){this.pieces.delete(capSq);this.shatter(victim);}await this.glide(g,m.from,m.to);}
  this.pieces.delete(m.from);this.pieces.set(m.to,g);
  if(m.flag==='k'||m.flag==='q'){const rf=m.flag==='k'?m.to+1:m.to-2,rt=m.flag==='k'?m.to-1:m.to+1,rook=this.pieces.get(rf);if(rook){this.pieces.delete(rf);this.pieces.set(rt,rook);await this.castleScene(g,rook,rf,rt);}}
  if(m.promo)await this.promote(m.to,m.promo);this.skipping=false;}
 shatter(g,big=false){const p=g.position;this.particles.burst(p.x,.5,p.z,big?90:40,g.userData.c==='w'?WHITE:BLACK,{speed:big?8:5,life:.9,gravity:-6,up:3,spread:.5});this.tween(.35,k=>{g.scale.setScalar(1-k);g.position.y=k*.6;}).then(()=>g.removeFromParent());}
 async castleScene(king,rook,rf,rt){if(!this.reduced)this.cinema({focus:sqPos(rt,.6),side:1,dist:4.2,height:1.6,title:'CASTLES'});await this.glide(rook,rf,rt,{lift:.8,dur:.55});this.particles.burst(sqPos(rt).x,.1,sqPos(rt).z,40,GOLD,{speed:4,life:.7,up:2});await this.wait(.25);this.endCinema();}
 async promote(s,p){const old=this.pieces.get(s),pos=sqPos(s);if(!this.reduced){this.cinema({focus:sqPos(s,.8),side:-1,dist:3.6,height:1.4,title:'PROMOTION'});this.arenaLight.position.set(pos.x,3,pos.z);this.arenaLight.color.set(GOLD);
   await this.tween(.6,k=>{this.arenaLight.intensity=k*12;if(old){old.rotation.y=k*8;old.position.y=k*1.2;}});}
  old?.removeFromParent();const g=this.makePiece(p);g.position.copy(pos);this.pieces.set(s,g);if(!this.reduced){this.stage.flashOnce(GOLD,.5,false);this.particles.burst(pos.x,.6,pos.z,120,GOLD,{speed:6,life:1.1,up:4});g.scale.setScalar(.01);
   await this.tween(.5,k=>{g.scale.setScalar(easeOut(k));this.arenaLight.intensity=12*(1-k);});await this.wait(.3);this.endCinema();}}
 // A check: the camera finds the king under a red light.
 async check(s){if(this.reduced||this.skipping)return;const p=sqPos(s);this.cinema({focus:sqPos(s,.7),side:1,dist:4,height:2.2,title:'CHECK!',red:true});this.checkLight.position.set(p.x,1.6,p.z);
  await this.tween(.9,k=>{this.checkLight.intensity=Math.sin(k*Math.PI)*30;});this.stage.shake(.3);this.endCinema();}
 // Checkmate: the losing king topples, shockwave, and the camera circles the board.
 async checkmate(s,winner){const g=this.pieces.get(s),p=sqPos(s);this.cinema({focus:sqPos(s,.7),side:1,dist:4.6,height:2.4,title:'CHECKMATE',red:true,orbit:true});this.checkLight.position.set(p.x,2,p.z);this.checkLight.intensity=40;
  await this.wait(.4);if(g)await this.tween(1.1,k=>{g.rotation.z=easeOut(k)*Math.PI/2;g.position.x=p.x+easeOut(k)*.3;g.position.y=Math.sin(k*Math.PI)*.3;});
  this.stage.shake(.7);this.stage.flashOnce(winner==='w'?WHITE:BLACK,.6,false);this.particles.burst(p.x,.3,p.z,200,winner==='w'?WHITE:BLACK,{speed:9,life:1.6,up:3,spread:1});for(let i=0;i<4;i++)this.particles.burst((Math.random()-.5)*8,4,(Math.random()-.5)*8,60,[GOLD,WHITE,BLACK][i%3],{speed:5,life:2,gravity:-4,up:2,spread:2});
  await this.wait(2.2);this.checkLight.intensity=0;this.endCinema();}
 // ── Cinema: letterbox, a camera move, and a title card ─────────────────────────────────────
 cinema({focus,side=1,dist=4,height=1.6,title='',red=false,orbit=false}){const flip=this.flipped?-1:1,from=this.camera.position.clone(),aim=this.aim?.clone()||new T.Vector3();
  const pos=focus.clone().add(new T.Vector3(side*dist*.8,height,dist*.6*flip));this.cine={pos,at:focus.clone(),from,aimFrom:aim,t0:performance.now(),orbit,red};this.host.classList.add('cinematic');if(title)this.title(title,red);}
 endCinema(){this.cine=null;this.host.classList.remove('cinematic');this.arenaLight.intensity=0;}
 title(text,red){const el=document.createElement('div');el.className='chess-title'+(red?' is-red':'');el.textContent=text;this.host.append(el);setTimeout(()=>el.remove(),1800);}
 // ── Battle scenes ──────────────────────────────────────────────────────────────────────────
 warrior(piece){const key=piece;let w=this.warriors.get(key);if(!w){const c=piece===piece.toUpperCase()?'w':'b',t=piece.toLowerCase(),name=(c==='w'?'White ':'Black ')+CLASS[t].name;
   const a=createDawgAsset(npcDawg(name)),b=new T.Box3().setFromObject(a.root),h=b.getSize(new T.Vector3()).y||1;a.root.scale.setScalar(1.55/h);const g=new T.Group();g.add(a.root);
   const arm=a.limbs.find(l=>l.side==='Right'&&l.kind==='arm'),wpn=weapon(CLASS[t].weapon,c==='w'?WHITE:BLACK);if(CLASS[t].weapon==='orbs'){g.add(wpn);wpn.position.y=1.0;}else{(arm?.lower||a.root).add(wpn);wpn.scale.setScalar(h/1.55*.9);wpn.position.y=-.1*h;wpn.rotation.x=Math.PI/2;}
   const aura=new T.Mesh(new T.RingGeometry(.4,.55,32).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(c==='w'?WHITE:BLACK).multiplyScalar(1.8),transparent:true,opacity:.8,toneMapped:false,depthWrite:false}));aura.position.y=.02;g.add(aura);
   if(t==='k'||t==='q'){const crown=new T.Mesh(new T.CylinderGeometry(.14,.18,.14,10,1,true),new T.MeshStandardMaterial({color:GOLD,metalness:1,roughness:.2,emissive:GOLD,emissiveIntensity:.3,side:T.DoubleSide}));a.head.add(crown);crown.position.y=.34;crown.scale.setScalar(1/(1.55/h)*.6);}
   g.rotation.order='YXZ';w={g,a,arm,wpn,t,c,crown:a.head.children.find(o=>o.geometry?.type==='CylinderGeometry')||null};this.warriors.set(key,w);}
  w.g.visible=true;this.scene.add(w.g);return w;}
 async battle(attacker,victim,from,at,to){const A=this.warrior(attacker.userData.p),D=this.warrior(victim.userData.p),P=sqPos(at),fromP=sqPos(from),dir=P.clone().sub(fromP).setY(0);if(dir.lengthSq()<.01)dir.set(0,0,attacker.userData.c==='w'?-1:1);dir.normalize();
  const start=P.clone().addScaledVector(dir,-2.0),side=new T.Vector3(-dir.z,0,dir.x);
  // Lights down on the board, up on the arena.
  attacker.visible=false;victim.visible=false;this.arenaLight.position.set(P.x,3.2,P.z);this.arenaLight.color.set(0xffffff);
  const mid=P.clone().addScaledVector(dir,-1).setY(.75);this.cinema({focus:mid,side:1,dist:0,height:0});this.cine.pos=mid.clone().addScaledVector(side,4.4).addScaledVector(dir,.3).setY(1.55);
  this.title(CLASS[attacker.userData.t].name+' ✕ '+CLASS[victim.userData.t].name,false);
  // Warriors turn only about the vertical axis, to face each other.
  const face=(o,x,z)=>o.rotation.set(0,Math.atan2(x-o.position.x,z-o.position.z),0);A.g.position.copy(start);face(A.g,P.x,P.z);D.g.position.copy(P);face(D.g,start.x,start.z);A.g.scale.setScalar(.01);D.g.scale.setScalar(.01);this.dimHemi=this.hemi.intensity;
  this.particles.burst(start.x,.8,start.z,40,A.c==='w'?WHITE:BLACK,{speed:4,life:.5,up:2});this.particles.burst(P.x,.8,P.z,40,D.c==='w'?WHITE:BLACK,{speed:4,life:.5,up:2});
  await this.tween(.4,k=>{const e=easeOut(k);A.g.scale.setScalar(e);D.g.scale.setScalar(e);this.arenaLight.intensity=k*9;this.hemi.intensity=this.dimHemi*(1-k*.7);});
  A.pose='idle';D.pose='idle';this.fighters=[A,D];
  // Every pairing plays out its own way: the defender braces in its style, the attacker strikes
  // in its style, and the defender falls in its style.
  await this.brace(D,A,P,dir);await this.attack(A,D,start,P,dir);
  this.hitstop=.09;this.stage.flashOnce(0xffffff,.3,false);this.stage.shake(.55);this.particles.burst(P.x,.9,P.z,120,A.c==='w'?WHITE:BLACK,{speed:9,life:.9,up:3,spread:.6});this.particles.burst(P.x,.9,P.z,60,GOLD,{speed:6,life:.6,up:2});
  await this.defeat(D,A,P,dir);D.g.visible=false;D.g.rotation.set(0,0,0);D.g.position.y=0;if(D.crown){D.crown.visible=true;}
  // Victory: a hop on the square, then back to a chess piece.
  A.pose='idle';const land=sqPos(to);await this.tween(.45,k=>{A.g.position.lerpVectors(A.g.position,land,.25);A.g.position.y=Math.sin(k*Math.PI)*.7;});
  this.pieces.delete(at);victim.removeFromParent();
  await this.tween(.3,k=>{A.g.scale.setScalar(1-k);});A.g.visible=false;attacker.position.copy(land);attacker.visible=true;attacker.scale.setScalar(.01);this.particles.burst(land.x,.6,land.z,40,A.c==='w'?WHITE:BLACK,{speed:3,life:.5,up:2});
  await this.tween(.3,k=>{attacker.scale.setScalar(easeOut(k));this.arenaLight.intensity=9*(1-k);this.hemi.intensity=this.dimHemi*(.3+.7*k);});this.fighters=null;this.endCinema();}
 // How each defender meets the attack.
 async brace(D,A,P,dir){const tc=D.c==='w'?WHITE:BLACK;
  if(D.t==='p'){await this.tween(.3,k=>{D.armX=-k*1.2;D.g.position.copy(P).addScaledVector(dir,k*.15);});}
  else if(D.t==='n'){await this.tween(.35,k=>{D.g.rotation.x=-Math.sin(k*Math.PI)*.5;D.g.position.y=Math.sin(k*Math.PI)*.35;});}
  else if(D.t==='b'){const bub=new T.Mesh(new T.SphereGeometry(.95,24,16),new T.MeshBasicMaterial({color:new T.Color(tc).multiplyScalar(1.4),transparent:true,opacity:0,toneMapped:false,depthWrite:false,side:T.DoubleSide}));bub.position.copy(P).setY(.8);this.scene.add(bub);D.bubble=bub;D.armX=-2.4;await this.tween(.35,k=>{bub.material.opacity=k*.28;bub.scale.setScalar(.6+k*.4);});}
  else if(D.t==='r'){await this.tween(.3,k=>{const s=1-Math.sin(k*Math.PI)*.18;D.g.scale.set(1+(1-s),s,1+(1-s));});D.g.scale.setScalar(1);}
  else if(D.t==='q'){D.pose='still';const orb=new T.Mesh(new T.SphereGeometry(.14,14,10),new T.MeshBasicMaterial({color:new T.Color(tc).multiplyScalar(2.4),toneMapped:false}));this.scene.add(orb);const a=P.clone().setY(1.2),b=A.g.position.clone().setY(1.1);
   await this.tween(.3,k=>orb.position.lerpVectors(a,b,k*.7));this.particles.burst(orb.position.x,orb.position.y,orb.position.z,30,GOLD,{speed:4,life:.4,up:1});orb.removeFromParent();D.pose='idle';}
  else if(D.t==='k'){await this.tween(.35,k=>{D.armX=-k*2.8;});}}
 async defeat(D,A,P,dir){const tc=D.c==='w'?WHITE:BLACK,yaw=D.g.rotation.y;D.pose='still';D.armX=0;
  if(D.bubble){const bub=D.bubble;D.bubble=null;this.particles.burst(P.x,.8,P.z,80,tc,{speed:6,life:.6,up:1,spread:1});this.tween(.25,k=>{bub.scale.setScalar(1+k*.6);bub.material.opacity=.3*(1-k);}).then(()=>bub.removeFromParent());}
  if(D.t==='p'){// Tumbles head over heels off the board.
   const fly=dir.clone().multiplyScalar(4.5);await this.tween(.75,k=>{D.g.position.set(P.x+fly.x*k,Math.sin(k*Math.PI)*1.6,P.z+fly.z*k);D.g.rotation.set(-k*7,yaw,0);D.g.scale.setScalar(1-k*.85);});}
  else if(D.t==='n'){// Flung spinning sideways.
   const side=new T.Vector3(-dir.z,0,dir.x).multiplyScalar(-3.5).addScaledVector(dir,2.5);await this.tween(.8,k=>{D.g.position.set(P.x+side.x*k,Math.sin(k*Math.PI)*2.4,P.z+side.z*k);D.g.rotation.set(0,yaw+k*14,k*1.2);D.g.scale.setScalar(1-k*.85);});}
  else if(D.t==='b'){// Lifts off and dissolves upward into sparks.
   await this.tween(.9,k=>{D.g.position.y=k*1.6;D.g.rotation.set(0,yaw+k*3,0);D.g.scale.setScalar(1-k);if(Math.random()<.7)this.particles.burst(P.x,.4+k*1.8,P.z,4,tc,{speed:1.5,life:.6,gravity:2,up:1,spread:.4});});}
  else if(D.t==='r'){// Crumbles into falling blocks.
   const blocks=[];const mat=new T.MeshStandardMaterial({color:D.c==='w'?0xcfc6e6:0x2a2238,roughness:.4,metalness:.3,emissive:tc,emissiveIntensity:.2});for(let i=0;i<14;i++){const m=new T.Mesh(new T.BoxGeometry(.18,.18,.18),mat);m.position.copy(P).add(new T.Vector3((Math.random()-.5)*.6,.2+Math.random()*1.4,(Math.random()-.5)*.6));m.userData.v=new T.Vector3((Math.random()-.5)*4,2+Math.random()*3,(Math.random()-.5)*4).addScaledVector(dir,2);this.scene.add(m);blocks.push(m);}
   D.g.visible=false;await this.tween(.9,k=>{for(const m of blocks){m.userData.v.y-=.35;m.position.addScaledVector(m.userData.v,.016);if(m.position.y<.09){m.position.y=.09;m.userData.v.multiplyScalar(.5);m.userData.v.y=Math.abs(m.userData.v.y)*.4;}m.rotation.x+=.2;m.rotation.z+=.15;m.scale.setScalar(1-Math.max(0,k-.6)*2.5);}});for(const m of blocks){m.removeFromParent();m.geometry.dispose();}mat.dispose();}
  else if(D.t==='q'){// Spins up into a column of light and is gone.
   this.arenaLight.color.set(tc);await this.tween(.8,k=>{D.g.rotation.set(0,yaw+k*18,0);D.g.position.y=Math.sin(k*Math.PI/2)*.9;D.g.scale.set(1-k,1+k*1.5,1-k);if(Math.random()<.8)this.particles.burst(P.x+Math.cos(k*30)*.5,.3+k*2,P.z+Math.sin(k*30)*.5,3,k<.5?GOLD:tc,{speed:.8,life:.5,gravity:1,up:.5,spread:.1});});this.arenaLight.color.set(0xfff0dd);}
  else{// The crown flies off; the king topples backward and fades.
   let crown=null;if(D.crown){const w=new T.Vector3();D.crown.getWorldPosition(w);D.crown.visible=false;crown=new T.Mesh(D.crown.geometry,D.crown.material);crown.scale.setScalar(.6);crown.position.copy(w);this.scene.add(crown);}
   const v=dir.clone().multiplyScalar(1.6).setY(5);await this.tween(1.0,k=>{D.g.rotation.set(-Math.min(1,k*1.6)*Math.PI/2,yaw,0);D.g.position.copy(P).addScaledVector(dir,Math.min(1,k*1.6)*.6);if(k>.6)D.g.scale.setScalar(1-(k-.6)*2.4);
    if(crown){crown.position.x+=v.x*.016;crown.position.z+=v.z*.016;crown.position.y=Math.max(.08,crown.position.y+(v.y-k*9)*.016);crown.rotation.x+=.25;crown.rotation.z+=.18;}});
   if(crown){this.particles.burst(crown.position.x,.2,crown.position.z,40,GOLD,{speed:3,life:.6,up:1.5});await this.wait(.25);crown.removeFromParent();}}}
 // Each piece fights its own way.
 async attack(A,D,start,P,dir){const t=A.t,stop=P.clone().addScaledVector(dir,-.85),arm=A.arm?.upper;
  const swing=(a)=>{if(arm){A.armX=a;}};
  if(t==='p'){A.pose='walk';await this.tween(.55,k=>{A.g.position.lerpVectors(start,stop,ease(k));});A.pose='idle';for(let i=0;i<3;i++)await this.tween(.13,k=>{swing(-Math.sin(k*Math.PI)*1.6);A.g.position.copy(stop).addScaledVector(dir,Math.sin(k*Math.PI)*.25);});this.slow(.25);}
  else if(t==='n'){A.pose='run';swing(-1.4);await this.tween(.25,()=>{});await this.tween(.45,k=>{A.g.position.lerpVectors(start,stop,k*k);A.g.position.y=Math.abs(Math.sin(k*Math.PI*3))*.25;if(!this.reduced&&Math.random()<.6)this.particles.burst(A.g.position.x,.1,A.g.position.z,2,GOLD,{speed:1,life:.3,gravity:0,up:.2});});this.slow(.3);}
  else if(t==='b'){A.pose='idle';A.g.position.copy(start.clone().lerp(P,.25));await this.tween(.45,k=>swing(-k*2.6));const orb=new T.Mesh(new T.SphereGeometry(.2,18,12),new T.MeshBasicMaterial({color:new T.Color(A.c==='w'?WHITE:BLACK).multiplyScalar(2.5),toneMapped:false}));this.scene.add(orb);const o0=A.g.position.clone().setY(1.6);
   await this.tween(.5,k=>{orb.position.lerpVectors(o0,P.clone().setY(.9),ease(k));orb.position.y+=Math.sin(k*Math.PI)*.8;if(!this.reduced)this.particles.burst(orb.position.x,orb.position.y,orb.position.z,3,A.c==='w'?WHITE:BLACK,{speed:.6,life:.4,gravity:0,up:0,spread:.1});});orb.removeFromParent();swing(0);this.slow(.3);}
  else if(t==='r'){A.pose='run';await this.tween(.35,k=>A.g.position.lerpVectors(start,start.clone().lerp(stop,.5),k));A.pose='still';swing(-2.8);const top=start.clone().lerp(stop,.5);
   await this.tween(.55,k=>{A.g.position.lerpVectors(top,stop,k);A.g.position.y=Math.sin(k*Math.PI)*2.6;swing(-2.8+k*3.4);});this.stage.shake(.5);const ring=new T.Mesh(new T.RingGeometry(.2,.35,40).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(GOLD).multiplyScalar(2),transparent:true,toneMapped:false,depthWrite:false}));ring.position.copy(stop).setY(.03);this.scene.add(ring);
   this.tween(.6,k=>{ring.scale.setScalar(1+k*8);ring.material.opacity=1-k;}).then(()=>ring.removeFromParent());this.slow(.25);}
  else if(t==='q'){A.pose='still';A.g.position.copy(start.clone().lerp(P,.2));await this.tween(.5,k=>{A.g.position.y=k*.5;A.g.rotation.y+=.25;});A.g.rotation.set(0,Math.atan2(P.x-A.g.position.x,P.z-A.g.position.z),0);
   for(let i=0;i<3;i++){const orb=new T.Mesh(new T.SphereGeometry(.16,14,10),new T.MeshBasicMaterial({color:new T.Color(i%2?GOLD:(A.c==='w'?WHITE:BLACK)).multiplyScalar(2.4),toneMapped:false}));this.scene.add(orb);const o0=A.g.position.clone().setY(1.5).add(new T.Vector3((i-1)*.5,0,0));
    await this.tween(.22,k=>{orb.position.lerpVectors(o0,P.clone().setY(.9),k);});orb.removeFromParent();this.particles.burst(P.x,.9,P.z,25,GOLD,{speed:4,life:.4,up:1});this.stage.shake(.15);}
   await this.tween(.25,k=>{A.g.position.y=.5*(1-k);});this.slow(.3);}
  else{A.pose='walk';await this.tween(.5,k=>A.g.position.lerpVectors(start,stop,ease(k)));A.pose='idle';await this.tween(.35,k=>swing(-k*3));this.slow(.35);await this.tween(.18,k=>swing(-3+k*4.4));}}
 slow(s){this.slowmo=s;}
 // ── Frame ─────────────────────────────────────────────────────────────────────────────────
 frame(now,{reduced=false,rivalPose='idle'}={}){if(!this.ready||this.dead)return false;let dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;this.reduced=reduced;
  if(this.hitstop>0){this.hitstop-=dt;dt=0;}const scale=this.slowmo>0?(this.slowmo-=dt,.35):1;
  // Tweens run on scaled time so slow motion slows the fight itself.
  for(const t of [...this.tweens]){t.t0+= (1-scale)*dt*1000;const k=Math.min(1,(now-t.t0)/t.dur);t.fn(k);if(k>=1){this.tweens.splice(this.tweens.indexOf(t),1);t.res();}}
  this.stage.resize();const real=now/1000,cam=this.camera,aspect=cam.aspect||1;
  if(this.rival)setDawgPose(this.rival,real,reduced?'still':rivalPose);
  for(const w of this.fighters||[]){setDawgPose(w.a,real*(w.pose==='run'?1.6:1),w.pose||'idle');if(w.arm&&w.armX)w.arm.upper.rotateX(w.armX);if(w.t==='q')for(const o of w.wpn.children)if(o.userData.orb!==undefined){const a=real*3+o.userData.orb*2.1;o.position.set(Math.cos(a)*.45,.3+Math.sin(real*4+o.userData.orb)*.1,Math.sin(a)*.45);}}
  // The resting camera, or the cinema shot.
  const flip=this.flipped?-1:1,top=this.view==='top',base=top?new T.Vector3(0,13.5,.01*flip):new T.Vector3(0,aspect<1?12:8.2,(aspect<1?10:8.9)*flip),aimBase=new T.Vector3(0,top?0:.1,top?0:-.4*flip);
  let pos=base,at=aimBase;if(this.cine){const c=this.cine,k=Math.min(1,(now-c.t0)/550),e=ease(k);pos=c.from.clone().lerp(c.pos,e);at=c.aimFrom.clone().lerp(c.at,e);if(c.orbit){const a=(now-c.t0)/1000*.6,r=c.pos.clone().sub(c.at);r.applyAxisAngle(new T.Vector3(0,1,0),a);pos=c.at.clone().add(r);}}
  else if(!reduced&&!top){pos=pos.clone();pos.x+=Math.sin(real*.15)*.25;}
  if(this.cine)cam.position.copy(pos);else cam.position.lerp(pos,Math.min(1,dt*4));this.aim=(this.aim||at.clone()).lerp(at,this.cine?1:Math.min(1,dt*4));this.stage.applyShake(real,reduced);cam.lookAt(this.aim);
  cam.fov=fitFov(this.cine?40:top?34:42,aspect,top?40:46);cam.updateProjectionMatrix();
  if(this.checkSq>=0&&!this.cine&&!reduced){const p=sqPos(this.checkSq);this.checkLight.position.set(p.x,1.4,p.z);this.checkLight.intensity=8+Math.sin(real*6)*6;}else if(!this.cine)this.checkLight.intensity=0;
  this.labels.visible=!this.cine;this.particles.update(dt*scale);this.stage.render(dt,real,{reduced,aberration:this.cine?.0025:.001});return true;}
 fail(){if(this.dead)return;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;for(const w of this.warriors.values())w.a.dispose();this.rival?.dispose();this.view3d?.remove();this.stage?.dispose();}
}
