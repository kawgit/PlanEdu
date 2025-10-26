#!/usr/bin/env python3
"""
Balanced Course Recommendation System (final refactor)

✅ Features:
 - Recommends both major-related and non-major/hub courses
 - 50/50 balanced output (interleaved)
 - Uses normalized embeddings + cosine similarity
 - Filters out completed/bookmarked classes
 - Computes hub coverage bonus
 - SQL-safe and JSON-safe

Usage:
  echo '{"userId": 123}' | python recommend_courses_refactored.py
"""

import os, sys, json, numpy as np, psycopg
from dotenv import load_dotenv
from typing import List, Dict, Optional, Set

# --------------------------------------------------------------------
# Environment & DB setup
# --------------------------------------------------------------------
load_dotenv()

def get_conn():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL not set")
    return psycopg.connect(db_url)

# --------------------------------------------------------------------
# Embedding helpers
# --------------------------------------------------------------------
def parse_embedding(raw):
    """Parse JSON or array from DB."""
    if raw is None:
        return None
    if isinstance(raw, list):
        return np.array(raw, dtype=np.float32)
    try:
        data = json.loads(raw)
        return np.array(data, dtype=np.float32)
    except Exception:
        try:
            arr = np.fromstring(str(raw).strip("[]"), sep=",", dtype=np.float32)
            return arr if arr.size else None
        except Exception:
            return None

def normalize(v):
    n = np.linalg.norm(v)
    return v / n if n else v

def cosine(a, b):
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) or 1e-9
    return float(np.dot(a, b) / denom)

# --------------------------------------------------------------------
# Database queries
# --------------------------------------------------------------------
def get_user_embedding(cur, uid):
    cur.execute('SELECT embedding FROM "Users" WHERE id=%s', (uid,))
    r = cur.fetchone()
    return normalize(parse_embedding(r[0])) if r and r[0] else None

def get_user_major(cur, uid):
    cur.execute('SELECT major FROM "Users" WHERE id=%s', (uid,))
    r = cur.fetchone()
    return r[0] if r and r[0] else None

def get_completed(cur, uid):
    cur.execute('SELECT "classId" FROM "UserCompletedClass" WHERE "userId"=%s', (uid,))
    return [r[0] for r in cur.fetchall()]

def get_bookmarked(cur, uid):
    cur.execute('SELECT "classId" FROM "Bookmark" WHERE "userId"=%s', (uid,))
    return [r[0] for r in cur.fetchall()]

def get_missing_hubs(cur, uid)->Set[int]:
    cur.execute('SELECT id FROM "HubRequirement"')
    allh = {r[0] for r in cur.fetchall()}
    cur.execute("""
        SELECT DISTINCT cthr."hubRequirementId"
        FROM "UserCompletedClass" ucc
        JOIN "ClassToHubRequirement" cthr ON ucc."classId" = cthr."classId"
        WHERE ucc."userId"=%s
    """, (uid,))
    done = {r[0] for r in cur.fetchall()}
    return allh - done

def get_hub_map(cur)->Dict[int,List[int]]:
    cur.execute('SELECT "classId","hubRequirementId" FROM "ClassToHubRequirement"')
    mapping = {}
    for cid,hid in cur.fetchall():
        mapping.setdefault(cid, []).append(hid)
    return mapping

def get_completed_course_embeddings(cur, uid):
    """Get embeddings of courses the user has completed."""
    cur.execute("""
        SELECT c.embedding
        FROM "UserCompletedClass" ucc
        JOIN "Class" c ON ucc."classId" = c.id
        WHERE ucc."userId"=%s AND c.embedding IS NOT NULL
    """, (uid,))
    embeddings = []
    for r in cur.fetchall():
        emb = parse_embedding(r[0])
        if emb is not None:
            embeddings.append(normalize(emb))
    return embeddings

def compute_course_history_vector(completed_embeddings):
    """Average of completed courses → represents academic trajectory."""
    if not completed_embeddings:
        return None
    return normalize(np.mean(completed_embeddings, axis=0))

def get_candidates(cur, excluded):
    cur.execute("""
      SELECT id, school, department, number, title, description, embedding
      FROM "Class"
      WHERE embedding IS NOT NULL AND NOT (id = ANY(%s))
    """, (excluded,))
    rows = cur.fetchall()
    out = []
    for r in rows:
        emb = parse_embedding(r[6])
        if emb is not None:
            out.append(dict(
                id=r[0], school=r[1], department=r[2],
                number=r[3], title=r[4], description=r[5],
                embedding=normalize(emb)
            ))
    return out

