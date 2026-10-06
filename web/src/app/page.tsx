import { checkApiHealth } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { healthy } = await checkApiHealth();

  return (
    <section className="hero">
      <p className="eyebrow">StreamSouk</p>
      <h1>
        Videos worth <em>watching</em>
      </h1>
      <p>The public showcase of videos is coming soon.</p>
      <p className="status" data-healthy={healthy}>
        API {healthy ? "reachable" : "unreachable"}
      </p>
    </section>
  );
}
