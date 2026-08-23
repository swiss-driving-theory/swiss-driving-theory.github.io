#!/usr/bin/env python3
"""Import new questions from Roadly.json into assets/questions.json."""

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
ROADLY_PATH = BASE / "import" / "Roadly.json"
QUESTIONS_PATH = BASE / "assets" / "questions.json"
IMAGES_DIR = BASE / "assets" / "images"

LANG_MAP = {"1": "de", "2": "fr", "3": "it"}

IGNORE_TAGS = {"Prüfungstipp", "Neue Fragen", "Neue Fragen Juli 2025", "Alle Graphik-Fragen"}

CATEGORY_MAP = {
    "Technik": 1,
    "Fahrassistenz-Systeme": 1,
    "Fahrzeugzustand": 1,
    "Betriebssicherheit": 1,
    "Fahrzeugausweis": 1,
    "Sicherheitsgurte": 1,
    "Zustand Fahrer": 1,
    "Umwelt": 1,
    "Signale": 2,
    "Strassenmarkierung": 2,
    "Richtungsanzeiger": 2,
    "Signale / Zusatztafeln": 2,
    "Busstreifen": 2,
    "Lichtsignal": 3,
    "Beleuchtung / Licht": 3,
    "Pannensignal": 3,
    "Verkehrsregelung Polizei usw.": 3,
    "Überholen": 4,
    "Einspuren": 4,
    "Rückwärtsfahren": 4,
    "Autobahn": 5,
    "Tunnel": 5,
    "Vortritt / Signale": 6,
    "Vortritt / Besonderes": 6,
    "Vortritt / Allgemein": 6,
    "Vortritt / Grundsätze": 6,
    "Vortritt / Grundsatz": 6,
    "Kreisverkehr": 6,
    "Parkieren + Halten": 7,
    "Anhalten": 7,
    "Geschwindigkeit": 8,
    "Anhaltestrecke": 8,
    "Bremsweg": 8,
    "Gefahrensituation": 9,
    "Verhalten": 9,
    "Strassenverhältnisse": 9,
    "Kreuzen": 9,
    "Fussgänger": 10,
    "Fussgängerstreifen": 10,
    "Kinder": 10,
    "Radstreifen + Radweg": 10,
    "Polizei / Ambulanz": 10,
    "Bus / Tram": 10,
    "Lernfahrer": 10,
    "Panne": 12,
    "Abschleppen": 12,
    "Verhalten bei Unfällen": 12,
    "Sicht / Beleuchtung": 11,
    "Unfall": 12,
    "Notfall": 12,
}


def parse_roadly(path):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    wrapped = "[" + text.strip() + "]"
    return json.loads(wrapped)


def download_image(url, dest_path):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp, open(dest_path, "wb") as out:
            out.write(resp.read())
        return True
    except Exception as e:
        print(f"  WARNING: Failed to download {url}: {e}")
        return False


