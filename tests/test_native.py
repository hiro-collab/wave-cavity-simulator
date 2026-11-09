"""Fast native input and numerical smoke tests; no full-duration run."""
import importlib.util
from pathlib import Path
import json, shutil, subprocess, tempfile, unittest
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('configure',ROOT/'native/configure.py')
config=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(config)
class NativeTests(unittest.TestCase):
    def test_validation(self):
        for invalid in [{'dt':1},{'dt':float('nan')},{'layer_mass':0},{'seed':1.5},{'amplitude_scale':0},{'unknown':1},{'layer_stiffness':True}]:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError): config.validate(invalid)
    def test_default_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            result=config.configure(ROOT/'native/parameters.json',tmp)
            self.assertEqual(len(result['sources']),12)
            self.assertEqual(result['sources'][0]['x'],572)
            self.assertAlmostEqual(result['sources'][0]['amplitude'],-.8907693144961584)
            times=np.load(Path(tmp)/'frame_times.npy')
            self.assertEqual(len(times),2521); self.assertEqual(times[0],0)
    @unittest.skipUnless(shutil.which('g++'),'g++ required')
    def test_solver_rest_and_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp=Path(tmp);config.configure(ROOT/'native/parameters.json',tmp)
            shutil.copy(ROOT/'native/simulate.cpp',tmp/'simulate.cpp')
            subprocess.run(['g++','-O2','-std=c++17','-DSIM_PERIODS=2','simulate.cpp','-o','simulate'],cwd=tmp,check=True)
            subprocess.run([str(tmp/'simulate')],cwd=tmp,check=True,capture_output=True)
            field=np.fromfile(tmp/'field.bin',np.float32).reshape(-1,101,271)
            self.assertTrue(np.isfinite(field).all());self.assertEqual(float(abs(field[0]).max()),0)
            self.assertGreater(float(abs(field[-1]).max()),0)
            cut=np.fromfile(tmp/'section.bin',np.float32).reshape(-1,541)
            np.testing.assert_array_equal(field[:,50,:],cut[:,::2])
            diag=np.genfromtxt(tmp/'diagnostics.csv',delimiter=',',names=True)
            self.assertLess(float(abs(diag['balance_error']).max()),1e-10)
            (tmp/'input.txt').write_text('broken input')
            result=subprocess.run([str(tmp/'simulate')],cwd=tmp,capture_output=True)
            self.assertNotEqual(result.returncode,0)
if __name__=='__main__': unittest.main()
