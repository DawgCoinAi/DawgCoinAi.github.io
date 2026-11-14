import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EMOJI,LIMITS,ROOM,cleanText,textOk,validData,validMoment,checkPost,postKey,rateHint,reasonText,errorHint,isMissing,normalizeRow,mergeMessages,groupFlags,dayLabel,unreadCount,scoreMoment,validScore,replayPath} from '../dist/chat.js';
import {VIEWS} from '../dist/shell.js';

const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const sql=read('../supabase/migrations/20261114000000_chat.sql');
const fn=name=>{const at=sql.indexOf('function public.'+name+'(');assert.ok(at>=0,name+' is defined');const end=sql.indexOf('\nend $$;',at),end2=sql.indexOf('\n$$;',at);return sql.slice(at,Math.min(...[end,end2].filter(n=>n>0))+8);};
const finisher={kind:'finisher',game:'fight',title:'BISCUIT finished MOXIE',text:'Thunder Fetch · flawless · round 2',data:{v:1,winner:'biscuit',loser:'moxie',move:'thunder_fetch',stage:'rooftop',seed:12345}};
const row=(id,o={})=>({id,created_at:new Date(1.7e12+id*1000).toISOString(),body:'m'+id,moment:null,player:'Nova',friend_code:'3FA9C210',avatar:null,level:4,mine:false,reactions:{},my_reaction:null,...o});
const msgs=(ids,o)=>ids.map(id=>normalizeRow(row(id,o)));

test('Message text is tidied and held to 240 characters',()=>{
 assert.equal(cleanText('  hi\u0000\n there\t  '),'hi there');assert.equal(cleanText('a'+String.fromCharCode(0x202e)+'b'+String.fromCharCode(0x200b)),'a b');assert.equal(cleanText(null),'');
 assert.deepEqual(checkPost('  good   run  ',null),{ok:true,body:'good run',moment:null});
 assert.equal(checkPost('x'.repeat(240),null).ok,true);assert.equal(checkPost('x'.repeat(241),null).reason,'long');
 assert.equal(checkPost('   ',null).reason,'empty');assert.equal(checkPost('',undefined).reason,'empty');assert.equal(checkPost({},null).reason,'empty');assert.equal(checkPost(42,null).reason,'empty');
 for(const r of ['empty','long','words','moment','gap','burst','repeat'])assert.ok(reasonText(r).length>10,r);
});

test('Chat text follows the same word rules as player names',()=>{
 for(const ok of ['nice run, Dickens!','cocktail hour at Scunthorpe','grape shiitake pizza','I rated that 5/7','who wants a chess match'])assert.ok(textOk(ok),ok);
 for(const bad of ['you sh1thead','F U C K is spaced but fuck is not','total d1ck','kys','what a b1tch','n@zi'])assert.ok(!textOk(bad),bad);
 assert.equal(checkPost('you sh1thead',null).reason,'words');
 // The SQL carries the exact patterns name_ok uses, so names and chat can't drift apart.
 const names=read('../supabase/migrations/20261024020000_turbo.sql'),rules=[...names.slice(names.indexOf('function public.name_ok')).matchAll(/t ~ '([^']+)'/g)].map(m=>m[1]);
 assert.equal(rules.length,3);const body=fn('chat_text_ok');for(const r of rules)assert.ok(body.includes(`t ~ '${r}'`),'chat_text_ok has '+r);
 assert.match(body,/translate\(lower\(coalesce\(p_text, ''\)\), '013457@\$_\.-', 'oieastas   '\)/);
});

test('Moments are checked for shape, size and junk',()=>{
 assert.deepEqual(validMoment(finisher),finisher);assert.notEqual(validMoment(finisher).data,finisher.data,'a copy, not the caller’s object');
 assert.equal(validMoment({...finisher,title:'  Tidy   title '}).title,'Tidy title');assert.equal(validMoment({kind:'feat',game:'chess',title:'No text',data:{v:1}}).text,'');
 const bad=[null,'x',[],{...finisher,kind:'Finisher'},{...finisher,kind:'x'},{...finisher,game:'../evil'},{...finisher,game:'a/b'},{...finisher,title:''},{...finisher,title:'x'.repeat(61)},{...finisher,text:'x'.repeat(121)},
  {...finisher,title:'<img src=x onerror=alert(1)>'},{...finisher,text:'a <b>bold</b> move'},{...finisher,title:'sh1thead finished MOXIE'},{...finisher,extra:1},{...finisher,title:7},{...finisher,text:7},{...finisher,data:undefined},{...finisher,data:[1,2]},{...finisher,data:'{}'}];
 for(const m of bad)assert.equal(validMoment(m),null,JSON.stringify(m)?.slice(0,60));
 assert.equal(validMoment({...finisher,title:'x'.repeat(60),text:'y'.repeat(120)})?.title.length,60);
 const data=[[{v:1,s:'x'.repeat(40),n:-1.5,b:false,a:Array(64).fill(1)},true],[{s:'x'.repeat(41)},false],[{a:Array(65).fill(1)},false],[{a:[1,'2']},false],[{a:[[1]]},false],[{o:{a:1}},false],[{n:null},false],[{n:NaN},false],[{n:Infinity},false],
  [{s:'<script>'},false],[{s:'a\u0007b'},false],[{'bad key':1},false],[{'9lives':1},false],[Object.fromEntries(Array.from({length:33},(_,i)=>['k'+i,i])),false],[Object.fromEntries(Array.from({length:32},(_,i)=>['k'+i,i])),true],[{},true],[new Date(),false],[new Map(),false]];
 for(const [d,ok] of data)assert.equal(validData(d),ok,JSON.stringify(d).slice(0,50));
 // 1500 bytes of JSON at most, counted in bytes, not characters.
 const fat=Object.fromEntries(Array.from({length:27},(_,i)=>['key'+i,'x'.repeat(40)]));assert.ok(JSON.stringify(fat).length<=LIMITS.data&&validData(fat));
 const fatter=Object.fromEntries(Array.from({length:32},(_,i)=>['a_long_key_name_'+i,'é'.repeat(40)]));assert.ok(JSON.stringify(fatter).length<3000&&!validData(fatter));
 assert.equal(checkPost('look at this',finisher).moment.title,finisher.title);assert.equal(checkPost('',finisher).ok,true);assert.equal(checkPost('hi',{...finisher,data:{o:{}}}).reason,'moment');
});

