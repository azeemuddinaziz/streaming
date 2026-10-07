import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UploadForm } from "@/components/UploadForm";
import { getCurrentUser } from "@/lib/api-client";

export const metadata: Metadata = { title: "Upload · StreamSouk" };
export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const cookieStore = await cookies();
  const account = cookieStore.has("token")
    ? await getCurrentUser(cookieStore.toString())
    : null;
  if (!account) redirect("/sign-in");

  return (
    <section className="form-page">
      <p className="eyebrow">Studio</p>
      <h1>
        Upload a <em>video</em>
      </h1>
      <UploadForm />
    </section>
  );
}
