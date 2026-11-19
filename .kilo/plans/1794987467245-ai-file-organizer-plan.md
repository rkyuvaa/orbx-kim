# AI File Organizer — Implementation Plan

## Understanding

Build a new, single-user Windows application in `D:\AI Temp Worktree`. It will run locally but open in a browser, read large batches of documents, use OmniRoute to design a content-based folder structure, show one batch preview, then create folders and move approved files. The target folder is empty; no existing application code needs to be preserved.

## Assumptions and Decisions

- `.pf` in the request means `.pdf`.
- Workflow: **Select folder → Scan/extract → AI planning → Preview → Apply → History/Undo**. Nothing moves before Apply.
- Support PDF, DOCX, XLSX/XLSM, CSV, TXT, PNG, JPEG, TIFF, BMP, and WebP. Legacy DOC/XLS, encrypted, corrupt, unsupported, and unreadable files become **Needs Review**.
- Use local English OCR for images and scanned PDFs. Do not send original documents or images to AI.
- Send only filenames, basic metadata, and bounded text excerpts through OmniRoute. Show this privacy behavior clearly before scanning.
- Default OmniRoute base URL: `http://localhost:20128/v1`; API key and model are user-configurable. Assume a 128K-capable model, but never depend on a large context window.
- Design for more than 500 files with persisted, resumable jobs and small AI requests. Defaults: at most 20 files and approximately 8,000 estimated input tokens per request, at most 1,200 extracted characters per file; expose these as advanced settings.
- AI groups by content and purpose, with at most two folder levels. Optional scan instructions can request grouping such as client/year.
- Recursion is optional per scan and defaults off. Always exclude the output tree, reparse points/symlinks, system files, and Office lock files.
- Output is `Selected Folder\Organized\Category\Optional Subcategory\original filename.ext`.
- Preserve filenames and contents. Never overwrite or delete files. Destination name conflicts remain unmoved and are reported.
- Unreadable and low-confidence files (default confidence below 0.65) remain in their original location under Needs Review; other valid files can still be applied.
- Out of scope for the first version: continuous folder watching, multi-user/cloud service, duplicate removal, document editing, AI renaming, legacy Office conversion, and a packaged installer.

## Business Flow

1. **Configure:** Enter/test OmniRoute URL, API key, and model. Validate local OCR availability. Store the API key in Windows Credential Manager through `keyring`, never in SQLite, browser storage, source code, or logs.
2. **Inventory:** Select a folder through a backend-launched native Windows folder dialog or a validated path input. Record stable file IDs, relative paths, size, and modification time; do not load the whole corpus into memory.
3. **Extract locally:** Parse supported formats with bounded pages/rows/characters. Render and OCR the first two PDF pages only when normal PDF text is insufficient. Never execute macros or follow external workbook links.
4. **Plan with AI:** Send compact, token-budgeted batches. Each result contains only file ID, proposed folder path, confidence, and a short reason. Carry a compact discovered taxonomy into later batches to encourage folder reuse; consolidate duplicate taxonomy entries when it grows and at the end, then remap file destinations locally.
5. **Preview:** Show folder tree, file destinations, confidence/reasons, extraction errors, and conflicts. Allow destination edits, exclusion, and filtering without requiring file-by-file approval. Revalidate every edit server-side.
6. **Apply:** Recheck source fingerprint and destination availability, then journal and move files one at a time. Continue after individual failures and finish with moved/skipped/failed counts.
7. **Undo:** Reverse eligible moves from a selected batch without overwriting files. Report any item that cannot be restored. Never automatically retry an uncertain move after a crash.

## Architecture

- **Backend:** Python 3.12+, FastAPI, Uvicorn, SQLModel/SQLite (WAL mode), Pydantic validation, OpenAI Python SDK configured for OmniRoute, and `keyring`.
- **Readers:** PyMuPDF, `python-docx`, `openpyxl`, Pillow, and `pytesseract`; use standard-library CSV/TXT readers. Detect Tesseract and its English data at startup and provide a clear setup error rather than installing system software automatically.
- **Frontend:** React, TypeScript, Vite, and plain CSS. FastAPI serves the production frontend build. Provide New Scan, Progress, Plan Preview, History, and Settings views with real empty states and no demo data.
- **Runtime:** Bind only to `127.0.0.1`, use same-origin requests plus a per-launch API token, and allow one active organization job per app instance. Supply project-local setup/start scripts; the start script builds if needed, starts the app, and opens the browser.
- **Isolation:** Keep Python dependencies in `D:\AI Temp Worktree\.venv` and Node dependencies inside the project. Runtime data goes in the project `data/` directory, not in users' document folders.

## Data Model and State

