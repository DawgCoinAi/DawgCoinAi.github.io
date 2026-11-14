// IT LEARNS: you against the House, a machine that studies how you move and then shoots where
// you are about to be. A 5×5 floor; every beat the House marks tiles it will blast, and you get one
// step (or stay). It keeps counts of what you do in each situation (your last move × where you
// stand), and when it is confident it arms a GUESS: an unmarked shot at the tile it expects you to
// step to. Dodge an armed guess and you've OUTSMARTED it (multiplier up); walk into it and you were
// PREDICTED. It herds you with its visible marks, baits you with bones it sometimes rigs, and it
// remembers you between runs. Fair by rule: every beat has at least one safe step that isn't the
// guess. Deterministic for a seed, a profile and the same inputs.
export const NEM={n:5,hearts:3,beat0:.92,beat1:.38,ramp:130,maxMult:8,decay:.97,prior:.6,minSamples:5,minConf:.4};
export const MOVES=['stay','up','down','left','right'];
const DELTA=[[0,0],[0,-1],[0,1],[-1,0],[1,0]],N=NEM.n,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const tileOf=(c,r)=>r*N+c;
export const posClass=(c,r)=>{const e=(c===0||c===N-1)+(r===0||r===N-1);return e;};// 0 inner, 1 edge, 2 corner
export const beatLength=beat=>NEM.beat0+(NEM.beat1-NEM.beat0)*Math.min(1,beat/NEM.ramp);
// Special phases, set by the beat number alone.
export const phaseOf=beat=>{const p=Math.floor(beat/16),k=beat%16;return {sweep:beat>=16&&p%2===1&&k<N,blackout:beat>=48&&p%3===2,mirror:beat>=72&&p%4===3&&k<6,index:p,k};};
const WHERE=['in the open','on an edge','in a corner'],AFTER=['standing still','going up','going down','going left','going right'],DO=['stand still','go up','go down','go left','go right'];
export const FEATS=[
 {id:'nemesis.out',name:'Not Today',text:'Outsmart the House once'},
 {id:'nemesis.out5',name:'Hard To Read',text:'Outsmart it 5 times in one run'},
 {id:'nemesis.out10',name:'Unreadable',text:'Outsmart it 10 times in one run'},
 {id:'nemesis.x4',name:'On A Roll',text:'Reach a ×4 multiplier'},
 {id:'nemesis.x8',name:'Maximum Disrespect',text:'Reach the ×8 multiplier'},
 {id:'nemesis.fifty',name:'Fifty Beats',text:'Survive 50 beats'},
 {id:'nemesis.hundred',name:'Century',text:'Survive 100 beats'},
 {id:'nemesis.ghost',name:'No File On Me',text:'Survive 40 beats without being predicted'},
 {id:'nemesis.bait',name:'Free Lunch',text:'Take 3 bones in one run without getting baited'}];
const freshCounts=()=>Array.from({length:15},()=>[0,0,0,0,0]);

