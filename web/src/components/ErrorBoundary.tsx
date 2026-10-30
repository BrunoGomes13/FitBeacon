import { Component, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    console.error('Erro inesperado na interface FitBeacon.', { name: error.name });
  }

  private retry = (): void => {
    this.setState({ failed: false });
  };

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="grid min-h-[100dvh] place-items-center px-4 py-8">
          <section className="panel w-full max-w-lg p-6">
            <AlertCircle aria-hidden="true" className="mb-3 text-danger" size={24} />
            <h1 className="m-0 text-xl font-semibold">Algo deu errado</h1>
            <p className="mb-5 mt-2 text-sm text-muted">A tela não pôde ser exibida. Tente novamente.</p>
            <button className="btn btn-primary" onClick={this.retry} type="button">
              <RefreshCw aria-hidden="true" size={16} /> Tentar novamente
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
