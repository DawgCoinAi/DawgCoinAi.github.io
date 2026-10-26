// The DAWG Chess opponents: negamax with alpha-beta, quiescence on captures, iterative deepening
// against a time budget, and move ordering by captures, killers and the last best line. Piece
// values and square tables are tapered from middlegame to endgame. Each rival is a budget plus
// a habit of human-ish mistakes.
import {Chess,colorOf,sqName} from './chess-engine.js';

const VALUE={p:100,n:320,b:330,r:500,q:900,k:0};
// Square tables from white's side, a8 first (index 0); black reads them mirrored.
const PST={
 p:[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
 n:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
 b:[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
 r:[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
 q:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
 k:[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20],
 kEnd:[-50,-40,-30,-20,-20,-30,-40,-50,-30,-20,-10,0,0,-10,-20,-30,-30,-10,20,30,30,20,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,20,30,30,20,-10,-30,-30,-30,0,0,0,0,-30,-30,-50,-30,-30,-30,-30,-30,-30,-50]};
// Static evaluation from the side to move's point of view.
export function evaluate(c){let mat=0,score=0;for(const p of c.board)if(p&&!'pPkK'.includes(p))mat+=VALUE[p.toLowerCase()];const endgame=mat<=2600;
 for(let s=0;s<64;s++){const p=c.board[s];if(!p)continue;const t=p.toLowerCase(),w=colorOf(p)==='w',i=w?s:(7-(s>>3))*8+(s&7),table=t==='k'&&endgame?PST.kEnd:PST[t];score+=(w?1:-1)*(VALUE[t]+table[i]);}
 return c.turn==='w'?score:-score;}
const MATE=100000;
export const RIVALS=[
 {id:'pup',name:'Pup Pawnsworth',title:'Eager rookie',rating:600,depth:1,time:250,blunder:.35,coat:2,taunts:['Ooh, is that a good move? I can never tell!','I like the horsey pieces best.','Wait, which way do the bishops go?'],win:'You win! Can we play again? Please?',lose:'I won?! I WON! Mom! MOM!'},
 {id:'biscuit',name:'Biscuit',title:'Coffee-shop hustler',rating:1000,depth:2,time:500,blunder:.12,coat:5,taunts:['Careful. I play here every morning.','That pawn looks lonely.','Your move, sugar.'],win:'Well played. Coffee is on me.',lose:'Pay the lady. Next customer!'},
 {id:'duchess',name:'Duchess',title:'Club champion',rating:1400,depth:3,time:900,blunder:.04,coat:9,taunts:['How quaint.','I have seen this opening. In a museum.','Do take your time. I have all night.'],win:'Hm. Fine. You may have the trophy.',lose:'Checkmate, darling. Do try again.'},
 {id:'brick',name:'Brick',title:'The bouncer who reads',rating:1700,depth:5,time:1400,blunder:0,coat:8,taunts:['…','You are not on the list.','I see what you are doing. Stop.'],win:'Respect. You can come in.',lose:'Bounced.'},
 {id:'grand',name:'The Grand DAWG',title:'Undefeated',rating:2000,depth:7,time:2600,blunder:0,coat:11,taunts:['Interesting.','Every move tells me who you are.','The board remembers everything.'],win:'At last. A worthy opponent.',lose:'Again, when you are ready.'}
];
// Points for a result against a rival: wins pay most, draws something, quick wins a bonus.
export function chessScore(rivalIndex,result,moves){const base=(rivalIndex+1)*500;return result==='win'?base+Math.max(0,(80-moves)*5)*(rivalIndex+1):result==='draw'?Math.round(base/4):0;}

export class Searcher {
 constructor(c,{time=1000,depth=64,random=Math.random}={}){this.c=c;this.time=time;this.maxDepth=depth;this.random=random;this.killers=[];this.nodes=0;}
 order(moves,ply,best){const k=this.killers[ply]||[];return moves.map(m=>{let s=0;if(best&&m.from===best.from&&m.to===best.to&&m.promo===best.promo)s=1e6;else if(m.captured)s=1e4+VALUE[m.captured.toLowerCase()]*10-VALUE[m.piece.toLowerCase()];else if(m.promo)s=9000;else if(k.some(x=>x.from===m.from&&x.to===m.to))s=5000;return [s,m];}).sort((a,b)=>b[0]-a[0]).map(x=>x[1]);}
 quiesce(alpha,beta,depth=0){this.nodes++;const stand=evaluate(this.c);if(stand>=beta)return beta;if(stand>alpha)alpha=stand;if(depth>6)return alpha;
  const caps=this.order(this.c.moves().filter(m=>m.captured||m.promo),99);for(const m of caps){const u=this.c.make(m),v=-this.quiesce(-beta,-alpha,depth+1);this.c.unmake(u);if(v>=beta)return beta;if(v>alpha)alpha=v;}return alpha;}
 search(depth,alpha,beta,ply){if((++this.nodes&1023)===0&&performance.now()>this.deadline)throw this.stop;
  const moves=this.c.moves();if(!moves.length)return this.c.inCheck()?-MATE+ply:0;if(ply&&(this.c.half>=100||this.c.insufficient()))return 0;
  if(depth<=0)return this.quiesce(alpha,beta);let best=-Infinity;
  for(const m of this.order(moves,ply,ply===0?this.pv:null)){const u=this.c.make(m),v=-this.search(depth-1,-beta,-alpha,ply+1);this.c.unmake(u);
   if(v>best){best=v;if(ply===0)this.rootBest=m;}if(v>alpha)alpha=v;if(alpha>=beta){if(!m.captured){const k=this.killers[ply]||=[];k.unshift(m);k.length=2;}break;}}
  return best;}
 // Best move found within the budget, deepening one ply at a time.
 run(){this.deadline=performance.now()+this.time;this.stop=new Error('time');let best=null,score=0,depth=0;
  for(let d=1;d<=this.maxDepth;d++){this.rootBest=null;try{const v=this.search(d,-Infinity,Infinity,0);best=this.rootBest||best;score=v;depth=d;this.pv=best;if(Math.abs(v)>MATE-100)break;}catch(e){if(e!==this.stop)throw e;break;}if(performance.now()>this.deadline)break;}
  return {move:best,score,depth,nodes:this.nodes};}
}
// The rival's move for a position: the search's choice, or now and then a plausible slip.
// A few sound first moves, so games don't all open the same way.
const BOOK={w:['e2e4','d2d4','g1f3','c2c4','e2e4','d2d4'],b:['e7e5','c7c5','e7e6','d7d5','g8f6','c7c6']};
export function rivalMove(fen,rival,random=Math.random){const c=new Chess(fen),moves=c.moves();if(!moves.length)return null;
 if(c.full===1){const book=BOOK[c.turn].map(x=>moves.find(m=>sqName(m.from)+sqName(m.to)===x)).filter(Boolean);if(book.length&&random()<.85){const m=book[Math.floor(random()*book.length)];return {from:m.from,to:m.to,promo:null,score:0,depth:0};}}
 const r=new Searcher(c,{time:rival.time,depth:rival.depth,random}).run();let m=r.move||moves[0];
 if(rival.blunder&&random()<rival.blunder){// A slip: a random move that at least doesn't hang mate in one.
  const safe=moves.filter(x=>{const u=c.make(x),mate=c.moves().some(y=>{const v=c.make(y),mt=c.moves().length===0&&c.inCheck();c.unmake(v);return mt;});c.unmake(u);return !mate;});if(safe.length)m=safe[Math.floor(random()*safe.length)];}
 return {from:m.from,to:m.to,promo:m.promo||null,score:r.score,depth:r.depth};}
// A hint: a short, fixed search from the player's side.
export function hintMove(fen){const c=new Chess(fen);const r=new Searcher(c,{time:700,depth:4}).run();return r.move?{from:r.move.from,to:r.move.to,promo:r.move.promo||null}:null;}
