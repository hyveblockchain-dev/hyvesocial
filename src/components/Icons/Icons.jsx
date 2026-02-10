// src/components/Icons/Icons.jsx
// Premium custom SVG icon library for Hyve Social
// All icons are 24x24 viewBox by default with currentColor fill

const defaultProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
};

function svg(props, children) {
  const { size, ...rest } = props;
  const merged = { ...defaultProps, ...rest };
  if (size) {
    merged.width = size;
    merged.height = size;
  }
  return <svg {...merged}>{children}</svg>;
}

// ─── Navigation & UI Icons ──────────────────────────────────────

export function IconSearch(props) {
  return svg(props, (
    <>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconHome(props) {
  return svg(props, (
    <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V10.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  ));
}

export function IconFeed(props) {
  return svg(props, (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9h18M9 9v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconUser(props) {
  return svg(props, (
    <>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 21v-1a6 6 0 0112 0v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconUsers(props) {
  return svg(props, (
    <>
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M2 21v-1a5 5 0 0110 0v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 21v-.5a4 4 0 00-5-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ));
}

export function IconChat(props) {
  return svg(props, (
    <>
      <path d="M21 12a9 9 0 01-9 9 9.08 9.08 0 01-4.36-1.12L3 21l1.12-4.64A9 9 0 1121 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ));
}

export function IconBell(props) {
  return svg(props, (
    <>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconClose(props) {
  return svg(props, (
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  ));
}

export function IconCheck(props) {
  return svg(props, (
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  ));
}

export function IconPhoto(props) {
  return svg(props, (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ));
}

export function IconVideo(props) {
  return svg(props, (
    <>
      <rect x="2" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 10l6-3v10l-6-3V10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ));
}

export function IconSmile(props) {
  return svg(props, (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </>
  ));
}

export function IconShare(props) {
  return svg(props, (
    <>
      <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16 6 12 2 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="2" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconLike(props) {
  return svg(props, (
    <path d="M7 22V11l-4-1v12h4zm2-11l3-9a2 2 0 012 2v4h5.5a2 2 0 012 2.2l-1.5 9A2 2 0 0118 22H9V11z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  ));
}

export function IconHeart(props) {
  return svg(props, (
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" fill={props.filled ? 'currentColor' : 'none'} strokeLinecap="round" strokeLinejoin="round" />
  ));
}

export function IconComment(props) {
  return svg(props, (
    <>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ));
}

export function IconLogout(props) {
  return svg(props, (
    <>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconMoon(props) {
  return svg(props, (
    <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  ));
}

export function IconSun(props) {
  return svg(props, (
    <>
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconMailbox(props) {
  return svg(props, (
    <>
      <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
      <polyline points="22 7 12 13 2 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ));
}

export function IconSparkles(props) {
  return svg(props, (
    <>
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <path d="M19 15l.88 2.12L22 18l-2.12.88L19 21l-.88-2.12L16 18l2.12-.88L19 15z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </>
  ));
}

export function IconTrash(props) {
  return svg(props, (
    <>
      <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ));
}

export function IconGroup(props) {
  return svg(props, (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2" />
    </>
  ));
}

export function IconDiscover(props) {
  return svg(props, (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
    </>
  ));
}

export function IconPlus(props) {
  return svg(props, (
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  ));
}

export function IconSend(props) {
  return svg(props, (
    <>
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22l-4-9-9-4L22 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </>
  ));
}

export function IconSettings(props) {
  return svg(props, (
    <>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" />
    </>
  ));
}

export function IconLock(props) {
  return svg(props, (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconGlobe(props) {
  return svg(props, (
    <>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="2" />
    </>
  ));
}

export function IconPin(props) {
  return svg(props, (
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" />
    </>
  ));
}

export function IconBriefcase(props) {
  return svg(props, (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconCalendar(props) {
  return svg(props, (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
    </>
  ));
}

export function IconLink(props) {
  return svg(props, (
    <>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconShield(props) {
  return svg(props, (
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  ));
}

export function IconEdit(props) {
  return svg(props, (
    <>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ));
}

export function IconConstruction(props) {
  return svg(props, (
    <>
      <path d="M2 20h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 20V8l7-5 7 5v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="9" y="12" width="6" height="8" stroke="currentColor" strokeWidth="2" />
    </>
  ));
}

export function IconArrowLeft(props) {
  return svg(props, (
    <>
      <line x1="19" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <polyline points="12 19 5 12 12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ));
}

export function IconInbox(props) {
  return svg(props, (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ));
}

export function IconImage(props) {
  return svg(props, (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ));
}

export function IconFilter(props) {
  return svg(props, (
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  ));
}

export function IconMoreHorizontal(props) {
  return svg(props, (
    <>
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    </>
  ));
}

export function IconCamera(props) {
  return svg(props, (
    <>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2" />
    </>
  ));
}

export function IconUpload(props) {
  return svg(props, (
    <>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconBookmark(props) {
  return svg(props, (
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  ));
}

export function IconInfo(props) {
  return svg(props, (
    <>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
    </>
  ));
}

export function IconUserPlus(props) {
  return svg(props, (
    <>
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
      <line x1="20" y1="8" x2="20" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="23" y1="11" x2="17" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconUserMinus(props) {
  return svg(props, (
    <>
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
      <line x1="23" y1="11" x2="17" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ));
}

export function IconMessageCircle(props) {
  return svg(props, (
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  ));
}

export function IconEye(props) {
  return svg(props, (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </>
  ));
}

export function IconZap(props) {
  return svg(props, (
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
  ));
}

export function IconTrendingUp(props) {
  return svg(props, (
    <>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ));
}

export function IconChevronDown(props) {
  return svg(props, (
    <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  ));
}

export function IconChevronRight(props) {
  return svg(props, (
    <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  ));
}

export function IconRefresh(props) {
  return svg(props, (
    <>
      <polyline points="23 4 23 10 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ));
}

// ─── Convenience aliases (suffix-style naming) ──────────────────
export const SearchIcon = IconSearch;
export const BellIcon = IconBell;
export const MoonIcon = IconMoon;
export const SunIcon = IconSun;
export const PlugIcon = IconLogout;
export const FeedIcon = IconFeed;
export const UserIcon = IconUser;
export const UsersIcon = IconUsers;
export const ChatIcon = IconChat;
export const DiscoverIcon = IconDiscover;
export const GroupsIcon = IconGroup;
export const CameraIcon = IconPhoto;
export const VideoIcon = IconVideo;
export const SmileIcon = IconSmile;
export const ShareIcon = IconShare;
export const ThumbsUpIcon = IconLike;
export const HeartIcon = IconHeart;
export const CloseIcon = IconClose;
export const CheckIcon = IconCheck;
export const StarIcon = IconSparkles;
export const MailIcon = IconMailbox;
export const TrashIcon = IconTrash;
export const PlusIcon = IconPlus;
export const CommentIcon = IconComment;
