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

## 6. Next steps

- **Protect the open API.** There is no authentication or rate limiting yet. Add rate limiting per client and a deadline for the whole run, which closes the regex gap above.
- **Virtual threads.** Turning on `spring.threads.virtual.enabled` stops slow Content check calls (up to 5 s each) from tying up the server's threads.
- **Configurable limits.** `ChainRunner` ignores the `Limits` bean and always uses 3,000 characters and 30 Steps ([#58](https://github.com/Khalifa1997/KNIME_Task/issues/58)).
- **Accounts and server-side saving.** A Saved session lives in one browser tab only.
- **Branching.** Steps with more than one input or output, which the canvas is ready for.
- **Check the Output too,** not only the Input text, and look at catching fraudulent data.
- **Avoid cold starts.** Render's free plan puts the backend to sleep when idle, so the first request after a pause is slow.
