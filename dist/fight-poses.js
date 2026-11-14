// BITE NIGHT poses: every stance, strike, reaction and cinematic pose as a 26-number vector the
// scene applies to a DAWG rig. Pure tables and maths, no rendering.
// Layout: [0 lunge, 1 lift, 2 pitch, 3 roll | 4 bodyY, 5 bodyPitch, 6 bodyYaw, 7 bodyRoll |
//  8-10 spine xyz | 11-13 head xyz | 14-16 near arm (swing, spread, elbow) | 17-19 far arm |
//  20-22 near leg (swing, spread, knee) | 23-25 far leg]. "Near" is the camera-side limb.
// Arm/leg swing: negative is forward. Yaw: positive turns the chest toward the camera.
export const N=26;
const P=o=>{const v=new Float32Array(N);v[0]=o.rf||0;v[1]=o.ry||0;v[2]=o.rp||0;v[3]=o.rr||0;v[4]=o.by||0;v[5]=o.bp||0;v[6]=o.byaw||0;v[7]=o.br||0;
 const put=(i,a)=>{if(a){v[i]=a[0]||0;v[i+1]=a[1]||0;v[i+2]=a[2]||0;}};put(8,o.s);put(11,o.h);put(14,o.an);put(17,o.af);put(20,o.ln);put(23,o.lf);return v;};
