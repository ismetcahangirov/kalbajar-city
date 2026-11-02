"use client";

import type { ComponentProps } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/admin/ui/form";
import { Input } from "@/components/admin/ui/input";
import { Textarea } from "@/components/admin/ui/textarea";

type FieldProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  description?: string;
};

/**
 * A labelled text input bound to the surrounding `<Form>`: its error, from
 * the schema or from the API (`applyApiErrors`), appears under it and is
 * linked with `aria-describedby` and `aria-invalid`.
 */
export function TextField<T extends FieldValues>({
  name,
  label,
  description,
  ...input
}: FieldProps<T> & Omit<ComponentProps<typeof Input>, "name" | "value" | "defaultValue">) {
  const { control } = useFormContext<T>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...input} {...field} value={field.value ?? ""} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  name,
  label,
  description,
  ...input
}: FieldProps<T> & Omit<ComponentProps<typeof Textarea>, "name" | "value" | "defaultValue">) {
  const { control } = useFormContext<T>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea {...input} {...field} value={field.value ?? ""} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
