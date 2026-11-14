// Three.js presentation for Maze Munch, Rush and Daily. MazeGame owns every rule; this module
// only reads its state and draws the maze as a miniature neon district seen from above: the
// walls are stalls, arcades, containers or hedges, the streets are wet paving with lamp pools,
// and the block sits inside a wider city. Each district theme has its own palette and props.
// Street view drops the camera to the DAWG's eye level in the same district: the buildings
// stand tall, side streets glow before you reach them, a heading-up radar shows the block and
// rivals outside the view are called out at the screen edge with their distance.
// World units: one maze tile is one meter; tile (x, y) sits at world (x, 0, y), so north is -z.
import {createDawgAsset,setDawgPose,assetKey} from './dawg-graphics-model.js';
import {T,smooth,quality,fitFov,texture,radial,glowStops,skyMaterial,pbr,merge,signTexture,SIGNS,buildingShells,facadeMaterials,contactShadow,contactShadowMaterial,Stage,Particles,Hud,AmbientLoop} from './three-kit.js';
import {heatLabel} from './difficulty.js';
import {hash} from './world.js';
import {TWIST_INFO,SHUTTER_PERIOD,SHUTTER_OPEN} from './engine.js';

export const HEADING={up:Math.PI,right:Math.PI/2,down:0,left:-Math.PI/2};
const STEP={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
// Stalker, ambusher, patrol, panicker (and two extras for Double Trouble).
const RIVAL_COLORS=[0xff3b55,0xff6fd8,0x35d8ff,0xffa62b,0xb47bff,0x9dff5a];
const PITCH=58*Math.PI/180,VFOV=36;
// How each district looks. `wall` tints instances; `win` are the lit-window colours.
const LOOKS={
 market:{ground:'#17100f',pave:'#5a4046',pave2:'#4e363e',line:'#ffcf8a',wall:[0xb86a4a,0xa8523e,0xc98a52,0x8f4a48],roof:[0xd8523a,0xe6b04a,0x2f9c92,0xe8e0d0],win:['#ffe2a8','#ffb45e','#ff8f5a'],glow:0xff7a59,accent:0xffd166,sky:0x180a14,horizon:0x4a1c18,fog:0x1c0d10,heights:[.5,.74,1.05],awning:.62,strings:.3,signs:6},
 arcade:{ground:'#0c0a18',pave:'#3a2f66',pave2:'#322858',line:'#7ef0ff',wall:[0x5a48a8,0x4a3a98,0x6a4ab8,0x3f3a90],roof:[0x2a2250,0x332a66,0x241d48,0x3a2a70],win:['#7ef0ff','#ff7ae0','#fff07a'],glow:0xb06bff,accent:0x3ee8f0,sky:0x08061a,horizon:0x2a1456,fog:0x120a26,heights:[.5,.8,1.15],awning:.25,strings:0,signs:8},
 docks:{ground:'#070d14',pave:'#3c5266',pave2:'#34485a',line:'#ffc94a',wall:[0xc8553a,0x2f7fc0,0x2fa58c,0xd8b23a,0xd0d6dc,0x8a5ac0],roof:[0xb04a34,0x2a6fa8,0x2a917a,0xc09c34,0xb8bec4,0x7a50aa],win:['#ffe9b0','#ff5a4a','#7ef0ff'],glow:0x3fb8ff,accent:0xffb347,sky:0x050b16,horizon:0x12324a,fog:0x0a1620,heights:[.56,.56,1.12],awning:0,strings:0,signs:0},
 garden:{ground:'#0a120c',pave:'#6a5c44',pave2:'#5e523c',line:'#d8ffb0',wall:[0x3f9a48,0x4aa850,0x358a44,0x58b058],roof:[0x56b85a,0x62c462,0x4aa850,0x70cc68],win:['#ffd0f0','#fff2a0','#ff9ad8'],glow:0x7be36a,accent:0xff8ad8,sky:0x06101a,horizon:0x14383a,fog:0x0a1a16,heights:[.42,.56,.72],awning:0,strings:.18,signs:0}
};
const lookFor=g=>LOOKS[g.district?.theme]||LOOKS.arcade;
const hex=n=>'#'+n.toString(16).padStart(6,'0');
// A box whose four sides share one material group and whose top is a second, so a whole class
// of buildings costs two draw calls. Side UVs keep their texel size whatever the height.
function blockGeometry(h){
 const g=new T.BoxGeometry(1,h,1).translate(0,h/2,0),uv=g.attributes.uv,n=g.attributes.normal;for(let i=0;i<uv.count;i++)if(Math.abs(n.getY(i))<.5)uv.setY(i,uv.getY(i)*h);
 const idx=[...g.index.array],face=k=>idx.slice(k*6,k*6+6);g.setIndex([...face(0),...face(1),...face(4),...face(5),...face(3),...face(2)]);g.clearGroups();g.addGroup(0,30,0);g.addGroup(30,6,1);return g;
}
// Shop fronts, cabinets, containers and hedges: the lit copy keeps only what glows.
function wallTexture(theme,look,lit){
 return texture(128,128,(c,w,h)=>{
  const win=look.win;c.fillStyle=lit?'#000':'#fff';c.fillRect(0,0,w,h);
  if(theme==='market'){
   if(!lit){c.fillStyle='#d8c2a8';c.fillRect(0,0,w,h);c.fillStyle='#00000030';for(let x=0;x<w;x+=16)c.fillRect(x,0,2,h);c.fillStyle='#5a3526';c.fillRect(0,h-10,w,10);}
   // The shop front sits low, so even the shortest stall shows it: a counter, shelves of goods and a lantern-lit sign.
   const g=c.createLinearGradient(0,h-60,0,h-18);g.addColorStop(0,lit?'#7a4a20':'#3a2418');g.addColorStop(1,lit?win[1]:'#4a2c1c');c.fillStyle=g;c.fillRect(34,h-60,w-46,42);
   c.fillStyle=lit?'#000000c0':'#22140e';for(let i=0;i<3;i++)c.fillRect(34,h-48+i*13,w-46,2);for(let i=0;i<9;i++){c.fillStyle=lit?['#000000b0','#00000060','#000000d0'][i%3]:'#2a1810';c.fillRect(38+i*9,h-58+(i%3)*13,6,9);}
   c.fillStyle=lit?'#000':'#5a3526';c.fillRect(10,h-60,18,50);c.fillStyle=lit?win[0]:'#2a1a14';c.fillRect(14,h-54,10,14);
   c.fillStyle=lit?win[2]:'#6a2a22';c.fillRect(8,h-72,w-16,7);if(lit){c.fillStyle='#000000a0';for(let i=0;i<7;i++)c.fillRect(14+i*15,h-70,8,3);}
   for(let i=0;i<4;i++){c.fillStyle=lit?(i%2?'#000':win[i%3]):'#2a1a14';c.fillRect(10+i*29,12,20,26);if(!lit){c.fillStyle='#6a4a34';c.fillRect(8+i*29,40,24,3);}}
  }else if(theme==='arcade'){
   if(!lit){c.fillStyle='#b8b0e0';c.fillRect(0,0,w,h);c.fillStyle='#00000038';for(let y=0;y<h;y+=32)c.fillRect(0,y,w,3);}
   for(let y=0;y<4;y++)for(let x=0;x<4;x++){const on=hash(y*7+3,x)>.3;c.fillStyle=lit?(on?win[(x+y)%3]:'#000'):on?'#2a2450':'#17142c';c.fillRect(8+x*30,6+y*30,22,20);}
   c.fillStyle=lit?win[0]:'#40387a';c.fillRect(0,h-6,w,6);c.fillStyle=lit?win[1]:'#40387a';c.fillRect(0,0,w,4);
  }else if(theme==='docks'){
   if(!lit){c.fillStyle='#e6e6e6';c.fillRect(0,0,w,h);for(let x=0;x<w;x+=8){c.fillStyle='#00000048';c.fillRect(x,0,3,h);c.fillStyle='#ffffff30';c.fillRect(x+4,0,2,h);}c.fillStyle='#00000060';c.fillRect(0,0,w,5);c.fillRect(0,h-6,w,6);c.fillRect(0,h/2-2,w,4);c.fillStyle='#ffffffb0';c.fillRect(20,h-48,30,14);c.fillRect(76,22,34,10);}
   else{c.fillStyle=win[1];c.fillRect(6,h-70,5,5);c.fillRect(w-11,h-70,5,5);c.fillStyle=win[0];c.fillRect(60,h-12,8,4);}
  }else{
   if(!lit){c.fillStyle='#c8e8c0';c.fillRect(0,0,w,h);for(let i=0;i<900;i++){const v=hash(91,i);c.fillStyle=v>.6?'#ffffff50':v>.3?'#00000040':'#0a300a50';c.beginPath();c.arc(hash(92,i)*w,hash(93,i)*h,2+hash(94,i)*4,0,7);c.fill();}}
   for(let i=0;i<26;i++){c.fillStyle=lit?win[i%3]:'#fff0f8';c.beginPath();c.arc(hash(95,i)*w,hash(96,i)*h,lit?2.2:2.6,0,7);c.fill();}
  }
 },{repeat:true});
}
function roofTexture(theme,look,lit){
 return texture(64,64,(c,w,h)=>{
  c.fillStyle=lit?'#000':'#fff';c.fillRect(0,0,w,h);
  if(theme==='market'){if(!lit){c.fillStyle='#00000030';for(let x=0;x<w;x+=16)c.fillRect(x,0,8,h);c.fillStyle='#00000050';c.strokeStyle='#00000060';c.lineWidth=3;c.strokeRect(1.5,1.5,w-3,h-3);}}
  else if(theme==='arcade'){c.fillStyle=lit?'#fff':'#e0d8ff';c.fillRect(0,0,w,h);c.fillStyle=lit?'#000':'#4a4478';c.fillRect(4,4,w-8,h-8);if(!lit){c.fillStyle='#6a62a0';c.fillRect(34,12,16,14);c.fillStyle='#38325e';c.fillRect(12,36,22,16);}}
  else if(theme==='docks'){if(!lit){for(let x=0;x<w;x+=8){c.fillStyle='#00000040';c.fillRect(x,0,3,h);}c.fillStyle='#00000070';c.fillRect(0,0,6,6);c.fillRect(w-6,0,6,6);c.fillRect(0,h-6,6,6);c.fillRect(w-6,h-6,6,6);}}
  else{if(!lit)for(let i=0;i<260;i++){const v=hash(81,i);c.fillStyle=v>.55?'#ffffff60':'#00000038';c.beginPath();c.arc(hash(82,i)*w,hash(83,i)*h,2+hash(84,i)*4,0,7);c.fill();}for(let i=0;i<7;i++){c.fillStyle=lit?look.win[i%3]:'#fff';c.beginPath();c.arc(hash(85,i)*w,hash(86,i)*h,2,0,7);c.fill();}}
 },{repeat:true});
}
const iconTexture=(text,color)=>texture(96,96,(c,w)=>{c.font='900 78px system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineWidth=12;c.strokeStyle='#05060c';c.strokeText(text,w/2,w/2+4);c.fillStyle=color;c.fillText(text,w/2,w/2+4);});
const coneTexture=()=>texture(128,128,(c,w,h)=>{const g=c.createLinearGradient(0,h,0,0);g.addColorStop(0,'#ffffffd0');g.addColorStop(.5,'#ffffff50');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.beginPath();c.moveTo(w/2-6,h);c.lineTo(w/2+6,h);c.lineTo(w-8,0);c.lineTo(8,0);c.closePath();c.fill();});
const ringTexture=()=>texture(128,128,(c,w)=>{c.strokeStyle='#fff';c.lineWidth=10;c.beginPath();c.arc(64,64,48,0,7);c.stroke();c.lineWidth=4;c.globalAlpha=.6;c.beginPath();c.arc(64,64,28,0,7);c.stroke();c.globalAlpha=1;c.lineWidth=6;for(let i=0;i<4;i++){const a=i*Math.PI/2;c.beginPath();c.moveTo(64+Math.cos(a)*40,64+Math.sin(a)*40);c.lineTo(64+Math.cos(a)*60,64+Math.sin(a)*60);c.stroke();}});
const arrowTexture=()=>texture(64,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#fff';c.lineWidth=9;c.lineJoin='round';for(let i=0;i<3;i++){const y=22+i*38;c.globalAlpha=.45+i*.25;c.beginPath();c.moveTo(12,y+18);c.lineTo(32,y);c.lineTo(52,y+18);c.stroke();}},{repeat:true});
const swirlTexture=()=>texture(128,128,(c,w)=>{c.translate(64,64);for(let k=0;k<3;k++){c.rotate(Math.PI*2/3);c.strokeStyle='#fff';c.lineWidth=7;c.beginPath();for(let a=0;a<5;a+=.1){const r=6+a*10;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.globalAlpha=.8;c.stroke();}});
const hazardTexture=()=>texture(64,64,(c,w,h)=>{c.fillStyle='#ffc21a';c.fillRect(0,0,w,h);c.fillStyle='#14110a';for(let i=-2;i<4;i++){c.beginPath();c.moveTo(i*32,0);c.lineTo(i*32+16,0);c.lineTo(i*32+16+64,64);c.lineTo(i*32+64,64);c.closePath();c.fill();}},{repeat:true});
// Fog of war for blackouts: a dark sheet above the roofs with holes where the torch reaches.
// The hole is cut where the view ray meets the street, so it stays glued to the DAWG.
const DARK={uniforms:{uP:{value:new T.Vector2()},uDir:{value:new T.Vector2(0,-1)},uAmt:{value:0},uSpots:{value:[new T.Vector3(),new T.Vector3(),new T.Vector3(),new T.Vector3()]}},
 vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
 fragmentShader:`uniform vec2 uP,uDir;uniform float uAmt;uniform vec3 uSpots[4];varying vec3 vW;void main(){vec3 ray=vW-cameraPosition;vec3 G=cameraPosition+ray*(cameraPosition.y/max(.001,cameraPosition.y-vW.y));vec2 d=G.xz-uP;float r=length(d);
 float torch=1.-smoothstep(2.1,3.7,r);float along=dot(d,uDir),side=abs(dot(d,vec2(-uDir.y,uDir.x)));float cone=(1.-smoothstep(5.,8.,along))*smoothstep(-.2,.6,along)*(1.-smoothstep(.3+along*.3,.8+along*.44,side));
 float light=max(torch,cone*.92);for(int i=0;i<4;i++){light=max(light,uSpots[i].z*(1.-smoothstep(.5,1.5,length(G.xz-uSpots[i].xy))));}
 gl_FragColor=vec4(.012,.016,.045,(1.-light)*uAmt);}`};

export class ThreeMaze {
 constructor(host,onFailure,{quality:q=quality()}={}){Object.assign(this,{host,onFailure,quality:q});this.ready=false;this.failed=false;this.dead=false;this.cameraMode='third';this.mapRef=null;this.asset=null;this.assetKey='';this.clock=performance.now();this.status='';this.statusSince=performance.now();this.yaw=Math.PI;this.facing='up';
  this.powerMix=0;this.darkMix=0;this.flourish=0;this.zoom=1.15;this.zoomGoal=1;this.punch=0;this.focus=new T.Vector3(10,0,11);this.wave=9;this.chainShown=0;this.insets={top:0,bottom:0};this.insetAt=0;this.slow=0;this.firstMix=0;this.camYaw=Math.PI;}
 async init(){
  this.stage=new Stage({quality:this.quality,className:'dash3d maze3d',onFailure:()=>this.fail()}).init();this.view=this.stage.view;this.scene=this.stage.scene;this.camera=this.stage.camera;this.stage.onDowngrade=()=>{this.quality='low';};
  this.hud=new Hud('<div class="m3-meters"><div class="m3-chain" hidden><b>0</b><small>CHAIN</small><i><u></u></i></div><div class="m3-mult" hidden><b>×1</b><small>KEEP MOVING</small><i><u></u></i></div></div><div class="m3-chips"></div><div class="m3-clock" hidden></div><div class="m3-mirror" hidden>⇄ CONTROLS MIRRORED</div><div class="m3-arrows"></div><canvas class="m3-radar" width="240" height="240" hidden></canvas><div class="m3-view" hidden></div>');
  this.view.append(this.hud.root);const q=s=>this.hud.q(s);this.el={chain:q('.m3-chain'),chainN:q('.m3-chain b'),chainBar:q('.m3-chain u'),mult:q('.m3-mult'),multN:q('.m3-mult b'),multBar:q('.m3-mult u'),chips:q('.m3-chips'),clock:q('.m3-clock'),mirror:q('.m3-mirror'),arrows:q('.m3-arrows'),radar:q('.m3-radar'),view:q('.m3-view')};
  this.arrows=RIVAL_COLORS.map(c=>{const a=document.createElement('i');a.style.setProperty('--c',hex(c));a.hidden=true;this.el.arrows.append(a);return a;});
  this.ambient=new AmbientLoop(now=>this.render(this.lastGame,this.lastDawg,now));
  this.build();this.host.append(this.view);this.ready=true;return this;
 }
 setCamera(mode){this.cameraMode=mode==='first'?'first':'third';}
 get first(){return this.firstMix>.5;}
 build(){
  const s=this.scene,high=this.quality==='high';this.stage.neonEnvironment(.55);s.fog=new T.Fog(0x0a0d1c,34,95);
  this.sky=new T.Mesh(new T.SphereGeometry(160,24,12),skyMaterial());s.add(this.sky);
  const stars=[];for(let i=0;i<260;i++){const a=hash(7,i)*Math.PI*2,y=.15+hash(8,i)*.8;stars.push(Math.cos(a)*150*(1-y*.5),y*150,Math.sin(a)*150*(1-y*.5));}const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(stars,3));this.stars=new T.Points(sg,new T.PointsMaterial({color:0xe8e4ff,size:1.4,sizeAttenuation:false,fog:false,transparent:true,opacity:.8}));s.add(this.stars);
  this.hemi=new T.HemisphereLight(0xbfc8ff,0x241a30,.8);s.add(this.hemi);this.lamp=new T.PointLight(0xfff0c8,high?9:7,5.5,1.3);s.add(this.lamp);
  this.moon=new T.DirectionalLight(0xcfd8ff,1.9);this.moon.position.set(-9,22,7);s.add(this.moon,this.moon.target);
  this.glowTex=radial(glowStops);this.coneTex=coneTexture();this.ringTex=ringTexture();this.arrowTex=arrowTexture();this.swirlTex=swirlTexture();this.hazardTex=hazardTexture();
  this.icons={alert:iconTexture('!','#ff5a6a'),lost:iconTexture('?','#b8c4ff'),panic:iconTexture('!!','#ffc24a'),sleep:iconTexture('z','#c8d0ff')};
  this.particles=new Particles(s,high?520:260,this.glowTex);this.dummy=new T.Object3D();this.tint=new T.Color();
  // Treats: little glowing bones through one instanced mesh, and big power bones with halos.
  const bone=()=>merge([new T.CylinderGeometry(.035,.035,.16,6).rotateZ(Math.PI/2),...[[-.09,.035],[-.09,-.035],[.09,.035],[.09,-.035]].map(([x,z])=>new T.SphereGeometry(.05,6,5).translate(x,0,z))]);
  this.pelletMat=new T.MeshBasicMaterial({color:new T.Color(1,.84,.5),toneMapped:false});this.powerMat=new T.MeshBasicMaterial({color:new T.Color(.75,1.35,.4),toneMapped:false});
  this.pellets=new T.InstancedMesh(bone(),this.pelletMat,420);this.powers=new T.InstancedMesh(bone().scale(2.6,2.6,2.6),this.powerMat,8);for(const m of [this.pellets,this.powers]){m.frustumCulled=false;s.add(m);}
  const spriteMat=(map,color,opacity=1)=>new T.SpriteMaterial({map,color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});this.spriteMat=spriteMat;
  this.halos=[0,1,2,3,4,5,6,7].map(()=>{const h=new T.Sprite(spriteMat(this.glowTex,new T.Color(.5,1,.25),.55));h.scale.set(1.5,1.5,1);h.visible=false;s.add(h);return h;});
  this.goldMat=new T.MeshStandardMaterial({color:0xffc83d,metalness:1,roughness:.18,emissive:0xff8a00,emissiveIntensity:.7,envMapIntensity:1.8});
  this.loot=new T.Group();{const bag=new T.Mesh(new T.SphereGeometry(.24,14,10).scale(1,.9,1).translate(0,.24,0),this.goldMat),neck=new T.Mesh(new T.CylinderGeometry(.07,.12,.12,10).translate(0,.5,0),this.goldMat),glow=new T.Sprite(spriteMat(this.glowTex,new T.Color(1.6,1.1,.3),.9));glow.scale.set(1.9,1.9,1);glow.position.y=.3;this.loot.add(bag,neck,glow);}s.add(this.loot);
  const chest=merge([new T.BoxGeometry(.5,.26,.34).translate(0,.13,0),new T.CylinderGeometry(.17,.17,.5,10,1,false,0,Math.PI).rotateZ(Math.PI/2).translate(0,.26,0)]);this.chests=new T.InstancedMesh(chest,this.goldMat,5);this.chests.frustumCulled=false;this.chests.count=0;s.add(this.chests);
  this.chestGlow=[0,1,2,3,4].map(()=>{const h=new T.Sprite(spriteMat(this.glowTex,new T.Color(1.6,1.1,.3),.7));h.scale.set(1.7,1.7,1);h.visible=false;s.add(h);return h;});
  // The DAWG: its model in a holder, a halo on the ground and a contact shadow.
  this.shadowMat=contactShadowMaterial(.7);this.holder=new T.Group();s.add(this.holder);
  this.marker=new T.Mesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:this.ringTex,color:new T.Color(.8,1.5,.35),transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.marker.position.y=.03;s.add(this.marker);
  this.playerShadow=contactShadow(.9,.9,this.shadowMat);s.add(this.playerShadow);
  this.aura=new T.Sprite(spriteMat(this.glowTex,new T.Color(.9,1.2,.5),.5));this.aura.scale.set(2.6,2.6,1);s.add(this.aura);
  this.shock=new T.Mesh(new T.RingGeometry(.82,1,48).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(.8,1.6,.5),transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,side:T.DoubleSide}));this.shock.position.y=.06;s.add(this.shock);
  this.rivals=RIVAL_COLORS.map((color,i)=>this.makeRival(color,i));
  this.crown=new T.Mesh(merge([new T.CylinderGeometry(.2,.17,.1,8,1,true),...[0,1,2,3,4].map(i=>new T.ConeGeometry(.05,.14,5).translate(Math.cos(i*1.257)*.18,.11,Math.sin(i*1.257)*.18))]),this.goldMat);this.crown.visible=false;s.add(this.crown);
  this.pips=[0,1,2].map(()=>{const p=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:0xff4060,depthWrite:false,toneMapped:false,transparent:true}));p.scale.set(.34,.34,1);p.visible=false;s.add(p);return p;});
  this.aim=new T.Mesh(new T.PlaneGeometry(1.25,1.25).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:this.ringTex,color:new T.Color(RIVAL_COLORS[1]).multiplyScalar(1.6),transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.aim.position.y=.04;this.aim.visible=false;s.add(this.aim);
  const dm=new T.ShaderMaterial({...DARK,uniforms:T.UniformsUtils.clone(DARK.uniforms),transparent:true,depthWrite:false,depthTest:false,fog:false});this.dark=new T.Mesh(new T.PlaneGeometry(400,400).rotateX(-Math.PI/2),dm);this.dark.position.y=1.6;this.dark.renderOrder=6;this.dark.visible=false;s.add(this.dark);
  this.block=new T.Group();s.add(this.block);
  // Street view: the DAWG's snout and paws ride with the camera, and side streets glow on the paving.
  s.add(this.camera);const fur=new T.MeshStandardMaterial({color:0xc89a62,roughness:.85}),nose=new T.MeshStandardMaterial({color:0x16121a,roughness:.3});this.furMat=fur;
  this.body=new T.Group();const snout=new T.Mesh(new T.SphereGeometry(.09,14,10).scale(1.1,.62,1.5),fur),tip=new T.Mesh(new T.SphereGeometry(.035,10,8).scale(1.3,.9,1),nose);snout.position.set(0,-.2,-.42);tip.position.set(0,-.172,-.545);
  this.paws=[-1,1].map(side=>{const p=new T.Mesh(merge([new T.SphereGeometry(.06,10,8).scale(1,.7,1.5),new T.CylinderGeometry(.045,.05,.3,8).rotateX(Math.PI/2).translate(0,0,.18)]),fur);p.position.set(side*.36,-.3,-.5);p.userData.side=side;this.body.add(p);return p;});this.body.add(snout,tip);this.body.visible=false;this.body.scale.setScalar(.5);this.body.position.set(0,-.17,-.26);this.camera.add(this.body);
  this.turns=[0,1,2,3,4,5].map(()=>{const m=new T.Mesh(new T.PlaneGeometry(.9,1.1).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:this.arrowTex,color:new T.Color(1.6,1.6,1.6),transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));m.position.y=.045;m.visible=false;s.add(m);return m;});
 }
 // Four original creatures with distinct silhouettes; each keeps one body material so a power
 // treat can recolour the whole rival at once.
 makeRival(color,i){
  const g=new T.Group(),kind=i%4,mat=pbr({color,emissive:color,emissiveIntensity:.55,metalness:.15,roughness:.35,transparent:true,clearcoat:1,clearcoatRoughness:.15},this.quality),white=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,transparent:true}),dark=new T.MeshBasicMaterial({color:0x0a0a18,transparent:true});
  let body,eyes,pupils;const eye=(x,y,z,r)=>new T.SphereGeometry(r,10,8).translate(x,y,z),pair=(y,z,r,dx)=>merge([eye(-dx,y,z,r),eye(dx,y,z,r)]);
  if(kind===0){ // Shade: a tall hooded stalker with one long visor.
   body=merge([new T.CylinderGeometry(.13,.36,.78,14).translate(0,.39,0),new T.SphereGeometry(.24,14,10).translate(0,.84,0),new T.ConeGeometry(.2,.3,12).translate(0,1.1,-.05),new T.SphereGeometry(.1,8,6).scale(1,1.8,1).translate(-.3,.5,0),new T.SphereGeometry(.1,8,6).scale(1,1.8,1).translate(.3,.5,0)]);
   eyes=new T.BoxGeometry(.34,.07,.06).translate(0,.86,.21);pupils=new T.BoxGeometry(.1,.05,.03).translate(0,.86,.245);
  }else if(kind===1){ // Pounce: low, long and eared, like something about to spring.
   body=merge([new T.SphereGeometry(.3,14,10).scale(1.05,.72,1.35).translate(0,.3,-.05),new T.SphereGeometry(.22,12,10).translate(0,.5,.28),new T.ConeGeometry(.09,.24,6).translate(-.13,.76,.26),new T.ConeGeometry(.09,.24,6).translate(.13,.76,.26),new T.CylinderGeometry(.035,.06,.5,6).rotateX(-1.0).translate(0,.5,-.52)]);
   eyes=pair(.55,.45,.07,.09);pupils=pair(.55,.5,.035,.09);
  }else if(kind===2){ // Beat: a square-shouldered patrol bot with a beacon.
   body=merge([new T.BoxGeometry(.52,.5,.42).translate(0,.37,0),new T.BoxGeometry(.38,.24,.34).translate(0,.76,0),new T.CylinderGeometry(.09,.09,.16,8).translate(-.34,.34,0),new T.CylinderGeometry(.09,.09,.16,8).translate(.34,.34,0),new T.BoxGeometry(.6,.1,.5).translate(0,.06,0)]);
   eyes=new T.BoxGeometry(.3,.09,.05).translate(0,.78,.17);pupils=pair(.78,.2,.03,.07);
  }else{ // Jitters: a small round worrier with antennae.
   body=merge([new T.SphereGeometry(.3,16,12).scale(1,.92,1).translate(0,.32,0),new T.CylinderGeometry(.02,.02,.3,5).rotateZ(.35).translate(-.14,.7,0),new T.CylinderGeometry(.02,.02,.3,5).rotateZ(-.35).translate(.14,.7,0),new T.SphereGeometry(.06,8,6).translate(-.2,.85,0),new T.SphereGeometry(.06,8,6).translate(.2,.85,0)]);
   eyes=pair(.42,.24,.1,.11);pupils=pair(.42,.32,.045,.11);
  }
  const b=new T.Mesh(body,mat),e=new T.Mesh(eyes,white),p=new T.Mesh(pupils,dark),inner=new T.Group();inner.add(b,e,p);g.add(inner);
  let beacon=null;if(kind===2){beacon=new T.Mesh(new T.BoxGeometry(.2,.09,.09).translate(0,.95,0),new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,transparent:true}));inner.add(beacon);}
  const glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(color).multiplyScalar(1.3),transparent:true,opacity:.6,depthWrite:false,depthTest:false,blending:T.AdditiveBlending,toneMapped:false}));glow.scale.set(1.5,1.5,1);glow.position.y=.5;glow.renderOrder=8;g.add(glow);
  // The telegraph: a cone of attention on the street, pointing where the rival is heading.
  const cone=new T.Mesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2).translate(0,0,.5),new T.MeshBasicMaterial({map:this.coneTex,color:new T.Color(color).multiplyScalar(1.4),transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));cone.position.y=.035;cone.rotation.y=Math.PI;g.add(cone);
  const icon=new T.Sprite(new T.SpriteMaterial({map:this.icons.alert,transparent:true,depthWrite:false,depthTest:false,toneMapped:false}));icon.scale.set(.6,.6,1);icon.position.y=1.55;icon.renderOrder=9;icon.visible=false;g.add(icon);
  const shadow=contactShadow(.8,.8,this.shadowMat);g.add(shadow);
  g.userData={mat,white,dark,color,glow,cone,icon,inner,beacon,pupils:p,yaw:0,kind};g.visible=false;this.scene.add(g);return g;
 }
 clearBlock(){const gs=new Set(),ms=new Set(),ts=new Set();this.block.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [].concat(o.material||[])){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});
  const keep=new Set([this.glowTex,this.coneTex,this.ringTex,this.arrowTex,this.swirlTex,this.hazardTex,...Object.values(this.icons)]);this.block.clear();for(const g of gs)g.dispose();for(const m of ms)if(m!==this.goldMat&&m!==this.shadowMat)m.dispose();for(const t of ts)if(!keep.has(t))t.dispose();}
 // Rebuilds the whole district whenever the level's map changes.
 buildMap(g){
  this.mapRef=g.map;this.clearBlock();const rows=g.map.length,cols=g.map[0].length,look=this.look=lookFor(g),theme=this.theme=LOOKS[g.district?.theme]?g.district.theme:'arcade',high=this.quality==='high',B=this.block,d=this.dummy,seed=(g.worldSeed||1)+g.level*131;
  this.rows=rows;this.cols=cols;const open=(x,y)=>g.map[y]?.[x]!==undefined&&g.map[y][x]!=='#',shut=(x,y)=>g.shutterIndex.has(x+','+y),h2=(x,y,k=0)=>hash(seed+k*977,x*31+y*57);
  const glow=new T.Color(g.district?.color||look.glow),accent=new T.Color(g.district?.secondary||look.accent);this.glow=glow;this.accent=accent;
  // Streets: one painted texture for the whole block, with a second that only holds the light pools.
  const px=high?56:32,paint=(c,lit)=>{const S=px;c.fillStyle=lit?'#000':look.ground;c.fillRect(0,0,cols*S,rows*S);
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const o=open(x,y),sh=shut(x,y);if(!o&&!sh)continue;const X=x*S,Y=y*S;
    if(!lit){c.fillStyle=(x+y)%2?look.pave:look.pave2;c.fillRect(X,Y,S,S);c.strokeStyle='#ffffff10';c.lineWidth=1;
     if(theme==='garden'){for(let i=1;i<4;i++){c.beginPath();c.moveTo(X,Y+i*S/4);c.lineTo(X+S,Y+i*S/4);c.stroke();}}
     else if(theme==='market'){for(let i=0;i<3;i++)for(let j=0;j<3;j++)c.strokeRect(X+i*S/3+1,Y+j*S/3+1,S/3-2,S/3-2);}
     else if(theme==='docks'){c.strokeRect(X+.5,Y+.5,S-1,S-1);}
     else{c.strokeStyle=look.line+'30';c.strokeRect(X+1,Y+1,S-2,S-2);}
     if(sh){c.save();c.beginPath();c.rect(X,Y,S,S);c.clip();c.fillStyle='#ffc21a';c.fillRect(X,Y,S,S);c.fillStyle='#16120a';for(let i=-1;i<4;i++){c.beginPath();c.moveTo(X+i*S/2,Y);c.lineTo(X+i*S/2+S/4,Y);c.lineTo(X+i*S/2-S/4,Y+S);c.lineTo(X+i*S/2-S/2,Y+S);c.fill();}c.restore();}
     // Soft shade against each wall grounds the buildings even with shadows off.
     for(const [dx,dy]of [[0,-1],[0,1],[-1,0],[1,0]]){if(open(x+dx,y+dy)||shut(x+dx,y+dy))continue;const gr=c.createLinearGradient(X+(dx>0?S:dx<0?0:0),Y+(dy>0?S:0),X+(dx>0?S*.6:dx<0?S*.4:0),Y+(dy>0?S*.6:dy<0?S*.4:0));gr.addColorStop(0,'#000000a0');gr.addColorStop(1,'#00000000');c.fillStyle=gr;c.fillRect(X,Y,S,S);}
     const exits=open(x-1,y)+open(x+1,y)+open(x,y-1)+open(x,y+1);
     if(exits>=3&&theme!=='garden'){c.fillStyle='#ffffff26';for(const [dx,dy]of [[0,-1],[0,1],[-1,0],[1,0]])if(open(x+dx,y+dy))for(let i=0;i<4;i++){const t=S*(.16+i*.2);if(dx)c.fillRect(X+(dx>0?S*.86:S*.04),Y+t,S*.1,S*.09);else c.fillRect(X+t,Y+(dy>0?S*.86:S*.04),S*.09,S*.1);}}
     if(h2(x,y,3)<.14){c.fillStyle='#ffffff14';c.beginPath();c.ellipse(X+S*(.3+h2(x,y,4)*.4),Y+S*(.3+h2(x,y,5)*.4),S*.3,S*.16,h2(x,y,6)*3,0,7);c.fill();}
     if(theme==='docks'&&h2(x,y,7)<.1){c.fillStyle='#ffc94a50';for(let i=0;i<4;i++)c.fillRect(X+S*.1+i*S*.22,Y+S*.44,S*.12,S*.12);}
    }
   }
   // Lamp pools: warm circles of light every few tiles, plus a faint wash everywhere so nothing is black.
   c.globalCompositeOperation='lighter';for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){if(!open(x,y)||h2(x,y,9)>.17)continue;const X=(x+.5)*S,Y=(y+.5)*S,r=S*(1.5+h2(x,y,10)),col=h2(x,y,11)>.5?hex(accent.getHex()):hex(glow.getHex()),gr=c.createRadialGradient(X,Y,0,X,Y,r);gr.addColorStop(0,col+'66');gr.addColorStop(1,col+'00');c.fillStyle=gr;c.fillRect(X-r,Y-r,r*2,r*2);}
   c.globalCompositeOperation='source-over';
   // Keep the light off the roofs' footprints.
   c.fillStyle=lit?'#000':'#06070c';for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(!open(x,y)&&!shut(x,y))c.fillRect(x*S,y*S,S,S);};
  const ftex=texture(cols*px,rows*px,c=>paint(c,false));
  this.floorMat=pbr({map:ftex,emissiveMap:ftex,emissive:0xffffff,emissiveIntensity:.5,metalness:.15,roughness:.42,envMapIntensity:.7,clearcoat:.6,clearcoatRoughness:.25},this.quality);
  const floor=new T.Mesh(new T.PlaneGeometry(cols,rows).rotateX(-Math.PI/2),this.floorMat);floor.position.set((cols-1)/2,0,(rows-1)/2);floor.receiveShadow=true;B.add(floor);
  // Buildings: three height classes; a wall with a street behind it stays low so it hides nothing.
  const classes=[[],[],[]],tiles=[];g.map.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch!=='#'||shut(x,y))return;const behind=open(x,y-1),r=h2(Math.floor(x/2),Math.floor(y/2),1),cls=behind?(r>.55?1:0):r>.6?2:r>.25?1:0;classes[cls].push([x,y]);tiles.push([x,y,look.heights[cls]]);}));
  this.wallMat=new T.MeshStandardMaterial({map:wallTexture(theme,look,false),emissiveMap:wallTexture(theme,look,true),emissive:0xffffff,emissiveIntensity:theme==='docks'?1.2:.8,metalness:theme==='docks'?.5:.2,roughness:theme==='garden'?.9:.55});
  this.roofMat=new T.MeshStandardMaterial({map:roofTexture(theme,look,false),emissiveMap:roofTexture(theme,look,true),emissive:glow.clone(),emissiveIntensity:theme==='arcade'?.9:.25,metalness:.2,roughness:.6});
  classes.forEach((list,k)=>{if(!list.length)return;const m=new T.InstancedMesh(blockGeometry(look.heights[k]),[this.wallMat,this.roofMat],list.length);list.forEach(([x,y],i)=>{d.position.set(x,0,y);d.rotation.set(0,0,0);d.scale.setScalar(1);d.updateMatrix();m.setMatrixAt(i,d.matrix);const gk=h2(Math.floor(x/2),Math.floor(y/2),2),n=look.wall.length;m.setColorAt(i,this.tint.set(look.wall[Math.floor(gk*n)%n]).multiplyScalar(.85+h2(x,y,12)*.3));});m.castShadow=m.receiveShadow=high;m.instanceColor.needsUpdate=true;B.add(m);
   // A coloured canopy caps each roof, so the block reads as a patchwork from above.
   const cap=new T.InstancedMesh(new T.BoxGeometry(1.05,.05,1.05).translate(0,look.heights[k]+.025,0),this.roofMat,list.length);list.forEach(([x,y],i)=>{d.position.set(x,0,y);d.updateMatrix();cap.setMatrixAt(i,d.matrix);const gk=h2(Math.floor(x/2),Math.floor(y/2),31),n=look.roof.length;cap.setColorAt(i,this.tint.set(look.roof[Math.floor(gk*n)%n]).multiplyScalar(.8+h2(x,y,32)*.3));});cap.instanceColor.needsUpdate=true;cap.receiveShadow=high;B.add(cap);});
  // Awnings over the shop fronts that face the camera.
  const inst=(geo,mat,list,place)=>{if(!list.length)return null;const m=new T.InstancedMesh(geo,mat,list.length);list.forEach((it,i)=>{d.position.set(0,0,0);d.rotation.set(0,0,0);d.scale.setScalar(1);const col=place(it,i);d.updateMatrix();m.setMatrixAt(i,d.matrix);if(col!==undefined)m.setColorAt(i,this.tint.set(col));});if(m.instanceColor)m.instanceColor.needsUpdate=true;m.frustumCulled=false;B.add(m);return m;};
  const fronts=tiles.filter(([x,y])=>open(x,y+1));
  if(look.awning)inst(new T.BoxGeometry(.94,.03,.4),new T.MeshStandardMaterial({roughness:.8,map:texture(64,16,(c,w,h)=>{c.fillStyle='#fff';c.fillRect(0,0,w,h);c.fillStyle='#00000030';for(let x=0;x<w;x+=16)c.fillRect(x,0,8,h);})}),fronts.filter(([x,y])=>h2(x,y,13)<look.awning),([x,y,h])=>{d.position.set(x,Math.min(h-.08,.46),y+.6);d.rotation.x=.5;return look.roof[Math.floor(h2(x,y,14)*look.roof.length)];});
  // Roof clutter: vents, crates and planters on the taller roofs; bushes on the hedges.
  const tops=tiles.filter(([x,y])=>h2(x,y,15)<(theme==='garden'?.55:.34));
  if(theme==='garden')inst(new T.IcosahedronGeometry(.3,1),new T.MeshStandardMaterial({roughness:.95}),tops,([x,y,h])=>{d.position.set(x+(h2(x,y,16)-.5)*.3,h+.06,y+(h2(x,y,17)-.5)*.3);d.scale.setScalar(.8+h2(x,y,18)*.6);return look.roof[Math.floor(h2(x,y,19)*4)];});
  else inst(new T.BoxGeometry(.34,.16,.3),new T.MeshStandardMaterial({roughness:.6,metalness:.4}),tops,([x,y,h])=>{d.position.set(x+(h2(x,y,16)-.5)*.4,h+.08,y+(h2(x,y,17)-.5)*.4);d.rotation.y=h2(x,y,18)*3;return theme==='docks'?look.wall[Math.floor(h2(x,y,19)*6)]:[0x9aa0b4,0x5a7ab0,0xd8b24a,0x6a6f84][Math.floor(h2(x,y,19)*4)];});
  // Lights: lanterns on roof corners everywhere, and strings across the streets in the market and garden.
  const bulbs=[];for(const [x,y,h]of tiles){if(h2(x,y,20)<.42)bulbs.push([x+(h2(x,y,21)>.5?.44:-.44),h+.05,y+.44,h2(x,y,22)]);}
  if(look.strings)for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++){if(!open(x,y)||h2(x,y,23)>look.strings)continue;const ns=!open(x,y-1)&&!open(x,y+1),ew=!open(x-1,y)&&!open(x+1,y);if(ns===ew)continue;for(let i=0;i<4;i++){const t=(i+.5)/4-.5,sag=.86+Math.abs(t)*.3;bulbs.push(ns?[x+h2(x,y,24)*.3,sag,y+t,h2(x+i,y,25)]:[x+t,sag,y+h2(x,y,24)*.3,h2(x+i,y,25)]);}}
  const bulbCols=[accent.clone().multiplyScalar(1.5),glow.clone().multiplyScalar(1.5),new T.Color(1.5,1.3,.9)];
  this.bulbs=inst(new T.SphereGeometry(.045,8,6),new T.MeshBasicMaterial({toneMapped:false}),bulbs,([x,y,z,r])=>{d.position.set(x,y,z);return bulbCols[Math.floor(r*3)];});
  // Neon signs standing on the roofs, tilted back so they read from above.
  if(look.signs){const spots=tiles.filter(([x,y,h])=>h>=look.heights[1]&&!open(x,y-1)&&h2(x,y,26)<.3).slice(0,high?look.signs:Math.ceil(look.signs/2));this.signs=spots.map(([x,y,h],i)=>{const [text,col]=SIGNS[Math.floor(h2(x,y,27)*SIGNS.length)],t=signTexture(text,col,false),w=Math.min(1.9,.5*t.aspect),m=new T.Mesh(new T.PlaneGeometry(w,w/t.aspect),new T.MeshBasicMaterial({map:t.map,transparent:true,toneMapped:false,color:new T.Color(1.7,1.7,1.7),depthWrite:false}));m.position.set(x,h+.34,y-.1);m.rotation.x=-.75;m.userData.flicker=h2(x,y,28)<.4?3+i:0;B.add(m);return m;});}else this.signs=[];
  this.buildCity(g,theme,look,seed);this.buildTwists(g,look);
  // Vents and wisps: a few fixed spots that breathe steam, fog or fireflies.
  this.vents=[];for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++)if(open(x,y)&&h2(x,y,29)<.035&&this.vents.length<9)this.vents.push([x,y]);
  const cx=(cols-1)/2,cz=(rows-1)/2;this.moon.target.position.set(cx,0,cz);this.moon.position.set(cx-9,24,cz+8);this.moon.target.updateMatrixWorld();this.stage.sunShadow(this.moon,{size:Math.max(cols,rows)*.62+1,far:60,map:2048,radius:3,bias:-.0004,normalBias:.03});
  const u=this.sky.material.uniforms;u.uTop.value.set(look.sky);u.uHorizon.value.set(look.horizon);u.uGlow.value.copy(glow).multiplyScalar(.3);this.scene.fog.color.set(look.fog);
 }
 // The wider city: a ring road with traffic, blocks of towers behind, lower roofs in front.
 buildCity(g,theme,look,seed){
  const B=this.block,d=this.dummy,cols=this.cols,rows=this.rows,garden=theme==='garden',docks=theme==='docks',base=garden?-14:0,h2=(x,y,k=0)=>hash(seed+k*613,x*17+y*29);
  const ground=new T.Mesh(new T.PlaneGeometry(260,260).rotateX(-Math.PI/2),pbr({color:docks?0x0a2030:garden?0x060a10:0x14141c,metalness:docks?.85:.5,roughness:docks?.16:.42,envMapIntensity:docks?1.4:.8,clearcoat:.6,clearcoatRoughness:.2},this.quality));ground.position.set(cols/2,base-.02,rows/2);ground.receiveShadow=true;B.add(ground);
  if(garden){const slab=new T.Mesh(new T.BoxGeometry(cols+2.4,14,rows+2.4),new T.MeshStandardMaterial({color:0x2a3040,map:wallTexture('arcade',LOOKS.arcade,false),emissiveMap:wallTexture('arcade',LOOKS.garden,true),emissive:0xffffff,emissiveIntensity:.6,roughness:.7}));slab.material.map.repeat.set(10,7);slab.material.emissiveMap.repeat.set(10,7);slab.position.set((cols-1)/2,-7.03,(rows-1)/2);B.add(slab);
   const rim=new T.Mesh(new T.BoxGeometry(cols+2.6,.3,rows+2.6),new T.MeshStandardMaterial({color:0x56606e,roughness:.7}));rim.position.set((cols-1)/2,-.16,(rows-1)/2);B.add(rim);}
  else{ // The ring road, with dashes of lane paint.
   const road=new T.Mesh(new T.PlaneGeometry(cols+5,rows+5).rotateX(-Math.PI/2),pbr({color:docks?0x1c2832:0x1a1a26,metalness:.4,roughness:.36,envMapIntensity:.9,clearcoat:.5},this.quality));road.position.set((cols-1)/2,-.012,(rows-1)/2);road.receiveShadow=true;B.add(road);
   const dashes=[];for(let x=-2;x<=cols+1;x+=1.4){dashes.push([x,-1.75,0],[x,rows+.75,0]);}for(let z=-1;z<=rows;z+=1.4){dashes.push([-1.75,z,1],[cols+.75,z,1]);}
   const m=new T.InstancedMesh(new T.PlaneGeometry(.5,.07).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:new T.Color(look.line).multiplyScalar(.9),toneMapped:false,transparent:true,opacity:.7}),dashes.length);dashes.forEach(([x,z,r],i)=>{d.position.set(x,.004,z);d.rotation.set(0,r?Math.PI/2:0,0);d.scale.setScalar(1);d.updateMatrix();m.setMatrixAt(i,d.matrix);});B.add(m);}
  // Towers: four shells from the kit, instanced around the block. North is the skyline; the south stays low.
  const shells=buildingShells(4),mats=facadeMaterials(),lists=[[],[],[],[]];
  for(let gz=-22;gz<=rows+13;gz+=3.3)for(let gx=-19;gx<=cols+19;gx+=3.3){const inside=gx>-4.4&&gx<cols+3.4&&gz>-4.4&&gz<rows+3.4;if(inside)continue;if(docks&&(gz>rows+2||gx>cols+3))continue;const k=Math.floor(h2(gx,gz,1)*4),north=gz<-2,south=gz>rows+1,far=Math.max(0,-gz-4)/18;
   lists[k].push([gx+(h2(gx,gz,2)-.5)*.8,gz+(h2(gx,gz,3)-.5)*.8,north?.3+far*.5+h2(gx,gz,4)*.14:south?.08+h2(gx,gz,4)*.06:.13+h2(gx,gz,4)*.1,h2(gx,gz,5)]);}
  lists.forEach((list,k)=>{if(!list.length)return;const m=new T.InstancedMesh(shells[k].g,mats[k],list.length);mats[k].emissiveIntensity=.9;list.forEach(([x,z,s,r],i)=>{d.position.set(x,base+(garden?h2(x,z,6)*8:0),z);d.rotation.set(0,Math.floor(r*4)*Math.PI/2,0);d.scale.set(.36,s*(garden?1.5:1),.36);d.updateMatrix();m.setMatrixAt(i,d.matrix);m.setColorAt(i,this.tint.set(0xffffff).lerp(this.glow,.25+r*.3));});m.instanceColor.needsUpdate=true;m.frustumCulled=false;B.add(m);});
  if(docks){ // Container stacks along the quay and a gantry crane over the water.
   const piles=[];for(let z=-1;z<rows+1;z+=1.25)for(let k=0;k<3;k++)if(h2(z,k,7)<.7)piles.push([cols+3.2+k*1.15,z,Math.floor(h2(z,k,8)*3)]);
   const cm=new T.MeshStandardMaterial({map:wallTexture('docks',look,false),metalness:.5,roughness:.5}),m=new T.InstancedMesh(new T.BoxGeometry(1,.56,1.05),cm,piles.length*2);let n=0;for(const [x,z,st]of piles)for(let s=0;s<Math.min(2,st+1);s++){d.position.set(x,.28+s*.56,z);d.rotation.set(0,0,0);d.scale.setScalar(1);d.updateMatrix();m.setMatrixAt(n,d.matrix);m.setColorAt(n++,this.tint.set(look.wall[Math.floor(h2(x+s,z,9)*6)]));}m.count=n;m.instanceColor.needsUpdate=true;B.add(m);
   const steel=new T.MeshStandardMaterial({color:0xd8a020,metalness:.6,roughness:.4}),crane=new T.Mesh(merge([new T.BoxGeometry(.3,7,.3).translate(-3,3.5,0),new T.BoxGeometry(.3,7,.3).translate(3,3.5,0),new T.BoxGeometry(11,.4,.5).translate(1.5,7,0),new T.BoxGeometry(.8,.6,.8).translate(4.5,6.5,0)]),steel);crane.position.set(cols/2,0,rows+7);B.add(crane);}
  // Traffic on the ring road: tiny cars with headlights, circling the block.
  this.cars=null;if(!garden){const car=merge([new T.BoxGeometry(.36,.16,.72).translate(0,.14,0),new T.BoxGeometry(.3,.13,.36).translate(0,.28,-.04)]),lamps=merge([new T.BoxGeometry(.09,.05,.03).translate(-.11,.14,.37),new T.BoxGeometry(.09,.05,.03).translate(.11,.14,.37)]),n=this.quality==='high'?9:6;
   this.cars={n,body:new T.InstancedMesh(car,new T.MeshStandardMaterial({metalness:.7,roughness:.25}),n),lamps:new T.InstancedMesh(lamps,new T.MeshBasicMaterial({color:new T.Color(2.4,2.1,1.4),toneMapped:false}),n),phase:Array.from({length:n},(_,i)=>i/n+h2(i,3,10)*.05),speed:Array.from({length:n},(_,i)=>.012+h2(i,5,11)*.01)};
   for(let i=0;i<n;i++)this.cars.body.setColorAt(i,this.tint.set([0xff4060,0x40c8ff,0xffd040,0xf0f0f0,0x9a60ff,0x40e0a0][i%6]));this.cars.body.instanceColor.needsUpdate=true;this.cars.body.frustumCulled=this.cars.lamps.frustumCulled=false;B.add(this.cars.body,this.cars.lamps);}
 }
 // Gates, tunnels and shutter doors for the level's twists.
 buildTwists(g,look){
  const B=this.block;this.gateMeshes=[];this.portalMeshes=[];this.shutterMeshes=[];
  for(const [k,dir]of g.gates){const [x,y]=k.split(',').map(Number),tex=this.arrowTex,m=new T.Mesh(new T.PlaneGeometry(.8,.95).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:tex,color:new T.Color(1.2,2,.6),transparent:true,opacity:.95,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));m.position.set(x,.04,y);m.rotation.y=HEADING[dir]+Math.PI;
   const posts=new T.Mesh(merge([new T.BoxGeometry(.07,.5,.07).translate(-.44,.25,0),new T.BoxGeometry(.07,.5,.07).translate(.44,.25,0),new T.BoxGeometry(.95,.06,.06).translate(0,.5,0)]),new T.MeshBasicMaterial({color:new T.Color(1,1.7,.5),toneMapped:false}));posts.position.set(x,0,y);posts.rotation.y=HEADING[dir];B.add(m,posts);this.gateMeshes.push(m);}
  const pairCols=[new T.Color(.5,1.6,2.2),new T.Color(2.2,1,.4)];
  for(const [k,p]of g.portals){const [x,y]=k.split(',').map(Number),col=pairCols[p.pair%2],ring=new T.Mesh(new T.TorusGeometry(.36,.05,8,28).rotateX(Math.PI/2),new T.MeshBasicMaterial({color:col,toneMapped:false})),swirl=new T.Mesh(new T.PlaneGeometry(.9,.9).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:this.swirlTex,color:col,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false})),beam=new T.Sprite(this.spriteMat(this.glowTex,col,.55));
   ring.position.set(x,.07,y);swirl.position.set(x,.05,y);beam.position.set(x,.7,y);beam.scale.set(.9,2.2,1);B.add(ring,swirl,beam);this.portalMeshes.push({ring,swirl,beam});}
  const sm=()=>new T.MeshStandardMaterial({map:this.hazardTex,emissive:0xff2a2a,emissiveIntensity:0,roughness:.5,metalness:.3});
  g.shutters.forEach(s=>{const m=new T.Mesh(new T.BoxGeometry(.98,.8,.98).translate(0,.4,0),sm());m.position.set(s.x,0,s.y);m.userData.h=1;B.add(m);this.shutterMeshes.push(m);});
 }
 prepare(dawg){if(!dawg||!this.ready)return;const key=assetKey(dawg);if(key===this.assetKey)return;const next=createDawgAsset(dawg),box=new T.Box3().setFromObject(next.root),h=box.getSize(new T.Vector3()).y||1;next.root.scale.setScalar(1.12/h);next.root.traverse(o=>{if(o.isMesh)o.castShadow=this.quality==='high';});if(this.asset){this.asset.root.removeFromParent();this.asset.dispose();}this.asset=next;this.assetKey=key;this.holder.add(next.root);}
 event(e,g){
  if(!this.ready)return;const st=this.stage,hud=this.hud,P=this.particles,at=(x,y,h=.45)=>[x,h,y],L=this.look||LOOKS.arcade;
  if(e.type==='pellet'){P.burst(...at(e.x,e.y,.3),e.chain>=10?7:4,e.chain>=20?0xfff2a0:0xffd6a0,{speed:1.6+Math.min(2,e.chain*.05),life:.35,gravity:-2,up:.9});}
  else if(e.type==='chain'){P.burst(...at(e.x,e.y),26,0xfff07a,{speed:3.5,life:.6,gravity:-3,up:1.6});if(e.chain%20===0)hud.pop('CHAIN ×'+e.chain+' +'+e.bonus,'gold');this.punch=Math.max(this.punch,.2);}
  else if(e.type==='chainEnd'){this.chainShown=0;}
  else if(e.type==='power'){P.burst(...at(e.x,e.y),60,0x9cff6a,{speed:5,life:.9,gravity:-1});hud.pop('BEAST MODE','shield');st.flashOnce(0x7cff8a,.3,this.reduced);st.shake(.3);this.wave=0;this.shock.position.set(e.x,.06,e.y);this.punch=1;}
  else if(e.type==='eat'){P.burst(...at(e.x,e.y),60,0x7ff3ff,{speed:6,life:.8});P.burst(...at(e.x,e.y),20,0xffffff,{speed:9,life:.4});hud.pop('+'+e.bonus+(e.combo>1?' ×'+e.combo:''),'big');st.shake(.4);this.punch=Math.max(this.punch,.7);}
  else if(e.type==='tackle'){P.burst(...at(e.x,e.y),70,0x63f6ff,{speed:8,life:.7});hud.pop('TACKLE +'+e.bonus,'shield');st.shake(.5);st.flashOnce(0x63f6ff,.22,this.reduced);this.punch=Math.max(this.punch,.6);}
  else if(e.type==='clang'){P.burst(...at(e.x,e.y),30,0xffd27a,{speed:6,life:.4});hud.pop('NO GOOD · BEAST MODE ONLY','dodge');st.shake(.35);}
  else if(e.type==='bossHit'){hud.pop(e.hp>0?'WARDEN HIT · '+e.hp+' TO GO':'WARDEN DOWN','big');st.shake(.7);}
  else if(e.type==='bossDown'){for(let i=0;i<5;i++)P.burst(e.x+(Math.random()-.5)*2,1,e.y+(Math.random()-.5)*2,50,[0xffd25e,0xff5fc8,0x7ff3ff][i%3],{speed:8,life:1.1});hud.banner('THE WARDEN IS DOWN · +'+e.bonus);st.flashOnce(0xffd25e,.4,this.reduced);}
  else if(e.type==='hit'){P.burst(...at(e.x,e.y),80,0xff4f6a,{speed:7,life:.9});hud.pop('CAUGHT!','big');st.shake(.9);st.flashOnce(0xff3355,.5,this.reduced);this.punch=1;}
  else if(e.type==='escape'){P.burst(...at(e.x,e.y),24,0xc8ff7a,{speed:4,life:.5});hud.pop('CLOSE CALL +'+e.bonus,'dodge');this.slow=.5;}
  else if(e.type==='loot'||e.type==='chest'){P.burst(...at(e.x,e.y),60,0xffc14d,{speed:6,life:.9,up:3});hud.pop(e.type==='chest'?'CHEST +'+e.bonus+(e.left?' · '+e.left+' LEFT':''):'+'+e.bonus+' GOLD','gold');st.shake(.25);this.punch=Math.max(this.punch,.5);}
  else if(e.type==='jackpot'){hud.banner('JACKPOT · ALL FIVE CHESTS · +'+e.bonus);st.flashOnce(0xffd25e,.4,this.reduced);this.flourish=Math.max(this.flourish,1.6);}
  else if(e.type==='lootSpawn'){hud.pop('GOLD DROP ON THE MAP','gold');}
  else if(e.type==='teleport'){P.burst(...at(e.x,e.y),40,e.pair?0xffa040:0x60d8ff,{speed:5,life:.6});P.burst(...at(e.tx,e.ty),50,e.pair?0xffa040:0x60d8ff,{speed:6,life:.7,up:3});st.flashOnce(e.pair?0xffa040:0x60d8ff,.2,this.reduced);this.snapPlayer=true;}
  else if(e.type==='shutter'){P.burst(e.x,.5,e.y,e.open?10:22,e.open?0xfff07a:0xff8050,{speed:e.open?2:4,life:.4});if(!e.open)st.shake(.12);}
  else if(e.type==='dash'){st.shake(.18);P.burst(...at(e.x,e.y),26,0x63f6ff,{speed:4,life:.45,gravity:0,up:.4});}
  else if(e.type==='mult'){hud.pop('×'+e.mult+' MULTIPLIER','shield');}
  else if(e.type==='multLost'){hud.pop('MULTIPLIER LOST','dodge');}
  else if(e.type==='extend'){hud.pop('+'+e.seconds+'s','big');}
  else if(e.type==='frenzy'){hud.banner('FINAL 10 · DOUBLE POINTS');st.flashOnce(0xff3a5a,.35,this.reduced);st.shake(.5);}
  else if(e.type==='mirrorSoon'){hud.banner('MIRROR IN 3…');}
  else if(e.type==='mirrorOn'){hud.banner('⇄ MIRRORED');st.flashOnce(0xff5fc8,.35,this.reduced);}
  else if(e.type==='mirrorOff'){hud.banner('CONTROLS BACK TO NORMAL');st.flashOnce(0x7cff8a,.25,this.reduced);}
  else if(e.type==='level'){hud.banner(e.auto?'BLOCK CLEARED · NEXT BLOCK':'DISTRICT CLEARED');st.flashOnce(new T.Color(L.accent).getHex(),.35,this.reduced);this.flourish=e.auto?1.2:3.2;}
  else if(e.type==='dailyClear'){hud.banner('MAZE CLEARED · '+e.seconds+'s LEFT · +'+e.bonus);}
  else if(e.type==='heat'){hud.banner(heatLabel(e.tier));st.flashOnce(0xff7a3d,.2,this.reduced);}
  else if(e.type==='feat'){hud.pop('★ '+e.name,'gold');}
  else if(e.type==='over'){st.shake(1);st.flashOnce(0xff3355,.4,this.reduced);}
 }
 draw(g,d,reduced=false){
  if(!this.ready||this.failed)return false;this.lastGame=g;this.lastDawg=d;this.reduced=reduced;const now=performance.now();this.ambient.drew(now);this.render(g,d,now);
  if(g.status!=='playing')this.ambient.start(t=>!this.dead&&!this.view.hidden&&!document.hidden&&(this.lastGame.status==='ready'?t-this.ambient.lastDraw<30000:t-this.statusSince<4000));return true;
 }
 render(g,d,now){
  this.stage.resize();this.prepare(d);if(g.map!==this.mapRef)this.buildMap(g);const dt=Math.min(.05,Math.max(0,(now-this.clock)/1000));this.clock=now;const real=now/1000,reduced=this.reduced,L=this.look;this.particles.reduced=this.hud.reduced=reduced;
  if(g.status!==this.status){this.status=g.status;this.statusSince=now;}
  const ease=(v,to,k)=>v+(to-v)*Math.min(1,dt*k);
  this.firstMix=ease(this.firstMix,this.cameraMode==='first'?1:0,4);if(Math.abs(this.firstMix-(this.cameraMode==='first'?1:0))<.002)this.firstMix=this.cameraMode==='first'?1:0;const fm=smooth(this.firstMix);
  // Street view raises every building to full height (the facades repeat upward as extra storeys) and pulls the fog in for depth.
  this.block.scale.y=1+fm*1.7;if(this.wallMat){this.wallMat.map.repeat.y=this.wallMat.emissiveMap.repeat.y=this.block.scale.y;}this.scene.fog.near=34+(5-34)*fm-this.darkMix*fm*3.5;this.scene.fog.far=95+(g.dark?9-95:30-95)*fm;
  this.powerMix=ease(this.powerMix,g.power>0?1:0,g.power>0?7:3);this.darkMix=ease(this.darkMix,g.dark?1:0,2.5);this.flourish=Math.max(0,this.flourish-dt);this.punch=Math.max(0,this.punch-dt*2.2);this.slow=Math.max(0,this.slow-dt);
  // Power flips the whole scene: cold electric light, hotter windows and streets, more bloom.
  const pm=this.powerMix,fl=this.flourish>0?.5+.5*Math.sin(real*14):0,ending=g.power>0&&g.power<2&&Math.floor(real*8)%2===0;
  this.hemi.color.set(0xbfc8ff).lerp(this.tint.set(0x5a7cff),pm);this.hemi.intensity=.8+pm*.5+fl*.6;this.moon.intensity=1.5*(1-pm*.5);
  this.wallMat.emissiveIntensity=(this.theme==='docks'?1.2:.8)*(1+pm*.7+fl*2.2)*(1-fm*.45);this.roofMat.emissive.copy(this.glow).lerp(this.tint.set(0x58a0ff),pm);this.roofMat.emissiveIntensity=(this.theme==='arcade'?.9:.25)+pm*.6+fl*2;
  this.floorMat.emissive.set(0xffffff).lerp(this.tint.set(0x6aa0ff),pm*.8);this.floorMat.emissiveIntensity=.5+pm*.35+fl*.7;this.stage.bloomBase=.42+pm*.16+fl*.25;
  const u=this.sky.material.uniforms;u.uHorizon.value.set(L.horizon).lerp(this.tint.set(0x1a2a8a),pm);
  if(this.bulbs)this.bulbs.material.color.setScalar(reduced?1:.85+.15*Math.sin(real*3)+fl);
  for(const s of this.signs){const f=s.userData.flicker;s.material.color.setScalar(reduced||!f?1.7:(hash(Math.floor(real*9),f)>.86?.5:1.7)+fl);}
  // Treats.
  let n=0,pw=0;const d3=this.dummy,spots=this.dark.material.uniforms.uSpots.value;for(const h of this.halos)h.visible=false;
  for(const [k,c]of g.pellets){const i=k.indexOf(','),x=+k.slice(0,i),y=+k.slice(i+1);if(c==='o'){if(pw<8){const s=reduced?1:1+Math.sin(real*5+x)*.16;d3.position.set(x,.34,y);d3.rotation.set(0,real*1.5,.35);d3.scale.setScalar(s);d3.updateMatrix();this.powers.setMatrixAt(pw,d3.matrix);const h=this.halos[pw];h.visible=true;h.position.set(x,.36,y);h.scale.setScalar(1.5*s);if(pw<4)spots[pw].set(x,y,1);pw++;}}
   else if(n<420){d3.position.set(x,.2+(reduced?0:Math.sin(real*3+x*1.3+y*.7)*.03),y);d3.rotation.set(0,(x*7+y*3)%3+real*.6,0);d3.scale.setScalar(1.02+pm*.2+this.firstMix*.1);d3.updateMatrix();this.pellets.setMatrixAt(n++,d3.matrix);}}
  for(let i=pw;i<4;i++)spots[i].z=0;this.pellets.count=n;this.powers.count=pw;this.pellets.instanceMatrix.needsUpdate=true;this.powers.instanceMatrix.needsUpdate=true;
  this.loot.visible=!!g.loot;if(g.loot){this.loot.position.set(g.loot.x,.12+Math.sin(real*3)*.06,g.loot.y);this.loot.rotation.y=real*2;this.loot.scale.setScalar(g.loot.time<3&&Math.floor(real*8)%2?.8:1.15);}
  this.chests.count=g.chests?.length||0;this.chestGlow.forEach((h,i)=>{const c=g.chests?.[i];h.visible=!!c;if(!c)return;d3.position.set(c.x,.05+Math.abs(Math.sin(real*2+i))*.05,c.y);d3.rotation.set(0,i,0);d3.scale.setScalar(1);d3.updateMatrix();this.chests.setMatrixAt(i,d3.matrix);h.position.set(c.x,.4,c.y);});this.chests.instanceMatrix.needsUpdate=true;
  this.drawTwists(g,real,dt);this.drawRivals(g,real,dt,ending);this.placePlayer(g,real,dt);this.drawAmbient(g,real,dt);this.placeCamera(g,dt,real);this.particles.update(dt);this.updateHud(g,real);
  // The shockwave from a power treat.
  if(this.wave<1.2){this.wave+=dt*1.5;const w=smooth(Math.min(1,this.wave));this.shock.scale.setScalar(.5+w*16);this.shock.material.opacity=(1-w)*.9;this.shock.visible=true;}else this.shock.visible=false;
  const dm=this.dark.material.uniforms;this.dark.visible=this.darkMix>.01&&this.firstMix<.6;dm.uAmt.value=this.darkMix*(.93-pm*.35)*(this.flourish>0?.3:1)*(1-this.firstMix/.6);dm.uP.value.set(this.px,this.py);const f=STEP[this.facing]||[0,-1];dm.uDir.value.lerp(new T.Vector2(f[0],f[1]),Math.min(1,dt*8)).normalize();
  this.stage.render(dt,real,{reduced,aberration:.0014+(g.dashTime>0?.006:0)+(g.mirrored?.005:0)+this.slow*.006});
 }
 drawTwists(g,real,dt){
  if(this.gateMeshes.length){this.arrowTex.offset.y=this.reduced?0:(real*.9)%1;}
  for(const p of this.portalMeshes){p.swirl.rotation.y=real*2.4;p.ring.scale.setScalar(1+Math.sin(real*4)*.06);p.beam.material.opacity=.4+.2*Math.sin(real*5);}
  const t=(g.twistClock||0)%SHUTTER_PERIOD,closing=t>SHUTTER_OPEN-.9&&t<SHUTTER_OPEN;
  this.shutterMeshes.forEach((m,i)=>{const open=g.shutterState[i]?1:0,goal=open?.05:1;m.userData.h+=(goal-m.userData.h)*Math.min(1,dt*(open?9:16));m.scale.y=m.userData.h;m.material.emissiveIntensity=open&&closing&&Math.floor(real*10)%2?1.6:0;});
 }
 drawRivals(g,real,dt,ending){
  let boss=null,aim=null;
  this.rivals.forEach((r,i)=>{const gh=g.ghosts[i];r.visible=!!gh;if(!gh)return;const p=g.position(gh),u=r.userData,home=gh.cooldown>0,down=gh.boss&&gh.hp<=0,scared=g.power>0&&!home,mood=home?'sleep':scared?'scared':gh.mood,size=(gh.boss?1.75:1.12)*(scared?.9:1);
   let diff=((HEADING[gh.dir]??0)-u.yaw+Math.PI*3)%(Math.PI*2)-Math.PI;u.yaw+=diff*Math.min(1,dt*12);r.rotation.y=u.yaw;r.visible=!down;
   // Each habit has its own body language: the stalker glides, the ambusher crouches, the patrol marches, the panicker shakes.
   const k=u.kind,jit=mood==='panic'||scared?(this.reduced?0:(Math.sin(real*47+i)*.04)):0,bob=this.reduced?0:k===0?Math.sin(real*3+i)*.05+.06:k===1?Math.abs(Math.sin(real*9))*(mood==='ambush'?.03:.08):k===2?Math.abs(Math.sin(real*6))*.04:Math.abs(Math.sin(real*13+i))*.09;
   r.position.set(p.x+jit,bob,p.y+jit*.7);r.scale.setScalar(size);u.inner.scale.set(1,k===1&&mood==='ambush'?.82:scared?.88+Math.sin(real*20)*.05:1,1);
   const col=scared?(ending?0xffffff:0x3a6cff):u.color;u.mat.color.set(col);u.mat.emissive.set(col);u.mat.emissiveIntensity=scared?1.1:.55;u.mat.opacity=home?.4:1;u.white.opacity=u.dark.opacity=home?.4:1;u.glow.material.color.set(col).multiplyScalar(home?.4:1.3);u.glow.material.opacity=home?.25:.6+this.darkMix*.3;u.glow.material.depthTest=u.icon.material.depthTest=this.first;
   if(u.beacon){const alert=mood==='alert';u.beacon.rotation.y=real*(alert?14:5);u.beacon.material.color.set(alert?0xff3030:scared?0x88aaff:0xffffff).multiplyScalar(1.6+Math.sin(real*(alert?20:6))*.6);}
   // Pupils slide toward whatever the rival is aiming at.
   if(gh.aim){const dx=gh.aim.x-p.x,dy=gh.aim.y-p.y,len=Math.hypot(dx,dy)||1,c=Math.cos(-u.yaw),s=Math.sin(-u.yaw),lx=(dx*c-dy*s)/len;u.pupils.position.x=Math.max(-.035,Math.min(.035,lx*.035));}
   u.cone.visible=!home&&!scared&&g.status==='playing';u.cone.scale.set(k===2?2.2:k===0?1.2:1.5,1,k===0?3.4:k===2?2.6:2);u.cone.material.opacity=(mood==='alert'||mood==='panic'?.8:.45)*(1-this.darkMix*.5);
   const icon=mood==='alert'?'alert':mood==='lost'?'lost':mood==='panic'?'panic':home&&!down?'sleep':null;u.icon.visible=!!icon;if(icon){u.icon.material.map=this.icons[icon];u.icon.position.y=1.5+Math.sin(real*6)*.05;}
   if(gh.boss&&!down)boss={r,gh,p,size};if(k===1&&mood==='ambush'&&gh.aim&&!home)aim=gh.aim;});
  this.crown.visible=!!boss;this.pips.forEach((s,i)=>{s.visible=!!boss&&i<boss.gh.hp;});
  if(boss){this.crown.position.set(boss.p.x,boss.r.position.y+1.22*boss.size,boss.p.y);this.crown.rotation.y=real;this.crown.scale.setScalar(boss.size*.9);this.pips.forEach((s,i)=>s.position.set(boss.p.x+(i-1)*.36,2.75,boss.p.y));}
  this.aim.visible=!!aim&&g.status==='playing'&&g.power<=0;if(aim){this.aim.position.set(aim.x,.045,aim.y);this.aim.rotation.y=real*1.5;this.aim.scale.setScalar(1+Math.sin(real*7)*.12);}
 }
 placePlayer(g,real,dt){
  const p=g.position(g.player),moving=g.player.moving&&g.status==='playing';if(STEP[g.player.dir])this.facing=g.player.dir;
  // Turn smoothly toward the heading and lean into the corner.
  const target=HEADING[this.facing];let diff=((target-this.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;this.yaw+=diff*Math.min(1,dt*(this.reduced?30:14));
  const dash=g.dashTime>0,beast=g.power>0,size=(this.first?1:1.85)+(beast?.2:0);this.holder.position.set(p.x,dash&&!this.reduced?.06:0,p.y);this.holder.rotation.set(dash?.28:0,this.yaw,this.reduced?0:-diff*.25);this.holder.scale.set(size,size*(dash?.92:1),size*(dash?1.18:1));
  if(this.asset)setDawgPose(this.asset,g.status==='ready'?real:real*(dash?2.4:1.5),moving?'run':'idle');
  this.holder.visible=!this.first&&!(g.invincible>0&&g.status==='playing'&&!this.reduced&&Math.floor(real*10)%2===0);this.playerShadow.visible=!this.first;
  this.lamp.position.set(p.x+Math.sin(this.yaw)*.5,1.5,p.y+Math.cos(this.yaw)*.5+.6);this.lamp.color.set(beast?0x9cff6a:dash?0x7ff3ff:0xfff0c8);this.lamp.intensity=(this.quality==='high'?9:7)*(1+this.darkMix*.8+(beast?.5:0))*(1-this.firstMix*.6);
  this.marker.position.set(p.x,.03,p.y);this.marker.rotation.y=real*1.2;this.marker.scale.setScalar((beast?2.6:2)+(this.reduced?0:Math.sin(real*5)*.08));this.marker.material.color.set(beast?0x9cff6a:dash?0x7ff3ff:0xc8ff5a).multiplyScalar(1.5);this.marker.visible=this.holder.visible;this.placeBody(g,real,dt,moving);
  this.playerShadow.position.set(p.x,.02,p.y);this.aura.position.set(p.x,.7,p.y);this.aura.visible=!this.first;this.aura.material.color.set(beast?0x9cff6a:dash?0x7ff3ff:0xfff0b0).multiplyScalar(beast?1.3:.9);this.aura.scale.setScalar(beast?3.4:2.6);
  // At street level sparks would burst right against the lens, so they shrink and the trail is dropped.
  this.particles.points.material.size=this.first?.07:.22;
  if(moving&&!this.reduced&&!this.first&&(dash||beast||g.corner>0))this.particles.burst(p.x,.3,p.y,dash?3:1,dash?0x63f6ff:beast?0x9cff6a:0xfff2a0,{speed:.8,life:.4,gravity:0,up:.2});
  this.px=p.x;this.py=p.y;
 }
 drawAmbient(g,real,dt){
  if(this.cars){const c=this.cars,d=this.dummy,W=this.cols+2.5,H=this.rows+2.5,per=2*(W+H),x0=-1.75,z0=-1.75;
   for(let i=0;i<c.n;i++){if(!this.reduced)c.phase[i]=(c.phase[i]+c.speed[i]*dt*(i%2?1:-1)+1)%1;const lane=i%2?.32:-.32;let s=c.phase[i]*per,x,z,rot;
    if(s<W){x=x0+s;z=z0-lane;rot=Math.PI/2;}else if(s<W+H){x=x0+W+lane;z=z0+s-W;rot=0;}else if(s<2*W+H){x=x0+W-(s-W-H);z=z0+H+lane;rot=-Math.PI/2;}else{x=x0-lane;z=z0+H-(s-2*W-H);rot=Math.PI;}
    d.position.set(x,0,z);d.rotation.set(0,rot+(i%2?0:Math.PI),0);d.scale.setScalar(1.25);d.updateMatrix();c.body.setMatrixAt(i,d.matrix);c.lamps.setMatrixAt(i,d.matrix);}
   c.body.instanceMatrix.needsUpdate=c.lamps.instanceMatrix.needsUpdate=true;}
  if(!this.reduced&&this.vents?.length){const garden=this.theme==='garden',docks=this.theme==='docks';for(const [x,y]of this.vents)if(Math.random()<dt*(garden?5:7))this.particles.burst(x+(Math.random()-.5)*(garden?2:.3),garden?.4+Math.random():.1,y+(Math.random()-.5)*(garden?2:.3),1,garden?0xd8ff7a:docks?0x8ab0c8:0xd8d0e8,{speed:garden?.5:.4,life:garden?1.6:1.4,gravity:garden?0:.5,up:garden?.1:.9,spread:1.5});}
  // The level-clear flourish: fireworks off the roofs while every window burns.
  if(this.flourish>0&&!this.reduced&&Math.random()<dt*16){const x=Math.random()*this.cols,z=Math.random()*this.rows;this.particles.burst(x,1.2+Math.random()*2,z,34,[0xffd25e,0xff5fc8,0x7ff3ff,0xb9ff5e][Math.floor(Math.random()*4)],{speed:5,life:1,gravity:-3,up:2});}
 }
 // Measures how much of the view the score bar and touch controls cover, so the camera can
 // frame the maze in the space that is actually free.
 measure(now){
  if(now-this.insetAt<500)return;this.insetAt=now;const v=this.view.getBoundingClientRect();let top=0,bottom=0;if(!v.height)return;
  for(const el of this.host.querySelectorAll('.mobile-game-header,.cabinet-top')){const r=el.getBoundingClientRect();if(r.width>v.width*.5&&r.height>0&&r.bottom-v.top<v.height*.4)top=Math.max(top,r.bottom-v.top);}
  for(const el of this.host.querySelectorAll('.mobile-controls')){const r=el.getBoundingClientRect();if(r.width>v.width*.5&&r.height>0&&getComputedStyle(el).display!=='none'&&v.bottom-r.top<v.height*.45)bottom=Math.max(bottom,v.bottom-r.top);}
  this.insets={top:top/v.height,bottom:bottom/v.height};this.hud.root.style.setProperty('--m3-top',Math.round(top)+'px');this.hud.root.style.setProperty('--m3-bottom',Math.round(bottom)+'px');
 }
 placeCamera(g,dt,real){
  this.measure(real*1000);const cam=this.camera,cols=this.cols||21,rows=this.rows||23,aspect=cam.aspect||1,tanV=Math.tan(VFOV*Math.PI/360),{top,bottom}=this.insets,free=Math.max(.35,1-top-bottom);
  // Fit: fill the free part of the screen with the block. Whichever of width or depth runs out
  // first sets the distance; the camera then follows the DAWG along the other axis.
  const zPer=2*tanV/Math.sin(PITCH)*free,xPer=2*tanV*aspect,fitZ=(rows+1.2)/zPer,fitW=(cols+1.2)/xPer,base=Math.max(Math.min(fitZ,fitW),9/xPer)*.9;
  const over=g.status==='over'||g.status==='level',goal=this.flourish>0||over?1.16:g.status==='ready'?1.08:g.frenzy?.92:1;this.zoomGoal=goal-this.punch*.1;this.zoom+=(this.zoomGoal-this.zoom)*Math.min(1,dt*(this.punch>0?9:2.4));
  const dist=base*this.zoom,visW=dist*xPer,visZ=dist*zPer,cx=(cols-1)/2,cz=(rows-1)/2,look=STEP[this.facing]||[0,0];
  const clamp=(v,c,half,span)=>{const slack=(span+1.6)/2-half;return slack<=0?c:Math.max(c-slack,Math.min(c+slack,v));};
  const fx=clamp(this.px+look[0]*1.2,cx,visW/2,cols),fz=clamp(this.py+look[1]*1.2,cz,visZ/2,rows);
  const k=g.status==='ready'&&!this.camStarted?1:Math.min(1,dt*(this.snapPlayer?12:3.2));this.camStarted=true;this.snapPlayer=false;this.focus.x+=(fx-this.focus.x)*k;this.focus.z+=(fz-this.focus.z)*k;
  // The free area's centre sits below or above the screen centre; slide the aim point to match.
  const shift=(top-bottom)/2*(visZ/free),sway=this.reduced?0:Math.sin(real*.3)*.25;
  const at=new T.Vector3(this.focus.x,0,this.focus.z-shift),pos=new T.Vector3(at.x+sway+(this.focus.x-cx)*.06,Math.sin(PITCH)*dist,at.z+Math.cos(PITCH)*dist),fm=smooth(this.firstMix);let fov=VFOV;
  if(fm>0){
   // Street level: eyes a little above the DAWG's head and just behind it, looking down the street.
   // Quarter turns are eased over about a fifth of a second: quick, never a snap, never a drift.
   let turn=((HEADING[this.facing]-this.camYaw+Math.PI*3)%(Math.PI*2))-Math.PI;this.camYaw+=turn*Math.min(1,dt*(this.reduced?40:11));
   const fxd=Math.sin(this.camYaw),fzd=Math.cos(this.camYaw),eye=.72,dash=g.dashTime>0?1:0;
   pos.lerp(new T.Vector3(this.px-fxd*.4,eye,this.py-fzd*.4),fm);at.lerp(new T.Vector3(this.px+fxd*3,eye-.34,this.py+fzd*3),fm);
   fov+=(fitFov(62+dash*6+this.powerMix*4,aspect,86)-VFOV)*fm;
  }else this.camYaw=this.yaw;
  cam.position.copy(pos);this.stage.applyShake(real,this.reduced);
  cam.up.set(this.reduced||fm>0?0:(fx-this.focus.x)*.006,1,0);cam.lookAt(at);cam.fov+=(fov-cam.fov)*Math.min(1,dt*8+(fm===0?1:0));cam.near=fm>.3?.05:.5;cam.far=400;cam.updateProjectionMatrix();
  this.sky.position.copy(cam.position);this.stars.position.copy(cam.position);
 }
 // Snout and paws in street view, and glowing chevrons on the side streets ahead.
 placeBody(g,real,dt,moving){
  const on=this.first;this.body.visible=on;if(on){const run=moving&&!this.reduced?real*(g.dashTime>0?20:12):0;for(const p of this.paws){const s=p.userData.side;p.position.set(s*.36,-.31+(moving?Math.max(0,Math.sin(run+(s>0?0:Math.PI)))*.035:0),-.5+(moving?Math.cos(run+(s>0?0:Math.PI))*.05:0));}
   this.furMat.emissive.set(g.power>0?0x2a6a18:g.dashTime>0?0x18506a:0x000000);}
  let n=0;if(on&&g.status==='playing'){const f=STEP[this.facing],sides=f[0]?[[0,-1,'up'],[0,1,'down']]:[[-1,0,'left'],[1,0,'right']];let x=Math.round(this.px),y=Math.round(this.py);
   for(let i=0;i<7&&n<this.turns.length;i++){if(i>0){if(g.wall(x+f[0],y+f[1]))break;x+=f[0];y+=f[1];}for(const [dx,dy,dir]of sides){if(n>=this.turns.length||!g.enterable(x+dx,y+dy,dir))continue;const m=this.turns[n++];m.visible=true;m.position.set(x+dx*.62,.045,y+dy*.62);m.rotation.y=HEADING[dir]+Math.PI;m.material.opacity=(.95-i*.11)*(.7+.3*Math.sin(real*6-i));m.material.color.copy(this.accent||this.tint.set(0xffffff)).multiplyScalar(1.8);}}}
  for(;n<this.turns.length;n++)this.turns[n].visible=false;
 }
 updateHud(g,real){
  const el=this.el,playing=g.status==='playing'||g.status==='paused';this.hud.live(playing||g.status==='ready');
  const chain=g.chain||0;el.chain.hidden=chain<3;if(chain>=3){this.hud.set(el.chainN,'chain','×'+chain);el.chainBar.style.width=Math.max(0,Math.min(100,(g.chainTime||0)/1.6*100))+'%';el.chain.classList.toggle('m3-hot',chain>=20);if(chain>this.chainShown){this.chainShown=chain;el.chain.classList.remove('m3-bump');void el.chain.offsetWidth;el.chain.classList.add('m3-bump');}}
  const rush=g.mode==='rush';el.mult.hidden=!rush;if(rush){this.hud.set(el.multN,'mult','×'+g.mult*(g.frenzy?2:1));el.multBar.style.width=(g.mult>=5?100:Math.min(100,g.moveTime/3*100))+'%';el.mult.classList.toggle('m3-hot',g.mult>=4||g.frenzy);}
  const last=rush&&g.time<=10&&g.status==='playing';el.clock.hidden=!last;if(last)this.hud.set(el.clock,'clock',String(Math.ceil(g.time)));this.view.classList.toggle('m3-frenzy',last);
  el.mirror.hidden=!g.mirrored;
  const chips=(g.twists||[]).map(t=>t==='treasure'?'CHESTS '+(5-g.chests.length)+'/5':t==='boss'?'WARDEN '+'♥'.repeat(Math.max(0,g.ghosts[0]?.hp||0)):TWIST_INFO[t]?.name||'').filter(Boolean).join('|');
  if(chips!==this.chipText){this.chipText=chips;el.chips.innerHTML=chips?chips.split('|').map(c=>'<span>'+c+'</span>').join(''):'';}
  const first=this.first;this.view.classList.toggle('m3-first',first);this.view.classList.toggle('m3-beast',first&&g.power>0);el.view.hidden=!first||!playing;if(first)this.hud.set(el.view,'view','STREET VIEW · COINS ×'+(g.viewBonus||1));el.radar.hidden=!first;
  if(first){this.drawRadar(g,real);this.threats(g);return;}
  // Arrows on the screen edge for rivals outside the frame.
  const v=new T.Vector3();this.arrows.forEach((a,i)=>{a.textContent='';a.classList.remove('m3-near');const gh=g.ghosts[i];if(!gh||gh.cooldown>0||g.status!=='playing'){a.hidden=true;return;}const p=g.position(gh);v.set(p.x,.5,p.y).project(this.camera);const top=1-this.insets.top*2,bot=-1+this.insets.bottom*2;if(Math.abs(v.x)<=1&&v.y<=top&&v.y>=bot){a.hidden=true;return;}
   const x=Math.max(-.94,Math.min(.94,v.x)),y=Math.max(bot+.06,Math.min(top-.06,v.y));a.hidden=false;a.style.left=((x+1)*50)+'%';a.style.top=((1-y)*50)+'%';a.style.transform='translate(-50%,-50%) rotate('+Math.atan2(-(v.y-y),v.x-x)+'rad)';a.classList.toggle('m3-scared',g.power>0);});
 }
 // Street view: every rival that is not straight ahead is called out on the screen edge, in the
 // direction it is in, with how many tiles away it is.
 threats(g){
  const fx=Math.sin(this.camYaw),fz=Math.cos(this.camYaw),top=this.insets.top*100+7,bot=100-this.insets.bottom*100-7;
  this.arrows.forEach((a,i)=>{const gh=g.ghosts[i];if(!gh||gh.cooldown>0||g.status!=='playing'){a.hidden=true;return;}const p=g.position(gh),dx=p.x-this.px,dy=p.y-this.py,dist=Math.hypot(dx,dy),ang=Math.atan2(-dx*fz+dy*fx,dx*fx+dy*fz);
   if(dist>9||Math.abs(ang)<.5&&dist<6){a.hidden=true;return;}const x=50+Math.sin(ang)*44,y=Math.max(top,Math.min(bot,50-Math.cos(ang)*40));a.hidden=false;a.style.left=x+'%';a.style.top=y+'%';a.style.transform='translate(-50%,-50%)';a.textContent=(Math.abs(ang)>2.3?'▼ ':ang>0?'▶ ':'◀ ')+Math.max(1,Math.round(dist));a.classList.toggle('m3-near',dist<3.5&&g.power<=0);a.classList.toggle('m3-scared',g.power>0);});
 }
 // A heading-up radar: the way you face is always up, so a turn on the radar is a turn on the stick.
 drawRadar(g,real){
  const cv=this.el.radar,c=cv.getContext('2d'),W=cv.width,R=6.5,S=W/2/R,px=this.px,py=this.py;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,W);c.save();c.beginPath();c.arc(W/2,W/2,W/2-2,0,7);c.clip();c.fillStyle='#070912d8';c.fillRect(0,0,W,W);
  c.translate(W/2,W/2);c.rotate(this.camYaw-Math.PI);c.scale(S,S);c.translate(-px,-py);
  const x0=Math.max(0,Math.floor(px-R-1)),x1=Math.min(this.cols-1,Math.ceil(px+R+1)),y0=Math.max(0,Math.floor(py-R-1)),y1=Math.min(this.rows-1,Math.ceil(py+R+1));
  c.fillStyle=hex(this.glow.getHex())+'b0';for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(g.wall(x,y))c.fillRect(x-.5,y-.5,1.02,1.02);
  const dark=g.dark,seen=(x,y)=>!dark||Math.hypot(x-px,y-py)<4.5;
  for(const [k,v]of g.pellets){const i=k.indexOf(','),x=+k.slice(0,i),y=+k.slice(i+1);if(x<x0||x>x1||y<y0||y>y1||!seen(x,y)&&v!=='o')continue;c.fillStyle=v==='o'?'#b9ff5e':'#ffe2a8';const r=v==='o'?.34:.13;c.beginPath();c.arc(x,y,r,0,7);c.fill();}
  for(const [k,d]of g.gates){const [x,y]=k.split(',').map(Number);c.fillStyle='#b9ff5e';c.save();c.translate(x,y);c.rotate(-HEADING[d]+Math.PI);c.beginPath();c.moveTo(0,-.4);c.lineTo(.32,.3);c.lineTo(-.32,.3);c.fill();c.restore();}
  for(const [k,p]of g.portals){const [x,y]=k.split(',').map(Number);c.strokeStyle=p.pair?'#ffa040':'#60d8ff';c.lineWidth=.16;c.beginPath();c.arc(x,y,.36,0,7);c.stroke();}
  for(const ch of g.chests||[]){c.fillStyle='#ffd25e';c.fillRect(ch.x-.3,ch.y-.24,.6,.48);}
  if(g.loot){c.fillStyle='#ffc83d';c.beginPath();c.arc(g.loot.x,g.loot.y,.42,0,7);c.fill();}
  g.ghosts.forEach((gh,i)=>{if(gh.cooldown>0)return;const q=g.position(gh);if(!seen(q.x,q.y)&&Math.hypot(q.x-px,q.y-py)>7)return;c.fillStyle=g.power>0?'#5b8cff':hex(RIVAL_COLORS[i]);c.beginPath();c.arc(q.x,q.y,gh.boss?.62:.44,0,7);c.fill();c.strokeStyle='#fff';c.lineWidth=.08;c.stroke();});
  c.restore();c.fillStyle='#c8ff5a';c.beginPath();c.moveTo(W/2,W/2-S*.62);c.lineTo(W/2+S*.46,W/2+S*.42);c.lineTo(W/2,W/2+S*.18);c.lineTo(W/2-S*.46,W/2+S*.42);c.closePath();c.fill();
  c.strokeStyle=hex(this.glow.getHex());c.lineWidth=3;c.beginPath();c.arc(W/2,W/2,W/2-2,0,7);c.stroke();
 }
 fail(){if(this.failed)return;this.failed=true;this.onFailure?.();this.dispose();}
 dispose(){if(this.dead)return;this.dead=true;this.ready=false;this.ambient?.stop();this.hud?.dispose();try{this.asset?.dispose();}catch{}this.stage?.dispose();}
}
