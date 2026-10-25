import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { PoiShell, hubMenu, type HubTab } from '../components/PoiShell';
import { AnnouncementsScreen } from './AnnouncementsScreen';
import { AnnouncementScreen } from './AnnouncementScreen';
import { CommunityScreen } from './CommunityScreen';
import { CommunityThreadScreen } from './CommunityThreadScreen';
import { ComposeAnnouncementScreen } from './ComposeAnnouncementScreen';
import { DonateScreen } from './DonateScreen';
import type { DonationProject } from '../api/donations';
import { EventsScreen } from './EventsScreen';
import { CalendarScreen } from './CalendarScreen';
import { LivestreamScreen } from './LivestreamScreen';
import { MassIntentionsScreen } from './MassIntentionsScreen';
import { MoreScreen } from './MoreScreen';
import { ReadingsScreen } from './ReadingsScreen';
import { MessagesScreen } from './MessagesScreen';
import { NotificationsScreen } from './NotificationsScreen';
import { PoiHomeScreen } from './PoiHomeScreen';
import { NewRequestScreen } from './NewRequestScreen';
import { PrayerRequestsScreen } from './PrayerRequestsScreen';
import { ProfileScreen } from './ProfileScreen';
import { RequestDetailScreen } from './RequestDetailScreen';
import { RequestsScreen } from './RequestsScreen';
import { useAuth } from '../auth/AuthContext';
import { getActiveModules } from '../api/pois';
import { getAnnouncements } from '../api/announcements';
import { getMessagesUnread } from '../api/messages';
import type { PushTarget } from '../notifications/push';
import type { ActiveModule, Announcement, CommunityPost, Poi } from '../api/types';

type Props = {
  poi: Poi;
  onOpenPlaces: () => void;
  onAddPlace: () => void;
  onLeavePlace: () => Promise<void>;
  onSignIn: () => void;
  // A tapped notification for this place, to open once it arrives.
  pushTarget?: (PushTarget & { nonce: number }) | null;
};

// A drill-down opened from within a tab. It replaces the tab's own content
// while the banner and tab bar stay exactly where they are — selecting any
// tab drops back to `list`.
type Drilldown =
  | { kind: 'list' }
  | { kind: 'compose-announcement' }
  | { kind: 'announcement'; item: Announcement }
  | { kind: 'community-thread'; post: CommunityPost }
  | { kind: 'new-request' }
  | { kind: 'request'; id: string }
  | { kind: 'calendar' }
  | { kind: 'notifications' }
  | { kind: 'project'; project: DonationProject };

/**
 * Everything under one POI. The banner and the bottom menu live in
 * `PoiShell` and stay mounted for the whole visit: picking a module swaps
 * only what sits between them, so the chrome never moves and the selected
 * button is the one thing that changes.
 */
