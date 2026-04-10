"use client";

import { createContext, useContext } from "react";

const UserContext = createContext(null);

export function useUser() {
  return useContext(UserContext);
}

export default function DashboardClient({ user, children }) {
  return (
    <UserContext.Provider value={user}>
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </UserContext.Provider>
  );
}