test('Score cards are a built-in moment',()=>{
 const m=scoreMoment('runner',12345.9,{medal:3,best:true,detail:'412 m · 38 gold <b>'});
 assert.equal(m.kind,'score');assert.equal(m.title,'12,345 in DAWG Dash');assert.equal(m.text,'new personal best · gold medal · 412 m · 38 gold b');assert.deepEqual(m.data,{v:1,score:12345,medal:3,best:true});
 assert.ok(validMoment(m)&&validScore(m.data));assert.equal(scoreMoment('trade',900).title,'$900 in Street Hustle');assert.equal(scoreMoment('runner',-5).data.score,0);
 assert.ok(validMoment(scoreMoment('pinball',1e12,{detail:'x'.repeat(400)})),'long details are trimmed to fit');
 for(const d of [{v:2,score:1},{v:1,score:-1},{v:1,score:1.5},{v:1,score:'9'},{v:1,score:1,medal:4},{v:1,score:1,best:'yes'},{v:1}])assert.ok(!validScore(d),JSON.stringify(d));
 assert.equal(replayPath('fight'),'./fight-replay.js');for(const g of ['../x','a/b','A','x','http://evil','fight.js',null,7])assert.equal(replayPath(g),null,String(g));
});

test('Pace hints match the server: 3 s apart, 20 in 5 minutes, repeats after 2 minutes',()=>{
 const t=1e9,k=postKey('hi',null);assert.deepEqual(rateHint([],t,k),{ok:true,reason:'',wait:0});
 assert.deepEqual(rateHint([{at:t-1000,key:'x'}],t,k),{ok:false,reason:'gap',wait:2000});assert.equal(rateHint([{at:t-3000,key:'x'}],t,k).ok,true);
 assert.deepEqual(rateHint([{at:t-60000,key:k}],t,k),{ok:false,reason:'repeat',wait:60000});assert.equal(rateHint([{at:t-120000,key:k}],t,k).ok,true);assert.equal(rateHint([{at:t-60000,key:k}],t,postKey('hi!',null)).ok,true);
 const busy=Array.from({length:20},(_,i)=>({at:t-290000+i*10000,key:'m'+i}));assert.deepEqual(rateHint(busy,t,k),{ok:false,reason:'burst',wait:10000});
 assert.equal(rateHint(busy.slice(1),t,k).ok,true,'19 in the window is fine');assert.equal(rateHint(busy,t+10000,k).ok,true,'the oldest one aged out');
 assert.notEqual(postKey('hi',null),postKey('hi',finisher));assert.equal(postKey(' hi  ',null),postKey('hi',null));
 const post=fn('chat_post');assert.match(post,/interval '3 seconds'/);assert.match(post,/interval '5 minutes'/);assert.match(post,/recent >= 20/);assert.match(post,/interval '2 minutes'/);
 assert.equal(LIMITS.gap,3000);assert.equal(LIMITS.burst,20);assert.equal(LIMITS.window,300000);assert.equal(LIMITS.repeat,120000);
});

test('Rows from the server are treated as untrusted',()=>{
 const m=normalizeRow(row(7,{body:' hello\u0000 <b>x</b> ',level:'12',reactions:{'🔥':3,'💩':9,'😂':'2','👏':0,'💀':-1},my_reaction:'🔥',mine:'yes',friend_code:'not a code',player:'  A very long player name that goes on and on  ',avatar:'<svg>'}));
 assert.equal(m.id,7);assert.equal(m.body,'hello <b>x</b>');assert.equal(m.level,12);assert.deepEqual(m.reactions,{'🔥':3,'😂':2});assert.equal(m.my,'🔥');assert.equal(m.mine,false);assert.equal(m.code,'');assert.equal(m.player.length,24);assert.equal(m.avatar,null);
 assert.equal(normalizeRow(row(8,{my_reaction:'💩'})).my,null);assert.equal(normalizeRow(row(9,{level:1e9})).level,1);assert.equal(normalizeRow(row(10,{player:''})).player,'Guest');
 assert.equal(normalizeRow(row(11,{body:'',moment:finisher})).moment.title,finisher.title);assert.equal(normalizeRow(row(12,{body:'see',moment:{...finisher,title:'<i>'}})).moment,null,'a bad moment is dropped, the text stays');
 for(const junk of [null,'x',row(0),row(-1),row(1.5),row(13,{created_at:'never'}),row(14,{body:'',moment:null}),row(15,{body:'',moment:{kind:'x'}}),row(16,{body:7})])assert.equal(normalizeRow(junk),null);
 assert.equal(EMOJI.length,6);assert.equal(new Set(EMOJI).size,6);assert.equal(ROOM,'lobby');
});

