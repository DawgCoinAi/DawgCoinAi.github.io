// Lazy, failure-safe 3D scene for a 2D scene canvas (Street Hustle, After Hours). Returns a
// function that draws a place and returns the characters' screen anchors (or false if it didn't); until the 3D scene has loaded, or if
// it fails, it returns false and the caller draws its 2D scene as before. Three.js and the
// models load only when a scene is first shown.
export function sceneFor(canvas){let state='idle',scene=null;
 return place=>{if(state==='idle'){if(typeof WebGL2RenderingContext==='undefined'){state='failed';return false;}state='loading';
   import('./scene-3d.js').then(({ThreeStreetScene})=>{const s=new ThreeStreetScene(canvas,{onFailure:()=>{state='failed';scene=null;}});return s.init().then(()=>{if(state==='loading'&&s.ready){scene=s;state='ready';}else if(state==='loading')state='failed';});}).catch(()=>{state='failed';});}
  if(state!=='ready'||!scene)return false;try{return scene.draw(place)?scene.anchors||{}:false;}catch{state='failed';scene.dispose();scene=null;return false;}};}
