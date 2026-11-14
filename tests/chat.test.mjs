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
