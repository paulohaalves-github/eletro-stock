import { redirect } from "next/navigation";

export default function ContactCenterDashboardRedirect() {
  redirect("/dashboards?view=contact-center");
}
