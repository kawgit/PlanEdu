import requests
import re
import json
from bs4 import BeautifulSoup
from tqdm import tqdm

def get_courses(url, i):
    urli = f"{url}/{i}"
    try:
        resp = requests.get(urli, timeout=10)
        resp.raise_for_status()
    except requests.RequestException:
        return []

    soup = BeautifulSoup(resp.text, 'html.parser')
    course_items = soup.find_all('li')
    courses = []

    for li in course_items:
        text = li.get_text(separator=' ').strip()
        text = re.sub(r'\s+', ' ', text)
        if re.match(r'^[A-Z]{3,} [A-Z]+ \d+', text):
            school, department, number = text.lower().split()[:3]
            number = number.removesuffix(":")
            course_url = f"{url}/{school}-{department}-{number}"
            courses.append(course_url)

    return courses


def main(output_file="data/class_urls.json"):
    urls = [
        "https://www.bu.edu/academics/cas/courses",
        "https://www.bu.edu/academics/khc/courses",
        "https://www.bu.edu/academics/com/courses",
        "https://www.bu.edu/academics/eng/courses",
        "https://www.bu.edu/academics/cfa/courses",
        "https://www.bu.edu/academics/cgs/courses",
        "https://www.bu.edu/academics/cds/courses",
        "https://www.bu.edu/academics/questrom/courses",
        "https://www.bu.edu/academics/sar/courses",
        "https://www.bu.edu/academics/sha/courses",
    ]

    all_courses = set()

    for url in tqdm(urls, desc="Schools", position=0):
        for i in tqdm(range(1, 1000), desc=f"Pages ({url.split('/')[-2]})", leave=False, position=1):
            courses = get_courses(url, i)
            if not courses:
                break
            all_courses.update(courses)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(sorted(all_courses), f, indent=2)

    print(f"\n✅ Saved {len(all_courses)} unique course URLs to {output_file}")


if __name__ == "__main__":
    main()
