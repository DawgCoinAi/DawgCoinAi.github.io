import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {challengeLink,readChallenge,NAME_RULE,RANKED_GAMES} from '../dist/rankings.js';
import {GAME_IDS} from '../dist/games.js';

const sql=fs.readFileSync(new URL('../supabase/migrations/20261024010000_social.sql',import.meta.url),'utf8');
test('Challenge links round-trip and reject anything malformed',()=>{
 const url=challengeLink('https://dawgcoinai.github.io/?old=1#x','runner',1234.7,'3FA9C210');assert.equal(url,'https://dawgcoinai.github.io/?challenge=runner&score=1234&from=3FA9C210');
 assert.deepEqual(readChallenge(new URL(url).search),{game:'runner',score:1234,from:'3FA9C210'});
 for(const bad of ['?challenge=chess&score=1&from=3FA9C210','?challenge=runner&score=-5&from=3FA9C210','?challenge=runner&score=1&from=<script>','?challenge=runner&score=1e99&from=3FA9C210',''])assert.equal(readChallenge(bad),null,bad);
});
test('Player names follow the same rule in the browser and the database',()=>{
 assert.ok(sql.includes(`'${NAME_RULE.source}'`),'regex matches the SQL check');
 for(const ok of ['Velvet Nugget','DAWG_99','a.b-c'])assert.ok(NAME_RULE.test(ok),ok);for(const bad of ['ab',' lead','trail ','way-too-long-name-x','<b>','emoji🐶'])assert.ok(!NAME_RULE.test(bad),bad);
});
test('Every game has a board, and impossible scores are kept off it',()=>{
 assert.deepEqual(RANKED_GAMES,GAME_IDS);for(const id of ['runner','flappy','snake','cross','story','trade'])assert.match(sql,new RegExp(`when '${id}' then`));
 assert.match(sql,/greatest\(p_score, 0\) <= score_cap\(p_game, greatest\(secs, 1\)\)/);assert.match(sql,/where s\.game = p_game and s\.ranked/);
});
test('Social data stays private except through the public functions',()=>{
 assert.match(sql,/alter table public\.follows enable row level security/);assert.doesNotMatch(sql,/create policy[^;]*on public\.profiles[^;]*for select[^;]*using \(true\)/i,'profiles are never world-readable');
 for(const f of ['ensure_profile','set_profile','leaderboard','my_standing','global_stats','public_profile','follow_code','unfollow_code','my_friends','delete_my_data'])assert.match(sql,new RegExp(`'${f}\\(`),f+' is revoked from anon and granted to players');
 assert.match(sql,/is_public or b\.user_id = auth\.uid\(\)/,'hidden players stay off public boards');assert.match(sql,/delete from follows where user_id = auth\.uid\(\) or friend_id = auth\.uid\(\)/);
 assert.doesNotMatch(sql,/sb_secret|service_role/);
});
