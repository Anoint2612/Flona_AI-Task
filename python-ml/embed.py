import sys
import json
import numpy as np
from sentence_transformers import SentenceTransformer

try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception as e:
    sys.stderr.write(f"Error loading model: {str(e)}\n")
    sys.exit(1)

def process_input():
    try:
        input_data = sys.stdin.read()
        if not input_data:
            return

        texts = json.loads(input_data)
        
        if not isinstance(texts, list):
            raise ValueError("Input must be a JSON array of strings")

        embeddings = model.encode(texts, normalize_embeddings=True)

        output = embeddings.tolist()
        
        print(json.dumps(output))

    except Exception as e:
        sys.stderr.write(f"Error processing: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    process_input()
