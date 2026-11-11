import { Navigate, useParams } from 'react-router';
import { RequestState } from '../shared/FeatureUI.jsx';
import { useResource } from '../shared/useResource.js';

// /my-games/:gameId has no screen of its own: drafts open in the editor, published games on their
// public page.
export function MyGameRedirect() {
  const { gameId } = useParams();
  const resource = useResource(`/games/${gameId}`);
  return (
    <RequestState resource={resource}>
      {resource.data && (
        <Navigate
          replace
          to={resource.data.status === 'draft' ? `/my-games/${gameId}/edit` : `/games/${gameId}`}
        />
      )}
    </RequestState>
  );
}
