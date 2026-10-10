// Where the backend lives. Defaults to your PC for normal development; the
// Android build overrides these via .env.android because "127.0.0.1" on a
// phone or emulator means the phone itself, not your computer.
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";
export const WS_BASE: string = import.meta.env.VITE_WS_BASE ?? "ws://127.0.0.1:8000";
