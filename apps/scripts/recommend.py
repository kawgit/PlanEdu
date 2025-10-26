#!/usr/bin/env python3
"""
Recommendation script that generates user embeddings based on their profile
Uses OpenAI's text-embedding-3-small model to create embeddings
"""

import sys
import json
import os
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def recommend_for_user(user_data):
    """
    Generate an embedding for a user based on their profile
    
    Args:
        user_data: Dictionary containing:
            - major: string of user's major
            - interests: list of interest strings
            - courses_taken: list of course codes/names
    
    Returns:
        Dictionary with 'embedding' key containing the vector
    """
    # Initialize OpenAI client
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    
    client = OpenAI(api_key=api_key)
    
    # Build a text representation of the user's profile
    major = user_data.get('major', '')
    interests = user_data.get('interests', [])
    courses_taken = user_data.get('courses_taken', [])
    
    # Create a descriptive text for the embedding
    text_parts = []
    
    if major:
        text_parts.append(f"Major: {major}")
    
    if interests and len(interests) > 0:
        text_parts.append(f"Interests: {', '.join(interests)}")
    
    if courses_taken and len(courses_taken) > 0:
        text_parts.append(f"Courses taken: {', '.join(courses_taken)}")
    
    # Combine all parts into a single text
    text = "\n".join(text_parts)
    
    if not text.strip():
        raise ValueError("User data is empty - cannot generate embedding")
    
    # Generate embedding using OpenAI API
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    
    # Extract the embedding vector
    embedding = response.data[0].embedding
    
    return {"embedding": embedding}


if __name__ == "__main__":
    try:
        # Read JSON input from stdin
        data = json.load(sys.stdin)
        
        # Generate recommendation/embedding
        result = recommend_for_user(data)
        
        # Output result as JSON
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        # Output error as JSON and exit with error code
        error_result = {"error": str(e)}
        print(json.dumps(error_result))
        sys.exit(1)

