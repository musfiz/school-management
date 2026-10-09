"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import { useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  className = "",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-brand-600 underline font-medium",
        },
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "min-h-[160px] p-3.5 focus:outline-none prose prose-sm max-w-none text-ink-800",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  function setLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl);

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div
      className={`overflow-hidden rounded-md border border-ink-200 bg-white transition-colors focus-within:border-brand-400 ${className}`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-ink-200 bg-ink-50/80 p-1.5 text-ink-700">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`rounded p-1.5 transition-colors hover:bg-ink-200 ${
            editor.isActive("bold") ? "bg-ink-200 text-ink-900" : ""
          }`}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`rounded p-1.5 transition-colors hover:bg-ink-200 ${
            editor.isActive("italic") ? "bg-ink-200 text-ink-900" : ""
          }`}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rounded p-1.5 transition-colors hover:bg-ink-200 ${
            editor.isActive("underline") ? "bg-ink-200 text-ink-900" : ""
          }`}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-ink-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`rounded p-1.5 transition-colors hover:bg-ink-200 ${
            editor.isActive("heading", { level: 1 }) ? "bg-ink-200 text-ink-900" : ""
          }`}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`rounded p-1.5 transition-colors hover:bg-ink-200 ${
            editor.isActive("heading", { level: 2 }) ? "bg-ink-200 text-ink-900" : ""
          }`}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`rounded p-1.5 transition-colors hover:bg-ink-200 ${
            editor.isActive("heading", { level: 3 }) ? "bg-ink-200 text-ink-900" : ""
          }`}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-ink-300 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded p-1.5 transition-colors hover:bg-ink-200 ${
            editor.isActive("bulletList") ? "bg-ink-200 text-ink-900" : ""
          }`}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded p-1.5 transition-colors hover:bg-ink-200 ${
            editor.isActive("orderedList") ? "bg-ink-200 text-ink-900" : ""
          }`}
          title="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`rounded p-1.5 transition-colors hover:bg-ink-200 ${
            editor.isActive("blockquote") ? "bg-ink-200 text-ink-900" : ""
          }`}
          title="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </button>

        <div className="h-4 w-[1px] bg-ink-300 mx-1" />

        <button
          type="button"
          onClick={setLink}
          className={`rounded p-1.5 transition-colors hover:bg-ink-200 ${
            editor.isActive("link") ? "bg-ink-200 text-ink-900" : ""
          }`}
          title="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
        {editor.isActive("link") && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className="rounded p-1.5 transition-colors hover:bg-ink-200 text-red-600"
            title="Remove Link"
          >
            <Unlink className="h-4 w-4" />
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className="rounded p-1.5 transition-colors hover:bg-ink-200 disabled:opacity-30"
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className="rounded p-1.5 transition-colors hover:bg-ink-200 disabled:opacity-30"
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <EditorContent editor={editor} />
    </div>
  );
}
