# Date Concierge v0.2 — changed/new files only

This patch is for an existing standalone Date Concierge v0.1 project. It does not include the original pH7Builder repository.

## Apply
1. Back up your current project folder or create a Git commit first.
2. Extract this ZIP into the ROOT of your existing `date-concierge` project and allow matching files to be overwritten. Do not extract into a new nested folder.
3. Follow `DELETE_OLD_FILES.txt` to remove the two obsolete v0.1 assets after confirming the new homepage loads the new site CSS/JS.
4. Review `README.md`; configure a Neon PostgreSQL test database and Vercel `DATABASE_URL` before testing live auth.
5. Run `npm run check`, then `npm install` and `npm run test:auth` after dependencies are installed.

This is a patch, not a complete project ZIP. If the target folder is not the previous Date Concierge standalone v0.1 project, use the complete v0.2 archive instead.
