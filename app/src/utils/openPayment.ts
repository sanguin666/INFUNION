import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Opens a payment page (Stripe Checkout, the card update page).
 *
 * On iPhone it goes to Safari itself, outside the app: Apple only lets apps
 * that aren't approved nonprofits take contributions outside the App Store
 * payment system when the payment happens in Safari, not in a browser
 * window inside the app (App Review Guidelines 3.2.1 vi / 3.2.2 iv).
 * Android keeps the in-app browser tab, which Google Play allows for
 * contributions. Screens poll the backend for the result either way, so
 * coming back to the app works the same.
 */
export async function openPayment(url: string): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL(url);
    return;
  }
  await WebBrowser.openBrowserAsync(url);
}
