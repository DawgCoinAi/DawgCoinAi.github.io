// DAWG Chess depth: who the five rivals are (look, manner, signature opening), the feats a player
// can earn, the daily mate puzzle, and the line a result is bragged with. Pure: no DOM, no clock
// (the day is passed in), so everything here is tested.
import {Chess,sqIndex,sqName,colorOf} from './chess-engine.js';

// ── The ladder: each rival is a character with a look, a manner and an opening it always reaches for ──
// `white` / `black` are the rival's own first moves, played while they are legal and nothing has been taken.
export const RIVAL_LORE={
 pup:{look:'Oversized helmet, tail never stops',manner:'Narrates every move out loud',opening:'The Pawn Parade',white:['h2h4','a2a4','h4h5'],black:['h7h5','a7a5','h5h4']},
 biscuit:{look:'Apron, espresso, a clock she slaps too hard',manner:'Sweet talk, sharp traps',opening:'The Espresso Gambit',white:['e2e4','f2f4','g1f3','f1c4'],black:['e7e5','b8c6','g8f6','f8c5']},
 duchess:{look:'Pearls, long ears, one raised eyebrow',manner:'Withering politeness',opening:'The Drawing Room',white:['d2d4','c2c4','b1c3','g1f3'],black:['e7e6','d7d5','g8f6','f8e7']},
 brick:{look:'Dinner jacket two sizes small, reading glasses',manner:'Says almost nothing',opening:'The Wall',white:['d2d4','e2e3','f2f4','g1f3','f1d3'],black:['e7e6','d7d5','f7f5','g8f6','f8d6']},
 grand:{look:'Silver muzzle, cape, never blinks',manner:'Speaks in riddles about you',opening:'The Old Road',white:['e2e4','g1f3','f1b5','e1g1'],black:['c7c5','d7d6','g8f6','b8c6']}};

/** The rival's signature-opening move in this position, or null once the game has left the book. */
export function bookMove(chess,rivalId){const lore=RIVAL_LORE[rivalId];if(!lore||chess.inCheck()||chess.history.some(h=>h.m.captured))return null;
 const line=lore[chess.turn==='w'?'white':'black'],n=Math.floor(chess.history.length/2);if(n>=line.length)return null;
 const from=sqIndex(line[n].slice(0,2)),to=sqIndex(line[n].slice(2,4)),m=chess.movesFrom(from).find(x=>x.to===to);if(!m)return null;
 // Not if it simply hangs the piece to a pawn or walks into a capture of something bigger than it takes.
 const u=chess.make(m),bad=chess.moves().some(r=>r.to===to&&r.captured);chess.unmake(u);return bad?null:{from,to};}

