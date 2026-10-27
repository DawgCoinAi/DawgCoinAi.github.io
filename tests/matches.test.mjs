import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MATCH_GAMES,isMatchGame,myTurn,matchState,needsYou,shown,summary} from '../dist/matches.js';
import {GAME_IDS} from '../dist/games.js';
import {QUICK_MODES} from '../dist/pack-checkpoint.js';

const sql=fs.readFileSync(new URL('../supabase/migrations/20261027000000_matches.sql',import.meta.url),'utf8');
const base={id:1,role:'from',player:'Nova',game:'runner',seed:42,my_score:null,their_score:null,moves:[],status:'open',seen:true};

test('Matches cover every game with a repeatable course, plus chess',()=>{
 for(const id of MATCH_GAMES)assert.ok(GAME_IDS.includes(id),id);
 for(const id of MATCH_GAMES)if(id!=='chess')assert.ok(QUICK_MODES.includes(id)||['classic','rush'].includes(id),id+' can be seeded');
 assert.ok(!isMatchGame('trade')&&!isMatchGame('story')&&!isMatchGame('daily'));
 const list=sql.match(/p_game not in \(([^)]+)\)/)[1].split(',').map(s=>s.trim().replace(/'/g,''));assert.deepEqual(list.sort(),[...MATCH_GAMES].sort(),'the server accepts the same games');
});

test('Whose turn it is, and what the inbox says',()=>{
 assert.equal(myTurn(base),true);assert.equal(matchState(base).key,'yours');
 const played={...base,my_score:900};assert.equal(myTurn(played),false);assert.equal(matchState(played).label,'WAITING ON THEM');
 const chessW={...base,game:'chess',moves:[]},chessB={...chessW,role:'to'};assert.ok(myTurn(chessW));assert.ok(!myTurn(chessB));assert.ok(myTurn({...chessB,moves:['e2e4']}));
 assert.equal(matchState({...base,status:'done',outcome:'win'}).key,'won');assert.equal(matchState({...base,status:'done',outcome:'loss'}).label,'THEY WON');assert.equal(matchState({...base,status:'declined'}).key,'declined');
 assert.equal(needsYou([base,played,{...played,status:'done',outcome:'win',seen:false},{...played,status:'done',outcome:'win',seen:true}]),2);
});

test('Their score stays hidden until you have played',()=>{
 assert.equal(shown({...base,their_score:1234}).their_score,null);assert.equal(shown({...base,my_score:10,their_score:1234}).their_score,1234);
 assert.match(summary({...base,their_score:500}),/same course/);assert.match(summary({...base,game:'chess',moves:['e2e4','e7e5']}),/move 2/);
});

test('The server sets matches up safely',()=>{
 assert.match(sql,/enable row level security/);assert.match(sql,/revoke insert, update, delete on public\.matches from anon, authenticated/);
 assert.match(sql,/create policy matches_read on public\.matches for select using \(auth\.uid\(\) in \(from_id, to_id\)\)/);
 for(const f of ['create_match','my_matches','submit_match_score','chess_move','decline_match','mark_matches_seen','accept_invite'])assert.match(sql,new RegExp(`function public\\.${f}\\(`),f);
 const submit=sql.slice(sql.indexOf('function public.submit_match_score'));assert.match(submit,/score_cap\(m\.game/,'scores are capped by run length');assert.match(submit,/already played this match/,'one score each');
 const move=sql.slice(sql.indexOf('function public.chess_move'));assert.match(move,/not your turn/);assert.match(move,/\^\[a-h\]\[1-8\]\[a-h\]\[1-8\]\[qrbn\]\?\$/);
 assert.match(sql.slice(sql.indexOf('function public.accept_invite')),/\(auth\.uid\(\), target\), \(target, auth\.uid\(\)\)/,'invites make friends both ways');
 assert.match(sql,/delete from matches where from_id = auth\.uid\(\) or to_id = auth\.uid\(\)/,'deleting your data removes your matches');
});
test('Every migration quotes its function bodies with paired $$ markers',()=>{
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql'))){const s=fs.readFileSync(new URL(f,dir),'utf8');
  assert.equal((s.match(/\$\$/g)||[]).length%2,0,f+' has an unpaired $$');
  assert.doesNotMatch(s,/\bas \$\s*\n|^end \$;|^do \$\s*$/m,f+' has a single $ where $$ belongs');}
});
