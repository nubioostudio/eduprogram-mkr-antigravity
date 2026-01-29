import argparse
import json
import sys
import os

try:
    from pypdf import PdfReader
except ImportError:
    print(json.dumps({"status": "error", "message": "pypdf is not installed. Run 'pip install pypdf'."}))
    sys.exit(1)

def extract_from_pdf(file_path):
    if not os.path.exists(file_path):
        return {"status": "error", "message": f"File not found: {file_path}"}

    try:
        reader = PdfReader(file_path)
        text_content = []
        
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                text_content.append(text)
        
        full_text = "\n".join(text_content)
        
        metadata = reader.metadata
        safe_metadata = {}
        if metadata:
            # Safely get metadata, handling potential None values
            safe_metadata = {
                "author": metadata.get("/Author", None),
                "creator": metadata.get("/Creator", None),
                "producer": metadata.get("/Producer", None),
                "creation_date": str(metadata.get("/CreationDate", None)),
                "page_count": len(reader.pages)
            }
        else:
            safe_metadata = {"page_count": len(reader.pages)}

        return {
            "status": "success",
            "text": full_text,
            "metadata": safe_metadata
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract text and metadata from a PDF file.")
    parser.add_argument("file_path", help="Path to the PDF file")
    
    args = parser.parse_args()
    
    result = extract_from_pdf(args.file_path)
    print(json.dumps(result, indent=2))
