import figma from "@figma/code-connect";
import { Card } from "./card";

figma.connect(
  Card,
  "https://www.figma.com/design/iFAZNHve9yjvuls9pMcBlC/view-2.0-design-system?node-id=5-513",
  {
    props: {
      // The Figma component carries Default / Soft / AI / Outlined variants
      // for visual reference. The shadcn `Card` doesn't have a `variant` prop
      // — these visual variants are achieved via className overrides at the
      // call site (e.g., `bg-muted/40` for Soft, `bg-view-source-muted/40
      // ring-view-source/30` for AI).
      variant: figma.enum("Variant", {
        Default: "default",
        Soft: "soft",
        AI: "ai",
        Outlined: "outlined",
      }),
    },
    example: ({ variant }) => {
      const className =
        variant === "soft"
          ? "bg-muted/40 p-6"
          : variant === "ai"
            ? "bg-view-source-muted/40 ring-view-source/30 p-6"
            : variant === "outlined"
              ? "border border-border p-6"
              : "p-6";
      return <Card className={className}>{/* card body */}</Card>;
    },
  },
);
