#!/usr/bin/env python3
"""
Update User Embedding Based on Swipe Interactions

This script updates a user's embedding vector based on their likes/dislikes of courses.
It uses an incremental learning approach where the user vector moves toward liked courses
and away from disliked courses.

Formula: user_vec_new = normalize(user_vec_old + α * direction * course_vec)
where:
  - direction = +1 if liked, -1 if disliked
  - α (learning rate) = 0.1
  - normalize() ensures unit length

Usage:
  python update_user_embedding.py --student_id 12345 --course_id CAS-PS101 --liked True
  python update_user_embedding.py --student_id 12345 --course_id CAS-PS101 --liked False
"""

import os
import sys
import json
import argparse
import numpy as np
from typing import Optional, List
from dotenv import load_dotenv

try:
    import psycopg
except ImportError:
    print("❌ Error: psycopg is not installed. Install with: pip install psycopg[binary]")
    sys.exit(1)

# Load environment variables
load_dotenv()

# Constants
LEARNING_RATE = 0.1
DEFAULT_EMBEDDING_DIM = 1536  # OpenAI text-embedding-3-small dimension


def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description='Update user embedding based on course swipe interaction'
    )
    parser.add_argument(
        '--student_id',
        type=str,
        required=True,
        help='Student ID (e.g., google_id or user ID)'
    )
    parser.add_argument(
        '--course_id',
        type=str,
        required=True,
        help='Course ID (e.g., CAS-PS101 or numeric ID)'
    )
    parser.add_argument(
        '--liked',
        type=lambda x: str(x).lower() in ['true', '1', 'yes'],
        required=True,
        help='Whether the user liked the course (True/False)'
    )
    parser.add_argument(
        '--learning_rate',
        type=float,
        default=LEARNING_RATE,
        help=f'Learning rate for embedding update (default: {LEARNING_RATE})'
    )
    
    return parser.parse_args()


def get_database_url() -> str:
    """Get database URL from environment."""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError(
            "DATABASE_URL environment variable is not set. "
            "Add it to your .env file."
        )
    return db_url


def parse_embedding(embedding_data) -> Optional[np.ndarray]:
    """
    Parse embedding from database (could be JSONB array or PostgreSQL vector).
    Returns numpy array or None if parsing fails.
    """
    if embedding_data is None:
        return None
    
    try:
        # If it's already a list (from JSONB)
        if isinstance(embedding_data, list):
            return np.array(embedding_data, dtype=np.float32)
        
        # If it's a string (JSON or vector format)
        if isinstance(embedding_data, str):
            # Try JSON parse
            try:
                data = json.loads(embedding_data)
                if isinstance(data, list):
                    return np.array(data, dtype=np.float32)
            except json.JSONDecodeError:
                pass
            
            # Try vector format: [1,2,3] or just comma-separated
            embedding_str = embedding_data.strip('[]')
            values = [float(x.strip()) for x in embedding_str.split(',')]
            return np.array(values, dtype=np.float32)
        
        # If it's bytes, decode first
        if isinstance(embedding_data, bytes):
            return parse_embedding(embedding_data.decode('utf-8'))
            
        return None
    except Exception as e:
        print(f"⚠️  Warning: Failed to parse embedding: {e}")
        return None


def normalize_vector(vec: np.ndarray) -> np.ndarray:
    """
    Normalize vector to unit length.
    If vector is all zeros, return it unchanged.
    """
    norm = np.linalg.norm(vec)
    if norm == 0 or np.isnan(norm):
        return vec
    return vec / norm


def fetch_student_embedding(conn, student_id: str) -> Optional[np.ndarray]:
    """
    Fetch student embedding from database.
    Returns numpy array or None if not found.
    """
    with conn.cursor() as cur:
        # Try to fetch from Users table (based on your schema)
        cur.execute(
            'SELECT embedding FROM "Users" WHERE google_id = %s',
            (student_id,)
        )
        result = cur.fetchone()
        
        if result and result[0]:
            return parse_embedding(result[0])
        
        return None


def fetch_course_embedding(conn, course_id: str) -> Optional[np.ndarray]:
    """
    Fetch course embedding from database.
    Tries both by ID and by course code.
    Returns numpy array or None if not found.
    """
    with conn.cursor() as cur:
        # First try by ID (numeric)
        try:
            course_id_int = int(course_id)
            cur.execute(
                'SELECT embedding FROM "Class" WHERE id = %s',
                (course_id_int,)
            )
            result = cur.fetchone()
            if result and result[0]:
                return parse_embedding(result[0])
        except (ValueError, TypeError):
            pass
        
        # Try by course code (e.g., "CAS-PS-101" -> school=CAS, dept=PS, number=101)
        parts = course_id.replace('-', ' ').split()
        if len(parts) >= 3:
            school, dept, number = parts[0], parts[1], parts[2]
            try:
                number_int = int(number)
                cur.execute(
                    'SELECT embedding FROM "Class" WHERE school = %s AND department = %s AND number = %s',
                    (school, dept, number_int)
                )
                result = cur.fetchone()
                if result and result[0]:
                    return parse_embedding(result[0])
            except ValueError:
                pass
        
        return None


