import sys
import json
import numpy as np
from sentence_transformers import SentenceTransformer


# Here Using all-MiniLM-L6-v2 requested by Taske
try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception as e:
    sys.stderr.write(f"Error loading model: {str(e)}\n")
    sys.exit(1)

def process_input():
    try:
        # Read from stdin
        input_data = sys.stdin.read()
        if not input_data:
            return

        texts = json.loads(input_data)
        
        if not isinstance(texts, list):
            raise ValueError("Input must be a JSON array of strings")

        # Encode
        # normalize_embeddings=True ensures cosine similarity can be computed via dot product
        embeddings = model.encode(texts, normalize_embeddings=True)

        # Convert to list for JSON serialization
        output = embeddings.tolist()
        
        # Write to stdout
        print(json.dumps(output))

    except Exception as e:
        sys.stderr.write(f"Error processing: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    process_input()
