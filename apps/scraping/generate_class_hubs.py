import json
import random
import os
import threading
from typing import List, Dict
from google import genai
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- Configuration ---
MAX_WORKERS = 10
OUTPUT_PATH = "data/hub_to_classes.json"
# --- End Configuration ---

# Full list of BU Hub requirement names
HUB_AREAS = [
    "Philosophical Inquiry and Life's Meanings",
    "Aesthetic Exploration",
    "Historical Consciousness",
    "Scientific Inquiry I",
    "Scientific Inquiry II",
    "Social Inquiry I",
    "Social Inquiry II",
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

# Initialize Gemini client
try:
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    if not os.environ.get("GEMINI_API_KEY"):
        print("Warning: GEMINI_API_KEY environment variable not set.")
except Exception as e:
    print(f"Failed to initialize Gemini client: {e}")
    client = None

def load_class_data(filepath: str):
    with open(filepath, "r") as f:
        return json.load(f)

def identify_hubs(description: str, class_code: str) -> List[str]:
    """Use Gemini to identify which BU Hub areas are fulfilled by a given course."""
    if not client:
        print(f"Skipping {class_code}: Gemini client not initialized.")
        return []

    prompt = f"""
The following is a Boston University course description. Determine which of the following BU Hub areas it fulfills. Only assume a hub area applies if it is explicitly says so in the course description. There must be some statement along the lines of "Hub areas fulfilled: [list of hub areas]" in the course description.

Possible Hub areas:
{json.dumps(HUB_AREAS, indent=2)}

Course Description:
{description}

Return ONLY the names of the Hub areas from the list above that this course fulfills, one per line. 
If none are mentioned, output "NONE".
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        text = response.text.strip()
        if text == "NONE":
            return []
        hubs = [line.strip() for line in text.split("\n") if line.strip() in HUB_AREAS]
        return hubs
    except Exception as e:
        print(f"Error processing {class_code}: {e}")
        return []

def main():
    if not client:
        print("Exiting: Gemini client is not initialized.")
        return

    data_path = "/Volumes/Case-Sensitive/Projects/PlanEdu/apps/scraping/data/class_data.json"
    try:
        classes = load_class_data(data_path)
    except FileNotFoundError:
        print(f"Error: Data file not found at {data_path}")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON at {data_path}")
        return

    print(f"Loaded {len(classes)} classes.")

    sample_size = min(100000, len(classes))
    sampled_classes = random.sample(classes, sample_size)
    print(f"Analyzing {sample_size} classes with {MAX_WORKERS} threads...\n")

    # Map: hub_name -> list of course codes
    hub_to_classes: Dict[str, List[str]] = {hub: [] for hub in HUB_AREAS}
    lock = threading.Lock()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {}
        for class_info in sampled_classes:
            class_code = class_info['url']
            # class_code = f"{class_info['school']} {class_info['department']} {class_info['number']}"
            description = class_info.get("description", "")
            if not description:
                continue
            futures[executor.submit(identify_hubs, description, class_code)] = class_code

        total = len(futures)
        for i, future in enumerate(as_completed(futures), 1):
            class_code = futures[future]
            try:
                hubs = future.result()
                with lock:
                    if hubs:
                        for hub in hubs:
                            hub_to_classes[hub].append(class_code)
                        print(f"[{i}/{total}] {class_code}: Found hubs {hubs}")
                    else:
                        print(f"[{i}/{total}] {class_code}: No hubs found")
            except Exception as e:
                print(f"[{i}/{total}] ERROR {class_code}: {e}")

    # Filter out empty lists
    hub_to_classes = {hub: codes for hub, codes in hub_to_classes.items() if codes}

    # Save to JSON
    with open(OUTPUT_PATH, "w") as f:
        json.dump(hub_to_classes, f, indent=2)

    print(f"\n✅ Saved hub mapping to {OUTPUT_PATH}")
    print(f"Non-empty hub categories: {len(hub_to_classes)}")

if __name__ == "__main__":
    main()
