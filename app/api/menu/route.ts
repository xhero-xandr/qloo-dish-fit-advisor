import { createMenuHandler } from "@/lib/menu-handler";
import { readMenu } from "@/lib/menu-reader";

export const POST = createMenuHandler(readMenu);
