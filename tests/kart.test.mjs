import test from 'node:test';
import assert from 'node:assert/strict';
import {KartGame,KART,ITEMS,THEMES,FEATS,CUPS,RIVALS,DAILY_TWIST,cupFor,kartTheme,kartTrack,trackAt,trackPoint,trackHeight,wallAt,ordinal} from '../dist/kart-engine.js';
import {createQuickGame,snapshotQuick,restoreQuick} from '../dist/pack-checkpoint.js';
import {seededRandom} from '../dist/mobile-core.js';

// Off the grid: start and sit through the lights.
const race=(seed,world=seed)=>{const g=new KartGame(seededRandom(seed),world);g.start();g.tick(KART.grid+.01);g.events=[];return g;};
const run=(g,s)=>{for(let i=0;i<Math.round(s*60);i++)g.tick(1/60);};
const seen=(g,type)=>g.events.some(e=>e.type===type);
// A tidy driver: follows the inside line through corners and fires items as soon as they land.
function drive(g,seconds,{items=true}={}){const t=g.track;for(let s=0;s<seconds&&g.status==='playing';s+=1/60){const k=g.you,look=trackAt(t,k.p+14+k.v*.4),line=Math.max(-3.5,Math.min(3.5,look.curve*260)),err=Math.max(-.45,Math.min(.45,(line-k.d)*.35)),st=(err-k.a)*3.2;
 g.press('left',st>.25);g.press('right',st<-.25);if(items&&k.item)g.press('up',true);g.tick(1/60);}}
// A racer who slides: drifts through the corners (↓ on keys, or just holding the turn on touch) and lets go for the mini-turbo.
function slide(g,seconds,touch=false){const t=g.track;g.autoDrift=touch;for(let s=0;s<seconds&&g.status==='playing';s+=1/60){const k=g.you,look=trackAt(t,k.p+14+k.v*.4),here=trackAt(t,k.p+4),line=Math.max(-3.5,Math.min(3.5,look.curve*260)),err=Math.max(-.45,Math.min(.45,(line-k.d)*.35)),st=(err-k.a)*3.2,corner=Math.abs(here.curve)>.008&&Math.abs(look.curve)>.006;
  if(g.go>0){g.tick(1/60);continue;}
  if(k.drift){const want=Math.sign(here.curve)===k.drift&&corner&&k.charge<2.2,hold=k.drift>0?'left':'right',other=k.drift>0?'right':'left';if(touch){g.press(hold,want);g.press(other,false);}else{g.press('down',want);const wide=k.d*k.drift<-1.5||k.a*k.drift<.05;g.press(hold,wide);g.press(other,!wide&&k.d*k.drift>2.5);}}
  else{g.press('left',st>.25);g.press('right',st<-.25);if(!touch)g.press('down',corner&&Math.abs(st)>.25&&Math.sign(st)===Math.sign(here.curve));}
  if(k.item)g.press('up',true);g.tick(1/60);}}
const seedFor=id=>{let s=1;while(kartTheme(s).id!==id)s++;return s;};

