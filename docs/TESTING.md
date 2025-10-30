# Testing Guide for MITA DAO Platform

This guide outlines the testing strategy for the MITA (Mungu Ibariki Tanzania) platform, ensuring reliability, security, and DAO governance integrity before deployment.

## Testing Overview

### Types of Tests
- **Unit Tests**: Test individual functions, modules, and services in isolation.
- **Integration Tests**: Test interactions between components, APIs, and external services.
- **End-to-End (E2E) Tests**: Simulate full user workflows (future: using Playwright or Cypress).
- **Security Tests**: Validate encryption, authentication, and access controls.

### Tools
- **Backend**: Jest for unit/integration tests, Supertest for API testing.
- **Frontend**: React Testing Library + Jest (built-in with Create React App).
- **CI/CD**: GitHub Actions for automated testing on branches.

## Setup

### Backend Tests
1. Install dependencies (added to root `package.json`):
   ```bash
   npm install --save-dev jest supertest
   ```
2. Run tests: `npm test`
3. Coverage: `npm run test:coverage`

### Frontend Tests
1. Tests are pre-configured in `frontend/package.json`.
2. Run: `cd frontend && npm test`
3. Add tests in `frontend/src/__tests__/` or alongside components (e.g., `Component.test.js`).

## Writing Tests

### Unit Tests Example (Backend Service)
```javascript
const { submitVote } = require('../services/votingSystem');

describe('Voting System', () => {
  test('should handle valid vote submission', async () => {
    // Mock dependencies
    // Assert success
  });

  test('should throw error on invalid input', async () => {
    // Assert error handling
  });
});
```

### Integration Tests Example (API)
```javascript
const request = require('supertest');
const app = require('../server/index');

describe('API Integration', () => {
  test('POST /api/vote should return 200 on success', async () => {
    const response = await request(app)
      .post('/api/vote')
      .send({ vote: 'yes' })
      .expect(200);
    // Assertions
  });

  test('should handle errors gracefully', async () => {
    // Test 400, 500 scenarios
  });
});
```

### Frontend Tests Example
```javascript
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';

test('renders dashboard with user data', () => {
  render(<Dashboard />);
  expect(screen.getByText('Welcome')).toBeInTheDocument();
});
```

## Error Handling in Tests
- Test error boundaries, middleware, and service failures.
- Mock external APIs (Hedera, AI services) to simulate failures.
- Validate logging and user-facing error messages.

## CI/CD Integration
- Tests run automatically on pushes to `dev`, `preview`, and `production` branches.
- See `.github/workflows/test.yml` for configuration.
- Coverage reports uploaded to Codecov (future).

## Running Tests Locally
```bash
# Backend
npm test

# Frontend
cd frontend && npm test

# All
npm run test:all
```

## Coverage Goals
- Unit: 80%+
- Integration: 70%+
- E2E: 50% (initial)

## Contributing
- Write tests for new features.
- Update tests on refactors.
- Report flaky tests as issues.

For questions, see `CONTRIBUTING.md` or open an issue.