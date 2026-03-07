

## Problem Analysis

Two issues identified:

1. **Sarah Farrington generation failed** — The edge function logs show `SyntaxError: Expected ',' or '}' after property value in JSON at position 86020`. The AI model returns JSON that's too large or contains invalid characters, and the parser chokes. This is a recurring fragility with asking an LLM to return 80KB+ of structured JSON.

2. **PDF formatting issues** — The jsPDF-based PDF generation (742 lines of manual layout code) produces inconsistent formatting that's hard to maintain.

## Proposed Solution: Add "Download Raw Data (JSON)" Option

Instead of fighting with PDF formatting, add an option to export the raw IGP data as a clean JSON file that can be imported into Word, Google Docs, or any formatting tool.

### Changes

**1. Fix the JSON parsing failure in the edge function** (`supabase/functions/generate-growth-plan-recommendations/index.ts`)
- Add `response_format: { type: "json_object" }` to the AI request to enforce valid JSON output
- Add a retry mechanism (1 retry) if JSON parsing fails
- Truncate overly long prompts if the employee has many capabilities (cap at 15 most important)

**2. Add "Download Raw Data" menu option** (`src/components/igp/IGPDocument.tsx`)
- Add a new `menuAction="downloadJson"` variant
- When triggered, fetch the IGP data and save as a formatted JSON file
- Also offer a simple CSV-like text export with the key data in a readable format

**3. Wire it into the Employees page** (`src/pages/Employees.tsx`)
- Add a second dropdown item: "Download Growth Plan Data" alongside the existing PDF option
- This gives users the raw AI-generated recommendations, capability assessments, diagnostic scores, and training resources as structured data

### Output Format

The exported JSON will contain:
- Employee profile info
- All capability assessments with levels and definitions
- AI recommendations with training items, costs, and progression paths
- Diagnostic scores
- Development roadmap
- Vision, goals, habits, achievements

Users can then paste this into ChatGPT, format in Word/Docs, or use any tool they prefer.

