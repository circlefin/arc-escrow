# Contributing to arc-escrow

Thank you for your interest in contributing to arc-escrow! This document provides guidelines and instructions for contributing to the project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Message Conventions](#commit-message-conventions)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Issue Reporting](#issue-reporting)
- [Security](#security)

---

## Code of Conduct

### Our Pledge
We are committed to providing a welcoming and inclusive environment for all contributors, regardless of experience level, gender, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

### Expected Behavior
- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

### Enforcement
Instances of unacceptable behavior may be reported to the project maintainers. All complaints will be reviewed and investigated promptly and fairly.

---

## Getting Started

### Prerequisites
Before contributing, ensure you have:
- Node.js v20.20.1 or higher
- npm or yarn package manager
- Git installed and configured
- A GitHub account
- Docker Desktop (for local Supabase development)

### Fork and Clone
1. Fork the repository on GitHub
2. Clone your fork locally:
````bash
git clone https://github.com/YOUR_USERNAME/arc-escrow.git
cd arc-escrow
````

3. Add upstream remote:
````bash
git remote add upstream https://github.com/circlefin/arc-escrow.git
````

### Install Dependencies
````bash
npm install
````

### Set Up Environment
1. Copy environment template:
````bash
cp .env.example .env.local
````

2. Fill in required values (see README.md for details)

3. Generate agent wallet:
````bash
npm run generate-wallet
````

4. Set up database:
````bash
# For local development
npx supabase start
npx supabase migration up

# Or link to remote Supabase
npx supabase link --project-ref <your-ref>
npx supabase db push
````

### Run Development Server
````bash
npm run dev
````

Visit http://localhost:3000 to see the app.

---

## Development Workflow

### Branch Naming Convention
Create descriptive branch names following this pattern:

- `feat/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/documentation-topic` - Documentation updates
- `refactor/component-name` - Code refactoring
- `test/test-description` - Test additions
- `chore/task-description` - Maintenance tasks

**Examples:**
````bash
git checkout -b feat/ai-validation-improvements
git checkout -b fix/webhook-signature-verification
git checkout -b docs/api-documentation
````

### Keep Your Fork Updated
Before starting work, sync with upstream:

````bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
````

### Making Changes
1. Create a new branch from `main`
2. Make your changes
3. Test thoroughly
4. Commit with clear messages
5. Push to your fork
6. Open a pull request

---

## Pull Request Process

### Before Submitting
- ✅ Code follows project style guidelines
- ✅ All tests pass
- ✅ Documentation is updated
- ✅ Commit messages follow conventions
- ✅ Branch is up-to-date with main
- ✅ No merge conflicts

### PR Title Format
Follow conventional commits format:
type(scope): brief description
Examples:
feat(wallet): add multi-signature support
fix(validation): handle edge case in AI parsing
docs(readme): update installation instructions
refactor(api): optimize database queries

### PR Description Template
````markdown
## Description
Brief summary of changes

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to break)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## How Has This Been Tested?
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing
- [ ] Tested on Arc testnet

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where needed
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
- [ ] Any dependent changes have been merged

## Related Issues
Closes #[issue-number]
````

### Review Process
1. Maintainers will review your PR within 1-2 weeks
2. Address any requested changes
3. Once approved, a maintainer will merge your PR
4. Your contribution will be credited in the release notes

---

## Code Style Guidelines

### TypeScript
````typescript
// ✅ Good: Use descriptive names
const userWalletAddress = await getUserWallet(userId)

// ❌ Bad: Unclear abbreviations
const uwa = await getUsrWlt(uid)

// ✅ Good: Type everything
interface Agreement {
  id: string
  amount: number
  status: 'pending' | 'funded' | 'completed'
}

// ❌ Bad: Using any
const agreement: any = {...}

// ✅ Good: Use async/await
const result = await fetchData()

// ❌ Bad: Using callbacks or promises directly
fetchData().then(result => {...})
````

### React Components
````typescript
// ✅ Good: Functional components with TypeScript
interface Props {
  agreementId: string
  onSubmit: (data: FormData) => Promise<void>
}

export function SubmissionForm({ agreementId, onSubmit }: Props) {
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await onSubmit(data)
    } finally {
      setLoading(false)
    }
  }
  
  return <form onSubmit={handleSubmit}>...</form>
}

// ❌ Bad: Class components or untyped props
export default function SubmissionForm(props) {
  // ...
}
````

### API Routes
````typescript
// ✅ Good: Type-safe error handling
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Validate input
    if (!body.agreementId) {
      return NextResponse.json(
        { error: 'Agreement ID required' },
        { status: 400 }
      )
    }
    
    // Process request
    const result = await processSubmission(body)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Submission error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
````

### File Organization
app/
├── api/
│   ├── agreements/
│   │   └── route.ts          # POST /api/agreements
│   ├── submissions/
│   │   └── route.ts          # POST /api/submissions
│   └── webhooks/
│       └── circle/
│           └── route.ts      # POST /api/webhooks/circle
├── (dashboard)/
│   ├── agreements/
│   │   └── page.tsx
│   └── layout.tsx
components/
├── ui/                       # shadcn/ui components
└── [feature]/               # Feature-specific components
├── AgreementCard.tsx
└── SubmissionForm.tsx
lib/
├── supabase/
│   ├── client.ts
│   └── server.ts
└── circle/
├── wallets.ts
└── webhooks.ts

