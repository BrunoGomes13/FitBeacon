import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View, useColorScheme } from 'react-native';
import { BottomSheet } from '../src/components/BottomSheet';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Chip } from '../src/components/Chip';
import { EmptyState } from '../src/components/EmptyState';
import { ErrorState } from '../src/components/ErrorState';
import { Skeleton } from '../src/components/Skeleton';
import { StatCard } from '../src/components/StatCard';
import { Tabs, type TabItem } from '../src/components/Tabs';
import { Toast } from '../src/components/Toast';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { themes, type ThemeMode } from '../src/theme';

type GalleryTab = 'treino' | 'progresso';
type ScreenState = 'loading' | 'empty' | 'error' | 'success';

const galleryTabs: readonly TabItem<GalleryTab>[] = [
  { label: 'Treino', value: 'treino' },
  { label: 'Progresso', value: 'progresso' },
];

const screenStateTabs: readonly TabItem<ScreenState>[] = [
  { label: 'Carregando', value: 'loading' },
  { label: 'Vazio', value: 'empty' },
  { label: 'Erro', value: 'error' },
  { label: 'Sucesso', value: 'success' },
];

function GalleryPreview({ mode }: { mode: ThemeMode }) {
  const theme = themes[mode];

  return (
    <ThemeProvider theme={theme}>
      <PreviewContent mode={mode} />
    </ThemeProvider>
  );
}

function PreviewContent({ mode }: { mode: ThemeMode }) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<GalleryTab>('treino');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(true);

  return (
    <View
      style={{
        backgroundColor: theme.colors.background,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.xl,
        borderWidth: theme.sizes.border,
        gap: theme.spacing.lg,
        padding: theme.spacing.lg,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: theme.spacing.md,
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            flex: 1,
            fontFamily: theme.typography.fontFamily.semiBold,
            fontSize: theme.typography.fontSize.lg,
            lineHeight: theme.typography.lineHeight.lg,
          }}
        >
          Tema {mode === 'dark' ? 'escuro' : 'claro'}
        </Text>
        <Chip
          accessibilityLabel={`Tema ${mode === 'dark' ? 'escuro' : 'claro'}`}
          label={mode === 'dark' ? 'Escuro' : 'Claro'}
          selected
        />
      </View>

      <Card>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.typography.fontFamily.semiBold,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          Ações
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
          }}
        >
          <Button
            accessibilityLabel="Botão principal"
            label="Principal"
            onPress={() => setToastVisible(true)}
          />
          <Button
            accessibilityLabel="Botão secundário"
            label="Secundário"
            onPress={() => setToastVisible(true)}
            variant="secondary"
          />
          <Button
            accessibilityLabel="Botão discreto"
            label="Discreto"
            onPress={() => setToastVisible(true)}
            variant="ghost"
          />
          <Button
            accessibilityLabel="Botão carregando"
            label="Salvando"
            loading
            onPress={() => undefined}
          />
        </View>
        <Toast
          accessibilityLabel="Aviso de sucesso"
          message="Preferências atualizadas."
          visible={toastVisible}
        />
        <Button
          accessibilityLabel={toastVisible ? 'Ocultar aviso' : 'Mostrar aviso'}
          label={toastVisible ? 'Ocultar aviso' : 'Mostrar aviso'}
          onPress={() => setToastVisible(!toastVisible)}
          variant="ghost"
        />
      </Card>

      <Card>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.typography.fontFamily.semiBold,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          Navegação e filtros
        </Text>
        <Tabs
          accessibilityLabel="Abas de exemplo"
          items={galleryTabs}
          onChange={setActiveTab}
          value={activeTab}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Chip
            accessibilityLabel="Filtro todos"
            label="Todos"
            onPress={() => setActiveTab('treino')}
            selected={activeTab === 'treino'}
          />
          <Chip
            accessibilityLabel="Filtro favoritos"
            label="Favoritos"
            onPress={() => setActiveTab('progresso')}
            selected={activeTab === 'progresso'}
          />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <StatCard detail="+8% esta semana" label="Sessões" value="12" />
        <StatCard detail="Meta semanal" label="Minutos" value="180" />
      </View>

      <Card>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.typography.fontFamily.semiBold,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          Carregamento
        </Text>
        <Skeleton lines={3} />
      </Card>

      <Card>
        <EmptyState
          accessibilityLabel="Exemplo de estado vazio"
          actionLabel="Explorar exercícios"
          description="Quando houver conteúdo, ele aparecerá aqui."
          onAction={() => setToastVisible(true)}
          title="Nenhum exercício salvo"
        />
      </Card>

      <Card>
        <ErrorState
          accessibilityLabel="Exemplo de estado de erro"
          description="Confira sua conexão e tente novamente."
          onRetry={() => setToastVisible(true)}
          retryLabel="Tentar novamente"
          title="Não foi possível carregar"
        />
      </Card>

      <Card>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.typography.fontFamily.semiBold,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          Painel inferior
        </Text>
        <Button
          accessibilityLabel="Abrir painel inferior"
          label="Abrir BottomSheet"
          onPress={() => setSheetVisible(true)}
          variant="secondary"
        />
      </Card>

      <BottomSheet
        accessibilityLabel="Painel de detalhes do equipamento"
        onClose={() => setSheetVisible(false)}
        title="Detalhes do aparelho"
        visible={sheetVisible}
      >
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          Ajuste o equipamento antes de iniciar sua série.
        </Text>
      </BottomSheet>
    </View>
  );
}

