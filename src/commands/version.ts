// --- Formatting (pure) ---

export const formatVersionInfo = (cliVersion: string, latestRelease: string | null): string => {
  const lines = [
    `faber CLI v${cliVersion}`,
    `Latest template: ${latestRelease ?? 'unknown'}`,
  ]
  return lines.join('\n')
}
