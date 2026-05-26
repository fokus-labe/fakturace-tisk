import { Logo } from "@/components/logo";
import { CropMarks } from "@/components/ui/crop-marks";
import { LoginForm } from "./login-form";

export const metadata = { title: "Přihlášení · Fokus tisk" };

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo width={140} height={100} priority />
          <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
            Fakturace
          </p>
        </div>

        <div className="relative bg-card border rounded-lg p-8 shadow-sm">
          <CropMarks
            className="absolute inset-0 m-4"
            color="var(--color-border)"
            size={20}
            thickness={1}
          />

          <div className="relative space-y-6">
            <div>
              <h1 className="text-xl font-semibold">Přihlášení</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Zadej své přihlašovací údaje.
              </p>
            </div>
            <LoginForm />
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Fokus Labe, z. ú. © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
