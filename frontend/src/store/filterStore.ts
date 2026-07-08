import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FilterState {
  competencia: string
  setCompetencia: (v: string) => void
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      competencia: '',
      setCompetencia: (v) => set({ competencia: v }),
    }),
    { name: 'dash-vi-filter' }
  )
)
