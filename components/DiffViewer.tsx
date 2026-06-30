'use client'

import { useMemo } from 'react'
import { diffLines } from 'diff'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'

interface Props {
  oldText: string
  newText: string
}

type DiffLine = {
  text: string
  type: 'added' | 'removed' | 'unchanged'
}

const COLLAPSE_THRESHOLD = 4 // これ以上連続する unchanged 行は折り畳む
const CONTEXT_LINES = 2 // 折り畳み前後に表示する行数

export function DiffViewer({ oldText, newText }: Props) {
  const lines = useMemo<DiffLine[]>(() => {
    const changes = diffLines(oldText, newText)
    const result: DiffLine[] = []
    for (const change of changes) {
      const parts = change.value.replace(/\n$/, '').split('\n')
      for (const text of parts) {
        result.push({
          text,
          type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
        })
      }
    }
    return result
  }, [oldText, newText])

  const hasChanges = lines.some((l) => l.type !== 'unchanged')

  if (!hasChanges) {
    return <div className="px-4 py-8 text-center text-sm text-gray-400">変更はありませんでした</div>
  }

  // 長い unchanged ブロックを折り畳む（git diff -U2 と同じ考え方）。
  // 変更行の前後 CONTEXT_LINES 行だけ残し、残りを「N 行省略」に置き換える。
  type Segment =
    { kind: 'line'; line: DiffLine; index: number } | { kind: 'collapsed'; count: number }

  const segments: Segment[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.type === 'unchanged') {
      let j = i
      while (j < lines.length && lines[j].type === 'unchanged') j++
      const count = j - i
      if (count > COLLAPSE_THRESHOLD + CONTEXT_LINES * 2) {
        // 先頭の context
        for (let k = i; k < i + CONTEXT_LINES; k++) {
          segments.push({ kind: 'line', line: lines[k], index: k })
        }
        segments.push({ kind: 'collapsed', count: count - CONTEXT_LINES * 2 })
        // 末尾の context
        for (let k = j - CONTEXT_LINES; k < j; k++) {
          segments.push({ kind: 'line', line: lines[k], index: k })
        }
      } else {
        for (let k = i; k < j; k++) {
          segments.push({ kind: 'line', line: lines[k], index: k })
        }
      }
      i = j
    } else {
      segments.push({ kind: 'line', line, index: i })
      i++
    }
  }

  const addedCount = lines.filter((l) => l.type === 'added').length
  const removedCount = lines.filter((l) => l.type === 'removed').length

  return (
    <div className="text-xs font-mono">
      {/* 統計バー */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-50 border-b border-gray-100 text-gray-500">
        <span className="flex items-center gap-0.5 text-green-600">
          <AddIcon style={{ fontSize: 12 }} />
          {addedCount}
        </span>
        <span className="flex items-center gap-0.5 text-red-500">
          <RemoveIcon style={{ fontSize: 12 }} />
          {removedCount}
        </span>
      </div>

      {/* 差分行 */}
      <div className="overflow-auto max-h-96">
        {segments.map((seg, idx) => {
          if (seg.kind === 'collapsed') {
            return (
              <div
                key={`collapsed-${idx}`}
                className="px-4 py-1 bg-gray-50 text-gray-400 text-center select-none border-y border-gray-100"
              >
                ··· {seg.count} 行省略 ···
              </div>
            )
          }
          const { line } = seg
          return (
            <div
              key={`line-${seg.index}`}
              className={`flex items-start min-h-[1.5rem] ${
                line.type === 'added'
                  ? 'bg-green-50'
                  : line.type === 'removed'
                    ? 'bg-red-50'
                    : 'bg-white'
              }`}
            >
              <span
                className={`w-6 flex-shrink-0 text-center select-none py-0.5 ${
                  line.type === 'added'
                    ? 'text-green-500 bg-green-100'
                    : line.type === 'removed'
                      ? 'text-red-400 bg-red-100'
                      : 'text-gray-300 bg-gray-50'
                }`}
              >
                {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
              </span>
              <span
                className={`px-3 py-0.5 whitespace-pre-wrap break-all flex-1 ${
                  line.type === 'added'
                    ? 'text-green-900'
                    : line.type === 'removed'
                      ? 'text-red-700 line-through opacity-75'
                      : 'text-gray-700'
                }`}
              >
                {line.text || ' '}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
