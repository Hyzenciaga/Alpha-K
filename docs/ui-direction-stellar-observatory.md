# Alpha-K spatial direction: Stellar Observatory

Status: concept recorded; research complete; do not implement yet.

This document preserves a distinct Alpha-K interaction direction. It is intentionally separate from
the current UI baseline and from `docs/ui-exploration-notes.md`. It does not authorize changes to the
renderer, shared contracts, preload, IPC, or main process.

## 1. Direction summary

Alpha-K becomes a personal stellar observatory for knowledge rather than a conventional collection
of fixed web pages.

The user looks through a large viewport into a navigable knowledge universe. Knowledge items,
sources, topics, reports, questions, and their relationships can become celestial objects,
constellations, or trajectories. The user can rotate around the space, change the observation lens,
focus on a cluster, and travel toward a selected object.

A cockpit-like control area sits at the bottom of the app. It may include a dock, wide-angle
perspective screens, switches, knobs, and a throttle-like control. These controls must change real
knowledge operations or views; they must not exist only to make the interface look like a game.

The intended feeling is:

- observing a living personal knowledge system from inside a spacecraft or observatory;
- moving between overview, orientation, investigation, and focused work without losing spatial
  context;
- using AI as a navigation computer that helps reveal routes and relationships;
- retaining the legibility, trust, and local-first behavior required by a serious knowledge tool.

This is not:

- a reskin of the current sidebar-and-card layout;
- a space-themed dashboard with ordinary forms placed on top;
- a fully simulated game world;
- an excuse to hide important actions behind decorative controls;
- a replacement for Alpha-K's real local data, IPC, or background workflows.

## 2. Interaction premise

The main surface has three cooperating layers.

### 2.1 Knowledge universe

The central viewport is a spatial knowledge field.

Possible celestial mappings:

- knowledge item → star, object, signal, or probe;
- topic or collection → constellation, nebula, or sector;
- source → origin system, beacon, or station;
- citation or confirmed relation → stable trajectory;
- AI-proposed relation → visually distinct provisional trajectory;
- inbox item → unidentified object awaiting classification;
- report → mapped expedition, observation log, or synthesized star chart;
- failed or incomplete processing → weak, interrupted, or warning signal.

The user can:

- rotate in all directions;
- zoom, pan, and focus on a selected object;
- return to a known orientation;
- isolate a topic, source, time range, or relationship type;
- jump from an overview to a readable detail surface;
- preserve a visible path back to the previous context.

### 2.2 Cockpit shell

The title bar, bottom dock, global state, notifications, and essential commands remain accessible
DOM UI. They can look and behave like a cockpit, but they should remain crisp, keyboard-operable,
and understandable without spatial navigation.

The dock should represent operating modes rather than reproduce a row of conventional page tabs.
Candidate modes:

- Observe: global knowledge field and current activity;
- Receive: inbox and newly discovered objects;
- Navigate: topics, collections, relationships, and search;
- Ask: contextual Alpha-K questions;
- Synthesize: reports and generated knowledge products;
- Systems: sources, Agents, automation, Vault, cloud state, and settings.

### 2.3 Contextual spatial screens

A small number of perspective screens can appear near the selected object or cockpit.

Good uses:

- a compact object identity panel;
- relationship evidence and provenance;
- a short AI navigation suggestion;
- an active task or processing status;
- a preview before opening a full reading or editing surface.

Poor uses:

- long documents;
- dense settings;
- multi-step forms;
- tables with many columns;
- anything requiring precise text selection or extended keyboard input.

These should flatten or dock into a normal readable work surface when the task becomes detailed.

## 3. Controls must have product meaning

Potential cockpit controls are hypotheses to test, not visual requirements.

| Control form | Possible product meaning |
| --- | --- |
| Main throttle | Expand or contract the observation radius; move between local context and the wider knowledge field |
| Rotary lens control | Switch relationship lens: topic, source, time, citation, similarity, or workflow state |
| Signal-gain knob | Change the minimum confidence or relevance shown |
| Range dial | Change the time span or graph depth |
| Toggle switches | Show or hide confirmed links, AI suggestions, unread items, failed jobs, or remote-only metadata |
| Radar sweep | Reveal newly arrived or currently changing knowledge |
| Dock bays | Change operating mode while preserving the current selected object and orientation |
| Jump control | Travel to a selected topic, cited item, previous context, or AI-suggested destination |

