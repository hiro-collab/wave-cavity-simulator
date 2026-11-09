// UI state transitions with a minimal DOM/canvas stub. Not a real-browser/layout test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements={},context={clearRect(){},fillRect(){},strokeRect(){},drawImage(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},putImageData(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}}};
for(const id of ['field','section','time','state','play','step','reset','status','parameters','mass','stiffness','amplitude','sigma','mirrors','defaults','speed','gain','speed-label','gain-label','export'])elements[id]={value:'',checked:true,width:1080,height:402,getContext(){return context},addEventListener(type,fn){this[type]=fn},reportValidity(){return true}};
Object.entries({mass:4,stiffness:2,amplitude:1,sigma:.225,speed:8,gain:1}).forEach(([k,v])=>elements[k].value=v);
let nextFrame;
const sandbox={window:{},document:{getElementById:id=>elements[id],createElement:()=>({getContext:()=>context})},requestAnimationFrame:f=>nextFrame=f,performance:{now:()=>0},setTimeout,URL,Blob};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('web/model.js','utf8'),sandbox);sandbox.CavityModel=sandbox.window.CavityModel;sandbox.CAVITY_DEFAULTS=sandbox.window.CAVITY_DEFAULTS;
vm.runInContext(fs.readFileSync('web/app.js','utf8'),sandbox);
const read=expr=>vm.runInContext(expr,sandbox);
assert.equal(read('model.steps'),0);
elements.play.onclick();nextFrame();assert.equal(read('model.steps'),8);elements.play.onclick();nextFrame();assert.equal(read('model.steps'),8);
elements.reset.onclick();assert.equal(read('model.steps'),0);assert.equal(read('running'),false);
elements.mass.value=6;elements.parameters.input();assert.equal(read('dirty'),true);elements.reset.onclick();assert.equal(read('dirty'),true);
elements.parameters.onsubmit({preventDefault(){}});assert.equal(read('model.options.mass'),6);assert.equal(read('model.steps'),0);assert.equal(read('dirty'),false);
elements.mirrors.checked=false;elements.parameters.onsubmit({preventDefault(){}});assert.equal(read('model.options.mirrors'),false);assert.equal(read('model.mass.every(v=>v===1)'),true);
elements.play.onclick();nextFrame();elements.step.onclick();assert.equal(read('running'),false);assert.equal(read('model.steps'),9);
elements.defaults.onclick();assert.equal(read('model.options.mass'),4);assert.equal(read('model.options.mirrors'),true);assert.equal(read('model.steps'),0);
console.log('PASS: run/pause, reset, dirty settings, apply, layer-free control, single step, defaults (DOM stub only).');
