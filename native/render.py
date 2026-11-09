#!/usr/bin/env python3
"""Render the same simulated displacement as a 2D field and its central cut."""
from pathlib import Path
import os,json,tempfile,subprocess
os.environ.setdefault('MPLCONFIGDIR', str(Path(tempfile.gettempdir())/'cavity_buildup_matplotlib'))
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, AsinhNorm
from matplotlib.font_manager import FontProperties
from PIL import Image

P=Path(__file__).resolve().parent
cfg=json.loads((P/'config.json').read_text()); times=np.load(P/'frame_times.npy')/80
u=np.memmap(P/'field.bin',dtype='float32',mode='r',shape=(len(times),101,271))
section=np.memmap(P/'section.bin',dtype='float32',mode='r',shape=(len(times),541))
data=np.genfromtxt(P/'diagnostics.csv',delimiter=',',names=True)
ca=data[data['control']==0];co=data[data['control']==1]
off=max(s['center']+4*s['sigma'] for s in cfg['sources'])/80
e0=np.interp(off*80,ca['time'],ca['energy_cavity']);e1=np.interp(off*80,co['time'],co['energy_cavity'])
ec=ca['energy_cavity']/e0;eo=co['energy_cavity']/e1;et=ca['time']/80
FP='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
FP=os.environ.get('CAVITY_FONT',FP);FB=os.environ.get('CAVITY_FONT_BOLD',FB)
if not Path(FP).is_file():
    from matplotlib.font_manager import findfont
    FP=findfont('DejaVu Sans');print('Warning: Japanese font missing; set CAVITY_FONT to a CJK font file.')
if not Path(FB).is_file(): FB=FP
plt.rcParams.update({'font.family':FontProperties(fname=FP).get_name(),'axes.unicode_minus':False})
BG='#09111e';PANEL='#101a2b';INK='#e9f1fb';MUTED='#94a9c3';CYAN='#72e0f2';GOLD='#ffd092';GRAY='#9da5b0'
cm=LinearSegmentedColormap.from_list('signed_wave',['#78dbff','#195178',PANEL,'#875233','#ffcf91'])
norm=AsinhNorm(linear_width=.005,vmin=-.7,vmax=.7)
fig=plt.figure(figsize=(16,9),dpi=120,facecolor=BG)
def text(x,y,s,size=12,col=INK,bold=False,**kwargs):
    return fig.text(x,y,s,color=col,fontsize=size,fontproperties=FontProperties(fname=FB if bold else FP),**kwargs)
text(.045,.952,'無波から、共振が生まれるまで',25,bold=True)
clock=text(.95,.954,'',13,MUTED,ha='right')
stage=text(.046,.909,'',14,CYAN,bold=True)
ax=fig.add_axes([.056,.304,.87,.573],facecolor=PANEL)
im=ax.imshow(cm(norm(u[0]),bytes=True),origin='lower',extent=[399,941,99,301],
             interpolation='bilinear',aspect='equal',animated=True)
ax.set_xlim(400,940);ax.set_ylim(100,300)
ax.set_xticks([420,522,762,830,940]);ax.set_yticks([100,200,300])
ax.tick_params(colors=MUTED,labelsize=9)
for sp in ax.spines.values():sp.set_color('#2b3c52')
ax.set_ylabel('格子位置 y',color=MUTED,labelpad=7,fontsize=10)
overlays=[]
for a in [440,474,508,762,796]:
    overlays.append(ax.axvspan(a,a+14,fc='none',ec='#bcae88',lw=.8,alpha=.55,zorder=3,animated=True))
for a in [522,762]:overlays.append(ax.axvline(a,color='#88c0cc',lw=1,alpha=.7,zorder=3,animated=True))
cut=ax.axhline(200,color='white',lw=1,ls=(0,(5,5)),alpha=.65,zorder=4,animated=True)
overlays.append(cut)
for a,b,label,col in [(420,522,'多層：3組',GOLD),(522,762,'内部の12点から短い波を出す',INK),(762,830,'多層：2組',GOLD),(830,940,'漏れ出す波 →',GOLD)]:
    ax.text((a+b)/2,304,label,ha='center',va='bottom',fontsize=10.5,color=col,clip_on=False)
