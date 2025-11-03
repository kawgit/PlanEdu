# Prerequisite Extraction

You are extracting a prerequisite structure for CLASS_NAME from its class description:

CLASS_DESCRIPTION

Return **only** one JSON value: a single prerequisite tree (see Node System) or `null` if none.

## NODE SYSTEM

* `"and"` node: `{"type":"and","children":[NODE,...]}` — true if all children are true (≥2 children allowed)
* `"or"` node: `{"type":"or","children":[NODE,...]}` — true if any child is true (≥2 children allowed)
* `"not"` node: `{"type":"not","child":NODE}` — true if child is false
* `"when"` node: `{"type":"when","offset":INT,"child":NODE}` (offsets are `0` coreq (same term), `-1` prereq (prev term))
* `"course"` node: `{"type":"course","course_id":"SCHOOL DEPT NUMBER[LETTER]"}` (must include all parts; e.g. `CAS CS 111`)
* `"group"` node: `{"type":"group","group_id":"GROUP_ID","count":1}` — `group_id` must exactly match a known group
* `"range"` node: `{"type":"range","school":"SCHOOL","department":"DEPT","min_number":100,"max_number":199,"count":1}` Represents any course in that department within the number range.
* `"attribute"` node: `{"type":"attribute","key":"standing","values":["junior"]}`

## RULES

1. **Root logic:** commas/semicolons → `and`; top-level “or” → `or`; parentheses create sub-nodes.
2. **Coreq detection:** “Corequisite(s)” or “may be taken concurrently” → wrap in `{"type":"when","offset":0}`.
   “Prerequisite(s)” → offset −1 (default, no wrapper).
3. **Course format:** `SCHOOL DEPT NUMBER[LETTER]`; if school omitted, infer based on department from abbreviations list.
   * `MA 121/123` → `or` of two numbers same dept
   * `PS/NE 212` → `or` of two depts same number
   * Sometimes a class will be specified with the letters for the school and department in the same word
without a space between. For exmaple "CGSDS 301". This should be interpretted as "CGS DS 301" since
the school abbreviation always has 3 letters while the department has two. Course ids in your
response should always use the spaced version "CGS DS 301". If a course is named without a specified
school (e.g. "WR 150"), you should infer it based on the context (often prerequisites for a given
course will be of the same school as the that course). So "WR 150" would be written in your response
as "CAS WR 150".
4. **Groups:** use only IDs in `LIST_OF_GROUP_IDS`; no new IDs.
5. **Ranges:** for “any 100-level DEPT” or “200–400 in MA”, emit `"range"` node.
6. **Attributes:** phrases like “junior standing” → attribute node (key = “standing”).
7. **Negations:** “for beginners only” → `{"type":"not","child":...}`.
8. **Ignore:** “consent of instructor”, “recommended”, etc.
9. **Empty:** if no enforceable requirements → `null`.

## Abbreviations used in course numbers

CAS: College of Arts & Sciences and Graduate School of Arts & Sciences

AA: African American & Black Diaspora Studies
AH: History of Art & Architecture
AI: Asian Studies
AM: American & New England Studies, including Preservation Studies
AN: Anthropology
AR: Archaeology
AS: Astronomy
BB: Biochemistry & Molecular Biology
BI: Biology
CC: Core Curriculum
CG: Modern Greek
CH: Chemistry
CI: Cinema & Media Studies
CL: Classical Studies
CS: Computer Science
EC: Economics
EE: Earth & Environment
EI: Editorial Studies
EN: English
FR: French Studies (International Programs only)
FY: First Year Experience
HI: History
HU: Humanities
ID: Interdisciplinary Studies
IN: Internships
IP: International Programs
IR: International Relations
IT: Italian Studies (International Programs only)
JS: Jewish Studies
LA: Hausa
LC: Chinese
LD: Amharic, Igbo, Mandinka/Bambara, Setswana/Sesotho, isiZulu, Other African Languages and Linguistics
LE: Swahili (Kiswahili)
LF: French
LG: German
LH: Hebrew
LI: Italian
LJ: Japanese
LK: Korean
LL: Language Learning
LM: isiXosha
LN: Hindi-Urdu
LO: Yoruba
LP: Portuguese
LR: Russian
LS: Spanish
LT: Turkish
LU: Pulaar
LW: Wolof, Akan Twi
LX: Applied Linguistics
LY: Arabic
LZ: Persian (Farsi)

MA: Mathematics & Statistics
ME: Middle East & North Africa Studies
MR: Marine Science
MS: Medical Science
MU: Music
NE: Neuroscience
NG: Nigerian Studies (International Programs only)
NS: Natural Sciences
PH: Philosophy
PO: Political Science
PS: Psychological & Brain Sciences
PY: Physics
QU: Spanish Studies (Quito only)
RN: Religion
RO: Romance Studies
SO: Sociology
SS: Social Sciences
SY: Senior-Year Development
TL: Literary Translation (Note: TL are CAS courses and degree is GRS)
WR: Writing
WS: Women’s, Gender & Sexuality Studies
XL: Comparative Literature

