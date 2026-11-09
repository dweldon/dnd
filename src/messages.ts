import type { View } from './game/view';

// Client → server
export type ClientMessage =
  | { type: 'join'; characterId: string }
  | { type: 'start' }
  | { type: 'chat'; text: string }
  | { type: 'reset' };

// Server → client
export type ServerMessage =
  | { type: 'state'; view: View; thinking: boolean; voice: boolean }
  | { type: 'token'; token: string }
  | { type: 'error'; error: string };
