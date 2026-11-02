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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
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

export type SelectOption = { value: string; label: string };

/**
 * A labelled select bound to the surrounding `<Form>`. Options may come in
 * groups (`{ label, options }`), e.g. floors by block.
 */
export function SelectField<T extends FieldValues>({
  name,
  label,
  description,
  placeholder,
  options,
  disabled,
  onValueChange,
}: FieldProps<T> & {
  placeholder?: string;
  options: Array<SelectOption | { label: string; options: SelectOption[] }>;
  disabled?: boolean;
  /** Called after the field takes the value, e.g. to fill a dependent field. */
  onValueChange?: (value: string) => void;
}) {
  const { control } = useFormContext<T>();
  const item = (option: SelectOption) => (
    <SelectItem key={option.value} value={option.value}>
      {option.label}
    </SelectItem>
  );
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={field.value ?? ""}
            disabled={disabled}
            onValueChange={(value) => {
              field.onChange(value);
              onValueChange?.(value);
            }}
          >
            <FormControl>
              <SelectTrigger ref={field.ref} onBlur={field.onBlur} className="w-full">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) =>
                "options" in option ? (
                  <SelectGroup key={option.label}>
                    <SelectLabel>{option.label}</SelectLabel>
                    {option.options.map(item)}
                  </SelectGroup>
                ) : (
                  item(option)
                ),
              )}
            </SelectContent>
          </Select>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