CDS: Faculty of Computing & Data Sciences

BF: Bioinformatics
DS: Data Science
DX: Online Data Science course

CFA: College of Fine Arts

AR: Visual Arts
TH: Theatre
FA: CFA Courses
ME: Music Education
ML: Applied Lessons
MP: Performance
MT: Music Theory
MU: Music

CGS: College of General Studies

HU: Humanities
MA: Mathematics
NS: Natural Science
RH: Rhetoric
SS: Social Science

COM: College of Communication

CI: Cinema & Media Studies
CM: Mass Communication, Advertising & Public Relations
CO: Communication Core Courses
EM: Emerging Media Studies
FT: Film & Television
JO: Journalism

ENG: College of Engineering

BE: Biomedical Engineering
BF: Bioinformatics
EC: Electrical & Computer Engineering
EK: Engineering Core
ME: Mechanical Engineering
MS: Materials Science & Engineering
SE: Systems Engineering

GMS: Graduate Medical Sciences

AN: Anatomy and Neurobiology
BC: Healthcare Emergency Management
BI: Biochemistry
BN: Behavioral Neuroscience
BT: Biomedical Laboratory & Clinical Sciences
BY: Biophysics
CI: Clinical Investigation
FA: Forensic Anthropology
FC: Foundations Curriculum
FS: Biomedical Forensic Sciences
GC: Genetic Counseling
GE: Genetics and Genomics
HS: Health Professions
IM: Bioimaging
MA: Medical Anthropology & Cross-Cultural Practice
MD: Medical Sciences
MH: Mental Health Counseling and Behavioral Medicine
MI: Microbiology
MM: Molecular Medicine
MS: Medical Sciences
NU: Nutrition & Metabolism
OB: Oral Biology
OH: Oral Health Sciences
PA: Pathology & Laboratory Medicine
PH: Physiology
PM: Pharmacology & Experimental Therapeutics

HUB: BU Hub – General Education Program

CC: Cocurricular
FY: First-Year Experience
IC: Interdisciplinary Course
RL: RIL with Honors Thesis or Directed Study
SA: Study Abroad Experience
SJ: Social & Racial Justice
XC: Cross-College Challenge

KHC: Kilachand Honors College
LAW: School of Law

AM: American Law
BK: Banking
JD: Juris Doctor
XB: Business Law
TX: Tax Law

MED: Chobanian & Avedisian School of Medicine
MET: Metropolitan College

AD: Administrative Sciences
AH: Art History
AN: Anthropology
AR: Arts Administration
AT: Actuarial Science
BI: Biology
BT: Biomedical Laboratory & Clinical Sciences
CH: Chemistry
CJ: Criminal Justice
CM: Communications/Advertising
CS: Computer Science
EC: Economics
EN: English
ES: Earth Sciences
HC: Health Communication
HI: History
HU: Humanities
IS: Interdisciplinary Studies
LD: Leadership
LX: Linguistics
MA: Mathematics, Statistics
MG: Management
ML: Gastronomy
PH: Philosophy
PO: Political Science
PS: Psychology
PY: Physics
SO: Sociology
UA: Urban Affairs

OTP: Officer Training Program (ROTC)

AS: Aerospace Studies (Air Force)
MS: Military Science (Army)
NS: Naval Science (Navy)

Questrom
Questrom School of Business

AC: Accounting
BA: Business Analytics
DS: Doctoral Dissertation Section
ES: Executive Skills
FE: Finance
FI: MSIM
HF: Humphrey Scholars
HM: Health Sector
IM: International Management
IS: Management Information Systems
LA: Law
MF: Math Finance
MG: Ethics
MK: Marketing
MO: Organizational Behavior
MS: Management Studies
OM: Operations & Technology Management
PL: Markets, Public Policy & Law
QM: Quantitative Modeling
SI: Strategy & Innovation
SM: Management Core

SAR: Sargent College of Health & Rehabilitation Sciences

HP: Health Professions
HS: Health Sciences
OT: Occupational Therapy
PT: Physical Therapy
RS: Rehabilitation Sciences
SH: Speech, Language & Hearing Sciences
SR: Summer Research

SDM: Henry M. Goldman School of Dental Medicine

EN: Endodontics
GD: General Dentistry
MB: Molecular Biology
MD: Dental Medicine
OB: Oral Biology
OD: Oral Diagnosis
OP: Operative Dentistry
OR: Orthodontics & Dentofacial Orthopedics
OS: Oral & Maxillofacial Surgery
PA: Oral & Maxillofacial Pathology
PD: Pediatric Dentistry
PE: Periodontology
PH: Dental Public Health
PR: Prosthodontics
RS: Restorative Dentistry

