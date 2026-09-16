import React from 'react';
import { Text } from 'react-native';
import { Platform } from 'react-native';
import { appendLog } from '../services/diagnosticsLog';
import { Screen, Button } from '../theme/components';
import { typography, spacing } from '../theme/tokens';
// resolveJsonModule is enabled in tsconfig.json, so this reads the real app version
// without adding an expo-constants dependency just for this.
import { version as appVersion } from '../../package.json';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const header = `CRASH app=${appVersion} os=${Platform.OS} ${Platform.Version}`;
    const detail = `${error.stack || error.message}\n${info.componentStack}`;
    appendLog(`${header}\n${detail}`).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <Screen>
          <Text style={typography.h1}>Something went wrong</Text>
          <Text style={[typography.body, { marginTop: spacing.md }]}>
            The app hit an unexpected error. A diagnostic entry was saved on this device — you can review and share it from Settings → Report a Problem.
          </Text>
          <Button label="Try Again" onPress={() => this.setState({ hasError: false })} style={{ marginTop: spacing.lg }} />
        </Screen>
      );
    }
    return this.props.children;
  }
}
