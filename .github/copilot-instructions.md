# FiberTrack Project Guidelines

## Tech Stack
- **Framework**: React 18 (Vite + TypeScript).
- **Styling**: Tailwind CSS (Utility-first).
- **Database**: Firebase v10 (Compat Mode).
- **Icons**: Lucide React.
- **Maps**: Leaflet / React-Leaflet (Native DOM implementation in `MapPicker.tsx`).
- **Performance**: `react-window` for virtualized lists.

## Coding Standards

### React Components
- Use **Functional Components** with hooks (`useState`, `useEffect`, `useMemo`).
- Define Prop types using `interface`.
- **Virtualization**: When rendering lists of records (e.g., in Dashboards), ALWAYS use `react-window` (`FixedSizeList`) to ensure performance with large datasets.
- **Memoization**: Use `React.memo` for heavy components like maps.

### Firebase
- Use **Compat** imports: `import firebase from "firebase/compat/app";`.
- Access instances via `firebase.ts` exports (`db`, `auth`).
- **Offline Persistence**: Ensure queries handle offline states gracefully (listeners vs one-time gets).

### TypeScript
- Avoid `any` where possible. Use shared types from `types.ts`.
- Use `Partial<T>` for form states that start empty.

### Styling
- Use Tailwind CSS classes.
- For dynamic colors, use helper functions (e.g., `getStatusColor` in dashboards).
- Ensure mobile responsiveness (`md:`, `lg:` prefixes).

## Project Structure
- `index.html`: Entry point (no importmaps, allow Vite to bundle).
- `src/` (root): `App.tsx`, `firebase.ts`, `types.ts`.
- `components/`: UI Components.
- `services/`: Utility logic (`utils.ts`).

## Workflow
- **RBAC**: Check `userProfile.role` ('dsr' vs 'supervisor') before rendering restricted UI.
- **Sync**: Writes are immediate to Firestore; `synced` flag is for UI feedback.
