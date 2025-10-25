import requests
import re
from bs4 import BeautifulSoup

def get_courses(url, i):
    urli = url + "/" + str(i)
    resp = requests.get(urli)
    resp.raise_for_status()
    
    soup = BeautifulSoup(resp.text, 'html.parser')

    course_items = soup.find_all('li')
    courses = []

    for li in course_items:
        text = li.get_text(separator=' ').strip()
        text = re.sub(r'\s+', ' ', text)
        if re.match(r'^[A-Z]{3,} [A-Z]+ \d+', text):
            
            school, department, number = text.split( )[:3]
            
            courses.append(f"{url}/{school.lower()}-{department.lower()}-{number.removesuffix(":")}")
            
    return courses

urls = [
    "https://www.bu.edu/academics/cas/courses",
    "https://www.bu.edu/academics/khc/courses",
    "https://www.bu.edu/academics/camed/courses",
    "https://www.bu.edu/academics/com/courses",
    "https://www.bu.edu/academics/eng/courses",
    "https://www.bu.edu/academics/cfa/courses",
    "https://www.bu.edu/academics/cgs/courses",
    "https://www.bu.edu/academics/cds/courses",
    "https://www.bu.edu/academics/gms/courses",
    "https://www.bu.edu/academics/grs/courses",
    "https://www.bu.edu/academics/sdm/courses",
    "https://www.bu.edu/academics/met/courses",
    "https://www.bu.edu/academics/questrom/courses",
    "https://www.bu.edu/academics/sar/courses",
    "https://www.bu.edu/academics/sha/courses",
    "https://www.bu.edu/academics/law/courses",
    "https://www.bu.edu/academics/sph/courses",
    "https://www.bu.edu/academics/ssw/courses",
    "https://www.bu.edu/academics/sth/courses",
    "https://www.bu.edu/academics/wheelock/courses",
]

for url in urls:
    for i in range(1, 1000):
        courses = get_courses(url, i)
        
        if len(courses) == 0:
            break
        
        print("\n".join(courses), end="\n")

