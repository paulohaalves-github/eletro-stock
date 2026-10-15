import { apiHandler } from "@/lib/api";
import { listInventoryAssignees } from "@/lib/services/inventories";

export const GET = apiHandler(async (_request, { session }) => listInventoryAssignees(session));
