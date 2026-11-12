# Shipment Triage Agent

A LangGraph.js shipment-exception triage system. An exception event is routed to one of
three carrier specialist agents (DHL, Maersk, regional ground), each built with LangChain
`createAgent` and calling models through OpenRouter's OpenAI-compatible API.

## Prompt caching

### What was implemented

- Every specialist request puts the stable content first (base triage rules + carrier
  specialist prompt + tool definitions) and the changing content (the exception event)
  last, as a human message.
- The end of the stable prefix is marked with `cache_control: { "type": "ephemeral" }`
  on the last system content part, the format OpenRouter documents for its
  OpenAI-compatible API. Built in `caching.ts`, applied in `carriers.ts`.
- Estimated prefix sizes are printed once at server startup (`cache-prewarm.ts`).
- Optional cache pre-warm on server startup sends one tiny request (`max_tokens: 1`)
  per specialist containing the stable prefix, so the cache is filled before the first
  real event. Pre-warm failures are logged and ignored.
- After every model call, `cached_tokens` and `cache_write_tokens` are read from the
  response usage and recorded on the LLM span and in the JSONL log (event `cache_usage`).

### The stable-prefix rule

Providers cache a prompt only as a literal prefix: everything before the breakpoint must
be byte-identical between requests. The system prompt here contains no timestamps, run
IDs, or random values. Editing a prompt through the prompt store changes the prefix and
invalidates the cache — that is expected and fine.

### Measured prefix sizes

Text-only estimate (system prompt + tool descriptions, ~4 chars/token):

- DHL: ~365 tokens
- Maersk: ~401 tokens
- Regional ground: ~292 tokens

The full serialized request (tool JSON schemas, structured-output schema, message
framing) came to **1,086 prompt tokens** for the DHL specialist in a real call. Most
providers only cache prefixes of 1,024+ tokens (some models need 2,048–4,096), so this
prefix is borderline: on a caching provider it may cache for DHL/Maersk and silently
not cache if the model's minimum is higher.

### Env flags

- `PROMPT_CACHE` — send the `cache_control` breakpoint. Default: `true`.
- `CACHE_PREWARM` — pre-warm each specialist's cache on server startup. Default:
  `false`, because each warm-up costs one real model call per specialist (3 total).

Enable pre-warm with `CACHE_PREWARM=true` in `.env`, then start the server
(`npm run server`).

### Checking cached_tokens in Langfuse

Open a trace, select a `chat <model>` generation span, and look at its attributes:

- `gen_ai.usage.cached_tokens` — tokens served from the provider cache
- `gen_ai.usage.cache_write_tokens` — tokens written to the cache on this call

The same numbers appear in `logs/agent-log.jsonl` as `cache_usage` events.

### Honest note on "openrouter/free"

No cache hits are expected on the current setup. Caching happens at the provider behind
each model, not at OpenRouter: `openrouter/free` may route every call to a different
free model, and free providers generally do not cache at all. A real call was verified
to carry `cache_control` all the way to OpenRouter and to report
`prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }` back. On a caching
model (e.g. Anthropic Claude via OpenRouter) the same requests would produce cache
writes and reads, subject to the minimum prefix size above.

To re-verify the wire format (costs one model call): `npm run cache:verify`.
