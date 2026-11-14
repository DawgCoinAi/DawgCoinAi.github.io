// BITE NIGHT director: plays a finishing-move script (fight-cine.js) in a FightScene. It owns the
// cinematic props (all built from primitives, nothing loaded), the showers of balls/coins/confetti,
// the camera cuts and the stamp. Presentation only: it never touches the engine.
import {T,texture,radial,glowStops} from './three-kit.js';
import {CINES} from './fight-cine.js';

const TAU=Math.PI*2,smooth=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
const mats=new Map();
export function mat(color,o={}){const key=color+JSON.stringify(o);let m=mats.get(key);if(!m){m=new T.MeshStandardMaterial({color,roughness:o.r??.6,metalness:o.m??0,emissive:o.e??0,emissiveIntensity:o.ei??1,transparent:o.a!==undefined,opacity:o.a??1,side:o.ds?T.DoubleSide:T.FrontSide,depthWrite:o.a===undefined||o.a>.6});mats.set(key,m);}return m;}
const add=(g,geo,m,x=0,y=0,z=0,r)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);if(r)o.rotation.set(r[0],r[1],r[2]);g.add(o);return o;};
const box=(g,w,h,d,m,x,y,z,r)=>add(g,new T.BoxGeometry(w,h,d),m,x,y,z,r);
const cyl=(g,rt,rb,h,m,x,y,z,r,open)=>add(g,new T.CylinderGeometry(rt,rb,h,20,1,!!open),m,x,y,z,r);
const ball=(g,rad,m,x,y,z,s)=>{const o=add(g,new T.SphereGeometry(rad,16,12),m,x,y,z);if(s)o.scale.set(s[0],s[1],s[2]);return o;};
const label=(text,color='#fff',bg='#111',w=256,h=128,size=44)=>texture(w,h,(c)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);c.fillStyle=color;c.font=`900 ${size}px system-ui,sans-serif`;c.textAlign='center';c.textBaseline='middle';const lines=text.split('\n');lines.forEach((l,i)=>c.fillText(l,w/2,h/2+(i-(lines.length-1)/2)*size*1.1));});
const screen=(tex,w,h,ei=1.6)=>new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:0xffffff,emissiveIntensity:ei,roughness:.4}));
const GOLD=()=>mat(0xffc93d,{m:1,r:.25}),STEEL=()=>mat(0x8a909c,{m:.9,r:.35}),DARK=()=>mat(0x1a1c24,{r:.5,m:.3});

