// The arcade soundtrack: synthesized electro house in the spirit of big stadium-car-game anthems.
// Every game has its own track (key, tempo, progression, hook); each one cycles intro → build →
// drop → breakdown → build → drop, with supersaw chords pumping against the kick, a growling
// drop bass, snare-roll builds with risers, and impacts on every drop. After Hours gets a chill
// lounge-house groove instead. No audio files: everything is scheduled on the Web Audio clock.
const hz=n=>440*Math.pow(2,(n-69)/12);
// Chords as semitones from the track's root: i, VI, III, VII and friends (minor-key anthems).
const C={i:[0,3,7],iv:[5,8,12],v:[7,10,14],VI:[-4,0,3],III:[3,7,10],VII:[-2,2,5],i7:[0,3,7,10],iv7:[5,8,12,15],VI7:[-4,0,3,7],v7:[7,10,14,17]};
// Hooks: 16 sixteenth-note steps of scale offsets (semitones above the root, an octave up), null = rest.
const _=null;
export const TRACKS={
 runner:{title:'Night Shift',bpm:128,root:45,prog:['i','VI','III','VII'],hook:[12,_,15,_,19,_,15,12,_,12,10,_,7,_,10,_],arp:[0,12,7,12]},
 turbo:{title:'Turbo Pup',bpm:140,root:47,prog:['i','VII','VI','VII'],hook:[19,_,19,17,_,15,_,12,15,_,15,_,17,_,19,22],arp:[0,7,12,15]},
 kart:{title:'Drift Season',bpm:132,root:50,prog:['VI','VII','i','i'],hook:[12,_,12,15,_,12,10,_,7,_,10,12,_,15,_,17],arp:[0,12,15,12]},
 pinball:{title:'Multiball',bpm:124,root:48,prog:['i','iv','VI','v'],hook:[7,12,_,15,_,12,_,7,8,_,12,_,15,_,14,_],arp:[0,7,12,7]},
 snake:{title:'Light Trail',bpm:126,root:44,prog:['i','III','VII','VI'],hook:[15,_,_,12,_,_,10,_,12,_,_,15,_,17,_,_],arp:[0,3,7,12]},
 flappy:{title:'Updraft',bpm:120,root:52,prog:['VI','III','VII','i'],hook:[12,_,14,15,_,_,19,_,17,_,15,_,14,_,12,_],arp:[0,12,7,15]},
 cross:{title:'Crosswalk Anthem',bpm:118,root:46,prog:['i','VI','VII','i'],hook:[7,_,10,_,12,_,_,15,_,12,_,10,_,7,_,_],arp:[0,7,10,12]},
 classic:{title:'Munch Time',bpm:128,root:49,prog:['i','VII','VI','v'],hook:[12,_,12,_,15,_,12,_,10,_,10,_,12,_,7,_],arp:[0,12,7,12]},
 rush:{title:'Rush Hour',bpm:136,root:49,prog:['i','VII','VI','v'],hook:[12,15,_,12,15,_,17,_,19,_,17,15,_,12,_,_],arp:[0,7,12,15]},
 daily:{title:'Daily Grind',bpm:128,root:51,prog:['i','VI','III','VII'],hook:[15,_,12,_,10,_,12,_,15,_,17,_,19,_,_,_],arp:[0,12,7,12]},
 story:{title:'After Hours Lounge',bpm:98,root:50,prog:['i7','iv7','VI7','v7'],lounge:true},
 climb:{title:'Vertigo',bpm:134,root:46,prog:['i','VI','iv','V'],hook:[12,_,15,_,17,_,19,_,22,_,19,_,17,15,_,12],arp:[0,7,12,19]},
 chess:{title:'Grandmaster Groove',bpm:88,root:45,prog:['i7','VI7','iv7','v7'],lounge:true},
 // Street Hustle's car radio: a sunset-synth cruiser and a late-night house station.
 hustle:{title:'Palm Static',bpm:112,root:48,prog:['i','VI','III','VII'],hook:[12,_,_,15,_,_,17,_,15,_,12,_,10,_,12,_],arp:[0,12,7,15]},
 cruise:{title:'Kennel Club',bpm:118,root:46,prog:['i7','VI7','III','v7'],lounge:true}
};
const FORM=[['intro',8],['build',8],['drop',16],['break',8],['build',8],['drop',16]];
const FORM_LOOP=3; // after the first pass, the form loops from the breakdown

