// Node-only numerical checks; no dependencies. Optional C++ fixture path as argv[2].
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {CavityModel}=require('../web/model.js');
let m=new CavityModel();
assert.equal(m.u.every(v=>v===0),true);
m.step(100);assert.equal(m.u.every(v=>v===0),true,'exact rest before pulse cutoff');
assert.equal(m.kx[439],4/3,'harmonic interface bond');
assert.equal(m.mass[440],4);assert.equal(m.km[440],2);
assert.throws(()=>new CavityModel({stiffness:3}),RangeError);
assert.throws(()=>new CavityModel({sigma:NaN}),RangeError);
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
console.log('PASS: rest, harmonic bonds, parameter validation, independent stencil, uniform control, finite propagation, fixed boundaries.');