// kind → builder(group, opts, loserColor). Builders may set g.userData.set(key, value) and tick(time, dt).
const PROPS={
 stick(g){cyl(g,.035,.03,.75,mat(0x8a5a2b),0,0,0,[0,0,1.2]);ball(g,.07,mat(0xfff2a0,{e:0xffe060,ei:2}),.3,.12,0);},
 cloud(g){for(const [x,y,z,r]of [[0,0,0,1],[.9,-.1,.1,.75],[-.9,-.15,0,.8],[.4,.4,-.2,.7],[-.4,.35,.2,.72],[0,-.3,.4,.8]])ball(g,r,mat(0x3d4460,{r:1}),x,y,z);},
 bolt(g){const m=mat(0xffffff,{e:0xcfe0ff,ei:6});box(g,.12,1.2,.12,m,.15,-.6,0,[0,0,.35]);box(g,.12,1.1,.12,m,-.05,-1.6,0,[0,0,-.4]);box(g,.1,1.2,.1,m,.1,-2.6,0,[0,0,.3]);},
 poof(g,o,lc){const w=mat(0xffffff,{r:1});for(let i=0;i<11;i++){const a=i/11*TAU;ball(g,.3,w,Math.cos(a)*.38,Math.sin(a)*.38,Math.sin(i*2.1)*.12);}ball(g,.5,w,0,0,0);ball(g,.06,mat(0x111111),-.15,.1,.48);ball(g,.06,mat(0x111111),.15,.1,.48);ball(g,.07,mat(0x222222),0,-.03,.52);ball(g,.14,mat(lc),-.36,.56,0,[1,1.4,.7]);ball(g,.14,mat(lc),.36,.56,0,[1,1.4,.7]);},
 oven(g){box(g,1.7,2,1.5,STEEL(),0,1,0);box(g,1.9,.12,1.7,DARK(),0,2.05,0);cyl(g,.16,.16,1,DARK(),.5,2.6,-.3);const glow=box(g,.9,.5,.05,mat(0x2a1206,{e:0xff6a00,ei:0}),0,.95,.86),door=new T.Group();door.position.set(-.65,.95,.8);g.add(door);box(door,1.3,1,.08,mat(0x20242c,{m:.6,r:.3}),.65,0,0);box(door,.9,.08,.1,STEEL(),.65,.36,.07);
  g.userData.set=(k,v)=>{if(k==='glow')glow.material=v?mat(0xff7a1a,{e:0xff6a00,ei:4}):mat(0x2a1206,{e:0xff6a00,ei:0});if(k==='open')door.rotation.y=v?-1.9:0;};},
 loaf(g,o,lc){const m=mat(0xd8922e,{r:.55});ball(g,.5,m,0,.38,0,[1.5,.85,1]);for(let i=-1;i<=1;i++)box(g,.06,.06,.7,mat(0xf2c56a),i*.3,.8,0,[0,.5,0]);ball(g,.13,mat(lc),-.5,.75,0,[1,1.3,.6]);ball(g,.13,mat(lc),-.28,.82,.2,[1,1.3,.6]);},
 box(g){box(g,1.5,1.5,1.5,mat(0xc9a36a,{r:.9}),0,.75,0);box(g,1.52,.16,1.52,mat(0xe9d7a8),0,1.1,0);box(g,.16,1.52,1.52,mat(0xe9d7a8),0,.75,0);const st=add(g,new T.PlaneGeometry(.9,.45),new T.MeshBasicMaterial({map:label('RETURN\nTO SENDER','#d81e3c','#00000000',256,128,34),transparent:true}),0,.7,.76);st.rotation.z=-.2;st.visible=false;g.userData.set=(k,v)=>{if(k==='label')st.visible=!!v;};},
 drone(g){box(g,.9,.18,.9,DARK(),0,0,0);const rs=[];for(const [x,z]of [[.6,.6],[-.6,.6],[.6,-.6],[-.6,-.6]]){cyl(g,.03,.03,.2,STEEL(),x,.12,z);rs.push(cyl(g,.36,.36,.02,mat(0x9fe8ff,{a:.45}),x,.24,z));}cyl(g,.012,.012,1.5,STEEL(),0,-.75,0);ball(g,.06,mat(0xff3040,{e:0xff2030,ei:3}),0,-.08,.46);g.userData.tick=t=>{for(const r of rs)r.rotation.y=t*40;};},
 roller(g){cyl(g,1.1,1.1,3.2,mat(0xff5fc8,{r:.35}),0,0,0,[Math.PI/2,0,0]);for(const z of [-1.7,1.7]){cyl(g,.08,.08,2.6,STEEL(),-.9,1.2,z,[0,0,.6]);}cyl(g,.1,.1,3.6,STEEL(),-1.7,2.3,0,[Math.PI/2,0,0]);},
 frame(g){const m=GOLD();box(g,2,.14,.1,m,0,1.2,0);box(g,2,.14,.1,m,0,-1.2,0);box(g,.14,2.5,.1,m,1,0,0);box(g,.14,2.5,.1,m,-1,0,0);box(g,1.86,2.3,.04,mat(0xf4ede0),0,0,-.06);box(g,.7,.16,.04,m,0,-1.5,0);},
 dart(g){add(g,new T.ConeGeometry(.05,.35,8),mat(0xdfe6f0,{m:.8,r:.3}),0,0,0,[0,0,-.9]);},
 ring(g,o){const m=new T.MeshBasicMaterial({map:ringTex(),color:o.color??0xffffff,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false});const p=add(g,new T.PlaneGeometry(1,1),m);if(o.flat)p.rotation.x=-Math.PI/2;g.userData.fade=m;},
 rocket(g){cyl(g,.46,.46,2.1,mat(0xff5fc8,{m:.6,r:.3}),0,1.25,0);ball(g,.46,mat(0xf4f4f8,{m:.5,r:.3}),0,2.3,0,[1,.7,1]);cyl(g,.12,.16,.25,mat(0x222222),0,2.7,0);for(let i=0;i<3;i++){const a=i/3*TAU;box(g,.06,.7,.5,mat(0x5ee7ff),Math.cos(a)*.5,.4,Math.sin(a)*.5,[0,-a,0]);}const s=add(g,new T.TorusGeometry(.5,.05,8,24),mat(0xffe45e),0,1.3,0,[Math.PI/2,0,0]);s.visible=false;g.userData.set=(k,v)=>{if(k==='strap')s.visible=!!v;};},
 bell(g){const m=mat(0xe2a72e,{m:1,r:.22});cyl(g,.45,1.15,1.6,m,0,0,0,null,true);ball(g,.46,m,0,.8,0,[1,.6,1]);add(g,new T.TorusGeometry(1.15,.07,8,28),m,0,-.8,0,[Math.PI/2,0,0]);ball(g,.2,DARK(),0,-.75,0);box(g,2.6,.22,.3,mat(0x4a3324),0,1.3,0);for(const x of [-1.2,1.2])box(g,.2,6,.3,mat(0x4a3324),x,4.2,0);},
 star(g){const m=mat(0xffffff,{e:0xfff2b0,ei:5});add(g,new T.OctahedronGeometry(.5),m).scale.set(1,1.7,.3);add(g,new T.OctahedronGeometry(.5),m).scale.set(1.7,1,.3);g.userData.tick=t=>{g.rotation.z=Math.sin(t*5)*.4;};},
 ice(g){const b=box(g,1.3,2.2,1.1,mat(0xbfeaff,{a:.42,r:.08,m:.1}),0,1.1,0);const cr=new T.Group();g.add(cr);for(const [x,y,r,l]of [[.1,1.5,.5,1.2],[-.2,1,-.6,1],[.2,.6,.3,.8],[-.1,1.8,1.2,.6]])box(cr,.03,l,1.12,mat(0xffffff,{e:0xffffff,ei:1.5}),x,y,0,[0,0,r]);cr.visible=false;g.userData.set=(k,v)=>{if(k==='crack')cr.visible=!!v;};},
 sand(g){cyl(g,2.4,2.4,.04,mat(0xe8dcc0,{r:1}),0,0,0);const rg=new T.Group();g.add(rg);for(let i=1;i<=5;i++)add(rg,new T.TorusGeometry(.42*i,.022,6,48),mat(0xc9b891,{r:1}),0,.03,0,[Math.PI/2,0,0]);rg.visible=false;for(const [x,z,s]of [[1.6,.9,.3],[-1.5,-.8,.24],[1.2,-1.3,.2]])ball(g,s,mat(0x7d8088,{r:.9}),x,s*.6,z,[1,.7,1]);g.userData.set=(k,v)=>{if(k==='rings')rg.visible=!!v;};},
 bonsai(g){cyl(g,.04,.07,.4,mat(0x6a4526),0,.2,0,[0,0,.2]);for(const [x,y,s]of [[.08,.5,.24],[-.14,.42,.18],[.2,.36,.15]])ball(g,s,mat(0x4fae5a,{r:.9}),x,y,0,[1,.7,1]);cyl(g,.16,.12,.1,mat(0x7a4a8a),0,.02,0);},
 bird(g){ball(g,.12,mat(0xffd84a),0,0,0);add(g,new T.ConeGeometry(.04,.1,6),mat(0xff8a3d),.14,0,0,[0,0,-1.57]);const w=box(g,.05,.02,.3,mat(0xf0b830),0,.04,0);g.userData.tick=t=>{w.scale.z=.6+Math.abs(Math.sin(t*18));};},
 teacup(g){const p=mat(0xf6f3ea,{r:.25});cyl(g,1.6,1.15,1.5,p,0,.85,0,null,true);cyl(g,1.15,1.15,.08,p,0,.12,0);cyl(g,1.52,1.52,.02,mat(0xb9772f,{r:.2}),0,1.35,0);add(g,new T.TorusGeometry(1.59,.05,8,40),mat(0x3d6fd8),0,1.55,0,[Math.PI/2,0,0]);add(g,new T.TorusGeometry(.45,.1,8,20),p,1.75,.9,0);cyl(g,2.2,1.9,.1,p,0,.05,0);},
 string(g){cyl(g,.012,.012,4,mat(0xf4f4f4),0,0,0);box(g,.3,.36,.02,mat(0xff5f7a),0,2.1,0);},
 cabinet(g){const body=mat(0x14121f,{r:.5,m:.2});box(g,1.25,2.3,1,body,0,1.15,0);box(g,1.3,.4,1.05,mat(0x5ee7ff,{e:0x5ee7ff,ei:1.2}),0,2.35,0);for(const x of [-.64,.64])box(g,.03,2.2,.9,mat(0xff5fc8,{e:0xff5fc8,ei:1.5}),x,1.15,0);box(g,1,.2,.5,mat(0x2a2740),0,1,.4,[.4,0,0]);ball(g,.06,mat(0xff3040,{e:0xff2030,ei:2}),-.25,1.12,.5);
  const el=document.createElement('canvas');el.width=160;el.height=128;const c=el.getContext('2d'),tex=new T.CanvasTexture(el);tex.colorSpace=T.SRGBColorSpace;tex.magFilter=T.NearestFilter;const scr=screen(tex,.95,.76,1.4);scr.position.set(0,1.6,.51);scr.rotation.x=-.12;g.add(scr);let mode='attract';
  const draw=t=>{c.fillStyle='#070b18';c.fillRect(0,0,160,128);if(mode==='attract'){c.fillStyle='#5ee7ff';c.font='900 26px monospace';c.textAlign='center';c.fillText('BITE',80,54);c.fillText('NIGHT',80,84);}
   else{const x=mode==='over'?80:30+((t*40)%100),y=mode==='over'?70:78-Math.abs(Math.sin(t*9))*22;c.fillStyle='#22304a';c.fillRect(0,98,160,30);c.fillStyle=g.userData.lc;c.fillRect(x-10,y-4,20,20);c.fillRect(x-12,y-18,24,16);c.fillRect(x-16,y-22,6,10);c.fillRect(x+10,y-22,6,10);c.fillStyle='#fff';c.fillRect(x-7,y-13,4,4);c.fillRect(x+3,y-13,4,4);
    if(mode==='over'){c.fillStyle='#ff4d6e';c.font='900 20px monospace';c.textAlign='center';c.fillText('GAME OVER',80,26);if(Math.floor(t*3)%2){c.fillStyle='#ffe45e';c.font='900 11px monospace';c.fillText('INSERT COIN',80,118);}}else{c.fillStyle='#ffe45e';c.font='900 11px monospace';c.textAlign='left';c.fillText('LIVES 0',6,14);}}tex.needsUpdate=true;};
  draw(0);g.userData.tick=t=>{if(mode!=='attract')draw(t);};g.userData.set=(k,v)=>{if(k==='sprite')mode='sprite';if(k==='over')mode='over';if(k==='glow')scr.material.emissiveIntensity=2.4;};},
 bin(g){cyl(g,.55,.42,1.1,mat(0x7d8696,{m:.8,r:.4}),0,.55,0,null,true);cyl(g,.42,.42,.04,DARK(),0,.03,0);const lid=new T.Group();lid.position.set(-.55,1.12,0);g.add(lid);cyl(lid,.6,.6,.08,mat(0x9aa3b4,{m:.8,r:.35}),.55,0,0);ball(lid,.08,DARK(),.55,.08,0);g.userData.set=(k,v)=>{if(k==='open')lid.rotation.z=v?1.3:0;};},
 jar(g){cyl(g,.42,.42,.8,mat(0xcfefff,{a:.28,r:.05}),0,.4,0);cyl(g,.44,.44,.08,mat(0xc9483d,{m:.6,r:.4}),0,.84,0);},
 plane(g,o,lc){const m=mat(0xf8f6ee,{ds:1,r:.9}),geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([.6,0,0,-.5,0,.34,-.5,.05,0, .6,0,0,-.5,.05,0,-.5,0,-.34, .6,0,0,-.5,.05,0,-.5,-.22,0],3));geo.computeVertexNormals();add(g,geo,m);ball(g,.07,mat(lc),-.1,.03,.12);ball(g,.07,mat(lc),-.1,.03,-.12);},
 lamp(g){cyl(g,.07,.1,3.6,mat(0x2c3340,{m:.8,r:.4}),0,1.8,0);box(g,.9,.08,.08,mat(0x2c3340,{m:.8,r:.4}),.4,3.55,0);ball(g,.2,mat(0xfff0c0,{e:0xffe6a0,ei:3}),.8,3.45,0);cyl(g,.25,.3,.2,DARK(),0,.1,0);},
 moon(g){const tex=texture(256,256,(c,w)=>{c.fillStyle='#c9ccd6';c.fillRect(0,0,w,w);for(let i=0;i<40;i++){const x=(i*73)%256,y=(i*131)%256,r=6+(i*17)%22;c.fillStyle='#a9adba';c.beginPath();c.arc(x,y,r,0,7);c.fill();c.fillStyle='#dfe2ea';c.beginPath();c.arc(x-2,y-2,r*.7,0,7);c.fill();}});
  ball(g,6,new T.MeshStandardMaterial({map:tex,emissive:0x8088a0,emissiveIntensity:.5,roughness:1}),0,0,0);const cr=ball(g,.9,mat(0x4a4d58,{r:1}),-.4,0,5.6,[1,1,.3]);cr.visible=false;g.userData.set=(k,v)=>{if(k==='crater')cr.visible=!!v;};},
 truck(g){const y=mat(0xffc21f,{r:.4,m:.3});box(g,1.4,1.3,1.8,y,-1.9,1.25,0);box(g,1.2,.6,1.6,mat(0x9fd8ff,{a:.5,r:.1}),-1.95,1.7,0);box(g,4.6,.3,1.9,DARK(),.2,.6,0);for(const x of [-1.9,.6,1.7])for(const z of [-.95,.95])cyl(g,.45,.45,.3,mat(0x15161a,{r:.9}),x,.45,z,[Math.PI/2,0,0]);
  const bed=new T.Group();bed.position.set(2.3,.8,0);g.add(bed);box(bed,3,.12,1.9,y,-1.5,0,0);box(bed,3,1.1,.1,y,-1.5,.6,.95);box(bed,3,1.1,.1,y,-1.5,.6,-.95);box(bed,.1,1.1,1.9,y,-3,.6,0);let tip=0,goal=0;g.userData.set=(k,v)=>{if(k==='tip')goal=v?.9:0;};g.userData.tick=(t,dt)=>{tip+=(goal-tip)*Math.min(1,dt*3);bed.rotation.z=-tip;};},
 ball1(g){ball(g,.16,mat(0xd8f04a,{r:.8}),0,0,0);},
 tornado(g){const m=mat(0xd9ccae,{a:.34,r:1,ds:1});for(let i=0;i<6;i++)cyl(g,.35+i*.33,.2+i*.3,.75,m,Math.sin(i*1.3)*.12,.4+i*.72,Math.cos(i*1.7)*.12,null,true);},
 shoe(g){box(g,.34,.16,.16,mat(0xff4d5e),0,.08,0);box(g,.14,.2,.16,mat(0xff4d5e),-.1,.2,0);box(g,.36,.04,.18,mat(0xffffff),0,.02,0);},
 camera(g){box(g,.42,.28,.2,DARK(),0,0,0);cyl(g,.1,.12,.16,mat(0x3a3f4c,{m:.8,r:.3}),.02,0,.16,[Math.PI/2,0,0]);box(g,.12,.08,.1,mat(0xffffff,{e:0xffffff,ei:2}),-.12,.18,0);},
 photo(g,o,lc){box(g,.8,.95,.02,mat(0xfaf8f0,{r:.9}),0,0,0);box(g,.66,.62,.022,mat(0x9fd0e8),0,.1,.002);ball(g,.2,mat(lc),0,.02,.01,[1,1,.1]);ball(g,.08,mat(lc),-.17,.2,.01,[1,1.4,.1]);ball(g,.08,mat(lc),.17,.2,.01,[1,1.4,.1]);ball(g,.035,mat(0x111111),-.07,.05,.03,[1,1,.2]);ball(g,.035,mat(0x111111),.07,.05,.03,[1,1,.2]);},
 globe(g){const tex=texture(256,128,(c,w,h)=>{c.fillStyle='#2a6fe0';c.fillRect(0,0,w,h);c.fillStyle='#4fc46a';for(let i=0;i<22;i++){c.beginPath();c.ellipse((i*97)%256,20+(i*53)%90,10+(i*13)%26,6+(i*7)%16,i,0,7);c.fill();}c.fillStyle='#ffffffcc';c.fillRect(0,0,w,8);c.fillRect(0,h-8,w,8);});ball(g,2,new T.MeshStandardMaterial({map:tex,roughness:.7,emissive:0x1a3a80,emissiveIntensity:.5}),0,0,0);ball(g,2.12,mat(0x9fd0ff,{a:.14}),0,0,0);},
 streak(g){ball(g,.12,mat(0xffffff,{e:0xb9ff5e,ei:6}),0,0,0);ball(g,.3,mat(0xb9ff5e,{a:.3,e:0xb9ff5e,ei:2}),0,0,0);},
 plinth(g){const m=mat(0xeceaf2,{r:.3});cyl(g,.7,.8,.35,m,0,.18,0);cyl(g,.85,.85,.1,m,0,.4,0);for(const x of [-1.35,1.35]){cyl(g,.04,.04,.9,GOLD(),x,.45,.7);ball(g,.08,GOLD(),x,.93,.7);}box(g,2.7,.05,.05,mat(0xb3123a),0,.75,.7);},
 bigcrown(g){const m=GOLD();cyl(g,1.35,1.25,1.5,m,0,.75,0,null,true);add(g,new T.TorusGeometry(1.3,.12,8,32),m,0,.1,0,[Math.PI/2,0,0]);for(let i=0;i<7;i++){const a=i/7*TAU;add(g,new T.ConeGeometry(.28,.9,8),m,Math.cos(a)*1.3,1.9,Math.sin(a)*1.3);ball(g,.14,mat([0xff3b6b,0x5ee7ff,0xb9ff5e][i%3],{e:[0xff3b6b,0x5ee7ff,0xb9ff5e][i%3],ei:1.5}),Math.cos(a)*1.38,.8,Math.sin(a)*1.38);}},
 chain(g){for(let i=0;i<9;i++)add(g,new T.TorusGeometry(.09,.03,6,12),GOLD(),0,.4+i*.28,0,[0,i%2?1.57:0,0]);add(g,new T.TorusGeometry(.2,.04,8,16),GOLD(),0,.1,0);},
 drain(g){const tex=texture(256,256,(c,w)=>{c.fillStyle='#1a4f9c';c.fillRect(0,0,w,w);c.translate(128,128);for(let i=0;i<6;i++){c.rotate(TAU/6);c.strokeStyle=i%2?'#8fd8ff':'#ffffff';c.lineWidth=7;c.beginPath();for(let a=0;a<5;a+=.1){const r=a*24;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.stroke();}c.fillStyle='#04060c';c.beginPath();c.arc(0,0,20,0,7);c.fill();});add(g,new T.CircleGeometry(1.5,40),new T.MeshStandardMaterial({map:tex,roughness:.1,metalness:.3,emissive:0x2a6fd0,emissiveIntensity:.4}),0,0,0,[-Math.PI/2,0,0]);add(g,new T.TorusGeometry(1.5,.07,8,40),GOLD(),0,.02,0,[Math.PI/2,0,0]);},
 purse(g){ball(g,.4,mat(0x7a3fb0,{r:.7}),0,0,0,[1,1.1,.9]);cyl(g,.12,.2,.2,mat(0x7a3fb0,{r:.7}),0,.44,0);add(g,new T.TorusGeometry(.14,.03,6,16),GOLD(),0,.38,0,[Math.PI/2,0,0]);const s=add(g,new T.PlaneGeometry(.4,.4),new T.MeshBasicMaterial({map:label('$','#ffd25e','#00000000',64,64,54),transparent:true}),0,0,.37);},
 slot(g){const red=mat(0xc8203a,{m:.4,r:.3});box(g,2.2,3.4,1.3,red,0,1.7,0);box(g,2.3,.5,1.4,GOLD(),0,3.5,0);box(g,2,.5,.9,GOLD(),0,.55,.5);ball(g,.5,mat(0xffe45e,{e:0xffd25e,ei:1.5}),0,4,0);const arm=new T.Group();arm.position.set(1.2,1.9,0);g.add(arm);cyl(arm,.05,.05,1.1,STEEL(),0,.55,0);ball(arm,.16,mat(0xff3040),0,1.15,0);
  const reels=[];for(let i=0;i<3;i++){const el=document.createElement('canvas');el.width=64;el.height=96;const tex=new T.CanvasTexture(el);tex.colorSpace=T.SRGBColorSpace;const m=screen(tex,.52,.8,.55);m.position.set(-.6+i*.6,2.2,.66);g.add(m);reels.push({el,tex,stop:false});}
  let spin=false;const SYM=['🍒','🔔','★','🦴','7'],draw=(r,t,i)=>{const c=r.el.getContext('2d');c.fillStyle='#fffdf2';c.fillRect(0,0,64,96);c.font='900 54px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillStyle=r.stop?'#d81e3c':'#222';c.fillText(r.stop?'7':SYM[Math.floor(t*14+i*2)%SYM.length],32,52);r.tex.needsUpdate=true;};
  reels.forEach((r,i)=>draw(r,i,i));g.userData.set=(k,v)=>{if(k==='spin'){spin=true;arm.rotation.x=1;}if(k==='stop'){reels[v-1].stop=true;draw(reels[v-1],0,0);}};g.userData.tick=t=>{if(spin)reels.forEach((r,i)=>{if(!r.stop)draw(r,t,i);});};},
 board(g){box(g,5.4,3.4,.3,DARK(),0,0,0);const el=document.createElement('canvas');el.width=320;el.height=192;const tex=new T.CanvasTexture(el);tex.colorSpace=T.SRGBColorSpace;const m=screen(tex,5,3,1.5);m.position.z=.16;g.add(m);let mode='list',fl=false;
  const draw=t=>{const c=el.getContext('2d');c.fillStyle=fl&&Math.floor(t*14)%2?'#30102a':'#080a16';c.fillRect(0,0,320,192);c.textAlign='center';c.font='900 26px monospace';if(mode==='list'){c.fillStyle='#5ee7ff';c.fillText('HIGH SCORES',160,34);c.font='900 20px monospace';c.fillStyle='#ffe45e';['1. K.K. 999999','2. K.K. 999998','3. K.K. 999997','4. YOU  000012'].forEach((s,i)=>c.fillText(s,160,74+i*30));}
   else{c.fillStyle=Math.floor(t*4)%2?'#ffe45e':'#ff5fc8';c.fillText('NEW HIGH SCORE',160,70);c.font='900 54px monospace';c.fillStyle='#fff';c.fillText('K.K.',160,136);}tex.needsUpdate=true;};draw(0);
  g.userData.set=(k,v)=>{if(k==='flicker')fl=true;if(k==='score'){mode='score';fl=false;}};g.userData.tick=t=>{if(fl||mode==='score')draw(t);};},
 tub(g){const w=mat(0xfdfdfd,{r:.15});const t=ball(g,1,w,0,.75,0,[1.35,.7,.9]);box(g,2.9,.1,2,w,0,1.02,0);for(const [x,z]of [[-1,.6],[1,.6],[-1,-.6],[1,-.6]])ball(g,.13,GOLD(),x,.12,z);for(let i=0;i<14;i++)ball(g,.2+((i*7)%5)*.04,mat(0xffffff,{r:1}),-1.1+(i%7)*.37,1.12+((i*3)%3)*.08,(i<7?-.45:.5)+((i*5)%3)*.1);cyl(g,.04,.04,.5,GOLD(),1.2,1.3,0);},
 balloons(g){const cols=[0xff5fc8,0x5ee7ff,0xffe45e,0xb9ff5e,0xc78bff,0xff8a3d,0xff4d5e];for(let i=0;i<11;i++){const a=i*2.4,r=.25+(i%4)*.22,x=Math.cos(a)*r,z=Math.sin(a)*r*.6,y=.9+(i%5)*.3;ball(g,.3,mat(cols[i%7],{r:.2}),x,y,z,[1,1.2,1]);const s=cyl(g,.006,.006,y+1.3,mat(0xffffff),x*.5,(y-1.3)/2,z*.5);s.rotation.z=x*.25;s.rotation.x=-z*.25;}},
 shadow(g){add(g,new T.CircleGeometry(1,28),new T.MeshBasicMaterial({color:0,transparent:true,opacity:.55,depthWrite:false}),0,0,0,[-Math.PI/2,0,0]);},
 paper(g){const tex=texture(256,128,(c,w,h)=>{c.fillStyle='#f1eee2';c.fillRect(0,0,w,h);c.fillStyle='#222';c.font='900 30px serif';c.fillText('THE DAILY BARK',8,34);c.fillStyle='#777';for(let y=50;y<h;y+=9)c.fillRect(8,y,w-16-(y*7)%60,3);},{repeat:true});const m=new T.MeshStandardMaterial({map:tex,roughness:.9});const c=add(g,new T.CylinderGeometry(.55,.55,5.2,18),m,-2.6,0,0,[0,0,Math.PI/2]);},
 billboard(g){box(g,5.6,3.5,.3,DARK(),0,0,0);for(const x of [-2,2])box(g,.2,6,.2,STEEL(),x,-4.4,-.1);const el=document.createElement('canvas');el.width=320;el.height=192;const tex=new T.CanvasTexture(el);tex.colorSpace=T.SRGBColorSpace;const m=screen(tex,5.2,3.1,1.7);m.position.z=.16;g.add(m);let mode='ad',fl=false;
  const draw=t=>{const c=el.getContext('2d'),off=fl&&Math.floor(t*17)%3===0;c.fillStyle=off?'#000':mode==='ad'?'#1a0830':'#ff2f92';c.fillRect(0,0,320,192);if(off){tex.needsUpdate=true;return;}c.textAlign='center';if(mode==='ad'){c.font='900 46px system-ui';c.fillStyle='#ff5fc8';c.fillText('BITE NIGHT',160,90);c.font='900 18px system-ui';c.fillStyle='#5ee7ff';c.fillText('EVERY DAWG HAS ITS NIGHT',160,130);}else{c.font='900 34px system-ui';c.fillStyle='#fff';c.fillText('TONIGHT ONLY',160,44);c.font='900 16px system-ui';c.fillText('ONE NIGHT ONLY · SLIGHTLY USED',160,176);}tex.needsUpdate=true;};draw(0);
  g.userData.set=(k,v)=>{if(k==='flicker')fl=true;if(k==='ad'){mode='tonight';fl=false;draw(0);}};g.userData.tick=t=>{if(fl)draw(t);};},
 train(g){const body=mat(0xb8c0cc,{m:.8,r:.3});box(g,18,2.7,2.5,body,0,1.75,0);box(g,18,.3,2.52,mat(0xffc21f),0,1.1,0);box(g,18.1,.9,2.4,mat(0xfff2c0,{e:0xffe9a8,ei:1.2}),0,2.2,.07);for(let x=-8;x<=8;x+=2)if(Math.abs(x)>1.1)box(g,.5,1,2.56,body,x,2.2,0);box(g,18,.3,2.3,DARK(),0,.25,0);
  const dl=box(g,.95,2.1,.08,mat(0x8a94a4,{m:.8,r:.3}),-.48,1.5,1.27),dr=box(g,.95,2.1,.08,mat(0x8a94a4,{m:.8,r:.3}),.48,1.5,1.27);for(const d of [dl,dr])box(d,.6,.8,.02,mat(0xcfefff,{a:.4,r:.05}),0,.4,.05);let open=0,goal=0;g.userData.set=(k,v)=>{if(k==='doors')goal=v?1:0;};g.userData.tick=(t,dt)=>{open+=(goal-open)*Math.min(1,dt*7);dl.position.x=-.48-open*.9;dr.position.x=.48+open*.9;};},
 claw(g){cyl(g,.03,.03,14,STEEL(),0,7.4,0);box(g,.7,.4,.7,mat(0xff5fc8,{m:.5,r:.3}),0,.3,0);const pr=[];for(let i=0;i<3;i++){const p=new T.Group();p.rotation.y=i/3*TAU;g.add(p);const arm=new T.Group();arm.position.set(.3,.15,0);p.add(arm);box(arm,.08,1,.12,STEEL(),.25,-.45,0,[0,0,.5]);box(arm,.08,.6,.12,STEEL(),.35,-1.1,0,[0,0,-.6]);pr.push(arm);}let gr=0,goal=0;g.userData.set=(k,v)=>{if(k==='grab')goal=v?1:0;};g.userData.tick=(t,dt)=>{gr+=(goal-gr)*Math.min(1,dt*8);for(const a of pr)a.rotation.z=.5-gr*.75;};},
 chute(g){box(g,1.8,1.5,1.4,mat(0x2a2740,{m:.3,r:.4}),0,.75,0);box(g,1.4,.5,.1,DARK(),0,.5,.72);const s=add(g,new T.PlaneGeometry(1.6,.5),new T.MeshStandardMaterial({map:label('PRIZES','#ffe45e','#30104a',256,80,56),emissive:0xffffff,emissiveIntensity:.6,emissiveMap:label('PRIZES','#ffe45e','#30104a',256,80,56)}),0,1.2,.71);g.userData.set=(k,v)=>{if(k==='win')g.userData.win=true;};g.userData.tick=t=>{if(g.userData.win)s.material.emissiveIntensity=1+Math.sin(t*20);};},
 pot(g){cyl(g,1.25,1.05,1.5,mat(0x2e3138,{m:.8,r:.35}),0,.95,0,null,true);cyl(g,1.05,1.05,.06,mat(0x2e3138,{m:.8,r:.35}),0,.22,0);cyl(g,1.2,1.2,.02,mat(0xf0b860,{r:.15,e:0x9a5a10,ei:.5}),0,1.55,0);box(g,3,.2,2,mat(0x7a2e1e),0,.1,0);for(const x of [-1.6,1.6])add(g,new T.TorusGeometry(.2,.05,6,14),STEEL(),x*.82,1.3,0);for(const [x,z]of [[-1.2,.9],[1.2,.9]])cyl(g,.3,.3,.12,DARK(),x,.3,z,[Math.PI/2,0,0]);},
 lid(g){cyl(g,1.3,1.3,.08,mat(0x8a909c,{m:.9,r:.3}),0,0,0);ball(g,.14,DARK(),0,.14,0);},
 noodles(g){for(let i=0;i<6;i++)add(g,new T.TorusGeometry(.18+i*.03,.03,6,18,4),mat(0xf2d27a,{r:.6}),Math.sin(i)*.12,-.05*i,Math.cos(i*2)*.1,[1.2+i*.3,i,0]);box(g,.5,.03,.03,mat(0x8a5a2b),.1,.1,0,[0,0,.5]);box(g,.5,.03,.03,mat(0x8a5a2b),.16,.1,.05,[0,0,.4]);},
 hook(g){cyl(g,.04,.04,14,STEEL(),0,7.6,0);box(g,.5,.5,.5,mat(0xffc21f),0,.5,0);add(g,new T.TorusGeometry(.25,.06,8,18,4.4),STEEL(),0,.05,0,[0,0,-.9]);},
 container(g){const tex=texture(128,64,(c,w,h)=>{c.fillStyle='#1f8a8a';c.fillRect(0,0,w,h);for(let x=0;x<w;x+=8){c.fillStyle='#00000030';c.fillRect(x,0,3,h);c.fillStyle='#ffffff18';c.fillRect(x+4,0,2,h);}},{repeat:true});tex.repeat.set(4,1);const m=new T.MeshStandardMaterial({map:tex,roughness:.6,metalness:.4});
  box(g,3.2,.12,2.5,m,0,.06,0);box(g,3.2,2.6,.1,m,0,1.3,-1.25);box(g,3.2,2.6,.1,m,0,1.3,1.25);box(g,.1,2.6,2.5,m,-1.6,1.3,0);box(g,.1,2.6,2.5,m,1.6,1.3,0);const top=new T.Group();top.position.set(-1.6,2.62,0);g.add(top);box(top,3.2,.1,2.5,m,1.6,0,0);
  const st=add(g,new T.PlaneGeometry(1.6,.8),new T.MeshBasicMaterial({map:label('THIS SIDE\nUP ↓','#fff','#00000000',256,128,40),transparent:true}),0,1.4,1.31);st.visible=false;let o=0,goal=0;g.userData.set=(k,v)=>{if(k==='open')goal=v?1:0;if(k==='label')st.visible=!!v;};g.userData.tick=(t,dt)=>{o+=(goal-o)*Math.min(1,dt*6);top.rotation.z=o*1.9;};},
 treat(g){const m=mat(0xf2dfb8,{r:.7});cyl(g,.035,.035,.22,m,0,0,0,[0,0,1.57]);for(const [x,y]of [[-.12,.04],[-.12,-.04],[.12,.04],[.12,-.04]])ball(g,.05,m,x,y,0);},
 hole(g){add(g,new T.CircleGeometry(.85,24),new T.MeshBasicMaterial({color:0x020204}),0,.005,0,[-Math.PI/2,0,0]);for(let i=0;i<9;i++){const a=i/9*TAU;box(g,.5,.1,.3,mat(0x4a4e58,{r:1}),Math.cos(a)*1,.04,Math.sin(a)*1,[.2,-a,.25]);}},
 manhole(g){cyl(g,.6,.6,.08,mat(0x5a606c,{m:.9,r:.45}),0,0,0);for(let i=0;i<4;i++)box(g,1,.02,.06,mat(0x3a3e48,{m:.9}),0,.045,-.3+i*.2);}
};
let ringT=null;const ringTex=()=>ringT??=texture(128,128,(c)=>{const g=c.createRadialGradient(64,64,30,64,64,64);g.addColorStop(0,'#ffffff00');g.addColorStop(.72,'#ffffffff');g.addColorStop(.9,'#ffffff55');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,128,128);});
export const PROP_KINDS=Object.keys(PROPS);
// Showers made of real little objects.
const RAIN={ball:{geo:()=>new T.SphereGeometry(.15,10,8),colors:[0xd8f04a,0xc8e83a],g:-12},coin:{geo:()=>new T.CylinderGeometry(.11,.11,.03,12),colors:[0xffc93d,0xffe08a],g:-11,metal:1,spin:1},cube:{geo:()=>new T.BoxGeometry(.11,.11,.11),colors:[0x5ee7ff,0xff5fc8,0xffffff],g:0,glow:1},
 confetti:{geo:()=>new T.PlaneGeometry(.12,.07),colors:[0xff5fc8,0x5ee7ff,0xffe45e,0xb9ff5e,0xc78bff,0xffffff],g:-2.4,spin:1,flutter:1},ticket:{geo:()=>new T.PlaneGeometry(.2,.09),colors:[0xffe45e,0xff8a3d],g:-3,spin:1,flutter:1},bubble:{geo:()=>new T.SphereGeometry(.1,10,8),colors:[0xdff4ff,0xffffff],g:.5,a:.5},
 heart:{geo:()=>{const s=new T.Shape();s.moveTo(0,-.1);s.bezierCurveTo(.18,.02,.12,.16,0,.07);s.bezierCurveTo(-.12,.16,-.18,.02,0,-.1);return new T.ShapeGeometry(s);},colors:[0xff5f8a,0xff8ab0],g:.9,flutter:1},shard:{geo:()=>new T.TetrahedronGeometry(.1),colors:[0xffffff],g:-7,spin:1}};