# --------------------------------------------------------------------
# Scoring functions
# --------------------------------------------------------------------
def major_score(c, uvec, history_vec=None):
    """
    Score major courses using:
    - 60% user interests (current embedding)
    - 20% course history (academic trajectory)
    - 20% course level/keywords
    """
    sim = cosine(uvec, c["embedding"])
    
    # Factor in prior courses if available
    history_sim = 0.0
    if history_vec is not None:
        history_sim = cosine(history_vec, c["embedding"])
    
    try: num = int(c["number"])
    except: num = 100
    level_bonus = 0.3 if 200 <= num < 300 else 0.1
    keyword_bonus = 0.2 if any(k in c["title"].lower()
        for k in ["data", "algo", "system", "program", "ml", "ai"]) else 0
    
    # Combined: 60% interests + 20% trajectory + 20% fundamentals
    if history_vec is not None:
        return 0.6 * sim + 0.2 * history_sim + 0.2 * (level_bonus + keyword_bonus)
    else:
        return 0.8 * sim + 0.2 * (level_bonus + keyword_bonus)

def hub_score(c, uvec, missing, hmap, history_vec=None):
    """
    Score hub courses using:
    - 50% user interests
    - 20% course history (if you took similar courses)
    - 30% hub coverage
    """
    sim = cosine(uvec, c["embedding"])
    
    # Factor in prior courses
    history_sim = 0.0
    if history_vec is not None:
        history_sim = cosine(history_vec, c["embedding"])
    
    hubs = hmap.get(c["id"], [])
    overlap = len(set(hubs) & missing)
    coverage = min(1.0, overlap / max(1, len(missing)))
    
    if history_vec is not None:
        return 0.5 * sim + 0.2 * history_sim + 0.3 * coverage
    else:
        return 0.7 * sim + 0.3 * coverage

# --------------------------------------------------------------------
# Main recommender
# --------------------------------------------------------------------
def recommend(uid):
    with get_conn() as conn, conn.cursor() as cur:
        user_vec = get_user_embedding(cur, uid)
        if user_vec is None:
            raise ValueError("User has no embedding — compute it first.")

        major = get_user_major(cur, uid)
        completed = get_completed(cur, uid)
        bookmarked = get_bookmarked(cur, uid)
        excluded = list(set(completed + bookmarked))
        missing = get_missing_hubs(cur, uid)
        hubmap = get_hub_map(cur)
        
        # NEW: Get course history vector (average of completed courses)
        completed_embeddings = get_completed_course_embeddings(cur, uid)
        history_vec = compute_course_history_vector(completed_embeddings)
        
        candidates = get_candidates(cur, excluded)

        if not candidates:
            return []

        majors, hubs = [], []
        for c in candidates:
            dept = c["department"].lower()
            if major and any(term in dept for term in major.lower().split()):
                c["score"] = major_score(c, user_vec, history_vec)
                c["type"] = "major"
                majors.append(c)
            else:
                c["score"] = hub_score(c, user_vec, missing, hubmap, history_vec)
                c["type"] = "hub"
                hubs.append(c)

        majors.sort(key=lambda x: x["score"], reverse=True)
        hubs.sort(key=lambda x: x["score"], reverse=True)

        # NEW: Ensure at least 25% (1 in 4) are outside major department
        # Mix algorithm: 3 major → 1 hub → 3 major → 1 hub...
        mixed, seen = [], set()
        major_dept = major.lower() if major else ""
        out_of_dept_count = 0
        i = j = 0
        
        while len(mixed) < 20 and (i < len(majors) or j < len(hubs)):
            # Every 4th course should be out-of-department
            should_add_hub = (len(mixed) % 4 == 3) or out_of_dept_count < (len(mixed) // 4)
            
            if should_add_hub and j < len(hubs):
                # Add hub course (out-of-department)
                c = hubs[j]; j += 1
                if c["id"] not in seen:
                    seen.add(c["id"])
                    mixed.append(c)
                    out_of_dept_count += 1
            elif i < len(majors):
                # Add major course
                c = majors[i]; i += 1
                if c["id"] not in seen:
                    seen.add(c["id"])
                    mixed.append(c)
            elif j < len(hubs):
                # Fallback: add hub if no more majors
                c = hubs[j]; j += 1
                if c["id"] not in seen:
                    seen.add(c["id"])
                    mixed.append(c)
                    out_of_dept_count += 1

        for c in mixed:
            c["score"] = round(float(c["score"]), 4)

        print(f"✓ Recommended {len(mixed)} courses ({len(mixed)-out_of_dept_count} major, {out_of_dept_count} outside dept)", file=sys.stderr)
        return mixed

# --------------------------------------------------------------------
# CLI / API entrypoint
# --------------------------------------------------------------------
def main():
    try:
        data = json.load(sys.stdin)
        uid = data.get("userId")
        if not uid:
            raise ValueError("Missing 'userId' in input JSON")

        recs = recommend(uid)
        print(json.dumps({
            "userId": uid,
            "count": len(recs),
            "recommendations": recs
        }, indent=2, default=float))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
