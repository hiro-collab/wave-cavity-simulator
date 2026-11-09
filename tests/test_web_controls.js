// UI transitions and render mapping with a minimal DOM/canvas stub.
// This is NOT a real-browser/layout or compatibility test.
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements={},gradients=[],styles={};
const context={clearRect(){},fillRect(){},strokeRect(){},drawImage(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},putImageData(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},createLinearGradient(){const stops=[];gradients.push(stops);return {addColorStop:(offset,color)=>stops.push([offset,color])}}};
const html=fs.readFileSync('web/index.html','utf8');
for(const id of [...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]))elements[id]={value:'',checked:true,style:{},disabled:false,width:1080,height:402,getContext(){return context},addEventListener(type,fn){this[type]=fn},setAttribute(name,value){this[name]=value},reportValidity(){return true}};
Object.entries({mass:4,stiffness:2,amplitude:1,sigma:.225,speed:8,gain:1,'source-mode':'auto',wavelength:18}).forEach(([k,v])=>elements[k].value=String(v));
let nextFrame,download,released=0,clicked=0;
const sandbox={window:{},document:{documentElement:{style:{setProperty:(k,v)=>styles[k]=v}},getElementById:id=>elements[id],createElement:()=>({getContext:()=>context,click(){clicked++}})},requestAnimationFrame:f=>nextFrame=f,performance:{now:()=>0},setTimeout:f=>f(),URL:{createObjectURL:b=>{download=b;return 'blob:test'},revokeObjectURL:()=>released++},Blob};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('web/model.js','utf8'),sandbox);
for(const name of ['CavityModel','CAVITY_DEFAULTS','CAVITY_WAVE_FACTOR'])sandbox[name]=sandbox.window[name];
vm.runInContext(fs.readFileSync('web/app.js','utf8'),sandbox);
const read=expr=>vm.runInContext(expr,sandbox);
const submit=()=>elements.parameters.onsubmit({preventDefault(){}});
const input=(id,value)=>{elements[id].value=String(value);if(elements[id].oninput)elements[id].oninput();elements.parameters.input();};
assert.equal(read('model.steps'),0);assert.equal(read('model.options.sigma'),18);
assert.equal(elements.emit.disabled,true);assert.match(elements.status.textContent,/自動デモ/);
elements.play.onclick();nextFrame();assert.equal(read('model.steps'),8);elements.play.onclick();nextFrame();assert.equal(read('model.steps'),8);
elements.reset.onclick();assert.equal(read('model.steps'),0);assert.equal(read('running'),false);
input('mass',6);assert.equal(read('dirty'),true);elements.reset.onclick();assert.equal(read('dirty'),true);
submit();assert.equal(read('model.options.mass'),6);assert.equal(read('model.steps'),0);assert.equal(read('dirty'),false);
elements.mirrors.checked=false;submit();assert.equal(read('model.options.mirrors'),false);assert.equal(read('model.mass.every(v=>v===1)'),true);
elements.play.onclick();nextFrame();elements.step.onclick();assert.equal(read('running'),false);assert.equal(read('model.steps'),9);
elements.defaults.onclick();assert.equal(read('model.options.mass'),4);assert.equal(read('model.options.mirrors'),true);assert.equal(read('model.steps'),0);assert.equal(read('model.options.sigma'),18);
// Explicit manual mode starts at rest, and emission while paused only schedules.
input('source-mode','manual');submit();assert.equal(read('model.hasExcitation'),false);
elements.step.onclick();assert.equal(read('model.u.every(v=>v===0)'),true);
const pausedSteps=read('model.steps');elements.emit.onclick();
assert.equal(read('running'),false);assert.equal(read('model.steps'),pausedSteps);assert.match(elements.status.textContent,/予約/);
assert.equal(elements.emit.disabled,true);assert.equal(elements['stop-source'].disabled,false);
for(let i=0;i<20;i++)elements.emit.onclick();assert.equal(read('model.emissionCount'),1);assert.equal(read('model.sources.length'),12);
elements.play.onclick();nextFrame();assert.equal(read('running'),true);
read('model.step(240)');
const fieldRef=read('model.u'),prevRef=read('model.prev'),time=read('model.time');
elements['stop-source'].onclick();assert.equal(read('running'),true);assert.equal(read('model.u'),fieldRef);assert.equal(read('model.prev'),prevRef);assert.equal(read('model.time'),time);assert.equal(read('model.force.every(v=>v===0)'),true);
assert.equal(elements.emit.disabled,false);assert.equal(elements['stop-source'].disabled,true);
elements.emit.onclick();assert.equal(read('model.u'),fieldRef);assert.equal(read('model.time'),time);
// Live colors/gain cannot alter the model, source batch, dirty state, or clock.
input('mass',7);const modelRef=read('model'),sourceRef=read('model.sources');
for(const [id,value] of [['background','#eeeeee'],['text-color','#222222'],['negative-color','#0000ff'],['positive-color','#ff0000']]){elements[id].value=value;elements[id].oninput();}
assert.equal(read('display.palette'),'custom');assert.equal(elements.palette.value,'custom');
assert.equal(styles['--background'],'#eeeeee');assert.equal(styles['--text'],'#222222');
assert.equal(read('model'),modelRef);assert.equal(read('model.sources'),sourceRef);assert.equal(read('running'),true);assert.equal(read('dirty'),true);assert.equal(read('model.time'),time);
assert.match(elements['color-bar'].style.background,/#0000ff,#eeeeee,#ff0000/);
assert.deepEqual(gradients.at(-1).map(s=>s[1]),['#ff0000','#ff0000','#0000ff','#0000ff']);
read('model.u[200*1250+650]=.5;model.u[200*1250+651]=-.5;draw()');
const pixel=(x,y)=>Array.from(read('pixels.data.slice('+(((y-100)*541+x-400)*4)+','+((((y-100)*541+x-400)*4)+3)+')'));
assert.deepEqual(pixel(650,200),[255,0,0]);assert.deepEqual(pixel(651,200),[0,0,255]);assert.deepEqual(pixel(400,100),[238,238,238]);
elements.gain.value=2;elements.gain.oninput();assert.equal(elements['positive-label'].textContent,'+0.250');
assert.equal(read('model.time'),time);assert.equal(read('model'),modelRef);
elements.palette.value='cyan-magenta';elements.palette.onchange();assert.equal(read('display.negative'),'#35d3d3');
elements.palette.value='bogus';elements.palette.onchange();assert.equal(read('display.palette'),'cyan-magenta');
elements.background.value='invalid';elements.background.oninput();assert.equal(read('display.background'),'#eeeeee');
elements['display-defaults'].onclick();assert.equal(read('display.background'),'#0c1726');assert.equal(read('model'),modelRef);assert.equal(read('running'),true);assert.equal(read('dirty'),true);
// Invalid input must not replace or pause the live simulation, even when validation is bypassed.
input('mass','');submit();assert.equal(read('model'),modelRef);assert.equal(read('running'),true);
input('mass',11);submit();assert.equal(read('model'),modelRef);assert.match(elements.status.textContent,/範囲外/);
elements.parameters.reportValidity=()=>false;input('mass',5);submit();assert.equal(read('model'),modelRef);
elements.parameters.reportValidity=()=>true;
// Chrome rounds range serialization to 15 significant digits. Irrational max
// 106.6291905158008 became 106.629190515801 and failed native form validation.
const sliderHTML=html.match(/<input id="wavelength"[^>]+>/)[0];
const sliderMin=Number(sliderHTML.match(/min="([^"]+)"/)[1]);
const sliderMax=Number(sliderHTML.match(/max="([^"]+)"/)[1]);
const serializeRange=value=>Number(Number(value).toPrecision(15));
assert.ok(serializeRange(106.6291905158008)>106.6291905158008,'regression reproduces the previous endpoint failure');
assert.equal(sliderMin,8);assert.equal(sliderMax,24);assert.match(sliderHTML,/step="any"/);
elements.parameters.reportValidity=()=>{const v=serializeRange(elements.wavelength.value);return v>=sliderMin&&v<=sliderMax;};
// Home/End, arbitrary interior value, sigma linkage, and displayed lambda.
for(const sigma of [sliderMin,sliderMax,60/(Math.SQRT2*Math.PI)]){
  input('wavelength',serializeRange(sigma));assert.equal(elements.parameters.reportValidity(),true);submit();
  assert.ok(Math.abs(read('model.options.sigma')-sigma)<1e-12);assert.equal(read('dirty'),false);assert.equal(read('running'),false);
  assert.equal(elements['wavelength-label'].textContent,(Math.SQRT2*Math.PI*sigma).toFixed(1));
  assert.match(elements.wavelength['aria-valuetext'],/波長の目安/);
}
input('sigma',.2);assert.equal(Number(elements.wavelength.value),16);
elements.reset.onclick();assert.equal(read('dirty'),true);assert.notEqual(read('model.options.sigma'),16);
submit();assert.equal(read('model.options.sigma'),16);
elements.defaults.onclick();assert.equal(read('model.options.sigma'),18);assert.equal(elements.sigma.value,.225);assert.equal(read('model.options.sourceMode'),'auto');
assert.equal(read('display.background'),'#0c1726');
// Horizon handling is defensive in both the buttons and the model.
read('model.stopExcitation();model.steps=15999');elements.step.onclick();
assert.equal(read('model.steps'),16000);assert.equal(elements.play.disabled,true);assert.equal(elements.step.disabled,true);assert.equal(elements.emit.disabled,true);
elements.play.onclick();elements.step.onclick();elements.emit.onclick();nextFrame();assert.equal(read('model.steps'),16000);assert.equal(read('running'),false);assert.match(elements.status.textContent,/60 T₀/);
elements.reset.onclick();assert.equal(read('model.steps'),0);assert.equal(elements.play.disabled,false);assert.equal(read('model.hasExcitation'),true);
elements.gain.value=NaN;elements.gain.oninput();assert.equal(Number(elements.gain.value),1);
elements.speed.value=Infinity;elements.speed.oninput();assert.equal(Number(elements.speed.value),8);
(async()=>{
  elements.export.onclick();const saved=JSON.parse(await download.text());
  assert.equal(saved.formatVersion,2);assert.equal(saved.options.sigma,18);assert.equal(saved.options.sourceMode,'auto');
  assert.equal(saved.display.background,'#0c1726');assert.equal(saved.sources.length,12);assert.equal('weights' in saved.sources[0],false);
  assert.equal(clicked,1);assert.equal(released,1);
  console.log('PASS: run/pause, reset/dirty/apply/defaults, manual emit/stop/repeats, wavelength endpoints, invalid inputs, live colors/legend/centerline, horizon, JSON (DOM stub).');
})().catch(error=>{console.error(error);process.exitCode=1});