const LEGS={ln:[.3,.05,.35],lf:[-.45,.05,.55]},CR={ln:[-1.15,.1,1.95],lf:[-1.35,.1,2.05]};
const D={
 stand:{by:-.05,bp:.12,byaw:.28,s:[.06,.1,0],h:[-.1,-.2,0],an:[-.75,.1,-1.75],af:[-1.2,.05,-1.35],...LEGS},
 walkA:{by:-.03,bp:.12,byaw:.28,h:[-.1,-.2,0],an:[-.75,.1,-1.75],af:[-1.2,.05,-1.35],ln:[-.5,.05,.3],lf:[.4,.05,.6]},
 walkB:{by:-.06,bp:.12,byaw:.28,h:[-.1,-.2,0],an:[-.8,.1,-1.7],af:[-1.15,.05,-1.4],ln:[.45,.05,.6],lf:[-.55,.05,.3]},
 crouch:{by:-.4,bp:.3,byaw:.2,h:[-.25,-.2,0],an:[-.9,.1,-1.9],af:[-1.2,0,-1.6],...CR},
 guard:{by:-.06,bp:-.06,byaw:.4,h:[.22,-.1,0],an:[-1.35,-.25,-2.1],af:[-1.55,-.2,-2],ln:[.3,0,.3],lf:[-.3,0,.4]},
 guardlow:{by:-.4,bp:.2,byaw:.35,h:[.2,-.1,0],an:[-1.3,-.25,-2.1],af:[-1.5,-.2,-2],...CR},
 jump:{by:.05,bp:.12,an:[-.4,.6,-.8],af:[-.6,.6,-.8],ln:[-1.25,0,1.85],lf:[-.7,0,1.4]},
 fall:{by:.03,bp:-.05,an:[-2.2,.7,-.4],af:[-2.2,.7,-.4],ln:[-.3,.1,.5],lf:[.2,.1,.7]},
 dashf:{rf:.1,bp:.55,byaw:-.1,an:[.9,.2,-.6],af:[-1.3,0,-1.2],ln:[.85,0,.6],lf:[-1.05,0,.95]},
 dashf2:{rf:.1,bp:.55,byaw:.1,an:[-1.3,.2,-1.2],af:[.9,0,-.6],ln:[-1.05,0,.95],lf:[.85,0,.6]},
 dashb:{bp:-.3,byaw:.3,an:[-1,.2,-1.2],af:[-.8,.2,-1],ln:[-.7,0,.4],lf:[.5,0,.6]},
 jabH:{rf:.3,bp:.22,byaw:-.35,h:[-.1,.2,0],af:[-1.55,0,-.05],an:[-.8,.1,-1.9],ln:[.45,0,.2],lf:[-.6,0,.6]},
 crossW:{byaw:.55,bp:.08,an:[-.5,.25,-2],af:[-1.1,0,-1.6],...LEGS},
 crossH:{rf:.34,bp:.26,byaw:-.75,h:[-.1,.5,0],an:[-1.6,0,-.05],af:[-.9,0,-2],ln:[.55,0,.15],lf:[-.6,0,.65]},
 hookW:{byaw:.8,bp:.05,an:[-1,.95,-1.6],af:[-1.1,0,-1.7],...LEGS},
 hookH:{rf:.32,byaw:-.95,bp:.2,h:[0,.6,0],an:[-1.5,.45,-.9],af:[-.8,.1,-2],ln:[.5,0,.2],lf:[-.6,0,.6]},
 lowH:{by:-.22,bp:-.18,byaw:-.2,rf:.2,an:[-.6,.5,-1.2],af:[-.9,.3,-1.5],ln:[.35,0,.9],lf:[-1.5,0,.08]},
 heavyW:{byaw:.9,bp:0,by:-.08,an:[.65,.3,-1.4],af:[-1.2,0,-1.2],...LEGS},
 heavyH:{rf:.4,byaw:-.85,bp:.36,h:[-.1,.6,0],an:[-1.5,0,-.1],af:[-.3,.3,-1.5],ln:[.65,0,.2],lf:[-.75,0,.7]},
 overW:{by:.06,bp:-.28,an:[-2.9,0,-.3],af:[-2.9,0,-.3],ln:[.1,0,.2],lf:[-.3,0,.3]},
 overH:{rf:.32,by:-.22,bp:.62,an:[-1.1,0,0],af:[-1.1,0,0],ln:[.55,0,.4],lf:[-.85,0,.95]},
 upperW:{by:-.42,bp:.38,byaw:.5,an:[.35,0,-1.2],af:[-1,0,-1.8],...CR},
 upperH:{rf:.16,ry:.12,by:.1,bp:-.28,byaw:-.4,h:[-.3,0,0],an:[-2.95,0,-.2],af:[-.3,.3,-1.3],ln:[.1,0,.1],lf:[-.3,0,.2]},
 sweepH:{by:-.46,bp:-.25,byaw:-.5,rf:.25,an:[.6,.4,-.3],af:[-.5,.6,-.5],ln:[-1.5,0,.02],lf:[-1.2,0,2.1]},
 airL:{bp:.32,an:[-.5,.4,-1.4],af:[-1.45,0,-.15],ln:[-1,0,1.6],lf:[-.4,0,1.2]},
 airH:{bp:-.22,rp:-.25,an:[-.4,.7,-.6],af:[-.4,.7,-.6],ln:[-.2,0,1.7],lf:[-1.35,0,.08]},
 throwW:{rf:.22,bp:.26,an:[-1.4,.3,-.4],af:[-1.4,.3,-.4],ln:[.5,0,.3],lf:[-.6,0,.6]},
 throwH:{rf:.1,bp:-.12,by:-.05,an:[-1.9,.1,-.6],af:[-1.9,.1,-.6],ln:[.3,0,.4],lf:[-.4,0,.5]},
 throwT:{rf:.2,byaw:-.95,bp:.32,an:[-1.2,.8,0],af:[-1.2,.8,0],ln:[.6,0,.2],lf:[-.7,0,.7]},
 castW:{byaw:.65,by:-.05,an:[.5,.3,-1.5],af:[-1.2,0,-1.3],...LEGS},
 castH:{rf:.16,byaw:-.5,bp:.2,an:[-1.52,0,0],af:[-.5,.3,-1.4],ln:[.5,0,.2],lf:[-.6,0,.6]},
 castlowH:{rf:.14,by:-.32,bp:.4,byaw:-.4,an:[-1.05,0,0],af:[-.5,.3,-1.4],...CR},
 castupH:{byaw:-.3,bp:-.22,an:[-2.45,0,0],af:[-.5,.4,-1.2],ln:[.2,0,.2],lf:[-.3,0,.3]},
 beamW:{byaw:.5,by:-.1,an:[.4,.4,-1.4],af:[.4,.4,-1.4],...LEGS},
 beamH:{rf:.1,bp:.22,by:-.12,an:[-1.5,-.15,0],af:[-1.5,-.15,0],ln:[.6,0,.3],lf:[-.7,0,.8]},
 palmH:{rf:.42,bp:.2,by:-.08,an:[-1.5,-.1,0],af:[-1.5,-.1,0],ln:[.7,0,.2],lf:[-.8,0,.8]},
 kickA:{bp:-.3,byaw:-.2,an:[-.5,.6,-1],af:[-.9,.3,-1.5],ln:[.2,0,.3],lf:[-1.55,0,.05]},
 kickB:{bp:-.25,byaw:.2,an:[-.9,.3,-1.5],af:[-.5,.6,-1],ln:[-1.3,0,.9],lf:[.1,0,.3]},
 charge:{rf:.22,bp:.58,byaw:-.5,an:[-.2,.2,-2.2],af:[.5,.2,-1],ln:[.7,0,.5],lf:[-.9,0,1]},
 rungrab:{rf:.2,bp:.45,an:[-1.4,.6,-.3],af:[-1.4,.6,-.3],ln:[.8,0,.6],lf:[-1,0,.9]},
 upgrab:{by:.05,bp:-.2,an:[-2.8,.25,-.2],af:[-2.8,.25,-.2],ln:[.1,0,.1],lf:[-.2,0,.2]},
 counter:{by:-.1,bp:-.06,byaw:.55,h:[0,-.35,0],an:[-1.4,.4,-1.2],af:[-.6,.3,-1.7],ln:[.4,0,.4],lf:[-.5,0,.6]},
 counterlow:{by:-.4,bp:.15,byaw:.5,h:[.1,-.3,0],an:[-1,.4,-1],af:[-.6,.3,-1.7],...CR},
 tele:{by:-.12,bp:.1,an:[-.3,.9,-.2],af:[-.3,.9,-.2],ln:[.1,.2,.4],lf:[-.1,.2,.4]},
 sip:{bp:-.12,h:[-.32,0,0],an:[-1.4,-.3,-2.2],af:[.1,.2,-.2],ln:[.1,0,.1],lf:[-.1,0,.1]},
 honk:{bp:-.22,by:-.05,h:[-.45,0,0],an:[-1.6,.7,-.4],af:[-1.6,.7,-.4],ln:[.3,.2,.3],lf:[-.3,.2,.3]},
 stompW:{by:.05,bp:-.1,an:[-2.2,.3,-.6],af:[-2.2,.3,-.6],ln:[-1.45,0,1.7],lf:[0,0,.1]},
 stompH:{by:-.26,bp:.32,an:[-.3,.5,-.4],af:[-.3,.5,-.4],ln:[-.35,0,.6],lf:[.2,0,.5]},
 swingW:{byaw:.95,bp:0,an:[-1.2,1.1,-.3],af:[-1.2,.2,-1.3],...LEGS},
 swingH:{byaw:-.95,rf:.32,bp:.22,an:[-1.42,-.3,0],af:[-.6,.4,-1.2],ln:[.6,0,.2],lf:[-.7,0,.7]},
 thrustH:{rf:.52,bp:.42,by:-.1,an:[-1.52,0,0],af:[.4,.3,-.6],ln:[.85,0,.2],lf:[-1,0,.9]},
 dive:{rp:.35,bp:.1,an:[.4,.6,-.3],af:[.4,.6,-.3],ln:[-.3,0,1.75],lf:[-1.25,0,0]},
 ball:{by:-.2,bp:.7,h:[.6,0,0],an:[-1.2,0,-2.2],af:[-1.2,0,-2.2],ln:[-1.9,0,2.2],lf:[-1.9,0,2.2]},
 hithigh:{rf:-.1,bp:-.36,byaw:.3,h:[-.5,.3,0],an:[-.3,.5,-.6],af:[-.2,.5,-.5],ln:[.4,0,.3],lf:[-.2,0,.3]},
 hitlow:{rf:-.08,by:-.1,bp:.56,h:[.4,0,0],an:[-.9,.2,-1.6],af:[-.9,.2,-1.6],ln:[.3,0,.5],lf:[-.3,0,.6]},
 fly:{rp:-1.15,h:[-.3,0,0],an:[-2.6,.6,0],af:[-2.6,.6,0],ln:[-.4,.3,.3],lf:[.3,.3,.5]},
 lie:{rp:-1.52,ry:-.62,h:[.1,0,.2],an:[-.5,1.2,0],af:[-.5,1.2,0],ln:[-.1,.3,0],lf:[-.1,.35,0]},
 held:{ry:.28,bp:-.2,h:[.3,0,0],an:[.3,.6,-.3],af:[.3,.6,-.3],ln:[-.5,.2,.9],lf:[-.2,.2,.7]},
 dizzy:{by:-.08,bp:.26,h:[.35,0,.22],an:[.15,.25,-.2],af:[.15,.25,-.2],ln:[.1,.12,.2],lf:[-.1,.12,.2]},
 cheer:{by:.02,bp:-.16,h:[-.3,0,0],an:[-2.9,.38,-.2],af:[-2.9,.38,-.2],ln:[.05,.1,.1],lf:[-.05,.1,.1]},
 taunt:{byaw:.65,bp:-.1,h:[0,-.3,0],an:[.2,.5,-1.6],af:[-1.35,.15,-.15],ln:[.15,.1,.1],lf:[-.2,.1,.2]},
 // Cinematic-only poses.
 sit:{by:-.52,bp:-.1,an:[-.3,.2,-.6],af:[-.3,.2,-.6],ln:[-1.5,.25,.2],lf:[-1.5,.25,.2]},
 alert:{by:.03,bp:-.1,h:[-.28,0,0],an:[.2,.4,-.2],af:[.2,.4,-.2],ln:[.05,.05,.05],lf:[-.05,.05,.05]},
 jumpup:{by:.08,bp:-.2,h:[-.4,0,0],an:[-2.95,.15,0],af:[-2.95,.15,0],ln:[.1,0,.6],lf:[-.4,0,.9]},
 flat:{an:[0,1.5,0],af:[0,1.5,0],ln:[0,.55,0],lf:[0,.55,0],h:[-.2,0,0]},
 cower:{by:-.32,bp:.42,h:[.45,0,0],an:[-2.45,.2,-2],af:[-2.45,.2,-2],...CR},
 stiff:{an:[0,.12,0],af:[0,.12,0],ln:[0,.04,0],lf:[0,.04,0]},
 hang:{by:.05,h:[.25,0,0],an:[-3,.2,0],af:[-3,.2,0],ln:[.1,0,.3],lf:[-.1,0,.3]},
 hug:{bp:.2,an:[-1.4,-.4,-1],af:[-1.4,-.4,-1],ln:[-.6,.3,.9],lf:[-.6,.3,.9]},
 lift:{by:-.03,bp:-.1,an:[-2.95,.2,-.1],af:[-2.95,.2,-.1],ln:[.2,.1,.2],lf:[-.2,.1,.2]},
 wave:{bp:-.05,h:[-.1,-.3,.1],an:[-2.7,.5,-.5],af:[.1,.2,-.2],ln:[.1,.05,.1],lf:[-.1,.05,.1]},
 bow:{bp:.95,h:[.3,0,0],an:[.2,.2,-.3],af:[-.6,-.3,-1.6],ln:[.05,0,.05],lf:[-.05,0,.05]},
 arms:{bp:-.1,byaw:.5,h:[-.15,-.3,0],an:[-.9,-.5,-2],af:[-.9,-.5,-2],ln:[.15,.1,.1],lf:[-.15,.1,.1]},
 shrug:{h:[0,0,.2],an:[-.3,.9,-1.6],af:[-.3,.9,-1.6],ln:[.05,.05,.05],lf:[-.05,.05,.05]},
 sniff:{bp:.25,h:[-.42,0,0],an:[.1,.2,-.3],af:[.1,.2,-.3],ln:[.1,0,.1],lf:[-.1,0,.1]},
 dust:{bp:.1,an:[-1.2,-.3,-1.3],af:[-1.2,-.3,-1.3],ln:[.1,.05,.1],lf:[-.1,.05,.1]},
 tap:{rf:.1,bp:.12,byaw:-.3,af:[-1.42,0,-.2],an:[.2,.2,-.4],ln:[.3,0,.2],lf:[-.3,0,.3]},
 blow:{bp:.3,h:[.1,0,0],an:[-1.3,.5,-1.8],af:[-1.3,.5,-1.8],ln:[.3,0,.3],lf:[-.3,0,.4]},
 rake:{bp:.36,an:[-1.1,0,-.4],af:[-1,0,-.6],ln:[.3,0,.3],lf:[-.3,0,.4]},
 snap:{byaw:.4,an:[.2,.4,-1.5],af:[-1.9,.3,-1.4],h:[0,-.2,0],ln:[.1,.05,.1],lf:[-.1,.05,.1]},
 skid:{bp:-.32,an:[-.6,.7,-.4],af:[.3,.7,-.4],ln:[-.9,0,.1],lf:[.4,0,.95]},
 aim:{h:[.1,0,0],an:[-1.5,-.2,-1],af:[-1.5,-.2,-1],ln:[.15,.05,.2],lf:[-.15,.05,.2]},
 kneel:{by:-.42,bp:.25,h:[.4,0,0],an:[.1,.2,-.2],af:[.1,.2,-.2],ln:[-.2,0,1.9],lf:[-1.5,0,1.6]},
 reach:{bp:.1,an:[.1,.2,-.3],af:[-2.2,.2,-.2],ln:[.2,0,.2],lf:[-.2,0,.2]},
 pull:{by:-.12,bp:-.2,an:[.1,.2,-.3],af:[-.6,.2,-1.9],ln:[.3,0,.4],lf:[-.3,0,.5]},
 scrub:{by:-.15,bp:.42,an:[-1.2,0,-.8],af:[-1.2,0,-.8],ln:[.3,0,.5],lf:[-.3,0,.6]},
 batready:{byaw:.9,an:[-1.6,.5,-1.6],af:[-1.6,-.3,-1.4],...LEGS},
 batwind:{byaw:1.25,bp:-.1,an:[-1.4,1.2,-1],af:[-1.6,.3,-1.6],...LEGS},
 batswing:{byaw:-1.1,rf:.3,bp:.2,an:[-1.5,-.5,0],af:[-1.5,-.9,-.2],ln:[.6,0,.2],lf:[-.7,0,.7]},
 salute:{bp:-.05,an:[.1,.15,-.1],af:[-2.3,.9,-2.3],ln:[.03,.03,0],lf:[-.03,.03,0]},
 kick:{bp:-.32,byaw:-.2,an:[-.5,.6,-1],af:[-.9,.3,-1.5],ln:[.2,0,.3],lf:[-1.6,0,.02]}
};
export const POSE=Object.fromEntries(Object.entries(D).map(([k,o])=>[k,P(o)]));
for(const [a,b]of [['point','taunt'],['windup','heavyW'],['punch','heavyH'],['upper','upperH'],['slam','overH'],['cast','castH'],['palm','palmH'],['push','palmH'],['grab','throwW'],['fold','dust'],['catch','reach'],['tumble','ball'],['walk','walkA'],['run','dashf']])POSE[a]=POSE[b];
// Poses that keep moving while held (cinematics): [index, amplitude, speed].
export const WIGGLE={wave:[14,.35,11],scrub:[14,.5,16],dust:[14,.3,14],dizzy:[7,.12,3.2],cheer:[1,.07,9],rake:[14,.3,6],run:[0,0,0],walk:[0,0,0],hang:[23,.25,5],alert:[11,.05,14],fold:[14,.4,12]};
// Move animations: [windup pose, strike pose] or a cycling list; the scene eases stand → windup
// through startup, snaps to the strike at the first active frame and relaxes through recovery.
export const CLIP={jab:['stand','jabH'],cross:['crossW','crossH'],hook:['hookW','hookH'],lowjab:['crouch','lowH'],heavy:['heavyW','heavyH'],over:['overW','overH'],upper:['upperW','upperH'],sweep:['crouch','sweepH'],
 airL:['jump','airL'],airH:['jump','airH'],throw:['throwW','throwW'],flurry:['crossW',['jabH','crossH']],dash:['dashf','dashf'],slam:['overW','overH'],rise:['upperW','upperH'],cast:['castW','castH'],castlow:['castW','castlowH'],castup:['castW','castupH'],
 beam:['beamW','beamH'],rungrab:['dashf','rungrab'],charge:['heavyW','charge'],grab:['throwW','throwW'],upgrab:['crouch','upgrab'],palm:['beamW','palmH'],sip:['sip','sip'],counter:['counter','counter'],counterlow:['counterlow','counterlow'],
 dive:['jump','dive'],tele:['tele','tele'],honk:['beamW','honk'],stomp:['stompW','stompH'],kicks:['kickB',['kickA','kickB']],swing:['swingW','swingH'],upswing:['upperW','upperH'],thrust:['dashb','thrustH'],roll:['ball','ball']};
