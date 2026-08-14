import React from 'react'
import { ErrorFallback } from './ErrorFallback'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Fallback personalizado. Si no se pasa, usa ErrorFallback. */
  fallback?: React.ReactNode
}

/**
 * Captura errores de render en el árbol de componentes hijos.
 * Sin este componente, cualquier error = pantalla blanca en producción.
 * Debe ser una class component — React no permite hooks en error boundaries.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // En producción, aquí se enviaría a Sentry o similar
    console.warn('[ErrorBoundary] Error capturado:', error.message, info.componentStack?.slice(0, 200))
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      )
    }
    return this.props.children
  }
}
