// BITE NIGHT in 3D: five stages, the fighters (DAWG rigs posed every frame from the engine's
// state), hit sparks, trails, projectiles, the fight camera and the finishing-move director.
// Presentation only: it reads the engine's game and events and never changes them.
import {T,Stage,Particles,radial,glowStops,texture,pbr,castShadows,contactShadow,wetGround,signMaterials,skylineTexture,buildingShells,facadeMaterials,quality,skyMaterial,merge} from './three-kit.js';
import {createDawgAsset} from './dawg-graphics-model.js';
import {npcDawg} from './npc-dawg.js';
import {previewDawg} from './dawg-fashion.js';
import {fighter,FIGHTERS,stageOf} from './fight-roster.js';
import {POSE,N,clipPose,statePose,namedPose,mix} from './fight-poses.js';
import {Director,mat} from './fight-props.js';

const TAU=Math.PI*2,lerp=(a,b,k)=>a+(b-a)*k,clamp=(x,a,b)=>x<a?a:x>b?b:x;
const SFX={hit1:[[220,.06,'square',.03],[110,.08,'sawtooth',.025]],hit2:[[150,.1,'sawtooth',.04],[70,.14,'square',.035,20]],hit3:[[120,.14,'sawtooth',.045],[60,.2,'square',.04,25],[900,.05,'triangle',.02]],block:[[520,.04,'triangle',.02],[300,.06,'square',.015]],snap:[[1400,.06,'triangle',.03],[2100,.1,'sine',.025,40]],
 whoosh:[[420,.12,'sine',.012]],swing:[[300,.09,'triangle',.012]],jump:[[260,.08,'sine',.012]],land:[[90,.08,'sine',.03]],thud:[[70,.16,'sine',.05]],boom:[[55,.4,'sawtooth',.06],[40,.5,'sine',.06,30]],super:[[110,.5,'sawtooth',.04],[220,.5,'sawtooth',.03,80],[440,.6,'triangle',.03,160],[880,.5,'triangle',.02,240]],
 under:[[98,.5,'sawtooth',.05],[196,.5,'square',.03,60],[392,.6,'triangle',.03,120]],proj:[[700,.12,'sine',.02],[500,.1,'triangle',.015,40]],tele:[[1200,.07,'sine',.02],[600,.1,'sine',.02,50]],grab:[[180,.08,'square',.03]],tech:[[800,.05,'triangle',.03],[1000,.08,'triangle',.025,60]],counter:[[1000,.08,'triangle',.03],[1500,.16,'sine',.03,60]],
 ko:[[82,.9,'sawtooth',.06],[164,.7,'square',.03,60],[41,1.1,'sine',.06,100]],round:[[330,.12,'square',.03],[440,.16,'square',.03,140]],go:[[660,.3,'sawtooth',.04],[990,.3,'triangle',.03,60]],sting:[[196,.3,'sawtooth',.04],[233,.3,'sawtooth',.04,160],[294,.6,'sawtooth',.045,320]],stamp:[[65,.5,'sawtooth',.07],[130,.4,'square',.04],[523,.5,'triangle',.03,90],[784,.7,'triangle',.03,180]],
 ding:[[1568,.5,'sine',.03]],ting:[[2093,.25,'sine',.03]],zap:[[1800,.06,'sawtooth',.03],[900,.1,'sawtooth',.03,30]],pop:[[600,.05,'sine',.04],[1200,.05,'sine',.02,20]],bang:[[90,.25,'sawtooth',.06],[1400,.06,'square',.02]],bonk:[[400,.08,'sine',.04]],slide:[[160,.3,'sawtooth',.015]],rise:[[300,.5,'sine',.02],[600,.5,'sine',.015,200]],
 clang:[[300,.3,'square',.035],[450,.4,'triangle',.02]],clank:[[250,.12,'square',.03]],click:[[1500,.03,'square',.03]],splash:[[500,.25,'sine',.02],[240,.3,'triangle',.03,30]],splat:[[130,.18,'sawtooth',.045]],gong:[[98,1.6,'sine',.07],[196,1.3,'triangle',.03],[294,1,'sine',.02]],crack:[[1800,.05,'square',.04],[140,.2,'sawtooth',.05,20]],
 shatter:[[2400,.08,'square',.03],[1800,.1,'square',.025,40],[3000,.12,'triangle',.02,90],[1300,.2,'triangle',.02,140]],freeze:[[1900,.4,'sine',.02],[2500,.5,'sine',.015,100]],wind:[[240,.7,'sine',.012],[300,.8,'sine',.01,200]],rumble:[[50,.7,'sawtooth',.04]],honk:[[196,.5,'square',.05],[247,.5,'square',.04]],horn:[[110,.9,'sawtooth',.05],[147,.9,'sawtooth',.04]],
 beep:[[1000,.14,'square',.025]],blip:[[880,.06,'square',.025]],lose:[[440,.15,'square',.03],[330,.15,'square',.03,160],[220,.4,'square',.03,320]],jackpot:[[784,.1,'square',.03],[988,.1,'square',.03,90],[1175,.1,'square',.03,180],[1568,.4,'square',.03,270]],coin:[[1319,.06,'square',.03],[1760,.2,'square',.025,60]],
 launch:[[120,.6,'sawtooth',.05],[240,.8,'sine',.03,100]],ignite:[[80,.5,'sawtooth',.05]],spinup:[[200,1.4,'sawtooth',.02],[400,1.4,'sine',.015,400]],suck:[[900,.6,'sine',.025]],glitch:[[1300,.05,'square',.03],[500,.05,'square',.03,60],[1900,.05,'square',.03,120]],power:[[110,.3,'square',.03],[220,.3,'square',.03,120]],
 squeak:[[1900,.08,'sine',.03],[2300,.1,'sine',.025,90]],tweet:[[2600,.07,'sine',.02],[3000,.07,'sine',.02,90]],chomp:[[300,.06,'square',.04]],happy:[[523,.12,'triangle',.03],[659,.12,'triangle',.03,110],[784,.25,'triangle',.03,220]],soft:[[392,.4,'sine',.025],[494,.5,'sine',.02,200]],
 inflate:[[300,.5,'sine',.02]],hiss:[[2400,.3,'sawtooth',.008]],peel:[[700,.2,'sawtooth',.015]],slap:[[200,.08,'square',.05]],whap:[[100,.2,'sawtooth',.07],[1200,.05,'square',.03]],fold:[[900,.05,'triangle',.02]],shutter:[[1600,.03,'square',.04],[1000,.04,'square',.03,50]],whirr:[[340,.5,'sawtooth',.012]],
 buzz:[[180,.8,'sawtooth',.012]],creak:[[240,.4,'sawtooth',.02]],charge:[[160,.6,'sawtooth',.025],[320,.6,'sawtooth',.02,150]],stone:[[110,.3,'sawtooth',.03]],rake:[[1200,.5,'sawtooth',.006]],shine:[[1760,.3,'sine',.03],[2637,.4,'sine',.02,100]],shrink:[[900,.6,'sine',.02]],ray:[[1400,1,'sawtooth',.012]],
 flush:[[200,.8,'sawtooth',.02]],gurgle:[[140,.3,'sine',.03],[180,.3,'sine',.03,200],[120,.4,'sine',.03,400]],lever:[[300,.1,'square',.03],[200,.14,'square',.03,90]],reels:[[700,.05,'square',.015],[700,.05,'square',.015,120],[700,.05,'square',.015,240],[700,.05,'square',.015,360]],chime:[[784,.25,'sine',.03],[622,.35,'sine',.03,220]],
 skid:[[1100,.25,'sawtooth',.012]],drill:[[160,1.2,'sawtooth',.03]],scrub:[[1500,.4,'sawtooth',.006]],slurp:[[300,.5,'sine',.03],[600,.3,'sine',.02,300]],stampfx:[[120,.12,'square',.05]],clink:[[1800,.08,'triangle',.03]],hazard:[[1500,.06,'sawtooth',.03],[90,.3,'sawtooth',.05,30]],heal:[[660,.2,'sine',.02],[880,.3,'sine',.02,120]]};
