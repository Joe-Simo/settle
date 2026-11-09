import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-3xl font-black">Wrong room.</h1>
      <p className="mt-3 text-dim">That page is not on the advance sheet.</p>
      <Link href="/show" className="mt-6 inline-block rounded-md bg-amber px-5 py-3 font-semibold text-amber-ink">Go to the demo show</Link>
    </main>
  );
}
