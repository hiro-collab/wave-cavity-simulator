'use strict';
const $=id=>document.getElementById(id);
let model=new CavityModel(), running=false, dirty=false;
const field=$('field'), ctx=field.getContext('2d'), line=$('section'), lc=line.getContext('2d');
const raster=document.createElement('canvas');raster.width=541;raster.height=201;
const rc=raster.getContext('2d'), pixels=rc.createImageData(541,201);
let peak=0;
function draw(){
  const scale=.5/Number($('gain').value), data=pixels.data, u=model.u;
  peak=0;
  for(let y=100;y<=300;y++)for(let x=400;x<=940;x++){
    const value=u[y*1250+x];peak=Math.max(peak,Math.abs(value));
    const q=Math.min(1,Math.abs(value)/scale), i=((y-100)*541+x-400)*4;
    const c=value>=0?[238,165,96]:[51,139,212];
    data[i]=12+q*(c[0]-12);data[i+1]=23+q*(c[1]-23);data[i+2]=38+q*(c[2]-38);data[i+3]=255;
  }
  rc.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(raster,0,0,field.width,field.height);
  if(model.options.mirrors){ctx.fillStyle='rgba(191,216,232,.10)';ctx.strokeStyle='rgba(191,216,232,.35)';for(const x of [440,474,508,762,796]){const a=(x-400)/540*field.width,w=14/540*field.width;ctx.fillRect(a,0,w,field.height);ctx.strokeRect(a+.5,.5,w,field.height-1);}}
  ctx.setLineDash([4,6]);ctx.strokeStyle='#cbd7e34d';ctx.beginPath();ctx.moveTo(0,200);ctx.lineTo(1080,200);ctx.stroke();ctx.setLineDash([]);
  lc.clearRect(0,0,1080,170);lc.strokeStyle='#304156';lc.beginPath();lc.moveTo(0,85);lc.lineTo(1080,85);lc.stroke();
  lc.strokeStyle='#73ced2';lc.lineWidth=1.7;lc.beginPath();for(let x=400;x<=940;x++){const xx=(x-400)*2, yy=85-Math.max(-1,Math.min(1,u[200*1250+x]/scale))*70;if(x===400)lc.moveTo(xx,yy);else lc.lineTo(xx,yy);}lc.stroke();
  lc.fillStyle='#8ca3bc';lc.font='12px system-ui';lc.fillText('+'+scale.toFixed(3),8,16);lc.fillText('−'+scale.toFixed(3),8,162);
  $('time').textContent='t / T₀ = '+(model.time/80).toFixed(2)+'  ·  max |u| = '+peak.toFixed(4);
  $('state').textContent=running?'計算中 · Running':model.steps?'停止 · Paused':'静止 · Ready';
  $('play').textContent=running?'Ⅱ 一時停止 / Pause':'▶ 開始 / Run';
}
function status(){
  if(dirty){$('status').textContent='変更は未適用です。「適用してリセット」で反映します。';return;}
  const end=Math.max(...model.sources.map(s=>s.center+4*s.sigma))/80;
  $('status').textContent=model.time>=4800?'60 T₀ に到達しました。リセットして再実行できます。':model.time/80>end?'励振は終了。反射・透過・減衰による自由な時間発展です。':'静止から計算中。全励振終了: '+end.toFixed(2)+' T₀。色・断面の表示範囲 ±'+(.5/Number($('gain').value)).toFixed(3)+'（範囲外は飽和表示）。';
}
function reset(options=model.options){running=false;model=new CavityModel(options);dirty=false;draw();status();}
$('play').onclick=()=>{if(model.time>=4800)return;running=!running;draw();status();};
$('step').onclick=()=>{running=false;if(model.time<4800)model.step();draw();status();};
$('reset').onclick=()=>{const wasDirty=dirty;reset();dirty=wasDirty;status();};
$('parameters').addEventListener('input',()=>{dirty=true;status();});
$('parameters').onsubmit=e=>{e.preventDefault();if(!$('parameters').reportValidity())return;reset({mass:Number($('mass').value),stiffness:Number($('stiffness').value),amplitude:Number($('amplitude').value),sigma:80*Number($('sigma').value),mirrors:$('mirrors').checked});};
$('defaults').onclick=()=>{$('mass').value=4;$('stiffness').value=2;$('amplitude').value=1;$('sigma').value=.225;$('mirrors').checked=true;reset(CAVITY_DEFAULTS);};
for(const id of ['speed','gain'])$(id).oninput=()=>{$(id+'-label').textContent=id==='gain'?Number($(id).value).toFixed(2):$(id).value;draw();status();};
$('export').onclick=()=>{const payload={model:'scalar-mass-spring-2d',nx:1250,ny:401,dt:.3,T0:80,options:model.options,sources:model.sources.map(({weights,...s})=>s)};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='wave-cavity-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function frame(){if(running){const start=performance.now(),count=Number($('speed').value);for(let i=0;i<count&&model.time<4800;i++){model.step();if(performance.now()-start>20)break;}if(model.time>=4800)running=false;draw();status();}requestAnimationFrame(frame);}
draw();requestAnimationFrame(frame);
