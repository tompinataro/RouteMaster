import React from 'react';
import { View, Text, Button } from 'react-native';

type Props = { children: React.ReactNode };
type State = { error?: Error };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: any) {
    // eslint-disable-next-line no-console
    console.warn('ErrorBoundary', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Something went wrong</Text>
        <Text style={{ marginBottom: 16 }}>{this.state.error.message}</Text>
        <Button title="Reload" onPress={() => this.setState({ error: undefined })} />
      </View>
    );
  }
}
