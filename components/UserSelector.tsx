'use client'

import PersonIcon from '@mui/icons-material/Person'
import { useCurrentUser } from '@/lib/user-context'

export function UserSelector() {
  const { users, currentUser, setCurrentUser } = useCurrentUser()

  if (!currentUser) return <div className="w-32 h-6 bg-gray-100 rounded animate-pulse" />

  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <PersonIcon style={{ fontSize: 14 }} />
      <select
        value={currentUser.id}
        onChange={(e) => {
          const user = users.find((u) => u.id === e.target.value)
          if (user) setCurrentUser(user)
        }}
        className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>
  )
}
