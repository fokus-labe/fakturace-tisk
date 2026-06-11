import Link from "next/link";

export const metadata = {
  title: "Žádný přístup k provozovně",
};

export default function NoAccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Žádný přístup k provozovně</h1>
      <p className="max-w-md text-muted-foreground">
        Tvůj účet zatím není přiřazen k žádné provozovně. Kontaktuj admina (
        <a
          href="mailto:kolstrunk@fokuslabe.cz"
          className="underline hover:text-foreground"
        >
          kolstrunk@fokuslabe.cz
        </a>{" "}
        nebo{" "}
        <a
          href="mailto:krbec@fokuslabe.cz"
          className="underline hover:text-foreground"
        >
          krbec@fokuslabe.cz
        </a>
        ) a požádej o přístup.
      </p>
      <Link href="/" className="text-sm text-primary underline">
        Zkusit znovu
      </Link>
    </div>
  );
}
