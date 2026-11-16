#!/usr/bin/env python3
"""Assemble a VASP POTCAR locally from POSCAR species and a licensed PAW library."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path


ELEMENT = re.compile(r"^[A-Z][a-z]?$")


def parse_poscar(path: Path, fallback_species: list[str] | None) -> tuple[list[str], list[int]]:
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    if len(lines) < 7:
        raise ValueError("POSCAR is too short to contain lattice and species information.")

    candidate = lines[5].split()
    if candidate and all(token.isdigit() for token in candidate):
        if not fallback_species:
            raise ValueError(
                "This is a VASP 4 POSCAR without element symbols. Supply them in order with --species C H N."
            )
        species = fallback_species
        counts_line = candidate
    else:
        species = candidate
        counts_line = lines[6].split()

    if not species or not all(ELEMENT.fullmatch(symbol) for symbol in species):
        raise ValueError("Could not parse the POSCAR element-symbol line; expected symbols such as C H N.")
    if fallback_species and not (candidate and all(token.isdigit() for token in candidate)):
        raise ValueError("--species is only used for VASP 4 POSCAR files that lack element symbols.")
    if len(species) != len(counts_line):
        raise ValueError("The number of POSCAR species must match the number of atom counts.")

    try:
        counts = [int(value) for value in counts_line]
    except ValueError as exc:
        raise ValueError("POSCAR atom counts must be integers.") from exc
    if any(count < 0 for count in counts) or sum(counts) < 1:
        raise ValueError("POSCAR atom counts must be non-negative and include at least one atom.")
    return species, counts


def parse_overrides(values: list[str]) -> dict[str, str]:
    overrides: dict[str, str] = {}
    for value in values:
        if "=" not in value:
            raise ValueError(f"Invalid --map value {value!r}; use ELEMENT=DATASET, for example C=C_h.")
        element, dataset = value.split("=", 1)
        if not (ELEMENT.fullmatch(element) or element.isdigit()) or not dataset.strip():
            raise ValueError(f"Invalid --map value {value!r}; use ELEMENT=DATASET or species-index=DATASET, such as C=C_h or 2=C_h.")
        overrides[element] = dataset.strip()
    return overrides


def locate_potcar(root: Path, element: str, dataset: str) -> Path:
    matches = sorted(path for path in root.rglob("POTCAR") if path.is_file() and path.parent.name == dataset)
    if not matches:
        raise FileNotFoundError(
            f"No POTCAR found for {element} using dataset folder {dataset!r} under {root}. "
            f"Use --map {element}=<folder-name> to select a variant."
        )
    if len(matches) > 1:
        choices = "\n  ".join(str(path) for path in matches)
        raise ValueError(
            f"Multiple POTCAR files match {element} / {dataset!r}. Use a more specific library root.\n  {choices}"
        )
    return matches[0]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read POSCAR species order and concatenate matching POTCAR datasets locally."
    )
    parser.add_argument("poscar", type=Path, help="Input POSCAR / CONTCAR")
    parser.add_argument("--potcar-root", required=True, type=Path, help="Root of your licensed VASP PAW library")
    parser.add_argument("--output-dir", type=Path, default=Path("."), help="Calculation directory for POTCAR (default: current directory)")
    parser.add_argument("--species", nargs="+", help="Ordered symbols for a VASP 4 POSCAR with no element line")
    parser.add_argument("--map", action="append", default=[], metavar="ELEMENT=DATASET", help="Select a variant, e.g. C=C_h; use 2=C_h for a specific species block")
    parser.add_argument("--force", action="store_true", help="Replace existing POTCAR and manifest")
    args = parser.parse_args()

    try:
        poscar = args.poscar.expanduser().resolve(strict=True)
        library = args.potcar_root.expanduser().resolve(strict=True)
        if not library.is_dir():
            raise ValueError("--potcar-root must point to a directory.")
        species, counts = parse_poscar(poscar, args.species)
        overrides = parse_overrides(args.map)
        valid_keys = set(species) | {str(index) for index in range(1, len(species) + 1)}
        unknown = sorted(set(overrides) - valid_keys)
        if unknown:
            raise ValueError("--map refers to an element or species-block index that is not present: " + ", ".join(unknown))

        datasets: list[tuple[str, int, Path, bytes]] = []
        for index, (element, count) in enumerate(zip(species, counts), start=1):
            dataset = overrides.get(str(index), overrides.get(element, element))
            source = locate_potcar(library, element, dataset)
            content = source.read_bytes()
            if not content.strip() or b"TITEL" not in content:
                raise ValueError(f"{source} does not look like a VASP POTCAR dataset (missing TITEL).")
            datasets.append((element, count, source, content))

        out_dir = args.output_dir.expanduser().resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        output = out_dir / "POTCAR"
        manifest_path = out_dir / "POTCAR.manifest.json"
        existing = [path for path in (output, manifest_path) if path.exists()]
        if existing and not args.force:
            raise FileExistsError(
                "Output already exists: " + ", ".join(str(path) for path in existing) + ". Use --force to replace it."
            )

        assembled = b"".join(content if content.endswith((b"\n", b"\r")) else content + b"\n" for _, _, _, content in datasets)
        output_tmp = output.with_name(output.name + ".tmp")
        output_tmp.write_bytes(assembled)
        os.replace(output_tmp, output)
        manifest = {
            "status": "assembled-locally-review-before-use",
            "poscar": poscar.name,
            "species_order": species,
            "atom_counts": counts,
            "datasets": [
                {
                    "element": element,
                    "count": count,
                    "dataset_folder": source.parent.name,
                    "library_relative_path": str(source.relative_to(library)),
                    "sha256": hashlib.sha256(content).hexdigest(),
                }
                for element, count, source, content in datasets
            ],
            "potcar_sha256": hashlib.sha256(assembled).hexdigest(),
            "note": "Generated from the local VASP PAW library. Verify dataset choice and species order; do not redistribute licensed POTCAR data.",
        }
        manifest_tmp = manifest_path.with_name(manifest_path.name + ".tmp")
        manifest_tmp.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        os.replace(manifest_tmp, manifest_path)
    except (OSError, ValueError) as exc:
        print(f"POTCAR build failed: {exc}", file=sys.stderr)
        return 2

    print("POTCAR created:", output)
    print("Species order:", " ".join(f"{symbol}({count})" for symbol, count in zip(species, counts)))
    print("Manifest:", manifest_path)
    print("SHA-256:", manifest["potcar_sha256"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
