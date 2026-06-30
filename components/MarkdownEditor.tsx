'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown, MarkdownStorage } from 'tiptap-markdown'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import CodeIcon from '@mui/icons-material/Code'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import DataObjectIcon from '@mui/icons-material/DataObject'

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      // onClick の代わりに onMouseDown + preventDefault を使う。
      // onClick はエディタの blur 後に発火するためカーソル位置が失われる。
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-gray-200 mx-1 self-center" />
}

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minHeight = 360,
}: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? '入力してください...',
      }),
      Markdown.configure({
        html: false,
        transformCopiedText: true,
        transformPastedText: true,
      }),
    ],
    content: value,
    onUpdate({ editor }) {
      // editor.storage の型がブラウザ組み込みの Storage インターフェースと衝突するため
      // TS が直接アクセスを拒否する。unknown を経由した二段キャストで回避する。
      const md = (editor.storage as unknown as { markdown: MarkdownStorage }).markdown
      onChange(md.getMarkdown())
    },
  })

  if (!editor) {
    return <div className="border border-gray-200 rounded-xl bg-white" style={{ minHeight }} />
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400 bg-white">
      {/* ツールバー */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="見出し1 （# + スペース）"
        >
          <span className="text-xs font-bold w-5 h-5 flex items-center justify-center leading-none">
            H1
          </span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="見出し2 （## + スペース）"
        >
          <span className="text-xs font-bold w-5 h-5 flex items-center justify-center leading-none">
            H2
          </span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="見出し3 （### + スペース）"
        >
          <span className="text-xs font-bold w-5 h-5 flex items-center justify-center leading-none">
            H3
          </span>
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="太字 （Ctrl+B / **text**）"
        >
          <FormatBoldIcon style={{ fontSize: 16 }} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="斜体 （Ctrl+I / *text*）"
        >
          <FormatItalicIcon style={{ fontSize: 16 }} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="インラインコード （`code`）"
        >
          <CodeIcon style={{ fontSize: 16 }} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="箇条書き （- + スペース）"
        >
          <FormatListBulletedIcon style={{ fontSize: 16 }} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="番号付きリスト （1. + スペース）"
        >
          <FormatListNumberedIcon style={{ fontSize: 16 }} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="引用 （> + スペース）"
        >
          <FormatQuoteIcon style={{ fontSize: 16 }} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="コードブロック （``` + Enter）"
        >
          <DataObjectIcon style={{ fontSize: 16 }} />
        </ToolbarButton>
      </div>

      {/* エディタ本体 */}
      <div
        style={{ minHeight }}
        className="cursor-text px-4 py-3 text-sm text-gray-800"
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* ショートカットヒント */}
      <div className="px-4 py-1.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 flex flex-wrap gap-x-3">
        <span>
          <kbd className="font-mono">-</kbd> + スペース → リスト
        </span>
        <span>
          <kbd className="font-mono">#</kbd> + スペース → 見出し
        </span>
        <span>
          <kbd className="font-mono">&gt;</kbd> + スペース → 引用
        </span>
        <span>
          <kbd className="font-mono">```</kbd> + Enter → コード
        </span>
      </div>
    </div>
  )
}