sx=[s['x'] for s in cfg['sources']];sy=[s['y'] for s in cfg['sources']]
sources=ax.scatter(sx,sy,s=24,facecolors='none',edgecolors='#e0e6ed',lw=.7,alpha=.22,zorder=5,animated=True)
cbax=fig.add_axes([.943,.345,.010,.49])
cb=fig.colorbar(matplotlib.cm.ScalarMappable(norm=norm,cmap=cm),cax=cbax,ticks=[-.5,-.1,-.02,0,.02,.1,.5]);cb.ax.tick_params(colors=MUTED,labelsize=8)
cb.ax.set_yticklabels(['−0.5','−0.1','−0.02','0','0.02','0.1','0.5'])
cb.set_label('変位 u',color=MUTED,fontsize=10,labelpad=5);cb.outline.set_edgecolor('#2b3c52')
text(.056,.266,'白い破線の断面：2Dと同じ計算値',12,bold=True)
text(.662,.266,'多層あり／なしの比較',12,bold=True)
axs=fig.add_axes([.056,.092,.558,.143],facecolor=PANEL)
axs.set_xlim(400,940);axs.set_ylim(-.7,.7);axs.set_yscale('asinh',linear_width=.005)
axs.set_yticks([-.5,-.05,0,.05,.5]);axs.set_yticklabels(['−0.5','−0.05','0','0.05','0.5'])
axs.set_xticks([420,522,762,830,940]);axs.tick_params(colors=MUTED,labelsize=8)
axs.axhline(0,lw=.6,color='#324258')
for a in [440,474,508,762,796]:axs.axvspan(a,a+14,color=GOLD,alpha=.08,lw=0)
for a in [522,762]:axs.axvline(a,lw=.6,color='#354960')
trace,=axs.plot([],[],color=CYAN,lw=1.8,animated=True)
traceout,=axs.plot([],[],color=GOLD,lw=1.8,animated=True)
axs.set_ylabel('変位 u',fontsize=9,color=MUTED)
for sp in axs.spines.values():sp.set_color('#2b3c52')
axe=fig.add_axes([.677,.092,.249,.143],facecolor=PANEL)
axe.set_xlim(0,60);axe.set_yscale('log');axe.set_ylim(1e-8,4)
axe.set_xticks([0,20,40,60]);axe.set_yticks([1,1e-4,1e-8]);axe.tick_params(colors=MUTED,labelsize=8)
axe.axvspan(0,off,color=GOLD,alpha=.08,lw=0);axe.axvline(off,color=GOLD,alpha=.6,lw=.7)
axe.grid(axis='y',color='#30445e',alpha=.45,lw=.5)
le,=axe.plot([],[],color=CYAN,lw=1.7,label='多層あり',animated=True)
lo,=axe.plot([],[],color=GRAY,lw=1.5,label='多層なし',animated=True)
marker=axe.axvline(0,color='white',alpha=.4,lw=.8,animated=True)
axe.legend(loc='upper right',fontsize=7.5,frameon=False,labelcolor=INK,ncol=2)
axe.set_ylabel('内部エネルギー',color=MUTED,fontsize=9)
for sp in axe.spines.values():sp.set_color('#2b3c52')
text(.056,.052,'色・断面：弱い波も見える固定の非線形目盛',10,MUTED)
text(.677,.052,'各々、波源停止時を1とする   横軸：t / T0',9.5,MUTED)
footer=text(.056,.020,'',11,MUTED)
dynamic=[im,*overlays,sources,trace,traceout,le,lo,marker,clock,stage,footer]
for a in [clock,stage,footer]:a.set_animated(True)
fig.canvas.draw();bg=fig.canvas.copy_from_bbox(fig.bbox)
W,H=fig.canvas.get_width_height()
cmd=['ffmpeg','-y','-v','error','-f','rawvideo','-vcodec','rawvideo','-s',f'{W}x{H}',
     '-pix_fmt','rgba','-r','60','-i','-','-an','-c:v','libx264','-preset','fast','-crf','18',
     '-pix_fmt','yuv420p','-movflags','+faststart',str(P/'cavity_from_rest_2d.mp4')]
p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
snapshot_times=[0,1.5,3,5,8,15,30,60]
snapshot_ids={int(np.argmin(abs(times-t))):t for t in snapshot_times}
x=np.arange(400,941)
for i,t in enumerate(times):
    im.set_data(cm(norm(u[i]),bytes=True));trace.set_data(x,section[i]);traceout.set_data(x[x>=830],section[i][x>=830])
    colors=[];sizes=[]
    for s in cfg['sources']:
        z=(t*80-s['center'])/s['sigma'];a=abs(s['amplitude']*(1-z*z)*np.exp(-z*z/2)) if abs(z)<=4 else 0
        colors.append((1.,.91,.72,.2+.8*min(a,1)));sizes.append(17+50*min(a,1))
    sources.set_edgecolors(colors);sources.set_sizes(sizes)
    n=np.searchsorted(et,t,side='right');le.set_data(et[:n],ec[:n]);lo.set_data(et[:n],eo[:n]);marker.set_xdata([t,t])
    clock.set_text(f't / T0 = {t:5.2f}   |   '+('再生速度 ×1' if t<8 else '再生速度 ×4'))
    if t<min((s['center']-4*s['sigma'])/80 for s in cfg['sources']):
        stage.set_text('初期状態：変位も速度もゼロ。まだ波はありません。')
        footer.set_text('丸印の12点に、開始時刻・符号の異なる短い広帯域パルスを加えます。')
    elif t<off:
        stage.set_text('波源ON：点から広がる波が、質量とバネ定数の境界で反射・透過する。')
        footer.set_text(f"通常部 m=1, K=1 ／ 色枠の層 m={cfg['parameters']['layer_mass']:g}, K={cfg['parameters']['layer_stiffness']:g}。反射率は指定せず計算。")
    elif t<8:
        stage.set_text('波源OFF：これ以降のエネルギー補給はゼロ。戻った波どうしが重なる。')
        footer.set_text('同位相の単色波を与えた結果ではありません。広帯域の波が反射・干渉を繰り返します。')
    elif t<30:
        stage.set_text('残響：共振しやすい成分が長く残る。多層なしでは、波が速く外へ逃げる。')
        footer.set_text('残るのは複数の共振成分です。単一モードへの選択やレーザー発振を計算したものではありません。')
    else:
        stage.set_text('内部にはほぼ定在波状の成分が残り、外側には進行波が漏れ続ける。')
        footer.set_text('受動共振器なので、残った波も最後は減衰します。利得媒質・誘導放出は含みません。')
    fig.canvas.restore_region(bg)
    for a in dynamic:fig.draw_artist(a)
    p.stdin.write(fig.canvas.buffer_rgba())
    if i in snapshot_ids:Image.fromarray(np.asarray(fig.canvas.buffer_rgba())).save(P/f'frame_T{snapshot_ids[i]:04.1f}.png')
    if i%600==0:print(f'Render {i}/{len(times)}',flush=True)
p.stdin.close();assert p.wait()==0
print('Video complete',flush=True)
