#!/usr/bin/env python3
"""
Compute and store course embeddings using OpenAI's text-embedding-3-small model.

This script:
1. Connects to a Postgres database
2. Fetches all courses without embeddings
3. Computes embeddings for each course using OpenAI
4. Stores the embeddings back in the database

Usage:
    export DATABASE_URL="postgresql://..."
    export OPENAI_API_KEY="sk-..."
    python compute_course_embeddings.py
"""

import os
import sys
import time
import json
from typing import List, Dict, Any, Optional
from psycopg import connect
from tqdm import tqdm
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ============================================================================
# Configuration
# ============================================================================

# Rate limiting (requests per minute for OpenAI API)
REQUESTS_PER_MINUTE = 500  # Adjust based on your OpenAI tier
SLEEP_BETWEEN_REQUESTS = 60.0 / REQUESTS_PER_MINUTE  # Seconds between requests

# OpenAI model
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536  # Default for text-embedding-3-small

# Batch size for database commits
BATCH_SIZE = 50

# ============================================================================
# Database functions
# ============================================================================

def get_connection():
    """Create and return a database connection."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set")
    return connect(database_url)


def ensure_embedding_column_exists(conn):
    """Ensure the embedding column exists in the Class table."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'Class'
                    AND column_name = 'embedding'
                )
            """)
            exists = cur.fetchone()[0]

            if not exists:
                print("📊 Creating 'embedding' column in Class table...")
                cur.execute('ALTER TABLE "Class" ADD COLUMN embedding JSONB;')
                conn.commit()
                print("✅ Column created successfully")
            else:
                print("✅ Embedding column already exists")

    except Exception as e:
        print(f"⚠️  Error checking/creating embedding column: {e}")
        conn.rollback()
        raise



def fetch_courses_without_embeddings(conn) -> List[Dict[str, Any]]:
    """Fetch all courses that don't have embeddings yet."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 
                id,
                school,
                department,
                number,
                title,
                description
            FROM "Class"
            WHERE embedding IS NULL
            ORDER BY school, department, number
        """)
        
        columns = [desc[0] for desc in cur.description]
        courses = []
        for row in cur.fetchall():
            course = dict(zip(columns, row))
            courses.append(course)
        
        return courses


def update_course_embedding(conn, course_id: int, embedding: List[float]) -> None:
    """Update a course with its computed embedding."""
    with conn.cursor() as cur:
        # Store embedding as JSONB
        embedding_json = json.dumps(embedding)
        cur.execute("""
            UPDATE "Class"
            SET embedding = %s::jsonb
            WHERE id = %s
        """, (embedding_json, course_id))


# ============================================================================
# OpenAI functions
# ============================================================================

def initialize_openai_client() -> OpenAI:
    """Initialize and return OpenAI client."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    return OpenAI(api_key=api_key)


def create_course_text(course: Dict[str, Any]) -> str:
    """
    Create a text representation of a course for embedding.
    Combines school, department, number, title, and description.
    """
    school = course.get('school', '')
    department = course.get('department', '')
    number = course.get('number', '')
    title = course.get('title', '')
    description = course.get('description', '')
    
    # Create a rich text representation
    course_code = f"{school}{department} {number}"
    text_parts = [
        f"Course: {course_code}",
        f"Title: {title}",
        f"Description: {description}"
    ]
    
    return "\n".join(text_parts)


def compute_embedding(client: OpenAI, text: str) -> Optional[List[float]]:
    """
    Compute embedding for the given text using OpenAI API.
    Returns None if an error occurs.
    """
    try:
        response = client.embeddings.create(
            input=text,
            model=EMBEDDING_MODEL
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"\n❌ Error computing embedding: {e}")
        return None


# ============================================================================
# Main script
# ============================================================================

def main():
    """Main execution function."""
    print("=" * 80)
    print("🎓 Course Embedding Computer")
    print("=" * 80)
    print()
    
    # Step 1: Validate environment variables
    print("🔍 Checking environment variables...")
    try:
        if not os.getenv("DATABASE_URL"):
            print("❌ DATABASE_URL is not set")
            sys.exit(1)
        if not os.getenv("OPENAI_API_KEY"):
            print("❌ OPENAI_API_KEY is not set")
            sys.exit(1)
        print("✅ Environment variables validated")
        print()
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        sys.exit(1)
    
    # Step 2: Connect to database
    print("🔌 Connecting to database...")
    try:
        conn = get_connection()
        print("✅ Connected successfully")
        print()
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)
    
    try:
        # Step 3: Ensure embedding column exists
        ensure_embedding_column_exists(conn)
        print()
        
        # Step 4: Fetch courses without embeddings
        print("📚 Fetching courses without embeddings...")
        courses = fetch_courses_without_embeddings(conn)
        
        if not courses:
            print("✅ All courses already have embeddings!")
            return
        
        print(f"📊 Found {len(courses)} courses to process")
        print(f"⏱️  Estimated time: ~{len(courses) * SLEEP_BETWEEN_REQUESTS / 60:.1f} minutes")
        print()
        
        # Step 5: Initialize OpenAI client
        print("🤖 Initializing OpenAI client...")
        client = initialize_openai_client()
        print("✅ OpenAI client ready")
        print()
        
        # Step 6: Process courses
        print("🚀 Computing embeddings...")
        print(f"   Model: {EMBEDDING_MODEL}")
        print(f"   Rate limit: {REQUESTS_PER_MINUTE} requests/minute")
        print()
        
        successful = 0
        failed = 0
        
        # Use tqdm for progress bar
        with tqdm(total=len(courses), desc="Processing", unit="course") as pbar:
            for i, course in enumerate(courses):
                try:
                    # Create text representation
                    course_text = create_course_text(course)
                    
                    # Compute embedding
                    embedding = compute_embedding(client, course_text)
                    
                    if embedding:
                        # Update database
                        update_course_embedding(conn, course['id'], embedding)
                        successful += 1
                        
                        # Commit in batches
                        if (i + 1) % BATCH_SIZE == 0:
                            conn.commit()
                            pbar.set_postfix({
                                'success': successful,
                                'failed': failed,
                                'committed': i + 1
                            })
                    else:
                        failed += 1
                        pbar.set_postfix({
                            'success': successful,
                            'failed': failed
                        })
                    
                    # Update progress bar
                    pbar.update(1)
                    
                    # Rate limiting (sleep between requests)
                    if i < len(courses) - 1:  # Don't sleep after last request
                        time.sleep(SLEEP_BETWEEN_REQUESTS)
                    
                except Exception as e:
                    failed += 1
                    pbar.set_postfix({
                        'success': successful,
                        'failed': failed,
                        'error': str(e)[:30]
                    })
                    pbar.update(1)
                    print(f"\n⚠️  Error processing course {course['id']}: {e}")
                    continue
        
        # Final commit
        conn.commit()
        print()
        
        # Step 7: Summary
        print("=" * 80)
        print("📊 Summary")
        print("=" * 80)
        print(f"✅ Successfully processed: {successful} courses")
        if failed > 0:
            print(f"❌ Failed: {failed} courses")
        print(f"💾 Total embeddings stored: {successful}")
        print()
        
        if failed == 0:
            print("🎉 All courses processed successfully!")
        else:
            print("⚠️  Some courses failed. You can re-run this script to retry.")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Process interrupted by user")
        conn.rollback()
        print("🔄 Changes rolled back")
        sys.exit(1)
        
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        conn.rollback()
        print("🔄 Changes rolled back")
        sys.exit(1)
        
    finally:
        conn.close()
        print("🔌 Database connection closed")


if __name__ == "__main__":
    main()

