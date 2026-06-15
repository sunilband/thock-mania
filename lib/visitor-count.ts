"use cache";

import { cacheLife } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export async function getVisitorCount(): Promise<number> {
    cacheLife("minutes");

    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("get_visitor_count");

    if (error) return 0;
    return (data as number) ?? 0;
}
