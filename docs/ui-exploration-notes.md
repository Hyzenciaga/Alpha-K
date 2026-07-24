# Alpha-K UI exploration notes

Status: collecting feedback; do not implement the next revision yet.

The next local HTML revision will add a seventh design direction and keep the current six available for comparison.

## Preserve

1. Keep the `学习时间线` direction's `继续上一次` card.
   - Place it in the right-hand auxiliary area after entering a specific learning field.
   - It should help resume field-specific work rather than dominate the global home page.
2. Keep the visual language of `今日简报`.
   - In particular, preserve compact AI cues such as the star beside `是否将“Agent 记忆”设为重点研究主题？`.
   - These cues should distinguish Agent suggestions without turning every section into an AI panel.

## Add in the next revision

1. Make quick capture more prominent than search.
   - The high-frequency action is dropping a link into Alpha-K at any moment.
   - Entry should be continuously available with minimal clicks and should not require navigating to Inbox first.
2. Add a Settings surface for evaluating:
   - information-source subscriptions;
   - Agent configuration, availability, and status.

## Electron compatibility boundary

The visual direction is compatible with the current Electron client, but the local prototype is not intended to be copied into the application as a standalone package.

- Both surfaces use React 19 and a Vite-based renderer, so component structure, layout, interaction state, and CSS can be ported without an architectural rewrite.
- Port prototype JSX to the client's TypeScript TSX and use the client's existing component/types conventions.
- Prefer the client's installed `lucide-react` icons for the small AI star/sparkle language. Do not add a second icon system solely because the prototype currently uses Phosphor.
- Reuse the client's Electron title-bar implementation. The client already uses `titleBarStyle: hiddenInset`, a defined traffic-light position, and CSS drag/no-drag regions.
- Recompose the client's existing Sources, Agents, and Settings pages inside the new shell instead of replacing their real behavior with prototype mocks.
- Do not copy the prototype's package, Vite, hosting, or browser-server configuration into the Electron app. Preserve `electron.vite.config.ts`, the CJS preload output, context isolation, shared IPC contracts, and main-process lifecycle.
- The existing client quick-capture dialog is currently visual feedback only. Persisting a note/link is a backend integration task that requires an agreed shared DTO, preload API, IPC handler, and local workflow; it must not be implemented with browser storage.

## Suggested implementation sequence after design confirmation

1. Finalize the seventh direction and interaction hierarchy in the isolated local prototype.
2. Port only the selected shell and shared visual components into `src/renderer`.
3. Reattach existing real pages and existing preload clients without changing their contracts.
4. Specify and implement the quick-capture contract as a separate vertical slice.
5. Validate the result in the Electron runtime, not only in a browser preview.
