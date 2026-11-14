// Synthesized DAWG Dash soundtrack and effects: no audio files, nothing to download.
// A small look-ahead scheduler plays a 112 BPM synthwave loop while a run is live.
const BPM=112,STEP=60/BPM/4,BASS=[45,45,57,45,43,43,55,43,41,41,53,41,43,43,55,47],ARP=[0,7,12,16,19,16,12,7],CHORDS=[[57,60,64],[55,59,62],[53,57,60],[55,59,62]];
const hz=n=>440*Math.pow(2,(n-69)/12);
export class DashAudio {
 constructor(){this.ctx=null;this.playing=false;this.step=0;this.timer=0;this.intensity=0;
  this.onVisibility=()=>{if(!this.ctx)return;if(document.hidden)this.ctx.suspend().catch(()=>{});else if(this.playing)this.ctx.resume().catch(()=>{});};document.addEventListener('visibilitychange',this.onVisibility);}
 ensure(){
  if(this.ctx)return this.ctx;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;const c=this.ctx=new AC();
  this.master=c.createGain();this.master.gain.value=.55*(this.volume??.8);const comp=c.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=4;this.master.connect(comp);comp.connect(c.destination);
  this.music=c.createGain();this.music.gain.value=0;this.music.connect(this.master);this.fx=c.createGain();this.fx.gain.value=.9;this.fx.connect(this.master);
  // Shared echo gives the synths and effects a neon-alley space.
  const delay=c.createDelay(1);delay.delayTime.value=STEP*3;const feedback=c.createGain();feedback.gain.value=.28;const wet=c.createGain();wet.gain.value=.22;delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(this.master);this.echo=delay;
  this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=900;this.filter.Q.value=4;this.filter.connect(this.music);
  const len=c.sampleRate,buf=c.createBuffer(1,len,c.sampleRate),data=buf.getChannelData(0);for(let i=0;i<len;i++)data[i]=Math.random()*2-1;this.noiseBuf=buf;
  return c;
 }
 // Master volume, 0–1, from the player's settings.
 setVolume(v){if(v===this.volume)return;this.volume=v;if(this.master)this.master.gain.value=.55*v;}
 setPlaying(on,speed=25){
  if(on&&!this.ensure())return;this.intensity=Math.min(1,Math.max(0,(speed-25)/15));
  if(this.ctx&&on)this.filter.frequency.setTargetAtTime(700+this.intensity*2600,this.ctx.currentTime,.4);
  if(on===this.playing)return;this.playing=on;const c=this.ctx;if(!c)return;
  if(on){c.resume().catch(()=>{});this.music.gain.cancelScheduledValues(c.currentTime);this.music.gain.setTargetAtTime(.5,c.currentTime,.25);this.next=c.currentTime+.05;clearInterval(this.timer);this.timer=setInterval(()=>this.schedule(),25);}
  else{this.music.gain.cancelScheduledValues(c.currentTime);this.music.gain.setTargetAtTime(0,c.currentTime,.12);clearInterval(this.timer);this.timer=0;}
 }
 schedule(){const c=this.ctx;while(this.next<c.currentTime+.12){this.beat(this.step,this.next);this.next+=STEP;this.step=(this.step+1)%64;}}
 beat(s,t){
  const bar=Math.floor(s/16)%4,i=s%16;
  if(i%4===0)this.kick(t);if(i===4||i===12)this.snare(t);if(i%2===1||this.intensity>.5)this.hat(t,i%4===2?.05:.03);
  this.tone(hz(BASS[i]-12+(bar===2?-2:0)),t,STEP*.9,'sawtooth',.16,this.filter);
  if(this.intensity>.15||bar%2===1)this.tone(hz(CHORDS[bar][0]+12+ARP[i%8]),t,STEP*.6,'square',.035,this.filter,true);
  if(i===0)for(const n of CHORDS[bar])this.tone(hz(n),t,STEP*15,'sawtooth',.025,this.filter);
 }
 tone(f,t,len,type,gain,out=this.fx,echo=false,slide=0){
  const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f*slide),t+len);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.0005,t+len);o.connect(g);g.connect(out);if(echo)g.connect(this.echo);o.start(t);o.stop(t+len+.02);
 }
 noise(t,len,gain,type='highpass',freq=6000,out=this.fx,sweep=0){
  const c=this.ctx,src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();src.buffer=this.noiseBuf;f.type=type;f.frequency.setValueAtTime(freq,t);if(sweep)f.frequency.exponentialRampToValueAtTime(sweep,t+len);
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0005,t+len);src.connect(f);f.connect(g);g.connect(out);src.start(t,Math.random()*.5);src.stop(t+len+.02);
 }
 kick(t){this.tone(150,t,.32,'sine',.55,this.music,false,.28);}
 snare(t){this.noise(t,.18,.22,'bandpass',1800,this.music);this.tone(190,t,.1,'triangle',.12,this.music);}
 hat(t,gain){this.noise(t,.04,gain,'highpass',8000,this.music);}
 // Turbo Pup's own effects (types arrive as 'turbo:<event>').
 turboSfx(type,t){
  const up=(base,steps,gap=.04,wave='square',g=.055)=>steps.forEach((n,i)=>this.tone(hz(base+n),t+i*gap,.18,wave,g,this.fx,true));
  if(type==='coin'){this.coinStep=t-(this.coinAt||0)<.35?Math.min(12,(this.coinStep||0)+1):0;this.coinAt=t;this.tone(hz(84+this.coinStep),t,.07,'square',.045,this.fx,true);}
  else if(type==='jump'||type==='spring'){this.tone(type==='spring'?220:320,t,.22,'square',.055,this.fx,false,2.6);}
  else if(type==='flipstart'){this.noise(t,.3,.07,'bandpass',700,this.fx,3600);}
  else if(['flip','ring','limbo','near','overtake','wall','grind','clean'].includes(type))up(type==='ring'?81:76,type==='flip'?[0,5,12]:[0,7],.045,'triangle',.06);
  else if(type==='perfect'||type==='loop'||type==='twist')up(72,[0,4,7,12,16,19],.04,'sawtooth',.05);
  else if(type==='checkpoint'){up(67,[0,4,7,12,7,12,16],.07,'square',.06);this.noise(t,.6,.07,'bandpass',500,this.fx,6000);}
  else if(type==='pad'||type==='air'){this.noise(t,.45,.12,'bandpass',500,this.fx,7000);this.tone(180,t,.35,'sawtooth',.05,this.fx,false,3);}
  else if(type==='boost'){this.noise(t,.8,.2,'bandpass',300,this.fx,8000);this.tone(110,t,.7,'sawtooth',.09,this.fx,false,4);}
  else if(type==='empty'){this.tone(140,t,.12,'square',.04,this.fx,false,.6);}
  else if(type==='roll'||type==='stomp'||type==='grindstart'){this.noise(t,.3,.1,'bandpass',type==='grindstart'?5000:2400,this.fx,type==='grindstart'?2500:500);}
  else if(type==='lane'){this.noise(t,.08,.035,'bandpass',2200,this.fx,5200);}
  else if(type==='smash'||type==='slam'){this.noise(t,.3,.3,'lowpass',2600,this.fx,200);this.tone(100,t,.25,'sine',.4,this.fx,false,.4);up(88,[0,7],.03,'triangle',.05);}
  else if(type==='land'){this.tone(110,t,.1,'sine',.18,this.fx,false,.5);}
  else if(type==='hurt'||type==='stumble'||type==='fall'){this.noise(t,.4,.35,'lowpass',3000,this.fx,180);this.tone(type==='stumble'?160:90,t,.4,'sawtooth',.2,this.fx,false,.4);}
  else if(type==='combobreak'){this.tone(330,t,.3,'triangle',.06,this.fx,false,.5);}
  else if(type==='heat'||type==='over')this.sfx(type);
 }
 sfx(type){
  if(!this.ensure())return;const c=this.ctx,t=c.currentTime+.005;if(c.state==='suspended')c.resume().catch(()=>{});if(type.startsWith('turbo:')){this.turboSfx(type.slice(6),t);return;}
  if(type==='coin'){this.tone(1318,t,.09,'square',.07,this.fx,true);this.tone(1976,t+.06,.16,'square',.07,this.fx,true);}
  else if(type==='power'){[0,4,7,12,16].forEach((n,i)=>this.tone(hz(72+n),t+i*.045,.2,'sawtooth',.06,this.fx,true));this.noise(t,.5,.08,'bandpass',800,this.fx,6000);}
  else if(type==='shield'){this.noise(t,.35,.35,'lowpass',3000,this.fx,200);this.tone(90,t,.4,'sine',.5,this.fx,false,.4);[0,5,9].forEach((n,i)=>this.tone(hz(96+n),t+.05+i*.03,.3,'triangle',.05,this.fx,true));}
  else if(type==='jump'){this.tone(300,t,.22,'square',.06,this.fx,false,2.6);this.noise(t,.18,.05,'bandpass',1200,this.fx,4000);}
  else if(type==='slide'){this.noise(t,.4,.12,'bandpass',3000,this.fx,500);}
  else if(type==='dodge'){this.tone(880,t,.07,'triangle',.05,this.fx,true);}
  else if(type==='near'){this.noise(t,.22,.22,'bandpass',900,this.fx,7000);this.tone(1480,t+.04,.14,'triangle',.07,this.fx,true);}
  else if(type==='prize'){[0,4,7,12,19].forEach((n,i)=>this.tone(hz(79+n),t+i*.04,.22,'square',.06,this.fx,true));}
  else if(type==='flowbreak'){this.tone(330,t,.3,'triangle',.07,this.fx,false,.5);}
  else if(type==='turn'){this.noise(t,.09,.035,'bandpass',2200,this.fx,5200);}
  else if(type==='land'){this.tone(110,t,.12,'sine',.25,this.fx,false,.5);}
  else if(type==='over'){this.noise(t,.7,.5,'lowpass',2500,this.fx,120);this.tone(120,t,.8,'sine',.7,this.fx,false,.25);this.tone(hz(45),t,.6,'sawtooth',.12,this.fx,false,.5);}
  else if(type==='heat'){[0,3,7,10,12].forEach((n,i)=>this.tone(hz(64+n),t+i*.05,.22,'square',.06,this.fx,true));this.noise(t,.6,.1,'bandpass',500,this.fx,5000);}
  else if(type==='count'){this.tone(660,t,.12,'square',.05,this.fx,true);}
  else if(type==='go'){this.tone(990,t,.25,'square',.06,this.fx,true);this.noise(t,.4,.06,'bandpass',600,this.fx,7000);}
 }
 dispose(){this.setPlaying(false);document.removeEventListener('visibilitychange',this.onVisibility);this.ctx?.close().catch(()=>{});this.ctx=null;}
}
