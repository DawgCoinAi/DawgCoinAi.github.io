import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {movement,timeAgo,unlockProgress,BLURBS,posterOf,VIEWS} from '../dist/shell.js';
import {GAME_IDS} from '../dist/games.js';

const sql=fs.readFileSync(new URL('../supabase/migrations/20261024050000_social_inbox.sql',import.meta.url),'utf8');

test('Challenges are private, server-scored and rate limited',()=>{
 assert.match(sql,/alter table public\.challenges enable row level security/);
 assert.match(sql,/create policy "read own challenges" on public\.challenges for select to authenticated\s+using \(from_id = \(select auth\.uid\(\)\) or to_id = \(select auth\.uid\(\)\)\)/);
 assert.doesNotMatch(sql,/on public\.challenges for (insert|update|delete|all)/,'players never write challenges directly');
 assert.match(sql,/best := best_score\(auth\.uid\(\), p_game\)/,'the score to beat comes from the server, not the client');
 assert.doesNotMatch(sql,/send_challenge\([^)]*p_score/,'send_challenge takes no score argument');
 assert.match(sql,/created_at > now\(\) - interval '1 day';\s+if recent >= 30/,'at most 30 challenges a day');
 assert.match(sql,/where friend_code = upper\(p_code\) and is_public/,'only public players can be challenged');
 assert.match(sql,/update challenges set dismissed = true where id = p_id and to_id = auth\.uid\(\)/);assert.match(sql,/delete from challenges where id = p_id and from_id = auth\.uid\(\)/);
});
test('Feed, boards and friends only show public players, and delete-my-data covers challenges',()=>{
 assert.match(sql,/friend_feed[^]*?p\.is_public and s\.ranked/);assert.match(sql,/level_board[^]*?where \(p\.is_public or t\.user_id = auth\.uid\(\)\)/);
 assert.match(sql,/my_followers[^]*?f\.friend_id = auth\.uid\(\) and p\.is_public/);
 assert.match(sql,/delete from challenges where from_id = auth\.uid\(\) or to_id = auth\.uid\(\);/);
 assert.match(sql,/revoke all on function public\.best_score\(uuid, text\) from public, anon, authenticated/,'the helper is not callable by players');
 for(const f of ['send_challenge(text, text)','my_challenges()','remove_challenge(bigint)','mark_challenges_seen()','friend_feed(int)','level_board(text, int)','my_rank(text, text)','my_level_rank()','my_friends()','my_followers()','delete_my_data()'])assert.ok(sql.includes(`'${f}'`),f+' is revoked from anon and granted to players');
 assert.match(sql,/security definer set search_path = public/);assert.doesNotMatch(sql,/sb_secret|service_role/);
});
test('Shell helpers: rank movement, relative times and unlock progress',()=>{
 assert.deepEqual(movement(3,7),{text:'▲ 4',dir:'up'});assert.deepEqual(movement(5,2),{text:'▼ 3',dir:'down'});assert.deepEqual(movement(4,4),{text:'',dir:''});assert.deepEqual(movement(4,null),{text:'',dir:''});
 const now=Date.parse('2026-10-24T12:00:00Z');assert.equal(timeAgo('2026-10-24T11:59:30Z',now),'just now');assert.equal(timeAgo('2026-10-24T11:45:00Z',now),'15 min ago');assert.equal(timeAgo('2026-10-24T09:00:00Z',now),'3 h ago');assert.equal(timeAgo('2026-10-21T12:00:00Z',now),'3 d ago');
 assert.equal(unlockProgress({open:true}),100);assert.equal(unlockProgress({open:false,routes:[{have:3,need:10},{have:30,need:60}]}),50);assert.equal(unlockProgress({open:false,routes:[]}),0);
 for(const id of GAME_IDS){assert.ok(BLURBS[id],id+' has hero copy');assert.ok(fs.existsSync(new URL('../dist/'+posterOf(id),import.meta.url)),id+' has a poster');}
 assert.deepEqual(VIEWS,['play','rankings','friends','me']);
});
