This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!


## CI/CD Pipeline & Deployment Workflow

This project uses a Jenkins-based CI/CD pipeline for automated build, test, deployment, health checks, notifications, and rollback.

### Pipeline Stages
1. **Install & Build**: Installs dependencies and builds the app.
2. **Lint & Test**: Runs linting and tests to ensure code quality.
3. **Environment Validation**: Checks for required environment variables using `scripts/validate-env.js`.
4. **Database Migration**: Applies schema changes with Prisma.
5. **Asset Optimization**: (Optional) Uploads images to Cloudinary and purges CDN cache.
6. **Deploy to Staging**: Deploys to a staging environment for integration testing.
7. **Health Checks**: Runs `scripts/health-check.js` to validate HTTP and DB connectivity.
8. **Promote to Production**: Deploys to production if all checks pass.
9. **Post-Deploy Actions**: Sends Slack notifications and triggers rollback if health checks fail.

### Notifications
Slack notifications are sent after deployment and on rollback using `scripts/notify-slack.js`. Set `SLACK_WEBHOOK_URL` in Jenkins environment.

### Rollback Logic
If health checks fail, the pipeline triggers a rollback and sends a Slack alert. Customize rollback commands in the Jenkinsfile as needed.


## Branch Protection & Automation

The `main` branch is protected to ensure code quality and safe deployments:
- **Required status checks**: All commits must pass CI tests before merging.
- **Pull request reviews**: Merges require at least one approving review and code owner review.
- **Admin enforcement**: Protection rules apply to repository admins.

Branch protection is managed via GitHub CLI and documented in `branch-protection.json`.

Refer to the CI/CD section above for details on automated testing, deployment, notifications, and rollback.

### Branching Model
- `main`: Production branch
- `development`: Feature and integration branch

### Customization
Edit the Jenkinsfile to add more stages, integrations, or deployment targets as needed.
