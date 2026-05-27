"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { cs } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = DayPickerProps;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={cs}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "select-none",
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-3",
        month_caption: "flex justify-center pt-1 relative items-center h-8",
        caption_label: "text-sm font-medium",
        nav: "flex items-center justify-between absolute inset-x-1 top-1",
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-10 text-[0.7rem] font-normal uppercase tracking-wide text-muted-foreground",
        week: "flex w-full mt-1",
        day: "h-10 w-10 text-center text-sm p-0 relative",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-full p-0 font-normal rounded-md aria-selected:opacity-100",
        ),
        selected:
          "[&_button]:bg-primary [&_button]:text-primary-foreground [&_button:hover]:bg-primary [&_button:hover]:text-primary-foreground",
        today: "[&_button]:ring-1 [&_button]:ring-primary/40",
        outside: "[&_button]:text-muted-foreground [&_button]:opacity-40",
        disabled: "[&_button]:text-muted-foreground [&_button]:opacity-50",
        range_middle:
          "[&_button]:bg-accent [&_button]:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: (chevProps) => {
          if (chevProps.orientation === "left")
            return <ChevronLeft className="size-4" />;
          return <ChevronRight className="size-4" />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
