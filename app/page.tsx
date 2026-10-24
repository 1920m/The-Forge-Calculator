import { Calculator } from "@/components/calculator";
import { getCatalogue } from "@/lib/data/catalogue";

export const revalidate = 3600;

export default async function Home() {
  return <Calculator cat={await getCatalogue()} />;
}
