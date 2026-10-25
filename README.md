# Date Concierge — Auth UI Preview

A clean, standalone static website for the first Date Concierge login and registration UI milestone. This is its own project, with Date Concierge-owned HTML, CSS and JavaScript. No source repository from another dating platform is bundled or required.

## Current scope

- `/` — login UI
- `/register.html` (also `/register` on Vercel with clean URLs) — registration UI
- Responsive styling and CSS animations, with a reduced-motion accessibility fallback
- Browser-native form validation and an age-18 date-of-birth maximum
- Preview notices explaining that no authentication backend is connected yet

## Important limitation

This is a UI-only preview. Form submissions are intercepted in the browser and no values are sent to a server or stored. Do not enter real passwords or sensitive personal data. Authentication, database persistence, email/OTP verification, profiles, subscriptions, credits and refunds are not implemented in this preview.

## Project structure

```text
.
├── index.html                 # Login page
├── register.html              # Registration page
├── assets/
│   ├── css/auth.css           # Standalone Date Concierge styles and animations
│   └── js/auth.js             # Preview-only validation and notices
├── favicon.svg
├── vercel.json                # Static deployment configuration
├── tools/verify_project.py    # Dependency-free file/reference checks
├── docs/NEXT_STEPS.md         # Planned next implementation milestones
├── .gitignore
└── README.md
```

## Zero-cost local preview

From the project root, run:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/` and `http://localhost:8000/register.html`. Press `Ctrl+C` to stop the server.

## Verify the project

```powershell
python tools/verify_project.py
```

This checks required files, local assets, form IDs and accidental references to upstream framework-specific classes. It does not test a live backend or complete browser rendering.

## Push to a new GitHub repository

1. Extract this ZIP into a new folder named `date-concierge`.
2. Create an empty GitHub repository for Date Concierge.
3. Open PowerShell in this folder and run:

```powershell
git init
git add .
git commit -m "Create Date Concierge auth UI preview"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/date-concierge.git
git push -u origin main
```

Replace the placeholder remote URL with your actual new repository URL. If the folder is already a Git repository, do not repeat `git init` or `git remote add`.

## Deploy to Vercel

1. Import the new Date Concierge repository in Vercel.
2. Keep Root Directory as `./` (the repository root).
3. Framework Preset: `Other`.
4. Build Command: enable the override and leave the command empty to skip the build.
5. Output Directory: `.` if Vercel asks for an explicit static output directory.
6. Install Command: leave unset. There are no npm or Python dependencies for this plain HTML/CSS/JavaScript preview.
7. Deploy. Open `/` for login and `/register` (or `/register.html`) for registration.

## Dependencies

No Python or npm packages are required for the current static preview. A `requirements.txt` would be misleading because the website is plain HTML, CSS and JavaScript, with no Python runtime. If a backend is added later, its dependencies will be declared in the appropriate manifest for that backend.
