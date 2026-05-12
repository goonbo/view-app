import figma from "@figma/code-connect";
import { Badge } from "./badge";

figma.connect(
  Badge,
  "https://www.figma.com/design/iFAZNHve9yjvuls9pMcBlC/view-2.0-design-system?node-id=5-496",
  {
    props: {
      variant: figma.enum("Variant", {
        Default: "default",
        Secondary: "secondary",
        Destructive: "destructive",
        Outline: "outline",
      }),
      children: figma.string("Label"),
    },
    example: ({ variant, children }) => (
      <Badge variant={variant}>{children}</Badge>
    ),
  },
);