const OVERRIDE={gold:()=>new T.MeshStandardMaterial({color:0xffc83a,metalness:1,roughness:.18,emissive:0x6a4200,emissiveIntensity:.5}),ice:()=>new T.MeshStandardMaterial({color:0xbfeaff,metalness:.1,roughness:.05,emissive:0x3a7fb0,emissiveIntensity:.5,transparent:true,opacity:.86}),
 stone:()=>new T.MeshStandardMaterial({color:0x8d9098,roughness:1}),paint:()=>new T.MeshStandardMaterial({color:0xff5fc8,roughness:.3}),balloon:()=>new T.MeshStandardMaterial({color:0xff7ad0,roughness:.12,metalness:.1}),pixel:()=>new T.MeshBasicMaterial({color:0x5ee7ff,wireframe:true,toneMapped:false}),
 shadow:()=>new T.MeshBasicMaterial({color:0x05060c}),toast:()=>new T.MeshStandardMaterial({color:0x2a2622,roughness:1}),paper:()=>new T.MeshStandardMaterial({color:0xf1eee2,roughness:.9})};
const overrides=new Map(),override=k=>{if(!overrides.has(k))overrides.set(k,OVERRIDE[k]());return overrides.get(k);};
const eul=new T.Euler(),qt=new T.Quaternion();

/** One fighter: a DAWG asset in a holder (position, facing) and a tilt group (whole-body pitch). */
class Rig {
 constructor(fid,dawg,q){const F=this.F=fighter(fid);this.id=fid;this.color=F.color;
  const d=F.own?(dawg||npcDawg('Contender')):previewDawg(npcDawg(F.name),F.look);
  const a=this.asset=createDawgAsset(d),box=new T.Box3().setFromObject(a.root),h=box.getSize(new T.Vector3()).y||1.8;this.H=1.75*F.scale;this.k=this.H/h;
  this.holder=new T.Group();this.tilt=new T.Group();this.tilt.position.y=this.H/2;this.holder.add(this.tilt);a.root.scale.set(this.k*(F.arche==='GRAPPLER'||F.arche==='HEAVY'?1.14:1),this.k,this.k*(F.arche==='HEAVY'?1.12:1));a.root.position.y=-this.H/2;this.tilt.add(a.root);
  if(F.weapon){const w=new T.Group(),gold=mat(0xffc93d,{m:1,r:.25});const st=new T.Mesh(new T.CylinderGeometry(.022,.022,1.25,8),gold);st.position.y=-.35;w.add(st);for(const y of [-.98,.3]){for(const x of [-.07,.07]){const s=new T.Mesh(new T.SphereGeometry(.075,10,8),gold);s.position.set(x,y,0);w.add(s);}}const gem=new T.Mesh(new T.OctahedronGeometry(.07),mat(0xc78bff,{e:0xc78bff,ei:2.5}));gem.position.y=.42;w.add(gem);
   const arm=a.limbs.find(l=>l.kind==='arm'&&l.side==='Right');w.position.set(0,-.2,.08);w.rotation.x=1.35;arm.lower.add(w);this.weapon=w;}
  castShadows(a.root,q,false);this.mats=[];const seen=new Set();a.root.traverse(o=>{if(o.isMesh){o.userData.orig=o.material;if(!seen.has(o.material)&&o.material.emissive){seen.add(o.material);this.mats.push({m:o.material,e:o.material.emissive.clone()});}}});
  this.cur=new Float32Array(N);this.tgt=new Float32Array(N);this.cur.set(POSE.stand);this.extra=[0,0,0];this.flash=0;this.matKind='normal';this.spin=0;
  this.shadow=contactShadow(1.5*F.scale,1.1*F.scale);this.aura=new T.PointLight(F.color,0,4,1.6);this.aura.position.y=1;this.holder.add(this.aura);}
 setMat(kind){if(kind===this.matKind)return;this.matKind=kind;const m=kind==='normal'?null:override(kind);this.asset.root.traverse(o=>{if(o.isMesh&&o.userData.orig)o.material=m||o.userData.orig;});}
 /** Blend toward the target pose and write it to the bones. face: +1 when facing +x. */
 apply(face,snap=.45){const v=this.cur,t=this.tgt,a=this.asset;for(let i=0;i<N;i++)v[i]+=(t[i]-v[i])*snap;
  const nearLeft=face>0,s=-face,rot=(bone,x,y,z)=>{qt.setFromEuler(eul.set(x,y,z));bone.quaternion.copy(a.base.get(bone).q).multiply(qt);};
  for(const [bone,b]of a.base)bone.position.copy(b.p);
  a.body.position.y+=v[4];rot(a.body,v[5],v[6]*s,v[7]*s);rot(a.spine,v[8],v[9]*s,v[10]);rot(a.head,v[11],v[12]*s,v[13]*s);
  for(const l of a.limbs){const near=(l.side==='Left')===nearLeft,i=l.kind==='arm'?(near?14:17):(near?20:23),zs=l.side==='Left'?-1:1;rot(l.upper,v[i],0,v[i+1]*zs);rot(l.lower,v[i+2],0,0);}
  const sc=this.F.scale;this.tilt.position.set(0,this.H/2+v[1]*sc,v[0]*sc);this.tilt.rotation.set(v[2]+this.extra[0]+this.spin,0,v[3]+this.extra[2]);
  if(this.flash>0||this.flashOn){this.flashOn=this.flash>0;for(const {m,e}of this.mats)m.emissive.setRGB(e.r+this.flash,e.g+this.flash,e.b+this.flash);}}
 cinePose(name,pt,dt,face){namedPose(this.tgt,name,pt);this.spin=0;this.apply(face,Math.min(1,dt*14));}
 dispose(){this.holder.removeFromParent();this.shadow.removeFromParent();this.shadow.geometry.dispose();this.asset.dispose();}
}

