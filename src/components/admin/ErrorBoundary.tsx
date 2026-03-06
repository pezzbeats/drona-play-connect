import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <GlassCard className="p-8 text-center max-w-md">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h2 className="font-display text-xl font-bold text-foreground mb-2">Something went wrong</h2>
            <p className="text-muted-foreground text-sm mb-4">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <Button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
              <RefreshCw className="h-4 w-4 mr-2" /> Reload Page
            </Button>
          </GlassCard>
        </div>
      );
    }
    return this.props.children;
  }
}
