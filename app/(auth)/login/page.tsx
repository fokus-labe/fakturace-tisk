import { LoginForm } from "./login-form";

export const metadata = { title: "Přihlášení · Fokus tisk" };

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <div className="mx-auto h-2 w-16 rounded-full bg-[#C6E94D]" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Fokus tisk · Fakturace
          </h1>
          <p className="text-sm text-muted-foreground">
            Přihlas se ke svému účtu.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
