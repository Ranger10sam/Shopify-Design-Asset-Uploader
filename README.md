# Design Asset Uploader

Internal Next.js app for validating a designer's product folder, generating the correct zip file or zip files, uploading them to S3, and returning final public URLs for spreadsheet entry.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- AWS SDK v3 for S3
- `archiver` for zip generation
- `zod` for validation
- `lucide-react` for icons
- `vitest` for unit tests

## What The App Does

1. Accepts exactly one product folder.
2. Validates the folder structure strictly.
3. Detects whether the upload is a single asset set or a split light/dark asset set.
4. Shows the exact zip filename(s) before upload.
5. Generates the zip file(s) on the server.
6. Uploads the generated zip file(s) to S3.
7. Returns copy-ready public URL(s).

## Required Environment Variables

Copy `.env.example` to `.env.local` and fill in every value:

```bash
cp .env.example .env.local
```

If you are on Windows PowerShell, use:

```powershell
Copy-Item .env.example .env.local
```

Then fill in:

- `AWS_REGION`: AWS region for the S3 bucket, for example `us-east-1`
- `AWS_S3_BUCKET`: bucket name
- `AWS_S3_PREFIX`: optional folder prefix inside the bucket, for example `design-assets`
- `AWS_ACCESS_KEY_ID`: IAM access key
- `AWS_SECRET_ACCESS_KEY`: IAM secret key
- `AWS_PUBLIC_BASE_URL`: public URL base used to build the final result URLs, for example `https://cdn.example.com/design-assets`

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local env file:

   ```bash
   cp .env.example .env.local
   ```

   PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Fill in the AWS values in `.env.local`.

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `npm run dev`: start the local development server
- `npm run build`: create a production build
- `npm run start`: run the production build
- `npm run lint`: run ESLint
- `npm run test`: run unit tests

## Test Locally

Run:

```bash
npm run lint
npm run test
npm run build
```

## Accepted Folder Structure

Upload one product folder. The app only uses the `asset` folder for packaging logic.

### Case A: Single asset case

The `asset` folder contains files directly and no subfolders.

```text
Army Origin T-Shirt/
├─ asset/
│  ├─ front.png
│  └─ back.png
├─ mockups/
└─ notes.txt
```

Output:

```text
Army_Origin_T--Shirt.zip
```

### Case B: Split asset case

The `asset` folder contains exactly these two subfolders and no loose files:

- `for light`
- `for dark`

Both folders must exist and both must contain at least one file.

```text
Army Origin T-Shirt/
├─ asset/
│  ├─ for light/
│  │  ├─ front.png
│  │  └─ nested/
│  │     └─ detail.png
│  └─ for dark/
│     └─ front.png
└─ mockups/
```

Output:

```text
Army_Origin_T--Shirt_For_Light.zip
Army_Origin_T--Shirt_For_Dark.zip
```

## Naming Rules

Zip names are based on the uploaded product folder name:

- spaces become `_`
- hyphens become `--`
- readable casing is preserved
- illegal filename characters are sanitized safely

Example:

```text
Army Origin T-Shirt -> Army_Origin_T--Shirt.zip
```

## Common Errors

- Missing `asset` folder
- Empty `asset` folder
- `asset` contains both loose files and subfolders
- Wrong split folder names such as `light`, `dark`, `Light`, `Dark`, or `for_light`
- Only one of `for light` or `for dark` exists
- Extra folders directly inside `asset`
- `for light` or `for dark` exists but contains no files

## Browser Notes

- Best experience: desktop Chrome or Edge
- The app supports drag and drop and a clickable folder picker
- When supported, the clickable folder picker uses the File System Access API to detect empty directories accurately
- If the browser falls back to the classic folder input, empty directories may not be exposed by the browser

## Production Deployment Notes

- Deploy this app to a Node.js environment because the server route reconstructs files, creates zip archives, and uploads to S3
- Make sure all environment variables above are configured in production
- The IAM credentials used by this app should have permission to put and delete objects in the configured bucket/prefix
- This workflow uploads full folders as multipart form data, so make sure your reverse proxy or hosting platform allows a request body size large enough for expected design uploads
- For internal use, Chrome or Edge on desktop is the recommended browser baseline

## S3 Behavior

- The app uploads only after validation passes
- If multiple zip files are required and one upload fails, the app attempts to delete any zip files that were already uploaded in that run
- Final URLs are built from `AWS_PUBLIC_BASE_URL` plus the uploaded S3 key

## Development Notes

- Business rules live in `src/lib`
- The upload API route is `src/app/api/process/route.ts`
- Unit tests cover normalization, folder validation, and zip naming
