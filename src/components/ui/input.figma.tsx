import figma from "@figma/code-connect";
import { Input } from "./input";

figma.connect(
  Input,
  "https://www.figma.com/design/iFAZNHve9yjvuls9pMcBlC/view-2.0-design-system?node-id=5-529",
  {
    props: {
      // `State` in Figma is a visual demonstration — there's no `state` prop
      // on the React component. Focus / Disabled / Error are surfaced via
      // standard HTML attributes (`aria-invalid`, `disabled`) plus focus-
      // visible CSS.
      placeholder: figma.string("Placeholder"),
    },
    example: ({ placeholder }) => <Input placeholder={placeholder} />,
  },
);
