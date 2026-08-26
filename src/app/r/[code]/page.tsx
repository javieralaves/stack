import { RoomApp } from "@/components/RoomApp";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <main className="app-shell">
      <RoomApp code={code} />
    </main>
  );
}
