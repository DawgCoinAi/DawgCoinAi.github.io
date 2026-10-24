import {ROOMS,ITEMS} from './story-engine.js';
// Derived from collected clues; opening the notebook never advances the story.
export function storyJournal(s){
 const e=s.episode,bar=e?.barRoom||'diner',dj=e?.djRoom||'shop',token=e?.tokenRoom||'block',room=id=>(s.roomInfo?.(id)||ROOMS[id]).name;
 const notes=[{title:'Tonight’s job',text:e?e.plot.need:'Get the unfinished rooftop anthem ready for tonight’s party.'}];
 if(s.flags.flyer)notes.push({title:'Flyer copied',text:(s.item?.('flyer')||ITEMS.flyer).description});
 if(s.flags.token)notes.push({title:'Coffee connection',text:'Token found at '+room(token)+'. Redeem it at '+room(bar)+'.'});
 if(s.flags.awake)notes.push({title:'DJ awake',text:'The desk at '+room(dj)+' can finish your demo.'});
 if(s.flags.mixed)notes.push({title:'Demo finished',text:'The guard needs a password, a brushed coat, and this demo.'});
 if(s.flags.pass)notes.push({title:'Rooftop unlocked',text:'Play the demo, risk the microphone, or make a connection and stay for sunrise.'});
 if(s.flags.favor)notes.push({title:'Small kindness, big night',text:'The lost badge is home. Your crew pin adds a bonus to the ending.'});
 let lead={room:'block',text:'Read the party flyer. It has this episode’s clues.'};
 if(s.ending)lead=null;else if(!s.flags.flyer){}else if(!s.flags.token&&!s.flags.awake&&!s.has('coffee'))lead={room:token,text:'Investigate the glint at '+room(token)+'.'};else if(s.has('token'))lead={room:bar,text:'Use your coffee token at '+room(bar)+'.'};else if(s.has('coffee'))lead={room:dj,text:'Bring coffee to the sleeping DJ at '+room(dj)+'.'};else if(!s.flags.mixed)lead={room:dj,text:'Use the record or mixing desk. Check the copied flyer for the sequence.'};else if(!s.flags.pass)lead={room:'club',text:'Visit the guard with your demo. Use the comb and the flyer’s password.'};else lead={room:'roof',text:'Go upstairs and choose how your night ends.'};
 return {notes,lead};
}
