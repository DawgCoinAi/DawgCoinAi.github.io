// Real full screen for game sessions. Every game already fills the browser window while it is
// played; this also asks the browser to drop its own bars (address bar, tabs, phone system UI)
// so the game owns the whole screen. Sessions call enter() when they start and exit() when they
// end. Switching straight from one game to another keeps full screen (the exit is deferred and
// cancelled by the next enter). Where the browser can't (an iPhone, an embedded view) the game
// still fills the window. Players can turn it off in the in-game ⛶ button; that choice is kept.
const KEY='dawg-fullscreen';
const doc=()=>globalThis.document;
const root=()=>doc()?.documentElement;
let leaving=0;
function readPref(){try{return globalThis.localStorage?.getItem(KEY)!=='off';}catch{return true;}}
function writePref(on){try{globalThis.localStorage?.setItem(KEY,on?'on':'off');}catch{}}
export const immersive={
 // The browser can put the page in full screen at all.
 supported(){const el=root();return !!(el&&(el.requestFullscreen||el.webkitRequestFullscreen));},
 // The page is in browser full screen right now (or was installed and launched as an app).
 active(){const d=doc();return !!(d&&(d.fullscreenElement||d.webkitFullscreenElement))||!!globalThis.matchMedia?.('(display-mode: fullscreen)').matches;},
 wanted(){return readPref();},
 // Must run inside the click/tap/keypress that starts a game: browsers only allow full screen there.
 enter(){clearTimeout(leaving);leaving=0;if(!readPref()||this.active()||!this.supported())return false;const el=root();
  try{const p=(el.requestFullscreen||el.webkitRequestFullscreen).call(el,{navigationUI:'hide'});p?.catch?.(()=>{});return true;}catch{return false;}},
 // Leaves full screen a moment later, unless another game session starts in the meantime.
 exit(){clearTimeout(leaving);leaving=setTimeout(()=>{leaving=0;const d=doc();if(!d||!(d.fullscreenElement||d.webkitFullscreenElement))return;try{(d.exitFullscreen||d.webkitExitFullscreen).call(d)?.catch?.(()=>{});}catch{}},180);},
 // The ⛶ button: flip it now and remember the choice for next time.
 toggle(){if(this.active()){writePref(false);clearTimeout(leaving);const d=doc();try{(d.exitFullscreen||d.webkitExitFullscreen).call(d)?.catch?.(()=>{});}catch{}return false;}writePref(true);return this.enter();},
 // Keeps a ⛶ button's label and visibility in step with the state.
 bind(button){if(!button)return;const sync=()=>{const on=this.active();button.hidden=!this.supported();button.textContent=on?'⤡':'⛶';button.setAttribute('aria-label',on?'Leave full screen':'Full screen');button.setAttribute('aria-pressed',String(on));};
  button.addEventListener?.('click',e=>{e.preventDefault();this.toggle();setTimeout(sync,250);});doc()?.addEventListener?.('fullscreenchange',sync);doc()?.addEventListener?.('webkitfullscreenchange',sync);sync();}
};
