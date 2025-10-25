import json
import re
import os
from tqdm import tqdm  # pip install tqdm

# ✅ Official BU Hub Areas (exactly as defined by you)
HUBS = [
    "Philosophical Inquiry and Life’s Meanings",
    "Aesthetic Exploration",
    "Historical Consciousness",
    "Social Inquiry I",
    "Social Inquiry II",
    "Scientific Inquiry I",
    "Quantitative Reasoning I",
    "Quantitative Reasoning II",
    "The Individual in Community",
    "Global Citizenship and Intercultural Literacy",
    "Ethical Reasoning",
    "First-Year Writing Seminar",
    "Writing, Research, and Inquiry",
    "Writing-Intensive Course",
    "Oral and/or Signed Communication",
    "Digital/Multimedia Expression",
    "Critical Thinking",
    "Research and Information Literacy",
    "Teamwork/Collaboration",
    "Creativity/Innovation"
]

def extract_hub_areas(text):
    """
    Extracts exact BU Hub areas from a course description.
    Does not split compound names.
    """
    if not text:
        return []

    # Look for “BU Hub area(s): ...”
    match = re.search(r"BU Hub areas?: (.+?)(?:\.|$)", text)
    if not match:
        return []

    hubs_text = match.group(1)
    # Roughly split by commas or "and"
    hubs_found = [h.strip(" .") for h in re.split(r",|and", hubs_text) if h.strip()]

    # Keep only valid ones from HUBS
    hubs_clean = []
    for h in hubs_found:
        for official in HUBS:
            if h.lower() in official.lower():
                hubs_clean.append(official)
                break

    # Remove duplicates and preserve order
    seen = set()
    hubs_final = [x for x in hubs_clean if not (x in seen or seen.add(x))]
    return hubs_final


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, "class_offerings.json")
    output_path = os.path.join(script_dir, "hubs_strict.json")

    if not os.path.exists(input_path):
        print(f"❌ Error: Could not find {input_path}")
        exit(1)

    with open(input_path, "r") as f:
        courses = json.load(f)

    hubs_dict = {}

    for code in tqdm(courses, desc="Extracting Official Hub Areas", unit="course"):
        desc = courses[code].get("description", "")
        hubs = extract_hub_areas(desc)
        hubs_dict[code] = hubs

    with open(output_path, "w") as f:
        json.dump(hubs_dict, f, indent=2)

    print(f"\n✅ Extracted official Hub areas for {len(hubs_dict)} courses.")
    print(f"📁 Saved to: {output_path}")
