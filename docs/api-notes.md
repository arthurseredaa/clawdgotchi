# API notes (Claude Code v2.1.284, from .claude-plugin/types/claude-code/index.d.ts)

1. `$.ui.blit(args): Promise<UiBlitResult>` — args `{ requestId, key, cells, columns, rows }`. Returns `{}` on success or `{ deny }` (not mounted, another size, bad cells). It does not throw on deny; a test-kit `deny` stub rejects. Handle both. Live probe: band `requestId` is `'above-prompt'`. Up to 120 blits/s taken, ~60 shown.
2. `$.clock.now(): Promise<number>`; `$.clock.every(ms, fn)` is a `TimerCall` with `cancel()`.
3. `context.percent` is a whole percentage 0–100. `tokens` and `percent` are optional: absent in a fresh session and right after a compaction, until the next response. `window` is always present.
4. `session.compact` input: `{ trigger: 'manual' | 'auto' | 'plugin' | 'precompute', agentId?, instructions?, messages }`. `next(e)` resolves after the compaction with `{ messages, tokensBefore?, tokensAfter?, usage? }` or `{ skip }`. `precompute` installs nothing. `agentId` set = a subagent's own transcript.
   `session.measure` input: `{ context: SessionContextUsage, rateLimits, cost?, changed }` — carries the reading directly.
5. `ui.render` for `AbovePrompt`: props `hasSurvey` (a hook yields to it), `isWorking`, `maxRows`, `bodyColumns`, `scroll`, `view`. `next(e)` result for an empty band: to confirm in the live run.
6. `Text.color?: string` — hex strings accepted.
7. `.catch(handler)`: handler is `($, e, next & Caught)`, runs when the hook throws, misreturns or overruns; returning `undefined` means "hook absent".
8. Test kit: `import { expect, mock, test } from 'claude-code/testing'`; `$` in a test is the engine's own API, each method fires its event (`$.session.compact(args)`, `$.classic.SessionStart(...)`, `$.turn.complete(...)`); `$.ui.mount({ plugin, surface, component, props, ... })`, `ui.find({ key })` / `ui.find({ type, text })`.