export class NemesisGame {
 constructor(random=Math.random,worldSeed=0){this.random=random;this.worldSeed=worldSeed;this.status='ready';this.time=0;this.score=0;this.reason='';this.events=[];
  this.c=2;this.r=2;this.hearts=NEM.hearts;this.beat=0;this.t=0;this.moved=false;this.cur=0;this.last=0;this.mult=1;this.bonus=0;this.marks=[];this.guess=-1;this.guessMove=-1;this.read=0;
  this.counts=freshCounts();this.outs=0;this.preds=0;this.blasts=0;this.baited=0;this.baitTaken=0;this.baitOffered=0;this.bone=null;this.runs=0;this.breather=0;this.feats=[];this.taken=0;this.plan();}
 // A feat is earned once per run; the arcade's quest board remembers it for good.
 feat(id){const full='nemesis.'+id;if(this.feats.includes(full))return;const f=FEATS.find(f=>f.id===full);if(!f)return;this.feats.push(full);this.events.push({type:'feat',id:full,name:f.name});}
 get tile(){return tileOf(this.c,this.r);}
 get phase(){return phaseOf(this.beat);}
 get beatLen(){return beatLength(this.beat);}
 start(){if(this.status==='ready'||this.status==='paused')this.status='playing';}
 pause(){if(this.status==='playing')this.status='paused';}
 end(reason){if(this.status!=='playing')return;this.status='over';this.reason=reason;this.events.push({type:'over'});}
 // What the House remembers between runs (faded by half each time it is loaded).
 exportProfile(){return {v:1,counts:this.counts.map(row=>row.map(n=>Math.round(n*100)/100)),baitTaken:this.baitTaken,baitOffered:this.baitOffered,runs:this.runs+1};}
 loadProfile(p){if(!validProfile(p))return false;this.counts=p.counts.map(row=>row.map(n=>n*.5));this.baitTaken=Math.round(p.baitTaken*.5);this.baitOffered=Math.round(p.baitOffered*.5);this.runs=p.runs;this.plan();return true;}
 context(){return this.last*3+posClass(this.c,this.r);}
 // Legal steps from where you stand: [move index, tile].
 options(){const out=[];for(let m=0;m<5;m++){const c=this.c+DELTA[m][0],r=this.r+DELTA[m][1];if(c>=0&&r>=0&&c<N&&r<N)out.push([m,tileOf(c,r)]);}return out;}
 // What the House expects in this situation: options sorted by probability.
 predict(){const row=this.counts[this.context()],opts=this.options(),total=opts.reduce((s,[m])=>s+row[m]+NEM.prior,0),samples=opts.reduce((s,[m])=>s+row[m],0);
  return {samples,list:opts.map(([m,t])=>({m,t,p:(row[m]+NEM.prior)/total})).sort((a,b)=>b.p-a.p||a.m-b.m)};}
 // The House's turn: decide this beat's visible marks and whether to arm a guess.
 plan(){const rnd=this.random,beat=this.beat,ph=phaseOf(beat),{samples,list}=this.predict(),top=list[0];this.read=samples>=NEM.minSamples?top.p:top.p*samples/NEM.minSamples*.6;
  // The first two beats teach the rule (your tile lights up: move), and the beat after a hit is a breather.
  const calm=beat<2||this.breather>0;if(this.breather>0)this.breather--;
  this.guess=-1;this.guessMove=-1;if(!calm&&samples>=NEM.minSamples&&top.p>=NEM.minConf&&rnd()<Math.min(.9,.3+beat/110)){this.guess=top.t;this.guessMove=top.m;}
  const marks=new Set(),here=this.tile,budget=calm?0:Math.min(11,2+Math.floor(beat/10));if(calm&&beat<2)marks.add(here);
  if(!calm&&this.guess!==here&&rnd()<.8)marks.add(here);
  // Herd: close off the steps you rarely take, so the habit is the easy way out.
  const herd=calm?0:Math.min(2,Math.floor(beat/28)+(this.guess>=0?1:0));for(let i=0;i<herd;i++){const o=list[list.length-1-i];if(o&&o.t!==this.guess&&o!==top)marks.add(o.t);}
  if(ph.sweep&&!calm){const line=ph.k,row=ph.index%4<2;for(let i=0;i<N;i++)marks.add(row?tileOf(i,line):tileOf(line,i));}
  for(let tries=0;marks.size<budget&&tries<40;tries++){const t=Math.floor(rnd()*N*N);if(t!==this.guess)marks.add(t);}
  marks.delete(this.guess);
  // Fair by rule: at least one legal step is unmarked and isn't the guess.
  const safe=()=>list.some(o=>!marks.has(o.t)&&o.t!==this.guess);
  if(!safe()){const out=[...list].reverse().find(o=>o.t!==this.guess)||list[0];marks.delete(out.t);if(!safe()){this.guess=-1;this.guessMove=-1;marks.delete(out.t);}}
  this.marks=[...marks].sort((a,b)=>a-b);this.moved=false;this.cur=0;
  // Bait: a bone on a nearby tile; the more often you take them, the more often they're rigged.
  if(this.bone){this.bone.ttl--;if(this.bone.ttl<=0)this.bone=null;}
  else if(beat>=4&&rnd()<.2){let t=Math.floor(rnd()*N*N);if(t===here)t=(t+7)%(N*N);const rate=this.baitOffered>=3?this.baitTaken/this.baitOffered:0;this.bone={t,ttl:4,rigged:rnd()<clamp(rate*.9-.25,0,.65)};this.baitOffered++;this.events.push({type:'bait',t,rigged:this.bone.rigged});}
  if(ph.k===0&&beat>0){if(ph.sweep)this.events.push({type:'phase',name:'SWEEP'});else if(ph.blackout)this.events.push({type:'phase',name:'BLACKOUT'});else if(ph.mirror)this.events.push({type:'phase',name:'MIRROR'});}
  if(this.guess>=0)this.events.push({type:'armed'});}
 // One step per beat. In a MIRROR phase left and right are swapped.
 move(dir){if(this.status!=='playing'||this.moved)return false;let m=MOVES.indexOf(dir);if(m<1)return false;if(this.phase.mirror&&m>=3)m=m===3?4:3;
  const c=this.c+DELTA[m][0],r=this.r+DELTA[m][1];if(c<0||r<0||c>=N||r>=N){this.events.push({type:'bump',dir:MOVES[m]});return false;}
  this.c=c;this.r=r;this.moved=true;this.cur=m;this.events.push({type:'hop',c,r,m});
  if(this.bone&&this.bone.t===this.tile){const b=this.bone;this.bone=null;this.baitTaken++;if(b.rigged){this.baited++;this.hit('baited');}else{this.bonus+=100*this.mult;this.score=this.bonus;this.taken++;this.events.push({type:'bone',points:100*this.mult,t:b.t});if(this.taken>=3&&!this.baited)this.feat('bait');}}
  return true;}
 press(dir,down){return down?this.move(dir):false;}
 tick(dt){if(this.status!=='playing')return;this.time+=dt;this.t+=dt;while(this.status==='playing'&&this.t>=this.beatLen){this.t-=this.beatLen;this.resolve();}}
 // The beat lands: learn what you did, blast the marks, check the guess.
 resolve(){const row=this.counts[this.lastCtx()],m=this.cur;for(let i=0;i<5;i++)row[i]*=NEM.decay;row[m]+=1;
  const here=this.tile,guessed=this.guess>=0,gm=this.guessMove;this.events.push({type:'blast',marks:this.marks,guess:this.guess});
  if(this.marks.includes(here)){this.blasts++;this.hit('blasted');}
  else if(guessed&&here===this.guess){this.preds++;this.hit('predicted',this.habit(this.lastCtx(),gm));}
  else if(guessed){this.outs++;this.mult=Math.min(NEM.maxMult,this.mult+1);this.bonus+=50*this.mult;this.events.push({type:'outsmart',mult:this.mult,points:50*this.mult,t:this.guess});this.feat('out');if(this.outs>=5)this.feat('out5');if(this.outs>=10)this.feat('out10');if(this.mult>=4)this.feat('x4');if(this.mult>=NEM.maxMult)this.feat('x8');}
  if(this.status!=='playing')return;this.bonus+=10*this.mult;this.last=m;this.beat++;if(this.beat>=50)this.feat('fifty');if(this.beat>=100)this.feat('hundred');if(this.beat>=40&&!this.preds)this.feat('ghost');this.score=this.bonus;this.plan();}
 // The situation the current beat's move is judged in (the one plan() predicted from).
 lastCtx(){const pc=this.moved?[this.c-DELTA[this.cur][0],this.r-DELTA[this.cur][1]]:[this.c,this.r];return this.last*3+posClass(pc[0],pc[1]);}
 habit(ctx,m){const row=this.counts[ctx],total=row.reduce((a,b)=>a+b,0)||1;return {after:Math.floor(ctx/3),where:ctx%3,move:m,pct:Math.round(row[m]/total*100)};}
 hit(how,habit=null){this.hearts--;this.mult=1;this.breather=1;this.events.push({type:'hit',how,habit,hearts:this.hearts,line:how==='predicted'?habitLine(habit):how==='baited'?'You took the bait. It was counting on that.':'Blasted. That one was marked.'});
  if(this.hearts<=0){this.score=this.bonus;this.end(this.verdict());}}
 // The House's file on you: the strongest habits it found, in plain words.
 dossier(){const out=[];for(let ctx=0;ctx<15;ctx++){const row=this.counts[ctx],total=row.reduce((a,b)=>a+b,0);if(total<NEM.minSamples)continue;let m=0;for(let i=1;i<5;i++)if(row[i]>row[m])m=i;const pct=Math.round(row[m]/total*100);if(pct>=45)out.push({pct,total,text:habitLine({after:Math.floor(ctx/3),where:ctx%3,move:m,pct})});}
  out.sort((a,b)=>b.pct*Math.min(1,b.total/12)-a.pct*Math.min(1,a.total/12));const lines=out.slice(0,3).map(o=>o.text);
  if(this.baitOffered>=3)lines.push(`You took ${Math.round(this.baitTaken/this.baitOffered*100)}% of the bones it left out.`);return lines;}
 verdict(){const d=this.dossier(),read=this.preds+this.outs?Math.round(this.preds/(this.preds+this.outs)*100):0;
  return `${this.beat} beats. Predicted ${this.preds}, outsmarted it ${this.outs}${this.preds+this.outs?` (it read you ${read}% of the time)`:''}. ${d[0]||'It hasn’t figured you out yet. Yet.'}`;}
}
export const habitLine=h=>h?`After ${AFTER[h.after]} ${WHERE[h.where]}, you ${DO[h.move]} ${h.pct}% of the time. It noticed.`:'';
export function validProfile(p){return !!p&&p.v===1&&Array.isArray(p.counts)&&p.counts.length===15&&p.counts.every(r=>Array.isArray(r)&&r.length===5&&r.every(n=>Number.isFinite(n)&&n>=0&&n<=1e4))&&Number.isInteger(p.baitTaken)&&Number.isInteger(p.baitOffered)&&p.baitTaken>=0&&p.baitOffered>=p.baitTaken&&p.baitOffered<=1e6&&Number.isInteger(p.runs)&&p.runs>=0&&p.runs<=1e7;}
export const NEMESIS_FIELDS=['c','r','hearts','beat','t','moved','cur','last','mult','bonus','marks','guess','guessMove','read','counts','outs','preds','blasts','baited','baitTaken','baitOffered','bone','runs','breather','feats','taken'];
const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b,num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
export function validNemesisSnapshot(s){const T=N*N-1;
 return int(s.c,0,N-1)&&int(s.r,0,N-1)&&int(s.hearts,1,NEM.hearts)&&int(s.beat,0,1e6)&&num(s.t,0,1)&&typeof s.moved==='boolean'&&int(s.cur,0,4)&&int(s.last,0,4)&&int(s.mult,1,NEM.maxMult)&&int(s.bonus,0,1e9)&&s.score===s.bonus
  &&Array.isArray(s.marks)&&s.marks.length<=N*N&&s.marks.every(t=>int(t,0,T))&&new Set(s.marks).size===s.marks.length&&int(s.guess,-1,T)&&int(s.guessMove,-1,4)&&!s.marks.includes(s.guess)&&num(s.read,0,1)
  &&validProfile({v:1,counts:s.counts,baitTaken:s.baitTaken,baitOffered:s.baitOffered,runs:s.runs})&&int(s.outs,0,1e6)&&int(s.preds,0,1e6)&&int(s.blasts,0,1e6)&&int(s.baited,0,1e6)
  &&int(s.breather,0,1)&&int(s.taken,0,1e6)&&Array.isArray(s.feats)&&s.feats.length<=FEATS.length&&s.feats.every(id=>FEATS.some(f=>f.id===id))&&new Set(s.feats).size===s.feats.length&&(s.bone===null||s.bone&&int(s.bone.t,0,T)&&int(s.bone.ttl,1,4)&&typeof s.bone.rigged==='boolean');}
