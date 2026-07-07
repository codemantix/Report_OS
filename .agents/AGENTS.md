# Codebase Architecture & Modularity Guidelines

Always prioritize modular architecture and maintainable code. Avoid placing large amounts of logic, UI, or sub-components in a single file. Break complex features into smaller, reusable components, hooks, utilities, services, and modules where appropriate.

## Core Rules:
* **One component per file** whenever possible.
* **Extract repeated UI** into reusable components.
* **Move business logic** into custom hooks or service files.
* **Keep page files focused** on composition and orchestration only.
* **Avoid files growing beyond a reasonable size** (e.g., 200–300 lines unless justified).
* **Group related files** into feature-based folders.
* **Favor readability, scalability, and maintainability** over convenience.
* **Refactor proactively** when a file becomes difficult to navigate.

---

## Enforce Scalable Feature-Based Architecture:
Always enforce a scalable feature-based architecture. Never place multiple large components, extensive business logic, API integrations, state management, and utility functions inside a single file.

Each page should primarily compose smaller components. Extract:
* **UI sections** into dedicated component files.
* **State management** into hooks or stores.
* **API calls** into service layers.
* **Validation** into schema files.
* **Constants** into dedicated constants files.
* **Types/interfaces** (when applicable) into separate files.

If a file starts becoming difficult to scan or exceeds roughly 250 lines, evaluate whether it should be split into smaller modules. Optimize for long-term maintainability, developer experience, and code reusability.

The codebase should remain easy to understand, extend, test, and maintain as the project grows.
