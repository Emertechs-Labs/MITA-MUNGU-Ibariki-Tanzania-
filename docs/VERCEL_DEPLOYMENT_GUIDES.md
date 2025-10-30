# Vercel Deployment Guides - MITA DAO Platform

## Overview

This document consolidates best practices and guides for deploying frontend applications to Vercel, specifically tailored for the MITA DAO Platform monorepo structure. It combines insights from official Vercel documentation and practical GitHub Actions deployment guides.

## Reference Links

### Official Documentation
- **Vercel Git Integration**: https://vercel.com/docs/git
- **GitHub Actions Deployment Guide**: https://dev.to/ephraimx/a-practical-guide-to-deploying-frontend-apps-on-vercel-using-github-actions-3pf4

## Key Concepts from Vercel Git Integration

### Supported Git Providers
Vercel supports automatic deployments from:
- GitHub (Free, Team, Enterprise Cloud/Server)
- GitLab (Free, Premium, Ultimate, Enterprise, Self-Managed)
- Bitbucket (Free, Standard, Premium, Data Center)
- Azure DevOps Pipelines

### Deployment Types

#### 1. Automatic Deployments
- **Preview Deployments**: Created for every push to non-production branches
- **Production Deployments**: Created when changes merge to the production branch (default: `main`)
- **Instant Rollbacks**: Available for production deployments

#### 2. Manual Deployments
- Create deployments from specific commits (SHA) or branches
- Useful when automatic deployments are interrupted
- Access via Vercel Dashboard → Project → Deployments → Create Deployment

### Monorepo Considerations

For monorepo structures like the MITA platform:

```json
{
  "version": 2,
  "installCommand": "cd frontend && npm install",
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": "create-react-app",
  "rootDirectory": "frontend"
}
```

## GitHub Actions CI/CD Pipeline

### Why GitHub Actions Over Default Integration?

While Vercel's built-in Git integration is convenient, GitHub Actions provides:

- **Custom Logic**: Multi-step build/test processes
- **Conditional Deployments**: Deploy based on specific conditions
- **Monorepo Support**: Better handling of complex project structures
- **Integration**: Seamless integration with other GitHub tools

### Prerequisites for GitHub Actions Deployment

1. **Production-Ready Frontend Application**
   - TypeScript/React application in `frontend/` directory
   - Proper `package.json` with build scripts
   - Environment variables configured

2. **GitHub Repository**
   - Code pushed to GitHub repository
   - Proper branch structure (main for production)

3. **Vercel Account & Project**
   - Vercel project created and linked
   - Personal Access Token generated
   - Project ID obtained

4. **Required Secrets in GitHub**
   - `VERCEL_TOKEN`: Personal access token
   - `VERCEL_ORG_ID`: Organization ID (if applicable)
   - `VERCEL_PROJECT_ID`: Project ID

### GitHub Actions Workflow Template

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [ main, production ]
  pull_request:
    branches: [ main, production ]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Run tests
        run: cd frontend && npm test -- --coverage --watchAll=false

      - name: Build application
        run: cd frontend && npm run build

      - name: Deploy to Vercel
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

      - name: Deploy Preview
        if: github.event_name == 'pull_request'
        uses: amondnet/vercel-action@v25
        id: vercel-preview
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--no-prod'

      - name: Comment PR with Preview URL
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `🚀 Preview deployment ready: ${{ steps.vercel-preview.outputs.preview-url }}`
            })
```

### Obtaining Vercel Credentials

#### 1. Personal Access Token
1. Go to Vercel Dashboard → Account → Developer
2. Generate new token with appropriate permissions
3. Copy the token value

#### 2. Organization ID (if using team)
1. Go to Vercel Dashboard → Settings → General
2. Copy the Organization ID

#### 3. Project ID
1. Go to your Vercel project dashboard
2. Go to Settings → General
3. Copy the Project ID

### Adding Secrets to GitHub

1. Go to GitHub Repository → Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `VERCEL_TOKEN`: Your personal access token
   - `VERCEL_ORG_ID`: Organization ID (if applicable)
   - `VERCEL_PROJECT_ID`: Project ID

## Monorepo-Specific Configuration

### Directory Structure
```
MITA(Mungu Ibariki Tanzania)/
├── frontend/
│   ├── package.json
│   ├── src/
│   ├── public/
│   └── vercel.json (optional)
├── src/ (backend)
├── docs/
└── vercel.json (root config)
```

### Root-Level vercel.json
```json
{
  "version": 2,
  "installCommand": "cd frontend && npm install",
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": "create-react-app",
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "https://mita-backend.vercel.app/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "REACT_APP_API_URL": "https://mita-backend.vercel.app",
    "REACT_APP_HEDERA_NETWORK": "testnet",
    "REACT_APP_ENVIRONMENT": "production"
  }
}
```

### .vercelignore Configuration
```gitignore
# Allow essential files
!vercel.json
!.vercelignore

