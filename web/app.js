'use strict';
const $=id=>document.getElementById(id);
const DISPLAY_DEFAULTS=Object.freeze({background:'#0c1726',text:'#dce6f4',palette:'blue-orange',negative:'#338bd4',positive:'#eea560'});
const PALETTES={
  'blue-orange':['#338bd4','#eea560'],
  'cyan-magenta':['#35d3d3','#ee75d1'],
  'blue-red':['#5da9ff','#ff6c70'],
  'gray':['#717171','#ffffff']
};
let model=new CavityModel(),running=false,dirty=false,notice='',display={...DISPLAY_DEFAULTS};
const field=$('field'),ctx=field.getContext('2d'),line=$('section'),lc=line.getContext('2d');
const raster=document.createElement('canvas');raster.width=541;raster.height=201;
const rc=raster.getContext('2d'),pixels=rc.createImageData(541,201);
let peak=0;
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const mix=(a,b,q)=>'rgb('+a.map((v,i)=>Math.round(v+(b[i]-v)*q)).join(',')+')';
function applyDisplay(){
  const root=document.documentElement.style,bg=rgb(display.background),fg=rgb(display.text);
  for(const [name,value] of Object.entries({background:display.background,text:display.text,surface:mix(bg,fg,.035),border:mix(bg,fg,.22),muted:mix(bg,fg,.75),negative:display.negative,positive:display.positive}))root.setProperty('--'+name,value);
  $('background').value=display.background;$('text-color').value=display.text;
  $('negative-color').value=display.negative;$('positive-color').value=display.positive;$('palette').value=display.palette;
  // Canvas and the numeric legend always use exactly the same mapping.
  $('color-bar').style.background='linear-gradient(to right,'+display.negative+','+display.background+','+display.positive+')';
  draw();status();
}
function draw(){
  const scale=.5/Number($('gain').value),data=pixels.data,u=model.u;
  const bg=rgb(display.background),negative=rgb(display.negative),positive=rgb(display.positive),fg=rgb(display.text);
  peak=0;
  for(let y=100;y<=300;y++)for(let x=400;x<=940;x++){
    const value=u[y*1250+x];peak=Math.max(peak,Math.abs(value));
    const q=Math.min(1,Math.abs(value)/scale),i=((y-100)*541+x-400)*4,c=value>=0?positive:negative;
    data[i]=bg[0]+q*(c[0]-bg[0]);data[i+1]=bg[1]+q*(c[1]-bg[1]);data[i+2]=bg[2]+q*(c[2]-bg[2]);data[i+3]=255;
  }
  rc.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(raster,0,0,field.width,field.height);
  if(model.options.mirrors){ctx.fillStyle=mix(bg,fg,.10);ctx.strokeStyle=mix(bg,fg,.35);ctx.globalAlpha=.45;for(const x of [440,474,508,762,796]){const a=(x-400)/540*field.width,w=14/540*field.width;ctx.fillRect(a,0,w,field.height);ctx.strokeRect(a+.5,.5,w,field.height-1);}ctx.globalAlpha=1;}
  ctx.setLineDash([4,6]);ctx.strokeStyle=mix(bg,fg,.3);ctx.beginPath();ctx.moveTo(0,200);ctx.lineTo(1080,200);ctx.stroke();ctx.setLineDash([]);
  lc.clearRect(0,0,1080,170);lc.strokeStyle=mix(bg,fg,.25);lc.beginPath();lc.moveTo(0,85);lc.lineTo(1080,85);lc.stroke();
  const gradient=lc.createLinearGradient(0,0,0,170);
  gradient.addColorStop(0,display.positive);gradient.addColorStop(.49999,display.positive);gradient.addColorStop(.5,display.negative);gradient.addColorStop(1,display.negative);
  lc.strokeStyle=gradient;lc.lineWidth=1.7;lc.beginPath();for(let x=400;x<=940;x++){const xx=(x-400)*2,yy=85-Math.max(-1,Math.min(1,u[200*1250+x]/scale))*70;if(x===400)lc.moveTo(xx,yy);else lc.lineTo(xx,yy);}lc.stroke();
  lc.fillStyle=display.text;lc.font='12px system-ui';lc.fillText('+'+scale.toFixed(3),8,16);lc.fillText('−'+scale.toFixed(3),8,162);
  $('negative-label').textContent='−'+scale.toFixed(3);$('positive-label').textContent='+'+scale.toFixed(3);
  $('time').textContent='t / T₀ = '+(model.time/80).toFixed(2)+'  ·  max |u| = '+peak.toFixed(4);
  $('state').textContent=model.time>=4800?'終了 · 60 T₀':running?'計算中 · Running':model.steps?'停止 · Paused':'静止 · Ready';
  $('play').textContent=running?'Ⅱ 一時停止 / Pause':'▶ 開始 / Run';
  $('play').disabled=model.time>=4800;$('step').disabled=model.time>=4800;
  $('emit').disabled=!model.canEmit;$('stop-source').disabled=!model.hasExcitation;
  $('emit').textContent=model.hasExcitation?'1組予約済み / Scheduled':'波を1回発生 / Emit';
  $('source-state').textContent=model.hasExcitation?(model.lastEmission.kind==='auto'?'自動デモ · ':'手動発生 · ')+'励振終了予定: '+(model.sourceEnd/80).toFixed(2)+' T₀'+(!running?'（一時停止中）':''):'励振なし · '+(model.options.sourceMode==='auto'?'自動デモ':'手動')+' / '+model.emissionCount+' 組';
}
function status(){
  let message;
  if(model.time>=4800)message='60 T₀ に到達しました。リセットして再実行できます。';
  else if(dirty)message='物理設定の変更は未適用です。「適用してリセット」で反映します。発生ボタンは適用済みの設定を使います。';
  else if(notice)message=notice;
  else if(model.hasExcitation)message=model.lastEmission.kind==='auto'?'自動デモの1組が予約済みです。ボタンだけで発生させるには「発生モード → 手動」を選び「適用してリセット」。':'有限の12波源を1組だけ励振します。時間を進めるには「開始」。励振停止は既存の波を消しません。';
  else if(!model.canEmit)message='新しい1組を60 T₀ までに完了できないため発生できません。既存の波は計算を続けられます。';
  else message='「波を1回発生」で1組を予約できます。開始・一時停止とは独立です。既存の波は自由に伝播・減衰します。';
  $('status').textContent=message;
}
function refresh(){draw();status();}
function reset(options=model.options){running=false;model=new CavityModel(options);dirty=false;notice='';refresh();}
function sourcePreview(fromSlider=false){
  // Store sigma in the range, whose integer endpoints survive browser serialization.
  // Irrational wavelength endpoints can round above max and invalidate the form.
  if(fromSlider)$('sigma').value=String(Math.max(8,Math.min(24,Number($('wavelength').value)))/80);
  const sigma=80*Number($('sigma').value);
  if(!Number.isFinite(sigma)||sigma<8||sigma>24){$('wave-info').textContent='パルス幅は 0.1–0.3 T₀ の範囲で入力してください。';return;}
  const wavelength=CAVITY_WAVE_FACTOR*sigma;
  $('wavelength').value=String(sigma);$('wavelength-label').textContent=wavelength.toFixed(1);
  $('wavelength').setAttribute('aria-valuetext','波長の目安 約'+wavelength.toFixed(1)+'格子');
  $('wave-info').textContent='入力値: σ = '+(sigma/80).toFixed(3)+' T₀、f_peak × T₀ ≈ '+(80/wavelength).toFixed(3)+'。適用済み λ ≈ '+(CAVITY_WAVE_FACTOR*model.options.sigma).toFixed(1)+' 格子。';
}
$('play').onclick=()=>{if(model.time>=4800)return;running=!running;notice='';refresh();};
$('step').onclick=()=>{running=false;notice='';if(model.time<4800)model.step();refresh();};
$('emit').onclick=()=>{if(model.emit())notice=running?'新しい12波源を1組発生させました。':'12波源を1組予約しました。「開始」または「1 ステップ」で時間を進めてください。';else notice=model.hasExcitation?'すでに1組が発生中です。追加の予約はしません。':'残り時間が足りません。リセットして再実行してください。';refresh();};
$('stop-source').onclick=()=>{if(model.stopExcitation())notice='励振を停止しました。既存の波と時刻は保持され、計算を続けられます。';refresh();};
$('reset').onclick=()=>{const wasDirty=dirty;reset();dirty=wasDirty;sourcePreview();status();};
$('parameters').addEventListener('input',()=>{dirty=true;notice='';sourcePreview();status();});
$('sigma').oninput=()=>sourcePreview();
$('wavelength').oninput=()=>{sourcePreview(true);dirty=true;notice='';status();};
$('parameters').onsubmit=e=>{
  e.preventDefault();if(!$('parameters').reportValidity())return;
  try{
    const options={mass:Number($('mass').value),stiffness:Number($('stiffness').value),amplitude:Number($('amplitude').value),sigma:80*Number($('sigma').value),mirrors:$('mirrors').checked,sourceMode:$('source-mode').value};
    // Validate construction before replacing the running model or its wave field.
    const replacement=new CavityModel(options);running=false;model=replacement;dirty=false;notice='';sourcePreview();refresh();
  }catch(error){if(!(error instanceof RangeError||error instanceof TypeError))throw error;notice='入力値が範囲外です。物理設定と波の状態は変更していません。';$('status').textContent=notice;}
};
$('defaults').onclick=()=>{$('mass').value=4;$('stiffness').value=2;$('amplitude').value=1;$('sigma').value=.225;$('mirrors').checked=true;$('source-mode').value='auto';reset(CAVITY_DEFAULTS);sourcePreview();};
for(const id of ['speed','gain'])$(id).oninput=()=>{
  const value=Number($(id).value),lo=id==='gain'?.25:1,hi=id==='gain'?8:32;
  if(!Number.isFinite(value)||value<lo||value>hi){$(id).value=id==='gain'?1:8;}
  $(id+'-label').textContent=id==='gain'?Number($(id).value).toFixed(2):$(id).value;refresh();
};
$('palette').onchange=()=>{const preset=PALETTES[$('palette').value];if(!preset){$('palette').value=display.palette;return;}display.palette=$('palette').value;[display.negative,display.positive]=preset;applyDisplay();};
for(const [id,key] of [['background','background'],['text-color','text'],['negative-color','negative'],['positive-color','positive']])$(id).oninput=()=>{
  const value=$(id).value;if(!/^#[0-9a-f]{6}$/i.test(value)){$(id).value=display[key];return;}
  display[key]=value.toLowerCase();if(key==='negative'||key==='positive')display.palette='custom';applyDisplay();
};
$('display-defaults').onclick=()=>{display={...DISPLAY_DEFAULTS};applyDisplay();};
$('export').onclick=()=>{
  const payload={formatVersion:2,model:'scalar-mass-spring-2d',nx:1250,ny:401,dt:.3,T0:80,time:model.time,options:model.options,display:{...display,gain:Number($('gain').value)},excitation:{enabled:model.excitationEnabled,hasPending:model.hasExcitation,emissionCount:model.emissionCount,lastEmission:model.lastEmission},sources:model.sources.map(({weights,...s})=>s)};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='wave-cavity-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
function frame(){
  if(running){const start=performance.now(),count=Number($('speed').value);for(let i=0;i<count&&model.time<4800;i++){model.step();if(performance.now()-start>20)break;}if(model.time>=4800)running=false;notice='';refresh();}
  requestAnimationFrame(frame);
}
applyDisplay();sourcePreview();requestAnimationFrame(frame);
