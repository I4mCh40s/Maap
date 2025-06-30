// declarations/firebase-auth-react-native.d.ts
declare module 'firebase/auth/react-native' {
  import type {
    initializeAuth as _IA,
    getReactNativePersistence as _GRNP
  } from 'firebase/auth';

  export const initializeAuth: typeof _IA;
  export const getReactNativePersistence: typeof _GRNP;
}