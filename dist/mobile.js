import {mobileLayout,stickDirection,clampStick,isTimed} from './mobile-core.js';
const $=id=>document.getElementById(id);
export class MobileControls {
 constructor(callbacks,prefs){
  this.callbacks=callbacks;this.prefs=prefs;this.active=false;this.pointer=null;this.lastDirection=null;this.scrollY=0;
  this.coarse=()=>window.matchMedia('(pointer: coarse)').matches||window.innerWidth<=820;
  this.resize=()=>this.layout();window.addEventListener('resize',this.resize);window.visualViewport?.addEventListener('resize',this.resize);
  $('mobileBack').onclick=()=>callbacks.exit();$('mobilePause').onclick=()=>callbacks.pause();$('mobileSettings').onclick=()=>callbacks.settings();
  const stick=$('thumbstick');
  stick.addEventListener('pointerdown',e=>{if(this.pointer!==null)return;e.preventDefault();this.pointer=e.pointerId;stick.setPointerCapture(e.pointerId);stick.classList.add('held');this.move(e);});
  stick.addEventListener('pointermove',e=>{if(e.pointerId===this.pointer){e.preventDefault();this.move(e);}});
  const release=e=>{if(e.pointerId!==this.pointer)return;this.pointer=null;this.lastDirection=null;stick.classList.remove('held');$('stickKnob').style.transform='translate(0,0)';};
  stick.addEventListener('pointerup',release);stick.addEventListener('pointercancel',release);stick.addEventListener('lostpointercapture',release);
  document.querySelectorAll('[data-mobile-dir]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();callbacks.direction(b.dataset.mobileDir);});b.onclick=()=>callbacks.direction(b.dataset.mobileDir);});
  $('mobileDash').addEventListener('pointerdown',e=>{e.preventDefault();callbacks.dash();});$('mobileDash').onclick=()=>callbacks.dash();
  this.applyPrefs();
 }
 move(e){const r=$('thumbstick').getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,p=clampStick(dx,dy);$('stickKnob').style.transform=`translate(${p.x}px,${p.y}px)`;const direction=stickDirection(dx,dy,this.lastDirection);if(direction&&direction!==this.lastDirection){this.lastDirection=direction;this.callbacks.direction(direction);}if(!direction)this.lastDirection=null;}
 applyPrefs(){document.body.dataset.touchControls=this.prefs.controls;document.body.dataset.dashSide=this.prefs.hand==='left'?'left':'right';}
 enter(){if(this.active)return;this.scrollY=window.scrollY;this.active=true;document.body.classList.add('mobile-session');document.documentElement.classList.add('mobile-session');this.layout();}
 exit(){this.active=false;document.body.classList.remove('mobile-session','mobile-landscape');document.documentElement.classList.remove('mobile-session');this.pointer=null;this.lastDirection=null;$('stickKnob').style.transform='translate(0,0)';window.scrollTo({top:this.scrollY,behavior:'instant'});}
 layout(){
  if(!this.active)return;const v=window.visualViewport,w=Math.round(v?.width||window.innerWidth),h=Math.round(v?.height||window.innerHeight),s=getComputedStyle($('safeAreaProbe'));
  const safe={top:parseFloat(s.paddingTop)||0,bottom:parseFloat(s.paddingBottom)||0,left:parseFloat(s.paddingLeft)||0,right:parseFloat(s.paddingRight)||0};
  const l=mobileLayout(w,h,safe),prior=document.body.classList.contains('mobile-landscape');document.body.classList.toggle('mobile-landscape',l.landscape);
  const root=$('arcadePanel').style;root.setProperty('--mobile-width',w+'px');root.setProperty('--mobile-height',h+'px');root.setProperty('--board-width',l.boardWidth+'px');
  root.setProperty('--viewport-top',(v?.offsetTop||0)+'px');root.setProperty('--viewport-left',(v?.offsetLeft||0)+'px');
  if(prior!==l.landscape)this.callbacks.rotate();
 }
 sync(game,mode,countdown=false){
  const canDash=!countdown&&game.status==='playing'&&game.dashCooldown<=0;
  $('mobileDash').disabled=!canDash;$('mobileDash').style.setProperty('--charge',(1-game.dashCooldown/game.dashRecharge)*100+'%');
  $('mobileDashLabel').textContent=game.dashCooldown>0?game.dashCooldown.toFixed(1)+'s':'DASH';$('mobileDashHint').textContent=countdown?'GET READY':game.status==='paused'?'PAUSED':canDash?'SHIELDED BURST':game.dashCooldown>0?'RECHARGING':'READY WHEN YOU ARE';
  $('mobileMode').textContent=mode==='daily'?'DAILY RUN':mode==='rush'?'60-SECOND RUSH':'MAZE MUNCH';$('mobileDistrict').textContent=document.body.classList.contains('mobile-landscape')?game.score.toLocaleString()+' PTS · '+(isTimed(mode)?Math.ceil(game.time)+'s':game.lives+' LIVES'):game.district.name+' · '+(isTimed(mode)?Math.ceil(game.time)+'s':'LEVEL '+game.level);
  $('mobilePause').textContent=game.status==='paused'?'▷':'Ⅱ';$('mobilePause').disabled=countdown||!['playing','paused'].includes(game.status);$('mobilePause').setAttribute('aria-label',game.status==='paused'?'Resume game':'Pause game');
  $('mobileIntel').textContent=game.power>0?'BEAST MODE · '+game.power.toFixed(1)+'s':game.loot?'GOLD BAG · '+Math.ceil(game.loot.time)+'s':'SWIPE OR USE YOUR THUMB';
 }
 haptic(pattern=12){if(this.prefs.haptics&&this.active&&typeof navigator.vibrate==='function'){try{navigator.vibrate(pattern);}catch{}}}
}
