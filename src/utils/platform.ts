export type Platform =
  | { readonly tag: 'darwin' }
  | { readonly tag: 'linux' }
  | { readonly tag: 'win32' }
  | { readonly tag: 'unknown'; readonly raw: string }

export const detectPlatform = (platform: string): Platform => {
  switch (platform) {
    case 'darwin': return { tag: 'darwin' }
    case 'linux': return { tag: 'linux' }
    case 'win32': return { tag: 'win32' }
    default: return { tag: 'unknown', raw: platform }
  }
}

export const isWindows = (p: Platform): boolean => p.tag === 'win32'
export const isMac = (p: Platform): boolean => p.tag === 'darwin'
export const isLinux = (p: Platform): boolean => p.tag === 'linux'
