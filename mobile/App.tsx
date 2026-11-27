import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { adStatusScript, ads, type AdStatus } from './ads';
import { getPlayerId, playerIdScript, type PlayerId } from './playerId';
import { prepareGame } from './prepareGame';

const BG = '#1d2b1f';
const LOGO = require('./assets/logo.webp');

type State =
  | { kind: 'loading'; done: number; total: number }
  | { kind: 'ready'; dir: string; player: PlayerId | null }
  | { kind: 'error'; message: string };

export default function App() {
  useKeepAwake();
  const [state, setState] = useState<State>({ kind: 'loading', done: 0, total: 0 });
  const [attempt, setAttempt] = useState(0);
  // WebView's extra-props type is named (<object>) so its ref type-checks
  const web = useRef<WebView<object>>(null);
  const adStatus = useRef<AdStatus>({ privacy: false });

  // Ads: Google's consent form (where required) shows over the loading
  // screen on first launch, then the first ad loads in the background.
  useEffect(() => {
    void ads.start();
    return ads.onStatus((s) => {
      adStatus.current = s;
      web.current?.injectJavaScript(adStatusScript(s));
    });
  }, []);

  useEffect(() => {
    let live = true;
    setState({ kind: 'loading', done: 0, total: 0 });
    // The player ID (for the free hero portraits) is ready before the game starts.
    Promise.all([prepareGame((done, total) => live && setState({ kind: 'loading', done, total })), getPlayerId()])
      .then(([dir, player]) => live && setState({ kind: 'ready', dir: dir.uri, player }))
      .catch((e: unknown) => live && setState({ kind: 'error', message: String(e) }));
    return () => {
      live = false;
    };
  }, [attempt]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {state.kind === 'ready' ? (
        <WebView<object>
          ref={web}
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
          // The ID goodwookie.com counts free hero portraits against (playerId.ts).
          // Given twice, in case a phone skips the early one; the game reads it late.
          injectedJavaScriptBeforeContentLoaded={playerIdScript(state.player) + adStatusScript(adStatus.current)}
          injectedJavaScript={playerIdScript(state.player)}
          // The game says when the player is between runs (src/ads.ts); ads.ts
          // shows an ad if one is due, then tells the game to carry on.
          onMessage={(e) => ads.handle(e.nativeEvent.data, (js) => web.current?.injectJavaScript(js))}
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
          <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Fetch Dash" />
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
  // Same size as the splash screen's logo on iOS, so the hand-over doesn't jump
  logo: { width: 360, maxWidth: '80%', aspectRatio: 2400 / 702, height: undefined, marginBottom: 16 },
  note: { color: '#d9c8a2', fontSize: 18 },
  button: { marginTop: 16, backgroundColor: '#c79a3e', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  buttonText: { color: '#16202a', fontSize: 18, fontWeight: 'bold' },
  debug: { color: '#a85433', marginTop: 12, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
