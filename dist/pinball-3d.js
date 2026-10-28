// Three.js presentation for Neon Pinball. PinballGame owns every rule; this module draws the
// table as a neon cabinet, rebuilding the level's pieces (bumpers, targets, ramps and wireforms)
// whenever the game moves up a table. Third person is the classic standing-at-the-cabinet view; first
// person is Ball Cam, chasing the lead ball around the playfield.
// World units: one table unit is one meter. Table (x, y) sits at world (x - 5, 0, 10 - y), so
// the flippers are nearest the player and the backglass is far away at -z.
import {T,quality,fitFov,texture,radial,glowStops,skyMaterial,pbr,castShadows,lightShaft,Stage,Particles,CameraRig,Hud,AmbientLoop} from './three-kit.js';
import {TABLE,FLIPPERS,LANES,LANE_Y,HOLE,WALLS,flipperAngle,rampPoint} from './pinball-engine.js';
import {heatLabel} from './difficulty.js';
import {worldLook} from './world.js';

const wx=x=>x-5,wz=y=>10-y;
const PF=[512,1024],ppu=PF[0]/10;
// The painted playfield: deep purple with neon art, lane arrows and the DAWG head in the middle.
function playfieldArt(c,w,h){
 const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#1a0b33');g.addColorStop(.55,'#0d0a24');g.addColorStop(1,'#07121f');c.fillStyle=g;c.fillRect(0,0,w,h);
 const at=(x,y)=>[x*ppu,h-y*ppu];c.lineCap='round';
 c.globalAlpha=.16;c.strokeStyle='#5ee7ff';c.lineWidth=1;for(let i=0;i<=20;i++){c.beginPath();c.moveTo(0,i*ppu);c.lineTo(w,i*ppu);c.stroke();}for(let i=0;i<=10;i++){c.beginPath();c.moveTo(i*ppu,0);c.lineTo(i*ppu,h);c.stroke();}c.globalAlpha=1;
 // Sunburst behind the bumpers.
 const [bx,by]=at(4.5,14);for(let i=0;i<18;i++){c.fillStyle=i%2?'#ff5fc81a':'#5ee7ff12';c.beginPath();c.moveTo(bx,by);c.arc(bx,by,ppu*5,i/18*Math.PI*2,(i+1)/18*Math.PI*2);c.fill();}
 // DAWG head.
 const [hx,hy]=at(4.5,7.1),r=ppu*1.25;c.strokeStyle='#b9ff5e';c.lineWidth=6;c.shadowColor='#b9ff5e';c.shadowBlur=18;
 c.beginPath();c.ellipse(hx,hy,r,r*.92,0,0,Math.PI*2);c.stroke();c.beginPath();c.ellipse(hx-r*.95,hy-r*.35,r*.35,r*.6,-.5,0,Math.PI*2);c.ellipse(hx+r*.95,hy-r*.35,r*.35,r*.6,.5,0,Math.PI*2);c.stroke();
 c.fillStyle='#b9ff5e';for(const s of [-1,1]){c.beginPath();c.arc(hx+s*r*.38,hy-r*.1,r*.13,0,Math.PI*2);c.fill();}c.beginPath();c.ellipse(hx,hy+r*.35,r*.26,r*.17,0,0,Math.PI*2);c.fill();
 c.shadowBlur=0;c.font=`900 ${ppu*.55}px system-ui,sans-serif`;c.textAlign='center';c.fillStyle='#ff5fc8';c.fillText('DAWG HOUSE',...at(4.5,11.2));
 c.font=`900 ${ppu*.42}px system-ui,sans-serif`;c.fillStyle='#5ee7ffcc';c.fillText('NEON PINBALL',...at(4.5,5.4));
 // Inlane arrows and the shooter lane stripe.
 c.strokeStyle='#ffe45e88';c.lineWidth=4;for(const [x,y,dx]of [[1.25,5,1],[7.75,5,-1]]){const [ax,ay]=at(x,y);c.beginPath();c.moveTo(ax,ay-14);c.lineTo(ax+dx*16,ay+6);c.lineTo(ax,ay+26);c.stroke();}
 c.fillStyle='#ffffff10';c.fillRect(9*ppu,0,ppu,h);
}
function glyph(text,color){return texture(128,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.font='900 92px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.shadowColor=color;c.shadowBlur=14;c.fillText(text,w/2,h/2+4);});}
function backglassArt(c,w,h){
 const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#2b0c4a');g.addColorStop(1,'#08051a');c.fillStyle=g;c.fillRect(0,0,w,h);
 for(let i=0;i<24;i++){c.fillStyle=i%2?'#ff5fc822':'#5ee7ff18';c.beginPath();c.moveTo(w/2,h*.62);c.arc(w/2,h*.62,w,i/24*Math.PI*2,(i+1)/24*Math.PI*2);c.fill();}
 c.textAlign='center';c.font=`900 ${h*.2}px system-ui,sans-serif`;c.lineWidth=6;c.strokeStyle='#ff5fc8';c.shadowColor='#ff5fc8';c.shadowBlur=30;c.strokeText('NEON',w/2,h*.3);c.strokeStyle='#5ee7ff';c.shadowColor='#5ee7ff';c.strokeText('PINBALL',w/2,h*.55);
 c.shadowBlur=20;c.fillStyle='#b9ff5e';c.font=`900 ${h*.1}px system-ui,sans-serif`;c.fillText('★ THE DAWG HOUSE ★',w/2,h*.8);
}

export class ThreePinball {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.cameraMode='third';this.clock=performance.now();this.status='';this.statusSince=performance.now();this.flash={bumpers:[],slings:[0,0]};this.follow=new T.Vector3(0,0,6);this.level=0;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d pinball3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud('<div class="d3-meter"><b class="d3-dist">1</b><small>BALL</small></div><div class="d3-gold"><i></i><b>×1</b></div><div class="d3-mission"><b class="d3-level">LEVEL 1</b><small class="d3-goal"></small></div>');this.view.append(this.hud.root);
  this.ui={ball:this.hud.q('.d3-dist'),mult:this.hud.q('.d3-gold b'),level:this.hud.q('.d3-level'),goal:this.hud.q('.d3-goal')};
  this.rig=new CameraRig(this.camera);this.rig.setMode(this.cameraMode);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D TABLE · LIVE');return this;
 }
 setCamera(mode){this.cameraMode=mode==='first'?'first':'third';this.rig?.setMode(this.cameraMode);}
 build(){
  const s=this.scene,q=this.quality;this.stage.neonEnvironment(.8);this.stage.hdrEnvironment(undefined,.7);s.fog=new T.FogExp2(0x070914,.012);
  this.sky=new T.Mesh(new T.SphereGeometry(120,24,12),skyMaterial());s.add(this.sky);
  s.add(new T.HemisphereLight(0xb6a8ff,0x120a22,.9));const key=new T.DirectionalLight(0xfff4e6,1.6);key.position.set(-4,12,8);s.add(key,key.target);this.stage.sunShadow(key,{size:11.5,far:40,map:2048,radius:3,bias:-.0002,normalBias:.015});
  this.ballLight=new T.PointLight(0xffffff,6,4,1.8);s.add(this.ballLight);
  // Playfield and cabinet.
  const art=texture(PF[0],PF[1],playfieldArt);this.field=new T.Mesh(new T.PlaneGeometry(10,20).rotateX(-Math.PI/2),pbr({map:art,emissiveMap:art,emissive:0xffffff,emissiveIntensity:.8,metalness:.3,roughness:.38,envMapIntensity:.7,clearcoat:1,clearcoatRoughness:.06},q));this.field.receiveShadow=true;s.add(this.field);
  const cabinet=pbr({color:0x140f2a,metalness:.6,roughness:.3,clearcoat:.8,clearcoatRoughness:.15},q);
  for(const [x,z,w,d]of [[-5.35,0,.7,21.4],[5.35,0,.7,21.4],[0,-10.35,11.4,.7],[0,10.5,11.4,1]]){const m=new T.Mesh(new T.BoxGeometry(w,.9,d).translate(0,.2,0),cabinet);m.position.set(x,0,z);s.add(m);}
  const under=new T.Mesh(new T.BoxGeometry(11.4,6,21.4).translate(0,-3.25,0),cabinet);s.add(under);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x05060c,metalness:.4,roughness:.7}));floor.position.y=-6.25;s.add(floor);
  // Backglass standing at the far end of the cabinet.
  const glass=new T.Mesh(new T.PlaneGeometry(11,6.2),new T.MeshBasicMaterial({map:texture(1024,576,backglassArt),toneMapped:false,color:new T.Color(1.15,1.15,1.15)}));glass.position.set(0,3.6,-10.75);s.add(glass);
  const box=new T.Mesh(new T.BoxGeometry(11.6,6.8,.6),cabinet);box.position.set(0,3.6,-11.1);s.add(box);
  // Walls: dark bodies with glowing top rails; slingshots glow on their own and flash on a kick.
  this.railMat=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});const wallMat=new T.MeshStandardMaterial({color:0x2a2350,metalness:.6,roughness:.3});this.slings=[];
  for(const [x1,y1,x2,y2,kind]of WALLS){const ax=wx(x1),az=wz(y1),bx=wx(x2),bz=wz(y2),len=Math.hypot(bx-ax,bz-az),mid=[(ax+bx)/2,(az+bz)/2],yaw=-Math.atan2(bz-az,bx-ax);
   if(kind==='post'){const p=new T.Mesh(new T.CylinderGeometry(.09,.09,.5,10).translate(0,.25,0),wallMat);p.scale.z=len/.18;p.position.set(mid[0],0,mid[1]);s.add(p);const cap=new T.Mesh(new T.BoxGeometry(.2,.04,len),this.railMat);cap.position.set(mid[0],.52,mid[1]);s.add(cap);continue;}
   const tall=kind==='gate'?.2:.5,thick=kind==='gate'?.05:.12;const body=new T.Mesh(new T.BoxGeometry(len+thick,tall,thick).translate(0,tall/2,0),kind==='sling'?new T.MeshStandardMaterial({color:0xff5fc8,emissive:0xff2fae,emissiveIntensity:.8,metalness:.2,roughness:.3}):wallMat);
   body.position.set(mid[0],0,mid[1]);body.rotation.y=yaw;s.add(body);if(kind==='sling')this.slings.push(body);
   const rail=new T.Mesh(new T.BoxGeometry(len+thick,.04,thick+.02),this.railMat);rail.position.set(mid[0],tall+.02,mid[1]);rail.rotation.y=yaw;s.add(rail);}
  this.glowTex=radial(glowStops);this.chromeMat=new T.MeshStandardMaterial({color:0xe8ecff,metalness:1,roughness:.08,envMapIntensity:1.6});this.chromeMat.userData.shared=true;this.table=new T.Group();s.add(this.table);
  // Inserts: D-A-W-G lane letters and multiplier lamps.
  this.lanes=LANES.map(l=>{const m=new T.Mesh(new T.PlaneGeometry(.75,.75).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:glyph(l.label,'#ffffff'),transparent:true,depthWrite:false,toneMapped:false,color:new T.Color(.4,.4,.5)}));m.position.set(wx(l.x),.02,wz(LANE_Y-1.1));s.add(m);return m;});
  this.mults=[2,3,4,5].map((n,i)=>{const m=new T.Mesh(new T.PlaneGeometry(.62,.62).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:glyph('×'+n,'#ffffff'),transparent:true,depthWrite:false,toneMapped:false,color:new T.Color(.4,.4,.5)}));m.position.set(wx(3+i),.02,wz(8.6));s.add(m);return m;});
  this.buildHole(s);this.buildFlippers(s);this.buildBalls(s);castShadows(s,q,false);this.field.castShadow=false;floor.castShadow=under.castShadow=false;
  // Two warm cabinet lamps haze down over the playfield from the backbox.
  if(q==='high')for(const x of [-3.2,3.2]){const shaft=lightShaft(0xffe8c8,{length:9,radius:3.2,top:.25,opacity:.12});shaft.position.set(x,7.4,-10.2);shaft.rotation.x=-.75;s.add(shaft);}
 }
 // The level's own pieces: bumpers, drop targets, ramps and wireforms, and its name on the apron.
 buildTable(t){const s=this.table;for(const o of [...s.children]){o.removeFromParent();o.traverse?.(m=>{m.geometry?.dispose?.();if(m.material&&!m.material.userData.shared)[].concat(m.material).forEach(x=>x.dispose?.());});}
  this.flash.bumpers=t.bumpers.map(()=>0);const tint=new T.Color(t.color);
  // Pop bumpers: a chrome skirt, a glowing body and a cap that flashes when hit.
  this.bumpers=t.bumpers.map(b=>{const g=new T.Group(),mat=new T.MeshStandardMaterial({color:0x5ee7ff,emissive:0x2fc8ff,emissiveIntensity:.6,metalness:.3,roughness:.25});
   g.add(new T.Mesh(new T.CylinderGeometry(b.r+.08,b.r+.12,.12,28).translate(0,.06,0),new T.MeshStandardMaterial({color:0xdde4ff,metalness:1,roughness:.15})));
   g.add(new T.Mesh(new T.CylinderGeometry(b.r*.82,b.r*.9,.42,28).translate(0,.33,0),mat));const cap=new T.Mesh(new T.CylinderGeometry(b.r,b.r*.9,.1,28).translate(0,.58,0),new T.MeshBasicMaterial({color:new T.Color(.5,1.1,1.4),toneMapped:false}));g.add(cap);
   g.position.set(wx(b.x),0,wz(b.y));s.add(g);return {g,mat,cap};});
  // Drop targets on the side walls.
  this.targetMat=t.targets.map(()=>new T.MeshStandardMaterial({color:0xffe45e,emissive:0xffb800,emissiveIntensity:1,metalness:.2,roughness:.3}));
  this.targets=t.targets.map((tg,i)=>{const m=new T.Mesh(new T.BoxGeometry(.14,.5,.72).translate(0,.25,0),this.targetMat[i]);m.position.set(wx(tg.x)+(tg.x<4.5?.05:-.05),0,wz(tg.y));s.add(m);return m;});
  // Ramps are translucent neon ribbons on posts; wireforms are twin chrome rails with hoops.
  this.ramps=t.ramps.map(r=>{const pts=r.path.map(([x,y,z])=>new T.Vector3(wx(x),z+.02,wz(y))),curve=new T.CatmullRomCurve3(pts,false,'catmullrom',.3),g=new T.Group(),n=Math.max(24,Math.round(r.length*6));
   if(r.kind==='ramp'){const tube=new T.Mesh(new T.TubeGeometry(curve,n,.36,8,false),new T.MeshStandardMaterial({color:tint,emissive:tint,emissiveIntensity:.35,transparent:true,opacity:.42,metalness:.3,roughness:.3,side:T.DoubleSide,depthWrite:false}));tube.scale.y=.22;g.add(tube);
    for(const side of [-1,1]){const rail=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>p.clone()),false,'catmullrom',.3),n,.035,6,false),this.chromeMat);rail.position.x=side*.0;rail.userData.side=side;g.add(rail);}}
   else{for(const dx of [-.16,.16]){const rail=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>p.clone().add(new T.Vector3(dx,0,0))),false,'catmullrom',.3),n,.03,6,false),this.chromeMat);g.add(rail);}
    for(let i=0;i<pts.length;i++){const hoop=new T.Mesh(new T.TorusGeometry(.3,.025,6,16),this.chromeMat);hoop.position.copy(curve.getPointAt(i/(pts.length-1)));const tan=curve.getTangentAt(i/(pts.length-1));hoop.lookAt(hoop.position.clone().add(tan));g.add(hoop);}}
   // Posts hold the path up wherever it leaves the playfield.
   for(let i=0;i<=8;i++){const p=curve.getPointAt(i/8);if(p.y<.3)continue;const post=new T.Mesh(new T.CylinderGeometry(.03,.03,p.y,6),this.chromeMat);post.position.set(p.x,p.y/2,p.z);g.add(post);}
   // The entry arrow and lamp on the playfield.
   const e=r.entry,lamp=new T.Mesh(new T.PlaneGeometry(.7,.5).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:glyph('▲',r.kind==='ramp'?'#ffffff':'#ffffff'),transparent:true,depthWrite:false,toneMapped:false,color:tint.clone().multiplyScalar(1.6)}));lamp.position.set(wx((e[0]+e[2])/2),.02,wz(e[1]-.6));g.add(lamp);
   g.userData.curve=curve;s.add(g);return {g,curve,r,lamp};});
  // The level's name on the apron.
  const name=new T.Mesh(new T.PlaneGeometry(4.2,.7),new T.MeshBasicMaterial({map:texture(512,96,(c,w,h)=>{c.clearRect(0,0,w,h);c.font='900 44px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=t.color;c.shadowColor=t.color;c.shadowBlur=14;c.fillText('LEVEL '+t.level+' · '+t.name,w/2,h/2+2,w-20);}),transparent:true,toneMapped:false}));name.rotation.x=-Math.PI/2;name.position.set(0,.03,wz(.55));s.add(name);castShadows(s,this.quality,false);
 }
 buildHole(s){
  this.hole=new T.Mesh(new T.RingGeometry(HOLE.r*.7,HOLE.r*1.25,32).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(1.5,.4,1.2),toneMapped:false,transparent:true}));this.hole.position.set(wx(HOLE.x),.02,wz(HOLE.y));s.add(this.hole);
  const pit=new T.Mesh(new T.CircleGeometry(HOLE.r*.7,24).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0x000000}));pit.position.set(wx(HOLE.x),.025,wz(HOLE.y));s.add(pit);
  this.holeGlow=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(1.6,.4,1.3),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.holeGlow.scale.set(2.4,2.4,1);this.holeGlow.position.set(wx(HOLE.x),.3,wz(HOLE.y));s.add(this.holeGlow);
 }
 buildFlippers(s){
  // Flippers: tapered bats that swing about their pivots.
  const shape=new T.Shape(),R=.17,r=.08;FLIPPERS[0];const len=FLIPPERS[0].len;shape.absarc(0,0,R,Math.PI/2,Math.PI*1.5,false);shape.lineTo(len,-r);shape.absarc(len,0,r,-Math.PI/2,Math.PI/2,false);shape.lineTo(0,R);
  const bat=new T.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:false,curveSegments:10}).rotateX(-Math.PI/2);
  this.flipperMat=new T.MeshStandardMaterial({color:0xffffff,emissive:0xb9ff5e,emissiveIntensity:.9,metalness:.3,roughness:.25});
  this.flippers=FLIPPERS.map(f=>{const m=new T.Mesh(bat,this.flipperMat);m.position.set(wx(f.px),.02,wz(f.py));s.add(m);return m;});
  // Plunger spring in the shooter lane.
  this.plunger=new T.Mesh(new T.CylinderGeometry(.16,.16,1,14).rotateX(Math.PI/2),new T.MeshStandardMaterial({color:0xdde4ff,metalness:1,roughness:.2}));this.plunger.position.set(wx(9.5),.25,wz(.2));s.add(this.plunger);
 }
 buildBalls(s){
  // Balls: polished chrome, up to six for multiball.
  const chrome=new T.MeshStandardMaterial({color:0xffffff,metalness:1,roughness:.06,envMapIntensity:1.6});const sphere=new T.SphereGeometry(TABLE.ball,28,18);
  this.balls=Array.from({length:6},()=>{const m=new T.Mesh(sphere,chrome);m.visible=false;s.add(m);return m;});
  const haloMat=new T.SpriteMaterial({map:radial(glowStops),color:new T.Color(1.4,1.5,1.8),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
  this.halos=this.balls.map(()=>{const h=new T.Sprite(haloMat);h.scale.set(1.3,1.3,1);h.visible=false;s.add(h);return h;});
  this.particles=new Particles(s,this.quality==='high'?420:240,this.glowTex);
 }
 at(x,y,h=TABLE.ball){return new T.Vector3(wx(x),h,wz(y));}
 lead(g){return g.balls.find(b=>b.state==='play'||b.state==='ramp')||g.balls[0];}
 event(e,g){if(!this.ready)return;const st=this.stage,hud=this.hud,b=this.lead(g),p=b?this.at(b.x,b.y):this.at(4.5,5);
  if(e.type==='bumper'){this.flash.bumpers[e.index]=1;const m=g.table.bumpers[e.index];if(!m)return;this.particles.burst(wx(m.x),.6,wz(m.y),18,0x5ee7ff,{speed:4,life:.45});hud.pop('+'+e.points);st.shake(.06);}
  else if(e.type==='sling'){this.flash.slings[b&&b.x<4.5?0:1]=1;this.particles.burst(p.x,.3,p.z,10,0xff5fc8,{speed:3,life:.35});}
  else if(e.type==='target'){this.particles.burst(p.x,.4,p.z,16,0xffe45e,{speed:3.5,life:.5});hud.pop('+'+e.points);}
  else if(e.type==='targets'){hud.banner('DAWG HOUSE LIT');st.flashOnce(0xff5fc8,.2,this.reduced);}
  else if(e.type==='lane')hud.pop(LANES[e.index].label);
  else if(e.type==='laneset'){hud.banner('×'+e.mult+' MULTIPLIER');st.flashOnce(0xb9ff5e,.25,this.reduced);}
  else if(e.type==='hole'){hud.pop('+'+e.points,'big');this.particles.burst(wx(HOLE.x),.4,wz(HOLE.y),26,0xff5fc8,{speed:3,life:.6});}
  else if(e.type==='multiball'){hud.banner('MULTIBALL!');st.shake(.4);st.flashOnce(0xffffff,.35,this.reduced);this.particles.burst(wx(HOLE.x),.5,wz(HOLE.y),80,0xb9ff5e,{speed:7,life:1});}
  else if(e.type==='ballsave')hud.banner('BALL SAVED');
  else if(e.type==='ramp'){hud.pop(e.label+' +'+e.points);st.flashOnce(0x5ee7ff,.12,this.reduced);}
  else if(e.type==='land'){this.particles.burst(wx(e.x),.3,wz(e.y),14,0xffffff,{speed:3,life:.4});st.shake(.08);}
  else if(e.type==='goal')hud.pop(({bumps:'BUMPERS DONE',ramps:'RAMPS DONE',targets:'TARGETS DONE',lanes:'LANES DONE'})[e.kind]||'DONE','big');
  else if(e.type==='levelup'){hud.banner('LEVEL '+e.level+' · '+e.name);st.shake(.5);st.flashOnce(0xffffff,.5,this.reduced);this.particles.burst(0,1,0,90,0xffe45e,{speed:8,life:1.2});}
  else if(e.type==='launch'){this.particles.burst(wx(9.5),.3,wz(1.2),14,0xffffff,{speed:3,life:.4});st.shake(.05);}
  else if(e.type==='drain'){st.shake(.25);st.flashOnce(0xff3355,.25,this.reduced);}
  else if(e.type==='nextball')hud.banner('BALL '+(4-e.left));
  else if(e.type==='nudge')st.shake(.18);
  else if(e.type==='heat'){hud.banner(heatLabel(e.tier));st.flashOnce(0xff7a3d,.2,this.reduced);}
  else if(e.type==='over'){st.shake(.6);st.flashOnce(0xff3355,.45,this.reduced);}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<2500));return true;}
 render(g,now){
  this.stage.resize();const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}if(g.level!==this.level){this.level=g.level;this.buildTable(g.table);}
  const look=worldLook(g.worldSeed),glow=new T.Color(look.glow),accent=new T.Color(look.accent);this.railMat.color.copy(glow).multiplyScalar(1.7);
  const u=this.sky.material.uniforms;u.uTop.value.set(0x04050c);u.uHorizon.value.copy(glow).multiplyScalar(.12);u.uGlow.value.copy(accent).multiplyScalar(.18);this.scene.fog.color.copy(glow).multiplyScalar(.05);
  const fade=Math.exp(-dt*(reduced?30:9));
  this.bumpers.forEach((b,i)=>{const f=this.flash.bumpers[i]*=fade;b.mat.emissiveIntensity=.6+f*3;b.cap.material.color.setRGB(.5+f*2,1.1+f*1.5,1.4+f*1.5);b.g.scale.setScalar(1+f*.08);});
  this.slings.forEach((m,i)=>{const f=this.flash.slings[i%2]*=fade;m.material.emissiveIntensity=.8+f*4;});
  this.targets.forEach((m,i)=>{const down=g.targets[i]||g.reset>0;m.position.y+=((down?-.48:0)-m.position.y)*Math.min(1,dt*18);this.targetMat[i].emissiveIntensity=down?.15:1+(reduced?0:Math.sin(real*5+i)*.3);});
  const dim=new T.Color(.35,.35,.45),lit=new T.Color(2.2,2.6,1.2);this.lanes.forEach((m,i)=>m.material.color.copy(g.lanes[i]?lit:dim));this.mults.forEach((m,i)=>m.material.color.copy(g.mult>=i+2?new T.Color(2.4,1.2,2.2):dim));
  const pulse=g.holeLit?.6+(reduced?.4:Math.sin(real*8)*.4+.4):.15;this.hole.material.opacity=.35+pulse*.65;this.holeGlow.material.opacity=pulse;
  FLIPPERS.forEach((f,i)=>{this.flippers[i].rotation.y=flipperAngle(f,g.flips[i].angle);});this.flipperMat.emissiveIntensity=.9+(g.flips.some(f=>f.held)?.8:0);
  const waiting=g.balls.find(b=>b.state==='lane');this.plunger.scale.z=waiting&&!reduced?1-Math.min(.45,waiting.wait*.15):1;this.plunger.position.z=wz(.2)+(1-this.plunger.scale.z)*.5;
  this.ramps?.forEach(r=>{r.lamp.material.opacity=.5+(reduced?.3:Math.sin(real*6)*.3+.3);});
  this.balls.forEach((m,i)=>{const b=g.balls[i],h=this.halos[i];m.visible=h.visible=!!b;if(!b)return;const z=b.z||0;h.position.copy(this.at(b.x,b.y,TABLE.ball*1.2+z));m.position.copy(this.at(b.x,b.y,(b.state==='held'?-.05:TABLE.ball)+z));h.scale.setScalar(1.3+z*.3);m.rotation.x-=(b.state==='ramp'?b.sp:b.vy)*dt*2;m.rotation.z-=b.vx*dt*2;});
  const lead=this.lead(g);if(lead){const p=this.at(lead.x,lead.y,TABLE.ball+(lead.z||0));this.ballLight.position.set(p.x,1.2,p.z);this.follow.lerp(p,Math.min(1,dt*(reduced?30:6)));}
  // Third person stands at the cabinet; Ball Cam rides behind and above the lead ball.
  const f=this.follow,third={pos:new T.Vector3(0,19,17.5),at:new T.Vector3(0,0,.4)};
  const first={pos:new T.Vector3(f.x*.8,3.1,f.z+4.6),at:new T.Vector3(f.x,0,f.z-2.2)};
  this.rig.update(dt,third,first,{follow:this.rig.mix>.5?10:8});this.stage.applyShake(real,reduced);this.rig.aim();
  const cam=this.camera;cam.fov+=(fitFov(this.rig.mix>.5?72:48,cam.aspect,this.rig.mix>.5?70:42)-cam.fov)*Math.min(1,dt*6);cam.near=.05;cam.updateProjectionMatrix();this.sky.position.copy(cam.position);
  this.particles.update(dt);const hud=this.hud;hud.set(this.ui.ball,'b',String(Math.min(3,4-g.ballsLeft)));hud.set(this.ui.mult,'m','×'+g.mult);const goal=g.goal;hud.set(this.ui.level,'l','LEVEL '+g.level);hud.set(this.ui.goal,'g',goal.done?'MISSION COMPLETE':`BUMPERS ${goal.bumps[0]}/${goal.bumps[1]} · RAMPS ${goal.ramps[0]}/${goal.ramps[1]} · ${goal.targets?'✓':'○'} TARGETS · ${goal.lanes?'✓':'○'} D-A-W-G`);hud.live(g.status==='playing');
  this.stage.render(dt,real,{reduced,aberration:.0012});
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();this.stage?.dispose();}
}
