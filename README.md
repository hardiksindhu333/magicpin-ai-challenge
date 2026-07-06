# magicpin AI Challenge

This project implements a deterministic backend for the Magicpin AI Challenge. It exposes the judge-facing endpoints required by the challenge brief and uses an in-memory context store to maintain category, merchant, customer, and trigger state.

## Structure

- src/app.ts — Express app setup
- src/routes/veraRoutes.ts — versioned API routes
- src/controllers/veraController.ts — request validation and response handling
- src/services/decisionService.ts — tick and reply orchestration
- src/composer/deterministicComposer.ts — deterministic message composition
- src/storage/contextStore.ts — in-memory context persistence

## Scripts

- npm run build
- npm test
- npm run dev

## Notes

The composer is intentionally deterministic and grounded in the provided context. No randomness or model temperature settings are used.
