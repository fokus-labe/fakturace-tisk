"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { clientSchema, type ClientInput } from "@/lib/validations/client";

interface Props {
  initial?: Partial<ClientInput> & { id?: string };
  mode?: "create" | "edit";
}

export function ClientForm({ initial, mode = "create" }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: initial?.name ?? "",
      ico: initial?.ico ?? "",
      dic: initial?.dic ?? "",
      address_street: initial?.address_street ?? "",
      address_city: initial?.address_city ?? "",
      address_zip: initial?.address_zip ?? "",
      address_country: initial?.address_country ?? "Česká republika",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      notes: initial?.notes ?? "",
    },
  });

  async function onSubmit(values: ClientInput) {
    setSubmitting(true);
    const res = await fetch(
      mode === "create" ? "/api/clients" : `/api/clients/${initial?.id}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error("Uložení selhalo", { description: j?.error });
      return;
    }
    toast.success("Klient uložen");
    router.push("/clients");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="space-y-1.5 md:col-span-2">
            <Label>Jméno / název *</Label>
            <Input {...register("name")} />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>IČO</Label>
            <Input {...register("ico")} />
          </div>
          <div className="space-y-1.5">
            <Label>DIČ</Label>
            <Input {...register("dic")} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" {...register("email")} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefon</Label>
            <Input {...register("phone")} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Ulice</Label>
            <Input {...register("address_street")} />
          </div>
          <div className="space-y-1.5">
            <Label>PSČ</Label>
            <Input {...register("address_zip")} />
          </div>
          <div className="space-y-1.5">
            <Label>Město</Label>
            <Input {...register("address_city")} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Země</Label>
            <Input {...register("address_country")} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Poznámky</Label>
            <Textarea rows={3} {...register("notes")} />
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Ukládám…" : "Uložit"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
