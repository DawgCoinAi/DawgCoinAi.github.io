// Street Hustle's open city, live: the car, traffic, cruisers, camera, HUD, input and sound over
// the static city from hustle-city-3d.js. Rules live in hustle-world.js; this module draws them,
// takes input (keyboard, touch steering, auto-drive) and reports what happened (parked, busted,
// wants the phone) to its owner, hustle-phone.js.
import {T,quality as detectQuality,fitFov,skyMaterial,Stage,Particles,loadModel,cloneModel,fitModel,contactShadowMaterial} from './three-kit.js';
import {skylineBand,glowTexture} from './city-art.js';
import {buildCity,LOOKS,paint,headlightTexture,CAR_MODELS,PLAYER_MODEL,COP_MODEL,MPH,CURB,money,store,clamp,wrap,rnd,DISTRICT_COLORS} from './hustle-city-3d.js';
import {WorldSim,autopilot,NODES,EDGES,ALLEYS,BEACH,STOPS,XS,ZS,ROAD_HALF,NODE_R,routeTo,evadeTime,rectAt,clampPoint} from './hustle-world.js';
import {RADIO,DRIVE_CASH_CAP} from './hustle-drive.js';
import {DISTRICTS} from './engine.js';
import {WEATHER} from './world.js';
import {music} from './arcade-music.js';

