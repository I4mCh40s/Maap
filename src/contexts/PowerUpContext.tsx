import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

type PowerUpType = "megaphone" | "echo" | "spotlight" | "none";

interface PowerUp {
  type: PowerUpType;
  expiresAt: Date | null;
  used: boolean;
}

interface ContextValue {
  powerUp: PowerUp | null;
  spinWheel: () => Promise<void>;
}

const PowerUpContext = createContext<ContextValue>({
  powerUp: null,
  spinWheel: async () => {}
});

export function PowerUpProvider({ children }: { children: React.ReactNode }) {
  const uid = auth.currentUser?.uid!;
  const [powerUp, setPowerUp] = useState<PowerUp | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), snap => {
      const data = snap.data();
      if (!data) return;
      setPowerUp({
        type: data.powerUp?.type || "none",
        expiresAt: data.powerUp?.expiresAt?.toDate() ?? null,
        used: !!data.powerUp?.used
      });
    });
    return unsub;
  }, [uid]);

  const spinWheel = async () => {
    if (!powerUp || !uid) return;

    // pick random one
    const options: PowerUpType[] = ["megaphone","echo","spotlight"];
    const chosen = options[Math.floor(Math.random()*options.length)];

    // expires tomorrow midnight UTC
    const tomorrowMidnight = new Date();
    tomorrowMidnight.setUTCHours(24,0,0,0);

    await updateDoc(doc(db, "users", uid), {
      "powerUp.type": chosen,
      "powerUp.expiresAt": serverTimestamp(),
      "powerUp.used": false
    });
  };

  return (
    <PowerUpContext.Provider value={{ powerUp, spinWheel }}>
      {children}
    </PowerUpContext.Provider>
  );
}

export function usePowerUp() {
  return useContext(PowerUpContext);
}
