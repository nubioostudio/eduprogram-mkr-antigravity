---
description: Guidelines and standards for Frontend Development (Passive Guide).
---

# Directive: Build Frontend (Passive Guide)

> [!NOTE]
> This directive is a **Passive Guide**. It is described in the PRD but not yet executable as a skill. Use this as a reference for future frontend implementation.

## Tech Stack
- **Framework**: React + TypeScript (Vite)
- **Styling**: Tailwind CSS
- **Components**: ShadCN UI (Radix Primitives)
- **State Management**: React Query (Server state), Context/Zustand (Client state)

## Design Principles
1. **Minimalist & Professional**: Follow a Stripe-like aesthetic. Clean lines, generous whitespace, excellent typography.
2. **Mobile-First**: Ensure all layouts work on mobile devices.
3. **Accessibility**: Use semantic HTML and ARIA labels where necessary.

## Component Structure
- `src/components/ui`: ShadCN base components.
- `src/components/layout`: Layout components (Sidebar, Header).
- `src/components/features`: Feature-specific components (e.g., `DocumentList`, `PDFViewer`).

## Code Standards
- Use Functional Components with Hooks.
- Strong Typing: Avoid `any`. Define interfaces for props and data models.
- File Naming: PascalCase for components (`MyComponent.tsx`), camelCase for utilities (`myUtility.ts`).