Each control needs:

- a visible value and label;
- keyboard and pointer operation;
- a predictable reset;
- direct feedback in the knowledge field;
- a non-simulated equivalent for reduced-motion or low-performance mode.

## 4. Reinterpreting existing Alpha-K surfaces

### Today

Today becomes the observatory's current watch: new signals, active background work, important
changes, and a short AI observation. It should not require entering the full spatial field before
the user can understand what happened.

### Inbox

Inbox items can arrive as unidentified or unclassified objects. The user inspects an object,
reviews extracted metadata and Agent suggestions, then accepts, adjusts, ignores, or retries it.
Acceptance moves it into the stable knowledge field; this visual transition must reflect a real
state change.

### Knowledge space

The knowledge universe is the alternative primary view of the library. A readable list/search view
must remain available as an equal mode, not only as an accessibility fallback.

### Sources

Sources can become beacons or stations that show health, last contact, arrival rate, and failures.
Configuration itself should open in a clear surface rather than be performed through decorative
machinery.

### Ask Alpha-K

Asking Alpha-K is contextual to the current field, selection, and observation lens. The answer
shows the route through the evidence and allows the user to visit cited knowledge objects.

### Reports

A report can be presented as an expedition log or synthesized map. Reading and editing remain
document-oriented.

### Agents and settings

Agents can be represented as an onboard crew or capability system: availability, permissions,
assigned work, current load, failures, and recent output. The metaphor must not obscure which local
provider is used or what it can access.

## 5. AI-native behavior

AI is a navigation computer inside the knowledge system, not a separate chat page pasted onto the
interface.

Candidate behaviors:

- explain why a cluster or relationship is visible;
- propose a route through several related items;
- identify a weakly connected area worth revisiting;
- compare the currently selected objects;
- suggest an observation lens based on the user's question;
- summarize what changed in the visible field;
- turn a completed exploration path into a report or follow-up question.

Trust boundaries:

- AI-proposed relationships must look different from confirmed citations or deterministic links;
- each proposal needs evidence, confidence, generation time, and a way to dismiss or confirm it;
- spatial proximity must not silently imply a factual relationship;
- the AI view must never hide the underlying source or citation;
- rendering a graph must not upload Vault content or move local processing into the renderer.

## 6. Technical direction

Recommended rendering structure:

1. React DOM for the cockpit shell, readable work surfaces, forms, and accessibility;
2. Three.js through React Three Fiber for the knowledge universe;
3. limited spatial HTML for small contextual screens;
4. typed renderer state bridging selection, camera, dock, and contextual UI;
5. a future read-only graph projection supplied through agreed IPC contracts.

Candidate packages for a prototype:

- `three`;
- `@react-three/fiber` version compatible with React 19;
- `@react-three/drei`;
- `r3f-forcegraph` as a replaceable prototype accelerator;
- `motion`;
- `@use-gesture/react`;
- `zustand` if cross-layer state becomes difficult to manage;
- `@react-three/postprocessing` only for restrained focus, outline, and glow effects.

The perspective dock itself should first use CSS transforms and DOM animation. A physics engine,
second 3D renderer, or game engine is not currently justified.

Electron compatibility assumptions:

- keep the existing Electron/Vite renderer architecture;
- keep sandbox, context isolation, preload output, shared contracts, and lifecycle behavior;
- bundle assets locally rather than loading essential visual resources from a CDN;
- lazy-load the spatial route;
- stop or reduce rendering when the window is hidden;
- use WebGL 2 as the baseline and provide a non-WebGL fallback;
- validate in the actual packaged Electron runtime, not only in a browser prototype.

## 7. Data gap

The current knowledge model does not yet contain a complete graph. A meaningful universe requires a
separate projection rather than invented visual relationships.

