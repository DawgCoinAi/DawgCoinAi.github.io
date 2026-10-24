// The glTF exporter reads Blob buffers through the browser FileReader API.
// This small Node adapter keeps offline CLI exports dependency free.
export function installFileReader(){if(typeof globalThis.FileReader!=='undefined')return;globalThis.FileReader=class {
 readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.({target:this});}).catch(error=>this.onerror?.(error));}
 readAsDataURL(blob){blob.arrayBuffer().then(value=>{this.result='data:'+blob.type+';base64,'+Buffer.from(value).toString('base64');this.onloadend?.({target:this});}).catch(error=>this.onerror?.(error));}
};}
