// Node-only numerical checks; no dependencies. Optional C++ fixture path as argv[2].
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {CavityModel,SOURCES,WAVE_FACTOR,MAX_TIME}=require('../web/model.js');
let m=new CavityModel();
assert.equal(m.u.every(v=>v===0),true);
m.step(100);assert.equal(m.u.every(v=>v===0),true,'exact rest before pulse cutoff');
assert.equal(m.kx[439],4/3,'harmonic interface bond');
assert.equal(m.mass[440],4);assert.equal(m.km[440],2);
assert.throws(()=>new CavityModel({stiffness:3}),RangeError);
assert.throws(()=>new CavityModel({sigma:NaN}),RangeError);
assert.throws(()=>new CavityModel({sourceMode:'loop'}),RangeError);
assert.throws(()=>new CavityModel({mirrors:'false'}),TypeError);
assert.throws(()=>m.step(Infinity),RangeError);assert.throws(()=>m.step(-1),RangeError);
assert.throws(()=>m.step(1.5),RangeError);
// Ricker spectral peak: Fourier magnitude is proportional to omega^2 exp(-sigma^2 omega^2/2).
assert.equal(WAVE_FACTOR,Math.SQRT2*Math.PI);
for(const sigma of [8,18,24]){
  const peak=1/(WAVE_FACTOR*sigma),omega=2*Math.PI*peak;
  assert.ok(Math.abs(omega-Math.SQRT2/sigma)<1e-16);
  const spectrum=w=>w*w*Math.exp(-sigma*sigma*w*w/2);
  assert.ok(spectrum(omega)>spectrum(.99*omega)&&spectrum(omega)>spectrum(1.01*omega));
  const manual=new CavityModel({sourceMode:'manual',sigma});
  assert.equal(manual.sources.length,0);assert.equal(manual.hasExcitation,false);
  assert.equal(manual.emit(),true);assert.equal(manual.sources.length,12);
  assert.ok(Math.abs(Math.min(...manual.sources.map(s=>s.center-4*s.sigma)))<1e-12);
  for(let i=0;i<12;i++){
    assert.equal(manual.sources[i].x,SOURCES[i].x);assert.equal(manual.sources[i].y,SOURCES[i].y);
    assert.equal(manual.sources[i].amplitude,SOURCES[i].amplitude);
    assert.equal(manual.sources[i].sigma,sigma);
    assert.ok(Math.abs((manual.sources[i].center-manual.sources[0].center)-(SOURCES[i].center-SOURCES[0].center))<1e-12);
  }
}
// Independent scalar stencil at deterministic non-zero sites, including interface and damping.
m=new CavityModel();for(let i=0;i<m.u.length;i++){m.u[i]=Math.sin(i*.03)*.01;m.prev[i]=Math.cos(i*.07)*.01;}
const sites=[[439,200],[440,200],[453,200],[454,200],[200,45],[1020,350],[600,200]];
const expected=sites.map(([x,y])=>{const i=y*1250+x,u=m.u,p=m.prev;const k=v=>m.km[v];const h=(a,b)=>2*a*b/(a+b);const f=h(k(x),k(x+1))*(u[i+1]-u[i])+h(k(x),k(x-1))*(u[i-1]-u[i])+k(x)*(u[i+1250]+u[i-1250]-2*u[i]);const g=m.gx[x]+m.gy[y];return (2*u[i]-(1-g*.15)*p[i]+.09*f/m.mass[x])/(1+g*.15);});
m.step();sites.forEach(([x,y],i)=>assert.ok(Math.abs(m.u[y*1250+x]-expected[i])<1e-16));
// Unforced zero remains zero; layer-free control is uniform.
const control=new CavityModel({mirrors:false});assert.equal(control.mass.every(v=>v===1),true);assert.equal(control.kx.every(v=>v===1),true);
// Match source-overlap accumulation and pulse timing through a real simulation.
m=new CavityModel();m.step(500);assert.equal(m.time,150);assert.ok(m.u.some(v=>Math.abs(v)>1e-6));assert.equal(m.u.every(Number.isFinite),true);
for(let x=0;x<1250;x++){assert.equal(m.u[x],0);assert.equal(m.u[400*1250+x],0);}
if(process.argv[2]){
 const b=fs.readFileSync(process.argv[2]);const frame=Number(process.argv[3] || 225); if(frame===450)m.step(500); assert.ok(frame===225 || frame===450);const start=frame*101*271*4;assert.ok(b.length>=start+101*271*4);
 let max=0,j=0;
 for(let y=100;y<=300;y+=2)for(let x=400;x<=940;x+=2,j++)max=Math.max(max,Math.abs(Math.fround(m.u[y*1250+x])-b.readFloatLE(start+j*4)));
 assert.ok(max<1e-7,'C++ reference difference '+max);console.log('C++ frame '+frame+' comparison: max absolute Float32 difference',max);
}
// Manual source lifecycle, including nonzero forcing at stop and repeated clicks.
m=new CavityModel({sourceMode:'manual'});m.step(2);assert.equal(m.u.every(v=>v===0),true);
assert.equal(m.emit(),true);for(let i=0;i<50;i++)assert.equal(m.emit(),false);
assert.equal(m.emissionCount,1);assert.equal(m.sources.length,12);
m.step(240);assert.ok(m.force.some(v=>Math.abs(v)>1e-6));assert.ok(m.u.some(v=>Math.abs(v)>1e-6));
const stoppedU=m.u.slice(),stoppedPrev=m.prev.slice(),stoppedTime=m.time;
assert.equal(m.stopExcitation(),true);assert.equal(m.stopExcitation(),false);
assert.deepEqual(m.u,stoppedU);assert.deepEqual(m.prev,stoppedPrev);assert.equal(m.time,stoppedTime);
assert.equal(m.force.every(v=>v===0),true);m.step();assert.equal(m.force.every(v=>v===0),true);
assert.ok(m.u.some((v,i)=>v!==stoppedU[i]),'unforced waves continue to propagate');
const propagated=m.u.slice();assert.equal(m.emit(),true);assert.deepEqual(m.u,propagated);
for(let i=0;i<50;i++){m.stopExcitation();assert.equal(m.emit(),true);assert.equal(m.sources.length,12);}
// A completed batch can be replaced, not accumulated. Synthetic time jumps avoid expensive full runs.
m.steps=Math.ceil((m.sourceEnd+m.dt)/m.dt);m.step();assert.equal(m.force.every(v=>v===0),true);
assert.equal(m.hasExcitation,false);assert.equal(m.emit(),true);assert.equal(m.sources.length,12);
m.stopExcitation();m.steps=Math.floor((MAX_TIME-m.emissionDuration)/m.dt);
assert.equal(m.canEmit,true);m.steps++;assert.equal(m.canEmit,false);assert.equal(m.emit(),false);
m.steps=15999;m.step(3);assert.equal(m.steps,16000);assert.equal(m.time,MAX_TIME);assert.equal(m.emit(),false);
console.log('PASS: rest, harmonic bonds, inputs, independent stencil, propagation, fixed boundaries, Ricker wavelength, manual batch lifecycle, source stop, bounded repeats, 60 T0 limit.');
