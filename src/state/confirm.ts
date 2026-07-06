import { create } from 'zustand'

export type ConfirmVariant = 'default' | 'danger' | 'warning'

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
}

interface ConfirmState {
  open: boolean
  request: ConfirmRequest | null
  resolve: ((value: boolean) => void) | null
  ask: (req: ConfirmRequest) => Promise<boolean>
  answer: (value: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  request: null,
  resolve: null,
  ask: (req) =>
    new Promise<boolean>((resolve) => {
      get().resolve?.(false)
      set({ open: true, request: req, resolve })
    }),
  answer: (value) => {
    const { resolve } = get()
    resolve?.(value)
    set({ open: false, request: null, resolve: null })
  },
}))

/** Promise-based replacement for window.confirm(). */
export function confirmAction(messageOrOptions: string | ConfirmRequest): Promise<boolean> {
  const req: ConfirmRequest =
    typeof messageOrOptions === 'string'
      ? { title: 'Confirm', message: messageOrOptions }
      : messageOrOptions
  return useConfirmStore.getState().ask(req)
}
