#!/usr/bin/env python3
"""Export Director quiz data to a single questions.json file."""

import csv
import json
import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path

BASE = Path(__file__).parent.parent
LANGUAGES = ["de", "fr", "it"]
IMPORT_DIR = BASE / "import"

warnings = []


def warn(msg):
    warnings.append(msg)


def read_csv(path):
    """Read a Members.csv file and return rows as list of dicts."""
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def build_name_to_file(rows):
    """From bmpquestions Members.csv: Name column -> filename (Number.png)."""
    mapping = {}
    for row in rows:
        name = row.get("Name", "").strip()
        number = row.get("Number", "").strip()
        if name and number:
            mapping[name] = f"assets/images/{number}.png"
    return mapping


def build_name_to_number(rows):
    """From txtequestions Members.csv: Name column -> Number."""
    mapping = {}
    for row in rows:
        name = row.get("Name", "").strip()
        number = row.get("Number", "").strip()
        if name and number:
            mapping[name] = int(number)
    return mapping


def resolve_image(ref, name_to_file):
    """Resolve an image ref (e.g. '2.61', '2.59-5-a') to a filename."""
    if not ref:
        return None
    ref = ref.strip()
    filename = name_to_file.get(ref)
    if filename:
        return filename
    warn(f"Image ref '{ref}' not found in bmpquestions Members.csv")
    return None


def parse_xml_question(path):
    """Parse xmlquestions/N.txt and return metadata + answers."""
    content = path.read_text(encoding="utf-8")
    # Strip the xml declaration and wrapper tags
    root = ET.fromstring(content)
    q = root.find("question")
    if q is None:
        return None

    q_attrs = dict(q.attrib)
    answers = []
    for ans in q.findall("answer"):
        answers.append(dict(ans.attrib))

    return {
        "frageId": q_attrs.get("fragenumber"),
        "type_raw": int(q_attrs.get("typ", "0")),
        "category": int(q_attrs.get("lKategorie", "0")),
        "hasTextCast": q_attrs.get("text") == "1",
        "questionImageRef": q_attrs.get("image"),
        "answers_raw": answers,
    }


def parse_xmlexplanation(path):
    """Parse xmlequestions/M.txt and return answers with paragraph, hidden, textRef, plus question-level asa flag."""
    content = path.read_text(encoding="utf-8")
    root = ET.fromstring(content)
    answers = []
    for ans in root.findall("answer"):
        a = dict(ans.attrib)
        answers.append({
            "number": int(a.get("number", "0")),
            "paragraph": a.get("paragraf", ""),
            "validity": a.get("validity", "0"),
            "textRef": a.get("text", ""),
            "hidden": a.get("asadelete", "0") == "1",
        })
    q_attrs = dict(root.attrib)
    asa = q_attrs.get("asa", "0")
    frage_id = q_attrs.get("fragenummer")
    return answers, asa == "1", frage_id


def build_xmle_id_map(lang):
    """Build a mapping from fragenummer (int) -> Path for a language's xmlequestions."""
    xmle_dir = IMPORT_DIR / lang / "xmlequestions"
    mapping = {}
    for f in xmle_dir.iterdir():
        if f.suffix != ".txt" or f.name == "Members.csv":
            continue
        try:
            content = f.read_text(encoding="utf-8")
            root = ET.fromstring(content)
            frage_id = root.attrib.get("fragenummer")
            if frage_id is not None:
                mapping[int(frage_id)] = f
        except Exception:
            pass
    return mapping


def read_txtquestion(path, has_text_cast):
    """Read txtquestions/N.txt and return (question_text, options_list)."""
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines:
        return None, []
    # Strip trailing whitespace but preserve empty lines as content
    lines = [l.rstrip() for l in lines]

    if not has_text_cast:
        # All lines are options (question is shown as image)
        return None, [l for l in lines if l]
    else:
        # Line 1 is question, rest are options
        question = lines[0] if lines else ""
        options = [l for l in lines[1:] if l]
        return question, options


def read_explanation(txte_dir, number):
    """Read txtequestions/K.txt and return text."""
    fpath = txte_dir / f"{number}.txt"
    if not fpath.exists():
        return None
    try:
        return fpath.read_text(encoding="utf-8").strip()
    except Exception:
        return None


def map_type(type_raw):
    """Map numeric type to string."""
    return {1: "image", 2: "text", 3: "text", 4: "text"}.get(type_raw, "text")


