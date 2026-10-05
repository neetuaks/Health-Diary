import { Alert } from 'react-native';

// Every gate in PAYWALL-SPEC §4 shows "an upgrade prompt that deep-links to the
// Paywall — never a dead-end alert." One shared helper so every gate does that
// the same way instead of each screen hand-rolling its own Alert.
export function showUpgradePrompt(navigation: any, message: string, title = 'Upgrade to unlock this') {
  Alert.alert(title, message, [
    { text: 'Not now', style: 'cancel' },
    { text: 'See Plans', onPress: () => navigation.navigate('Paywall') },
  ]);
}
