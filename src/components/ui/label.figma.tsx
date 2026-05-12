import figma from "@figma/code-connect";
import { Label } from "./label";

figma.connect(
  Label,
  "https://www.figma.com/design/iFAZNHve9yjvuls9pMcBlC/view-2.0-design-system?node-id=5-533",
  {
    props: { children: figma.string("Label") },
    example: ({ children }) => <Label>{children}</Label>,
  },
);
