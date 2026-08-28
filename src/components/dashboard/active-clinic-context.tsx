"use client";

import { createContext, useContext } from "react";

const ActiveClinicContext = createContext("no-clinic");

export function ActiveClinicProvider({ clinicId, children }: { clinicId?: string | null; children: React.ReactNode }) {
  return <ActiveClinicContext.Provider value={clinicId ?? "no-clinic"}>{children}</ActiveClinicContext.Provider>;
}

export function useActiveClinicId() {
  return useContext(ActiveClinicContext);
}