SHA: School of Hospitality Administration

HF: Hospitality Administration
RE: Real Estate
SE: Sport and Entertainment

SPH: School of Public Health

BS: Biostatistics
EH: Environmental Health
EP: Epidemiology
GH: Global Health
LW: Health Law, Bioethics & Human Rights
MC: Maternal & Child Health
PH: General Public Health
PM: Health Policy & Management
SB: Social & Behavioral Sciences

SSW: School of Social Work

CP: Clinical Practice
ET: Ethics
FE: Field Education
HB: Human Behavior
IS: Integrative Seminar
KC: PhD Proseminar
MP: Macro Practice
SR: Social Work Research
WP: Social Welfare Policy

STH: School of Theology

DM: Doctor of Ministry
TA: Sacred Music and the Arts
TC: Preaching, Worship, Administration, Evangelism, and Spirituality
TE: Religious Education
TF: Interdisciplinary Studies
TH: History of Christianity
TJ: Practical Theology
TM: Mission Studies
TN: New Testament
TO: Hebrew Scripture
TR: Sociology of Religion
TS: Ethics
TT: Philosophy and Systematic Theology
TX: Cross Listed
TY: Pastoral Psychology and Psychology of Religion
TZ: Research Methods and Professional Development

SUM: Summer Term

WED: Wheelock College of Education & Human Development

AP: Policy, Planning & Administration
BI: English as a Second Language
CE: Counseling & Counseling Psychology
CH: Childhood Education
CL: Latin & Classical Studies Education
CT: Curriculum & Teaching
DE: Deaf Studies
DS: Human Development & Education
EC: Early Childhood Education
ED: Education Core
EM: Educational Media & Technology
EN: English & Language Arts Education
HD: Human Development
HE: Health Education
HR: Human Resource Education
IE: International Education
LC: Independent Study
LR: Reading (formerly RE Reading Education)
LS: Language & Literacy Studies
LW: Writing Education
ME: Mathematics Education
PE: Physical Education & Coaching
RS: Research
SC: Science Education
SE: Special Education
SO: Social Studies Education
TL: Teaching English to Speakers of Other Languages (TESOL) & Modern Foreign Language Education
WL: World Language
YJ: Youth Justice

XAS: Marine Program/Semester at Sea

NS: SEA Semester, Marine Science

XRG: Cross-registration outside the University

AN: with Andover Newton Theological School through the Boston Theological Institute
BC: with Boston College School of Theology and Ministry & Theology Department through the Boston Theological Institute
BD: with Brandeis University
ED: Episcopal Divinity School through the Boston Theological Institute
GC: Gordon Conwell Theological School through the Boston Theological Institute
HB: Hebrew College Rabinical School through the Boston Theological Institute
HC: with Holy Cross through the Boston Theological Institute
HD: Harvard Divinity School through the Boston Theological Institute
HU: with Hebrew College
SJ: Saint John’s Seminary through the Boston Theological Institute
TF: with Tufts University

## Available group ids
[
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

## OUTPUT

Return only one JSON object (root node) or `null`. No text outside JSON.

## EXAMPLES

**AND**

> “CAS CS 111 and CAS MA 123.”

```json
{"type":"and","children":[
 {"type":"course","course_id":"CAS CS 111"},
 {"type":"course","course_id":"CAS MA 123"}]}
```

**Multi-OR**

> “CS 111 or CS 112 or CS 113.”

```json
{"type":"or","children":[
 {"type":"course","course_id":"CAS CS 111"},
 {"type":"course","course_id":"CAS CS 112"},
 {"type":"course","course_id":"CAS CS 113"}]}
```

**Nested AND/OR**

> “(MA 115 and MA 116) or MA 121.”

```json
{"type":"or","children":[
 {"type":"and","children":[
   {"type":"course","course_id":"CAS MA 115"},
   {"type":"course","course_id":"CAS MA 116"}]},
 {"type":"course","course_id":"CAS MA 121"}]}
```

**Corequisite**

> “Corequisites: CH 218 or NE 218.”

```json
{"type":"when","offset":0,"child":{
 "type":"or","children":[
  {"type":"course","course_id":"CAS CH 218"},
  {"type":"course","course_id":"CAS NE 218"}]}}
```

**Attribute**

> “junior standing or consent of instructor.”

```json
{"type":"attribute","key":"standing","values":["junior"]}
```

**Range**

> “any 100-level computer science course.”

```json
{"type":"range","school":"CAS","department":"CS","min_number":100,"max_number":199,"count":1}
```

**Negation**

> “For beginners only (students who have not taken any 100-level Greek).”

```json
{"type":"not","child":{
 "type":"range","school":"CAS","department":"GK","min_number":100,"max_number":199,"count":1}}
```

**Group Node**

> "At least two Writing-Intensive Courses"

```json
{ "type": "group", "group_id": "Writing Intensive Course", "count": 2 }
```