import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/server/auth";

export default async function HomePage() {
  redirect(await getAuthenticatedUser() ? "/dashboard" : "/sign-in");
}
