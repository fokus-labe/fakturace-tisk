import { ImportClient } from "./import-client";
import { VenueBreadcrumb } from "@/components/venue/venue-breadcrumb";

export const metadata = {
  title: "Hromadný import faktur",
};

export default function ImportPage() {
  return (
    <div className="space-y-2">
      <VenueBreadcrumb />
      <ImportClient />
    </div>
  );
}
