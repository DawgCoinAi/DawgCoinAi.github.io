import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TYPES,ATTACKERS,VICTIMS,SPECIALS,matchup,variantIndex,battleMode,nextBattleMode,boardMismatch,checkers} from '../dist/chess-fights.js';
import {FEATS,FEAT_IDS,earnedFeats,validFeats,resultLine,PUZZLES,mateIn,puzzleReply,dailyPuzzle,RIVAL_LORE,bookMove} from '../dist/chess-feats.js';
import {Chess,START,sqIndex} from '../dist/chess-engine.js';

const mv=(c,s)=>c.play({from:sqIndex(s.slice(0,2)),to:sqIndex(s.slice(2,4)),promo:s[4]});
const facts=(c,color,extra={})=>({history:c.history.map(h=>({piece:h.m.piece,captured:h.m.captured,promo:h.m.promo,flag:h.m.flag,san:h.san})),color,board:c.board,rivals:5,beaten:[],hintsUsed:0,takebacksUsed:0,result:null,...extra});

test('All 36 matchups are defined and each is its own scene',()=>{
 const seen=new Set(),titles=new Set(),twists=new Set();
 for(const a of TYPES)for(const v of TYPES){const m=matchup(a,v,0),m2=matchup(a,v,1);assert.ok(m&&m.title&&m.card,a+v);assert.equal(m.id,a+'x'+v);
  assert.notEqual(m.attack,m2.attack,'two variants per attacker');assert.equal(m.brace,VICTIMS[v].brace);assert.equal(m.defeat,VICTIMS[v].defeat);
  seen.add([m.attack,m.brace,m.twist,m.defeat].join('|'));seen.add([m2.attack,m2.brace,m2.twist,m2.defeat].join('|'));titles.add(m.title);twists.add(m.twist);assert.equal(m.beats.length,6);}
 assert.equal(seen.size,72,'36 pairings x 2 variants, all different');assert.equal(titles.size,36);assert.equal(twists.size,36);
 assert.equal(matchup('x','p'),null);assert.equal(variantIndex(.99),1);assert.equal(variantIndex(.2),0);assert.equal(variantIndex(3),1);assert.equal(variantIndex(NaN),0);
 for(const a of TYPES)assert.equal(new Set(ATTACKERS[a].variants).size,2);
 assert.equal(new Set(TYPES.split('').flatMap(a=>ATTACKERS[a].variants)).size,12,'no attack is shared');
 assert.equal(new Set(TYPES.split('').map(v=>VICTIMS[v].defeat)).size,6);assert.equal(new Set(TYPES.split('').map(v=>VICTIMS[v].brace)).size,6);
});

test('Special scenes are defined, and every routine in the fight book exists in the choreography',()=>{
 for(const k of ['enpassant','promotion','castleShort','castleLong','check','checkmate']){assert.ok(SPECIALS[k].title&&SPECIALS[k].beats.length>=2,k);}
 assert.equal(new Set(Object.values(SPECIALS).map(s=>s.beats.join())).size,6);
 const src=readFileSync(new URL('../dist/chess-battle.js',import.meta.url),'utf8'),has=n=>src.includes(` async '${n}'(X)`)||src.includes(` async ${n}(X)`);
 for(const a of TYPES){for(const v of ATTACKERS[a].variants)assert.ok(has(v),'attack '+v);assert.ok(has(ATTACKERS[a].victory),'victory '+ATTACKERS[a].victory);assert.ok(has(VICTIMS[a].brace),'brace '+VICTIMS[a].brace);assert.ok(has(VICTIMS[a].defeat),'defeat '+VICTIMS[a].defeat);}
 for(const dmg of ['pierce','trample','arcane','crush','slash'])assert.ok(src.includes(`dmg==='${dmg}'`),'twist '+dmg);
 for(const f of ['enPassant','promotion','castling','checkScene','checkmateScene'])assert.ok(src.includes('export async function '+f+'('),f);
});