def transform_question(roadly_q, new_id):
    ref = roadly_q.get("reference") or str(roadly_q.get("id", ""))
    image_url = roadly_q.get("image")
    local_image = None
    if image_url:
        ext = Path(image_url).suffix or ".jpg"
        dest = IMAGES_DIR / f"{ref}{ext}"
        if not dest.exists():
            if download_image(image_url, dest):
                local_image = f"assets/images/{ref}{ext}"
        else:
            local_image = f"assets/images/{ref}{ext}"

    answers = []
    answer_texts = {}
    for idx, ans in enumerate(roadly_q.get("answers", []), start=1):
        para = chr(ord("a") + idx - 1)
        answers.append({
            "index": idx,
            "correct": bool(ans.get("correct", False)),
            "image": None,
            "paragraph": para,
            "hidden": False,
        })
        answer_texts[para] = {}
        for src_key, locale in LANG_MAP.items():
            text = (ans.get("translations", {}).get(src_key) or "").strip()
            answer_texts[para][locale] = text

    translations = {}
    info_button = roadly_q.get("info-button") or {}
    for src_key, locale in LANG_MAP.items():
        q_text = (roadly_q.get("translations", {}).get(src_key) or "").strip()
        explanation = ""
        if isinstance(info_button, dict):
            explanation = (info_button.get(src_key) or "").strip()
        options = [answer_texts[para][locale] for para in sorted(answer_texts) if answer_texts[para].get(locale)]
        translations[locale] = {
            "question": q_text,
            "options": options,
            "explanations": {},
            "questionExplanation": explanation if explanation else None,
        }

    tag_names = [t["name"] for t in roadly_q.get("tags", []) if t.get("name") and t["name"] not in IGNORE_TAGS]
    category = 1
    for name in tag_names:
        if name in CATEGORY_MAP:
            category = CATEGORY_MAP[name]
            break

    return {
        "id": new_id,
        "originalId": str(ref),
        "type": "text",
        "category": category,
        "official": bool(ref),
        "questionImage": local_image,
        "answers": answers,
        "translations": translations,
    }


def main():
    dry_run = "--dry-run" in sys.argv
    skip_images = "--skip-images" in sys.argv

    roadly = parse_roadly(ROADLY_PATH)
    with open(QUESTIONS_PATH, encoding="utf-8") as f:
        questions_data = json.load(f)

    existing = questions_data.get("questions", [])
    existing_by_ref = {str(q.get("originalId", "")): q for q in existing}
    max_id = max((q.get("id", 0) for q in existing), default=0)

    new_questions = []
    updated_count = 0
    added_count = 0
    skipped_count = 0
    warnings = []

    next_id = max_id + 1
    for rq in roadly:
        ref = rq.get("reference") or str(rq.get("id", ""))
        if not ref:
            warnings.append(f"Roadly question id={rq.get('id')} has no reference, skipping")
            skipped_count += 1
            continue

        if ref in existing_by_ref:
            eq = existing_by_ref[ref]
            if eq.get("type") == "image":
                skipped_count += 1
                continue
            transformed = transform_question(rq, eq["id"])
            eq["type"] = eq["type"]
            eq["category"] = transformed["category"]
            eq["official"] = transformed["official"]
            eq["questionImage"] = transformed["questionImage"]
            eq["answers"] = transformed["answers"]
            for lang in LANG_MAP.values():
                et = eq["translations"].setdefault(lang, {})
                nt = transformed["translations"].get(lang, {})
                if nt.get("question"):
                    et["question"] = nt["question"]
                if nt.get("options"):
                    et["options"] = nt["options"]
                if nt.get("questionExplanation") and not et.get("questionExplanation"):
                    et["questionExplanation"] = nt["questionExplanation"]
            updated_count += 1
        else:
            transformed = transform_question(rq, next_id)
            new_questions.append(transformed)
            added_count += 1
            next_id += 1

    if dry_run:
        print(f"DRY RUN")
        print(f"  Would add:    {added_count}")
        print(f"  Would update: {updated_count}")
        print(f"  Skipped:      {skipped_count}")
        print(f"  New total:    {len(existing) + added_count}")
        if warnings:
            print(f"Warnings ({len(warnings)}):")
            for w in warnings[:20]:
                print(f"  - {w}")
        return

    existing.extend(new_questions)
    questions_data["questions"] = existing

    with open(QUESTIONS_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(questions_data, f, ensure_ascii=False, indent=2)

    print(f"Updated {QUESTIONS_PATH}")
    print(f"  Added:    {added_count}")
    print(f"  Updated:  {updated_count}")
    print(f"  Skipped:  {skipped_count}")
    print(f"  Total:    {len(existing)}")
    if warnings:
        print(f"Warnings ({len(warnings)}):")
        for w in warnings[:20]:
            print(f"  - {w}")


if __name__ == "__main__":
    main()