function StateShowcase() {
  const theme = useTheme();
  const [state, setState] = useState<ScreenState>('success');

  return (
    <Card>
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: theme.typography.fontFamily.semiBold,
          fontSize: theme.typography.fontSize.lg,
          lineHeight: theme.typography.lineHeight.lg,
        }}
      >
        Estados da tela
      </Text>
      <Tabs
        accessibilityLabel="Estados de tela para demonstração"
        items={screenStateTabs}
        onChange={setState}
        value={state}
      />
      {state === 'loading' ? <Skeleton lines={3} /> : null}
      {state === 'empty' ? (
        <EmptyState
          accessibilityLabel="Tela sem equipamentos"
          description="Aproxime-se de um aparelho para ver os exercícios."
          title="Nenhum equipamento por perto"
        />
      ) : null}
      {state === 'error' ? (
        <ErrorState
          accessibilityLabel="Falha ao carregar equipamentos"
          description="Verifique a conexão e tente novamente."
          onRetry={() => setState('success')}
          retryLabel="Tentar novamente"
          title="Algo deu errado"
        />
      ) : null}
      {state === 'success' ? (
        <Text
          style={{
            color: theme.colors.success,
            fontFamily: theme.typography.fontFamily.medium,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          Tudo pronto: seus componentes estão disponíveis.
        </Text>
      ) : null}
    </Card>
  );
}

export default function GalleryScreen() {
  const colorScheme = useColorScheme();
  const activeTheme = colorScheme === 'dark' ? themes.dark : themes.light;

  return (
    <ThemeProvider theme={activeTheme}>
      <GalleryContent activeMode={activeTheme.mode} />
    </ThemeProvider>
  );
}

function GalleryContent({ activeMode }: { activeMode: ThemeMode }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <ScrollView
      contentContainerStyle={{
        alignItems: 'center',
        gap: theme.spacing['2xl'],
        paddingBottom: theme.spacing['4xl'],
        paddingHorizontal: theme.sizes.pagePadding,
        paddingTop: theme.sizes.pageTopPadding,
      }}
      style={{ backgroundColor: theme.colors.background, flex: 1 }}
    >
      <View
        style={{
          gap: theme.spacing.sm,
          maxWidth: theme.sizes.contentMaxWidth,
          width: theme.sizes.fullWidth,
        }}
      >
        <Text
          style={{
            color: theme.colors.primary,
            fontFamily: theme.typography.fontFamily.semiBold,
            fontSize: theme.typography.fontSize.xs,
            lineHeight: theme.typography.lineHeight.sm,
          }}
        >
          FITBEACON / GALERIA
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text,
            fontFamily: theme.typography.fontFamily.bold,
            fontSize: theme.typography.fontSize['3xl'],
            lineHeight: theme.typography.lineHeight['3xl'],
          }}
        >
          Galeria de componentes
        </Text>
        <Text
          style={{
            color: theme.colors.secondary,
            fontFamily: theme.typography.fontFamily.regular,
            fontSize: theme.typography.fontSize.md,
            lineHeight: theme.typography.lineHeight.md,
          }}
        >
          Tema do sistema: {activeMode === 'dark' ? 'escuro' : 'claro'}. A galeria abaixo
          compara os dois temas.
        </Text>
        <Button
          accessibilityLabel="Abrir diagnóstico iBeacon"
          label="Abrir diagnóstico iBeacon"
          onPress={() => router.push('/diagnostics')}
          variant="secondary"
        />
        <StateShowcase />
        <GalleryPreview mode="dark" />
        <GalleryPreview mode="light" />
      </View>
    </ScrollView>
  );
}
