"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangleIcon } from "lucide-react";

import { logger } from "@/lib/logger";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(
      "Erro capturado por ErrorBoundary",
      process.env.NODE_ENV === "development"
        ? { message: error.message, stack: error.stack, componentStack: errorInfo.componentStack }
        : undefined,
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Alert variant="destructive" className="m-4">
          <AlertTriangleIcon className="size-4" />
          <AlertTitle>Erro ao carregar este componente</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              {process.env.NODE_ENV === "development"
                ? this.state.error?.message ?? "Erro desconhecido"
                : "Ocorreu uma falha inesperada. Tente novamente."}
            </span>
            <Button variant="outline" size="sm" onClick={this.handleReset} className="w-fit">
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}