export function PoiHubScreen({ poi, onOpenPlaces, onAddPlace, onLeavePlace, onSignIn, pushTarget }: Props) {
  const { isAdminOf, me } = useAuth();
  const isStaff = isAdminOf(poi.id);
  const [modules, setModules] = useState<ActiveModule[] | null>(null);
  const [tab, setTab] = useState<HubTab>('home');
  const [drilldown, setDrilldown] = useState<Drilldown>({ kind: 'list' });
  const [profileOpen, setProfileOpen] = useState(false);
  // The office wrote and the member has not opened Messages since.
  const [messagesUnread, setMessagesUnread] = useState(false);
  const messagesLive = !!modules?.some((m) => m.moduleType === 'messages' && m.status !== 'expired' && m.status !== 'cancelled');

  useEffect(() => {
    setMessagesUnread(false);
    if (!me || !messagesLive) return;
    let cancelled = false;
    const check = () =>
      getMessagesUnread(poi.id)
        .then((result) => {
          if (!cancelled) setMessagesUnread(result.unread);
        })
        .catch(() => undefined);
    check();
    const timer = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [poi.id, me, messagesLive]);

  useEffect(() => {
    let cancelled = false;
    getActiveModules(poi.id)
      .then((result) => {
        if (!cancelled) setModules(result);
      })
      // The tab bar just stays empty on a failure — the home page below
      // still renders whatever it can.
      .catch(() => {
        if (!cancelled) setModules([]);
      });
    return () => {
      cancelled = true;
    };
  }, [poi.id]);

  useEffect(() => {
    if (!pushTarget) return;
    let cancelled = false;
    setProfileOpen(false);
    switch (pushTarget.screen) {
      case 'request':
        setTab('requests');
        setDrilldown({ kind: 'request', id: pushTarget.id });
        break;
      case 'event':
        selectTab('events');
        break;
      case 'livestream':
        selectTab('livestreams');
        break;
      case 'readings':
        selectTab('daily_readings');
        break;
      case 'messages':
        selectTab('messages');
        break;
      case 'announcement':
        // The news list first, so there is something on screen at once;
        // the item itself once it has loaded.
        selectTab('announcements');
        getAnnouncements(poi.id)
          .then((items) => {
            const item = items.find((candidate) => candidate.id === pushTarget.id);
            if (item && !cancelled) setDrilldown({ kind: 'announcement', item });
          })
          .catch(() => undefined);
        break;
    }
    return () => {
      cancelled = true;
    };
  }, [pushTarget?.nonce]);

  function selectTab(next: HubTab) {
    setTab(next);
    setDrilldown({ kind: 'list' });
  }

  /**
   * One step back, innermost first: the settings sheet, then a
   * drill-down inside a tab, then the tab itself. Says whether it had
   * anywhere to go, which is what Android's back button needs to know —
   * false there lets the press fall through and close the app, which is
   * what it should do from a place's home page.
   */
  const goBack = useCallback(() => {
    if (profileOpen) {
      setProfileOpen(false);
      return true;
    }
    if (drilldown.kind !== 'list') {
      setDrilldown({ kind: 'list' });
      return true;
    }
    if (tab !== 'home') {
      selectTab('home');
      return true;
    }
    return false;
  }, [profileOpen, drilldown.kind, tab]);

  // The phone's own back button, which people who have used Android for
  // years reach for before they look at the screen. Android only; the
  // listener is a no-op elsewhere.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  }, [goBack]);

  return (
    <PoiShell
      poi={poi}
      modules={modules}
      me={me}
      activeTab={tab}
      onSelectTab={selectTab}
      messagesUnread={messagesUnread}
      onBack={tab === 'home' && drilldown.kind === 'list' ? undefined : goBack}
      onOpenPlaces={onOpenPlaces}
      onOpenProfile={() => setProfileOpen(true)}
      scrollKey={`${tab}:${drilldown.kind}:${drilldown.kind === 'project' ? projectKey(drilldown.project) : drilldown.kind === 'announcement' ? drilldown.item.id : ''}`}
    >
      <ProfileScreen
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSignIn={onSignIn}
      />

      {tab === 'home' && (
        <PoiHomeScreen
          poi={poi}
          modules={modules}
          onSelectTab={selectTab}
        />
      )}

      {tab === 'more' && drilldown.kind === 'notifications' && <NotificationsScreen poi={poi} />}

      {tab === 'more' && drilldown.kind !== 'notifications' && (
        <MoreScreen
          poi={poi}
          modules={modules}
          onSelectTab={selectTab}
          onOpenPlaces={onOpenPlaces}
          onAddPlace={onAddPlace}
          onLeavePlace={onLeavePlace}
          onOpenNotifications={() => setDrilldown({ kind: 'notifications' })}
          messagesUnread={messagesUnread}
        />
      )}

      {tab === 'donations' && (
        <DonateScreen
          key={drilldown.kind === 'project' ? projectKey(drilldown.project) : 'donate'}
          poi={poi}
          project={drilldown.kind === 'project' ? drilldown.project : null}
          onOpenProject={(project) => setDrilldown({ kind: 'project', project })}
          onDone={() => selectTab('home')}
          onSignIn={onSignIn}
        />
      )}

      {tab === 'requests' &&
        (drilldown.kind === 'new-request' ? (
          <NewRequestScreen poi={poi} onCreated={(id) => setDrilldown({ kind: 'request', id })} />
        ) : drilldown.kind === 'request' ? (
          <RequestDetailScreen key={drilldown.id} poi={poi} requestId={drilldown.id} />
        ) : (
          <RequestsScreen
            poi={poi}
            onNew={() => setDrilldown({ kind: 'new-request' })}
            onOpen={(id) => setDrilldown({ kind: 'request', id })}
            onSignIn={onSignIn}
          />
        ))}

      {tab === 'mass_intentions' && <MassIntentionsScreen poi={poi} />}

      {tab === 'daily_readings' && <ReadingsScreen poi={poi} />}

      {tab === 'messages' && (
        <MessagesScreen poi={poi} onSignIn={onSignIn} onRead={() => setMessagesUnread(false)} />
      )}

      {tab === 'events' &&
        (drilldown.kind === 'calendar' ? (
          <CalendarScreen poi={poi} />
        ) : (
          <EventsScreen
            poi={poi}
            onWatchLive={
              hubMenu(poi, modules).livestreamInEvents ? () => setTab('livestreams') : undefined
            }
            onOpenCalendar={() => setDrilldown({ kind: 'calendar' })}
          />
        ))}

      {tab === 'announcements' &&
        (drilldown.kind === 'compose-announcement' ? (
          <ComposeAnnouncementScreen
            poi={poi}
            onBack={() => setDrilldown({ kind: 'list' })}
            onCreated={() => setDrilldown({ kind: 'list' })}
          />
        ) : drilldown.kind === 'announcement' ? (
          <AnnouncementScreen key={drilldown.item.id} item={drilldown.item} />
        ) : (
          <AnnouncementsScreen
            poi={poi}
            canCompose={isStaff}
            onCompose={() => setDrilldown({ kind: 'compose-announcement' })}
            onOpen={(item) => setDrilldown({ kind: 'announcement', item })}
          />
        ))}

      {tab === 'prayer_requests' && <PrayerRequestsScreen poi={poi} onSignIn={onSignIn} />}

      {tab === 'livestreams' && <LivestreamScreen poi={poi} />}

      {tab === 'community' &&
        (drilldown.kind === 'community-thread' ? (
          <CommunityThreadScreen
            poi={poi}
            post={drilldown.post}
            onBack={() => setDrilldown({ kind: 'list' })}
            onSignIn={onSignIn}
          />
        ) : (
          <CommunityScreen
            poi={poi}
            onOpenPost={(post) => setDrilldown({ kind: 'community-thread', post })}
            onSignIn={onSignIn}
          />
        ))}
    </PoiShell>
  );
}

function projectKey(project: DonationProject): string {
  return project.kind === 'campaign' ? project.campaign.id : project.kind;
}
