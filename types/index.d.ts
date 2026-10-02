export type ClawdReading = { tokens: number; window: number; percent: number }

declare module 'claude-code' {
  interface PluginState {
    clawdgotchi: { reading: ClawdReading | null }
  }
}
