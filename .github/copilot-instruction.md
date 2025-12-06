# COPILOT EDITS OPERATIONAL GUIDELINES
           
## Key Principles
- Focus on readability over being performant.
- Fully implement all requested functionality.
- Leave NO todo's, placeholders or missing pieces.
- Be sure to reference file names.
- Be concise. Minimize any other prose.
- If you think there might not be a correct answer, you say so. If you do not know the answer, say so instead of guessing.
- Only write code that is necessary to complete the task.
- Rewrite the complete code only if necessary.
- Update relevant tests or create new tests if necessary.
- Do not perform tests that require starting the backend api, starting or querying the database, or launching the frontend service (npm run) unless explicitly instructed to do so. Leave high-level testing to the the developer. Do run unit tests after updating them or asked to find issues in them. 

## General guidelines

### React & TypeScript
- React 18 Best Practices - Hooks, functional components, performance
- TypeScript React Patterns - Props typing, component interfaces, generic components
- React Router 6 Patterns - Modern routing, protected routes, navigation
### Styling & UI
- Tailwind CSS Best Practices - Utility composition, component patterns, responsive design
- Accessible UI Components - ARIA patterns, keyboard navigation, semantic HTML
- React Component Design Patterns - Composition vs inheritance, render props, compound components

### Code Quality & Architecture
- Clean Code Principles - Function naming, component structure, file organization
- React Performance Optimization - Memoization, lazy loading, bundle splitting
- Error Handling Patterns - Error boundaries, async error handling, user feedback

### API Integration
- TypeScript API Client Patterns - Type-safe HTTP clients, error handling, response validation
- React Data Fetching Patterns - Loading states, error states, caching strategies
- WebSocket Integration - Connection management, message handling, reconnection

### Development & Testing
- Vite Configuration - Build optimization, environment variables, proxy setup
- React Testing Patterns - Component testing, integration testing, mocking
- TypeScript Configuration - Strict mode, path mapping, build optimization

### Accessibility & UX
- Web Accessibility Guidelines (WCAG) - Screen reader support, keyboard navigation
- Progressive Enhancement - Graceful degradation, loading states, offline support
- Mobile-First Design - Responsive layouts, touch interactions, performance

This stack represents a modern, lightweight approach focusing on:

Type safety (TypeScript)
Fast development (Vite + HMR)
Utility-first styling (Tailwind)
Component composition (React 18)
Minimal dependencies (no heavy state management or UI libraries)

## Folder Structure
    Reference #file:../ProjectStructure.md for the project components and directory layout to follow. If a large refactor is appropriate to complete a task, ask for explicit permission before changing this structure. 

## REFACTORING GUIDANCE
When refactoring large files:
- Break work into logical, independently functional chunks
- Ensure each intermediate state maintains functionality
- Consider temporary duplication as a valid interim step
- Always indicate the refactoring pattern being applied
                
## RATE LIMIT AVOIDANCE
- For very large files, suggest splitting changes across multiple sessions
- Prioritize changes that are logically complete units
- Always provide clear stopping points
            
## General Requirements
    Use modern technologies as described below for all code suggestions. Prioritize clean, maintainable code with appropriate comments.          

---
applyTo: "**/*.go"
description: "Global rules for all Golang projects"
---

# Golang Global Rules

    Error Handling: Always use standard `if err != nil` checks. Do not panic unless absolutely necessary.

    Logging: Use `zerolog` for logging. Do not suggest `fmt.Println` or the standard `log` package.

    Naming: Prefer `camelCase` for variable names and follow Go's standard visibility rules (capital case for exported names, lower case for internal names).

    Formatting: Follow the standard `gofmt` style guidelines (e.g., indentation, spacing).

    Testing: Unit tests are required for all core logic. Use Go's built-in testing framework.

    Dependencies: When adding new dependencies, prefer built-in packages where possible.


---
applyTo: "../frontend/**"
description: "Guidance on frontend React, Typescript, and "
---

## FRONTEND GUIDANCE
    Language: Use TypeScript for all code; prefer interface over type definitions for props.

    Components: Favor functional components and use named exports.

    Styling: Use Tailwind CSS for all styling and implement a mobile-first approach.

    State Management/Hooks: Minimize the use of useEffect and useState where possible, favoring 

    React Server Components (RSC) patterns if applicable to your project.

    Structure: Use lowercase with dashes for directory names (e.g., components/auth-forms).

    Code Quality: Focus on readability, fully implement all requested functionality with no placeholders, and avoid mutating props or state directly. 
