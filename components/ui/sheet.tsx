"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function Sheet({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetBackdrop({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="sheet-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

type Side = "left" | "right" | "top" | "bottom";

interface SheetContentProps extends DrawerPrimitive.Popup.Props {
  side?: Side;
  showCloseButton?: boolean;
}

function SheetContent({
  className,
  side = "left",
  children,
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  const sideClasses: Record<Side, string> = {
    left: "inset-y-0 left-0 h-full w-72 border-r data-closed:-translate-x-full",
    right:
      "inset-y-0 right-0 h-full w-72 border-l data-closed:translate-x-full",
    top: "inset-x-0 top-0 w-full border-b data-closed:-translate-y-full",
    bottom: "inset-x-0 bottom-0 w-full border-t data-closed:translate-y-full",
  };

  return (
    <DrawerPrimitive.Portal>
      <SheetBackdrop />
      <DrawerPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background shadow-lg outline-none transition-transform duration-200 ease-out",
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DrawerPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-3 right-3"
              />
            }
          >
            <XIcon className="size-4" />
            <span className="sr-only">Zavřít</span>
          </DrawerPrimitive.Close>
        ) : null}
      </DrawerPrimitive.Popup>
    </DrawerPrimitive.Portal>
  );
}

function SheetHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4 pb-2", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base font-semibold leading-none", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetBackdrop,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
