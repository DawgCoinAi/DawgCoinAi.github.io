import {T,createDawgAsset,setDawgPose} from './dawg-graphics-model.js';
export const LIGHTING={neon:{background:0x111326,key:0xffe6d2,rim:0xc198ff,fill:0x8dffe3},gallery:{background:0x252936,key:0xfff3dd,rim:0xe1e9ff,fill:0xb9ccff},sunset:{background:0x291d30,key:0xffcf95,rim:0xff73ba,fill:0x83d8ff}};
function studio(transparent=false){const scene=new T.Scene();if(!transparent){scene.background=new T.Color(LIGHTING.neon.background);scene.fog=new T.Fog(LIGHTING.neon.background,7,16);}const hemi=new T.HemisphereLight(0xc6d9ff,0x42334c,2);scene.add(hemi);const key=new T.DirectionalLight(0xffe6d2,4);key.position.set(-3,5,4);key.castShadow=!transparent;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-1;key.shadow.normalBias=.025;key.shadow.bias=-.0001;scene.add(key);const rim=new T.DirectionalLight(0xc198ff,5);rim.position.set(2,3,-3);scene.add(rim);const fill=new T.DirectionalLight(0x8dffe3,1.5);fill.position.set(3,1.2,3);scene.add(fill);return {scene,key,rim,fill};}
function renderer(canvas,alpha=false){const r=new T.WebGLRenderer({canvas,antialias:true,alpha,powerPreference:'low-power',preserveDrawingBuffer:alpha});r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.1;r.shadowMap.enabled=!alpha;r.shadowMap.type=T.PCFShadowMap;return r;}
export class GPUShowroom {
 constructor(canvas,onFailure){this.canvas=canvas;this.r=renderer(canvas);const pmrem=new T.PMREMGenerator(this.r),room=new T.RoomEnvironment();this.environment=pmrem.fromScene(room,.04);pmrem.dispose();room.dispose();Object.assign(this,studio());this.scene.environment=this.environment.texture;this.camera=new T.PerspectiveCamera(31,840/900,.05,25);this.pivot=new T.Group();this.scene.add(this.pivot);this.light='neon';this.quality='full';
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0x101725,metalness:.35,roughness:.42}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.035;this.scene.add(floor);
  const plinth=new T.Mesh(new T.CylinderGeometry(.74,.8,.08,64),new T.MeshStandardMaterial({color:0x263443,metalness:.6,roughness:.32}));plinth.position.y=-.035;plinth.receiveShadow=true;this.scene.add(plinth);
  const ring=new T.Mesh(new T.TorusGeometry(.76,.008,8,80),new T.MeshBasicMaterial({color:0xb5f98d}));ring.rotation.x=Math.PI/2;ring.position.y=.011;this.scene.add(ring);this.ring=ring;
  this.loss=e=>{e.preventDefault();onFailure?.('Graphics context interrupted. Canvas view active.');};canvas.addEventListener('webglcontextlost',this.loss);
 }
 set(d){const next=createDawgAsset(d);this.asset?.root.removeFromParent();this.asset?.dispose();this.asset=next;this.pivot.add(next.root);}
 lighting(name){this.light=name in LIGHTING?name:'neon';const p=LIGHTING[this.light];this.scene.background.set(p.background);this.scene.fog.color.set(p.background);this.key.color.set(p.key);this.rim.color.set(p.rim);this.fill.color.set(p.fill);}
 render({yaw=-.35,pitch=.07,zoom=1,time=0,animation='still',quality='full'}={}){if(!this.asset)return;const dpr=quality==='light'?1:Math.min(globalThis.devicePixelRatio||1,1.5),w=Math.max(240,Math.round(this.canvas.clientWidth||840)),h=Math.round(w*900/840);if(this.width!==w||this.dpr!==dpr){this.r.setPixelRatio(dpr);this.r.setSize(w,h,false);this.width=w;this.dpr=dpr;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}this.r.shadowMap.enabled=quality!=='light';this.pivot.rotation.y=yaw;setDawgPose(this.asset,time,animation);this.camera.position.set(0,1+Math.sin(pitch)*4,4/zoom);this.camera.lookAt(0,.98,0);this.r.render(this.scene,this.camera);}
 dispose(){this.canvas.removeEventListener('webglcontextlost',this.loss);this.asset?.dispose();const gs=new Set(),ms=new Set();this.scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});for(const g of gs)g.dispose();for(const m of ms)m.dispose();this.key.shadow.dispose();this.environment.dispose();this.r.dispose();this.scene.clear();}
}
// Render the same skinned asset into a local atlas; Pixi uploads one texture.
// Returns after each three frames so new outfits do not monopolize the UI thread.
async function renderRunAtlas(d,{frames=12,width=128,height=160,signal,turntable=false}={}){
 const canvas=document.createElement('canvas'),out=document.createElement('canvas');out.width=width*4;out.height=height*Math.ceil(frames/4);const context=out.getContext('2d');let r,a,env,room,pmrem,s;
 try{
  r=renderer(canvas,true);s=studio(true);a=createDawgAsset(d);const camera=new T.OrthographicCamera(-.94,.94,1.175,-1.175,.05,20);camera.position.set(0,1.08,5);camera.lookAt(0,1.08,0);s.scene.add(a.root);r.setSize(width,height,false);r.setClearColor(0x000000,0);
  pmrem=new T.PMREMGenerator(r);room=new T.RoomEnvironment();env=pmrem.fromScene(room,.04);s.scene.environment=env.texture;room.dispose();room=null;pmrem.dispose();pmrem=null;
  for(let i=0;i<frames;i++){if(signal?.aborted)throw new Error('Sprite job cancelled');a.root.rotation.y=turntable?i/frames*Math.PI*2:Math.PI;setDawgPose(a,turntable?0:i/frames*Math.PI*2/13,turntable?'still':'run');r.render(s.scene,camera);if(r.getContext().isContextLost())throw Error('Sprite renderer lost its context');context.drawImage(canvas,i%4*width,Math.floor(i/4)*height);if(i%3===2)await new Promise(resolve=>setTimeout(resolve,0));}
  return {source:out,width,height,frames,columns:4,kind:turntable?'3d-turntable':'3d-run'};
 }finally{a?.dispose();room?.dispose();pmrem?.dispose();env?.dispose();r?.forceContextLoss();r?.dispose();s?.scene.clear();}
}

export const createTurntableAtlas=(d,options={})=>createRunAtlas(d,{...options,frames:8,width:256,height:320,turntable:true});

let atlasQueue=Promise.resolve();
export function createRunAtlas(d,options={}){const job=atlasQueue.then(()=>{if(options.signal?.aborted)throw Error('Sprite job cancelled');return renderRunAtlas(d,options);});atlasQueue=job.catch(()=>{});return job;}