def update_student_embedding(
    conn, 
    student_id: str, 
    new_embedding: np.ndarray
) -> bool:
    """
    Update student embedding in database.
    Returns True if successful, False otherwise.
    """
    try:
        # Convert numpy array to list for JSON storage or vector format
        embedding_list = new_embedding.tolist()
        
        # Format as PostgreSQL vector if using pgvector
        # Format: [1,2,3]
        vector_str = f"[{','.join(map(str, embedding_list))}]"
        
        with conn.cursor() as cur:
            # Update using pgvector format
            cur.execute(
                '''
                UPDATE "Users" 
                SET embedding = %s::vector,
                    embedding_updated_at = NOW()
                WHERE google_id = %s
                ''',
                (vector_str, student_id)
            )
            
            if cur.rowcount == 0:
                print(f"⚠️  Warning: No user found with google_id: {student_id}")
                return False
            
        conn.commit()
        return True
        
    except Exception as e:
        print(f"❌ Error updating embedding: {e}")
        conn.rollback()
        return False


def update_embedding_from_interaction(
    student_vec: Optional[np.ndarray],
    course_vec: np.ndarray,
    liked: bool,
    learning_rate: float
) -> np.ndarray:
    """
    Update user embedding based on course interaction.
    
    Formula: user_vec_new = normalize(user_vec_old + α * direction * course_vec)
    """
    # Initialize student vector if it doesn't exist
    if student_vec is None:
        student_vec = np.zeros_like(course_vec)
    
    # Ensure same dimensions
    if len(student_vec) != len(course_vec):
        print(f"⚠️  Warning: Dimension mismatch. Student: {len(student_vec)}, Course: {len(course_vec)}")
        # Resize student vector to match course vector
        if len(student_vec) < len(course_vec):
            student_vec = np.pad(student_vec, (0, len(course_vec) - len(student_vec)))
        else:
            student_vec = student_vec[:len(course_vec)]
    
    # Calculate direction (+1 for like, -1 for dislike)
    direction = 1.0 if liked else -1.0
    
    # Update: user_vec_new = user_vec_old + α * direction * course_vec
    updated_vec = student_vec + (learning_rate * direction * course_vec)
    
    # Normalize to unit length
    normalized_vec = normalize_vector(updated_vec)
    
    return normalized_vec


def main():
    """Main execution function."""
    # Parse arguments
    args = parse_arguments()
    
    student_id = args.student_id
    course_id = args.course_id
    liked = args.liked
    learning_rate = args.learning_rate
    
    action = "liking" if liked else "disliking"
    
    print(f"\n{'='*60}")
    print(f"Updating user embedding based on {action} course")
    print(f"{'='*60}")
    print(f"Student ID: {student_id}")
    print(f"Course ID: {course_id}")
    print(f"Liked: {liked}")
    print(f"Learning Rate: {learning_rate}")
    print()
    
    try:
        # Get database connection
        db_url = get_database_url()
        
        # Connect to database
        with psycopg.connect(db_url) as conn:
            print("✅ Connected to database")
            
            # Fetch student embedding
            print(f"📥 Fetching embedding for student {student_id}...")
            student_vec = fetch_student_embedding(conn, student_id)
            
            if student_vec is None:
                print(f"   → No existing embedding found, will initialize to zero vector")
            else:
                print(f"   → Found embedding with {len(student_vec)} dimensions")
            
            # Fetch course embedding
            print(f"📥 Fetching embedding for course {course_id}...")
            course_vec = fetch_course_embedding(conn, course_id)
            
            if course_vec is None:
                print(f"❌ Course embedding not found for {course_id}")
                print(f"   Cannot update user embedding without course embedding.")
                print(f"   Make sure the course has been embedded first.")
                sys.exit(1)
            
            print(f"   → Found course embedding with {len(course_vec)} dimensions")
            
            # Update embedding
            print(f"\n🔄 Computing updated embedding...")
            new_student_vec = update_embedding_from_interaction(
                student_vec,
                course_vec,
                liked,
                learning_rate
            )
            
            # Calculate magnitude of change
            if student_vec is not None:
                change_magnitude = np.linalg.norm(new_student_vec - student_vec)
                print(f"   → Change magnitude: {change_magnitude:.6f}")
            
            # Store updated embedding
            print(f"💾 Storing updated embedding...")
            success = update_student_embedding(conn, student_id, new_student_vec)
            
            if success:
                print(f"\n✅ Updated embedding for student {student_id} after {action} course {course_id}")
                print(f"{'='*60}\n")
            else:
                print(f"\n❌ Failed to update embedding")
                sys.exit(1)
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

