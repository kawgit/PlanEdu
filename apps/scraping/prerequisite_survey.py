import json
import random
import os
import threading
from typing import List, Set
from google import genai
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- Configuration ---
# You can adjust this number based on your API rate limits and machine's capability
MAX_WORKERS = 10 
# --- End Configuration ---

# Initialize the Gemini client once. It is designed to be thread-safe.
try:
    client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))
    if not os.environ.get('GEMINI_API_KEY'):
        print("Warning: GEMINI_API_KEY environment variable not set.")
except Exception as e:
    print(f"Failed to initialize Gemini client: {e}")
    client = None

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
    if not client:
        print(f"Skipping {class_code} due to client initialization failure.")
        return []
        
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
        # Note: Using a specific model. Adjust if "gemini-2.0-flash" is not what you intend.
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
        # This print will appear in the console from the worker thread
        print(f"Error processing {class_code} in thread: {e}")
        # Re-raise the exception so the main thread's 'as_completed' loop can catch it
        raise

def main():
    if not client:
        print("Exiting: Gemini client is not initialized.")
        return

    # Load class data
    data_path = '/Volumes/Case-Sensitive/Projects/PlanEdu/apps/scraping/data/class_data.json'
    print("Loading class data...")
    try:
        classes = load_class_data(data_path)
    except FileNotFoundError:
        print(f"Error: Data file not found at {data_path}")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {data_path}")
        return
        
    print(f"Total classes available: {len(classes)}")
    
    # Sample 500 random classes
    sample_size = min(50000, len(classes))
    sampled_classes = random.sample(classes, sample_size)
    print(f"Analyzing {sample_size} randomly sampled classes using up to {MAX_WORKERS} threads...\n")
    
    # Track results
    all_groups: Set[str] = set()
    classes_with_groups = 0
    
    # A lock is crucial to prevent race conditions when updating shared variables
    # from multiple threads.
    results_lock = threading.Lock()
    
    # Use ThreadPoolExecutor to manage a pool of threads
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Create a dictionary to map future objects back to their class code
        # This helps in logging when results come in
        futures = {}
        
        print(f"Submitting {sample_size} tasks to the thread pool...")
        
        for class_info in sampled_classes:
            class_code = f"{class_info['school']} {class_info['department']} {class_info['number']}"
            description = class_info.get('description', '')
            
            if not description:
                print(f"  -> Skipping {class_code} (no description)")
                continue
            
            # Submit the task to the executor.
            # It will run 'extract_prerequisite_groups' in a separate thread.
            future = executor.submit(extract_prerequisite_groups, description, class_code)
            futures[future] = class_code

        total_tasks = len(futures)
        print(f"Tasks submitted. Waiting for results...\n")

        # as_completed yields futures as they finish, allowing for real-time processing
        for i, future in enumerate(as_completed(futures), 1):
            class_code = futures[future]
            
            try:
                # Get the result from the completed future
                groups = future.result()
                
                # --- CRITICAL SECTION ---
                # Use the lock to safely modify the shared result variables
                with results_lock:
                    if groups:
                        classes_with_groups += 1
                        print(f"[{i}/{total_tasks}] SUCCESS: {class_code} -> Found {len(groups)} group(s):")
                        for group in groups:
                            print(f"     - {group}")
                            all_groups.add(group)
                    else:
                        print(f"[{i}/{total_tasks}] SUCCESS: {class_code} -> No groups found")
                # --- END CRITICAL SECTION ---
                
            except Exception as e:
                # This catches exceptions raised from within the thread
                print(f"[{i}/{total_tasks}] ERROR processing {class_code}: {e}")
            
            print() # Add a newline for readability

    # Print final results
    # No lock needed here, as all threads are finished
    print("\n" + "="*80)
    print("FINAL RESULTS")
    print("="*80)
    print(f"\nTotal classes analyzed: {sample_size}")
    print(f"Classes with group prerequisites: {classes_with_groups}")
    if sample_size > 0:
        print(f"Percentage: {(classes_with_groups / sample_size * 100):.2f}%")
    else:
        print("Percentage: N/A (no classes analyzed)")
    print(f"\nUnique prerequisite groups found: {len(all_groups)}")
    print("\nFull list of prerequisite groups:")
    print("-" * 80)
    if all_groups:
        for i, group in enumerate(sorted(all_groups), 1):
            print(f"{i}. {group}")
    else:
        print("No unique groups were found.")
    print("="*80)

if __name__ == "__main__":
    main()
    
"""
================================================================================
FINAL RESULTS
================================================================================

Total classes analyzed: 4649
Classes with group prerequisites: 104
Percentage: 2.24%

Unique prerequisite groups found: 65

Full list of prerequisite groups:
--------------------------------------------------------------------------------
1. 1 semester of physics
2. 1 semester of statistics
3. 100- or 200-level course in either sociology or women's, gender, & sexuality
4. 100-level PO course
5. 1st Year Writing Seminar
6. 2 semesters of calculus
7. 300-level Greek seminar or equivalent
8. 300-level Latin seminars or equivalent
9. 300-level PO course
10. 300-level modern Chinese courses
11. 300-level social science courses in CAS
12. 400-level LS course
13. 400-level LS courses
14. 400-level LS literature courses
15. Any 100-level course in Political Science
16. CAS WR 150/1/2/3
17. CASLS 400-level course
18. Firs t-Year Writing
19. First Year Writing Seminar
20. First-Year Writing
21. First-Year Writing Seminar
22. Intro programming course in any language
23. LF 400-level literature course
24. LS 300-level language course
25. LS 400-level literature courses
26. Level 1 Advanced Course
27. Marine Breadth class
28. WGS electives
29. Writing, Research, and Inquiry
30. Writing- Intensive Course
31. Writing-Intensive Course
32. a course in neuroscience
33. all licensure courses
34. another microeconomics course
35. any 100-level philosophy course
36. any 300-level Spanish language course
37. any course numbered CAS LG 302-345
38. any course numbered LG302-350
39. any one philosophy course from CASPH 450-457
40. archaeological studies courses at the 200 level or above
41. at least one course on art or literature in Europe/US 1300-1750 or 1750-present
42. at least two previous sociology courses
43. equivalent programming experience
44. equivalent statistics course
45. familiarity with calculus
46. first-year writing seminar
47. international economics class
48. knowledge of stochastic processes
49. literature course
50. one additional biological anthropology course
51. one other LF course at the 300-level
52. one previous literature course
53. one upper level NE course
54. other high-level production classes
55. other intro to prog ramming
56. other intro to statistics
57. physiological psychology
58. previous coursework in natural sciences
59. previous coursework in social sciences
60. two courses in classical civilization
61. two courses in philosophy above the 100 level
62. two literature courses
63. two other philosophy courses
64. two previous PH courses
65. two previous literature courses
===============================================================================
"""