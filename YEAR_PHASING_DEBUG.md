# Strategic Learning Design - Year Phasing Debug

## Expected Results

### Year 1 (2026) - EXACTLY 5 Cohorts:
1. Leadership
2. People Management
3. CRM System Proficiency
4. Agronomy Sales Excellence
5. Written Communication

### Current Issue
The system is showing 44 cohorts in Year 1 instead of 5.

## Debugging Steps

1. Generate a new Strategic Learning Design report
2. Check edge function logs for `generate-strategic-learning-design`
3. Look for console output showing:
   - Total cohorts: X
   - Cohort names: [list of all capability names]
   - Year 1 cohorts: X [names]
   - Year 2 cohorts: X
   - Year 3 cohorts: X

## Next Steps
If the capability names in the database don't match exactly, we need to adjust the filter to match the actual capability names being generated.
