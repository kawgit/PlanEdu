import json
import random
import os
from typing import List, Set
from google import genai

client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

def load_class_data(filepath: str) -> List[dict]:
    """Load class data from JSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)

def extract_prerequisite_groups(description: str, class_code: str) -> List[str]:
    """
    Use Gemini to identify if the prerequisite requirements mention groups of classes.
    
    Args:
        description: The class description containing prerequisite information
        class_code: The class code for logging purposes
        
    Returns:
        List of prerequisite group names found
    """
    prompt = f"""Analyze the following course description and identify if the prerequisite requirements mention any GROUP of classes rather than specific individual courses.

Examples of groups include:
- "300 level Greek course"
- "writing intensive course"
- "200-level history course"
- "introductory programming course"
- "any calculus course"
- "upper-level elective"

IMPORTANT: Only identify REQUIRED prerequisites. Ignore any recommendations or suggested courses.

Course Description:
{description}

If the description mentions one or more groups of classes in the REQUIRED prerequisites section, list them clearly. If there are no such groups mentioned (only specific course codes or no prerequisites), respond with "NONE".

Output format:
- If groups found: List each group on a new line, starting with "GROUP:"
- If no groups found: Just output "NONE"

Example output if groups are found:
GROUP: 300 level Greek course
GROUP: writing intensive course

Example output if no groups are found:
NONE"""

    try:
        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        response_text = response.text.strip()
        
        # Parse the response
        groups = []
        if response_text != "NONE":
            lines = response_text.split('\n')
            for line in lines:
                if line.strip().startswith("GROUP:"):
                    group_name = line.replace("GROUP:", "").strip()
                    if group_name:
                        groups.append(group_name)
        
        return groups
    except Exception as e:
        print(f"Error processing {class_code}: {e}")
        return []

def main():
    # Load class data
    data_path = '/Volumes/Case-Sensitive/Projects/PlanEdu/apps/scraping/data/class_data.json'
    print("Loading class data...")
    classes = load_class_data(data_path)
    print(f"Total classes available: {len(classes)}")
    
    # Sample 500 random classes
    sample_size = min(500, len(classes))
    sampled_classes = random.sample(classes, sample_size)
    print(f"Analyzing {sample_size} randomly sampled classes...\n")
    
    # Track results
    all_groups: Set[str] = set()
    classes_with_groups = 0
    
    # Process each class
    for i, class_info in enumerate(sampled_classes, 1):
        class_code = f"{class_info['school']} {class_info['department']} {class_info['number']}"
        description = class_info.get('description', '')
        
        print(f"[{i}/{sample_size}] Processing {class_code}...")
        
        if not description:
            print(f"  -> No description available")
            continue
        
        # Get groups from Gemini
        groups = extract_prerequisite_groups(description, class_code)
        
        if groups:
            classes_with_groups += 1
            print(f"  -> Found {len(groups)} group(s):")
            for group in groups:
                print(f"     - {group}")
                all_groups.add(group)
        else:
            print(f"  -> No groups found")
        
        print()
    
    # Print final results
    print("\n" + "="*80)
    print("FINAL RESULTS")
    print("="*80)
    print(f"\nTotal classes analyzed: {sample_size}")
    print(f"Classes with group prerequisites: {classes_with_groups}")
    print(f"Percentage: {(classes_with_groups / sample_size * 100):.2f}%")
    print(f"\nUnique prerequisite groups found: {len(all_groups)}")
    print("\nFull list of prerequisite groups:")
    print("-" * 80)
    for i, group in enumerate(sorted(all_groups), 1):
        print(f"{i}. {group}")
    print("="*80)

if __name__ == "__main__":
    main()


"""

================================================================================
FINAL RESULTS
================================================================================

Total classes analyzed: 500
Classes with group prerequisites: 9
Percentage: 1.80%

Unique prerequisite groups found: 12

Full list of prerequisite groups:
--------------------------------------------------------------------------------
1. 1 semester of physics
2. 1 semester of statistics
3. 1st Year Writing Seminar
4. 2 semesters of calculus
5. First Year Writing Seminar
6. First-Year Writing Seminar
7. Writing- Intensive Course
8. advanced beginning level dance techniques
9. all licensure courses
10. archaeological studies courses at the 200 level or above
11. first-year writing seminar
12. literature courses
================================================================================

"""