import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStoredItem } from './src/storage/legacyKeys';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AddPlaceScreen } from './src/screens/AddPlaceScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ScanQRScreen } from './src/screens/ScanQRScreen';
import { NearbyScreen } from './src/screens/NearbyScreen';
import { PoiHubScreen } from './src/screens/PoiHubScreen';
import { PhoneLoginScreen } from './src/screens/PhoneLoginScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { ReligiousConsentSheet } from './src/components/ReligiousConsentSheet';
import { PlaceSwitcher } from './src/components/PlaceSwitcher';
import { IntroAnimation } from './src/components/IntroAnimation';
import { UpdateBanner } from './src/updates/UpdateBanner';
import { PreviewApp, previewPoiId } from './src/preview/PreviewApp';
import { I18nProvider, useI18n } from './src/i18n/I18nContext';
import {
  enablePush,
  followAsGuest,
  onNotificationTapped,
  refreshPush,
  unfollowAsGuest,
  type PushTarget,
} from './src/notifications/push';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import {
  joinPoi,
  leavePoi,
  needsReligiousConsent,
  setLastActivePoi,
} from './src/api/auth';
import { getPoi } from './src/api/pois';
import { forgetPlace, getSavedPlaces, rememberPlace, toSaved, type SavedPlace } from './src/storage/savedPlaces';
import { landingPoi } from './src/landing';
import { getGuestChoice, setGuestChoice } from './src/storage/session';
import { applyColorScheme, colors } from './src/theme/theme';
import { poiAccent } from './src/theme/poiThemes';
import { installDesktopFrame } from './src/web/desktopFrame';
import { AppearanceProvider, useAppearance } from './src/theme/AppearanceContext';
import type { Poi } from './src/api/types';
import type { MapPlace, Origin } from './src/api/placesMap';

// Set once this phone has been asked about notifications, so the question
// comes up the first time someone is signed in and never again uninvited.
const PUSH_ASKED_KEY = 'infunion.push.asked.v1';

type Route =
  | { name: 'addPlace' }
  | { name: 'scan' }
  | { name: 'nearby'; origin: Origin | null; query?: string }
  // `signUp` only changes the screen's title: the backend makes an account
  // on the first code that verifies either way.
  | { name: 'signIn'; signUp?: boolean }
  | { name: 'hub'; poi: Poi };

/**
 * Small hand-rolled navigation stack instead of react-navigation: the app
 * only has a handful of screens so far, and this keeps native dependencies
 * to a minimum for the demo. Revisit if the screen count grows.
 *
 * The welcome screen asks first: sign up, sign in, or continue without an
 * account (Seb, 9 Nov 2026, in place of the demo account). Without one,
 * every community can be found and read; whatever needs a person (posting,
 * contributing, notifications) asks to sign in where it is. Signing out
 * empties the stack back to the welcome screen.
 */
