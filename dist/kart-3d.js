// Three.js presentation for Drift Dawgs. KartGame owns every rule; this module draws the seeded
// circuit in its theme (kart-art.js builds it), the six karts and everything that sells speed
// and contact: skid marks, tyre smoke, sparks, flames, speed lines, shunts, the start lights,
// the last-lap treatment and the podium shot. Third person is the chase cam; first person sits
// in the driver's seat.
// World units: one track metre is one metre. Track (x, y) at height h sits at world (x, h, -y),
// and a kart with heading θ faces (cos θ, 0, -sin θ), so rotation.y = θ.
import {T,quality,fitFov,radial,glowStops,skyMaterial,castShadows,contactShadow,contactShadowMaterial,auraMaterial,Stage,Particles,CameraRig,Hud,AmbientLoop} from './three-kit.js';
import {KART,RIVALS,FEATS,CUPS,trackAt,trackPoint,trackHeight,ordinal} from './kart-engine.js';
import {heatLabel} from './difficulty.js';
import {loadKartArt,kartRig,buildCircuit,LOOKS} from './kart-art.js';
import {makeDawg} from './dawg-career.js';

const ICONS={boost:'⚡',bone:'🦴',rocket:'🚀',shield:'🛡️',howl:'📣'},LABELS={boost:'BOOST',bone:'BONE',rocket:'ROCKET',shield:'SHIELD',howl:'HOWL'},CAUSE={bone:'A BONE',rocket:'ROCKET',howl:'HOWL'};
const HUD_HTML='<div class="k-top"><div class="k-place"><b>6</b><i>th</i></div><div class="k-lap"><small>LAP</small><b>1/3</b></div></div><ol class="k-tower"></ol><canvas class="k-map" width="220" height="220" aria-hidden="true"></canvas><canvas class="k-mirror" width="320" height="84" aria-hidden="true" hidden></canvas>'
 +'<div class="k-side"><div class="k-item" data-empty="1"><b></b><small>ITEM</small></div><div class="k-coins"><i></i><b>0</b></div><div class="k-speed"><b>0</b><small>KM/H</small></div></div>'
 +'<div class="d3-power k3-drift" hidden><span>DRIFT</span><em><s></s></em></div><div class="k-lights" hidden><p><i></i><i></i><i></i><i></i></p><small>HIT ANY CONTROL AS THE GREEN COMES ON</small></div>'
 +'<div class="k-rush"></div><div class="k-edge"></div><div class="k-warn" hidden>⚠ INCOMING</div><div class="k-name" hidden><small></small><b></b><em></em></div><div class="k-feat" hidden><small>FEAT</small><b></b></div><div class="k-tip" hidden></div>'
 +'<div class="k-result" hidden><small></small><b></b><em></em><ol></ol></div>';
function styles(){if(document.getElementById('kartCss'))return;const l=document.createElement('link');l.id='kartCss';l.rel='stylesheet';l.href=new URL('./kart.css',import.meta.url).href;document.head.append(l);}

// The stand-in kart shown until the model karts arrive.
function kartModel(color){const g=new T.Group(),body=new T.MeshStandardMaterial({color,metalness:.55,roughness:.25,emissive:color,emissiveIntensity:.2}),dark=new T.MeshStandardMaterial({color:0x111118,metalness:.4,roughness:.6});
 g.add(new T.Mesh(new T.BoxGeometry(1.9,.32,1.15).translate(0,.32,0),body),new T.Mesh(new T.BoxGeometry(.7,.22,.9).translate(1.15,.28,0),body),new T.Mesh(new T.BoxGeometry(.12,.35,1.3).translate(-1,.72,0),body),new T.Mesh(new T.BoxGeometry(.5,.45,.7).translate(-.35,.6,0),dark));
 const wheelGeo=new T.CylinderGeometry(.27,.27,.26,16).rotateX(Math.PI/2);for(const [x,z]of [[.7,.62],[.7,-.62],[-.7,.65],[-.7,-.65]]){const w=new T.Mesh(wheelGeo,dark);w.position.set(x,.27,z);g.add(w);}
 const head=new T.Mesh(new T.SphereGeometry(.34,18,14),new T.MeshStandardMaterial({color:0xe9c79a,roughness:.7}));head.position.set(-.3,1.1,0);g.add(head);return {root:g,head};}

// Soft alpha-blended puffs for tyre smoke, dust and spray (the shared Particles are additive).
class Puffs{
 constructor(scene,n){this.n=n;this.pos=new Float32Array(n*3);this.vel=new Float32Array(n*3);this.col=new Float32Array(n*4);this.size=new Float32Array(n);this.life=new Float32Array(n);this.max=new Float32Array(n);this.grow=new Float32Array(n);this.alpha=new Float32Array(n);this.next=0;
  const g=this.geo=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(this.pos,3).setUsage(T.DynamicDrawUsage));g.setAttribute('aColor',new T.BufferAttribute(this.col,4).setUsage(T.DynamicDrawUsage));g.setAttribute('aSize',new T.BufferAttribute(this.size,1).setUsage(T.DynamicDrawUsage));
  this.mat=new T.ShaderMaterial({uniforms:{uScale:{value:600}},transparent:true,depthWrite:false,vertexShader:'attribute vec4 aColor;attribute float aSize;uniform float uScale;varying vec4 vC;void main(){vC=aColor;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aSize*uScale/max(.1,-mv.z);}',
   fragmentShader:'varying vec4 vC;void main(){float d=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-d),1.7)*vC.a;if(a<.004)discard;gl_FragColor=vec4(vC.rgb,a);}'});
  this.points=new T.Points(g,this.mat);this.points.frustumCulled=false;this.points.renderOrder=3;scene.add(this.points);this.c=new T.Color();}
 emit(x,y,z,{color=0xd8dce8,size=.7,grow=1.6,life=.7,alpha=.4,vx=0,vy=.8,vz=0,spread=.6}={}){const k=this.next=(this.next+1)%this.n,c=this.c.set(color);this.pos.set([x,y,z],k*3);this.vel.set([vx+(Math.random()-.5)*spread,vy+Math.random()*spread*.5,vz+(Math.random()-.5)*spread],k*3);this.col.set([c.r,c.g,c.b,alpha],k*4);this.size[k]=size;this.grow[k]=grow;this.life[k]=this.max[k]=life*(.7+Math.random()*.6);this.alpha[k]=alpha;}
 update(dt){for(let i=0;i<this.n;i++){if(this.life[i]<=0){if(this.col[i*4+3]!==0)this.col[i*4+3]=0;continue;}this.life[i]-=dt;const k=i*3,f=Math.max(0,this.life[i]/this.max[i]);this.pos[k]+=this.vel[k]*dt;this.pos[k+1]+=this.vel[k+1]*dt;this.pos[k+2]+=this.vel[k+2]*dt;this.size[i]+=this.grow[i]*dt;this.col[i*4+3]=this.alpha[i]*f;}
  const a=this.geo.attributes;a.position.needsUpdate=a.aColor.needsUpdate=a.aSize.needsUpdate=true;}
}
// Rubber left on the road: a ring buffer of quads laid between successive wheel positions.
class Skids{
 constructor(scene,n){this.n=n;this.pos=new Float32Array(n*12);this.next=0;this.last=new Map();const idx=[];for(let i=0;i<n;i++)idx.push(i*4,i*4+1,i*4+2,i*4+2,i*4+1,i*4+3);
  const g=this.geo=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(this.pos,3).setUsage(T.DynamicDrawUsage));g.setIndex(idx);
  this.mesh=new T.Mesh(g,new T.MeshBasicMaterial({color:0x08080c,transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3}));this.mesh.frustumCulled=false;this.mesh.renderOrder=1;scene.add(this.mesh);}
 lay(key,x,y,z,on){const p=this.last.get(key);if(!on){if(p)this.last.delete(key);return;}if(p){const dx=x-p[0],dz=z-p[2],l=Math.hypot(dx,dz);if(l<.25)return;if(l<4){const nx=-dz/l*.13,nz=dx/l*.13,k=(this.next=(this.next+1)%this.n)*12;this.pos.set([p[0]-nx,p[1],p[2]-nz,p[0]+nx,p[1],p[2]+nz,x-nx,y,z-nz,x+nx,y,z+nz],k);this.geo.attributes.position.needsUpdate=true;}}this.last.set(key,[x,y,z]);}
 clear(){this.pos.fill(0);this.last.clear();this.geo.attributes.position.needsUpdate=true;}
}

