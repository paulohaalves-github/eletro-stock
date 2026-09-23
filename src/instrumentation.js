export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { startInboxAutomationScheduler } = await import("./lib/services/inbox-automations");
  startInboxAutomationScheduler();
}
