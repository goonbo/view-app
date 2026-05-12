import figma from "@figma/code-connect";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

figma.connect(
  Avatar,
  "https://www.figma.com/design/iFAZNHve9yjvuls9pMcBlC/view-2.0-design-system?node-id=5-554",
  {
    props: {
      variant: figma.enum("Variant", {
        Initials: "initials",
        Image: "image",
      }),
      initials: figma.string("Initials"),
    },
    example: ({ variant, initials }) =>
      variant === "image" ? (
        <Avatar>
          <AvatarImage src="" alt="" />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      ) : (
        <Avatar>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      ),
  },
);