export class ThreeKart {
 constructor(target,onFailure,{quality:q=quality()}={}){Object.assign(this,{target,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.cameraMode='third';this.clock=performance.now();this.status='';this.statusSince=performance.now();this.trackSeed=null;this.camYaw=null;this.rush=0;this.wind=0;}
 async init(){
  styles();this.stage=new Stage({quality:this.quality,className:'dash3d kart3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;
  this.hud=new Hud(HUD_HTML);this.view.append(this.hud.root);const q=s=>this.hud.q(s);
  this.ui={drift:q('.k3-drift'),driftLabel:q('.k3-drift span'),driftBar:q('.k3-drift s'),place:q('.k-place b'),suffix:q('.k-place i'),lap:q('.k-lap b'),lapBox:q('.k-lap'),item:q('.k-item'),itemIcon:q('.k-item b'),itemLabel:q('.k-item small'),coins:q('.k-coins b'),speed:q('.k-speed b'),map:q('.k-map'),mirror:q('.k-mirror'),tower:q('.k-tower'),lights:q('.k-lights'),lamps:[...this.hud.root.querySelectorAll('.k-lights i')],rush:q('.k-rush'),edge:q('.k-edge'),warn:q('.k-warn'),name:q('.k-name'),nameText:q('.k-name b'),nameCup:q('.k-name small'),nameTwist:q('.k-name em'),feat:q('.k-feat'),featText:q('.k-feat b'),tip:q('.k-tip'),result:q('.k-result')};
  this.rig=new CameraRig(this.camera);this.rig.setMode(this.cameraMode);this.ambient=new AmbientLoop(now=>this.render(this.lastGame,now));
  this.build();this.target.parentElement.append(this.view);this.ready=true;this.onAsset?.('3D RACEWAY · LIVE');return this;
 }
 setCamera(mode){this.cameraMode=mode==='first'?'first':'third';this.rig?.setMode(this.cameraMode);}
 build(){
  const s=this.scene,high=this.quality==='high';this.stage.neonEnvironment(.7);this.nightEnv=s.environment;s.fog=new T.FogExp2(0x070914,.0055);
  this.art=null;loadKartArt().then(a=>{if(this.dead)return;this.art=a;this.modelKarts=false;}).catch(()=>{});
  this.sky=new T.Mesh(new T.SphereGeometry(900,24,12),skyMaterial());this.sky.renderOrder=-3;s.add(this.sky);this.glowTex=radial(glowStops);
  this.sunSprite=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,transparent:true,depthWrite:false,depthTest:false,blending:T.AdditiveBlending,toneMapped:false,fog:false}));this.sunSprite.renderOrder=-2;s.add(this.sunSprite);
  this.hemi=new T.HemisphereLight(0xb4c0ff,0x2a1c40,1.5);const key=this.key=new T.DirectionalLight(0xdfe8ff,2.3);key.position.set(14,28,9);s.add(this.hemi,key,key.target);this.stage.sunShadow(key,{size:20,far:110,map:2048,radius:3});this.blobMat=contactShadowMaterial(.6);
  const boxTex=this.boxTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,128,128);g.addColorStop(0,'#ff5fc8');g.addColorStop(.5,'#5ee7ff');g.addColorStop(1,'#b9ff5e');x.fillStyle=g;x.globalAlpha=.6;x.fillRect(0,0,128,128);x.globalAlpha=1;x.strokeStyle='#fff';x.lineWidth=9;x.strokeRect(5,5,118,118);x.font='900 92px system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#fff';x.fillText('?',64,70);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;})();
  this.boxGeo=new T.BoxGeometry(1.15,1.15,1.15);this.boxMat=new T.MeshStandardMaterial({map:boxTex,emissive:0xffffff,emissiveMap:boxTex,emissiveIntensity:.9,transparent:true,opacity:.88,metalness:.2,roughness:.1});
  this.coinMat=new T.MeshStandardMaterial({color:0xffc83d,metalness:1,roughness:.15,emissive:0xff8a00,emissiveIntensity:.55,envMapIntensity:1.8});
  this.boneMat=new T.MeshStandardMaterial({color:0xf4efe6,roughness:.5,emissive:0x665544,emissiveIntensity:.4});
  this.bones=Array.from({length:24},()=>{const g=new T.Group();g.add(new T.Mesh(new T.CylinderGeometry(.11,.11,.9,8).rotateZ(Math.PI/2),this.boneMat));for(const x of [-.45,.45])for(const z of [-.12,.12]){const k=new T.Mesh(new T.SphereGeometry(.17,8,6),this.boneMat);k.position.set(x,0,z);g.add(k);}g.visible=false;s.add(g);return g;});
  const rocketMat=new T.MeshStandardMaterial({color:0xff4f6a,emissive:0xff2040,emissiveIntensity:1.6});
  this.rockets=Array.from({length:12},()=>{const m=new T.Mesh(new T.ConeGeometry(.24,1.1,10).rotateZ(-Math.PI/2),rocketMat);m.visible=false;s.add(m);return m;});
  this.flameGeo=new T.ConeGeometry(.11,1,8).rotateZ(Math.PI/2).translate(-.5,0,0);this.shieldGeo=new T.SphereGeometry(1.3,20,14);
  this.ring=new T.Mesh(new T.RingGeometry(.86,1,40).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(2,1.6,.6),transparent:true,opacity:0,depthWrite:false,toneMapped:false,side:T.DoubleSide}));this.ring.visible=false;s.add(this.ring);
  this.karts=[];this.particles=new Particles(s,high?700:320,this.glowTex);this.puffs=new Puffs(s,high?260:120);this.skids=new Skids(s,high?520:220);this.dummy=new T.Object3D();this.trackGroup=new T.Group();s.add(this.trackGroup);this.v1=new T.Vector3();
 }
 // Sky, light, fog, reflections and grade for the circuit's theme.
 applyLook(look){const s=this.scene,u=this.sky.material.uniforms,st=this.stage;this.look=look;u.uTop.value.set(look.top);u.uHorizon.value.set(look.horizon);u.uGlow.value.set(look.glow).multiplyScalar(look.night?.35:.5);s.fog.color.set(look.fog);s.fog.density=look.fogD;
  this.hemi.color.set(look.hemi[0]);this.hemi.groundColor.set(look.hemi[1]);this.hemi.intensity=look.hemi[2];this.key.color.set(look.sun);this.key.intensity=look.sunI;this.sunDir=new T.Vector3(...look.sunDir).normalize();this.key.position.copy(this.key.target.position).addScaledVector(this.sunDir,48);
  st.r.toneMappingExposure=look.exposure;const gu=st.grade.uniforms;gu.uSaturation.value=look.sat;gu.uVignette.value=look.night?.9:.6;gu.uHighTint.value.set(.016+look.warm*.02,.006,-.012-look.warm*.012);
  st.bloomBase=look.night?.5:.3;this.particles.points.material.opacity=look.night?.5:.85;this.particles.points.material.size=look.night?.17:.22;this.sunSprite.material.color.set(look.sun).multiplyScalar(look.night?.5:1.5);this.sunSprite.scale.setScalar(look.night?70:t2(look)*260);
  if(look.night){s.environment=this.nightEnv;s.environmentIntensity=.7;if(!this.hdrAsked){this.hdrAsked=true;st.hdrEnvironment(undefined,.55).then(()=>{if(this.dead)return;this.nightEnv=s.environment;if(!this.look.night&&this.dayEnv){s.environment=this.dayEnv.texture;s.environmentIntensity=.8;}});}}
  else{this.dayEnv?.dispose();const env=new T.Scene(),dome=new T.Mesh(new T.SphereGeometry(50,24,12),skyMaterial());for(const k of ['uTop','uHorizon','uGlow'])dome.material.uniforms[k].value.copy(u[k].value);env.add(dome);const sun=new T.Mesh(new T.SphereGeometry(5,12,8),new T.MeshBasicMaterial({color:new T.Color(look.sun).multiplyScalar(9)}));sun.position.copy(this.sunDir).multiplyScalar(40);env.add(sun);
   const ground=new T.Mesh(new T.CircleGeometry(50,24).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(look.hemi[1]).multiplyScalar(.6)}));ground.position.y=-6;env.add(ground);const pm=new T.PMREMGenerator(st.r);this.dayEnv=pm.fromScene(env,.02);pm.dispose();env.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});s.environment=this.dayEnv.texture;s.environmentIntensity=.8;}}
 buildTrack(g){
  const t=g.track,grp=this.trackGroup,scrap=new Set();grp.traverse(o=>{if(o.geometry)o.geometry.dispose();for(const m of [].concat(o.material||[])){for(const v of Object.values(m))if(v?.isTexture&&v!==this.glowTex)scrap.add(v);m.dispose();}});for(const x of scrap)x.dispose();grp.clear();this.skids.clear();
  const c=this.circuit=buildCircuit(t,{quality:this.quality,glowTex:this.glowTex});grp.add(c.group);this.applyLook(c.look);
  // Item boxes and coins.
  this.boxes=t.boxes.map(b=>{const p=trackPoint(t,b.s,b.d),m=new T.Mesh(this.boxGeo,this.boxMat);m.position.set(p.x,trackHeight(t,b.s,b.d)+1.05,-p.y);m.userData.y=m.position.y;grp.add(m);return m;});
  this.coins=new T.InstancedMesh(new T.CylinderGeometry(.34,.34,.09,20).rotateX(Math.PI/2),this.coinMat,t.coins.length);this.coins.frustumCulled=false;grp.add(this.coins);this.coinAt=t.coins.map(c=>{const p=trackPoint(t,c.s,c.d);return [p.x,trackHeight(t,c.s,c.d)+.75+(c.air||0),-p.y];});
  // Minimap backdrop: the circuit as a lit line, with the start and the jump marked.
  const mc=this.ui.map,xs=t.pts.map(p=>p[0]),ys=t.pts.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),sc=Math.min((mc.width-44)/(maxX-minX),(mc.height-44)/(maxY-minY));
  this.mapAt=(x,y)=>[mc.width/2+(x-(minX+maxX)/2)*sc,mc.height/2-(y-(minY+maxY)/2)*sc];const bg=document.createElement('canvas');bg.width=mc.width;bg.height=mc.height;const b=bg.getContext('2d'),glow='#'+new T.Color(c.look.night?c.look.rail:c.look.accent).getHexString();
  const path=(from,to)=>{b.beginPath();for(let s=from;s<=to;s+=t.ds){const q=trackAt(t,s),[x,y]=this.mapAt(q.x,q.y);s===from?b.moveTo(x,y):b.lineTo(x,y);}};b.lineJoin=b.lineCap='round';
  path(0,t.len+t.ds);b.strokeStyle='#05060cc0';b.lineWidth=13;b.stroke();b.strokeStyle=glow;b.shadowColor=glow;b.shadowBlur=10;b.lineWidth=6;b.stroke();b.shadowBlur=0;b.strokeStyle='#ffffffd0';b.lineWidth=2;b.stroke();
  path(t.jump.s,t.jump.s+t.jump.gap);b.strokeStyle='#ffb547';b.lineWidth=7;b.setLineDash([3,5]);b.stroke();b.setLineDash([]);if(t.tunnel){path(t.tunnel.s0,t.tunnel.s1);b.strokeStyle='#0b0c14';b.lineWidth=4;b.stroke();}
  {const q=trackAt(t,0),[x,y]=this.mapAt(q.x,q.y),nx=-Math.sin(q.ang),ny=-Math.cos(q.ang);b.strokeStyle='#fff';b.lineWidth=4;b.beginPath();b.moveTo(x-nx*9,y-ny*9);b.lineTo(x+nx*9,y+ny*9);b.stroke();}this.mapBg=bg;
  this.trackSeed=g.worldSeed;this.camYaw=null;this.hud.set(this.ui.nameText,'tn',t.name.toUpperCase());
  if(!this.karts.length)this.karts=g.karts.map((k,i)=>this.makeKart(k,i));
 }
 // One kart: a posed group holding the body (which bounces and rolls), flames, underglow, a
 // contact shadow, a shield bubble and, for rivals, a name tag.
 makeKart(k,i){const g=new T.Group(),body=new T.Group(),col=new T.Color(k.color);g.rotation.order='YZX';g.add(body);const stand=kartModel(k.color);body.add(stand.root);castShadows(stand.root,this.quality,false);
  const blob=contactShadow(3,2.2,this.blobMat);blob.position.y=.03;g.add(blob);
  const glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:col.clone().multiplyScalar(1.5),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));glow.scale.set(3.6,1.5,1);glow.position.y=.08;g.add(glow);
  const flameMat=new T.MeshBasicMaterial({color:(i?new T.Color(2.6,1.2,.3):new T.Color(.5,1.9,2.6)),transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}),flames=new T.Group();for(const z of [-.26,.26]){const f=new T.Mesh(this.flameGeo,flameMat);f.position.set(-1.05,.42,z);flames.add(f);}flames.visible=false;body.add(flames);
  const aura=auraMaterial();aura.uniforms.uColor.value.set(0x7fe9ff);const shield=new T.Mesh(this.shieldGeo,aura);shield.position.y=.7;shield.visible=false;g.add(shield);
  let tag=null;if(i){const c=document.createElement('canvas');c.width=256;c.height=64;const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tag=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false,fog:false,sizeAttenuation:false}));tag.scale.set(.15,.0375,1);tag.position.y=2.2;tag.userData={c,tex,place:0};g.add(tag);}
  // The cockpit, seen only from the driver's seat: the kart's nose and front wheels, a steering
  // wheel that turns, and two paws on it.
  let cockpit=null,wheel=null,tyres=null;if(!i){cockpit=new T.Group();wheel=new T.Group();tyres=[];const dark=new T.MeshStandardMaterial({color:0x14151d,roughness:.55,metalness:.4}),paint=new T.MeshStandardMaterial({color:col,roughness:.25,metalness:.45,envMapIntensity:1.2}),fur=new T.MeshStandardMaterial({color:0xe2b98a,roughness:.85}),pad=new T.MeshStandardMaterial({color:0x4a2f25,roughness:.8});
   const limb=(x0,y0,z0,x1,y1,z1,r)=>{const a=new T.Vector3(x0,y0,z0),b=new T.Vector3(x1,y1,z1),m=new T.Mesh(new T.CylinderGeometry(r,r*1.15,a.distanceTo(b),8),fur);m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());return m;};
   wheel.add(new T.Mesh(new T.TorusGeometry(.16,.026,8,24).rotateY(Math.PI/2),dark),new T.Mesh(new T.BoxGeometry(.02,.04,.32),dark),new T.Mesh(new T.BoxGeometry(.02,.16,.04).translate(0,-.08,0),dark));
   for(const z of [-.15,.15]){const paw=new T.Mesh(new T.SphereGeometry(.058,12,10).scale(1.15,.95,1.1),fur);paw.position.set(-.012,.02,z);wheel.add(paw);for(const dz of [-.03,0,.03]){const toe=new T.Mesh(new T.SphereGeometry(.02,6,5),pad);toe.position.set(.045,.03,z+dz);wheel.add(toe);}}
   wheel.position.set(.62,.86,0);wheel.rotation.z=-.45;cockpit.add(wheel);for(const z of [-.15,.15])cockpit.add(limb(.605,.865,z,.1,.3,z*2.6,.034));
   cockpit.add(new T.Mesh(new T.BoxGeometry(1.15,.14,.6).translate(1.25,.5,0),paint),new T.Mesh(new T.BoxGeometry(.5,.05,.3).translate(1.2,.6,0),dark),new T.Mesh(new T.BoxGeometry(.14,.04,1.46).translate(1.9,.36,0),paint),new T.Mesh(new T.BoxGeometry(.4,.1,.5).translate(.84,.56,0),dark),new T.Mesh(new T.CylinderGeometry(.02,.025,.34,8).rotateZ(Math.PI/2-.45).translate(.77,.79,0),dark));
   for(const z of [-.74,.74]){const ty=new T.Mesh(new T.CylinderGeometry(.27,.27,.26,18).rotateX(Math.PI/2),dark);ty.position.set(1.32,.27,z);tyres.push(ty);cockpit.add(ty);}
   cockpit.visible=false;g.add(cockpit);}
  this.scene.add(g);return {cockpit,wheel,tyres,g,body,root:stand.root,head:stand.head,blob,glow,flames,flameMat,shield,aura,tag,roll:0,pitch:0,squash:0,drop:0};}
 drawTag(m,k,place){const {c,tex}=m.tag.userData,x=c.getContext('2d');m.tag.userData.place=place;x.clearRect(0,0,256,64);x.fillStyle='#07080fd8';x.beginPath();x.roundRect(2,8,252,48,24);x.fill();x.fillStyle=k.color;x.beginPath();x.arc(28,32,20,0,7);x.fill();x.font='900 26px system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#0a0a12';x.fillText(String(place),28,34);x.textAlign='left';x.fillStyle='#fff';x.font='800 25px system-ui,sans-serif';x.fillText(k.name.toUpperCase(),58,34,188);tex.needsUpdate=true;}
 // Replace the stand-ins with the model karts: the player's own DAWG drives kart one, rivals
 // get their own DAWGs (or the stock driver on low graphics settings).
 swapKarts(g){this.modelKarts=true;const rnd=()=>{try{return makeDawg();}catch{return null;}};
  this.karts.forEach((m,i)=>{const rig=kartRig(this.art.karts[i%this.art.karts.length],{dawg:i===0?this.dawg:this.quality==='high'?rnd():null,color:i?g.karts[i].color:null});m.body.remove(m.root);castShadows(rig.root,this.quality,false);m.body.add(rig.root);m.root=rig.root;m.wheels=rig.wheels;m.driver=rig.driver;m.head=rig.driver?.lean||rig.seat||rig.root;});}
 pose(t,k){const p=trackPoint(t,k.p,k.d),q=trackAt(t,k.p);return {x:p.x,y:trackHeight(t,k.p,k.d)+(k.y||0),z:-p.y,yaw:q.ang+k.a};}
 event(e,g){if(!this.ready||!this.karts.length)return;const st=this.stage,hud=this.hud,t=g.track,me=this.pose(t,g.you),fx=Math.cos(me.yaw),fz=-Math.sin(me.yaw),P=this.particles,name=id=>g.karts[id]?.name.toUpperCase()||'';
  const at=id=>this.pose(t,g.karts[id]||g.you);
  if(e.type==='coin'){P.burst(me.x+fx,me.y+1,me.z+fz,14,0xffc14d,{speed:3,life:.5});}
  else if(e.type==='item'){hud.pop(ICONS[e.item]+' '+LABELS[e.item],'big');P.burst(me.x+fx*2,me.y+1,me.z+fz*2,30,0x5ee7ff,{speed:5,life:.6});this.ui.item.classList.remove('k-got');void this.ui.item.offsetWidth;this.ui.item.classList.add('k-got');}
  else if(e.type==='hop'){this.hopAt=performance.now();}
  else if(e.type==='go'){this.goAt=performance.now();hud.banner('GO!');st.flashOnce(0x9dff7a,.16,this.reduced);}
  else if(e.type==='rev'){for(let i=0;i<10;i++)this.puffs.emit(me.x-fx*1.1,me.y+.25,me.z-fz*1.1,{size:.8,grow:2.4,life:.8,alpha:.5,vx:-fx*3,vz:-fz*3});}
  else if(e.type==='rocketstart'){hud.pop('ROCKET START! +150','big');st.shake(.35);st.flashOnce(0x5ee7ff,.2,this.reduced);P.burst(me.x-fx*1.2,me.y+.4,me.z-fz*1.2,50,0x5ee7ff,{speed:7,life:.6});}
  else if(e.type==='bogged'){hud.pop('TOO EARLY!','magnet');}
  else if(e.type==='draft'){hud.pop('SLIPSTREAM! +50','shield');st.flashOnce(0x9fdcff,.1,this.reduced);P.burst(me.x-fx,me.y+.6,me.z-fz,30,0x9fdcff,{speed:6,life:.5,gravity:0,up:.2});}
  else if(e.type==='slip'){hud.pop(name(e.kart)+' RUNS WIDE','dodge');}
  else if(e.type==='charge'){st.flashOnce(e.level===2?0xff8a3d:0x5ec8ff,.07,this.reduced);}
  else if(e.type==='miniturbo'){hud.pop(e.level===2?'SUPER TURBO! +200':'MINI-TURBO! +100','big');st.shake(e.level===2?.3:.16);st.flashOnce(e.level===2?0xff8a3d:0x5ec8ff,.08,this.reduced);P.burst(me.x-fx*1.2,me.y+.4,me.z-fz*1.2,24,e.level===2?0xff8a3d:0x5ec8ff,{speed:6,life:.5});}
  else if(e.type==='boost'||e.type==='pad'){if(!e.kart){st.shake(.12);st.flashOnce(0x5ee7ff,.12,this.reduced);}}
  else if(e.type==='shield'){if(!e.kart)hud.pop('🛡️ SHIELD UP','shield');}
  else if(e.type==='howl'){const p=at(e.kart);this.ring.visible=true;this.ring.position.set(p.x,p.y+.3,p.z);this.ringAt=performance.now();P.burst(p.x,p.y+1,p.z,60,0xffd25e,{speed:11,life:.5,gravity:0,up:0});if(!e.kart){hud.pop(e.n?'HOWL! '+e.n+' SPUN +'+150*e.n:'HOWL!','big');st.shake(.3);}else if(Math.hypot(p.x-me.x,p.z-me.z)<30)st.shake(.2);}
  else if(e.type==='rocket'){if(e.to===0&&e.kart){this.warnUntil=performance.now()+1100;this.hud.set(this.ui.warn,'w','⚠ '+name(e.kart)+'’S ROCKET'+(g.you.item==='shield'?' · SHIELD!':''));}}
  else if(e.type==='hit'){hud.pop('DIRECT HIT +200','big');}
  else if(e.type==='wipeout'){const p=at(e.kart);if(Math.hypot(p.x-me.x,p.z-me.z)<70){P.burst(p.x,p.y+1,p.z,50,e.cause==='rocket'?0xff4f6a:0xffe45e,{speed:8,life:.8});for(let i=0;i<8;i++)this.puffs.emit(p.x,p.y+.5,p.z,{size:.9,grow:2.6,life:.9,alpha:.32,spread:3,color:this.dust});if(e.by>0&&e.by!==e.kart)hud.pop(name(e.by)+' GOT '+name(e.kart),'dodge');}}
  else if(e.type==='spin'){st.shake(.65);st.flashOnce(0xff3355,.32,this.reduced);P.burst(me.x,me.y+1,me.z,60,0xffe45e,{speed:7,life:.8});for(let i=0;i<10;i++)this.puffs.emit(me.x,me.y+.5,me.z,{size:.9,grow:2.6,life:1,alpha:.34,spread:3,color:this.dust});hud.pop(e.by>0?name(e.by)+'’S '+(CAUSE[e.cause]||'HIT')+'!':'SPUN OUT!','magnet');}
  else if(e.type==='block'){const p=at(e.kart);P.burst(p.x,p.y+1,p.z,40,0x7fe9ff,{speed:7,life:.5});if(!e.kart){hud.pop('BLOCKED! +100','shield');st.shake(.2);st.flashOnce(0x7fe9ff,.15,this.reduced);}}
  else if(e.type==='wall'){st.shake(.28);P.burst(me.x,me.y+.5,me.z,22,0xffd9a0,{speed:5,life:.3});}
  else if(e.type==='bump'||e.type==='clash'){const a=at(e.a),b=at(e.b);if(Math.hypot(a.x-me.x,a.z-me.z)<60)P.burst((a.x+b.x)/2,a.y+.45,(a.z+b.z)/2,e.hard?26:10,0xffe9b0,{speed:e.hard?7:4,life:.35,up:1.5});if(e.type==='bump'){st.shake(e.hard?.3:.1);if(e.hard)hud.pop(RIVALS[e.b].bully?name(e.b)+' SHOVES YOU':'CONTACT!','dodge');}}
  else if(e.type==='jump'){hud.pop('BIG AIR!','shield');}
  else if(e.type==='shortcut'){hud.pop('SHORTCUT! +250','big');}
  else if(e.type==='feat'){const f=FEATS.find(x=>x.id===e.id);if(f){this.ui.featText.textContent=f.name.toUpperCase();this.ui.feat.hidden=false;this.ui.feat.classList.remove('k-show');void this.ui.feat.offsetWidth;this.ui.feat.classList.add('k-show');clearTimeout(this.featTimer);this.featTimer=setTimeout(()=>{this.ui.feat.hidden=true;},2600);}}
  else if(e.type==='land'){st.shake(.24);this.karts[0].squash=1;for(let i=0;i<8;i++)this.puffs.emit(me.x-fx*.6,me.y+.2,me.z-fz*.6,{size:.7,grow:2.6,life:.6,alpha:.4,spread:3,color:this.dust});}
  else if(e.type==='splash'){const p=at(e.kart),wet=t.theme==='harbour';p.y=wet?-1.8:p.y-2.5;if(Math.hypot(p.x-me.x,p.z-me.z)<90){for(let i=0;i<20;i++)this.puffs.emit(p.x,p.y+.4,p.z,{size:1.2,grow:4,life:1.1,alpha:.6,vy:5+Math.random()*4,spread:5,color:wet?0xd9f2ff:0xe8ecf6});P.burst(p.x,p.y+.5,p.z,50,wet?0x9fdcff:0xffffff,{speed:9,life:.8,up:5});}if(!e.kart){hud.pop(wet?'SPLASH!':'MISSED IT!','magnet');st.shake(.5);st.flashOnce(wet?0x3f9fd8:0xffffff,.25,this.reduced);}}
  else if(e.type==='rescue'){this.karts[e.kart].drop=1;}
  else if(e.type==='lap'){hud.banner(e.final?'FINAL LAP!':'LAP '+e.lap+' / '+KART.laps);if(e.final){st.flashOnce(0xff3f86,.14,this.reduced);st.shake(.2);}}
  else if(e.type==='pass')hud.pop('▲ '+ordinal(e.place).toUpperCase(),e.place===1?'big':'shield');
  else if(e.type==='heat'){hud.pop(heatLabel(e.tier),'dodge');}
  else if(e.type==='finish'){st.flashOnce(e.place===1?0xb9ff5e:0xffffff,.45,this.reduced);for(let i=0;i<4;i++)P.burst(me.x+(Math.random()-.5)*8,me.y+2+Math.random()*3,me.z+(Math.random()-.5)*8,60,[0xffc83d,0xff5fc8,0x5ee7ff,0xb9ff5e][i],{speed:9,life:1.4});this.finish=e;this.finishAt=performance.now();}}
 draw(g,d,reduced=false){if(!this.ready||this.failed)return false;this.lastGame=g;this.dawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<4000));return true;}
 render(g,now){
  this.stage.resize();if(this.trackSeed!==g.worldSeed)this.buildTrack(g);const t=g.track,dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced,live=g.status==='playing',P=this.particles,night=this.look.night;P.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}if(g.go>=KART.grid&&this.finish){this.finish=null;this.skids.clear();}
  this.dust=t.theme==='harbour'?0xd8c29a:t.theme==='neon'?0x3a4258:0xe6ecf6;
  // Track furniture.
  this.boxes.forEach((m,i)=>{m.visible=!g.taken.some(x=>x.i===i);m.rotation.set(reduced?0:real*.8,reduced?.6:real*1.3,0);m.position.y=m.userData.y+(reduced?0:Math.sin(real*2+i)*.12);});
  const lap=Math.floor(g.you.p/t.len)*1000,D=this.dummy;this.coinAt.forEach((c,i)=>{const gone=g.coinTaken.includes(lap+i);D.position.set(c[0],gone?-90:c[1],c[2]);D.rotation.set(0,reduced?0:real*3+i,0);D.updateMatrix();this.coins.setMatrixAt(i,D.matrix);});this.coins.instanceMatrix.needsUpdate=true;D.rotation.set(0,0,0);
  this.bones.forEach((m,i)=>{const b=g.bones[i];m.visible=!!b;if(!b)return;const p=trackPoint(t,b.p,b.d);m.position.set(p.x,trackHeight(t,b.p,b.d)+.3,-p.y);m.rotation.set(0,i+real,.3);});
  this.rockets.forEach((m,i)=>{const r=g.rockets[i];m.visible=!!r;if(!r)return;const p=trackPoint(t,r.p,r.d),y=trackHeight(t,r.p,r.d)+.8;m.position.set(p.x,y,-p.y);m.rotation.y=p.ang;if(!reduced){P.burst(p.x,y,-p.y,2,0xff8a3d,{speed:1,life:.3});this.puffs.emit(p.x,y,-p.y,{size:.4,grow:1.5,life:.5,alpha:.35});}});
  if(this.ring.visible){const u=(now-this.ringAt)/450;if(u>=1)this.ring.visible=false;else{this.ring.scale.setScalar(1+u*KART.howl);this.ring.material.opacity=(1-u)*.9;}}
  // The start lights on the gantry.
  const lit=g.go>1.8?0:g.go>1.2?1:g.go>.6?2:g.go>0?3:4,green=lit===4&&this.goAt&&now-this.goAt<1600;this.circuit.lights.forEach((m,i)=>{if(i<3)m.color.setRGB(...(lit>i&&lit<4?[3,.15,.1]:[.12,.03,.03]));else m.color.setRGB(...(green?[.3,3,.4]:[.03,.12,.04]));});
  // Karts.
  if(this.art&&!this.modelKarts)this.swapKarts(g);const order=g.order?.length===g.karts.length&&g.karts.includes(g.order[0])?g.order:[...g.karts].sort((a,b)=>b.p-a.p);
  g.karts.forEach((k,i)=>{const m=this.karts[i],p=this.pose(t,k),fx=Math.cos(p.yaw),fz=-Math.sin(p.yaw),rx=Math.sin(p.yaw),rz=Math.cos(p.yaw),air=k.y>0,spin=k.spin>0?(1.1-k.spin)*Math.PI*4:0;
   const slope=(trackHeight(t,k.p+1.2,k.d)-trackHeight(t,k.p-1.2,k.d))/2.4,bank=(trackHeight(t,k.p,k.d+1)-trackHeight(t,k.p,k.d-1))/2,f=Math.min(1,dt*10);
   m.pitch+=((air?Math.atan2(k.vy,Math.max(8,k.v))*.7:Math.atan(slope))-m.pitch)*f;m.roll+=((air?0:Math.atan(bank))+(k.drift?k.drift*.1:k.steer*.05)-m.roll)*f;m.squash=Math.max(0,m.squash-dt*5);m.drop=Math.max(0,m.drop-dt*1.8);
   const hop=!i&&this.hopAt&&!reduced?Math.max(0,Math.sin(Math.min(1,(now-this.hopAt)/260)*Math.PI))*.34:0,sunk=k.sink>0?-Math.pow(1.4-k.sink,2)*14:0;
   m.g.visible=sunk>-9;m.g.position.set(p.x,p.y+hop+sunk+m.drop*m.drop*7,p.z);m.g.rotation.set(m.roll+(k.sink>0?(1.4-k.sink)*2:0),p.yaw+k.drift*.42+spin,m.pitch);
   m.body.position.y=(reduced?0:Math.sin(real*31+i*2)*.012*Math.min(1,k.v/20))-m.squash*.1;m.body.scale.y=1-m.squash*.14;m.blob.visible=!air&&!k.sink;m.glow.material.opacity=air?.3:1;
   // Wheels roll with distance and the front pair steers; the driver leans into the corner.
   if(m.wheels){m.spinAngle=(m.spinAngle||0)+k.v*dt/.3;for(const w of m.wheels){w.node.rotation.x=m.spinAngle;if(w.front)w.node.rotation.y=(k.drift?k.drift*.5:k.steer*.35);}}
   if(m.driver?.lean){const l=m.driver.lean;l.rotation.x+=(-(k.drift||k.steer)*.26-l.rotation.x)*f;l.rotation.z=k.spin>0?Math.sin(real*30)*.25:(l.rotation.z*.9);}
   const boosting=k.boost>0&&!k.finished;m.flames.visible=boosting;if(boosting){const len=.7+Math.min(1,k.boost)*1.1+Math.random()*.5;for(const fl of m.flames.children)fl.scale.set(len,1+Math.random()*.3,1+Math.random()*.3);}
   m.shield.visible=k.shield>0;if(k.shield>0){m.aura.uniforms.uTime.value=real;m.aura.uniforms.uAlpha.value=k.shield<1.5?.25+.25*Math.sin(real*20):.5;}
   if(m.tag){const place=order.indexOf(k)+1,dist=Math.hypot(p.x-this.camera.position.x,p.z-this.camera.position.z);if(place!==m.tag.userData.place)this.drawTag(m,k,place);m.tag.visible=live&&dist<80&&dist>4.5&&!k.sink&&this.rig.mix<.5||live&&dist<80&&dist>2&&this.rig.mix>=.5&&!k.sink;m.tag.material.opacity=Math.min(1,(80-dist)/25,(dist-2)/5);}
   // Rubber and smoke: the player's drift, any spin, and rivals running wide.
   const rear=[p.x-fx*.8,p.y+.04,p.z-fz*.8],skid=!air&&!k.sink&&k.v>6&&(k.drift!==0||k.spin>0||k.slip>0&&i>0);for(const sd of [-1,1])this.skids.lay(i*2+(sd>0?1:0),rear[0]+rx*.6*sd,rear[1],rear[2]+rz*.6*sd,skid);
   if(reduced||!live)return;
   if(skid&&Math.random()<(i?.4:.75)){const sd=Math.random()<.5?-1:1;this.puffs.emit(rear[0]+rx*.6*sd,p.y+.2,rear[2]+rz*.6*sd,{size:.45,grow:1.7,life:.6,alpha:night?.24:.26,vx:-fx*2,vz:-fz*2,color:this.dust});}
   if(boosting)P.burst(p.x-fx*1.5,p.y+.45,p.z-fz*1.5,2,i?0xff8a3d:0x5ee7ff,{speed:2,life:.25,up:.5});
   if(Math.abs(k.d)>KART.width/2+.4&&k.v>10&&!air&&Math.random()<.5)this.puffs.emit(rear[0],p.y+.2,rear[2],{size:.5,grow:2,life:.7,alpha:.28,color:this.dust,spread:1.5});
   if(!i&&k.draft>.25)for(let n=0;n<2;n++)P.burst(p.x+fx*(2+Math.random()*7)+(Math.random()-.5)*2.6,p.y+.4+Math.random()*1.4,p.z+fz*(2+Math.random()*7)+(Math.random()-.5)*2.6,1,0x9fdcff,{speed:.3,life:.3,gravity:0,up:0});
   // Drift sparks change colour with the charge: white, then blue, then orange.
   if(k.drift&&!i&&k.charge>.25){const c=k.charge>=1.8?0xff8a3d:k.charge>=.9?0x5ec8ff:0xffffff,n=k.charge>=1.8?3:k.charge>=.9?2:1;for(const sd of [-1,1])P.burst(rear[0]+rx*.62*sd,p.y+.16,rear[2]+rz*.62*sd,n,c,{speed:3,life:.28,up:1.2});}});
  // Cameras: a chase cam that lags the kart's heading, or the driver's seat.
  const you=g.you,me=this.pose(t,you),km=this.karts[0];this.stage.followSun(this.key,me.x,me.y,me.z);if(this.camYaw===null)this.camYaw=me.yaw;
  // On the grid the camera sweeps round from the front; after the flag it swings back for the podium shot.
  const grid=g.status==='ready'?1:Math.min(1,g.go/KART.grid),outro=you.finished?Math.min(1,(now-(this.finishAt||now))/900):0,orbit=g.status==='ready'&&!reduced?real*.12:0,swing=reduced?0:grid*grid*2.5+orbit+outro*(2.6+Math.min(3,(now-(this.finishAt||now))/1000)*.25);
  const lookIn=me.yaw+(reduced?0:you.drift*.2);this.camYaw+=Math.atan2(Math.sin(lookIn-this.camYaw),Math.cos(lookIn-this.camYaw))*Math.min(1,dt*(reduced?20:5.5));
  const yawC=this.camYaw+swing,cx=Math.cos(yawC),cz=-Math.sin(yawC),fast=Math.min(1,you.v/KART.top),rush=this.rush+=((you.boost>0&&!you.finished?1:0)-this.rush)*Math.min(1,dt*4),wind=this.wind+=((you.draft>.2?1:0)-this.wind)*Math.min(1,dt*5),tall=Math.max(0,Math.min(1,1.25-this.camera.aspect)),back=6+fast*1.3+rush*1.1+Math.min(3,(you.y||0)*.8)+grid*2.5+outro*1.2+tall*2.2;
  const behind=trackHeight(t,you.p-back*Math.cos(swing),you.d),camY=Math.max(me.y,behind+(you.y||0)*.6)+2.75+fast*.25-rush*.25+Math.min(2,(you.y||0)*.5)-grid*1.2-outro*.8,ahead=trackHeight(t,you.p+7,you.d);
  const third={pos:new T.Vector3(me.x-cx*back,camY,me.z-cz*back),at:new T.Vector3(me.x+cx*7*(1-grid)*(1-outro),(swing>.6?me.y:Math.max(ahead,me.y-1.5)+(you.y||0)*.5)+.9+tall*1.9,me.z+cz*7*(1-grid)*(1-outro))};
  const fy=Math.cos(me.yaw),fzz=-Math.sin(me.yaw),seat=-.2,first={pos:new T.Vector3(me.x+fy*seat,me.y+1.32,me.z+fzz*seat),at:new T.Vector3(me.x+fy*14,Math.max(trackHeight(t,you.p+14,you.d),me.y-3)+(you.y||0)*.4+.5,me.z+fzz*14)};
  const inside=this.rig.mix>.5;km.body.visible=!inside;km.glow.visible=!inside;if(inside)km.blob.visible=false;if(km.cockpit){km.cockpit.visible=inside;const turn=you.drift?you.drift*.9:you.steer*.7;km.wheel.rotation.x=-turn;for(const ty of km.tyres)ty.rotation.y=turn*.5;}if(this.circuit.line){this.circuit.line.visible=this.rig.mix>.05;this.circuit.line.material.opacity=this.rig.mix*(this.look.night?.5:.75);}
  this.rig.update(dt,third,first,{follow:grid>0||outro>0?8:30,roll:0});this.stage.applyShake(real,reduced);this.rig.aim();
  if(live&&!reduced&&(rush>.2||fast>.97)){const n=rush>.2?3:1;for(let j=0;j<n;j++){const a=Math.random()*Math.PI*2,r=2.6+Math.random()*3.2,ah=9+Math.random()*16;P.burst(me.x+cx*ah-cz*Math.cos(a)*r,me.y+Math.max(.2,1.4+Math.sin(a)*r*.6),me.z+cz*ah+cx*Math.cos(a)*r,1,rush>.2?0x9fe8ff:0xc8ccff,{speed:.2,life:.32,gravity:0,up:0});}}
  const cam=this.camera,boosting=reduced?0:rush*10+fast*5+wind*3;cam.fov+=(fitFov((this.rig.mix>.5?72:61)+boosting,cam.aspect,this.rig.mix>.5?86:70)-cam.fov)*Math.min(1,dt*5);cam.near=.08;cam.far=2400;cam.updateProjectionMatrix();this.sky.position.copy(cam.position);this.sunSprite.position.copy(cam.position).addScaledVector(this.sunDir,800);
  this.puffs.mat.uniforms.uScale.value=this.stage.r.domElement.height/(2*Math.tan(cam.fov*Math.PI/360));
  this.circuit.update(real,dt,cam,g);P.update(dt,undefined,-200);this.puffs.update(dt);this.updateHud(g,order,now,rush,wind);
  this.stage.render(dt,real,{reduced,aberration:you.boost>0?.0045:.001+fast*.0008});
 }
 updateHud(g,order,now,rush,wind){const h=this.hud,ui=this.ui,y=g.you,t=g.track,live=g.status==='playing';h.live(live||g.status==='ready');
  const place=ordinal(g.place);h.set(ui.place,'p',String(g.place));h.set(ui.suffix,'ps',place.slice(-2));h.set(ui.lap,'l',Math.min(KART.laps,g.lap+1)+'/'+KART.laps);
  const fin=g.finalLap&&!y.finished&&live;if(fin!==this.finalOn){this.finalOn=fin;h.root.classList.toggle('k-final',fin);}
  if(y.item!==this.itemShown){this.itemShown=y.item;ui.item.dataset.empty=y.item?'0':'1';ui.itemIcon.textContent=y.item?ICONS[y.item]:'';ui.itemLabel.textContent=y.item?LABELS[y.item]:'ITEM';}
  h.set(ui.coins,'c',String(y.coins));h.set(ui.speed,'s',String(Math.round(y.v*5.2)));
  const lvl=y.charge>=1.8?2:y.charge>=.9?1:0,show=live&&g.go<=0&&(y.drift!==0||y.draft>.2);ui.drift.hidden=!show;if(show){const drifting=y.drift!==0;h.set(ui.driftLabel,'dl',drifting?(lvl===2?'SUPER TURBO · LET GO!':lvl===1?'MINI-TURBO READY':'DRIFT'):'SLIPSTREAM');ui.drift.dataset.kind=drifting?(lvl===2?'super':lvl===1?'shield':'idle'):'shield';ui.driftBar.style.transform=`scaleX(${Math.min(1,drifting?y.charge/1.8:y.draft/KART.draftTime).toFixed(3)})`;}
  // Tips: each shown once, the first time the technique is within reach.
  if(live&&g.go<=0){const c=t.cut,s=((y.p%t.len)+t.len)%t.len,tip=y.drift&&y.charge>.9&&y.charge<1.2&&!g.supers?['super','KEEP SLIDING FOR ORANGE SPARKS']:c&&!g.cuts&&(y.boost>.4||y.item==='boost')&&s>c.s0-40&&s<c.s0+4?['cut','BOOST ACROSS THE DIRT: SHORTCUT '+(c.side>0?'LEFT':'RIGHT')]:y.item==='shield'&&g.rockets.some(r=>r.to===0)?['shield','FIRE THE SHIELD NOW']:!g.drafts&&y.draft>.3?['draft','STAY TUCKED IN FOR THE SLINGSHOT']:null;
   if(tip&&!(this.tips??=new Set()).has(tip[0])){this.tips.add(tip[0]);ui.tip.textContent=tip[1];ui.tip.hidden=false;clearTimeout(this.tipTimer);this.tipTimer=setTimeout(()=>{ui.tip.hidden=true;},2600);}}
  // Start lights, speed lines, warnings.
  const lights=live&&(g.go>0||this.goAt&&now-this.goAt<900&&g.time<1.2);if(ui.lights.hidden===lights)ui.lights.hidden=!lights;if(lights){const lit=g.go>1.8?0:g.go>1.2?1:g.go>.6?2:g.go>0?3:4;if(lit!==this.litShown){this.litShown=lit;ui.lamps.forEach((el,i)=>{el.dataset.on=i<3?(lit>i&&lit<4?'1':'0'):lit===4?'1':'0';});}}
  const r=this.reduced?0:Math.max(rush,wind*.6);if(Math.abs(r-(this.rushShown||0))>.02){this.rushShown=r;ui.rush.style.opacity=r.toFixed(2);ui.rush.dataset.kind=wind>rush?'wind':'boost';}if(r>.05)ui.rush.style.setProperty('--a',(now/9%360).toFixed(0)+'deg');
  const warn=live&&this.warnUntil>now;if(ui.warn.hidden===warn)ui.warn.hidden=!warn;const intro=g.status==='ready'||live&&g.go>1.3;if(ui.name.hidden===intro)ui.name.hidden=!intro;if(intro){const cup=g.league||CUPS[0];h.set(ui.nameCup,'nc',cup.name.toUpperCase()+' · '+cup.cc);h.set(ui.nameTwist,'nt',g.twist?g.twist.name+' · '+g.twist.text.toUpperCase():'');}
  // Position tower: every racer in running order, with the gap to you.
  if(!ui.rows){ui.rows=g.karts.map(k=>{const li=document.createElement('li');li.innerHTML='<u></u><i></i><b></b><em></em>';li.querySelector('i').style.background=k.color;li.querySelector('b').textContent=k.id?k.name.toUpperCase():'YOU';if(!k.id)li.className='k-you';ui.tower.append(li);return {li,pos:li.querySelector('u'),gap:li.querySelector('em')};});}
  order.forEach((k,n)=>{const row=ui.rows[k.id];if(row.n!==n){row.n=n;row.li.style.setProperty('--n',n);row.pos.textContent=n+1;}const gap=k.id?(k.finished?'FIN':((k.p-y.p)/Math.max(12,y.v)).toFixed(1)):'';if(row.gapText!==gap){row.gapText=gap;row.gap.textContent=k.id&&!k.finished?(k.p>=y.p?'+':'')+gap:gap;}});
  // The flag: result card with the podium.
  const res=!!this.finish&&y.finished;if(ui.result.hidden===res){ui.result.hidden=!res;if(res){const e=this.finish,c=ui.result.children;c[0].textContent=e.photo?'PHOTO FINISH · '+e.margin.toFixed(2)+' S':e.place===1?'WON BY '+e.margin.toFixed(1)+' S':t.name.toUpperCase();c[1].textContent=ordinal(e.place).toUpperCase()+' PLACE';c[2].textContent='+'+e.bonus.toLocaleString('en-US')+(e.fast?' · PACE +'+e.fast.toLocaleString('en-US'):'');ui.result.dataset.place=e.place;}}
  if(res){const top=order.slice(0,3).map(k=>k.id+':'+(k.finished?1:0)).join();if(top!==this.podium){this.podium=top;ui.result.children[3].innerHTML=order.slice(0,3).map((k,n)=>`<li${k.id?'':' class="k-you"'}><u>${n+1}</u><i style="background:${k.color}"></i><b>${k.id?k.name.toUpperCase():'YOU'}</b></li>`).join('');}}
  if(!this.mapBg)return;const c=ui.map.getContext('2d');c.clearRect(0,0,ui.map.width,ui.map.height);c.drawImage(this.mapBg,0,0);
  for(let i=g.karts.length-1;i>=0;i--){const k=g.karts[i],p=trackPoint(t,k.p,k.d),[x,yy]=this.mapAt(p.x,p.y);c.fillStyle=k.color;c.strokeStyle=i?'#05060c':'#fff';c.lineWidth=i?2:3;c.beginPath();if(i)c.arc(x,yy,5.5,0,Math.PI*2);else{const a=p.ang+k.a,fx=Math.cos(a),fy=-Math.sin(a);c.moveTo(x+fx*11,yy+fy*11);c.lineTo(x-fx*7-fy*8,yy-fy*7+fx*8);c.lineTo(x-fx*7+fy*8,yy-fy*7-fx*8);c.closePath();}c.stroke();c.fill();}
  // Rear-view mirror (driver's seat only): who is behind, how close, on which side, and any rocket coming.
  const first=this.rig.mix>.5&&live&&g.go<=0;if(ui.mirror.hidden===first)ui.mirror.hidden=!first;if(!first)return;const m=ui.mirror.getContext('2d'),W=ui.mirror.width,H=ui.mirror.height;m.clearRect(0,0,W,H);
  const gapTo=k=>{const d=((y.p-k.p)%t.len+t.len)%t.len;return d>t.len/2?d-t.len:d;};m.font='900 13px system-ui,sans-serif';m.textAlign='center';m.textBaseline='middle';
  for(const k of [...g.karts].slice(1).sort((a,b)=>gapTo(b)-gapTo(a))){const back=gapTo(k);if(back<-2.5||back>50||k.finished)continue;const near=1-Math.max(0,back)/50,sz=10+near*near*30,x=W/2-(k.d-y.d)/9*(W/2-18)*(.35+near*.65),yy=18+near*near*40;
   m.fillStyle='#05060cc0';m.beginPath();m.roundRect(x-sz*.62,yy-sz*.42+2,sz*1.24,sz*.84,sz*.2);m.fill();m.fillStyle=k.color;m.beginPath();m.roundRect(x-sz*.55,yy-sz*.42,sz*1.1,sz*.7,sz*.2);m.fill();m.fillStyle='#0a0a12';m.beginPath();m.arc(x,yy-sz*.34,sz*.24,0,7);m.fill();if(sz>22){m.fillStyle='#fff';m.fillText(k.name.toUpperCase().slice(0,6),x,yy+sz*.62);}
   if(Math.abs(back)<3){m.fillStyle=k.color;const lx=k.d>y.d?10:W-10;m.beginPath();m.moveTo(lx,H/2-16);m.lineTo(lx+(k.d>y.d?-8:8),H/2);m.lineTo(lx,H/2+16);m.fill();}}
  for(const r of g.rockets)if(r.to===0&&Math.floor(now/90)%2){m.fillStyle='#ff3355';m.beginPath();m.moveTo(W/2,H-6);m.lineTo(W/2-13,H-28);m.lineTo(W/2+13,H-28);m.fill();m.fillStyle='#fff';m.fillText('!',W/2,H-20);}}
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;clearTimeout(this.featTimer);clearTimeout(this.tipTimer);this.ready=false;this.ambient?.stop();this.hud?.dispose();this.dayEnv?.dispose();this.stage?.dispose();}
}
// Sun size on the sky: the low harbour sun reads larger than the high one above the clouds.
const t2=look=>look===LOOKS.harbour?1.25:.8;
