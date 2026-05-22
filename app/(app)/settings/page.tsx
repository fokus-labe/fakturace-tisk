import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ISSUER } from "@/config/issuer";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nastavení</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vystavovatel</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1 text-muted-foreground">
          <div className="text-foreground font-medium">{ISSUER.name}</div>
          <div>{ISSUER.division.name} · {ISSUER.division.note}</div>
          <div>
            {ISSUER.address.street}, {ISSUER.address.zip} {ISSUER.address.city}
          </div>
          <div>IČO: {ISSUER.ico}</div>
          <div>{ISSUER.contact.email} · {ISSUER.contact.phone}</div>
          <p className="text-xs pt-2">
            Údaje jsou nastavené v <code>config/issuer.ts</code>.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API klíče</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="text-muted-foreground mb-3">
            Klíče pro budoucí napojení e-shopů na endpoint{" "}
            <code>POST /api/invoice-requests</code>.
          </p>
          <Link
            href="/settings/api-keys"
            className="text-sm font-medium underline"
          >
            Spravovat API klíče →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