test('Pages merge oldest-first without duplicates, and the newest window drops what was removed',()=>{
 const ids=l=>l.map(m=>m.id);let list=mergeMessages([],msgs([5,4,3]));assert.deepEqual(ids(list),[3,4,5]);
 list=mergeMessages(list,msgs([2,1]));assert.deepEqual(ids(list),[1,2,3,4,5],'an older page goes on top');
 list=mergeMessages(list,msgs([6,5],{body:'edited'}),{head:true,limit:2});assert.deepEqual(ids(list),[1,2,3,4,5,6]);assert.equal(list[4].body,'edited','the fresh copy wins');assert.equal(list[3].body,'m4');
 // Message 5 was deleted: once the window the server sends reaches past it, it goes.
 assert.deepEqual(ids(mergeMessages(list,msgs([7,6]),{head:true,limit:2})),[1,2,3,4,5,6,7]);
 assert.deepEqual(ids(mergeMessages(list,msgs([6,4]),{head:true,limit:2})),[1,2,3,4,6]);
 assert.deepEqual(ids(mergeMessages(list,msgs([6]),{head:true,limit:2})),[6],'a short page is the whole room');assert.deepEqual(mergeMessages(list,[],{head:true}),[]);
 const sending={id:Number.MAX_SAFE_INTEGER-5,pending:true,mine:true,at:0};assert.deepEqual(mergeMessages([...list,sending],msgs([7]),{head:true,limit:1}).map(m=>m.id),[1,2,3,4,5,6,7,sending.id],'a message still sending stays last');
 assert.equal(unreadCount(list,4),2);assert.equal(unreadCount(list,0),6);assert.equal(unreadCount(msgs([1,2],{mine:true}),0),0);assert.equal(unreadCount([...list,sending],6),0);
});

test('Consecutive messages group under one author, with a divider per day',()=>{
 const at=(h,m=0)=>new Date(2026,10,14,h,m).getTime(),mk=(id,t,o={})=>({id,at:t,body:'x',moment:null,player:'Nova',code:'3FA9C210',mine:false,...o});
 const list=[mk(1,new Date(2026,10,13,23,50).getTime()),mk(2,at(9)),mk(3,at(9,1)),mk(4,at(9,2),{player:'Rex',code:'AAAAAAAA'}),mk(5,at(9,3),{player:'Rex',code:'AAAAAAAA'}),mk(6,at(9,30),{player:'Rex',code:'AAAAAAAA'}),mk(7,at(9,31),{player:'Rex',code:'AAAAAAAA',moment:{}}),mk(8,at(9,32),{player:'Rex',code:'AAAAAAAA'}),mk(9,at(9,33),{mine:true,player:'You'})];
 const f=groupFlags(list,at(12));assert.deepEqual(f.map(x=>x.first),[true,true,false,true,false,true,true,true,true]);assert.deepEqual(f.map(x=>x.day),['Yesterday','Today',null,null,null,null,null,null,null]);
 assert.equal(dayLabel(new Date(2026,10,2).getTime(),at(12)),'Nov 2');assert.deepEqual(groupFlags([]),[]);
});

test('Server refusals read as plain words, and a missing migration is told apart from an error',()=>{
 assert.match(errorHint('slow down'),/3 seconds/);assert.match(errorHint('too many messages'),/20 messages/);assert.match(errorHint('duplicate message'),/just said that/);assert.match(errorHint('message not allowed'),/friendly/);
 assert.match(errorHint('chat muted for 12 more minutes'),/muted in chat for 12 more minutes/);assert.match(errorHint('chat muted for 1 more minutes'),/1 more minute\./);assert.match(errorHint('chat is for players shown on public boards'),/Show me on public boards/);
 assert.match(errorHint('TypeError: Failed to fetch'),/cloud connection/);assert.match(errorHint('some new postgres error <b>'),/hiccup/);assert.doesNotMatch(errorHint('<script>'),/</);
 assert.ok(isMissing({status:404,message:''}));assert.ok(isMissing({code:'PGRST202'}));assert.ok(isMissing({message:'Could not find the function public.chat_recent(p_before, p_limit, p_room) in the schema cache'}));
 assert.ok(!isMissing({status:401,message:'permission denied for function chat_recent'}));assert.ok(!isMissing({status:400,message:'slow down'}));assert.ok(!isMissing(null));
});

test('The server keeps chat safe: read-only tables, every write through a checked function',()=>{
 for(const t of ['chat_messages','chat_reactions','chat_reports','chat_mutes']){assert.match(sql,new RegExp(`create table if not exists public\\.${t} \\(`),t);assert.match(sql,new RegExp(`alter table public\\.${t} enable row level security`),t+' has RLS');}
 assert.match(sql,/revoke insert, update, delete, truncate on public\.chat_messages from anon, authenticated/);assert.match(sql,/revoke insert, update, delete, truncate on public\.chat_reactions from anon, authenticated/);
 assert.match(sql,/revoke all on public\.chat_reports from public, anon, authenticated/);assert.match(sql,/revoke all on public\.chat_mutes from public, anon, authenticated/);
 assert.match(sql,/create policy chat_read on public\.chat_messages for select to authenticated\s+using \(not deleted and \(not hidden or author = \(select auth\.uid\(\)\)\)\)/);
 assert.equal((sql.match(/create policy/g)||[]).length,2,'only read policies');assert.doesNotMatch(sql,/for (insert|update|delete|all)\b/);
 assert.match(sql,/author uuid not null references public\.profiles \(id\) on delete cascade/);assert.match(sql,/body text not null default '' check \(char_length\(body\) <= 240\)/);assert.match(sql,/room text not null default 'lobby'/);assert.match(sql,/primary key \(message_id, user_id\)/);
 const grants=sql.slice(sql.lastIndexOf('do $$'));
 for(const [f,sig] of [['chat_post','text, jsonb'],['chat_recent','text, bigint, int'],['chat_react','bigint, text'],['chat_report','bigint, text'],['chat_delete','bigint'],['chat_mute','text, int'],['delete_my_data','']]){
  const body=fn(f);assert.match(sql.slice(sql.indexOf('function public.'+f+'('),sql.indexOf('function public.'+f+'(')+700),/security definer set search_path = public/,f+' is security definer with a fixed search path');
  assert.ok(grants.includes(`'${f}(${sig})'`),f+' is revoked from anon and granted to signed-in players');if(f!=='chat_recent'&&f!=='chat_mute')assert.match(body,/sign in first/,f+' needs a signed-in player');}
 assert.match(grants,/revoke all on function public\.%s from public, anon/);assert.match(grants,/grant execute on function public\.%s to authenticated/);
 assert.doesNotMatch(sql,/sb_secret|service_role/);assert.equal((sql.match(/\$\$/g)||[]).length%2,0);assert.ok(![0x200b,0x200c,0x200d,0x200e,0x200f,0x2028,0x2029,0x202a,0x202e,0xfeff].some(c=>sql.includes(String.fromCharCode(c))),'no invisible characters in the file itself');
});

