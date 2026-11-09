import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = { title: "Settle: The Foundry Hall, Nov 7" };

export default function ShowPage() {
  return <Dashboard />;
}
