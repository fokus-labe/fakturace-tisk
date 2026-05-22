"use client";

import { Trash2, Plus } from "lucide-react";
import {
  useFieldArray,
  type Control,
  type UseFormRegister,
  type FieldErrors,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InvoiceFormInput } from "./invoice-form-schema";

interface Props {
  control: Control<InvoiceFormInput>;
  register: UseFormRegister<InvoiceFormInput>;
  errors: FieldErrors<InvoiceFormInput>;
}

export function InvoiceItemsEditor({ control, register, errors }: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  return (
    <div className="space-y-3">
      <div className="hidden md:grid grid-cols-[1fr_90px_140px_80px_40px] gap-2 px-1 text-xs uppercase tracking-wide text-muted-foreground">
        <div>Popis</div>
        <div className="text-right">Množ.</div>
        <div className="text-right">J. cena bez DPH</div>
        <div className="text-right">DPH %</div>
        <div />
      </div>

      {fields.map((field, idx) => (
        <div
          key={field.id}
          className="grid grid-cols-1 md:grid-cols-[1fr_90px_140px_80px_40px] gap-2 items-start"
        >
          <div>
            <Label className="md:hidden text-xs">Popis</Label>
            <Input
              {...register(`items.${idx}.description` as const)}
              placeholder="Tisk letáků A5, 200 ks"
            />
            {errors.items?.[idx]?.description ? (
              <p className="text-xs text-destructive mt-1">
                {errors.items[idx]?.description?.message}
              </p>
            ) : null}
          </div>
          <div>
            <Label className="md:hidden text-xs">Množství</Label>
            <Input
              type="number"
              step="0.01"
              className="text-right"
              {...register(`items.${idx}.quantity` as const)}
            />
          </div>
          <div>
            <Label className="md:hidden text-xs">J. cena bez DPH</Label>
            <Input
              type="number"
              step="0.01"
              className="text-right"
              {...register(`items.${idx}.unit_price_no_vat` as const)}
            />
          </div>
          <div>
            <Label className="md:hidden text-xs">DPH %</Label>
            <Input
              type="number"
              step="0.01"
              className="text-right"
              {...register(`items.${idx}.vat_rate` as const)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(idx)}
            disabled={fields.length === 1}
            aria-label="Smazat položku"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      {errors.items?.root ? (
        <p className="text-xs text-destructive">{errors.items.root.message}</p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          append({
            description: "",
            quantity: 1,
            unit_price_no_vat: 0,
            vat_rate: 21,
          })
        }
      >
        <Plus className="size-4 mr-2" />
        Přidat položku
      </Button>
    </div>
  );
}
