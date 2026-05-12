import figma from "@figma/code-connect";
import { Separator } from "./separator";

figma.connect(
  Separator,
  "https://www.figma.com/design/iFAZNHve9yjvuls9pMcBlC/view-2.0-design-system?node-id=5-559",
  {
    props: {
      orientation: figma.enum("Orientation", {
        Horizontal: "horizontal",
        Vertical: "vertical",
      }),
    },
    example: ({ orientation }) => <Separator orientation={orientation} />,
  },
);
