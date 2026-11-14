// Domino Dynasty's sounds, all synthesized: every knock, roll, boing and punch has its own voice.
// A domino run climbs a scale as it goes, the win is a little fanfare with a chime per star, and a
// near miss gets a sad trombone. Presentation only: it listens to engine events and never touches
// rules. dominoSfx(event, game, volume) is called by the shell while sound is on.
let ctx=null,out=null,noise=null;
const SCALE=[0,2,4,7,9,12,14,16,19,21,24,26,28,31,33,36];
const hz=semi=>523.25*Math.pow(2,semi/12);
function ensure(volume){
 const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return null;
 if(!ctx){ctx=new AC();out=ctx.createGain();const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=5;out.connect(comp);comp.connect(ctx.destination);
  const len=ctx.sampleRate*.4|0,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);let s=12345;for(let i=0;i<len;i++){s=(s*1664525+1013904223)>>>0;d[i]=s/2147483648-1;}noise=buf;}
 if(ctx.state==='suspended')ctx.resume().catch(()=>{});out.gain.value=.5*volume;return ctx;}
// A pitched voice with an attack-decay envelope and an optional glide to a second pitch.
function tone(f,dur,{type='sine',gain=.2,to=0,at=0,attack=.004,vib=0}={}){const t=ctx.currentTime+at,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+dur);
 if(vib){const l=ctx.createOscillator(),lg=ctx.createGain();l.frequency.value=vib;lg.gain.value=f*.04;l.connect(lg);lg.connect(o.frequency);l.start(t);l.stop(t+dur);}
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(out);o.start(t);o.stop(t+dur+.02);}
// A burst of filtered noise: wood clacks, thumps, whooshes.
function burst(f,dur,{gain=.2,q=6,to=0,at=0,type='bandpass'}={}){const t=ctx.currentTime+at,src=ctx.createBufferSource(),flt=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=noise;src.loop=dur>.35;flt.type=type;flt.Q.value=q;flt.frequency.setValueAtTime(f,t);if(to)flt.frequency.exponentialRampToValueAtTime(to,t+dur);
 g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);src.connect(flt);flt.connect(g);g.connect(out);src.start(t);src.stop(t+dur+.02);}
let lastHit=0;
export function dominoSfx(e,game,volume=.8){if(!ensure(volume))return;const now=ctx.currentTime;
 switch(e.type){
  case 'grab':burst(2200,.04,{gain:.12,q:3});break;
  case 'place':burst(900,.05,{gain:.3,q:4});tone(330,.09,{type:'triangle',gain:.16,to:220});break;
  case 'pickup':tone(520,.08,{type:'triangle',gain:.12,to:780});break;
  case 'nope':tone(150,.16,{type:'square',gain:.1,to:110});break;
  case 'go':for(let i=0;i<4;i++)tone(hz(-12+i*4),.08,{type:'square',gain:.07,at:i*.045});burst(600,.25,{gain:.12,q:1,to:2400});break;
  // Each domino in a run is one step higher than the last.
  case 'knock':{const n=SCALE[Math.min(SCALE.length-1,e.n||0)];burst(1500+n*40,.045,{gain:.32,q:5});tone(hz(n-5),.11,{type:'triangle',gain:.13});break;}
  case 'flat':burst(420,.07,{gain:.2,q:2});break;
  case 'tap':burst(2600,.02,{gain:.08,q:8});break;
  case 'hit':if(now-lastHit>.04){lastHit=now;const k=Math.min(1,e.v/8);tone(1400+k*900,.12,{gain:.06+k*.12});tone(2900+k*600,.07,{gain:.04+k*.06});}break;
  case 'thud':if(now-lastHit>.04){lastHit=now;const k=Math.min(1,e.v/12);tone(150-k*40,.14,{gain:.1+k*.22,to:55});burst(300,.06,{gain:.08+k*.15,q:1.5});if(e.bone)tone(1760,.2,{gain:.05});}break;
  case 'spring':tone(180,.42,{type:'sine',gain:.26,to:640,vib:28});tone(360,.3,{type:'triangle',gain:.1,to:1100});break;
  case 'glove':burst(180,.16,{gain:.5,q:1,type:'lowpass'});tone(120,.2,{type:'square',gain:.2,to:50});tone(1975,.5,{gain:.12,at:.03});tone(2637,.4,{gain:.07,at:.03});break;
  case 'switch':burst(3000,.02,{gain:.25,q:6});tone(880,.07,{type:'square',gain:.08,at:.03});tone(1320,.1,{type:'square',gain:.08,at:.1});break;
  case 'door':tone(320,.3,{type:'sawtooth',gain:.1,to:80});burst(250,.2,{gain:.25,q:1.2,at:.12});break;
  case 'clack':burst(800,.06,{gain:.3,q:3});tone(200,.1,{type:'triangle',gain:.14,to:120});break;
  case 'bone':[0,4,7,12].forEach((s,i)=>tone(hz(12+s),.22,{gain:.07,at:i*.05}));break;
  case 'slow':burst(300,1.1,{gain:.1,q:2,to:2600});tone(110,1.1,{type:'sawtooth',gain:.04,to:220});break;
  case 'win':{[0,4,7,12,16].forEach((s,i)=>tone(hz(s),.3,{type:'triangle',gain:.16,at:i*.07}));tone(hz(12),.7,{type:'sawtooth',gain:.07,at:.35});for(let i=0;i<e.stars;i++){tone(hz(19+i*5),.5,{gain:.14,at:.55+i*.28});tone(hz(31+i*5),.3,{gain:.05,at:.55+i*.28});}break;}
  // The sad trombone: four falling notes, the last one sagging with a wobble.
  case 'fail':if(e.near){[[311,.26],[294,.26],[277,.26],[262,.9]].forEach(([f,d],i)=>tone(f,d,{type:'sawtooth',gain:.11,at:i*.28,to:i===3?f*.84:f*.98,vib:i===3?6:0,attack:.03}));}else{tone(196,.35,{type:'sawtooth',gain:.1,to:130,attack:.02});tone(147,.5,{type:'sawtooth',gain:.1,to:98,at:.3,attack:.02});}break;
  case 'feat':[7,12,16,19,24].forEach((s,i)=>tone(hz(s+12),.25,{gain:.08,at:1.4+i*.06}));break;
  case 'skip':tone(392,.15,{type:'triangle',gain:.1,to:262});break;
  case 'unlock':tone(784,.2,{type:'triangle',gain:.08,at:2});tone(1175,.3,{type:'triangle',gain:.08,at:2.12});break;
  case 'dynasty':[0,4,7,12,7,12,16,19,24].forEach((s,i)=>tone(hz(s),.4,{type:'triangle',gain:.14,at:i*.11}));break;
  case 'over':break;}}