export class FightScene {
 constructor(host,{quality:q=quality(),sound=null,onFailure=null,viewer=false}={}){Object.assign(this,{host,quality:q,sound,onFailure,viewer,ready:false,dead:false,rigs:[null,null],rigCache:new Map(),time:0,stageId:null,excite:0,dim:1,dimGoal:1,cine:false,projMesh:new Map(),arcs:[],rings:[],reduced:false,camX:0,camZ:7,camY:1.6,zoom:0,roll:0});}
 get lite(){return this.quality!=='high';}
 init(){
  const st=this.stage=new Stage({quality:this.quality,className:'fight3d',onFailure:()=>{this.dead=true;this.onFailure?.();},tone:'neutral',exposure:1.05}).init();this.scene=st.scene;this.camera=st.camera;this.host.prepend(st.view);st.onDowngrade=()=>{this.quality='low';};
  const s=this.scene;st.neonEnvironment(.45);s.fog=new T.FogExp2(0x0b0a1e,.018);s.background=new T.Color(0x05050c);
  this.hemi=new T.HemisphereLight(0x8090ff,0x201030,.8);this.key=new T.DirectionalLight(0xfff2e0,2.4);this.key.position.set(-4,9,7);st.sunShadow(this.key,{size:9,far:40,map:this.lite?1024:2048,radius:5});this.key.target.position.set(0,1,0);
  this.rimA=new T.DirectionalLight(0x5ee7ff,2.6);this.rimA.position.set(-7,4,-6);this.rimB=new T.DirectionalLight(0xff5fc8,2.6);this.rimB.position.set(7,4,-6);this.fill=new T.PointLight(0xffffff,0,9,1.6);this.spot=new T.SpotLight(0xffffff,0,20,.5,.6,1);this.spot.position.set(0,8,4);
  s.add(this.hemi,this.key,this.key.target,this.rimA,this.rimB,this.fill,this.spot,this.spot.target);
  this.glow=radial(glowStops);this.particles=new Particles(s,this.lite?500:1400,this.glow);this.particles.points.material.size=.16;
  this.sky=new T.Mesh(new T.SphereGeometry(300,24,12),skyMaterial());s.add(this.sky);
  const sp=new Float32Array(900);for(let i=0;i<300;i++){const a=Math.random()*TAU,u=Math.random()*2-1,r=Math.sqrt(1-u*u);sp.set([Math.cos(a)*r*200,60+u*120,Math.sin(a)*r*200],i*3);}const sg=new T.BufferGeometry();sg.setAttribute('position',new T.BufferAttribute(sp,3));this.stars=new T.Points(sg,new T.PointsMaterial({size:1.6,color:0xffffff,map:this.glow,transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false}));this.stars.visible=false;s.add(this.stars);
  this.world=new T.Group();s.add(this.world);this.fx=new T.Group();s.add(this.fx);
  // Pools: slash arcs and shock rings.
  const arcGeo=new T.RingGeometry(.55,.9,20,1,-.9,1.8),ringGeo=new T.PlaneGeometry(1,1),ringTex=texture(128,128,c=>{const g=c.createRadialGradient(64,64,34,64,64,64);g.addColorStop(0,'#ffffff00');g.addColorStop(.75,'#ffffff');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,128,128);});
  for(let i=0;i<8;i++){const m=new T.Mesh(arcGeo,new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false}));m.visible=false;this.fx.add(m);this.arcs.push({m,t:9});}
  for(let i=0;i<6;i++){const m=new T.Mesh(ringGeo,new T.MeshBasicMaterial({map:ringTex,color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false}));m.visible=false;this.fx.add(m);this.rings.push({m,t:9,s:1});}
  this.director=new Director(this);
  const o=this.overlay=document.createElement('div');o.className='fight-cine';o.innerHTML='<i class="fc-bar fc-top"></i><i class="fc-bar fc-bot"></i><p class="fc-say"></p><div class="fc-stamp"><b></b><span></span></div>';this.host.append(o);
  this.ready=true;return this;}
 sfx(name){const list=SFX[name];if(!list||!this.sound)return;for(const [f,len,wave,vol,delay]of list){if(delay)setTimeout(()=>this.sound(f,len,wave,vol),delay);else this.sound(f,len,wave,vol);}}

 // ── Stages.
 setStage(id){if(this.stageId===id)return;this.stageId=id;const w=this.world;w.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){for(const m of [].concat(o.material)){if(m.map)m.map.dispose();m.dispose?.();}}});w.clear();this.ticks=[];this.hazard=null;
  const q=this.quality,hi=!this.lite,B=(wd,h,d,m,x,y,z,ry=0)=>{const o=new T.Mesh(new T.BoxGeometry(wd,h,d),m);o.position.set(x,y,z);o.rotation.y=ry;o.receiveShadow=hi;w.add(o);return o;},
   M=(c,o={})=>new T.MeshStandardMaterial({color:c,roughness:o.r??.7,metalness:o.m??0,emissive:o.e??0,emissiveIntensity:o.ei??1}),
   floor=(m,y=0)=>{const f=new T.Mesh(new T.PlaneGeometry(60,16).rotateX(-Math.PI/2),m);f.position.set(0,y,-2);f.receiveShadow=hi;w.add(f);return f;},
   look=(top,hor,glw,fog,dens,hemiS,hemiG,hemiI,keyC,keyI,ra,rb,rimI=2.6)=>{const u=this.sky.material.uniforms;u.uTop.value.set(top);u.uHorizon.value.set(hor);u.uGlow.value.set(glw);this.scene.fog.color.set(fog);this.scene.fog.density=dens;this.hemi.color.set(hemiS);this.hemi.groundColor.set(hemiG);this.base={hemi:hemiI,key:keyI,rim:rimI};this.key.color.set(keyC);this.rimA.color.set(ra);this.rimB.color.set(rb);},
   crowd=(n,x0,x1,z0,z1,y)=>{n=this.lite?Math.ceil(n*.45):n;const parts=[new T.CapsuleGeometry(.2,.4,3,8).translate(0,.4,0),new T.SphereGeometry(.24,10,8).translate(0,.95,0),new T.SphereGeometry(.09,6,5).scale(1,1.6,.7).translate(-.2,1.1,0),new T.SphereGeometry(.09,6,5).scale(1,1.6,.7).translate(.2,1.1,0)],geo=merge(parts.map(g=>{const n2=g.toNonIndexed();g.dispose();return n2;})),
    im=new T.InstancedMesh(geo,new T.MeshStandardMaterial({roughness:.8}),n),cols=[0xc89a60,0x414a60,0xde975d,0x99a5b8,0x805c54,0xe5d4aa,0xbc738f,0x6baca0,0x9384bd,0xbf6858],data=[];
    for(let i=0;i<n;i++){const k=(i*.618)%1,x=lerp(x0,x1,(i+.5)/n)+(k-.5)*.5,z=lerp(z0,z1,k);data.push([x,y,z,k*TAU,.85+k*.4]);im.setColorAt(i,new T.Color(cols[i%10]).multiplyScalar(.75));}im.instanceColor.needsUpdate=true;w.add(im);
    const m4=new T.Matrix4(),p=new T.Vector3(),sc=new T.Vector3(),qq=new T.Quaternion();this.ticks.push(t=>{const e=this.excite;for(let i=0;i<n;i++){const d=data[i];p.set(d[0],d[1]+Math.abs(Math.sin(t*(3+d[4])+d[3]))*(.05+e*.35),d[2]);sc.setScalar(d[4]);m4.compose(p,qq,sc);im.setMatrixAt(i,m4);}im.instanceMatrix.needsUpdate=true;});},
   glowBox=(wd,h,d,c,x,y,z,ei=2)=>B(wd,h,d,M(c,{e:c,ei}),x,y,z),
   hazard=(side,build)=>{const g=new T.Group();g.position.set(side*7.25,0,-.2);w.add(g);build(g);this.hazard={g,t:9,side};};
  const HB=(g,wd,h,d,m,x,y,z)=>{const o=new T.Mesh(new T.BoxGeometry(wd,h,d),m);o.position.set(x,y,z);g.add(o);return o;};
  if(id==='rooftop'){
   look(0x05061a,0x2a1050,0xff3fa0,0x0b0a1e,.016,0x8a9aff,0x1a1030,.75,0xfff0e0,2.3,0x5ee7ff,0xff5fc8);
   floor(wetGround({color:0x232838,roughness:.42,repeat:[10,3],q}));B(40,.5,.4,M(0x2a2f40),0,.25,-3.6);glowBox(40,.06,.08,0xff5fc8,0,.52,-3.42,3);B(40,.5,.4,M(0x2a2f40),0,.25,3.9);
   const shells=buildingShells(10),fm=facadeMaterials();for(let i=0;i<16;i++){const sh=shells[i%10],m=new T.Mesh(sh.g,fm[i%4]);m.position.set(-34+i*4.6+(i%3),-14-(i%4)*3,-13-(i%5)*5);m.scale.setScalar(1.25);w.add(m);}
   const sky=new T.Mesh(new T.CylinderGeometry(120,120,34,32,1,true),new T.MeshBasicMaterial({map:skylineTexture(),transparent:true,side:T.BackSide,fog:false,color:0x8a90c0}));sky.material.map.repeat.set(4,1);sky.position.y=2;w.add(sky);
   const signs=signMaterials();[[-6.5,3.3,-5,0],[-1.5,4.4,-6.5,6],[4.2,3.4,-5.2,2],[9,4.6,-7,10],[-11,4.8,-8,8]].forEach(([x,y,z,i])=>{const s=signs[i%signs.length],m=new T.Mesh(new T.PlaneGeometry(2.6*Math.min(2,s.aspect),2.6/Math.max(1,1/s.aspect)*.5),s.mat);m.position.set(x,y,z);w.add(m);B(.12,y,.12,M(0x20242e,{m:.8}),x-.9,y/2-.4,z-.1);B(.12,y,.12,M(0x20242e,{m:.8}),x+.9,y/2-.4,z-.1);});
   B(14,.6,5,M(0x1c2030),-3,-.35,-7.6);const tank=new T.Mesh(new T.CylinderGeometry(1.3,1.3,2.2,16),M(0x5a4636,{r:.9}));tank.position.set(-9.5,3.4,-7);w.add(tank);const cone=new T.Mesh(new T.ConeGeometry(1.45,.8,16),M(0x3a2e26));cone.position.set(-9.5,4.9,-7);w.add(cone);for(const [x,z]of [[-10.3,-7.8],[-8.7,-7.8],[-10.3,-6.2],[-8.7,-6.2]])B(.12,2.4,.12,M(0x20242e),x,1.2,z);
   for(const x of [6,8.2])B(1.5,1,1.2,M(0x4a5060,{m:.6,r:.5}),x,.5,-4.8);const blink=glowBox(.12,.12,.12,0xff2030,11,7.4,-9,4);B(.08,7,.08,M(0x20242e),11,3.7,-9);this.ticks.push(t=>{blink.material.emissiveIntensity=Math.sin(t*3)>0?5:.2;});
   crowd(26,-9,3,-7.9,-6.6,-.05);for(let i=0;i<18;i++)glowBox(.09,.09,.09,[0xffe45e,0xff5fc8,0x5ee7ff][i%3],-9+i*.72,2.1+Math.sin(i*.6)*.18,-6.2,3);
   if(hi){const n=420,rp=new Float32Array(n*3);for(let i=0;i<n;i++)rp.set([(Math.random()-.5)*26,Math.random()*9,-6+Math.random()*10],i*3);const rg=new T.BufferGeometry();rg.setAttribute('position',new T.BufferAttribute(rp,3));const rain=new T.Points(rg,new T.PointsMaterial({size:.05,color:0x9fb8ff,transparent:true,opacity:.5,depthWrite:false}));w.add(rain);this.ticks.push((t,dt)=>{for(let i=0;i<n;i++){rp[i*3+1]-=dt*11;if(rp[i*3+1]<0)rp[i*3+1]=9;}rg.attributes.position.needsUpdate=true;});}
   hazard(1,g=>{HB(g,.2,5,.2,M(0x20242e,{m:.8}),0,2.5,-.6);HB(g,.2,5,.2,M(0x20242e,{m:.8}),0,2.5,.9);const p=HB(g,.14,2.6,1.9,M(0xff5fc8,{e:0xff3fb0,ei:1.6}),-.1,3.2,.15);g.userData.p=p;});
  }else if(id==='subway'){
   look(0x0a0d10,0x141a1e,0x7dffb0,0x0c1114,.022,0xcfe8ff,0x283038,.95,0xf2fff4,2.1,0x7dffb0,0xffd27a,2.2);
   const tile=texture(256,256,(c,s)=>{c.fillStyle='#b9c2c4';c.fillRect(0,0,s,s);c.strokeStyle='#7d888c';c.lineWidth=3;for(let i=0;i<=4;i++){c.strokeRect(i*64,0,0,s);c.strokeRect(0,i*64,s,0);}for(let i=0;i<300;i++){c.fillStyle='#00000012';c.fillRect((i*71)%256,(i*37)%256,5,3);}},{repeat:true});tile.repeat.set(24,6);
   floor(pbr({map:tile,roughness:.35,metalness:.1,clearcoat:.4},q));B(60,.02,.5,M(0xffc21f,{r:.5}),0,.012,-2.9);B(60,2,3.6,M(0x07080a),0,-1.02,-5.2);for(const z of [-4.6,-5.8])B(60,.12,.12,M(0x6a6e78,{m:.9,r:.3}),0,-.4,z);
   const wall=texture(256,256,(c,s)=>{c.fillStyle='#d9dfd8';c.fillRect(0,0,s,s);c.strokeStyle='#9aa39c';c.lineWidth=2;for(let y=0;y<8;y++)for(let x=0;x<4;x++)c.strokeRect(x*64+(y%2)*32-32,y*32,64,32);c.fillStyle='#1f6b4a';c.fillRect(0,96,s,40);},{repeat:true});wall.repeat.set(14,2);
   const bw=new T.Mesh(new T.PlaneGeometry(60,7),new T.MeshStandardMaterial({map:wall,roughness:.4}));bw.position.set(0,3.2,-9.6);w.add(bw);B(60,.3,2.8,M(0xb9c2c4),0,-.15,-8.2);
   const name=new T.Mesh(new T.PlaneGeometry(4.6,.9),new T.MeshStandardMaterial({map:texture(512,100,(c)=>{c.fillStyle='#10402c';c.fillRect(0,0,512,100);c.fillStyle='#fff';c.font='900 64px system-ui';c.textAlign='center';c.fillText('BARK STREET',256,72);}),roughness:.4}));name.position.set(0,3.25,-9.55);w.add(name);
   B(60,.4,14,M(0x1a1e22),0,6.2,-3);for(let i=-3;i<=3;i++){glowBox(2.6,.08,.16,0xe8fff0,i*4.4,5.95,-1.2,2.4);glowBox(2.6,.08,.16,0xe8fff0,i*4.4+2,5.95,-7.6,1.8);}for(const x of [-9,-3,3,9])B(.6,6.2,.6,M(0x2e4a3e,{r:.4}),x,3.1,-7.2);
   const train=new T.Group();train.position.set(60,-.3,-5.2);w.add(train);HB(train,26,2.9,2.4,M(0xaab2be,{m:.8,r:.3}),0,1.8,0);HB(train,26.1,.9,2.44,M(0xfff0c0,{e:0xffe9a8,ei:1.4}),0,2.3,0);for(let x=-12;x<=12;x+=2)HB(train,.5,1,2.5,M(0xaab2be,{m:.8,r:.3}),x,2.3,0);HB(train,26.1,.3,2.44,M(0xffc21f),0,1.2,0);
   this.ticks.push(t=>{const c=(t+6)%17;train.position.x=c<3.2?60-c*40:999;train.visible=c<3.2;if(c<3.2&&!this.cine)this.stage.trauma=Math.max(this.stage.trauma,.12);});
   crowd(22,-10,10,-8.9,-7.4,0);
   hazard(-1,g=>{HB(g,1,2.2,1.2,M(0xd8303c,{m:.4,r:.3}),0,1.1,0);const p=HB(g,.06,1.3,.9,M(0xbfe8ff,{e:0x9fd8ff,ei:1.5}),.5,1.3,0);g.userData.p=p;});
  }else if(id==='arcade'){
   look(0x070414,0x1a0a30,0xc78bff,0x0a0618,.02,0xb0a0ff,0x180a28,.8,0xfff0e8,2.1,0x5ee7ff,0xff5fc8,2.9);
   const carpet=texture(256,256,(c,s)=>{c.fillStyle='#160a2c';c.fillRect(0,0,s,s);const cols=['#ff5fc8','#5ee7ff','#ffe45e','#b9ff5e'];for(let i=0;i<46;i++){c.strokeStyle=cols[i%4];c.lineWidth=4;c.globalAlpha=.75;const x=(i*89)%256,y=(i*53)%256;c.beginPath();if(i%3===0)c.arc(x,y,9,0,5);else if(i%3===1){c.moveTo(x,y);c.lineTo(x+16,y+8);c.lineTo(x+4,y+18);}else{c.moveTo(x,y);c.bezierCurveTo(x+10,y-12,x+16,y+12,x+26,y);}c.stroke();}},{repeat:true});carpet.repeat.set(16,4);
   floor(pbr({map:carpet,roughness:.6,clearcoat:.15},q));B(60,7,.3,M(0x100820),0,3.5,-9.4);B(60,.3,14,M(0x0c0618),0,6.4,-3);for(let i=0;i<5;i++)glowBox(60,.05,.1,[0xff5fc8,0x5ee7ff][i%2],0,6.2,1.5-i*2.4,2.6);
   const screens=[];for(let r=0;r<2;r++)for(let i=0;i<10;i++){const x=-13.5+i*3+(r?1.5:0),z=r?-8.2:-4.2,col=[0x5ee7ff,0xff5fc8,0xffe45e,0xb9ff5e,0xc78bff][(i+r*2)%5];B(1.3,2.4,1,M(0x15121f,{r:.5,m:.2}),x,1.2,z);glowBox(1.34,.34,1.04,col,x,2.45,z,1.6);const sc=glowBox(1,.76,.04,col,x,1.62,z+.52,1.5);screens.push(sc);B(1.05,.16,.5,M(0x2a2740),x,1,z+.45);}
   this.ticks.push(t=>{for(let i=0;i<screens.length;i++)screens[i].material.emissiveIntensity=1.1+.7*Math.sin(t*(2+i%5)+i);});
   const glass=new T.Mesh(new T.BoxGeometry(2,2.4,2),new T.MeshStandardMaterial({color:0xbfe8ff,transparent:true,opacity:.18,roughness:.05}));glass.position.set(11.5,2.2,-5.6);w.add(glass);B(2.1,1,2.1,M(0xff5fc8,{m:.4,r:.3}),11.5,.5,-5.6);glowBox(2.1,.3,2.1,0xffe45e,11.5,3.55,-5.6,1.5);
   crowd(24,-11,10,-6.6,-5.6,0);
   hazard(1,g=>{HB(g,1.1,2.3,1.2,M(0xffc21f,{m:.5,r:.3}),0,1.15,0);const p=HB(g,.06,.8,.8,M(0xffe9a0,{e:0xffd25e,ei:1.6}),-.56,1.5,0);g.userData.p=p;});
  }else if(id==='market'){
   look(0x120608,0x3a1608,0xff8a3d,0x1a0c08,.019,0xffd8a0,0x301810,.8,0xffe2b8,2.2,0xff6a3d,0xffd25e,2.3);
   const cob=texture(256,256,(c,s)=>{c.fillStyle='#3a3230';c.fillRect(0,0,s,s);for(let y=0;y<8;y++)for(let x=0;x<8;x++){const g=40+((x*7+y*13)%5)*8;c.fillStyle=`rgb(${g+26},${g+14},${g+8})`;c.beginPath();c.roundRect(x*32+(y%2)*16-14,y*32+2,28,28,7);c.fill();}},{repeat:true});cob.repeat.set(20,5);
   floor(pbr({map:cob,roughness:.5,clearcoat:.3},q));const fm=facadeMaterials();for(let i=0;i<7;i++){const m=new T.Mesh(new T.BoxGeometry(7,12,4),fm[i%4]);m.position.set(-21+i*7,6,-11.5);w.add(m);}
   const aw=c1=>texture(128,64,(c)=>{for(let i=0;i<8;i++){c.fillStyle=i%2?c1:'#fff4e0';c.fillRect(i*16,0,16,64);}});
   [[-10,'#d8303c'],[-5,'#2a8a6a'],[0,'#e8a020'],[5,'#3a60c8'],[10,'#d8303c']].forEach(([x,c1],i)=>{B(3.4,1,1.4,M(0x6a4028,{r:.8}),x,.5,-4.6);const a=new T.Mesh(new T.BoxGeometry(3.8,.1,2.2),new T.MeshStandardMaterial({map:aw(c1),roughness:.8}));a.position.set(x,3,-4.3);a.rotation.x=.28;w.add(a);for(const dx of [-1.6,1.6])B(.1,3,.1,M(0x3a2a20),x+dx,1.5,-3.6);
    glowBox(.4,.5,.4,0xff9a3d,x-1,2.4,-3.7,3);glowBox(.4,.5,.4,0xffd25e,x+1,2.4,-3.7,3);for(let k=0;k<4;k++)B(.5,.3,.5,M([0xe85030,0xf2c04a,0x6ab04a,0xf0e0c0][(k+i)%4]),x-1.1+k*.72,1.15,-4.5);});
   for(let i=0;i<34;i++){const u=i/33,x=-15+u*30;glowBox(.14,.14,.14,[0xff9a3d,0xffd25e,0xff5f7a][i%3],x,4.6-Math.sin(u*Math.PI*5)**2*.6,-2.2-(i%2)*2.4,3.4);}
   this.ticks.push(t=>{if(Math.floor(t*6)!==this.steamT&&!this.cine){this.steamT=Math.floor(t*6);const x=[-10,-5,0,5,10][this.steamT%5];this.particles.burst(x,1.5,-4.5,this.lite?1:3,0xffe8d0,{speed:.4,life:2,gravity:.9,up:.5});}});
   crowd(26,-12,12,-6.4,-5.5,0);
   hazard(-1,g=>{HB(g,1.4,.9,1.6,M(0x7a2e1e,{r:.7}),0,.6,0);const pot=new T.Mesh(new T.CylinderGeometry(.5,.42,.7,14),M(0x2e3138,{m:.8,r:.35}));pot.position.set(0,1.4,0);g.add(pot);const p=HB(g,.9,.04,.9,M(0xf0b860,{e:0xc07818,ei:1.2}),0,1.76,0);g.userData.p=p;HB(g,.08,2.6,.08,M(0x3a2a20),-.6,1.3,-.7);HB(g,1.6,.08,1.9,M(0xd8303c),0,2.6,0);});
  }else{
   look(0x1a2a5a,0xff9a6a,0xffc890,0x4a3040,.011,0xffd0b0,0x203040,.95,0xffe0c0,1.7,0xff9a4a,0xffb070,3.2);this.stage.r.toneMappingExposure=1.1;
   const con=texture(256,256,(c,s)=>{c.fillStyle='#5a5e66';c.fillRect(0,0,s,s);for(let i=0;i<900;i++){c.fillStyle=i%2?'#ffffff0c':'#00000018';c.fillRect((i*73)%256,(i*41)%256,4,3);}c.strokeStyle='#3a3d44';c.lineWidth=3;c.strokeRect(0,0,s,s);c.fillStyle='#f2c21f';for(let i=0;i<8;i++){c.save();c.translate(i*36,236);c.transform(1,0,-1,1,0,0);c.fillRect(0,0,18,20);c.restore();}},{repeat:true});con.repeat.set(12,3);
   floor(pbr({map:con,roughness:.75},q));const water=new T.Mesh(new T.PlaneGeometry(400,200).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x2a4a6a,roughness:.08,metalness:.9}));water.position.set(0,-1.2,-110);w.add(water);B(60,1.4,.5,M(0x4a4e56),0,-.6,-9.8);
   const sun=new T.Mesh(new T.CircleGeometry(9,40),new T.MeshBasicMaterial({color:new T.Color(3,1.9,1),fog:false}));sun.position.set(14,7,-190);w.add(sun);
   const corr=c1=>{const t=texture(128,64,(c,s,h)=>{c.fillStyle=c1;c.fillRect(0,0,s,h);for(let x=0;x<s;x+=8){c.fillStyle='#00000035';c.fillRect(x,0,3,h);c.fillStyle='#ffffff18';c.fillRect(x+4,0,2,h);}},{repeat:true});t.repeat.set(3,1);return new T.MeshStandardMaterial({map:t,roughness:.6,metalness:.4});};
   const cm=['#c8483a','#2a7a8a','#d8a020','#3a5a9a','#5a8a4a'].map(corr);[[-12,0,0],[-12,1,1],[-6,0,2],[-6,1,3],[-6,2,0],[1,0,4],[7,0,1],[7,1,2],[13,0,3],[13,1,0],[13,2,4]].forEach(([x,l,c])=>B(5.6,2.5,2.4,cm[c],x+(l%2)*.3,1.25+l*2.5,-7.6));
   const cr=M(0x1c2430,{m:.6,r:.5});B(.7,22,.7,cr,-16,11,-16);B(.7,22,.7,cr,-12,11,-16);B(16,.8,.8,cr,-8,21,-16);B(.2,7,.2,cr,-2,17.4,-16);B(5,1,1,cr,-14,16,-16);
   const gulls=[];for(let i=0;i<5;i++){const gm=new T.Mesh(new T.BoxGeometry(.7,.04,.16),M(0xf4f4f4));w.add(gm);gulls.push(gm);}this.ticks.push(t=>{gulls.forEach((gm,i)=>{const a=t*.3+i*1.3;gm.position.set(Math.cos(a)*(9+i*2),7+i*.8+Math.sin(t+i),-12+Math.sin(a)*5);gm.rotation.y=-a;gm.rotation.z=Math.sin(t*5+i)*.5;});});
   crowd(18,-9,9,-5.9,-5,0);
   hazard(1,g=>{for(const [x,y,z,s]of [[0,.5,0,1],[.1,1.5,.1,1],[-.1,2.4,-.1,.8],[0,.4,1.1,.8]])HB(g,s,s,s,M(0xb98a4a,{r:.9}),x,y,z);const p=HB(g,.04,.5,.5,M(0xffe9a0,{e:0xffd25e,ei:.6}),-.52,1.5,.1);g.userData.p=p;});
  }
  if(id!=='docks')this.stage.r.toneMappingExposure=1.05;this.hemi.intensity=this.base.hemi;this.key.intensity=this.base.key;this.rimA.intensity=this.rimB.intensity=this.base.rim;
 }

 // ── Fighters.
 rig(fid,dawg){const key=fid+(fid==='you'&&dawg?':'+(dawg.id||'')+(dawg.fashion?JSON.stringify(dawg.fashion.equipped):''):'');let r=this.rigCache.get(key);if(!r){r=new Rig(fid,dawg,this.quality);this.rigCache.set(key,r);}return r;}
 setFighters(a,b,dawg){for(const r of this.rigs)if(r){r.holder.removeFromParent();r.shadow.removeFromParent();}
  const ra=this.rig(a,dawg);let rb=this.rig(b,a===b?null:dawg);if(rb===ra){rb=new Rig(b,null,this.quality);this.rigCache.set(b+':mirror',rb);}this.rigs=[ra,rb];
  for(const r of this.rigs){r.setMat('normal');r.holder.visible=true;r.holder.scale.setScalar(1);r.extra=[0,0,0];r.spin=0;r.flash=0;this.scene.add(r.holder,r.shadow);}
  this.introT=0;this.zoom=0;this.camX=0;}

 // ── Cinematic hooks used by the director.
 cineBegin(){this.cine=true;this.overlay.classList.add('on');for(const [m]of this.projMesh)this.dropProj(m);}
 cineEnd(){this.cine=false;this.overlay.classList.remove('on','stamp');this.overlay.querySelector('.fc-say').textContent='';this.cineSky('stage');this.dimGoal=1;this.spot.intensity=0;this.camera.fov=38;this.camera.updateProjectionMatrix();}
 cineLight(amb,color){this.dimGoal=amb;this.spot.intensity=amb<.8?60:0;this.spot.color.set(color??0xffffff);const d=this.director;this.spot.position.set(d.ox,8,4);this.spot.target.position.set(d.ox+d.dir*.6,1,0);}
 cineSky(kind){const space=kind==='space';this.world.visible=!space;this.stars.visible=space;this.sky.visible=!space;this.scene.fog.density=space?0:this.fogD??this.scene.fog.density;if(!space&&this.fogD===undefined)this.fogD=this.scene.fog.density;if(space)this.fogD=this.fogD??0;}
 cineStamp(text,sub){const o=this.overlay,s=o.querySelector('.fc-stamp');s.querySelector('b').textContent=text;s.querySelector('span').textContent=sub||'';o.classList.remove('stamp');void o.offsetWidth;o.classList.add('stamp');this.stage.shake(.5);this.stage.flashOnce(0xffffff,.35,this.reduced);}
 cineSay(text){const p=this.overlay.querySelector('.fc-say');p.textContent=text;p.classList.remove('show');void p.offsetWidth;p.classList.add('show');}
 /** Start a finisher between the two current rigs. winner: 0|1. */
 playCine(id,{winner=0,ox=null,seed=1,loop=false}={}){const w=this.rigs[winner],l=this.rigs[1-winner],wx=w.holder.position.x,lx=l.holder.position.x,dir=wx<=lx?1:-1;this.fogD=this.scene.fog.density;
  for(const r of this.rigs){r.spin=0;r.flash=0;}return this.director.start(id,{w,l,ox:ox??clamp((wx+lx)/2,-3.6,3.6),dir,seed,loop});}
 stopCine(){this.director.stop();}

 // ── Per-frame.
 ring(x,y,z,color,size=1.6,flat=false){const r=this.rings.reduce((a,b)=>a.t>b.t?a:b);r.t=0;r.s=size;r.m.visible=true;r.m.position.set(x,y,z);r.m.material.color.set(color);r.m.rotation.set(flat?-Math.PI/2:0,0,0);}
 arc(x,y,z,face,color,kind,size=1){const a=this.arcs.reduce((p,c)=>p.t>c.t?p:c);a.t=0;a.m.visible=true;a.m.position.set(x,y,z);a.m.material.color.set(color);a.m.scale.set(size*face,size,size);a.m.rotation.set(kind==='flat'?-1.2:0,0,kind==='up'?1.2:kind==='down'?-1.2:0);}
 dropProj(p){const m=this.projMesh.get(p);if(m){this.fx.remove(m);m.traverse(o=>{o.geometry?.dispose();});this.projMesh.delete(p);}}
 projFor(p,color){const g=new T.Group(),k=p.k,em=(c,ei=3)=>mat(c,{e:c,ei}),add=(geo,m)=>{const o=new T.Mesh(geo,m);g.add(o);return o;};
  if(k==='paint'){add(new T.SphereGeometry(.2,12,10),em(0xff5fc8));add(new T.SphereGeometry(.34,10,8),mat(0xff5fc8,{a:.3,e:0xff5fc8,ei:1.5}));}
  else if(k==='ball')add(new T.SphereGeometry(.2,12,10),mat(0xd8f04a,{e:0x7a9a10,ei:1.2,r:.8}));
  else if(k==='can'){const c=add(new T.CylinderGeometry(.16,.16,.42,12),mat(0x5ee7ff,{m:.8,r:.3,e:0x1a6a80,ei:1}));c.rotation.x=Math.PI/2;c.position.y=.18;}
  else if(k==='puddle'){const c=add(new T.CircleGeometry(.75,20),mat(0xff5fc8,{r:.05,m:.3,e:0x80205a,ei:1}));c.rotation.x=-Math.PI/2;c.position.y=.03;}
  else if(k==='crown'){const c=add(new T.TorusGeometry(.24,.07,8,18),mat(0xffc93d,{m:1,r:.2,e:0x805a00,ei:1}));c.rotation.x=Math.PI/2;}
  else if(k==='coin'){const c=add(new T.CylinderGeometry(.24,.24,.06,16),mat(0xffc93d,{m:1,r:.2,e:0x805a00,ei:1.4}));c.rotation.x=Math.PI/2;}
  else if(k==='quake'){const c=add(new T.ConeGeometry(.5,.9,5),em(color,2));c.position.y=.3;const d=add(new T.ConeGeometry(.35,.6,5),em(0xffffff,2));d.position.set(-.5,.2,.2);}
  else if(k==='decoy'){const c=add(new T.CapsuleGeometry(.3,.9,4,10),mat(0x5ee7ff,{a:.4,e:0x5ee7ff,ei:2}));c.position.y=.8;const h=add(new T.SphereGeometry(.34,10,8),mat(0x5ee7ff,{a:.4,e:0x5ee7ff,ei:2}));h.position.y=1.55;}
  else if(k==='beam'){const c=add(new T.CylinderGeometry(.42,.42,p.w*2,14,1,true),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(2.5),transparent:true,opacity:.85,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));c.rotation.z=Math.PI/2;const d=add(new T.CylinderGeometry(.2,.2,p.w*2,10,1,true),new T.MeshBasicMaterial({color:new T.Color(3,3,3),toneMapped:false}));d.rotation.z=Math.PI/2;}
  else add(new T.SphereGeometry(.2,10,8),em(color));
  this.fx.add(g);this.projMesh.set(p,g);return g;}
 events(g,events){const P=this.particles,R=this.rigs;
  for(const e of events){switch(e.type){
   case 'hit':{const c=R[e.by].color,n=(this.lite?6:14)*e.w;P.burst(e.x,e.y,.25,n,c,{speed:3+e.w*1.6,life:.45,gravity:-9,up:1.5});P.burst(e.x,e.y,.25,Math.ceil(n/2),0xffffff,{speed:5+e.w,life:.25,gravity:-4,up:.5});this.ring(e.x,e.y,.3,e.counter?0xff4d5e:0xffffff,.8+e.w*.5);
    this.fill.position.set(e.x,e.y,1.4);this.fill.color.set(c);this.fill.intensity=14+e.w*8;R[e.side].flash=.35+e.w*.1;this.stage.shake(.12+e.w*.09);if(e.w>=3)this.stage.flashOnce(c,.12,this.reduced);this.excite=Math.min(1,this.excite+.12*e.w);this.roll=(e.side?1:-1)*.012*e.w;this.sfx('hit'+Math.min(3,e.w));break;}
   case 'throw':P.burst(e.x,.4,.2,this.lite?16:40,0xffffff,{speed:5,life:.6,gravity:-8,up:3});this.ring(e.x,.1,0,R[e.side].color,3,true);this.stage.shake(.5);this.excite=1;this.sfx('boom');break;
   case 'block':P.burst(e.x,e.y,.3,this.lite?4:9,0x8fd8ff,{speed:2.6,life:.3,gravity:-3,up:.6});this.sfx('block');break;
   case 'snap':P.burst(e.x,e.y,.3,this.lite?8:18,0xffffff,{speed:4,life:.4,gravity:-2,up:.8});this.ring(e.x,e.y,.3,0x8fd8ff,1.5);this.sfx('snap');break;
   case 'armor':P.burst(e.x,e.y,.3,10,0xffd25e,{speed:3,life:.3,gravity:-4});this.ring(e.x,e.y,.3,0xffd25e,1.2);this.sfx('clank');break;
   case 'counter':this.ring(e.x,e.y,.3,0x5effc1,2.6);this.stage.flashOnce(0x5effc1,.3,this.reduced);this.sfx('counter');break;
   case 'move':if(e.w>=2)this.sfx(e.kind==='normal'?'swing':'whoosh');break;
   case 'super':this.zoom=1;this.zoomSide=e.side;this.dimGoal=.35;this.stage.flashOnce(R[e.side].color,.5,this.reduced);this.ring(R[e.side].holder.position.x,1.1,.2,R[e.side].color,5);this.sfx('super');break;
   case 'underdawg':{const x=R[e.side].holder.position.x;this.ring(x,1,.2,R[e.side].color,7);this.ring(x,.1,0,0xffffff,6,true);P.burst(x,1,.2,this.lite?30:80,R[e.side].color,{speed:8,life:.8,gravity:-2,up:2});this.stage.flashOnce(R[e.side].color,.6,this.reduced);this.stage.shake(.7);this.sfx('under');break;}
   case 'proj':this.sfx('proj');break;case 'projend':P.burst(e.x,e.y,.2,10,0xffffff,{speed:3,life:.3,gravity:-2});this.sfx('pop');break;
   case 'tele':for(const x of [e.from,e.to])P.burst(x,1+e.y*.5,.2,this.lite?10:24,R[e.side].color,{speed:3,life:.4,gravity:0,up:0});this.sfx('tele');break;
   case 'grab':this.sfx('grab');break;case 'tech':this.ring(R[e.side].holder.position.x,1.2,.3,0xffffff,2);this.sfx('tech');break;
   case 'jump':this.sfx('jump');break;case 'dash':P.burst(R[e.side].holder.position.x,.1,.2,6,0xd8c8a8,{speed:1.5,life:.4,gravity:-1,up:.4});break;
   case 'land':P.burst(e.x,.08,.2,e.heavy?18:6,0xd8c8a8,{speed:2,life:.4,gravity:-2,up:.6});this.sfx('land');if(e.heavy)this.stage.shake(.25);break;
   case 'down':P.burst(e.x,.08,.2,this.lite?8:20,0xd8c8a8,{speed:2.6,life:.5,gravity:-2,up:.8});this.stage.shake(.22);this.sfx('thud');break;
   case 'wall':P.burst(e.x,e.y,.2,this.lite?14:36,0xffffff,{speed:5,life:.5,gravity:-6,up:1});this.ring(e.x,e.y,.2,0xffffff,3);this.stage.shake(.5);this.sfx('hit3');break;
   case 'hazard':if(this.hazard){this.hazard.t=0;P.burst(this.hazard.g.position.x,2,.3,this.lite?30:90,0xffe45e,{speed:8,life:.9,gravity:-9,up:4});}this.stage.flashOnce(0xffe45e,.4,this.reduced);this.stage.shake(.8);this.sfx('hazard');break;
   case 'heal':P.burst(R[e.side].holder.position.x,1.2,.2,16,0x5effc1,{speed:1.5,life:.9,gravity:1.5,up:1});this.sfx('heal');break;
   case 'ko':case 'time':this.stage.flashOnce(0xffffff,.7,this.reduced);this.stage.shake(.8);this.excite=1;this.sfx('ko');this.koT=0;break;
   case 'round':this.introT=0;this.sfx('round');break;case 'fight':this.sfx('go');break;
   case 'finishwin':this.dimGoal=.45;this.sfx('sting');break;
   case 'finisher':{const w=g.f[e.winner],l=g.f[e.loser];R[0].holder.position.x=g.f[0].x;R[1].holder.position.x=g.f[1].x;this.playCine(e.id,{winner:e.winner,seed:g.seed+g.frame});this.cinePt=0;break;}
   case 'over':this.dimGoal=1;break;
  }}}
 /** Draw one frame of a match. dt is real seconds. */
 frame(g,events,dt){if(!this.ready||this.dead)return;this.time+=dt;const t=this.time;if(events?.length)this.events(g,events);
  if(g.phase==='cine'&&this.director.active){const target=g.pt/60;this.director.update(Math.max(0,Math.min(.1,target-this.director.t+(this.director.holdT>0?dt:0))));this.common(dt,true);return;}
  if(this.director.active&&g.phase!=='cine'&&!this.resultLoop)this.director.stop();
  if(this.director.active){this.director.update(dt);this.common(dt,true);return;}
  this.introT+=dt;
  for(const f of g.f){const r=this.rigs[f.side],F=r.F,o=g.f[1-f.side];let x=f.x;
   if(g.phase==='intro'&&g.round===1){const k=clamp(g.pt/70,0,1);x+=(f.side?1:-1)*(1-k)*(1-k)*5;if(k<1)mix(r.tgt,POSE.walkA,POSE.walkB,.5+.5*Math.sin(t*11));else namedPose(r.tgt,'taunt',t);}
   else if(f.st==='atk'){const m=F.moves[f.mv];clipPose(r.tgt,m,f.mt,t);if(f.mt===m.s+1&&m.dmg>0&&m.lv!=='throw'){const up=/upper|rise|upswing/.test(m.anim),dn=/over|slam|stomp|dive/.test(m.anim);this.arc(f.x+f.face*Math.min(1.4,m.x1*.75),f.y+(m.lv==='low'?.4:up?1.6:1.15),.35,f.face,m.weapon||F.weapon&&m.kind!=='normal'?0xffd25e:r.color,up?'up':dn?'down':m.lv==='low'||/hook|swing|sweep/.test(m.anim)?'flat':'mid',m.kind==='normal'?.8+m.w*.2:1.4);}}
   else statePose(r.tgt,f,t+f.side*1.7,g.phase);
   r.spin=f.st==='launch'?r.spin+dt*(f.jug>0?9:5)*-1:f.st==='atk'&&(F.moves[f.mv].anim==='roll')?r.spin+dt*16:0;
   const tele=f.st==='atk'&&F.moves[f.mv].tele&&Math.abs(f.mt-F.moves[f.mv].tele[0])<3;
   r.holder.visible=!tele;r.holder.position.set(x,f.y,0);const yaw=f.face>0?Math.PI/2-.42:-Math.PI/2+.42;r.holder.rotation.y=(f.st==='down'||f.st==='ko')?(f.face>0?Math.PI/2:-Math.PI/2):yaw;
   r.flash=Math.max(0,r.flash-dt*3);r.apply(f.face,g.hitstop>0?0:f.st==='atk'?.55:.3);
   r.shadow.position.set(x,.02,0);r.shadow.material.opacity=.7*clamp(1-f.y/3,.25,1);r.aura.intensity=f.ud>0?10+Math.sin(t*20)*4:0;
   if(f.ud>0&&Math.random()<.5)this.particles.burst(x+(Math.random()-.5)*.6,f.y+.2,.1,1,r.color,{speed:.3,life:.7,gravity:3,up:1.5});}
  // Projectiles.
  for(const p of g.proj){const m=this.projMesh.get(p)||this.projFor(p,this.rigs[p.o].color);m.position.set(p.x,p.y+(p.k==='beam'?p.h/2:p.h/2*(p.trap?0:1)),.15);if(p.k==='crown'||p.k==='coin')m.rotation.y=t*14;if(p.k==='can')m.rotation.z=-t*12*Math.sign(p.vx||1);if(p.k==='beam')m.scale.set(1,1+Math.sin(t*50)*.25,1+Math.sin(t*50)*.25);if(p.k==='paint'||p.k==='ball')this.particles.burst(p.x,p.y+.2,.15,1,p.k==='paint'?0xff5fc8:0xd8f04a,{speed:.5,life:.3,gravity:0,up:0});}
  for(const [p]of this.projMesh)if(!g.proj.includes(p))this.dropProj(p);
  // Camera.
  const [a,b]=g.f,ia=this.rigs[0].holder.position.x,ib=this.rigs[1].holder.position.x,mid=(ia+ib)/2,dist=Math.abs(ib-ia),top=Math.max(a.y,b.y),cam=this.camera,vf=38,hf=2*Math.atan(Math.tan(vf*Math.PI/360)*cam.aspect);
  let z=Math.max(5.4,(dist/2+1.45)/Math.tan(hf/2)),cx=mid*.92,cy=1.5+top*.35+z*.04,ax=mid,ay=1.12+top*.4;
  this.zoom=Math.max(0,this.zoom-dt*(g.freeze>0?0:1.6));
  if(g.freeze>0||this.zoom>0){const k=Math.min(1,this.zoom),r=this.rigs[this.zoomSide||0].holder.position;cx=lerp(cx,r.x,k*.7);z=lerp(z,Math.max(3.6,z*.55),k);cy=lerp(cy,1.3,k);ax=lerp(ax,r.x,k*.7);}
  if(g.phase==='ko'){const l=g.f[1-(g.koBy?.winner??0)];const k=clamp(g.pt/40,0,1)*.5;cx=lerp(cx,l.x,k);ax=lerp(ax,l.x,k);z=lerp(z,z*.72,k);}
  if(g.phase==='finish'){z*=.9;cy-=.25;}
  if(g.phase==='over'&&g.result){const wr=this.rigs[g.result.winner].holder.position;cx=lerp(cx,wr.x,.8);ax=lerp(ax,wr.x,.8);z=Math.max(3.4,z*.5);cy=1.35;ay=1.15;}
  if(g.phase==='intro'&&g.round===1){const k=clamp(g.pt/90,0,1);z+=(1-k)*2.5;cy+=(1-k)*.8;cx+=Math.sin((1-k)*2)*2;}
  if(g.freeze===0&&g.phase!=='super')this.dimGoal=g.phase==='finish'?.45:this.dimGoal<.4?1:this.dimGoal;if(g.phase==='fight'&&g.freeze===0&&this.zoom<=0)this.dimGoal=1;
  const f=Math.min(1,dt*(this.snapCam?99:7));this.snapCam=false;this.camX=lerp(this.camX,cx,f);this.camZ=lerp(this.camZ,z,f);this.camY=lerp(this.camY,cy,f);this.ax=lerp(this.ax??ax,ax,f);this.ay=lerp(this.ay??ay,ay,f);
  cam.fov=vf;cam.updateProjectionMatrix();cam.position.set(this.camX,this.camY,this.camZ);this.stage.applyShake(t,this.reduced);this.roll*=Math.pow(.02,dt);cam.up.set(Math.sin(this.roll),Math.cos(this.roll),0);cam.lookAt(this.ax,this.ay,0);
  this.stage.followSun(this.key,mid,1,0);this.common(dt,false);}
 camCut(){this.snapCam=true;}
 common(dt,cine){const t=this.time;this.excite=Math.max(0,this.excite-dt*.5);for(const fn of this.ticks||[])fn(t,dt);
  this.dim=lerp(this.dim,this.dimGoal,Math.min(1,dt*6));const b=this.base;if(b){this.hemi.intensity=b.hemi*this.dim;this.key.intensity=b.key*(.25+.75*this.dim);}
  this.fill.intensity*=Math.pow(.0005,dt);
  for(const a of this.arcs){if(a.t>.2){a.m.visible=false;continue;}a.t+=dt;const k=a.t/.2;a.m.material.opacity=(1-k)*.9;a.m.rotation.z+=dt*-9*Math.sign(a.m.scale.x);}
  for(const r of this.rings){if(r.t>.35){r.m.visible=false;continue;}r.t+=dt;const k=r.t/.35,s=r.s*(.3+k*1.2);r.m.scale.set(s,s,s);r.m.material.opacity=(1-k)*.9;if(r.m.rotation.x===0)r.m.quaternion.copy(this.camera.quaternion);}
  if(this.hazard){const h=this.hazard;h.t+=dt;const p=h.g.userData.p;if(p)p.material.emissiveIntensity=h.t<1?(Math.sin(t*60)>0?6:.2):1.2+.5*Math.sin(t*3);h.g.rotation.z=h.t<.6?Math.sin(h.t*40)*.06*(1-h.t/.6):0;}
  this.particles.update(dt);this.sky.position.copy(this.camera.position);this.stage.resize();this.stage.render(dt,t,{reduced:this.reduced});}
 /** Character select / gallery: one fighter posing on the stage. */
 showcase(fid,dt,dawg,pose='stand'){if(!this.ready||this.dead)return;this.time+=dt;const t=this.time;if(this.director.active)this.director.stop();
  if(this.showId!==fid+pose[0]||this.rigs[1]){this.showId=fid+pose[0];for(const r of this.rigs)if(r){r.holder.removeFromParent();r.shadow.removeFromParent();}const r=this.rig(fid,dawg);this.rigs=[r,null];r.setMat('normal');r.holder.visible=true;r.holder.scale.setScalar(1);r.extra=[0,0,0];r.spin=0;this.scene.add(r.holder,r.shadow);this.showT=0;}
  const r=this.rigs[0];this.showT+=dt;const cyc=this.showT%6;namedPose(r.tgt,pose!=='stand'?pose:cyc<3.4?'stand':cyc<4.6?'taunt':'cheer',t);if(pose==='stand'&&cyc<3.4){statePose(r.tgt,{st:'idle'},t);}
  r.holder.position.set(0,0,0);r.holder.rotation.y=.35+Math.sin(t*.5)*.25;r.apply(1,Math.min(1,dt*9));r.shadow.position.set(0,.02,0);r.aura.intensity=6;
  const cam=this.camera,asp=cam.aspect,z=asp<1?5.6:4.3;cam.fov=38;cam.updateProjectionMatrix();cam.position.set(asp<1?0:-1.25,1.25,z);cam.up.set(0,1,0);cam.lookAt(asp<1?0:-1.25,asp<1?1.25:.95,0);this.dimGoal=.8;this.common(dt,false);}
 /** A small head-and-shoulders picture of a fighter as a data URL (for portraits). */
 portrait(fid,dawg,size=128){try{const r=this.rig(fid,dawg),sc=new T.Scene(),cam=new T.PerspectiveCamera(30,1,.1,30),par=r.holder.parent;sc.environment=this.scene.environment;sc.environmentIntensity=.6;sc.background=new T.Color(r.color).multiplyScalar(.16);
   sc.add(new T.HemisphereLight(0xffffff,0x303040,1.6));const k=new T.DirectionalLight(0xffffff,2.6);k.position.set(-2,3,4);const rim=new T.DirectionalLight(r.color,3);rim.position.set(3,2,-3);sc.add(k,rim);
   mix(r.cur,POSE.stand,POSE.stand,0);mix(r.tgt,POSE.stand,POSE.stand,0);r.extra=[0,0,0];r.spin=0;const hv=r.holder.visible;r.holder.visible=true;r.holder.position.set(0,0,0);r.holder.rotation.y=.5;r.holder.scale.setScalar(1);r.setMat('normal');r.apply(1,1);sc.add(r.holder);const hy=r.H*.8;cam.position.set(.25,hy+.05,2.5*r.F.scale);cam.lookAt(.05,hy,0);
   const rt=new T.WebGLRenderTarget(size,size,{samples:this.lite?0:4}),R=this.stage.r,buf=new Uint8Array(size*size*4);R.setRenderTarget(rt);R.render(sc,cam);R.readRenderTargetPixels(rt,0,0,size,size,buf);R.setRenderTarget(null);rt.dispose();
   const el=document.createElement('canvas');el.width=el.height=size;const c=el.getContext('2d'),img=c.createImageData(size,size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const s=((size-1-y)*size+x)*4,d=(y*size+x)*4;for(let j=0;j<3;j++)img.data[d+j]=Math.min(255,Math.pow(buf[s+j]/255,1/2.2)*255*1.08);img.data[d+3]=255;}c.putImageData(img,0,0);
   sc.remove(r.holder);if(par)par.add(r.holder);r.holder.visible=hv;return el.toDataURL('image/jpeg',.85);}catch{return null;}}
 resize(){this.stage?.resize();}
 dispose(){if(this.dead&&!this.stage)return;this.dead=true;this.director?.stop();for(const r of this.rigCache.values())r.dispose();this.rigCache.clear();this.overlay?.remove();this.stage?.dispose();}
}
export {FIGHTERS};
