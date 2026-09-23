import { redirect } from "next/navigation";

export default function VendasDashboardRedirect() {
  redirect("/dashboards?view=comercial");
}
