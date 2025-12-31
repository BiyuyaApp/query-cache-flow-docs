---
status: active
max_iterations: 50
current_iteration: 0
completion_promise: "CACHE-FLOW-DOCS-COMPLETE"
prompt_file: ".ralph-wiggum-prompt.md"
---

# Ralph Wiggum Loop Configuration

This loop will build complete documentation for CACHE-FLOW.

## Prompt Source
The main prompt is loaded from `.ralph-wiggum-prompt.md` in the project root.

## Completion Criteria
Output `<promise>CACHE-FLOW-DOCS-COMPLETE</promise>` when:
- Landing page is complete and verified
- Docusaurus documentation builds without errors
- All markdown files are written
- Naive reviewer validation passed
- SEO and Playwright verification done
