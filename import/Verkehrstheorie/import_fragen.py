#!/usr/bin/env python3
"""Import questions from Verkehrstheorie fragen.json into assets/questions.json."""

import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent.parent
FRAGEN_PATH = BASE / "import" / "Verkehrstheorie" / "data" / "fragen.json"
REGELN_PATH = BASE / "import" / "Verkehrstheorie" / "data" / "regeln.json"
QUESTIONS_PATH = BASE / "assets" / "questions.json"

LANG_MAP = {"d": "de", "f": "fr", "i": "it"}


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def extract_category_from_nr(nr):
    match = re.match(r"(\d+)-", str(nr))
    if match:
        return 1000 + int(match.group(1))
    return 1000


def transform_question(frage, regeln_by_nr, original_id_override=None):
    bild = str(frage.get("bild", "")).strip()
    if not bild:
        return None, "empty bild"

    original_id = original_id_override if original_id_override else bild
    question_image = f"assets/images/{bild}.jpg"

    category = extract_category_from_nr(frage.get("nr", ""))

    asa = bool(frage.get("asa", False))
    deleted = bool(frage.get("deleted", False))
    official = asa and not deleted

    answers = []
    answer_texts = {}
    for idx, ans in enumerate(frage.get("antworten", []), start=1):
        richtig = bool(ans.get("richtig", False))
        answers.append({
            "index": idx,
            "correct": richtig,
            "image": None,
            "paragraph": chr(ord("a") + idx - 1),
            "hidden": False,
        })
        para = chr(ord("a") + idx - 1)
        answer_texts[para] = {}
        for src_lang, target_lang in LANG_MAP.items():
            text = (ans.get("text", {}).get(src_lang) or "").strip()
            answer_texts[para][target_lang] = text

    translations = {}
    correct_paras = [para for para, ans in zip(sorted(answer_texts), frage.get("antworten", [])) if bool(ans.get("richtig", False))]
    for src_lang, target_lang in LANG_MAP.items():
        q_text = (frage.get("text", {}).get(src_lang) or "").strip()
        options = [answer_texts[para][target_lang] for para in sorted(answer_texts)]

        question_explanation = ""
        if correct_paras:
            regel_nrs = [r.strip() for r in str(frage.get("regeln", "")).split(";") if r.strip()]
            regel_texts = []
            for rn in regel_nrs:
                rule = regeln_by_nr.get(rn)
                if rule:
                    rule_text = (rule.get("text", {}).get(src_lang) or "").strip()
                    if rule_text:
                        regel_texts.append(rule_text)
            if regel_texts:
                question_explanation = "\n\n".join(regel_texts)

        translations[target_lang] = {
            "question": q_text,
            "options": options,
            "explanations": {},
            "questionExplanation": question_explanation,
        }

    return {
        "originalId": original_id,
        "type": "text",
        "category": category,
        "official": official,
        "questionImage": question_image,
        "answers": answers,
        "translations": translations,
    }, None


def main():
    dry_run = "--dry-run" in sys.argv

    frage_data = load_json(FRAGEN_PATH)
    regeln_data = load_json(REGELN_PATH)
    with open(QUESTIONS_PATH, encoding="utf-8") as f:
        questions_data = json.load(f)

    regeln_by_nr = {}
    for rule in regeln_data:
        nr = str(rule.get("nr", "")).strip()
        if nr:
            regeln_by_nr[nr] = rule

    primary_entries = {}
    extra_entries = []
    official_bilder = set()

    for frage in frage_data:
        bild = str(frage.get("bild", "")).strip()
        if not bild:
            continue

        is_official = bool(frage.get("asa", False)) and not bool(frage.get("deleted", False))

        if bild not in primary_entries:
            primary_entries[bild] = frage
            if is_official:
                official_bilder.add(bild)
        else:
            existing_entry = primary_entries[bild]
            existing_official = bool(existing_entry.get("asa", False)) and not bool(existing_entry.get("deleted", False))
            if is_official and not existing_official:
                extra_entries.append((existing_entry, existing_official))
                primary_entries[bild] = frage
                official_bilder.add(bild)
            else:
                extra_entries.append((frage, is_official))

    existing = questions_data.get("questions", [])
    max_id = max((q.get("id", 0) for q in existing), default=0)
    next_id = max_id + 1

    imported_original_ids = set()
    new_questions = []
    updated_count = 0
    added_count = 0
    skipped_count = 0
    warnings = []

    for frage in list(primary_entries.values()):
        transformed, error = transform_question(frage, regeln_by_nr)
        if error:
            warnings.append(f"Skip frage nr={frage.get('nr')}: {error}")
            skipped_count += 1
            continue

        original_id = transformed["originalId"]
        imported_original_ids.add(original_id)
        transformed["id"] = next_id
        new_questions.append(transformed)
        next_id += 1
        added_count += 1

    official_extra_ids = set()
    for frage, is_official in extra_entries:
        transformed, error = transform_question(frage, regeln_by_nr, original_id_override="0")
        if error:
            warnings.append(f"Skip frage nr={frage.get('nr')}: {error}")
            skipped_count += 1
            continue

        original_id = transformed["originalId"]
        imported_original_ids.add(original_id)
        transformed["id"] = next_id
        if is_official:
            transformed["official"] = True
            official_extra_ids.add(next_id)
        else:
            transformed["official"] = False
        new_questions.append(transformed)
        next_id += 1
        added_count += 1

    filtered_existing = [
        q for q in existing
        if str(q.get("originalId")) not in imported_original_ids
    ]
    updated_count = len(existing) - len(filtered_existing)

    if dry_run:
        print("DRY RUN")
        print(f"  Would add:    {added_count}")
        print(f"  Would update: {updated_count}")
        print(f"  Skipped:      {skipped_count}")
        print(f"  New total:    {len(filtered_existing) + added_count}")
        if warnings:
            print(f"Warnings ({len(warnings)}):")
            for w in warnings[:20]:
                print(f"  - {w}")
        return

    filtered_existing.extend(new_questions)

    for q in filtered_existing:
        q["official"] = False

    for q in new_questions:
        oid = str(q["originalId"])
        if oid != "0" and oid in official_bilder:
            q["official"] = True
        elif q["id"] in official_extra_ids:
            q["official"] = True

    questions_data["questions"] = filtered_existing

    with open(QUESTIONS_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(questions_data, f, ensure_ascii=False, indent=2)

    print(f"Updated {QUESTIONS_PATH}")
    print(f"  Added:    {added_count}")
    print(f"  Updated:  {updated_count}")
    print(f"  Skipped:  {skipped_count}")
    print(f"  Total:    {len(filtered_existing)}")
    if warnings:
        print(f"Warnings ({len(warnings)}):")
        for w in warnings[:20]:
            print(f"  - {w}")


if __name__ == "__main__":
    main()
