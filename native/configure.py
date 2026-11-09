"""Generate solver inputs from editable parameters.json (never overwrite it)."""
from pathlib import Path
import argparse
import json
import math
import numpy as np
P = Path(__file__).resolve().parent
DEFAULTS = dict(seed=420731, dt=.3, layer_mass=4., layer_stiffness=2.,
                pulse_sigma_periods=.225, amplitude_scale=1.)
def validate(values):
    if set(values) - set(DEFAULTS):
        raise ValueError("Unknown parameters: " + str(set(values) - set(DEFAULTS)))
    cfg = dict(DEFAULTS, **values)
    if type(cfg['seed']) is not int or not 0 <= cfg['seed'] <= 2**32-1:
        raise ValueError('seed must be an integer in [0, 4294967295]')
    for key, lo, hi in [('dt',.01,.35), ('layer_mass',1,10),
                        ('layer_stiffness',.1,2), ('pulse_sigma_periods',.1,.3),
                        ('amplitude_scale',.01,10)]:
        v = cfg[key]
        if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not lo <= v <= hi:
            raise ValueError(f'{key} must be finite and in [{lo}, {hi}]')
    return cfg

def configure(parameter_file=P/'parameters.json', output=P):
    v = validate(json.loads(Path(parameter_file).read_text()))
    rng = np.random.default_rng(v['seed'])
    T=80.; ft=np.r_[np.arange(0,8,1/120),np.arange(8,60+1e-9,1/30)]*T
    sources=[]
    for _ in range(12):
        sources.append(dict(x=int(rng.integers(548,736)),y=int(rng.integers(164,237)),
            center=float(rng.uniform(1.4,3.8)*T),sigma=float(v['pulse_sigma_periods']*T),
            amplitude=float(rng.choice([-1,1])*rng.uniform(.8,1.2)*v['amplitude_scale'])))
    cfg=dict(nx=1250,ny=401,dt=v['dt'],T=T,total_periods=60.,cavity=[522,762],
             mirrors=[420,522,762,830],view=[400,940,100,300],stride=2,
             sources=sources,source_cutoff_sigma=4.,parameters=v)
    output=Path(output); output.mkdir(parents=True,exist_ok=True)
    (output/'config.json').write_text(json.dumps(cfg,indent=2)+'\n')
    with (output/'input.txt').open('w') as f:
        f.write(f'{len(ft)} {len(sources)}\n')
        f.write(' '.join(map(str,ft))+'\n')
        for s in sources: f.write(' '.join(str(s[k]) for k in ['x','y','center','sigma','amplitude'])+'\n')
    np.save(output/'frame_times.npy',ft)
    (output/'parameters.h').write_text(
        '#ifndef SIM_DT\n#define SIM_DT '+repr(v['dt'])+'\n#endif\n'
        '#define LAYER_MASS '+repr(v['layer_mass'])+'\n'
        '#define LAYER_STIFFNESS '+repr(v['layer_stiffness'])+'\n')
    return cfg
if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--parameters',type=Path,default=P/'parameters.json')
    args=parser.parse_args()
    try: configure(args.parameters)
    except (ValueError,OSError) as exc: parser.error(str(exc))
    print('Configured 2521 frames. Edit parameters.json, not generated config.json.')