test('The battles setting reads old saves, and the board guard spots any drift',()=>{
 assert.equal(battleMode(true),'full');assert.equal(battleMode(undefined),'full');assert.equal(battleMode(false),'off');assert.equal(battleMode('quick'),'quick');assert.equal(battleMode('off'),'off');
 assert.equal(nextBattleMode(true),'quick');assert.equal(nextBattleMode('quick'),'off');assert.equal(nextBattleMode(false),'full');
 const c=new Chess(),shown=new Map();c.board.forEach((p,s)=>{if(p)shown.set(s,p);});assert.deepEqual(boardMismatch(shown,c.board),[]);
 mv(c,'e2e4');assert.deepEqual(boardMismatch(shown,c.board).sort((a,b)=>a-b),[sqIndex('e4'),sqIndex('e2')].sort((a,b)=>a-b));
 const k=new Chess('4k3/8/8/8/8/8/4R3/4K2B b - - 0 1');assert.deepEqual(checkers(k.pseudo('w'),k.king('b')),[sqIndex('e2')]);
});

test('Every feat can be earned, and nothing is earned by a blank game',()=>{
 assert.ok(FEATS.length>=8);assert.equal(new Set(FEAT_IDS).size,FEATS.length);assert.ok(FEAT_IDS.every(id=>/^chess\.[a-z0-9]+$/.test(id)));
 assert.deepEqual(earnedFeats(facts(new Chess(),'w')),[]);const got=new Set();const add=g=>{for(const id of earnedFeats(g))got.add(id);return earnedFeats(g);};
 // Scholar's mate: a win, a miniature, no help, a full house.
 let c=new Chess();for(const m of ['e2e4','e7e5','d1h5','b8c6','f1c4','g8f6','h5f7'])assert.ok(mv(c,m),m);assert.equal(c.status(),'checkmate');
 const s=add(facts(c,'w',{result:'win'}));for(const id of ['chess.win','chess.mini','chess.nohelp','chess.fullhouse'])assert.ok(s.includes(id),id);assert.ok(!earnedFeats(facts(c,'b',{result:'loss'})).includes('chess.win'));
 assert.ok(!earnedFeats(facts(c,'w',{result:'win',hintsUsed:1})).includes('chess.nohelp'));
 // Promotion and en passant are earned the moment they happen.
 c=new Chess('4k3/1P6/8/8/8/8/8/4K3 w - - 0 1');mv(c,'b7b8q');assert.ok(add(facts(c,'w')).includes('chess.promote'));
 c=new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');mv(c,'e5d6');assert.ok(add(facts(c,'w')).includes('chess.passant'));
 // Castle then win.
 c=new Chess();for(const m of ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','e1g1'])mv(c,m);assert.ok(add(facts(c,'w',{result:'win'})).includes('chess.castle'));assert.ok(!earnedFeats(facts(c,'w')).includes('chess.castle'));
 // A queen given up for nothing, then a win.
 c=new Chess('6k1/5ppp/8/8/8/8/3q1PPP/3Q2K1 w - - 0 1');mv(c,'d1d2');assert.ok(!earnedFeats(facts(c,'w',{result:'win'})).includes('chess.sac'),'a trade is not a sacrifice');
 c=new Chess('r5k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1');mv(c,'d1a1');mv(c,'a8a1');assert.ok(add(facts(c,'w',{result:'win'})).includes('chess.sac'));
 // Mates by knight and by pawn.
 c=new Chess('6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1');mv(c,'g5f7');assert.equal(c.status(),'checkmate');assert.ok(add(facts(c,'w',{result:'win'})).includes('chess.knightmate'));
 c=new Chess('7k/5K1p/6P1/8/8/8/8/8 w - - 0 1');mv(c,'g6g7');assert.equal(c.status(),'checkmate');assert.ok(add(facts(c,'w',{result:'win'})).includes('chess.pawnmate'));
 add(facts(new Chess(),'w',{beaten:['pup','biscuit','duchess','brick','grand']}));add(facts(new Chess(),'w',{puzzle:true,tries:0,result:'win'}));
 assert.deepEqual([...got].sort(),[...FEAT_IDS].sort(),'every feat was earned by one of the games above');
 assert.ok(validFeats(undefined));assert.ok(validFeats(['chess.win','chess.mini']));assert.equal(validFeats(['chess.win','chess.win']),false);assert.equal(validFeats(['nope']),false);assert.equal(validFeats('