// ── Feats ───────────────────────────────────────────────────────────────────────────────────
// `g` is the game so far: {history:[{piece,captured,promo,flag,san}], color, result ('win'|'loss'|'draw'|null),
// board, beaten:[rival ids], rivals (how many there are), hintsUsed, takebacksUsed, puzzle (true when a daily was solved)}.
const mine=(g,i)=>(i%2===0)===(g.first===g.color),won=g=>g.result==='win'&&!g.puzzle,myMoves=g=>g.history.filter((_,i)=>mine(g,i));
const Q=g=>g.color==='w'?'Q':'q';
export const FEATS=[
 {id:'chess.win',name:'First Crown',text:'Beat a rival',test:g=>won(g)},
 {id:'chess.mini',name:'Miniature',text:'Checkmate a rival in under 20 moves',test:g=>won(g)&&g.history.at(-1)?.san.endsWith('#')&&Math.ceil(g.history.length/2)<20},
 {id:'chess.promote',name:'Coronation',text:'Promote a pawn',test:g=>myMoves(g).some(h=>h.promo)},
 {id:'chess.passant',name:'In Passing',text:'Capture en passant',test:g=>myMoves(g).some(h=>h.flag==='e')},
 {id:'chess.castle',name:'Safe House',text:'Castle, then win',test:g=>won(g)&&myMoves(g).some(h=>h.flag==='k'||h.flag==='q')},
 {id:'chess.sac',name:'Queen Sacrifice',text:'Win after giving up your queen without taking theirs',test:g=>won(g)&&g.history.some((h,i)=>!mine(g,i)&&h.captured===Q(g)&&(g.history[i-1]?.captured||'').toLowerCase()!=='q'&&(g.history[i+1]?.captured||'').toLowerCase()!=='q')},
 {id:'chess.knightmate',name:'Hound’s Tooth',text:'Deliver checkmate with a knight',test:g=>won(g)&&/^N.*#$/.test(g.history.at(-1)?.san||'')},
 {id:'chess.pawnmate',name:'Peasant’s Revolt',text:'Deliver checkmate with a pawn',test:g=>won(g)&&/^[a-h].*#$/.test(g.history.at(-1)?.san||'')},
 {id:'chess.fullhouse',name:'Full House',text:'Win with a queen, rook, bishop, knight and pawn still standing',test:g=>won(g)&&'qrbnp'.split('').every(t=>g.board.includes(g.color==='w'?t.toUpperCase():t))},
 {id:'chess.nohelp',name:'No Training Wheels',text:'Win without a hint or a take-back',test:g=>won(g)&&!g.hintsUsed&&!g.takebacksUsed},
 {id:'chess.ladder',name:'Top DAWG',text:'Beat all five rivals',test:g=>g.rivals>0&&(g.beaten||[]).length>=g.rivals},
 {id:'chess.puzzle',name:'Daily Solver',text:'Solve the daily puzzle',test:g=>!!g.puzzle},
 {id:'chess.puzzle1',name:'First Glance',text:'Solve the daily puzzle on the first try',test:g=>!!g.puzzle&&g.tries===0}];
export const FEAT_IDS=FEATS.map(f=>f.id);
/** The ids of every feat this game has earned so far. */
export function earnedFeats(g){const game={first:'w',history:[],board:[],...g};return FEATS.filter(f=>{try{return !!f.test(game);}catch{return false;}}).map(f=>f.id);}
/** A saved feats list is an array of known ids with no repeats (or absent). */
export const validFeats=v=>v===undefined||Array.isArray(v)&&v.every(id=>FEAT_IDS.includes(id))&&new Set(v).size===v.length;

// ── The result line: one specific fact worth showing someone ──
const PIECE={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
export function resultLine(g){const game={first:'w',history:[],...g},moves=Math.ceil(game.history.length/2),last=game.history.at(-1),took=myMoves(game).filter(h=>h.captured).length,lost=game.history.filter((h,i)=>!mine(game,i)&&h.captured).length;
 if(game.puzzle)return `Solved the daily mate in ${game.mate}${game.tries?` after ${game.tries} wrong ${game.tries===1?'try':'tries'}`:' at first glance'}`;
 if(game.result==='win'){const by=last?.san.endsWith('#')?`Checkmate in ${moves} with a ${PIECE[(last.promo||last.piece).toLowerCase()]}`:`Won in ${moves} moves`;return by+(lost===0?', without losing a piece':earnedFeats(game).includes('chess.sac')?', after sacrificing the queen':`, ${took} taken for ${lost} lost`);}
 if(game.result==='draw')return `Held the draw for ${moves} moves`;return `Lasted ${moves} moves and took ${took}`;}

// ── The daily puzzle ────────────────────────────────────────────────────────────────────────
/** A move with which the side to move forces mate within n moves, or null. */
export function mateIn(c,n){for(const m of c.moves()){const u=c.make(m),replies=c.moves();let ok;
  if(!replies.length)ok=c.inCheck();else if(n<=1)ok=false;else ok=replies.every(r=>{const u2=c.make(r),w=!!mateIn(c,n-1);c.unmake(u2);return w;});
  c.unmake(u);if(ok)return m;}return null;}
/** After the solver's move: the defender's reply if mate is still forced within `left` more moves, else null (wrong move). */
export function puzzleReply(c,left){const replies=c.moves();if(!replies.length||left<1)return null;let pick=null;for(const r of replies){const u=c.make(r),w=!!mateIn(c,left);c.unmake(u);if(!w)return null;pick=pick||r;}return pick;}
// Hand-picked positions, each checked by test to be a forced mate in exactly `mate`.
export const PUZZLES=[
 {fen:'6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',mate:1,title:'The Back Door'},
 {fen:'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',mate:1,title:'Scholar’s Lesson'},
 {fen:'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',mate:1,title:'Fool Me Once'},
 {fen:'6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',mate:1,title:'No Room to Breathe'},
 {fen:'1k6/ppp5/8/8/8/8/8/K2R4 w - - 0 1',mate:1,title:'Top Shelf'},
 {fen:'5rk1/6p1/6P1/7Q/8/8/8/6K1 w - - 0 1',mate:1,title:'The Wedge'},
 {fen:'7k/8/5K2/8/8/8/8/6Q1 w - - 0 1',mate:1,title:'Kiss Goodnight'},
 {fen:'kbK5/pp6/1P6/8/8/8/8/R7 w - - 0 1',mate:2,title:'The Quiet Rook'},
 {fen:'7k/8/8/8/8/8/R7/1R4K1 w - - 0 1',mate:2,title:'The Ladder'},
 {fen:'R7/8/8/8/8/5K2/8/7k w - - 0 1',mate:2,title:'Cornered'},
 {fen:'r2qkbnr/ppp2ppp/2np4/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 1',mate:2,title:'A Legal Trick'},
 {fen:'4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 1',mate:2,title:'A Night at the Opera'},
 {fen:'r5k1/5ppp/8/8/8/8/4RPPP/4R1K1 w - - 0 1',mate:2,title:'Two on the File'}];
/** The day number for a date string 'YYYY-MM-DD' (days since 1970). */
export const dayNumber=key=>Math.floor(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7))-1,Number(key.slice(8,10)))/864e5);
/** Today's puzzle: the same for everyone on the same date. */
export function dailyPuzzle(key){const n=dayNumber(key),i=((n*7+3)%PUZZLES.length+PUZZLES.length)%PUZZLES.length;return {...PUZZLES[i],day:key,index:i};}
export {sqName,colorOf,Chess};