- `jobs`: UUID, source/destination roots, recursive flag, custom instructions, model and planning limits, state, stage progress, timestamps, and sanitized error.
- `file_items`: job ID, stable UUID, source/current relative paths, size, `mtime_ns`, type, extraction status/error, bounded excerpt, proposed/final destination, confidence, reason, review/conflict flags, and item state. Index by job and state.
- `categories`: job ID, proposed path, canonical path, description, and consolidation status.
- `ai_batches`: job ID, sequence, stage, file/category IDs, token estimate, state, attempts, and sanitized error. Completed batches are not requested again on resume.
- `move_operations`: job/file ID, original and final absolute paths, source fingerprint, move state, undo state, timestamps, and error. This is the durable audit trail.
- Job states: `created → scanning → extracting → planning → awaiting_approval → applying → completed | completed_with_errors`; support `cancelled`, `failed`, and `interrupted` with explicit resume rules.
- On restart, reconcile journaled in-flight operations against actual paths. Resume unfinished extraction/AI batches; never automatically continue an interrupted Apply without reconciliation and user action.

## API and Safety Logic

- `GET /api/health`; `GET/PUT /api/settings`; `POST /api/settings/test`; `GET /api/models`.
- `POST /api/dialogs/browse-folder` for a local native folder dialog.
- `POST /api/jobs`; `GET /api/jobs`; `GET /api/jobs/{id}`; `GET /api/jobs/{id}/files` with status/search filters.
- `PATCH /api/jobs/{id}/plan` for validated destination/exclusion edits.
- `POST /api/jobs/{id}/apply`, `/cancel`, `/resume`, and `/undo`.
- Use OmniRoute's OpenAI-compatible `POST {base_url}/chat/completions` and `GET {base_url}/models`. Use conservative character-based token estimates, request timeouts, bounded output, limited retries with backoff/`Retry-After`, and one malformed-response retry. Validate all JSON with Pydantic; do not depend on provider-specific tool calling.
- Treat document text as untrusted data and instruct the model to ignore embedded instructions. The AI receives no tools and cannot execute file operations.
- Resolve and verify every source and destination path server-side. Reject absolute/traversing AI paths, `..`, invalid Windows names, excessive depth/length, and anything outside the selected `Organized` root.
- Use same-volume, no-overwrite moves within the selected source tree. Commit journal state before and after each operation; filesystem moves are not claimed to be one atomic batch transaction.
- Redact secrets and excerpts from logs. Keep original files on disk except for the explicitly approved move and its undo.

## Ordered Implementation Tasks

1. Scaffold the backend/frontend in `D:\AI Temp Worktree`, project-local configuration, SQLite schema, loopback security, health checks, and setup/start scripts.
2. Implement folder selection, inventory, supported readers, English OCR fallback, extraction limits, and clear per-file errors.
3. Implement OmniRoute settings/connection testing, strict response schemas, token-budgeted persisted batches, taxonomy reuse/consolidation, retry/resume, and progress reporting.
4. Build the scan/progress/preview UI, including folder tree, confidence/reasons, conflicts, Needs Review, destination editing, exclusions, and empty states.
5. Implement server-side plan validation, journaled Apply, cancellation, partial-failure reporting, restart reconciliation, and Undo.
6. Add automated tests and run backend, frontend, end-to-end, scale, security, and opt-in OmniRoute smoke validation. Do not commit or push unless explicitly requested.

## Test Cases and Acceptance Criteria

- Unit-test every reader, scanned-PDF/image OCR fallback, macro-safe workbook reading, unsupported/encrypted/corrupt input, excerpt limits, token batching, malformed AI JSON, taxonomy mapping, and Windows path sanitization.
- API-test job transitions, resume without duplicate AI batches, preview edits, secret redaction, and rejection of Apply before a valid preview.
- Use temporary directories to test Apply/Undo, duplicate destinations, missing/changed sources, locked files, path traversal, cancellation, partial failure, and simulated crash between journal updates and moves.
- Simulate at least 1,000 files with mocked extraction/AI; verify bounded request tokens/file counts, stable memory use, progress, retry, and resume. No large real-AI test is required.
- Playwright-test the main flow with fake AI: configure → select temporary folder → scan → preview → Apply → verify files → Undo. Test empty and failure views without hardcoded demo rows.
- Run a small opt-in OmniRoute smoke test using non-sensitive synthetic text to verify authentication, model listing, JSON validation, timeout, and rate-limit handling.
- Acceptance requires: no pre-Apply moves; no overwrite/delete/rename; output exclusion on rerun; uncertain/conflicted files left in place; accurate move audit; eligible Undo restoration; and successful processing of more than 500 files through separate bounded requests.

## Risks

- AI can misclassify even with good extraction: mitigate with concise reasons, confidence, preview, and Undo.
- OCR quality varies: low-confidence/unreadable files remain unmodified; English-only OCR is explicit.
- Taxonomy drift across batches: carry forward and consolidate canonical categories before preview.
- AI cost/rate limits: use excerpts, small batches, persisted completed work, configurable limits, and no automatic full-corpus retries.
- Windows locks/long paths and external changes can prevent moves: revalidate, skip safely, and report rather than forcing operations.
- Local hosting does not make remote AI private: the UI must state exactly what is sent to the configured OmniRoute provider.
