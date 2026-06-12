# Contributing to Arc Escrow

Thank you for contributing to Arc Escrow! This guide covers everything you need to know.

## Prerequisites

- Node.js v22+
- Docker Desktop (for local Supabase)
- Circle Developer Console account
- OpenAI API key

## Development Setup

1. Fork and clone the repository
2. Install dependencies: npm install
3. Copy environment variables: cp .env.example .env.local
4. Generate agent wallet: npm run generate-wallet
5. Start Supabase: npx supabase start
6. Run migrations: npx supabase migration up
7. Start dev server: npm run dev

## Branch Naming

- feat/your-feature-name
- fix/your-bug-fix
- docs/your-documentation
- chore/your-chore

## Commit Messages

Follow Conventional Commits:
- feat: add new feature
- fix: fix a bug
- docs: update documentation
- chore: maintenance tasks

## Pull Request Process

1. Create a branch from master
2. Make your changes
3. Test thoroughly
4. Submit PR with clear description
5. Reference any related issues

## Code Style

- TypeScript strict mode
- ESLint configuration in .eslintrc
- Prettier for formatting

## Testing

- Test all escrow flows end-to-end
- Verify Circle webhook handling
- Test AI validation with sample deliverables

## Environment Variables

Never commit .env.local or any secrets.
Use .env.example as a template.

## Questions?

Open an issue or discussion on GitHub.
