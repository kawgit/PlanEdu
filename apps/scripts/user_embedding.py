#!/usr/bin/env python3
"""
User Embedding Script
Computes a vector representation of a user based on their academic profile.

This script:
1. Takes user data (major, interests, courses taken) as JSON input
2. Generates a text representation of the user's academic profile
3. Uses OpenAI's text-embedding-3-small model to create a 1536-dimensional vector
4. Returns the embedding vector that can be stored and used for recommendations
"""

import sys
import json
import os
from typing import Dict, List, Any
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def build_user_profile_text(user_data: Dict[str, Any]) -> str:
    """
    Build a rich text representation of the user's academic profile.
    
    Args:
        user_data: Dictionary containing major, interests, courses_taken
        
    Returns:
        Formatted text describing the user's profile
    """
    parts = []
    
    # Add major information
    major = user_data.get('major', '').strip()
    if major:
        parts.append(f"Academic Major: {major}")
    
    # Add interests with emphasis
    interests = user_data.get('interests', [])
    if isinstance(interests, list) and len(interests) > 0:
        # Filter out empty strings
        interests = [i.strip() for i in interests if i.strip()]
        if interests:
            parts.append(f"Academic Interests and Focus Areas: {', '.join(interests)}")
    
    # Add courses taken
    courses_taken = user_data.get('courses_taken', [])
    if isinstance(courses_taken, list) and len(courses_taken) > 0:
        # Filter out empty strings
        courses_taken = [c.strip() for c in courses_taken if c.strip()]
        if courses_taken:
            parts.append(f"Completed Courses: {', '.join(courses_taken)}")
    
    # Combine all parts
    profile_text = "\n".join(parts)
    
    if not profile_text.strip():
        raise ValueError(
            "User profile is empty. At least one of major, interests, or courses_taken must be provided."
        )
    
    return profile_text


def compute_user_embedding(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compute an embedding vector for a user based on their academic profile.
    
    Args:
        user_data: Dictionary with keys:
            - major: string (e.g., "Computer Science")
            - interests: list of strings (e.g., ["AI", "systems", "theory"])
            - courses_taken: list of course codes (e.g., ["CASCS111", "CASCS210"])
    
    Returns:
        Dictionary with:
            - embedding: list of floats (1536 dimensions)
            - profile_text: the text used to generate the embedding
            - dimension: int (1536)
    """
    # Validate environment
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY environment variable is not set. "
            "Please add it to your .env file."
        )
    
    # Initialize OpenAI client
    client = OpenAI(api_key=api_key)
    
    # Build the profile text
    try:
        profile_text = build_user_profile_text(user_data)
    except ValueError as e:
        raise ValueError(f"Failed to build user profile: {str(e)}")
    
    # Generate embedding using OpenAI's text-embedding-3-small model
    # This model produces 1536-dimensional vectors
    try:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=profile_text,
            encoding_format="float"
        )
    except Exception as e:
        raise RuntimeError(f"OpenAI API error: {str(e)}")
    
    # Extract the embedding vector
    embedding = response.data[0].embedding
    
    return {
        "embedding": embedding,
        "profile_text": profile_text,
        "dimension": len(embedding),
        "model": "text-embedding-3-small"
    }


def main():
    """
    Main entry point for the script.
    Reads JSON from stdin, computes embedding, outputs JSON to stdout.
    """
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Validate input structure
        if not isinstance(input_data, dict):
            raise ValueError("Input must be a JSON object")
        
        # Compute the user embedding
        result = compute_user_embedding(input_data)
        
        # Output result as JSON to stdout
        print(json.dumps(result))
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        error_result = {
            "error": f"Invalid JSON input: {str(e)}"
        }
        print(json.dumps(error_result))
        sys.exit(1)
        
    except ValueError as e:
        error_result = {
            "error": f"Validation error: {str(e)}"
        }
        print(json.dumps(error_result))
        sys.exit(1)
        
    except RuntimeError as e:
        error_result = {
            "error": f"Runtime error: {str(e)}"
        }
        print(json.dumps(error_result))
        sys.exit(1)
        
    except Exception as e:
        error_result = {
            "error": f"Unexpected error: {str(e)}",
            "type": type(e).__name__
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()

