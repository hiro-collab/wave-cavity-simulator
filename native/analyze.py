from pathlib import Path
import os,json,tempfile
os.environ.setdefault('MPLCONFIGDIR', str(Path(tempfile.gettempdir())/'cavity_buildup_matplotlib'))
import numpy as np
from scipy.signal import find_peaks
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
P=Path(__file__).resolve().parent
cfg=json.loads((P/'config.json').read_text());ts=np.load(P/'frame_times.npy')/80
u=np.memmap(P/'field.bin',dtype='float32',mode='r',shape=(len(ts),101,271))
s=np.memmap(P/'section.bin',dtype='float32',mode='r',shape=(len(ts),541))
d=np.genfromtxt(P/'diagnostics.csv',delimiter=',',names=True)
ca=d[d['control']==0];co=d[d['control']==1]
off=max(a['center']+4*a['sigma'] for a in cfg['sources'])/80
e0=np.interp(off*80,ca['time'],ca['energy_cavity']);e1=np.interp(off*80,co['time'],co['energy_cavity'])
# Spatial averaging is analysis only, never applied to the simulated field.
late=u[ts>=8,:,61:181].mean(axis=1)
late=late-late.mean(axis=0)
psd=np.mean(abs(np.fft.rfft(late*np.hanning(len(late))[:,None],axis=0))**2,axis=1)
fr=np.fft.rfftfreq(len(late),1/30)
source_times=np.arange(len(late))/30*80
sp=np.zeros(len(fr))
for a in cfg['sources']:
    z=(source_times-a['center'])/a['sigma']
    f=a['amplitude']*(1-z*z)*np.exp(-z*z/2)*(abs(z)<=4)
    sp+=abs(np.fft.rfft(f))**2
peak,_=find_peaks(psd,prominence=.01*psd.max())
peaks=[float(fr[i]) for i in peak if .2<fr[i]<2]
late_section=np.asarray(s[ts>=8],dtype=float)
late_flux=-np.gradient(late_section,80/30,axis=0)*np.gradient(late_section,axis=1)
out={
 'model':'2D scalar nearest-neighbor mass-spring lattice; exact rest initial conditions; no imposed reflection coefficients',
 'grid':[1250,401],'time_step':cfg['dt'],'total_time':4800.,'T0':80.,
 'source_count':12,'source_type':'Gaussian-second-derivative pulses, independent signed amplitudes and start times, truncated at 4 sigma',
 'all_sources_off_t_over_T0':off,'central_cut_maximum_absolute_difference':float(np.max(abs(u[:,50,:]-s[:,::2]))),
 'initial_displacement_maximum':float(np.max(abs(u[0]))),
 'relative_discrete_energy_balance_error_cavity':float(np.max(abs(ca['balance_error']))/ca['work'][-1]),
 'relative_discrete_energy_balance_error_control':float(np.max(abs(co['balance_error']))/co['work'][-1]),
 'external_work_cavity':float(ca['work'][-1]),'external_work_control':float(co['work'][-1]),
 'late_cavity_spectral_peaks_f_over_f0':peaks,
 'late_mean_central_section_energy_flux_right':float(late_flux[1:-1,450:521].mean()),
 'late_mean_central_section_energy_flux_left':float(late_flux[1:-1,:20].mean()),
 'spectral_analysis':'t/T0=8..60; average displacement across y, average temporal PSD across cavity x; Hann window',
 'fixed_display_transform':'asinh with linear width 0.005, same fixed range [-0.7,0.7] for color and central section; not frame normalized',
 'video':{'width':1920,'height':1080,'fps':60,'frames':len(ts),'duration_seconds':len(ts)/60,
          'playback':'T0=2 screen seconds before 8 T0; T0=0.5 screen seconds thereafter'},
 'retention':{},
 'limitations':['No gain or stimulated emission; all stored energy eventually decays.',
               'Multiple resonances remain; no single-mode selection or phase locking is claimed.',
               'Parallel finite-aperture analog with absorbing outer pads; no curved-mirror transverse confinement.',
               'Material layers and cavity geometry retained from the preceding 1D simulation.',
               'Same force history does not imply same injected work; energy curves are separately normalized at source shutoff.']}
for t in [8,15,30,60]:
    r0=float(np.interp(t*80,ca['time'],ca['energy_cavity'])/e0)
    r1=float(np.interp(t*80,co['time'],co['energy_cavity'])/e1)
    out['retention'][str(t)]={'cavity':r0,'control':r1}
(P/'validation.json').write_text(json.dumps(out,indent=2))
np.savez(P/'summary_data.npz',time_cavity=ca['time'],energy_cavity=ca['energy_cavity'],
         time_control=co['time'],energy_control=co['energy_cavity'],frequency_over_f0=fr,
         late_field_spectrum=psd,source_spectrum=sp,
         snapshots=np.array([u[np.argmin(abs(ts-t))] for t in [0,1.5,3,5,15,60]]),
         snapshot_times=np.array([0,1.5,3,5,15,60]))
fig,ax=plt.subplots(1,2,figsize=(13,4.4),dpi=160)
ax[0].semilogy(ca['time']/80,ca['energy_cavity']/e0,label='Material multilayers',color='#178d9f')
ax[0].semilogy(co['time']/80,co['energy_cavity']/e1,label='Uniform-material control',color='#626975')
ax[0].axvline(off,color='#ad7d30',ls='--',label='All sources off')
ax[0].set(xlabel='Time / T0',ylabel='Cavity energy / energy at shutoff',ylim=(1e-8,4),xlim=(0,60),title='Same 12 finite pulses; different escape rates')
ax[0].grid(alpha=.2);ax[0].legend(fontsize=8)
ax[1].plot(fr,sp/sp.max(),color='#8d939d',label='Broadband source spectrum (sum)')
ax[1].plot(fr,psd/psd.max(),color='#178d9f',label='Late cavity field spectrum')
ax[1].set(xlabel='Frequency / f0',ylabel='Each spectrum normalized to its own peak',xlim=(.2,1.7),ylim=(0,1.07),title='Several resonances persist, not a single mode')
ax[1].legend(fontsize=8);ax[1].grid(alpha=.2)
fig.tight_layout();fig.savefig(P/'validation_plots.png')
assert out['initial_displacement_maximum']==0
assert out['central_cut_maximum_absolute_difference']==0
assert out['relative_discrete_energy_balance_error_cavity']<1e-10
assert out['relative_discrete_energy_balance_error_control']<1e-10
print(json.dumps(out,indent=2))
