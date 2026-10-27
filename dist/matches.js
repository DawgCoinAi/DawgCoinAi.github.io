// Matches between friends. A match is set up on the server (supabase/migrations/…_matches.sql)
// and played whenever each player is online: score games give both players the same seeded
// course and the higher score wins; chess is a real game played in turns. This module holds the
// pure parts (which games, how a match reads, whose turn it is), shared by the Friends inbox,
// the game hooks in app.js and the chess screen.
import {gameById} from './games.js';

// Games with a seeded, repeatable course, plus chess. Daily Run already has one course for
// everyone; Street Hustle and After Hours are long-form, so they keep score challenges.
export const MATCH_GAMES=['classic','rush','flappy','cross','snake','runner','turbo','pinball','kart','chess'];
export const isMatchGame=id=>MATCH_GAMES.includes(id);
export const titleOf=id=>gameById(id)?.title||id;
// Chess: the challenger plays white, so it's your move when the move count matches your colour.
export const myColor=m=>m.role==='from'?'w':'b';
export function myTurn(m){if(m.status!=='open')return false;if(m.game==='chess')return ((m.moves?.length||0)%2===0)===(myColor(m)==='w');return m.my_score===null||m.my_score===undefined;}
// What a match needs from you, for its inbox row and the badge.
export function matchState(m){
 if(m.status==='declined')return {key:'declined',label:'DECLINED',tone:'lose'};
 if(m.status==='done')return m.outcome==='win'?{key:'won',label:'YOU WON',tone:'win'}:m.outcome==='loss'?{key:'lost',label:'THEY WON',tone:'lose'}:{key:'draw',label:'DRAW',tone:'wait'};
 return myTurn(m)?{key:'yours',label:m.game==='chess'?'YOUR MOVE':'YOUR TURN',tone:'go'}:{key:'theirs',label:m.game==='chess'?'THEIR MOVE':'WAITING ON THEM',tone:'wait'};}
// How many matches want your attention: your turn, or a result you haven't seen.
export const needsYou=rows=>(rows||[]).filter(m=>myTurn(m)||(!m.seen&&m.status!=='open')).length;
export function summary(m){const t=titleOf(m.game);if(m.game==='chess'){const n=m.moves?.length||0;return `${t} · you play ${myColor(m)==='w'?'white':'black'} · move ${Math.floor(n/2)+1}`+(m.result?` · ${m.result}`:'');}
 const mine=m.my_score??null,theirs=m.their_score??null,fmt=n=>Math.max(0,Math.floor(n)).toLocaleString('en-US');
 return `${t} · same course for both · you ${mine===null?'—':fmt(mine)} · them ${theirs===null?(mine===null?'—':'hidden till they play'):fmt(theirs)}`;}
// Their score stays hidden until you've played, so nobody plays to a number.
export function shown(m){return m.my_score===null||m.my_score===undefined?{...m,their_score:null}:m;}
// Remembers an invite or match link opened before the cloud connected, so it isn't lost.
const PENDING='dawg-pending-invite';
export function rememberInvite(code){try{if(code)localStorage.setItem(PENDING,code);}catch{}}
export function takeInvite(){try{const c=localStorage.getItem(PENDING);localStorage.removeItem(PENDING);return c&&/^[A-F0-9]{8}$/.test(c)?c:null;}catch{return null;}}