test('Circuits are pure functions of the seed: three themed families, closed, evenly sampled, never too tight',()=>{
 const themes=new Set();
 for(const seed of [1,2,3,42,9001,123456,7919,15838]){const t=kartTrack(seed);assert.equal(t,kartTrack(seed));assert.equal(t.theme,kartTheme(seed).id);themes.add(t.theme);assert.equal(t.pts.length,KART.samples);assert.ok(t.len>500&&t.len<1200,`length ${t.len}`);
  const steps=t.pts.map((p,i)=>Math.hypot(t.pts[(i+1)%t.pts.length][0]-p[0],t.pts[(i+1)%t.pts.length][1]-p[1]));assert.ok(Math.max(...steps)-Math.min(...steps)<.05*t.ds);
  assert.ok(Math.max(...t.curve.map(Math.abs))<1/20,'no corner tighter than a 20 m radius');assert.equal(t.boxes.length,16);assert.equal(t.pads.length,2);
  const a=trackAt(t,10),b=trackAt(t,10+t.len);assert.ok(Math.abs(a.x-b.x)<1e-9&&Math.abs(a.y-b.y)<1e-9,'wraps every lap');
  const left=trackPoint(t,50,3),c=trackAt(t,50);assert.ok(Math.abs(Math.hypot(left.x-c.x,left.y-c.y)-3)<1e-9);assert.ok(-Math.sin(c.ang)*(left.x-c.x)+Math.cos(c.ang)*(left.y-c.y)>0,'positive d is to the left');
  // Elevation: real hills, a flat grid, a ramp that rises to the lip and a lower landing, banked corners.
  assert.ok(Math.max(...t.hgt)-Math.min(...t.hgt)>2,'hills');assert.ok(Math.abs(trackHeight(t,0)-trackHeight(t,-20))<.2,'the grid is flat');
  const j=t.jump;assert.ok(trackHeight(t,j.s)>trackHeight(t,j.s-j.ramp)+1.5,'ramp');assert.ok(trackHeight(t,j.s+j.gap)<trackHeight(t,j.s),'landing is lower');
  for(let s=0;s<t.len;s+=2)if(s<j.s||s>j.s+j.gap)assert.ok(Math.abs(trackHeight(t,s+1)-trackHeight(t,s))<.3,'no cliff at '+s);
  const tight=t.curve.indexOf(Math.max(...t.curve));assert.ok(trackHeight(t,tight*t.ds,3)<trackHeight(t,tight*t.ds,-3),'left-handers bank down to the left');
  // Features keep clear of each other and of the start; furniture stays off the ramp.
  assert.ok(j.s>80&&j.s+j.gap<t.len-60);assert.ok(t.cut&&t.cut.s1>t.cut.s0+30&&[1,-1].includes(t.cut.side));assert.ok(t.cut.s1<j.s-30||t.cut.s0>j.s+j.gap+30,'shortcut clear of the jump');
  assert.equal(wallAt(t,(t.cut.s0+t.cut.s1)/2,t.cut.side),KART.wall+KART.cut);assert.equal(wallAt(t,(t.cut.s0+t.cut.s1)/2,-t.cut.side),KART.wall);assert.equal(wallAt(t,t.cut.s0-5,t.cut.side),KART.wall);
  if(t.tunnel)assert.ok(t.tunnel.s1<j.s-20||t.tunnel.s0>j.s+j.gap+20,'tunnel clear of the jump');
  for(const b of [...t.boxes,...t.pads])assert.ok(b.s<j.s-30||b.s>j.s+j.gap+20,'no pickups on the ramp');assert.ok(t.coins.filter(c=>c.air).length>=3,'coins over the gap');}
 assert.deepEqual([...themes].sort(),THEMES.map(x=>x.id).sort(),'all three themes turn up');
});
test('The start lights: nobody moves until green, and a press in the last moment is a rocket start',()=>{
 const g=new KartGame(seededRandom(5),5);g.start();g.tick(1);assert.ok(g.go>0);assert.ok(g.karts.every(k=>k.v===0&&k.p<0));assert.equal(g.time,0,'the clock waits for green');assert.ok(seen(g,'light'));
 g.tick(KART.grid-1-.2);assert.ok(g.go>0&&g.go<.42);assert.ok(g.press('left',true));assert.equal(g.rev,1);g.press('left',false);g.tick(.4);assert.ok(seen(g,'go')&&seen(g,'rocketstart'));assert.ok(g.you.boost>.5);assert.ok(g.feats.includes('kart.rocketstart'));assert.ok(g.bonus>=150);
 const early=new KartGame(seededRandom(5),5);early.start();early.tick(KART.grid-1);early.press('up',true);assert.equal(early.rev,-1);early.tick(.95);early.press('up',true);assert.equal(early.rev,-1,'no second chance');early.tick(.2);assert.ok(seen(early,'bogged'));assert.equal(early.you.boost,0);
 const calm=new KartGame(seededRandom(5),5);calm.start();calm.tick(.3);calm.press('left',true);assert.equal(calm.rev,0,'steering early on the grid costs nothing');
});
test('A clean racer finishes three laps near the front; an idle one is called last',()=>{
 let wins=0,podiums=0;for(let seed=1;seed<=6;seed++){const g=new KartGame(seededRandom(seed),seed*7919);g.start();drive(g,220);
  assert.equal(g.status,'over',`seed ${seed}`);assert.ok(g.you.finished);assert.ok(g.you.time>50&&g.you.time<125,`race took ${g.you.time}`);if(g.place===1)wins++;if(g.place<=3)podiums++;
  assert.ok(g.score>=Math.floor(g.distance/2)+[3000,2000,1400,900,500,250][g.place-1]);for(const k of g.karts)assert.ok(Number.isFinite(k.p+k.d+k.v+k.a+k.y));
  assert.match(g.reason,new RegExp('^'+g.track.name+', Pup Cup: '+ordinal(g.place)+' of 6 in '));assert.match(g.reason,/(clear of|behind) (Blaze|Mochi|Turbo Tank|Pixel|Duchess)/);}
 assert.ok(wins>=1&&podiums>=3,`wins ${wins} podiums ${podiums}`);
 const idle=new KartGame(seededRandom(3),3);idle.start();for(let s=0;s<220&&idle.status==='playing';s+=1/60)idle.tick(1/60);
 assert.equal(idle.status,'over');assert.equal(idle.place,KART.rivals+1);assert.match(idle.reason,/6th of 6/);assert.match(idle.reason,/more points opens the Street Cup/);
});
test('Drifting is what wins, and keys and touch are comparably hard',()=>{
 const res={};for(const touch of [false,true]){let wins=0,turbos=0,time=0;for(let seed=1;seed<=5;seed++){const g=new KartGame(seededRandom(seed),seed*7919);g.start();slide(g,220,touch);assert.equal(g.status,'over');if(g.place===1)wins++;turbos+=g.turbos;time+=g.you.time;}assert.ok(wins>=3,`${touch?'touch':'keys'} wins ${wins}`);assert.ok(turbos>=25,`turbos ${turbos}`);res[touch]={time,turbos};}
 assert.ok(Math.abs(res.true.time-res.false.time)<res.false.time*.06,`touch ${res.true.time.toFixed(0)} s vs keys ${res.false.time.toFixed(0)} s over five races`);assert.ok(res.true.turbos<=res.false.turbos,'touch does not out-turbo the keys');
});
test('Laps count by distance along the track, whatever the hills and the jump do',()=>{
 const g=race(4,seedFor('skyway')),t=g.track,laps=[];let airborne=0,maxY=0;for(let s=0;s<200&&g.status==='playing';s+=1/60){const k=g.you,look=trackAt(t,k.p+14+k.v*.4),err=Math.max(-.45,Math.min(.45,(Math.max(-3.5,Math.min(3.5,look.curve*260))-k.d)*.35)),st=(err-k.a)*3.2;g.press('left',st>.25);g.press('right',st<-.25);g.tick(1/60);if(k.y>0)airborne++;maxY=Math.max(maxY,k.y);for(const e of g.events)if(e.type==='lap')laps.push([e.lap,k.p]);g.events=[];}
 assert.deepEqual(laps.map(l=>l[0]),[2,3]);assert.ok(laps.every(([n,p])=>Math.abs(p-(n-1)*t.len)<1),'lap events land on the line');assert.ok(g.you.finished&&g.you.p>=3*t.len);assert.ok(airborne>60&&maxY>1.5,'and it flew: '+maxY);assert.equal(g.jumps,3);assert.ok(g.feats.includes('kart.air3'));
});
test('The ramp: fast karts fly the gap and land with a kick, slow ones drop in and are put back',()=>{
 const g=race(6,seedFor('harbour')),t=g.track,j=t.jump,y=g.you;g.karts.slice(1).forEach(k=>k.p-=200);
 y.p=j.s-3;y.d=0;y.a=0;y.v=30;run(g,.15);assert.ok(seen(g,'jump'));assert.ok(y.y>0&&y.vy>0);g.press('left',true);const a0=y.a;run(g,.2);g.press('left',false);assert.ok(Math.abs(y.a-a0)<.25,'little steering in the air');
 run(g,1.2);assert.ok(seen(g,'land'));assert.equal(y.y,0);assert.ok(y.p>j.s+j.gap,'cleared the gap');assert.ok(!seen(g,'splash'));assert.equal(g.jumps,1);
 g.events=[];y.p=j.s-3;y.d=0;y.a=0;y.v=10;y.boost=0;g.input={left:false,right:false,down:false};for(let i=0;i<40&&!seen(g,'splash');i++){y.v=Math.min(y.v,10);g.tick(1/60);}assert.ok(seen(g,'splash'),'too slow: into the gap');assert.ok(y.sink>0);const lost=g.time;run(g,1.5);assert.ok(seen(g,'rescue'));assert.equal(y.sink,0);assert.ok(y.p>j.s+j.gap&&y.p<j.s+j.gap+12);assert.ok(g.time-lost>1.3);
});
test('The inside line is the short way round, and the shortcut pays only on a boost',()=>{
 const g=race(7,seedFor('neon')),t=g.track,c=t.cut,mid=(c.s0+c.s1)/2;g.karts.slice(1).forEach(k=>k.p-=300);
 const lap=(d,boost)=>{const y=g.you;y.p=mid-10;y.d=d;y.a=0;y.v=boost?40:28;y.boost=boost?2:0;const p0=y.p;for(let i=0;i<30;i++){y.d=d;y.a=0;y.boost=boost?2:0;g.tick(1/60);}return y.p-p0;};
 const inside=lap(c.side*3,false),outside=lap(-c.side*3,false);assert.ok(inside>outside*1.08,`inside ${inside.toFixed(1)} m vs outside ${outside.toFixed(1)} m`);
 g.events=[];const dirt=lap(c.side*(KART.wall+2),false);assert.ok(dirt<outside,'the dirt is slow without a boost');assert.ok(seen(g,'shortcut'));assert.ok(!g.feats.includes('kart.shortcut'));
 g.cutLap=-1;const flown=lap(c.side*(KART.wall+2),true);assert.ok(flown>inside*1.3,'and very quick with one');assert.ok(g.feats.includes('kart.shortcut'));assert.equal(g.cuts,2);
 g.you.p=mid;g.you.d=-c.side*20;g.tick(1/60);assert.ok(Math.abs(g.you.d)<=KART.wall,'the far side is still walled');
});
test('The wheel ramps to full lock, touch drifts only start in corners, and they ride the bend',()=>{
 const g=race(5);g.tick(1.5);g.press('left',true);g.tick(1/60);assert.ok(g.you.steer>0&&g.you.steer<.5,'a tap is a small correction');g.tick(.2);assert.equal(g.you.steer,1);g.press('left',false);g.tick(.2);assert.equal(g.you.steer,0);
 const t=g.track,clear=s=>s>60&&(s<t.jump.s-60||s>t.jump.s+40)&&(s<t.cut.s0-30||s>t.cut.s1+10),straight=[...t.curve.keys()].find(i=>clear(i*t.ds)&&[0,4,8,12,16,20,24,28,32,36,40].every(m=>Math.abs(trackAt(t,i*t.ds+m).curve)<.004)),bend=[...t.curve.keys()].find(i=>clear(i*t.ds)&&([0,3,6,9,12,15].every(m=>trackAt(t,i*t.ds+m).curve>.012)||[0,3,6,9,12,15].every(m=>trackAt(t,i*t.ds+m).curve<-.012)));
 assert.ok(straight!==undefined&&bend!==undefined);g.autoDrift=true;g.karts.slice(1).forEach(k=>k.p-=300);
 g.you.p=straight*t.ds;g.you.d=0;g.you.a=0;g.you.v=28;g.press('left',true);for(let i=0;i<50;i++){g.tick(1/60);g.you.a=0;g.you.d=0;}assert.equal(g.you.drift,0,'holding a side on a straight never drifts');g.press('left',false);g.tick(.2);
 const side=trackAt(t,bend*t.ds).curve>0?'left':'right',sign=side==='left'?1:-1;g.you.p=bend*t.ds-12;g.you.d=0;g.you.a=0;g.you.v=28;g.events=[];g.press(side,true);let drifted=0;for(let i=0;i<150&&g.you.p<bend*t.ds+15;i++){g.tick(1/60);if(g.you.drift===sign)drifted++;}
 assert.ok(drifted>20,'held into the bend: the slide starts');assert.ok(!seen(g,'wall'),'and it follows the corner instead of finding a wall');assert.ok(g.you.d*sign>-2,'on the inside half');
});
test('Slipstream slings a kart past the one it follows, and rivals run wide now and then',()=>{
 const g=race(9);g.tick(3);const y=g.you,r=g.karts[1];g.karts.slice(2).forEach(k=>k.p-=200);g.events=[];
 for(let i=0;i<90&&!seen(g,'draft');i++){y.p=r.p-6;y.d=r.d;y.a=0;y.v=Math.max(y.v,24);y.boost=0;g.tick(1/60);}
 assert.ok(seen(g,'draft'));assert.equal(g.drafts,1);assert.ok(y.boost>0);assert.equal(y.draft,0);
 const far=race(9);far.tick(3);far.karts.slice(1).forEach(k=>k.p+=60);far.events=[];far.tick(2);assert.equal(far.drafts,0,'no tow from far behind');
 const s=race(4);let slips=0;const marks=new Set();for(let i=0;i<60*70&&s.status==='playing';i++){s.tick(1/60);for(const k of s.karts.slice(1))if(k.slip>0&&!marks.has(k.id+':'+Math.floor(s.time/2))){marks.add(k.id+':'+Math.floor(s.time/2));slips++;}}assert.ok(slips>=5,'slips '+slips);
 const k=s.karts.find(k=>k.id&&k.slip>0)||s.karts[1];k.slip=.5;const cap=k.cap;s.tick(1/60);assert.ok(k.cap<cap*.9||cap===undefined);
});
test('Steering, drifting into a mini-turbo, and walls',()=>{
 const g=race(5);g.tick(1.8);assert.ok(g.you.v>20,'auto-gas');
 const ref=race(5);ref.tick(1.8);ref.tick(.3);g.press('left',true);g.tick(.3);assert.ok(g.you.d>ref.you.d+.2,'left steers toward +d');g.press('left',false);
 g.you.d=0;g.you.a=0;const into=trackAt(g.track,g.you.p).curve>0?'left':'right',out=into==='left'?'right':'left',sign=into==='left'?1:-1;g.press('down',true);g.press(into,true);g.tick(1/60);assert.equal(g.you.drift,sign);assert.ok(seen(g,'hop'));
 g.tick(.5);g.press(into,false);g.press(out,true);g.tick(.6);assert.equal(g.you.drift,sign,'counter-steering holds the slide');assert.ok(seen(g,'charge'));g.press(out,false);g.press('down',false);g.tick(1/60);
 assert.ok(seen(g,'miniturbo'),'releasing a charged drift fires a mini-turbo');assert.ok(g.you.boost>0);
 const w=race(6);w.press('left',true);w.tick(6);assert.ok(Math.abs(w.you.d)<=KART.wall+KART.cut);assert.ok(seen(w,'wall'));assert.ok(w.knocks>=1);
 const a=race(7);a.autoDrift=true;a.tick(3);const turn=trackAt(a.track,a.you.p+5).curve;a.you.v=28;if(Math.abs(turn)>.006){a.press(turn>0?'left':'right',true);a.tick(.6);assert.equal(a.you.drift,Math.sign(turn),'touch players drift by holding a turn');}
});
test('Items: boost, bones, rockets that find the kart ahead, a shield that eats one hit, and the howl',()=>{
 assert.deepEqual(ITEMS,['boost','bone','rocket','shield','howl']);
 const g=race(8);g.tick(3);const you=g.you;
 you.item='boost';assert.ok(g.press('up',true));assert.ok(you.boost>1);assert.equal(you.item,null);assert.equal(g.press('up',true),false,'nothing left to fire');
 you.item='bone';g.press('up',true);assert.equal(g.bones.length,1);const victim=g.karts[1];victim.shield=0;g.bones[0].p=victim.p+.2;g.bones[0].d=victim.d;g.tick(1/60);assert.ok(victim.spin>0);assert.equal(g.bones.length,0);assert.ok(g.events.some(e=>e.type==='wipeout'&&e.kart===1&&e.cause==='bone'));
 const r=race(9);r.tick(3);r.you.p=Math.min(...r.karts.slice(1).map(k=>k.p))-6;r.you.d=0;const ahead=r.karts.filter(k=>k.id&&k.p>r.you.p).sort((a,b)=>a.p-b.p)[0];ahead.shield=0;r.you.item='rocket';r.press('up',true);r.tick(1.1);
 assert.ok(r.events.some(e=>e.type==='hit'&&e.kart===ahead.id),'the rocket spun out the kart ahead');assert.equal(r.hits,1);
 // Shield: one hit bounces off, the next one lands.
 const s=race(10);s.tick(2);s.you.coins=5;s.you.item='shield';s.press('up',true);assert.ok(s.you.shield>0);assert.equal(s.spinOut(s.you,'rocket',1),false);assert.ok(seen(s,'block'));assert.equal(s.you.spin,0);assert.equal(s.you.shield,0);assert.ok(s.feats.includes('kart.block'));
 assert.equal(s.spinOut(s.you,'bone'),true);assert.equal(s.you.coins,2);assert.ok(s.events.some(e=>e.type==='spin'));assert.equal(s.knocks,1);
 // Howl: everyone within range spins, in front or behind; those out of range do not.
 const h=race(11);h.tick(3);const y=h.you;h.karts.forEach(k=>{k.shield=0;k.spin=0;});h.karts[1].p=y.p+6;h.karts[2].p=y.p-7;h.karts[3].p=y.p+40;h.karts[4].p=y.p-60;h.karts[5].p=y.p+90;y.item='howl';h.press('up',true);
 assert.ok(h.karts[1].spin>0&&h.karts[2].spin>0);assert.equal(h.karts[3].spin,0);assert.equal(h.hits,2);assert.ok(h.feats.includes('kart.howl2'));assert.ok(h.events.some(e=>e.type==='howl'&&e.n===2));
 // The leader never draws a rocket; the back of the field draws more boosts than the front.
 const d=race(12);d.order=[...d.karts];const count=(k,n=400)=>{const c={};for(let i=0;i<n;i++){const it=d.roll(k);c[it]=(c[it]||0)+1;}return c;};const front=count(d.order[0]),back=count(d.order[5]);
 assert.equal(front.rocket,undefined);assert.ok((back.boost||0)>(front.boost||0)*1.5);for(const it of Object.keys({...front,...back}))assert.ok(ITEMS.includes(it));
});
test('Contact: the heavy kart holds its line, and rivals have their own habits',()=>{
 assert.equal(RIVALS.length,KART.rivals+1);assert.ok(RIVALS[3].weight>RIVALS[4].weight*2);assert.ok(RIVALS[1].bully&&RIVALS[2].tactician&&RIVALS[4].wild);
 const g=race(13);g.tick(3);const tank=g.karts[3],pixel=g.karts[4];g.karts.forEach(k=>{if(k!==tank&&k!==pixel)k.p-=150;});pixel.p=tank.p;tank.d=0;pixel.d=1;tank.a=pixel.a=0;g.events=[];const td=tank.d,pd=pixel.d;g.step(KART.step);
 assert.ok(Math.abs(pixel.d-pd)>Math.abs(tank.d-td)*1.8,'the light kart moves, the heavy one barely');assert.ok(g.events.some(e=>e.type==='clash'&&e.a===3&&e.b===4));
 const b=race(14);b.tick(3);b.karts.slice(1).forEach(k=>k.p-=150);b.you.p=b.karts[0].p;b.you.d=1.2;const o=b.karts[2];o.p=b.you.p;o.d=0;b.events=[];b.step(KART.step);assert.ok(b.events.some(e=>e.type==='bump'&&e.a===0&&e.b===2),'your own contact is a bump');
 // The bully steers at you when you are alongside.
 const s=race(15);s.tick(4);const blaze=s.karts[1],you=s.you;s.karts.slice(2).forEach(k=>k.p-=200);you.p=blaze.p+.5;you.d=3;blaze.d=0;blaze.slip=0;blaze.think=1;s.drive(blaze,KART.step,0);assert.equal(blaze.line,3);
});
test('Item boxes, coins and boost pads along the track',()=>{
 const g=race(11);g.tick(1);const t=g.track,box=t.boxes[0];
 g.you.p=box.s-.2;g.you.d=box.d;g.tick(1/120);assert.ok(g.you.item);assert.ok(seen(g,'item'));
 const c=t.coins.find(c=>!c.air&&Math.abs(c.d)<5);g.you.p=c.s-.1+t.len;g.you.d=c.d;const coins=g.you.coins;g.tick(1/120);assert.equal(g.you.coins,coins+1);
 const pad=t.pads[0];g.you.p=pad.s-.2;g.you.d=pad.d;g.you.boost=0;g.tick(1/120);assert.ok(g.you.boost>.5);
 assert.deepEqual([1,2,3,4,11,12,13,21,22,23].map(ordinal),['1st','2nd','3rd','4th','11th','12th','13th','21st','22nd','23rd']);
});
test('The race heats up lap by lap, announces laps and passes, and holds the podium shot after the flag',()=>{
 const g=new KartGame(seededRandom(12),12);g.start();assert.equal(g.heat,0);const types=new Set();let flagged=0,sawFinal=false;
 for(let i=0;i<60*220&&g.status==='playing';i++){drive(g,1/60);for(const e of g.events)types.add(e.type);g.events=[];if(g.finalLap&&!g.you.finished)sawFinal=true;if(g.you.finished&&g.status==='playing')flagged++;}
 for(const type of ['light','go','lap','heat','finish','over','coin','item','jump','land'])assert.ok(types.has(type),type);
 assert.ok(sawFinal);assert.ok(flagged>KART.outro*60*.9&&flagged<KART.outro*60*1.1+2,'the outro runs '+flagged+' frames');assert.equal(g.outro,0);assert.ok(g.margin>=0);
});
test('Cups: the best score picks the cup, faster cups have faster rivals and pay more',()=>{
 assert.deepEqual([0,4499,4500,7999,8000,99999].map(cupFor),[0,0,1,1,2,2]);assert.deepEqual(CUPS.map(c=>c.name),['Pup Cup','Street Cup','Top Dawg Cup']);
 const pace=cup=>{const g=new KartGame(seededRandom(21),21);g.setCup(CUPS[cup].need);assert.equal(g.cup,cup);g.start();run(g,30);return g.karts.slice(1).reduce((s,k)=>s+k.p,0);};
 const a=pace(0),b=pace(1),c=pace(2);assert.ok(b>a*1.01&&c>b*1.01,`rival distance ${a|0} < ${b|0} < ${c|0}`);
 const late=race(21);assert.equal(late.setCup(9999),0,'the cup is fixed once the lights start');
 const w=race(22),top=race(22);top.cup=2;for(const g of [w,top]){g.karts.slice(1).forEach(k=>k.p-=400);g.you.p=3*g.track.len-2;g.you.v=30;g.you.a=0;g.you.d=0;run(g,.3);assert.ok(g.you.finished);}assert.ok(top.bonus>w.bonus*1.4);
 run(top,KART.outro+.2);assert.equal(top.status,'over');assert.match(top.reason,/Top Dawg Cup: 1st of 6/);assert.doesNotMatch(top.reason,/opens the/);
});
test('Every feat can be earned, each is announced once with its name, and ids are stable',()=>{
 assert.ok(FEATS.length>=8);assert.equal(new Set(FEATS.map(f=>f.id)).size,FEATS.length);for(const f of FEATS){assert.match(f.id,/^kart\.[a-z0-9]+$/);assert.ok(f.name&&f.text);}
 const got=new Set(),note=g=>{for(const e of g.events)if(e.type==='feat'){assert.equal(e.name,FEATS.find(f=>f.id===e.id).name);got.add(e.id);}for(const id of g.feats)got.add(id);};
 // Rocket start, three slipstreams, ten mini-turbos, three supers.
 const g=new KartGame(seededRandom(31),31);g.start();g.tick(KART.grid-.2);g.press('up',true);g.tick(.3);
 g.karts.slice(1).forEach(k=>k.p-=300);for(let n=0;n<10;n++){g.you.drift=1;g.you.charge=n<3?2:1;g.you.spin=0;g.releaseDrift(g.you);}assert.equal(g.turbos,10);assert.equal(g.supers,3);
 const r=g.karts[1];for(let n=0;n<3;n++)for(let i=0;i<200&&g.drafts<=n;i++){const y=g.you;r.p=y.p+6;r.d=y.d;r.v=y.v;y.a=0;y.v=Math.max(y.v,24);y.boost=0;g.tick(1/60);}
 // Coins, shield block, howl, three hits.
 g.you.coins=9;const t=g.track,c=t.coins.find(c=>!c.air&&Math.abs(c.d)<5);g.you.p=c.s-.1+t.len;g.you.d=c.d;g.you.y=0;g.tick(1/120);assert.equal(g.you.coins,10);
 g.you.shield=5;g.spinOut(g.you,'rocket',2);g.you.spin=0;g.karts.forEach(k=>{k.shield=0;k.spin=0;});g.karts[2].p=g.you.p+5;g.karts[3].p=g.you.p-5;g.you.item='howl';g.press('up',true);g.hits=2;g.karts[4].spin=0;g.karts[4].shield=0;g.karts[4].p=g.you.p+10;g.you.item='rocket';g.press('up',true);g.tick(1.1);note(g);
 for(const id of ['kart.rocketstart','kart.drift10','kart.super3','kart.draft3','kart.coins10','kart.block','kart.howl2','kart.hits3'])assert.ok(got.has(id),id);
 assert.equal(g.events.filter(e=>e.type==='feat'&&e.id==='kart.drift10').length+0,g.events.filter(e=>e.type==='feat'&&e.id==='kart.drift10').length);
 const again=g.feats.length;g.feat('kart.block');assert.equal(g.feats.length,again,'never twice');
 // Three jumps and the boosted shortcut.
 const a=race(32);a.karts.slice(1).forEach(k=>k.p-=300);for(let lap=0;lap<3;lap++){a.you.p=lap*a.track.len+a.track.jump.s-3;a.you.d=0;a.you.a=0;a.you.v=30;a.you.y=0;run(a,1.6);}const cu=a.track.cut;a.you.p=(cu.s0+cu.s1)/2+a.track.len*0;a.you.d=cu.side*(KART.wall+2);a.you.boost=1;a.you.y=0;a.tick(1/60);note(a);assert.ok(got.has('kart.air3')&&got.has('kart.shortcut'));
 // Winning: clean, by a whisker, from the back.
 const w=race(33);w.karts.slice(1).forEach((k,i)=>{k.p=3*w.track.len-40-i*3;});w.lastLapPlace=5;w.lap=2;w.you.p=3*w.track.len-1.2;w.you.v=30;w.you.a=0;w.you.d=0;w.karts[1].p=w.you.p-3;w.karts[1].v=30;run(w,.2);note(w);
 assert.ok(w.you.finished&&w.place===1);assert.ok(w.margin<.25,'margin '+w.margin);for(const id of ['kart.win','kart.photo','kart.lastfirst','kart.clean'])assert.ok(got.has(id),id);
 assert.deepEqual([...got].sort(),FEATS.map(f=>f.id).sort(),'every feat in the list is reachable');
 const hit=race(34);hit.karts.slice(1).forEach(k=>k.p-=300);hit.knocks=1;hit.you.p=3*hit.track.len-1;hit.you.v=30;run(hit,.2);assert.ok(hit.feats.includes('kart.win')&&!hit.feats.includes('kart.clean'));
});
test('The daily course carries one seeded twist that changes a rule',()=>{
 const ids=new Set();for(let s=1;s<60;s++){const tw=DAILY_TWIST(s);assert.deepEqual(tw,DAILY_TWIST(s));assert.ok(tw.id&&tw.name&&tw.text);ids.add(tw.id);}assert.deepEqual([...ids].sort(),['gold','rockets','tailwind','turbo']);
 const seed=id=>{let s=1;while(DAILY_TWIST(s).id!==id)s++;return s;},pair=id=>{const a=race(40,seed(id)),b=race(40,seed(id));b.daily=true;assert.equal(a.twist,null);assert.equal(b.twist.id,id);return [a,b];};
 let [a,b]=pair('rockets');for(const g of [a,b])g.order=[...g.karts];const drawn=new Set();for(let i=0;i<200;i++)drawn.add(b.roll(b.order[3]));assert.deepEqual([...drawn].sort(),['rocket','shield']);
 [a,b]=pair('turbo');for(const g of [a,b]){g.you.drift=1;g.you.charge=2;g.releaseDrift(g.you);}assert.ok(Math.abs(b.you.boost-a.you.boost*1.5)<1e-9);
 [a,b]=pair('gold');for(const g of [a,b]){const c=g.track.coins.find(c=>!c.air&&Math.abs(c.d)<5),bonus=g.bonus;g.you.p=c.s-.1+g.track.len;g.you.d=c.d;g.tick(1/120);g.gain=g.bonus-bonus;}assert.equal(b.gain,a.gain*2);
 [a,b]=pair('tailwind');for(const g of [a,b]){const y=g.you,r=g.karts[1];g.tick(2);g.karts.slice(2).forEach(k=>k.p-=200);y.draft=0;for(let i=0;i<24;i++){r.p=y.p+6;r.d=y.d;y.a=0;y.v=Math.max(y.v,24);y.boost=0;r.v=y.v;g.tick(1/60);}}assert.ok(b.drafts>a.drafts||b.you.draft>a.you.draft*1.6);
});
test('Same seed and inputs race identically, and a checkpoint resumes exactly',()=>{
 const a=createQuickGame('kart',77),b=createQuickGame('kart',77);a.start();b.start();drive(a,25);drive(b,25);assert.equal(a.score,b.score);assert.deepEqual(a.karts,b.karts);assert.deepEqual(a.feats,b.feats);
 a.pause();const snap=JSON.parse(JSON.stringify(snapshotQuick(a,'kart'))),c=restoreQuick(snap);assert.ok(c,'snapshot restores');assert.equal(c.status,'paused');assert.equal(c.track.theme,a.track.theme);
 a.start();c.start();for(let i=0;i<600;i++){a.tick(1/60);c.tick(1/60);}assert.equal(c.score,a.score);assert.deepEqual(c.karts,a.karts);assert.deepEqual(c.feats,a.feats);
 // On the grid and in the air too.
 const grid=createQuickGame('kart',78);grid.setCup(5000);grid.daily=true;grid.start();grid.tick(1);grid.press('up',true);grid.pause();const g2=restoreQuick(JSON.parse(JSON.stringify(snapshotQuick(grid,'kart'))));assert.ok(g2);assert.equal(g2.go,grid.go);assert.equal(g2.rev,-1);assert.equal(g2.cup,1);assert.equal(g2.daily,true);assert.equal(g2.twist.id,grid.twist.id);
 const air=createQuickGame('kart',79);air.start();air.tick(KART.grid+2);air.you.p=air.track.jump.s-2;air.you.v=30;air.you.a=0;air.you.d=0;air.tick(.3);assert.ok(air.you.y>0);air.pause();const a2=restoreQuick(JSON.parse(JSON.stringify(snapshotQuick(air,'kart'))));assert.ok(a2);air.start();a2.start();for(let i=0;i<120;i++){air.tick(1/60);a2.tick(1/60);}assert.deepEqual(a2.karts,air.karts);
 // Corrupt saves are refused, never half-loaded.
 const bad=x=>assert.equal(restoreQuick(x),null);
 bad({...snap,karts:snap.karts.slice(1)});bad({...snap,karts:[{...snap.karts[0],v:999},...snap.karts.slice(1)]});bad({...snap,karts:[{...snap.karts[0],item:'banana'},...snap.karts.slice(1)]});bad({...snap,lap:9});
 bad({...snap,karts:[{...snap.karts[0],y:-1},...snap.karts.slice(1)]});bad({...snap,karts:[{...snap.karts[0],d:40},...snap.karts.slice(1)]});bad({...snap,karts:[{...snap.karts[0],shield:99},...snap.karts.slice(1)]});
 bad({...snap,go:9});bad({...snap,rev:2});bad({...snap,outro:99});bad({...snap,cup:7});bad({...snap,daily:'yes'});bad({...snap,feats:['kart.win','kart.win']});bad({...snap,feats:['kart.nope']});bad({...snap,feats:'kart.win'});bad({...snap,drafts:-1});
 assert.ok(restoreQuick({...snap,feats:['kart.win','kart.block']}));
 // A save from before the themed circuits lacks the new fields: refused, never a crash.
 const old=JSON.parse(JSON.stringify(snap));for(const k of ['go','rev','outro','margin','feats','cup','daily','supers','jumps','knocks','cuts','cutLap','lastLapPlace'])delete old[k];for(const k of old.karts){delete k.y;delete k.vy;delete k.sink;delete k.shield;delete k.hitCd;}bad(old);
});
