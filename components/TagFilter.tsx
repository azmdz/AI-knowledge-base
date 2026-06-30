'use client'

import Link from 'next/link'

type TagFilterProps = {
  tags: { name: string; count: number }[]
  current?: string
  sort?: string
}

export function TagFilter({ tags, current, sort = 'newest' }: TagFilterProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">タグ</p>
      <ul className="space-y-1">
        <li>
          <Link
            href={`/?sort=${sort}`}
            className={`block w-full text-left text-sm px-2 py-1 rounded-lg transition-colors ${
              !current
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            すべて
          </Link>
        </li>
        {tags.map((tag) => {
          const params = new URLSearchParams({ sort, tag: tag.name })
          return (
            <li key={tag.name}>
              <Link
                href={`/?${params}`}
                className={`flex items-center justify-between text-sm px-2 py-1 rounded-lg transition-colors ${
                  current === tag.name
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">{tag.name}</span>
                <span className="text-xs text-gray-400 ml-1 flex-shrink-0">{tag.count}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