export class ArcadeMusic {
 constructor(){this.ctx=null;this.playing=false;this.track=TRACKS.runner;this.trackId='runner';this.volume=.8;this.intensity=0;this.timer=0;
  this.onVisibility=()=>{if(!this.ctx)return;if(document.hidden)this.ctx.suspend().catch(()=>{});else if(this.playing)this.ctx.resume().catch(()=>{});};globalThis.document?.addEventListener?.('visibilitychange',this.onVisibility);}
 ensure(){if(this.ctx)return this.ctx;const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return null;const c=this.ctx=new AC();
  this.out=c.createGain();this.out.gain.value=0;const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=5;comp.attack.value=.004;comp.release.value=.2;this.out.connect(comp);comp.connect(c.destination);
  this.master=c.createGain();this.master.gain.value=.5*this.volume;this.master.connect(this.out);
  // Everything but the kick runs through the duck, which the kick pulls down: the classic pump.
  this.duck=c.createGain();this.duck.connect(this.master);
  this.synthFilter=c.createBiquadFilter();this.synthFilter.type='lowpass';this.synthFilter.frequency.value=1200;this.synthFilter.Q.value=.8;this.synthFilter.connect(this.duck);
  this.bassFilter=c.createBiquadFilter();this.bassFilter.type='lowpass';this.bassFilter.frequency.value=400;this.bassFilter.Q.value=7;this.bassFilter.connect(this.duck);
  const delay=c.createDelay(1.5),fb=c.createGain(),wet=c.createGain(),damp=c.createBiquadFilter();damp.type='lowpass';damp.frequency.value=3500;fb.gain.value=.32;wet.gain.value=.25;delay.connect(damp);damp.connect(fb);fb.connect(delay);delay.connect(wet);wet.connect(this.duck);this.echo=delay;
  // A short plate-style reverb from decaying noise.
  const len=Math.floor(c.sampleRate*1.8),ir=c.createBuffer(2,len,c.sampleRate);for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2);}
  this.verb=c.createConvolver();this.verb.buffer=ir;const vwet=c.createGain();vwet.gain.value=.22;this.verb.connect(vwet);vwet.connect(this.duck);
  const nlen=c.sampleRate,nb=c.createBuffer(1,nlen,c.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nlen;i++)nd[i]=Math.random()*2-1;this.noiseBuf=nb;
  return c;}
 setVolume(v){this.volume=v;if(this.master)this.master.gain.value=.5*v;}
 // Switches songs on the next bar; the form restarts from the intro.
 setTrack(id){const t=TRACKS[id]||TRACKS.runner;if(t===this.track)return;this.track=t;this.trackId=id;this.restart=true;}
 setPlaying(on,intensity=0){this.intensity=Math.max(0,Math.min(1,intensity));if(on&&!this.ensure())return;if(on===this.playing)return;this.playing=on;const c=this.ctx;if(!c)return;
  if(on){c.resume().catch(()=>{});this.out.gain.cancelScheduledValues(c.currentTime);this.out.gain.setTargetAtTime(1,c.currentTime,.2);this.next=c.currentTime+.06;this.step=0;this.bar=0;this.restart=false;clearInterval(this.timer);this.timer=setInterval(()=>this.schedule(),25);}
  else{this.out.gain.cancelScheduledValues(c.currentTime);this.out.gain.setTargetAtTime(0,c.currentTime,.15);clearInterval(this.timer);this.timer=0;}}
 get stepLen(){return 60/this.track.bpm/4;}
 // Which section a bar falls in, and how far through it.
 section(bar){if(this.track.lounge)return {name:'groove',at:bar%8,len:8};let b=bar;const first=FORM.reduce((n,[,l])=>n+l,0);
  if(b>=first){const loop=FORM.slice(FORM_LOOP),len=loop.reduce((n,[,l])=>n+l,0);b=(b-first)%len;for(const [name,l] of loop){if(b<l)return {name,at:b,len:l};b-=l;}}
  for(const [name,l] of FORM){if(b<l)return {name,at:b,len:l};b-=l;}return {name:'drop',at:0,len:16};}
 schedule(){const c=this.ctx;while(this.next<c.currentTime+.14){if(this.restart&&this.step%16===0){this.restart=false;this.bar=0;this.step=0;}this.play(this.step%16,this.bar,this.next);this.next+=this.stepLen;this.step++;if(this.step%16===0)this.bar++;}}
 play(i,bar,t){const tr=this.track,s=this.section(bar),S=this.stepLen,chord=C[tr.prog[bar%4]],root=tr.root;
  if(tr.lounge){this.lounge(i,bar,t,chord,root);return;}
  const drop=s.name==='drop',build=s.name==='build',brk=s.name==='break',intro=s.name==='intro',heat=this.intensity;
  // Filter: closed in the intro and breakdown, sweeping open through the build, wide open on the drop.
  if(i===0){const f=drop?7000:build?900+5200*Math.pow((s.at+1)/s.len,2):brk?900:intro?600+1400*(s.at/s.len):1500;this.synthFilter.frequency.setTargetAtTime(f+heat*1500,t,build?.6:.08);}
  // Drums.
  const kickOn=drop||(intro&&s.at>=2)||(build&&s.at<s.len-1);if(kickOn&&i%4===0)this.kick(t);
  if((drop||(build&&s.at<4))&&(i===4||i===12))this.clap(t);
  if((drop||intro||build)&&i%4===2)this.hat(t,.07,true);if(drop&&i%2===1)this.hat(t,.035);if(heat>.6&&drop&&i%4===0)this.hat(t,.03);
  if(build&&s.at>=s.len-4){const left=s.len-s.at,rate=left<=1?1:left<=2?2:4;if(i%rate===0)this.snare(t,.06+.12*(1-left/4));}
  if(build&&s.at===s.len-1&&i===0){this.riser(t,S*16);}
  if(drop&&s.at===0&&i===0)this.impact(t);
  if(brk&&s.at===0&&i===0)this.impact(t,.5);
  // Supersaw chords: held through the bar, ducked by the kick on the drop.
  if(i===0&&!intro){const vel=drop?.05:build?.04:.035;for(const n of chord)this.supersaw(hz(root+24+n),t,S*16,vel);}
  if(intro&&i===0&&s.at>=4)for(const n of chord)this.supersaw(hz(root+24+n),t,S*16,.025);
  // Bass: off-beat pulses in the build and intro, a growl on the drop.
  const bn=root+chord[0]-(chord[0]>6?12:0);
  if(drop){if(i%2===0||i%4===3)this.growl(hz(bn-12),t,S*(i%4===3?1:1.9),i%8===0);}
  else if((build||intro&&s.at>=4)&&i%4===2)this.tone(hz(bn-12),t,S*1.6,'sawtooth',.14,this.bassFilter);
  // Arps in the breakdown and build, the hook on the drop.
  if((brk||build||(intro&&s.at>=4))&&!drop){const a=tr.arp[i%4]+chord[i%3];this.pluck(hz(root+36+a),t,S*.9,brk?.05:.035);}
  if(drop){const h=tr.hook[i];if(h!==null&&h!==undefined){const n=root+24+h+(s.at%8>=4&&bar%2?12:0);this.lead(hz(n),t,S*(tr.hook[(i+1)%16]===null?2:1));}}
  if(brk&&s.at>=4){const h=tr.hook[i];if(h!==null&&h!==undefined&&i%2===0)this.pluck(hz(root+24+h),t,S*2,.06);}
 }
 // After Hours: a lazy four-on-the-floor with soft keys, a walking bass and brushed hats.
 lounge(i,bar,t,chord,root){const S=this.stepLen;if(i===0)this.synthFilter.frequency.setTargetAtTime(2200,t,.2);
  if(i%4===0)this.kick(t,.6);if(i===4||i===12)this.snap(t);if(i%4===2)this.hat(t,.05,true);if(i%2===1&&bar%2)this.hat(t,.02);
  if(i===0||i===6||(i===10&&bar%2))for(const n of chord)this.keys(hz(root+24+n),t,S*(i===0?6:4),.045);
  const walk=[0,7,chord[1],chord[2]],bn=root-12+(chord[0]>6?chord[0]-12:chord[0]);if(i%4===0)this.tone(hz(bn+walk[i/4]),t,S*3.4,'triangle',.22,this.bassFilter);
  if(bar%4===3&&i>=8&&i%2===0)this.keys(hz(root+36+[0,3,7,10,12,10,7,3][i-8]),t,S*1.5,.03,true);}
 // ── Voices ────────────────────────────────────────────────────────────────────────────────
 env(g,t,peak,att,len){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+att);g.gain.exponentialRampToValueAtTime(.0004,t+len);}
 tone(f,t,len,type,gain,out=this.duck,echo=false,slide=0){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f*slide),t+len);this.env(g,t,gain,.006,len);o.connect(g);g.connect(out);if(echo)g.connect(this.echo);o.start(t);o.stop(t+len+.03);return g;}
 noise(t,len,gain,type,freq,out=this.duck,sweep=0,q=1){const c=this.ctx,src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=this.noiseBuf;src.loop=len>1;f.type=type;f.Q.value=q;f.frequency.setValueAtTime(freq,t);if(sweep)f.frequency.exponentialRampToValueAtTime(sweep,t+len);this.env(g,t,gain,.002,len);src.connect(f);f.connect(g);g.connect(out);src.start(t,Math.random()*.4);src.stop(t+len+.03);return g;}
 kick(t,amt=1){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(42,t+.12);g.gain.setValueAtTime(.95*amt,t);g.gain.exponentialRampToValueAtTime(.001,t+.42);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.45);
  this.noise(t,.012,.25*amt,'highpass',3000,this.master);
  // The pump: duck everything else, then swell back before the next beat.
  const d=this.duck.gain,S=this.stepLen;d.cancelScheduledValues(t);d.setValueAtTime(1,t);d.linearRampToValueAtTime(.18,t+.008);d.setTargetAtTime(1,t+.03,S*.9);}
 clap(t){for(let k=0;k<3;k++)this.noise(t+k*.011,k===2?.2:.02,.32,'bandpass',1500,this.duck,0,1.4);this.noise(t,.25,.08,'highpass',6000);const g=this.noise(t,.3,.1,'bandpass',1800);g.connect(this.verb);}
 snare(t,gain=.15){this.noise(t,.12,gain,'bandpass',2200,this.duck,0,.9);this.tone(210,t,.07,'triangle',gain*.6);}
 snap(t){this.noise(t,.08,.12,'bandpass',2600,this.duck,0,2).connect(this.verb);}
 hat(t,gain,open=false){this.noise(t,open?.16:.035,gain,'highpass',open?7500:9500);}
 supersaw(f,t,len,gain){const c=this.ctx,g=c.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.02);g.gain.setValueAtTime(gain,t+len*.85);g.gain.linearRampToValueAtTime(0,t+len);g.connect(this.synthFilter);g.connect(this.verb);
  for(const cents of [-18,-9,0,9,18]){const o=c.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(f,t);o.detune.value=cents;o.connect(g);o.start(t);o.stop(t+len+.02);}}
 growl(f,t,len,accent){const c=this.ctx,g=c.createGain(),flt=c.createBiquadFilter();flt.type='lowpass';flt.Q.value=9;flt.frequency.setValueAtTime(accent?2400:1400,t);flt.frequency.exponentialRampToValueAtTime(180,t+len);
  this.env(g,t,.2,.004,len);g.connect(this.duck);flt.connect(g);for(const [type,det,mul] of [['sawtooth',-12,1],['sawtooth',12,1],['square',0,.5]]){const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(f*mul,t);o.detune.value=det;o.connect(flt);o.start(t);o.stop(t+len+.03);}
  this.tone(f/2,t,len,'sine',.32,this.master);}
 lead(f,t,len){const c=this.ctx,g=c.createGain();this.env(g,t,.075,.01,len*1.4);g.connect(this.synthFilter);g.connect(this.echo);g.connect(this.verb);
  for(const [type,det] of [['sawtooth',-7],['square',7],['sawtooth',1205]]){const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);o.detune.value=det;const vib=c.createOscillator(),vg=c.createGain();vib.frequency.value=5.5;vg.gain.value=6;vib.connect(vg);vg.connect(o.detune);vib.start(t);vib.stop(t+len*1.4+.05);o.connect(g);o.start(t);o.stop(t+len*1.4+.05);}}
 pluck(f,t,len,gain){const g=this.tone(f,t,len,'square',gain,this.synthFilter,true);g.connect(this.verb);this.tone(f*2,t,len*.5,'triangle',gain*.4,this.synthFilter);}
 keys(f,t,len,gain,echo=false){const g=this.tone(f,t,len,'sine',gain,this.synthFilter,echo);g.connect(this.verb);this.tone(f*2,t,len*.4,'triangle',gain*.25,this.synthFilter);}
 riser(t,len){this.noise(t,len,.22,'bandpass',300,this.duck,9000,1.2);this.tone(hz(this.track.root+12),t,len,'sawtooth',.05,this.synthFilter,false,4);}
 impact(t,amt=1){this.noise(t,1.6,.4*amt,'lowpass',8000,this.master,200);this.tone(70,t,1.2,'sine',.7*amt,this.master,false,.4);this.noise(t,2.2,.12*amt,'highpass',5000).connect(this.verb);}
 dispose(){this.setPlaying(false);globalThis.document?.removeEventListener?.('visibilitychange',this.onVisibility);this.ctx?.close().catch(()=>{});this.ctx=null;}
}
// One soundtrack for the whole arcade.
export const music=new ArcadeMusic();