export const mix=(out,a,b,k)=>{for(let i=0;i<N;i++)out[i]=a[i]+(b[i]-a[i])*k;return out;};
const ease=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
const tmpA=new Float32Array(N);
/** The pose of a move at frame t: wind up, strike, recover. */
export function clipPose(out,m,t,time){const c=CLIP[m.anim]||CLIP.jab,wind=POSE[c[0]],hit=Array.isArray(c[1])?POSE[c[1][Math.floor(t/4)%c[1].length]]:POSE[c[1]],s=m.s,a=m.fall?99:m.a,st=POSE.stand;
 if(t<=s){const k=s<=1?1:t/s;return k<.7?mix(out,st,wind,ease(k/.7)):mix(out,wind,hit,ease((k-.7)/.3)*.85);}
 if(t<=s+a)return mix(out,hit,hit,0);
 return mix(out,hit,st,ease((t-s-a)/Math.max(1,m.r)));}
/** The pose for a fighter's engine state (not attacking). */
export function statePose(out,f,time,phase){const st=f.st,w=Math.sin(time*9);
 switch(st){
  case 'walk':return mix(out,POSE.walkA,POSE.walkB,.5+.5*Math.sin(time*11));
  case 'crouch':case 'pre':return mix(out,POSE.crouch,POSE.crouch,0);
  case 'block':case 'bstun':{const p=f.low?POSE.guardlow:POSE.guard;mix(out,p,p,0);if(st==='bstun'){out[0]-=.1;out[5]-=.12;}return out;}
  case 'jump':return mix(out,POSE.jump,POSE.fall,f.vy>0?0:ease(Math.min(1,-f.vy*8)));
  case 'dash':return mix(out,POSE.dashf,POSE.dashf2,.5+.5*Math.sin(time*26));
  case 'bdash':return mix(out,POSE.dashb,POSE.dashb,0);
  case 'hit':return mix(out,POSE.stand,f.low||f.stun%2?POSE.hitlow:POSE.hithigh,Math.min(1,.55+f.stun/20));
  case 'rec':return mix(out,POSE.stand,POSE.crouch,.3);
  case 'launch':return mix(out,POSE.fly,POSE.ball,.25+.25*w);
  case 'down':case 'ko':return mix(out,POSE.lie,POSE.lie,0);
  case 'wake':return mix(out,POSE.lie,POSE.crouch,ease(f.t/14));
  case 'throwing':return mix(out,POSE.throwH,POSE.throwT,ease((f.t-18)/14));
  case 'thrown':return mix(out,POSE.held,POSE.held,0);
  case 'dizzy':{mix(out,POSE.dizzy,POSE.dizzy,0);out[7]+=Math.sin(time*3.2)*.14;out[5]+=Math.sin(time*2.1)*.08;return out;}
  case 'win':{mix(out,POSE.cheer,POSE.cheer,0);out[1]+=Math.abs(Math.sin(time*7))*.12;return out;}
  default:{mix(out,POSE.stand,POSE.stand,0);out[4]+=Math.sin(time*3.4)*.012;out[14]+=Math.sin(time*3.4)*.04;out[17]+=Math.sin(time*3.4+1)*.04;return out;}
 }}
/** A named pose with its idle motion, for cinematics. */
export function namedPose(out,name,time){const p=POSE[name]||POSE.stand;mix(out,p,p,0);
 if(name==='run'){return mix(out,POSE.dashf,POSE.dashf2,.5+.5*Math.sin(time*26));}if(name==='walk'){return mix(out,POSE.walkA,POSE.walkB,.5+.5*Math.sin(time*11));}
 const w=WIGGLE[name];if(w)out[w[0]]+=Math.sin(time*w[2])*w[1];if(name==='tumble')out[2]=0;return out;}
export {tmpA};