export class HustleWorld {
 constructor({host,info,spot=null,quality=detectQuality(),reduced=false,sound=false,volume=.8,on=()=>{}}){this.host=host;this.info=info;this.on=on;this.quality=quality;this.reduced=reduced;this.sound=sound;this.volume=volume;
  this.sim=new WorldSim({seed:info.seed,day:info.day,heat:info.heat,district:info.district,weather:info.weather,spot});
  // A fresh game (or a save from before the city) starts parked at your dealer, phone in hand.
  const s=this.sim.stopHere();if(s){this.sim.parked=s.id;this.sim.leaving=null;}
  this.keys=new Set();this.touch={steer:0,gas:false,brake:false,hand:false,id:null,x0:0};this.auto=false;this.phone=false;this.paused=false;this.state='loading';this.cache={};
  this.radio=clamp(Number(store.get('dawg-hustle-radio','0'))||0,0,RADIO.length-1);this.camPos=new T.Vector3();this.camAt=new T.Vector3();this.camH=this.sim.h;this.last=0;this.introAt=0;this.cardTimer=0;this.look=LOOKS[info.weather]||LOOKS[0];this.lookIndex=-1;this.spotAt=0;
  this.ready=new Promise(r=>{this.resolveReady=r;});try{this.mount();this.load();}catch(e){console.warn('Street Hustle world failed to start',e);this.fail();}}
 fail(){if(this.dead||this.failed)return;this.failed=true;this.resolveReady(false);this.on('failed');}
 // ── DOM: HUD, buttons, touch controls ──────────────────────────────────────────────────────
 mount(){const root=this.root=document.createElement('div');root.className='hw-root hw-loading';
  root.innerHTML=`<div class="hw-view"></div>
<div class="hw-hud" aria-hidden="true"><div class="hw-top"><div class="hw-wanted"><span class="hw-stars"></span><small class="hw-status"></small><i class="hw-meter hw-bust"><b></b></i><i class="hw-meter hw-evade"><b></b></i></div>
<div class="hw-place"><small class="hw-night"></small><strong class="hw-district"></strong><small class="hw-street"></small></div><canvas class="hw-map" width="176" height="176"></canvas></div>
<div class="hw-run" hidden><small>DELIVERY RUN</small><b class="hw-run-time"></b><span class="hw-run-to"></span></div>
<div class="hw-pops"></div><div class="hw-banner" hidden></div><div class="hw-prompt" hidden></div>
<div class="hw-wallet"><b class="hw-cash"></b><small class="hw-bag"></small><small class="hw-road"></small></div>
<div class="hw-gauge"><strong class="hw-speed">0</strong><small>MPH</small></div>
<section class="hw-card" hidden><span class="hw-card-kicker"></span><strong class="hw-card-title"></strong><p class="hw-card-text"></p><dl class="hw-card-rows"></dl></section>
<div class="hw-loadmsg">LOADING THE CITY…</div></div>
<div class="hw-buttons"><button type="button" data-hw="exit" aria-label="Back to the arcade">‹ ARCADE</button><button type="button" data-hw="radio" class="hw-radio" aria-label="Change radio station"><span class="hw-radio-name"></span></button><button type="button" data-hw="auto" aria-pressed="false">AUTO-DRIVE</button><button type="button" data-hw="phone" class="hw-phone-btn">PHONE</button></div>
<div class="hw-touch" aria-hidden="true"><div class="hw-steer"><i class="hw-wheel"></i><small>HOLD TO DRIVE · SLIDE TO STEER</small></div><div class="hw-pedals"><button type="button" data-hold="hand" tabindex="-1">DRIFT</button><button type="button" data-hold="brake" tabindex="-1">BRAKE</button></div></div>`;
  this.host.append(root);this.$=s=>root.querySelector(s);
  root.addEventListener('click',e=>{const b=e.target.closest('[data-hw]');if(!b)return;const a=b.dataset.hw;if(a==='exit')this.on('exit');if(a==='radio')this.nextStation();if(a==='auto')this.setAuto(!this.auto);if(a==='phone')this.askPhone();b.blur?.();});
  // Touch: the left thumb drives (hold to go, slide to steer); the right has brake and drift.
  const steer=this.$('.hw-steer'),wheel=this.$('.hw-wheel');
  steer.addEventListener('pointerdown',e=>{e.preventDefault();try{steer.setPointerCapture?.(e.pointerId);}catch{}this.touch.id=e.pointerId;this.touch.x0=e.clientX;this.touch.gas=true;this.touch.steer=0;steer.classList.add('on');const r=steer.getBoundingClientRect();wheel.style.left=(e.clientX-r.left)+'px';wheel.style.top=(e.clientY-r.top)+'px';if(this.auto)this.setAuto(false);this.wake();});
  steer.addEventListener('pointermove',e=>{if(e.pointerId!==this.touch.id)return;const s=clamp((e.clientX-this.touch.x0)/64,-1,1);this.touch.steer=Math.sign(s)*Math.pow(Math.abs(s),1.25);wheel.style.transform=`translate(-50%,-50%) rotate(${(s*70).toFixed(0)}deg)`;});
  const up=e=>{if(e.pointerId!==this.touch.id)return;this.touch.id=null;this.touch.gas=false;this.touch.steer=0;steer.classList.remove('on');wheel.style.transform='translate(-50%,-50%)';};
  for(const t of ['pointerup','pointercancel','lostpointercapture'])steer.addEventListener(t,up);
  const hold=(e,on)=>{const b=e.target.closest?.('[data-hold]');if(!b)return;e.preventDefault();this.touch[b.dataset.hold]=on;b.classList.toggle('on',on);if(on&&this.auto)this.setAuto(false);if(on)this.wake();};
  root.addEventListener('pointerdown',e=>{if(e.target.closest('[data-hold]')){try{e.target.setPointerCapture?.(e.pointerId);}catch{}hold(e,true);}});
  for(const t of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(t,e=>hold(e,false));
  root.addEventListener('contextmenu',e=>{if(e.target.closest('.hw-touch'))e.preventDefault();});
  root.addEventListener('touchstart',()=>root.classList.add('hw-touching'),{passive:true,once:true});
  if(globalThis.matchMedia?.('(pointer: coarse)').matches)root.classList.add('hw-touching');
  const map={arrowup:'gas',w:'gas',arrowdown:'brake',s:'brake',arrowleft:'left',a:'left',arrowright:'right',d:'right',' ':'hand',shift:'hand'};
  this.onKey=e=>{if(this.paused||e.target?.closest?.('input,select,textarea,dialog')||document.querySelector('dialog[open]'))return;const k=(e.key||'').toLowerCase(),down=e.type==='keydown';
   if(this.phone){if(down&&k==='escape'){e.preventDefault();this.on('closePhone');}return;}
   if(map[k]){if(e.target?.closest?.('button')&&k===' ')e.target.blur();e.preventDefault();if(down){this.keys.add(map[k]);if(this.auto&&map[k]!=='gas')this.setAuto(false);this.wake();}else this.keys.delete(map[k]);return;}
   if(!down||e.repeat)return;if(k==='e'||k==='f'||k==='enter'||k==='tab'){if(k==='enter'&&e.target?.closest?.('button'))return;e.preventDefault();this.askPhone();}else if(k==='r')this.nextStation();else if(k==='q')this.setAuto(!this.auto);else if(k==='m'){this.askPhone('map');}};
  window.addEventListener('keydown',this.onKey);window.addEventListener('keyup',this.onKey);
  this.onBlur=()=>{this.keys.clear();this.touch.gas=this.touch.brake=this.touch.hand=false;this.touch.steer=0;};window.addEventListener('blur',this.onBlur);this.showStation();}
 wake(){if(!this.audio&&this.sound&&this.state==='live')this.audioStart();}
 // ── Loading and building ───────────────────────────────────────────────────────────────────
 async load(){if(typeof WebGL2RenderingContext==='undefined'){this.fail();return;}
  const stage=this.stage=new Stage({quality:this.quality,className:'hw-gpu',onFailure:()=>this.fail()}).init();this.$('.hw-view').append(stage.view);this.scene=stage.scene;this.camera=stage.camera;this.camera.far=1300;this.camera.near=.3;
  stage.neonEnvironment(.5);stage.hdrEnvironment(undefined,.6);stage.onDowngrade=()=>{this.quality='low';};
  const timeout=new Promise(r=>setTimeout(()=>r(null),15000)),get=p=>loadModel(p).catch(()=>null);
  const art=await Promise.race([Promise.all([Promise.all(CAR_MODELS.map(get)),get(PLAYER_MODEL),get(COP_MODEL)]),timeout]).catch(()=>null);if(this.dead)return;
  try{this.build(art||[[],null,null]);}catch(e){console.warn('Street Hustle world failed to build',e);this.fail();return;}
  this.state='live';this.root.classList.remove('hw-loading');this.introAt=performance.now();this.resolveReady(true);
  this.loop=now=>{if(this.dead)return;this.raf=requestAnimationFrame(this.loop);if(!this.paused)this.frame(now);};this.raf=requestAnimationFrame(this.loop);
  if(/[?&]debug\b/.test(location.search))globalThis.hustleWorld=this;}
 build([cars,playerSrc,copSrc]){const s=this.scene,high=this.quality==='high',R=rnd(77);
  this.fog=s.fog=new T.FogExp2(0xffffff,.003);this.sky=new T.Mesh(new T.SphereGeometry(1000,24,12),skyMaterial());s.add(this.sky);
  this.hemi=new T.HemisphereLight(0xffffff,0x444444,1);this.key=new T.DirectionalLight(0xffffff,1);s.add(this.hemi,this.key,this.key.target);this.stage.sunShadow(this.key,{size:46,far:220,map:2048,radius:3});
  this.glowTex=glowTexture();this.sunDir=new T.Vector3();
  this.sun=new T.Sprite(new T.SpriteMaterial({map:this.glowTex,transparent:true,depthWrite:false,fog:false,blending:T.AdditiveBlending,toneMapped:false}));s.add(this.sun);
  this.glitter=new T.Mesh(new T.PlaneGeometry(520,64).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:this.glowTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,fog:false}));this.glitter.position.y=-.55;s.add(this.glitter);
  this.ocean=new T.Mesh(new T.PlaneGeometry(4200,5200).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x1c86b4,metalness:.82,roughness:.2,envMapIntensity:1.1}));this.ocean.position.set(-2420,-.7,0);s.add(this.ocean);
  this.land=new T.Mesh(new T.PlaneGeometry(2600,3600).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x555555,roughness:1}));this.land.position.set(978,-.06,0);s.add(this.land);
  this.skyline=skylineBand(760,90,'#ffcf96');s.add(this.skyline);
  const stars=[];for(let i=0;i<500;i++){const a=R()*Math.PI*2,e=.08+R()*1.4;stars.push(Math.cos(a)*Math.cos(e)*900,Math.sin(e)*900,Math.sin(a)*Math.cos(e)*900);}
  this.stars=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(stars,3)),new T.PointsMaterial({size:2.6,sizeAttenuation:false,color:0xffffff,transparent:true,opacity:0,fog:false,depthWrite:false,toneMapped:false}));s.add(this.stars);
  buildCity(this);
  // Cars: one template per model with a soft shadow under it; copies come from pools as needed.
  const shadowMat=contactShadowMaterial(.7),fit=src=>{if(!src)return null;const o=fitModel(cloneModel(src),4.4),g=new T.Group();g.add(o);const sh=new T.Mesh(new T.PlaneGeometry(3.2,5.6).rotateX(-Math.PI/2),shadowMat);sh.position.y=.03;sh.renderOrder=1;g.add(sh);if(high)o.traverse(m=>{if(m.isMesh)m.castShadow=true;});g.userData.model=o;return g;};
  const boxCar=color=>{const g=new T.Group(),b=new T.Mesh(new T.BoxGeometry(1.9,1.2,4.2),new T.MeshStandardMaterial({color,metalness:.5,roughness:.4}));b.position.y=.8;g.add(b);g.userData.model=b;return g;};
  this.templates=cars.map(fit).filter(Boolean);if(!this.templates.length)this.templates=[boxCar(0x8899aa),boxCar(0xd9a441)];this.copTemplate=fit(copSrc)||boxCar(0x1a2a6a);
  const car=this.car=fit(playerSrc)||boxCar(0xff5fc8);s.add(car);const model=car.userData.model;this.body=model.getObjectByName?.('body')||null;this.wheels=[];model.traverse?.(o=>{if(/^wheel-/.test(o.name)){o.rotation.order='YXZ';this.wheels.push({o,front:/front/.test(o.name)});}});
  // Glossier paint on the player's car so it catches the sky and the neon.
  model.traverse?.(o=>{if(o.isMesh&&o.name==='body'){o.material=o.material.clone();o.material.metalness=.6;o.material.roughness=.28;o.material.envMapIntensity=1.3;}});
  this.beams=new T.Mesh(new T.PlaneGeometry(11,19).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:headlightTexture(),color:0xfff0c8,transparent:true,opacity:.5,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.beams.rotation.y=Math.PI;this.beams.position.set(0,.05,11);this.beams.renderOrder=2;car.add(this.beams);
  // Moving lights (tail lights, headlights, light bars) in one points cloud.
  this.lightN=220;this.lightPos=new Float32Array(this.lightN*3);this.lightCol=new Float32Array(this.lightN*3);const lg=new T.BufferGeometry();lg.setAttribute('position',new T.BufferAttribute(this.lightPos,3).setUsage(T.DynamicDrawUsage));lg.setAttribute('color',new T.BufferAttribute(this.lightCol,3).setUsage(T.DynamicDrawUsage));
  this.lights=new T.Points(lg,new T.PointsMaterial({map:this.glowTex,size:.8,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.lights.frustumCulled=false;s.add(this.lights);
  // Cash drops.
  const cashTex=paint(128,128,x=>{x.shadowColor='#7dff8a';x.shadowBlur=24;x.fillStyle='#173d22';x.beginPath();x.roundRect(18,34,92,60,10);x.fill();x.lineWidth=5;x.strokeStyle='#9dff7a';x.stroke();x.font='900 54px system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#d8ffc8';x.fillText('$',64,66);});
  this.cashTemplate=new T.Sprite(new T.SpriteMaterial({map:cashTex,transparent:true,depthWrite:false,toneMapped:false,color:new T.Color(1.6,1.6,1.6)}));this.cashTemplate.scale.setScalar(1.7);
  this.particles=new Particles(s,high?520:240,this.glowTex);this.particles.reduced=this.reduced;this.carPools=new Map();this.dummy=new T.Object3D();
  this.applyLook(this.info.weather,true);this.place(0,performance.now()/1000,true);}
 // Sky, light, fog and the city's glow for tonight's weather.
 applyLook(index,force=false){if(index===this.lookIndex&&!force)return;this.lookIndex=index;const L=this.look=LOOKS[index]||LOOKS[0],low=this.quality!=='high',u=this.sky.material.uniforms;u.uTop.value.set(L.top);u.uHorizon.value.set(L.horizon);u.uGlow.value.set(L.glow);
  this.fog.color.set(L.fog);this.fog.density=L.density*(low?1.7:1);this.hemi.color.set(L.hemi[0]);this.hemi.groundColor.set(L.hemi[1]);this.hemi.intensity=L.hemi[2];this.key.color.set(L.key[0]);this.key.intensity=L.key[1];this.sunDir.set(...L.dir).normalize();
  this.stage.r.toneMappingExposure=L.exposure;this.scene.environmentIntensity=L.night>.6?.45:.75;this.ocean.material.color.set(L.water);this.land.material.color.set(L.ground);
  this.sun.material.color.set(L.sun).multiplyScalar(L.night>.6?.9:L.name==='dusk'?1.05:1.3);this.sun.scale.setScalar(L.night>.6?46:L.name==='dusk'?110:80);this.glitter.material.color.set(L.sun).multiplyScalar(L.night>.6?.3:.75);this.stars.material.opacity=L.night>.6&&!L.rain?.9:0;
  for(const m of this.mats.fac)m.emissiveIntensity=L.windows;this.lampGlow.material.size=1.2+L.lamps*1.6;this.lampGlow.material.opacity=Math.min(1,.15+L.lamps);this.lampPools.visible=L.lamps>.4;this.lampPools.material.opacity=.14+L.lamps*.2;
  const wet=L.rain;this.mats.road.roughness=wet?.14:L.night>.6?.34:.62;this.mats.road.metalness=wet?.7:L.night>.6?.4:.08;this.mats.road.envMapIntensity=wet?1.5:1;this.mats.plain.roughness=wet?.18:.6;this.mats.plain.metalness=wet?.6:.12;
  for(const m of this.signMats)m.color.setScalar(.75+L.night*1.05);this.mats.glow.color.setScalar(.45+L.night*.75);this.cabins.material.opacity=.25+L.night*.75;
  const dark=L.night>.6;this.palms.children[0].material.color.set(dark?0x2a2026:0x7a5a44);this.palms.children[1].material.color.set(dark?0x5a7a66:0xffffff);this.beams.visible=L.lamps>.4;this.skyline.material.color.setScalar(dark?1:.55);this.skyline.material.opacity=L.name==='fog'?.25:dark?1:.5;}
 // ── Controls, radio and sound ──────────────────────────────────────────────────────────────
 input(){if(this.auto&&this.sim.gps!==null)return autopilot(this.sim);const k=this.keys,t=this.touch,steer=clamp((k.has('right')?1:0)-(k.has('left')?1:0)+t.steer,-1,1);return {throttle:k.has('gas')||t.gas&&!t.brake?1:0,brake:k.has('brake')||t.brake?1:0,steer,handbrake:k.has('hand')||t.hand};}
 setAuto(on){if(on&&this.sim.gps===null){this.banner('SET A DESTINATION ON THE PHONE MAP FIRST');on=false;}this.auto=on;const b=this.$('[data-hw="auto"]');b.setAttribute('aria-pressed',String(on));b.classList.toggle('on',on);b.textContent=on?'AUTO-DRIVE · ON':'AUTO-DRIVE';if(on&&this.sim.parked!==null&&!this.phone)this.sim.depart();if(this.state==='live'&&!this.phone&&this.sim.gps!==null)this.banner(on?'AUTO-DRIVE ON':'YOU HAVE THE WHEEL');}
 setAutoOff(){if(this.auto){this.auto=false;const b=this.$('[data-hw="auto"]');b.setAttribute('aria-pressed','false');b.classList.remove('on');b.textContent='AUTO-DRIVE';}}
 askPhone(tab){const sim=this.sim;if(this.phone||sim.busted)return;if(sim.chase){this.banner('NOT NOW · LOSE THE CRUISERS FIRST','hot');return;}if(sim.speed>2.5&&sim.parked===null){this.banner('PULL OVER TO USE YOUR PHONE');return;}
  if(sim.parked===null){const q=sim.stopHere();sim.vx=sim.vz=0;sim.speed=0;sim.vf=0;if(q&&sim.canPark(q))sim.parked=q.id;}this.on('phone',{tab,stop:sim.parked!==null?STOPS[sim.parked]:null});}
 // The owner opened or closed the phone: the world holds still while it's up.
 setPhone(open){if(this.phone===open)return;this.phone=open;this.root.classList.toggle('hw-phone',open);this.keys.clear();if(!open)this.sim.depart();}
 setGps(stopId){this.sim.gps=stopId;this.routeAt=0;}
 nextStation(){this.radio=(this.radio+1)%RADIO.length;store.set('dawg-hustle-radio',String(this.radio));this.showStation();this.wake();this.tune();}
 showStation(){const st=RADIO[this.radio];this.$('.hw-radio-name').textContent='📻 '+st.name;}
 tune(){const st=RADIO[this.radio];if(!this.sound||!st.track||this.state!=='live'||this.paused||!this.audio){music.setPlaying(false);return;}music.setVolume(this.volume);music.setTrack(st.track);music.setPlaying(true,this.sim.chase?.9:.35);}
 audioStart(){if(!this.sound||this.audio)return;try{const AC=globalThis.AudioContext||globalThis.webkitAudioContext,c=this.audio=new AC(),out=this.out=c.createGain();out.gain.value=.5*this.volume;out.connect(c.destination);
  const eng=this.engine=c.createOscillator(),lp=c.createBiquadFilter(),eg=this.engineGain=c.createGain();eng.type='sawtooth';lp.type='lowpass';lp.frequency.value=420;eg.gain.value=.045;eng.connect(lp);lp.connect(eg);eg.connect(out);eng.start();
  const sir=this.siren=c.createOscillator(),sg=this.sirenGain=c.createGain(),sl=c.createBiquadFilter();sir.type='square';sg.gain.value=0;sl.type='lowpass';sl.frequency.value=1800;sir.connect(sl);sl.connect(sg);sg.connect(out);sir.start();
  // Tyre squeal: filtered noise that opens up with slip.
  const buf=c.createBuffer(1,c.sampleRate,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const n=c.createBufferSource(),bp=c.createBiquadFilter(),ng=this.skidGain=c.createGain();n.buffer=buf;n.loop=true;bp.type='bandpass';bp.frequency.value=1500;bp.Q.value=4;ng.gain.value=0;n.connect(bp);bp.connect(ng);ng.connect(out);n.start();this.tune();}catch{this.audio=null;}}
 audioFrame(){const c=this.audio;if(!c)return;const t=c.currentTime,sim=this.sim,quiet=this.phone||this.paused;this.engine.frequency.setTargetAtTime(40+Math.abs(sim.vf||0)*2.5+(this.lastInput?.throttle?9:0),t,.08);this.engineGain.gain.setTargetAtTime(quiet?.012:.045,t,.2);
  const on=!!sim.chase&&!quiet;this.sirenGain.gain.setTargetAtTime(on?(sim.chase.seen?.024:.012):0,t,.2);this.siren.frequency.setTargetAtTime(Math.floor(t/.42)%2?640:880,t,.02);this.skidGain.gain.setTargetAtTime(!quiet&&sim.drifting?Math.min(.05,Math.abs(sim.slip)*.006):0,t,.05);}
 blip(f,len=.12,type='triangle',gain=.06){const c=this.audio;if(!c)return;const o=c.createOscillator(),g=c.createGain(),t=c.currentTime;o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.5,t+len);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0005,t+len);o.connect(g);g.connect(this.out);o.start(t);o.stop(t+len+.02);}
 haptic(p){try{if(navigator.userActivation?.hasBeenActive!==false)navigator.vibrate?.(p);}catch{}}
 setSound(on,volume=this.volume){this.sound=on;this.volume=volume;if(this.out)this.out.gain.value=on?.5*volume:0;this.tune();}
 // The trade state changed: tonight's heat, weather and which district is home.
 sync(info){this.info=info;this.sim.setNight(info);if(this.state==='live')this.applyLook(info.weather);}
 pause(on){this.paused=on;if(on){this.keys.clear();music.setPlaying(false);try{this.audio?.suspend();}catch{}}else{this.last=0;try{this.audio?.resume();}catch{}this.tune();}}
 // ── Each frame ─────────────────────────────────────────────────────────────────────────────
 frame(now){if(this.dead||!this.stage)return;const dt=Math.min(.1,Math.max(0,(now-(this.last||now))/1000));this.last=now;const sim=this.sim,real=now/1000;
  if(!this.phone&&!sim.busted){this.lastInput=this.input();if(sim.parked!==null&&(this.lastInput.throttle||this.lastInput.brake))sim.depart();sim.advance(dt,this.lastInput);}else{this.lastInput=null;if(sim.parked!==null||sim.busted)sim.traffic(Math.min(dt,.05));}
  for(const e of sim.events.splice(0))this.event(e);
  if(now-this.spotAt>8000&&!sim.chase&&!this.phone){this.spotAt=now;this.on('spot',sim.spot());}
  this.place(dt,real,false);this.hud(now);this.audioFrame();this.stage.resize();this.particles.update(dt);this.stage.render(dt,real,{reduced:this.reduced,aberration:.0012});}
 event(e){const sim=this.sim;
  if(e.type==='cash'){this.pop('+'+money(e.value),'cash');this.particles.burst(sim.x,1.2,sim.z,18,0x7dff8a,{speed:4,life:.6,up:3});this.blip(880);this.haptic(10);}
  if(e.type==='near'){this.pop((e.oncoming?'HEAD-ON NEAR MISS ':'NEAR MISS ')+'+'+money(e.bonus)+(e.count>1?' · ×'+e.count:''),'near');this.blip(1200,.08,'square',.03);if(e.count===3)this.tip('threader','Five near misses on one trip is a feat. Keep threading.');}
  if(e.type==='crash'||e.type==='rammed'){this.stage.shake(e.hard?.8:.4);this.stage.flashOnce('#ffffff',e.hard?.22:.1,this.reduced);this.particles.burst(sim.x,.8,sim.z,e.hard?36:16,0xffc861,{speed:7,life:.5,up:2});this.blip(90,.3,'sawtooth',.1);this.haptic(e.hard?[30,20,30]:18);if(e.type==='rammed')this.pop('RAMMED','bad');}
  if(e.type==='spotted'){this.banner({speeding:'CLOCKED SPEEDING · CRUISER ON YOU',hit:'YOU HIT A CRUISER · RUN',wanted:'SPOTTED · '+'★'.repeat(e.stars)+' WANTED'}[e.why]||'CRUISERS ON YOUR TAIL','hot');this.tune();this.haptic([12,40,12]);this.setAutoOff();this.tip('escape','Break their line of sight: corners, alleys (too narrow for cruisers), the tunnel, or a pink spray shop.');}
  if(e.type==='lost'){this.card('escaped',['HEAT SHAKEN','SLIPPED THE NET',`${'★'.repeat(e.stars)} lost in ${e.seconds}s. Roll up to a dealer clean and the night goes easier.`]);this.tune();this.blip(660,.3,'triangle',.06);}
  if(e.type==='roadblock')this.banner('ROADBLOCK AHEAD · FIND A GAP','hot');
  if(e.type==='copcrash'&&e.t-(this.copPop||-9)>2.5){this.copPop=e.t;this.pop('CRUISER WIPED OUT','near');}
  if(e.type==='district'&&sim.parked===null&&!sim.chase)this.banner(DISTRICTS[e.district].name.toUpperCase(),'place');
  if(e.type==='run')this.banner('DELIVERY RUN · '+DISTRICTS[e.to].name.toUpperCase()+' IN '+e.par+'s FOR +$100','go');
  if(e.type==='late')this.pop('EXPRESS BONUS GONE','bad');
  if(e.type==='parked'){this.setAutoOff();this.on('parked',{stop:STOPS[e.stop]});}
  if(e.type==='busted'){this.stage.flashOnce('#4a8bff',.3,this.reduced);this.blip(220,.5,'triangle',.08);this.on('busted',{});}
  if(e.type==='respray'){this.stage.flashOnce('#ff5fc8',.35,this.reduced);this.particles.burst(sim.x,1.2,sim.z,40,0xff5fc8,{speed:5,life:.9,up:2});}}
 // A one-time hint the first time you're close to an advanced move.
 tip(id,text){const key='dawg-hustle-tip-'+id;if(store.get(key,'')==='1')return;store.set(key,'1');const p=document.createElement('span');p.className='hw-pop hw-pop-tip';p.textContent='TIP · '+text;this.$('.hw-pops').append(p);setTimeout(()=>p.remove(),5200);}
 groundY(x,z){const r=rectAt(x,z,0);if(!r)return CURB;if(r.kind==='beach')return .02;if(r.kind==='alley')return CURB;const e=r.edge,a=NODES[e.a],lat=e.horizontal?Math.abs(z-a.z):Math.abs(x-a.x),inJunction=NODES.some(n=>Math.abs(x-n.x)<ROAD_HALF&&Math.abs(z-n.z)<ROAD_HALF);return lat<=ROAD_HALF||inJunction?0:CURB;}
 place(dt,real,snap){const sim=this.sim,low=this.quality!=='high',L=this.look,night=L.lamps>.4;
  for(const p of this.carPools.values()){for(const o of p.items)o.visible=false;p.used=0;}
  // The player's car: nose where the sim says, body rolling into corners and pitching on the pedals.
  const car=this.car,gy=this.groundY(sim.x,sim.z);this.carY=snap?gy:(this.carY||0)+(gy-(this.carY||0))*Math.min(1,dt*14);car.position.set(sim.x,this.carY,sim.z);car.rotation.set(0,Math.PI-sim.h,0);
  const lat=clamp((sim.yaw||0)*(sim.vf||0)/26,-1,1),acc=snap?0:clamp(((sim.vf||0)-(this.prevVf||0))/Math.max(dt,.001)/22,-1,1);this.prevVf=sim.vf||0;this.roll=(this.roll||0)+(lat*.1+clamp(sim.slip/14,-1,1)*.05-(this.roll||0))*Math.min(1,dt*7);this.pitch=(this.pitch||0)+(-acc*.05-(this.pitch||0))*Math.min(1,dt*6);
  if(this.body){this.body.rotation.z=this.roll;this.body.rotation.x=this.pitch;}this.spin=(this.spin||0)+(sim.vf||0)*dt/.33;for(const w of this.wheels){w.o.rotation.x=this.spin;if(w.front)w.o.rotation.y=-sim.steer*.5;}
  // Tyre smoke when the rear lets go, dust on the sand, spray in the rain.
  if(!snap&&!this.phone){const bx=sim.x-Math.sin(sim.h)*1.7,bz=sim.z+Math.cos(sim.h)*1.7;if(sim.drifting&&!this.reduced)this.particles.burst(bx,.25,bz,low?1:3,L.night>.6?0x8a8aa0:0xd8d8d8,{speed:1.6,life:.7,gravity:1.5,up:.6,spread:5});
   if(sim.surface==='sand'&&sim.speed>6)this.particles.burst(bx,.2,bz,2,0xe8c890,{speed:2.4,life:.5,gravity:-2,up:1.4,spread:5});if(L.rain&&sim.speed>12)this.particles.burst(bx,.2,bz,1,0x9fc4ff,{speed:2,life:.35,gravity:-4,up:1.6,spread:4});}
  let n=0;const light=(x,y,z,r,g,b)=>{if(n>=this.lightN)return;this.lightPos.set([x,y,z],n*3);this.lightCol.set([r,g,b],n*3);n++;};
  const lamps=(x,z,h,bright=1)=>{const fx=Math.sin(h),fz=-Math.cos(h),rx=Math.cos(h),rz=Math.sin(h);for(const side of [-.68,.68]){light(x-fx*2.15+rx*side,.82,z-fz*2.15+rz*side,2.1*bright,.14*bright,.1*bright);if(night)light(x+fx*2.15+rx*side,.72,z+fz*2.15+rz*side,2.1,1.9,1.5);}};
  const braking=!!this.lastInput?.brake||sim.parking!==null,rev=(sim.vf||0)<-.5;lamps(sim.x,sim.z,sim.h,braking?2.2:night?1:.55);if(rev)for(const side of [-.4,.4])light(sim.x-Math.sin(sim.h)*2.2+Math.cos(sim.h)*side,.8,sim.z+Math.cos(sim.h)*2.2+Math.sin(sim.h)*side,1.6,1.6,1.6);
  const pools=this.carPools,take=(key,t)=>{let p=pools.get(key);if(!p){p={items:[],used:0};pools.set(key,p);}if(p.used>=p.items.length){const o=t.clone(true);this.scene.add(o);p.items.push(o);}const o=p.items[p.used++];o.visible=true;return o;};
  const reach=low?150:260;
  for(const c of sim.cars){const d=Math.hypot(c.x-sim.x,c.z-sim.z);if(d>reach)continue;const k=c.kind%this.templates.length,o=take('car'+k,this.templates[k]);o.position.set(c.x,0,c.z);o.rotation.set(0,Math.PI-c.h,0);if(d<170)lamps(c.x,c.z,c.h,c.v<2?1.7:night?1:.5);}
  const flash=Math.floor(real*7)%2,bar=(c,hot)=>{const rx=Math.cos(c.h)*.42,rz=Math.sin(c.h)*.42;light(c.x-rx,1.72,c.z-rz,hot&&flash?3.4:.25,.1,.1);light(c.x+rx,1.72,c.z+rz,.1,.25,hot&&!flash?3.6:.25);};
  for(const c of sim.cops){if(c.mode==='off')continue;const o=take('cop',this.copTemplate);o.position.set(c.x,0,c.z);o.rotation.set(0,Math.PI-c.h,0);bar(c,c.mode==='chase'||sim.busted);lamps(c.x,c.z,c.h,night?1:.5);}
  for(const b of sim.blocks)for(const q of b.cars){const o=take('cop',this.copTemplate);o.position.set(q.x,0,q.z);o.rotation.set(0,Math.PI-q.h,0);bar(q,true);}
  // Whoever you're dealing with pulls up beside you: a rival's ride, or a cruiser on your bumper.
  if(this.info.pending&&(this.phone||sim.busted)){const cop=this.info.pending==='stop',ki=2%this.templates.length,o=take(cop?'cop':'car'+ki,cop?this.copTemplate:this.templates[ki]),back=cop?-6.4:.6,side=cop?0:-3.1,x=sim.x+Math.sin(sim.h)*back+Math.cos(sim.h)*side,z=sim.z-Math.cos(sim.h)*back+Math.sin(sim.h)*side;o.position.set(x,0,z);o.rotation.set(0,Math.PI-sim.h,0);if(cop)bar({x,z,h:sim.h},true);}
  for(const q of sim.pickups){if(q.taken||Math.hypot(q.x-sim.x,q.z-sim.z)>reach)continue;const o=take('cash',this.cashTemplate);o.position.set(q.x,1.5+Math.sin(real*3+q.x)*.25,q.z);}
  for(let i=n;i<this.lightN;i++)this.lightCol[i*3]=this.lightCol[i*3+1]=this.lightCol[i*3+2]=0;this.lights.geometry.attributes.position.needsUpdate=true;this.lights.geometry.attributes.color.needsUpdate=true;
  // Stop markers pulse; the GPS target gets a taller, brighter beam. They dim while you're wanted.
  for(const m of this.markers){const q=m.stop,target=sim.gps===q.id,home=q.kind==='market'&&q.district===this.info.district,can=!sim.chase||q.kind==='garage';m.g.visible=sim.parked!==q.id;m.ring.scale.setScalar(1+Math.sin(real*3+q.id)*.04);m.ring.material.opacity=can?.85:.2;m.beam.scale.set(target?1.6:1,target?2.2:1,target?1.6:1);m.beam.position.y=target?28:13;m.beam.material.opacity=can?(target?.5:home?.14:.26):.06;m.icon.position.y=6.4+Math.sin(real*2+q.id)*.3;m.icon.material.opacity=can?1:.35;}
  // Pedestrians stroll; they step back against the wall when a car mounts the curb.
  const walkers=this.walkers,dummy=this.dummy;for(let i=0;i<walkers.length;i++){const w=walkers[i],a=NODES[w.e.a],hz=w.e.horizontal;w.u+=w.v*dt;if(w.u>140-NODE_R||w.u<NODE_R){w.v=-w.v;w.u=clamp(w.u,NODE_R,140-NODE_R);}
   const off=w.side*(8.9+w.dodge*1.2),x=hz?a.x+w.u:a.x+off,z=hz?a.z+off:a.z+w.u,d=Math.hypot(x-sim.x,z-sim.z);if(d>170&&!snap)continue;w.dodge+=((d<7&&sim.speed>3?1:0)-w.dodge)*Math.min(1,dt*8);
   dummy.position.set(x,CURB+Math.abs(Math.sin(real*7*Math.abs(w.v)+w.phase))*.06+w.dodge*.25,z);dummy.rotation.set(0,hz?(w.v>0?Math.PI/2:-Math.PI/2):(w.v>0?0:Math.PI),0);dummy.updateMatrix();this.peds.setMatrixAt(i,dummy.matrix);}this.peds.instanceMatrix.needsUpdate=true;
  if(L.rain&&!this.reduced)for(let i=0;i<(low?3:7);i++)this.particles.burst(sim.x+(Math.random()-.5)*36+Math.sin(sim.h)*12,15,sim.z+(Math.random()-.5)*36-Math.cos(sim.h)*12,1,0x9fc4ff,{speed:.2,life:.6,gravity:-30,up:0,spread:.1});
  this.wheel.rotation.x=real*.08;this.route(real);this.cameraFrame(dt,real,snap);}
 // GPS chevrons on the tarmac from the car to the target stop.
 route(real){const sim=this.sim;if(sim.gps===null||this.phone){this.arrows.count=0;return;}if(real-(this.routeAt||0)<.4)return;this.routeAt=real;const pts=routeTo(sim.x,sim.z,STOPS[sim.gps]);this.routePts=pts;let k=0;const d=this.dummy;
  for(let i=1;i<pts.length&&k<40;i++){const a=pts[i-1],b=pts[i],len=Math.hypot(b.x-a.x,b.z-a.z),ux=(b.x-a.x)/(len||1),uz=(b.z-a.z)/(len||1);for(let u=i===1?9:6;u<len-4&&k<40;u+=9){d.position.set(a.x+ux*u,.05+this.groundY(a.x+ux*u,a.z+uz*u),a.z+uz*u);d.rotation.set(0,Math.atan2(-ux,-uz),0);d.updateMatrix();this.arrows.setMatrixAt(k++,d.matrix);}}
  this.arrows.count=k;this.arrows.instanceMatrix.needsUpdate=true;}
 cameraFrame(dt,real,snap){const sim=this.sim,cam=this.camera,v=sim.speed,now=performance.now(),portrait=cam.aspect<.9;
  // Chase: behind where the car is going rather than where it points, so slides show off the car's flank.
  const moving=v>4&&(sim.vf||0)>0?Math.atan2(sim.vx,-sim.vz):sim.h,want=sim.h+wrap(moving-sim.h)*.45;this.camH=snap?want:this.camH+wrap(want-this.camH)*Math.min(1,dt*(4.2+v*.06));
  const fx=Math.sin(this.camH),fz=-Math.cos(this.camH),back=(portrait?7.6:6.4)+v*.075,pos=new T.Vector3(sim.x-fx*back,0,sim.z-fz*back),turn=clamp((sim.yaw||0)*.9,-1.2,1.2),ahead=7+v*.28;
  const at=new T.Vector3(sim.x+fx*ahead+Math.cos(this.camH)*turn*3.2,1.2,sim.z+fz*ahead+Math.sin(this.camH)*turn*3.2);
  const [cx,cz]=clampPoint(pos.x,pos.z,.9);pos.x=cx;pos.z=cz;pos.y=(portrait?3.1:2.5)+v*.014+(this.carY||0);if(sim.surface==='tunnel')pos.y=Math.min(pos.y,3.4);
  let fov=(portrait?64:58)+(this.reduced?0:v*.42+(sim.drifting?4:0)),offX=0,offY=0;
  if(this.phone||sim.busted||sim.parked!==null){ // parked: a slow three-quarter orbit of the car, framed clear of the phone
   const a=sim.h-.85+Math.sin(real*.12)*.3,r=portrait?9.5:8.2,p=clampPoint(sim.x+Math.sin(a)*r,sim.z-Math.cos(a)*r,1.2);pos.set(p[0],2.1+(this.carY||0),p[1]);at.set(sim.x,.9,sim.z);fov=portrait?56:46;if(this.phone){offX=portrait?0:.2;offY=portrait?.27:0;}}
  const intro=this.introAt?Math.min(1,(now-this.introAt)/(this.reduced?1:2600)):1;if(intro<1){ // establishing shot: down out of the sky from the ocean side
   const e=1-Math.pow(1-intro,3),hi=new T.Vector3(sim.x-80,70,sim.z+60);pos.lerpVectors(hi,pos,e);at.lerp(new T.Vector3(sim.x,2,sim.z),1-e);snap=true;}
  const f=snap?1:Math.min(1,dt*(this.phone?2.6:7));this.camPos.lerp(pos,f);this.camAt.lerp(at,snap?1:Math.min(1,dt*9));cam.position.copy(this.camPos);this.stage.applyShake(real,this.reduced);cam.lookAt(this.camAt);
  this.fov=snap?fov:(this.fov||fov)+(fov-(this.fov||fov))*Math.min(1,dt*5);cam.fov=fitFov(this.fov,cam.aspect,portrait?58:72);
  this.offX=(this.offX||0)+(offX-(this.offX||0))*Math.min(1,dt*4);this.offY=(this.offY||0)+(offY-(this.offY||0))*Math.min(1,dt*4);const w=this.stage.w||1,h=this.stage.h||1;if(Math.abs(this.offX)>.002||Math.abs(this.offY)>.002)cam.setViewOffset(w,h,this.offX*w,this.offY*h,w,h);else cam.clearViewOffset();cam.updateProjectionMatrix();
  this.sky.position.copy(cam.position);this.stars.position.copy(cam.position);this.skyline.position.set(cam.position.x,this.skyline.position.y,cam.position.z);this.sun.position.copy(cam.position).addScaledVector(this.sunDir,900);
  const sx=this.sunDir.x,sz=this.sunDir.z,gx=-640;this.glitter.position.set(gx,-.55,sim.z+(sx<-.05?sz/sx*(gx-sim.x):0));this.glitter.rotation.y=Math.atan2(-sz,sx);
  this.key.position.set(sim.x+this.sunDir.x*90,Math.max(40,this.sunDir.y*140),sim.z+this.sunDir.z*90);this.key.target.position.set(sim.x,0,sim.z);this.stage.followSun(this.key,sim.x,0,sim.z);}
 // ── HUD ────────────────────────────────────────────────────────────────────────────────────
 set(sel,v,how='text'){const key=sel+'|'+how;if(this.cache[key]===v)return;this.cache[key]=v;const el=this.$(sel);if(!el)return;if(how==='html')el.innerHTML=v;else if(how==='width')el.style.width=v;else if(how==='hidden')el.hidden=v;else el.textContent=v;}
 hud(now){if(now-(this.hudAt||0)<66)return;this.hudAt=now;const sim=this.sim,i=this.info,ch=sim.chase,shown=ch?ch.stars:sim.stars;
  this.set('.hw-stars','<b>'+'★'.repeat(shown)+'</b><i>'+'★'.repeat(5-shown)+'</i>','html');const w=this.$('.hw-wanted');w.classList.toggle('hot',!!ch);w.classList.toggle('hidden',!!ch&&!ch.seen);w.classList.toggle('calm',!ch&&sim.calm>0);
  this.set('.hw-status',sim.busted?'BUSTED':ch?(ch.bust>.25?'BOXED IN · MOVE!':ch.seen?'CRUISERS ON YOU · BREAK THEIR LINE OF SIGHT':'OUT OF SIGHT · STAY HIDDEN'):sim.calm>0?'LYING LOW':shown?'WANTED · PATROLS ARE LOOKING':'NO HEAT');
  this.set('.hw-bust b',Math.round(ch?Math.min(1,ch.bust/2.4)*100:0)+'%','width');this.set('.hw-evade b',Math.round(ch?Math.min(1,ch.evade/evadeTime(ch.stars))*100:0)+'%','width');
  const d=sim.district,r=rectAt(sim.x,sim.z,0);this.set('.hw-district',DISTRICTS[d].name.toUpperCase());this.set('.hw-night','NIGHT '+String(i.day).padStart(2,'0')+' · '+(WEATHER[i.weather]||'').toUpperCase());this.set('.hw-street',r?.edge?r.edge.name:r?.kind==='beach'?'The Beach':r?.kind==='alley'?'Back alley':'');
  this.set('.hw-speed',String(Math.round(sim.speed*MPH)));this.set('.hw-cash',money(i.cash));this.set('.hw-bag','BAG '+i.used+'/'+i.capacity);this.set('.hw-road',sim.trip.cash?'+'+money(sim.trip.cash)+' ROAD'+(sim.trip.cash>=DRIVE_CASH_CAP?' · MAX':''):'');
  const run=sim.run;this.set('.hw-run',!run,'hidden');if(run){const left=Math.max(0,Math.ceil(run.par-run.t));this.set('.hw-run-time',run.late?'LATE':Math.floor(left/60)+':'+String(left%60).padStart(2,'0'));this.set('.hw-run-to','→ '+DISTRICTS[run.to].name.toUpperCase()+(run.late?'':' · +$100 EXPRESS'));this.$('.hw-run').classList.toggle('late',run.late);}
  // What to do right here.
  const stop=sim.stopHere();let prompt='';if(!this.phone&&!sim.busted){if(sim.parked!==null)prompt=this.root.classList.contains('hw-touching')?'HOLD LEFT TO DRIVE · TAP PHONE TO DEAL':'W A S D TO DRIVE · SPACE HANDBRAKE · E PHONE · M MAP';
   else if(stop&&sim.leaving!==stop.id){prompt=ch?(stop.kind==='garage'?(ch.seen?'THEY CAN SEE YOU · NO RESPRAY':'SLOW DOWN TO DUCK INTO THE SPRAY SHOP'):'DEALERS WON’T TALK WITH CRUISERS ON YOU'):sim.speed>=13.5?'SLOW DOWN TO PULL UP':'PULLING UP…';}
   else if(!ch&&sim.speed<1&&now-(this.introAt||0)>4000&&!this.keys.size&&!this.touch.gas&&!this.auto)prompt=this.root.classList.contains('hw-touching')?'HOLD LEFT TO DRIVE · TAP PHONE FOR THE MAP':'W A S D TO DRIVE · SPACE HANDBRAKE · E PHONE · M MAP';}
  this.set('.hw-prompt',!prompt,'hidden');this.set('.hw-prompt',prompt);if(now-(this.mapAt||0)>80){this.mapAt=now;this.minimap(now);}}
 minimap(now){const c=this.$('.hw-map'),x=c.getContext('2d'),w=c.width,sim=this.sim,scale=.3,cx=w/2,cy=w*.6;x.clearRect(0,0,w,w);x.save();x.beginPath();x.arc(w/2,w/2,w/2-2,0,7);x.clip();x.fillStyle='#0b0f1ee6';x.fillRect(0,0,w,w);
  x.translate(cx,cy);x.rotate(-sim.h);x.scale(scale,scale);x.translate(-sim.x,-sim.z);
  x.fillStyle='#17506e';x.fillRect(-900,-900,900+BEACH.x0-30,1800);x.fillStyle='#8a7550';x.fillRect(BEACH.x0-30,-900,BEACH.x1-BEACH.x0+30,1800);
  x.lineCap='round';x.strokeStyle='#ffffff38';x.lineWidth=13;x.beginPath();for(const e of EDGES){const a=NODES[e.a],b=NODES[e.b];x.moveTo(a.x,a.z);x.lineTo(b.x,b.z);}x.stroke();
  x.strokeStyle='#ffffff22';x.lineWidth=5;x.beginPath();for(const a of ALLEYS){x.moveTo(a.x0,a.z0);x.lineTo(a.x1,a.z1);}x.stroke();
  x.strokeStyle='#6dff9a88';x.lineWidth=13;x.beginPath();x.moveTo(XS[1],ZS[4]);x.lineTo(XS[2],ZS[4]);x.stroke();
  if(sim.gps!==null&&this.routePts){x.strokeStyle='#ffd34a';x.lineWidth=7;x.lineJoin='round';x.beginPath();this.routePts.forEach((p,i)=>i?x.lineTo(p.x,p.z):x.moveTo(sim.x,sim.z));x.stroke();}
  const dot=(px,pz,col,r)=>{x.fillStyle=col;x.beginPath();x.arc(px,pz,r/scale,0,7);x.fill();};
  for(const q of sim.pickups)if(!q.taken)dot(q.x,q.z,'#7dff8a',1.8);
  for(const q of STOPS){const col=q.kind==='market'?DISTRICT_COLORS[q.district]:'#ff5fc8';dot(q.x,q.z,'#0b0f1e',6.5);dot(q.x,q.z,col,q.id===sim.gps?6:4.6);}
  const flash=Math.floor(now/200)%2;for(const k of sim.cops)if(k.mode==='chase')dot(k.x,k.z,flash?'#ff4060':'#4a8bff',4);else if(k.mode==='patrol'&&Math.hypot(k.x-sim.x,k.z-sim.z)<150)dot(k.x,k.z,'#4a8bff',3);for(const b of sim.blocks)dot(b.x,b.z,'#ff4060',5);
  x.restore();
  // Stops beyond the edge of the map sit on its rim so you always know which way.
  for(const q of STOPS){const dx=q.x-sim.x,dz=q.z-sim.z,c2=Math.cos(-sim.h),s2=Math.sin(-sim.h),px=cx+(dx*c2-dz*s2)*scale,py=cy+(dx*s2+dz*c2)*scale,rr=Math.hypot(px-w/2,py-w/2),lim=w/2-9;if(rr<=lim)continue;if(q.kind!=='market'&&q.id!==sim.gps)continue;const k=lim/rr;x.fillStyle=q.id===sim.gps?'#ffd34a':q.kind==='market'?DISTRICT_COLORS[q.district]:'#ff5fc8';x.beginPath();x.arc(w/2+(px-w/2)*k,w/2+(py-w/2)*k,q.id===sim.gps?6:4,0,7);x.fill();}
  x.fillStyle='#fff';x.beginPath();x.moveTo(cx,cy-9);x.lineTo(cx+6.5,cy+7);x.lineTo(cx,cy+3.5);x.lineTo(cx-6.5,cy+7);x.closePath();x.fill();x.strokeStyle=sim.chase?(flash?'#ff4060':'#4a8bff'):'#ffffff55';x.lineWidth=3;x.beginPath();x.arc(w/2,w/2,w/2-2,0,7);x.stroke();}
 pop(text,kind){const p=document.createElement('span');p.className='hw-pop hw-pop-'+kind;p.textContent=text;const box=this.$('.hw-pops');box.append(p);setTimeout(()=>p.remove(),kind==='feat'?2600:1300);while(box.children.length>4)box.firstChild.remove();}
 banner(text,tone=''){const b=this.$('.hw-banner');b.textContent=text;b.dataset.tone=tone;b.hidden=false;b.classList.remove('hw-show');void b.offsetWidth;b.classList.add('hw-show');clearTimeout(this.bannerTimer);this.bannerTimer=setTimeout(()=>{b.hidden=true;},2400);}
 // A title card: arrivals, payouts, escapes. rows are [label, value] pairs.
 card(tone,[kicker,title,text],rows=[],ms=4200){const el=this.$('.hw-card');el.dataset.tone=tone;this.$('.hw-card-kicker').textContent=kicker;this.$('.hw-card-title').textContent=title;this.$('.hw-card-text').textContent=text||'';this.$('.hw-card-rows').innerHTML=rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');el.hidden=false;el.classList.remove('hw-show');void el.offsetWidth;el.classList.add('hw-show');clearTimeout(this.cardTimer);this.cardTimer=setTimeout(()=>{el.hidden=true;},ms);}
 dispose(){if(this.dead)return;this.dead=true;cancelAnimationFrame(this.raf);window.removeEventListener('keydown',this.onKey);window.removeEventListener('keyup',this.onKey);window.removeEventListener('blur',this.onBlur);music.setPlaying(false);try{this.audio?.close();}catch{}clearTimeout(this.bannerTimer);clearTimeout(this.cardTimer);try{this.stage?.dispose();}catch{}this.root?.remove();if(globalThis.hustleWorld===this)delete globalThis.hustleWorld;}
}
