# KICETIC-surface · Surface Compute Lab

A bilingual Korean / English interface mockup for a small diamond-growth research group: literature data → problem definition → DFT input drafts → simulated cluster jobs → results → kinetics / COMSOL transfer.

[한국어 안내](docs/SHARING.ko.md) · [Research survey and module notes](docs/research-and-modules.ko.md)

## Preview locally

Open `site/index.html` in a current browser. A server, Python, and a DFT installation are not needed to view the prebuilt page. Internet access is needed for the exported viewer's external runtime assets. The language buttons preserve current settings and demo progress. Preferences are saved in this browser when storage is available; there is no shared backend.

## Publish with GitHub Pages

1. Create an empty GitHub repository, for example `surface-compute-lab`.
2. Upload this folder's **contents**, preserving `src`, `tools`, `site`, `data`, `docs`, and `.github/workflows/pages.yml`. Do not upload the ZIP file itself or nest the whole folder inside another folder.
3. Commit to `main`.
4. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
5. In **Actions → Deploy Surface Compute Lab**, run the workflow if necessary. The successful deployment provides the shareable URL.

The workflow follows [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Repository-plan and organization settings determine whether Pages is available.

If browser upload omits the hidden `.github` folder, use the simpler alternative: **Settings → Pages → Deploy from a branch → main → /docs**. A prebuilt copy is included at `docs/index.html`. After future changes, run the build script to update both page copies.

## Update the mockup

- Edit `src/app.html`: interface, translations, example data, and demo logic.
- Run `python tools/build.py` (Python 3, no third-party packages).
- Open `site/index.html` to review, then commit changed files.
- `src/page-template.html` contains the exported viewer shell; normally leave it unchanged.
- `data/literature-seed.json` is the initial research inventory. The mockup uses its own embedded `sources` records in `src/app.html`; this JSON is not loaded automatically. Keep both aligned when updating references.

## What works

- Korean / English switching with shared screen and calculation state.
- Literature search, source links, and seed-data download.
- Problem and condition editing; VASP / Quantum ESPRESSO **draft** input generation.
- Slurm / PBS job-script drafts and simulated job-state progression.
- Synthetic result plots and an adjustable TST demonstration.
- Example JSON / CSV downloads for kinetics integration.

## Scope and data

No real SSH, uploads, scheduler submissions, VASP / QE calculations, output parsing, or COMSOL execution are performed. Structure-file selection shows the filename only. Generated drafts have unresolved structure and pseudopotential requirements and are not runnable input packages. POTCAR / UPF files and credentials are not included.

Results and example free-energy barriers are synthetic. Quantitative literature barriers remain `null` pending primary-source verification. Seven source records and five reaction candidates are included. Source links and verification limits are documented in the research notes. This is a static prototype, not a shared research database or a restricted-access collaboration service.

## Repository structure

```text
src/app.html                  Editable bilingual application fragment
src/page-template.html        Exported viewer shell
tools/build.py                Rebuild standalone pages
site/index.html               GitHub Actions deployment target
docs/index.html               Optional branch-based Pages target
data/literature-seed.json     Initial source and reaction inventory
docs/SHARING.ko.md            Korean upload instructions
docs/research-and-modules.ko.md  Research scope and module plan
.github/workflows/pages.yml   Pages build and deployment
```

The viewer was exported from the visualization used during design. External runtime resources remain referenced in the exported shell. No project-wide license is assigned in this package; choose one before licensing or redistributing the project more broadly. Referenced publications and software retain their respective rights and licenses.
