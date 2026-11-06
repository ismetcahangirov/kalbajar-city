"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { MediaPicker } from "@/components/admin/media/media-picker";
import { thumbUrl } from "@/components/admin/media/media-thumb";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import type { Locale } from "@/i18n/routing";
import { t, type MessageKey } from "@/lib/admin/messages";
import { cn } from "@/lib/admin/utils";
import { safeHref, type RichTextDoc } from "@/shared/rich-text";

import { extensions } from "./rich-text-extensions";

const emptyDoc: RichTextDoc = { type: "doc", content: [{ type: "paragraph" }] };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Tool = {
  label: MessageKey;
  icon: LucideIcon;
  active?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const tools: Tool[] = [
  {
    label: "editor.heading2",
    icon: Heading2,
    active: (editor) => editor.isActive("heading", { level: 2 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "editor.heading3",
    icon: Heading3,
    active: (editor) => editor.isActive("heading", { level: 3 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: "editor.bold",
    icon: Bold,
    active: (editor) => editor.isActive("bold"),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    label: "editor.italic",
    icon: Italic,
    active: (editor) => editor.isActive("italic"),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    label: "editor.bulletList",
    icon: List,
    active: (editor) => editor.isActive("bulletList"),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: "editor.orderedList",
    icon: ListOrdered,
    active: (editor) => editor.isActive("orderedList"),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "editor.quote",
    icon: Quote,
    active: (editor) => editor.isActive("blockquote"),
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
];

/**
 * The console's rich-text editor (#25), TipTap. It loads only in the console:
 * the public site renders the stored JSON with `RichTextView` and never ships
 * the editor. The toolbar is a row of toggle buttons with names and
 * `aria-pressed`; the usual shortcuts (Ctrl+B, Ctrl+I, Ctrl+Z) work too.
 */
export function RichTextEditor({
  value,
  onChange,
  onBlur,
  label,
  locale,
  disabled = false,
  canUpload = false,
  invalid = false,
  describedBy,
}: {
  value: RichTextDoc | null | undefined;
  onChange: (doc: RichTextDoc) => void;
  onBlur?: () => void;
  label: string;
  locale: Locale;
  disabled?: boolean;
  canUpload?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  // What the editor last reported, so a value coming back from the form is
  // not pushed into the editor again (which would move the cursor).
  const emitted = useRef<RichTextDoc | null | undefined>(value);
  const [linking, setLinking] = useState(false);
  const aria = useRef<Record<string, string>>({});
  const [picking, setPicking] = useState(false);

  const editor = useEditor({
    extensions,
    content: value ?? emptyDoc,
    editable: !disabled,
    // Rendered in the browser only: the console page's HTML has no editor.
    immediatelyRender: false,
    editorProps: {
      attributes: () => ({
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        lang: locale,
        class: "kc-prose min-h-48 px-3 py-2 outline-none",
        ...aria.current,
      }),
    },
    onUpdate: ({ editor: current }) => {
      const doc = current.getJSON() as RichTextDoc;
      emitted.current = doc;
      onChange(doc);
    },
    onBlur: () => onBlur?.(),
  });

  // A value set from outside (copy from az, a reset after saving).
  useEffect(() => {
    if (!editor || same(value, emitted.current)) return;
    emitted.current = value;
    editor.commands.setContent(value ?? emptyDoc, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // Error state reaches the textbox through ProseMirror's attribute function.
  useEffect(() => {
    aria.current = {
      ...(invalid ? { "aria-invalid": "true" } : {}),
      ...(describedBy ? { "aria-describedby": describedBy } : {}),
    };
    editor?.view.setProps({});
  }, [editor, invalid, describedBy]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            active: tools.map((tool) => tool.active?.(current) ?? false),
            link: current.isActive("link"),
            undo: current.can().undo(),
            redo: current.can().redo(),
          }
        : null,
  });

  const off = disabled || !editor;

  return (
    <div
      className={cn(
        "border-input focus-within:border-ring focus-within:ring-ring/50 rounded-md border focus-within:ring-[3px]",
        invalid && "border-destructive",
      )}
    >
      <div
        role="toolbar"
        aria-label={t("editor.toolbar", { label })}
        aria-orientation="horizontal"
        className="flex flex-wrap gap-1 border-b p-1"
      >
        {tools.map((tool, index) => (
          <Button
            key={tool.label}
            type="button"
            variant={state?.active[index] ? "secondary" : "ghost"}
            size="icon"
            aria-label={t(tool.label)}
            aria-pressed={state?.active[index] ?? false}
            disabled={off}
            onClick={() => editor && tool.run(editor)}
          >
            <tool.icon aria-hidden />
          </Button>
        ))}
        <Button
          type="button"
          variant={state?.link ? "secondary" : "ghost"}
          size="icon"
          aria-label={t("editor.link")}
          aria-pressed={state?.link ?? false}
          disabled={off}
          onClick={() => setLinking(true)}
        >
          <Link2 aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("editor.unlink")}
          disabled={off || !state?.link}
          onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}
        >
          <Link2Off aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("editor.image")}
          disabled={off}
          onClick={() => setPicking(true)}
        >
          <ImagePlus aria-hidden />
        </Button>
        <span className="ml-auto flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("editor.undo")}
            disabled={off || !state?.undo}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("editor.redo")}
            disabled={off || !state?.redo}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 aria-hidden />
          </Button>
        </span>
      </div>
      <EditorContent editor={editor} />

      {editor ? (
        <LinkDialog
          // Mounted afresh on each opening, so it starts from the current link.
          key={linking ? "open" : "closed"}
          open={linking}
          onOpenChange={setLinking}
          initial={(editor.getAttributes("link").href as string | undefined) ?? ""}
          onSubmit={(href) => {
            const chain = editor.chain().focus().extendMarkRange("link");
            if (editor.state.selection.empty && !editor.isActive("link")) {
              chain
                .insertContent({
                  type: "text",
                  text: href,
                  marks: [{ type: "link", attrs: { href } }],
                })
                .run();
            } else {
              chain.setLink({ href }).run();
            }
          }}
        />
      ) : null}
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        kind="image"
        title={t("editor.image")}
        canUpload={canUpload}
        onSelect={(file) =>
          editor
            ?.chain()
            .focus()
            .insertContent({
              type: "image",
              attrs: { src: thumbUrl(file) ?? "", alt: file.alt?.az ?? "", mediaId: file.id },
            })
            .run()
        }
      />
    </div>
  );
}

function LinkDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: string;
  onSubmit: (href: string) => void;
}) {
  const id = useId();
  const [href, setHref] = useState(initial);
  const [error, setError] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // The form may sit inside the article's form: keep this submit to itself.
    event.stopPropagation();
    const safe = safeHref(href);
    if (!safe) {
      setError(true);
      return;
    }
    onSubmit(safe);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editor.link")}</DialogTitle>
          <DialogDescription>{t("editor.linkLead")}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-href`}>{t("editor.linkHref")}</Label>
            <Input
              id={`${id}-href`}
              value={href}
              inputMode="url"
              autoComplete="off"
              aria-invalid={error || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => {
                setHref(event.target.value);
                setError(false);
              }}
            />
            {error ? (
              <p id={`${id}-error`} className="text-sm text-destructive">
                {t("editor.linkInvalid")}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit">{t("editor.linkApply")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