const DUST={spark:1,dust:1,snow:1,steam:1,drip:1},FLIP={truck:1,paper:1,roller:1,lamp:1,plane:1,dart:1,stick:1};

export class Director {
 constructor(scene){this.s=scene;this.props=[];this.rains=[];this.tracks=[];this.active=false;this.t=0;this.dur=0;this.group=new T.Group();scene.scene.add(this.group);this.m=new T.Matrix4();this.q=new T.Quaternion();this.e=new T.Euler();this.v=new T.Vector3();this.c=new T.Color();}
 rnd(){let a=this.rs=(this.rs+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
 /** Begin a finisher. w/l are the scene's rigs; ox is where the midpoint sits; dir is +1 if the winner is on the left. */
 start(id,{w,l,ox=0,dir=1,seed=1,loop=false}){
  this.stop();const cine=CINES[id];if(!cine)return false;this.id=id;this.dur=cine.dur;this.t=0;this.holdT=0;this.rs=seed>>>0||1;this.seed0=this.rs;this.done=false;this.ox=ox;this.dir=dir;this.loop=loop;this.active=true;this.lc=l.color;
  this.A={w:{rig:w,pos:[-1.1,0,0],rot:[0,0,0],scale:[1,1,1],vis:true,pose:'stand',base:Math.PI/2,pt:0},l:{rig:l,pos:[1.1,0,0],rot:[0,0,0],scale:[1,1,1],vis:true,pose:'dizzy',base:-Math.PI/2,pt:0}};
  this.cp=[0,1.5,5.6];this.ca=[0,1.15,0];this.fov=40;this.followT=null;this.tracks=[];cine.run(this);this.tracks.sort((a,b)=>a.t0-b.t0);
  this.s.cineBegin();return true;}
 stop(){if(!this.active&&!this.props.length)return;this.active=false;for(const p of this.props){this.group.remove(p.g);p.g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material?.map&&o.material.userData?.own)o.material.map.dispose();});}this.props=[];for(const r of this.rains){this.group.remove(r.mesh);r.mesh.geometry.dispose();r.mesh.material.dispose();}this.rains=[];this.tracks=[];
  if(this.A)for(const a of Object.values(this.A)){a.rig.setMat('normal');a.rig.holder.visible=true;a.rig.holder.scale.setScalar(1);a.rig.extra=[0,0,0];}this.A=null;this.s.cineEnd();}
 tgt(x){return typeof x==='string'?this.A[x]:x;}
 at(t,fn){this.tracks.push({t0:t,t1:t,fn});}
 tw(t0,t1,fn){this.tracks.push({t0,t1:Math.max(t1,t0+.001),fn});}
 // ── Script vocabulary (see fight-cine.js).
 cam(t,p,a,fov=40){this.at(t,()=>{this.cp=[...p];this.ca=[...a];this.fov=fov;this.followT=null;this.s.camCut?.();});}
 dolly(t0,t1,p,a){let p0,a0;this.tw(t0,t1,k=>{if(!p0){p0=[...this.cp];a0=[...this.ca];}const e=smooth(k);for(let i=0;i<3;i++){this.cp[i]=p0[i]+(p[i]-p0[i])*e;this.ca[i]=a0[i]+(a[i]-a0[i])*e;}});}
 follow(t0,t1,target,off){this.tw(t0,t1,k=>{const o=this.tgt(target);this.ca=[...o.pos];this.cp=[o.pos[0]+off[0],o.pos[1]+off[1],o.pos[2]+off[2]];});}
 light(t,amb,color){this.at(t,()=>this.s.cineLight(amb,color));}
 flash(t,color,amt){this.at(t,()=>this.s.stage.flashOnce(color,amt,this.s.reduced));}
 shake(t,amt){this.at(t,()=>this.s.stage.shake(amt*.8));}
 sky(t,kind){this.at(t,()=>this.s.cineSky(kind));}
 hold(t,sec){this.at(t,()=>{this.holdT=sec;});}
 pose(t,who,name){this.at(t,()=>{const a=this.A[who];a.pose=name;a.pt=0;});}
 place(t,x,p){this.at(t,()=>{this.tgt(x).pos=[...p];});}
 turn(t,x,r){this.at(t,()=>{this.tgt(x).rot=[...r];});}
 size(t,x,s){this.at(t,()=>{this.tgt(x).scale=typeof s==='number'?[s,s,s]:[...s];});}
 vis(t,x,v){this.at(t,()=>{this.tgt(x).vis=v;});}
 mat(t,who,kind){this.at(t,()=>this.A[who].rig.setMat(kind));}
 move(t0,t1,x,to,arc=0,ease=''){let from;this.tw(t0,t1,k=>{const o=this.tgt(x);if(!from)from=[...o.pos];const e=ease==='in'?k*k:ease==='out'?1-(1-k)*(1-k):smooth(k);for(let i=0;i<3;i++)o.pos[i]=from[i]+(to[i]-from[i])*e;o.pos[1]+=arc*4*k*(1-k);});}
 grow(t0,t1,x,s){let from;const to=typeof s==='number'?[s,s,s]:s;this.tw(t0,t1,k=>{const o=this.tgt(x);if(!from)from=[...o.scale];const e=smooth(k);for(let i=0;i<3;i++)o.scale[i]=from[i]+(to[i]-from[i])*e;});}
 spin(t0,t1,x,axis,turns,mode=''){let base;const i='xyz'.indexOf(axis);this.tw(t0,t1,k=>{const o=this.tgt(x);if(base===undefined)base=o.rot[i];
  o.rot[i]=base+(mode==='wobble'?Math.sin(k*Math.PI*8)*(1-k)*turns*TAU:mode==='loop'?Math.sin(k*TAU*turns)*.7:turns*TAU*(mode==='accel'||mode==='in'?k*k:mode==='decel'?1-(1-k)*(1-k):k));});}
 circle(t0,t1,x,c,r,turns,mode='',phase=0,plane='xz'){phase=Number(phase)||0;this.tw(t0,t1,k=>{const o=this.tgt(x),f=mode==='accel'?k*k:k,a=phase+turns*TAU*f,rr=mode==='shrink'?r*(1-k*.85):r;
  if(plane==='xy')o.pos=[c[0]+Math.cos(a)*rr,c[1]+Math.sin(a)*rr*.25,c[2]+Math.sin(a)*rr];else o.pos=[c[0]+Math.cos(a)*rr,c[1],c[2]+Math.sin(a)*rr];
  if(o.rig&&(o.pose==='run'||o.pose==='rake'))o.rot[1]=-a-o.base;});}
 attach(t,p,who){this.at(t,()=>{p.attached=this.A[who];});}
 prop(t,kind,pos,o={}){const g=new T.Group(),lc=this.lc;g.userData.lc=lc;(PROPS[kind]||PROPS.star)(g,o,o.color==='l'?lc:o.color??lc);const s=o.s??1,h={g,kind,pos:[...pos],rot:[0,0,0],scale:[s,s,s],vis:false,t0:t,life:o.life||0,growTo:o.grow||0,s0:s};g.visible=false;this.group.add(g);this.props.push(h);
  if(this.s.quality==='high')g.traverse(m=>{if(m.isMesh&&!m.material.transparent)m.castShadow=true;});this.at(t,()=>{h.vis=true;});return h;}
 set(t,p,k,v){this.at(t,()=>p.g.userData.set?.(k,v));}
 burst(t,p,color,n,speed=5){this.at(t,()=>{const w=this.world(p);this.s.particles.burst(w[0],w[1],w[2],this.s.lite?Math.ceil(n/2):n,color,{speed,life:.9,gravity:-7,up:speed*.35});});}
 shards(t,who,colors,n){this.at(t,()=>{const a=this.A[who],p=[a.pos[0],a.pos[1]+.9,a.pos[2]];a.vis=false;if(n>0){this.spawnRain('shard',this.s.lite?Math.ceil(n/2):n,{from:p,spread:.5,up:4,life:2.4,colors,burst:6});}const w=this.world(p);for(const c of colors)this.s.particles.burst(w[0],w[1],w[2],24,c,{speed:7,life:1,gravity:-6,up:3});});}
 rain(t,kind,n,o={}){if(DUST[kind]){const until=o.until??(o.every?t+1.2:t),every=o.every?o.every/60:0;let next=t;const emit=()=>{const from=o.trail?[o.trail.pos[0],o.trail.pos[1]-.4,o.trail.pos[2]]:o.from,w=this.world(from),col=o.color??(kind==='steam'?0xffffff:kind==='snow'?0xdff4ff:0xd8c8a8),per=every?Math.max(2,Math.round(n/Math.max(1,(until-t)/every)*.5)):n;
    if(o.to){const d=this.world(o.to),life=o.life||.6;for(let i=0;i<per;i++){const P=this.s.particles,k=P.next=(P.next+1)%P.N,sp=o.spread||.2;P.pos.set([w[0]+(this.rnd()-.5)*sp,w[1]+(this.rnd()-.5)*sp,w[2]+(this.rnd()-.5)*sp],k*3);P.vel.set([(d[0]-w[0])/life+(this.rnd()-.5)*sp*2,(d[1]-w[1])/life+(this.rnd()-.5)*sp*2,(d[2]-w[2])/life],k*3);P.life[k]=P.max[k]=life*(.7+this.rnd()*.5);P.grav[k]=0;P.stick[k]=0;this.c.set(col);P.base.set([this.c.r,this.c.g,this.c.b],k*3);}}
    else this.s.particles.burst(w[0],w[1],w[2],this.s.lite?Math.ceil(per/2):per,col,{speed:(o.spread||.5)*2.2,life:o.life||1,gravity:kind==='steam'?1.2:kind==='snow'?-1:kind==='dust'?-1:-9,up:o.up??1,spread:(o.spread||.5)*3});};
   if(!every){this.at(t,emit);return;}this.tw(t,until,()=>{while(next<=this.t){emit();next+=every;}});return;}
  this.at(t,()=>this.spawnRain(kind,this.s.lite?Math.ceil(n*.45):n,o));}
 spawnRain(kind,n,o){const R=RAIN[kind];if(!R)return;const geo=R.geo(),m=R.glow?new T.MeshBasicMaterial({toneMapped:false}):new T.MeshStandardMaterial({roughness:R.metal?.25:.6,metalness:R.metal?1:0,side:T.DoubleSide,transparent:!!R.a,opacity:R.a??1});
  const mesh=new T.InstancedMesh(geo,m,n);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);if(this.s.quality==='high'&&!R.a&&!R.glow)mesh.castShadow=true;const cols=o.colors||(o.color!==undefined?[o.color]:R.colors),P=new Float32Array(n*3),V=new Float32Array(n*3),D=new Float32Array(n),L=new Float32Array(n),S=new Float32Array(n);
  const from=o.from,sp=o.spread??.5,to=o.to;
  for(let i=0;i<n;i++){P[i*3]=from[0]+(this.rnd()-.5)*sp*2;P[i*3+1]=from[1]+(this.rnd()-.5)*sp;P[i*3+2]=from[2]+(this.rnd()-.5)*sp*1.4;D[i]=(o.stagger||0)*this.rnd();L[i]=(o.life||2)*(.75+this.rnd()*.5);S[i]=this.rnd()*TAU;
   if(o.burst){const a=this.rnd()*TAU,u=this.rnd();V[i*3]=Math.cos(a)*o.burst*u;V[i*3+1]=(o.up||3)*(.4+this.rnd());V[i*3+2]=Math.sin(a)*o.burst*u*.7;}
   else if(to&&!o.drag){V[i*3]=(to[0]-from[0])/.7+(this.rnd()-.5)*sp;V[i*3+1]=(o.up||0)+this.rnd();V[i*3+2]=(to[2]-from[2])/.7+(this.rnd()-.5)*sp;}
   else{V[i*3]=(this.rnd()-.5)*sp*2.2;V[i*3+1]=(o.up||0)*(.5+this.rnd()*.7);V[i*3+2]=(this.rnd()-.5)*sp*1.6;}
   mesh.setColorAt(i,this.c.set(cols[i%cols.length]));}
  mesh.instanceColor.needsUpdate=true;this.group.add(mesh);this.rains.push({mesh,R,o,n,P,V,D,L,S,age:0,landed:0});}
 stamp(t,text,sub){this.at(t,()=>this.s.cineStamp(text,sub));}
 say(t,text){this.at(t,()=>this.s.cineSay(text));}
 snd(t,name){this.at(t,()=>this.s.sfx(name));}
 world(p){return [this.ox+this.dir*p[0],p[1],p[2]];}

 update(dt){
  if(!this.active)return;if(this.holdT>0){this.holdT-=dt;dt*=.06;}
  this.t+=dt;const t=this.t;
  for(const tr of this.tracks){if(tr.done||t<tr.t0)continue;const k=Math.min(1,(t-tr.t0)/Math.max(1e-6,tr.t1-tr.t0));tr.fn(tr.t1===tr.t0?1:k);if(t>=tr.t1)tr.done=true;}
  // Actors.
  for(const a of Object.values(this.A)){a.pt+=dt;const r=a.rig,w=this.world(a.pos),yaw=a.base+a.rot[1];r.holder.visible=a.vis;r.holder.position.set(w[0],w[1],w[2]);r.holder.rotation.y=this.dir>0?yaw:-yaw;r.holder.scale.set(a.scale[0],a.scale[1],a.scale[2]);r.extra=[a.rot[0],0,a.rot[2]*this.dir];r.cinePose(a.pose,a.pt,dt,this.dir*(a===this.A.w?1:-1));}
  // Props.
  for(const p of this.props){const g=p.g;if(p.attached){const a=p.attached,sw=a.pose==='batswing',wd=a.pose==='batwind';p.pos=[a.pos[0]+(sw?.9:wd?-.5:.25),a.pos[1]+(sw?1.25:wd?1.7:1.1),a.pos[2]+.3];p.rot=[0,0,sw?-1.45:wd?.9:-.25];p.scale=[.55,.55,.55];}
   if(p.life){const k=(t-p.t0)/p.life;if(k>=1)p.vis=false;else if(k>=0){if(p.growTo){const s=p.s0*(1+(p.growTo-1)*k);p.scale=[s,s,s];}if(g.userData.fade)g.userData.fade.opacity=1-k;}}
   g.visible=p.vis&&t>=p.t0;if(!g.visible)continue;const w=this.world(p.pos);g.position.set(w[0],w[1],w[2]);if(this.dir<0&&FLIP[p.kind])g.rotation.set(p.rot[0],p.rot[1]+Math.PI+(p.kind==='truck'?Math.PI:0),p.rot[2]);else g.rotation.set(p.rot[0],p.rot[1]*this.dir+(p.kind==='truck'?Math.PI:0),p.rot[2]*this.dir);g.scale.set(p.scale[0],p.scale[1],p.scale[2]);g.userData.tick?.(t,dt);}
  // Showers.
  for(const r of this.rains){r.age+=dt;const {P,V,D,L,S,R,o,n,mesh}=r,to=o.to,pile=o.pile;let live=0;
   for(let i=0;i<n;i++){const age=r.age-D[i],k=i*3;if(age<0||age>L[i]){this.m.makeScale(0,0,0);mesh.setMatrixAt(i,this.m);continue;}live++;
    if(o.drag&&to){const pull=Math.min(1,age*1.4);V[k]+=((to[0]-P[k])*6*pull-V[k]*2)*dt;V[k+1]+=((to[1]-P[k+1])*6*pull-V[k+1]*2)*dt;V[k+2]+=((to[2]-P[k+2])*6*pull-V[k+2]*2)*dt;}
    else V[k+1]+=R.g*dt;
    if(R.flutter){V[k]+=Math.sin(age*5+S[i])*dt*1.5;V[k+1]=Math.max(V[k+1],-1.4);}
    P[k]+=V[k]*dt;P[k+1]+=V[k+1]*dt;P[k+2]+=V[k+2]*dt;
    const floor=pile?Math.max(.12,Math.min(1.55,r.landed/n*2.2)*Math.max(0,1-Math.hypot(P[k]-pile[0],P[k+2]-pile[2])/2)+.12):.06;
    if(R.g<0&&P[k+1]<floor&&!(o.drag&&to)){P[k+1]=floor;if(Math.abs(V[k+1])>1.2&&o.bounce){V[k+1]=-V[k+1]*o.bounce;V[k]*=.7;V[k+2]*=.7;}else{if(V[k+1]<-.01)r.landed++;V[k]=V[k+1]=V[k+2]=0;}}
    const gone=o.drag&&to&&Math.hypot(P[k]-to[0],P[k+1]-to[1],P[k+2]-to[2])<.25,sc=gone?0:Math.min(1,(L[i]-age)*3);if(gone)L[i]=0;
    const w=this.world([P[k],P[k+1],P[k+2]]);this.e.set(R.spin?age*6+S[i]:0,S[i],R.spin?age*4:0);this.q.setFromEuler(this.e);this.v.set(sc,sc,sc);this.m.compose(new T.Vector3(w[0],w[1],w[2]),this.q,this.v);mesh.setMatrixAt(i,this.m);}
   mesh.instanceMatrix.needsUpdate=true;mesh.visible=live>0;}
  // Camera: the script's shot, pulled back on narrow screens so both actors stay in frame.
  const cam=this.s.camera,asp=cam.aspect,pull=asp<1.25?Math.min(2.3,Math.pow(1.25/asp,.9)):1,p=this.world(this.cp),a=this.world(this.ca);
  cam.position.set(a[0]+(p[0]-a[0])*pull,a[1]+(p[1]-a[1])*pull,a[2]+(p[2]-a[2])*pull);cam.fov=this.fov;cam.updateProjectionMatrix();this.s.stage.applyShake(this.t,this.s.reduced);cam.up.set(0,1,0);cam.lookAt(a[0],a[1],a[2]);
  if(t>=this.dur+(this.loop?1.6:0)){if(this.loop){const {id,ox,dir,loop}=this,w=this.A.w.rig,l=this.A.l.rig;this.start(id,{w,l,ox,dir,seed:this.seed0||1,loop});}else this.done=true;}
 }
}