A future graph projection may need:

- stable node identifiers and node kinds;
- typed edge kinds;
- evidence or citation identifiers;
- confidence and provenance;
- confirmed versus AI-proposed state;
- timestamps and optional layout hints;
- bounded queries for the current field rather than loading the whole Vault.

The first visual prototype may use contract-shaped fixtures, but it must clearly remain a prototype.

## 8. Performance and accessibility guardrails

- Keep critical reading and editing in the DOM.
- Support reduced motion and a stable reset-orientation command.
- Offer list/search access to every knowledge object exposed in the universe.
- Prefer instanced points and links rather than one heavy mesh per item.
- Render on demand when the scene is idle.
- Reduce pixel ratio, labels, particles, and post-processing before reducing essential information.
- Detect unavailable or unstable GPU features and fall back gracefully.
- Preserve keyboard focus and avoid trapping input inside the canvas.
- Ensure the bottom dock remains usable at the current minimum window size.

## 9. Prototype questions

Before this direction enters the production renderer, an isolated prototype should answer:

1. Can the user understand what the objects represent without a tutorial?
2. Can the user rotate and return to a known orientation without becoming lost?
3. Does selecting an object produce a clear path into reading or action?
4. Are the cockpit controls useful when their science-fiction styling is removed?
5. Can Inbox, contextual Ask, and Sources each feel native to the premise?
6. Does the app remain calm when there are hundreds or thousands of objects?
7. Can the visual quality degrade gracefully on lower-performance hardware?
8. Does hiding and restoring the Electron window preserve state without wasting GPU time?

## 10. Reserved concept seed: Black Hole

Status: preserve as a separate concept seed; do not merge into the Stellar Observatory direction or
choose its final interaction yet.

The user wants a future Black Hole direction. It should later be explored together with concrete
Alpha-K scenarios and functions rather than treated only as a dark visual style.

Possible conceptual meanings to investigate:

- attraction: a major question or topic pulls related knowledge toward it;
- accretion: scattered inputs accumulate into a coherent body of knowledge;
- compression: many items collapse into a digest, report, principle, or reusable memory;
- depth: crossing successive layers reveals source, summary, annotation, citation, and raw artifact;
- forgetting: low-value or intentionally dismissed material leaves the active field without being
  silently destroyed;
- uncertainty: the event horizon marks where the system no longer has enough evidence;
- temporal distortion: revisit how understanding of a topic changed over time;
- hidden mass: reveal influential but rarely opened knowledge through its relationships;
- recovery: inspect what was absorbed, archived, ignored, or summarized and restore it safely.

Potential future scenes, without committing to them:

- a research question at the center drawing relevant knowledge into an accretion disk;
- Inbox triage in which noisy material is rejected, useful material is captured, and uncertain
  material remains in orbit;
- a synthesis flow where selected items collapse into a report while citations remain recoverable;
- an archive or forgetting surface that makes retention and deletion boundaries explicit;
- an AI investigation that approaches an evidence boundary and visibly states what remains unknown.

Questions that must be answered before visual ideation:

1. Is the Black Hole primarily a place, a workflow, a transition, or the whole application shell?
2. Does crossing the event horizon mean focus, archive, synthesis, deletion, or something else?
3. What must remain reversible?
4. Which Alpha-K state changes are represented, and which effects are only visual?
5. How does the metaphor avoid making data loss feel mysterious or inevitable?
6. How does it coexist with the calmer Stellar Observatory direction?

Guardrail: the Black Hole must never imply that accepted knowledge has been deleted, uploaded,
merged, or altered unless the corresponding Alpha-K operation actually occurred and is clearly
explained.

## 11. Relationship to current work

- This direction does not replace the current UI baseline.
- It does not modify the uncommitted renderer work on `codex/ui-baseline-redesign`.
- It does not change the existing instruction to keep quick capture prominent.
- It preserves the need for clear source, Agent, settings, and local/cloud state.
- Stellar Observatory and Black Hole should remain independently understandable until future
  scenario exploration establishes a useful reason to combine them.
