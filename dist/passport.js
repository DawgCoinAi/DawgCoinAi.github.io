export const STAMPS=[
 {id:'classic',name:'Block cleaner',game:'Maze Munch',target:500,icon:'◉'},
 {id:'rush',name:'Full send',game:'60-Second Rush',target:600,icon:'ϟ'},
 {id:'daily',name:'Daily explorer',game:'Daily Run',target:800,icon:'✦'},
 {id:'trade',name:'Made it out',game:'Street Hustle',target:2500,icon:'$'},
 {id:'flappy',name:'Sky regular',game:'Flappy DAWG',target:50,icon:'↟'},
 {id:'cross',name:'Uptown bound',game:'DAWG Cross',target:100,icon:'⇧'},
 {id:'snake',name:'Pack grower',game:'Neon Snake',target:100,icon:'∿'},
 {id:'runner',name:'Night runner',game:'DAWG Dash',target:400,icon:'»'},
 {id:'turbo',name:'Loop legend',game:'Turbo Pup',target:1500,icon:'∞'},
 {id:'story',name:'Main character',game:'After Hours',target:1,icon:'☾'}
];
export function validPassport(s){return s?.version===1&&Array.isArray(s.stamps)&&s.stamps.length<=STAMPS.length&&new Set(s.stamps).size===s.stamps.length&&s.stamps.every(id=>STAMPS.some(m=>m.id===id))&&typeof s.complete==='boolean'&&(!s.complete||s.stamps.length===STAMPS.length);}
export function updatePassport(saved,records){const state=validPassport(saved)?{version:1,stamps:[...saved.stamps],complete:saved.complete}:{version:1,stamps:[],complete:false},unlocked=STAMPS.filter(m=>!state.stamps.includes(m.id)&&Number.isFinite(records?.[m.id])&&records[m.id]>=m.target);state.stamps.push(...unlocked.map(m=>m.id));const completed=!state.complete&&state.stamps.length===STAMPS.length;if(completed)state.complete=true;return {state,unlocked,reward:unlocked.length*100+(completed?300:0),completed};}
