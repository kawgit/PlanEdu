import argparse
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional

from google import genai

JSON_BLOCK_RE = re.compile(r"(?s)(\{.*\}|null)")

def build_course_id(s: str, d: str, n: str) -> str:
    return f"{s} {d} {n}"

def extract_json_text(raw: str) -> Optional[str]:
    if not raw:
        return None
    raw = raw.strip()
    if raw == "null":
        return "null"
    if raw.startswith("{") and raw.endswith("}"):
        return raw
    m = JSON_BLOCK_RE.search(raw)
    return m.group(1).strip() if m else None

def parse_model_json(raw: str) -> Optional[Any]:
    t = extract_json_text(raw)
    if t is None or t == "null":
        return None
    try:
        return json.loads(t)
    except Exception:
        return None

def main():
    p = argparse.ArgumentParser(description="Extract prerequisite trees (simple).")
    p.add_argument("--input", required=True, help="Path to input courses JSON (array).")
    p.add_argument("--output", required=True, help="Path to output JSON (dict).")
    p.add_argument("--max-workers", type=int, default=8, help="Thread pool size.")
    p.add_argument("--model", default="gemini-2.0-flash", help="Gemini model name.")
    p.add_argument("--prompt", default="prereq_prompt.md", help="Path to prompt file.")
    args = p.parse_args()

    # Client
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set.", file=sys.stderr)
        sys.exit(1)
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"ERROR: Failed to init genai client: {e}", file=sys.stderr)
        sys.exit(1)

    # Load data
    try:
        with open(args.input, "r", encoding="utf-8") as f:
            courses = json.load(f)
        if not isinstance(courses, list):
            raise ValueError("Input must be a JSON array of course dicts.")
    except Exception as e:
        print(f"ERROR: reading input: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        PREREQ_PROMPT_TEMPLATE = open(args.prompt, "r", encoding="utf-8").read()
    except Exception as e:
        print(f"ERROR: reading prompt file: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(courses)} courses. Model: {args.model}. Workers: {args.max_workers}")

    output_map = {}

    def run_one(course: dict) -> Optional[tuple]:
        desc = course.get("description") or ""
        if not desc:
            return None
        class_id = build_course_id(course["school"], course["department"], course["number"])

        # Simple placeholder replacement. We don't use .format() to avoid brace issues.
        prompt = PREREQ_PROMPT_TEMPLATE
        prompt = prompt.replace("CLASS_NAME", class_id)
        prompt = prompt.replace("CLASS_DESCRIPTION", desc)

        try:
            resp = client.models.generate_content(model=args.model, contents=prompt)
            raw = (getattr(resp, "text", None) or "").strip()
            tree = parse_model_json(raw)
            if tree is None:
                return None
            return (class_id, tree)
        except Exception as e:
            print(f"[WARN] {class_id}: {e}", file=sys.stderr)
            return None

    with ThreadPoolExecutor(max_workers=args.max_workers) as ex:
        futures = {ex.submit(run_one, c): c for c in courses}
        total = len(futures)
        for i, fut in enumerate(as_completed(futures), 1):
            c = futures[fut]
            cid = build_course_id(c["school"], c["department"], c["number"])
            try:
                res = fut.result()
                if res:
                    k, v = res
                    output_map[k] = v
                    print(f"[{i}/{total}] ✅ {cid}")
                else:
                    print(f"[{i}/{total}] ␀  {cid}")
            except Exception as e:
                print(f"[{i}/{total}] ERROR {cid}: {e}", file=sys.stderr)

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_map, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"ERROR: writing output: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"\n✅ Saved prerequisites for {len(output_map)} courses to {args.output}")

if __name__ == "__main__":
    main()
