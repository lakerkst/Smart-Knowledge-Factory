import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ hasError: false, message: '' })

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface p-6">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-light">
              <AlertTriangle className="h-8 w-8 text-danger" />
            </div>
            <h1 className="text-xl font-semibold text-text">Что-то пошло не так</h1>
            <p className="mt-2 text-sm text-text-muted">{this.state.message}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={this.reset}>
                Попробовать снова
              </Button>
              <Button onClick={() => { window.location.href = '/' }}>
                На главную
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
