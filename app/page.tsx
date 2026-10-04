import { Homepage } from "@/components/public-pages";
import { publicContent } from "@/lib/public-data";

export default async function Page() {
  const events = await publicContent("events");
  return <Homepage events={events.slice(0, 3)} />;
}
