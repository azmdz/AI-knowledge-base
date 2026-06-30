'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type User = { id: string; name: string }

type UserContextType = {
  users: User[]
  currentUser: User | null
  setCurrentUser: (user: User) => void
}

const USER_KEY = 'current-user-id'

const UserContext = createContext<UserContextType>({
  users: [],
  currentUser: null,
  setCurrentUser: () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUserState] = useState<User | null>(null)

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data: User[]) => {
        setUsers(data)
        const savedId = localStorage.getItem(USER_KEY)
        const matched = data.find((u) => u.id === savedId) ?? data[0] ?? null
        setCurrentUserState(matched)
      })
      .catch(() => {})
  }, [])

  function setCurrentUser(user: User) {
    setCurrentUserState(user)
    localStorage.setItem(USER_KEY, user.id)
  }

  return (
    <UserContext.Provider value={{ users, currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useCurrentUser() {
  return useContext(UserContext)
}