### Naming Conventions
- **Files**: PascalCase for components (`AgreementCard.tsx`), camelCase for utilities (`walletHelpers.ts`)
- **Components**: PascalCase (`AgreementCard`, `SubmissionForm`)
- **Functions**: camelCase (`getUserWallet`, `validateSubmission`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`, `USDC_TOKEN_ID`)
- **Types/Interfaces**: PascalCase (`Agreement`, `SubmissionData`)

---

## Commit Message Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format
<type>(<scope>): <subject>
<body>
<footer>
`````
Types

feat: New feature
fix: Bug fix
docs: Documentation changes
style: Code style changes (formatting, no logic change)
refactor: Code refactoring
perf: Performance improvements
test: Adding or updating tests
chore: Build process or auxiliary tool changes

Scope
The scope should specify the area of change:

wallet: Wallet-related changes
api: API route changes
ui: UI component changes
validation: AI validation logic
db: Database schema or queries
webhooks: Webhook handling

Examples
bash# Simple feature
git commit -m "feat(wallet): add wallet balance display"

# Bug fix with body
git commit -m "fix(validation): handle empty file uploads

Previously, empty files would crash the validation endpoint.
Now we return a clear error message to the user."

# Breaking change
git commit -m "feat(api)!: change agreement schema

BREAKING CHANGE: The 'criteria' field is now required and must be a non-empty string."

# Documentation
git commit -m "docs(readme): add troubleshooting section"

# Chore
git commit -m "chore(deps): update circle-sdk to v4.7.0"
Commit Best Practices

✅ Use the imperative mood ("add feature" not "added feature")
✅ Keep subject line under 72 characters
✅ Capitalize the subject line
✅ Don't end subject line with a period
✅ Separate subject from body with a blank line
✅ Use the body to explain what and why, not how


Testing Guidelines
Test Structure
typescript// components/__tests__/AgreementCard.test.tsx
import { render, screen } from '@testing-library/react'
import { AgreementCard } from '../AgreementCard'

describe('AgreementCard', () => {
  it('renders agreement details correctly', () => {
    const agreement = {
      id: '123',
      amount: 1000,
      status: 'pending'
    }
    
    render(<AgreementCard agreement={agreement} />)
    
    expect(screen.getByText('1000 USDC')).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
  })
  
  it('handles missing data gracefully', () => {
    render(<AgreementCard agreement={null} />)
    
    expect(screen.getByText('No agreement found')).toBeInTheDocument()
  })
})
API Testing
typescript// api/__tests__/agreements.test.ts
import { POST } from '../agreements/route'

describe('POST /api/agreements', () => {
  it('creates agreement successfully', async () => {
    const request = new Request('http://localhost/api/agreements', {
      method: 'POST',
      body: JSON.stringify({
        beneficiaryId: 'user-123',
        amount: 1000,
        criteria: 'Complete website redesign'
      })
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.agreement).toBeDefined()
    expect(data.agreement.amount).toBe(1000)
  })
  
  it('validates required fields', async () => {
    const request = new Request('http://localhost/api/agreements', {
      method: 'POST',
      body: JSON.stringify({})
    })
    
    const response = await POST(request)
    
    expect(response.status).toBe(400)
  })
})
Running Tests
bash# Run all tests
npm test

# Run specific test file
npm test AgreementCard.test.tsx

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

Documentation
Code Comments
typescript// ✅ Good: Explain why, not what
// Use exponential backoff to handle rate limits gracefully
const delay = Math.pow(2, attempt) * 1000

// ❌ Bad: Stating the obvious
// Increment i by 1
i++

// ✅ Good: Document complex logic
/**
 * Validates submission deliverables using OpenAI GPT-4 Vision.
 * 
 * The AI analyzes the submitted file against the agreement criteria
 * and returns a structured validation result with approval status
 * and detailed reasoning.
 * 
 * @param file - The uploaded file (image, PDF, or document)
 * @param criteria - Agreement criteria to validate against
 * @returns Validation result with approval boolean and reasoning
 * @throws {OpenAIError} If the API request fails
 */
async function validateWithAI(file: File, criteria: string): Promise<ValidationResult>
README Updates
When adding features, update README.md:

Add to feature list
Update prerequisites if needed
Add usage examples
Update troubleshooting if relevant

API Documentation
Document new API endpoints in docs/API.md:
markdown## POST /api/submissions

Creates a new submission for an agreement.

### Request Body
```json
{
  "agreementId": "uuid",
  "fileUrl": "string"
}
```

### Response
```json
{
  "submission": {
    "id": "uuid",
    "status": "pending",
    "createdAt": "timestamp"
  }
}
```

### Errors
- `400` - Invalid request body
- `404` - Agreement not found
- `500` - Server error

Issue Reporting
Bug Reports
Use the bug report template:
markdown**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. macOS 13.0]
- Node: [e.g. v20.20.1]
- Browser: [e.g. Chrome 120]

**Additional context**
Any other relevant information.
Feature Requests
markdown**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Other approaches you've thought about.

**Additional context**
Mockups, examples, or references.

Security
Reporting Security Issues
DO NOT open public issues for security vulnerabilities.
Instead:

Email security concerns to: [security@circle.com]
Include detailed description
Provide steps to reproduce
Suggest a fix if possible

See SECURITY.md for more details.
Security Best Practices

Never commit API keys or secrets
Use environment variables for sensitive data
Follow principle of least privilege
Validate all user inputs
Use parameterized queries
Keep dependencies updated


Questions?

Documentation: Check docs/ folder
Issues: Search existing issues first
Discussions: Use GitHub Discussions for questions
Circle Support: https://developers.circle.com


License
By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE).

Thank You! 🎉
Your contributions make this project better for everyone. We appreciate your time and effort!
