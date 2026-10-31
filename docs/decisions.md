# Decisions

The main choices behind Text Transformer, and why I made them. The words used here (Transformation, Step, Chain, Content check, …) are defined in [`GLOSSARY.md`](../GLOSSARY.md). The full research notes, measurements and screenshots of every design are on the [`research`](https://github.com/Khalifa1997/KNIME_Task/tree/research/docs/research) branch.

## 1. The editor: a node canvas

I built ten throwaway prototypes of the same editor before choosing one: a **node canvas** (n8n style), a **recipe** (CyberChef), a **pipeline** of cards, **Scratch-style blocks**, a **command bar**, a **conveyor belt**, **track changes**, a **debugger**, a **spreadsheet** and **example first**. Screenshots of all ten: [`frontend-ux-screenshots.md`](https://github.com/Khalifa1997/KNIME_Task/blob/research/docs/research/frontend-ux-screenshots.md).

**I chose the node canvas because it scales the furthest:**

- **It can grow into a network.** A Chain is linear today, but a canvas can later show a node with more than one input or output, or a branch, without redesigning the UI. Every list-based design would need a rework.
- **No long scrolling.** In a list, a long Chain means scrolling to reach the Output or the Step you want to edit. On a canvas the whole Chain fits on one screen.
- **Reordering is direct.** Shift+drag one node onto another swaps them. A plain drag only moves a node, so users can lay the canvas out as they like.

**What it costs:** it's the second-heaviest design (+56 KB brotli, about twice the load time of the recipe), and Vue Flow 2 is a pinned prerelease that needed one patch for touch dragging.

**The runner-up was the recipe.** A scroll area of its own and a drag-and-drop package would have fixed its scrolling and reordering. But it's a list, so it can't grow into branches or nodes with several inputs or outputs.

**Why not the others, in short:**
- **Too complicated:** the command bar (typing a syntax isn't no-code), the blocks (Blockly alone adds about 156 KB, nearly three times the canvas), and the debugger.
- **Too basic, or too much scrolling:** the pipeline, the spreadsheet and track changes.
- **The conveyor belt** was the prettiest, but it makes users wait: the results arrive from the backend at once, and the animation then holds them back Step by Step.
- **Example first** needs search logic in the backend, which is beyond this task.

The Chain runs when you press **Run**, not on every keystroke. This was deliberate: there's no backend call per keystroke, and every problem is reported together at one moment.

## 2. The backend: a thin Spring Boot layer

The text processing is `core`, a plain Java 25 library with no Spring. `app` is a thin Spring Boot layer that exposes it over HTTP. I benchmarked the same endpoints in four frameworks, each calling the same Java library (5,000 POST requests, 50 at a time, in Docker; 500 for Go):

| | Requests/sec | Average time | Idle memory |
|---|---:|---:|---:|
| **Spring Boot** | **10,011** | **4.7 ms** | 217 MB |
| NestJS | 4,946 | 9.8 ms | 78 MB |
| FastAPI | 767 | 65 ms | 146 MB |
| Go | 149 | 321 ms | 7 MB |

Spring Boot had twice the throughput of the next option because it is the only one that calls the Java library directly, as normal method calls in the same process. The others had to reach the library through a bridge, and each bridge caused problems:

- **Go can't load a Java library at all.** The prototype started a new `java` process for every request, which cost about 35 ms each time. The alternatives were a long-running Java process to talk to, or a Java microservice, and a microservice means writing a Java web layer anyway. The image was also no smaller, because Java still had to be installed.
- **FastAPI used JPype, which loads a JVM inside Python.**
  - There can be only one JVM per process, and it can't be restarted.
  - Java classes can only be imported after the JVM has started.
  - Calls between Python and Java threads are hard to reason about.
  - Python's global interpreter lock held throughput back. More worker processes would help, but each one starts its own JVM.
  - Data crosses two type systems, and there are two toolchains (pip and Maven) to maintain.
- **NestJS used `java-bridge`, which loads a JVM inside Node.**
  - It **corrupted emoji** and other characters outside Unicode's Basic Multilingual Plane: `"a👋b"` arrived in Java as garbage. That alone rules it out for a text tool.
  - Its prebuilt binary needed a newer glibc (2.39), so the Docker image had to move to Debian 13.
  - Java 25 warns that the way it loads native code will be blocked in a future release unless extra JVM flags are added.
  - Its fast mode blocks Node's event loop while Java runs, and its async mode is slower.
  - The library is called by method name, with no types, so every new Transformation would go through an untyped boundary.

### How the backend is built

- **A rejected Chain is a normal result, not an exception.** `ChainRunner` returns a sealed `RunResult` (`Completed` or `Rejected`), so the compiler makes every caller handle both outcomes. Only an unreachable Content check is thrown.
- **Two layers of validation.** `app` checks only the request's shape (fields present, Step ids unique). Every Transformation's rules live in `core`, declared once in its Fields, and that same declaration feeds the metadata the frontend builds its forms from. The rules and the forms can't drift apart.
- **We own the error format.** The `422` is our own record instead of Spring's `ProblemDetail`, so no automatic fields leak into the contract, and the tests compare it against the [`contract/`](../contract/) JSON exactly.
- **All or nothing.** A successful run returns every Step's result, which the canvas shows on each node. A rejected run returns no partial results, so the canvas never shows results that don't match the Chain.
- **Stateless.** The server stores nothing. The whole Chain is sent on every Run and the Saved session lives in the browser, so there's no database and the backend scales out freely.
- **Plain Spring MVC, not WebFlux.** The work is short and CPU-bound, so blocking request handling is simpler and enough.
- **An explicit list of Transformations.** They are registered by hand in `BuiltInTransformations.all()`, with no classpath scanning or plugins, so the toolbar order is explicit and `core` needs no framework.
- **Two ways to deploy.** Locally it's one jar on one port. For free hosting, the backend runs on Render (Docker) and the frontend on Netlify, which forwards `/api` to Render so the browser still sees one origin and needs no CORS.

## 3. The Transformations

Each Transformation has a real use. Most are modelled on the JavaScript `String` API, which web developers already know:

| Transformation | JavaScript | Real use |
|---|---|---|
| Replace | `replaceAll()` | Fix a recurring typo, rename a product |
| Append / Prepend | `concat()` | Add a suffix, prefix or signature |
| Substring | `substring()` | Keep part of the text, such as a code |
| Regex replace | `replace()` with a regex | Reformat dates or phone numbers |
| Uppercase / Lowercase | `toUpperCase()` / `toLowerCase()` | Normalise text before comparing it |
| Reverse | `split('').reverse().join('')` | Check palindromes, simple text puzzles |
| Trim whitespace | `trim()` | Clean pasted input |
| Mask | none | Hide card numbers or emails |
| Base64 encode / decode | `btoa()` / `atob()` | Prepare text for URLs or headers |

Unlike JavaScript, these Transformations treat an emoji as one character:
- **Reverse** reverses whole characters (grapheme clusters), so emoji, flags and accented letters stay intact.
- **Substring and Mask** count Unicode code points, so most emoji count as one.

**Regex can't take the server down.** A user-written pattern with catastrophic backtracking (ReDoS) could keep the CPU busy for minutes. Java's regex engine has no timeout, so `core` adds these limits:
- A 2-second deadline on each Regex replace Step.
- Results are capped at 3,000 characters while they are built.
- A pattern nested too deeply to run is reported as a Step error instead of crashing.
- At most 30 Steps per Chain.

One gap remains: 30 slow Regex replace Steps could still hold a request for about a minute.

## 4. The Content check

The optional Content check screens the Input text with OpenAI's Moderation API before the Chain runs, and stops the run if hate, harassment, violence or another category is flagged. It's off by default. Text tools usually need to check what users type, especially if the results end up in front of other people (notes, embedded iframes).

**OpenAI's moderation model is free.** Usage is capped only by rate limits per account tier ([model page](https://platform.openai.com/docs/models/omni-moderation-latest), checked 2026-10-31):

| Tier | Requests per minute | Requests per day | Tokens per minute |
|---|---:|---:|---:|
| Free | 250 | 5,000 | 10,000 |
| Build | 500 | no limit | 20,000 |
| Launch | 2,000 | no limit | 250,000 |
| Grow | 5,000 | no limit | 500,000 |

It checks only the Input text, it sends that text to OpenAI, and if OpenAI can't be reached the run is refused rather than going ahead unchecked ([ADR 0001](adr/0001-content-check-outside-core.md)). If this became a full product, the same place in the backend is where I'd look at catching fraudulent data.

## 5. Other decisions

- **The backend is the source of truth.** The frontend builds every Field from the backend's metadata, so a new Transformation needs no frontend change.
- **All errors arrive at once,** in one `422`, each with a stable `code`.
- **One jar.** Maven builds the Vue app into the Spring Boot jar.
- **Maven's Enforcer keeps Spring out of `core`.**
- **ESLint only, no oxlint,** so Vue templates and the accessibility rules are linted.
- **The Saved session keeps invalid values** instead of silently fixing them.
- **No CI.** Tests are run by hand.

## 6. How I built it

I built this with an AI agent (Pi, with Claude models), using Matt Pocock's [engineering skills](https://github.com/mattpocock/skills). Rather than asking the agent for an app, I split the work into phases, and I made every decision myself. The agent's job was to research, challenge me, and then type.

### The phases

| When | Phase | What came out |
|---|---|---|
| 25 Oct | **Research and prototypes** | Four backend prototypes with a benchmark (section 2), ten editor prototypes with measurements (section 1), research notes on the `research` branch |
| 25–26 Oct, about 19 h | **Planning with [Wayfinder](https://github.com/mattpocock/skills/tree/main/skills/engineering/wayfinder)** | One map, [Text Transformer MVP: build-ready plan](https://github.com/Khalifa1997/KNIME_Task/issues/1), resolved through 18 decision tickets |
| 30 Oct | **Spec and tickets** | [The spec](https://github.com/Khalifa1997/KNIME_Task/issues/21) ([`to-spec`](https://github.com/mattpocock/skills/tree/main/skills/engineering/to-spec)), then 15 vertical slices with blocking links ([`to-tickets`](https://github.com/mattpocock/skills/tree/main/skills/engineering/to-tickets)) |
| 30–31 Oct, about 24 h | **Implementation** | One PR per slice ([`implement`](https://github.com/mattpocock/skills/tree/main/skills/engineering/implement)), with the unblocked slices built in parallel, each in its own git worktree |
| 31 Oct | **Follow-ups** | Regex memory limits, the Content check, more Transformations |

### Wayfinder and grilling

**Wayfinder** is for work too big for one agent session. It charts the way as a **map**: one GitHub issue listing the destination (here, the four success criteria) and the decisions made so far. Each open question becomes its own **decision ticket**, labelled by how it gets resolved:

- **research:** the agent reads primary sources (toolchain versions, Vue Flow's keyboard and touch behaviour).
- **prototype:** throwaway code answers a question that reading can't.
- **grilling:** a live interview with me.

Tickets block each other, so I could always see which questions were answerable now. The map was done when nothing was left to decide. It only plans: apart from throwaway prototypes, no code was written until the map was closed.

**[Grilling](https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling)** is how most tickets were resolved. The agent asks every question it can answer now, in numbered rounds, each with its recommendation, and I accept or overrule it. It keeps going until every branch of the decision is covered. Grilling regularly surfaced layers I hadn't seen. For example:

- **Bridges to Java.** I was weighing FastAPI and Go for speed. The research showed that every non-JVM framework needs a bridge to the Java library, and the bridges cost more than they saved.
- **A changed backend.** What should a Saved session do when the backend has changed since it was saved? That became the reconciliation rules and the blocked restore.
- **A failed run versus a wrong Chain.** A server that can't be reached is different from a Chain with mistakes in it. That became a new glossary term, **Run failure**, which never marks a Step red.
- **A real bug.** The canvas prototype found that touch dragging doesn't work in Vue Flow 2, which led to a patch and a test that guards it.
- **The Content check's gap.** It checks only the Input text, so a Step can still add harmful text. I accepted that and recorded it in an ADR.

The words agreed during grilling went into [`GLOSSARY.md`](../GLOSSARY.md), so the tickets, code and tests all use the same vocabulary.

### Tests

Tests are what make it safe to let an AI write the code. An agent writes plausible code very quickly, so I need a check that doesn't depend on reading every line. I settled the testing strategy as its own decision ticket, [Testing strategy: layers, tools, and what the build runs](https://github.com/Khalifa1997/KNIME_Task/issues/18), before any code existed:

| Layer | Tools | What it proves |
|---|---|---|
| `core` | JUnit 6 + AssertJ, no Spring | One test per Transformation example and per error in the catalogue |
| `app` | `MockMvcTester` | Every endpoint and status code, compared strictly against the [`contract/`](../contract/) JSON |
| Frontend | Vitest + jsdom | Field rendering and the pure logic (session reconciliation, save timing, failure messages), using the same `contract/` JSON |
| End to end | Playwright against the real jar | The four success criteria, touch drag, Shift+drag swap, Retry, on Chromium desktop and phone |
| Accessibility | axe in Playwright | Any WCAG 2.2 A or AA violation fails the run |

**How I used test-driven development with AI:**

- **Test first, one slice at a time.** The `implement` skill drives each ticket with the [`tdd`](https://github.com/mattpocock/skills/tree/main/skills/engineering/tdd) skill: write one failing test, then only enough code to pass it, then the next test. A test that was seen failing proves it can catch something, which matters when the same agent writes both the test and the code.
- **The examples are the spec.** The tickets held concrete tables (every Transformation's examples and every error's code), and the tests are written from those tables, not from the code. The agent can't quietly change the behaviour to match its own implementation.
- **One contract, used by both sides.** The `contract/` JSON is checked by the Java tests and the frontend tests, so the backend and frontend can't drift apart without a test failing.
- **Real over mocked.** The API tests use the real `core`, and the end-to-end tests run the real jar. Mocks hide exactly the integration mistakes an agent is likely to make.
- **Review on two axes.** The PRs went through the [`code-review`](https://github.com/mattpocock/skills/tree/main/skills/engineering/code-review) skill: one reviewer checks it against the repo's standards (`AGENTS.md`, the glossary), another against what the ticket asked for. Visible changes come with a Playwright flow that records a video and screenshots, so the evidence can be run again.

### PRs as a bird's-eye view

Every slice ended in a PR written with the [`pr`](https://github.com/mattpocock/skills/tree/main/skills/engineering/pr) skill (adapted from Dex Horthy's [`show-me`](https://github.com/humanlayer/skills/tree/main/plugins/show-me/skills/show-me)). I use it all the time, because reading the PR list gives me the whole build at a glance without opening the code. Every body has the same three parts:

- **Summary:** the smallest picture that makes the change clear, such as pseudocode, a call tree, a file tree or a diff of the structure, with very little prose.
- **Evidence:** proof that it works.
- **Merge Danger:** whether the change is a one-way or a two-way door (can it be rolled back?), and its blast radius.

For example, [Saved session: reconciliation and blocked restore](https://github.com/Khalifa1997/KNIME_Task/pull/51) explains the restore logic in a ten-line call tree, so a reviewer sees all of it before reading any code:

```text
restoreSession(stored, metadata, mode)
  none      -> ready, empty Chain
  blocked   -> snapshot untouched, nothing saved
                 Retry                    -> load metadata again
                 Discard saved session... -> confirm, remove it, empty Chain
  restored  -> Chain and layout set, notice lists the Field adjustments
```

**How I adapted it:**

- **Evidence must be rerunnable.** A reviewer has to be able to run it again: a test or a flow file, never a description of what was done.
- **Visible changes get a recording.** A companion `pr-evidence` skill writes a Playwright flow for the change (16 so far, in `frontend/e2e/flows/`). A committed script (`frontend/scripts/pr-evidence.mjs`) then records a video and screenshots the same way every time, and fails on any console error.
- **Everything else gets test output,** plus one line saying why there's no recording, so a reviewer can disagree with that call.
- **`Closes #N` on every slice.** Merging a PR closes its ticket, so the issue list always shows what's left.

### Trade-offs I made

- **A day of planning before any code.** Prototyping ten editors and four backends took time. But it meant the implementation never changed direction, and the slices could be built in parallel because the decisions were already locked.
- **Parallel agents bring merge conflicts.** Building unblocked slices at the same time was fast, but two merges once left a duplicated tag in `ChainCanvas.vue`, which needed its own fix PR.
- **End-to-end tests aren't part of the build.** `./mvnw package` runs the Java tests, lint, type-check and Vitest. Playwright needs a browser download and the built jar, so it runs separately with `npm run test:e2e`. There is no CI and no coverage gate; the layers above are the bar.
- **Everything is recorded.** Every prompt I sent is in [`PROMPTS.md`](../PROMPTS.md), and every decision is on the map and its tickets.

## 7. Next steps

- **Protect the open API.** There is no authentication or rate limiting yet. Add rate limiting per client and a deadline for the whole run, which closes the regex gap above.
- **Virtual threads.** Turning on `spring.threads.virtual.enabled` stops slow Content check calls (up to 5 s each) from tying up the server's threads.
- **Configurable limits.** `ChainRunner` ignores the `Limits` bean and always uses 3,000 characters and 30 Steps ([#58](https://github.com/Khalifa1997/KNIME_Task/issues/58)).
- **Accounts and server-side saving.** A Saved session lives in one browser tab only.
- **Branching.** Steps with more than one input or output, which the canvas is ready for.
- **Check the Output too,** not only the Input text, and look at catching fraudulent data.
- **Avoid cold starts.** Render's free plan puts the backend to sleep when idle, so the first request after a pause is slow.
