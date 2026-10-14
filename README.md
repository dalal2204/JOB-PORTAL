# MERN Job Portal

## AI resume matching

Recruiter applicants are ranked using a persisted analysis attached to each existing `Application`. Applying still creates the ordinary application with its existing `pending`/`accepted`/`rejected` status. The backend then attempts a PDF analysis; parse or provider failures are saved on that application and do not remove it. Recruiters can retry pending, failed, stale, and completed analyses whose semantic criterion was unavailable. Other completed results are reused across refreshes and become pending for review if the applicant's resume URL or the job description, title, requirements, experience level, or analysis pipeline version changes.

Resume text is extracted from the PDF already stored in the student's Cloudinary profile. Uploads are limited to 8 MB; the resume endpoint checks PDF type and signature. Analysis downloads only HTTPS URLs for `res.cloudinary.com` under the configured Cloudinary account, rejects redirects, and enforces a 12-second download timeout and byte limit. Text is normalized and split into overlapping chunks. This supports text-based PDFs; scanned/image-only PDFs without extractable text are reported as unsupported.

The configurable taxonomy and aliases are in `backend/utils/skillTaxonomy.js`. The current scoring weights are:

| Criterion | Weight |
| --- | ---: |
| Required-skill evidence | 35% |
| Semantic relevance | 30% |
| Project and experience evidence | 25% |
| Experience-level fit | 10% |
| **Total** | **100%** |

Unavailable criteria are excluded and the remaining available weights are renormalized for that score. A criterion is never awarded points just because a resume section exists. Skills marked “not found” were not found in extracted text; that is not evidence the candidate lacks them. Scores are heuristic job-relevance estimates, not hiring probabilities or guarantees.

Semantic similarity uses Google's `@google/genai` embeddings API. Set `GEMINI_API_KEY` in `backend/.env`; `GEMINI_EMBEDDING_MODEL` selects the embedding model and defaults to `gemini-embedding-001`. The same model embeds job and resume text chunks in one request, and the provider validates that returned vectors are finite, nonempty, and dimension-compatible before cosine similarity is calculated. When Gemini is unavailable, semantic similarity is excluded and the UI records the limitation alongside the available criteria. No fabricated semantic score is saved. API keys and embedding vectors are not stored in MongoDB.

### Environment and installation

Copy `backend/.env.example` to `backend/.env`, then set MongoDB, JWT, and Cloudinary values for your local environment. Set `GEMINI_API_KEY` to an API key from Google AI Studio to enable semantic matching. Do not commit real credentials.

```powershell
cd backend
npm install
npm test
npm run dev
```

In another terminal:

```powershell
cd frontend
npm install
npm run lint
npm run build
npm run dev
```

The PDF dependency is `pdf-parse` 2.x (locked at 2.4.5), whose declared Node.js range is `>=20.16.0 <21 || >=22.3.0`. Node.js 24 satisfies that range, but this repository does not pin a required Node.js version. Backend tests use Node's built-in test runner and do not require production data or a database. Startup inspects existing application duplicates before adding the unique `(job, applicant)` index; if legacy duplicates exist, it keeps them and skips that index. Newly created applications also receive a private deterministic deduplication key protected by a partial unique index, so concurrent submissions remain idempotent without requiring a cleanup migration.

### Lifecycle and local verification

Analysis runs once after application persistence. Each Gemini embedding request has a 12-second timeout; this is not a single end-to-end analysis deadline. A process interrupted during analysis leaves a persisted `processing` state; recruiters may retry it after 15 minutes. Ranking reads never re-run completed analyses. Existing applications with no analysis are presented as pending and can be retried.

For a manual end-to-end check, configure the backend and frontend, start MongoDB and both apps, create a recruiter job with requirements, create a student profile, upload a text-based PDF resume, apply, and open that job's Applicants page. Confirm that the applicant appears, inspect the score breakdown/evidence and skill chips, change the application status, test filters and the Top N selector, then retry a failed, pending, or semantically incomplete analysis. Repeat without `GEMINI_API_KEY` to confirm the semantic criterion is explicitly unavailable. Verify a different recruiter cannot load the ranking, detail, or retry endpoints for that job.

## Existing application

The application remains a React/Vite/Redux/Tailwind frontend and Express/Mongoose backend. Start the API from `backend` and the web app from `frontend`. Recruiter job management, student applications, profile editing, and manual application status updates remain on the existing routes and models.
