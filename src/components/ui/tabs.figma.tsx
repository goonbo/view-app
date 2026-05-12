import figma from "@figma/code-connect";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

figma.connect(
  Tabs,
  "https://www.figma.com/design/iFAZNHve9yjvuls9pMcBlC/view-2.0-design-system?node-id=5-548",
  {
    props: {
      variant: figma.enum("Variant", {
        Default: "default",
        Line: "line",
      }),
    },
    example: ({ variant }) => (
      <Tabs defaultValue="all">
        <TabsList variant={variant}>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>
        <TabsContent value="all">{/* content */}</TabsContent>
      </Tabs>
    ),
  },
);
