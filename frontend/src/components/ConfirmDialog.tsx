import { useState } from 'react'

interface Props {
  isOpen: boolean
  title: string
  description: string
  confirmWord: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmDialog({ isOpen, title, description, confirmWord, onConfirm, onCancel, loading }: Props) {
  const [input, setInput] = useState('')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-4">{description}</p>
        <p className="text-sm font-medium mb-2">
          Digite <strong className="text-red-600">"{confirmWord}"</strong> para confirmar:
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-empresa-blue"
          placeholder={confirmWord}
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => { setInput(''); onCancel() }}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            disabled={input !== confirmWord || loading}
            onClick={() => { onConfirm(); setInput('') }}
            className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Aguarde...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
