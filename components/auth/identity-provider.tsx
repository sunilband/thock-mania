"use client";

import { createContext, type ReactNode, use, useContext } from "react";
import type { IdentityData } from "@/lib/get-identity";

const IdentityContext = createContext<IdentityData | null>(null);

export function useIdentityData(): IdentityData {
    const ctx = useContext(IdentityContext);
    if (!ctx) {
        throw new Error("useIdentityData must be used within IdentityProvider");
    }
    return ctx;
}

interface IdentityProviderProps {
    children: ReactNode;
    identityPromise: Promise<IdentityData>;
}

export function IdentityProvider({
    children,
    identityPromise,
}: IdentityProviderProps) {
    const data = use(identityPromise);

    return (
        <IdentityContext.Provider value={data}>
            {children}
        </IdentityContext.Provider>
    );
}
