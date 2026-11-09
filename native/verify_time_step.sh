#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p verify_half_step
cp input.txt verify_half_step/
g++ -O3 -std=c++17 -DSIM_DT=.15 -DSIM_PERIODS=20 -DCONTROL_RUNS=1 simulate.cpp -o verify_half_step/simulate
(cd verify_half_step && ./simulate)
python - <<'PY'
import json
from pathlib import Path
import numpy as np
ts=np.load('frame_times.npy')
shape=(101,271)
nf=Path('verify_half_step/field.bin').stat().st_size//(4*np.prod(shape))
u=np.memmap('field.bin',dtype='float32',mode='r',shape=(len(ts),*shape))
v=np.memmap('verify_half_step/field.bin',dtype='float32',mode='r',shape=(nf,*shape))
num=den=0.
for i in range(0,nf,20):
    a=np.asarray(u[i:min(i+20,nf)],float);b=np.asarray(v[i:min(i+20,nf)],float)
    num+=np.sum((a-b)**2);den+=np.sum(b*b)
result={'reference_dt':.15,'tested_to_T0':20,
        'all_saved_frames_relative_rms_error':float(np.sqrt(num/den)),
        'final_frame_relative_rms_error':float(np.linalg.norm(u[nf-1]-v[-1])/np.linalg.norm(v[-1]))}
Path('half_step_validation.json').write_text(json.dumps(result,indent=2))
checks=json.loads(Path('validation.json').read_text());checks['half_time_step_verification']=result
Path('validation.json').write_text(json.dumps(checks,indent=2))
assert result['all_saved_frames_relative_rms_error']<.005
print(json.dumps(result,indent=2))
PY
