import { OrderExperience } from "@/components/voice/order-experience";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Smash &amp; Go</h1>
        <p className="text-sm text-muted-foreground">Order by voice.</p>
      </div>
      <OrderExperience />
    </main>
  );
}
