#!/usr/bin/env python3
"""Build the admin catalog from the YouNeed app source. Do not hand-edit the output."""

import json
import re
import shutil
import sys
from pathlib import Path

LANDING = Path(__file__).resolve().parents[1]
APP = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else LANDING.parent / "YouNeed"
OUT_JS = LANDING / "admin" / "catalog-data.js"
OUT_IMAGES = LANDING / "admin" / "catalog-images"

CATEGORIES_FILE = APP / "src" / "constants" / "categories.ts"
TRANSLATIONS_FILE = APP / "src" / "constants" / "translations.ts"
PHOTOS_FILE = APP / "src" / "constants" / "catalog-photos.ts"
ICONS_FILE = APP / "src" / "constants" / "catalog-icons.ts"
MARKS_FILE = APP / "src" / "constants" / "catalog-marks.ts"
IMAGE_DIR = APP / "assets" / "catalog"


def fail(message):
    raise SystemExit(message)


def read(path):
    if not path.is_file():
        fail(f"Missing catalog source: {path}")
    return path.read_text()


def extract_object(text, open_index):
    depth = 0
    quote = None
    index = open_index
    while index < len(text):
        char = text[index]
        if quote:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = None
        elif char in ('"', "'"):
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[open_index:index + 1]
        index += 1
    fail("Unclosed object in catalog source")


def string_pairs(block):
    pairs = {}
    pattern = re.compile(
        r"""(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')\s*:\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')"""
    )
    for match in pattern.finditer(block):
        key = match.group(1) if match.group(1) is not None else match.group(2)
        value = match.group(3) if match.group(3) is not None else match.group(4)
        pairs[key] = value
    return pairs


def language_catalogs(text):
    catalogs = {}
    for language in ("en", "lt", "ru"):
        match = re.search(rf"\n  {language}: \{{", text)
        if not match:
            fail(f"Missing {language} translations")
        body = extract_object(text, match.end() - 1)
        catalog_match = re.search(r"\bcatalog:\s*\{", body)
        if not catalog_match:
            fail(f"Missing {language} catalog translations")
        catalog = extract_object(body, catalog_match.end() - 1)
        names_match = re.search(r"\bnames:\s*\{", catalog)
        subs_match = re.search(r"\bsubcategories:\s*\{", catalog)
        if not names_match or not subs_match:
            fail(f"Missing {language} catalog names or subcategories")
        catalogs[language] = {
            "names": string_pairs(extract_object(catalog, names_match.end() - 1)),
            "subcategories": string_pairs(extract_object(catalog, subs_match.end() - 1)),
        }
    return catalogs


def categories(text):
    rows = []
    for block in re.split(r"\n  \{\n", text)[1:]:
        identifier = re.search(r"id:\s*(\d+)", block)
        name = re.search(r'name:\s*"((?:\\.|[^"\\])*)"', block)
        sub_block = re.search(r"subcategories:\s*\[(.*?)\]", block, re.S)
        if not identifier or not name or not sub_block:
            continue
        subs = re.findall(r'"((?:\\.|[^"\\])*)"', sub_block.group(1))
        rows.append({
            "id": int(identifier.group(1)),
            "name": name.group(1),
            "subcategories": subs,
        })
    return rows


def photo_map(text):
    photos = {}
    pattern = re.compile(r'"((?:c:\d+|s:\d+:[^"]+))"\s*:\s*require\("\.\./\.\./assets/catalog/([^"]+)"\)')
    for key, filename in pattern.findall(text):
        photos[key] = filename
    return photos


def mark_map(icons_text, marks_text):
    fallback_match = re.search(
        r"FALLBACK_CATALOG_MARK:\s*CatalogMarkSpec\s*=\s*\{(.*?)\};",
        marks_text,
        re.S,
    )
    if not fallback_match:
        fail("Missing fallback catalog mark")
    fallback = spec_from_block(fallback_match.group(1))
    design_match = re.search(r"export const categoryIconDesign[^{]*\{", icons_text)
    if not design_match:
        fail("Missing category icon designs")
    design_body = extract_object(icons_text, design_match.end() - 1)
    designs = {}
    for identifier, block in re.findall(r"(?:^|\n)\s*(\d+)\s*:\s*\{(.*?)\}", design_body, re.S):
        designs[int(identifier)] = spec_from_block(block)
    subs_match = re.search(r"export const subcategoryMarks\s*=\s*\{", icons_text)
    if not subs_match:
        fail("Missing subcategory marks")
    subs_body = extract_object(icons_text, subs_match.end() - 1)
    sub_marks = {}
    for key, block in re.findall(r"""['"]((?:\\.|[^'"\\])*)['"]\s*:\s*\{(.*?)\}""", subs_body, re.S):
        sub_marks[key] = spec_from_block(block)
    return fallback, designs, sub_marks


