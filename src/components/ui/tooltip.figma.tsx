import figma from "@figma/code-connect";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./tooltip";

figma.connect(
  TooltipContent,
  "https://www.figma.com/design/iFAZNHve9yjvuls9pMcBlC/view-2.0-design-system?node-id=5-563",
  {
    props: { children: figma.string("Label") },
    example: ({ children }) => (
      <Tooltip>
        <TooltipTrigger>{/* trigger */}</TooltipTrigger>
        <TooltipContent>{children}</TooltipContent>
      </Tooltip>
    ),
  },
);
