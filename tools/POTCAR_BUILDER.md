# Local POTCAR builder

The helper reads the element symbols and species order from a VASP 5 `POSCAR` or `CONTCAR`, then concatenates matching `POTCAR` datasets from a local VASP PAW library. It can be used on Windows, macOS, and Linux with Python 3.10 or newer.

The helper does not contain or upload VASP datasets. Keep the generated `POTCAR` on your own system and follow your VASP license.

## Windows PowerShell

```powershell
python .\tools\build_potcar.py .\POSCAR `
  --potcar-root "D:\VASP\potpaw_PBE.64" `
  --output-dir .\dos
```

Replace the library path with the directory on your computer that contains element folders such as `C\POTCAR`, `N\POTCAR`, and `H\POTCAR`. Use the functional and PAW release that match your calculation.

## macOS / Linux

```bash
python3 tools/build_potcar.py POSCAR \
  --potcar-root /path/to/potpaw_PBE.64 \
  --output-dir dos
```

## Potential variants

The default is an element folder matching the `POSCAR` symbol, for example `C/POTCAR`. To select a variant such as `C_h`, name the library folder explicitly:

```powershell
python .\tools\build_potcar.py .\POSCAR `
  --potcar-root "D:\VASP\potpaw_PBE.64" `
  --output-dir .\dos `
  --map C=C_h
```

Repeat `--map`, for example `--map C=C_h --map N=N --map H=H`, when more than one species needs an explicit selection. If multiple datasets match, the helper stops and asks for a more specific library root instead of choosing one silently.

For POSCAR files that list the same element in more than one species block, use the one-based block number to select a variant for only that block, for example `--map 2=C_h`.

## VASP 4 POSCAR files

If the POSCAR has no element-symbol line, pass symbols in the exact order of its count line:

```powershell
python .\tools\build_potcar.py .\POSCAR `
  --potcar-root "D:\VASP\potpaw_PBE.64" `
  --output-dir .\dos `
  --species C N H
```

The helper writes `POTCAR` and `POTCAR.manifest.json` to the output directory. The manifest records the detected species/count order, selected dataset folders, and SHA-256 checksums. Review it and verify the choice of PAW datasets before submitting VASP. Existing output is protected; use `--force` only when you intend to replace both generated files.
