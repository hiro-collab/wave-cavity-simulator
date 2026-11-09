/* Scalar 2-D mass-spring lattice. No dependencies; also usable from Node. */
(function (root) {
'use strict';
const SOURCES = [
  {
    "x": 572,
    "y": 219,
    "center": 221.74320537239106,
    "sigma": 18.0,
    "amplitude": -0.8907693144961584
  },
  {
    "x": 709,
    "y": 174,
    "center": 176.1447124449326,
    "sigma": 18.0,
    "amplitude": -1.1912047747872272
  },
  {
    "x": 607,
    "y": 168,
    "center": 203.4167869042367,
    "sigma": 18.0,
    "amplitude": 1.1891245311623693
  },
  {
    "x": 684,
    "y": 177,
    "center": 223.35728730138842,
    "sigma": 18.0,
    "amplitude": 1.074432746449167
  },
  {
    "x": 730,
    "y": 216,
    "center": 225.60342281595973,
    "sigma": 18.0,
    "amplitude": 0.8710021963412196
  },
  {
    "x": 678,
    "y": 164,
    "center": 158.00065927116694,
    "sigma": 18.0,
    "amplitude": -1.192749651917408
  },
  {
    "x": 714,
    "y": 193,
    "center": 187.33674231871805,
    "sigma": 18.0,
    "amplitude": -1.003744159007014
  },
  {
    "x": 558,
    "y": 182,
    "center": 259.08602843845705,
    "sigma": 18.0,
    "amplitude": -1.123944837200846
  },
  {
    "x": 675,
    "y": 231,
    "center": 292.027512262548,
    "sigma": 18.0,
    "amplitude": 0.9613542224514685
  },
  {
    "x": 630,
    "y": 179,
    "center": 125.40056271090855,
    "sigma": 18.0,
    "amplitude": -1.0155203407163842
  },
  {
    "x": 593,
    "y": 196,
    "center": 274.8355209749367,
    "sigma": 18.0,
    "amplitude": -0.9007392325745626
  },
  {
    "x": 632,
    "y": 213,
    "center": 225.44075455343943,
    "sigma": 18.0,
    "amplitude": -0.8304074063366157
  }
];
const DEFAULTS = Object.freeze({mass:4, stiffness:2, amplitude:1, sigma:18, mirrors:true});
class CavityModel {
  constructor(options={}) {
    this.options={...DEFAULTS,...options};
    const o=this.options;
    for(const [key,lo,hi] of [['mass',1,10],['stiffness',0.1,2],['amplitude',0.01,10],['sigma',8,24]])
      if(!Number.isFinite(o[key]) || o[key]<lo || o[key]>hi) throw new RangeError(key+' out of range');
    this.nx=1250; this.ny=401; this.dt=.3; this.steps=0;
    const nx=this.nx, ny=this.ny, n=nx*ny;
    this.u=new Float64Array(n); this.prev=new Float64Array(n); this.next=new Float64Array(n);
    this.force=new Float64Array(n); this.mass=new Float64Array(nx).fill(1);
    this.km=new Float64Array(nx).fill(1); this.kx=new Float64Array(nx-1);
    this.gx=new Float64Array(nx); this.gy=new Float64Array(ny); this.den=new Float64Array(n);
    if(o.mirrors) for(const a of [440,474,508,762,796]) for(let x=a;x<a+14;x++){this.mass[x]=o.mass;this.km[x]=o.stiffness;}
    for(let x=0;x<nx-1;x++) this.kx[x]=2*this.km[x]*this.km[x+1]/(this.km[x]+this.km[x+1]);
    for(let x=0;x<nx;x++) {
      if(x<300)this.gx[x]=.18*((300-x)/300)**3;
      if(x>=950)this.gx[x]=.18*((x-949)/300)**3;
    }
    for(let y=0;y<ny;y++) {
      if(y<100)this.gy[y]=.12*((100-y)/100)**3;
      if(y>300)this.gy[y]=.12*((y-300)/100)**3;
      for(let x=0;x<nx;x++)this.den[y*nx+x]=1/(1+(this.gx[x]+this.gy[y])*this.dt/2);
    }
    this.sources=SOURCES.map(s=>{
      const weights=[];let sum=0;
      for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
        const weight=Math.exp(-(dx*dx+dy*dy)/4.5);sum+=weight;
        weights.push([(s.y+dy)*nx+s.x+dx,weight]);
      }
      return {...s,sigma:o.sigma,amplitude:s.amplitude*o.amplitude,weights:weights.map(([i,w])=>[i,w/sum])};
    });
  }
  get time(){return this.steps*this.dt;}
  step(count=1){
    const {nx,ny,dt,mass,km,kx,gx,gy,den,force,sources}=this;
    for(let k=0;k<count;k++){
      const {u,prev,next}=this, now=this.time;
      for(const s of sources)for(const [i] of s.weights)force[i]=0;
      for(const s of sources){
        const z=(now-s.center)/s.sigma;
        const pulse=Math.abs(z)>4?0:s.amplitude*(1-z*z)*Math.exp(-z*z/2);
        for(const [i,w] of s.weights)force[i]+=pulse*w;
      }
      for(let y=1;y<ny-1;y++)for(let x=1,i=y*nx+1;x<nx-1;x++,i++){
        const g=gx[x]+gy[y];
        const elastic=kx[x]*(u[i+1]-u[i])-kx[x-1]*(u[i]-u[i-1])+km[x]*(u[i+nx]+u[i-nx]-2*u[i]);
        next[i]=(2*u[i]-(1-g*dt/2)*prev[i]+dt*dt*(elastic+force[i])/mass[x])*den[i];
      }
      this.prev=u;this.u=next;this.next=prev;this.steps++;
    }
  }
}
root.CavityModel=CavityModel;root.CAVITY_DEFAULTS=DEFAULTS;
if(typeof module!=='undefined')module.exports={CavityModel,SOURCES,DEFAULTS};
})(typeof window==='undefined'?globalThis:window);
