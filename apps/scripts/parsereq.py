import json
import re
import os
from tqdm import tqdm  # pip install tqdm

def extract_hub_areas(text):
    """
    Extracts BU Hub areas from the course description.
    Handles both:
    - '... fulfills a single unit in each of the following BU Hub areas: X, Y, Z.'
    - '... fulfills a single unit in the following BU Hub area: Quantitative Reasoning II.'
    """
    if not text:
        return []

    match = re.search(r"BU Hub areas?: (.+?)(?:\.|$)", text)
    if not match:
        return []

    hubs_text = match.group(1)
    hubs = [h.strip(" .") for h in re.split(r",|and", hubs_text) if h.strip()]
    return hubs


if __name__ == "__main__":
    # Locate JSON file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, "class_offerings.json")
    output_path = os.path.join(script_dir, "hubs.json")

    if not os.path.exists(input_path):
        print(f"❌ Error: Could not find {input_path}")
        exit(1)

    # Load JSON
    with open(input_path, "r") as f:
        courses = json.load(f)

    hubs_dict = {}

    # Use tqdm progress bar
    for code in tqdm(courses, desc="Extracting Hub Areas", unit="course"):
        desc = courses[code].get("description", "")
        hubs = extract_hub_areas(desc)
        hubs_dict[code] = hubs

    # Save output
    with open(output_path, "w") as f:
        json.dump(hubs_dict, f, indent=2)

    print(f"\n✅ Hub areas extracted for {len(hubs_dict)} courses.")
    print(f"📁 Saved to: {output_path}")
