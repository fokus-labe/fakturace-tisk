"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Venue } from "@/lib/venues/get-user-venues";

type VenueForm = {
  slug: string;
  name: string;
  legal_name: string;
  ico: string;
  dic: string;
  address_street: string;
  address_city: string;
  address_zip: string;
  address_country: string;
  email: string;
  phone: string;
  bank_account: string;
  iban: string;
  data_box: string;
  logo_url: string;
  brand_color: string;
};

const EMPTY_FORM: VenueForm = {
  slug: "",
  name: "",
  legal_name: "Fokus Labe, z. ú.",
  ico: "44226586",
  dic: "CZ44226586",
  address_street: "",
  address_city: "",
  address_zip: "",
  address_country: "Česká republika",
  email: "",
  phone: "",
  bank_account: "",
  iban: "",
  data_box: "",
  logo_url: "",
  brand_color: "#2563EB",
};

function venueToForm(v: Venue): VenueForm {
  return {
    slug: v.slug,
    name: v.name,
    legal_name: v.legal_name,
    ico: v.ico,
    dic: v.dic ?? "",
    address_street: v.address_street ?? "",
    address_city: v.address_city ?? "",
    address_zip: v.address_zip ?? "",
    address_country: v.address_country ?? "Česká republika",
    email: v.email ?? "",
    phone: v.phone ?? "",
    bank_account: v.bank_account ?? "",
    iban: v.iban ?? "",
    data_box: v.data_box ?? "",
    logo_url: v.logo_url ?? "",
    brand_color: v.brand_color ?? "#2563EB",
  };
}

export function VenuesClient({ initialVenues }: { initialVenues: Venue[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VenueForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (v: Venue) => {
    setEditingId(v.id);
    setForm(venueToForm(v));
    setDialogOpen(true);
  };

  const setField = (key: keyof VenueForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const url = editingId ? `/api/venues/${editingId}` : "/api/venues";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error ?? "Uložení selhalo");
      }
      toast.success(editingId ? "Provozovna upravena" : "Provozovna vytvořena");
      setDialogOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uložení selhalo");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (v: Venue) => {
    setBusyId(v.id);
    try {
      const res = await fetch(`/api/venues/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !v.active }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Změna selhala");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Změna selhala");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (v: Venue) => {
    if (
      !confirm(
        `Smazat provozovnu "${v.name}"? Lze jen pokud nemá žádná navázaná data.`,
      )
    )
      return;
    setBusyId(v.id);
    try {
      const res = await fetch(`/api/venues/${v.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Smazání selhalo");
      }
      toast.success("Provozovna smazána");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smazání selhalo");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-2" />
          Nová provozovna
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>IČO</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialVenues.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    Žádné provozovny.
                  </TableCell>
                </TableRow>
              ) : (
                initialVenues.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-3 rounded-full"
                          style={{ backgroundColor: v.brand_color }}
                        />
                        {v.name}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {v.slug}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{v.ico}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => toggleActive(v)}
                        disabled={busyId === v.id}
                        className={
                          v.active
                            ? "inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {v.active ? "Aktivní" : "Neaktivní"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => openEdit(v)}
                          aria-label="Upravit"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => remove(v)}
                          disabled={busyId === v.id}
                          aria-label="Smazat"
                        >
                          {busyId === v.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => !open && setDialogOpen(false)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Upravit provozovnu" : "Nová provozovna"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Slug *">
              <Input
                value={form.slug}
                onChange={(e) => setField("slug", e.target.value)}
                placeholder="piknik-usti"
              />
            </Field>
            <Field label="Název *">
              <Input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Piknik Ústí"
              />
            </Field>
            <Field label="Právní název *" full>
              <Input
                value={form.legal_name}
                onChange={(e) => setField("legal_name", e.target.value)}
              />
            </Field>
            <Field label="IČO *">
              <Input
                value={form.ico}
                onChange={(e) => setField("ico", e.target.value)}
              />
            </Field>
            <Field label="DIČ">
              <Input
                value={form.dic}
                onChange={(e) => setField("dic", e.target.value)}
              />
            </Field>
            <Field label="Ulice" full>
              <Input
                value={form.address_street}
                onChange={(e) => setField("address_street", e.target.value)}
              />
            </Field>
            <Field label="Město">
              <Input
                value={form.address_city}
                onChange={(e) => setField("address_city", e.target.value)}
              />
            </Field>
            <Field label="PSČ">
              <Input
                value={form.address_zip}
                onChange={(e) => setField("address_zip", e.target.value)}
              />
            </Field>
            <Field label="Země">
              <Input
                value={form.address_country}
                onChange={(e) => setField("address_country", e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
              />
            </Field>
            <Field label="Telefon">
              <Input
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </Field>
            <Field label="Bankovní účet">
              <Input
                value={form.bank_account}
                onChange={(e) => setField("bank_account", e.target.value)}
              />
            </Field>
            <Field label="IBAN">
              <Input
                value={form.iban}
                onChange={(e) => setField("iban", e.target.value)}
              />
            </Field>
            <Field label="Datová schránka">
              <Input
                value={form.data_box}
                onChange={(e) => setField("data_box", e.target.value)}
              />
            </Field>
            <Field label="Barva (hex)">
              <div className="flex items-center gap-2">
                <Input
                  value={form.brand_color}
                  onChange={(e) => setField("brand_color", e.target.value)}
                />
                <span
                  className="inline-block size-8 shrink-0 rounded border"
                  style={{ backgroundColor: form.brand_color }}
                />
              </div>
            </Field>
            <Field label="Logo URL" full>
              <Input
                value={form.logo_url}
                onChange={(e) => setField("logo_url", e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Zrušit
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Ukládám…
                </>
              ) : (
                "Uložit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <Label className="mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