test('Posting is filtered, sized, paced and closed to hidden and muted players',()=>{
 const post=fn('chat_post');
 assert.match(post,/clean text := chat_clean\(p_body\)/);assert.match(post,/char_length\(clean\) > 240/);assert.match(post,/not chat_text_ok\(clean\)/);assert.match(post,/not chat_moment_ok\(p_moment\)/);assert.match(post,/chat_text_ok\(\(mom ->> 'title'\) \|\| ' ' \|\| \(mom ->> 'text'\)\)/);
 assert.match(post,/select is_public into shown from profiles/);assert.match(post,/chat is for players shown on public boards/);assert.match(post,/from chat_mutes where user_id = uid and until > now\(\)/);assert.match(post,/pg_advisory_xact_lock/);
 assert.ok(post.indexOf('pg_advisory_xact_lock')<post.indexOf('slow down')&&post.indexOf('slow down')<post.indexOf('insert into chat_messages'),'limits are checked under the lock, before the insert');
 assert.match(fn('chat_clean'),/\[\[:cntrl:\]/);assert.match(fn('chat_clean'),/'\\s\+', ' ', 'g'/);
 const mom=fn('chat_moment_ok');assert.match(mom,/k not in \('kind', 'game', 'title', 'text', 'data'\)/);assert.match(mom,/not between 1 and 60/);assert.match(mom,/> 120/);assert.match(mom,/'\[<>\]'/);assert.match(mom,/chat_data_ok\(p_moment -> 'data'\)/);
 assert.ok(mom.includes("'^[a-z][a-z0-9_]{1,15}$'")&&mom.includes("'^[a-z][a-z0-9_-]{1,15}$'"),'kind and game ids match the client');
 const data=fn('chat_data_ok');assert.match(data,/octet_length\(p_data::text\) > 2400/);assert.match(data,/> 40/);assert.match(data,/jsonb_array_length\(v\) > 64/);assert.match(data,/n > 32/);assert.match(data,/jsonb_typeof\(e\) <> 'number'/);assert.match(data,/not in \('number', 'boolean'\)/);
 assert.ok(data.includes("'^[A-Za-z_][A-Za-z0-9_]{0,23}$'"));
});

test('Reading, reacting, reporting, deleting and muting follow the rules',()=>{
 const recent=fn('chat_recent');assert.match(recent,/auth\.uid\(\) is not null/);assert.match(recent,/not m\.deleted/);assert.match(recent,/not m\.hidden or m\.author = auth\.uid\(\)/);assert.match(recent,/p\.is_public or m\.author = auth\.uid\(\)/,'players who hide from public boards leave chat too');
 assert.match(recent,/p_before is null or m\.id < p_before/);assert.match(recent,/order by m\.id desc/);assert.match(recent,/least\(greatest\(coalesce\(p_limit, 50\), 1\), 100\)/);assert.match(recent,/m\.author = auth\.uid\(\)/);assert.match(recent,/arcade_level\(/);assert.match(recent,/coalesce\(p\.display_name, 'Guest ' \|\| p\.friend_code\)/);
 assert.doesNotMatch(recent.slice(0,recent.indexOf('language sql')),/author|user_id/,'account ids never leave the server');
 const react=fn('chat_react');for(const e of EMOJI)assert.ok(react.includes(`'${e}'`),e+' is accepted by the server');const allowed=react.match(/p_emoji not in \(([^)]*)\)/)[1].split(',').map(x=>x.trim().replace(/'/g,''));assert.deepEqual(allowed,EMOJI,'and nothing else is');
 assert.match(react,/on conflict \(message_id, user_id\) do update/);
 const report=fn('chat_report');assert.match(report,/that is your own message/);assert.match(report,/today >= 30/);assert.match(report,/votes >= 3/);assert.match(report,/set hidden = true/);assert.match(report,/on conflict do nothing/);
 const del=fn('chat_delete');assert.match(del,/m\.author <> uid and not exists \(select 1 from arcade_owners where user_id = uid\)/);assert.match(del,/set deleted = true, body = '', moment = null/);
 const mute=fn('chat_mute');assert.match(mute,/not exists \(select 1 from arcade_owners where user_id = auth\.uid\(\)\) then raise exception 'only the arcade owner can do that'/);assert.match(mute,/43200/);
 const wipe=fn('delete_my_data'),before=read('../supabase/migrations/20261027000000_matches.sql');
 for(const line of before.slice(before.indexOf('function public.delete_my_data')).match(/delete from [^;]+;/g))assert.ok(wipe.includes(line),'still removes: '+line);
 for(const t of ['chat_reactions where user_id','chat_reports where user_id','chat_mutes where user_id','chat_messages where author'])assert.match(wipe,new RegExp('delete from '+t+' = auth\\.uid\\(\\)'),t);
 assert.ok(wipe.indexOf('chat_messages')<wipe.indexOf('delete from profiles'),'chat goes before the profile it points at');
});

test('Chat is a destination in the shell, wired to games and the results card',()=>{
 const html=read('../dist/index.html'),app=read('../dist/app.js'),js=read('../dist/chat.js');
 assert.deepEqual(VIEWS,['play','rankings','friends','chat','me']);
 const nav=html.slice(html.indexOf('<nav class="app-nav"'),html.indexOf('</nav>'));assert.match(nav,/<button data-view="chat" id="chatNav"/);assert.equal((nav.match(/data-view="/g)||[]).length,VIEWS.length,'one nav item per view');
 for(const v of VIEWS)assert.match(html,new RegExp(`<section id="view${v[0].toUpperCase()+v.slice(1)}" class="view`),v+' has a view');
 assert.match(html,/<section id="viewChat" class="view chat-view"[^>]* hidden>/);for(const id of ['chatBadge','resultsChat','chatList','chatForm','chatInput','chatSend','chatCount','chatHint','chatNew','chatNotice','chatQuick','chatStatus'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(html,/<textarea id="chatInput"[^>]*maxlength="240"/);assert.match(html,/href="chat\.css"/);assert.ok(fs.existsSync(new URL('../dist/chat.css',import.meta.url)));
 assert.match(app,/import \{Chat\} from '\.\/chat\.js';/);assert.match(app,/chat:m=>chat\.post\(m\),/,'games get io.chat');assert.match(app,/const chat=new Chat\(\{cloud,rankings,shell,/);
 // Nothing from another player is ever parsed as markup or turned into a link.
 assert.doesNotMatch(js,/innerHTML|insertAdjacentHTML|outerHTML|document\.write|\.href\s*=|createElement\('a'\)|el\('a'/);
 assert.match(js,/mod\.validMoment\?\.\(mo\.data\)/,'a moment plays only after its game’s viewer accepts it');assert.match(js,/mod\.playMoment\(host,mo\.data,/);
 assert.doesNotMatch(js+read('../dist/chat-debug.js'),/sb_secret|service_role/);
 assert.match(read('../SUPABASE_SETUP.md'),/20261114000000_chat\.sql/);
});

// ── DAWG Chat v2: rooms, roles, moderation, replies, mentions, edits ──────────────────────────
import * as core from '../dist/chat-core.js';
const sql2=read('../supabase/migrations/20261115000000_chat_v2.sql');
const fn2=name=>{const at=sql2.indexOf('function public.'+name+'(');assert.ok(at>=0,name+' is defined');const end=sql2.indexOf('\nend $$;',at),end2=sql2.indexOf('\n$$;',at);return sql2.slice(at,Math.min(...[end,end2].filter(n=>n>0))+8);};

test('Roles: nobody moderates the owner, only the owner moderates mods, nobody escalates',()=>{
 const {can,canModerate,normRole,isStaff,badgeOf}=core;
 assert.equal(normRole('admin'),'member');assert.equal(normRole(undefined),'member');assert.ok(isStaff('mod')&&isStaff('owner')&&!isStaff('member'));
 assert.deepEqual(['owner','mod','member','x'].map(badgeOf),['OWNER','MOD','','']);
 assert.ok(canModerate('mod','member'));assert.ok(!canModerate('mod','mod'));assert.ok(!canModerate('mod','owner'));assert.ok(canModerate('owner','mod'));assert.ok(!canModerate('owner','owner'));assert.ok(!canModerate('member','member'));assert.ok(!canModerate('owner','member',true),'not yourself');
 for(const a of ['timeout','ban','setRole','pin','slow','lock','rooms','rules','announce','queue','log'])assert.ok(!can('member',a,{target:'member'}),'members can’t '+a);
 for(const a of ['timeout','pin','slow','queue','log','sanctions','postLocked'])assert.ok(can('mod',a,{target:'member'}),'mods can '+a);
 for(const a of ['ban','setRole','lock','rooms','rules','announce','archive'])assert.ok(!can('mod',a,{target:'member'}),'mods can’t '+a);
 for(const a of ['ban','setRole','lock','rooms','rules','announce','timeout'])assert.ok(can('owner',a,{target:'mod'}),'the owner can '+a);
 assert.ok(!can('owner','setRole',{target:'owner'}));assert.ok(can('member','delete',{mine:true}));assert.ok(!can('member','delete',{target:'member'}));assert.ok(can('mod','delete',{target:'member'}));assert.ok(!can('mod','delete',{target:'owner'}));
 assert.deepEqual(core.TIMEOUTS.mod,[5,60,1440]);assert.ok(core.TIMEOUTS.owner.includes(10080));assert.deepEqual([5,60,1440,10080].map(core.timeoutLabel),['5 min','1 h','1 day','1 week']);
});

test('The post gate: bans, hidden profiles, time-outs, rules, locked rooms and slow mode',()=>{
 const g=(me,room={},o={})=>core.postGate({me,room,now:1e6,...o}).reason;
 assert.equal(g({role:'member',agreed:true}),'');assert.equal(g({role:'member',agreed:true,banned:true}),'banned');assert.equal(g({role:'member',agreed:true},{},{hidden:true}),'hidden');
 assert.equal(g({role:'member',agreed:true,muted_until:new Date(1e6+60000).toISOString()}),'timeout');assert.equal(core.postGate({me:{muted_until:new Date(1e6+60000).toISOString()},now:1e6}).wait,60000);
 assert.equal(g({role:'member',agreed:true,muted_until:new Date(1e6-1).toISOString()}),'','an expired time-out is over');
 assert.equal(g({role:'member',agreed:false}),'rules');assert.equal(g({role:'mod',agreed:false}),'','staff skip the rules step');
 assert.equal(g({role:'member',agreed:true},{locked:true}),'locked');assert.equal(g({role:'mod',agreed:true},{locked:true}),'');
 assert.equal(g({role:'member',agreed:true},{slow:10},{lastAt:1e6-4000}),'slow');assert.equal(core.postGate({me:{agreed:true},room:{slow:10},lastAt:1e6-4000,now:1e6}).wait,6000);
 assert.equal(g({role:'member',agreed:true},{slow:10},{lastAt:1e6-10000}),'');assert.equal(g({role:'owner'},{slow:10},{lastAt:1e6-1}),'','staff skip slow mode');
 assert.equal(core.slowWait(0,10,5,'member'),0);assert.deepEqual([999,59000,61000,7200000].map(core.waitLabel),['1 s','59 s','2 min','2 h']);
 assert.match(core.errorHint('slow mode 7 seconds'),/Wait 7 more seconds/);assert.match(core.errorHint('banned from chat'),/banned/);assert.match(core.errorHint('room is locked'),/locked/);
 assert.match(core.errorHint('agree to the chat rules first'),/rules/);assert.match(core.errorHint('you can not moderate that player'),/can’t moderate/);assert.match(core.errorHint('too late to edit'),/5 minutes/);
});

test('Mentions: @Name with _ for spaces, never inside words or e-mail addresses, at most five',()=>{
 assert.deepEqual(core.mentionTokens('hi @Nova. and @Top_Dog, mail a@b.com and @nova again'),['nova','top_dog']);
 assert.deepEqual(core.mentionTokens('@a1 @b2 @c3 @d4 @e5 @f6'),['a1','b2','c3','d4','e5']);assert.deepEqual(core.mentionTokens('no@mention here'),[]);
 assert.equal(core.mentionHandle('Top  Dog'),'Top_Dog');assert.ok(core.mentions('yo @top_dog!','Top Dog'));assert.ok(!core.mentions('yo @top','Top Dog'));
 assert.deepEqual(core.mentionParts('hey @Rex! <b>'),[{text:'hey '},{text:'@Rex',mention:'rex'},{text:'! <b>'}],'parts stay plain text');
 assert.deepEqual(core.mentionQuery('hello @No',9),{start:6,query:'No'});assert.equal(core.mentionQuery('a@b',3),null);assert.deepEqual(core.mentionQuery('@',1),{start:0,query:''});
 const people=[{name:'Nova'},{name:'Top Dog'},{name:'Snowy'},{name:'nova'}];assert.deepEqual(core.mentionSuggest('no',people).map(p=>p.handle),['Nova','Snowy']);assert.equal(core.mentionSuggest('',people).length,3);
 assert.deepEqual(core.applyMention('hey @to and',4,7,'Top_Dog'),{text:'hey @Top_Dog  and',caret:13});
 // The server uses the same pattern.
 assert.ok(fn2('chat_mentions_in').includes("'(^|[^A-Za-z0-9_])@([A-Za-z0-9](?:[A-Za-z0-9_.-]{0,22}[A-Za-z0-9])?)'"));
 assert.equal(core.MENTION.source,'(^|[^A-Za-z0-9_])@([A-Za-z0-9](?:[A-Za-z0-9_.-]{0,22}[A-Za-z0-9])?)');
 assert.match(fn2('chat_mentions_in'),/limit 5/);assert.ok(fn2('chat_mentions_in').includes("replace(coalesce(p.display_name, 'Guest ' || p.friend_code), ' ', '_')"));
});

test('Replies, edits and v2 rows from the server',()=>{
 const t=1.8e12,m={id:5,at:t,mine:true,body:'hi'};
 assert.ok(core.canEdit(m,t+299999));assert.ok(!core.canEdit(m,t+300001));assert.ok(!core.canEdit({...m,mine:false},t));assert.ok(!core.canEdit({...m,pending:true},t));assert.ok(!core.canEdit({...m,body:''},t),'moment-only posts have no text to edit');
 assert.equal(core.lastEditable([m,{...m,id:6},{...m,id:7,mine:false}],t).id,6);assert.equal(core.lastEditable([m],t+400000),null);assert.equal(core.EDIT_MS,300000);
 const r=core.normalizeRow({id:9,created_at:new Date(t).toISOString(),body:'x',role:'mod',room:'bite-night',reply_id:4,reply_player:' Rex ',reply_body:'y'.repeat(200),edited:true,pinned:true,kind:'announce',mentions_me:true});
 assert.deepEqual([r.role,r.room,r.edited,r.pinned,r.kind,r.mentionsMe],['mod','bite-night',true,true,'announce',true]);assert.deepEqual(r.reply,{id:4,player:'Rex',body:'y'.repeat(90)});
 const j=core.normalizeRow({id:9,created_at:new Date(t).toISOString(),body:'x',role:'god',room:'../x',reply_id:'nope',kind:'<script>',edited:'yes',mentions_me:1});
 assert.deepEqual([j.role,j.room,j.reply,j.kind,j.edited,j.mentionsMe],['member','lobby',null,'msg',false,false]);
 const at=h=>new Date(2026,10,14,h).getTime(),row=(id,o={})=>({id,at:at(9)+id*1000,body:'x',player:'Nova',code:'3FA9C210',mine:false,kind:'msg',...o});
 assert.deepEqual(core.groupFlags([row(1),row(2),row(3,{reply:{id:1}}),row(4,{kind:'announce'}),row(5)]).map(f=>f.first),[true,false,true,true,true]);
 assert.equal(core.unreadIndex([row(1),row(2,{mine:true}),row(3)],1),2);assert.equal(core.unreadIndex([row(1)],0),-1);assert.equal(core.unreadIndex([row(1)],5),-1);
});

test('Rooms, presence and typing',()=>{
 assert.deepEqual(core.DEFAULT_ROOMS.map(r=>r.slug),['lobby','bite-night','it-learns','help','looking-for-match']);
 for(const r of core.DEFAULT_ROOMS)assert.ok(sql2.includes(`('${r.slug}', '${r.title}',`),r.slug+' is seeded by the server');
 assert.ok(core.roomSlugOk('it-learns')&&!core.roomSlugOk('It')&&!core.roomSlugOk('-x')&&!core.roomSlugOk('a'.repeat(25)));
 const room=core.normalizeRoom({slug:'help',title:' help ',topic:'t',locked:true,slow_seconds:'30',last_id:12});assert.deepEqual([room.title,room.locked,room.slow,room.lastId],['help',true,30,12]);
 assert.equal(core.normalizeRoom({slug:'NOPE'}),null);assert.equal(core.normalizeRoom({slug:'ok',slow_seconds:99999}).slow,0);
 assert.equal(core.roomForGame('fight'),'bite-night');assert.equal(core.roomForGame('nemesis'),'it-learns');
 const p=core.presenceRooms({a:[{code:'AAAAAAAA',name:'Nova',room:'lobby',level:4,role:'member'}],b:[{code:'BBBBBBBB',name:'TopX',room:'lobby',role:'owner'},{code:'BBBBBBBB',name:'TopX again',room:'help'}],c:[{code:'bad',name:'x'}],d:[{code:'CCCCCCCC',name:'<i>',room:'../evil'}]});
 assert.equal(p.total,3);assert.deepEqual(p.rooms.lobby.map(x=>x.name),['TopX','<i>','Nova'],'owner first, one entry per player, bad rooms fall back to the lobby');
 assert.equal(core.typingLine([]),'');assert.equal(core.typingLine(['Moxie']),'Moxie is typing…');assert.equal(core.typingLine(['A','B']),'A and B are typing…');assert.equal(core.typingLine(['A','B','C','D']),'Several people are typing…');
 assert.match(core.logLine({actor:'TopX',action:'timeout',target:'Rex',detail:{minutes:60}}),/TopX timed out Rex for 1 h/);assert.match(core.logLine({actor:'TopX',action:'make_mod',target:'Nova'}),/made Nova a mod/);
 assert.match(core.logLine({actor:'Moxie',action:'room',room:'lobby',detail:{slow:10}}),/slow mode 10s/);assert.equal(core.REPORT_REASONS.length,5);assert.ok(core.EMOJI_PICKER.length>=40);
});

test('v2 SQL: new tables locked down, every write through a role-checked function',()=>{
 for(const t of ['chat_rooms','chat_roles','chat_bans','chat_mod_log','chat_config','chat_rules_ack']){
  assert.match(sql2,new RegExp(`create table if not exists public\\.${t} \\(`),t);assert.match(sql2,new RegExp(`alter table public\\.${t} enable row level security`),t+' has RLS');
  assert.match(sql2,new RegExp(`revoke all on public\\.${t} from public, anon, authenticated`),t+' is closed to clients');}
 // Clients read only signal columns of messages (for Realtime); text and authors come through chat_feed.
 assert.ok(sql2.includes('revoke select on public.chat_messages from authenticated;\ngrant select (id, room, created_at, touched_at, deleted, hidden, pinned_at) on public.chat_messages to authenticated;'));
 assert.match(sql2,/pg_publication_tables where pubname = 'supabase_realtime'/,'adding to the Realtime publication is safe to re-run');
 assert.equal((sql2.match(/\$\$/g)||[]).length%2,0);assert.doesNotMatch(sql2,/sb_secret|service_role/);
 const helpers=sql2.slice(sql2.indexOf('-- Helpers: nobody calls these directly.'),sql2.indexOf('-- Player and staff functions'));
 assert.ok(helpers.includes("revoke all on function public.%s from public, anon, authenticated"));
 for(const f of ['chat_role_of(uuid)','chat_is_staff(uuid)','chat_log(text, uuid, bigint, text, text, jsonb)','chat_can_moderate(uuid)','chat_target(text)','chat_name(uuid)','chat_mentions_in(text)'])assert.ok(helpers.includes(`'${f}'`),f+' is not callable by players');
 const grants=sql2.slice(sql2.indexOf('-- Player and staff functions'));
 for(const f of ['chat_send(text, text, jsonb, bigint, boolean)','chat_post(text, jsonb)','chat_edit(bigint, text)','chat_me()','chat_agree(int)','chat_rooms()','chat_feed(text, bigint, bigint, int, boolean)','chat_mentions(bigint)','chat_staff()','chat_react(bigint, text)','chat_report(bigint, text)','chat_delete(bigint)','chat_timeout(text, int, text)','chat_mute(text, int)','chat_ban(text, text)','chat_unban(text)','chat_set_role(text, text)','chat_sanctions()','chat_report_queue()','chat_resolve_report(bigint, text, text)','chat_pin(bigint, boolean)','chat_room_settings(text, int, boolean, text, text, boolean)','chat_room_create(text, text)','chat_set_rules(text)','chat_mod_log(bigint, int)','delete_my_data()']){
  assert.ok(grants.includes(`'${f}'`),f+' is granted to signed-in players only');const name=f.slice(0,f.indexOf('('));const at=sql2.indexOf('function public.'+name+'(');assert.match(sql2.slice(at,at+900),/security definer set search_path = public/,name);}
 assert.match(grants,/revoke all on function public\.%s from public, anon'/);assert.match(grants,/grant execute on function public\.%s to authenticated'/);
});

test('v2 SQL: staff functions check the caller’s role and write the audit log',()=>{
 const staffOnly=['chat_timeout','chat_sanctions','chat_report_queue','chat_resolve_report','chat_pin','chat_room_settings','chat_mod_log'],ownerOnly=['chat_ban','chat_unban','chat_set_role','chat_room_create','chat_set_rules'];
 for(const f of staffOnly)assert.ok(fn2(f).includes("if not chat_is_staff(auth.uid()) then raise exception 'only staff can do that'"),f+' is staff only');
 for(const f of ownerOnly)assert.ok(fn2(f).includes("if chat_role_of(auth.uid()) <> 'owner' then raise exception 'only the arcade owner can do that'"),f+' is owner only');
 assert.match(fn2('chat_mute'),/arcade_owners where user_id = auth\.uid\(\)/);
 const cm=fn2('chat_can_moderate');for(const s of ["chat_role_of(p_target) <> 'owner'","chat_role_of(p_target) = 'member' or chat_role_of(auth.uid()) = 'owner'",'p_target is distinct from auth.uid()'])assert.ok(cm.includes(s),s);
 for(const f of ['chat_timeout','chat_ban'])assert.ok(fn2(f).includes('if not chat_can_moderate(target) then raise exception'),f+' respects the hierarchy');
 assert.ok(fn2('chat_timeout').includes("= 'mod' and span not in (0, 5, 60, 1440)"),'mods get three lengths');assert.ok(fn2('chat_set_role').includes("p_role not in ('mod', 'member')"));assert.ok(fn2('chat_set_role').includes("chat_role_of(target) = 'owner'"));
 assert.ok(fn2('chat_room_settings').includes('if not owner and (p_locked is not null or p_title is not null or p_topic is not null or p_archived is not null)'),'mods only change slow mode');
 assert.ok(fn2('chat_delete').includes("chat_can_moderate(m.author) or chat_role_of(uid) = 'owner'"));
 const logged={chat_delete:'delete',chat_timeout:'timeout',chat_ban:'ban',chat_unban:'unban',chat_set_role:'make_mod',chat_pin:'pin',chat_room_settings:'room',chat_room_create:'room_create',chat_set_rules:'rules',chat_resolve_report:'report_',chat_send:'announce'};
 for(const [f,a] of Object.entries(logged))assert.ok(fn2(f).includes('chat_log(')&&fn2(f).includes(`'${a}`),f+' writes the audit log');
 assert.match(fn2('chat_log'),/insert into chat_mod_log \(actor, action, target, message_id, room, reason, detail\)\s+values \(auth\.uid\(\)/,'the actor is always the caller');
 assert.ok(fn2('chat_report_queue').includes('r.resolved_at is null'));assert.ok(fn2('chat_report').includes('r.resolved_at is null'),'dismissed reports stop counting');
});

test('v2 SQL: chat_send enforces every rule, and v1 clients go through it',()=>{
 const send=fn2('chat_send'),order=['banned from chat','public boards','chat muted for','agree to the chat rules','room is locked','only the arcade owner','message too long','message not allowed','bad moment','pg_advisory_xact_lock','slow down','slow mode','too many messages','duplicate message','insert into chat_messages'];
 let at=-1;for(const s of order){const i=send.indexOf(s);assert.ok(i>at,s+' is checked, in order');at=i;}
 for(const s of ['if r.locked and not staff','if r.slow_seconds > 0 and not staff','not staff and not exists (select 1 from chat_rules_ack',"coalesce(p_announce, false) and my_role <> 'owner'",'not archived','where id = p_reply and room = r.slug and not deleted','chat_mentions_in(clean)'])assert.ok(send.includes(s),'chat_send: '+s);
 assert.ok(fn2('chat_post').includes("select chat_send('lobby', p_body, p_moment, null, false)"),'v1 posts follow every v2 rule');
 for(const f of ['chat_react','chat_report','chat_edit'])assert.ok(fn2(f).includes("chat_bans where user_id = uid) then raise exception 'banned from chat'"),f+' is closed to banned players');
 const edit=fn2('chat_edit');for(const s of ['m.author <> uid',"interval '5 minutes'",'chat_text_ok(clean)','edited_at = now()','until > now()'])assert.ok(edit.includes(s),'chat_edit: '+s);
 const feed=fn2('chat_feed');for(const s of ['not m.deleted','not m.hidden or m.author = auth.uid()','p.is_public or m.author = auth.uid()','chat_reports x where x.message_id = m.id and x.user_id = auth.uid()','chat_role_of(m.author)','auth.uid() = any (m.mentions)'])assert.ok(feed.includes(s),'chat_feed: '+s);
 assert.doesNotMatch(feed.slice(0,feed.indexOf('language sql')),/\bauthor\b|user_id/,'account ids never leave the server');
 assert.ok(fn2('chat_agree').includes('p_version is distinct from v'));assert.ok(fn2('chat_set_rules').includes('rules_version = rules_version + 1'),'new rules ask everyone again');
});

test('v2 SQL: deleting your data covers the new chat tables too',()=>{
 const wipe=fn2('delete_my_data'),before=fn('delete_my_data');
 for(const line of before.match(/delete from [^;]+;/g))assert.ok(wipe.includes(line),'still removes: '+line);
 for(const t of ['chat_bans where user_id','chat_roles where user_id','chat_rules_ack where user_id'])assert.ok(wipe.includes('delete from '+t+' = auth.uid()'),t);
 for(const s of ['update chat_mod_log set actor = null where actor = auth.uid()','update chat_mod_log set target = null where target = auth.uid()','array_remove(mentions, auth.uid())'])assert.ok(wipe.includes(s),s);
 assert.ok(wipe.indexOf('delete from chat_messages')<wipe.indexOf('delete from profiles'));
 assert.match(read('../SUPABASE_SETUP.md'),/20261115000000_chat_v2\.sql/);
});

test('v2 view: chat keys stay in chat, staff tools only for staff, realtime with a polling fallback',()=>{
 const js=read('../dist/chat.js'),html=read('../dist/index.html');
 for(const id of ['chatShell','chatRooms','chatRoomList','chatPeople','chatPeopleList','chatMod','chatModBtn','chatModOpen','chatGate','chatContext','chatSuggest','chatTyping','chatPins','chatEmojiBtn','chatAnnounce','chatTopic','chatOnline','chatScrim'])assert.ok(html.includes(`id="${id}"`),id);
 assert.ok(js.includes("$('viewChat').addEventListener('keydown',e=>{esc(e);e.stopPropagation();})"),'typing in chat never steers a game');
 for(const s of ["postgres_changes',{event:'*',schema:'public',table:'chat_messages'}",".on('presence',{event:'sync'}","event:'typing'",'const live=this.live?.ok;if(!live||Date.now()-(this.lastFetch||0)>30000)this.refresh()',"$('chatModBtn').hidden=$('chatModOpen').hidden=!this.staffMode",'get staffMode(){return this.v2&&isStaff(this.role);}','catch(error){if(!isMissing(error)){if(this.v2===null)throw error;return true;}this.v2=false;'])assert.ok(js.includes(s),s);
 assert.doesNotMatch(js+read('../dist/chat-core.js'),/innerHTML|insertAdjacentHTML|outerHTML|document\.write|\.href\s*=|createElement\('a'\)|el\('a'/);
});
