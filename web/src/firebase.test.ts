import { describe, expect, beforeEach, vi } from 'vitest'

// Mock Firebase SDK modules to avoid real network initialization
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'app' })),
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ auth: true })),
  RecaptchaVerifier: vi.fn(function RecaptchaVerifier() {
    return { widgetId: 'mock-recaptcha' }
  }),
}))

vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn(() => ({ firestore: true })),
  enableIndexedDbPersistence: vi.fn(() => Promise.resolve()),
}))

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({ functions: true })),
}))

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({ storage: true })),
}))

describe('firebase configuration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_FB_API_KEY', 'test-api-key')
    vi.stubEnv('VITE_FB_AUTH_DOMAIN', 'auth.example.com')
    vi.stubEnv('VITE_FB_PROJECT_ID', 'project-123')
    vi.stubEnv('VITE_FB_STORAGE_BUCKET', 'bucket-123')
    vi.stubEnv('VITE_FB_APP_ID', 'app-123')
    vi.stubEnv('VITE_FB_FUNCTIONS_REGION', 'us-test-1')
  })

  it('initializes the default Firestore database', async () => {
    const firebase = await import('./firebase')

    expect(firebase.db).toBeDefined()
    expect(firebase).not.toHaveProperty('rosterDb')
  })


  it('supports non-Vite Firebase env aliases for hosted deployments', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('NEXT_PUBLIC_FB_API_KEY', 'alias-api-key')
    vi.stubEnv('NEXT_PUBLIC_FB_AUTH_DOMAIN', 'alias-auth.example.com')
    vi.stubEnv('NEXT_PUBLIC_FB_PROJECT_ID', 'alias-project-123')
    vi.stubEnv('NEXT_PUBLIC_FB_STORAGE_BUCKET', 'alias-bucket-123')
    vi.stubEnv('NEXT_PUBLIC_FB_APP_ID', 'alias-app-123')
    vi.stubEnv('NEXT_PUBLIC_FB_FUNCTIONS_REGION', 'alias-region-1')

    const firebase = await import('./firebase')

    expect(firebase.firebaseConfig).toEqual({
      apiKey: 'alias-api-key',
      authDomain: 'alias-auth.example.com',
      projectId: 'alias-project-123',
      storageBucket: 'alias-bucket-123',
      appId: 'alias-app-123',
    })
  })
})
