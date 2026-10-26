import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess,START,perft,sqIndex,sqName} from '../dist/chess-engine.js';
import {RIVALS,Searcher,rivalMove,chessScore,evaluate} from '../dist/chess-ai.js';
import {validChessSave} from '../dist/chess-play.js';

const mv=(c,s)=>c.play({from:sqIndex(s.slice(0,2)),to:sqIndex(s.slice(2,4)),promo:s[4]});

test('Move generation is exact on the standard perft positions',()=>{
 const cases=[[START,[20,400,8902]],['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',[48,2039]],['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',[14,191,2812]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',[6,264]],['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',[44,1486]]];
 for(const [fen,want] of cases){const c=new Chess(fen);assert.deepEqual(want.map((_,i)=>perft(c,i+1)),want,fen);assert.equal(c.fen(),fen,'search leaves the position untouched');}
});

test('Special moves, notation and every way a game ends',()=>{
 let c=new Chess();for(const m of ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','e1g1'])assert.ok(mv(c,m),m);assert.equal(c.history.at(-1).san,'O-O');assert.equal(c.board[sqIndex('f1')],'R');assert.ok(!c.castling.includes('K'));
 c=new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');const ep=mv(c,'e5d6');assert.equal(ep.san,'exd6');assert.equal(c.board[sqIndex('d5')],null,'en passant removes the pawn');
 c=new Chess('4k3/1P6/8/8/8/8/8/4K3 w - - 0 1');const pr=mv(c,'b7b8n');assert.equal(pr.san,'b8=N');assert.equal(c.board[sqIndex('b8')],'N');
 c=new Chess();for(const m of ['f2f3','e7e5','g2g4','d8h4'])mv(c,m);assert.equal(c.status(),'checkmate');assert.equal(c.history.at(-1).san,'Qh4#');
 assert.equal(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').status(),'stalemate');assert.equal(new Chess('8/8/4k3/8/8/2K5/5N2/8 w - - 0 1').status(),'material');assert.equal(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 100 80').status(),'fifty');
 c=new Chess();for(let i=0;i<2;i++)for(const m of ['g1f3','g8f6','f3g1','f6g8'])mv(c,m);assert.equal(c.status(),'repetition');
 c=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');const ns=c.moves().filter(m=>m.to===sqIndex('d1')&&m.piece==='R');assert.equal(ns.length,1);
 c=new Chess('k7/8/8/8/8/8/8/R6R w - - 0 1');assert.equal(c.san(c.moves().find(m=>m.from===sqIndex('a1')&&m.to===sqIndex('d1'))),'Rad1','disambiguates rooks on the same rank');
 assert.equal(mv(new Chess(),'e2e5'),null,'illegal moves are refused');
});

test('Saves are the start plus moves, and rebuild the same position; bad ones are refused',()=>{
 const c=new Chess();for(const m of ['e2e4','c7c5','g1f3','d7d6'])mv(c,m);const s=c.save(START),r=Chess.restore(s);assert.equal(r.fen(),c.fen());assert.equal(r.history.length,4);
 assert.equal(Chess.restore({start:START,moves:['e2e5']}),null);assert.equal(Chess.restore({start:START,moves:['zz']}),null);
 c.takeBack();assert.equal(c.history.length,3);assert.equal(c.turn,'b');
 const ok={v:1,rival:0,color:'w',start:START,moves:['e2e4'],beaten:[],hints:3,takebacks:3,battles:true,view:'3d',over:null};assert.ok(validChessSave(ok));
 for(const bad of [{...ok,rival:9},{...ok,moves:['e2e5']},{...ok,beaten:['nobody']},{...ok,hints:99},{...ok,color:'x'}])assert.equal(validChessSave(bad),false);
});

test('The rivals find mates and free material, and the ladder gets stronger',()=>{
 const mate=new Chess('r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1'),r=new Searcher(mate,{time:1500}).run();assert.equal(sqName(r.move.from)+sqName(r.move.to),'h5f7');
 const free=new Chess('4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1');const f=new Searcher(free,{time:600}).run();assert.equal(sqName(f.move.to),'d5','takes a hanging queen');
 assert.ok(RIVALS.every((rv,i)=>!i||rv.rating>RIVALS[i-1].rating&&rv.time>=RIVALS[i-1].time));
 const m=rivalMove(START,{...RIVALS[0],time:50},()=>.99);assert.ok(m&&new Chess().moves().some(x=>x.from===m.from&&x.to===m.to));
 // A strong rival beats a weak one.
 let c=new Chess(),plies=0;while(c.status()==='playing'&&plies<120){const rv=c.turn==='w'?{...RIVALS[3],time:40,depth:3}:{...RIVALS[0],time:15};c.play(rivalMove(c.fen(),rv,Math.random));plies++;}
 assert.notEqual(c.status()==='checkmate'&&c.turn==='w','white lost',true);assert.ok(evaluate(c)!==undefined);
 assert.ok(chessScore(4,'win',30)>chessScore(0,'win',30));assert.equal(chessScore(2,'loss',40),0);assert.ok(chessScore(1,'draw',50)>0);
});
