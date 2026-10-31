# Content check lives outside core and screens only the Input text

The Content check calls OpenAI's Moderation API (`omni-moderation-latest`). `core` only defines the check as an interface, and `app` provides the OpenAI version with its API key, HTTP client and timeouts. That keeps `ChainRunner` free of network calls and gives the same result every time, so it can be tested with a fake checker. The check is a demo of using an outside service, not a full safety guarantee. It screens the Input text once, after validation passes and before the Chain runs. Any flagged category stops the run.

## Consequences

- Steps can still add harmful text after the check, for example a Replace or Append Step whose Field values contain it. We accept this gap. Checking the Output instead would close it if the purpose ever changes from a demo to real protection.
- The user turns the check on or off per Saved session, and it's off by default. The server reports whether the check is available (no API key means it isn't), and the frontend shows the badge as not available when it isn't.
- If OpenAI can't be reached, the run is refused with a 503 Run failure. It never goes ahead unchecked.
- Flagged Input text is a 422 Input error (`input-flagged`). The message doesn't repeat the text or name the categories.
- Every Input text checked is sent to OpenAI, and the OpenAI badge's tooltip says so.
