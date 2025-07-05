import React, {
  createContext,
  useContext,
  useState,
  Dispatch,
  SetStateAction,
} from "react";

/**
 * UI-related assets that an organiser can provide to brand the app
 * while Event Mode is enabled.
 */
export interface EventAssets {
  /** Hex or rgba string used as the primary accent */
  primaryColor?: string;
  /** Optional secondary tint */
  secondaryColor?: string;
  /** URL or require() path to a logo image */
  logoUri?: string;
  /** Optional background image used for special screens */
  backgroundImageUri?: string;
}

/**
 * Canonical description of an event that has activated Event Mode.
 * An `id` of `null` means the user is *not* currently inside an event.
 */
export interface EventInfo {
  /** Firestore doc id or other unique slug; `null` → no event mode */
  id: string | null;
  /** Public‑facing event name (e.g. “Bright Beats ’25”) */
  name?: string;
  /** ISO 8601 string or Date object of the first show day */
  date?: string | Date;
  /** Invite code word that unlocked the mode for this user */
  inviteCode?: string;
  /** Brand assets (colors, logos…) */
  assets?: EventAssets;
  /** Organiser’s verified account e‑mail */
  hostEmail?: string;
  /** Optional array of vendor emails that gain posting privileges */
  vendorEmails?: string[];
}

/** Shape exposed via React context */
interface EventContextState {
  event: EventInfo;
  /** Replace the current event object */
  setEvent: Dispatch<SetStateAction<EventInfo>>;
  /** Convenience helper to reset back to normal mode */
  clearEvent: () => void;
  /** Role helpers for the *current logged‑in* user */
  roleFor: (email?: string | null) => "host" | "vendor" | "guest";
}

const defaultContext: EventContextState = {
  event: { id: null },
  setEvent: () => {},
  clearEvent: () => {},
  roleFor: () => "guest",
};

const EventContext = createContext<EventContextState>(defaultContext);

/**
 * Provider that wraps the app and gives children access to `useEvent()`.
 */
export const EventProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [event, setEvent] = useState<EventInfo>({ id: null });

  const clearEvent = () => setEvent({ id: null });

  /** Determine user role inside the event (helper, not a security gate). */
  const roleFor = (email?: string | null) => {
    if (!email || !event.id) return "guest";
    if (email === event.hostEmail) return "host";
    if (event.vendorEmails?.includes(email)) return "vendor";
    return "guest";
  };

  return (
    <EventContext.Provider value={{ event, setEvent, clearEvent, roleFor }}>
      {children}
    </EventContext.Provider>
  );
};

/**
 * Hook to access event info anywhere in the component tree.
 */
export const useEvent = () => useContext(EventContext);
