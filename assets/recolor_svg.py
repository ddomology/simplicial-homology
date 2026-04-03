from pathlib import Path
import re
import xml.etree.ElementTree as ET

ASSETS_DIR = Path(__file__).resolve().parent
TARGET_FILES = ["undo.svg", "redo.svg"]

WHITE = "#ffffff"

BLACK_VALUES = {
    "#000", "#000000",
    "black",
    "rgb(0,0,0)", "rgb(0, 0, 0)",
    "rgba(0,0,0,1)", "rgba(0, 0, 0, 1)",
}

COLOR_ATTRS = {"fill", "stroke", "color"}

def normalize_color(value: str) -> str:
    return value.strip().lower()

def is_black(value: str) -> bool:
    return normalize_color(value) in BLACK_VALUES

def parse_style(style: str) -> dict[str, str]:
    result = {}
    for chunk in style.split(";"):
        if ":" not in chunk:
            continue
        key, value = chunk.split(":", 1)
        result[key.strip()] = value.strip()
    return result

def dump_style(style_dict: dict[str, str]) -> str:
    return "; ".join(f"{k}: {v}" for k, v in style_dict.items())

def recolor_element(elem: ET.Element) -> bool:
    changed = False

    for attr in COLOR_ATTRS:
        value = elem.get(attr)
        if value is not None and is_black(value):
            elem.set(attr, WHITE)
            changed = True

    style = elem.get("style")
    if style:
        style_dict = parse_style(style)
        local_changed = False
        for key in COLOR_ATTRS:
            if key in style_dict and is_black(style_dict[key]):
                style_dict[key] = WHITE
                local_changed = True
        if local_changed:
            elem.set("style", dump_style(style_dict))
            changed = True

    return changed

def uses_current_color(root: ET.Element) -> bool:
    for elem in root.iter():
        for attr in COLOR_ATTRS:
            value = elem.get(attr)
            if value is not None and normalize_color(value) == "currentcolor":
                return True
        style = elem.get("style")
        if style:
            style_dict = parse_style(style)
            for key in COLOR_ATTRS:
                if normalize_color(style_dict.get(key, "")) == "currentcolor":
                    return True
    return False

def set_root_current_color_white(root: ET.Element) -> None:
    root.set("color", WHITE)
    style = root.get("style", "")
    style_dict = parse_style(style) if style else {}
    style_dict["color"] = WHITE
    root.set("style", dump_style(style_dict))

def recolor_svg_file(svg_path: Path) -> None:
    ET.register_namespace("", "http://www.w3.org/2000/svg")

    tree = ET.parse(svg_path)
    root = tree.getroot()

    changed = False
    for elem in root.iter():
        if recolor_element(elem):
            changed = True

    if uses_current_color(root):
        set_root_current_color_white(root)
        changed = True

    if changed:
        tree.write(svg_path, encoding="utf-8", xml_declaration=True)
        print(f"[OK] recolored: {svg_path.name}")
    else:
        print(f"[SKIP] no black color found: {svg_path.name}")

def main() -> None:
    for name in TARGET_FILES:
        svg_path = ASSETS_DIR / name
        if not svg_path.exists():
            print(f"[MISS] file not found: {svg_path}")
            continue
        recolor_svg_file(svg_path)

if __name__ == "__main__":
    main()