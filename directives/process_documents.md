---
description: Process PDF documents to extract text and structure using local Python scripts.
---

# Directive: Process Documents

## Goal
Extract raw text and metadata from PDF files to validate content before passing it to the AI for analysis. This step ensures we have access to the data without hallucination.

## Inputs
- **FilePath**: Absolute path to the PDF file to be processed.

## Tools & Scripts
- **Script**: `execution/process_pdf.py`
  - **Command**: `python execution/process_pdf.py <FilePath>`
  - **Dependencies**: `pypdf` (install via `pip install pypdf`)

## Process
1. **Validate Input**: Ensure the file exists and is a PDF.
2. **Execute Extraction**: Run the `process_pdf.py` script.
3. **Review Output**: The script will output the extracted text to stdout or a JSON file.
4. **Validation**: Check if the extracted text contains meaningful content (not just garbled text).

## Outputs
- **JSON Object**:
    - `text`: Full extracted text.
    - `metadata`: Object containing `page_count`, `author`, `creation_date`.
    - `status`: "success" or "error".

## Error Handling
- If the file is encrypted/password protected, the script should return a clear error.
- If the file is not a valid PDF, return an error.
