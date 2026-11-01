import { createBrowserRouter } from 'react-router';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { NotFoundPage, RouteErrorPage } from './pages/NotFoundPage.jsx';
import { PlaceholderPage } from './pages/PlaceholderPage.jsx';
import { ExplorePage } from './features/explore/ExplorePage.jsx';
import { MyGamesPage } from './features/games/MyGamesPage.jsx';
import { GamePage } from './features/games/GamePage.jsx';
import { GameEditorPage } from './features/games/GameEditorPage.jsx';
import { MyGameRedirect } from './features/games/MyGameRedirect.jsx';
import { ProfilePage } from './features/profile/ProfilePage.jsx';
import { EditProfilePage } from './features/profile/EditProfilePage.jsx';
import { FormBuilderPage } from './features/forms/FormBuilderPage.jsx';
import { FeedbackInboxPage } from './features/feedback/FeedbackInboxPage.jsx';
import { ReviewsPage, PublishedReviewPage } from './features/reviews/ReviewsPage.jsx';
import { ReviewLayout } from './features/review/ReviewLayout.jsx';
import { ReviewPage } from './features/review/ReviewPage.jsx';
import { AuthNavigation } from './pages/auth/AuthNavigation.jsx';
import { LogInPage } from './pages/auth/LogInPage.jsx';
import { SignUpPage } from './pages/auth/SignUpPage.jsx';

// Route map for the high-fidelity screens. Each placeholder names the Figma frame it should be
// built from; swap the element for the real page when it lands.
const screens = [
  { path: 'roulette', title: 'Playtest Roulette', figmaNode: '356:1636' },

  { path: 'admin', title: 'Admin: Dashboard', figmaNode: '375:1089' },
  { path: 'admin/reports', title: 'Admin: Report Queue', figmaNode: '405:1475' },
  { path: 'admin/moderation', title: 'Admin: Content Moderation', figmaNode: '405:1523' },
  { path: 'admin/users', title: 'Admin: User Management', figmaNode: '405:1571' },
  { path: 'admin/featured', title: 'Admin: Feature Games', figmaNode: '410:1481' },
  { path: 'admin/settings', title: 'Admin: Configuration', figmaNode: '410:1529' },
];

// Dev-only gallery of every base component with sample content.
const devRoutes = import.meta.env.DEV
  ? [
      {
        path: 'dev/components',
        lazy: async () => ({
          Component: (await import('./dev/ComponentGallery.jsx')).ComponentGallery,
        }),
      },
    ]
  : [];

export const routes = [
  {
    // Sign up and Log in share the shell but use their own header (Figma 232:699 and 232:744).
    element: <AppLayout navigation={<AuthNavigation />} />,
    children: [
      {
        errorElement: <RouteErrorPage />,
        children: [
          { path: 'login', element: <LogInPage /> },
          { path: 'signup', element: <SignUpPage /> },
        ],
      },
    ],
  },
  {
    // The review flow (Figma 281:685 onwards) has its own header: the logo, Playtime and Leave.
    element: <ReviewLayout />,
    children: [
      {
        errorElement: <RouteErrorPage />,
        children: [{ path: 'games/:gameId/review', element: <ReviewPage /> }],
      },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      {
        // Pathless boundary so errors render inside the shell instead of replacing it.
        errorElement: <RouteErrorPage />,
        children: [
          ...screens.map(({ title, figmaNode, ...route }) => ({
            ...route,
            element: <PlaceholderPage title={title} figmaNode={figmaNode} />,
          })),
          { index: true, element: <ExplorePage /> },
          { path: 'games/:gameId', element: <GamePage /> },
          { path: 'users/:username', element: <ProfilePage /> },
          { path: 'settings/profile', element: <EditProfilePage /> },
          { path: 'my-games', element: <MyGamesPage /> },
          { path: 'my-games/new', element: <GameEditorPage /> },
          { path: 'my-games/:gameId', element: <MyGameRedirect /> },
          { path: 'my-games/:gameId/edit', element: <GameEditorPage /> },
          { path: 'my-games/:gameId/form', element: <FormBuilderPage /> },
          { path: 'my-games/:gameId/feedback', element: <FeedbackInboxPage /> },
          { path: 'games/:gameId/reviews', element: <ReviewsPage /> },
          { path: 'reviews/:reviewId', element: <PublishedReviewPage /> },
          { path: 'games/:gameId/reviews/:reviewId', element: <PublishedReviewPage /> },
          ...devRoutes,
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
