import { createAnalyzeHandler } from "@/lib/analyze-handler";
import { buildPilotPackage } from "@/lib/pilot-package";

export const POST = createAnalyzeHandler(buildPilotPackage);
