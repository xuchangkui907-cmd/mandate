import { createFileRoute } from "@tanstack/react-router";
import { ConsoleApp } from "@/components/console-app";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/console")({ component: ConsolePage });

function ConsolePage() {
  return (
    <Shell>
      <ConsoleApp />
    </Shell>
  );
}
