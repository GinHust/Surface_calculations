# KICETIC-surface · Surface Compute Lab

An English-language interface mockup for a small diamond-growth research group: literature data → problem definition → DFT input drafts → simulated cluster jobs → results → kinetics / COMSOL transfer.

[한국어 안내](docs/SHARING.ko.md) · [Research survey and module notes](docs/research-and-modules.ko.md)

## Preview locally

Open `site/index.html` in a current browser. A server, Python, and a DFT installation are not needed to view the prebuilt page. Internet access is needed for the exported viewer's external runtime assets. The interface uses English, including for previously saved language preferences. Preferences are saved in this browser when storage is available; there is no shared backend.

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
- `data/literature-seed.json` is the initial research inventory. The build embeds its source records into the application and generates the selected nitrogen-incorporation references on Literature Search. Rebuild after updating this JSON.

## What works

- **Research Planner**: source-linked questions, multiple material configurations, provenance/assumptions, attached coordinate files, matched comparison groups, and dependency-aware calculation plans. Available as an optional Advanced comparison planning button inside Problem & Conditions. Includes adsorption/NEB planning templates, browser persistence and JSON import/export. See the [Vietnamese guide](docs/research-planner.vi.md).
- **Paper → Structure builder (L01 example)**: focuses on one question with two slab models—an N-free C–C reference and a surface-embedded C–N hypothesis. It presents paper values with source locations, separates them from geometric assumptions, generates and previews the two starting POSCARs, and can save exactly two paper-linked configurations to the Research Planner. A downloadable VASP draft bundle contains separate slab-relaxation inputs plus C–C 4→6 and C–N 4→5→6 NEB templates. Reaction endpoints/images are not fabricated and the package is not runnable until those coordinates, licensed PAW files, and convergence/cluster settings are supplied. This is a paper-specific reconstruction workflow, not automatic extraction or DFT execution for arbitrary papers.
- English-only interface with shared screen and calculation state.
- Embedded [3Dmol.js](https://3dmol.org/) structure viewer in **Problem & Conditions**: open POSCAR / CONTCAR (with element names), `.vasp`, `.cif`, or `.xyz`; switch between orthographic XY / XZ / YZ views and free rotation, toggle the unit cell and inferred bonds, zoom, and save PNG images.
- Literature search, source links, and seed-data download.
- **Find papers online** opens paper search inside the website from Literature, using the current keywords. **Find related papers** in Problem & Conditions uses the current research question. Closing the search returns to the same calculation screen; unchanged searches retain their results. The full search page remains available.
- Problem and condition editing; VASP / Quantum ESPRESSO **draft** input generation.
- Slurm / PBS job-script drafts and simulated job-state progression.
- Synthetic result plots and an adjustable TST demonstration.
- Example JSON / CSV downloads for kinetics integration.

## Scope and data

No real SSH, server uploads, scheduler submissions, VASP / QE calculations, calculation-output parsing, or COMSOL execution are performed. The structure viewer reads local files in browser memory; reopen the file after a page refresh. Viewing does not validate the structure for computation or populate generated input drafts. Generated drafts have unresolved structure and pseudopotential requirements and are not runnable input packages. POTCAR / UPF files and credentials are not included.

The viewer loads 3Dmol.js **2.5.5** from jsDelivr on first use and requires internet access and WebGL. It accepts up to 5 MB / 10,000 displayed atoms and shows the first XYZ frame. XYZ cell metadata is not interpreted; CIF symmetry handling is provided by 3Dmol. POSCAR scalar, negative-volume, and three-component scaling are normalized before rendering. Cartesian view axes are not necessarily crystallographic planes for tilted cells. Bonds are inferred from distances. The built-in diamond example is an ideal unit cell, not a reconstructed surface slab or a calculation result. The L01 builder's generated slab coordinates use stated, adjustable bond-length assumptions and require geometry relaxation and independent structural review. They are not author coordinates; reaction geometries and transition states are not inferred from paper figures. QE `.in` files must be converted to a supported format first.

Results and example free-energy barriers are synthetic. Quantitative literature barriers remain `null` pending primary-source verification. Twelve source records and five reaction candidates are included. Source links and verification limits are documented in the research notes. This is a static prototype, not a shared research database or a restricted-access collaboration service.

## Repository structure

```text
src/app.html                  Editable bilingual application fragment
src/structure-viewer.js       Embedded structure viewer and format validation
src/research-planner.js       Research plans, configuration records and comparison checks
src/paper-model.js            Paper-grounded L01 model construction and POSCAR drafts
data/l01-model.json           Reported L01 settings, source locations and explicit assumptions
src/page-template.html        Exported viewer shell
tools/build.py                Rebuild standalone pages
site/index.html               GitHub Actions deployment target
docs/index.html               Optional branch-based Pages target
data/literature-seed.json     Initial source and reaction inventory
docs/SHARING.ko.md            Korean upload instructions
docs/research-and-modules.ko.md  Research scope and module plan
.github/workflows/pages.yml   Pages build and deployment
```

Run `node --test tests/*.test.cjs` to check coordinate normalization, malformed-file handling, scientific planning checks, JSON round-trips and Literature → Planner → draft-manifest integration. `tests/fixtures/` includes small POSCAR, CIF and XYZ files for browser checks. Rebuild with `python tools/build.py` after changing application source files.

Research plans are not solver submissions. Attached coordinates persist in browser state when storage is available and are included in plan JSON exports; generated DFT input packages remain drafts without automatic coordinate/pseudopotential insertion. A complete planning record does not establish physical validity. Composition/cell checks require POSCAR; CIF remains a preview and XYZ lacks a periodic cell. Limits: eight problems, forty configurations/groups per problem, 200 KiB per coordinate file, 1 MiB per planning document. The standalone shell permits up to 2 MiB of widget state to accommodate the planning document and current draft context.

The viewer was exported from the visualization used during design. External runtime resources remain referenced in the exported shell. No project-wide license is assigned in this package; choose one before licensing or redistributing the project more broadly. Referenced publications and software retain their respective rights and licenses.
