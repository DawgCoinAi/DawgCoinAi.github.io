// Street Hustle's drive between districts, in 3D: a third-person car down a palm-lined coastal
// boulevard at golden hour or neon night, with traffic, cash drops, wanted stars and cruisers on
// your tail. Rules live in hustle-drive.js; this module only draws them and collects input
// (keyboard, on-screen pedals, auto-drive). driveTo() resolves with the drive's outcome, or null
// when the player skips or the 3D view is unavailable, and the trip then plays as it always has.
import {T,quality as detectQuality,fitFov,skyMaterial,Stage,Particles,loadModel,cloneModel,fitModel} from './three-kit.js';
import {loadBuildings,styledBuildings,SKIES,STORE_SIGNS,roadTexture,palmGrove,storeSign,skylineBand,glowTexture} from './city-art.js';
import {planDrive,DriveSim,autopilot,roadPath,roadPoint,LANES,RADIO,TOP_SPEED,driveSeed,DRIVE_CASH_CAP} from './hustle-drive.js';
import {DISTRICTS} from './engine.js';
import {music} from './arcade-music.js';

const CAR_MODELS=['cars/sedan.glb','cars/taxi.glb','cars/van.glb','cars/suv.glb','cars/hatchback-sports.glb','cars/delivery.glb'];
const PLAYER_MODEL='cars/hatchback-sports.glb',COP_MODEL='cars/police.glb',MPH=2.237;
const RESULT_CARD={clean:['CLEAN RUN','Nobody looked twice. Encounter risk tonight drops.'],escaped:['SHOOK THEM','Lost the cruisers. Heat cools and the crews stay away.'],tailed:['STILL TAILED','A cruiser followed you in. Heat +6.'],busted:['PULLED OVER','A patrol DAWG is walking up to your window…']};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const money=n=>'$'+Math.round(n).toLocaleString('en-US');
const store={get(k,f){try{const v=localStorage.getItem(k);return v===null?f:v;}catch{return f;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};

// The plan for a trip from the trade state: the same night and route always plays the same streets.
export function drivePlanFor(trade,to){return planDrive({seed:driveSeed(trade.world.seed,trade.day,trade.district,to),from:trade.district,to,heat:trade.heat,day:trade.day,weather:trade.world.weather});}
// Opens the drive full screen. Resolves with an outcome for trade.travel(), or null to skip.
export function driveTo(options){return new HustleDrive(options).run();}

class HustleDrive {
 constructor({plan,reduced=false,quality=detectQuality(),sound=false,volume=.8,dawgName=''}){this.plan=plan;this.reduced=reduced;this.quality=quality;this.sound=sound;this.volume=volume;this.dawgName=dawgName;
  this.sim=new DriveSim(plan);this.path=roadPath(plan);this.look=SKIES[plan.look]||SKIES.sunset;this.keys=new Set();this.touch={left:false,right:false,gas:false,brake:false};
  this.auto=false;this.state='loading';this.radio=Math.max(0,Math.min(RADIO.length-1,Number(store.get('dawg-hustle-radio','0'))||0));this.cache={};this.last=0;this.mapAt=0;this.camPos=new T.Vector3();this.camAt=new T.Vector3();this.streamed=[];this.pools=new Map();}
 run(){return new Promise(resolve=>{this.resolve=resolve;try{this.mount();this.load();}catch{this.close(null);}});}
 // ── DOM: the overlay, HUD and controls ─────────────────────────────────────────────────────
 mount(){const p=this.plan,from=DISTRICTS[p.from].name,to=DISTRICTS[p.to].name,root=this.root=document.createElement('div');root.className='hd-root hd-loading';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',`Drive from ${from} to ${to}`);
  const stars=n=>'★'.repeat(n)+'<i>'+'★'.repeat(5-n)+'</i>';
  root.innerHTML=`<div class="hd-view"></div>
<div class="hd-hud" aria-hidden="true"><div class="hd-top"><div class="hd-wanted"><span class="hd-stars">${stars(0)}</span><small class="hd-status">ON THE ROAD</small><i class="hd-bust"><b></b></i></div>
<div class="hd-dest"><small>DROP-OFF</small><strong>${esc(to)}</strong><i class="hd-trip"><b></b></i><small class="hd-dist"></small></div><canvas class="hd-map" width="150" height="150"></canvas></div>
<div class="hd-pops"></div><div class="hd-banner" hidden></div><div class="hd-gauge"><strong class="hd-speed">0</strong><small>MPH</small><b class="hd-cash">+$0</b></div></div>
<button type="button" class="hd-radio" data-hd="radio" aria-label="Change radio station"><span class="hd-radio-name"></span><small class="hd-radio-tag"></small></button>
<div class="hd-actions"><button type="button" data-hd="auto" aria-pressed="false">AUTO-DRIVE</button><button type="button" data-hd="skip">SKIP DRIVE ⏭</button></div>
<div class="hd-pad" aria-hidden="true"><button type="button" data-hold="left" tabindex="-1">◀</button><button type="button" data-hold="right" tabindex="-1">▶</button></div>
<div class="hd-pedals" aria-hidden="true"><button type="button" data-hold="brake" tabindex="-1">BRAKE</button><button type="button" data-hold="gas" tabindex="-1">GAS</button></div>
<section class="hd-card hd-intro"><span class="hd-kicker">NIGHT ${p.day} · THE RUN</span><h2>${esc(from)} <em>→</em> ${esc(to)}</h2><p class="hd-route">${(p.length/1000).toFixed(1)} km of boulevard · wanted <span class="hd-stars">${stars(p.stars)}</span></p>
<p class="hd-brief">${p.stars?`Your heat put ${p.police.length===1?'a cruiser':p.police.length+' cruisers'} on the streets. Lose them (stay well ahead), or they'll box you in.`:'No heat on you. Watch your speed past the parked patrol, grab the cash drops and thread traffic for near-miss bonuses.'}</p>
<p class="hd-keys">W / ↑ gas · S / ↓ brake · A D / ← → steer · R radio · Space auto-drive · Esc skip</p>
<div class="hd-card-actions"><button type="button" class="hd-go" data-hd="go" disabled>LOADING THE CITY…</button><button type="button" data-hd="autogo">AUTO-DRIVE</button><button type="button" data-hd="skip">SKIP · ARRIVE NOW</button></div></section>
<section class="hd-card hd-result" hidden><span class="hd-kicker">ARRIVED · ${esc(to.toUpperCase())}</span><h2 class="hd-result-title"></h2><p class="hd-result-text"></p><dl class="hd-tally"></dl><button type="button" class="hd-go" data-hd="done">CONTINUE ↗</button></section>`;
  document.body.append(root);document.body.classList.add('hd-active');this.$=s=>root.querySelector(s);
  this.onClick=e=>{const b=e.target.closest('[data-hd]');if(!b||b.disabled)return;const a=b.dataset.hd;if(a==='go')this.start(false);if(a==='autogo')this.start(true);if(a==='skip')this.close(null);if(a==='auto')this.setAuto(!this.auto);if(a==='radio')this.nextStation();if(a==='done')this.close(this.sim.outcome());};
  root.addEventListener('click',this.onClick);
  const hold=(e,on)=>{const b=e.target.closest('[data-hold]');if(!b)return;e.preventDefault();this.touch[b.dataset.hold]=on;b.classList.toggle('on',on);if(on&&this.auto&&b.dataset.hold!=='gas')this.setAuto(false);};
  root.addEventListener('pointerdown',e=>{if(e.target.closest('[data-hold]')){e.target.setPointerCapture?.(e.pointerId);hold(e,true);}});
  for(const t of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(t,e=>hold(e,false));
  root.addEventListener('contextmenu',e=>{if(e.target.closest('[data-hold]'))e.preventDefault();});
  const map={arrowup:'gas',w:'gas',arrowdown:'brake',s:'brake',arrowleft:'left',a:'left',arrowright:'right',d:'right'};
  this.onKey=e=>{const k=e.key.toLowerCase(),down=e.type==='keydown';if(map[k]){e.preventDefault();e.stopPropagation();if(down){this.keys.add(map[k]);if(this.auto&&map[k]!=='gas')this.setAuto(false);}else this.keys.delete(map[k]);return;}
   if(!down)return;if(k==='escape'){e.preventDefault();e.stopPropagation();this.state==='done'?this.close(this.sim.outcome()):this.close(null);}else if(k===' '||k==='enter'){if(e.target.closest?.('button')&&k==='enter')return;e.preventDefault();e.stopPropagation();if(this.state==='ready')this.start(false);else if(this.state==='driving')this.setAuto(!this.auto);else if(this.state==='done')this.close(this.sim.outcome());}else if(k==='r'&&!e.repeat){e.stopPropagation();this.nextStation();}};
  window.addEventListener('keydown',this.onKey,true);window.addEventListener('keyup',this.onKey,true);
  this.onBlur=()=>{this.keys.clear();for(const k in this.touch)this.touch[k]=false;};window.addEventListener('blur',this.onBlur);
  this.showStation(false);setTimeout(()=>this.$('[data-hd="autogo"]')?.focus?.({preventScroll:true}),30);}
 // ── 3D world ───────────────────────────────────────────────────────────────────────────────
 async load(){
  if(typeof WebGL2RenderingContext==='undefined'){this.close(null);return;}
  const stage=this.stage=new Stage({quality:this.quality,className:'hd-gpu',onFailure:()=>this.close(this.state==='done'?this.sim.outcome():null)}).init();this.$('.hd-view').append(stage.view);
  this.scene=stage.scene;this.camera=stage.camera;this.camera.far=900;stage.neonEnvironment(this.look.night?.75:.5);stage.hdrEnvironment(undefined,this.look.night?.35:.75);stage.r.toneMappingExposure=this.look.night?.95:1.02;
  const timeout=new Promise(r=>setTimeout(()=>r(null),15000));
  const art=await Promise.race([Promise.all([loadBuildings(),Promise.all(CAR_MODELS.map(p=>loadModel(p).catch(()=>null))),loadModel(PLAYER_MODEL).catch(()=>null),loadModel(COP_MODEL).catch(()=>null)]),timeout]).catch(()=>null);
  if(this.closed)return;try{this.build(art||[[],[],null,null]);}catch(e){console.warn('Street Hustle drive failed to build',e);this.close(null);return;}
  this.state='ready';this.root.classList.remove('hd-loading');const go=this.$('[data-hd="go"]');go.disabled=false;go.textContent='DRIVE ↗';
  this.loop=now=>{this.raf=requestAnimationFrame(this.loop);this.frame(now);};this.raf=requestAnimationFrame(this.loop);
  if(/[?&]debug\b/.test(location.search))globalThis.hustleDrive=this;}
 build([buildings,cars,playerSrc,copSrc]){const s=this.scene,look=this.look,p=this.plan,path=this.path,low=this.quality!=='high',night=look.night;
  s.fog=new T.FogExp2(look.fog,look.fogDensity*(p.weather===2?1.6:1));
  this.sky=new T.Mesh(new T.SphereGeometry(800,24,12),skyMaterial());const u=this.sky.material.uniforms;u.uTop.value.set(look.top);u.uHorizon.value.set(look.horizon);u.uGlow.value.set(look.glow);s.add(this.sky);
  s.add(new T.HemisphereLight(look.hemi[0],look.hemi[1],look.hemi[2]));const key=this.key=new T.DirectionalLight(look.key[0],look.key[1]);s.add(key,key.target);
  this.glowTex=glowTexture();
  // The sun (or moon) low over the water, with a long glitter path; it keeps its bearing as you drive.
  this.sunDir=new T.Vector3(-.75,.07,-.66).normalize();
  this.sun=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,color:new T.Color(look.sun).multiplyScalar(night?.9:1.3),transparent:true,depthWrite:false,fog:false,blending:T.AdditiveBlending,toneMapped:false}));this.sun.scale.set(night?40:70,night?40:70,1);s.add(this.sun);
  this.glitter=new T.Mesh(new T.PlaneGeometry(40,500),new T.MeshBasicMaterial({map:this.glowTex,color:new T.Color(look.sun).multiplyScalar(night?.35:.8),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,fog:false}));this.glitter.rotation.x=-Math.PI/2;s.add(this.glitter);
  this.ocean=new T.Mesh(new T.PlaneGeometry(4000,4000).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:look.water,metalness:.85,roughness:.16,envMapIntensity:1.1}));this.ocean.position.y=-.7;s.add(this.ocean);
  this.skyline=skylineBand(620,70,night?'#ff9ad5':'#ffcf96');s.add(this.skyline);
  // Ground: the road, sidewalks, the inland blocks on the right and the beach down to the water on the left.
  const s0=-120,s1=p.length+320,step=low?6:4;
  const road=roadTexture();this.road=this.ribbon(s0,s1,-7,7,.03,.03,new T.MeshStandardMaterial({map:road,roughness:p.weather===1?.12:.3,metalness:p.weather===1?.65:.45,envMapIntensity:night?1.4:1}),step,16);
  this.ribbon(s0,s1,7,10.5,.2,.2,new T.MeshStandardMaterial({color:night?0x3a3648:0x9a8e8a,roughness:.8}),step);
  this.ribbon(s0,s1,-10.5,-7,.2,.2,new T.MeshStandardMaterial({color:night?0x3a3648:0xb0a49a,roughness:.8}),step);
  this.ribbon(s0,s1,10.5,300,.02,.02,new T.MeshStandardMaterial({color:look.ground,roughness:.95}),step*2);
  this.ribbon(s0,s1,-46,-10.5,-.9,.08,new T.MeshStandardMaterial({color:look.sand,roughness:1}),step*2);
  // Buildings on the inland side, with neon storefronts; palms on both sidewalks; lamps.
  if(buildings.length){const styled=styledBuildings(buildings,night?'night':'day'),gap=low?24:15;let i=0;
   for(let at=s0+10;at<s1;at+=gap+((i*37)%7)){i++;const src=styled[(i*7+p.seed)%styled.length],tall=p.to===3||p.to===1?1.4:1,h=(9+((i*53+p.seed)%29))*tall,d=17+((i*11)%9),pt=roadPoint(path,at,d),b=fitModel(cloneModel(src),h),g=new T.Group();g.add(b);g.position.set(pt.x,0,pt.z);g.rotation.y=Math.atan2(-Math.cos(pt.h),-Math.sin(pt.h));s.add(g);this.streamed.push({obj:g,s:at});
    if(i%3===0){const [text,col]=STORE_SIGNS[(i/3+p.seed)%STORE_SIGNS.length|0],sign=storeSign(text,col,5.5),q=roadPoint(path,at,12.2);sign.position.set(q.x,3.6+(i%2)*1.2,q.z);sign.rotation.y=Math.atan2(-Math.cos(q.h),-Math.sin(q.h));s.add(sign);this.streamed.push({obj:sign,s:at});}}}
  const palms=[];for(let at=s0;at<s1;at+=low?16:11){const a=roadPoint(path,at,-9.1);palms.push([a.x,a.z,.85+((at*7)%5)/10,at*1.7]);if(Math.round(at/11)%2===0){const b=roadPoint(path,at+5,9.2);palms.push([b.x,b.z,.8+((at*3)%4)/10,at]);}}
  const grove=palmGrove(palms,{dark:night});grove.children.forEach(m=>{m.position.y=.2;});s.add(grove);
  const poles=[],glows=[];for(let at=s0;at<s1;at+=low?36:26){const a=roadPoint(path,at,8);poles.push(a);glows.push(roadPoint(path,at,6.6));}
  const poleMesh=new T.InstancedMesh(new T.CylinderGeometry(.08,.11,6.4,6).translate(0,3.4,0),new T.MeshStandardMaterial({color:0x2a2a34,roughness:.6,metalness:.6}),poles.length),m4=new T.Matrix4();poles.forEach((a,i)=>poleMesh.setMatrixAt(i,m4.makeTranslation(a.x,0,a.z)));s.add(poleMesh);
  const glowGeo=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(glows.flatMap(a=>[a.x,6.5,a.z]),3));this.lamps=new T.Points(glowGeo,new T.PointsMaterial({map:this.glowTex,size:night?2.4:1.6,color:new T.Color(1.2,1,.75).multiplyScalar(look.lamps),transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));s.add(this.lamps);
  // An arch over the road at the drop-off with the district's name.
  const gate=storeSign(DISTRICTS[p.to].name.toUpperCase(),['#b9ff5e','#ff5fc8','#5ee7ff','#ffc861','#c78bff'][p.to],12),g=roadPoint(path,p.length,0);gate.position.set(g.x,7.2,g.z);gate.rotation.y=-g.h;s.add(gate);
  // Cars: one template per model, fitted to length; copies come from pools as cars come into view.
  const fit=src=>{if(!src)return null;const o=fitModel(cloneModel(src),4.4);const w=new T.Group();w.add(o);return w;};
  this.templates=cars.map(fit);this.copTemplate=fit(copSrc)||this.box(0x1a2a6a);this.player=fit(playerSrc)||this.box(0xff5fc8);s.add(this.player);
  this.patrolCar=p.patrol?this.copTemplate.clone(true):null;if(this.patrolCar){const a=roadPoint(path,p.patrol.s,p.patrol.d-.4);this.patrolCar.position.set(a.x,.2,a.z);this.patrolCar.rotation.y=Math.PI-a.h;s.add(this.patrolCar);}
  // Lights that move: tail lights, oncoming headlights and the cruisers' light bars, in one points cloud.
  this.lightN=160;this.lightPos=new Float32Array(this.lightN*3);this.lightCol=new Float32Array(this.lightN*3);const lg=new T.BufferGeometry();lg.setAttribute('position',new T.BufferAttribute(this.lightPos,3).setUsage(T.DynamicDrawUsage));lg.setAttribute('color',new T.BufferAttribute(this.lightCol,3).setUsage(T.DynamicDrawUsage));
  this.lights=new T.Points(lg,new T.PointsMaterial({map:this.glowTex,size:night?.9:.7,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.lights.frustumCulled=false;s.add(this.lights);
  // Cash drops: glowing green bills that bob over the lane.
  const cashTex=new T.CanvasTexture((()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.shadowColor='#7dff8a';x.shadowBlur=24;x.fillStyle='#173d22';x.beginPath();x.roundRect(18,34,92,60,10);x.fill();x.lineWidth=5;x.strokeStyle='#9dff7a';x.stroke();x.font='900 54px system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#d8ffc8';x.fillText('$',64,66);return c;})());cashTex.colorSpace=T.SRGBColorSpace;
  this.cashMat=new T.SpriteMaterial({map:cashTex,transparent:true,depthWrite:false,toneMapped:false,color:new T.Color(1.6,1.6,1.6)});
  this.particles=new Particles(s,low?200:420,this.glowTex);this.particles.reduced=this.reduced;
  this.place(0,true);}
 box(color){const g=new T.Group(),b=new T.Mesh(new T.BoxGeometry(1.9,1.3,4.2),new T.MeshStandardMaterial({color,metalness:.5,roughness:.4}));b.position.y=.75;g.add(b);return g;}
 // A strip of ground beside the road's centreline from d0 to d1 (metres right of centre).
 ribbon(s0,s1,d0,d1,y0,y1,mat,step,tile=0){const n=Math.ceil((s1-s0)/step)+1,pos=new Float32Array(n*6),uv=new Float32Array(n*4),idx=[];
  for(let i=0;i<n;i++){const at=s0+i*step,a=roadPoint(this.path,at,d0),b=roadPoint(this.path,at,d1);pos.set([a.x,y0,a.z,b.x,y1,b.z],i*6);uv.set([0,tile?at/tile:0,1,tile?at/tile:0],i*4);if(i){const k=i*2;idx.push(k-2,k-1,k,k-1,k+1,k);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const m=new T.Mesh(g,mat);this.scene.add(m);return m;}
 pool(key,template){let p=this.pools.get(key);if(!p){p={items:[],used:0};this.pools.set(key,p);}if(p.used>=p.items.length){const o=template.clone(true);this.scene.add(o);p.items.push(o);}const o=p.items[p.used++];o.visible=true;return o;}
 // ── Controls, radio and sound ──────────────────────────────────────────────────────────────
 input(){if(this.auto)return autopilot(this.sim);const k=this.keys,t=this.touch,steer=(k.has('right')||t.right?1:0)-(k.has('left')||t.left?1:0);return {throttle:k.has('gas')||t.gas?1:0,brake:k.has('brake')||t.brake?1:0,steer};}
 setAuto(on){this.auto=on;const b=this.$('[data-hd="auto"]');b.setAttribute('aria-pressed',String(on));b.classList.toggle('on',on);b.textContent=on?'AUTO-DRIVE · ON':'AUTO-DRIVE';if(this.state==='driving')this.banner(on?'AUTO-DRIVE ON':'YOU HAVE THE WHEEL');}
 start(auto){if(this.state!=='ready')return;this.state='intro';this.introAt=performance.now();this.root.classList.add('hd-driving');this.$('.hd-intro').hidden=true;this.setAuto(auto);this.audioStart();this.tune();}
 nextStation(){this.radio=(this.radio+1)%RADIO.length;store.set('dawg-hustle-radio',String(this.radio));this.showStation(true);this.tune();}
 showStation(flash){const st=RADIO[this.radio];this.$('.hd-radio-name').textContent=st.track?'📻 '+st.name:'📻 '+st.name;this.$('.hd-radio-tag').textContent=st.tag;if(flash){const r=this.$('.hd-radio');r.classList.remove('hd-flash');void r.offsetWidth;r.classList.add('hd-flash');}}
 tune(){const st=RADIO[this.radio];if(!this.sound||!st.track||this.state==='loading'||this.state==='ready'){music.setPlaying(false);return;}music.setVolume(this.volume);music.setTrack(st.track);music.setPlaying(true,this.sim.chasing?.85:.35);}
 audioStart(){if(!this.sound)return;try{const AC=globalThis.AudioContext||globalThis.webkitAudioContext,c=this.audio=new AC(),out=c.createGain();out.gain.value=.5*this.volume;out.connect(c.destination);
  const eng=this.engine=c.createOscillator(),lp=c.createBiquadFilter(),eg=c.createGain();eng.type='sawtooth';lp.type='lowpass';lp.frequency.value=420;eg.gain.value=.05;eng.connect(lp);lp.connect(eg);eg.connect(out);eng.start();
  const sir=this.siren=c.createOscillator(),sg=this.sirenGain=c.createGain();sir.type='square';sg.gain.value=0;const sl=c.createBiquadFilter();sl.type='lowpass';sl.frequency.value=1800;sir.connect(sl);sl.connect(sg);sg.connect(out);sir.start();this.out=out;}catch{this.audio=null;}}
 audioFrame(){const c=this.audio;if(!c)return;const t=c.currentTime,v=this.sim.v;this.engine.frequency.setTargetAtTime(38+v*2.4+(this.lastInput?.throttle?8:0),t,.08);
  const on=this.sim.chasing&&this.state==='driving';this.sirenGain.gain.setTargetAtTime(on?.022:0,t,.2);this.siren.frequency.setTargetAtTime(Math.floor(t/.42)%2?640:880,t,.02);}
 blip(f,len=.12,type='triangle',gain=.06){const c=this.audio;if(!c)return;const o=c.createOscillator(),g=c.createGain(),t=c.currentTime;o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.5,t+len);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0005,t+len);o.connect(g);g.connect(this.out);o.start(t);o.stop(t+len+.02);}
 // ── Each frame: step the sim, place everything, draw the HUD ─────────────────────────────
 frame(now){if(this.closed||!this.stage)return;const dt=Math.min(.1,Math.max(0,(now-(this.last||now))/1000));this.last=now;const sim=this.sim;
  if(this.state==='intro'&&(this.reduced||now-this.introAt>1500)){this.state='driving';this.banner('GO · GET TO '+DISTRICTS[this.plan.to].name.toUpperCase());}
  if(this.state==='driving'){this.lastInput=this.input();sim.advance(dt,this.lastInput);for(const e of sim.events.splice(0))this.event(e);if(sim.done)this.finish();}
  this.place(dt,false,now/1000);this.hud(now);this.audioFrame();this.stage.resize();this.particles.update(dt);this.stage.render(dt,now/1000,{reduced:this.reduced,aberration:.0012});}
 event(e){const at=roadPoint(this.path,this.sim.s,this.sim.d);
  if(e.type==='cash'){this.pop('+'+money(e.value),'cash');this.particles.burst(at.x,1.2,at.z,18,0x7dff8a,{speed:4,life:.6,up:3});this.blip(880);this.haptic(10);}
  if(e.type==='near'){this.pop((e.oncoming?'ONCOMING NEAR MISS ':'NEAR MISS ')+'+'+money(e.bonus),'near');this.blip(1200,.08,'square',.03);}
  if(e.type==='crash'){this.stage.shake(e.hard?.8:.45);this.stage.flashOnce('#ffffff',e.hard?.25:.12,this.reduced);this.particles.burst(at.x,.8,at.z,e.hard?40:20,0xffc861,{speed:7,life:.5,up:2});this.blip(90,.3,'sawtooth',.1);this.haptic(e.hard?[30,20,30]:18);}
  if(e.type==='spotted'){this.banner(e.patrol?'SPEED TRAP · YOU\'VE BEEN SPOTTED':'CRUISERS ON YOUR TAIL');this.tune();this.haptic([12,40,12]);}
  if(e.type==='lost'){this.banner('YOU LOST THEM');this.tune();this.blip(660,.3,'triangle',.06);}
  if(e.type==='copcrash'&&e.t-(this.copPop||-9)>2.5){this.copPop=e.t;this.pop('CRUISER WIPED OUT','near');}}
 haptic(p){try{if(navigator.userActivation?.hasBeenActive!==false)navigator.vibrate?.(p);}catch{}}
 place(dt,snap,real=0){const sim=this.sim,path=this.path,low=this.quality!=='high',night=this.look.night;this.pools.forEach(p=>{for(const o of p.items)o.visible=false;p.used=0;});
  const me=roadPoint(path,sim.s,sim.d),yaw=Math.atan2(sim.lat,Math.max(6,sim.v))*.8;this.player.position.set(me.x,.12,me.z);this.player.rotation.set(0,Math.PI-me.h-yaw,0);this.player.rotateZ(-sim.lat*.006);
  let L=0;const light=(x,y,z,r,g,b)=>{if(L>=this.lightN)return;this.lightPos.set([x,y,z],L*3);this.lightCol.set([r,g,b],L*3);L++;};
  const tail=(pt,dir,bright)=>{const fx=Math.sin(pt.h)*dir,fz=-Math.cos(pt.h)*dir,rx=Math.cos(pt.h),rz=Math.sin(pt.h);for(const side of [-.7,.7])light(pt.x-fx*2.2+rx*side,.85,pt.z-fz*2.2+rz*side,2*bright,.15*bright,.1*bright);};
  const head=(pt,dir)=>{const fx=Math.sin(pt.h)*dir,fz=-Math.cos(pt.h)*dir,rx=Math.cos(pt.h),rz=Math.sin(pt.h);for(const side of [-.7,.7])light(pt.x+fx*2.2+rx*side,.8,pt.z+fz*2.2+rz*side,2.2,2,1.6);};
  tail(me,1,this.lastInput?.brake?1.6:1);
  sim.cars.forEach((c,i)=>{const rel=c.s-sim.s;if(rel<-60||rel>(low?260:340))return;const t=this.templates[c.kind%Math.max(1,this.templates.length)];if(!t)return;const o=this.pool('car'+(c.kind%this.templates.length),t),pt=roadPoint(path,c.s,c.d);o.position.set(pt.x,.12,pt.z);o.rotation.set(0,c.dir>0?Math.PI-pt.h:-pt.h,0);if(c.side)o.rotateY(c.side*.25);
   if(c.dir>0)tail(pt,1,1);else head(pt,-1);});
  const flash=Math.floor(real*6)%2;for(const c of sim.cops){if(!c.active&&c.delay>sim.t-.01||c.lost&&c.s<sim.s-260)continue;const rel=c.s-sim.s;if(rel<-300||rel>300)continue;const o=this.pool('cop',this.copTemplate),pt=roadPoint(path,c.s,c.d);o.position.set(pt.x,.12,pt.z);o.rotation.set(0,Math.PI-pt.h,0);
   if(!c.lost){const rx=Math.cos(pt.h)*.45,rz=Math.sin(pt.h)*.45;light(pt.x-rx,1.75,pt.z-rz,flash?3:.3,.1,.1);light(pt.x+rx,1.75,pt.z+rz,.1,.3,flash?.3:3);}head(pt,1);}
  if(this.patrolCar&&sim.patrol&&!sim.patrol.woke){const pt=roadPoint(path,sim.patrol.s,sim.patrol.d-.4),rel=sim.patrol.s-sim.s;this.patrolCar.visible=rel>-80&&rel<400;if(rel<160&&rel>-20)light(pt.x,1.75,pt.z,flash?1.6:.2,.1,flash?.2:1.6);}else if(this.patrolCar)this.patrolCar.visible=false;
  for(const q of sim.pickups){if(q.taken)continue;const rel=q.s-sim.s;if(rel<-10||rel>240)continue;const o=this.pool('cash',this.cashSprite??=new T.Sprite(this.cashMat)),pt=roadPoint(path,q.s,q.d),bob=Math.sin(real*3+q.s)*.25;o.position.set(pt.x,1.5+bob,pt.z);o.scale.setScalar(1.7);}
  for(let i=L;i<this.lightN;i++){this.lightCol[i*3]=this.lightCol[i*3+1]=this.lightCol[i*3+2]=0;}const lg=this.lights.geometry;lg.attributes.position.needsUpdate=true;lg.attributes.color.needsUpdate=true;
  for(const it of this.streamed){const rel=it.s-sim.s;it.obj.visible=rel>-90&&rel<(low?380:520);}
  // Rain when the weather says so.
  if(this.plan.weather===1&&!this.reduced)for(let i=0;i<(low?3:6);i++)this.particles.burst(me.x+(Math.random()-.5)*30,14,me.z+(Math.random()-.5)*30-Math.sin(me.h)*10,1,0x9fc4ff,{speed:.2,life:.6,gravity:-30,up:0,spread:.1});
  // Chase camera: low behind the car, pulling back and widening with speed; an intro swoop first.
  const fwd=new T.Vector3(Math.sin(me.h),0,-Math.cos(me.h)),v=sim.v,back=5.4+v*.06,pos=new T.Vector3(me.x,0,me.z).addScaledVector(fwd,-back),at=new T.Vector3(me.x,1.3,me.z).addScaledVector(fwd,10);at.y=1.1;pos.y=2.15+v*.01;
  if(this.state==='ready'||this.state==='loading'||this.state==='intro'){const k=this.state==='intro'?Math.min(1,(performance.now()-this.introAt)/1500):0,e=k*k*(3-2*k),orbit=new T.Vector3(me.x,0,me.z).addScaledVector(fwd,16).add(new T.Vector3(Math.cos(me.h)*9,4.5+Math.sin(real*.3)*.4,Math.sin(me.h)*9));pos.lerp(orbit,1-e);at.lerp(new T.Vector3(me.x,1,me.z),1-e);snap=true;}
  if(this.state==='done'){const o=new T.Vector3(me.x,0,me.z).add(new T.Vector3(Math.cos(real*.25+me.h)*9,3.5,Math.sin(real*.25+me.h)*9));pos.copy(o);at.set(me.x,1,me.z);}
  const f=snap?1:Math.min(1,dt*6);this.camPos.lerp(pos,f);this.camAt.lerp(at,f);const cam=this.camera;cam.position.copy(this.camPos);this.stage.applyShake(real,this.reduced);cam.lookAt(this.camAt);
  cam.fov=fitFov(60+(this.reduced?0:v*.32),cam.aspect,72);cam.updateProjectionMatrix();
  this.sky.position.copy(cam.position);this.skyline.position.set(cam.position.x,this.skyline.position.y,cam.position.z);this.ocean.position.x=Math.round(cam.position.x/50)*50;this.ocean.position.z=Math.round(cam.position.z/50)*50;
  this.sun.position.copy(cam.position).addScaledVector(this.sunDir,700);this.glitter.position.set(cam.position.x+this.sunDir.x*260,-.62,cam.position.z+this.sunDir.z*260);this.glitter.rotation.z=Math.atan2(this.sunDir.x,this.sunDir.z);
  this.key.position.set(me.x+this.sunDir.x*60,night?40:25,me.z+this.sunDir.z*60);this.key.target.position.set(me.x,0,me.z);}
 hud(now){if(now-this.hudAt<70)return;this.hudAt=now;const sim=this.sim,p=this.plan,set=(sel,v,attr='textContent')=>{if(this.cache[sel]===v)return;this.cache[sel]=v;const el=this.$(sel);if(attr==='html')el.innerHTML=v;else if(attr==='width')el.style.width=v;else el.textContent=v;};
  const stars=sim.chasing?Math.max(1,p.stars):0,blink=sim.chasing&&sim.lose>0&&Math.floor(now/180)%2;set('.hd-hud .hd-stars','★'.repeat(stars)+'<i>'+'★'.repeat(5-stars)+'</i>'+(blink?'':''),'html');this.$('.hd-wanted').classList.toggle('hot',sim.chasing);this.$('.hd-wanted').classList.toggle('losing',sim.chasing&&sim.lose>0);
  const trap=sim.patrol&&!sim.patrol.woke&&sim.patrol.s-sim.s<180&&sim.patrol.s-sim.s>-5;
  set('.hd-status',sim.done?(RESULT_CARD[sim.result]||[''])[0]:sim.chasing?(sim.bust>.3?'PULL AWAY · THEY\'RE BOXING YOU IN':sim.lose>0?'LOSING THEM…':'CRUISERS ON YOUR TAIL'):sim.escaped?'LOST THEM · KEEP IT COOL':trap?'SPEED TRAP AHEAD · UNDER 80 MPH':'ON THE ROAD');
  set('.hd-bust b',Math.round(Math.min(1,sim.bust/3)*100)+'%','width');set('.hd-trip b',Math.round(sim.progress*100)+'%','width');set('.hd-dist',Math.max(0,Math.round(p.length-sim.s))+' m');
  set('.hd-speed',String(Math.round(sim.v*MPH)));set('.hd-cash','+'+money(sim.cash)+(sim.cash>=DRIVE_CASH_CAP?' MAX':''));if(now-this.mapAt>66){this.mapAt=now;this.minimap(now);}}
 minimap(now){const c=this.$('.hd-map'),x=c.getContext('2d'),w=c.width,sim=this.sim,path=this.path,me=roadPoint(path,sim.s,sim.d),scale=.2,rot=-me.h;x.clearRect(0,0,w,w);x.save();x.beginPath();x.arc(w/2,w/2,w/2-2,0,7);x.clip();x.fillStyle='#0b0f1ecc';x.fillRect(0,0,w,w);
  // Heading-up: the road ahead always points up the map.
  x.translate(w/2,w*.62);x.rotate(rot);const tp=(px,pz)=>[(px-me.x)*scale,(pz-me.z)*scale];
  x.strokeStyle='#2b6b8a';x.lineWidth=40*scale;x.beginPath();x.moveTo(...tp(path.pts[0].x-200,path.pts[0].z));x.lineTo(...tp(path.pts[0].x-200,path.pts[0].z-4000));x.stroke();
  x.lineCap='round';x.strokeStyle='#ffffff40';x.lineWidth=7;x.beginPath();let first=true;for(const q of path.pts){if(Math.abs(q.s-sim.s)>520)continue;const [a,b]=tp(q.x,q.z);first?x.moveTo(a,b):x.lineTo(a,b);first=false;}x.stroke();
  x.strokeStyle='#ffd34a';x.lineWidth=3;x.beginPath();first=true;for(const q of path.pts){if(q.s<sim.s||q.s>this.plan.length)continue;if(q.s-sim.s>520)break;const [a,b]=tp(q.x,q.z);first?x.moveTo(a,b):x.lineTo(a,b);first=false;}x.stroke();
  const dot=(s,d,col,r)=>{if(Math.abs(s-sim.s)>520)return;const pt=roadPoint(path,s,d),[a,b]=tp(pt.x,pt.z);x.fillStyle=col;x.beginPath();x.arc(a,b,r,0,7);x.fill();};
  for(const q of sim.pickups)if(!q.taken)dot(q.s,q.d,'#7dff8a',2.6);for(const car of sim.cars)dot(car.s,car.d,'#ffffff70',1.6);
  const flash=Math.floor(now/200)%2;for(const cop of sim.cops)if(cop.active&&!cop.lost)dot(cop.s,cop.d,flash?'#ff4060':'#4a8bff',3.6);if(sim.patrol&&!sim.patrol.woke)dot(sim.patrol.s,sim.patrol.d,'#4a8bff',3);
  dot(this.plan.length,0,'#b9ff5e',5);x.restore();
  x.fillStyle='#fff';x.beginPath();x.moveTo(w/2,w*.62-7);x.lineTo(w/2+5,w*.62+5);x.lineTo(w/2-5,w*.62+5);x.closePath();x.fill();x.strokeStyle='#ffffff55';x.lineWidth=2;x.beginPath();x.arc(w/2,w/2,w/2-2,0,7);x.stroke();}
 pop(text,kind){const p=document.createElement('span');p.className='hd-pop hd-pop-'+kind;p.textContent=text;const box=this.$('.hd-pops');box.append(p);setTimeout(()=>p.remove(),1300);while(box.children.length>4)box.firstChild.remove();}
 banner(text){const b=this.$('.hd-banner');b.textContent=text;b.hidden=false;b.classList.remove('hd-show');void b.offsetWidth;b.classList.add('hd-show');clearTimeout(this.bannerTimer);this.bannerTimer=setTimeout(()=>{b.hidden=true;},2200);}
 finish(){if(this.state==='done')return;this.state='done';const o=this.sim.outcome(),[title,text]=RESULT_CARD[o.result];this.root.classList.remove('hd-driving');this.root.classList.add('hd-over');
  this.$('.hd-result-title').textContent=title;this.$('.hd-result').dataset.result=o.result;this.$('.hd-result-text').textContent=text;
  const rows=[['Road cash','+'+money(o.cash)],['Near misses',String(o.nearMisses)],['Top speed',Math.round(this.sim.topSpeed*MPH)+' mph'],['Bumps',String(o.crashes)]];this.$('.hd-tally').innerHTML=rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  this.$('.hd-result').hidden=false;this.tune();if(this.sirenGain&&o.result!=='busted')this.sirenGain.gain.value=0;this.blip(o.result==='busted'?220:780,.4,'triangle',.08);setTimeout(()=>this.$('[data-hd="done"]')?.focus?.({preventScroll:true}),40);}
 close(outcome){if(this.closed)return;this.closed=true;cancelAnimationFrame(this.raf);window.removeEventListener('keydown',this.onKey,true);window.removeEventListener('keyup',this.onKey,true);window.removeEventListener('blur',this.onBlur);
  music.setPlaying(false);try{this.audio?.close();}catch{}clearTimeout(this.bannerTimer);try{this.stage?.dispose();}catch{}this.root?.remove();document.body.classList.remove('hd-active');if(globalThis.hustleDrive===this)delete globalThis.hustleDrive;this.resolve?.(outcome||null);}
}