def spec_from_block(block):
    mark = re.search(r"mark:\s*'([^']+)'", block)
    background = re.search(r"background:\s*'(#[0-9A-Fa-f]+)'", block)
    accent = re.search(r"accent:\s*'(#[0-9A-Fa-f]+)'", block)
    motif = re.search(r"motif:\s*(\d+)", block)
    if not mark or not background or not accent:
        fail("Incomplete icon mark")
    return {
        "mark": mark.group(1),
        "background": background.group(1),
        "accent": accent.group(1),
        "motif": int(motif.group(1)) if motif else 0,
    }


def labels_for(table, key, language):
    value = table.get(key)
    if not value:
        fail(f"Missing {language} label for {key}")
    return value


def main():
    catalog_rows = categories(read(CATEGORIES_FILE))
    translations = language_catalogs(read(TRANSLATIONS_FILE))
    photos = photo_map(read(PHOTOS_FILE))
    fallback, designs, sub_marks = mark_map(read(ICONS_FILE), read(MARKS_FILE))
    if len(catalog_rows) != 24:
        fail(f"Expected 24 categories, found {len(catalog_rows)}")
    subcategory_count = sum(len(row["subcategories"]) for row in catalog_rows)
    if subcategory_count != 255:
        fail(f"Expected 255 subcategories, found {subcategory_count}")
    if len(photos) != 279:
        fail(f"Expected 279 catalog images, found {len(photos)}")

    if OUT_IMAGES.exists():
        shutil.rmtree(OUT_IMAGES)
    OUT_IMAGES.mkdir(parents=True)

    categories_out = []
    used_images = set()
    for order, row in enumerate(catalog_rows, start=1):
        photo_key = f"c:{row['id']}"
        filename = photos.get(photo_key)
        if not filename:
            fail(f"Missing photo for category {row['id']}")
        source = IMAGE_DIR / filename
        if not source.is_file():
            fail(f"Missing image file {source}")
        shutil.copy2(source, OUT_IMAGES / filename)
        used_images.add(filename)
        subcategories = []
        for sub_order, name in enumerate(row["subcategories"], start=1):
            sub_key = f"s:{row['id']}:{name}"
            sub_filename = photos.get(sub_key)
            if not sub_filename:
                fail(f"Missing photo for {sub_key}")
            sub_source = IMAGE_DIR / sub_filename
            if not sub_source.is_file():
                fail(f"Missing image file {sub_source}")
            shutil.copy2(sub_source, OUT_IMAGES / sub_filename)
            used_images.add(sub_filename)
            subcategories.append({
                "name": name,
                "order": sub_order,
                "image": f"/admin/catalog-images/{sub_filename}",
                "mark": sub_marks.get(name, fallback),
                "labels": {
                    language: labels_for(translations[language]["subcategories"], name, language)
                    for language in ("en", "lt", "ru")
                },
            })
        categories_out.append({
            "id": row["id"],
            "order": order,
            "name": row["name"],
            "image": f"/admin/catalog-images/{filename}",
            "mark": designs.get(row["id"], fallback),
            "labels": {
                language: labels_for(translations[language]["names"], row["name"], language)
                for language in ("en", "lt", "ru")
            },
            "subcategories": subcategories,
        })

    if len(used_images) != 279:
        fail(f"Expected to publish 279 images, prepared {len(used_images)}")
    payload = {
        "source": "YouNeed/src/constants/categories.ts",
        "categoryCount": 24,
        "subcategoryCount": 255,
        "imageCount": 279,
        "categories": categories_out,
    }
    OUT_JS.write_text(
        "/* Generated by admin/build-catalog.py from the YouNeed app catalog. Do not edit by hand. */\n"
        "window.YOUNEED_CATALOG = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n"
    )
    print(f"Wrote {OUT_JS}")
    print(f"Copied {len(used_images)} images to {OUT_IMAGES}")


if __name__ == "__main__":
    main()