# Allow entire frontend directory
!frontend/**

# Ignore everything else
*
!frontend/
```

## Deployment Workflow

### 1. Development Phase
- Push feature branches → Automatic preview deployments
- PR created → Preview URL generated and commented
- Team reviews changes on preview deployment

### 2. Production Deployment
- PR merged to main → Production deployment triggered
- Automatic build, test, and deploy
- Instant rollback available if issues detected

### 3. Rollback Process
1. Go to Vercel Dashboard → Project → Deployments
2. Find the deployment to rollback to
3. Click "Rollback" button
4. Confirm the rollback

## Environment Variables

### Development vs Production
```bash
# Development
REACT_APP_API_URL=http://localhost:3000
REACT_APP_HEDERA_NETWORK=testnet
REACT_APP_ENVIRONMENT=development

# Production
REACT_APP_API_URL=https://mita-backend.vercel.app
REACT_APP_HEDERA_NETWORK=mainnet
REACT_APP_ENVIRONMENT=production
```

### Setting Environment Variables in Vercel
1. Go to Project Dashboard → Settings → Environment Variables
2. Add variables for different environments
3. Variables prefixed with `REACT_APP_` are available in frontend

## Troubleshooting Common Issues

### Build Failures
- **Issue**: `index.html` not found
- **Solution**: Ensure `public/` directory exists in build root
- **Check**: Verify `installCommand` and `buildCommand` paths

### Dependency Issues
- **Issue**: Modules not found during build
- **Solution**: Check `package.json` and `package-lock.json`
- **Check**: Ensure dependencies installed in correct directory

### Environment Variables
- **Issue**: Variables not available in build
- **Solution**: Prefix with `REACT_APP_` for Create React App
- **Check**: Variables configured in Vercel dashboard

### Monorepo Conflicts
- **Issue**: Wrong directory being deployed
- **Solution**: Use `rootDirectory` or adjust build commands
- **Check**: Verify `.vercelignore` includes necessary files

## Security Considerations

### Private Repository Deployments
- Commit authors must have Vercel project access
- Pro teams require team membership verification
- Public repos have different access rules

### Deployment Protection
- Enable password protection for staging
- Use Vercel Authentication for sensitive deployments
- Configure domain restrictions

## Performance Optimization

### Build Performance
- Use build caches when possible
- Optimize bundle size
- Implement code splitting

### Deployment Speed
- Use multiple build machines for large projects
- Enable concurrent builds
- Prioritize production builds

## Monitoring and Analytics

### Deployment Monitoring
- Track deployment success rates
- Monitor build times
- Set up failure notifications

### Application Monitoring
- Use Vercel Analytics for performance metrics
- Monitor error rates
- Track user engagement

## Best Practices Summary

1. **Use GitHub Actions** for complex workflows and monorepos
2. **Configure proper .vercelignore** to include only necessary files
3. **Set up environment variables** correctly for different stages
4. **Test deployments** on preview URLs before merging
5. **Monitor deployments** and set up alerts for failures
6. **Use rollbacks** when issues occur in production
7. **Secure sensitive deployments** with appropriate protection

## Next Steps

1. **Implement the GitHub Actions workflow** from this guide
2. **Configure Vercel project settings** for the monorepo
3. **Set up environment variables** in Vercel dashboard
4. **Test the deployment pipeline** with a feature branch
5. **Monitor and optimize** build performance
6. **Set up monitoring and alerts** for production deployments

---

*This guide combines official Vercel documentation with practical GitHub Actions deployment strategies, specifically adapted for the MITA DAO Platform's monorepo structure.*</content>
<parameter name="filePath">e:\Polymath Universata\Projects\MITA(Mungu Ibariki Tanzania)\docs\VERCEL_DEPLOYMENT_GUIDES.md