function AppRoutes() {
  const { ready, me, refresh } = useAuth();
  // Read so that a switch between light and dark repaints every screen.
  // Dark mode is for the signed-in app only: the welcome and sign-in
  // screens stay light whatever the phone or the choice says.
  const { scheme: wanted } = useAppearance();
  const scheme = me ? wanted : 'light';
  const [stack, setStack] = useState<Route[]>([]);
  // Whether the opening route has been worked out for this session. The
  // stack alone can't say: "empty" is also what signing out leaves.
  // Who the opening route was worked out for: the account's id, 'guest',
  // or null when it still has to be (at launch, after signing in or out,
  // after leaving the place on screen).
  const [landedAs, setLandedAs] = useState<string | null>(null);
  // Whether this device chose to go on without an account; null until
  // read back, so the welcome screen doesn't flash at a returning guest.
  const [guest, setGuest] = useState<boolean | null>(null);
  const loaded = ready && guest !== null;
  // The community a guest was looking at, so that signing up from inside
  // it lands them back in it as a member rather than on "add a community".
  const guestPoiRef = useRef<Poi | null>(null);
  const current = stack[stack.length - 1];
  // Inside a place, its own accent; everywhere else infunion's purple.
  applyColorScheme(scheme, current?.name === 'hub' ? poiAccent(current.poi) : 'purple');
  const { language } = useI18n();
  // The hearts opening plays once per launch, over whatever is loading
  // underneath, so it never holds anything up.
  const [introDone, setIntroDone] = useState(false);
  // What a tapped notification asked to open, handed to the place's hub.
  // `nonce` makes tapping the same notification twice open it twice.
  const [pushTarget, setPushTarget] = useState<(PushTarget & { nonce: number }) | null>(null);
  const currentPoiId = current?.name === 'hub' ? current.poi.id : null;
  const currentPoiRef = useRef<string | null>(null);
  currentPoiRef.current = currentPoiId;

  // Notifications follow the signed-in person: ask the first time, and
  // register again on every launch and language change so the backend
  // writes to this phone in the language it is set to.
  useEffect(() => {
    if (!me) return;
    (async () => {
      const asked = await getStoredItem(PUSH_ASKED_KEY).catch(() => null);
      if (asked) {
        await refreshPush(language);
      } else {
        await AsyncStorage.setItem(PUSH_ASKED_KEY, '1').catch(() => undefined);
        await enablePush(language);
      }
    })().catch(() => undefined);
  }, [me?.id, language]);

  // Without an account, the same question comes up the first time a
  // community is open, and the phone then follows each community opened
  // (Seb, 9 Nov 2026): news and event bells reach guests too.
  useEffect(() => {
    if (me || !guest || !currentPoiId) return;
    const poiId = currentPoiId;
    (async () => {
      const asked = await getStoredItem(PUSH_ASKED_KEY).catch(() => null);
      if (asked) {
        await refreshPush(language);
      } else {
        await AsyncStorage.setItem(PUSH_ASKED_KEY, '1').catch(() => undefined);
        await enablePush(language);
      }
      await followAsGuest(poiId, language);
    })().catch(() => undefined);
  }, [me?.id, guest, currentPoiId, language]);

  // The places this device has visited, merged under the ones the account
  // carries, so the switcher shows both.
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [switchFailed, setSwitchFailed] = useState(false);
  // The church whose question is on screen: joining it records religious
  // belief, so the backend wants an explicit yes first.
  const [consentPoi, setConsentPoi] = useState<Poi | null>(null);
  // Until the current terms are accepted, that is the only screen.
  const consenting = !!me?.consentRequired;

  useEffect(() => {
    let cancelled = false;
    getSavedPlaces().then((saved) => {
      if (cancelled) return;
      const fromAccount: SavedPlace[] = (me?.pois ?? []).map(toSaved);
      const extra = saved.filter((place) => !fromAccount.some((mine) => mine.id === place.id));
      setPlaces([...fromAccount, ...extra]);
    });
    return () => {
      cancelled = true;
    };
  }, [me]);

  useEffect(() => {
    getGuestChoice().then(setGuest, () => setGuest(false));
  }, []);

  // A guest who signs in is a guest no more.
  useEffect(() => {
    if (me && guest) {
      setGuest(false);
      void setGuestChoice(false);
    }
  }, [me?.id, guest]);

  useEffect(() => {
    if (!me && current?.name === 'hub') guestPoiRef.current = current.poi;
  }, [me, current]);

  // Where the app opens. Runs once the stored session has been checked,
  // and again after signing in or out, since both change the answer.
  useEffect(() => {
    if (!loaded) return;

    if (!me) {
      if (!guest) {
        setStack([]);
        setLandedAs(null);
        return;
      }
      if (landedAs === 'guest') return;
      // Without an account: the community last opened on this device,
      // or the screen to find one.
      setLandedAs('guest');
      getSavedPlaces()
        .then(async ([last]) => (last ? getPoi(last.id) : null))
        .catch(() => null)
        .then((poi) => setStack(poi ? [{ name: 'hub', poi }] : [{ name: 'addPlace' }]));
      return;
    }
    // Landing waits for the terms, so the church question below comes after.
    if (landedAs === me.id || me.consentRequired) return;

    setLandedAs(me.id);
    const poi = landingPoi(me);
    // Signed up while looking at a community as a guest: back into it,
    // now joining it.
    const browsed = guestPoiRef.current;
    guestPoiRef.current = null;
    if (!poi && browsed) {
      openPoi(browsed);
      return;
    }
    setStack(poi ? [{ name: 'hub', poi }] : [{ name: 'addPlace' }]);
    // A church membership from before the religious-data question is asked
    // here once; joining again is harmless for everyone else.
    if (poi) {
      joinPoi(poi.qrCodeToken).catch((error) => {
        if (needsReligiousConsent(error)) setConsentPoi(poi);
      });
    }
  }, [loaded, me, guest, landedAs]);

  function continueAsGuest() {
    setGuest(true);
    void setGuestChoice(true);
  }

  // Back from "add a community" with nowhere else to go: a guest returns
  // to the welcome screen.
  function backToWelcome() {
    setGuest(false);
    void setGuestChoice(false);
  }

  function startSignIn() {
    push({ name: 'signIn' });
  }

  function push(route: Route) {
    setStack((s) => [...s, route]);
  }

  function pop() {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }

  /**
   * Entering a place replaces the stack rather than growing it: with the
   * banner's back chevron gone, switching places over and over would
   * otherwise pile up routes nothing can pop.
   */
  function openPoi(poi: Poi) {
    rememberPlace(poi).then(setPlaces);
    setStack([{ name: 'hub', poi }]);
    closeSwitcher();
    // A guest only keeps the community on this device.
    if (!me) return;
    // Entering a place is also joining it and marking it as where this
    // person was last, so both follow the account rather than the device.
    // Either failing is harmless — the device list below still remembers
    // the place, exactly as it did before there were accounts.
    // A church asks first; see agreeToJoin below.
    joinPoi(poi.qrCodeToken)
      .then(() => setLastActivePoi(poi.id))
      .then(() => refresh())
      .catch((error) => {
        if (needsReligiousConsent(error)) setConsentPoi(poi);
      });
  }

  async function agreeToJoin(poi: Poi) {
    await joinPoi(poi.qrCodeToken, true);
    setConsentPoi(null);
    await setLastActivePoi(poi.id).catch(() => undefined);
    await refresh();
  }

  /**
   * "Not now" keeps the place open to read, but it is not one of their
   * places: a membership from before the question is ended, since it can't
   * be kept without the agreement.
   */
  function declineToJoin(poi: Poi) {
    setConsentPoi(null);
    if (!me?.pois.some((mine) => mine.id === poi.id)) return;
    leavePoi(poi.id)
      .then(() => forgetPlace(poi.id))
      .then(setPlaces)
      .then(() => refresh())
      .catch(() => undefined);
  }

  // A place picked on the map or in "near you": what the map knows is a
  // public summary, so the place itself is fetched before entering it.
  async function openMapPlace(place: MapPlace) {
    openPoi(await getPoi(place.id));
  }

  /**
   * Leaving the place somebody is currently in. The membership goes
   * first, then the device's own copy, and only then does the app work
   * out where to go: clearing `landedAs` hands that back to the effect
   * above, which lands on another place or on the add-a-place screen
   * exactly as it would at launch.
   *
   * Anything failing here is left to throw — the menu that called this
   * is the one showing the error, and it should not say "done" over a
   * membership that is still there.
   */
  async function leaveCurrentPoi(poi: Poi) {
    if (me) await leavePoi(poi.id);
    else await unfollowAsGuest(poi.id).catch(() => undefined);
    setPlaces(await forgetPlace(poi.id));
    if (me) await refresh();
    else guestPoiRef.current = null;
    setLandedAs(null);
  }

  // A tapped notification opens its place first, when it isn't the one
  // on screen, then the news item, request or event inside it.
  useEffect(() => {
    if (!me) return;
    return onNotificationTapped((target) => {
      const open = () => setPushTarget({ ...target, nonce: Date.now() });
      if (currentPoiRef.current === target.poiId) {
        open();
        return;
      }
      getPoi(target.poiId)
        .then((poi) => {
          openPoi(poi);
          open();
        })
        .catch(() => undefined);
    });
  }, [me?.id]);

  // Android's back button for everything outside a place: the switcher
  // closes first, then the stack pops. Returning false at the bottom of
  // the stack leaves the press to Android, which closes the app. The hub
  // registers its own handler for the screens inside a place.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (switcherOpen) {
        closeSwitcher();
        return true;
      }
      if (stack.length > 1) {
        pop();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [switcherOpen, stack.length]);

  function closeSwitcher() {
    setSwitcherOpen(false);
    setSwitchingTo(null);
    setSwitchFailed(false);
  }

  // Only the place's id is on the device, and it may have been renamed
  // since, so re-open it from the server rather than the cached copy.
  async function selectPlace(place: SavedPlace) {
    setSwitchingTo(place.id);
    setSwitchFailed(false);
    try {
      openPoi(await getPoi(place.id));
    } catch {
      setSwitchingTo(null);
      setSwitchFailed(true);
    }
  }

  // Light text up there over the camera and in dark mode. Not "auto":
  // that follows the phone, which is wrong when the app was set to
  // light or dark by hand.
  const statusBarStyle = current?.name === 'scan' || scheme === 'dark' ? 'light' : 'dark';

  return (
    <>
      {/* Nothing is decided until the stored session has been read back;
          flashing the welcome screen at somebody who is signed in is
          worse than a moment of nothing. */}
      {(!loaded || (guest && !me && stack.length === 0)) && (
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {loaded && !me && !guest && current?.name !== 'signIn' && (
        <OnboardingScreen
          onSignUp={() => push({ name: 'signIn', signUp: true })}
          onSignIn={startSignIn}
          onGuest={continueAsGuest}
        />
      )}

      {loaded && consenting && <ConsentScreen />}

      {loaded && current?.name === 'signIn' && (
        <PhoneLoginScreen
          signUp={current.signUp}
          onBack={() => setStack((s) => s.filter((route) => route.name !== 'signIn'))}
          // Where to go next is not this screen's business: signing in
          // changes `me`, and the effect above lands the app.
          onSignedIn={() => setStack([])}
        />
      )}

      {loaded && !consenting && current?.name === 'addPlace' && (
        <AddPlaceScreen
          onScanQR={() => push({ name: 'scan' })}
          onOpenPoi={openPoi}
          onFindNearby={(origin) => push({ name: 'nearby', origin })}
          onFindByName={(query) => push({ name: 'nearby', origin: null, query })}
          onBack={
            stack.length > 1
              ? pop
              : places.length > 0
                ? () => setSwitcherOpen(true)
                : !me
                  ? backToWelcome
                  : undefined
          }
        />
      )}

      {loaded && !consenting && current?.name === 'nearby' && (
        <NearbyScreen
          key={current.query ?? `${current.origin?.latitude},${current.origin?.longitude}`}
          origin={current.origin}
          query={current.query}
          onOpenPlace={openMapPlace}
          onFindNearby={(origin) => push({ name: 'nearby', origin })}
          onBack={pop}
        />
      )}

      {loaded && !consenting && current?.name === 'scan' && <ScanQRScreen onBack={pop} onFound={openPoi} />}

      {loaded && !consenting && current?.name === 'hub' && (
        /* Keyed by the place, so entering a different one starts on its
           own home tab rather than wherever the last place was left —
           landing on another place's "More" menu after leaving one reads
           as nothing having happened. */
        <PoiHubScreen
          key={current.poi.id}
          poi={current.poi}
          onOpenPlaces={() => setSwitcherOpen(true)}
          onAddPlace={() => push({ name: 'addPlace' })}
          onLeavePlace={() => leaveCurrentPoi(current.poi)}
          onSignIn={startSignIn}
          onSignUp={() => push({ name: 'signIn', signUp: true })}
          pushTarget={pushTarget?.poiId === current.poi.id ? pushTarget : null}
        />
      )}

      {/* Reachable from the hub's banner and from the add-a-place screen
          alike, so it lives outside both rather than inside either. */}
      {loaded && !consenting && (me || guest) && (
        <PlaceSwitcher
          visible={switcherOpen}
          places={places}
          currentPoiId={current?.name === 'hub' ? current.poi.id : ''}
          busyPlaceId={switchingTo}
          failed={switchFailed}
          onSelect={selectPlace}
          onAddPlace={() => {
            closeSwitcher();
            push({ name: 'addPlace' });
          }}
          onClose={closeSwitcher}
        />
      )}

      <ReligiousConsentSheet
        poiName={consentPoi?.name ?? null}
        onAgree={() => (consentPoi ? agreeToJoin(consentPoi) : Promise.resolve())}
        onDecline={() => consentPoi && declineToJoin(consentPoi)}
      />

      {/* Over everything, once the opening animation is over. */}
      <UpdateBanner hidden={!introDone} />

      {!introDone && <IntroAnimation onDone={() => setIntroDone(true)} />}

      <StatusBar style={statusBarStyle} />
    </>
  );
}

// AuthProvider has to sit above anything calling useAuth, so the routes
// live in their own component rather than in App itself.
installDesktopFrame();

export default function App() {
  // Inside the dashboard's phone frame, the app shows one place and
  // nothing else: no welcome, no sign-in.
  const preview = previewPoiId();
  return (
    <SafeAreaProvider>
      {/* The dashboard's preview stays light, like the dashboard around it. */}
      <AppearanceProvider forced={preview ? 'light' : undefined}>
        <I18nProvider>
          <AuthProvider>
            {preview ? <PreviewApp poiId={preview} /> : <AppRoutes />}
          </AuthProvider>
        </I18nProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}
