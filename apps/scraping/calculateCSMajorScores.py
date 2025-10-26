#!/usr/bin/env python3
"""
Calculate CS Major Scores for all classes in the database.
This score (0-100) indicates how much a CS major would be interested in a course
based on keyword matching in the title and description.
"""
import os
import psycopg
from tqdm import tqdm
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


def get_conninfo():
    dsn = os.getenv("DATABASE_URL")
    if dsn:
        return dsn
    host = os.getenv("PGHOST", "localhost")
    port = os.getenv("PGPORT", "5432")
    user = os.getenv("PGUSER", "postgres")
    password = os.getenv("PGPASSWORD", "")
    dbname = os.getenv("PGDATABASE", "postgres")
    return f"host={host} port={port} user={user} password={password} dbname={dbname}"


def calculate_cs_major_score(title, description, department, number):
    """
    Calculate a score (0-100) for how much a CS major would like this course.
    Simple keyword-based scoring from title and description.
    """
    # Start with a base score for all courses
    score = 30
    
    # Combine title and description for analysis
    text = f"{title} {description}".lower()
    
    # CS-related keywords with their point values
    cs_keywords = {
        # Core CS topics (high value)
        'algorithm': 18,
        'data structure': 18,
        'computer science': 18,
        'computing': 15,
        'programming': 18,
        'coding': 15,
        'software': 15,
        'computer systems': 18,
        'systems programming': 18,
        'software engineering': 15,
        'software development': 15,
        'full-stack': 12,
        'application design': 10,
        
        # CS subfields
        'machine learning': 20,
        'artificial intelligence': 20,
        'ai': 20,
        'deep learning': 18,
        'neural network': 16,
        'data science': 15,
        'data mining': 12,
        'big data': 12,
        'cybersecurity': 12,
        'security': 10,
        'information security': 12,
        'networking': 15,
        'computer network': 15,
        'network programming': 12,
        'distributed system': 18,
        'cloud computing': 15,
        'database': 15,
        'database system': 15,
        'operating system': 15,
        'operating systems': 15,
        'web development': 12,
        'computer graphics': 12,
        'graphics': 10,
        'image processing': 12,
        'computer vision': 12,
        'natural language processing': 12,
        'nlp': 12,
        'blockchain': 12,
        'cryptography': 15,
        'advanced cryptography': 12,
        'compiler': 10,
        'compiler design': 12,
        'embedde': 10,
        'i/o': 8,
        'device driver': 10,
        
        # Programming languages and tools
        'python': 12,
        'java': 12,
        'javascript': 12,
        'c++': 10,
        'c': 10,
        'c programming': 12,
        'perl': 8,
        'unix': 10,
        'linux': 10,
        'react': 10,
        'node.js': 10,
        'sql': 12,
        'git': 8,
        'api': 8,
        'http': 8,
        'tcp/ip': 12,
        'bash': 6,
        
        # Math and logic relevant to CS
        'discrete': 12,
        'combinatoric': 12,
        'combinatorial': 12,
        'linear algebra': 8,
        'algebra': 10,
        'algebraic': 12,
        'probability': 12,
        'probabilistic': 12,
        'statistics': 10,
        'statistical': 10,
        'calculus': 8,
        'logic': 12,
        'formal logic': 12,
        'graph theory': 12,
        'optimization': 12,
        'complexity': 12,
        'np-complete': 8,
        'computational': 15,
        'computation': 15,
        'reduction': 8,
        'polynomial': 8,
        'approximation': 8,
        'randomness': 8,
        'random': 8,
        'set theory': 10,
        'matrix': 8,
        'vectors': 8,
        
        # Technical skills and concepts
        'problem solving': 10,
        'debugging': 10,
        'testing': 8,
        'automation': 8,
        'data analysis': 12,
        'design pattern': 10,
        'software architecture': 12,
        'concurrency': 12,
        'parallel computing': 12,
        'parallel algorithm': 10,
        'synchronization': 10,
        'replication': 8,
        'fault tolerance': 10,
        'robust': 8,
        'real-time': 8,
        'performance': 10,
        'scalability': 10,
        'efficiency': 10,
        'data center': 8,
        
        # Tech industry and business related
        'startup': 8,
        'entrepreneurship': 6,
        'innovation': 6,
        'mobile app': 8,
        'ios': 6,
        'android': 6,
        
        # Economics and finance (CS majors often minor/double major)
        'econometrics': 10,
        'financial modeling': 10,
        'quantitative finance': 12,
        'trading': 8,
        'risk analysis': 8,
        'portfolio': 6,
        
        # Engineering (related technical field)
        'circuit': 10,
        'signal processing': 10,
        'digital logic': 12,
        'hardware': 10,
        'microprocessor': 10,
        'fpga': 8,
        'arduino': 6,
        'raspberry pi': 6,
        
        # Statistics and data (CS majors take these)
        'regression': 12,
        'classification': 12,
        'clustering': 12,
        'anomaly detection': 10,
        'outlier': 8,
        'feature selection': 10,
        'dimensionality reduction': 10,
        'sampling': 8,
        'hypothesis testing': 8,
        
        # Project-based learning
        'capstone': 10,
        'practicum': 10,
        'internship': 6,
        'independent study': 8,
        'project': 6,
    }
    
    # Check for keywords and add points
    for keyword, points in cs_keywords.items():
        if keyword in text:
            score += points
    
    # Ensure score is between 0 and 100
    return min(max(score, 0), 100)


def main():
    logger.info("Connecting to database...")
    
    conninfo = get_conninfo()
    
    with psycopg.connect(conninfo) as conn:
        with conn.cursor() as cur:
            # Get all classes
            cur.execute('SELECT id, "title", "description", "department", "number" FROM "Class"')
            classes = cur.fetchall()
            
            logger.info(f"Found {len(classes)} classes to score")
            
            updated = 0
            skipped = 0
            
            for class_row in tqdm(classes, desc="Calculating scores"):
                class_id, title, description, department, number = class_row
                
                # Calculate score
                score = calculate_cs_major_score(
                    title or "",
                    description or "",
                    department,
                    number
                )
                
                # Update the database
                cur.execute(
                    'UPDATE "Class" SET "csMajorScore" = %s WHERE id = %s',
                    (score, class_id)
                )
                
                updated += 1
            
            # Commit all updates
            conn.commit()
            
            logger.info(f"✅ Updated {updated} classes with CS major scores")
            logger.info(f"   Skipped {skipped} classes")


if __name__ == "__main__":
    main()
