import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { prepareGame } from './prepareGame';

const BG = '#1d2b1f';

type State =
  | { kind: 'loading'; done: number; total: number }
  | { kind: 'ready'; dir: string }
  | { kind: 'error'; message: string };

export default function App() {
  useKeepAwake();
  const [state, setState] = useState<State>({ kind: 'loading', done: 0, total: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ kind: 'loading', done: 0, total: 0 });
    prepareGame((done, total) => live && setState({ kind: 'loading', done, total }))
      .then((dir) => live && setState({ kind: 'ready', dir: dir.uri }))
      .catch((e: unknown) => live && setState({ kind: 'error', message: String(e) }));
    return () => {
      live = false;
    };
  }, [attempt]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {state.kind === 'ready' ? (
        <WebView
          style={styles.root}
          containerStyle={styles.root}
          source={{ uri: joinUri(state.dir, 'index.html') }}
          originWhitelist={['*']}
          // The game, its art and its saved progress are local files.
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          allowingReadAccessToURL={state.dir}
          javaScriptEnabled
          domStorageEnabled
          // Sound effects start on the first tap without asking.
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          // A game, not a page: no scrolling, bouncing, zooming or long-press menus.
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          setBuiltInZoomControls={false}
          textInteractionEnabled={false}
          allowsLinkPreview={false}
          setSupportMultipleWindows={false}
          // Web links (like the Design Your Pet shop) open in the phone's browser.
          onShouldStartLoadWithRequest={(req) => {
            if (/^https?:/i.test(req.url)) {
              Linking.openURL(req.url);
              return false;
            }
            return true;
          }}
          webviewDebuggingEnabled={__DEV__}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.title}>Fetch Dash</Text>
          {state.kind === 'loading' ? (
            <Text style={styles.note}>
              Getting the trail ready{state.total ? ` (${Math.round((100 * state.done) / state.total)}%)` : '…'}
            </Text>
          ) : (
            <>
              <Text style={styles.note}>The game couldn't start.</Text>
              <Pressable style={styles.button} onPress={() => setAttempt((n) => n + 1)}>
                <Text style={styles.buttonText}>Try again</Text>
              </Pressable>
              {__DEV__ && <Text style={styles.debug}>{state.message}</Text>}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function joinUri(dir: string, name: string) {
  return dir.endsWith('/') ? dir + name : `${dir}/${name}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#efe3c6', fontSize: 34, fontWeight: 'bold', marginBottom: 12 },
  note: { color: '#d9c8a2', fontSize: 18 },
  button: { marginTop: 16, backgroundColor: '#c79a3e', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  buttonText: { color: '#16202a', fontSize: 18, fontWeight: 'bold' },
  debug: { color: '#a85433', marginTop: 12, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
