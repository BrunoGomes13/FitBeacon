import { Component, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AppTheme } from '../theme';

type NativeErrorBoundaryProps = {
  children: ReactNode;
  theme: AppTheme;
};

type NativeErrorBoundaryState = {
  error: Error | null;
};

export class NativeErrorBoundary extends Component<
  NativeErrorBoundaryProps,
  NativeErrorBoundaryState
> {
  state: NativeErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): NativeErrorBoundaryState {
    return { error };
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { children, theme } = this.props;
    if (!this.state.error) return children;

    return (
      <View
        accessibilityLabel="Falha inesperada no aplicativo"
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.background,
          flex: 1,
          gap: theme.spacing.lg,
          justifyContent: 'center',
          padding: theme.spacing['2xl'],
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.typography.fontFamily.bold,
            fontSize: theme.typography.fontSize.lg,
            lineHeight: theme.typography.lineHeight.lg,
            textAlign: 'center',
          }}
        >
          O app encontrou um erro inesperado.
        </Text>
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.sm,
            lineHeight: theme.typography.lineHeight.md,
            textAlign: 'center',
          }}
        >
          Tente abrir esta tela novamente. Se o problema continuar, reinicie o app.
        </Text>
        <Pressable
          accessibilityLabel="Tentar novamente"
          accessibilityRole="button"
          onPress={this.retry}
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.md,
            justifyContent: 'center',
            minHeight: theme.sizes.controlHeight,
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <Text
            style={{
              color: theme.colors.onPrimary,
              fontFamily: theme.typography.fontFamily.semiBold,
              fontSize: theme.typography.fontSize.sm,
              lineHeight: theme.typography.lineHeight.sm,
            }}
          >
            Tentar novamente
          </Text>
        </Pressable>
      </View>
    );
  }
}