def main():
    # Load bmpquestions mapping
    bmp_rows = read_csv(BASE / "assets" / "images" / "Members.csv")
    name_to_file = build_name_to_file(bmp_rows)

    # Load txtequestions Members.csv for each language
    lang_name_to_number = {}
    for lang in LANGUAGES:
        txte_members = IMPORT_DIR / lang / "txtequestions" / "Members.csv"
        if txte_members.exists():
            rows = read_csv(txte_members)
            lang_name_to_number[lang] = build_name_to_number(rows)
        else:
            lang_name_to_number[lang] = {}

    # Build xmlequestions ID maps for each language (fragenummer -> file path)
    lang_xmle_id_map = {}
    for lang in LANGUAGES:
        lang_xmle_id_map[lang] = build_xmle_id_map(lang)

    questions = []

    xml_dir = IMPORT_DIR / "de" / "xmlquestions"
    xml_files = sorted(
        [f for f in xml_dir.iterdir() if f.suffix == ".txt" and f.name != "Members.csv"],
        key=lambda f: int(f.stem),
    )

    for q_file in xml_files:
        idx = int(q_file.stem)
        q_data = parse_xml_question(q_file)
        if q_data is None:
            warn(f"Could not parse xmlquestions/{q_file.name}")
            continue

        type_str = map_type(q_data["type_raw"])
        has_text_cast = q_data["hasTextCast"]

        # Resolve question image (shared across languages)
        question_image = resolve_image(q_data["questionImageRef"], name_to_file)

        # Read German xmlequestions for official flag (primary source)
        frage_id = int(q_data["frageId"]) if q_data.get("frageId") else None
        xmle_path_de = lang_xmle_id_map["de"].get(frage_id) if frage_id else None
        official = False
        if xmle_path_de is not None:
            _, official, _ = parse_xmlexplanation(xmle_path_de)

        # Build base answer objects from xmlquestions (structural: index, correct, image)
        base_answers = []
        for raw_ans in q_data["answers_raw"]:
            ans_num = int(raw_ans.get("number", "0"))
            base_answers.append({
                "index": ans_num,
                "correct": raw_ans.get("validity") == "1",
                "image": resolve_image(raw_ans.get("image"), name_to_file),
            })

        # Build translations
        translations = {}
        for lang in LANGUAGES:
            txt_path = IMPORT_DIR / lang / "txtquestions" / f"{idx}.txt"
            if not txt_path.exists():
                translations[lang] = None
                continue

            question_text, options = read_txtquestion(txt_path, has_text_cast)

            # Read language-specific xmlequestions for paragraph, hidden, textRef
            xmle_path = lang_xmle_id_map[lang].get(frage_id) if frage_id else None
            xmle_answers = []
            official = False
            if xmle_path is not None:
                xmle_answers, official, _ = parse_xmlexplanation(xmle_path)
            else:
                warn(f"No xmlequestions found for {lang}/xmlequestions/{idx}.txt")

            # Merge xmlequestions data into base answers by number/position
            xmle_by_number = {a["number"]: a for a in xmle_answers}
            used_xmle_indices = set()
            answer_map = []

            for base_ans in base_answers:
                ans_num = base_ans["index"]
                xmle = xmle_by_number.get(ans_num)
                if xmle is not None:
                    answer_map.append((base_ans, xmle))
                    used_xmle_indices.add(xmle_answers.index(xmle))
                else:
                    answer_map.append((base_ans, None))

            # Fallback: match by position for number mismatches
            unused_xmle = [a for i, a in enumerate(xmle_answers) if i not in used_xmle_indices]
            unused_xmle_pos = 0
            for i, (base_ans, xmle) in enumerate(answer_map):
                if xmle is not None:
                    continue
                if unused_xmle_pos < len(unused_xmle):
                    xmle = unused_xmle[unused_xmle_pos]
                    unused_xmle_pos += 1
                    answer_map[i] = (base_ans, xmle)
                    warn(f"Q{idx} ({lang}) answer {base_ans['index']}: number mismatch, matched by position to xmle answer {xmle['number']}")
                else:
                    warn(f"Q{idx} ({lang}) answer {base_ans['index']}: no matching xmlequestions answer")

            # Build answers with language-specific paragraph, hidden, textRef
            answers = []
            for base_ans, xmle in answer_map:
                ans_obj = dict(base_ans)
                ans_obj["paragraph"] = xmle.get("paragraph", "") if xmle else ""
                ans_obj["hidden"] = xmle.get("hidden", False) if xmle else False
                ans_obj["_textRef"] = xmle.get("textRef", "") if xmle else ""
                answers.append(ans_obj)

            # Resolve explanations from language-specific txtequestions
            explanations = {}
            txte_dir = IMPORT_DIR / lang / "txtequestions"
            for ans in answers:
                para = ans["paragraph"]
                if not para:
                    continue
                text_ref = ans.get("_textRef", "")
                if not text_ref:
                    continue
                file_num = lang_name_to_number.get(lang, {}).get(text_ref)
                if file_num is None:
                    warn(f"Q{idx} ({lang}) textRef '{text_ref}' not found in {lang}/txtequestions/Members.csv")
                    continue
                expl = read_explanation(txte_dir, file_num)
                if expl is not None:
                    explanations[para] = expl

            translations[lang] = {
                "question": question_text if question_text else None,
                "options": options if options else [],
                "explanations": explanations if explanations else {},
            }

        # Strip internal _textRef from final answers
        clean_answers = [{k: v for k, v in a.items() if not k.startswith("_")} for a in answers]

        question_obj = {
            "id": idx,
            "originalId": q_data["frageId"],
            "type": type_str,
            "category": q_data["category"],
            "official": official,
            "questionImage": question_image,
            "answers": clean_answers,
            "translations": translations,
        }
        questions.append(question_obj)

    output = {
        "questions": questions,
        "meta": {
            "totalQuestions": len(questions),
            "languages": LANGUAGES,
            "exportedFrom": "DirectorCastRipper_D12",
            "notes": [
                "Answers are keyed by paragraph label (a, b, c, d...).",
                "Multiple answers can be correct (correct: true on more than one).",
                "Image-type questions (type=image) have image filenames in answers[].image.",
                "Text-type questions (type=text) may have a questionImage (diagram/sign).",
                "Missing translations are null.",
            ],
        },
    }

    out_path = BASE / "assets" / "questions.json"
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Wrote {out_path} ({out_path.stat().st_size:,} bytes)")
    print(f"Total questions: {len(questions)}")
    if warnings:
        print(f"Warnings ({len(warnings)}):")
        for w in warnings[:20]:
            print(f"  - {w}")
        if len(warnings) > 20:
            print(f"  ... and {len(warnings) - 20} more")
    else:
        print("No warnings.")


if __name__ == "__main__":
    main()
