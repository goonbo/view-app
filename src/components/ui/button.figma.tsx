import figma from "@figma/code-connect";
import { Button } from "./button";

const FIGMA_URL =
  "https://www.figma.com/design/iFAZNHve9yjvuls9pMcBlC/view-2.0-design-system?node-id=5-439";

figma.connect(Button, FIGMA_URL, {
  props: {
    variant: figma.enum("Variant", {
      Default: "default",
      Destructive: "destructive",
      Outline: "outline",
      Secondary: "secondary",
      Ghost: "ghost",
      Link: "link",
    }),
    children: figma.string("Label"),
  },
  example: ({ variant, children }) => (
    <Button variant={variant}>{children}</Button>
  ),
});
