"""Portable runner. Requires g++ (or CXX), Python dependencies and optional FFmpeg."""
from pathlib import Path
import argparse, os, subprocess, sys
from configure import configure
P=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--parameters',type=Path,default=P/'parameters.json')
parser.add_argument('--no-render',action='store_true',help='Skip MP4 creation (still compute and analyze)')
args=parser.parse_args()
configure(args.parameters)
def run(cmd): subprocess.run(cmd,cwd=P,check=True)
exe=P/('simulate.exe' if os.name=='nt' else 'simulate')
run([os.environ.get('CXX','g++'),'-O3','-std=c++17',str(P/'simulate.cpp'),'-o',str(exe)])
run([str(exe)])
run([sys.executable,str(P/'analyze.py')])
if not args.no_render: run([sys.executable,str(P/'render.py')])
