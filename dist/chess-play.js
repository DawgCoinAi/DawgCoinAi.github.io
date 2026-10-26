// The DAWG Chess play screen: climb a ladder of five rival DAWGs. Tap a piece, tap where it goes;
// captures play out as battles on the 3D board (or plainly, if battles are off). The rival thinks
// in a worker so the board keeps moving. Hints and takebacks are limited per game. A win against
// a rival opens the next one; the result is recorded like any other arcade run.
import {Chess,START,sqName,colorOf} from './chess-engine.js';
import {RIVALS,chessScore,rivalMove,hintMove} from './chess-ai.js';

const $=id=>document.getElementById(id);
const GLYPH={K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const HINTS=3,TAKEBACKS=3;
const REASON={checkmate:'Checkmate',stalemate:'Stalemate',fifty:'Fifty-move rule',repetition:'Threefold repetition',material:'Not enough material to mate',resign:'Resigned'};
export function validChessSave(v){return v===null||!!v&&typeof v==='object'&&v.v===1&&Number.isInteger(v.rival)&&v.rival>=0&&v.rival<RIVALS.length&&['w','b'].includes(v.color)&&Array.isArray(v.beaten)&&v.beaten.every(id=>RIVALS.some(r=>r.id===id))&&Number.isInteger(v.hints)&&v.hints>=0&&v.hints<=HINTS&&Number.isInteger(v.takebacks)&&v.takebacks>=0&&v.takebacks<=TAKEBACKS&&!!Chess.restore({start:v.start,moves:v.moves})&&(v.over===null||v.over&&['win','loss','draw'].includes(v.over.result));}

// Lazy, failure-safe 3D board; null until it loads (or without WebGL).
function boardFor(host){let state='idle',b=null;return {get(){if(state==='idle'){if(typeof WebGL2RenderingContext==='undefined'){state='failed';return null;}state='loading';
   import('./chess-3d.js').then(({ThreeChess})=>{const s=new ThreeChess(host,{onFailure:()=>{state='failed';b=null;host.classList.remove('has-3d');}});return s.init().then(()=>{if(state==='loading'&&s.ready){b=s;state='ready';host.classList.add('has-3d');this.onReady?.(s);}else state='failed';});}).catch(()=>{state='failed';});}
  return state==='ready'?b:null;}};}

export class ChessPlay {
 constructor(io){this.io=io;const saved=io.read('chess',null);this.s=validChessSave(saved)&&saved?saved:{v:1,rival:0,color:'w',start:START,moves:[],beaten:[],hints:HINTS,takebacks:TAKEBACKS,battles:true,view:'3d',over:null};
  this.s.battles=this.s.battles!==false;this.chess=Chess.restore({start:this.s.start,moves:this.s.moves})||new Chess();this.sel=-1;this.busy=false;this.hint=null;this.evalScore=0;this.lastMove=this.lastFromHistory();
  this.board3d=boardFor($('chessStage'));this.board3d.onReady=b=>{b.setRival(this.rival.name);b.setFlipped(this.s.color==='b');b.setView(this.s.view);b.setPosition(this.chess.board);this.marks();};
  this.worker=null;try{this.worker=new Worker(new URL('chess-worker.js',document.baseURI),{type:'module'});this.worker.onerror=()=>{this.worker=null;};}catch{this.worker=null;}this.jobs=new Map();this.jobId=0;if(this.worker)this.worker.onmessage=e=>{const j=this.jobs.get(e.data.id);if(j){this.jobs.delete(e.data.id);j(e.data.move||null);}};
  this.build2d();this.wire();}
 get rival(){return RIVALS[this.s.rival];}
 get mine(){return this.chess.turn===this.s.color;}
 lastFromHistory(){const h=this.chess.history.at(-1);return h?[h.m.from,h.m.to]:null;}
 save(){this.s.start=this.s.start||START;this.s.moves=this.chess.save(this.s.start).moves;this.io.write('chess',this.s);}
 wire(){
  $('chessStage').addEventListener('click',e=>{if(this.busy==='anim'){this.board3d.get()?.skip();return;}const b=this.board3d.get();let sq=-1;if(b)sq=b.pick(e.clientX,e.clientY);else{const t=e.target.closest?.('[data-sq]');if(t)sq=Number(t.dataset.sq);}if(sq>=0)this.tap(sq);});
  $('chessLadder').onclick=e=>{const b=e.target.closest('[data-rival]');if(b&&!b.disabled)this.newGame(Number(b.dataset.rival));};
  $('chessColor').onclick=e=>{const b=e.target.closest('[data-color]');if(!b)return;const c=b.dataset.color==='r'?(Math.random()<.5?'w':'b'):b.dataset.color;this.newGame(this.s.rival,c);};
  $('chessHint').onclick=()=>this.askHint();$('chessUndo').onclick=()=>this.takeBack();$('chessResign').onclick=()=>this.io.confirm?.('Resign this game?',`${this.rival.name} takes the win. You can rematch right away.`,'RESIGN',()=>this.finish('loss','resign'));
  $('chessView').onclick=()=>{this.s.view=this.s.view==='top'?'3d':'top';this.board3d.get()?.setView(this.s.view);this.save();this.render();};
  $('chessBattles').onclick=()=>{this.s.battles=!this.s.battles;this.save();this.render();};
  $('chessNext').onclick=()=>this.newGame(Math.min(RIVALS.length-1,this.s.rival+(this.s.over?.result==='win'?1:0)));$('chessRematch').onclick=()=>this.newGame(this.s.rival);
  $('chessShareBtn').onclick=()=>{const o=this.s.over;if(!o||!this.io.share)return;this.io.share('chess',o.score,{detail:`${o.result==='win'?'beat':o.result==='draw'?'drew with':'lost to'} ${this.rival.name}`,text:`I ${o.result==='win'?'beat':o.result==='draw'?'drew with':'lost to'} ${this.rival.name} (${this.rival.rating}) at DAWG Chess on the DAWG Arcade ♞ Your move.`});};
  $('chessPromo').onclick=e=>{const b=e.target.closest('[data-promo]');if(!b)return;$('chessPromo').hidden=true;const p=this.pendingPromo;this.pendingPromo=null;if(p)this.move(p.from,p.to,b.dataset.promo);};}
 newGame(rival=this.s.rival,color=this.s.color){if(this.busy)return;const unlocked=rival===0||this.s.beaten.includes(RIVALS[rival-1].id);if(!unlocked)return;
  Object.assign(this.s,{rival,color,start:START,moves:[],hints:HINTS,takebacks:TAKEBACKS,over:null});this.chess=new Chess();this.sel=-1;this.hint=null;this.lastMove=null;this.evalScore=0;this.save();
  const b=this.board3d.get();if(b){b.setRival(this.rival.name);b.setFlipped(color==='b');b.setPosition(this.chess.board);}this.say(this.rival.taunts[0]);this.render();if(!this.mine)this.rivalTurn();}
 tap(sq){if(this.busy||this.s.over||!this.mine)return;const p=this.chess.board[sq];
  if(this.sel>=0){const legal=this.chess.movesFrom(this.sel).filter(m=>m.to===sq);if(legal.length){if(legal[0].promo){this.pendingPromo={from:this.sel,to:sq};$('chessPromo').hidden=false;return;}this.move(this.sel,sq);return;}}
  this.sel=p&&colorOf(p)===this.s.color&&this.sel!==sq?sq:-1;this.io.sound?.(this.sel>=0?520:300,.04,'triangle',.015);this.marks();}
 async move(from,to,promo){const m=this.chess.play({from,to,promo});if(!m)return;this.sel=-1;this.hint=null;this.lastMove=[from,to];this.save();await this.show(m);if(!this.afterMove())this.rivalTurn();}
 // Animates a move just played, plus check, and sounds.
 async show(m){this.busy='anim';this.marks();this.render();const b=this.board3d.get();this.io.sound?.(m.captured?180:420,m.captured?.25:.07,m.captured?'sawtooth':'triangle',m.captured?.035:.02);
  if(b){$('chessSkip').hidden=!m.captured||!this.s.battles;await b.play(m,{battle:this.s.battles,reduced:this.io.prefs?.fx==='low'});$('chessSkip').hidden=true;const st=this.chess.status();if(st==='playing'&&this.chess.inCheck()){this.io.sound?.(880,.25,'square',.03);if(this.s.battles)await b.check(this.chess.king(this.chess.turn));}}
  else this.build2d();this.busy=false;this.marks();this.render();}
 // Ends the game if the last move did; true when it's over.
 afterMove(){const st=this.chess.status();if(st==='playing')return false;if(st==='checkmate'){const loser=this.chess.turn;this.finish(loser===this.s.color?'loss':'win','checkmate');}else this.finish('draw',st);return true;}
 async finish(result,reason){if(this.s.over)return;const moves=Math.ceil(this.chess.history.length/2),score=chessScore(this.s.rival,result,moves),first=result==='win'&&!this.s.beaten.includes(this.rival.id);
  if(first)this.s.beaten.push(this.rival.id);this.s.over={result,reason,score};this.save();const b=this.board3d.get();
  if(b&&reason==='checkmate'){this.busy='anim';await b.checkmate(this.chess.king(this.chess.turn),this.chess.turn==='w'?'b':'w');this.busy=false;}
  this.say(result==='win'?this.rival.win:result==='loss'?this.rival.lose:'A draw. Fair enough.');this.io.record?.('chess',score,first?200:0);[523,659,784].forEach((f,i)=>setTimeout(()=>this.io.sound?.(result==='loss'?f/2:f,.2,'triangle',.03),i*130));this.render();}
 ask(kind){const fen=this.chess.fen(),rival=this.rival;if(this.worker)return new Promise(res=>{const id=++this.jobId;this.jobs.set(id,res);this.worker.postMessage({id,kind,fen,rival});setTimeout(()=>{if(this.jobs.has(id)){this.jobs.delete(id);res(kind==='hint'?hintMove(fen):rivalMove(fen,rival));}},rival.time+6000);});
  return new Promise(res=>setTimeout(()=>res(kind==='hint'?hintMove(fen):rivalMove(fen,rival)),60));}
 async rivalTurn(){if(this.s.over||this.mine)return;this.busy='think';this.render();const started=performance.now(),mv=await this.ask('move');const wait=Math.max(0,600-(performance.now()-started));if(wait)await new Promise(r=>setTimeout(r,wait));
  if(!mv||this.s.over){this.busy=false;this.render();return;}const m=this.chess.play(mv);if(!m){this.busy=false;this.render();return;}this.evalScore=-(mv.score||0);this.lastMove=[mv.from,mv.to];this.save();
  if((m.captured||this.chess.inCheck())&&Math.random()<.5)this.say(this.rival.taunts[Math.floor(Math.random()*this.rival.taunts.length)]);await this.show(m);this.afterMove();this.render();}
 async askHint(){if(this.busy||this.s.over||!this.mine||this.s.hints<=0)return;this.busy='think';this.render();const h=await this.ask('hint');this.busy=false;if(h){this.s.hints--;this.hint=[h.from,h.to];this.save();}this.marks();this.render();}
 takeBack(){if(this.busy||this.s.over||this.s.takebacks<=0||!this.mine||this.chess.history.length<2)return;this.chess.takeBack();this.chess.takeBack();this.s.takebacks--;this.sel=-1;this.hint=null;this.lastMove=this.lastFromHistory();this.save();this.board3d.get()?.setPosition(this.chess.board);this.build2d();this.marks();this.render();}
 say(text){const el=$('chessBubble');el.hidden=!text;$('chessBubbleText').textContent=text||'';clearTimeout(this.sayTimer);if(text){this.sayTimer=setTimeout(()=>{el.hidden=true;},5200);this.sayTimer?.unref?.();}}
 // Board markers for 3D, and the 2D board's classes.
 marks(){const c=this.chess,moves=this.sel>=0?c.movesFrom(this.sel):[],check=c.inCheck()?c.king(c.turn):-1,data={selected:this.sel,moves:moves.filter(m=>!m.captured).map(m=>m.to),captures:moves.filter(m=>m.captured).map(m=>m.to),last:this.lastMove,hint:this.hint,check};
  this.board3d.get()?.marks(data);for(const btn of this.squares||[]){const s=Number(btn.dataset.sq);btn.classList.toggle('sel',s===data.selected);btn.classList.toggle('to',data.moves.includes(s));btn.classList.toggle('cap',data.captures.includes(s));btn.classList.toggle('last',!!data.last?.includes(s));btn.classList.toggle('hint',!!data.hint?.includes(s));btn.classList.toggle('check',s===check);}}
 build2d(){const box=$('chessBoard2d');if(!box)return;const flip=this.s.color==='b';this.squares=[];box.replaceChildren();for(let i=0;i<64;i++){const s=flip?63-i:i,p=this.chess.board[s],b=document.createElement('button');b.type='button';b.dataset.sq=String(s);b.className='sq '+(((s>>3)+(s&7))%2?'dark':'light')+(p?' '+(colorOf(p)==='w'?'pw':'pb'):'');b.textContent=p?GLYPH[p]:'';b.setAttribute('aria-label',sqName(s)+(p?' '+p:''));this.squares.push(b);box.append(b);}this.marks();}
 render(){const s=this.s,r=this.rival,c=this.chess,over=s.over;
  $('chessRivalName').textContent=r.name;$('chessRivalTitle').textContent=`${r.title} · ${r.rating}`;
  $('chessLadder').replaceChildren(...RIVALS.map((rv,i)=>{const b=document.createElement('button');b.type='button';b.dataset.rival=String(i);const open=i===0||s.beaten.includes(RIVALS[i-1].id),beat=s.beaten.includes(rv.id);b.disabled=!open||!!this.busy;b.className='chess-rung'+(i===s.rival?' current':'')+(beat?' beaten':'');b.setAttribute('aria-pressed',String(i===s.rival));
   const n=document.createElement('strong');n.textContent=(beat?'✓ ':open?'':'🔒 ')+rv.name;const t=document.createElement('small');t.textContent=rv.title+' · '+rv.rating;b.append(n,t);return b;}));
  for(const b of $('chessColor').querySelectorAll('[data-color]'))b.setAttribute('aria-pressed',String(b.dataset.color===s.color));
  const pairs=[];c.history.forEach((h,i)=>{if(i%2===0)pairs.push([h.san]);else pairs.at(-1).push(h.san);});$('chessMoves').replaceChildren(...pairs.map(p=>{const li=document.createElement('li');li.textContent=p.join('  ');return li;}));$('chessMoves').scrollTop=1e6;
  const lost={w:[],b:[]};const count=(set,p)=>set.filter(x=>x===p).length;const full='PPPPPPPPNNBBRRQ'.split('');for(const col of ['w','b']){const have=c.board.filter(p=>p&&colorOf(p)===col);for(const p of new Set(full)){const want=count(full,p),pc=col==='w'?p:p.toLowerCase();for(let i=count(have,pc);i<want;i++)lost[col].push(GLYPH[pc]);}}
  $('chessCaptured').textContent=(lost.b.join('')||'—')+'   ·   '+(lost.w.join('')||'—');
  $('chessHint').textContent=`HINT (${s.hints})`;$('chessUndo').textContent=`TAKE BACK (${s.takebacks})`;$('chessHint').disabled=!!this.busy||!!over||!this.mine||s.hints<=0;$('chessUndo').disabled=!!this.busy||!!over||!this.mine||s.takebacks<=0||c.history.length<2;$('chessResign').disabled=!!over||!!this.busy;
  $('chessView').textContent=s.view==='top'?'VIEW: TOP':'VIEW: 3D';$('chessBattles').textContent=s.battles?'BATTLES: EPIC':'BATTLES: OFF';$('chessBattles').setAttribute('aria-pressed',String(s.battles));
  const st=c.status();$('chessStatus').textContent=over?(over.result==='win'?'You win':over.result==='loss'?'You lose':'Draw')+' · '+REASON[over.reason]:this.busy==='think'?`${r.name} is thinking…`:this.mine?(c.inCheck()?'Check! Your move':'Your move'):`${r.name}'s move`;
  const white=Math.max(-1,Math.min(1,(c.turn==='w'?1:-1)*0+(this.s.color==='w'?this.evalScore:-this.evalScore)/800));$('chessEval').style.setProperty?.('--adv',String((white+1)/2));
  $('chessOver').hidden=!over;if(over){$('chessOverKicker').textContent=REASON[over.reason].toUpperCase();$('chessOverTitle').textContent=over.result==='win'?`You beat ${r.name}!`:over.result==='loss'?`${r.name} wins`:'A draw';$('chessOverText').textContent=over.result==='win'?(s.rival<RIVALS.length-1?`${RIVALS[s.rival+1].name} is waiting. ${over.score.toLocaleString('en-US')} points.`:`You beat the whole ladder. ${over.score.toLocaleString('en-US')} points.`):over.result==='draw'?`${over.score.toLocaleString('en-US')} points for holding your own.`:'Rematch, or take a step back down the ladder.';
   $('chessNext').hidden=over.result!=='win'||s.rival>=RIVALS.length-1;$('chessShareBtn').hidden=over.result==='loss';}
  if(!this.board3d.get()&&this.renderedFen!==c.fen()){this.renderedFen=c.fen();this.build2d();}}
 frame(now,{reduced}={}){const b=this.board3d.get();if(b){if(b.rivalName!==this.rival.name)b.setRival(this.rival.name);try{b.frame(now,{reduced});}catch(e){if(!this.frameError){this.frameError=e;console.error('chess 3d',e);}}}}
}
